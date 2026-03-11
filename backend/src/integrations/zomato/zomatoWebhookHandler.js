/**
 * Improved Zomato Webhook Handler
 * Production-ready with signature verification, idempotency, and error handling
 * 
 * Handles these Zomato webhooks:
 * - Order Relay Webhook (new orders)
 * - Order Status Update Webhook (rejections/timeouts)  
 * - Fetch Order Status Update Webhook (Zomato polling for status)
 * - Delivery Partner Status Update Webhook (rider assigned/picked up)
 * - Order Rating Update Webhook
 * - Complaint Relay Webhook
 * - Merchant Agreed Cancellation (MAC) Relay Webhook
 */

const { prisma } = require('../../prisma');
const verifyZomatoSignature = require('../../utils/verifyZomatoSignature');
const WebhookRetryQueue = require('../../utils/webhookRetryQueue');
const { logIntegrationEvent } = require('../../utils/integrationLogger');
const { confirmOrder, rejectOrder, notifyZomatoStatusChange } = require('./zomatoApiClient');
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
        // Try DB config first, fall back to env var
        let secret;
        try {
            const platformConfig = await prisma.platformConfig.findUnique({
                where: { platform: 'ZOMATO' }
            });
            secret = platformConfig?.webhookSecret || process.env.ZOMATO_WEBHOOK_SECRET;
        } catch {
            secret = process.env.ZOMATO_WEBHOOK_SECRET;
        }
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
            // ── Order Relay Webhook ──
            case 'order.placed':
            case 'order.created':
                result = await processZomatoOrderPlaced(payload, webhookLogId);
                break;

            // ── Order Status Update Webhook (from Zomato side) ──
            case 'order.confirmed':
                result = await processZomatoOrderConfirmed(payload, webhookLogId);
                break;

            case 'order.ready':
                result = await processZomatoOrderReady(payload, webhookLogId);
                break;

            // ── Delivery Partner Status Update Webhook ──
            case 'order.assigned':
                result = await processZomatoDeliveryPartnerAssigned(payload, webhookLogId);
                break;

            case 'order.picked_up':
            case 'order.out_for_delivery':
                result = await processZomatoOrderPickedUp(payload, webhookLogId);
                break;

            case 'order.delivered':
                result = await processZomatoOrderDelivered(payload, webhookLogId);
                break;

            // ── Cancellation & Rejection ──
            case 'order.cancelled':
                result = await processZomatoOrderCancelled(payload, webhookLogId);
                break;

            case 'order.rejected':
            case 'order.timeout':
                result = await processZomatoOrderRejected(payload, webhookLogId);
                break;

            // ── Fetch Order Status Update Webhook ──
            // Zomato asks for current status when POS hasn't sent updates in time
            case 'order.status_fetch':
            case 'order.status_check':
                result = await processZomatoStatusFetch(payload, webhookLogId);
                break;

            // ── Order Rating Update Webhook ──
            case 'order.rating':
            case 'order.rating_update':
                result = await processZomatoOrderRating(payload, webhookLogId);
                break;

            // ── Complaint Relay Webhook ──
            case 'order.complaint':
            case 'complaint.created':
                result = await processZomatoComplaint(payload, webhookLogId);
                break;

            // ── Merchant Agreed Cancellation (MAC) Relay Webhook ──
            case 'order.mac':
            case 'order.cancellation_request':
                result = await processZomatoMACRequest(payload, webhookLogId);
                break;

            // ── Menu Processing Status Webhook ──
            case 'menu.processing_status':
            case 'menu.processing':
            case 'menu_processing_status':
                result = await processMenuProcessingStatus(payload, webhookLogId);
                break;

            // ── Menu Moderation Status Webhook ──
            case 'menu.moderation_status':
            case 'menu.moderation':
            case 'menu_moderation_status':
                result = await processMenuModerationStatus(payload, webhookLogId);
                break;

            // ── Outlet Serviceability Status Webhook ──
            case 'outlet.serviceability_status':
            case 'outlet.serviceability':
            case 'restaurant.serviceability_status':
                result = await processOutletServiceabilityStatus(payload, webhookLogId);
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
            let mapping = await prisma.menuItemMapping.findFirst({
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
                            webhookLogId,
                            orderTags: payload.order_tags ? JSON.stringify(payload.order_tags) : null
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

        // AUTO-CONFIRM with Zomato if autoAcceptOrders is enabled
        try {
            const platformConfig = await prisma.platformConfig.findUnique({
                where: { platform: 'ZOMATO' }
            });
            if (platformConfig?.autoAcceptOrders) {
                await confirmOrder(
                    payload.order_id?.toString(),
                    platformConfig.defaultPrepTime || 30
                );

                // Update local status to reflect confirmation
                await prisma.order.update({
                    where: { id: order.id },
                    data: { status: 'PREPARING' }
                });
                await prisma.deliveryInfo.update({
                    where: { orderId: order.id },
                    data: {
                        deliveryStatus: 'CONFIRMED',
                        confirmationStatus: 'ACCEPTED',
                        confirmedAt: new Date(),
                        preparationTime: platformConfig.defaultPrepTime || 30
                    }
                });

                logger.info('[ZOMATO] Order auto-confirmed with Zomato', {
                    platformOrderId: payload.order_id
                });
            }
        } catch (confirmError) {
            // Don't fail the order creation if Zomato confirm fails
            logger.warn('[ZOMATO] Auto-confirm failed, manual confirmation needed', {
                error: confirmError.message
            });
        }

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

        // CONFIRMED maps to PREPARING in our OrderStatus enum
        await prisma.order.update({
            where: { id: deliveryInfo.orderId },
            data: { status: 'PREPARING' }
        });

        await prisma.deliveryInfo.update({
            where: { id: deliveryInfo.id },
            data: {
                deliveryStatus: 'CONFIRMED',
                confirmedAt: new Date()
            }
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

        // DELIVERED maps to PAID in our OrderStatus enum (order is complete)
        await prisma.order.update({
            where: { id: deliveryInfo.orderId },
            data: {
                status: 'PAID',
                paidAt: new Date()
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
            include: { order: { include: { items: true } } }
        });

        if (!deliveryInfo) {
            logger.warn('[ZOMATO] Cancellation for unknown order');
            return { success: true };
        }

        const wasPreparing = ['PREPARING', 'SERVED'].includes(deliveryInfo.order.status);

        await prisma.$transaction(async (tx) => {
            await tx.order.update({
                where: { id: deliveryInfo.orderId },
                data: { status: 'CANCELLED' }
            });

            await tx.deliveryInfo.update({
                where: { id: deliveryInfo.id },
                data: { deliveryStatus: 'CANCELLED' }
            });

            // Refund ingredients if order was already being prepared
            if (wasPreparing) {
                for (const orderItem of deliveryInfo.order.items) {
                    const recipe = await tx.menuItemIngredient.findMany({
                        where: { menuItemId: orderItem.menuItemId }
                    });
                    for (const recipeItem of recipe) {
                        await tx.ingredient.update({
                            where: { id: recipeItem.ingredientId },
                            data: { currentStock: { increment: recipeItem.quantity * orderItem.quantity } }
                        });
                    }
                }
                logger.info('[ZOMATO] Ingredients refunded for cancelled order', {
                    orderId: deliveryInfo.orderId
                });
            }
        });

        return { success: true, orderId: deliveryInfo.orderId };
    } catch (error) {
        throw new Error(`Failed to cancel: ${error.message}`);
    }
}

async function processZomatoOrderRejected(payload, webhookLogId) {
    try {
        const platformOrderId = payload.order_id?.toString();
        const reason = payload.rejection_reason || payload.reason || 'Not specified';

        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'ZOMATO', platformOrderId },
            include: { order: true }
        });

        if (!deliveryInfo) {
            logger.warn('[ZOMATO] Rejection for unknown order');
            return { success: true };
        }

        // REJECTED maps to CANCELLED in our OrderStatus enum
        await prisma.order.update({
            where: { id: deliveryInfo.orderId },
            data: { status: 'CANCELLED' }
        });

        await prisma.deliveryInfo.update({
            where: { id: deliveryInfo.id },
            data: {
                deliveryStatus: 'CANCELLED',
                rejectionReason: reason
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

// ── New handlers for missing Zomato webhook types ──────────────────

/**
 * Delivery Partner Status Update Webhook - partner assigned
 */
async function processZomatoDeliveryPartnerAssigned(payload, webhookLogId) {
    try {
        const platformOrderId = payload.order_id?.toString();
        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'ZOMATO', platformOrderId }
        });

        if (!deliveryInfo) throw new Error(`Order not found`);

        // "rider-assigned" status per Zomato docs
        await prisma.deliveryInfo.update({
            where: { id: deliveryInfo.id },
            data: {
                deliveryStatus: 'RIDER_ASSIGNED',
                deliveryPartnerName: payload.delivery_partner?.name
                    || payload.delivery_boy?.name || null,
                deliveryPartnerPhone: payload.delivery_partner?.phone
                    || payload.delivery_boy?.phone || null
            }
        });

        return { success: true, orderId: deliveryInfo.orderId };
    } catch (error) {
        throw new Error(`Failed to assign delivery partner: ${error.message}`);
    }
}

/**
 * Fetch Order Status Update Webhook
 * Zomato asks for current order status when POS hasn't sent updates in time
 * We respond with the current status from our DB
 */
async function processZomatoStatusFetch(payload, webhookLogId) {
    try {
        const platformOrderId = payload.order_id?.toString();
        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'ZOMATO', platformOrderId },
            include: { order: true }
        });

        if (!deliveryInfo) {
            return { success: true, status: 'NOT_FOUND' };
        }

        // Map our delivery status back and notify Zomato
        await notifyZomatoStatusChange(platformOrderId, deliveryInfo.deliveryStatus);

        return {
            success: true,
            orderId: deliveryInfo.orderId,
            currentStatus: deliveryInfo.deliveryStatus
        };
    } catch (error) {
        throw new Error(`Failed to process status fetch: ${error.message}`);
    }
}

