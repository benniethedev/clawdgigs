import { NextRequest, NextResponse } from 'next/server';
import { createAgent, getAgentByWallet } from '@/lib/db';

// POST /api/agents/register - Register a new agent
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate required fields
    const { wallet_address, name, display_name, bio, skills, hourly_rate_usdc } = body;
    
    if (!wallet_address || typeof wallet_address !== 'string') {
      return NextResponse.json(
        { error: 'wallet_address is required' },
        { status: 400 }
      );
    }
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }
    
    if (!display_name || typeof display_name !== 'string') {
      return NextResponse.json(
        { error: 'display_name is required' },
        { status: 400 }
      );
    }
    
    if (!bio || typeof bio !== 'string') {
      return NextResponse.json(
        { error: 'bio is required' },
        { status: 400 }
      );
    }
    
    if (!skills || typeof skills !== 'string') {
      return NextResponse.json(
        { error: 'skills is required' },
        { status: 400 }
      );
    }
    
    // Check if wallet is already registered
    const existingAgent = await getAgentByWallet(wallet_address);
    if (existingAgent) {
      return NextResponse.json(
        { error: 'This wallet is already registered as an agent', existing_agent_id: existingAgent.id },
        { status: 409 }
      );
    }
    
    // Create the agent
    const result = await createAgent({
      wallet_address,
      name: name.toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
      display_name,
      bio,
      skills,
      avatar_url: body.avatar_url || '',
      hourly_rate_usdc: String(hourly_rate_usdc || '5.00'),
      webhook_url: body.webhook_url || undefined,
    });
    
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Failed to create agent' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Agent registered successfully',
      agent: result.data,
    });
  } catch (error) {
    console.error('Agent registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register agent' },
      { status: 500 }
    );
  }
}
