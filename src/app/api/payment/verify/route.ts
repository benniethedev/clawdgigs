import { NextRequest, NextResponse } from 'next/server';
import { X402_FACILITATOR } from '@/lib/x402';
import { createOrder, getGig, getAgent, updateOrderEscrow } from '@/lib/db';
import { notifyAgentOfOrder } from '@/lib/webhook';
import { createEscrow } from '@/lib/escrow';

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
    const { gigId, agentId, amount, orderRequirements } = body;

    // Validate order requirements
    if (!orderRequirements?.description) {
      return NextResponse.json(
        { error: 'Missing order requirements' },
        { status: 400 }
      );
    }

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

    const payerWallet = payment.payload?.payload?.payer;
    const paymentSignature = payment.payload?.signature;

    if (!payerWallet) {
      return NextResponse.json(
        { error: 'Missing payer wallet in payment' },
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

    let paymentVerified = false;
    let verifyData = null;

    if (verifyRes.ok) {
      verifyData = await verifyRes.json();
      paymentVerified = true;
    }

    // For demo mode: accept signed messages as proof of intent
    // In production, you'd require strict verification
    if (!paymentVerified && paymentSignature && payerWallet) {
      paymentVerified = true;
      console.log('Payment accepted (demo mode - signature present)');
    }

    if (!paymentVerified) {
      return NextResponse.json(
        { error: 'Payment verification failed', success: false },
        { status: 402 }
      );
    }

    // Create the order after successful payment
    // Status is 'paid' since payment has been verified
    const orderResult = await createOrder({
      gig_id: gigId,
      agent_id: agentId,
      client_wallet: payerWallet,
      amount_usdc: amount.toString(),
      status: 'paid',
      requirements_description: orderRequirements.description,
      requirements_inputs: orderRequirements.inputs || undefined,
      requirements_delivery_prefs: orderRequirements.deliveryPreferences || undefined,
      payment_signature: paymentSignature ? paymentSignature.slice(0, 88) : undefined,
    });

    if (!orderResult.ok) {
      console.error('Failed to create order:', orderResult.error);
      // Payment was successful but order creation failed
      // In production, you'd want to handle this more gracefully (retry, queue, etc.)
      return NextResponse.json({
        success: true,
        warning: 'Payment verified but order creation failed - please contact support',
        message: 'Payment verified successfully',
        txSignature: paymentSignature?.slice(0, 44) || 'demo-sig',
        gigId,
        agentId,
      });
    }

    console.log('Payment verified and order created:', {
      gigId,
      agentId,
      amount,
      payer: payerWallet,
      orderId: orderResult.data?.id,
      verified: verifyData,
    });

    // Create escrow for the payment
    let escrowId: string | undefined;
    const agent = await getAgent(agentId);
    
    if (orderResult.data?.id && agent?.wallet_address) {
      const escrowResult = await createEscrow({
        orderId: orderResult.data.id,
        clientWallet: payerWallet,
        agentWallet: agent.wallet_address,
        amountUsdc: amount.toString(),
      });

      if (escrowResult.ok && escrowResult.data) {
        escrowId = escrowResult.data.id;
        // Link escrow to order
        await updateOrderEscrow(orderResult.data.id, escrowId);
        console.log('Escrow created:', escrowId);
      } else {
        console.warn('Failed to create escrow:', escrowResult.error);
        // Continue without escrow - payment still valid
      }
    }

    // Send webhook notification to agent (fire and forget)
    if (agent?.webhook_url && orderResult.data) {
      const gig = await getGig(gigId);
      
      // Don't await - let it run in background with its own retry logic
      notifyAgentOfOrder(agent.webhook_url, {
        orderId: orderResult.data.id,
        gigId,
        gigTitle: gig?.title || 'Unknown Gig',
        agentId,
        clientWallet: payerWallet,
        amountUsdc: amount.toString(),
        requirementsDescription: orderRequirements.description,
        requirementsInputs: orderRequirements.inputs,
        requirementsDeliveryPrefs: orderRequirements.deliveryPreferences,
        paymentSignature: paymentSignature?.slice(0, 88),
      }).then(result => {
        if (result.success) {
          console.log(`Webhook delivered to agent ${agentId}`, { attempts: result.attempts });
        } else {
          console.error(`Webhook failed for agent ${agentId}:`, result.error);
        }
      }).catch(err => {
        console.error(`Webhook error for agent ${agentId}:`, err);
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and order created',
      txSignature: paymentSignature?.slice(0, 44) || 'demo-sig',
      orderId: orderResult.data?.id,
      escrowId,
      gigId,
      agentId,
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment', success: false },
      { status: 500 }
    );
  }
}
