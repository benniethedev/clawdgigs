// Dispute Management for ClawdGigs
// Uses PressBase for storage

const API_BASE = 'https://backend.benbond.dev/wp-json/app/v1/db';

export type DisputeStatus = 
  | 'open'           // Newly opened dispute
  | 'under_review'   // Being reviewed
  | 'ai_arbitrated'  // AI provided recommendation (needs manual review)
  | 'auto_resolved'  // AI auto-resolved (high confidence)
  | 'resolved_buyer' // Resolved in favor of buyer (refund)
  | 'resolved_seller'// Resolved in favor of seller (release)
  | 'resolved_split' // Resolved with 50/50 split
  | 'cancelled';     // Dispute cancelled by buyer

export type DisputeCategory = 
  | 'quality'
  | 'incomplete'
  | 'timing'
  | 'communication'
  | 'mismatch'
  | 'other';

export interface Dispute {
  id: string;
  order_id: string;
  escrow_id: string;
  buyer_wallet: string;
  seller_wallet: string;
  amount_usdc: number;
  category: DisputeCategory;
  reason: string;
  details?: string;
  status: DisputeStatus;
  // AI Arbitration fields
  ai_analysis?: string;
  ai_recommendation?: 'refund_buyer' | 'pay_seller' | 'partial_refund';
  ai_confidence?: number;
  ai_arbitrated_at?: string;
  auto_resolved?: boolean;  // True if AI auto-resolved this dispute
  // Resolution fields
  resolution?: 'refund_buyer' | 'pay_seller' | 'split';
  resolution_notes?: string;
  resolved_by?: string;  // 'ai_auto' for auto-resolution, 'admin' for manual
  resolved_at?: string;
  // Timestamps
  created_at: string;
  updated_at: string;
}

// API helper
async function disputeDbRequest(
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    where?: string;
    id?: string;
    data?: Record<string, unknown>;
  } = {}
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const { method = 'GET', where, id, data } = options;
  
  let url = `${API_BASE}/disputes`;
  if (id) url += `/${id}`;
  if (where && method === 'GET') url += `?where=${encodeURIComponent(where)}`;

  const headers: HeadersInit = {
    'Authorization': `Bearer ${process.env.PRESSBASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      cache: 'no-store',
    });

    const json = await res.json();
    return json;
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

// Generate a short readable ID
function generateDisputeId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'DSP-';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Create a new dispute
export async function createDispute(params: {
  orderId: string;
  escrowId: string;
  buyerWallet: string;
  sellerWallet: string;
  amountUsdc: number;
  category: DisputeCategory;
  reason: string;
  details?: string;
}): Promise<{ ok: boolean; data?: Dispute; error?: string }> {
  const now = new Date().toISOString();
  
  const disputeData = {
    id: generateDisputeId(),
    order_id: params.orderId,
    escrow_id: params.escrowId,
    buyer_wallet: params.buyerWallet,
    seller_wallet: params.sellerWallet,
    amount_usdc: params.amountUsdc,
    category: params.category,
    reason: params.reason,
    details: params.details || null,
    status: 'open' as DisputeStatus,
    ai_analysis: null,
    ai_recommendation: null,
    ai_confidence: null,
    ai_arbitrated_at: null,
    resolution: null,
    resolution_notes: null,
    resolved_by: null,
    resolved_at: null,
    created_at: now,
    updated_at: now,
  };

  const result = await disputeDbRequest({
    method: 'POST',
    data: disputeData,
  });

  if (result.ok && result.data) {
    return { ok: true, data: result.data as Dispute };
  }
  return { ok: false, error: result.error || 'Failed to create dispute' };
}

// Get dispute by ID
export async function getDispute(disputeId: string): Promise<Dispute | null> {
  const result = await disputeDbRequest({ where: `id:eq:${disputeId}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Dispute[] };
    return data.data?.[0] || null;
  }
  return null;
}

// Get dispute by order ID
export async function getDisputeByOrder(orderId: string): Promise<Dispute | null> {
  const result = await disputeDbRequest({ where: `order_id:eq:${orderId}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Dispute[] };
    return data.data?.[0] || null;
  }
  return null;
}

// Get dispute by escrow ID
export async function getDisputeByEscrow(escrowId: string): Promise<Dispute | null> {
  const result = await disputeDbRequest({ where: `escrow_id:eq:${escrowId}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Dispute[] };
    return data.data?.[0] || null;
  }
  return null;
}

// Get all open/pending disputes (for admin queue)
export async function getOpenDisputes(): Promise<Dispute[]> {
  // Get disputes that are open or under_review or ai_arbitrated
  const result = await disputeDbRequest({ where: `status:in:open,under_review,ai_arbitrated` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Dispute[] };
    return data.data || [];
  }
  return [];
}

// Get all disputes
export async function getAllDisputes(): Promise<Dispute[]> {
  const result = await disputeDbRequest({});
  if (result.ok && result.data) {
    const data = result.data as { data?: Dispute[] };
    return data.data || [];
  }
  return [];
}

// Update dispute
async function updateDispute(
  disputeId: string,
  updates: Partial<Omit<Dispute, 'id' | 'created_at'>>
): Promise<{ ok: boolean; error?: string }> {
  const result = await disputeDbRequest({
    method: 'PUT',
    id: disputeId,
    data: { ...updates, updated_at: new Date().toISOString() },
  });
  return { ok: result.ok, error: result.error };
}

