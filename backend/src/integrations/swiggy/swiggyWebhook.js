exports.swiggyWebhook = async (req, res) => {
  const { event_type, order } = req.body;

  try {
    // 1️⃣ Signature Verification
    const isValid = verifySwiggySignature(
      req,
      process.env.SWIGGY_WEBHOOK_SECRET
    );

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    // 2️⃣ Idempotency Check
    const existingOrder = await prisma.deliveryInfo.findFirst({
      where: {
        platform: 'SWIGGY',
        platformOrderId: order.id
      }
    });

    if (existingOrder && event_type === 'order_created') {
      return res.status(200).json({
        success: true,
        message: 'Duplicate ignored'
      });
    }

    // 3️⃣ Log inbound event
    await logIntegrationEvent(
      'SWIGGY',
      event_type,
      'INBOUND',
      '/delivery/webhook/swiggy',
      req.body
    );

    // 4️⃣ Route event types
    switch (event_type) {

      case 'order_created':
        await createPlatformOrder(order, 'SWIGGY');
        break;

      case 'order_cancelled':
        await updatePlatformOrderStatus(
          order.id,
          'CANCELLED',
          'SWIGGY'
        );
        break;

      case 'order_picked_up':
        await updatePlatformOrderStatus(
          order.id,
          'OUT_FOR_DELIVERY',
          'SWIGGY'
        );
        break;

      case 'order_delivered':
        await updatePlatformOrderStatus(
          order.id,
          'DELIVERED',
          'SWIGGY'
        );
        break;

      default:
        console.log(`Unhandled Swiggy event: ${event_type}`);
        break;
    }

    return res.status(200).json({ success: true });

  } catch (error) {

    await logIntegrationEvent(
      'SWIGGY',
      'WEBHOOK_FAILED',
      'INBOUND',
      '/delivery/webhook/swiggy',
      req.body,
      { error: error.message },
      500,
      false
    );

    return res.status(200).json({
      success: false
    });
  }
};
