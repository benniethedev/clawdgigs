'use client';

import { useState } from 'react';
import { Brain, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';

interface DisputeActionsProps {
  disputeId: string;
  hasAiAnalysis: boolean;
  aiRecommendation?: string | null;
  aiConfidence?: number | null;
}

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

export function DisputeActions({
  disputeId,
  hasAiAnalysis,
  aiRecommendation,
  aiConfidence,
}: DisputeActionsProps) {
  const [status, setStatus] = useState<ActionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolution, setResolution] = useState<'refund_buyer' | 'pay_seller' | 'split'>(
    aiRecommendation === 'pay_seller' ? 'pay_seller' : 
    aiRecommendation === 'partial_refund' ? 'split' : 'refund_buyer'
  );
  const [notes, setNotes] = useState('');
  const [autoResolved, setAutoResolved] = useState(false);

  const handleRunAiArbitration = async () => {
    setStatus('loading');
    setError(null);

    try {
      const res = await fetch(`/api/disputes/${disputeId}/arbitrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'AI arbitration failed');
      }

      // Check if AI auto-resolved the dispute
      if (data.autoResolved) {
        setAutoResolved(true);
      }

      setStatus('success');
      setTimeout(() => {
        window.location.reload();
      }, data.autoResolved ? 2500 : 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStatus('error');
    }
  };

  const handleResolve = async () => {
    if (notes.trim().length < 10) {
      setError('Please provide resolution notes (at least 10 characters)');
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const res = await fetch(`/api/disputes/${disputeId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution,
          notes: notes.trim(),
          resolvedBy: 'admin',
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to resolve dispute');
      }

      setStatus('success');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className={`${autoResolved ? 'bg-cyan-500/20 border-cyan-500/30' : 'bg-green-500/20 border-green-500/30'} rounded-xl p-6 border text-center`}>
        <CheckCircle className={`w-12 h-12 ${autoResolved ? 'text-cyan-400' : 'text-green-400'} mx-auto mb-3`} />
        <div className="text-white font-semibold">
          {autoResolved ? 'AI Auto-Resolved!' : 'Action Completed'}
        </div>
        <div className="text-gray-400 text-sm">
          {autoResolved ? 'High confidence resolution applied' : 'Refreshing page...'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-orange-500/30">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-orange-400" /> Actions
      </h3>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* AI Arbitration Button */}
      {!hasAiAnalysis && (
        <button
          onClick={handleRunAiArbitration}
          disabled={status === 'loading'}
          className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 mb-3"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Running AI Analysis...
            </>
          ) : (
            <>
              <Brain className="w-5 h-5" /> Run AI Arbitration
            </>
          )}
        </button>
      )}

      {/* Resolve Section */}
      {!showResolveForm ? (
        <button
          onClick={() => setShowResolveForm(true)}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition"
        >
          Resolve Dispute
        </button>
      ) : (
        <div className="space-y-4">
          {/* Resolution Options */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Resolution</label>
            <div className="space-y-2">
              <label className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition ${
                resolution === 'refund_buyer' 
                  ? 'bg-yellow-500/20 border-yellow-500/50' 
                  : 'bg-gray-700 border-gray-600 hover:border-gray-500'
              }`}>
                <input
                  type="radio"
                  name="resolution"
                  value="refund_buyer"
                  checked={resolution === 'refund_buyer'}
                  onChange={(e) => setResolution(e.target.value as 'refund_buyer')}
                  className="sr-only"
                />
                <XCircle className={`w-5 h-5 ${resolution === 'refund_buyer' ? 'text-yellow-400' : 'text-gray-400'}`} />
                <div>
                  <div className={`font-semibold ${resolution === 'refund_buyer' ? 'text-yellow-400' : 'text-white'}`}>
                    Refund Buyer
                  </div>
                  <div className="text-gray-400 text-xs">Return all funds to the buyer</div>
                </div>
              </label>
              
              <label className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition ${
                resolution === 'pay_seller' 
                  ? 'bg-green-500/20 border-green-500/50' 
                  : 'bg-gray-700 border-gray-600 hover:border-gray-500'
              }`}>
                <input
                  type="radio"
                  name="resolution"
                  value="pay_seller"
                  checked={resolution === 'pay_seller'}
                  onChange={(e) => setResolution(e.target.value as 'pay_seller')}
                  className="sr-only"
                />
                <CheckCircle className={`w-5 h-5 ${resolution === 'pay_seller' ? 'text-green-400' : 'text-gray-400'}`} />
                <div>
                  <div className={`font-semibold ${resolution === 'pay_seller' ? 'text-green-400' : 'text-white'}`}>
                    Pay Seller
                  </div>
                  <div className="text-gray-400 text-xs">Release funds to the agent</div>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition ${
                resolution === 'split' 
                  ? 'bg-orange-500/20 border-orange-500/50' 
                  : 'bg-gray-700 border-gray-600 hover:border-gray-500'
              }`}>
                <input
                  type="radio"
                  name="resolution"
                  value="split"
                  checked={resolution === 'split'}
                  onChange={(e) => setResolution(e.target.value as 'split')}
                  className="sr-only"
                />
                <AlertTriangle className={`w-5 h-5 ${resolution === 'split' ? 'text-orange-400' : 'text-gray-400'}`} />
                <div>
                  <div className={`font-semibold ${resolution === 'split' ? 'text-orange-400' : 'text-white'}`}>
                    50/50 Split
                  </div>
                  <div className="text-gray-400 text-xs">Split funds between both parties</div>
                </div>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              Resolution Notes <span className="text-red-400">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain the reasoning for this resolution..."
              rows={3}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:border-orange-500 focus:outline-none transition resize-none"
            />
            <p className="text-gray-500 text-xs mt-1">
              {notes.length}/10 characters minimum
            </p>
          </div>

          {/* Confirm Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowResolveForm(false);
                setNotes('');
                setError(null);
              }}
              disabled={status === 'loading'}
              className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white py-2 rounded-lg font-semibold transition"
            >
              Cancel
            </button>
            <button
              onClick={handleResolve}
              disabled={status === 'loading' || notes.trim().length < 10}
              className={`flex-1 ${
                resolution === 'refund_buyer' 
                  ? 'bg-yellow-500 hover:bg-yellow-600' 
                  : resolution === 'pay_seller'
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-orange-500 hover:bg-orange-600'
              } disabled:bg-gray-600 text-white py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2`}
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                </>
              ) : (
                'Confirm'
              )}
            </button>
          </div>
        </div>
      )}

      {/* AI Confidence & Recommendation */}
      {hasAiAnalysis && !showResolveForm && (
        <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-400 text-sm font-semibold flex items-center gap-2">
              <Brain className="w-4 h-4" /> AI Analysis
            </span>
            {aiConfidence && (
              <span className={`text-sm font-bold ${
                aiConfidence >= 85 ? 'text-green-400' : 
                aiConfidence >= 70 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {aiConfidence}%
              </span>
            )}
          </div>
          
          {/* Confidence Bar */}
          {aiConfidence && (
            <div className="mb-2">
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${
                    aiConfidence >= 85 ? 'bg-green-400' : 
                    aiConfidence >= 70 ? 'bg-yellow-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${aiConfidence}%` }}
                />
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-gray-500">Low</span>
                <span className={`${aiConfidence >= 85 ? 'text-green-400' : 'text-gray-500'}`}>
                  {aiConfidence >= 85 ? '✓ Auto-resolve threshold' : 'Auto-resolve: 85%'}
                </span>
                <span className="text-gray-500">High</span>
              </div>
            </div>
          )}

          {aiRecommendation && (
            <div className="text-center">
              <span className="text-gray-400 text-sm">Recommends: </span>
              <span className={`text-sm font-semibold ${
                aiRecommendation === 'pay_seller' ? 'text-green-400' :
                aiRecommendation === 'refund_buyer' ? 'text-yellow-400' : 'text-orange-400'
              }`}>
                {aiRecommendation === 'pay_seller' ? 'Release to Seller' :
                 aiRecommendation === 'refund_buyer' ? 'Refund Buyer' : '50/50 Split'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
