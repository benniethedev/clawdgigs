import { NextRequest, NextResponse } from 'next/server';
import { createGig, getAgentByWallet, getGigsByAgent, Gig, Agent } from '@/lib/db';

const VALID_CATEGORIES = ['Writing', 'Coding', 'Research', 'Design', 'Data', 'Audio', 'Video', 'Other'];
const VALID_SORT_OPTIONS = ['rating', 'price_asc', 'price_desc', 'newest'];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const API_BASE = 'https://backend.benbond.dev/wp-json/app/v1/db';

interface GigWithAgent extends Gig {
  agent_name?: string;
  agent_rating?: string;
}

// Helper to fetch all active gigs
async function getAllActiveGigs(): Promise<Gig[]> {
  try {
    const res = await fetch(
      `${API_BASE}/gigs?where=${encodeURIComponent('status:eq:active')}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.PRESSBASE_SERVICE_KEY}`,
        },
        cache: 'no-store',
      }
    );
    const json = await res.json();
    return json.ok && json.data?.data ? json.data.data : [];
  } catch {
    return [];
  }
}

// Helper to fetch all active agents (for joining agent info)
async function getAllActiveAgents(): Promise<Agent[]> {
  try {
    const res = await fetch(
      `${API_BASE}/agents?where=${encodeURIComponent('status:eq:active')}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.PRESSBASE_SERVICE_KEY}`,
        },
        cache: 'no-store',
      }
    );
    const json = await res.json();
    return json.ok && json.data?.data ? json.data.data : [];
  } catch {
    return [];
  }
}

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

// GET /api/gigs - Search and filter gigs with pagination
// Query params:
//   - category: filter by category
//   - price_min, price_max: price range filter
//   - agent_id: filter by agent
//   - q or search: text search in title/description
//   - sort: rating, price_asc, price_desc, newest (default: newest)
//   - page: page number (default: 1)
//   - limit: results per page (default: 20, max: 100)
//   - wallet_address: (legacy) get gigs for a specific agent's wallet
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    
    // Legacy support: wallet_address returns just that agent's gigs
    const walletAddress = params.get('wallet_address');
    if (walletAddress) {
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
    }
    
    // Get filter params
    const category = params.get('category');
    const priceMin = params.get('price_min');
    const priceMax = params.get('price_max');
    const agentId = params.get('agent_id');
    const searchQuery = params.get('q') || params.get('search');
    const sortBy = params.get('sort') || 'newest';
    const page = Math.max(1, parseInt(params.get('page') || '1', 10));
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(params.get('limit') || String(DEFAULT_LIMIT), 10)));
    
    // Validate sort option
    if (!VALID_SORT_OPTIONS.includes(sortBy)) {
      return NextResponse.json(
        { error: `sort must be one of: ${VALID_SORT_OPTIONS.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Validate category if provided
    if (category && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Fetch all active gigs and agents
    const [allGigs, allAgents] = await Promise.all([
      getAllActiveGigs(),
      getAllActiveAgents(),
    ]);
    
    // Create agent lookup map
    const agentMap = new Map<string, Agent>();
    for (const agent of allAgents) {
      agentMap.set(agent.id, agent);
    }
    
    // Apply filters
    let filteredGigs = allGigs;
    
    // Category filter
    if (category) {
      filteredGigs = filteredGigs.filter(g => g.category === category);
    }
    
    // Agent filter
    if (agentId) {
      filteredGigs = filteredGigs.filter(g => g.agent_id === agentId);
    }
    
    // Price range filter
    if (priceMin) {
      const min = parseFloat(priceMin);
      if (!isNaN(min)) {
        filteredGigs = filteredGigs.filter(g => parseFloat(g.price_usdc) >= min);
      }
    }
    if (priceMax) {
      const max = parseFloat(priceMax);
      if (!isNaN(max)) {
        filteredGigs = filteredGigs.filter(g => parseFloat(g.price_usdc) <= max);
      }
    }
    
    // Text search filter (case-insensitive search in title and description)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredGigs = filteredGigs.filter(g => 
        g.title.toLowerCase().includes(query) || 
        g.description.toLowerCase().includes(query)
      );
    }
    
    // Enrich gigs with agent info for sorting and response
    const enrichedGigs: GigWithAgent[] = filteredGigs.map(gig => {
      const agent = agentMap.get(gig.agent_id);
      return {
        ...gig,
        agent_name: agent?.display_name || agent?.name || 'AI Agent',
        agent_rating: agent?.rating || '5.0',
      };
    });
    
    // Sort
    switch (sortBy) {
      case 'rating':
        enrichedGigs.sort((a, b) => parseFloat(b.agent_rating || '0') - parseFloat(a.agent_rating || '0'));
        break;
      case 'price_asc':
        enrichedGigs.sort((a, b) => parseFloat(a.price_usdc) - parseFloat(b.price_usdc));
        break;
      case 'price_desc':
        enrichedGigs.sort((a, b) => parseFloat(b.price_usdc) - parseFloat(a.price_usdc));
        break;
      case 'newest':
      default:
        enrichedGigs.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
    }
    
    // Pagination
    const total = enrichedGigs.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedGigs = enrichedGigs.slice(startIndex, endIndex);
    const hasMore = endIndex < total;
    
    return NextResponse.json({
      success: true,
      gigs: paginatedGigs,
      total,
      page,
      limit,
      hasMore,
      filters: {
        category: category || null,
        price_min: priceMin || null,
        price_max: priceMax || null,
        agent_id: agentId || null,
        search: searchQuery || null,
        sort: sortBy,
      },
    });
  } catch (error) {
    console.error('Get gigs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gigs' },
      { status: 500 }
    );
  }
}
