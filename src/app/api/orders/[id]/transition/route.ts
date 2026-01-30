import { NextRequest, NextResponse } from 'next/server';
import { getOrder, updateOrderStatus } from '@/lib/db';
import { canTransition, TransitionAction, OrderStatus } from '@/lib/order-state-machine';
import { releaseEscrow, disputeEscrow, getEscrow } from '@/lib/escrow';

/**
 * POST /api/orders/[id]/transition
 * 
 * Transition an order to a new status using the state machine.
 * 
 * Body:
 * - action: TransitionAction (pay, start_work, deliver, request_revision, accept, dispute, cancel, resolve)
 * - role: 'client' | 'agent' | 'admin'
 * - wallet?: string (for client role verification)
 * - agentId?: string (for agent role verification)
 * - reason?: string (optional reason for revision/dispute)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await req.json();
    const { action, role, wallet, agentId, reason } = body;

    // Validate required fields
    if (!action) {
      return NextResponse.json(
        { error: 'Missing action' },
        { status: 400 }
      );
    }

    if (!role || !['client', 'agent', 'system', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be: client, agent, system, or admin' },
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

    // Verify authorization based on role
    if (role === 'client' && wallet !== order.client_wallet) {
      return NextResponse.json(
        { error: 'Unauthorized: wallet does not match order client' },
        { status: 403 }
      );
    }

    if (role === 'agent' && agentId !== order.agent_id) {
      return NextResponse.json(
        { error: 'Unauthorized: agent does not own this order' },
        { status: 403 }
      );
    }

    // Check if transition is valid
    const result = canTransition(
      order.status as OrderStatus,
      action as TransitionAction,
      role
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Perform the transition
    const updated = await updateOrderStatus(orderId, result.newStatus!);

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update order status' },
        { status: 500 }
      );
    }

    // Handle escrow actions based on transition
    let escrowAction: string | null = null;
    let escrowError: string | null = null;
    
    if (result.newStatus === 'completed' && order.escrow_id) {
      // Release escrow when order is accepted/completed
      const escrowResult = await releaseEscrow(order.escrow_id);
      if (escrowResult.ok) {
        escrowAction = 'released';
        console.log('Escrow released:', order.escrow_id);
      } else {
        console.warn('Failed to release escrow:', escrowResult.error);
        escrowError = escrowResult.error || 'Unknown error';
      }
    }
    
    if (result.newStatus === 'disputed' && order.escrow_id) {
      // Dispute escrow when order is disputed
      const disputeReason = reason || 'Client raised dispute';
      const escrowResult = await disputeEscrow(order.escrow_id, disputeReason);
      if (escrowResult.ok) {
        escrowAction = 'disputed';
        console.log('Escrow disputed:', order.escrow_id);
      } else {
        console.warn('Failed to dispute escrow:', escrowResult.error);
        escrowError = escrowResult.error || 'Unknown error';
      }
    }

    console.log('Order transition:', {
      orderId,
      from: order.status,
      to: result.newStatus,
      action,
      role,
      reason,
      escrowAction,
      escrowError,
    });

    return NextResponse.json({
      success: true,
      message: `Order transitioned from ${order.status} to ${result.newStatus}`,
      previousStatus: order.status,
      newStatus: result.newStatus,
      escrowAction,
      escrowError,
    });
  } catch (error) {
    console.error('Order transition error:', error);
    return NextResponse.json(
      { error: 'Failed to transition order' },
      { status: 500 }
    );
  }
}
