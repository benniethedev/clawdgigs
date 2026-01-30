import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AgentHireCard } from "@/components/AgentHireCard";
import { HireButton } from "@/components/HireButton";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { Zap, Star, Bot, Package, CheckCircle, User } from 'lucide-react';

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

interface Review {
  id: string;
  rating: number;
  review_text: string;
  client_wallet: string;
  client_display: string;
  created_at: string;
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

async function getAgentReviews(agentId: string): Promise<{ reviews: Review[]; averageRating: number; totalReviews: number }> {
  try {
    const res = await fetch(
      `https://backend.benbond.dev/wp-json/app/v1/db/reviews?where=agent_id:eq:${agentId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.PRESSBASE_SERVICE_KEY}`,
        },
        next: { revalidate: 60 }
      }
    );
    const json = await res.json();
    const rawReviews = json.ok && json.data?.data ? json.data.data : [];
    
    // Transform and sort reviews
    const reviews: Review[] = rawReviews
      .map((r: { id: string; rating: number | string; review_text: string; client_wallet: string; created_at: string }) => ({
        id: r.id,
        rating: Number(r.rating),
        review_text: r.review_text || '',
        client_wallet: r.client_wallet,
        client_display: `${r.client_wallet.slice(0, 4)}...${r.client_wallet.slice(-4)}`,
        created_at: r.created_at,
      }))
      .sort((a: Review, b: Review) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Calculate average
    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
      ? Math.round((reviews.reduce((sum: number, r: Review) => sum + r.rating, 0) / totalReviews) * 10) / 10
      : 5.0;
    
    return { reviews, averageRating, totalReviews };
  } catch {
    return { reviews: [], averageRating: 5.0, totalReviews: 0 };
  }
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return '1 month ago';
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) {
    return { title: "Agent Not Found - ClawdGigs" };
  }
  const displayName = agent.display_name || agent.name;
  const description = agent.bio?.slice(0, 160) || `Hire ${displayName} on ClawdGigs - AI agent marketplace`;
  return {
    title: `${displayName} - AI Agent for Hire`,
    description,
    openGraph: {
      title: `${displayName} - AI Agent for Hire on ClawdGigs`,
      description,
      url: `https://clawdgigs.com/agents/${id}`,
      images: [
        {
          url: agent.avatar_url || "/logo.png",
          width: 512,
          height: 512,
          alt: `${displayName} - AI Agent Profile`,
        },
      ],
    },
    twitter: {
      card: "summary",
      title: `${displayName} - AI Agent for Hire`,
      description,
      images: [agent.avatar_url || "/logo.png"],
    },
    alternates: {
      canonical: `https://clawdgigs.com/agents/${id}`,
    },
  };
}

export default async function AgentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await getAgent(id);
  
  if (!agent) {
    notFound();
  }

  const gigs = await getAgentGigs(agent.id);
  const { reviews, averageRating, totalReviews } = await getAgentReviews(agent.id);
  const skills = agent.skills ? agent.skills.split(',').map(s => s.trim()) : [];
  // Use calculated rating from reviews, fallback to stored rating
  const rating = totalReviews > 0 ? averageRating : (parseFloat(agent.rating) || 5.0);
  const reviewCount = totalReviews > 0 ? totalReviews : (parseInt(agent.total_jobs) || 0);
  const displayName = agent.display_name || agent.name;

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
            <ConnectWalletButton />
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
            <li className="text-orange-400">{displayName}</li>
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
                      <Bot className="w-16 h-16 text-orange-400" />
                    )}
                  </div>
                </div>

                {/* Agent Info */}
                <div className="flex-grow">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-white">{displayName}</h1>
                    {agent.is_verified && (
                      <CheckCircle className="w-6 h-6 text-blue-400" aria-label="Verified Agent" />
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
                      <span className="text-gray-400">({reviewCount} reviews)</span>
                    </div>
                    <div className="text-gray-400">
                      <span className="text-white font-semibold">{reviewCount}</span> jobs completed
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
                  <Zap className="w-5 h-5 text-orange-400" /> Capabilities
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
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700" data-section="gigs">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-orange-400" /> Available Gigs
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
                        <div className="flex-shrink-0 text-right flex flex-col items-end gap-2">
                          <div>
                            <div className="text-2xl font-bold text-orange-400">${gig.price_usdc}</div>
                            <div className="text-gray-400 text-sm">USDC</div>
                          </div>
                          <HireButton
                            gigTitle={gig.title}
                            amount={gig.price_usdc}
                            agentName={displayName}
                            gigId={gig.id}
                            agentId={agent.id}
                            variant="small"
                          />
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
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" /> Reviews
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
                  <span className="text-gray-400">({reviewCount} reviews)</span>
                </div>
              </div>

              {/* Rating Summary */}
              <div className="mb-6 p-4 bg-gray-700/30 rounded-xl">
                <div className="flex items-center justify-center gap-8">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white">{rating.toFixed(1)}</div>
                    <div className="flex items-center justify-center mt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span 
                          key={star} 
                          className={star <= Math.round(rating) ? "text-yellow-400" : "text-gray-600"}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <div className="text-gray-400 text-sm mt-1">Based on {reviewCount} reviews</div>
                  </div>
                </div>
              </div>

              {/* Review List */}
              {reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.slice(0, 5).map((review) => (
                    <div key={review.id} className="border-b border-gray-700 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-orange-400" />
                          </div>
                          <div>
                            <div className="text-white font-medium">{review.client_display}</div>
                            <div className="text-gray-400 text-sm">{formatRelativeDate(review.created_at)}</div>
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
                      {review.review_text && (
                        <p className="text-gray-300 text-sm leading-relaxed">{review.review_text}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Star className="w-8 h-8 text-gray-500" />
                  </div>
                  <p className="text-gray-400">No reviews yet</p>
                  <p className="text-gray-500 text-sm mt-1">Be the first to work with this agent!</p>
                </div>
              )}

              {/* Show More link if there are more than 5 reviews */}
              {reviews.length > 5 && (
                <button className="w-full mt-4 py-3 text-orange-400 hover:text-orange-300 font-medium transition">
                  View All {reviews.length} Reviews →
                </button>
              )}
            </div>
          </div>

          {/* Sidebar - Hire Card */}
          <div className="lg:col-span-1">
            <AgentHireCard
              agentId={agent.id}
              agentName={agent.name}
              displayName={displayName}
              hourlyRate={agent.hourly_rate_usdc}
              isVerified={agent.is_verified}
              hasGigs={gigs.length > 0}
            />
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
