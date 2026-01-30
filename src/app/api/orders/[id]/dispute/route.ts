import { NextRequest, NextResponse } from 'next/server';
import { getOrder, updateOrderStatus } from '@/lib/db';
import { disputeEscrow, getEscrow } from '@/lib/escrow';
import { canTransition } from '@/lib/order-state-machine';

/**
 * POST /api/orders/[id]/dispute
 * 
 * Open a dispute on the order. Freezes escrow funds pending resolution.
 * Only the buyer (client) can open a dispute.
 * 
 * Body:
 * - wallet: string (client's wallet address for authorization)
 * - reason: string (required reason for the dispute)
 * - category?: string (optional category: quality, timing, communication, other)
 * - details?: string (optional additional details)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await req.json();
    const { wallet, reason, category, details } = body;

    // Validate required fields
    if (!wallet) {
      return NextResponse.json(
        { error: 'Missing wallet address' },
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'Please provide a reason for the dispute (at least 10 characters)' },
        { status: 400 }
      );
    }

    // Get the order
    const order = await getOrder(orderId);
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify the caller is the client
    if (wallet !== order.client_wallet) {
      return NextResponse.json(
        { error: 'Unauthorized: only the buyer can open a dispute' },
        { status: 403 }
      );
    }

    // Check if transition is valid
    const transitionResult = canTransition(order.status, 'dispute', 'client');
    if (!transitionResult.success) {
      return NextResponse.json(
        { error: transitionResult.error },
        { status: 400 }
      );
    }

    // Update order status to disputed
    const updated = await updateOrderStatus(orderId, 'disputed');
    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update order status' },
        { status: 500 }
      );
    }

    // Build full dispute reason
    const fullReason = [
      category ? `[${category.toUpperCase()}]` : null,
      reason.trim(),
      details ? `\n\nAdditional details: ${details.trim()}` : null,
    ].filter(Boolean).join(' ');

    // Dispute escrow if exists
    let escrowDisputed = false;
    
    if (order.escrow_id) {
      const escrow = await getEscrow(order.escrow_id);
      if (escrow && escrow.status === 'funded') {
        const disputeResult = await disputeEscrow(order.escrow_id, fullReason);
        if (disputeResult.ok) {
          escrowDisputed = true;
          console.log('Escrow disputed:', {
            escrowId: order.escrow_id,
            reason: fullReason,
          });
        } else {
          console.warn('Failed to dispute escrow:', disputeResult.error);
        }
      }
    }

    console.log('Dispute opened:', {
      orderId,
      previousStatus: order.status,
      newStatus: 'disputed',
      category,
      reason: reason.slice(0, 100),
      escrowDisputed,
    });

    return NextResponse.json({
      success: true,
      message: 'Dispute opened successfully',
      orderId,
      previousStatus: order.status,
      newStatus: 'disputed',
      escrowDisputed,
      disputeInfo: {
        category: category || 'general',
        reason: reason.trim(),
        openedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Open dispute error:', error);
    return NextResponse.json(
      { error: 'Failed to open dispute' },
      { status: 500 }
    );
  }
}
