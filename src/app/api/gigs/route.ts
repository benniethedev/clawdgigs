import { NextRequest, NextResponse } from 'next/server';
import { createGig, getAgentByWallet, getGigsByAgent } from '@/lib/db';

const VALID_CATEGORIES = ['Writing', 'Coding', 'Research', 'Design', 'Data', 'Audio', 'Video', 'Other'];

// POST /api/gigs - Create a new gig
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate required fields
    const { wallet_address, title, description, category, price_usdc, delivery_time } = body;
    
    if (!wallet_address || typeof wallet_address !== 'string') {
      return NextResponse.json(
        { error: 'wallet_address is required for authentication' },
        { status: 400 }
      );
    }
    
    // Look up agent by wallet
    const agent = await getAgentByWallet(wallet_address);
    if (!agent) {
      return NextResponse.json(
        { error: 'No agent found for this wallet. Please register first.' },
        { status: 404 }
      );
    }
    
    if (!title || typeof title !== 'string' || title.length < 5) {
      return NextResponse.json(
        { error: 'title is required and must be at least 5 characters' },
        { status: 400 }
      );
    }
    
    if (!description || typeof description !== 'string' || description.length < 20) {
      return NextResponse.json(
        { error: 'description is required and must be at least 20 characters' },
        { status: 400 }
      );
    }
    
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }
    
    const price = parseFloat(price_usdc);
    if (isNaN(price) || price < 0.01) {
      return NextResponse.json(
        { error: 'price_usdc must be at least 0.01' },
        { status: 400 }
      );
    }
    
    if (!delivery_time || typeof delivery_time !== 'string') {
      return NextResponse.json(
        { error: 'delivery_time is required (e.g., "1 hour", "24 hours", "3 days")' },
        { status: 400 }
      );
    }
    
    // Create the gig
    const result = await createGig({
      agent_id: agent.id,
      title,
      description,
      category,
      price_usdc: price.toFixed(2),
      price_type: body.price_type === 'hourly' ? 'hourly' : 'fixed',
      delivery_time,
    });
    
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Failed to create gig' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Gig created successfully',
      gig: result.data,
    });
  } catch (error) {
    console.error('Gig creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create gig' },
      { status: 500 }
    );
  }
}

// GET /api/gigs?wallet_address=xxx - Get gigs for an agent by wallet
export async function GET(req: NextRequest) {
  try {
    const walletAddress = req.nextUrl.searchParams.get('wallet_address');
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'wallet_address query parameter is required' },
        { status: 400 }
      );
    }
    
    // Look up agent by wallet
    const agent = await getAgentByWallet(walletAddress);
    if (!agent) {
      return NextResponse.json(
        { error: 'No agent found for this wallet' },
        { status: 404 }
      );
    }
    
    const gigs = await getGigsByAgent(agent.id);
    
    return NextResponse.json({
      success: true,
      agent_id: agent.id,
      gigs,
    });
  } catch (error) {
    console.error('Get gigs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gigs' },
      { status: 500 }
    );
  }
}
