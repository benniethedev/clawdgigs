import { NextRequest, NextResponse } from 'next/server';
import { getEscrowsForAutoRelease, releaseEscrow, formatEscrowAmount, getPlatformWallet } from '@/lib/escrow';
import { updateOrderStatus } from '@/lib/db';

/**
 * GET /api/jobs/auto-release
 * 
 * Vercel Cron Job: Auto-release funded escrows after 7 days
 * 
 * Conditions for auto-release:
 * - Status is 'funded'
 * - funded_at is more than 7 days ago
 * - No dispute_reason set (not disputed)
 * 
 * Authentication:
 * - Vercel cron sends Authorization: Bearer <CRON_SECRET>
 * - Also accepts X-Cron-Secret header for backwards compatibility
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authorization (Vercel cron uses Authorization header)
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get('Authorization');
      const cronHeader = req.headers.get('X-Cron-Secret');
      
      const bearerToken = authHeader?.replace('Bearer ', '');
      
      if (bearerToken !== cronSecret && cronHeader !== cronSecret) {
        console.log('Auto-release: Unauthorized request');
        return NextResponse.json(
          { ok: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('Auto-release cron job started:', new Date().toISOString());

    // Get all escrows due for auto-release
    const escrowsToRelease = await getEscrowsForAutoRelease();
    
    if (escrowsToRelease.length === 0) {
      console.log('Auto-release: No escrows due');
      return NextResponse.json({
        ok: true,
        message: 'No escrows due for auto-release',
        processed: 0,
        released: 0,
        failed: 0,
      });
    }

    console.log(`Auto-release: Found ${escrowsToRelease.length} escrow(s) to process`);

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
      // Skip if escrow has dispute_reason set (already verified by getEscrowsForAutoRelease, but double-check)
      if (escrow.dispute_reason) {
        console.log(`Auto-release: Skipping ${escrow.id} - has dispute`);
        continue;
      }

      try {
        // Release the escrow funds to seller
        const releaseResult = await releaseEscrow(escrow.id, undefined);
        
        if (releaseResult.ok) {
          // Update order status to completed
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
          console.error(`Auto-release failed for ${escrow.id}:`, releaseResult.error);
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
        console.error(`Auto-release error for ${escrow.id}:`, error);
      }
    }

    const released = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log('Auto-release cron job complete:', {
      processed: results.length,
      released,
      failed,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      message: `Auto-released ${released} escrow(s)`,
      processed: results.length,
      released,
      failed,
      results,
    });
  } catch (error) {
    console.error('Auto-release cron job error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to process auto-release', details: String(error) },
      { status: 500 }
    );
  }
}
