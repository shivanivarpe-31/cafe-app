const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');
const { handleSwiggyWebhook } = require('../integrations/swiggy/swiggyWebhookHandler');
const { handleZomatoWebhook } = require('../integrations/zomato/zomatoWebhookHandler');
const zomatoApi = require('../integrations/zomato/zomatoApiClient');
const swiggyApi = require('../integrations/swiggy/swiggyApiClient');
const auth = require('../middleware/auth');
const { adminOrManager } = require('../middleware/authorize');

const { prisma } = require('../prisma');

// Delivery management - Admin and Manager only
router.get('/', auth, adminOrManager, deliveryController.getDeliveryOrders);
router.get('/stats', auth, adminOrManager, deliveryController.getDeliveryStats);
router.post('/takeaway', auth, adminOrManager, deliveryController.createTakeawayOrder);
router.post('/delivery', auth, adminOrManager, deliveryController.createDeliveryOrder);
router.put('/:id/status', auth, adminOrManager, deliveryController.updateDeliveryStatus);

// Simulation endpoint for testing - Admin and Manager only
router.post('/simulate', auth, adminOrManager, deliveryController.simulateOnlineOrder);

// ── Zomato Outbound API Actions (manual triggers from staff) ──

// Confirm a Zomato order with platform
router.post('/zomato/confirm', auth, adminOrManager, async (req, res, next) => {
    try {
        const { platformOrderId, prepTime } = req.body;
        if (!platformOrderId) return res.status(400).json({ error: 'platformOrderId is required' });

        // Call Zomato API
        const result = await zomatoApi.confirmOrder(platformOrderId, prepTime);

        // Update local order status
        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'ZOMATO', platformOrderId: platformOrderId.toString() }
        });
        if (deliveryInfo) {
            await prisma.order.update({
                where: { id: deliveryInfo.orderId },
                data: { status: 'PREPARING' }
            });
            await prisma.deliveryInfo.update({
                where: { id: deliveryInfo.id },
                data: {
                    deliveryStatus: 'CONFIRMED',
                    confirmationStatus: 'ACCEPTED',
                    confirmedBy: req.user?.userId || null,
                    confirmedAt: new Date(),
                    preparationTime: prepTime || null
                }
            });
        }

        res.json({ success: true, message: 'Order confirmed with Zomato', result });
    } catch (error) { next(error); }
});

// Reject a Zomato order
router.post('/zomato/reject', auth, adminOrManager, async (req, res, next) => {
    try {
        const { platformOrderId, reason } = req.body;
        if (!platformOrderId) return res.status(400).json({ error: 'platformOrderId is required' });

        const result = await zomatoApi.rejectOrder(platformOrderId, reason);

        // Update local order status
        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'ZOMATO', platformOrderId: platformOrderId.toString() }
        });
        if (deliveryInfo) {
            await prisma.order.update({
                where: { id: deliveryInfo.orderId },
                data: { status: 'CANCELLED' }
            });
            await prisma.deliveryInfo.update({
                where: { id: deliveryInfo.id },
                data: {
                    deliveryStatus: 'CANCELLED',
                    confirmationStatus: 'REJECTED',
                    rejectionReason: reason || 'Rejected by restaurant'
                }
            });
        }

        res.json({ success: true, message: 'Order rejected on Zomato', result });
    } catch (error) { next(error); }
});

// Mark order as ready on Zomato
router.post('/zomato/ready', auth, adminOrManager, async (req, res, next) => {
    try {
        const { platformOrderId, itemCheckList } = req.body;
        if (!platformOrderId) return res.status(400).json({ error: 'platformOrderId is required' });

        const result = await zomatoApi.markOrderReady(platformOrderId, itemCheckList ?? null);

        // Update local delivery status
        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'ZOMATO', platformOrderId: platformOrderId.toString() }
        });
        if (deliveryInfo) {
            await prisma.deliveryInfo.update({
                where: { id: deliveryInfo.id },
                data: { deliveryStatus: 'READY_FOR_PICKUP' }
            });
            await prisma.order.update({
                where: { id: deliveryInfo.orderId },
                data: { status: 'SERVED' }
            });
        }

        res.json({ success: true, message: 'Order marked ready on Zomato', result });
    } catch (error) { next(error); }
});

// Self-logistics: Assign own delivery partner and notify Zomato
router.post('/zomato/assign-rider', auth, adminOrManager, async (req, res, next) => {
    try {
        const { platformOrderId, name, phone } = req.body;
        if (!platformOrderId) return res.status(400).json({ error: 'platformOrderId is required' });
        if (!name) return res.status(400).json({ error: 'Delivery partner name is required' });

        const result = await zomatoApi.assignDeliveryPartner(platformOrderId, { name, phone });

        // Update local delivery status
        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'ZOMATO', platformOrderId: platformOrderId.toString() }
        });
        if (deliveryInfo) {
            await prisma.deliveryInfo.update({
                where: { id: deliveryInfo.id },
                data: {
                    deliveryStatus: 'RIDER_ASSIGNED',
                    deliveryPartnerName: name,
                    deliveryPartnerPhone: phone || null
                }
            });
        }

        res.json({ success: true, message: 'Delivery partner assigned on Zomato', result });
    } catch (error) { next(error); }
});

