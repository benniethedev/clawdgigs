// Custom Escrow System for ClawdGigs
// Uses PressBase for storage, handles all escrow logic internally
// Real fund custody - escrow wallet holds USDC until release

import { transferFromEscrow, refundFromEscrow, getEscrowWalletPublic, getPlatformWallet as getWallet } from './escrow-transfer';

const API_BASE = 'https://backend.benbond.dev/wp-json/app/v1/db';

// Platform fee configuration
const PLATFORM_FEE_PERCENT = 10; // 10% platform fee

// Auto-release after 1 day (in milliseconds) - MVP simple logic
const AUTO_RELEASE_DAYS = 1;
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
// Helper to flatten PressBase records (data is nested under 'data' field)
function flattenEscrow(record: Record<string, unknown> | null): Escrow | null {
  if (!record) return null;
  if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
    const { data, id: rowId, ...topLevel } = record;
    // Use the custom escrow ID from data, not the row ID
    return { ...topLevel, ...(data as object), _rowId: rowId } as unknown as Escrow;
  }
  return record as Escrow;
}

export async function getEscrow(escrowId: string): Promise<Escrow | null> {
  // Workaround: PressBase stores custom ID in data.id, so fetch all and filter
  const result = await escrowDbRequest({});
  if (result.ok && result.data) {
    const data = result.data as { data?: Record<string, unknown>[] };
    const records = data.data || [];
    for (const record of records) {
      const flattened = flattenEscrow(record);
      if (flattened && flattened.id === escrowId) {
        // Store the Pressbase row ID for updates
        (flattened as unknown as Record<string, unknown>)._rowId = record.id;
        return flattened;
      }
    }
  }
  return null;
}

// Get escrow by order ID
export async function getEscrowByOrder(orderId: string): Promise<Escrow | null> {
  // Workaround: PressBase stores order_id in data field, so fetch all and filter
  const result = await escrowDbRequest({});
  if (result.ok && result.data) {
    const data = result.data as { data?: Record<string, unknown>[] };
    const records = data.data || [];
    for (const record of records) {
      const flattened = flattenEscrow(record);
      if (flattened && flattened.order_id === orderId) {
        (flattened as unknown as Record<string, unknown>)._rowId = record.id;
        return flattened;
      }
    }
  }
  return null;
}

// Get all escrows due for auto-release
// Alias: getEscrowsReadyForAutoRelease
export async function getEscrowsForAutoRelease(): Promise<Escrow[]> {
  // Workaround: fetch all and filter for funded status
  const result = await escrowDbRequest({});
  if (result.ok && result.data) {
    const data = result.data as { data?: Record<string, unknown>[] };
    const now = new Date();
    const escrows: Escrow[] = [];
    for (const record of data.data || []) {
      const flattened = flattenEscrow(record);
      if (flattened && flattened.status === 'funded' && flattened.auto_release_at) {
        if (new Date(flattened.auto_release_at) <= now) {
          (flattened as unknown as Record<string, unknown>)._rowId = record.id;
          escrows.push(flattened);
        }
      }
    }
    return escrows;
  }
  return [];
}

