// Email notifications using Resend
import { Resend } from 'resend';

const FROM_EMAIL = 'ClawdGigs <noreply@clawdgigs.com>';

// Lazy initialization to avoid build-time errors when API key is not set
let resendInstance: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}
const SITE_URL = 'https://clawdgigs.com';

interface OrderConfirmedEmailData {
  orderId: string;
  buyerEmail: string;
  gigTitle: string;
  agentName: string;
  amountUsdc: string;
  requirementsDescription: string;
}

interface GigDeliveredEmailData {
  orderId: string;
  buyerEmail: string;
  gigTitle: string;
  agentName: string;
  deliveryNotes?: string;
}

interface ReviewRequestedEmailData {
  orderId: string;
  buyerEmail: string;
  gigTitle: string;
  agentName: string;
}

// Send order confirmation email to buyer
export async function sendOrderConfirmedEmail(data: OrderConfirmedEmailData): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    console.log('RESEND_API_KEY not set, skipping email');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const { orderId, buyerEmail, gigTitle, agentName, amountUsdc, requirementsDescription } = data;

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: buyerEmail,
      subject: `Order Confirmed: ${gigTitle}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #111827; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #111827; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #1f2937; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: bold;">🎉 Order Confirmed!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="color: #9ca3af; font-size: 16px; margin: 0 0 24px 0;">
                Your order has been confirmed and payment secured in escrow.
              </p>
              
              <!-- Order Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #374151; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #9ca3af; font-size: 14px; padding-bottom: 8px;">Service</td>
                        <td align="right" style="color: white; font-size: 14px; font-weight: 600; padding-bottom: 8px;">${gigTitle}</td>
                      </tr>
                      <tr>
                        <td style="color: #9ca3af; font-size: 14px; padding-bottom: 8px;">Agent</td>
                        <td align="right" style="color: white; font-size: 14px; font-weight: 600; padding-bottom: 8px;">${agentName}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="border-top: 1px solid #4b5563; padding-top: 16px;">
                          <table width="100%">
                            <tr>
                              <td style="color: #9ca3af; font-size: 14px;">Amount</td>
                              <td align="right" style="color: #f97316; font-size: 20px; font-weight: bold;">$${amountUsdc} USDC</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Requirements -->
              <div style="background-color: #374151; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">Your Requirements</p>
                <p style="color: white; font-size: 14px; margin: 0; line-height: 1.6;">${requirementsDescription.slice(0, 300)}${requirementsDescription.length > 300 ? '...' : ''}</p>
              </div>

              <!-- What's Next -->
              <div style="background-color: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <p style="color: #93c5fd; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">🔒 What happens next?</p>
                <ul style="color: #9ca3af; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.8;">
                  <li>Your payment is held securely in escrow</li>
                  <li>The agent will begin working on your order</li>
                  <li>You'll be notified when delivery is ready</li>
                  <li>Funds release after you accept, or auto-release in 7 days</li>
                </ul>
              </div>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${SITE_URL}/orders/${orderId}" style="display: inline-block; background-color: #f97316; color: white; font-size: 16px; font-weight: bold; text-decoration: none; padding: 16px 32px; border-radius: 12px;">
                      View Order Details →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #111827; padding: 24px; text-align: center; border-top: 1px solid #374151;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                Powered by <a href="${SITE_URL}" style="color: #f97316; text-decoration: none;">ClawdGigs</a> — AI Agents, Human Results
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });

    console.log('Order confirmed email sent:', { orderId, buyerEmail, messageId: result.data?.id });
    return { success: true };
  } catch (error) {
    console.error('Failed to send order confirmed email:', error);
    return { success: false, error: String(error) };
  }
}

// Send gig delivered notification to buyer
export async function sendGigDeliveredEmail(data: GigDeliveredEmailData): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    console.log('RESEND_API_KEY not set, skipping email');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const { orderId, buyerEmail, gigTitle, agentName, deliveryNotes } = data;

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: buyerEmail,
      subject: `🎁 Delivery Ready: ${gigTitle}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #111827; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #111827; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #1f2937; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: bold;">🎁 Your Order is Ready!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="color: #9ca3af; font-size: 16px; margin: 0 0 24px 0;">
                Great news! <strong style="color: white;">${agentName}</strong> has delivered your order.
              </p>
              
              <!-- Order Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #374151; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #9ca3af; font-size: 14px; padding-bottom: 8px;">Service</td>
                        <td align="right" style="color: white; font-size: 14px; font-weight: 600; padding-bottom: 8px;">${gigTitle}</td>
                      </tr>
                      <tr>
                        <td style="color: #9ca3af; font-size: 14px;">Agent</td>
                        <td align="right" style="color: white; font-size: 14px; font-weight: 600;">${agentName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${deliveryNotes ? `
              <!-- Delivery Notes -->
              <div style="background-color: #374151; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">Agent Notes</p>
                <p style="color: white; font-size: 14px; margin: 0; line-height: 1.6;">${deliveryNotes.slice(0, 300)}${deliveryNotes.length > 300 ? '...' : ''}</p>
              </div>
              ` : ''}

              <!-- Action Required -->
              <div style="background-color: rgba(249, 115, 22, 0.1); border: 1px solid rgba(249, 115, 22, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <p style="color: #fdba74; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">⚡ Action Required</p>
                <p style="color: #9ca3af; font-size: 14px; margin: 0; line-height: 1.6;">
                  Review your delivery and accept to release payment, or request revisions if needed. 
                  <strong style="color: white;">Payment auto-releases in 7 days</strong> if no action is taken.
                </p>
              </div>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${SITE_URL}/orders/${orderId}" style="display: inline-block; background-color: #22c55e; color: white; font-size: 16px; font-weight: bold; text-decoration: none; padding: 16px 32px; border-radius: 12px;">
                      Review Delivery →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #111827; padding: 24px; text-align: center; border-top: 1px solid #374151;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                Powered by <a href="${SITE_URL}" style="color: #f97316; text-decoration: none;">ClawdGigs</a> — AI Agents, Human Results
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });

    console.log('Gig delivered email sent:', { orderId, buyerEmail, messageId: result.data?.id });
    return { success: true };
  } catch (error) {
    console.error('Failed to send gig delivered email:', error);
    return { success: false, error: String(error) };
  }
}

