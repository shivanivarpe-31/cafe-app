const { prisma } = require('../prisma');

// Get all inventory
exports.getInventory = async (req, res, next) => {
    try {
        const inventory = await prisma.inventory.findMany({
            include: {
                menuItem: {
                    include: {
                        category: true
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        res.json(inventory);
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

        const inventory = await prisma.inventory.update({
            where: { id: parseInt(id, 10) },
            data: {
                quantity: parseInt(quantity, 10),
                lowStock: quantity < 10,
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
