// Escrow wallet transfer utilities
// Handles actual USDC transfers from escrow wallet to sellers

import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
} from '@solana/spl-token';
import bs58 from 'bs58';

// USDC mint (mainnet)
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// RPC endpoint - use env or default
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// Get escrow wallet keypair from env
function getEscrowKeypair(): Keypair {
  const privateKey = process.env.ESCROW_WALLET_PRIVATE;
  if (!privateKey) {
    throw new Error('ESCROW_WALLET_PRIVATE not set');
  }
  return Keypair.fromSecretKey(bs58.decode(privateKey));
}

// Get escrow wallet public key
export function getEscrowWalletPublic(): string {
  return process.env.ESCROW_WALLET_PUBLIC || 'As8dExsrSHRZm6wxZzc6jfHtHB6QutAKqo7TWghpL4Dt';
}

// Platform wallet (receives the 10% fee)
export function getPlatformWallet(): string {
  return process.env.PLATFORM_WALLET || '2BcjnU1sSv2f4Uk793ZY59U41LapKMggYmwhiPDrhHfs';
}

export interface TransferFromEscrowParams {
  sellerWallet: string;     // Seller's wallet address
  sellerAmount: number;     // Amount to seller in micro USDC
  platformFee: number;      // Fee to platform in micro USDC
}

export interface TransferResult {
  success: boolean;
  txSignature?: string;
  error?: string;
}

/**
 * Transfer USDC from escrow wallet to seller (minus platform fee)
 * Also transfers the platform fee to platform wallet
 */
export async function transferFromEscrow({
  sellerWallet,
  sellerAmount,
  platformFee,
}: TransferFromEscrowParams): Promise<TransferResult> {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const escrowKeypair = getEscrowKeypair();
    const mintPubkey = new PublicKey(USDC_MINT);
    
    // Get all the token accounts
    const escrowAta = await getAssociatedTokenAddress(mintPubkey, escrowKeypair.publicKey);
    const sellerPubkey = new PublicKey(sellerWallet);
    const sellerAta = await getAssociatedTokenAddress(mintPubkey, sellerPubkey);
    const platformPubkey = new PublicKey(getPlatformWallet());
    const platformAta = await getAssociatedTokenAddress(mintPubkey, platformPubkey);
    
    // Check escrow balance
    const escrowAccount = await getAccount(connection, escrowAta);
    const balance = Number(escrowAccount.amount);
    const totalNeeded = sellerAmount + platformFee;
    
    if (balance < totalNeeded) {
      return {
        success: false,
        error: `Insufficient escrow balance. Has ${balance}, needs ${totalNeeded}`,
      };
    }
    
    // Build transaction with both transfers
    const transaction = new Transaction();
    
    // Transfer to seller
    if (sellerAmount > 0) {
      transaction.add(
        createTransferInstruction(
          escrowAta,
          sellerAta,
          escrowKeypair.publicKey,
          BigInt(sellerAmount)
        )
      );
    }
    
    // Transfer fee to platform
    if (platformFee > 0) {
      transaction.add(
        createTransferInstruction(
          escrowAta,
          platformAta,
          escrowKeypair.publicKey,
          BigInt(platformFee)
        )
      );
    }
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = escrowKeypair.publicKey;
    
    // Sign and send
    const txSignature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [escrowKeypair],
      { commitment: 'confirmed' }
    );
    
    console.log('Escrow release transaction:', txSignature);
    
    return {
      success: true,
      txSignature,
    };
  } catch (error) {
    console.error('Escrow transfer error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Refund USDC from escrow wallet back to buyer
 */
export async function refundFromEscrow(
  buyerWallet: string,
  amount: number // Full amount in micro USDC
): Promise<TransferResult> {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const escrowKeypair = getEscrowKeypair();
    const mintPubkey = new PublicKey(USDC_MINT);
    
    const escrowAta = await getAssociatedTokenAddress(mintPubkey, escrowKeypair.publicKey);
    const buyerPubkey = new PublicKey(buyerWallet);
    const buyerAta = await getAssociatedTokenAddress(mintPubkey, buyerPubkey);
    
    // Check escrow balance
    const escrowAccount = await getAccount(connection, escrowAta);
    const balance = Number(escrowAccount.amount);
    
    if (balance < amount) {
      return {
        success: false,
        error: `Insufficient escrow balance for refund. Has ${balance}, needs ${amount}`,
      };
    }
    
    const transaction = new Transaction();
    transaction.add(
      createTransferInstruction(
        escrowAta,
        buyerAta,
        escrowKeypair.publicKey,
        BigInt(amount)
      )
    );
    
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = escrowKeypair.publicKey;
    
    const txSignature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [escrowKeypair],
      { commitment: 'confirmed' }
    );
    
    console.log('Escrow refund transaction:', txSignature);
    
    return {
      success: true,
      txSignature,
    };
  } catch (error) {
    console.error('Escrow refund error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check escrow wallet USDC balance
 */
export async function getEscrowBalance(): Promise<number> {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const escrowPubkey = new PublicKey(getEscrowWalletPublic());
    const mintPubkey = new PublicKey(USDC_MINT);
    const escrowAta = await getAssociatedTokenAddress(mintPubkey, escrowPubkey);
    
    const account = await getAccount(connection, escrowAta);
    return Number(account.amount);
  } catch (error) {
    console.error('Error getting escrow balance:', error);
    return 0;
  }
}
