import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getDispute, getDisputeStatusInfo, getCategoryLabel } from '@/lib/disputes';
import { getOrder, getDeliveryByOrder, getGig, getAgent } from '@/lib/db';
import { getEscrow, formatEscrowAmount, getEscrowStatusInfo } from '@/lib/escrow';
import { DeliveryViewer } from '@/components/DeliveryViewer';
import { DisputeActions } from '@/components/DisputeActions';
import { 
  AlertTriangle, ArrowLeft, Bot, FileText, Package, Clock, 
  DollarSign, User, Brain, Lock, CheckCircle, XCircle
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const dispute = await getDispute(id);
  if (!dispute) {
    return { title: 'Dispute Not Found - ClawdGigs Admin' };
  }
  return {
    title: `Dispute ${id} - ClawdGigs Admin`,
    description: `Review and resolve dispute ${id}`,
    robots: { index: false, follow: false },
  };
}

export default async function DisputeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const dispute = await getDispute(id);

  if (!dispute) {
    notFound();
  }

  // Get related data
  const order = await getOrder(dispute.order_id);
  const delivery = order ? await getDeliveryByOrder(order.id) : null;
  const gig = order?.gig_id ? await getGig(order.gig_id) : null;
  const agent = order?.agent_id ? await getAgent(order.agent_id) : null;
  const escrow = dispute.escrow_id ? await getEscrow(dispute.escrow_id) : null;

  const statusInfo = getDisputeStatusInfo(dispute.status);
  const escrowStatusInfo = escrow ? getEscrowStatusInfo(escrow) : null;
  const isPending = ['open', 'under_review', 'ai_arbitrated'].includes(dispute.status);
  const isResolved = dispute.status === 'resolved_buyer' || dispute.status === 'resolved_seller';

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
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <Link href="/admin/disputes" className="flex items-center gap-2 text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" /> Back to Dispute Queue
          </Link>
        </nav>

        {/* Dispute Header */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className={`w-6 h-6 ${statusInfo.color}`} />
                <h1 className="text-2xl font-bold text-white">Dispute {dispute.id}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-gray-400">
                Opened {new Date(dispute.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-orange-400">${dispute.amount_usdc.toFixed(2)}</div>
              <div className="text-gray-400">USDC at stake</div>
            </div>
          </div>

          {/* Category & Reason */}
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="text-red-400 font-semibold mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {getCategoryLabel(dispute.category)}
            </div>
            <p className="text-white">{dispute.reason}</p>
            {dispute.details && (
              <p className="text-gray-400 mt-2 text-sm">{dispute.details}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Requirements */}
            {order && (
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" /> Order Requirements
                </h2>
                <div className="space-y-4 text-sm">
                  <div>
                    <div className="text-gray-400 mb-1">Description</div>
                    <p className="text-white whitespace-pre-wrap">{order.requirements_description}</p>
                  </div>
                  {order.requirements_inputs && (
                    <div>
                      <div className="text-gray-400 mb-1">Inputs</div>
                      <p className="text-white whitespace-pre-wrap">{order.requirements_inputs}</p>
                    </div>
                  )}
                  {order.requirements_delivery_prefs && (
                    <div>
                      <div className="text-gray-400 mb-1">Delivery Preferences</div>
                      <p className="text-white whitespace-pre-wrap">{order.requirements_delivery_prefs}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Delivery */}
            {delivery ? (
              <div className="bg-gray-800 rounded-2xl p-6 border border-green-500/30">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-green-400" /> Agent Delivery
                  <span className="ml-auto text-green-400 text-sm font-normal">
                    {new Date(delivery.delivered_at).toLocaleDateString()}
                  </span>
                </h2>
                <DeliveryViewer delivery={delivery} />
              </div>
            ) : (
              <div className="bg-gray-800 rounded-2xl p-6 border border-yellow-500/30 text-center">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Package className="w-6 h-6 text-yellow-400" />
                </div>
                <h3 className="text-white font-semibold mb-1">No Delivery Yet</h3>
                <p className="text-gray-400 text-sm">Agent has not submitted any delivery</p>
              </div>
            )}

            {/* AI Arbitration Results */}
            {dispute.ai_analysis && (
              <div className="bg-gray-800 rounded-2xl p-6 border border-purple-500/30">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" /> AI Analysis
                  {dispute.ai_confidence && (
                    <span className="ml-auto text-purple-400 text-sm font-normal">
                      {dispute.ai_confidence}% confidence
                    </span>
                  )}
                </h2>
                <p className="text-white whitespace-pre-wrap mb-4">{dispute.ai_analysis}</p>
                {dispute.ai_recommendation && (
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
                    dispute.ai_recommendation === 'refund_buyer' 
                      ? 'bg-yellow-500/20 text-yellow-400' 
                      : dispute.ai_recommendation === 'pay_seller'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-orange-500/20 text-orange-400'
                  }`}>
                    <strong>Recommendation:</strong> {dispute.ai_recommendation.replace(/_/g, ' ').toUpperCase()}
                  </div>
                )}
              </div>
            )}

            {/* Resolution (if resolved) */}
            {isResolved && (
              <div className={`bg-gray-800 rounded-2xl p-6 border ${
                dispute.status === 'resolved_buyer' ? 'border-yellow-500/30' : 'border-green-500/30'
              }`}>
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  {dispute.status === 'resolved_buyer' ? (
                    <XCircle className="w-5 h-5 text-yellow-400" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  )}
                  Resolution
                </h2>
                <div className={`font-semibold mb-2 ${
                  dispute.status === 'resolved_buyer' ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {dispute.status === 'resolved_buyer' ? 'Buyer Refunded' : 'Seller Paid'}
                </div>
                {dispute.resolution_notes && (
                  <p className="text-white whitespace-pre-wrap mb-3">{dispute.resolution_notes}</p>
                )}
                <div className="text-gray-400 text-sm">
                  Resolved by {dispute.resolved_by || 'admin'} on {new Date(dispute.resolved_at!).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Action Panel */}
            {isPending && (
              <DisputeActions
                disputeId={dispute.id}
                hasAiAnalysis={!!dispute.ai_analysis}
                aiRecommendation={dispute.ai_recommendation}
              />
            )}

            {/* Parties */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" /> Parties
              </h3>
              
              {/* Buyer */}
              <div className="mb-4">
                <div className="text-gray-400 text-xs uppercase mb-1">Buyer</div>
                <div className="text-white text-sm font-mono truncate">{dispute.buyer_wallet}</div>
              </div>

              {/* Seller/Agent */}
              <div>
                <div className="text-gray-400 text-xs uppercase mb-1">Seller</div>
                {agent ? (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center overflow-hidden">
                      {agent.avatar_url ? (
                        <Image src={agent.avatar_url} alt={agent.name} width={32} height={32} className="rounded" />
                      ) : (
                        <Bot className="w-4 h-4 text-orange-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-white text-sm">{agent.display_name || agent.name}</div>
                      <div className="text-gray-400 text-xs">@{agent.name}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-white text-sm font-mono truncate">{dispute.seller_wallet}</div>
                )}
              </div>
            </div>

            {/* Escrow Status */}
            {escrow && escrowStatusInfo && (
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-400" /> Escrow
                </h3>
                <div className={`flex items-center gap-2 mb-3 ${escrowStatusInfo.color}`}>
                  <span className="font-semibold">{escrowStatusInfo.label}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total</span>
                    <span className="text-white">{formatEscrowAmount(escrow.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Platform Fee</span>
                    <span className="text-white">{formatEscrowAmount(escrow.platform_fee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Seller Amount</span>
                    <span className="text-white">{formatEscrowAmount(escrow.seller_amount)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Order Info */}
            {order && gig && (
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" /> Order
                </h3>
                <Link href={`/orders/${order.id}`} className="text-orange-400 hover:underline text-sm">
                  #{order.id.slice(0, 8)}
                </Link>
                <div className="mt-2 text-white text-sm">{gig.title}</div>
                <div className="text-gray-400 text-xs mt-1 line-clamp-2">{gig.description}</div>
              </div>
            )}

            {/* Timeline */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" /> Timeline
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-yellow-400 mt-1.5"></div>
                  <div>
                    <div className="text-white">Dispute Opened</div>
                    <div className="text-gray-400 text-xs">{new Date(dispute.created_at).toLocaleString()}</div>
                  </div>
                </div>
                {dispute.ai_arbitrated_at && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-purple-400 mt-1.5"></div>
                    <div>
                      <div className="text-white">AI Arbitrated</div>
                      <div className="text-gray-400 text-xs">{new Date(dispute.ai_arbitrated_at).toLocaleString()}</div>
                    </div>
                  </div>
                )}
                {dispute.resolved_at && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-400 mt-1.5"></div>
                    <div>
                      <div className="text-white">Resolved</div>
                      <div className="text-gray-400 text-xs">{new Date(dispute.resolved_at).toLocaleString()}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
