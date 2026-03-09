/**
 * guestController.js
 * Public-facing endpoints for the Digital Menu / QR self-ordering flow.
 * No authentication required — these are intentionally open.
 */

const { prisma } = require('../prisma');
const config = require('../config/businessConfig');
const crypto = require('crypto');

const generateBillNumber = () => {
    const date = new Date();
    const yy = date.getFullYear().toString().slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `QR${yy}${mm}${dd}${rand}`;
};

// ─── GET /api/guest/restaurant ────────────────────────────────────────────────
// Returns basic restaurant info + tax rate for the customer menu UI
exports.getRestaurantInfo = async (req, res, next) => {
    try {
        res.json({
            name: config.restaurant.name,
            address: config.restaurant.address,
            phone: config.restaurant.phone,
            currency: config.currency.symbol,
            taxRate: config.tax.rate,
            taxLabel: config.tax.label,
        });
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/guest/table/:tableId ───────────────────────────────────────────
// Returns table number + current status so the menu page can display it
exports.getTable = async (req, res, next) => {
    try {
        const tableId = parseInt(req.params.tableId, 10);
        if (isNaN(tableId)) return res.status(400).json({ error: 'Invalid table ID' });

        const table = await prisma.table.findUnique({
            where: { id: tableId },
            select: { id: true, number: true, capacity: true, status: true }
        });

        if (!table) return res.status(404).json({ error: 'Table not found' });

        res.json(table);
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/guest/menu ─────────────────────────────────────────────────────
// Returns all active menu items grouped by category, with available modifications
exports.getMenu = async (req, res, next) => {
    try {
        const [items, modifications] = await Promise.all([
            prisma.menuItem.findMany({
                where: { isActive: true },
                include: { category: true },
                orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }]
            }),
            prisma.modification.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' }
            })
        ]);

        // Group items by category
        const categoryMap = new Map();
        for (const item of items) {
            const catName = item.category.name;
            if (!categoryMap.has(catName)) {
                categoryMap.set(catName, {
                    id: item.category.id,
                    name: catName,
                    items: []
                });
            }
            categoryMap.get(catName).items.push({
                id: item.id,
                name: item.name,
                description: item.description,
                price: parseFloat(item.price),
            });
        }

        res.json({
            categories: Array.from(categoryMap.values()),
            modifications: modifications.map(m => ({
                id: m.id,
                name: m.name,
                price: parseFloat(m.price),
            })),
        });
    } catch (err) {
        next(err);
    }
};