/**
 * Order Rating Update Webhook
 * Stores customer rating for a completed order
 */
async function processZomatoOrderRating(payload, webhookLogId) {
    try {
        const platformOrderId = payload.order_id?.toString();
        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'ZOMATO', platformOrderId }
        });

        if (!deliveryInfo) {
            logger.warn('[ZOMATO] Rating for unknown order', { platformOrderId });
            return { success: true };
        }

        // Store rating in platformResponse JSON field
        const ratingData = {
            rating: payload.rating || payload.order_rating,
            review: payload.review || payload.comment,
            ratedAt: new Date().toISOString()
        };

        await prisma.deliveryInfo.update({
            where: { id: deliveryInfo.id },
            data: {
                platformResponse: JSON.stringify(ratingData)
            }
        });

        logger.info('[ZOMATO] Order rating received', {
            platformOrderId,
            rating: ratingData.rating
        });

        return { success: true, orderId: deliveryInfo.orderId };
    } catch (error) {
        throw new Error(`Failed to process rating: ${error.message}`);
    }
}

/**
 * Complaint Relay Webhook
 * Records customer complaints for orders
 */
async function processZomatoComplaint(payload, webhookLogId) {
    try {
        const platformOrderId = payload.order_id?.toString();
        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'ZOMATO', platformOrderId }
        });

        if (!deliveryInfo) {
            logger.warn('[ZOMATO] Complaint for unknown order', { platformOrderId });
            return { success: true };
        }

        // Log complaint in integration log for visibility
        await logIntegrationEvent({
            platform: 'ZOMATO',
            eventType: 'COMPLAINT_RECEIVED',
            direction: 'INBOUND',
            requestBody: JSON.stringify(payload),
            success: true,
            orderId: deliveryInfo.orderId
        }).catch(() => { });

        logger.warn('[ZOMATO] Complaint received', {
            platformOrderId,
            complaintType: payload.complaint_type || payload.type,
            description: payload.description || payload.message
        });

        return { success: true, orderId: deliveryInfo.orderId };
    } catch (error) {
        throw new Error(`Failed to process complaint: ${error.message}`);
    }
}

