import { NextRequest, NextResponse } from 'next/server';
import { getEscrow, refundEscrow, formatEscrowAmount } from '@/lib/escrow';
import { updateOrderStatus } from '@/lib/db';

/**
 * POST /api/escrow/[id]/refund
 * 
 * Refund escrow funds to the buyer
 * Can be triggered by seller (voluntary refund) or after dispute resolution
 * 
 * Body:
 * - refundTxSignature?: string (optional, for recording the refund tx)
 * - actorWallet?: string (wallet initiating the refund)
 * - reason?: string (reason for refund)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: escrowId } = await params;
    const body = await req.json();
    const { refundTxSignature, actorWallet, reason } = body;

    // Get the escrow
    const escrow = await getEscrow(escrowId);
    if (!escrow) {
      return NextResponse.json(
        { error: 'Escrow not found' },
        { status: 404 }
      );
    }

    // Can refund from funded or disputed status
    if (escrow.status !== 'funded' && escrow.status !== 'disputed') {
      return NextResponse.json(
        { error: `Cannot refund escrow in ${escrow.status} status` },
        { status: 400 }
      );
    }

    // Verify the actor is authorized (seller can initiate voluntary refund)
    if (actorWallet && actorWallet !== escrow.seller_wallet && actorWallet !== escrow.buyer_wallet) {
      return NextResponse.json(
        { error: 'Only the seller or buyer can initiate refund' },
        { status: 403 }
      );
    }

    // Refund the escrow
    const result = await refundEscrow(escrowId, refundTxSignature);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Failed to refund escrow' },
        { status: 500 }
      );
    }

    // Update order status to 'cancelled'
    if (escrow.order_id) {
      await updateOrderStatus(escrow.order_id, 'cancelled');
    }

    console.log('Escrow refunded:', {
      escrowId,
      orderId: escrow.order_id,
      buyerWallet: escrow.buyer_wallet,
      refundAmount: formatEscrowAmount(escrow.amount),
      reason,
    });

    return NextResponse.json({
      success: true,
      message: 'Escrow refunded successfully',
      escrow: result.escrow,
      refund: {
        buyerWallet: escrow.buyer_wallet,
        refundAmount: escrow.amount, // Full amount refunded to buyer
      },
    });
  } catch (error) {
    console.error('Refund escrow error:', error);
    return NextResponse.json(
      { error: 'Failed to refund escrow' },
      { status: 500 }
    );
  }
}
