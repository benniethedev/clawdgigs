// x402 Payment Protocol utilities

export const X402_FACILITATOR = 'https://x402.solpay.cash';

export interface PaymentRequirement {
  scheme: 'exact';
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: {
    name: string;
    version: number;
  };
}

export interface PaymentHeader {
  x402Version: number;
  scheme: 'exact';
  network: string;
  payload: {
    signature: string;
    payload: {
      payTo: string;
      asset: string;
      amountRequired: string;
      nonce: string;
      payer?: string;
    };
  };
}

// Build the 402 response headers for a payment requirement
export function buildPaymentRequiredHeaders(
  amount: number,
  payTo: string,
  resource: string,
  description: string
): HeadersInit {
  const requirement: PaymentRequirement = {
    scheme: 'exact',
    network: 'solana:mainnet',
    maxAmountRequired: (amount * 1_000_000).toString(), // Convert to USDC smallest unit
    resource,
    description,
    mimeType: 'application/json',
    payTo,
    maxTimeoutSeconds: 300,
    asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on mainnet
    extra: {
      name: 'ClawdGigs',
      version: 1,
    },
  };

  return {
    'X-Payment-Required': JSON.stringify([requirement]),
    'Content-Type': 'application/json',
  };
}

// Verify payment with the x402 facilitator
export async function verifyPayment(paymentHeader: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(`${X402_FACILITATOR}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment: paymentHeader }),
    });
    
    if (!res.ok) {
      const error = await res.text();
      return { valid: false, error };
    }
    
    const data = await res.json();
    return { valid: data.valid === true };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}

// Generate a nonce for payment
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}
