const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');

// All routes require authentication
router.post('/create-order', auth, paymentController.createPaymentOrder);
router.post('/verify', auth, paymentController.verifyPayment);
router.post('/manual', auth, paymentController.recordManualPayment);
router.post('/split', auth, paymentController.processSplitPayment);
router.post('/partial', auth, paymentController.recordPartialPayment);
router.get('/all', auth, paymentController.getAllPayments);
router.get('/stats', auth, paymentController.getPaymentStats);
router.get('/order/:orderId', auth, paymentController.getPaymentByOrder);
router.get('/details/:paymentId', auth, paymentController.getPaymentDetails);
router.post('/refund', auth, paymentController.refundPayment);

module.exports = router;