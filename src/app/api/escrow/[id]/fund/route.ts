import { NextRequest, NextResponse } from 'next/server';
import { getEscrow, markEscrowFunded } from '@/lib/escrow';
import { updateOrderStatus } from '@/lib/db';
import { verifyTransaction } from '@/lib/solana';

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

    // CRITICAL: Verify the transaction on-chain before marking as funded
    console.log('Verifying transaction on-chain:', fundingTxSignature.slice(0, 20) + '...');
    
    const txVerification = await verifyTransaction(fundingTxSignature);
    
    if (!txVerification) {
      console.error('Transaction not found on-chain:', fundingTxSignature);
      return NextResponse.json(
        { error: 'Transaction not found on-chain. Please wait for confirmation and try again.' },
        { status: 400 }
      );
    }

    if (!txVerification.confirmed) {
      console.error('Transaction failed on-chain:', {
        signature: fundingTxSignature,
        error: txVerification.err,
      });
      return NextResponse.json(
        { error: 'Transaction failed on-chain. Payment was not successful.' },
        { status: 400 }
      );
    }

    console.log('Transaction verified on-chain:', {
      signature: fundingTxSignature.slice(0, 20) + '...',
      slot: txVerification.slot,
      blockTime: txVerification.blockTime,
    });

    // Mark escrow as funded (transaction verified)
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

    console.log('Escrow funded (verified on-chain):', {
      escrowId,
      orderId: escrow.order_id,
      fundingTxSignature: fundingTxSignature.slice(0, 20) + '...',
      verifiedSlot: txVerification.slot,
      verifiedBlockTime: txVerification.blockTime,
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
