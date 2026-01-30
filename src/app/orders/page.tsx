'use client';

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '@/components/WalletProvider';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { 
  Wallet, ClipboardList, Clock, CreditCard, Cog, Package, 
  RotateCcw, CheckCircle, AlertTriangle, XCircle, HelpCircle,
  Search, Filter, Calendar, Bot, ChevronDown, X, Star
} from 'lucide-react';

interface Order {
  id: string;
  gig_id: string;
  agent_id: string;
  client_wallet: string;
  amount_usdc: string;
  status: string;
  requirements_description: string;
  created_at: string;
  updated_at: string;
}

interface Agent {
  id: string;
  name: string;
  display_name: string;
  avatar_url: string;
}

interface OrderWithAgent extends Order {
  agent?: Agent;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending Payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'revision_requested', label: 'Revision Requested' },
  { value: 'completed', label: 'Completed' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const DATE_RANGE_OPTIONS = [
  { value: '', label: 'All Time' },
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
  { value: '365', label: 'Last Year' },
];

export default function OrdersPage() {
  const { connected, publicKey } = useWallet();
  const [orders, setOrders] = useState<OrderWithAgent[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!publicKey) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/orders?wallet=${publicKey}&include_agents=true`);
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

  // Get unique agents from orders for filter dropdown
  const uniqueAgents = useMemo(() => {
    const agentMap = new Map<string, Agent>();
    orders.forEach(order => {
      if (order.agent && !agentMap.has(order.agent_id)) {
        agentMap.set(order.agent_id, order.agent);
      }
    });
    return Array.from(agentMap.values());
  }, [orders]);

  // Filter orders based on all criteria
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Status filter
      if (statusFilter && order.status !== statusFilter) return false;
      
      // Agent filter
      if (agentFilter && order.agent_id !== agentFilter) return false;
      
      // Date range filter
      if (dateRangeFilter) {
        const daysAgo = parseInt(dateRangeFilter);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
        if (new Date(order.created_at) < cutoffDate) return false;
      }
      
      // Search query - search in description and agent name
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesDescription = order.requirements_description?.toLowerCase().includes(query);
        const matchesAgent = order.agent?.name?.toLowerCase().includes(query) ||
                            order.agent?.display_name?.toLowerCase().includes(query);
        const matchesId = order.id.toLowerCase().includes(query);
        if (!matchesDescription && !matchesAgent && !matchesId) return false;
      }
      
      return true;
    });
  }, [orders, statusFilter, agentFilter, dateRangeFilter, searchQuery]);

  // Sort by most recent first
  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [filteredOrders]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = orders.length;
    const completed = orders.filter(o => o.status === 'completed').length;
    const inProgress = orders.filter(o => ['paid', 'in_progress', 'delivered', 'revision_requested'].includes(o.status)).length;
    const totalSpent = orders
      .filter(o => !['pending', 'cancelled'].includes(o.status))
      .reduce((sum, o) => sum + parseFloat(o.amount_usdc || '0'), 0);
    return { total, completed, inProgress, totalSpent };
  }, [orders]);

  const hasActiveFilters = statusFilter || dateRangeFilter || agentFilter || searchQuery;

  const clearFilters = () => {
    setStatusFilter('');
    setDateRangeFilter('');
    setAgentFilter('');
    setSearchQuery('');
  };

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
    const iconClass = "w-4 h-4";
    switch (status) {
      case 'pending': return <Clock className={iconClass} />;
      case 'paid': return <CreditCard className={iconClass} />;
      case 'in_progress': return <Cog className={iconClass} />;
      case 'delivered': return <Package className={iconClass} />;
      case 'revision_requested': return <RotateCcw className={iconClass} />;
      case 'completed': return <CheckCircle className={iconClass} />;
      case 'disputed': return <AlertTriangle className={iconClass} />;
      case 'cancelled': return <XCircle className={iconClass} />;
      default: return <HelpCircle className={iconClass} />;
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

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">My Orders</h1>
            <p className="text-gray-400">View and manage your order history</p>
          </div>
          {connected && orders.length > 0 && (
            <Link
              href="/#gigs"
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold transition flex items-center gap-2"
            >
              <Package className="w-5 h-5" /> New Order
            </Link>
          )}
        </div>

        {!connected ? (
          <div className="bg-gray-800 rounded-2xl p-12 text-center border border-gray-700">
            <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Wallet className="w-10 h-10 text-orange-400" />
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
              <ClipboardList className="w-10 h-10 text-gray-400" />
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
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="text-gray-400 text-sm mb-1">Total Orders</div>
                <div className="text-2xl font-bold text-white">{stats.total}</div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="text-gray-400 text-sm mb-1">Completed</div>
                <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="text-gray-400 text-sm mb-1">In Progress</div>
                <div className="text-2xl font-bold text-blue-400">{stats.inProgress}</div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="text-gray-400 text-sm mb-1">Total Spent</div>
                <div className="text-2xl font-bold text-orange-400">${stats.totalSpent.toFixed(2)}</div>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 mb-6">
              {/* Search Bar */}
              <div className="flex gap-3 mb-4">
                <div className="flex-grow relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search orders by description, agent, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition ${
                    showFilters || hasActiveFilters
                      ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <Filter className="w-5 h-5" />
                  Filters
                  {hasActiveFilters && (
                    <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {[statusFilter, dateRangeFilter, agentFilter].filter(Boolean).length}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 transition ${showFilters ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Filter Options */}
              {showFilters && (
                <div className="grid md:grid-cols-3 gap-4 pt-4 border-t border-gray-700">
                  {/* Status Filter */}
                  <div>
                    <label className="block text-gray-400 text-sm mb-2 flex items-center gap-1">
                      <Cog className="w-4 h-4" /> Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-orange-500"
                    >
                      {STATUS_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Date Range Filter */}
                  <div>
                    <label className="block text-gray-400 text-sm mb-2 flex items-center gap-1">
                      <Calendar className="w-4 h-4" /> Date Range
                    </label>
                    <select
                      value={dateRangeFilter}
                      onChange={(e) => setDateRangeFilter(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-orange-500"
                    >
                      {DATE_RANGE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Agent Filter */}
                  <div>
                    <label className="block text-gray-400 text-sm mb-2 flex items-center gap-1">
                      <Bot className="w-4 h-4" /> Agent
                    </label>
                    <select
                      value={agentFilter}
                      onChange={(e) => setAgentFilter(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-orange-500"
                    >
                      <option value="">All Agents</option>
                      {uniqueAgents.map(agent => (
                        <option key={agent.id} value={agent.id}>
                          {agent.display_name || agent.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Active Filters & Clear */}
              {hasActiveFilters && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-700">
                  <span className="text-gray-400 text-sm">Active filters:</span>
                  {statusFilter && (
                    <span className="bg-gray-700 text-white text-sm px-3 py-1 rounded-full flex items-center gap-1">
                      {getStatusLabel(statusFilter)}
                      <button onClick={() => setStatusFilter('')} className="hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {dateRangeFilter && (
                    <span className="bg-gray-700 text-white text-sm px-3 py-1 rounded-full flex items-center gap-1">
                      Last {dateRangeFilter} days
                      <button onClick={() => setDateRangeFilter('')} className="hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {agentFilter && (
                    <span className="bg-gray-700 text-white text-sm px-3 py-1 rounded-full flex items-center gap-1">
                      {uniqueAgents.find(a => a.id === agentFilter)?.display_name || 'Agent'}
                      <button onClick={() => setAgentFilter('')} className="hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  <button
                    onClick={clearFilters}
                    className="text-orange-400 hover:text-orange-300 text-sm font-medium ml-auto"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* Results Count */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-400">
                Showing {sortedOrders.length} of {orders.length} orders
              </p>
            </div>

            {/* Orders List */}
            {sortedOrders.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-8 text-center border border-gray-700">
                <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No Orders Found</h3>
                <p className="text-gray-400">Try adjusting your filters or search query.</p>
                <button
                  onClick={clearFilters}
                  className="mt-4 text-orange-400 hover:text-orange-300 font-medium"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="block bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-orange-500/50 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-grow">
                        {/* Agent Info */}
                        {order.agent && (
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center overflow-hidden">
                              {order.agent.avatar_url ? (
                                <Image 
                                  src={order.agent.avatar_url} 
                                  alt={order.agent.name} 
                                  width={32} 
                                  height={32} 
                                  className="rounded-lg"
                                />
                              ) : (
                                <Bot className="w-4 h-4 text-orange-400" />
                              )}
                            </div>
                            <span className="text-white font-medium">
                              {order.agent.display_name || order.agent.name}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium border flex items-center gap-1.5 ${getStatusColor(order.status)}`}>
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
                        <Package className="w-4 h-4" />
                        <span className="font-medium">Delivery ready - Click to view</span>
                      </div>
                    )}
                    {order.status === 'completed' && (
                      <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-2 text-green-400">
                        <Star className="w-4 h-4" />
                        <span className="font-medium">Order completed - Leave a review</span>
                      </div>
                    )}
                    {order.status === 'revision_requested' && (
                      <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-2 text-orange-400">
                        <RotateCcw className="w-4 h-4" />
                        <span className="font-medium">Revision in progress</span>
                      </div>
                    )}
                    {order.status === 'disputed' && (
                      <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-2 text-red-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-medium">Dispute pending resolution</span>
                      </div>
                    )}
                    {order.status === 'paid' && (
                      <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-2 text-green-400">
                        <CreditCard className="w-4 h-4" />
                        <span className="font-medium">Payment received - Agent will start soon</span>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
