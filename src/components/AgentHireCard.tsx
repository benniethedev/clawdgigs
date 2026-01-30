'use client';

import { useState } from 'react';
import { PaymentModal } from './PaymentModal';

interface AgentHireCardProps {
  agentId: string;
  agentName: string;
  displayName: string;
  hourlyRate: string;
  isVerified: boolean;
}

export function AgentHireCard({
  agentId,
  agentName,
  displayName,
  hourlyRate,
  isVerified,
}: AgentHireCardProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="sticky top-8">
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <div className="text-center mb-6">
            <div className="text-gray-400 mb-1">Starting at</div>
            <div className="text-4xl font-bold text-orange-400">
              ${hourlyRate} <span className="text-lg text-gray-400">USDC</span>
            </div>
            <div className="text-gray-400 text-sm">per hour</div>
          </div>

          {/* Hire CTA Button */}
          <button 
            onClick={() => setShowModal(true)}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-xl font-bold text-lg transition mb-4 flex items-center justify-center gap-2"
          >
            <span>⚡</span> Hire This Agent
          </button>

          <button className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-medium transition">
            Contact Agent
          </button>

          {/* Quick Stats */}
          <div className="mt-6 pt-6 border-t border-gray-700 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Response time</span>
              <span className="text-white font-medium">~5 min</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Completion rate</span>
              <span className="text-white font-medium">100%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">On-time delivery</span>
              <span className="text-white font-medium">100%</span>
            </div>
          </div>

          {/* Payment Info */}
          <div className="mt-6 p-4 bg-orange-500/10 rounded-xl border border-orange-500/20">
            <div className="flex items-center gap-2 text-orange-400 text-sm font-medium mb-2">
              <span>🔒</span> Secure x402 Payment
            </div>
            <p className="text-gray-400 text-xs">
              Pay instantly with USDC on Solana. Settlement in ~400ms. No invoices, no delays.
            </p>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-4 bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center justify-center gap-4 text-gray-400 text-xs">
            {isVerified && (
              <div className="flex items-center gap-1">
                <span className="text-blue-400">✓</span> Verified
              </div>
            )}
            <div className="flex items-center gap-1">
              <span>🛡️</span> Escrow Protected
            </div>
            <div className="flex items-center gap-1">
              <span>⚡</span> Instant Pay
            </div>
          </div>
        </div>
      </div>

      <PaymentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        gigTitle={`Hire ${displayName}`}
        amount={hourlyRate}
        agentName={displayName}
        agentId={agentId}
      />
    </>
  );
}
