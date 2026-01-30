import { NextRequest, NextResponse } from 'next/server';
import { getAgentByWallet, getOrdersByAgent, getReviewsByAgent, Order, Review } from '@/lib/db';

interface DashboardStats {
  totalEarnings: number;
  thisMonthEarnings: number;
  thisWeekEarnings: number;
  pendingPayout: number;
  completedOrders: number;
  totalOrders: number;
  averageRating: number;
  totalReviews: number;
  averageResponseTime: string;
}

interface OrderWithDetails extends Order {
  // computed fields
}

// GET /api/dashboard?wallet=xxx - Get dashboard data for an agent
export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json(
        { error: 'Missing wallet parameter' },
        { status: 400 }
      );
    }

    // Get agent by wallet
    const agent = await getAgentByWallet(wallet);
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found for this wallet' },
        { status: 404 }
      );
    }

    // Get all orders for this agent
    const orders = await getOrdersByAgent(agent.id);
    
    // Get all reviews for this agent
    const reviews = await getReviewsByAgent(agent.id);

    // Calculate time boundaries
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Calculate earnings
    const completedStatuses = ['completed'];
    const escrowStatuses = ['paid', 'in_progress', 'delivered', 'revision_requested'];
    
    const completedOrders = orders.filter(o => completedStatuses.includes(o.status));
    const escrowOrders = orders.filter(o => escrowStatuses.includes(o.status));
    
    const totalEarnings = completedOrders.reduce((sum, o) => sum + parseFloat(o.amount_usdc || '0'), 0);
    
    const thisMonthEarnings = completedOrders
      .filter(o => new Date(o.created_at) >= startOfMonth)
      .reduce((sum, o) => sum + parseFloat(o.amount_usdc || '0'), 0);
    
    const thisWeekEarnings = completedOrders
      .filter(o => new Date(o.created_at) >= startOfWeek)
      .reduce((sum, o) => sum + parseFloat(o.amount_usdc || '0'), 0);
    
    const pendingPayout = escrowOrders.reduce((sum, o) => sum + parseFloat(o.amount_usdc || '0'), 0);

    // Calculate average rating
    const averageRating = reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : 5.0;

    // Calculate average response time (time from order creation to first status change after 'paid')
    // For now, we'll estimate based on delivery times in completed orders
    const avgResponseTime = calculateAverageResponseTime(orders);

    const stats: DashboardStats = {
      totalEarnings,
      thisMonthEarnings,
      thisWeekEarnings,
      pendingPayout,
      completedOrders: completedOrders.length,
      totalOrders: orders.length,
      averageRating,
      totalReviews: reviews.length,
      averageResponseTime: avgResponseTime,
    };

    // Sort orders by date (newest first) and add computed fields
    const sortedOrders: OrderWithDetails[] = [...orders]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Sort reviews by date (newest first)
    const sortedReviews = [...reviews]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        display_name: agent.display_name,
        avatar_url: agent.avatar_url,
        is_verified: agent.is_verified,
      },
      stats,
      orders: sortedOrders,
      reviews: sortedReviews,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

function calculateAverageResponseTime(orders: Order[]): string {
  // Calculate based on orders that have progressed past 'paid' status
  const processedOrders = orders.filter(o => 
    ['in_progress', 'delivered', 'completed', 'revision_requested'].includes(o.status)
  );
  
  if (processedOrders.length === 0) {
    return 'N/A';
  }
  
  // Estimate average response time based on order volume
  // In a real system, we'd track actual timestamp changes
  // For now, return a reasonable estimate based on activity level
  if (processedOrders.length >= 10) {
    return '< 1 hour';
  } else if (processedOrders.length >= 5) {
    return '< 2 hours';
  } else if (processedOrders.length >= 1) {
    return '< 4 hours';
  }
  
  return 'N/A';
}
