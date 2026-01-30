// Solana connection utilities for backend operations
// Uses Synapse RPC for mainnet

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Singleton connection instance
let connection: Connection | null = null;

/**
 * Get the Solana connection instance.
 * Uses SOLANA_RPC_URL env var (server-side only).
 * Falls back to public mainnet endpoint if not configured.
 */
export function getConnection(): Connection {
  if (connection) return connection;

  const rpcUrl = process.env.SOLANA_RPC_URL;
  
  if (!rpcUrl) {
    console.warn('SOLANA_RPC_URL not configured, using public mainnet endpoint');
    connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  } else {
    connection = new Connection(rpcUrl, 'confirmed');
  }

  return connection;
}

/**
 * Get SOL balance for a wallet address.
 * Returns balance in SOL (not lamports).
 */
export async function getWalletBalance(walletAddress: string): Promise<number> {
  try {
    const conn = getConnection();
    const pubkey = new PublicKey(walletAddress);
    const balance = await conn.getBalance(pubkey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Failed to get wallet balance:', error);
    throw error;
  }
}

/**
 * Verify a transaction exists and is confirmed.
 * Returns transaction details if found, null otherwise.
 */
export async function verifyTransaction(signature: string): Promise<{
  confirmed: boolean;
  slot?: number;
  blockTime?: number | null;
  err?: unknown;
} | null> {
  try {
    const conn = getConnection();
    const tx = await conn.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    
    if (!tx) return null;
    
    return {
      confirmed: tx.meta?.err === null,
      slot: tx.slot,
      blockTime: tx.blockTime,
      err: tx.meta?.err,
    };
  } catch (error) {
    console.error('Failed to verify transaction:', error);
    return null;
  }
}

/**
 * Get recent blockhash for transaction building.
 */
export async function getRecentBlockhash(): Promise<{
  blockhash: string;
  lastValidBlockHeight: number;
}> {
  const conn = getConnection();
  return conn.getLatestBlockhash('confirmed');
}

// USDC on mainnet
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
