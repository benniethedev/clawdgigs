// PressBase API client for orders and deliveries

const API_BASE = 'https://backend.benbond.dev/wp-json/app/v1/db';

async function apiRequest(
  table: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    where?: string;
    id?: string;
    data?: Record<string, unknown>;
  } = {}
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const { method = 'GET', where, id, data } = options;
  
  let url = `${API_BASE}/${table}`;
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

// Order types
import { OrderStatus } from './order-state-machine';

export interface Order {
  id: string;
  gig_id: string;
  agent_id: string;
  client_wallet: string;
  amount_usdc: string;
  status: OrderStatus;
  requirements_description: string;
  requirements_inputs?: string;
  requirements_delivery_prefs?: string;
  requirements_file_urls?: string; // JSON array of uploaded file info
  payment_signature?: string;
  escrow_id?: string;
  buyer_email?: string; // Optional email for notifications
  created_at: string;
  updated_at: string;
}

export interface Delivery {
  id: string;
  order_id: string;
  agent_id: string;
  delivery_type: 'text' | 'file' | 'url' | 'mixed';
  content_text?: string;
  content_url?: string;
  file_urls?: string; // JSON array of file URLs
  notes?: string;
  delivered_at: string;
}

// Order operations
export async function createOrder(order: Omit<Order, 'id' | 'created_at' | 'updated_at'>): Promise<{ ok: boolean; data?: Order; error?: string }> {
  const result = await apiRequest('orders', {
    method: 'POST',
    data: {
      ...order,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });
  
  if (result.ok && result.data) {
    return { ok: true, data: result.data as Order };
  }
  return { ok: false, error: result.error || 'Failed to create order' };
}

// Helper to flatten PressBase schemaless records (where fields are nested under 'data')
function flattenRecord<T>(record: Record<string, unknown> | null): T | null {
  if (!record) return null;
  if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
    // Merge nested data with top-level fields (id, created_at, etc.)
    const { data, ...topLevel } = record;
    return { ...topLevel, ...(data as object) } as T;
  }
  return record as T;
}

export async function getOrder(id: string): Promise<Order | null> {
  const result = await apiRequest('orders', { where: `id:eq:${id}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Record<string, unknown>[] };
    return flattenRecord<Order>(data.data?.[0] || null);
  }
  return null;
}

export async function getOrdersByClient(walletAddress: string): Promise<Order[]> {
  const result = await apiRequest('orders', { where: `client_wallet:eq:${walletAddress}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Record<string, unknown>[] };
    return (data.data || []).map(r => flattenRecord<Order>(r)).filter((o): o is Order => o !== null);
  }
  return [];
}

export async function getOrdersByAgent(agentId: string): Promise<Order[]> {
  const result = await apiRequest('orders', { where: `agent_id:eq:${agentId}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Record<string, unknown>[] };
    return (data.data || []).map(r => flattenRecord<Order>(r)).filter((o): o is Order => o !== null);
  }
  return [];
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<boolean> {
  const result = await apiRequest('orders', {
    method: 'PATCH',
    id,
    data: { status, updated_at: new Date().toISOString() },
  });
  return result.ok;
}

export async function updateOrderEscrow(id: string, escrowId: string): Promise<boolean> {
  const result = await apiRequest('orders', {
    method: 'PUT',
    id,
    data: { escrow_id: escrowId, updated_at: new Date().toISOString() },
  });
  return result.ok;
}

// Delivery operations
export async function createDelivery(delivery: Omit<Delivery, 'id' | 'delivered_at'>): Promise<{ ok: boolean; data?: Delivery; error?: string }> {
  const result = await apiRequest('deliveries', {
    method: 'POST',
    data: {
      ...delivery,
      delivered_at: new Date().toISOString(),
    },
  });
  
  if (result.ok && result.data) {
    return { ok: true, data: result.data as Delivery };
  }
  return { ok: false, error: result.error || 'Failed to create delivery' };
}

export async function getDeliveryByOrder(orderId: string): Promise<Delivery | null> {
  const result = await apiRequest('deliveries', { where: `order_id:eq:${orderId}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Record<string, unknown>[] };
    return flattenRecord<Delivery>(data.data?.[0] || null);
  }
  return null;
}

export async function getDeliveriesByAgent(agentId: string): Promise<Delivery[]> {
  const result = await apiRequest('deliveries', { where: `agent_id:eq:${agentId}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Delivery[] };
    return data.data || [];
  }
  return [];
}

// Get order with delivery info
export async function getOrderWithDelivery(orderId: string): Promise<{ order: Order; delivery: Delivery | null } | null> {
  const order = await getOrder(orderId);
  if (!order) return null;
  
  const delivery = await getDeliveryByOrder(orderId);
  return { order, delivery };
}

// Gig info helper
export async function getGig(id: string): Promise<{ id: string; title: string; description: string; agent_id: string; price_usdc: string } | null> {
  const result = await apiRequest('gigs', { where: `id:eq:${id}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: { id: string; title: string; description: string; agent_id: string; price_usdc: string }[] };
    return data.data?.[0] || null;
  }
  return null;
}

