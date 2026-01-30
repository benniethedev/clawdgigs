import { NextRequest, NextResponse } from 'next/server';
import { getEscrow, markEscrowFunded } from '@/lib/escrow';
import { updateOrderStatus } from '@/lib/db';

/**
 * POST /api/escrow/[id]/fund
 * 
 * Mark an escrow as funded after payment verification
 * 
 * Body:
 * - fundingTxSignature: string (the Solana transaction signature)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: escrowId } = await params;
    const body = await req.json();
    const { fundingTxSignature } = body;

    if (!fundingTxSignature) {
      return NextResponse.json(
        { error: 'Missing fundingTxSignature' },
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

    if (escrow.status !== 'pending_funding') {
      return NextResponse.json(
        { error: `Cannot fund escrow in ${escrow.status} status` },
        { status: 400 }
      );
    }

    // Mark escrow as funded
    const result = await markEscrowFunded(escrowId, fundingTxSignature);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Failed to fund escrow' },
        { status: 500 }
      );
    }

    // Update order status to 'paid' if linked
    if (escrow.order_id) {
      await updateOrderStatus(escrow.order_id, 'paid');
    }

    // Get updated escrow
    const updatedEscrow = await getEscrow(escrowId);

    console.log('Escrow funded:', {
      escrowId,
      orderId: escrow.order_id,
      fundingTxSignature: fundingTxSignature.slice(0, 20) + '...',
      autoReleaseAt: updatedEscrow?.auto_release_at,
    });

    return NextResponse.json({
      success: true,
      message: 'Escrow funded successfully',
      escrow: updatedEscrow,
    });
  } catch (error) {
    console.error('Fund escrow error:', error);
    return NextResponse.json(
      { error: 'Failed to fund escrow' },
      { status: 500 }
    );
  }
}
