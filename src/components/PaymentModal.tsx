'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useWallet } from './WalletProvider';
import { OrderRequirementsForm, OrderRequirements } from './OrderRequirementsForm';
import { Check, X, Zap, Wallet, Lock } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  gigTitle: string;
  amount: string;
  agentName: string;
  gigId?: string;
  agentId?: string;
}

type ModalStep = 'wallet' | 'requirements' | 'payment';
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
  const { connected, publicKey, connect, connecting, signMessage, walletType } = useWallet();
  // Start at 'wallet' step if not connected, otherwise skip to 'requirements'
  const [step, setStep] = useState<ModalStep>(connected ? 'requirements' : 'wallet');
  const [orderRequirements, setOrderRequirements] = useState<OrderRequirements | null>(null);
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Auto-advance to requirements when wallet connects
  useEffect(() => {
    if (connected && step === 'wallet') {
      setStep('requirements');
    }
  }, [connected, step]);

  // Reset step when modal opens based on wallet state
  useEffect(() => {
    if (isOpen) {
      setStep(connected ? 'requirements' : 'wallet');
    }
  }, [isOpen, connected]);

  // Lock body scroll when modal is open to prevent scroll glitch
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  // Track if we're mounted (for SSR safety with portal)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleRequirementsSubmit = (requirements: OrderRequirements) => {
    setOrderRequirements(requirements);
    setStep('payment');
  };

  const handleBackToRequirements = () => {
    setStep('requirements');
  };

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
          orderRequirements,
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
          orderRequirements,
        }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.success) {
        throw new Error(verifyData.error || 'Payment verification failed');
      }

      // Success!
      setTxSignature(verifyData.txSignature || signatureBase64.slice(0, 16) + '...');
      setOrderId(verifyData.orderId || null);
      setStatus('success');

    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment failed');
      setStatus('error');
    }
  };

  const resetAndClose = () => {
    setStep(connected ? 'requirements' : 'wallet');
    setOrderRequirements(null);
    setStatus('idle');
    setError(null);
    setTxSignature(null);
    setOrderId(null);
    onClose();
  };

  // Use portal to render at document.body level, escaping any parent stacking contexts
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm touch-none"
        onClick={status === 'success' ? resetAndClose : undefined}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-800 rounded-2xl p-8 max-w-lg w-full mx-4 border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto overscroll-contain">
        {/* Close button */}
        {(step === 'wallet' || step === 'requirements' || status === 'idle' || status === 'error' || status === 'success') && (
          <button
            onClick={resetAndClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Step 1: Wallet Connection */}
        {step === 'wallet' && (
          <div className="text-center">
            <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Wallet className="w-10 h-10 text-orange-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
            <p className="text-gray-400 mb-6">
              Connect your Solana wallet to place an order for <span className="text-orange-400">{gigTitle}</span>
            </p>

            {/* Price Preview */}
            <div className="bg-gray-700/30 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Order Total</span>
                <span className="text-2xl font-bold text-orange-400">${amount} <span className="text-sm font-normal">USDC</span></span>
              </div>
            </div>

            {/* Wallet Selection */}
            <div className="space-y-3 mb-6">
              <button
                onClick={() => connect('phantom')}
                disabled={connecting}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white py-4 rounded-xl font-semibold transition flex items-center justify-center gap-3"
              >
                {connecting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg width="24" height="24" viewBox="0 0 128 128" fill="white">
                      <path d="M64 0C28.7 0 0 28.7 0 64s28.7 64 64 64 64-28.7 64-64S99.3 0 64 0zm32.7 72.3c-1.5 1.5-3.5 2.3-5.7 2.3H37c-4.4 0-8-3.6-8-8V37c0-2.2.9-4.2 2.3-5.7 1.5-1.5 3.5-2.3 5.7-2.3h54c4.4 0 8 3.6 8 8v27c0 2.2-.9 4.2-2.3 5.7z"/>
                    </svg>
                    Connect Phantom
                  </>
                )}
              </button>
              <button
                onClick={() => connect('solflare')}
                disabled={connecting}
                className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:bg-gray-600 text-white py-4 rounded-xl font-semibold transition flex items-center justify-center gap-3"
              >
                {connecting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg width="24" height="24" viewBox="0 0 101 88" fill="white">
                      <path d="M100.48 69.38L86.17 82.45C81.72 86.62 75.61 88.99 69.27 89H0V44.89L15.83 30.01C20.31 25.81 26.47 23.42 32.87 23.42H69.27L100.48 0V69.38Z"/>
                    </svg>
                    Connect Solflare
                  </>
                )}
              </button>
            </div>

            {/* Info */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-4 h-4 text-blue-300" />
                <span className="text-blue-300 font-semibold text-sm">Why connect first?</span>
              </div>
              <p className="text-gray-400 text-xs">
                We verify you can pay before you fill out order details. This saves your time if there&apos;s an issue with your wallet.
              </p>
            </div>

            {/* No Wallet? */}
            <p className="text-gray-500 text-sm mt-4">
              Don&apos;t have a wallet?{' '}
              <a href="https://phantom.app/" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 transition">
                Get Phantom →
              </a>
            </p>
          </div>
        )}

        {/* Step 2: Order Requirements */}
        {step === 'requirements' && (
          <OrderRequirementsForm
            gigTitle={gigTitle}
            onSubmit={handleRequirementsSubmit}
          />
        )}

        {/* Step 3: Payment */}
        {step === 'payment' && (
          <>
            {/* Success State */}
            {status === 'success' && (
              <div className="text-center">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check className="w-12 h-12 text-green-400" />
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

                {/* Order Summary */}
                {orderRequirements && (
                  <div className="bg-gray-700/30 rounded-lg p-4 mb-6 text-left">
                    <div className="text-gray-400 text-sm mb-2">Your Order Requirements</div>
                    <p className="text-white text-sm line-clamp-3">{orderRequirements.description}</p>
                  </div>
                )}

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="w-4 h-4 text-blue-300" />
                    <span className="text-blue-300 font-semibold text-sm">Payment Secured in Escrow</span>
                  </div>
                  <p className="text-gray-400 text-xs">
                    Funds will be released to <span className="text-white">{agentName}</span> when you accept the delivery, or auto-released after 7 days.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={resetAndClose}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-semibold transition"
                  >
                    Close
                  </button>
                  {orderId && (
                    <a
                      href={`/orders/${orderId}`}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-semibold transition text-center"
                    >
                      View Order →
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Error State */}
            {status === 'error' && (
              <div className="text-center">
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <X className="w-12 h-12 text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Payment Failed</h2>
                <p className="text-gray-400 mb-4">{error || 'An unexpected error occurred'}</p>
                
                <div className="flex gap-3">
                  <button
                    onClick={handleBackToRequirements}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-semibold transition"
                  >
                    Edit Order
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
                  {status === 'verifying' && 'Creating secure escrow...'}
                </p>
              </div>
            )}

            {/* Idle State - Payment Details */}
            {status === 'idle' && (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-8 h-8 text-orange-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-1">Confirm Payment</h2>
                  <p className="text-gray-400">via x402 Protocol</p>
                </div>

                {/* Order Summary */}
                {orderRequirements && (
                  <div className="bg-gray-700/30 rounded-xl p-4 mb-4 border border-gray-600">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm font-medium">Your Requirements</span>
                      <button 
                        onClick={handleBackToRequirements}
                        className="text-orange-400 text-sm hover:text-orange-300 transition"
                      >
                        Edit
                      </button>
                    </div>
                    <p className="text-white text-sm line-clamp-2">{orderRequirements.description}</p>
                    {orderRequirements.inputs && (
                      <p className="text-gray-400 text-xs mt-1 line-clamp-1">
                        + Inputs: {orderRequirements.inputs}
                      </p>
                    )}
                  </div>
                )}

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
                    <Check className="w-5 h-5 text-green-400" />
                    <div>
                      <div className="text-green-400 text-sm font-medium">Wallet Connected</div>
                      <div className="text-gray-400 text-xs font-mono">
                        {publicKey?.slice(0, 4)}...{publicKey?.slice(-4)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-3 mb-6 flex items-center gap-3">
                    <Wallet className="w-5 h-5 text-gray-400" />
                    <div className="text-gray-400 text-sm">Connect your wallet to pay</div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleBackToRequirements}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-4 rounded-xl font-semibold transition"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handlePayment}
                    disabled={connecting}
                    className="flex-[2] bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white py-4 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2"
                  >
                    {connecting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Connecting...
                      </>
                    ) : connected ? (
                      <>
                        <Zap className="w-5 h-5" /> Pay ${amount} USDC
                      </>
                    ) : (
                      <>
                        <Wallet className="w-5 h-5" /> Connect Wallet
                      </>
                    )}
                  </button>
                </div>

                {/* Info */}
                <p className="text-gray-500 text-xs text-center mt-4 flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" /> Secured by SolPay Escrow • Auto-release in 7 days
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
