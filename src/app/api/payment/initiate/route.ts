import { NextRequest, NextResponse } from 'next/server';
import { buildPaymentRequiredHeaders, generateNonce } from '@/lib/x402';
import { buildUsdcTransferTransaction, USDC_MAINNET } from '@/lib/solana-transfer';
import { getAgent } from '@/lib/db';

// The wallet address that receives payments (ClawdGigs treasury/escrow)
const TREASURY_WALLET = process.env.TREASURY_WALLET || '8YLKoCu7NwqHNS8GzuvA2ibsvLrsg22YMfMDafxh1B15';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { gigId, agentId, amount, payer } = body;

    // Validate request
    if (!amount || isNaN(parseFloat(amount))) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    if (!payer) {
      return NextResponse.json(
        { error: 'Payer wallet address required' },
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

    // Get agent wallet if paying to agent, otherwise use treasury
    let recipientWallet = TREASURY_WALLET;
    if (agentId) {
      const agent = await getAgent(agentId);
      if (agent?.wallet_address) {
        recipientWallet = agent.wallet_address;
      }
    }

    // Generate nonce for this payment session
    const nonce = generateNonce();

    // Build the USDC transfer transaction
    let transaction;
    try {
      const result = await buildUsdcTransferTransaction({
        payer,
        recipient: recipientWallet,
        amountUsdc: numericAmount,
        network: 'mainnet',
      });
      transaction = result.serializedTx;
    } catch (txError) {
      console.error('Failed to build transaction:', txError);
      return NextResponse.json(
        { error: 'Failed to build payment transaction', details: String(txError) },
        { status: 500 }
      );
    }

    // Build x402 payment requirements (V1 format - matches facilitator test code)
    const paymentRequirements = {
      x402Version: 1,
      accepts: [{
        scheme: 'exact',
        network: 'solana-mainnet',  // V1 format uses hyphen
        maxAmountRequired: String(Math.round(numericAmount * 1_000_000)),
        resource,
        payTo: recipientWallet,
        asset: USDC_MAINNET,
      }],
    };

    // Return 402 with payment requirements and unsigned transaction
    return NextResponse.json(
      {
        status: 'payment_required',
        message: 'Sign the transaction to complete payment',
        nonce,
        paymentRequirements,
        unsignedTransaction: transaction,
        recipient: recipientWallet,
        amountUsdc: numericAmount,
      },
      {
        status: 402,
        headers: {
          'X-Payment-Required': JSON.stringify([paymentRequirements.accepts[0]]),
          'X-Payment-Nonce': nonce,
          'Content-Type': 'application/json',
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
