/**
 * Improved Swiggy Webhook Handler
 * Production-ready with signature verification, idempotency, and error handling
 */

const { prisma } = require('../../prisma');
const verifySwiggySignature = require('../../utils/verifySwiggySignature');
const WebhookRetryQueue = require('../../utils/webhookRetryQueue');
const { logIntegrationEvent } = require('../../utils/integrationLogger');
const logger = require('../../utils/logger');
const config = require('../../config/businessConfig');

/**
 * Handles Swiggy webhook events
 * Validates signature, checks idempotency, and processes events
 */
async function handleSwiggyWebhook(req, res) {
    const startTime = Date.now();
    const eventType = req.body.event_type;
    const payload = req.body.payload || req.body;
    let webhookLogId = null;

    try {
        logger.info(`[SWIGGY WEBHOOK] Received: ${eventType}`, {
            orderId: payload.order_id
        });

        // 1️⃣ SIGNATURE VERIFICATION
        const secret = process.env.SWIGGY_WEBHOOK_SECRET;
        if (!secret) {
            logger.error('[SWIGGY WEBHOOK] SWIGGY_WEBHOOK_SECRET not configured');
            return res.status(500).json({
                success: false,
                error: 'Webhook secret not configured'
            });
        }

        const isSignatureValid = verifySwiggySignature(req, secret);
        if (!isSignatureValid) {
            logger.warn('[SWIGGY WEBHOOK] Invalid signature for event', { eventType });
            return res.status(401).json({
                success: false,
                error: 'Invalid signature'
            });
        }

        logger.info('[SWIGGY WEBHOOK] Signature verified');

        // 2️⃣ IDEMPOTENCY CHECK
        // Prevent processing the same webhook twice
        const platformOrderId = payload.order_id;
        const existingOrder = await prisma.deliveryInfo.findUnique({
            where: {
                unique_platform_order: {
                    deliveryPlatform: 'SWIGGY',
                    platformOrderId: platformOrderId
                }
            },
            select: { id: true, orderId: true }
        }).catch(() => null);  // Handle if unique constraint doesn't exist yet

        if (existingOrder && eventType === 'ORDER_PLACED') {
            // Don't recreate order if it already exists
            logger.info('[SWIGGY WEBHOOK] Duplicate order detected, ignoring', {
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
                platform: 'SWIGGY',
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
            case 'ORDER_PLACED':
            case 'NEW_ORDER':
                result = await processSwiggyOrderPlaced(payload, webhookLogId);
                break;

            case 'ORDER_CONFIRMED':
                result = await processSwiggyOrderConfirmed(payload, webhookLogId);
                break;

            case 'ORDER_READY':
                result = await processSwiggyOrderReady(payload, webhookLogId);
                break;

            case 'ORDER_PICKED_UP':
                result = await processSwiggyOrderPickedUp(payload, webhookLogId);
                break;

            case 'ORDER_DELIVERED':
            case 'DELIVERY_COMPLETED':
                result = await processSwiggyOrderDelivered(payload, webhookLogId);
                break;

            case 'ORDER_CANCELLED':
            case 'DELIVERY_CANCELLED':
                result = await processSwiggyOrderCancelled(payload, webhookLogId);
                break;

            case 'ORDER_REJECTED':
                result = await processSwiggyOrderRejected(payload, webhookLogId);
                break;

            default:
                logger.warn('[SWIGGY WEBHOOK] Unhandled event type', { eventType });
                return res.status(200).json({
                    success: true,
                    message: `Event '${eventType}' acknowledged but not processed`
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
        logger.info('[SWIGGY WEBHOOK] Processed successfully', {
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

        logger.error('[SWIGGY WEBHOOK] Processing failed', {
            eventType,
            error: error.message,
            stack: error.stack,
            duration: `${duration}ms`
        });

        // Enqueue for retry if webhook log was created
        if (webhookLogId) {
            try {
                await WebhookRetryQueue.enqueue(
                    'SWIGGY',
                    eventType,
                    payload,
                    error.message,
                    0
                );
            } catch (retryError) {
                logger.error('[SWIGGY WEBHOOK] Failed to enqueue retry', {
                    error: retryError.message
                });
            }
        }

        // Always return 200 to prevent platform from retrying
        // We handle retries ourselves
        return res.status(200).json({
            success: false,
            message: 'Webhook received, processing will be retried'
        });
    }
}

/**
 * Process ORDER_PLACED event
 */
async function processSwiggyOrderPlaced(payload, webhookLogId) {
    try {
        const items = payload.items || payload.order_items || [];

        // Map items using platformItemMapping table
        const mappedItems = [];
        for (const item of items) {
            // First try exact ID match
            let mapping = await prisma.platformItemMapping.findFirst({
                where: {
                    platform: 'SWIGGY',
                    platformItemId: item.item_id?.toString() || item.id?.toString()
                }
            });

            // Fallback to name match if ID match fails
            if (!mapping) {
                const menuItem = await prisma.menuItem.findFirst({
                    where: {
                        name: {
                            contains: item.name || item.item_name,
                            mode: 'insensitive'
                        },
                        isActive: true
                    }
                });

                if (menuItem) {
                    mapping = {
                        menuItemId: menuItem.id,
                        menuItem
                    };
                }
            } else {
                mapping.menuItem = await prisma.menuItem.findUnique({
                    where: { id: mapping.menuItemId }
                });
            }

            if (!mapping) {
                logger.warn('[SWIGGY] Item not found', {
                    itemName: item.name,
                    itemId: item.item_id
                });
                continue;
            }

            mappedItems.push({
                menuItemId: mapping.menuItemId,
                name: mapping.menuItem.name,
                quantity: item.quantity || 1,
                price: mapping.menuItem.price,
                notes: item.customizations || item.variant_name || null
            });
        }

        if (mappedItems.length === 0) {
            throw new Error('No mappable items found in order');
        }

        // Create order
        const subtotal = mappedItems.reduce((sum, item) =>
            sum + (item.price * item.quantity), 0);
        const tax = subtotal * config.tax.rate;
        const deliveryFee = parseFloat(payload.delivery_charges || 0);
        const packagingFee = parseFloat(payload.packing_charges || config.delivery.defaultPackagingFee);
        const total = subtotal + tax + deliveryFee + packagingFee;

        const billNumber = generateBillNumber('SWIGGY');

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
                            customerName: payload.customer?.name || 'Swiggy Customer',
                            customerPhone: payload.customer?.phone || '',
                            customerEmail: payload.customer?.email || null,
                            deliveryAddress: payload.delivery_address?.address ||
                                payload.address ||
                                'Address not provided',
                            deliveryPlatform: 'SWIGGY',
                            platformOrderId: payload.order_id?.toString(),
                            deliveryStatus: 'PENDING',
                            specialInstructions: payload.instructions ||
                                payload.special_request || null,
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

        await logIntegrationEvent(
            'SWIGGY',
            'ORDER_PLACED',
            'INBOUND',
            '/delivery/webhook/swiggy',
            payload,
            { orderId: order.id, billNumber: order.billNumber },
            200,
            true,
            null,
            order.id
        );

        return {
            success: true,
            orderId: order.id,
            billNumber: order.billNumber
        };

    } catch (error) {
        await logIntegrationEvent(
            'SWIGGY',
            'ORDER_PLACED',
            'INBOUND',
            '/delivery/webhook/swiggy',
            payload,
            { error: error.message },
            400,
            false,
            error.message
        );

        throw error;
    }
}

/**
 * Process ORDER_CONFIRMED event
 */
async function processSwiggyOrderConfirmed(payload, webhookLogId) {
    try {
        const platformOrderId = payload.order_id?.toString();

        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: {
                deliveryPlatform: 'SWIGGY',
                platformOrderId
            },
            include: { order: true }
        });

        if (!deliveryInfo) {
            throw new Error(`Order ${platformOrderId} not found`);
        }

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
        throw new Error(`Failed to confirm order: ${error.message}`);
    }
}

/**
 * Process ORDER_READY event
 */
async function processSwiggyOrderReady(payload, webhookLogId) {
    try {
        const platformOrderId = payload.order_id?.toString();

        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: {
                deliveryPlatform: 'SWIGGY',
                platformOrderId
            },
            include: { order: true }
        });

        if (!deliveryInfo) {
            throw new Error(`Order ${platformOrderId} not found`);
        }

        await prisma.order.update({
            where: { id: deliveryInfo.orderId },
            data: { status: 'READY' }
        });

        await prisma.deliveryInfo.update({
            where: { id: deliveryInfo.id },
            data: { deliveryStatus: 'READY_FOR_PICKUP' }
        });

        return { success: true, orderId: deliveryInfo.orderId };
    } catch (error) {
        throw new Error(`Failed to mark order as ready: ${error.message}`);
    }
}

/**
 * Process ORDER_PICKED_UP event
 */
async function processSwiggyOrderPickedUp(payload, webhookLogId) {
    try {
        const platformOrderId = payload.order_id?.toString();

        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: {
                deliveryPlatform: 'SWIGGY',
                platformOrderId
            }
        });

        if (!deliveryInfo) {
            throw new Error(`Order ${platformOrderId} not found`);
        }

        await prisma.deliveryInfo.update({
            where: { id: deliveryInfo.id },
            data: {
                deliveryStatus: 'OUT_FOR_DELIVERY',
                deliveryPartnerName: payload.delivery_executive?.name || null,
                deliveryPartnerPhone: payload.delivery_executive?.phone || null
            }
        });

        return { success: true, orderId: deliveryInfo.orderId };
    } catch (error) {
        throw new Error(`Failed to update pickup status: ${error.message}`);
    }
}

/**
 * Process ORDER_DELIVERED event
 */
async function processSwiggyOrderDelivered(payload, webhookLogId) {
    try {
        const platformOrderId = payload.order_id?.toString();

        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: {
                deliveryPlatform: 'SWIGGY',
                platformOrderId
            },
            include: { order: true }
        });

        if (!deliveryInfo) {
            throw new Error(`Order ${platformOrderId} not found`);
        }

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
        throw new Error(`Failed to mark order as delivered: ${error.message}`);
    }
}

