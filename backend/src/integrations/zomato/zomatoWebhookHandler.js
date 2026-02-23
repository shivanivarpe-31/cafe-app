/**
 * Improved Zomato Webhook Handler
 * Production-ready with signature verification, idempotency, and error handling
 */

const { prisma } = require('../../prisma');
const verifyZomatoSignature = require('../../utils/verifyZomatoSignature');
const WebhookRetryQueue = require('../../utils/webhookRetryQueue');
const { logIntegrationEvent } = require('../../utils/integrationLogger');
const logger = require('../../utils/logger');
const config = require('../../config/businessConfig');

async function handleZomatoWebhook(req, res) {
    const startTime = Date.now();
    const eventType = req.body.event_type || req.body.event;
    const payload = req.body.data || req.body.order || req.body;
    let webhookLogId = null;

    try {
        logger.info(`[ZOMATO WEBHOOK] Received: ${eventType}`, {
            orderId: payload.order_id
        });

        // 1️⃣ SIGNATURE VERIFICATION
        const secret = process.env.ZOMATO_WEBHOOK_SECRET;
        if (!secret) {
            logger.error('[ZOMATO WEBHOOK] ZOMATO_WEBHOOK_SECRET not configured');
            return res.status(500).json({
                success: false,
                error: 'Webhook secret not configured'
            });
        }

        const isSignatureValid = verifyZomatoSignature(req, secret);
        if (!isSignatureValid) {
            logger.warn('[ZOMATO WEBHOOK] Invalid signature for event', { eventType });
            return res.status(401).json({
                success: false,
                error: 'Invalid signature'
            });
        }

        logger.info('[ZOMATO WEBHOOK] Signature verified');

        // 2️⃣ IDEMPOTENCY CHECK
        const platformOrderId = payload.order_id?.toString() || payload.id?.toString();
        const existingOrder = await prisma.deliveryInfo.findFirst({
            where: {
                deliveryPlatform: 'ZOMATO',
                platformOrderId
            },
            select: { id: true, orderId: true }
        }).catch(() => null);

        if (existingOrder && (eventType === 'order.placed' || eventType === 'order.created')) {
            logger.info('[ZOMATO WEBHOOK] Duplicate order detected', {
                platformOrderId,
                localOrderId: existingOrder.orderId
            });

            return res.status(200).json({
                success: true,
                message: 'Duplicate order ignored',
                orderId: existingOrder.orderId
            });
        }

        // 3️⃣ LOG WEBHOOK EVENT
        const webhookLog = await prisma.webhookLog.create({
            data: {
                platform: 'ZOMATO',
                eventType,
                payload: JSON.stringify(payload),
                status: 'PENDING',
                attemptCount: 0
            }
        });
        webhookLogId = webhookLog.id;

        // 4️⃣ PROCESS EVENT
        let result;
        switch (eventType) {
            case 'order.placed':
            case 'order.created':
                result = await processZomatoOrderPlaced(payload, webhookLogId);
                break;

            case 'order.confirmed':
                result = await processZomatoOrderConfirmed(payload, webhookLogId);
                break;

            case 'order.ready':
                result = await processZomatoOrderReady(payload, webhookLogId);
                break;

            case 'order.picked_up':
            case 'order.out_for_delivery':
                result = await processZomatoOrderPickedUp(payload, webhookLogId);
                break;

            case 'order.delivered':
                result = await processZomatoOrderDelivered(payload, webhookLogId);
                break;

            case 'order.cancelled':
                result = await processZomatoOrderCancelled(payload, webhookLogId);
                break;

            case 'order.rejected':
                result = await processZomatoOrderRejected(payload, webhookLogId);
                break;

            default:
                logger.warn('[ZOMATO WEBHOOK] Unhandled event type', { eventType });
                return res.status(200).json({
                    success: true,
                    message: `Event '${eventType}' acknowledged`
                });
        }

        if (!result.success) {
            throw new Error(result.error || 'Failed to process event');
        }

        // 5️⃣ MARK WEBHOOK AS SUCCESSFUL
        await prisma.webhookLog.update({
            where: { id: webhookLogId },
            data: {
                status: 'SUCCESS',
                attemptCount: 0
            }
        });

        const duration = Date.now() - startTime;
        logger.info('[ZOMATO WEBHOOK] Processed successfully', {
            eventType,
            duration: `${duration}ms`,
            orderId: result.orderId
        });

        return res.status(200).json({
            success: true,
            message: 'Webhook processed',
            orderId: result.orderId,
            billNumber: result.billNumber
        });

    } catch (error) {
        const duration = Date.now() - startTime;

        logger.error('[ZOMATO WEBHOOK] Processing failed', {
            eventType,
            error: error.message,
            duration: `${duration}ms`
        });

        // Enqueue for retry
        if (webhookLogId) {
            try {
                await WebhookRetryQueue.enqueue(
                    'ZOMATO',
                    eventType,
                    payload,
                    error.message,
                    0
                );
            } catch (retryError) {
                logger.error('[ZOMATO WEBHOOK] Failed to enqueue retry', {
                    error: retryError.message
                });
            }
        }

        return res.status(200).json({
            success: false,
            message: 'Webhook received, processing will be retried'
        });
    }
}