// ─── POST /api/guest/order ───────────────────────────────────────────────────
// Places an order from the QR menu.  Validates + prices server-side, no trust in client prices.
// Body: { tableId, guestName, items: [{ menuItemId, quantity, notes?, modifications?: [{ id, quantity? }] }] }
exports.placeOrder = async (req, res, next) => {
    try {
        const { tableId, guestName, items } = req.body;

        if (!tableId) return res.status(400).json({ error: 'tableId is required' });
        if (!items || items.length === 0) return res.status(400).json({ error: 'Order items are required' });

        const parsedTableId = parseInt(tableId, 10);
        if (isNaN(parsedTableId)) return res.status(400).json({ error: 'Invalid tableId' });

        // Verify table exists
        const table = await prisma.table.findUnique({ where: { id: parsedTableId } });
        if (!table) return res.status(404).json({ error: 'Table not found' });

        // Fetch server-side prices — never trust client
        const menuItemIds = [...new Set(items.map(i => i.menuItemId))];
        const dbMenuItems = await prisma.menuItem.findMany({
            where: { id: { in: menuItemIds } },
            select: { id: true, price: true, name: true, isActive: true }
        });
        const itemMap = new Map(dbMenuItems.map(m => [m.id, m]));

        for (const item of items) {
            const db = itemMap.get(item.menuItemId);
            if (!db) return res.status(400).json({ error: `Menu item ID ${item.menuItemId} not found` });
            if (!db.isActive) return res.status(400).json({ error: `"${db.name}" is currently unavailable` });
        }

        // Fetch modification prices
        const allModIds = [
            ...new Set(items.flatMap(i => (i.modifications || []).map(m => m.id)).filter(Boolean))
        ];
        let modMap = new Map();
        if (allModIds.length > 0) {
            const dbMods = await prisma.modification.findMany({
                where: { id: { in: allModIds } },
                select: { id: true, price: true, name: true, isActive: true }
            });
            modMap = new Map(dbMods.map(m => [m.id, m]));
            for (const modId of allModIds) {
                const mod = modMap.get(modId);
                if (!mod) return res.status(400).json({ error: `Modification ID ${modId} not found` });
                if (!mod.isActive) return res.status(400).json({ error: `Modification "${mod.name}" is unavailable` });
            }
        }

        // Calculate totals server-side
        let subtotal = 0;
        for (const item of items) {
            const serverPrice = parseFloat(itemMap.get(item.menuItemId).price);
            let itemTotal = serverPrice * item.quantity;
            for (const mod of (item.modifications || [])) {
                itemTotal += parseFloat(modMap.get(mod.id).price) * (mod.quantity || 1) * item.quantity;
            }
            subtotal += itemTotal;
        }

        const tax = subtotal * config.tax.rate;
        const total = subtotal + tax;
        const billNumber = generateBillNumber();

        const order = await prisma.$transaction(async (tx) => {
            const newOrder = await tx.order.create({
                data: {
                    billNumber,
                    subtotal,
                    tax,
                    total,
                    status: 'PENDING',
                    orderType: 'DINE_IN',
                    tableId: parsedTableId,
                    // Store guest name in a notes field if your schema supports it, otherwise skip
                    items: {
                        create: items.map(item => ({
                            menuItemId: item.menuItemId,
                            quantity: item.quantity,
                            price: parseFloat(itemMap.get(item.menuItemId).price),
                            notes: [
                                guestName ? `Guest: ${guestName}` : null,
                                item.notes || null
                            ].filter(Boolean).join(' | ') || null,
                        }))
                    }
                },
                include: {
                    items: { select: { id: true } }
                }
            });

            // Attach modifications
            for (let i = 0; i < items.length; i++) {
                const clientItem = items[i];
                const createdItem = newOrder.items[i];
                for (const mod of (clientItem.modifications || [])) {
                    await tx.orderItemModification.create({
                        data: {
                            orderItemId: createdItem.id,
                            modificationId: mod.id,
                            quantity: mod.quantity || 1,
                            price: parseFloat(modMap.get(mod.id).price),
                        }
                    });
                }
            }

            // Mark table occupied
            await tx.table.update({
                where: { id: parsedTableId },
                data: {
                    status: 'OCCUPIED',
                    currentBill: total,
                    orderTime: new Date(),
                    updatedAt: new Date(),
                }
            });

            // Return full order for confirmation
            return tx.order.findUnique({
                where: { id: newOrder.id },
                include: {
                    table: { select: { number: true } },
                    items: {
                        include: {
                            menuItem: { select: { name: true } },
                            modifications: { include: { modification: { select: { name: true } } } }
                        }
                    }
                }
            });
        });

        res.status(201).json({
            message: 'Order placed successfully! Our team will serve you shortly.',
            billNumber,
            orderId: order.id,
            tableNumber: order.table?.number,
            subtotal: parseFloat(subtotal.toFixed(2)),
            tax: parseFloat(tax.toFixed(2)),
            total: parseFloat(total.toFixed(2)),
            items: order.items.map(i => ({
                name: i.menuItem.name,
                quantity: i.quantity,
                price: parseFloat(i.price),
                modifications: i.modifications.map(m => m.modification.name),
                notes: i.notes,
            }))
        });
    } catch (err) {
        console.error('Guest order error:', err);
        next(err);
    }
};