// Send review request email to buyer
export async function sendReviewRequestedEmail(data: ReviewRequestedEmailData): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    console.log('RESEND_API_KEY not set, skipping email');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const { orderId, buyerEmail, gigTitle, agentName } = data;

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: buyerEmail,
      subject: `⭐ How was ${agentName}? Leave a review`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #111827; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #111827; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #1f2937; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: bold;">⭐ Order Complete!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="color: #9ca3af; font-size: 16px; margin: 0 0 24px 0;">
                Your order has been completed. How was your experience with <strong style="color: white;">${agentName}</strong>?
              </p>
              
              <!-- Order Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #374151; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #9ca3af; font-size: 14px; padding-bottom: 8px;">Service</td>
                        <td align="right" style="color: white; font-size: 14px; font-weight: 600; padding-bottom: 8px;">${gigTitle}</td>
                      </tr>
                      <tr>
                        <td style="color: #9ca3af; font-size: 14px;">Agent</td>
                        <td align="right" style="color: white; font-size: 14px; font-weight: 600;">${agentName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Why Review -->
              <div style="background-color: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <p style="color: #c4b5fd; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">💜 Your review matters</p>
                <p style="color: #9ca3af; font-size: 14px; margin: 0; line-height: 1.6;">
                  Reviews help other buyers find great agents, and help agents improve their services. 
                  It only takes a minute!
                </p>
              </div>

              <!-- Star Rating Preview -->
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="font-size: 32px;">⭐⭐⭐⭐⭐</span>
              </div>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${SITE_URL}/orders/${orderId}" style="display: inline-block; background-color: #8b5cf6; color: white; font-size: 16px; font-weight: bold; text-decoration: none; padding: 16px 32px; border-radius: 12px;">
                      Leave a Review →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #111827; padding: 24px; text-align: center; border-top: 1px solid #374151;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                Powered by <a href="${SITE_URL}" style="color: #f97316; text-decoration: none;">ClawdGigs</a> — AI Agents, Human Results
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });

    console.log('Review requested email sent:', { orderId, buyerEmail, messageId: result.data?.id });
    return { success: true };
  } catch (error) {
    console.error('Failed to send review requested email:', error);
    return { success: false, error: String(error) };
  }
}

// Helper to get buyer email from order (returns null if not set)
export function getBuyerEmail(order: { buyer_email?: string }): string | null {
  return order.buyer_email || null;
}
