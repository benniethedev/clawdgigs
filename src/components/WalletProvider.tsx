'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

interface WalletContextType {
  connected: boolean;
  publicKey: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: (transaction: unknown) => Promise<unknown>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: Window & { phantom?: { solana?: any }; solflare?: any };

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Check if already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== 'undefined') {
        const phantom = window.phantom?.solana;
        if (phantom?.isConnected && phantom?.publicKey) {
          setConnected(true);
          setPublicKey(phantom.publicKey.toBase58());
        }
      }
    };
    checkConnection();
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === 'undefined') return;
    
    setConnecting(true);
    
    try {
      // Try Phantom first
      const phantom = window.phantom?.solana;
      if (phantom) {
        const resp = await phantom.connect();
        setPublicKey(resp.publicKey.toBase58());
        setConnected(true);
        return;
      }
      
      // Try Solflare
      const solflare = window.solflare;
      if (solflare) {
        await solflare.connect();
        if (solflare.publicKey) {
          setPublicKey(solflare.publicKey.toBase58());
          setConnected(true);
          return;
        }
      }
      
      // No wallet found
      window.open('https://phantom.app/', '_blank');
    } catch (err) {
      console.error('Failed to connect wallet:', err);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    const phantom = window.phantom?.solana;
    if (phantom) {
      phantom.disconnect();
    }
    setConnected(false);
    setPublicKey(null);
  }, []);

  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    const phantom = window.phantom?.solana;
    if (!phantom) throw new Error('Wallet not connected');
    
    const { signature } = await phantom.signMessage(message, 'utf8');
    return signature;
  }, []);

  const signTransaction = useCallback(async (transaction: unknown): Promise<unknown> => {
    const phantom = window.phantom?.solana;
    if (!phantom) throw new Error('Wallet not connected');
    
    return phantom.signTransaction(transaction);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        connected,
        publicKey,
        connecting,
        connect,
        disconnect,
        signMessage,
        signTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
