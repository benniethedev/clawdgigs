import { NextRequest, NextResponse } from 'next/server';
import { getEscrow, disputeEscrow, formatEscrowAmount } from '@/lib/escrow';
import { updateOrderStatus } from '@/lib/db';

/**
 * POST /api/escrow/[id]/dispute
 * 
 * Open a dispute on an escrow
 * Only the buyer can dispute (they're the one who paid)
 * 
 * Body:
 * - reason: string (reason for dispute)
 * - actorWallet: string (wallet opening the dispute)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: escrowId } = await params;
    const body = await req.json();
    const { reason, actorWallet } = body;

    if (!reason) {
      return NextResponse.json(
        { error: 'Missing dispute reason' },
        { status: 400 }
      );
    }

    // Get the escrow
    const escrow = await getEscrow(escrowId);
    if (!escrow) {
      return NextResponse.json(
        { error: 'Escrow not found' },
        { status: 404 }
      );
    }

    if (escrow.status !== 'funded') {
      return NextResponse.json(
        { error: `Cannot dispute escrow in ${escrow.status} status` },
        { status: 400 }
      );
    }

    // Verify the actor is the buyer
    if (actorWallet && actorWallet !== escrow.buyer_wallet) {
      return NextResponse.json(
        { error: 'Only the buyer can open a dispute' },
        { status: 403 }
      );
    }

    // Open the dispute
    const result = await disputeEscrow(escrowId, reason);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Failed to open dispute' },
        { status: 500 }
      );
    }

    // Update order status to 'disputed'
    if (escrow.order_id) {
      await updateOrderStatus(escrow.order_id, 'disputed');
    }

    console.log('Escrow disputed:', {
      escrowId,
      orderId: escrow.order_id,
      buyerWallet: escrow.buyer_wallet,
      sellerWallet: escrow.seller_wallet,
      amount: formatEscrowAmount(escrow.amount),
      reason,
    });

    return NextResponse.json({
      success: true,
      message: 'Dispute opened successfully',
      escrow: result.escrow,
      dispute: {
        reason,
        openedBy: escrow.buyer_wallet,
        openedAt: result.escrow?.disputed_at,
      },
    });
  } catch (error) {
    console.error('Dispute escrow error:', error);
    return NextResponse.json(
      { error: 'Failed to open dispute' },
      { status: 500 }
    );
  }
}