// Update escrow status
async function updateEscrow(
  escrow: Escrow & { _rowId?: string }, 
  updates: Partial<Omit<Escrow, 'id' | 'created_at'>>
): Promise<{ ok: boolean; error?: string }> {
  // Use the Pressbase row ID for the update, not the escrow ID
  const rowId = (escrow as unknown as Record<string, unknown>)._rowId as string || escrow.id;
  const result = await escrowDbRequest({
    method: 'PATCH', // Use PATCH to merge into data field
    id: rowId,
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

  return updateEscrow(escrow, {
    status: 'funded',
    funding_tx_signature: fundingTxSignature,
    funded_at: now.toISOString(),
    auto_release_at: autoReleaseAt.toISOString(),
  });
}

// Release escrow to agent (client approves delivery)
// Actually transfers USDC: 90% to seller, 10% to platform
export async function releaseEscrow(
  escrowId: string,
  releaseTxSignature?: string
): Promise<{ ok: boolean; escrow?: Escrow; txSignature?: string; error?: string }> {
  const escrow = await getEscrow(escrowId);
  if (!escrow) {
    return { ok: false, error: 'Escrow not found' };
  }

  if (escrow.status !== 'funded') {
    return { ok: false, error: `Cannot release escrow in ${escrow.status} status` };
  }

  // Actually transfer funds on-chain
  const transferResult = await transferFromEscrow({
    sellerWallet: escrow.seller_wallet,
    sellerAmount: escrow.seller_amount,
    platformFee: escrow.platform_fee,
  });

  if (!transferResult.success) {
    console.error('Escrow release transfer failed:', transferResult.error);
    return { ok: false, error: `Transfer failed: ${transferResult.error}` };
  }

  // Update escrow status in database
  const result = await updateEscrow(escrow, {
    status: 'released',
    release_tx_signature: transferResult.txSignature || releaseTxSignature || null,
    released_at: new Date().toISOString(),
  });

  if (result.ok) {
    const updatedEscrow = await getEscrow(escrowId);
    return { ok: true, escrow: updatedEscrow || undefined, txSignature: transferResult.txSignature };
  }
  return { ok: false, error: result.error };
}

// Refund escrow to buyer
// Actually transfers full amount back to buyer (no fee on refunds)
export async function refundEscrow(
  escrowId: string,
  refundTxSignature?: string
): Promise<{ ok: boolean; escrow?: Escrow; txSignature?: string; error?: string }> {
  const escrow = await getEscrow(escrowId);
  if (!escrow) {
    return { ok: false, error: 'Escrow not found' };
  }

  // Can refund from funded or disputed status
  if (escrow.status !== 'funded' && escrow.status !== 'disputed') {
    return { ok: false, error: `Cannot refund escrow in ${escrow.status} status` };
  }

  // Actually transfer funds back to buyer
  const transferResult = await refundFromEscrow(escrow.buyer_wallet, escrow.amount);

  if (!transferResult.success) {
    console.error('Escrow refund transfer failed:', transferResult.error);
    return { ok: false, error: `Refund transfer failed: ${transferResult.error}` };
  }

  const result = await updateEscrow(escrow, {
    status: 'refunded',
    release_tx_signature: transferResult.txSignature || refundTxSignature || null,
    released_at: new Date().toISOString(),
  });

  if (result.ok) {
    const updatedEscrow = await getEscrow(escrowId);
    return { ok: true, escrow: updatedEscrow || undefined, txSignature: transferResult.txSignature };
  }
  return { ok: false, error: result.error };
}

// Split escrow 50/50 between buyer and seller (for partial delivery/shared fault)
export async function splitEscrow(
  escrowId: string,
  splitTxSignature?: string
): Promise<{ ok: boolean; escrow?: Escrow; buyerRefund: number; sellerPayout: number; error?: string }> {
  const escrow = await getEscrow(escrowId);
  if (!escrow) {
    return { ok: false, error: 'Escrow not found', buyerRefund: 0, sellerPayout: 0 };
  }

  // Can only split from disputed status
  if (escrow.status !== 'disputed') {
    return { ok: false, error: `Cannot split escrow in ${escrow.status} status`, buyerRefund: 0, sellerPayout: 0 };
  }

  // Calculate 50/50 split (platform fee comes from seller's half)
  const halfAmount = Math.floor(escrow.amount / 2);
  const buyerRefund = halfAmount; // Buyer gets 50% back
  const sellerHalf = escrow.amount - halfAmount; // Seller's half
  const platformFeeFromSplit = Math.floor(sellerHalf * PLATFORM_FEE_PERCENT / 100);
  const sellerPayout = sellerHalf - platformFeeFromSplit; // Seller gets 50% minus platform fee

  // Mark escrow as released (we use 'released' status for split as well)
  const result = await updateEscrow(escrow, {
    status: 'released',
    release_tx_signature: splitTxSignature || `SPLIT-${Date.now()}`,
    released_at: new Date().toISOString(),
    // Store split info in description for audit trail
    description: `${escrow.description} | SPLIT: Buyer refund ${formatEscrowAmount(buyerRefund)}, Seller payout ${formatEscrowAmount(sellerPayout)}`,
  });

  if (result.ok) {
    const updatedEscrow = await getEscrow(escrowId);
    return { ok: true, escrow: updatedEscrow || undefined, buyerRefund, sellerPayout };
  }
  return { ok: false, error: result.error, buyerRefund: 0, sellerPayout: 0 };
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

  const result = await updateEscrow(escrow, {
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

  return updateEscrow(escrow, { status: 'cancelled' });
}

// Get platform wallet address (from env or default)
export function getPlatformWallet(): string {
  return getWallet();
}

// Get escrow wallet address (where payments should be sent)
export { getEscrowWalletPublic };

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

// Alias for auto-release function
export { getEscrowsForAutoRelease as getEscrowsReadyForAutoRelease };