/**
 * Process ORDER_CANCELLED event
 */
async function processSwiggyOrderCancelled(payload, webhookLogId) {
    try {
        const platformOrderId = payload.order_id?.toString();

        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: {
                deliveryPlatform: 'SWIGGY',
                platformOrderId
            },
            include: { order: true }
        });

        if (!deliveryInfo) {
            logger.warn('[SWIGGY] Cancellation for unknown order', {
                platformOrderId
            });
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
        throw new Error(`Failed to cancel order: ${error.message}`);
    }
}

/**
 * Process ORDER_REJECTED event
 */
async function processSwiggyOrderRejected(payload, webhookLogId) {
    try {
        const platformOrderId = payload.order_id?.toString();
        const reason = payload.rejection_reason || 'Not specified';

        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: {
                deliveryPlatform: 'SWIGGY',
                platformOrderId
            },
            include: { order: true }
        });

        if (!deliveryInfo) {
            logger.warn('[SWIGGY] Rejection for unknown order', {
                platformOrderId
            });
            return { success: true };
        }

        await prisma.order.update({
            where: { id: deliveryInfo.orderId },
            data: {
                status: 'REJECTED',
                notes: `Rejected by partner: ${reason}`
            }
        });

        await prisma.deliveryInfo.update({
            where: { id: deliveryInfo.id },
            data: {
                deliveryStatus: 'REJECTED',
                specialInstructions: `Rejection reason: ${reason}`
            }
        });

        return { success: true, orderId: deliveryInfo.orderId };
    } catch (error) {
        throw new Error(`Failed to process rejection: ${error.message}`);
    }
}

/**
 * Helper: Generate bill number
 */
function generateBillNumber(platform) {
    const crypto = require('crypto');
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `SW${year}${month}${day}${random}`;
}

module.exports = {
    handleSwiggyWebhook
};
