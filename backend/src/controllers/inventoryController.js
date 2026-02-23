const { prisma } = require('../prisma');
const config = require('../config/businessConfig');
const { getPaginationParams, formatPaginatedResponse } = require('../utils/pagination');

// Get all inventory
exports.getInventory = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPaginationParams(req);

        const where = {};
        if (req.query.lowStock === 'true') where.lowStock = true;

        const [inventory, total] = await Promise.all([
            prisma.inventory.findMany({
                where,
                include: {
                    menuItem: {
                        include: {
                            category: true
                        }
                    }
                },
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.inventory.count({ where })
        ]);

        res.json(formatPaginatedResponse(inventory, total, page, limit));
    } catch (error) {
        console.error('Get inventory error:', error);
        next(error);
    }
};


// Update stock quantity
exports.updateInventory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { quantity } = req.body;

        if (!id || isNaN(parseInt(id, 10))) {
            return res.status(400).json({ error: 'Valid inventory ID is required' });
        }
        if (quantity === undefined || quantity === null || isNaN(parseInt(quantity, 10)) || parseInt(quantity, 10) < 0) {
            return res.status(400).json({ error: 'Quantity must be a non-negative integer' });
        }

        const LOW_STOCK_THRESHOLD = config.inventory.lowStockThreshold;

        const inventory = await prisma.inventory.update({
            where: { id: parseInt(id, 10) },
            data: {
                quantity: parseInt(quantity, 10),
                lowStock: parseInt(quantity, 10) < LOW_STOCK_THRESHOLD,
                updatedAt: new Date()
            },
            include: {
                menuItem: true
            }
        });

        res.json({ success: true, inventory });
    } catch (error) {
        console.error('Update inventory error:', error);
        next(error);
    }
};

// Get low stock items
exports.getLowStock = async (req, res, next) => {
    try {
        const lowStock = await prisma.inventory.findMany({
            where: { lowStock: true },
            include: { menuItem: { include: { category: true } } }
        });
        res.json(lowStock);
    } catch (error) {
        next(error);
    }
};
