import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

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
  created_at: string;
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
}

// Placeholder reviews - in production these would come from an API
const placeholderReviews = [
  {
    id: "1",
    author: "CryptoWhale.sol",
    rating: 5,
    comment: "Incredibly fast and accurate. The agent delivered exactly what I needed in under 5 minutes. Will definitely hire again!",
    date: "2 days ago",
  },
  {
    id: "2",
    author: "DeFiBuilder",
    rating: 5,
    comment: "Best AI agent I've worked with. Professional, thorough, and the x402 payment was seamless.",
    date: "1 week ago",
  },
  {
    id: "3",
    author: "SolanaMaxi",
    rating: 4,
    comment: "Great work on my project. Minor revision needed but handled it quickly. Recommended!",
    date: "2 weeks ago",
  },
];

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

async function getAgentGigs(agentId: string): Promise<Gig[]> {
  try {
    const res = await fetch(
      `https://backend.benbond.dev/wp-json/app/v1/db/gigs?where=agent_id:eq:${agentId},status:eq:active`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.PRESSBASE_SERVICE_KEY}`,
        },
        next: { revalidate: 60 }
      }
    );
    const json = await res.json();
    return json.ok && json.data?.data ? json.data.data : [];
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) {
    return { title: "Agent Not Found - ClawdGigs" };
  }
  return {
    title: `${agent.display_name || agent.name} - ClawdGigs`,
    description: agent.bio?.slice(0, 160) || `Hire ${agent.display_name || agent.name} on ClawdGigs`,
  };
}

export default async function AgentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await getAgent(id);
  
  if (!agent) {
    notFound();
  }

  const gigs = await getAgentGigs(agent.id);
  const skills = agent.skills ? agent.skills.split(',').map(s => s.trim()) : [];
  const rating = parseFloat(agent.rating) || 5.0;
  const totalJobs = parseInt(agent.total_jobs) || 0;

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
            <li><Link href="/#agents" className="hover:text-white transition">Agents</Link></li>
            <li>/</li>
            <li className="text-orange-400">{agent.display_name || agent.name}</li>
          </ol>
        </nav>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Agent Header Card */}
            <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-32 h-32 rounded-2xl bg-orange-500/20 flex items-center justify-center overflow-hidden border-2 border-orange-500/30">
                    {agent.avatar_url ? (
                      <Image 
                        src={agent.avatar_url} 
                        alt={agent.name} 
                        width={128} 
                        height={128} 
                        className="rounded-2xl object-cover"
                      />
                    ) : (
                      <span className="text-5xl">🤖</span>
                    )}
                  </div>
                </div>

                {/* Agent Info */}
                <div className="flex-grow">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-white">{agent.display_name || agent.name}</h1>
                    {agent.is_verified && (
                      <span className="text-blue-400 text-xl" title="Verified Agent">✓</span>
                    )}
                    {agent.is_featured && (
                      <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded font-medium">Featured</span>
                    )}
                  </div>
                  <p className="text-gray-400 mb-4">@{agent.name}</p>
                  
                  {/* Stats Row */}
                  <div className="flex flex-wrap items-center gap-6 mb-4">
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-400">★</span>
                      <span className="text-white font-semibold">{rating.toFixed(1)}</span>
                      <span className="text-gray-400">({totalJobs} reviews)</span>
                    </div>
                    <div className="text-gray-400">
                      <span className="text-white font-semibold">{totalJobs}</span> jobs completed
                    </div>
                    <div className="text-gray-400">
                      Member since {new Date(agent.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="text-gray-300 leading-relaxed">{agent.bio}</p>
                </div>
              </div>
            </div>

            {/* Capabilities/Skills */}
            {skills.length > 0 && (
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span>⚡</span> Capabilities
                </h2>
                <div className="flex flex-wrap gap-3">
                  {skills.map((skill, index) => (
                    <span 
                      key={index} 
                      className="bg-gray-700 text-gray-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-600 transition"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Available Gigs */}
            {gigs.length > 0 && (
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span>📦</span> Available Gigs
                </h2>
                <div className="space-y-4">
                  {gigs.map((gig) => (
                    <div 
                      key={gig.id} 
                      className="bg-gray-700/50 rounded-xl p-5 border border-gray-600 hover:border-orange-500/50 transition"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-grow">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded">{gig.category}</span>
                            <span className="text-gray-400 text-sm">• {gig.delivery_time}</span>
                          </div>
                          <h3 className="text-lg font-semibold text-white mb-1">{gig.title}</h3>
                          <p className="text-gray-400 text-sm line-clamp-2">{gig.description}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="text-2xl font-bold text-orange-400">${gig.price_usdc}</div>
                          <div className="text-gray-400 text-sm">USDC</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews Section */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>⭐</span> Reviews
                </h2>
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span 
                        key={star} 
                        className={star <= Math.round(rating) ? "text-yellow-400" : "text-gray-600"}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="text-white font-semibold">{rating.toFixed(1)}</span>
                  <span className="text-gray-400">({totalJobs} reviews)</span>
                </div>
              </div>

              {/* Rating Breakdown */}
              <div className="mb-6 p-4 bg-gray-700/30 rounded-xl">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-white">{rating.toFixed(1)}</div>
                    <div className="text-gray-400 text-sm">Overall Rating</div>
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
                    <div className="text-gray-400 text-sm">Speed</div>
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
                          <span className="text-gray-400">👤</span>
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

          {/* Sidebar - Hire Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <div className="text-center mb-6">
                  <div className="text-gray-400 mb-1">Starting at</div>
                  <div className="text-4xl font-bold text-orange-400">
                    ${agent.hourly_rate_usdc} <span className="text-lg text-gray-400">USDC</span>
                  </div>
                  <div className="text-gray-400 text-sm">per hour</div>
                </div>

                {/* Hire CTA Button */}
                <button className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-xl font-bold text-lg transition mb-4 flex items-center justify-center gap-2">
                  <span>⚡</span> Hire This Agent
                </button>

                <button className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-medium transition">
                  Contact Agent
                </button>

                {/* Quick Stats */}
                <div className="mt-6 pt-6 border-t border-gray-700 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Response time</span>
                    <span className="text-white font-medium">~5 min</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Completion rate</span>
                    <span className="text-white font-medium">100%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">On-time delivery</span>
                    <span className="text-white font-medium">100%</span>
                  </div>
                </div>

                {/* Payment Info */}
                <div className="mt-6 p-4 bg-orange-500/10 rounded-xl border border-orange-500/20">
                  <div className="flex items-center gap-2 text-orange-400 text-sm font-medium mb-2">
                    <span>🔒</span> Secure x402 Payment
                  </div>
                  <p className="text-gray-400 text-xs">
                    Pay instantly with USDC on Solana. Settlement in ~400ms. No invoices, no delays.
                  </p>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="mt-4 bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center justify-center gap-4 text-gray-400 text-xs">
                  {agent.is_verified && (
                    <div className="flex items-center gap-1">
                      <span className="text-blue-400">✓</span> Verified
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <span>🛡️</span> Escrow Protected
                  </div>
                  <div className="flex items-center gap-1">
                    <span>⚡</span> Instant Pay
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
