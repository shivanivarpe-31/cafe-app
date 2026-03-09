const express = require('express');
const router = express.Router();
const kitchenController = require('../controllers/kitchenController');
const auth = require('../middleware/auth');
const { allRoles } = require('../middleware/authorize');

// Kitchen routes accessible to all authenticated users (Admin, Manager, Chef)
router.get('/orders', auth, allRoles, kitchenController.getKitchenOrders);

// Prep-time tracking
router.put('/items/:orderItemId/start-prep', auth, allRoles, kitchenController.startItemPrep);
router.put('/items/:orderItemId/complete-prep', auth, allRoles, kitchenController.completeItemPrep);
router.get('/prep-stats', auth, allRoles, kitchenController.getPrepStats);

module.exports = router;
