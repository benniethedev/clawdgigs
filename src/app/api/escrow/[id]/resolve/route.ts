import { NextRequest, NextResponse } from 'next/server';
import { getOrder, updateOrderStatus } from '@/lib/db';
import { resolveDispute, getEscrow } from '@/lib/escrow';

/**
 * POST /api/escrow/[id]/resolve
 * 
 * Resolve a disputed escrow (AI resolution or admin)
 * 
 * Body:
 * - resolution: 'release' | 'refund'
 * - details: string (explanation)
 * - resolvedBy?: string (default: 'ai')
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: escrowId } = await params;
    const body = await req.json();
    const { resolution, details, resolvedBy = 'ai' } = body;

    // Validate required fields
    if (!resolution || !['release', 'refund'].includes(resolution)) {
      return NextResponse.json(
        { error: 'Invalid resolution. Must be: release or refund' },
        { status: 400 }
      );
    }

    if (!details) {
      return NextResponse.json(
        { error: 'Missing resolution details' },
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

    // Resolve the escrow
    const result = await resolveDispute(escrowId, resolution, details, resolvedBy);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Failed to resolve escrow' },
        { status: 500 }
      );
    }

    // Update the order status based on resolution
    const order = await getOrder(escrow.order_id);
    if (order) {
      // If released -> completed, if refunded -> cancelled
      const newOrderStatus = resolution === 'release' ? 'completed' : 'cancelled';
      await updateOrderStatus(escrow.order_id, newOrderStatus);
    }

    console.log('Escrow dispute resolved:', {
      escrowId,
      resolution,
      resolvedBy,
      details,
    });

    return NextResponse.json({
      success: true,
      message: `Dispute resolved: ${resolution}`,
      escrowId,
      resolution,
      resolvedBy,
    });
  } catch (error) {
    console.error('Escrow resolution error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve escrow dispute' },
      { status: 500 }
    );
  }
}
