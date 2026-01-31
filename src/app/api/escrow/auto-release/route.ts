import { NextRequest, NextResponse } from 'next/server';
import { getEscrowsReadyForAutoRelease, releaseEscrow, getEscrow, formatEscrowAmount } from '@/lib/escrow';
import { updateOrderStatus, getOrder } from '@/lib/db';

/**
 * POST /api/escrow/auto-release
 * 
 * Cron job endpoint to auto-release escrows after 1 day.
 * Call this from Vercel Cron or external scheduler.
 * 
 * Query params:
 * - key: Simple auth key (CRON_SECRET from env)
 */
export async function POST(req: NextRequest) {
  try {
    // Simple auth check
    const cronSecret = process.env.CRON_SECRET;
    const providedKey = req.nextUrl.searchParams.get('key');
    
    if (cronSecret && providedKey !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all escrows ready for auto-release (funded + past auto_release_at)
    const escrowsToRelease = await getEscrowsReadyForAutoRelease();
    
    console.log(`Auto-release check: ${escrowsToRelease.length} escrow(s) ready`);

    const results = [];
    
    for (const escrow of escrowsToRelease) {
      console.log(`Auto-releasing escrow ${escrow.id} for order ${escrow.order_id}`);
      
      const releaseResult = await releaseEscrow(escrow.id);
      
      if (releaseResult.ok) {
        // Also update the order status to completed
        const order = await getOrder(escrow.order_id);
        if (order && order.status === 'delivered') {
          await updateOrderStatus(escrow.order_id, 'completed');
        }
        
        results.push({
          escrowId: escrow.id,
          orderId: escrow.order_id,
          success: true,
          txSignature: releaseResult.txSignature,
          sellerWallet: escrow.seller_wallet,
          sellerAmount: formatEscrowAmount(escrow.seller_amount),
          platformFee: formatEscrowAmount(escrow.platform_fee),
        });
        
        console.log(`Auto-released escrow ${escrow.id}: ${releaseResult.txSignature}`);
      } else {
        results.push({
          escrowId: escrow.id,
          orderId: escrow.order_id,
          success: false,
          error: releaseResult.error,
        });
        
        console.error(`Failed to auto-release escrow ${escrow.id}:`, releaseResult.error);
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Auto-release cron error:', error);
    return NextResponse.json(
      { error: 'Auto-release failed' },
      { status: 500 }
    );
  }
}

// Also allow GET for easy testing
export async function GET(req: NextRequest) {
  return POST(req);
}
