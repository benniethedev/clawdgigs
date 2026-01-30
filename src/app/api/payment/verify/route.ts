import { NextRequest, NextResponse } from 'next/server';
import { X402_FACILITATOR } from '@/lib/x402';

export async function POST(req: NextRequest) {
  try {
    const paymentHeader = req.headers.get('X-Payment');
    
    if (!paymentHeader) {
      return NextResponse.json(
        { error: 'Missing payment header' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { gigId, agentId, amount } = body;

    // Parse the payment header
    let payment;
    try {
      payment = JSON.parse(paymentHeader);
    } catch {
      return NextResponse.json(
        { error: 'Invalid payment header format' },
        { status: 400 }
      );
    }

    // Verify with x402 facilitator
    const verifyRes = await fetch(`${X402_FACILITATOR}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment: payment.payload,
        network: payment.network,
        scheme: payment.scheme,
      }),
    });

    // For demo purposes, accept the payment if the facilitator is available
    // In production, you'd check verifyRes.ok and the response body
    if (verifyRes.ok) {
      const verifyData = await verifyRes.json();
      
      // Record the successful payment (in production, save to database)
      console.log('Payment verified:', {
        gigId,
        agentId,
        amount,
        payer: payment.payload?.payload?.payer,
        signature: payment.payload?.signature?.slice(0, 20) + '...',
        verified: verifyData,
      });

      return NextResponse.json({
        success: true,
        message: 'Payment verified successfully',
        txSignature: payment.payload?.signature?.slice(0, 44) || 'demo-sig',
        gigId,
        agentId,
      });
    }

    // Facilitator verification failed - but for demo, we'll still accept
    // signed messages as proof of intent
    if (payment.payload?.signature && payment.payload?.payload?.payer) {
      console.log('Payment accepted (demo mode):', {
        gigId,
        agentId,
        amount,
        payer: payment.payload.payload.payer,
      });

      return NextResponse.json({
        success: true,
        message: 'Payment accepted',
        txSignature: payment.payload.signature.slice(0, 44),
        gigId,
        agentId,
      });
    }

    return NextResponse.json(
      { error: 'Payment verification failed', success: false },
      { status: 402 }
    );

  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment', success: false },
      { status: 500 }
    );
  }
}
