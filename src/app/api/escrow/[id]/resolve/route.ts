import { NextRequest, NextResponse } from 'next/server';
import { getOrder, updateOrderStatus } from '@/lib/db';
import { getEscrow, releaseEscrow, refundEscrow, formatEscrowAmount, getPlatformWallet } from '@/lib/escrow';

/**
 * POST /api/escrow/[id]/resolve
 * 
 * Resolve a disputed escrow (admin resolution)
 * 
 * Body:
 * - resolution: 'refund_buyer' | 'pay_seller'
 * - notes: string (explanation)
 * - resolvedBy?: string (admin identifier)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: escrowId } = await params;
    const body = await req.json();
    const { resolution, notes, resolvedBy = 'admin' } = body;

    // Validate required fields
    if (!resolution || !['refund_buyer', 'pay_seller'].includes(resolution)) {
      return NextResponse.json(
        { error: 'Invalid resolution. Must be: refund_buyer or pay_seller' },
        { status: 400 }
      );
    }

    if (!notes) {
      return NextResponse.json(
        { error: 'Missing resolution notes' },
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

    if (escrow.status !== 'disputed') {
      return NextResponse.json(
        { error: `Cannot resolve escrow in ${escrow.status} status` },
        { status: 400 }
      );
    }

    // Resolve based on decision
    let result;
    if (resolution === 'pay_seller') {
      result = await releaseEscrow(escrowId);
    } else {
      result = await refundEscrow(escrowId);
    }

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Failed to resolve escrow' },
        { status: 500 }
      );
    }

    // Update the order status
    if (escrow.order_id) {
      const order = await getOrder(escrow.order_id);
      if (order) {
        const newOrderStatus = resolution === 'pay_seller' ? 'completed' : 'cancelled';
        await updateOrderStatus(escrow.order_id, newOrderStatus);
      }
    }

    console.log('Escrow dispute resolved:', {
      escrowId,
      orderId: escrow.order_id,
      resolution,
      resolvedBy,
      notes,
      amount: formatEscrowAmount(escrow.amount),
      outcome: resolution === 'pay_seller' 
        ? `Seller receives ${formatEscrowAmount(escrow.seller_amount)}, platform receives ${formatEscrowAmount(escrow.platform_fee)}`
        : `Buyer refunded ${formatEscrowAmount(escrow.amount)}`,
    });

    return NextResponse.json({
      success: true,
      message: `Dispute resolved: ${resolution}`,
      escrowId,
      resolution,
      resolvedBy,
      escrow: result.escrow,
      payout: resolution === 'pay_seller' 
        ? {
            sellerWallet: escrow.seller_wallet,
            sellerAmount: escrow.seller_amount,
            platformFee: escrow.platform_fee,
            platformWallet: getPlatformWallet(),
          }
        : {
            buyerWallet: escrow.buyer_wallet,
            refundAmount: escrow.amount,
          },
    });
  } catch (error) {
    console.error('Escrow resolution error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve escrow dispute' },
      { status: 500 }
    );
  }
}
