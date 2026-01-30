/**
 * Order State Machine
 * 
 * States:
 * - pending: Order created, awaiting payment
 * - paid: Payment received, awaiting agent to start work
 * - in_progress: Agent is working on the order
 * - delivered: Agent delivered the work
 * - revision_requested: Client requested changes
 * - completed: Client accepted the delivery
 * - disputed: Client raised a dispute
 * - cancelled: Order was cancelled
 * 
 * Flow:
 *   pending → paid → in_progress → delivered → completed
 *                                     ↓ ↑
 *                              revision_requested
 *                                     ↓
 *                                 disputed
 * 
 *   (cancelled can be reached from pending, paid)
 */

export type OrderStatus = 
  | 'pending'
  | 'paid'
  | 'in_progress'
  | 'delivered'
  | 'revision_requested'
  | 'completed'
  | 'disputed'
  | 'cancelled';

export type TransitionAction =
  | 'pay'
  | 'start_work'
  | 'deliver'
  | 'request_revision'
  | 'redeliver'
  | 'accept'
  | 'dispute'
  | 'cancel'
  | 'resolve';

interface TransitionRule {
  from: OrderStatus[];
  to: OrderStatus;
  action: TransitionAction;
  /** Who can trigger this transition */
  allowedBy: ('client' | 'agent' | 'system' | 'admin')[];
}

const transitions: TransitionRule[] = [
  // Payment flow
  {
    from: ['pending'],
    to: 'paid',
    action: 'pay',
    allowedBy: ['client', 'system'],
  },
  
  // Work flow
  {
    from: ['paid'],
    to: 'in_progress',
    action: 'start_work',
    allowedBy: ['agent'],
  },
  {
    from: ['in_progress', 'revision_requested'],
    to: 'delivered',
    action: 'deliver',
    allowedBy: ['agent'],
  },
  
  // Client response to delivery
  {
    from: ['delivered'],
    to: 'completed',
    action: 'accept',
    allowedBy: ['client'],
  },
  {
    from: ['delivered'],
    to: 'revision_requested',
    action: 'request_revision',
    allowedBy: ['client'],
  },
  {
    from: ['in_progress', 'delivered', 'revision_requested'],
    to: 'disputed',
    action: 'dispute',
    allowedBy: ['client'],
  },
  
  // Redelivery after revision
  {
    from: ['revision_requested'],
    to: 'delivered',
    action: 'redeliver',
    allowedBy: ['agent'],
  },
  
  // Dispute resolution
  {
    from: ['disputed'],
    to: 'completed',
    action: 'resolve',
    allowedBy: ['admin'],
  },
  
  // Cancellation (only before work starts)
  {
    from: ['pending'],
    to: 'cancelled',
    action: 'cancel',
    allowedBy: ['client', 'agent', 'admin'],
  },
  {
    from: ['paid'],
    to: 'cancelled',
    action: 'cancel',
    allowedBy: ['client', 'admin'], // Requires refund
  },
];

export interface TransitionResult {
  success: boolean;
  newStatus?: OrderStatus;
  error?: string;
}

/**
 * Check if a transition is valid
 */
export function canTransition(
  currentStatus: OrderStatus,
  action: TransitionAction,
  role: 'client' | 'agent' | 'system' | 'admin'
): TransitionResult {
  const rule = transitions.find(
    (t) => t.action === action && t.from.includes(currentStatus)
  );

  if (!rule) {
    return {
      success: false,
      error: `Invalid transition: cannot ${action} from ${currentStatus}`,
    };
  }

  if (!rule.allowedBy.includes(role)) {
    return {
      success: false,
      error: `Unauthorized: ${role} cannot ${action}`,
    };
  }

  return {
    success: true,
    newStatus: rule.to,
  };
}

/**
 * Get all valid actions from current status for a given role
 */
export function getAvailableActions(
  currentStatus: OrderStatus,
  role: 'client' | 'agent' | 'system' | 'admin'
): TransitionAction[] {
  return transitions
    .filter((t) => t.from.includes(currentStatus) && t.allowedBy.includes(role))
    .map((t) => t.action);
}

/**
 * Get the next status for an action (without role check)
 */
export function getNextStatus(
  currentStatus: OrderStatus,
  action: TransitionAction
): OrderStatus | null {
  const rule = transitions.find(
    (t) => t.action === action && t.from.includes(currentStatus)
  );
  return rule?.to ?? null;
}

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    pending: 'Pending Payment',
    paid: 'Paid - Awaiting Start',
    in_progress: 'In Progress',
    delivered: 'Delivered',
    revision_requested: 'Revision Requested',
    completed: 'Completed',
    disputed: 'Disputed',
    cancelled: 'Cancelled',
  };
  return labels[status];
}

/**
 * Get status metadata for UI
 */
export function getStatusMeta(status: OrderStatus): {
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
} {
  const meta: Record<OrderStatus, { icon: string; color: string; bgColor: string; borderColor: string }> = {
    pending: { icon: '⏳', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500/30' },
    paid: { icon: '💳', color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/30' },
    in_progress: { icon: '⚙️', color: 'text-blue-400', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500/30' },
    delivered: { icon: '📦', color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/30' },
    revision_requested: { icon: '🔄', color: 'text-orange-400', bgColor: 'bg-orange-500/20', borderColor: 'border-orange-500/30' },
    completed: { icon: '✅', color: 'text-green-300', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/30' },
    disputed: { icon: '⚠️', color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/30' },
    cancelled: { icon: '❌', color: 'text-gray-400', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500/30' },
  };
  return meta[status];
}