async function processZomatoOrderPlaced(payload, webhookLogId) {
    try {
        const items = payload.items || payload.order_items || [];
        const mappedItems = [];

        for (const item of items) {
            // Try platform ID mapping first
            let mapping = await prisma.platformItemMapping.findFirst({
                where: {
                    platform: 'ZOMATO',
                    platformItemId: item.item_id?.toString()
                }
            });

            // Fallback to name matching
            if (!mapping) {
                const menuItem = await prisma.menuItem.findFirst({
                    where: {
                        name: { contains: item.name, mode: 'insensitive' },
                        isActive: true
                    }
                });

                if (menuItem) {
                    mapping = { menuItemId: menuItem.id, menuItem };
                }
            } else {
                mapping.menuItem = await prisma.menuItem.findUnique({
                    where: { id: mapping.menuItemId }
                });
            }

            if (!mapping) {
                logger.warn('[ZOMATO] Item not found', { itemName: item.name });
                continue;
            }

            mappedItems.push({
                menuItemId: mapping.menuItemId,
                name: mapping.menuItem.name,
                quantity: item.quantity || 1,
                price: mapping.menuItem.price,
                notes: item.instructions || item.variant_name || null
            });
        }

        if (mappedItems.length === 0) {
            throw new Error('No mappable items found in order');
        }

        const subtotal = mappedItems.reduce((sum, item) =>
            sum + (item.price * item.quantity), 0);
        const tax = subtotal * config.tax.rate;
        const deliveryFee = parseFloat(payload.delivery_fee || 0);
        const packagingFee = parseFloat(payload.packaging_fee || config.delivery.defaultPackagingFee);
        const total = subtotal + tax + deliveryFee + packagingFee;
        const billNumber = generateBillNumber('ZOMATO');

        const order = await prisma.$transaction(async (tx) => {
            const newOrder = await tx.order.create({
                data: {
                    billNumber,
                    subtotal,
                    tax,
                    total,
                    status: 'PENDING',
                    orderType: 'DELIVERY',
                    items: {
                        create: mappedItems.map(item => ({
                            menuItemId: item.menuItemId,
                            quantity: item.quantity,
                            price: item.price,
                            notes: item.notes
                        }))
                    },
                    deliveryInfo: {
                        create: {
                            customerName: payload.customer?.name || 'Zomato Customer',
                            customerPhone: payload.customer?.phone || payload.customer?.mobile || '',
                            customerEmail: payload.customer?.email || null,
                            deliveryAddress: payload.delivery?.address?.full_address ||
                                payload.delivery_address ||
                                'Address not provided',
                            deliveryPlatform: 'ZOMATO',
                            platformOrderId: payload.order_id?.toString(),
                            deliveryStatus: 'PENDING',
                            specialInstructions: payload.special_instructions ||
                                payload.customer_note || null,
                            deliveryFee,
                            packagingFee,
                            webhookLogId
                        }
                    }
                },
                include: { deliveryInfo: true }
            });

            // Deduct ingredients
            for (const item of mappedItems) {
                const recipe = await tx.menuItemIngredient.findMany({
                    where: { menuItemId: item.menuItemId },
                    include: { ingredient: true }
                });

                for (const recipeItem of recipe) {
                    const totalRequired = recipeItem.quantity * item.quantity;

                    if (recipeItem.ingredient.currentStock < totalRequired) {
                        throw new Error(
                            `Insufficient stock for ${recipeItem.ingredient.name}`
                        );
                    }

                    await tx.ingredient.update({
                        where: { id: recipeItem.ingredientId },
                        data: { currentStock: { decrement: totalRequired } }
                    });
                }
            }

            return newOrder;
        });

        return { success: true, orderId: order.id, billNumber: order.billNumber };
    } catch (error) {
        throw new Error(`Failed to create order: ${error.message}`);
    }
}

