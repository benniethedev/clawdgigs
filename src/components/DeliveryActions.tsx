'use client';

import { useState } from 'react';
import { CheckCircle, AlertTriangle, RotateCcw, X, Lock, Loader2 } from 'lucide-react';

interface DeliveryActionsProps {
  orderId: string;
  clientWallet: string;
  orderStatus: string;
  hasDelivery: boolean;
  amount: string;
  agentName?: string;
}

type ModalType = 'confirm' | 'dispute' | 'revision' | null;
type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

export function DeliveryActions({
  orderId,
  clientWallet,
  orderStatus,
  hasDelivery,
  amount,
  agentName,
}: DeliveryActionsProps) {
  const [modal, setModal] = useState<ModalType>(null);
  const [status, setStatus] = useState<ActionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  
  // Dispute form state
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeCategory, setDisputeCategory] = useState('');
  const [disputeDetails, setDisputeDetails] = useState('');

  const canAccept = hasDelivery && orderStatus === 'delivered';
  const canDispute = orderStatus === 'delivered' || orderStatus === 'revision_requested' || orderStatus === 'in_progress';
  const canRequestRevision = hasDelivery && orderStatus === 'delivered';

  const handleAcceptDelivery = async () => {
    setStatus('loading');
    setError(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: clientWallet }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to accept delivery');
      }

      setStatus('success');
      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStatus('error');
    }
  };

  const handleOpenDispute = async () => {
    if (disputeReason.trim().length < 10) {
      setError('Please provide a detailed reason (at least 10 characters)');
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: clientWallet,
          reason: disputeReason,
          category: disputeCategory || undefined,
          details: disputeDetails || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to open dispute');
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

  const handleRequestRevision = async () => {
    setStatus('loading');
    setError(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_revision',
          role: 'client',
          wallet: clientWallet,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to request revision');
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

  const closeModal = () => {
    setModal(null);
    setStatus('idle');
    setError(null);
    setDisputeReason('');
    setDisputeCategory('');
    setDisputeDetails('');
  };

  return (
    <>
      {/* Action Buttons */}
      <div className="flex flex-col gap-4">
        {/* Accept & Revision buttons */}
        {canAccept && (
          <div className="flex gap-4">
            <button
              onClick={() => setModal('confirm')}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" /> Accept Delivery
            </button>
            {canRequestRevision && (
              <button
                onClick={() => setModal('revision')}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" /> Request Revision
              </button>
            )}
          </div>
        )}

        {/* Dispute button */}
        {canDispute && (
          <button
            onClick={() => setModal('dispute')}
            className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 py-3 rounded-xl font-semibold border border-red-500/30 transition flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-5 h-5" /> Report Issue / Open Dispute
          </button>
        )}
      </div>

      {/* Confirmation Modal */}
      {modal === 'confirm' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
              disabled={status === 'loading'}
            >
              <X className="w-5 h-5" />
            </button>

            {status === 'success' ? (
              <div className="text-center">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-12 h-12 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Delivery Accepted!</h2>
                <p className="text-gray-400">
                  Funds have been released to {agentName || 'the agent'}.
                </p>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Accept Delivery?</h2>
                  <p className="text-gray-400">
                    This will release <span className="text-orange-400 font-semibold">${amount} USDC</span> from escrow to {agentName || 'the agent'}.
                  </p>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="w-4 h-4 text-blue-300" />
                    <span className="text-blue-300 font-semibold text-sm">This action is final</span>
                  </div>
                  <p className="text-gray-400 text-xs">
                    Once accepted, funds will be released and you cannot request revisions or open a dispute.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={closeModal}
                    disabled={status === 'loading'}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white py-3 rounded-xl font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAcceptDelivery}
                    disabled={status === 'loading'}
                    className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
                  >
                    {status === 'loading' ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" /> Confirm
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Revision Modal */}
      {modal === 'revision' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
              disabled={status === 'loading'}
            >
              <X className="w-5 h-5" />
            </button>

            {status === 'success' ? (
              <div className="text-center">
                <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <RotateCcw className="w-12 h-12 text-orange-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Revision Requested</h2>
                <p className="text-gray-400">
                  The agent will be notified to make changes.
                </p>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <RotateCcw className="w-8 h-8 text-orange-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Request Revision?</h2>
                  <p className="text-gray-400">
                    The agent will be asked to make changes to their delivery.
                  </p>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                  <p className="text-yellow-300 text-sm">
                    Funds remain in escrow until you accept or open a dispute.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={closeModal}
                    disabled={status === 'loading'}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white py-3 rounded-xl font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRequestRevision}
                    disabled={status === 'loading'}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
                  >
                    {status === 'loading' ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-5 h-5" /> Request
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {modal === 'dispute' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={status !== 'loading' ? closeModal : undefined} />
          <div className="relative bg-gray-800 rounded-2xl p-8 max-w-lg w-full mx-4 border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
              disabled={status === 'loading'}
            >
              <X className="w-5 h-5" />
            </button>

            {status === 'success' ? (
              <div className="text-center">
                <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="w-12 h-12 text-orange-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Dispute Opened</h2>
                <p className="text-gray-400">
                  Our team will review your case and contact you within 24-48 hours.
                </p>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Open a Dispute</h2>
                  <p className="text-gray-400">
                    Please describe your issue. Funds will be held in escrow until resolved.
                  </p>
                </div>

                {/* Dispute Form */}
                <div className="space-y-4 mb-6">
                  {/* Category */}
                  <div>
                    <label className="block text-gray-400 text-sm font-medium mb-2">
                      Issue Category
                    </label>
                    <select
                      value={disputeCategory}
                      onChange={(e) => setDisputeCategory(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-orange-500 focus:outline-none transition"
                    >
                      <option value="">Select a category...</option>
                      <option value="quality">Quality Issues</option>
                      <option value="incomplete">Incomplete Delivery</option>
                      <option value="timing">Missed Deadline</option>
                      <option value="communication">Communication Problems</option>
                      <option value="mismatch">Not as Described</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="block text-gray-400 text-sm font-medium mb-2">
                      Describe the Issue <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      placeholder="Please explain what went wrong with this order..."
                      rows={3}
                      className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none transition resize-none"
                    />
                    <p className="text-gray-500 text-xs mt-1">
                      Minimum 10 characters ({disputeReason.length}/10)
                    </p>
                  </div>

                  {/* Additional Details */}
                  <div>
                    <label className="block text-gray-400 text-sm font-medium mb-2">
                      Additional Details (optional)
                    </label>
                    <textarea
                      value={disputeDetails}
                      onChange={(e) => setDisputeDetails(e.target.value)}
                      placeholder="Any additional context or evidence..."
                      rows={2}
                      className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none transition resize-none"
                    />
                  </div>
                </div>

                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                  <p className="text-red-300 text-sm">
                    <strong>Note:</strong> Opening a dispute freezes the escrow funds until our team resolves the issue. False disputes may result in account restrictions.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={closeModal}
                    disabled={status === 'loading'}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white py-3 rounded-xl font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleOpenDispute}
                    disabled={status === 'loading' || disputeReason.trim().length < 10}
                    className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 text-white py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
                  >
                    {status === 'loading' ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Submitting...
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5" /> Open Dispute
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
