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

            return {
                ...order,
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
