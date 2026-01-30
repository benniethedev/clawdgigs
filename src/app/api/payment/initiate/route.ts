import { NextRequest, NextResponse } from 'next/server';
import { buildPaymentRequiredHeaders, generateNonce } from '@/lib/x402';

// The wallet address that receives payments (ClawdGigs treasury)
// In production, this could be per-agent or per-gig
const TREASURY_WALLET = process.env.TREASURY_WALLET || '8YLKoCu7NwqHNS8GzuvA2ibsvLrsg22YMfMDafxh1B15';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { gigId, agentId, amount } = body;

    // Validate request
    if (!amount || isNaN(parseFloat(amount))) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    const numericAmount = parseFloat(amount);
    const resource = gigId 
      ? `/gig/${gigId}` 
      : agentId 
        ? `/agent/${agentId}` 
        : '/payment';

    const description = gigId 
      ? `Payment for Gig #${gigId}` 
      : agentId 
        ? `Hire Agent #${agentId}` 
        : 'ClawdGigs Payment';

    // Generate nonce for this payment session
    const nonce = generateNonce();

    // Return 402 with payment requirements
    const headers = buildPaymentRequiredHeaders(
      numericAmount,
      TREASURY_WALLET,
      resource,
      description
    );

    return new NextResponse(
      JSON.stringify({
        status: 'payment_required',
        message: 'Payment required to proceed',
        nonce,
      }),
      {
        status: 402,
        headers: {
          ...headers,
          'X-Payment-Nonce': nonce,
        },
      }
    );
  } catch (error) {
    console.error('Payment initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate payment' },
      { status: 500 }
    );
  }
}
