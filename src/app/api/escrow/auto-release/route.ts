import { NextRequest, NextResponse } from 'next/server';
import { getPendingAutoReleaseEscrows, releaseEscrow } from '@/lib/escrow';
import { updateOrderStatus } from '@/lib/db';

/**
 * POST /api/escrow/auto-release
 * 
 * Process escrows that are past their auto-release deadline.
 * Should be called by a cron job (e.g., every hour).
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

    // Get all escrows past their release deadline
    const pendingEscrows = await getPendingAutoReleaseEscrows();
    
    if (pendingEscrows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No escrows pending auto-release',
        processed: 0,
      });
    }

    const results: { escrowId: string; success: boolean; error?: string }[] = [];

    for (const escrow of pendingEscrows) {
      try {
        const result = await releaseEscrow(escrow.id);
        
        if (result.ok) {
          // Update order status to completed
          await updateOrderStatus(escrow.order_id, 'completed');
          results.push({ escrowId: escrow.id, success: true });
          console.log(`Auto-released escrow ${escrow.id} for order ${escrow.order_id}`);
        } else {
          results.push({ escrowId: escrow.id, success: false, error: result.error });
          console.warn(`Failed to auto-release escrow ${escrow.id}:`, result.error);
        }
      } catch (err) {
        results.push({ escrowId: escrow.id, success: false, error: String(err) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    return NextResponse.json({
      success: true,
      message: `Processed ${successCount}/${pendingEscrows.length} escrows`,
      processed: successCount,
      total: pendingEscrows.length,
      results,
    });
  } catch (error) {
    console.error('Auto-release error:', error);
    return NextResponse.json(
      { error: 'Failed to process auto-release' },
      { status: 500 }
    );
  }
}

// Also support GET for manual testing
export async function GET(req: NextRequest) {
  return POST(req);
}
