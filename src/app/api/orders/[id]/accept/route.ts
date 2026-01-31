import { NextRequest, NextResponse } from 'next/server';
import { getOrder, updateOrderStatus, getAgent, updateAgent } from '@/lib/db';
import { releaseEscrow, getEscrow, formatEscrowAmount, getPlatformWallet } from '@/lib/escrow';
import { canTransition } from '@/lib/order-state-machine';

/**
 * POST /api/orders/[id]/accept
 * 
 * Accept delivery and release escrow funds to the agent.
 * Only the buyer (client) can accept delivery.
 * 
 * Body:
 * - wallet: string (client's wallet address for authorization)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await req.json();
    const { wallet } = body;

    // Validate wallet provided
    if (!wallet) {
      return NextResponse.json(
        { error: 'Missing wallet address' },
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

    // Verify the caller is the client
    if (wallet !== order.client_wallet) {
      return NextResponse.json(
        { error: 'Unauthorized: only the buyer can accept delivery' },
        { status: 403 }
      );
    }

    // Check if transition is valid
    const transitionResult = canTransition(order.status, 'accept', 'client');
    if (!transitionResult.success) {
      return NextResponse.json(
        { error: transitionResult.error },
        { status: 400 }
      );
    }

    // Update order status to completed
    const updated = await updateOrderStatus(orderId, 'completed');
    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update order status' },
        { status: 500 }
      );
    }

    // Update agent stats (total_jobs and total_earned_usdc)
    const agent = await getAgent(order.agent_id);
    if (agent) {
      const newTotalJobs = (parseInt(agent.total_jobs) || 0) + 1;
      const newTotalEarned = (parseFloat(agent.total_earned_usdc || '0') || 0) + parseFloat(order.amount_usdc);
      await updateAgent(order.agent_id, {
        total_jobs: String(newTotalJobs),
        total_earned_usdc: String(newTotalEarned.toFixed(2)),
      });
      console.log('Agent stats updated:', {
        agentId: order.agent_id,
        totalJobs: newTotalJobs,
        totalEarned: newTotalEarned.toFixed(2),
      });
    }

    // Release escrow if exists
    let escrowReleased = false;
    let escrowDetails = null;
    
    if (order.escrow_id) {
      const escrow = await getEscrow(order.escrow_id);
      if (escrow && escrow.status === 'funded') {
        const releaseResult = await releaseEscrow(order.escrow_id);
        if (releaseResult.ok) {
          escrowReleased = true;
          escrowDetails = {
            escrowId: order.escrow_id,
            sellerWallet: escrow.seller_wallet,
            sellerAmount: formatEscrowAmount(escrow.seller_amount),
            platformFee: formatEscrowAmount(escrow.platform_fee),
            platformWallet: getPlatformWallet(),
          };
          console.log('Escrow released on accept:', escrowDetails);
        } else {
          console.warn('Failed to release escrow:', releaseResult.error);
        }
      }
    }

    console.log('Delivery accepted:', {
      orderId,
      previousStatus: order.status,
      newStatus: 'completed',
      escrowReleased,
    });

    return NextResponse.json({
      success: true,
      message: 'Delivery accepted successfully',
      orderId,
      previousStatus: order.status,
      newStatus: 'completed',
      escrowReleased,
      escrowDetails,
    });
  } catch (error) {
    console.error('Accept delivery error:', error);
    return NextResponse.json(
      { error: 'Failed to accept delivery' },
      { status: 500 }
    );
  }
}
