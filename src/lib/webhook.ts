// Webhook service for notifying agents when gigs are purchased

export interface WebhookPayload {
  event: 'order.created';
  timestamp: string;
  data: {
    order_id: string;
    gig_id: string;
    gig_title: string;
    agent_id: string;
    client_wallet: string;
    amount_usdc: string;
    requirements: {
      description: string;
      inputs?: string;
      delivery_preferences?: string;
    };
    payment_signature?: string;
  };
}

interface WebhookResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  attempts: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send a webhook notification to an agent's webhook URL with retry logic
 */
export async function sendWebhook(
  webhookUrl: string,
  payload: WebhookPayload
): Promise<WebhookResult> {
  let lastError: string | undefined;
  let lastStatusCode: number | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ClawdGigs-Webhook/1.0',
          'X-ClawdGigs-Event': payload.event,
          'X-ClawdGigs-Delivery': `${payload.data.order_id}-${attempt}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      lastStatusCode = response.status;

      // Success: 2xx status codes
      if (response.ok) {
        console.log(`Webhook delivered successfully to ${webhookUrl}`, {
          orderId: payload.data.order_id,
          attempt,
          statusCode: response.status,
        });
        return {
          success: true,
          statusCode: response.status,
          attempts: attempt,
        };
      }

      // Client error (4xx): Don't retry, it's a permanent failure
      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`Webhook client error (${response.status}): ${errorText}`, {
          webhookUrl,
          orderId: payload.data.order_id,
        });
        return {
          success: false,
          statusCode: response.status,
          error: `Client error: ${response.status} - ${errorText}`,
          attempts: attempt,
        };
      }

      // Server error (5xx): Will retry
      lastError = `Server error: ${response.status}`;
      console.warn(`Webhook attempt ${attempt} failed with status ${response.status}`, {
        webhookUrl,
        orderId: payload.data.order_id,
      });

    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.warn(`Webhook attempt ${attempt} failed:`, {
        webhookUrl,
        orderId: payload.data.order_id,
        error: lastError,
      });
    }

    // Wait before retrying (except on last attempt)
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAYS[attempt - 1] || 15000;
      console.log(`Retrying webhook in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(delay);
    }
  }

  // All retries exhausted
  console.error(`Webhook delivery failed after ${MAX_RETRIES} attempts`, {
    webhookUrl,
    orderId: payload.data.order_id,
    lastError,
    lastStatusCode,
  });

  return {
    success: false,
    statusCode: lastStatusCode,
    error: lastError || 'Max retries exceeded',
    attempts: MAX_RETRIES,
  };
}

/**
 * Notify an agent about a new order (fire and forget with background retry)
 */
export async function notifyAgentOfOrder(
  webhookUrl: string,
  orderData: {
    orderId: string;
    gigId: string;
    gigTitle: string;
    agentId: string;
    clientWallet: string;
    amountUsdc: string;
    requirementsDescription: string;
    requirementsInputs?: string;
    requirementsDeliveryPrefs?: string;
    paymentSignature?: string;
  }
): Promise<WebhookResult> {
  const payload: WebhookPayload = {
    event: 'order.created',
    timestamp: new Date().toISOString(),
    data: {
      order_id: orderData.orderId,
      gig_id: orderData.gigId,
      gig_title: orderData.gigTitle,
      agent_id: orderData.agentId,
      client_wallet: orderData.clientWallet,
      amount_usdc: orderData.amountUsdc,
      requirements: {
        description: orderData.requirementsDescription,
        inputs: orderData.requirementsInputs,
        delivery_preferences: orderData.requirementsDeliveryPrefs,
      },
      payment_signature: orderData.paymentSignature,
    },
  };

  return sendWebhook(webhookUrl, payload);
}
