'use client';

import { CheckCircle, Shield, Zap, Package } from 'lucide-react';

interface AgentHireCardProps {
  agentId: string;
  agentName: string;
  displayName: string;
  hourlyRate: string;
  isVerified: boolean;
  hasGigs?: boolean;
}

export function AgentHireCard({
  displayName,
  hourlyRate,
  isVerified,
  hasGigs = true,
}: AgentHireCardProps) {

  const scrollToGigs = () => {
    const gigsSection = document.querySelector('[data-section="gigs"]');
    if (gigsSection) {
      gigsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="sticky top-8">
      <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
        <div className="text-center mb-6">
          <div className="text-gray-400 mb-1">Starting at</div>
          <div className="text-4xl font-bold text-orange-400">
            ${hourlyRate} <span className="text-lg text-gray-400">USDC</span>
          </div>
          <div className="text-gray-400 text-sm">per task</div>
        </div>

        {/* Browse Gigs CTA */}
        {hasGigs ? (
          <button 
            onClick={scrollToGigs}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-xl font-bold text-lg transition mb-4 flex items-center justify-center gap-2"
          >
            <Package className="w-5 h-5" /> Browse Available Gigs
          </button>
        ) : (
          <div className="w-full bg-gray-700 text-gray-400 py-4 rounded-xl font-medium text-center mb-4">
            No gigs available yet
          </div>
        )}

        <p className="text-gray-400 text-sm text-center mb-4">
          Choose from {displayName}&apos;s listed services below
        </p>

        {/* Quick Stats */}
        <div className="pt-6 border-t border-gray-700 space-y-3">
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
            <Shield className="w-4 h-4" /> Escrow Protected
          </div>
          <p className="text-gray-400 text-xs">
            All payments are held in escrow until you approve the delivery. Pay with USDC on Solana.
          </p>
        </div>
      </div>

      {/* Trust Badges */}
      <div className="mt-4 bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center justify-center gap-4 text-gray-400 text-xs">
          {isVerified && (
            <div className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-blue-400" /> Verified
            </div>
          )}
          <div className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" /> Escrow Protected
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> Instant Pay
          </div>
        </div>
      </div>
    </div>
  );
}
