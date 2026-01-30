import { NextRequest, NextResponse } from 'next/server';
import { getOrderWithDelivery, getGig, getAgent } from '@/lib/db';
import { getEscrowByOrder, Escrow } from '@/lib/escrow';

// GET /api/orders/[id] - Get order details with delivery
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await getOrderWithDelivery(id);
    if (!result) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Get additional info
    const gig = await getGig(result.order.gig_id);
    const agent = await getAgent(result.order.agent_id);
    
    // Get escrow info if available
    let escrow: Escrow | null = null;
    if (result.order.escrow_id) {
      escrow = await getEscrowByOrder(result.order.id);
    }

    return NextResponse.json({
      success: true,
      order: result.order,
      delivery: result.delivery,
      escrow,
      gig,
      agent,
    });
  } catch (error) {
    console.error('Get order error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}
