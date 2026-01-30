import { NextRequest, NextResponse } from 'next/server';
import { getOrdersByAgent } from '@/lib/db';

// GET /api/orders/agent?agentId=xxx - Get orders for an agent
export async function GET(req: NextRequest) {
  try {
    const agentId = req.nextUrl.searchParams.get('agentId');
    const status = req.nextUrl.searchParams.get('status');

    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing agentId parameter' },
        { status: 400 }
      );
    }

    let orders = await getOrdersByAgent(agentId);

    // Filter by status if provided
    if (status) {
      orders = orders.filter(o => o.status === status);
    }

    return NextResponse.json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error('Get agent orders error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
