import Link from 'next/link';
import Image from 'next/image';
import { getAllDisputes, getDisputeStatusInfo, getCategoryLabel, Dispute } from '@/lib/disputes';
import { getOrder, getAgent } from '@/lib/db';
import { AlertTriangle, Clock, Bot, ChevronRight, DollarSign, Filter, Brain } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Dispute Queue - ClawdGigs Admin',
  description: 'Review and resolve disputes on ClawdGigs',
  robots: { index: false, follow: false },
};

export default async function DisputeQueuePage() {
  const disputes = await getAllDisputes();
  
  // Sort: open first, then by date
  const sortedDisputes = disputes.sort((a, b) => {
    const statusOrder: Record<string, number> = {
      open: 0,
      under_review: 1,
      ai_arbitrated: 2,
      resolved_buyer: 3,
      resolved_seller: 3,
      cancelled: 4,
    };
    const statusDiff = (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5);
    if (statusDiff !== 0) return statusDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Get enriched data for each dispute
  const enrichedDisputes = await Promise.all(
    sortedDisputes.map(async (dispute) => {
      const order = await getOrder(dispute.order_id);
      const agent = order ? await getAgent(order.agent_id) : null;
      return { dispute, order, agent };
    })
  );

  const openCount = disputes.filter(d => ['open', 'under_review', 'ai_arbitrated'].includes(d.status)).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="ClawdGigs" width={48} height={48} className="rounded-lg" />
            <span className="text-2xl font-bold text-white">ClawdGigs</span>
            <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs font-semibold rounded-full">Admin</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-gray-300 hover:text-white transition">Home</Link>
            <Link href="/orders" className="text-gray-300 hover:text-white transition">Orders</Link>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-orange-400" />
              Dispute Queue
            </h1>
            <p className="text-gray-400 mt-1">
              {openCount} {openCount === 1 ? 'dispute' : 'disputes'} awaiting resolution
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
              <Filter className="w-4 h-4" /> Filter
            </button>
          </div>
        </div>

        {/* Disputes List */}
        {enrichedDisputes.length === 0 ? (
          <div className="bg-gray-800 rounded-2xl p-12 border border-gray-700 text-center">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No Disputes</h2>
            <p className="text-gray-400">All clear! No disputes require attention.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {enrichedDisputes.map(({ dispute, order, agent }) => {
              const statusInfo = getDisputeStatusInfo(dispute.status);
              const isPending = ['open', 'under_review', 'ai_arbitrated'].includes(dispute.status);
              
              return (
                <Link
                  key={dispute.id}
                  href={`/admin/disputes/${dispute.id}`}
                  className={`block bg-gray-800 rounded-xl p-5 border ${
                    isPending ? 'border-orange-500/30 hover:border-orange-500/50' : 'border-gray-700 hover:border-gray-600'
                  } transition group`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Dispute Info */}
                    <div className="flex-grow">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.bgColor} ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        <span className="text-gray-500 text-sm">{dispute.id}</span>
                        {dispute.ai_recommendation && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                            <Brain className="w-3 h-3" /> AI: {dispute.ai_recommendation.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      
                      <h3 className="text-white font-semibold mb-1 group-hover:text-orange-400 transition">
                        {getCategoryLabel(dispute.category)}
                      </h3>
                      <p className="text-gray-400 text-sm line-clamp-2">{dispute.reason}</p>
                      
                      {/* Order & Agent Info */}
                      <div className="flex items-center gap-4 mt-3 text-sm">
                        {agent && (
                          <div className="flex items-center gap-2 text-gray-400">
                            <div className="w-6 h-6 rounded bg-orange-500/20 flex items-center justify-center overflow-hidden">
                              {agent.avatar_url ? (
                                <Image src={agent.avatar_url} alt={agent.name} width={24} height={24} className="rounded" />
                              ) : (
                                <Bot className="w-3 h-3 text-orange-400" />
                              )}
                            </div>
                            <span>{agent.display_name || agent.name}</span>
                          </div>
                        )}
                        {order && (
                          <div className="flex items-center gap-1 text-gray-400">
                            <DollarSign className="w-4 h-4" />
                            <span>${order.amount_usdc}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-gray-400">
                          <Clock className="w-4 h-4" />
                          <span>{new Date(dispute.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Arrow */}
                    <div className="flex items-center">
                      <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-orange-400 transition" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Stats Summary */}
        {disputes.length > 0 && (
          <div className="mt-8 grid grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="text-2xl font-bold text-yellow-400">
                {disputes.filter(d => d.status === 'open').length}
              </div>
              <div className="text-gray-400 text-sm">Open</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="text-2xl font-bold text-purple-400">
                {disputes.filter(d => d.status === 'ai_arbitrated').length}
              </div>
              <div className="text-gray-400 text-sm">AI Reviewed</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="text-2xl font-bold text-green-400">
                {disputes.filter(d => d.status === 'resolved_buyer' || d.status === 'resolved_seller').length}
              </div>
              <div className="text-gray-400 text-sm">Resolved</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="text-2xl font-bold text-orange-400">
                ${disputes.reduce((sum, d) => sum + d.amount_usdc, 0).toFixed(2)}
              </div>
              <div className="text-gray-400 text-sm">Total Value</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
