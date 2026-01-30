// SolPay Escrow Client
// Uses escrow.solpay.cash for payment protection

import crypto from 'crypto';

const ESCROW_API = process.env.ESCROW_API_URL || 'https://escrow.solpay.cash/wp-json/app/v1';
const ESCROW_SERVICE_KEY = process.env.ESCROW_SERVICE_KEY || '';
const ESCROW_HMAC_SECRET = process.env.ESCROW_HMAC_SECRET || '';
const PLATFORM_ID = 'clawdgigs';

// Auto-release after 7 days
const AUTO_RELEASE_DAYS = 7;

export type EscrowStatus = 
  | 'pending'      // Escrow created, awaiting funding
  | 'funded'       // Client has paid, funds held
  | 'released'     // Funds released to agent
  | 'disputed'     // Client raised dispute
  | 'resolved'     // Dispute resolved
  | 'refunded';    // Funds refunded to client

export interface Escrow {
  id: string;
  order_id: string;
  client_wallet: string;
  agent_wallet: string;
  amount_usdc: string;
  status: EscrowStatus;
  platform_id: string;
  funded_at?: string;
  release_deadline?: string;
  released_at?: string;
  dispute_reason?: string;
  resolution?: string;
  resolved_by?: string;
  created_at: string;
  updated_at: string;
}

// Generate HMAC signature for 0% fee on our platform
function generateHmacSignature(payload: string): string {
  if (!ESCROW_HMAC_SECRET) {
    console.warn('ESCROW_HMAC_SECRET not set - fee waiver may not apply');
    return '';
  }
  return crypto
    .createHmac('sha256', ESCROW_HMAC_SECRET)
    .update(payload)
    .digest('hex');
}

