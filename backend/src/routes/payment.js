const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');
const { adminOnly, adminOrManager } = require('../middleware/authorize');

// Payment routes - Admin and Manager only
router.post('/create-order', auth, adminOrManager, paymentController.createPaymentOrder);
router.post('/verify', auth, adminOrManager, paymentController.verifyPayment);
router.post('/manual', auth, adminOrManager, paymentController.recordManualPayment);
router.post('/split', auth, adminOrManager, paymentController.processSplitPayment);
router.post('/partial', auth, adminOrManager, paymentController.recordPartialPayment);
router.get('/all', auth, adminOrManager, paymentController.getAllPayments);
router.get('/stats', auth, adminOrManager, paymentController.getPaymentStats);
router.get('/order/:orderId', auth, adminOrManager, paymentController.getPaymentByOrder);
router.get('/details/:paymentId', auth, adminOrManager, paymentController.getPaymentDetails);

// Refund route - Admin only (sensitive operation)
router.post('/refund', auth, adminOnly, paymentController.refundPayment);

module.exports = router;