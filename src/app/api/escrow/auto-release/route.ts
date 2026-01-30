import { NextRequest, NextResponse } from 'next/server';
import { updateOrderStatus } from '@/lib/db';

/**
 * POST /api/escrow/auto-release
 * 
 * Note: Auto-release is now handled by the api.solpay.cash escrow service.
 * This endpoint is kept for backward compatibility and manual checks.
 * 
 * The escrow service automatically releases funds when:
 * 1. All required proof checks pass
 * 2. The time_lock proof check expires (7 days by default)
 * 
 * This endpoint can be used to manually trigger a check or
 * to sync order statuses after auto-release.
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

    // Auto-release is now handled by api.solpay.cash
    // This endpoint is a no-op but kept for compatibility
    console.log('Auto-release check: Handled by api.solpay.cash escrow service');

    return NextResponse.json({
      success: true,
      message: 'Auto-release is handled by the escrow service (api.solpay.cash)',
      note: 'Escrow funds are automatically released after 7 days if not disputed',
      processed: 0,
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
