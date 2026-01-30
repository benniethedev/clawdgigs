import { NextRequest, NextResponse } from 'next/server';
import { getDispute, updateDisputeAiArbitration } from '@/lib/disputes';
import { getOrder, getDeliveryByOrder, getGig, getAgent } from '@/lib/db';
import { getEscrow } from '@/lib/escrow';

// Auto-resolve threshold - disputes with confidence >= this get auto-resolved
const AUTO_RESOLVE_THRESHOLD = 85;

/**
 * POST /api/disputes/[id]/arbitrate
 * 
 * Run AI arbitration on a dispute.
 * Analyzes the order requirements vs delivery and provides a recommendation.
 * 
 * This uses Claude API to analyze the case.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: disputeId } = await params;

    // Get the dispute
    const dispute = await getDispute(disputeId);
    if (!dispute) {
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      );
    }

    // Can only arbitrate open or under_review disputes
    if (dispute.status !== 'open' && dispute.status !== 'under_review') {
      return NextResponse.json(
        { error: `Cannot arbitrate dispute in ${dispute.status} status` },
        { status: 400 }
      );
    }

    // Get related data
    const order = await getOrder(dispute.order_id);
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const delivery = await getDeliveryByOrder(dispute.order_id);
    const gig = order.gig_id ? await getGig(order.gig_id) : null;
    const agent = order.agent_id ? await getAgent(order.agent_id) : null;
    const escrow = dispute.escrow_id ? await getEscrow(dispute.escrow_id) : null;

    // Build context for AI
    const context = buildArbitrationContext({
      dispute,
      order,
      delivery,
      gig,
      agent,
      escrow,
    });

    // Call AI for arbitration
    const arbitrationResult = await runAiArbitration(context);

    if (!arbitrationResult.success) {
      return NextResponse.json(
        { error: arbitrationResult.error || 'AI arbitration failed' },
        { status: 500 }
      );
    }

    const confidence = arbitrationResult.confidence!;
    const recommendation = arbitrationResult.recommendation!;
    const analysis = arbitrationResult.analysis!;

    // Save AI analysis for manual review
    const updateResult = await updateDisputeAiArbitration(disputeId, analysis, recommendation, confidence);

    if (!updateResult.ok) {
      return NextResponse.json(
        { error: updateResult.error || 'Failed to save arbitration results' },
        { status: 500 }
      );
    }

    const isHighConfidence = confidence >= AUTO_RESOLVE_THRESHOLD;
    
    console.log('AI Arbitration completed:', {
      disputeId,
      orderId: dispute.order_id,
      recommendation,
      confidence,
      highConfidence: isHighConfidence,
    });

    return NextResponse.json({
      success: true,
      disputeId,
      autoResolved: false,
      arbitration: {
        analysis,
        recommendation,
        confidence,
        timestamp: new Date().toISOString(),
      },
      note: isHighConfidence 
        ? `High confidence (${confidence}%) - recommended for quick resolution`
        : `Confidence ${confidence}% - requires manual review (threshold: ${AUTO_RESOLVE_THRESHOLD}%)`,
    });
  } catch (error) {
    console.error('AI Arbitration error:', error);
    return NextResponse.json(
      { error: 'Failed to run AI arbitration' },
      { status: 500 }
    );
  }
}

interface ArbitrationContext {
  disputeId: string;
  disputeCategory: string;
  disputeReason: string;
  disputeDetails?: string;
  orderAmount: string;
  orderRequirements: {
    description: string;
    inputs?: string;
    deliveryPrefs?: string;
  };
  gigTitle?: string;
  gigDescription?: string;
  agentName?: string;
  hasDelivery: boolean;
  deliveryContent?: {
    type: string;
    text?: string;
    url?: string;
    files?: string[];
    notes?: string;
  };
  deliveredAt?: string;
  orderCreatedAt: string;
}

function buildArbitrationContext(data: {
  dispute: NonNullable<Awaited<ReturnType<typeof getDispute>>>;
  order: NonNullable<Awaited<ReturnType<typeof getOrder>>>;
  delivery: Awaited<ReturnType<typeof getDeliveryByOrder>>;
  gig: Awaited<ReturnType<typeof getGig>>;
  agent: Awaited<ReturnType<typeof getAgent>>;
  escrow: Awaited<ReturnType<typeof getEscrow>>;
}): ArbitrationContext {
  const { dispute, order, delivery, gig, agent } = data;

  const context: ArbitrationContext = {
    disputeId: dispute.id,
    disputeCategory: dispute.category,
    disputeReason: dispute.reason,
    disputeDetails: dispute.details || undefined,
    orderAmount: `$${order.amount_usdc} USDC`,
    orderRequirements: {
      description: order.requirements_description,
      inputs: order.requirements_inputs || undefined,
      deliveryPrefs: order.requirements_delivery_prefs || undefined,
    },
    gigTitle: gig?.title,
    gigDescription: gig?.description,
    agentName: agent?.display_name || agent?.name,
    hasDelivery: !!delivery,
    orderCreatedAt: order.created_at,
  };

  if (delivery) {
    context.deliveryContent = {
      type: delivery.delivery_type,
      text: delivery.content_text || undefined,
      url: delivery.content_url || undefined,
      files: delivery.file_urls ? JSON.parse(delivery.file_urls) : undefined,
      notes: delivery.notes || undefined,
    };
    context.deliveredAt = delivery.delivered_at;
  }

  return context;
}

interface AiArbitrationResult {
  success: boolean;
  analysis?: string;
  recommendation?: 'refund_buyer' | 'pay_seller' | 'partial_refund';
  confidence?: number;
  error?: string;
}

async function runAiArbitration(context: ArbitrationContext): Promise<AiArbitrationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return { success: false, error: 'AI service not configured' };
  }

  const prompt = buildArbitrationPrompt(context);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      return { success: false, error: 'AI service error' };
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      return { success: false, error: 'No response from AI' };
    }

    // Parse the structured response
    return parseAiResponse(content);
  } catch (error) {
    console.error('AI API call error:', error);
    return { success: false, error: 'Failed to contact AI service' };
  }
}

function buildArbitrationPrompt(context: ArbitrationContext): string {
  let prompt = `You are an AI arbitrator for ClawdGigs, a freelance marketplace for AI agents. Your job is to objectively analyze a dispute between a buyer and seller (AI agent) and provide a fair recommendation.

## Dispute Information
- **Dispute ID:** ${context.disputeId}
- **Category:** ${context.disputeCategory}
- **Buyer's Complaint:** ${context.disputeReason}
${context.disputeDetails ? `- **Additional Details:** ${context.disputeDetails}` : ''}

## Order Information
- **Amount:** ${context.orderAmount}
- **Ordered:** ${new Date(context.orderCreatedAt).toLocaleDateString()}
${context.gigTitle ? `- **Gig:** ${context.gigTitle}` : ''}
${context.gigDescription ? `- **Gig Description:** ${context.gigDescription}` : ''}
${context.agentName ? `- **Agent:** ${context.agentName}` : ''}

## Order Requirements (what the buyer asked for)
**Description:**
${context.orderRequirements.description}

${context.orderRequirements.inputs ? `**Inputs provided:**
${context.orderRequirements.inputs}` : ''}

${context.orderRequirements.deliveryPrefs ? `**Delivery preferences:**
${context.orderRequirements.deliveryPrefs}` : ''}

## Delivery Status
`;

  if (context.hasDelivery && context.deliveryContent) {
    prompt += `**Delivery was submitted** on ${new Date(context.deliveredAt!).toLocaleDateString()}

**Delivery Type:** ${context.deliveryContent.type}

${context.deliveryContent.text ? `**Delivered Content:**
\`\`\`
${context.deliveryContent.text.slice(0, 3000)}${context.deliveryContent.text.length > 3000 ? '\n... (truncated)' : ''}
\`\`\`` : ''}

${context.deliveryContent.url ? `**Delivery URL:** ${context.deliveryContent.url}` : ''}

${context.deliveryContent.files?.length ? `**Files delivered:** ${context.deliveryContent.files.length} file(s)` : ''}

${context.deliveryContent.notes ? `**Agent's Notes:** ${context.deliveryContent.notes}` : ''}
`;
  } else {
    prompt += `**No delivery has been submitted yet.**
`;
  }

  prompt += `
## Your Task
Analyze this dispute objectively and provide:
1. A brief analysis of the situation (2-4 paragraphs)
2. Your recommendation: REFUND_BUYER, PAY_SELLER, or PARTIAL_REFUND
3. Your confidence level (0-100%)

Consider:
- Did the seller deliver what was requested?
- Is the buyer's complaint valid based on the requirements?
- Was there a clear misunderstanding vs. failure to deliver?
- Is there evidence of good faith effort by the seller?

**Respond in this exact format:**
ANALYSIS:
[Your analysis here]

RECOMMENDATION: [REFUND_BUYER|PAY_SELLER|PARTIAL_REFUND]

CONFIDENCE: [0-100]`;

  return prompt;
}

function parseAiResponse(content: string): AiArbitrationResult {
  try {
    // Extract analysis
    const analysisMatch = content.match(/ANALYSIS:\s*([\s\S]*?)(?=RECOMMENDATION:|$)/i);
    const analysis = analysisMatch ? analysisMatch[1].trim() : content;

    // Extract recommendation
    const recommendationMatch = content.match(/RECOMMENDATION:\s*(REFUND_BUYER|PAY_SELLER|PARTIAL_REFUND)/i);
    let recommendation: 'refund_buyer' | 'pay_seller' | 'partial_refund' = 'partial_refund';
    if (recommendationMatch) {
      const rec = recommendationMatch[1].toUpperCase();
      if (rec === 'REFUND_BUYER') recommendation = 'refund_buyer';
      else if (rec === 'PAY_SELLER') recommendation = 'pay_seller';
      else recommendation = 'partial_refund';
    }

    // Extract confidence
    const confidenceMatch = content.match(/CONFIDENCE:\s*(\d+)/i);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1], 10) : 70;

    return {
      success: true,
      analysis,
      recommendation,
      confidence: Math.min(100, Math.max(0, confidence)),
    };
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    return {
      success: true,
      analysis: content,
      recommendation: 'partial_refund',
      confidence: 50,
    };
  }
}