/**
 * Merchant Agreed Cancellation (MAC) Relay Webhook
 * Customer requests cancellation — auto-accept or log for manual review
 */
async function processZomatoMACRequest(payload, webhookLogId) {
    try {
        const platformOrderId = payload.order_id?.toString();
        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'ZOMATO', platformOrderId },
            include: { order: true }
        });

        if (!deliveryInfo) {
            logger.warn('[ZOMATO] MAC request for unknown order', { platformOrderId });
            return { success: true };
        }

        // Log the MAC request
        await logIntegrationEvent({
            platform: 'ZOMATO',
            eventType: 'MAC_REQUEST',
            direction: 'INBOUND',
            requestBody: JSON.stringify(payload),
            success: true,
            orderId: deliveryInfo.orderId
        }).catch(() => { });

        // If the order is still PENDING, auto-accept the cancellation
        if (deliveryInfo.order.status === 'PENDING') {
            const { updateMerchantAgreedCancellation } = require('./zomatoApiClient');
            await updateMerchantAgreedCancellation(platformOrderId, true, 'Order not yet started');

            await prisma.order.update({
                where: { id: deliveryInfo.orderId },
                data: { status: 'CANCELLED' }
            });

            await prisma.deliveryInfo.update({
                where: { id: deliveryInfo.id },
                data: { deliveryStatus: 'CANCELLED' }
            });

            logger.info('[ZOMATO] MAC auto-accepted (order was PENDING)', { platformOrderId });
        } else {
            // For in-progress orders, log for manual review
            logger.warn('[ZOMATO] MAC request needs manual review (order in progress)', {
                platformOrderId,
                currentStatus: deliveryInfo.order.status
            });
        }

        return { success: true, orderId: deliveryInfo.orderId };
    } catch (error) {
        throw new Error(`Failed to process MAC: ${error.message}`);
    }
}