async function processZomatoOrderConfirmed(payload, webhookLogId) {
    try {
        const platformOrderId = payload.order_id?.toString();
        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'ZOMATO', platformOrderId },
            include: { order: true }
        });

        if (!deliveryInfo) throw new Error(`Order ${platformOrderId} not found`);

        await prisma.order.update({
            where: { id: deliveryInfo.orderId },
            data: { status: 'CONFIRMED' }
        });

        await prisma.deliveryInfo.update({
            where: { id: deliveryInfo.id },
            data: { deliveryStatus: 'CONFIRMED' }
        });

        return { success: true, orderId: deliveryInfo.orderId };
    } catch (error) {
        throw new Error(`Failed to confirm: ${error.message}`);
    }
}

async function processZomatoOrderReady(payload, webhookLogId) {
    try {
        const platformOrderId = payload.order_id?.toString();
        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'ZOMATO', platformOrderId }
        });

        if (!deliveryInfo) throw new Error(`Order not found`);

        await prisma.deliveryInfo.update({
            where: { id: deliveryInfo.id },
            data: { deliveryStatus: 'READY_FOR_PICKUP' }
        });

        return { success: true, orderId: deliveryInfo.orderId };
    } catch (error) {
        throw new Error(`Failed to mark ready: ${error.message}`);
    }
}

async function processZomatoOrderPickedUp(payload, webhookLogId) {
    try {
        const platformOrderId = payload.order_id?.toString();
        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'ZOMATO', platformOrderId }
        });

        if (!deliveryInfo) throw new Error(`Order not found`);

        await prisma.deliveryInfo.update({
            where: { id: deliveryInfo.id },
            data: {
                deliveryStatus: 'OUT_FOR_DELIVERY',
                deliveryPartnerName: payload.delivery_boy?.name || null,
                deliveryPartnerPhone: payload.delivery_boy?.phone || null
            }
        });

        return { success: true, orderId: deliveryInfo.orderId };
    } catch (error) {
        throw new Error(`Failed to update pickup: ${error.message}`);
    }
}

async function processZomatoOrderDelivered(payload, webhookLogId) {
    try {
        const platformOrderId = payload.order_id?.toString();
        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'ZOMATO', platformOrderId },
            include: { order: true }
        });

        if (!deliveryInfo) throw new Error(`Order not found`);

        await prisma.order.update({
            where: { id: deliveryInfo.orderId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date()
            }
        });

        await prisma.deliveryInfo.update({
            where: { id: deliveryInfo.id },
            data: {
                deliveryStatus: 'DELIVERED',
                deliveredAt: new Date()
            }
        });

        return { success: true, orderId: deliveryInfo.orderId };
    } catch (error) {
        throw new Error(`Failed to mark delivered: ${error.message}`);
    }
}

async function processZomatoOrderCancelled(payload, webhookLogId) {
    try {
        const platformOrderId = payload.order_id?.toString();
        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'ZOMATO', platformOrderId },
            include: { order: true }
        });

        if (!deliveryInfo) {
            logger.warn('[ZOMATO] Cancellation for unknown order');
            return { success: true };
        }

        await prisma.order.update({
            where: { id: deliveryInfo.orderId },
            data: { status: 'CANCELLED' }
        });

        await prisma.deliveryInfo.update({
            where: { id: deliveryInfo.id },
            data: { deliveryStatus: 'CANCELLED' }
        });

        return { success: true, orderId: deliveryInfo.orderId };
    } catch (error) {
        throw new Error(`Failed to cancel: ${error.message}`);
    }
}

async function processZomatoOrderRejected(payload, webhookLogId) {
    try {
        const platformOrderId = payload.order_id?.toString();
        const reason = payload.rejection_reason || 'Not specified';

        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'ZOMATO', platformOrderId },
            include: { order: true }
        });

        if (!deliveryInfo) {
            logger.warn('[ZOMATO] Rejection for unknown order');
            return { success: true };
        }

        await prisma.order.update({
            where: { id: deliveryInfo.orderId },
            data: {
                status: 'REJECTED',
                notes: `Rejected: ${reason}`
            }
        });

        return { success: true, orderId: deliveryInfo.orderId };
    } catch (error) {
        throw new Error(`Failed to process rejection: ${error.message}`);
    }
}

function generateBillNumber(platform) {
    const crypto = require('crypto');
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ZM${year}${month}${day}${random}`;
}

module.exports = {
    handleZomatoWebhook
};
