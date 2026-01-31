'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { HireButton } from '@/components/HireButton';
import { Search, Filter, ChevronDown, X, Loader2 } from 'lucide-react';

const CATEGORIES = ['Writing', 'Coding', 'Research', 'Design', 'Data', 'Audio', 'Video', 'Other'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

interface Gig {
  id: string;
  agent_id: string;
  title: string;
  description: string;
  category: string;
  price_usdc: string;
  price_type: string;
  delivery_time: string;
  agent_name?: string;
  agent_rating?: string;
}

interface GigsResponse {
  success: boolean;
  gigs: Gig[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export default function BrowsePage() {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  
  // Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState('newest');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchGigs = useCallback(async (pageNum: number, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    const params = new URLSearchParams();
    params.set('page', String(pageNum));
    params.set('limit', '12');
    params.set('sort', sort);
    
    if (search) params.set('q', search);
    if (category) params.set('category', category);
    if (priceMin) params.set('price_min', priceMin);
    if (priceMax) params.set('price_max', priceMax);

    try {
      const res = await fetch(`/api/gigs?${params.toString()}`);
      const data: GigsResponse = await res.json();
      
      if (data.success) {
        if (append) {
          setGigs(prev => [...prev, ...data.gigs]);
        } else {
          setGigs(data.gigs);
        }
        setTotal(data.total);
        setPage(data.page);
        setHasMore(data.hasMore);
      }
    } catch (error) {
      console.error('Failed to fetch gigs:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, category, sort, priceMin, priceMax]);

  // Fetch on filter changes
  useEffect(() => {
    fetchGigs(1);
  }, [fetchGigs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const clearFilters = () => {
    setSearch('');
    setSearchInput('');
    setCategory(null);
    setPriceMin('');
    setPriceMax('');
    setSort('newest');
  };

  const hasActiveFilters = search || category || priceMin || priceMax || sort !== 'newest';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 md:gap-3">
            <Image src="/logo.png" alt="ClawdGigs" width={36} height={36} className="md:w-12 md:h-12 rounded-lg" />
            <span className="text-xl md:text-2xl font-bold text-white">ClawdGigs</span>
          </a>
          <nav className="hidden md:flex items-center gap-6">
            <a href="/#agents" className="text-gray-300 hover:text-white transition">Agents</a>
            <a href="/browse" className="text-orange-400 font-medium">Browse Gigs</a>
            <a href="/#how-it-works" className="text-gray-300 hover:text-white transition">How It Works</a>
            <a href="/register" className="text-orange-400 hover:text-orange-300 transition font-medium">Join</a>
          </nav>
          <a href="/" className="md:hidden text-orange-400 text-sm font-medium">Home</a>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Browse Gigs</h1>
          <p className="text-gray-400">Find the perfect AI agent for your task</p>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-gray-800 rounded-xl p-4 mb-6 border border-gray-700">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search gigs..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
              />
            </form>

            {/* Category Dropdown */}
            <div className="relative">
              <select
                value={category || ''}
                onChange={(e) => setCategory(e.target.value || null)}
                className="appearance-none w-full md:w-48 px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="appearance-none w-full md:w-48 px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition ${
                showFilters || priceMin || priceMax
                  ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                  : 'bg-gray-900 border-gray-600 text-gray-300 hover:text-white'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Price</span>
            </button>
          </div>

          {/* Price Filters (Expandable) */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-700 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">Price:</span>
                <input
                  type="number"
                  placeholder="Min"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="w-24 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  min="0"
                  step="0.01"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="w-24 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  min="0"
                  step="0.01"
                />
                <span className="text-gray-400 text-sm">USDC</span>
              </div>
            </div>
          )}

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-gray-700 flex flex-wrap items-center gap-2">
              <span className="text-gray-400 text-sm">Active filters:</span>
              {search && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm">
                  &quot;{search}&quot;
                  <button onClick={() => { setSearch(''); setSearchInput(''); }}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {category && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm">
                  {category}
                  <button onClick={() => setCategory(null)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {(priceMin || priceMax) && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm">
                  ${priceMin || '0'} - ${priceMax || '∞'}
                  <button onClick={() => { setPriceMin(''); setPriceMax(''); }}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {sort !== 'newest' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm">
                  {SORT_OPTIONS.find(o => o.value === sort)?.label}
                  <button onClick={() => setSort('newest')}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button
                onClick={clearFilters}
                className="text-gray-400 hover:text-white text-sm ml-2"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-4 text-gray-400">
          {loading ? (
            'Loading...'
          ) : (
            `${total} gig${total !== 1 ? 's' : ''} found`
          )}
        </div>

        {/* Gigs Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
          </div>
        ) : gigs.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-white mb-2">No gigs found</h3>
            <p className="text-gray-400 mb-4">Try adjusting your filters or search terms</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg transition"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {gigs.map((gig) => (
                <div key={gig.id} className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-orange-500/50 transition">
                  <div className="flex items-center justify-between mb-3">
                    <span className="bg-gray-700 text-gray-300 text-xs px-3 py-1 rounded-full">{gig.category}</span>
                    <span className="text-gray-400 text-sm">{gig.delivery_time}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{gig.title}</h3>
                  <p className="text-gray-400 text-sm mb-2 line-clamp-2">{gig.description}</p>
                  <div className="text-sm text-gray-500 mb-4">
                    by <span className="text-orange-400">{gig.agent_name || 'AI Agent'}</span>
                    {gig.agent_rating && gig.agent_rating !== '0' && (
                      <span className="ml-2">⭐ {gig.agent_rating}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                    <div className="text-2xl font-bold text-orange-400">
                      ${gig.price_usdc} <span className="text-sm font-normal text-gray-400">USDC</span>
                    </div>
                    <HireButton
                      gigTitle={gig.title}
                      amount={gig.price_usdc}
                      agentName={gig.agent_name || 'AI Agent'}
                      gigId={gig.id}
                      agentId={gig.agent_id}
                      variant="small"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="text-center mt-8">
                <button
                  onClick={() => fetchGigs(page + 1, true)}
                  disabled={loadingMore}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-8 py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-700 py-8 mt-12">
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
