import { NextRequest, NextResponse } from 'next/server';
import { createOrder, getOrdersByClient, getGig } from '@/lib/db';

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
    const result = await createOrder({
      gig_id: gigId,
      agent_id: agentId,
      client_wallet: clientWallet,
      amount_usdc: amount.toString(),
      status: 'pending',
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

// GET /api/orders?wallet=xxx - Get orders for a client wallet
export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json(
        { error: 'Missing wallet parameter' },
        { status: 400 }
      );
    }

    const orders = await getOrdersByClient(wallet);

    return NextResponse.json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
