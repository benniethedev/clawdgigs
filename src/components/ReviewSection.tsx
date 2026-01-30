'use client';

import { Star, User } from 'lucide-react';
import { ReviewForm } from './ReviewForm';

interface Review {
  id: string;
  order_id: string;
  agent_id: string;
  client_wallet: string;
  rating: number;
  review_text: string;
  created_at: string;
}

interface ReviewSectionProps {
  orderId: string;
  clientWallet: string;
  agentName?: string;
  existingReview: Review | null;
}

export function ReviewSection({ orderId, clientWallet, agentName, existingReview }: ReviewSectionProps) {
  if (existingReview) {
    // Show the existing review
    return (
      <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" /> Your Review
        </h2>
        
        <div className="bg-gray-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <div className="text-white font-medium">
                  {existingReview.client_wallet.slice(0, 4)}...{existingReview.client_wallet.slice(-4)}
                </div>
                <div className="text-gray-400 text-sm">
                  {new Date(existingReview.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              </div>
            </div>
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    star <= existingReview.rating
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>
          
          {existingReview.review_text && (
            <p className="text-gray-300 leading-relaxed">{existingReview.review_text}</p>
          )}
        </div>
        
        <p className="text-gray-500 text-sm mt-3 text-center">
          Thank you for your feedback!
        </p>
      </div>
    );
  }

  // Show the review form
  return (
    <div className="bg-gray-800 rounded-2xl p-6 border border-orange-500/30">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Star className="w-5 h-5 text-orange-400" /> Leave a Review
      </h2>
      <p className="text-gray-400 mb-4">
        How was your experience? Your review helps other buyers and helps agents improve.
      </p>
      <ReviewForm
        orderId={orderId}
        clientWallet={clientWallet}
        agentName={agentName}
      />
    </div>
  );
}
