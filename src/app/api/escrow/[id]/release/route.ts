import { NextRequest, NextResponse } from 'next/server';
import { getEscrow, releaseEscrow, getPlatformWallet, formatEscrowAmount } from '@/lib/escrow';
import { updateOrderStatus } from '@/lib/db';

/**
 * POST /api/escrow/[id]/release
 * 
 * Release escrow funds to the seller (agent)
 * Called when buyer approves delivery or auto-release timer expires
 * 
 * Body:
 * - releaseTxSignature?: string (optional, for recording the payout tx)
 * - actorWallet?: string (wallet initiating the release)
 * - isAutoRelease?: boolean (true if triggered by auto-release cron)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: escrowId } = await params;
    const body = await req.json();
    const { releaseTxSignature, actorWallet, isAutoRelease } = body;

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
        { error: `Cannot release escrow in ${escrow.status} status` },
        { status: 400 }
      );
    }

    // If not auto-release, verify the actor is the buyer
    if (!isAutoRelease && actorWallet && actorWallet !== escrow.buyer_wallet) {
      return NextResponse.json(
        { error: 'Only the buyer can release escrow funds' },
        { status: 403 }
      );
    }

    // Release the escrow
    const result = await releaseEscrow(escrowId, releaseTxSignature);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Failed to release escrow' },
        { status: 500 }
      );
    }

    // Update order status to 'completed'
    if (escrow.order_id) {
      await updateOrderStatus(escrow.order_id, 'completed');
    }

    console.log('Escrow released:', {
      escrowId,
      orderId: escrow.order_id,
      sellerWallet: escrow.seller_wallet,
      sellerAmount: formatEscrowAmount(escrow.seller_amount),
      platformFee: formatEscrowAmount(escrow.platform_fee),
      platformWallet: getPlatformWallet(),
      isAutoRelease: !!isAutoRelease,
    });

    return NextResponse.json({
      success: true,
      message: isAutoRelease 
        ? 'Escrow auto-released after 7 days' 
        : 'Escrow released successfully',
      escrow: result.escrow,
      payout: {
        sellerWallet: escrow.seller_wallet,
        sellerAmount: escrow.seller_amount,
        platformFee: escrow.platform_fee,
        platformWallet: getPlatformWallet(),
      },
    });
  } catch (error) {
    console.error('Release escrow error:', error);
    return NextResponse.json(
      { error: 'Failed to release escrow' },
      { status: 500 }
    );
  }
}
