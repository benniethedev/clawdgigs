import { NextRequest, NextResponse } from 'next/server';
import { getEscrowsForAutoRelease, releaseEscrow, formatEscrowAmount, getPlatformWallet } from '@/lib/escrow';
import { updateOrderStatus } from '@/lib/db';

/**
 * POST /api/escrow/auto-release
 * 
 * Process auto-release for escrows past their 7-day window
 * Should be called by a cron job
 * 
 * Headers:
 * - X-Cron-Secret: shared secret to authenticate cron calls
 */
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret if configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const providedSecret = req.headers.get('X-Cron-Secret');
      if (providedSecret !== cronSecret) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Get all escrows due for auto-release
    const escrowsToRelease = await getEscrowsForAutoRelease();
    
    if (escrowsToRelease.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No escrows due for auto-release',
        processed: 0,
      });
    }

    const results: Array<{
      escrowId: string;
      orderId: string;
      sellerWallet: string;
      amount: string;
      success: boolean;
      error?: string;
    }> = [];

    // Process each escrow
    for (const escrow of escrowsToRelease) {
      try {
        // Release the escrow
        const releaseResult = await releaseEscrow(escrow.id, undefined);
        
        if (releaseResult.ok) {
          // Update order status
          if (escrow.order_id) {
            await updateOrderStatus(escrow.order_id, 'completed');
          }
          
          results.push({
            escrowId: escrow.id,
            orderId: escrow.order_id,
            sellerWallet: escrow.seller_wallet,
            amount: formatEscrowAmount(escrow.seller_amount),
            success: true,
          });
          
          console.log('Auto-released escrow:', {
            escrowId: escrow.id,
            orderId: escrow.order_id,
            sellerWallet: escrow.seller_wallet,
            sellerAmount: formatEscrowAmount(escrow.seller_amount),
            platformFee: formatEscrowAmount(escrow.platform_fee),
            platformWallet: getPlatformWallet(),
          });
        } else {
          results.push({
            escrowId: escrow.id,
            orderId: escrow.order_id,
            sellerWallet: escrow.seller_wallet,
            amount: formatEscrowAmount(escrow.seller_amount),
            success: false,
            error: releaseResult.error,
          });
        }
      } catch (error) {
        results.push({
          escrowId: escrow.id,
          orderId: escrow.order_id,
          sellerWallet: escrow.seller_wallet,
          amount: formatEscrowAmount(escrow.seller_amount),
          success: false,
          error: String(error),
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log('Auto-release batch complete:', {
      total: escrowsToRelease.length,
      success: successCount,
      failed: failCount,
    });

    return NextResponse.json({
      success: true,
      message: `Auto-released ${successCount} escrow(s)`,
      processed: escrowsToRelease.length,
      successCount,
      failCount,
      results,
    });
  } catch (error) {
    console.error('Auto-release check error:', error);
    return NextResponse.json(
      { error: 'Failed to process auto-release check' },
      { status: 500 }
    );
  }
}

// Also support GET for manual testing
export async function GET(req: NextRequest) {
  return POST(req);
}