// Generic API request to escrow service
async function escrowRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    data?: Record<string, unknown>;
    where?: string;
  } = {}
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const { method = 'GET', data, where } = options;
  
  let url = `${ESCROW_API}${endpoint}`;
  if (where && method === 'GET') {
    url += `?where=${encodeURIComponent(where)}`;
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Add service key if available
  if (ESCROW_SERVICE_KEY) {
    headers['Authorization'] = `Bearer ${ESCROW_SERVICE_KEY}`;
  }

  // Add HMAC signature for platform authentication (0% fee)
  if (data && ESCROW_HMAC_SECRET) {
    const payload = JSON.stringify(data);
    const signature = generateHmacSignature(payload);
    headers['X-Platform-Id'] = PLATFORM_ID;
    headers['X-Platform-Signature'] = signature;
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      cache: 'no-store',
    });

    const json = await res.json();
    
    if (!res.ok) {
      return { ok: false, error: json.error?.message || `HTTP ${res.status}` };
    }
    
    return json;
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
}): Promise<{ ok: boolean; data?: Escrow; error?: string }> {
  const releaseDeadline = new Date();
  releaseDeadline.setDate(releaseDeadline.getDate() + AUTO_RELEASE_DAYS);

  const result = await escrowRequest<Escrow>('/db/escrows', {
    method: 'POST',
    data: {
      order_id: params.orderId,
      client_wallet: params.clientWallet,
      agent_wallet: params.agentWallet,
      amount_usdc: params.amountUsdc,
      status: 'funded',
      platform_id: PLATFORM_ID,
      funded_at: new Date().toISOString(),
      release_deadline: releaseDeadline.toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });

  return result;
}

// Get escrow by order ID
export async function getEscrowByOrder(orderId: string): Promise<Escrow | null> {
  const result = await escrowRequest<{ data: Escrow[] }>('/db/escrows', {
    where: `order_id:eq:${orderId}`,
  });
  
  if (result.ok && result.data?.data?.[0]) {
    return result.data.data[0];
  }
  return null;
}

// Get escrow by ID
export async function getEscrow(escrowId: string): Promise<Escrow | null> {
  const result = await escrowRequest<{ data: Escrow[] }>('/db/escrows', {
    where: `id:eq:${escrowId}`,
  });
  
  if (result.ok && result.data?.data?.[0]) {
    return result.data.data[0];
  }
  return null;
}

// Release escrow to agent (client approves delivery)
export async function releaseEscrow(escrowId: string): Promise<{ ok: boolean; error?: string }> {
  const escrow = await getEscrow(escrowId);
  if (!escrow) {
    return { ok: false, error: 'Escrow not found' };
  }
  
  if (escrow.status !== 'funded') {
    return { ok: false, error: `Cannot release escrow in ${escrow.status} status` };
  }

  const result = await escrowRequest(`/db/escrows/${escrowId}`, {
    method: 'PATCH',
    data: {
      status: 'released',
      released_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });

  return { ok: result.ok, error: result.error };
}

// Create dispute on escrow
export async function disputeEscrow(
  escrowId: string, 
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  const escrow = await getEscrow(escrowId);
  if (!escrow) {
    return { ok: false, error: 'Escrow not found' };
  }
  
  if (escrow.status !== 'funded') {
    return { ok: false, error: `Cannot dispute escrow in ${escrow.status} status` };
  }

  const result = await escrowRequest(`/db/escrows/${escrowId}`, {
    method: 'PATCH',
    data: {
      status: 'disputed',
      dispute_reason: reason,
      updated_at: new Date().toISOString(),
    },
  });

  return { ok: result.ok, error: result.error };
}

// Resolve dispute (called by AI resolution or admin)
export async function resolveDispute(
  escrowId: string,
  resolution: 'release' | 'refund',
  details: string,
  resolvedBy: string = 'ai'
): Promise<{ ok: boolean; error?: string }> {
  const escrow = await getEscrow(escrowId);
  if (!escrow) {
    return { ok: false, error: 'Escrow not found' };
  }
  
  if (escrow.status !== 'disputed') {
    return { ok: false, error: `Cannot resolve escrow in ${escrow.status} status` };
  }

  const newStatus = resolution === 'release' ? 'released' : 'refunded';
  const result = await escrowRequest(`/db/escrows/${escrowId}`, {
    method: 'PATCH',
    data: {
      status: newStatus,
      resolution: details,
      resolved_by: resolvedBy,
      ...(resolution === 'release' ? { released_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    },
  });

  return { ok: result.ok, error: result.error };
}

// Check for auto-release (7 days passed)
export async function checkAutoRelease(escrowId: string): Promise<{ 
  ok: boolean; 
  released: boolean; 
  error?: string 
}> {
  const escrow = await getEscrow(escrowId);
  if (!escrow) {
    return { ok: false, released: false, error: 'Escrow not found' };
  }
  
  if (escrow.status !== 'funded') {
    return { ok: true, released: escrow.status === 'released' };
  }

  // Check if release deadline has passed
  if (escrow.release_deadline) {
    const deadline = new Date(escrow.release_deadline);
    if (new Date() > deadline) {
      // Auto-release
      const result = await releaseEscrow(escrowId);
      return { ok: result.ok, released: result.ok, error: result.error };
    }
  }

  return { ok: true, released: false };
}

// Get all escrows pending auto-release (for cron job)
export async function getPendingAutoReleaseEscrows(): Promise<Escrow[]> {
  const now = new Date().toISOString();
  const result = await escrowRequest<{ data: Escrow[] }>('/db/escrows', {
    where: `status:eq:funded,release_deadline:lt:${now}`,
  });
  
  if (result.ok && result.data?.data) {
    return result.data.data;
  }
  return [];
}

// Get escrow status summary
export function getEscrowStatusInfo(escrow: Escrow): {
  label: string;
  icon: string;
  color: string;
  description: string;
} {
  const statusInfo: Record<EscrowStatus, { label: string; icon: string; color: string; description: string }> = {
    pending: {
      label: 'Awaiting Payment',
      icon: '⏳',
      color: 'text-yellow-400',
      description: 'Waiting for client to fund escrow',
    },
    funded: {
      label: 'In Escrow',
      icon: '🔒',
      color: 'text-blue-400',
      description: 'Funds secured until delivery accepted',
    },
    released: {
      label: 'Released',
      icon: '✅',
      color: 'text-green-400',
      description: 'Funds released to agent',
    },
    disputed: {
      label: 'Disputed',
      icon: '⚠️',
      color: 'text-orange-400',
      description: 'Under AI review',
    },
    resolved: {
      label: 'Resolved',
      icon: '⚖️',
      color: 'text-purple-400',
      description: 'Dispute resolved',
    },
    refunded: {
      label: 'Refunded',
      icon: '↩️',
      color: 'text-gray-400',
      description: 'Funds returned to client',
    },
  };

  return statusInfo[escrow.status] || statusInfo.pending;
}
