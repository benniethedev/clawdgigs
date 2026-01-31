import { NextRequest, NextResponse } from 'next/server';
import { X402_FACILITATOR } from '@/lib/x402';
import { createOrder, getGig, getAgent, updateOrderEscrow } from '@/lib/db';
import { notifyAgentOfOrder } from '@/lib/webhook';
import { createEscrow, markEscrowFunded } from '@/lib/escrow';
import { sendOrderConfirmedEmail } from '@/lib/email';

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

    // Step 1: Verify with x402 facilitator
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
    let settlementTx: string | null = null;

    if (verifyRes.ok) {
      verifyData = await verifyRes.json();
      
      // Step 2: Settle the payment (actually transfer USDC on-chain)
      const settleRes = await fetch(`${X402_FACILITATOR}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment: payment.payload,
          network: payment.network,
          scheme: payment.scheme,
        }),
      });

      if (settleRes.ok) {
        const settleData = await settleRes.json();
        if (settleData.txSignature || settleData.signature) {
          paymentVerified = true;
          settlementTx = settleData.txSignature || settleData.signature;
          console.log('Payment settled on-chain:', settlementTx);
        } else {
          console.error('Settlement response missing txSignature:', settleData);
        }
      } else {
        const settleError = await settleRes.text();
        console.error('Settlement failed:', settleError);
      }
    } else {
      const verifyError = await verifyRes.text();
      console.error('Payment verification failed:', verifyError);
    }

    // Demo mode: DISABLED for production
    // Uncomment below for testing without real payments
    // if (!paymentVerified && paymentSignature && payerWallet) {
    //   paymentVerified = true;
    //   console.log('Payment accepted (demo mode - signature present)');
    // }

    if (!paymentVerified) {
      return NextResponse.json(
        { error: 'Payment verification or settlement failed. Your wallet was not charged.', success: false },
        { status: 402 }
      );
    }

    // Use the settlement transaction signature for tracking
    const finalTxSignature = settlementTx || paymentSignature;

    // Get agent info for escrow
    const agent = await getAgent(agentId);
    const gig = await getGig(gigId);

    if (!agent?.wallet_address) {
      return NextResponse.json(
        { error: 'Agent wallet not found' },
        { status: 400 }
      );
    }

    // Create the order first (status 'paid')
    const orderResult = await createOrder({
      gig_id: gigId,
      agent_id: agentId,
      client_wallet: payerWallet,
      amount_usdc: amount.toString(),
      status: 'paid',
      requirements_description: orderRequirements.description,
      requirements_inputs: orderRequirements.inputs || undefined,
      requirements_delivery_prefs: orderRequirements.deliveryPreferences || undefined,
      payment_signature: finalTxSignature ? finalTxSignature.slice(0, 88) : undefined,
      buyer_email: orderRequirements.email || undefined,
    });

    if (!orderResult.ok || !orderResult.data) {
      console.error('Failed to create order:', orderResult.error);
      return NextResponse.json({
        success: true,
        warning: 'Payment verified but order creation failed - please contact support',
        message: 'Payment verified successfully',
        txSignature: finalTxSignature?.slice(0, 44) || 'unknown',
        gigId,
        agentId,
      });
    }

    const orderId = orderResult.data.id;

    // Create escrow for the payment
    let escrowId: string | undefined;
    let escrowError: string | undefined;

    const escrowResult = await createEscrow({
      orderId,
      clientWallet: payerWallet,
      agentWallet: agent.wallet_address,
      amountUsdc: amount.toString(),
      description: gig?.title ? `${gig.title} - Order ${orderId.slice(0, 8)}` : undefined,
    });

    if (escrowResult.ok && escrowResult.data) {
      escrowId = escrowResult.data.id;
      
      // Link escrow to order
      await updateOrderEscrow(orderId, escrowId);
      
      // Mark escrow as funded with the real on-chain transaction
      const fundResult = await markEscrowFunded(
        escrowId,
        finalTxSignature || 'settlement-tx',
      );
      
      if (fundResult.ok) {
        console.log('Escrow created and funded:', escrowId);
      } else {
        console.warn('Failed to mark escrow as funded:', fundResult.error);
        escrowError = fundResult.error;
      }
    } else {
      console.warn('Failed to create escrow:', escrowResult.error);
      escrowError = escrowResult.error;
      // Continue without escrow - payment still valid
      // In production, you might want to fail the whole transaction
    }

    console.log('Payment verified and order created:', {
      gigId,
      agentId,
      amount,
      payer: payerWallet,
      orderId,
      escrowId,
      verified: verifyData,
    });

    // Send webhook notification to agent (fire and forget)
    if (agent?.webhook_url && orderResult.data) {
      // Don't await - let it run in background with its own retry logic
      notifyAgentOfOrder(agent.webhook_url, {
        orderId,
        gigId,
        gigTitle: gig?.title || 'Unknown Gig',
        agentId,
        clientWallet: payerWallet,
        amountUsdc: amount.toString(),
        requirementsDescription: orderRequirements.description,
        requirementsInputs: orderRequirements.inputs,
        requirementsDeliveryPrefs: orderRequirements.deliveryPreferences,
        paymentSignature: finalTxSignature?.slice(0, 88),
        escrowId,
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

    // Send order confirmation email to buyer (fire and forget)
    if (orderRequirements.email) {
      sendOrderConfirmedEmail({
        orderId,
        buyerEmail: orderRequirements.email,
        gigTitle: gig?.title || 'Unknown Gig',
        agentName: agent?.display_name || agent?.name || 'AI Agent',
        amountUsdc: amount.toString(),
        requirementsDescription: orderRequirements.description,
      }).then(result => {
        if (result.success) {
          console.log(`Order confirmation email sent to ${orderRequirements.email}`);
        } else {
          console.warn(`Failed to send order confirmation email:`, result.error);
        }
      }).catch(err => {
        console.error(`Error sending order confirmation email:`, err);
      });
    }

    return NextResponse.json({
      success: true,
      message: escrowId 
        ? 'Payment verified and secured in escrow' 
        : 'Payment verified and order created',
      txSignature: finalTxSignature?.slice(0, 44) || 'settlement-tx',
      orderId,
      escrowId,
      escrowError,
      gigId,
      agentId,
      settlementTx,
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment', success: false },
      { status: 500 }
    );
  }
}
