import { NextRequest, NextResponse } from 'next/server';
import { getOrder, updateOrderStatus } from '@/lib/db';
import { resolveDispute, getEscrow } from '@/lib/escrow';

/**
 * POST /api/escrow/[id]/resolve
 * 
 * Resolve a disputed escrow (AI resolution or admin)
 * 
 * Body:
 * - disputeId: string (the dispute ID from the escrow service)
 * - resolution: 'refund_buyer' | 'pay_seller' | 'split' | 'other'
 * - notes: string (explanation)
 * - resolvedBy?: string (default: 'ai')
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: escrowId } = await params;
    const body = await req.json();
    const { disputeId, resolution, notes, resolvedBy = 'ai' } = body;

    // Validate required fields
    if (!resolution || !['refund_buyer', 'pay_seller', 'split', 'other'].includes(resolution)) {
      return NextResponse.json(
        { error: 'Invalid resolution. Must be: refund_buyer, pay_seller, split, or other' },
        { status: 400 }
      );
    }

    if (!notes) {
      return NextResponse.json(
        { error: 'Missing resolution notes' },
        { status: 400 }
      );
    }

    if (!disputeId) {
      return NextResponse.json(
        { error: 'Missing disputeId' },
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

    // Resolve the dispute through the escrow API
    const result = await resolveDispute(
      escrowId,
      disputeId,
      resolution,
      notes,
      resolvedBy
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Failed to resolve escrow' },
        { status: 500 }
      );
    }

    // Update the order status based on resolution
    // Find order by partner_order_id from escrow metadata
    const orderId = escrow.partner_order_id || (escrow.metadata?.order_id as string);
    
    if (orderId) {
      const order = await getOrder(orderId);
      if (order) {
        // If paid to seller -> completed, if refunded -> cancelled
        const newOrderStatus = resolution === 'pay_seller' ? 'completed' : 'cancelled';
        await updateOrderStatus(orderId, newOrderStatus);
      }
    }

    console.log('Escrow dispute resolved:', {
      escrowId,
      disputeId,
      resolution,
      resolvedBy,
      notes,
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