// Update dispute with AI arbitration results
export async function updateDisputeAiArbitration(
  disputeId: string,
  analysis: string,
  recommendation: 'refund_buyer' | 'pay_seller' | 'partial_refund',
  confidence: number
): Promise<{ ok: boolean; error?: string }> {
  return updateDispute(disputeId, {
    status: 'ai_arbitrated',
    ai_analysis: analysis,
    ai_recommendation: recommendation,
    ai_confidence: confidence,
    ai_arbitrated_at: new Date().toISOString(),
  });
}

// Mark dispute as under review
export async function markDisputeUnderReview(disputeId: string): Promise<{ ok: boolean; error?: string }> {
  return updateDispute(disputeId, { status: 'under_review' });
}

// Resolve dispute
export async function resolveDispute(
  disputeId: string,
  resolution: 'refund_buyer' | 'pay_seller' | 'split',
  notes: string,
  resolvedBy: string = 'admin',
  autoResolved: boolean = false
): Promise<{ ok: boolean; dispute?: Dispute; error?: string }> {
  const dispute = await getDispute(disputeId);
  if (!dispute) {
    return { ok: false, error: 'Dispute not found' };
  }

  if (dispute.status === 'resolved_buyer' || dispute.status === 'resolved_seller' || dispute.status === 'resolved_split') {
    return { ok: false, error: 'Dispute already resolved' };
  }

  let newStatus: DisputeStatus;
  if (resolution === 'refund_buyer') {
    newStatus = 'resolved_buyer';
  } else if (resolution === 'pay_seller') {
    newStatus = 'resolved_seller';
  } else {
    newStatus = 'resolved_split';
  }

  const result = await updateDispute(disputeId, {
    status: newStatus,
    resolution,
    resolution_notes: notes,
    resolved_by: resolvedBy,
    resolved_at: new Date().toISOString(),
    auto_resolved: autoResolved,
  });

  if (result.ok) {
    const updatedDispute = await getDispute(disputeId);
    return { ok: true, dispute: updatedDispute || undefined };
  }
  return { ok: false, error: result.error };
}

// Auto-resolve dispute based on AI recommendation (called when confidence > 85%)
export async function autoResolveDispute(
  disputeId: string,
  aiRecommendation: 'refund_buyer' | 'pay_seller' | 'partial_refund',
  confidence: number,
  analysis: string
): Promise<{ ok: boolean; dispute?: Dispute; error?: string }> {
  // Map AI recommendation to resolution
  const resolution: 'refund_buyer' | 'pay_seller' | 'split' = 
    aiRecommendation === 'refund_buyer' ? 'refund_buyer' :
    aiRecommendation === 'pay_seller' ? 'pay_seller' : 'split';

  const notes = `[AI Auto-Resolution - ${confidence}% confidence]\n\n${analysis}`;
  
  return resolveDispute(disputeId, resolution, notes, 'ai_auto', true);
}

// Check if dispute should be auto-resolved
export function shouldAutoResolve(confidence: number): boolean {
  return confidence >= 85; // Auto-resolve if confidence is 85% or higher
}

// Cancel dispute (by buyer)
export async function cancelDispute(disputeId: string): Promise<{ ok: boolean; error?: string }> {
  const dispute = await getDispute(disputeId);
  if (!dispute) {
    return { ok: false, error: 'Dispute not found' };
  }

  if (dispute.status !== 'open' && dispute.status !== 'under_review') {
    return { ok: false, error: 'Cannot cancel dispute in current status' };
  }

  return updateDispute(disputeId, { status: 'cancelled' });
}

// Get status display info
export function getDisputeStatusInfo(status: DisputeStatus): {
  label: string;
  color: string;
  bgColor: string;
  description: string;
} {
  const statusInfo: Record<DisputeStatus, { label: string; color: string; bgColor: string; description: string }> = {
    open: {
      label: 'Open',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      description: 'Awaiting review',
    },
    under_review: {
      label: 'Under Review',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      description: 'Being reviewed by team',
    },
    ai_arbitrated: {
      label: 'AI Reviewed',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      description: 'AI provided recommendation (needs approval)',
    },
    auto_resolved: {
      label: 'AI Auto-Resolved',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
      description: 'AI automatically resolved (high confidence)',
    },
    resolved_buyer: {
      label: 'Refunded',
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      description: 'Buyer received refund',
    },
    resolved_seller: {
      label: 'Paid to Seller',
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      description: 'Seller received payment',
    },
    resolved_split: {
      label: '50/50 Split',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      description: 'Funds split between buyer and seller',
    },
    cancelled: {
      label: 'Cancelled',
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/20',
      description: 'Dispute was cancelled',
    },
  };

  return statusInfo[status] || statusInfo.open;
}

// Get category display label
export function getCategoryLabel(category: DisputeCategory): string {
  const labels: Record<DisputeCategory, string> = {
    quality: 'Quality Issues',
    incomplete: 'Incomplete Delivery',
    timing: 'Missed Deadline',
    communication: 'Communication Problems',
    mismatch: 'Not as Described',
    other: 'Other',
  };
  return labels[category] || category;
}
