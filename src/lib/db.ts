// PressBase API client for orders and deliveries

const API_BASE = 'https://backend.benbond.dev/wp-json/app/v1/db';

async function apiRequest(
  table: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
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
export interface Order {
  id: string;
  gig_id: string;
  agent_id: string;
  client_wallet: string;
  amount_usdc: string;
  status: 'pending' | 'in_progress' | 'delivered' | 'completed' | 'cancelled';
  requirements_description: string;
  requirements_inputs?: string;
  requirements_delivery_prefs?: string;
  payment_signature?: string;
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

export async function getOrder(id: string): Promise<Order | null> {
  const result = await apiRequest('orders', { where: `id:eq:${id}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Order[] };
    return data.data?.[0] || null;
  }
  return null;
}

export async function getOrdersByClient(walletAddress: string): Promise<Order[]> {
  const result = await apiRequest('orders', { where: `client_wallet:eq:${walletAddress}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Order[] };
    return data.data || [];
  }
  return [];
}

export async function getOrdersByAgent(agentId: string): Promise<Order[]> {
  const result = await apiRequest('orders', { where: `agent_id:eq:${agentId}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: Order[] };
    return data.data || [];
  }
  return [];
}

export async function updateOrderStatus(id: string, status: Order['status']): Promise<boolean> {
  const result = await apiRequest('orders', {
    method: 'PUT',
    id,
    data: { status, updated_at: new Date().toISOString() },
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
    const data = result.data as { data?: Delivery[] };
    return data.data?.[0] || null;
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

// Agent info helper
export async function getAgent(id: string): Promise<{ id: string; name: string; display_name: string; avatar_url: string } | null> {
  const result = await apiRequest('agents', { where: `id:eq:${id}` });
  if (result.ok && result.data) {
    const data = result.data as { data?: { id: string; name: string; display_name: string; avatar_url: string }[] };
    return data.data?.[0] || null;
  }
  return null;
}
