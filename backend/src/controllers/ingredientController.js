const { prisma } = require('../prisma');

// Get all ingredients
exports.getIngredients = async (req, res, next) => {
    try {
        const ingredients = await prisma.ingredient.findMany({
            include: {
                menuItems: {
                    include: {
                        menuItem: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        // Add lowStock flag
        const ingredientsWithStatus = ingredients.map(ing => ({
            ...ing,
            lowStock: ing.currentStock <= ing.minStock,
            usedIn: ing.menuItems.map(mi => mi.menuItem.name)
        }));

        res.json(ingredientsWithStatus);
    } catch (error) {
        console.error('Get ingredients error:', error);
        next(error);
    }
};

// Create ingredient
exports.createIngredient = async (req, res, next) => {
    try {
        const { name, unit, currentStock, minStock, costPerUnit, supplier } = req.body;

        const ingredient = await prisma.ingredient.create({
            data: {
                name,
                unit: unit || 'GRAMS',
                currentStock: parseFloat(currentStock) || 0,
                minStock: parseFloat(minStock) || 10,
                costPerUnit: parseFloat(costPerUnit) || 0,
                supplier
            }
        });

        res.status(201).json(ingredient);
    } catch (error) {
        console.error('Create ingredient error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Ingredient with this name already exists' });
        }
        next(error);
    }
};

// Update ingredient
exports.updateIngredient = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, unit, minStock, costPerUnit, supplier } = req.body;

        const ingredient = await prisma.ingredient.update({
            where: { id: parseInt(id, 10) },
            data: {
                name,
                unit,
                minStock: minStock ? parseFloat(minStock) : undefined,
                costPerUnit: costPerUnit ? parseFloat(costPerUnit) : undefined,
                supplier
            }
        });

        res.json(ingredient);
    } catch (error) {
        console.error('Update ingredient error:', error);
        next(error);
    }
};

// Delete ingredient
exports.deleteIngredient = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check if ingredient is used in any menu items
        const usedInMenuItems = await prisma.menuItemIngredient.findMany({
            where: { ingredientId: parseInt(id, 10) },
            include: { menuItem: true }
        });

        if (usedInMenuItems.length > 0) {
            const itemNames = usedInMenuItems.map(m => m.menuItem.name).join(', ');
            return res.status(400).json({
                error: `Cannot delete. Ingredient is used in: ${itemNames}`
            });
        }

        await prisma.ingredient.delete({
            where: { id: parseInt(id, 10) }
        });

        res.json({ success: true, message: 'Ingredient deleted' });
    } catch (error) {
        console.error('Delete ingredient error:', error);
        next(error);
    }
};

// Update stock (purchase/add stock)
exports.addStock = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { quantity, notes } = req.body;

        const ingredient = await prisma.$transaction(async (tx) => {
            // Update stock
            const updated = await tx.ingredient.update({
                where: { id: parseInt(id, 10) },
                data: {
                    currentStock: { increment: parseFloat(quantity) }
                }
            });

            // Log the change
            await tx.ingredientStockLog.create({
                data: {
                    ingredientId: parseInt(id, 10),
                    changeType: 'PURCHASE',
                    quantity: parseFloat(quantity),
                    notes
                }
            });

            return updated;
        });

        res.json({ success: true, ingredient });
    } catch (error) {
        console.error('Add stock error:', error);
        next(error);
    }
};

// Record wastage
exports.recordWastage = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { quantity, notes } = req.body;

        const ingredient = await prisma.$transaction(async (tx) => {
            const updated = await tx.ingredient.update({
                where: { id: parseInt(id, 10) },
                data: {
                    currentStock: { decrement: parseFloat(quantity) }
                }
            });

            await tx.ingredientStockLog.create({
                data: {
                    ingredientId: parseInt(id, 10),
                    changeType: 'WASTAGE',
                    quantity: -parseFloat(quantity),
                    notes
                }
            });

            return updated;
        });

        res.json({ success: true, ingredient });
    } catch (error) {
        console.error('Record wastage error:', error);
        next(error);
    }
};

// Get stock logs for an ingredient
exports.getStockLogs = async (req, res, next) => {
    try {
        const { id } = req.params;

        const logs = await prisma.ingredientStockLog.findMany({
            where: { ingredientId: parseInt(id, 10) },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        res.json(logs);
    } catch (error) {
        console.error('Get stock logs error:', error);
        next(error);
    }
};

// Get low stock ingredients
exports.getLowStock = async (req, res, next) => {
    try {
        const ingredients = await prisma.ingredient.findMany({
            where: {
                currentStock: {
                    lte: prisma.ingredient.fields.minStock
                }
            }
        });

        // Manual filter since Prisma doesn't support field comparison directly
        const allIngredients = await prisma.ingredient.findMany();
        const lowStock = allIngredients.filter(ing => ing.currentStock <= ing.minStock);

        res.json(lowStock);
    } catch (error) {
        console.error('Get low stock error:', error);
        next(error);
    }
};

// ========== RECIPE MANAGEMENT ==========

// Get recipe for a menu item
exports.getMenuItemRecipe = async (req, res, next) => {
    try {
        const { menuItemId } = req.params;

        const recipe = await prisma.menuItemIngredient.findMany({
            where: { menuItemId: parseInt(menuItemId, 10) },
            include: {
                ingredient: true
            }
        });

        res.json(recipe);
    } catch (error) {
        console.error('Get recipe error:', error);
        next(error);
    }
};

// Set/update recipe for a menu item
exports.setMenuItemRecipe = async (req, res, next) => {
    try {
        const { menuItemId } = req.params;
        const { ingredients } = req.body; // Array of { ingredientId, quantity }

        // Delete existing recipe
        await prisma.menuItemIngredient.deleteMany({
            where: { menuItemId: parseInt(menuItemId, 10) }
        });

        // Create new recipe
        if (ingredients && ingredients.length > 0) {
            await prisma.menuItemIngredient.createMany({
                data: ingredients.map(ing => ({
                    menuItemId: parseInt(menuItemId, 10),
                    ingredientId: parseInt(ing.ingredientId, 10),
                    quantity: parseFloat(ing.quantity)
                }))
            });
        }

        // Fetch updated recipe
        const recipe = await prisma.menuItemIngredient.findMany({
            where: { menuItemId: parseInt(menuItemId, 10) },
            include: {
                ingredient: true,
                menuItem: true
            }
        });

        res.json({ success: true, recipe });
    } catch (error) {
        console.error('Set recipe error:', error);
        next(error);
    }
};

// Check if menu item can be made (has enough ingredients)
exports.checkAvailability = async (req, res, next) => {
    try {
        const { menuItemId, quantity } = req.params;
        const qty = parseInt(quantity, 10) || 1;

        const recipe = await prisma.menuItemIngredient.findMany({
            where: { menuItemId: parseInt(menuItemId, 10) },
            include: { ingredient: true }
        });

        if (recipe.length === 0) {
            return res.json({
                available: true,
                message: 'No recipe defined - assuming available',
                missingIngredients: []
            });
        }

        const missingIngredients = [];

        for (const item of recipe) {
            const required = item.quantity * qty;
            if (item.ingredient.currentStock < required) {
                missingIngredients.push({
                    name: item.ingredient.name,
                    required,
                    available: item.ingredient.currentStock,
                    unit: item.ingredient.unit,
                    shortage: required - item.ingredient.currentStock
                });
            }
        }

        res.json({
            available: missingIngredients.length === 0,
            canMake: missingIngredients.length === 0 ? qty : 0,
            missingIngredients
        });
    } catch (error) {
        console.error('Check availability error:', error);
        next(error);
    }
};