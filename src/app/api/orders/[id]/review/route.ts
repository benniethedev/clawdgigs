import { NextRequest, NextResponse } from 'next/server';
import { getOrder, getReviewByOrder, createReview, updateAgentRating } from '@/lib/db';

/**
 * POST /api/orders/[id]/review
 * 
 * Submit a review for a completed order.
 * Only the buyer can review, and only completed orders can be reviewed.
 * One review per order.
 * 
 * Body:
 * - wallet: string (client's wallet address for authorization)
 * - rating: number (1-5)
 * - review_text: string (optional review comment)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await req.json();
    const { wallet, rating, review_text } = body;

    // Validate required fields
    if (!wallet) {
      return NextResponse.json(
        { error: 'Missing wallet address' },
        { status: 400 }
      );
    }

    if (rating === undefined || rating === null) {
      return NextResponse.json(
        { error: 'Missing rating' },
        { status: 400 }
      );
    }

    // Validate rating is 1-5
    const ratingNum = Number(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5 || !Number.isInteger(ratingNum)) {
      return NextResponse.json(
        { error: 'Rating must be an integer between 1 and 5' },
        { status: 400 }
      );
    }

    // Get the order
    const order = await getOrder(orderId);
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify the caller is the client (buyer)
    if (wallet !== order.client_wallet) {
      return NextResponse.json(
        { error: 'Unauthorized: only the buyer can leave a review' },
        { status: 403 }
      );
    }

    // Check if order is completed
    if (order.status !== 'completed') {
      return NextResponse.json(
        { error: 'Can only review completed orders' },
        { status: 400 }
      );
    }

    // Check if a review already exists for this order
    const existingReview = await getReviewByOrder(orderId);
    if (existingReview) {
      return NextResponse.json(
        { error: 'A review already exists for this order' },
        { status: 400 }
      );
    }

    // Create the review
    const reviewResult = await createReview({
      order_id: orderId,
      agent_id: order.agent_id,
      client_wallet: wallet,
      rating: ratingNum,
      review_text: review_text || '',
    });

    if (!reviewResult.ok) {
      return NextResponse.json(
        { error: reviewResult.error || 'Failed to create review' },
        { status: 500 }
      );
    }

    // Update the agent's average rating
    await updateAgentRating(order.agent_id);

    console.log('Review created:', {
      orderId,
      agentId: order.agent_id,
      rating: ratingNum,
      reviewId: reviewResult.data?.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Review submitted successfully',
      review: reviewResult.data,
    });
  } catch (error) {
    console.error('Review submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit review' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orders/[id]/review
 * 
 * Get the review for a specific order (if exists)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    const review = await getReviewByOrder(orderId);
    
    if (!review) {
      return NextResponse.json(
        { review: null },
        { status: 200 }
      );
    }

    return NextResponse.json({ review });
  } catch (error) {
    console.error('Get review error:', error);
    return NextResponse.json(
      { error: 'Failed to get review' },
      { status: 500 }
    );
  }
}
