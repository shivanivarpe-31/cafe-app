const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const auth = require('../middleware/auth');
const { adminOrManager } = require('../middleware/authorize');

router.get('/', auth, adminOrManager, customerController.getCustomers);
router.get('/:id', auth, adminOrManager, customerController.getCustomerById);
router.post('/:id/whatsapp', auth, adminOrManager, customerController.logWhatsAppMessage);

module.exports = router;
