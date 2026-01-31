import { NextRequest, NextResponse } from 'next/server';
import { X402_FACILITATOR } from '@/lib/x402';
import { createOrder, getGig, getAgent, updateOrderEscrow } from '@/lib/db';
import { notifyAgentOfOrder } from '@/lib/webhook';
import { createEscrow, markEscrowFunded } from '@/lib/escrow';
import { sendOrderConfirmedEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { gigId, agentId, amount, orderRequirements, x402Payload, nonce } = body;

    // Validate order requirements
    if (!orderRequirements?.description) {
      return NextResponse.json(
        { error: 'Missing order requirements' },
        { status: 400 }
      );
    }

    // Validate x402 payload
    if (!x402Payload?.paymentPayload?.signedTransactionB64) {
      return NextResponse.json(
        { error: 'Missing signed transaction' },
        { status: 400 }
      );
    }

    // Extract payer from payment requirements
    const payerWallet = x402Payload.paymentRequirements?.accepts?.[0]?.extra?.payer || 
                        orderRequirements.payer || 
                        'unknown';

    // Step 1: Verify with x402 facilitator
    console.log('Verifying payment with x402 facilitator...');
    const verifyRes = await fetch(`${X402_FACILITATOR}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(x402Payload),
    });

    let verifyData = null;
    if (verifyRes.ok) {
      verifyData = await verifyRes.json();
      console.log('Verification response:', verifyData);
      
      if (!verifyData.isValid) {
        return NextResponse.json(
          { error: 'Payment verification failed', reason: verifyData.reason, success: false },
          { status: 402 }
        );
      }
    } else {
      const verifyError = await verifyRes.text();
      console.error('Verification failed:', verifyError);
      return NextResponse.json(
        { error: 'Payment verification failed', details: verifyError, success: false },
        { status: 402 }
      );
    }

    // Step 2: Settle the payment (submit transaction on-chain)
    console.log('Settling payment with x402 facilitator...');
    const settleRes = await fetch(`${X402_FACILITATOR}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(x402Payload),
    });

    let settlementTx: string | null = null;
    let settleData = null;

    if (settleRes.ok) {
      settleData = await settleRes.json();
      console.log('Settlement response:', settleData);
      
      if (settleData.settled && settleData.txId) {
        settlementTx = settleData.txId;
        console.log('Payment settled on-chain:', settlementTx);
      } else if (settleData.alreadySettled && settleData.txId) {
        settlementTx = settleData.txId;
        console.log('Payment was already settled:', settlementTx);
      } else {
        console.error('Settlement did not return txId:', settleData);
        return NextResponse.json(
          { error: 'Settlement failed - no transaction ID', details: settleData, success: false },
          { status: 402 }
        );
      }
    } else {
      const settleError = await settleRes.text();
      console.error('Settlement failed:', settleError);
      return NextResponse.json(
        { error: 'Payment settlement failed', details: settleError, success: false },
        { status: 402 }
      );
    }

    // Get the actual payer from verification response
    const actualPayer = verifyData?.payer || settleData?.receipt?.payer || payerWallet;

    // Get agent info for escrow
    const agent = await getAgent(agentId);
    const gig = await getGig(gigId);

    if (!agent?.wallet_address) {
      return NextResponse.json(
        { error: 'Agent wallet not found' },
        { status: 400 }
      );
    }

    // Create the order with confirmed payment
    const orderResult = await createOrder({
      gig_id: gigId,
      agent_id: agentId,
      client_wallet: actualPayer,
      amount_usdc: amount.toString(),
      status: 'paid',
      requirements_description: orderRequirements.description,
      requirements_inputs: orderRequirements.inputs || undefined,
      requirements_delivery_prefs: orderRequirements.deliveryPreferences || undefined,
      payment_signature: settlementTx || undefined,
      buyer_email: orderRequirements.email || undefined,
    });

    if (!orderResult.ok || !orderResult.data) {
      console.error('Failed to create order:', orderResult.error);
      return NextResponse.json({
        success: true,
        warning: 'Payment settled but order creation failed - please contact support',
        message: 'Payment settled successfully',
        txSignature: settlementTx,
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
      clientWallet: actualPayer,
      agentWallet: agent.wallet_address,
      amountUsdc: amount.toString(),
      description: gig?.title ? `${gig.title} - Order ${orderId.slice(0, 8)}` : undefined,
    });

    if (escrowResult.ok && escrowResult.data) {
      escrowId = escrowResult.data.id;
      
      // Link escrow to order
      await updateOrderEscrow(orderId, escrowId);
      
      // Mark escrow as funded with the real on-chain transaction
      const fundResult = await markEscrowFunded(escrowId, settlementTx || 'on-chain-tx');
      
      if (fundResult.ok) {
        console.log('Escrow created and funded:', escrowId);
      } else {
        console.warn('Failed to mark escrow as funded:', fundResult.error);
        escrowError = fundResult.error;
      }
    } else {
      console.warn('Failed to create escrow:', escrowResult.error);
      escrowError = escrowResult.error;
    }

    console.log('Payment verified, settled, and order created:', {
      gigId,
      agentId,
      amount,
      payer: actualPayer,
      orderId,
      escrowId,
      txSignature: settlementTx,
    });

    // Send webhook notification to agent (fire and forget)
    if (agent && orderResult.data) {
      notifyAgentOfOrder(agent.webhook_url || '', {
        orderId,
        gigId,
        gigTitle: gig?.title || 'Unknown Gig',
        agentId,
        clientWallet: actualPayer,
        amountUsdc: amount.toString(),
        requirementsDescription: orderRequirements.description,
        requirementsInputs: orderRequirements.inputs,
        requirementsDeliveryPrefs: orderRequirements.deliveryPreferences,
        paymentSignature: settlementTx || undefined,
        escrowId,
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
      }).catch(err => {
        console.error(`Error sending order confirmation email:`, err);
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment settled and secured in escrow',
      txSignature: settlementTx,
      orderId,
      escrowId,
      escrowError,
      gigId,
      agentId,
      receipt: settleData?.receipt,
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment', details: String(error), success: false },
      { status: 500 }
    );
  }
}
