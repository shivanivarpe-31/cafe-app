const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');
const { handleSwiggyWebhook } = require('../integrations/swiggy/swiggyWebhookHandler');
const { handleZomatoWebhook } = require('../integrations/zomato/zomatoWebhookHandler');
const auth = require('../middleware/auth');
const { adminOrManager } = require('../middleware/authorize');

// Delivery management - Admin and Manager only
router.get('/', auth, adminOrManager, deliveryController.getDeliveryOrders);
router.get('/stats', auth, adminOrManager, deliveryController.getDeliveryStats);
router.post('/takeaway', auth, adminOrManager, deliveryController.createTakeawayOrder);
router.post('/delivery', auth, adminOrManager, deliveryController.createDeliveryOrder);
router.put('/:id/status', auth, adminOrManager, deliveryController.updateDeliveryStatus);

// Simulation endpoint for testing - Admin and Manager only
router.post('/simulate', auth, adminOrManager, deliveryController.simulateOnlineOrder);

// Webhook routes (no auth - verified by platform signatures)
// Use production-ready handlers with signature verification
router.post('/webhook/zomato', handleZomatoWebhook);
router.post('/webhook/swiggy', handleSwiggyWebhook);

module.exports = router;