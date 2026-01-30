'use client';

import { useState } from 'react';
import { useWallet } from './WalletProvider';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  gigTitle: string;
  amount: string;
  agentName: string;
  gigId?: string;
  agentId?: string;
}

type PaymentStatus = 'idle' | 'connecting' | 'signing' | 'verifying' | 'success' | 'error';

export function PaymentModal({ 
  isOpen, 
  onClose, 
  gigTitle, 
  amount, 
  agentName,
  gigId,
  agentId 
}: PaymentModalProps) {
  const { connected, publicKey, connect, connecting, signMessage } = useWallet();
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePayment = async () => {
    setError(null);
    
    try {
      // Step 1: Connect wallet if not connected
      if (!connected) {
        setStatus('connecting');
        await connect();
        return; // Will re-render with connected state
      }

      // Step 2: Request payment requirements from our API
      setStatus('signing');
      const requirementRes = await fetch('/api/payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gigId,
          agentId,
          amount,
          payer: publicKey,
        }),
      });

      if (requirementRes.status !== 402) {
        throw new Error('Unexpected response from payment API');
      }

      const paymentRequired = requirementRes.headers.get('X-Payment-Required');
      if (!paymentRequired) {
        throw new Error('No payment requirements received');
      }

      const requirements = JSON.parse(paymentRequired);
      const requirement = requirements[0];

      // Step 3: Create and sign the payment message
      const nonce = crypto.randomUUID().replace(/-/g, '');
      const paymentPayload = {
        payTo: requirement.payTo,
        asset: requirement.asset,
        amountRequired: requirement.maxAmountRequired,
        nonce,
        payer: publicKey,
      };

      const messageToSign = JSON.stringify(paymentPayload);
      const encodedMessage = new TextEncoder().encode(messageToSign);
      const signature = await signMessage(encodedMessage);
      
      // Convert signature to base64
      const signatureBase64 = btoa(String.fromCharCode(...signature));

      // Step 4: Create the x402 payment header
      const paymentHeader = {
        x402Version: 1,
        scheme: 'exact',
        network: requirement.network,
        payload: {
          signature: signatureBase64,
          payload: paymentPayload,
        },
      };

      // Step 5: Submit payment for verification
      setStatus('verifying');
      const verifyRes = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': JSON.stringify(paymentHeader),
        },
        body: JSON.stringify({
          gigId,
          agentId,
          amount,
        }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.success) {
        throw new Error(verifyData.error || 'Payment verification failed');
      }

      // Success!
      setTxSignature(verifyData.txSignature || signatureBase64.slice(0, 16) + '...');
      setStatus('success');

    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment failed');
      setStatus('error');
    }
  };

  const resetAndClose = () => {
    setStatus('idle');
    setError(null);
    setTxSignature(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={status === 'success' ? resetAndClose : undefined}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
        {/* Close button */}
        {(status === 'idle' || status === 'error' || status === 'success') && (
          <button
            onClick={resetAndClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
          >
            ✕
          </button>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="text-center">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">✓</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
            <p className="text-gray-400 mb-6">
              Your payment of <span className="text-orange-400 font-semibold">${amount} USDC</span> has been confirmed.
            </p>
            
            {txSignature && (
              <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
                <div className="text-gray-400 text-sm mb-1">Transaction ID</div>
                <div className="text-white font-mono text-sm break-all">{txSignature}</div>
              </div>
            )}

            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-6">
              <p className="text-orange-300 text-sm">
                <span className="font-semibold">{agentName}</span> will begin working on your request immediately.
              </p>
            </div>

            <button
              onClick={resetAndClose}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-semibold transition"
            >
              Done
            </button>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="text-center">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">✕</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Payment Failed</h2>
            <p className="text-gray-400 mb-4">{error || 'An unexpected error occurred'}</p>
            
            <div className="flex gap-3">
              <button
                onClick={resetAndClose}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => { setStatus('idle'); setError(null); }}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-semibold transition"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Loading States */}
        {(status === 'connecting' || status === 'signing' || status === 'verifying') && (
          <div className="text-center py-8">
            <div className="w-16 h-16 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-xl font-bold text-white mb-2">
              {status === 'connecting' && 'Connecting Wallet...'}
              {status === 'signing' && 'Awaiting Signature...'}
              {status === 'verifying' && 'Verifying Payment...'}
            </h2>
            <p className="text-gray-400 text-sm">
              {status === 'connecting' && 'Please approve the connection in your wallet'}
              {status === 'signing' && 'Please sign the payment message in your wallet'}
              {status === 'verifying' && 'Confirming with x402 facilitator...'}
            </p>
          </div>
        )}

        {/* Idle State - Payment Details */}
        {status === 'idle' && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⚡</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">Confirm Payment</h2>
              <p className="text-gray-400">via x402 Protocol</p>
            </div>

            {/* Payment Details */}
            <div className="bg-gray-700/50 rounded-xl p-5 mb-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Service</span>
                <span className="text-white font-medium text-right max-w-[200px] truncate">{gigTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Agent</span>
                <span className="text-white font-medium">{agentName}</span>
              </div>
              <div className="border-t border-gray-600 pt-3 flex justify-between">
                <span className="text-gray-400">Amount</span>
                <span className="text-2xl font-bold text-orange-400">${amount} <span className="text-sm font-normal">USDC</span></span>
              </div>
            </div>

            {/* Wallet Status */}
            {connected ? (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-6 flex items-center gap-3">
                <span className="text-green-400">✓</span>
                <div>
                  <div className="text-green-400 text-sm font-medium">Wallet Connected</div>
                  <div className="text-gray-400 text-xs font-mono">
                    {publicKey?.slice(0, 4)}...{publicKey?.slice(-4)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-3 mb-6 flex items-center gap-3">
                <span className="text-gray-400">👛</span>
                <div className="text-gray-400 text-sm">Connect your wallet to pay</div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handlePayment}
              disabled={connecting}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white py-4 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2"
            >
              {connecting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connecting...
                </>
              ) : connected ? (
                <>
                  <span>⚡</span> Pay ${amount} USDC
                </>
              ) : (
                <>
                  <span>👛</span> Connect Wallet
                </>
              )}
            </button>

            {/* Info */}
            <p className="text-gray-500 text-xs text-center mt-4">
              Powered by SolPay x402 • Settles in ~400ms on Solana
            </p>
          </>
        )}
      </div>
    </div>
  );
}
