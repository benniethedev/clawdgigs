// Custom Escrow System for ClawdGigs
// Uses PressBase for storage, handles all escrow logic internally

const API_BASE = 'https://backend.benbond.dev/wp-json/app/v1/db';

// Platform fee configuration
const PLATFORM_FEE_PERCENT = 10; // 10% platform fee
const PLATFORM_WALLET = '2BcjnU1sSv2f4Uk793ZY59U41LapKMggYmwhiPDrhHfs'; // 0xRob wallet

// Auto-release after 7 days (in milliseconds)
const AUTO_RELEASE_DAYS = 7;
const AUTO_RELEASE_MS = AUTO_RELEASE_DAYS * 24 * 60 * 60 * 1000;

export type EscrowStatus = 
  | 'pending_funding'  // Escrow created, awaiting payment
  | 'funded'           // Client has paid, funds held
  | 'released'         // Funds released to agent
  | 'disputed'         // Client raised dispute
  | 'refunded'         // Funds refunded to client
  | 'cancelled';       // Escrow cancelled

export interface Escrow {
  id: string;
  buyer_wallet: string;
  seller_wallet: string;
  amount: number;              // Amount in micro USDC (6 decimals)
  platform_fee: number;        // Platform fee in micro USDC
  seller_amount: number;       // Amount seller receives (amount - platform_fee)
  status: EscrowStatus;
  order_id: string;            // Link to order
  description: string;
  funding_tx_signature: string | null;
  release_tx_signature: string | null;
  funded_at: string | null;
  released_at: string | null;
  disputed_at: string | null;
  dispute_reason: string | null;
  auto_release_at: string | null;
  created_at: string;
  updated_at: string;
}

// API helper
async function escrowDbRequest(
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    where?: string;
    id?: string;
    data?: Record<string, unknown>;
  } = {}
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const { method = 'GET', where, id, data } = options;
  
  let url = `${API_BASE}/escrows`;
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
function generateEscrowId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'ESC-';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Create a new escrow for an order
export async function createEscrow(params: {
  orderId: string;
  clientWallet: string;
  agentWallet: string;
  amountUsdc: string;
  description?: string;
}): Promise<{ ok: boolean; data?: Escrow; error?: string }> {
  // Convert USDC amount to micro units (6 decimals)
  const amountMicro = Math.round(parseFloat(params.amountUsdc) * 1_000_000);
  
  // Calculate platform fee (10%)
  const platformFee = Math.round(amountMicro * PLATFORM_FEE_PERCENT / 100);
  const sellerAmount = amountMicro - platformFee;

  const now = new Date().toISOString();
  
  const escrowData = {
    id: generateEscrowId(),
    buyer_wallet: params.clientWallet,
    seller_wallet: params.agentWallet,
    amount: amountMicro,
    platform_fee: platformFee,
    seller_amount: sellerAmount,
    status: 'pending_funding' as EscrowStatus,
    order_id: params.orderId,
    description: params.description || `ClawdGigs Order ${params.orderId}`,
    funding_tx_signature: null,
    release_tx_signature: null,
    funded_at: null,
    released_at: null,
    disputed_at: null,
    dispute_reason: null,
    auto_release_at: null,
    created_at: now,
    updated_at: now,
  };

  const result = await escrowDbRequest({
    method: 'POST',
    data: escrowData,
  });

  if (result.ok && result.data) {
    return { ok: true, data: result.data as Escrow };
  }
  return { ok: false, error: result.error || 'Failed to create escrow' };
}

// Get escrow by ID
export async function getEscrow(escrowId: string): Promise<Escrow | null> {
  const result = await escrowDbRequest({ where: `id:eq:${escrowId}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Escrow[] };
    return data.data?.[0] || null;
  }
  return null;
}

// Get escrow by order ID
export async function getEscrowByOrder(orderId: string): Promise<Escrow | null> {
  const result = await escrowDbRequest({ where: `order_id:eq:${orderId}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Escrow[] };
    return data.data?.[0] || null;
  }
  return null;
}

// Get all escrows due for auto-release
export async function getEscrowsForAutoRelease(): Promise<Escrow[]> {
  // Get all funded escrows
  const result = await escrowDbRequest({ where: `status:eq:funded` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Escrow[] };
    const now = new Date();
    // Filter to those past auto-release date
    return (data.data || []).filter(escrow => {
      if (!escrow.auto_release_at) return false;
      return new Date(escrow.auto_release_at) <= now;
    });
  }
  return [];
}

// Update escrow status
async function updateEscrow(
  escrowId: string, 
  updates: Partial<Omit<Escrow, 'id' | 'created_at'>>
): Promise<{ ok: boolean; error?: string }> {
  const result = await escrowDbRequest({
    method: 'PUT',
    id: escrowId,
    data: { ...updates, updated_at: new Date().toISOString() },
  });
  return { ok: result.ok, error: result.error };
}

// Mark escrow as funded (after payment verification)
export async function markEscrowFunded(
  escrowId: string,
  fundingTxSignature: string
): Promise<{ ok: boolean; error?: string }> {
  const escrow = await getEscrow(escrowId);
  if (!escrow) {
    return { ok: false, error: 'Escrow not found' };
  }

  if (escrow.status !== 'pending_funding') {
    return { ok: false, error: `Cannot fund escrow in ${escrow.status} status` };
  }

  const now = new Date();
  const autoReleaseAt = new Date(now.getTime() + AUTO_RELEASE_MS);

  return updateEscrow(escrowId, {
    status: 'funded',
    funding_tx_signature: fundingTxSignature,
    funded_at: now.toISOString(),
    auto_release_at: autoReleaseAt.toISOString(),
  });
}

