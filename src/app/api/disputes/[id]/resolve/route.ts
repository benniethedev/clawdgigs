import { NextRequest, NextResponse } from 'next/server';
import { getDispute, resolveDispute } from '@/lib/disputes';
import { getOrder, updateOrderStatus } from '@/lib/db';
import { getEscrow, releaseEscrow, refundEscrow, formatEscrowAmount, getPlatformWallet } from '@/lib/escrow';

/**
 * POST /api/disputes/[id]/resolve
 * 
 * Resolve a dispute and handle escrow accordingly.
 * 
 * Body:
 * - resolution: 'refund_buyer' | 'pay_seller'
 * - notes: string (explanation for the resolution)
 * - resolvedBy?: string (admin identifier)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: disputeId } = await params;
    const body = await req.json();
    const { resolution, notes, resolvedBy = 'admin' } = body;

    // Validate required fields
    if (!resolution || !['refund_buyer', 'pay_seller'].includes(resolution)) {
      return NextResponse.json(
        { error: 'Invalid resolution. Must be: refund_buyer or pay_seller' },
        { status: 400 }
      );
    }

    if (!notes || notes.trim().length < 10) {
      return NextResponse.json(
        { error: 'Please provide resolution notes (at least 10 characters)' },
        { status: 400 }
      );
    }

    // Get the dispute
    const dispute = await getDispute(disputeId);
    if (!dispute) {
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      );
    }

    // Check dispute can be resolved
    if (dispute.status === 'resolved_buyer' || dispute.status === 'resolved_seller' || dispute.status === 'cancelled') {
      return NextResponse.json(
        { error: `Dispute already ${dispute.status}` },
        { status: 400 }
      );
    }

    // Get the escrow
    const escrow = await getEscrow(dispute.escrow_id);
    if (!escrow) {
      return NextResponse.json(
        { error: 'Escrow not found' },
        { status: 404 }
      );
    }

    if (escrow.status !== 'disputed') {
      return NextResponse.json(
        { error: `Cannot resolve escrow in ${escrow.status} status` },
        { status: 400 }
      );
    }

    // Process escrow based on resolution
    let escrowResult;
    
    if (resolution === 'pay_seller') {
      escrowResult = await releaseEscrow(dispute.escrow_id);
    } else {
      escrowResult = await refundEscrow(dispute.escrow_id);
    }

    if (!escrowResult.ok) {
      return NextResponse.json(
        { error: escrowResult.error || 'Failed to process escrow' },
        { status: 500 }
      );
    }

    // Update order status
    const order = await getOrder(dispute.order_id);
    if (order) {
      const newOrderStatus = resolution === 'pay_seller' ? 'completed' : 'cancelled';
      await updateOrderStatus(dispute.order_id, newOrderStatus);
    }

    // Resolve the dispute record
    const resolveResult = await resolveDispute(disputeId, resolution, notes.trim(), resolvedBy);
    if (!resolveResult.ok) {
      console.warn('Dispute record update failed, but escrow was processed:', resolveResult.error);
    }

    const outcomeMessage = resolution === 'pay_seller'
      ? `Seller receives ${formatEscrowAmount(escrow.seller_amount)}`
      : `Buyer refunded ${formatEscrowAmount(escrow.amount)}`;

    console.log('Dispute resolved:', {
      disputeId,
      orderId: dispute.order_id,
      escrowId: dispute.escrow_id,
      resolution,
      resolvedBy,
      amount: formatEscrowAmount(escrow.amount),
      outcome: outcomeMessage,
    });

    const resolutionLabel = resolution === 'refund_buyer' ? 'Buyer refunded' : 'Seller paid';

    return NextResponse.json({
      success: true,
      message: `Dispute resolved: ${resolutionLabel}`,
      disputeId,
      resolution,
      resolvedBy,
      dispute: resolveResult.dispute,
      escrow: escrowResult.escrow,
      payout: resolution === 'pay_seller'
        ? {
            type: 'release',
            sellerWallet: escrow.seller_wallet,
            sellerAmount: formatEscrowAmount(escrow.seller_amount),
            platformFee: formatEscrowAmount(escrow.platform_fee),
            platformWallet: getPlatformWallet(),
          }
        : {
            type: 'refund',
            buyerWallet: escrow.buyer_wallet,
            refundAmount: formatEscrowAmount(escrow.amount),
          },
    });
  } catch (error) {
    console.error('Dispute resolution error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve dispute' },
      { status: 500 }
    );
  }
}
