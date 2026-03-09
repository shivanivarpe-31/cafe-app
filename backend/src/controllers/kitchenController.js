const { prisma } = require('../prisma');

// Get all active kitchen orders
exports.getKitchenOrders = async (req, res, next) => {
    try {
        const orders = await prisma.order.findMany({
            where: {
                status: { in: ['PENDING', 'PREPARING', 'SERVED'] }
            },
            include: {
                table: true,
                items: {
                    include: {
                        menuItem: {
                            include: {
                                category: true
                            }
                        },
                        modifications: {
                            include: {
                                modification: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'asc' } // Oldest orders first
        });

        // Add calculated fields for frontend
        const now = new Date();
        const ordersWithTime = orders.map(order => {
            const timeElapsed = Math.floor((now - new Date(order.createdAt)) / 1000); // seconds
            const minutesElapsed = Math.floor(timeElapsed / 60);

            // Annotate each item with live prep info
            const itemsWithPrep = order.items.map(item => {
                let itemElapsed = null;
                let isItemOverdue = false;

                if (item.prepStartedAt && item.prepStatus === 'PREPARING') {
                    itemElapsed = Math.floor((now - new Date(item.prepStartedAt)) / 1000);
                    // Flag if elapsed > avg prep time + 50%
                    if (item.menuItem.avgPrepTime) {
                        isItemOverdue = itemElapsed > item.menuItem.avgPrepTime * 1.5;
                    }
                }

                return {
                    ...item,
                    itemElapsed,      // seconds since prep started (null if not started)
                    isItemOverdue,    // true when cooking is taking too long
                };
            });

            return {
                ...order,
                items: itemsWithPrep,
                timeElapsed, // in seconds
                minutesElapsed,
                isUrgent: minutesElapsed >= 15 // Flag orders older than 15 minutes
            };
        });

        res.json(ordersWithTime);
    } catch (error) {
        console.error('Get kitchen orders error:', error);
        next(error);
    }
};

// Start preparing a specific order item
exports.startItemPrep = async (req, res, next) => {
    const { orderItemId } = req.params;
    try {
        const item = await prisma.orderItem.findUnique({
            where: { id: Number(orderItemId) }
        });

        if (!item) return res.status(404).json({ error: 'Order item not found' });
        if (item.prepStatus === 'PREPARING') return res.status(400).json({ error: 'Item is already being prepared' });
        if (item.prepStatus === 'DONE') return res.status(400).json({ error: 'Item is already completed' });

        const updated = await prisma.orderItem.update({
            where: { id: Number(orderItemId) },
            data: {
                prepStatus: 'PREPARING',
                prepStartedAt: new Date(),
            },
            include: {
                menuItem: { include: { category: true } },
                modifications: { include: { modification: true } }
            }
        });

        res.json({ message: 'Prep started', item: updated });
    } catch (error) {
        console.error('Start item prep error:', error);
        next(error);
    }
};

// Complete preparing a specific order item (records actual time, updates rolling average)
exports.completeItemPrep = async (req, res, next) => {
    const { orderItemId } = req.params;
    try {
        const item = await prisma.orderItem.findUnique({
            where: { id: Number(orderItemId) },
            include: { menuItem: true }
        });

        if (!item) return res.status(404).json({ error: 'Order item not found' });
        if (item.prepStatus !== 'PREPARING') return res.status(400).json({ error: 'Item has not been started yet' });

        const now = new Date();
        const actualPrepSeconds = item.prepStartedAt
            ? Math.floor((now - new Date(item.prepStartedAt)) / 1000)
            : null;

        // Update rolling average on MenuItem
        if (actualPrepSeconds !== null) {
            const currentAvg = item.menuItem.avgPrepTime ?? actualPrepSeconds;
            const count = item.menuItem.prepCount;
            const newAvg = Math.round((currentAvg * count + actualPrepSeconds) / (count + 1));

            await prisma.menuItem.update({
                where: { id: item.menuItemId },
                data: { avgPrepTime: newAvg, prepCount: { increment: 1 } }
            });
        }

        const updated = await prisma.orderItem.update({
            where: { id: Number(orderItemId) },
            data: {
                prepStatus: 'DONE',
                prepCompletedAt: now,
            },
            include: {
                menuItem: { include: { category: true } },
                modifications: { include: { modification: true } }
            }
        });

        res.json({ message: 'Item completed', item: updated, actualPrepSeconds });
    } catch (error) {
        console.error('Complete item prep error:', error);
        next(error);
    }
};

// Get average prep stats for each menu item
exports.getPrepStats = async (req, res, next) => {
    try {
        const items = await prisma.menuItem.findMany({
            where: { prepCount: { gt: 0 } },
            select: {
                id: true,
                name: true,
                avgPrepTime: true,
                prepCount: true,
                category: { select: { name: true } }
            },
            orderBy: { avgPrepTime: 'desc' }
        });

        res.json(items);
    } catch (error) {
        console.error('Get prep stats error:', error);
        next(error);
    }
};
