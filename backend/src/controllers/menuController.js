const { prisma } = require('../prisma');

// Get all menu items
exports.getMenuItems = async (req, res, next) => {
    try {
        const menuItems = await prisma.menuItem.findMany({
            include: {
                category: true,
                inventory: true,
                ingredients: {  // Include recipe ingredients
                    include: {
                        ingredient: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        res.json(menuItems);
    } catch (error) {
        console.error('Get menu items error:', error);
        next(error);
    }
};

// Get categories
exports.getCategories = async (req, res, next) => {
    try {
        const categories = await prisma.category.findMany({
            orderBy: { name: 'asc' }
        });

        res.json(categories);
    } catch (error) {
        console.error('Get categories error:', error);
        next(error);
    }
};

// Create menu item
exports.createMenuItem = async (req, res, next) => {
    try {
        const { name, description, price, categoryId } = req.body;

        const menuItem = await prisma.menuItem.create({
            data: {
                name,
                description: description || '',
                price: parseFloat(price),
                categoryId: parseInt(categoryId, 10),
                isActive: true,
                inventory: {
                    create: {
                        quantity: 0,
                        lowStock: false
                    }
                }
            },
            include: {
                category: true,
                inventory: true
            }
        });

        res.status(201).json(menuItem);
    } catch (error) {
        console.error('Create menu item error:', error);
        next(error);
    }
};

// Update menu item
exports.updateMenuItem = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, price, categoryId, isActive } = req.body;

        const menuItem = await prisma.menuItem.update({
            where: { id: parseInt(id, 10) },
            data: {
                name,
                description,
                price: price ? parseFloat(price) : undefined,
                categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
                isActive
            },
            include: {
                category: true,
                inventory: true
            }
        });

        res.json(menuItem);
    } catch (error) {
        console.error('Update menu item error:', error);
        next(error);
    }
};

// Delete menu item
exports.deleteMenuItem = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check if item has inventory
        const inventory = await prisma.inventory.findUnique({
            where: { menuItemId: parseInt(id, 10) }
        });

        if (inventory) {
            await prisma.inventory.delete({
                where: { menuItemId: parseInt(id, 10) }
            });
        }

        await prisma.menuItem.delete({
            where: { id: parseInt(id, 10) }
        });

        res.json({ success: true, message: 'Menu item deleted' });
    } catch (error) {
        console.error('Delete menu item error:', error);
        next(error);
    }
};