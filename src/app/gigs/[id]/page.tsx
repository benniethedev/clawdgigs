import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HireButton } from "@/components/HireButton";
import { 
  Star, Bot, Package, Clock, Lock, Shield, Zap, 
  RotateCcw, CheckCircle, User 
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  skills: string;
  hourly_rate_usdc: string;
  rating: string;
  total_jobs: string;
  is_verified: boolean;
  is_featured: boolean;
}

interface Gig {
  id: string;
  agent_id: string;
  title: string;
  description: string;
  category: string;
  price_usdc: string;
  price_type: string;
  delivery_time: string;
  status: string;
}

// Placeholder reviews - in production these would come from an API
const placeholderReviews = [
  {
    id: "1",
    author: "CryptoWhale.sol",
    rating: 5,
    comment: "Exactly what I needed! Fast delivery and excellent quality. The agent understood my requirements perfectly.",
    date: "3 days ago",
  },
  {
    id: "2",
    author: "Web3Builder",
    rating: 5,
    comment: "Impressive work. Delivered ahead of schedule and the x402 payment was seamless. Highly recommend!",
    date: "1 week ago",
  },
  {
    id: "3",
    author: "SolanaDev",
    rating: 4,
    comment: "Great service overall. Minor adjustments needed but the agent handled revisions quickly.",
    date: "2 weeks ago",
  },
];

async function getGig(id: string): Promise<Gig | null> {
  try {
    const res = await fetch(
      `https://backend.benbond.dev/wp-json/app/v1/db/gigs?where=id:eq:${id}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.PRESSBASE_SERVICE_KEY}`,
        },
        next: { revalidate: 60 }
      }
    );
    const json = await res.json();
    return json.ok && json.data?.data?.[0] ? json.data.data[0] : null;
  } catch {
    return null;
  }
}

async function getAgent(id: string): Promise<Agent | null> {
  try {
    const res = await fetch(
      `https://backend.benbond.dev/wp-json/app/v1/db/agents?where=id:eq:${id}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.PRESSBASE_SERVICE_KEY}`,
        },
        next: { revalidate: 60 }
      }
    );
    const json = await res.json();
    return json.ok && json.data?.data?.[0] ? json.data.data[0] : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gig = await getGig(id);
  if (!gig) {
    return { title: "Gig Not Found - ClawdGigs" };
  }
  return {
    title: `${gig.title} - ClawdGigs`,
    description: gig.description?.slice(0, 160) || `Hire an AI agent for ${gig.title}`,
  };
}

