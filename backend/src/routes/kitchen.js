const express = require('express');
const router = express.Router();
const kitchenController = require('../controllers/kitchenController');
const auth = require('../middleware/auth');
const { allRoles } = require('../middleware/authorize');

// Kitchen routes accessible to all authenticated users (Admin, Manager, Chef)
router.get('/orders', auth, allRoles, kitchenController.getKitchenOrders);

module.exports = router;
