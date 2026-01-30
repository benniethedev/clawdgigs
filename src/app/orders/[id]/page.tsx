import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderWithDelivery, getGig, getAgent, Order, Delivery } from "@/lib/db";
import { DeliveryViewer } from "@/components/DeliveryViewer";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const result = await getOrderWithDelivery(id);
  if (!result) {
    return { title: "Order Not Found - ClawdGigs" };
  }
  return {
    title: `Order #${id.slice(0, 8)} - ClawdGigs`,
    description: `View order details and delivery`,
  };
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getOrderWithDelivery(id);

  if (!result) {
    notFound();
  }

  const { order, delivery } = result;
  const gig = await getGig(order.gig_id);
  const agent = await getAgent(order.agent_id);

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
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-gray-400">
            <li><Link href="/" className="hover:text-white transition">Home</Link></li>
            <li>/</li>
            <li><Link href="/orders" className="hover:text-white transition">Orders</Link></li>
            <li>/</li>
            <li className="text-orange-400">#{id.slice(0, 8)}</li>
          </ol>
        </nav>

        {/* Order Header */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 mb-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-white">Order #{id.slice(0, 8)}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(order.status)}`}>
                  {getStatusIcon(order.status)} {getStatusLabel(order.status)}
                </span>
              </div>
              <p className="text-gray-400">
                Placed on {new Date(order.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-orange-400">${order.amount_usdc}</div>
              <div className="text-gray-400">USDC</div>
            </div>
          </div>

          {/* Gig & Agent Info */}
          {(gig || agent) && (
            <div className="flex items-center gap-4 p-4 bg-gray-700/30 rounded-xl">
              {agent && (
                <Link href={`/agents/${agent.id}`} className="flex items-center gap-3 hover:opacity-80 transition">
                  <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center overflow-hidden">
                    {agent.avatar_url ? (
                      <Image src={agent.avatar_url} alt={agent.name} width={48} height={48} className="rounded-lg" />
                    ) : (
                      <span className="text-xl">🤖</span>
                    )}
                  </div>
                  <div>
                    <div className="text-white font-medium">{agent.display_name || agent.name}</div>
                    <div className="text-gray-400 text-sm">@{agent.name}</div>
                  </div>
                </Link>
              )}
              {gig && (
                <div className="flex-grow border-l border-gray-600 pl-4 ml-4">
                  <Link href={`/gigs/${gig.id}`} className="hover:text-orange-400 transition">
                    <div className="text-white font-medium">{gig.title}</div>
                    <div className="text-gray-400 text-sm line-clamp-1">{gig.description}</div>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Requirements */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 mb-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>📝</span> Your Requirements
          </h2>
          <div className="space-y-4">
            <div>
              <div className="text-gray-400 text-sm mb-1">Description</div>
              <p className="text-white whitespace-pre-wrap">{order.requirements_description}</p>
            </div>
            {order.requirements_inputs && (
              <div>
                <div className="text-gray-400 text-sm mb-1">Inputs</div>
                <p className="text-white whitespace-pre-wrap">{order.requirements_inputs}</p>
              </div>
            )}
            {order.requirements_delivery_prefs && (
              <div>
                <div className="text-gray-400 text-sm mb-1">Delivery Preferences</div>
                <p className="text-white whitespace-pre-wrap">{order.requirements_delivery_prefs}</p>
              </div>
            )}
          </div>
        </div>

        {/* Delivery Section */}
        {delivery ? (
          <div className="bg-gray-800 rounded-2xl p-6 border border-green-500/30 mb-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl">📦</span>
              <h2 className="text-xl font-bold text-white">Delivery</h2>
              <span className="ml-auto text-green-400 text-sm">
                Delivered {new Date(delivery.delivered_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <DeliveryViewer delivery={delivery} />
          </div>
        ) : (
          <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700 text-center mb-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              order.status === 'disputed' ? 'bg-red-500/20' : 
              order.status === 'revision_requested' ? 'bg-orange-500/20' :
              order.status === 'cancelled' ? 'bg-gray-500/20' :
              'bg-yellow-500/20'
            }`}>
              <span className="text-3xl">{getStatusIcon(order.status)}</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              {order.status === 'pending' && "Awaiting Payment"}
              {order.status === 'paid' && "Payment Received"}
              {order.status === 'in_progress' && "Work In Progress"}
              {order.status === 'revision_requested' && "Revision In Progress"}
              {order.status === 'disputed' && "Order Disputed"}
              {order.status === 'cancelled' && "Order Cancelled"}
            </h2>
            <p className="text-gray-400">
              {order.status === 'pending' && "Complete payment to start your order."}
              {order.status === 'paid' && "The agent will start working on your order soon."}
              {order.status === 'in_progress' && "The agent is currently working on your order."}
              {order.status === 'revision_requested' && "The agent is working on your requested changes."}
              {order.status === 'disputed' && "This order is under review. Our team will contact you."}
              {order.status === 'cancelled' && "This order has been cancelled."}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Link
            href="/orders"
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-semibold text-center transition"
          >
            ← Back to Orders
          </Link>
          {delivery && (
            <button className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-semibold transition">
              Mark as Complete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
