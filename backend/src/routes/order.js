const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const auth = require('../middleware/auth');
const { adminOrManager, allRoles } = require('../middleware/authorize');
const { prisma } = require('../prisma');

// Routes accessible to all authenticated users (including Chef)
router.get('/active', auth, allRoles, orderController.getActiveOrders);  // Chef needs to see active orders
router.put('/:id/status', auth, allRoles, orderController.updateOrderStatus);  // Chef needs to update status

// Management routes - Admin and Manager only
router.post('/', auth, adminOrManager, orderController.createOrder);
router.get('/', auth, adminOrManager, orderController.getOrders);
router.put('/:id', auth, adminOrManager, orderController.updateOrder);
router.get('/tables', auth, adminOrManager, orderController.getTables);

router.get('/recent', auth, adminOrManager, async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                table: true,
                items: true
            }
        });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch recent orders' });
    }
});

// Pay Later routes - Admin and Manager only
router.post('/pay-later', auth, adminOrManager, orderController.createPayLaterOrder);
router.get('/pending-payments', auth, adminOrManager, orderController.getPendingPayments);

module.exports = router;
