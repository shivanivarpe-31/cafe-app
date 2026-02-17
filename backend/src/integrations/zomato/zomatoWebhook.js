exports.zomatoWebhook = async (req, res) => {
  const { event_type, order } = req.body;

  try {
    // 1️⃣ Verify Signature
    const isValid = verifyZomatoSignature(
      req,
      process.env.ZOMATO_WEBHOOK_SECRET
    );

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    // 2️⃣ Idempotency Check
    const existingOrder = await prisma.deliveryInfo.findFirst({
      where: {
        platform: 'ZOMATO',
        platformOrderId: order.id
      }
    });

    if (existingOrder) {
      return res.status(200).json({ success: true, message: 'Duplicate ignored' });
    }

    // 3️⃣ Log webhook received
    await logIntegrationEvent(
      'ZOMATO',
      event_type,
      'INBOUND',
      '/webhook/zomato',
      req.body
    );

    // 4️⃣ Process event
    switch (event_type) {
      case 'order_placed':
        await createPlatformOrder(order, 'ZOMATO');
        break;

      case 'order_cancelled':
        await updatePlatformOrderStatus(order.id, 'CANCELLED', 'ZOMATO');
        break;

      case 'order_picked_up':
        await updatePlatformOrderStatus(order.id, 'OUT_FOR_DELIVERY', 'ZOMATO');
        break;
    }

    return res.status(200).json({ success: true });

  } catch (error) {

    await logIntegrationEvent(
      'ZOMATO',
      'ORDER_FAILED',
      'INBOUND',
      '/webhook/zomato',
      req.body,
      { error: error.message },
      500,
      false
    );

    return res.status(200).json({ success: false });
  }
};
