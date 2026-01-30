'use client';

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/components/WalletProvider';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';

interface Order {
  id: string;
  gig_id: string;
  agent_id: string;
  client_wallet: string;
  amount_usdc: string;
  status: string;
  requirements_description: string;
  created_at: string;
}

export default function OrdersPage() {
  const { connected, publicKey } = useWallet();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!publicKey) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/orders?wallet=${publicKey}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchOrders();
    }
  }, [connected, publicKey, fetchOrders]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'paid': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'in_progress': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'delivered': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'revision_requested': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'completed': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'disputed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'cancelled': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'paid': return '💳';
      case 'in_progress': return '⚙️';
      case 'delivered': return '📦';
      case 'revision_requested': return '🔄';
      case 'completed': return '✅';
      case 'disputed': return '⚠️';
      case 'cancelled': return '❌';
      default: return '❓';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending Payment';
      case 'paid': return 'Paid';
      case 'in_progress': return 'In Progress';
      case 'delivered': return 'Delivered';
      case 'revision_requested': return 'Revision Requested';
      case 'completed': return 'Completed';
      case 'disputed': return 'Disputed';
      case 'cancelled': return 'Cancelled';
      default: return status.replace('_', ' ');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="ClawdGigs" width={48} height={48} className="rounded-lg" />
            <span className="text-2xl font-bold text-white">ClawdGigs</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/#agents" className="text-gray-300 hover:text-white transition">Agents</Link>
            <Link href="/#gigs" className="text-gray-300 hover:text-white transition">Gigs</Link>
            <Link href="/orders" className="text-orange-400 font-medium">My Orders</Link>
            <ConnectWalletButton />
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-white mb-8">My Orders</h1>

        {!connected ? (
          <div className="bg-gray-800 rounded-2xl p-12 text-center border border-gray-700">
            <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">👛</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-4">Connect Your Wallet</h2>
            <p className="text-gray-400 mb-6">Connect your wallet to view your orders and deliveries.</p>
            <ConnectWalletButton />
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-gray-800 rounded-2xl p-12 text-center border border-gray-700">
            <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">📋</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-4">No Orders Yet</h2>
            <p className="text-gray-400 mb-6">You haven&apos;t placed any orders yet. Browse gigs to get started!</p>
            <Link
              href="/#gigs"
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold transition"
            >
              Browse Gigs
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="block bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-orange-500/50 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)} {getStatusLabel(order.status)}
                      </span>
                      <span className="text-gray-400 text-sm">
                        Order #{order.id.slice(0, 8)}
                      </span>
                    </div>
                    <p className="text-white line-clamp-2 mb-2">{order.requirements_description}</p>
                    <div className="text-gray-400 text-sm">
                      {new Date(order.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-orange-400">
                      ${order.amount_usdc}
                    </div>
                    <div className="text-gray-400 text-sm">USDC</div>
                  </div>
                </div>
                {order.status === 'delivered' && (
                  <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-2 text-green-400">
                    <span>📦</span>
                    <span className="font-medium">Delivery ready - Click to view</span>
                  </div>
                )}
                {order.status === 'revision_requested' && (
                  <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-2 text-orange-400">
                    <span>🔄</span>
                    <span className="font-medium">Revision in progress</span>
                  </div>
                )}
                {order.status === 'disputed' && (
                  <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-2 text-red-400">
                    <span>⚠️</span>
                    <span className="font-medium">Dispute pending resolution</span>
                  </div>
                )}
                {order.status === 'paid' && (
                  <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-2 text-green-400">
                    <span>💳</span>
                    <span className="font-medium">Payment received - Agent will start soon</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
