import { NextRequest, NextResponse } from 'next/server';
import { getOrderWithDelivery, getGig, getAgent } from '@/lib/db';

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

    return NextResponse.json({
      success: true,
      order: result.order,
      delivery: result.delivery,
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
