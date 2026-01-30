import { NextRequest, NextResponse } from 'next/server';
import { getAgent, updateAgent } from '@/lib/db';

// GET /api/agents/[id] - Get agent profile
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agent = await getAgent(id);

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        display_name: agent.display_name,
        bio: agent.bio,
        avatar_url: agent.avatar_url,
        skills: agent.skills,
        hourly_rate_usdc: agent.hourly_rate_usdc,
        rating: agent.rating,
        total_jobs: agent.total_jobs,
        is_verified: agent.is_verified,
        wallet_address: agent.wallet_address,
        webhook_url: agent.webhook_url,
      },
    });
  } catch (error) {
    console.error('Get agent error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}

// PATCH /api/agents/[id] - Update agent profile
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Verify agent exists
    const agent = await getAgent(id);
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Extract allowed update fields
    const allowedUpdates: Record<string, unknown> = {};
    
    // Profile fields
    if (typeof body.display_name === 'string') {
      allowedUpdates.display_name = body.display_name;
    }
    if (typeof body.bio === 'string') {
      allowedUpdates.bio = body.bio;
    }
    if (typeof body.avatar_url === 'string') {
      allowedUpdates.avatar_url = body.avatar_url;
    }
    if (typeof body.skills === 'string') {
      allowedUpdates.skills = body.skills;
    }
    if (typeof body.hourly_rate_usdc === 'string' || typeof body.hourly_rate_usdc === 'number') {
      allowedUpdates.hourly_rate_usdc = String(body.hourly_rate_usdc);
    }
    if (typeof body.wallet_address === 'string') {
      allowedUpdates.wallet_address = body.wallet_address;
    }
    
    // Webhook URL - can be set, updated, or cleared (null/empty string)
    if (body.webhook_url !== undefined) {
      if (body.webhook_url === null || body.webhook_url === '') {
        allowedUpdates.webhook_url = null;
      } else if (typeof body.webhook_url === 'string') {
        // Validate webhook URL format
        try {
          const url = new URL(body.webhook_url);
          if (!['http:', 'https:'].includes(url.protocol)) {
            return NextResponse.json(
              { error: 'Webhook URL must use HTTP or HTTPS protocol' },
              { status: 400 }
            );
          }
          allowedUpdates.webhook_url = body.webhook_url;
        } catch {
          return NextResponse.json(
            { error: 'Invalid webhook URL format' },
            { status: 400 }
          );
        }
      }
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const success = await updateAgent(id, allowedUpdates);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update agent' },
        { status: 500 }
      );
    }

    // Fetch updated agent
    const updatedAgent = await getAgent(id);

    return NextResponse.json({
      success: true,
      message: 'Agent updated successfully',
      agent: updatedAgent,
    });
  } catch (error) {
    console.error('Update agent error:', error);
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    );
  }
}
