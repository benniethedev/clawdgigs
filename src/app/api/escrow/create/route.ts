import { NextRequest, NextResponse } from 'next/server';
import { createEscrow, getPlatformFeePercent, getPlatformWallet } from '@/lib/escrow';
import { getAgent } from '@/lib/db';

/**
 * POST /api/escrow/create
 * 
 * Create a new escrow for an order
 * 
 * Body:
 * - orderId: string
 * - clientWallet: string (buyer wallet address)
 * - agentId: string (to look up agent wallet)
 * - agentWallet?: string (optional, override agent wallet)
 * - amountUsdc: string (amount in USDC)
 * - description?: string
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, clientWallet, agentId, agentWallet, amountUsdc, description } = body;

    // Validate required fields
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    if (!clientWallet) {
      return NextResponse.json({ error: 'Missing clientWallet' }, { status: 400 });
    }

    if (!amountUsdc || isNaN(parseFloat(amountUsdc))) {
      return NextResponse.json({ error: 'Invalid amountUsdc' }, { status: 400 });
    }

    // Get agent wallet if not provided
    let sellerWallet = agentWallet;
    if (!sellerWallet && agentId) {
      const agent = await getAgent(agentId);
      if (!agent?.wallet_address) {
        return NextResponse.json({ error: 'Agent wallet not found' }, { status: 400 });
      }
      sellerWallet = agent.wallet_address;
    }

    if (!sellerWallet) {
      return NextResponse.json({ error: 'Missing agentWallet or agentId' }, { status: 400 });
    }

    // Create the escrow
    const result = await createEscrow({
      orderId,
      clientWallet,
      agentWallet: sellerWallet,
      amountUsdc,
      description,
    });

    if (!result.ok || !result.data) {
      console.error('Failed to create escrow:', result.error);
      return NextResponse.json(
        { error: result.error || 'Failed to create escrow' },
        { status: 500 }
      );
    }

    console.log('Escrow created:', {
      escrowId: result.data.id,
      orderId,
      amount: result.data.amount,
      platformFee: result.data.platform_fee,
      sellerAmount: result.data.seller_amount,
    });

    return NextResponse.json({
      success: true,
      escrow: result.data,
      platformFee: {
        percent: getPlatformFeePercent(),
        wallet: getPlatformWallet(),
      },
    });
  } catch (error) {
    console.error('Create escrow error:', error);
    return NextResponse.json(
      { error: 'Failed to create escrow' },
      { status: 500 }
    );
  }
}