// Release escrow to agent (client approves delivery)
export async function releaseEscrow(
  escrowId: string,
  releaseTxSignature?: string
): Promise<{ ok: boolean; escrow?: Escrow; error?: string }> {
  const escrow = await getEscrow(escrowId);
  if (!escrow) {
    return { ok: false, error: 'Escrow not found' };
  }

  if (escrow.status !== 'funded') {
    return { ok: false, error: `Cannot release escrow in ${escrow.status} status` };
  }

  const result = await updateEscrow(escrowId, {
    status: 'released',
    release_tx_signature: releaseTxSignature || null,
    released_at: new Date().toISOString(),
  });

  if (result.ok) {
    const updatedEscrow = await getEscrow(escrowId);
    return { ok: true, escrow: updatedEscrow || undefined };
  }
  return { ok: false, error: result.error };
}

// Refund escrow to buyer
export async function refundEscrow(
  escrowId: string,
  refundTxSignature?: string
): Promise<{ ok: boolean; escrow?: Escrow; error?: string }> {
  const escrow = await getEscrow(escrowId);
  if (!escrow) {
    return { ok: false, error: 'Escrow not found' };
  }

  // Can refund from funded or disputed status
  if (escrow.status !== 'funded' && escrow.status !== 'disputed') {
    return { ok: false, error: `Cannot refund escrow in ${escrow.status} status` };
  }

  const result = await updateEscrow(escrowId, {
    status: 'refunded',
    release_tx_signature: refundTxSignature || null,
    released_at: new Date().toISOString(),
  });

  if (result.ok) {
    const updatedEscrow = await getEscrow(escrowId);
    return { ok: true, escrow: updatedEscrow || undefined };
  }
  return { ok: false, error: result.error };
}

// Create dispute on escrow
export async function disputeEscrow(
  escrowId: string, 
  reason: string
): Promise<{ ok: boolean; escrow?: Escrow; error?: string }> {
  const escrow = await getEscrow(escrowId);
  if (!escrow) {
    return { ok: false, error: 'Escrow not found' };
  }

  if (escrow.status !== 'funded') {
    return { ok: false, error: `Cannot dispute escrow in ${escrow.status} status` };
  }

  const result = await updateEscrow(escrowId, {
    status: 'disputed',
    dispute_reason: reason,
    disputed_at: new Date().toISOString(),
    auto_release_at: null, // Stop auto-release timer when disputed
  });

  if (result.ok) {
    const updatedEscrow = await getEscrow(escrowId);
    return { ok: true, escrow: updatedEscrow || undefined };
  }
  return { ok: false, error: result.error };
}

// Cancel escrow (only if pending_funding)
export async function cancelEscrow(escrowId: string): Promise<{ ok: boolean; error?: string }> {
  const escrow = await getEscrow(escrowId);
  if (!escrow) {
    return { ok: false, error: 'Escrow not found' };
  }

  if (escrow.status !== 'pending_funding') {
    return { ok: false, error: `Cannot cancel escrow in ${escrow.status} status` };
  }

  return updateEscrow(escrowId, { status: 'cancelled' });
}

// Get platform wallet address
export function getPlatformWallet(): string {
  return PLATFORM_WALLET;
}

// Get platform fee percentage
export function getPlatformFeePercent(): number {
  return PLATFORM_FEE_PERCENT;
}

// Icon names that map to Lucide React icons
export type EscrowIconName = 'Hourglass' | 'Lock' | 'CheckCircle' | 'AlertTriangle' | 'Undo2' | 'XCircle' | 'Clock';

// Get escrow status summary for UI
export function getEscrowStatusInfo(escrow: Escrow): {
  label: string;
  icon: EscrowIconName;
  color: string;
  description: string;
} {
  const statusInfo: Record<EscrowStatus, { label: string; icon: EscrowIconName; color: string; description: string }> = {
    pending_funding: {
      label: 'Awaiting Payment',
      icon: 'Hourglass',
      color: 'text-yellow-400',
      description: 'Waiting for client to fund escrow',
    },
    funded: {
      label: 'In Escrow',
      icon: 'Lock',
      color: 'text-blue-400',
      description: 'Funds secured until delivery accepted',
    },
    released: {
      label: 'Released',
      icon: 'CheckCircle',
      color: 'text-green-400',
      description: 'Funds released to agent',
    },
    disputed: {
      label: 'Disputed',
      icon: 'AlertTriangle',
      color: 'text-orange-400',
      description: 'Under review',
    },
    refunded: {
      label: 'Refunded',
      icon: 'Undo2',
      color: 'text-gray-400',
      description: 'Funds returned to client',
    },
    cancelled: {
      label: 'Cancelled',
      icon: 'XCircle',
      color: 'text-gray-400',
      description: 'Escrow was cancelled',
    },
  };

  return statusInfo[escrow.status] || statusInfo.pending_funding;
}

// Format escrow amount for display
export function formatEscrowAmount(amount: number): string {
  return `$${(amount / 1_000_000).toFixed(2)}`;
}

// Get auto-release time remaining
export function getAutoReleaseTimeRemaining(escrow: Escrow): {
  days: number;
  hours: number;
  expired: boolean;
  formattedString: string;
} {
  if (!escrow.auto_release_at) {
    return { days: 0, hours: 0, expired: false, formattedString: 'No auto-release set' };
  }

  const autoReleaseDate = new Date(escrow.auto_release_at);
  const now = new Date();
  const diffMs = autoReleaseDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { days: 0, hours: 0, expired: true, formattedString: 'Auto-release pending' };
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  let formattedString = '';
  if (days > 0) {
    formattedString = `${days}d ${hours}h remaining`;
  } else {
    formattedString = `${hours}h remaining`;
  }

  return { days, hours, expired: false, formattedString };
}
