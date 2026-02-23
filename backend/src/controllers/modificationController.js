const { prisma } = require('../prisma');
const { getPaginationParams, formatPaginatedResponse } = require('../utils/pagination');

// Get all modifications
exports.getModifications = async (req, res, next) => {
    try {
        const modifications = await prisma.modification.findMany({
            where: { isActive: true },
            orderBy: [
                { category: 'asc' },
                { name: 'asc' }
            ]
        });

        // Group by category
        const grouped = modifications.reduce((acc, mod) => {
            const category = mod.category || 'Other';
            if (!acc[category]) acc[category] = [];
            acc[category].push(mod);
            return acc;
        }, {});

        res.json({
            all: modifications,
            grouped
        });
    } catch (error) {
        console.error('Get modifications error:', error);
        next(error);
    }
};

// Get all modifications (including inactive) for admin
exports.getAllModifications = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPaginationParams(req);

        const where = {};
        if (req.query.category) where.category = req.query.category;
        if (req.query.search) where.name = { contains: req.query.search, mode: 'insensitive' };

        const [modifications, total] = await Promise.all([
            prisma.modification.findMany({
                where,
                orderBy: [
                    { category: 'asc' },
                    { name: 'asc' }
                ],
                skip,
                take: limit
            }),
            prisma.modification.count({ where })
        ]);

        res.json(formatPaginatedResponse(modifications, total, page, limit));
    } catch (error) {
        console.error('Get all modifications error:', error);
        next(error);
    }
};

// Create modification
exports.createModification = async (req, res, next) => {
    try {
        const { name, price, category } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const modification = await prisma.modification.create({
            data: {
                name,
                price: parseFloat(price) || 0,
                category: category || 'Other',
                isActive: true
            }
        });

        res.status(201).json(modification);
    } catch (error) {
        console.error('Create modification error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Modification with this name already exists' });
        }
        next(error);
    }
};

// Update modification
exports.updateModification = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, price, category, isActive } = req.body;

        if (!id || isNaN(parseInt(id, 10))) {
            return res.status(400).json({ error: 'Valid modification ID is required' });
        }
        if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
            return res.status(400).json({ error: 'Name cannot be empty' });
        }
        if (price !== undefined && (isNaN(parseFloat(price)) || parseFloat(price) < 0)) {
            return res.status(400).json({ error: 'Price must be a non-negative number' });
        }

        const modification = await prisma.modification.update({
            where: { id: parseInt(id, 10) },
            data: {
                name,
                price: price !== undefined ? parseFloat(price) : undefined,
                category,
                isActive
            }
        });

        res.json(modification);
    } catch (error) {
        console.error('Update modification error:', error);
        next(error);
    }
};

// Delete modification
exports.deleteModification = async (req, res, next) => {
    try {
        const { id } = req.params;

        await prisma.modification.delete({
            where: { id: parseInt(id, 10) }
        });

        res.json({ success: true, message: 'Modification deleted' });
    } catch (error) {
        console.error('Delete modification error:', error);
        next(error);
    }
};

// Seed default modifications
exports.seedModifications = async (req, res, next) => {
    try {
        const defaultMods = [
            // Remove items (free)
            { name: 'No Onion', price: 0, category: 'Remove' },
            { name: 'No Garlic', price: 0, category: 'Remove' },
            { name: 'No Tomato', price: 0, category: 'Remove' },
            { name: 'No Spice', price: 0, category: 'Remove' },
            { name: 'No Cheese', price: 0, category: 'Remove' },
            { name: 'No Mayo', price: 0, category: 'Remove' },

            // Add-ons (charged)
            { name: 'Extra Cheese', price: 30, category: 'Add-ons' },
            { name: 'Extra Paneer', price: 40, category: 'Add-ons' },
            { name: 'Extra Chicken', price: 50, category: 'Add-ons' },
            { name: 'Extra Butter', price: 15, category: 'Add-ons' },
            { name: 'Extra Cream', price: 20, category: 'Add-ons' },
            { name: 'Add Egg', price: 20, category: 'Add-ons' },

            // Spice level (free)
            { name: 'Less Spicy', price: 0, category: 'Spice Level' },
            { name: 'Medium Spicy', price: 0, category: 'Spice Level' },
            { name: 'Extra Spicy', price: 0, category: 'Spice Level' },
            { name: 'No Chilli', price: 0, category: 'Spice Level' },

            // Cooking preference (free)
            { name: 'Well Done', price: 0, category: 'Cooking' },
            { name: 'Crispy', price: 0, category: 'Cooking' },
            { name: 'Less Oil', price: 0, category: 'Cooking' },
            { name: 'No Salt', price: 0, category: 'Cooking' },

            // Portion (charged)
            { name: 'Large Size', price: 50, category: 'Portion' },
            { name: 'Half Portion', price: -30, category: 'Portion' },
        ];

        let created = 0;
        for (const mod of defaultMods) {
            try {
                await prisma.modification.upsert({
                    where: { name: mod.name },
                    update: {},
                    create: mod
                });
                created++;
            } catch (e) {
                console.log(`Skipping ${mod.name}: ${e.message}`);
            }
        }

        res.json({ success: true, message: `Seeded ${created} modifications` });
    } catch (error) {
        console.error('Seed modifications error:', error);
        next(error);
    }
};