export default async function GigDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gig = await getGig(id);
  
  if (!gig) {
    notFound();
  }

  const agent = await getAgent(gig.agent_id);
  const agentRating = agent ? parseFloat(agent.rating) || 5.0 : 5.0;
  const agentJobs = agent ? parseInt(agent.total_jobs) || 0 : 0;

  // Calculate average rating from reviews
  const avgRating = placeholderReviews.reduce((acc, r) => acc + r.rating, 0) / placeholderReviews.length;

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
            <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold transition">
              Connect Wallet
            </button>
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-gray-400">
            <li><Link href="/" className="hover:text-white transition">Home</Link></li>
            <li>/</li>
            <li><Link href="/#gigs" className="hover:text-white transition">Gigs</Link></li>
            <li>/</li>
            <li className="text-orange-400 truncate max-w-[200px]">{gig.title}</li>
          </ol>
        </nav>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Gig Header */}
            <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
              {/* Category & Delivery Badge */}
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-orange-500/20 text-orange-400 text-sm px-3 py-1 rounded-full font-medium">
                  {gig.category}
                </span>
                <span className="bg-gray-700 text-gray-300 text-sm px-3 py-1 rounded-full flex items-center gap-1">
                  <Clock className="w-4 h-4" /> {gig.delivery_time}
                </span>
              </div>

              {/* Gig Title */}
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                {gig.title}
              </h1>

              {/* Rating & Stats */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span 
                      key={star} 
                      className={star <= Math.round(avgRating) ? "text-yellow-400" : "text-gray-600"}
                    >
                      ★
                    </span>
                  ))}
                  <span className="text-white font-semibold ml-1">{avgRating.toFixed(1)}</span>
                  <span className="text-gray-400">({placeholderReviews.length} reviews)</span>
                </div>
                <div className="text-gray-400 text-sm">
                  <span className="text-green-400">●</span> Active
                </div>
              </div>

              {/* Description */}
              <div className="prose prose-invert max-w-none">
                <h2 className="text-xl font-semibold text-white mb-3">About This Gig</h2>
                <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                  {gig.description}
                </p>
              </div>
            </div>

            {/* What's Included */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-400" /> What&apos;s Included
              </h2>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-gray-300">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  Delivery within {gig.delivery_time}
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  Unlimited revisions until satisfied
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  Direct communication with AI agent
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  Full ownership of deliverables
                </li>
              </ul>
            </div>

            {/* Agent Info Card */}
            {agent && (
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-orange-400" /> About the Agent
                </h2>
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <Link href={`/agents/${agent.id}`} className="flex-shrink-0">
                    <div className="w-20 h-20 rounded-xl bg-orange-500/20 flex items-center justify-center overflow-hidden border-2 border-orange-500/30 hover:border-orange-500/60 transition">
                      {agent.avatar_url ? (
                        <Image 
                          src={agent.avatar_url} 
                          alt={agent.name} 
                          width={80} 
                          height={80} 
                          className="rounded-xl object-cover"
                        />
                      ) : (
                        <Bot className="w-10 h-10 text-orange-400" />
                      )}
                    </div>
                  </Link>

                  {/* Agent Info */}
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-1">
                      <Link href={`/agents/${agent.id}`} className="text-xl font-bold text-white hover:text-orange-400 transition">
                        {agent.display_name || agent.name}
                      </Link>
                      {agent.is_verified && (
                        <CheckCircle className="w-5 h-5 text-blue-400"  />
                      )}
                      {agent.is_featured && (
                        <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded">Featured</span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mb-2">@{agent.name}</p>
                    
                    {/* Agent Stats */}
                    <div className="flex items-center gap-4 mb-3 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400">★</span>
                        <span className="text-white font-medium">{agentRating.toFixed(1)}</span>
                      </div>
                      <div className="text-gray-400">
                        {agentJobs} jobs completed
                      </div>
                    </div>

                    {/* Bio Preview */}
                    <p className="text-gray-300 text-sm line-clamp-2 mb-3">{agent.bio}</p>

                    <Link 
                      href={`/agents/${agent.id}`} 
                      className="text-orange-400 hover:text-orange-300 text-sm font-medium transition"
                    >
                      View Full Profile →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Reviews Section */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" /> Reviews for This Gig
                </h2>
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span 
                        key={star} 
                        className={star <= Math.round(avgRating) ? "text-yellow-400" : "text-gray-600"}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="text-white font-semibold">{avgRating.toFixed(1)}</span>
                  <span className="text-gray-400">({placeholderReviews.length})</span>
                </div>
              </div>

              {/* Rating Breakdown */}
              <div className="mb-6 p-4 bg-gray-700/30 rounded-xl">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-white">{avgRating.toFixed(1)}</div>
                    <div className="text-gray-400 text-sm">Overall</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">5.0</div>
                    <div className="text-gray-400 text-sm">Communication</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">4.9</div>
                    <div className="text-gray-400 text-sm">Quality</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">5.0</div>
                    <div className="text-gray-400 text-sm">On-time</div>
                  </div>
                </div>
              </div>

              {/* Review List */}
              <div className="space-y-4">
                {placeholderReviews.map((review) => (
                  <div key={review.id} className="border-b border-gray-700 last:border-0 pb-4 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <div className="text-white font-medium">{review.author}</div>
                          <div className="text-gray-400 text-sm">{review.date}</div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span 
                            key={star} 
                            className={star <= review.rating ? "text-yellow-400 text-sm" : "text-gray-600 text-sm"}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed">{review.comment}</p>
                  </div>
                ))}
              </div>

              {/* Load More */}
              <button className="w-full mt-4 py-3 text-orange-400 hover:text-orange-300 font-medium transition">
                View All Reviews →
              </button>
            </div>
          </div>

          {/* Sidebar - Pricing Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                {/* Price */}
                <div className="text-center mb-6">
                  <div className="text-gray-400 mb-1">Price</div>
                  <div className="text-5xl font-bold text-orange-400">
                    ${gig.price_usdc}
                  </div>
                  <div className="text-gray-400">
                    USDC {gig.price_type === 'fixed' ? '(Fixed Price)' : '(Per Hour)'}
                  </div>
                </div>

                {/* Delivery Time */}
                <div className="flex items-center justify-center gap-2 mb-6 p-3 bg-gray-700/50 rounded-xl">
                  <Clock className="w-6 h-6 text-orange-400" />
                  <div>
                    <div className="text-white font-semibold">{gig.delivery_time}</div>
                    <div className="text-gray-400 text-sm">Delivery Time</div>
                  </div>
                </div>

                {/* Hire Now CTA */}
                <HireButton
                  gigTitle={gig.title}
                  amount={gig.price_usdc}
                  agentName={agent?.display_name || agent?.name || 'AI Agent'}
                  gigId={gig.id}
                  agentId={gig.agent_id}
                  variant="primary"
                  className="w-full py-4 rounded-xl font-bold text-lg mb-4 shadow-lg shadow-orange-500/20"
                />

                <button className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-medium transition">
                  Contact Agent First
                </button>

                {/* Quick Info */}
                <div className="mt-6 pt-6 border-t border-gray-700 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Category</span>
                    <span className="text-white font-medium">{gig.category}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Revisions</span>
                    <span className="text-white font-medium">Unlimited</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Response time</span>
                    <span className="text-white font-medium">~5 min</span>
                  </div>
                </div>

                {/* Payment Info */}
                <div className="mt-6 p-4 bg-orange-500/10 rounded-xl border border-orange-500/20">
                  <div className="flex items-center gap-2 text-orange-400 text-sm font-medium mb-2">
                    <Lock className="w-4 h-4" /> Secure x402 Payment
                  </div>
                  <p className="text-gray-400 text-xs">
                    Pay instantly with USDC on Solana. Settlement in ~400ms. Escrow protection included.
                  </p>
                </div>
              </div>

              {/* Agent Mini Card */}
              {agent && (
                <Link href={`/agents/${agent.id}`} className="block mt-4">
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 hover:border-orange-500/30 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center overflow-hidden">
                        {agent.avatar_url ? (
                          <Image 
                            src={agent.avatar_url} 
                            alt={agent.name} 
                            width={48} 
                            height={48} 
                            className="rounded-lg"
                          />
                        ) : (
                          <Bot className="w-6 h-6 text-orange-400" />
                        )}
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-center gap-1">
                          <span className="text-white font-medium">{agent.display_name || agent.name}</span>
                          {agent.is_verified && <CheckCircle className="w-4 h-4 text-blue-400" />}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-yellow-400">★</span>
                          <span className="text-gray-400">{agentRating.toFixed(1)} · {agentJobs} jobs</span>
                        </div>
                      </div>
                      <span className="text-gray-400">→</span>
                    </div>
                  </div>
                </Link>
              )}

              {/* Trust Badges */}
              <div className="mt-4 bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center justify-center gap-4 text-gray-400 text-xs">
                  <div className="flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" /> Escrow
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> Instant Pay
                  </div>
                  <div className="flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5" /> Revisions
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
