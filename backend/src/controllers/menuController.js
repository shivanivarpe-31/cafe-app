const { prisma } = require('../prisma');
const { getPaginationParams, formatPaginatedResponse } = require('../utils/pagination');

// Get lightweight menu items (for billing/ordering - no ingredients)
exports.getMenuItems = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPaginationParams(req);

        const where = {};
        if (req.query.categoryId) where.categoryId = parseInt(req.query.categoryId, 10);
        if (req.query.search) where.name = { contains: req.query.search, mode: 'insensitive' };

        const [menuItems, total] = await Promise.all([
            prisma.menuItem.findMany({
                where,
                include: {
                    category: true
                },
                orderBy: { name: 'asc' },
                skip,
                take: limit
            }),
            prisma.menuItem.count({ where })
        ]);

        res.json(formatPaginatedResponse(menuItems, total, page, limit));
    } catch (error) {
        console.error('Get menu items error:', error);
        next(error);
    }
};

// Get detailed menu items (for menu management - includes ingredients & inventory)
exports.getDetailedMenuItems = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPaginationParams(req);

        const where = {};
        if (req.query.categoryId) where.categoryId = parseInt(req.query.categoryId, 10);
        if (req.query.search) where.name = { contains: req.query.search, mode: 'insensitive' };

        const [menuItems, total] = await Promise.all([
            prisma.menuItem.findMany({
                where,
                include: {
                    category: true,
                    inventory: true,
                    ingredients: {
                        include: {
                            ingredient: true
                        }
                    }
                },
                orderBy: { name: 'asc' },
                skip,
                take: limit
            }),
            prisma.menuItem.count({ where })
        ]);

        res.json(formatPaginatedResponse(menuItems, total, page, limit));
    } catch (error) {
        console.error('Get detailed menu items error:', error);
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

        // Input validation
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Name is required' });
        }
        if (name.trim().length > 200) {
            return res.status(400).json({ error: 'Name must be 200 characters or fewer' });
        }
        if (price === undefined || price === null || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
            return res.status(400).json({ error: 'Price must be a non-negative number' });
        }
        if (!categoryId || isNaN(parseInt(categoryId, 10))) {
            return res.status(400).json({ error: 'Valid category ID is required' });
        }

        // Verify category exists
        const category = await prisma.category.findUnique({ where: { id: parseInt(categoryId, 10) } });
        if (!category) {
            return res.status(400).json({ error: 'Category not found' });
        }

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

        if (!id || isNaN(parseInt(id, 10))) {
            return res.status(400).json({ error: 'Valid menu item ID is required' });
        }
        if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
            return res.status(400).json({ error: 'Name cannot be empty' });
        }
        if (name && name.trim().length > 200) {
            return res.status(400).json({ error: 'Name must be 200 characters or fewer' });
        }
        if (price !== undefined && (isNaN(parseFloat(price)) || parseFloat(price) < 0)) {
            return res.status(400).json({ error: 'Price must be a non-negative number' });
        }
        if (categoryId !== undefined && isNaN(parseInt(categoryId, 10))) {
            return res.status(400).json({ error: 'Valid category ID is required' });
        }

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

// Recipe Costing & Live Margin Calculator
// Returns every active menu item enriched with ingredient cost, profit, and margin
exports.getRecipeCosting = async (req, res, next) => {
    try {
        const items = await prisma.menuItem.findMany({
            where: { isActive: true },
            include: {
                category: true,
                ingredients: {
                    include: {
                        ingredient: true   // brings costPerUnit, unit, name
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        const result = items.map(item => {
            const sellingPrice = parseFloat(item.price);

            // Sum ingredient costs: costPerUnit × qty used per dish
            const ingredientLines = item.ingredients.map(rel => {
                const unitCost = parseFloat(rel.ingredient.costPerUnit ?? 0);
                const qtyUsed = parseFloat(rel.quantity ?? 0);
                const lineCost = unitCost * qtyUsed;
                return {
                    ingredientId: rel.ingredientId,
                    name: rel.ingredient.name,
                    unit: rel.ingredient.unit,
                    qtyUsed,
                    costPerUnit: unitCost,
                    lineCost: parseFloat(lineCost.toFixed(4))
                };
            });

            const totalIngredientCost = ingredientLines.reduce((s, l) => s + l.lineCost, 0);
            const profit = sellingPrice - totalIngredientCost;
            const marginPct = sellingPrice > 0
                ? (profit / sellingPrice) * 100
                : null;

            // Margin band: RED < 30 %, YELLOW 30–60 %, GREEN > 60 %
            let marginBand = 'NO_RECIPE';
            if (ingredientLines.length > 0) {
                if (marginPct === null) marginBand = 'NO_RECIPE';
                else if (marginPct < 30) marginBand = 'LOW';
                else if (marginPct < 60) marginBand = 'MEDIUM';
                else marginBand = 'HIGH';
            }

            return {
                id: item.id,
                name: item.name,
                description: item.description,
                category: item.category.name,
                sellingPrice,
                ingredientCost: parseFloat(totalIngredientCost.toFixed(4)),
                profit: parseFloat(profit.toFixed(4)),
                marginPct: marginPct !== null ? parseFloat(marginPct.toFixed(2)) : null,
                marginBand,
                hasRecipe: ingredientLines.length > 0,
                ingredients: ingredientLines
            };
        });

        // Sort: items with recipe first, then by margin asc (lowest-margin first – easy to spot)
        result.sort((a, b) => {
            if (a.hasRecipe !== b.hasRecipe) return a.hasRecipe ? -1 : 1;
            if (a.marginPct === null && b.marginPct === null) return 0;
            if (a.marginPct === null) return 1;
            if (b.marginPct === null) return -1;
            return a.marginPct - b.marginPct;
        });

        // Summary stats (only items that have a recipe)
        const withRecipe = result.filter(r => r.hasRecipe);
        const summary = {
            totalItems: result.length,
            itemsWithRecipe: withRecipe.length,
            itemsNoRecipe: result.length - withRecipe.length,
            avgMarginPct: withRecipe.length
                ? parseFloat((withRecipe.reduce((s, r) => s + r.marginPct, 0) / withRecipe.length).toFixed(2))
                : null,
            lowestMarginItem: withRecipe.length ? withRecipe[0] : null,
            highestMarginItem: withRecipe.length ? withRecipe[withRecipe.length - 1] : null,
            negativeMarginCount: withRecipe.filter(r => r.marginPct < 0).length
        };

        res.json({ summary, items: result });
    } catch (error) {
        console.error('Get recipe costing error:', error);
        next(error);
    }
};

// Delete menu item (hard-delete if no orders reference it, soft-delete otherwise)
exports.deleteMenuItem = async (req, res, next) => {
    try {
        const { id } = req.params;
        const parsedId = parseInt(id, 10);

        // Check if any order items reference this menu item
        const orderItemCount = await prisma.orderItem.count({
            where: { menuItemId: parsedId }
        });

        if (orderItemCount > 0) {
            // Soft-delete: deactivate the item to preserve order history
            await prisma.menuItem.update({
                where: { id: parsedId },
                data: { isActive: false }
            });

            return res.json({
                success: true,
                message: 'Menu item deactivated (has existing order history)',
                softDeleted: true
            });
        }

        // Hard-delete: no orders reference this item, safe to remove
        // Related records (inventory, recipe, platform mappings) cascade-delete automatically
        await prisma.menuItem.delete({
            where: { id: parsedId }
        });

        res.json({ success: true, message: 'Menu item deleted' });
    } catch (error) {
        console.error('Delete menu item error:', error);
        next(error);
    }
};