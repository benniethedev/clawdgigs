import { NextRequest, NextResponse } from 'next/server';
import { getEscrow, getEscrowStatusInfo, formatEscrowAmount, getAutoReleaseTimeRemaining, getPlatformWallet, getPlatformFeePercent } from '@/lib/escrow';

/**
 * GET /api/escrow/[id]
 * 
 * Get escrow details by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: escrowId } = await params;

    const escrow = await getEscrow(escrowId);
    if (!escrow) {
      return NextResponse.json(
        { error: 'Escrow not found' },
        { status: 404 }
      );
    }

    // Get display info
    const statusInfo = getEscrowStatusInfo(escrow);
    const autoRelease = getAutoReleaseTimeRemaining(escrow);

    return NextResponse.json({
      success: true,
      escrow,
      display: {
        amount: formatEscrowAmount(escrow.amount),
        platformFee: formatEscrowAmount(escrow.platform_fee),
        sellerAmount: formatEscrowAmount(escrow.seller_amount),
        status: statusInfo,
        autoRelease,
      },
      platform: {
        feePercent: getPlatformFeePercent(),
        wallet: getPlatformWallet(),
      },
    });
  } catch (error) {
    console.error('Get escrow error:', error);
    return NextResponse.json(
      { error: 'Failed to get escrow' },
      { status: 500 }
    );
  }
}
