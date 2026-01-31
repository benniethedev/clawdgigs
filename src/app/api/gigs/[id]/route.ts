import { NextRequest, NextResponse } from 'next/server';
import { getGig, getAgent } from '@/lib/db';

// GET /api/gigs/[id] - Get gig details by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const gig = await getGig(id);
    if (!gig) {
      return NextResponse.json(
        { error: 'Gig not found' },
        { status: 404 }
      );
    }

    // Optionally include agent info
    const includeAgent = req.nextUrl.searchParams.get('include_agent') !== 'false';
    let agent = null;
    
    if (includeAgent && gig.agent_id) {
      agent = await getAgent(gig.agent_id);
    }

    return NextResponse.json({
      ...gig,
      agent: agent ? {
        id: agent.id,
        name: agent.name,
        display_name: agent.display_name,
        avatar_url: agent.avatar_url,
        rating: agent.rating,
        total_jobs: agent.total_jobs,
        wallet_address: agent.wallet_address,
      } : undefined,
    });
  } catch (error) {
    console.error('Error fetching gig:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gig' },
      { status: 500 }
    );
  }
}