// ── Menu Webhooks ──────────────────────────────────────────────────

/**
 * Menu Processing Callback Notification
 * Zomato sends this to inform about success/failure state of menu processing.
 * 
 * On success: restaurant gets toggled back on in Zomato search.
 * On failure: contains error details about what failed validation.
 */
async function processMenuProcessingStatus(payload, webhookLogId) {
    try {
        const status = payload.status || payload.processing_status; // 'success' | 'failure'
        const errors = payload.errors || payload.error_details || [];
        const menuId = payload.menu_id || payload.request_id;

        const errorMsg = status !== 'success'
            ? (Array.isArray(errors) ? errors.map(e => e.message || e.error || JSON.stringify(e)).join('; ') : String(errors))
            : null;

        await logIntegrationEvent({
            platform: 'ZOMATO',
            eventType: 'MENU_PROCESSING_STATUS',
            direction: 'INBOUND',
            requestBody: JSON.stringify(payload),
            success: status === 'success',
            errorMessage: errorMsg
        }).catch(() => { });

        // Store processing result in PlatformConfig settings for frontend visibility
        try {
            const currentConfig = await prisma.platformConfig.findUnique({
                where: { platform: 'ZOMATO' }
            });
            if (currentConfig) {
                let settings = {};
                try { if (currentConfig.settings) settings = JSON.parse(currentConfig.settings); } catch { /* */ }
                settings.lastMenuProcessing = {
                    status,
                    menuId,
                    errors: status !== 'success' ? errors : [],
                    processedAt: new Date().toISOString()
                };
                await prisma.platformConfig.update({
                    where: { platform: 'ZOMATO' },
                    data: {
                        settings: JSON.stringify(settings),
                        // Only update lastMenuSync on success (restaurant toggled back on)
                        ...(status === 'success' ? { lastMenuSync: new Date() } : {})
                    }
                });
            }
        } catch (updateErr) {
            logger.warn('[ZOMATO MENU] Failed to save processing status to config', { error: updateErr.message });
        }

        if (status === 'success') {
            logger.info('[ZOMATO MENU] Menu processing succeeded — restaurant toggled back on', { menuId });
        } else {
            logger.error('[ZOMATO MENU] Menu processing failed — restaurant may remain toggled off', {
                menuId,
                errors
            });
        }

        return { success: true, menuStatus: status, errors: status !== 'success' ? errors : undefined };
    } catch (error) {
        throw new Error(`Failed to process menu status: ${error.message}`);
    }
}

/**
 * Menu Moderation Callback Notification
 * Zomato sends this to inform about the moderation status of the menu.
 * Items may be approved, rejected, or need changes.
 * 
 * Rejected items will be deactivated in our mappings so they aren't
 * included in future syncs until the issue is resolved.
 */
