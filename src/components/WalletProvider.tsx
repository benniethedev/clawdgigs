'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

const WALLET_STORAGE_KEY = 'clawdgigs_wallet_connected';
const WALLET_TYPE_KEY = 'clawdgigs_wallet_type';

interface WalletContextType {
  connected: boolean;
  publicKey: string | null;
  connecting: boolean;
  walletType: 'phantom' | 'solflare' | null;
  connect: (walletType?: 'phantom' | 'solflare') => Promise<void>;
  disconnect: () => void;
  switchWallet: () => Promise<void>;
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
  const [walletType, setWalletType] = useState<'phantom' | 'solflare' | null>(null);

  // Auto-reconnect on mount if previously connected
  useEffect(() => {
    const autoConnect = async () => {
      if (typeof window === 'undefined') return;
      
      const wasConnected = localStorage.getItem(WALLET_STORAGE_KEY) === 'true';
      const savedWalletType = localStorage.getItem(WALLET_TYPE_KEY) as 'phantom' | 'solflare' | null;
      
      if (!wasConnected || !savedWalletType) return;
      
      try {
        if (savedWalletType === 'phantom') {
          const phantom = window.phantom?.solana;
          if (phantom) {
            // Use onlyIfTrusted to silently reconnect without popup
            const resp = await phantom.connect({ onlyIfTrusted: true });
            setPublicKey(resp.publicKey.toBase58());
            setConnected(true);
            setWalletType('phantom');
            return;
          }
        }
        
        if (savedWalletType === 'solflare') {
          const solflare = window.solflare;
          if (solflare) {
            await solflare.connect({ onlyIfTrusted: true });
            if (solflare.publicKey) {
              setPublicKey(solflare.publicKey.toBase58());
              setConnected(true);
              setWalletType('solflare');
              return;
            }
          }
        }
      } catch (err) {
        // User hasn't approved this site yet or rejected - clear storage
        console.log('Auto-connect failed (user may need to re-approve):', err);
        localStorage.removeItem(WALLET_STORAGE_KEY);
        localStorage.removeItem(WALLET_TYPE_KEY);
      }
    };
    
    // Small delay to ensure wallet extension is loaded
    const timer = setTimeout(autoConnect, 100);
    return () => clearTimeout(timer);
  }, []);

  // Listen for wallet disconnect events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const phantom = window.phantom?.solana;
    const solflare = window.solflare;
    
    const handleDisconnect = () => {
      setConnected(false);
      setPublicKey(null);
      setWalletType(null);
      localStorage.removeItem(WALLET_STORAGE_KEY);
      localStorage.removeItem(WALLET_TYPE_KEY);
    };
    
    phantom?.on?.('disconnect', handleDisconnect);
    solflare?.on?.('disconnect', handleDisconnect);
    
    return () => {
      phantom?.off?.('disconnect', handleDisconnect);
      solflare?.off?.('disconnect', handleDisconnect);
    };
  }, []);

  const connect = useCallback(async (preferredWallet?: 'phantom' | 'solflare') => {
    if (typeof window === 'undefined') return;
    
    setConnecting(true);
    
    try {
      // If specific wallet requested, try that first
      if (preferredWallet === 'solflare') {
        const solflare = window.solflare;
        if (solflare) {
          await solflare.connect();
          if (solflare.publicKey) {
            const pk = solflare.publicKey.toBase58();
            setPublicKey(pk);
            setConnected(true);
            setWalletType('solflare');
            localStorage.setItem(WALLET_STORAGE_KEY, 'true');
            localStorage.setItem(WALLET_TYPE_KEY, 'solflare');
            return;
          }
        }
      }
      
      // Try Phantom first (default)
      const phantom = window.phantom?.solana;
      if (phantom && preferredWallet !== 'solflare') {
        const resp = await phantom.connect();
        const pk = resp.publicKey.toBase58();
        setPublicKey(pk);
        setConnected(true);
        setWalletType('phantom');
        localStorage.setItem(WALLET_STORAGE_KEY, 'true');
        localStorage.setItem(WALLET_TYPE_KEY, 'phantom');
        return;
      }
      
      // Try Solflare as fallback
      const solflare = window.solflare;
      if (solflare) {
        await solflare.connect();
        if (solflare.publicKey) {
          const pk = solflare.publicKey.toBase58();
          setPublicKey(pk);
          setConnected(true);
          setWalletType('solflare');
          localStorage.setItem(WALLET_STORAGE_KEY, 'true');
          localStorage.setItem(WALLET_TYPE_KEY, 'solflare');
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
    if (typeof window === 'undefined') return;
    
    const phantom = window.phantom?.solana;
    const solflare = window.solflare;
    
    if (walletType === 'phantom' && phantom) {
      phantom.disconnect();
    } else if (walletType === 'solflare' && solflare) {
      solflare.disconnect();
    }
    
    setConnected(false);
    setPublicKey(null);
    setWalletType(null);
    localStorage.removeItem(WALLET_STORAGE_KEY);
    localStorage.removeItem(WALLET_TYPE_KEY);
  }, [walletType]);

  const switchWallet = useCallback(async () => {
    // Disconnect current wallet first
    disconnect();
    // Small delay then show wallet selection
    await new Promise(resolve => setTimeout(resolve, 100));
  }, [disconnect]);

  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    if (walletType === 'phantom') {
      const phantom = window.phantom?.solana;
      if (!phantom) throw new Error('Wallet not connected');
      const { signature } = await phantom.signMessage(message, 'utf8');
      return signature;
    } else if (walletType === 'solflare') {
      const solflare = window.solflare;
      if (!solflare) throw new Error('Wallet not connected');
      const { signature } = await solflare.signMessage(message, 'utf8');
      return signature;
    }
    throw new Error('No wallet connected');
  }, [walletType]);

  const signTransaction = useCallback(async (transaction: unknown): Promise<unknown> => {
    if (walletType === 'phantom') {
      const phantom = window.phantom?.solana;
      if (!phantom) throw new Error('Wallet not connected');
      return phantom.signTransaction(transaction);
    } else if (walletType === 'solflare') {
      const solflare = window.solflare;
      if (!solflare) throw new Error('Wallet not connected');
      return solflare.signTransaction(transaction);
    }
    throw new Error('No wallet connected');
  }, [walletType]);

  return (
    <WalletContext.Provider
      value={{
        connected,
        publicKey,
        connecting,
        walletType,
        connect,
        disconnect,
        switchWallet,
        signMessage,
        signTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
