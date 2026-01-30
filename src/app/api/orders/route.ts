import { NextRequest, NextResponse } from 'next/server';
import { createOrder, getOrdersByClient, getGig, getAgent, Order } from '@/lib/db';

interface OrderWithAgent extends Order {
  agent?: {
    id: string;
    name: string;
    display_name: string;
    avatar_url: string;
  };
}

// POST /api/orders - Create a new order after payment
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      gigId,
      agentId,
      clientWallet,
      amount,
      requirements,
      paymentSignature,
    } = body;

    // Validate required fields
    if (!gigId || !agentId || !clientWallet || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: gigId, agentId, clientWallet, amount' },
        { status: 400 }
      );
    }

    if (!requirements?.description) {
      return NextResponse.json(
        { error: 'Missing requirements description' },
        { status: 400 }
      );
    }

    // Verify gig exists
    const gig = await getGig(gigId);
    if (!gig) {
      return NextResponse.json(
        { error: 'Gig not found' },
        { status: 404 }
      );
    }

    // Create the order
    // If paymentSignature is provided, order is paid; otherwise pending
    const status = paymentSignature ? 'paid' : 'pending';
    const result = await createOrder({
      gig_id: gigId,
      agent_id: agentId,
      client_wallet: clientWallet,
      amount_usdc: amount.toString(),
      status,
      requirements_description: requirements.description,
      requirements_inputs: requirements.inputs || undefined,
      requirements_delivery_prefs: requirements.deliveryPreferences || undefined,
      payment_signature: paymentSignature || undefined,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Failed to create order' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      order: result.data,
    });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}

// GET /api/orders?wallet=xxx&include_agents=true - Get orders for a client wallet
export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet');
    const includeAgents = req.nextUrl.searchParams.get('include_agents') === 'true';

    if (!wallet) {
      return NextResponse.json(
        { error: 'Missing wallet parameter' },
        { status: 400 }
      );
    }

    const orders = await getOrdersByClient(wallet);

    // If include_agents is requested, fetch agent info for each unique agent
    let ordersWithAgents: OrderWithAgent[] = orders;
    
    if (includeAgents && orders.length > 0) {
      // Get unique agent IDs
      const agentIds = [...new Set(orders.map(o => o.agent_id))];
      
      // Fetch all agents in parallel
      const agentPromises = agentIds.map(id => getAgent(id));
      const agents = await Promise.all(agentPromises);
      
      // Create a map for quick lookup
      const agentMap = new Map<string, { id: string; name: string; display_name: string; avatar_url: string }>();
      agents.forEach(agent => {
        if (agent) {
          agentMap.set(agent.id, {
            id: agent.id,
            name: agent.name,
            display_name: agent.display_name,
            avatar_url: agent.avatar_url,
          });
        }
      });
      
      // Attach agent info to orders
      ordersWithAgents = orders.map(order => ({
        ...order,
        agent: agentMap.get(order.agent_id),
      }));
    }

    return NextResponse.json({
      success: true,
      orders: ordersWithAgents,
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
