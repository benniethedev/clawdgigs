import { NextRequest, NextResponse } from 'next/server';
import { getOrder, updateOrderStatus, createDelivery } from '@/lib/db';

// POST /api/orders/[id]/deliver - Agent submits delivery
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await req.json();
    const {
      agentId,
      agentSecret, // Simple auth for now - in production use proper auth
      deliveryType,
      contentText,
      contentUrl,
      fileUrls,
      notes,
    } = body;

    // Validate required fields
    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing agentId' },
        { status: 400 }
      );
    }

    if (!deliveryType || !['text', 'file', 'url', 'mixed'].includes(deliveryType)) {
      return NextResponse.json(
        { error: 'Invalid deliveryType. Must be: text, file, url, or mixed' },
        { status: 400 }
      );
    }

    // Validate content based on delivery type
    if (deliveryType === 'text' && !contentText) {
      return NextResponse.json(
        { error: 'Text delivery requires contentText' },
        { status: 400 }
      );
    }

    if (deliveryType === 'url' && !contentUrl) {
      return NextResponse.json(
        { error: 'URL delivery requires contentUrl' },
        { status: 400 }
      );
    }

    if (deliveryType === 'file' && (!fileUrls || fileUrls.length === 0)) {
      return NextResponse.json(
        { error: 'File delivery requires fileUrls array' },
        { status: 400 }
      );
    }

    // Get the order
    const order = await getOrder(orderId);
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify agent owns this order
    if (order.agent_id !== agentId) {
      return NextResponse.json(
        { error: 'Unauthorized: Agent does not own this order' },
        { status: 403 }
      );
    }

    // Check order status
    if (order.status === 'delivered' || order.status === 'completed') {
      return NextResponse.json(
        { error: 'Order has already been delivered' },
        { status: 400 }
      );
    }

    if (order.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot deliver cancelled order' },
        { status: 400 }
      );
    }

    // Create the delivery
    const deliveryResult = await createDelivery({
      order_id: orderId,
      agent_id: agentId,
      delivery_type: deliveryType,
      content_text: contentText || undefined,
      content_url: contentUrl || undefined,
      file_urls: fileUrls ? JSON.stringify(fileUrls) : undefined,
      notes: notes || undefined,
    });

    if (!deliveryResult.ok) {
      return NextResponse.json(
        { error: deliveryResult.error || 'Failed to create delivery' },
        { status: 500 }
      );
    }

    // Update order status to delivered
    await updateOrderStatus(orderId, 'delivered');

    return NextResponse.json({
      success: true,
      message: 'Delivery submitted successfully',
      delivery: deliveryResult.data,
    });
  } catch (error) {
    console.error('Deliver order error:', error);
    return NextResponse.json(
      { error: 'Failed to submit delivery' },
      { status: 500 }
    );
  }
}
