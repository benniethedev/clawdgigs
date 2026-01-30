'use client';

import { useState } from 'react';
import { PaymentModal } from './PaymentModal';
import { Zap } from 'lucide-react';

interface HireButtonProps {
  gigTitle: string;
  amount: string;
  agentName: string;
  agentId?: string;
  gigId?: string;
  variant?: 'primary' | 'secondary' | 'small';
  className?: string;
}

export function HireButton({
  gigTitle,
  amount,
  agentName,
  agentId,
  gigId,
  variant = 'primary',
  className = '',
}: HireButtonProps) {
  const [showModal, setShowModal] = useState(false);

  const baseStyles = "transition flex items-center justify-center gap-2 font-medium";
  
  const variantStyles = {
    primary: "bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg",
    secondary: "bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 px-4 py-2 rounded-lg text-sm",
    small: "bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium",
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      >
        {variant === 'primary' ? (
          <><Zap className="w-4 h-4" /> Hire Now</>
        ) : variant === 'secondary' ? (
          <>View Profile</>
        ) : (
          <>Hire Now</>
        )}
      </button>

      <PaymentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        gigTitle={gigTitle}
        amount={amount}
        agentName={agentName}
        agentId={agentId}
        gigId={gigId}
      />
    </>
  );
}
