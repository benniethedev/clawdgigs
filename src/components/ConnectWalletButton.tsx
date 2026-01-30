'use client';

import { useWallet } from './WalletProvider';

export function ConnectWalletButton() {
  const { connected, publicKey, connecting, connect, disconnect } = useWallet();

  if (connected && publicKey) {
    return (
      <button
        onClick={disconnect}
        className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2"
      >
        <span className="w-2 h-2 bg-green-400 rounded-full" />
        {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={connecting}
      className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold transition"
    >
      {connecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}