// Self-logistics: Mark order as picked up and notify Zomato
router.post('/zomato/picked-up', auth, adminOrManager, async (req, res, next) => {
    try {
        const { platformOrderId } = req.body;
        if (!platformOrderId) return res.status(400).json({ error: 'platformOrderId is required' });

        const result = await zomatoApi.markOrderPickedUp(platformOrderId);

        // Update local delivery status
        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'ZOMATO', platformOrderId: platformOrderId.toString() }
        });
        if (deliveryInfo) {
            await prisma.deliveryInfo.update({
                where: { id: deliveryInfo.id },
                data: { deliveryStatus: 'OUT_FOR_DELIVERY' }
            });
        }

        res.json({ success: true, message: 'Order marked as picked up on Zomato', result });
    } catch (error) { next(error); }
});

// Self-logistics: Mark order as delivered and notify Zomato
router.post('/zomato/delivered', auth, adminOrManager, async (req, res, next) => {
    try {
        const { platformOrderId } = req.body;
        if (!platformOrderId) return res.status(400).json({ error: 'platformOrderId is required' });

        const result = await zomatoApi.markOrderDelivered(platformOrderId);

        // Update local order to completed
        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'ZOMATO', platformOrderId: platformOrderId.toString() }
        });
        if (deliveryInfo) {
            await prisma.order.update({
                where: { id: deliveryInfo.orderId },
                data: { status: 'PAID', paidAt: new Date() }
            });
            await prisma.deliveryInfo.update({
                where: { id: deliveryInfo.id },
                data: {
                    deliveryStatus: 'DELIVERED',
                    deliveredAt: new Date()
                }
            });
        }

        res.json({ success: true, message: 'Order marked as delivered on Zomato', result });
    } catch (error) { next(error); }
});

// Get masked contact details from Zomato
router.get('/zomato/contact/:platformOrderId', auth, adminOrManager, async (req, res, next) => {
    try {
        const result = await zomatoApi.getContactDetails(req.params.platformOrderId);
        res.json({ success: true, contact: result });
    } catch (error) { next(error); }
});

// Respond to MAC (cancellation request)
router.post('/zomato/mac', auth, adminOrManager, async (req, res, next) => {
    try {
        const { platformOrderId, accepted, reason } = req.body;
        if (!platformOrderId) return res.status(400).json({ error: 'platformOrderId is required' });
        const result = await zomatoApi.updateMerchantAgreedCancellation(platformOrderId, accepted, reason);
        res.json({ success: true, message: accepted ? 'Cancellation accepted' : 'Cancellation rejected', result });
    } catch (error) { next(error); }
});

// ── Swiggy Outbound API Actions (manual triggers from staff) ──

// Confirm a Swiggy order
router.post('/swiggy/confirm', auth, adminOrManager, async (req, res, next) => {
    try {
        const { platformOrderId, prepTime } = req.body;
        if (!platformOrderId) return res.status(400).json({ error: 'platformOrderId is required' });

        const result = await swiggyApi.confirmOrder(platformOrderId, prepTime);

        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'SWIGGY', platformOrderId: platformOrderId.toString() }
        });
        if (deliveryInfo) {
            await prisma.order.update({
                where: { id: deliveryInfo.orderId },
                data: { status: 'PREPARING' }
            });
            await prisma.deliveryInfo.update({
                where: { id: deliveryInfo.id },
                data: {
                    deliveryStatus: 'CONFIRMED',
                    confirmationStatus: 'ACCEPTED',
                    confirmedBy: req.user?.userId || null,
                    confirmedAt: new Date(),
                    preparationTime: prepTime || null
                }
            });
        }

        res.json({ success: true, message: 'Order confirmed with Swiggy', result });
    } catch (error) { next(error); }
});

// Reject a Swiggy order
router.post('/swiggy/reject', auth, adminOrManager, async (req, res, next) => {
    try {
        const { platformOrderId, reason } = req.body;
        if (!platformOrderId) return res.status(400).json({ error: 'platformOrderId is required' });

        const result = await swiggyApi.rejectOrder(platformOrderId, reason);

        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'SWIGGY', platformOrderId: platformOrderId.toString() }
        });
        if (deliveryInfo) {
            await prisma.order.update({
                where: { id: deliveryInfo.orderId },
                data: { status: 'CANCELLED' }
            });
            await prisma.deliveryInfo.update({
                where: { id: deliveryInfo.id },
                data: {
                    deliveryStatus: 'CANCELLED',
                    confirmationStatus: 'REJECTED',
                    rejectionReason: reason || 'Rejected by restaurant'
                }
            });
        }

        res.json({ success: true, message: 'Order rejected on Swiggy', result });
    } catch (error) { next(error); }
});

// Mark Swiggy order as ready
router.post('/swiggy/ready', auth, adminOrManager, async (req, res, next) => {
    try {
        const { platformOrderId } = req.body;
        if (!platformOrderId) return res.status(400).json({ error: 'platformOrderId is required' });

        const result = await swiggyApi.markOrderReady(platformOrderId);

        const deliveryInfo = await prisma.deliveryInfo.findFirst({
            where: { deliveryPlatform: 'SWIGGY', platformOrderId: platformOrderId.toString() }
        });
        if (deliveryInfo) {
            await prisma.deliveryInfo.update({
                where: { id: deliveryInfo.id },
                data: { deliveryStatus: 'READY_FOR_PICKUP' }
            });
            await prisma.order.update({
                where: { id: deliveryInfo.orderId },
                data: { status: 'SERVED' }
            });
        }

        res.json({ success: true, message: 'Order marked ready on Swiggy', result });
    } catch (error) { next(error); }
});

// Webhook routes (no auth - verified by platform signatures)
// Use production-ready handlers with signature verification
router.post('/webhook/zomato', handleZomatoWebhook);
router.post('/webhook/swiggy', handleSwiggyWebhook);

module.exports = router;