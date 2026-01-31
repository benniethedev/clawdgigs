// Solana USDC transfer utilities for x402 payments
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

// USDC mint addresses
export const USDC_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

// x402 Facilitator fee payer (sponsors transaction fees)
// This allows users to pay with only USDC, no SOL required
export const FACILITATOR_FEE_PAYER = '86Ts3pgt61316eCC8RR1bHoCgtLdt6BD3imrWXALWKtp';

// RPC endpoints
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const DEVNET_RPC = 'https://api.devnet.solana.com';

export interface BuildTransferParams {
  payer: string;        // Payer's wallet address
  recipient: string;    // Recipient's wallet address
  amountUsdc: number;   // Amount in USDC (e.g., 0.10)
  network?: 'mainnet' | 'devnet';
}

export interface TransferResult {
  transaction: Transaction;
  serializedTx: string; // Base64 encoded for signing
}

/**
 * Build a USDC transfer transaction for x402 payment.
 * Returns a transaction ready to be signed by the payer.
 */
export async function buildUsdcTransferTransaction({
  payer,
  recipient,
  amountUsdc,
  network = 'mainnet',
}: BuildTransferParams): Promise<TransferResult> {
  const rpc = network === 'mainnet' ? MAINNET_RPC : DEVNET_RPC;
  const usdcMint = network === 'mainnet' ? USDC_MAINNET : USDC_DEVNET;
  
  const connection = new Connection(rpc, 'confirmed');
  
  const payerPubkey = new PublicKey(payer);
  const recipientPubkey = new PublicKey(recipient);
  const mintPubkey = new PublicKey(usdcMint);
  
  // Convert USDC amount to smallest unit (6 decimals)
  const amountInSmallestUnit = Math.round(amountUsdc * 1_000_000);
  
  // Get associated token accounts
  const payerAta = await getAssociatedTokenAddress(
    mintPubkey,
    payerPubkey
  );
  
  const recipientAta = await getAssociatedTokenAddress(
    mintPubkey,
    recipientPubkey
  );
  
  const instructions: TransactionInstruction[] = [];
  
  // Check if recipient ATA exists
  // Note: We cannot create ATA in x402-facilitated transactions (program not allowed)
  // Recipient must have USDC ATA set up beforehand
  const recipientAtaInfo = await connection.getAccountInfo(recipientAta);
  if (!recipientAtaInfo) {
    throw new Error(
      `Recipient ${recipient} does not have a USDC token account. ` +
      `They must receive USDC at least once to create their account.`
    );
  }
  
  // Add transfer instruction only (no ATA creation - facilitator doesn't allow it)
  instructions.push(
    createTransferInstruction(
      payerAta,              // source
      recipientAta,          // destination
      payerPubkey,           // owner
      amountInSmallestUnit   // amount
    )
  );
  
  // Build transaction with x402 facilitator as fee payer (gasless for users)
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  
  // Use facilitator as fee payer so users don't need SOL
  const facilitatorPubkey = new PublicKey(FACILITATOR_FEE_PAYER);
  
  const transaction = new Transaction({
    feePayer: facilitatorPubkey,  // Facilitator sponsors the fee
    blockhash,
    lastValidBlockHeight,
  });
  
  transaction.add(...instructions);
  
  // Serialize for client-side signing
  const serializedTx = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  }).toString('base64');
  
  return {
    transaction,
    serializedTx,
  };
}

/**
 * Deserialize a base64 transaction
 */
export function deserializeTransaction(base64Tx: string): Transaction {
  const buffer = Buffer.from(base64Tx, 'base64');
  return Transaction.from(buffer);
}
