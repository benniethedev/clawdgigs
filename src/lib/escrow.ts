// SolPay Escrow Client
// Uses api.solpay.cash for real escrow protection

const ESCROW_API_BASE = process.env.ESCROW_API_URL || 'https://api.solpay.cash';
const PLATFORM_ID = 'clawdgigs';

// Auto-release after 7 days (in milliseconds)
const AUTO_RELEASE_DAYS = 7;

export type EscrowStatus = 
  | 'pending_funding'  // Escrow created, awaiting payment
  | 'funded'           // Client has paid, funds held
  | 'released'         // Funds released to agent
  | 'disputed'         // Client raised dispute
  | 'refunded'         // Funds refunded to client
  | 'cancelled'        // Escrow cancelled
  | 'expired';         // Escrow expired

export type DealType = 'digital_goods' | 'service' | 'physical_shipment' | 'other';

export interface Escrow {
  id: string;
  escrow_id: string; // Human-readable ID like ESC-ABC123
  buyer_wallet: string;
  seller_wallet: string;
  escrow_wallet: string | null;
  token: string;
  amount: number; // In micro units (6 decimals for USDC)
  fee_percentage: number;
  fee_amount: number;
  deal_type: DealType;
  deal_description: string | null;
  status: EscrowStatus;
  funding_tx_signature: string | null;
  payout_tx_signature: string | null;
  funded_at: string | null;
  completed_at: string | null;
  auto_release_at: string | null;
  partner_id: string | null;
  partner_order_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Dispute {
  id: string;
  escrow_id: string;
  opened_by: string;
  reason: string;
  description: string | null;
  status: 'open' | 'under_review' | 'resolved' | 'escalated';
  resolution: string | null;
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  ai_assessment: string | null;
  ai_recommended_outcome: string | null;
  created_at: string;
  updated_at: string;
}

// Generic API request to escrow service
async function escrowRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: Record<string, unknown>;
  } = {}
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const { method = 'GET', body } = options;
  
  const url = `${ESCROW_API_BASE}${endpoint}`;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });

    const json = await res.json();
    
    if (!res.ok) {
      return { ok: false, error: json.error || json.message || `HTTP ${res.status}` };
    }
    
    return { ok: true, data: json };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
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

  const result = await escrowRequest<{ success: boolean; escrow: Escrow }>('/api/v1/escrow', {
    method: 'POST',
    body: {
      buyer_wallet: params.clientWallet,
      seller_wallet: params.agentWallet,
      token: 'USDC',
      amount: amountMicro,
      deal_type: 'service' as DealType,
      deal_description: params.description || `ClawdGigs Order ${params.orderId}`,
      partner_id: PLATFORM_ID,
      partner_order_id: params.orderId,
      metadata: {
        platform: PLATFORM_ID,
        order_id: params.orderId,
      },
      // Add auto-release proof check (7 days)
      proof_checks: [
        {
          type: 'time_lock',
          name: 'Auto-release after 7 days',
          required: false,
          config: {
            auto_release_days: AUTO_RELEASE_DAYS,
          },
        },
      ],
    },
  });

  if (result.ok && result.data?.escrow) {
    return { ok: true, data: result.data.escrow };
  }
  return { ok: false, error: result.error || 'Failed to create escrow' };
}

// Get escrow by ID with full details
export async function getEscrow(escrowId: string): Promise<Escrow | null> {
  const result = await escrowRequest<{ success: boolean; escrow: Escrow }>(`/api/v1/escrow/${escrowId}`);
  
  if (result.ok && result.data?.escrow) {
    return result.data.escrow;
  }
  return null;
}

// Get escrow by order ID (using partner_order_id)
export async function getEscrowByOrder(orderId: string): Promise<Escrow | null> {
  // The API may support filtering by partner_order_id, or we may need to list and filter
  // For now, we'll store the escrow_id in the order record and use getEscrow
  // This function is kept for backward compatibility
  console.warn('getEscrowByOrder: Use order.escrow_id with getEscrow() instead');
  return null;
}

// Release escrow to agent (client approves delivery)
export async function releaseEscrow(
  escrowId: string,
  actorWallet?: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await escrowRequest<{ success: boolean; escrow: Escrow }>(`/api/v1/escrow/${escrowId}/release`, {
    method: 'POST',
    body: {
      actor: actorWallet,
    },
  });

  if (result.ok && result.data?.success) {
    return { ok: true };
  }
  return { ok: false, error: result.error || 'Failed to release escrow' };
}

// Create dispute on escrow
export async function disputeEscrow(
  escrowId: string, 
  reason: string,
  description: string,
  openedBy: string
): Promise<{ ok: boolean; error?: string; dispute?: Dispute }> {
  const result = await escrowRequest<{ success: boolean; dispute: Dispute }>(`/api/v1/escrow/${escrowId}/dispute`, {
    method: 'POST',
    body: {
      reason,
      description,
      opened_by: openedBy,
    },
  });

  if (result.ok && result.data?.success) {
    return { ok: true, dispute: result.data.dispute };
  }
  return { ok: false, error: result.error || 'Failed to create dispute' };
}

// Resolve dispute (admin/AI only)
export async function resolveDispute(
  escrowId: string,
  disputeId: string,
  resolution: 'refund_buyer' | 'pay_seller' | 'split' | 'other',
  notes: string,
  resolvedBy: string = 'ai'
): Promise<{ ok: boolean; error?: string }> {
  const result = await escrowRequest<{ success: boolean; dispute: Dispute }>(`/api/v1/escrow/${escrowId}/dispute`, {
    method: 'PUT',
    body: {
      dispute_id: disputeId,
      resolution,
      resolution_notes: notes,
      resolved_by: resolvedBy,
      use_ai_assessment: resolvedBy === 'ai',
    },
  });

  if (result.ok && result.data?.success) {
    return { ok: true };
  }
  return { ok: false, error: result.error || 'Failed to resolve dispute' };
}

// Mark escrow as funded (after payment verification)
export async function markEscrowFunded(
  escrowId: string,
  fundingTxSignature: string,
  escrowWallet?: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await escrowRequest<{ success: boolean; escrow: Escrow }>(`/api/v1/escrow/${escrowId}/fund`, {
    method: 'POST',
    body: {
      funding_tx_signature: fundingTxSignature,
      escrow_wallet: escrowWallet,
    },
  });

  if (result.ok && result.data?.success) {
    return { ok: true };
  }
  return { ok: false, error: result.error || 'Failed to mark escrow as funded' };
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
    expired: {
      label: 'Expired',
      icon: 'Clock',
      color: 'text-gray-400',
      description: 'Escrow has expired',
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
