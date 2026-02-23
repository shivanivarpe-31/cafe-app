const { prisma } = require('../prisma');
const config = require('../config/businessConfig');
const { getPaginationParams, formatPaginatedResponse } = require('../utils/pagination');

// Get all ingredients
exports.getIngredients = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPaginationParams(req);

        const where = {};
        if (req.query.search) where.name = { contains: req.query.search, mode: 'insensitive' };
        if (req.query.lowStock === 'true') {
            // Will filter after fetch since Prisma can't compare two fields
        }

        const [ingredients, total] = await Promise.all([
            prisma.ingredient.findMany({
                where,
                include: {
                    menuItems: {
                        include: {
                            menuItem: true
                        }
                    }
                },
                orderBy: { name: 'asc' },
                skip,
                take: limit
            }),
            prisma.ingredient.count({ where })
        ]);

        // Add lowStock flag
        const ingredientsWithStatus = ingredients.map(ing => ({
            ...ing,
            lowStock: ing.currentStock <= ing.minStock,
            usedIn: ing.menuItems.map(mi => mi.menuItem.name)
        }));

        res.json(formatPaginatedResponse(ingredientsWithStatus, total, page, limit));
    } catch (error) {
        console.error('Get ingredients error:', error);
        next(error);
    }
};

// Create ingredient
exports.createIngredient = async (req, res, next) => {
    try {
        const { name, unit, currentStock, minStock, costPerUnit, supplier } = req.body;

        // Input validation
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Name is required' });
        }
        if (name.trim().length > 200) {
            return res.status(400).json({ error: 'Name must be 200 characters or fewer' });
        }
        const validUnits = ['GRAMS', 'KG', 'ML', 'LITERS', 'PIECES', 'UNITS'];
        if (unit && !validUnits.includes(unit.toUpperCase())) {
            return res.status(400).json({ error: `Unit must be one of: ${validUnits.join(', ')}` });
        }
        if (currentStock !== undefined && (isNaN(parseFloat(currentStock)) || parseFloat(currentStock) < 0)) {
            return res.status(400).json({ error: 'Current stock must be a non-negative number' });
        }
        if (minStock !== undefined && (isNaN(parseFloat(minStock)) || parseFloat(minStock) < 0)) {
            return res.status(400).json({ error: 'Minimum stock must be a non-negative number' });
        }
        if (costPerUnit !== undefined && (isNaN(parseFloat(costPerUnit)) || parseFloat(costPerUnit) < 0)) {
            return res.status(400).json({ error: 'Cost per unit must be a non-negative number' });
        }

        const ingredient = await prisma.ingredient.create({
            data: {
                name,
                unit: unit || 'GRAMS',
                currentStock: parseFloat(currentStock) || 0,
                minStock: parseFloat(minStock) || config.inventory.defaultMinStock,
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

        if (!id || isNaN(parseInt(id, 10))) {
            return res.status(400).json({ error: 'Valid ingredient ID is required' });
        }
        if (quantity === undefined || quantity === null || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
            return res.status(400).json({ error: 'Quantity must be a positive number' });
        }

        const parsedId = parseInt(id, 10);
        const parsedQty = parseFloat(quantity);

        const ingredient = await prisma.$transaction(async (tx) => {
            // Lock the row to prevent concurrent stock modifications
            const [locked] = await tx.$queryRaw`
                SELECT * FROM Ingredient WHERE id = ${parsedId} FOR UPDATE
            `;

            if (!locked) {
                throw Object.assign(new Error('Ingredient not found'), { statusCode: 404 });
            }

            // Update stock
            const updated = await tx.ingredient.update({
                where: { id: parsedId },
                data: {
                    currentStock: { increment: parsedQty }
                }
            });

            // Log the change
            await tx.ingredientStockLog.create({
                data: {
                    ingredientId: parsedId,
                    changeType: 'PURCHASE',
                    quantity: parsedQty,
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

        if (!id || isNaN(parseInt(id, 10))) {
            return res.status(400).json({ error: 'Valid ingredient ID is required' });
        }
        if (quantity === undefined || quantity === null || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
            return res.status(400).json({ error: 'Quantity must be a positive number' });
        }

        const parsedId = parseInt(id, 10);
        const parsedQty = parseFloat(quantity);

        const result = await prisma.$transaction(async (tx) => {
            // Lock the row to prevent concurrent stock modifications
            const [locked] = await tx.$queryRaw`
                SELECT * FROM Ingredient WHERE id = ${parsedId} FOR UPDATE
            `;

            if (!locked) {
                throw Object.assign(new Error('Ingredient not found'), { statusCode: 404 });
            }

            // Verify stock won't go negative under the lock
            if (parsedQty > locked.currentStock) {
                throw Object.assign(
                    new Error('Wastage quantity exceeds current stock'),
                    { statusCode: 400, currentStock: locked.currentStock, requested: parsedQty }
                );
            }

            const updated = await tx.ingredient.update({
                where: { id: parsedId },
                data: {
                    currentStock: { decrement: parsedQty }
                }
            });

            await tx.ingredientStockLog.create({
                data: {
                    ingredientId: parsedId,
                    changeType: 'WASTAGE',
                    quantity: -parsedQty,
                    notes
                }
            });

            return updated;
        });

        res.json({ success: true, ingredient: result });
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
        // Prisma doesn't support field-to-field comparison in where clauses,
        // so fetch all and filter in-memory (single query, no dead code)
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
        const parsedMenuItemId = parseInt(menuItemId, 10);

        const recipe = await prisma.$transaction(async (tx) => {
            // Delete existing recipe
            await tx.menuItemIngredient.deleteMany({
                where: { menuItemId: parsedMenuItemId }
            });

            // Create new recipe
            if (ingredients && ingredients.length > 0) {
                await tx.menuItemIngredient.createMany({
                    data: ingredients.map(ing => ({
                        menuItemId: parsedMenuItemId,
                        ingredientId: parseInt(ing.ingredientId, 10),
                        quantity: parseFloat(ing.quantity)
                    }))
                });
            }

            // Fetch updated recipe
            return tx.menuItemIngredient.findMany({
                where: { menuItemId: parsedMenuItemId },
                include: {
                    ingredient: true,
                    menuItem: true
                }
            });
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