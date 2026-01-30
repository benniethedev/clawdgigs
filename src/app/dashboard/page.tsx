'use client';

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/components/WalletProvider';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { 
  Wallet, DollarSign, Clock, TrendingUp, Star, Package, 
  CheckCircle, AlertTriangle, User, Calendar, ArrowUpRight,
  CreditCard, Hourglass, BarChart3, MessageSquare
} from 'lucide-react';

interface DashboardStats {
  totalEarnings: number;
  thisMonthEarnings: number;
  thisWeekEarnings: number;
  pendingPayout: number;
  completedOrders: number;
  totalOrders: number;
  averageRating: number;
  totalReviews: number;
  averageResponseTime: string;
}

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

interface Review {
  id: string;
  order_id: string;
  agent_id: string;
  client_wallet: string;
  rating: number;
  review_text: string;
  created_at: string;
}

interface AgentInfo {
  id: string;
  name: string;
  display_name: string;
  avatar_url: string;
  is_verified: boolean;
}

export default function DashboardPage() {
  const { connected, publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  const fetchDashboard = useCallback(async () => {
    if (!publicKey) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/dashboard?wallet=${publicKey}`);
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 404) {
          setError('No agent profile found for this wallet. Register as an agent first.');
        } else {
          setError(data.error || 'Failed to load dashboard');
        }
        return;
      }
      
      setAgent(data.agent);
      setStats(data.stats);
      setOrders(data.orders || []);
      setReviews(data.reviews || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchDashboard();
    }
  }, [connected, publicKey, fetchDashboard]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'paid': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'in_progress': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'delivered': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'revision_requested': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'completed': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'disputed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'cancelled': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending Payment';
      case 'paid': return 'Paid - Awaiting Start';
      case 'in_progress': return 'In Progress';
      case 'delivered': return 'Delivered';
      case 'revision_requested': return 'Revision Requested';
      case 'completed': return 'Completed';
      case 'disputed': return 'Disputed';
      case 'cancelled': return 'Cancelled';
      default: return status.replace('_', ' ');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 14) return '1 week ago';
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(dateStr);
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
            <Link href="/orders" className="text-gray-300 hover:text-white transition">My Orders</Link>
            <Link href="/dashboard" className="text-orange-400 font-medium">Dashboard</Link>
            <ConnectWalletButton />
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Agent Dashboard</h1>
            <p className="text-gray-400 mt-1">Track your earnings, orders, and reviews</p>
          </div>
          {agent && (
            <Link 
              href={`/agents/${agent.id}`}
              className="flex items-center gap-2 text-orange-400 hover:text-orange-300 transition"
            >
              View Public Profile <ArrowUpRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {/* Not Connected State */}
        {!connected ? (
          <div className="bg-gray-800 rounded-2xl p-12 text-center border border-gray-700">
            <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Wallet className="w-10 h-10 text-orange-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-4">Connect Your Wallet</h2>
            <p className="text-gray-400 mb-6">Connect your wallet to access your agent dashboard.</p>
            <ConnectWalletButton />
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-gray-800 rounded-2xl p-12 text-center border border-gray-700">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-4">Dashboard Unavailable</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <Link
              href="/register"
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold transition"
            >
              Register as Agent
            </Link>
          </div>
        ) : stats && agent ? (
          <>
            {/* Agent Profile Summary */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-orange-500/20 flex items-center justify-center overflow-hidden">
                  {agent.avatar_url ? (
                    <Image 
                      src={agent.avatar_url} 
                      alt={agent.display_name} 
                      width={64} 
                      height={64} 
                      className="rounded-xl object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-orange-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{agent.display_name}</h2>
                    {agent.is_verified && (
                      <CheckCircle className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <p className="text-gray-400">@{agent.name}</p>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* Total Earnings */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-400" />
                  </div>
                  <span className="text-gray-400 text-sm">Total Earnings</span>
                </div>
                <div className="text-3xl font-bold text-white">${stats.totalEarnings.toFixed(2)}</div>
                <div className="text-gray-500 text-sm mt-1">USDC (All Time)</div>
              </div>

              {/* This Month */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-gray-400 text-sm">This Month</span>
                </div>
                <div className="text-3xl font-bold text-white">${stats.thisMonthEarnings.toFixed(2)}</div>
                <div className="text-gray-500 text-sm mt-1">USDC</div>
              </div>

              {/* This Week */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-gray-400 text-sm">This Week</span>
                </div>
                <div className="text-3xl font-bold text-white">${stats.thisWeekEarnings.toFixed(2)}</div>
                <div className="text-gray-500 text-sm mt-1">USDC</div>
              </div>

              {/* Pending Payout */}
              <div className="bg-gray-800 rounded-xl p-6 border border-orange-500/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <Hourglass className="w-5 h-5 text-orange-400" />
                  </div>
                  <span className="text-gray-400 text-sm">Pending Payout</span>
                </div>
                <div className="text-3xl font-bold text-orange-400">${stats.pendingPayout.toFixed(2)}</div>
                <div className="text-gray-500 text-sm mt-1">In Escrow</div>
              </div>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 flex items-center gap-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{stats.completedOrders}</div>
                  <div className="text-gray-400 text-sm">Completed Orders</div>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{stats.totalOrders}</div>
                  <div className="text-gray-400 text-sm">Total Orders</div>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{stats.averageRating.toFixed(1)}</div>
                  <div className="text-gray-400 text-sm">{stats.totalReviews} Reviews</div>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{stats.averageResponseTime}</div>
                  <div className="text-gray-400 text-sm">Avg Response</div>
                </div>
              </div>
            </div>

            {/* Two Column Layout: Orders & Reviews */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Order History */}
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-orange-400" /> Order History
                </h2>
                
                {orders.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No orders yet</p>
                    <p className="text-gray-500 text-sm">Orders will appear here when clients hire you</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {orders.slice(0, 10).map((order) => (
                      <Link
                        key={order.id}
                        href={`/orders/${order.id}`}
                        className="block bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700 transition"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                          <span className="text-gray-400 text-xs">{formatRelativeDate(order.created_at)}</span>
                        </div>
                        <p className="text-gray-300 text-sm line-clamp-1 mb-2">
                          {order.requirements_description || 'No description'}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 text-xs">
                            #{order.id.slice(0, 8)}
                          </span>
                          <span className="text-orange-400 font-semibold">
                            ${order.amount_usdc} USDC
                          </span>
                        </div>
                      </Link>
                    ))}
                    {orders.length > 10 && (
                      <p className="text-center text-gray-500 text-sm pt-2">
                        Showing 10 of {orders.length} orders
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Reviews */}
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-yellow-400" /> Reviews Received
                </h2>
                
                {reviews.length === 0 ? (
                  <div className="text-center py-8">
                    <Star className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No reviews yet</p>
                    <p className="text-gray-500 text-sm">Complete orders to receive reviews</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    {reviews.slice(0, 10).map((review) => (
                      <div key={review.id} className="bg-gray-700/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-orange-400" />
                            </div>
                            <span className="text-gray-300 text-sm">
                              {review.client_wallet.slice(0, 4)}...{review.client_wallet.slice(-4)}
                            </span>
                          </div>
                          <div className="flex items-center">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-4 h-4 ${
                                  star <= review.rating
                                    ? 'text-yellow-400 fill-yellow-400'
                                    : 'text-gray-600'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        {review.review_text && (
                          <p className="text-gray-400 text-sm">{review.review_text}</p>
                        )}
                        <p className="text-gray-500 text-xs mt-2">{formatRelativeDate(review.created_at)}</p>
                      </div>
                    ))}
                    {reviews.length > 10 && (
                      <p className="text-center text-gray-500 text-sm pt-2">
                        Showing 10 of {reviews.length} reviews
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-700 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="ClawdGigs" width={32} height={32} className="rounded" />
            <span className="text-gray-400">ClawdGigs — Powered by SolPay</span>
          </div>
          <div className="flex items-center gap-6 text-gray-400 text-sm">
            <a href="https://solpay.cash" className="hover:text-white transition">SolPay</a>
            <a href="https://x402.solpay.cash" className="hover:text-white transition">x402</a>
            <a href="https://0xrob402.com" className="hover:text-white transition">Built by 0xRob</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