// Agent type with all fields
export interface Agent {
  id: string;
  name: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  skills: string;
  hourly_rate_usdc: string;
  rating: string;
  total_jobs: string;
  total_earned_usdc: string;
  is_verified: boolean;
  is_featured: boolean;
  wallet_address: string;
  webhook_url?: string; // Optional webhook URL for order notifications
  created_at: string;
  updated_at: string;
}

// Agent info helper
export async function getAgent(id: string): Promise<Agent | null> {
  const result = await apiRequest('agents', { where: `id:eq:${id}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Agent[] };
    return data.data?.[0] || null;
  }
  return null;
}

// Get agent by wallet address
export async function getAgentByWallet(walletAddress: string): Promise<Agent | null> {
  const result = await apiRequest('agents', { where: `wallet_address:eq:${walletAddress}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Agent[] };
    return data.data?.[0] || null;
  }
  return null;
}

// Create new agent
export async function createAgent(agent: Omit<Agent, 'id' | 'created_at' | 'updated_at' | 'rating' | 'total_jobs' | 'total_earned_usdc' | 'is_verified' | 'is_featured'>): Promise<{ ok: boolean; data?: Agent; error?: string }> {
  const result = await apiRequest('agents', {
    method: 'POST',
    data: {
      ...agent,
      rating: '5.0',
      total_jobs: '0',
      total_earned_usdc: '0',
      is_verified: false,
      is_featured: false,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });
  
  if (result.ok && result.data) {
    return { ok: true, data: result.data as Agent };
  }
  return { ok: false, error: result.error || 'Failed to create agent' };
}

// Update agent profile (including webhook_url)
export async function updateAgent(id: string, updates: Partial<Omit<Agent, 'id' | 'created_at'>>): Promise<boolean> {
  const result = await apiRequest('agents', {
    method: 'PUT',
    id,
    data: { ...updates, updated_at: new Date().toISOString() },
  });
  return result.ok;
}

// Gig type
export interface Gig {
  id: string;
  agent_id: string;
  title: string;
  description: string;
  category: string;
  price_usdc: string;
  price_type: 'fixed' | 'hourly';
  delivery_time: string;
  status: 'active' | 'paused' | 'deleted';
  created_at: string;
  updated_at: string;
}

// Create new gig
export async function createGig(gig: Omit<Gig, 'id' | 'created_at' | 'updated_at' | 'status'>): Promise<{ ok: boolean; data?: Gig; error?: string }> {
  const result = await apiRequest('gigs', {
    method: 'POST',
    data: {
      ...gig,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });
  
  if (result.ok && result.data) {
    return { ok: true, data: result.data as Gig };
  }
  return { ok: false, error: result.error || 'Failed to create gig' };
}

// Get gigs by agent
export async function getGigsByAgent(agentId: string): Promise<Gig[]> {
  const result = await apiRequest('gigs', { where: `agent_id:eq:${agentId}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Gig[] };
    return data.data || [];
  }
  return [];
}

// Review type
export interface Review {
  id: string;
  order_id: string;
  agent_id: string;
  client_wallet: string;
  rating: number;
  review_text: string;
  created_at: string;
}

// Create a review
export async function createReview(review: Omit<Review, 'id' | 'created_at'>): Promise<{ ok: boolean; data?: Review; error?: string }> {
  const result = await apiRequest('reviews', {
    method: 'POST',
    data: {
      ...review,
      created_at: new Date().toISOString(),
    },
  });
  
  if (result.ok && result.data) {
    return { ok: true, data: result.data as Review };
  }
  return { ok: false, error: result.error || 'Failed to create review' };
}

// Get review by order ID
export async function getReviewByOrder(orderId: string): Promise<Review | null> {
  const result = await apiRequest('reviews', { where: `order_id:eq:${orderId}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Review[] };
    return data.data?.[0] || null;
  }
  return null;
}

// Get reviews for an agent
export async function getReviewsByAgent(agentId: string): Promise<Review[]> {
  const result = await apiRequest('reviews', { where: `agent_id:eq:${agentId}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Review[] };
    return data.data || [];
  }
  return [];
}

// Calculate average rating for an agent
export async function getAgentAverageRating(agentId: string): Promise<{ average: number; count: number }> {
  const reviews = await getReviewsByAgent(agentId);
  if (reviews.length === 0) {
    return { average: 5.0, count: 0 }; // Default rating when no reviews
  }
  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  return { 
    average: Math.round((total / reviews.length) * 10) / 10, 
    count: reviews.length 
  };
}

// Update agent rating in database
export async function updateAgentRating(agentId: string): Promise<boolean> {
  const { average, count } = await getAgentAverageRating(agentId);
  return updateAgent(agentId, { 
    rating: average.toFixed(1), 
    total_jobs: String(count) 
  });
}
