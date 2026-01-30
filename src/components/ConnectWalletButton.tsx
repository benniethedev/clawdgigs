'use client';

import { useState, useRef, useEffect } from 'react';
import { useWallet } from './WalletProvider';

export function ConnectWalletButton() {
  const { connected, publicKey, connecting, walletType, connect, disconnect, switchWallet } = useWallet();
  const [showMenu, setShowMenu] = useState(false);
  const [showWalletSelect, setShowWalletSelect] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
        setShowWalletSelect(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDisconnect = () => {
    disconnect();
    setShowMenu(false);
  };

  const handleSwitchWallet = async () => {
    setShowMenu(false);
    await switchWallet();
    setShowWalletSelect(true);
  };

  const handleSelectWallet = async (wallet: 'phantom' | 'solflare') => {
    setShowWalletSelect(false);
    await connect(wallet);
  };

  // Wallet selection modal
  if (showWalletSelect) {
    return (
      <div className="relative" ref={menuRef}>
        <div className="absolute right-0 top-0 mt-0 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700">
            <p className="text-sm font-medium text-white">Select Wallet</p>
          </div>
          <div className="py-1">
            <button
              onClick={() => handleSelectWallet('phantom')}
              className="w-full px-4 py-3 text-left text-white hover:bg-gray-700 flex items-center gap-3 transition"
            >
              <span className="text-xl">👻</span>
              <span>Phantom</span>
            </button>
            <button
              onClick={() => handleSelectWallet('solflare')}
              className="w-full px-4 py-3 text-left text-white hover:bg-gray-700 flex items-center gap-3 transition"
            >
              <span className="text-xl">🔆</span>
              <span>Solflare</span>
            </button>
          </div>
          <div className="px-4 py-2 border-t border-gray-700">
            <button
              onClick={() => setShowWalletSelect(false)}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (connected && publicKey) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2"
        >
          <span className="w-2 h-2 bg-green-400 rounded-full" />
          {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
          <svg
            className={`w-4 h-4 transition-transform ${showMenu ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {showMenu && (
          <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700">
              <p className="text-xs text-gray-400">Connected with {walletType === 'phantom' ? '👻 Phantom' : '🔆 Solflare'}</p>
              <p className="text-sm font-mono text-white truncate">{publicKey}</p>
            </div>
            <div className="py-1">
              <button
                onClick={handleSwitchWallet}
                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex items-center gap-2 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Switch Wallet
              </button>
              <button
                onClick={handleDisconnect}
                className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-700 flex items-center gap-2 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Disconnect Wallet
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => connect()}
      disabled={connecting}
      className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold transition"
    >
      {connecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}
