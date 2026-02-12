const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const auth = require('../middleware/auth');
const { prisma } = require('../prisma');

router.post('/', auth, orderController.createOrder);
router.get('/', auth, orderController.getOrders);
router.get('/active', auth, orderController.getActiveOrders);
router.put('/:id/status', auth, orderController.updateOrderStatus);
router.get('/tables', auth, orderController.getTables);


router.get('/recent', auth, async (req, res) => {
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

// Pay Later routes
router.post('/pay-later', auth, orderController.createPayLaterOrder);
router.get('/pending-payments', auth, orderController.getPendingPayments);

module.exports = router;
