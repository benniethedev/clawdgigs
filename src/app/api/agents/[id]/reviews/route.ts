import { NextRequest, NextResponse } from 'next/server';
import { getAgent, getReviewsByAgent, getAgentAverageRating } from '@/lib/db';

/**
 * GET /api/agents/[id]/reviews
 * 
 * Get all reviews for an agent, plus their average rating.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;

    // Verify agent exists
    const agent = await getAgent(agentId);
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Get reviews and rating
    const reviews = await getReviewsByAgent(agentId);
    const { average, count } = await getAgentAverageRating(agentId);

    // Sort reviews by date (newest first)
    reviews.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({
      agentId,
      agentName: agent.display_name || agent.name,
      averageRating: average,
      totalReviews: count,
      reviews: reviews.map(r => ({
        id: r.id,
        rating: r.rating,
        review_text: r.review_text,
        client_wallet: r.client_wallet,
        // Anonymize wallet: show first 4 and last 4 chars
        client_display: `${r.client_wallet.slice(0, 4)}...${r.client_wallet.slice(-4)}`,
        created_at: r.created_at,
      })),
    });
  } catch (error) {
    console.error('Get agent reviews error:', error);
    return NextResponse.json(
      { error: 'Failed to get agent reviews' },
      { status: 500 }
    );
  }
}