async function processMenuModerationStatus(payload, webhookLogId) {
    try {
        const status = payload.status || payload.moderation_status; // 'approved' | 'rejected' | 'partial'
        const items = payload.items || payload.moderated_items || payload.catalogues || [];

        const rejectedItems = items.filter(i => i.status === 'rejected');

        await logIntegrationEvent({
            platform: 'ZOMATO',
            eventType: 'MENU_MODERATION_STATUS',
            direction: 'INBOUND',
            requestBody: JSON.stringify(payload),
            success: status === 'approved',
            errorMessage: rejectedItems.length > 0
                ? `Moderation: ${rejectedItems.length} items rejected`
                : null
        }).catch(() => { });

        // Process individual item moderation results
        const moderationDetails = [];
        for (const item of items) {
            const itemId = item.item_id || item.vendorEntityId || item.vendor_entity_id;
            if (!itemId) continue;

            const mapping = await prisma.menuItemMapping.findFirst({
                where: {
                    platform: 'ZOMATO',
                    platformItemId: itemId.toString()
                }
            });

            const detail = {
                platformItemId: itemId,
                localMenuItemId: mapping?.menuItemId || null,
                status: item.status,
                reason: item.reason || item.rejection_reason || item.message || null
            };
            moderationDetails.push(detail);

            if (mapping && item.status === 'rejected') {
                // Deactivate rejected mappings so they aren't synced again until fixed
                await prisma.menuItemMapping.update({
                    where: { id: mapping.id },
                    data: { isActive: false }
                });

                logger.warn('[ZOMATO MENU] Item rejected by moderation', detail);
            }
        }

        // Store moderation result in PlatformConfig settings
        try {
            const currentConfig = await prisma.platformConfig.findUnique({
                where: { platform: 'ZOMATO' }
            });
            if (currentConfig) {
                let settings = {};
                try { if (currentConfig.settings) settings = JSON.parse(currentConfig.settings); } catch { /* */ }
                settings.lastMenuModeration = {
                    status,
                    totalItems: items.length,
                    approved: items.filter(i => i.status === 'approved').length,
                    rejected: rejectedItems.length,
                    details: moderationDetails,
                    moderatedAt: new Date().toISOString()
                };
                await prisma.platformConfig.update({
                    where: { platform: 'ZOMATO' },
                    data: { settings: JSON.stringify(settings) }
                });
            }
        } catch (updateErr) {
            logger.warn('[ZOMATO MENU] Failed to save moderation status to config', { error: updateErr.message });
        }

        logger.info('[ZOMATO MENU] Moderation status received', {
            status,
            totalItems: items.length,
            approved: items.filter(i => i.status === 'approved').length,
            rejected: rejectedItems.length
        });

        return { success: true, moderationStatus: status };
    } catch (error) {
        throw new Error(`Failed to process moderation status: ${error.message}`);
    }
}

// ── Outlet Management Webhooks ─────────────────────────────────────

/**
 * Outlet Serviceability Status Webhook
 * Zomato notifies when the serviceability status of the outlet changes
 * (e.g. outlet goes offline/online, delivery toggled by Zomato)
 */
async function processOutletServiceabilityStatus(payload, webhookLogId) {
    try {
        const status = payload.status || payload.serviceability_status;
        const reason = payload.reason || payload.message;
        const restaurantId = payload.restaurant_id || payload.outlet_id;

        await logIntegrationEvent({
            platform: 'ZOMATO',
            eventType: 'OUTLET_SERVICEABILITY_STATUS',
            direction: 'INBOUND',
            requestBody: JSON.stringify(payload),
            success: true,
            errorMessage: null
        }).catch(() => { });

        // Update PlatformConfig to reflect new status
        try {
            const currentConfig = await prisma.platformConfig.findUnique({
                where: { platform: 'ZOMATO' }
            });
            if (currentConfig) {
                let settings = {};
                if (currentConfig.settings) {
                    try { settings = JSON.parse(currentConfig.settings); } catch { /* ignore */ }
                }
                settings.outletServiceability = {
                    status,
                    reason,
                    updatedAt: new Date().toISOString(),
                    restaurantId
                };
                await prisma.platformConfig.update({
                    where: { platform: 'ZOMATO' },
                    data: { settings: JSON.stringify(settings) }
                });
            }
        } catch (updateErr) {
            logger.warn('[ZOMATO] Failed to update serviceability in config', {
                error: updateErr.message
            });
        }

        logger.info('[ZOMATO OUTLET] Serviceability status changed', {
            status,
            reason,
            restaurantId
        });

        return { success: true, serviceabilityStatus: status };
    } catch (error) {
        throw new Error(`Failed to process serviceability status: ${error.message}`);
    }
}

module.exports = {
    handleZomatoWebhook
};
