const { prisma, Prisma } = require('../prisma');
const config = require('../config/businessConfig');
const {
    createInsufficientStockError,
    createNotFoundError,
    createValidationError,
    createOrderStatusError,
} = require('../utils/errors');

const { getPaginationParams, formatPaginatedResponse } = require('../utils/pagination');

// Generate unique bill number using crypto for collision resistance
const crypto = require('crypto');
const generateBillNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 hex chars = 4+ billion possibilities
    return `BILL${year}${month}${day}${random}`;
};

// Helper function to check if enough ingredients are available
// When withLock=true, uses pessimistic locking (FOR UPDATE) to prevent race conditions
const checkIngredientAvailability = async (tx, orderItems, withLock = false) => {
    const missingIngredients = [];

    for (const item of orderItems) {
        // Get recipe for this menu item
        const recipe = await tx.menuItemIngredient.findMany({
            where: { menuItemId: item.menuItemId },
            include: {
                ingredient: true,
                menuItem: true
            }
        });

        // If no recipe defined, skip ingredient check
        if (recipe.length === 0) continue;

        // If locking is requested, get ingredient IDs and lock them
        if (withLock && recipe.length > 0) {
            const ingredientIds = recipe.map(r => r.ingredientId);

            // Use raw SQL to lock ingredient rows with FOR UPDATE
            // This prevents other transactions from reading or modifying these rows
            await tx.$queryRaw`
                SELECT id, currentStock
                FROM Ingredient
                WHERE id IN (${Prisma.join(ingredientIds)})
                FOR UPDATE
            `;
        }

        // Check each ingredient in the recipe
        for (const recipeItem of recipe) {
            const requiredQty = recipeItem.quantity * item.quantity;

            // Re-fetch ingredient with current lock to get latest stock value
            const currentIngredient = withLock
                ? await tx.ingredient.findUnique({ where: { id: recipeItem.ingredientId } })
                : recipeItem.ingredient;

            if (currentIngredient.currentStock < requiredQty) {
                missingIngredients.push({
                    menuItem: recipeItem.menuItem.name,
                    ingredient: recipeItem.ingredient.name,
                    required: requiredQty,
                    available: currentIngredient.currentStock,
                    unit: recipeItem.ingredient.unit
                });
            }
        }
    }

    return missingIngredients;
};

// Helper function to deduct ingredients when order is placed
const deductIngredients = async (tx, orderItems, orderId) => {
    for (const item of orderItems) {
        // Get recipe for this menu item
        const recipe = await tx.menuItemIngredient.findMany({
            where: { menuItemId: item.menuItemId },
            include: { ingredient: true }
        });

        // If no recipe, skip (backward compatible with items without recipes)
        if (recipe.length === 0) continue;

        // Deduct each ingredient
        for (const recipeItem of recipe) {
            const totalRequired = recipeItem.quantity * item.quantity;

            // Update ingredient stock
            await tx.ingredient.update({
                where: { id: recipeItem.ingredientId },
                data: {
                    currentStock: { decrement: totalRequired }
                }
            });

            // Log the usage
            await tx.ingredientStockLog.create({
                data: {
                    ingredientId: recipeItem.ingredientId,
                    changeType: 'ORDER_USAGE',
                    quantity: -totalRequired,
                    orderId: orderId,
                    notes: `Used for order #${orderId} - ${item.quantity}x items`
                }
            });
        }
    }
};

// Create new order
exports.createOrder = async (req, res, next) => {
    try {
        const { tableId, orderItems, orderType = 'DINE_IN' } = req.body;

        // Validate order items are present
        if (!orderItems || orderItems.length === 0) {
            throw createValidationError('orderItems', 'Order items are required');
        }

        // For dine-in orders, tableId is required
        if (orderType === 'DINE_IN' && !tableId) {
            throw createValidationError('tableId', 'Table is required for dine-in orders');
        }

        // Fetch actual prices from the database (never trust client-submitted prices)
        const menuItemIds = [...new Set(orderItems.map(item => item.menuItemId))];
        const dbMenuItems = await prisma.menuItem.findMany({
            where: { id: { in: menuItemIds } },
            select: { id: true, price: true, name: true, isActive: true }
        });
        const menuItemPriceMap = new Map(dbMenuItems.map(m => [m.id, m]));

        // Validate all menu items exist and are active
        for (const item of orderItems) {
            const dbItem = menuItemPriceMap.get(item.menuItemId);
            if (!dbItem) {
                throw createValidationError('menuItemId', `Menu item with ID ${item.menuItemId} not found`);
            }
            if (!dbItem.isActive) {
                throw createValidationError('menuItemId', `Menu item "${dbItem.name}" is currently unavailable`);
            }
        }

        // Fetch actual modification prices from the database
        const allModIds = [...new Set(
            orderItems.flatMap(item =>
                (item.modifications || []).map(mod => mod.id)
            ).filter(Boolean)
        )];
        let modPriceMap = new Map();
        if (allModIds.length > 0) {
            const dbMods = await prisma.modification.findMany({
                where: { id: { in: allModIds } },
                select: { id: true, price: true, name: true, isActive: true }
            });
            modPriceMap = new Map(dbMods.map(m => [m.id, m]));

            // Validate all modifications exist and are active
            for (const modId of allModIds) {
                const dbMod = modPriceMap.get(modId);
                if (!dbMod) {
                    throw createValidationError('modificationId', `Modification with ID ${modId} not found`);
                }
                if (!dbMod.isActive) {
                    throw createValidationError('modificationId', `Modification "${dbMod.name}" is currently unavailable`);
                }
            }
        }

        // Calculate totals using server-side prices
        let subtotal = 0;

        for (const item of orderItems) {
            const serverPrice = parseFloat(menuItemPriceMap.get(item.menuItemId).price);
            let itemTotal = serverPrice * item.quantity;

            // Add modification charges using server-side prices
            if (item.modifications && item.modifications.length > 0) {
                for (const mod of item.modifications) {
                    const serverModPrice = parseFloat(modPriceMap.get(mod.id).price);
                    itemTotal += serverModPrice * (mod.quantity || 1) * item.quantity;
                }
            }

            subtotal += itemTotal;
        }

        const tax = subtotal * config.tax.rate;
        const total = subtotal + tax;

        const billNumber = generateBillNumber();

        const order = await prisma.$transaction(async (tx) => {
            // Check ingredient availability
            const missingIngredients = await checkIngredientAvailability(tx, orderItems);

            if (missingIngredients.length > 0) {
                throw createInsufficientStockError(missingIngredients);
            }

            // Create order - tableId is optional for takeaway/delivery
            const orderData = {
                billNumber,
                subtotal,
                tax,
                total,
                status: 'PENDING',
                orderType: orderType,
                items: {
                    create: orderItems.map(item => ({
                        menuItemId: item.menuItemId,
                        quantity: item.quantity,
                        price: parseFloat(menuItemPriceMap.get(item.menuItemId).price),
                        notes: item.notes || null
                    }))
                }
            };

            // Only add tableId for dine-in orders
            if (orderType === 'DINE_IN' && tableId) {
                orderData.tableId = parseInt(tableId, 10);
            }

            const newOrder = await tx.order.create({
                data: orderData,
                include: {
                    table: true,
                    items: {
                        include: {
                            menuItem: { include: { category: true } }
                        }
                    }
                }
            });

            // Add modifications to order items
            for (let i = 0; i < orderItems.length; i++) {
                const item = orderItems[i];
                const createdOrderItem = newOrder.items[i];

                if (item.modifications && item.modifications.length > 0) {
                    for (const mod of item.modifications) {
                        await tx.orderItemModification.create({
                            data: {
                                orderItemId: createdOrderItem.id,
                                modificationId: mod.id,
                                quantity: mod.quantity || 1,
                                price: parseFloat(modPriceMap.get(mod.id).price)
                            }
                        });
                    }
                }
            }

            // NOTE: Ingredients will be deducted when order status changes to PREPARING
            // This prevents stock loss if order creation fails or order is cancelled before cooking starts

            // Update table status only for dine-in orders
            if (orderType === 'DINE_IN' && tableId) {
                await tx.table.update({
                    where: { id: parseInt(tableId, 10) },
                    data: {
                        status: 'OCCUPIED',
                        currentBill: total,
                        orderTime: new Date(),
                        updatedAt: new Date()
                    }
                });
            }

            // Fetch complete order with modifications
            const completeOrder = await tx.order.findUnique({
                where: { id: newOrder.id },
                include: {
                    table: true,
                    items: {
                        include: {
                            menuItem: { include: { category: true } },
                            modifications: {
                                include: { modification: true }
                            }
                        }
                    }
                }
            });

            return completeOrder;
        });

        res.status(201).json({
            message: 'Order created successfully',
            order,
            billNumber
        });
    } catch (error) {
        console.error('Create order error:', error);
        next(error);
    }
};

// Update order items (only for PENDING orders)
exports.updateOrder = async (req, res, next) => {
    try {
        const orderId = parseInt(req.params.id, 10);
        const { orderItems } = req.body;

        if (!Number.isFinite(orderId)) {
            throw createValidationError('orderId', 'Invalid order id');
        }

        if (!orderItems || orderItems.length === 0) {
            throw createValidationError('orderItems', 'Order items are required');
        }

        // Get existing order
        const existingOrder = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: true,
                table: true
            }
        });

        if (!existingOrder) {
            throw createNotFoundError('Order', orderId);
        }

        // Only allow editing PENDING, PREPARING, or SERVED orders (before payment)
        if (!['PENDING', 'PREPARING', 'SERVED'].includes(existingOrder.status)) {
            throw createOrderStatusError(
                'Order can only be edited when in PENDING, PREPARING, or SERVED status',
                existingOrder.status,
                'PENDING, PREPARING, or SERVED'
            );
        }

        // Fetch actual prices from the database (never trust client-submitted prices)
        const menuItemIds = [...new Set(orderItems.map(item => item.menuItemId))];
        const dbMenuItems = await prisma.menuItem.findMany({
            where: { id: { in: menuItemIds } },
            select: { id: true, price: true, name: true, isActive: true }
        });
        const menuItemPriceMap = new Map(dbMenuItems.map(m => [m.id, m]));

        // Validate all menu items exist and are active
        for (const item of orderItems) {
            const dbItem = menuItemPriceMap.get(item.menuItemId);
            if (!dbItem) {
                throw createValidationError('menuItemId', `Menu item with ID ${item.menuItemId} not found`);
            }
            if (!dbItem.isActive) {
                throw createValidationError('menuItemId', `Menu item "${dbItem.name}" is currently unavailable`);
            }
        }

        // Fetch actual modification prices from the database
        const allModIds = [...new Set(
            orderItems.flatMap(item =>
                (item.modifications || []).map(mod => mod.id)
            ).filter(Boolean)
        )];
        let modPriceMap = new Map();
        if (allModIds.length > 0) {
            const dbMods = await prisma.modification.findMany({
                where: { id: { in: allModIds } },
                select: { id: true, price: true, name: true, isActive: true }
            });
            modPriceMap = new Map(dbMods.map(m => [m.id, m]));

            for (const modId of allModIds) {
                const dbMod = modPriceMap.get(modId);
                if (!dbMod) {
                    throw createValidationError('modificationId', `Modification with ID ${modId} not found`);
                }
                if (!dbMod.isActive) {
                    throw createValidationError('modificationId', `Modification "${dbMod.name}" is currently unavailable`);
                }
            }
        }

        // Calculate new totals using server-side prices
        let subtotal = 0;

        for (const item of orderItems) {
            const serverPrice = parseFloat(menuItemPriceMap.get(item.menuItemId).price);
            let itemTotal = serverPrice * item.quantity;

            // Add modification charges using server-side prices
            if (item.modifications && item.modifications.length > 0) {
                for (const mod of item.modifications) {
                    const serverModPrice = parseFloat(modPriceMap.get(mod.id).price);
                    itemTotal += serverModPrice * (mod.quantity || 1) * item.quantity;
                }
            }

            subtotal += itemTotal;
        }

        const tax = subtotal * config.tax.rate;
        const total = subtotal + tax;

        const updatedOrder = await prisma.$transaction(async (tx) => {
            // Check ingredient availability for new items
            const missingIngredients = await checkIngredientAvailability(tx, orderItems);

            if (missingIngredients.length > 0) {
                throw createInsufficientStockError(missingIngredients);
            }

            // Delete existing order items and their modifications
            await tx.orderItemModification.deleteMany({
                where: {
                    orderItem: {
                        orderId: orderId
                    }
                }
            });

            await tx.orderItem.deleteMany({
                where: { orderId: orderId }
            });

            // Update order with new items and totals
            const order = await tx.order.update({
                where: { id: orderId },
                data: {
                    subtotal,
                    tax,
                    total,
                    updatedAt: new Date(),
                    items: {
                        create: orderItems.map(item => ({
                            menuItemId: item.menuItemId,
                            quantity: item.quantity,
                            price: parseFloat(menuItemPriceMap.get(item.menuItemId).price),
                            notes: item.notes || null
                        }))
                    }
                },
                include: {
                    table: true,
                    items: {
                        include: {
                            menuItem: { include: { category: true } }
                        }
                    }
                }
            });

            // Add modifications to new order items
            for (let i = 0; i < orderItems.length; i++) {
                const item = orderItems[i];
                const createdOrderItem = order.items[i];

                if (item.modifications && item.modifications.length > 0) {
                    for (const mod of item.modifications) {
                        await tx.orderItemModification.create({
                            data: {
                                orderItemId: createdOrderItem.id,
                                modificationId: mod.id,
                                quantity: mod.quantity || 1,
                                price: parseFloat(modPriceMap.get(mod.id).price)
                            }
                        });
                    }
                }
            }

            // Update table current bill (only for dine-in orders with a table)
            if (existingOrder.tableId) {
                await tx.table.update({
                    where: { id: existingOrder.tableId },
                    data: {
                        currentBill: total,
                        updatedAt: new Date()
                    }
                });
            }

            // Fetch complete updated order with modifications
            const completeOrder = await tx.order.findUnique({
                where: { id: orderId },
                include: {
                    table: true,
                    items: {
                        include: {
                            menuItem: { include: { category: true } },
                            modifications: {
                                include: { modification: true }
                            }
                        }
                    }
                }
            });

            return completeOrder;
        });

        res.json({
            message: 'Order updated successfully',
            order: updatedOrder
        });
    } catch (error) {
        console.error('Update order error:', error);
        next(error);
    }
};

// Update getOrders to include modifications
exports.getOrders = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPaginationParams(req);

        const where = {};
        if (req.query.status) where.status = req.query.status.toUpperCase();
        if (req.query.orderType) where.orderType = req.query.orderType.toUpperCase();

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                include: {
                    table: true,
                    items: {
                        include: {
                            menuItem: {
                                include: { category: true }
                            },
                            modifications: {
                                include: { modification: true }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.order.count({ where })
        ]);

        res.json(formatPaginatedResponse(orders, total, page, limit));
    } catch (error) {
        next(error);
    }
};

// Get all tables for table management
exports.getTables = async (req, res, next) => {
    try {
        const tables = await prisma.table.findMany({
            include: {
                orders: {
                    where: { status: { in: ['PENDING', 'PREPARING', 'SERVED'] } },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            },
            orderBy: { id: 'asc' }
        });
        res.json(tables);
    } catch (error) {
        next(error);
    }
};

// Get active orders
exports.getActiveOrders = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPaginationParams(req);

        const where = {
            status: { in: ['PENDING', 'PREPARING', 'SERVED'] }
        };

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                include: {
                    table: true,
                    items: {
                        include: {
                            menuItem: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.order.count({ where })
        ]);

        res.json(formatPaginatedResponse(orders, total, page, limit));
    } catch (error) {
        next(error);
    }
};

exports.updateOrderStatus = async (req, res, next) => {
    try {
        const { status: rawStatus, paymentMode } = req.body;
        const orderId = parseInt(req.params.id, 10);

        if (!Number.isFinite(orderId)) {
            throw createValidationError('orderId', 'Invalid order id');
        }

        const validStatuses = ['PENDING', 'PREPARING', 'SERVED', 'PAID', 'CANCELLED'];
        const status = String(rawStatus || '').toUpperCase();

        if (!validStatuses.includes(status)) {
            throw createValidationError('status', `Invalid status value. Must be one of: ${validStatuses.join(', ')}`);
        }

        // First, get the order with its table and items
        const existingOrder = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                table: true,
                items: true,
                deliveryInfo: true
            }
        });

        if (!existingOrder) {
            throw createNotFoundError('Order', orderId);
        }

        const updateData = {
            status,
            updatedAt: new Date()
        };

        // If status is PAID, add payment info
        if (status === 'PAID' && paymentMode) {
            updateData.paymentMode = paymentMode;
            updateData.paidAt = new Date();
        }

        // If order is changing to PREPARING, deduct ingredients (kitchen starts cooking)
        if (status === 'PREPARING' && existingOrder.status !== 'PREPARING') {
            const order = await prisma.$transaction(async (tx) => {
                // Check ingredient availability with pessimistic locking (FOR UPDATE)
                // This prevents race conditions where two orders deduct the same inventory simultaneously
                const missingIngredients = await checkIngredientAvailability(tx, existingOrder.items, true);

                if (missingIngredients.length > 0) {
                    throw createInsufficientStockError(missingIngredients);
                }

                // Deduct ingredients
                await deductIngredients(tx, existingOrder.items, orderId);

                // Deduct simple inventory (backward compatible) with row-level locking
                const menuItemIds = existingOrder.items.map(item => item.menuItemId);

                // Lock inventory rows to prevent concurrent deductions
                if (menuItemIds.length > 0) {
                    await tx.$queryRaw`
                        SELECT id, quantity
                        FROM Inventory
                        WHERE menuItemId IN (${Prisma.join(menuItemIds)})
                        FOR UPDATE
                    `;
                }

                for (const item of existingOrder.items) {
                    const inv = await tx.inventory.findUnique({
                        where: { menuItemId: item.menuItemId }
                    });

                    if (inv && inv.quantity > 0) {
                        await tx.inventory.update({
                            where: { menuItemId: item.menuItemId },
                            data: {
                                quantity: { decrement: item.quantity },
                                lowStock: (inv.quantity - item.quantity) < 10
                            }
                        });
                    }
                }

                // Update order status inside the same transaction
                const updatedOrder = await tx.order.update({
                    where: { id: orderId },
                    data: updateData,
                    include: {
                        table: true,
                        items: { include: { menuItem: true } },
                        deliveryInfo: true
                    }
                });

                return updatedOrder;
            });

            res.json({ success: true, order, tableUpdated: !!existingOrder.tableId });
            return;
        }

        // If order is being CANCELLED, refund ingredients (only if they were already deducted)
        if (status === 'CANCELLED' && existingOrder.status !== 'CANCELLED') {
            const order = await prisma.$transaction(async (tx) => {
                // Only refund if order was already PREPARING, SERVED, or PAID (ingredients already deducted)
                if (['PREPARING', 'SERVED', 'PAID'].includes(existingOrder.status)) {
                    // Refund ingredients
                    for (const item of existingOrder.items) {
                        const recipe = await tx.menuItemIngredient.findMany({
                            where: { menuItemId: item.menuItemId },
                            include: { ingredient: true }
                        });

                        for (const recipeItem of recipe) {
                            const refundQty = recipeItem.quantity * item.quantity;

                            await tx.ingredient.update({
                                where: { id: recipeItem.ingredientId },
                                data: {
                                    currentStock: { increment: refundQty }
                                }
                            });

                            await tx.ingredientStockLog.create({
                                data: {
                                    ingredientId: recipeItem.ingredientId,
                                    changeType: 'ADJUSTMENT',
                                    quantity: refundQty,
                                    orderId: orderId,
                                    notes: `Refunded - Order #${orderId} cancelled from ${existingOrder.status} status`
                                }
                            });
                        }

                        // Refund simple inventory too
                        const inv = await tx.inventory.findUnique({
                            where: { menuItemId: item.menuItemId }
                        });

                        if (inv) {
                            await tx.inventory.update({
                                where: { menuItemId: item.menuItemId },
                                data: {
                                    quantity: { increment: item.quantity },
                                    lowStock: (inv.quantity + item.quantity) < 10
                                }
                            });
                        }
                    }
                }

                // Update order status inside the same transaction
                const updatedOrder = await tx.order.update({
                    where: { id: orderId },
                    data: updateData,
                    include: {
                        table: true,
                        items: { include: { menuItem: true } },
                        deliveryInfo: true
                    }
                });

                // Handle table status
                if (existingOrder.tableId) {
                    const activeOrdersOnTable = await tx.order.count({
                        where: {
                            tableId: existingOrder.tableId,
                            status: { in: ['PENDING', 'PREPARING', 'SERVED'] },
                            id: { not: orderId }
                        }
                    });

                    if (activeOrdersOnTable === 0) {
                        await tx.table.update({
                            where: { id: existingOrder.tableId },
                            data: {
                                status: 'AVAILABLE',
                                currentBill: 0,
                                orderTime: null,
                                customerName: null,
                                customerPhone: null,
                                reservedFrom: null,
                                reservedUntil: null,
                                updatedAt: new Date()
                            }
                        });
                    }
                }

                // Update delivery status
                if (existingOrder.deliveryInfo) {
                    await tx.deliveryInfo.update({
                        where: { orderId: orderId },
                        data: {
                            deliveryStatus: 'CANCELLED',
                            actualTime: new Date()
                        }
                    });
                }

                return updatedOrder;
            });

            res.json({ success: true, order, tableUpdated: !!existingOrder.tableId });
            return;
        }

        // For all other status transitions (PENDING, SERVED, PAID) — no inventory changes needed
        const order = await prisma.order.update({
            where: { id: orderId },
            data: updateData,
            include: {
                table: true,
                items: {
                    include: {
                        menuItem: true
                    }
                },
                deliveryInfo: true
            }
        });

        // Handle table status based on ALL orders for that table
        if ((status === 'PAID' || status === 'CANCELLED') && existingOrder.tableId) {
            const activeOrdersOnTable = await prisma.order.count({
                where: {
                    tableId: existingOrder.tableId,
                    status: {
                        in: ['PENDING', 'PREPARING', 'SERVED']
                    }
                }
            });

            if (activeOrdersOnTable === 0) {
                await prisma.table.update({
                    where: { id: existingOrder.tableId },
                    data: {
                        status: 'AVAILABLE',
                        currentBill: 0,
                        orderTime: null,
                        customerName: null,
                        customerPhone: null,
                        reservedFrom: null,
                        reservedUntil: null,
                        updatedAt: new Date()
                    }
                });
            }
        }

        // Update delivery status if this is a delivery/takeaway order
        if (existingOrder.deliveryInfo && (status === 'PAID' || status === 'CANCELLED')) {
            await prisma.deliveryInfo.update({
                where: { orderId: orderId },
                data: {
                    deliveryStatus: status === 'PAID' ? 'DELIVERED' : 'CANCELLED',
                    actualTime: new Date()
                }
            });
        }

        res.json({
            success: true,
            order,
            tableUpdated: !!existingOrder.tableId
        });
    } catch (error) {
        next(error);
    }
};

// Create Pay Later order
exports.createPayLaterOrder = async (req, res, next) => {
    try {
        const { orderId, customerName, customerPhone, customerAddress } = req.body;

        // Validation
        if (!orderId || !customerName || !customerPhone) {
            return res.status(400).json({
                error: 'Order ID, customer name, and phone are required'
            });
        }

        const order = await prisma.order.findUnique({
            where: { id: parseInt(orderId, 10) }
        });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (order.status === 'PAID' || order.status === 'PARTIALLY_PAID') {
            return res.status(400).json({ error: 'Order already has payments' });
        }

        await prisma.$transaction(async (tx) => {
            // Create or update DeliveryInfo with customer details
            await tx.deliveryInfo.upsert({
                where: { orderId: order.id },
                create: {
                    orderId: order.id,
                    customerName,
                    customerPhone,
                    deliveryAddress: customerAddress || '',
                    deliveryStatus: 'DELIVERED',
                    deliveryPlatform: 'DIRECT'
                },
                update: {
                    customerName,
                    customerPhone,
                    deliveryAddress: customerAddress || ''
                }
            });

            // Create Pay Later payment record
            await tx.payment.create({
                data: {
                    orderId: order.id,
                    amount: 0,
                    currency: 'INR',
                    paymentMode: 'PAY_LATER',
                    status: 'PENDING',
                    notes: JSON.stringify({
                        customerName,
                        customerPhone,
                        customerAddress: customerAddress || '',
                        totalDue: order.total
                    })
                }
            });

            // Update order
            await tx.order.update({
                where: { id: order.id },
                data: {
                    status: 'PARTIALLY_PAID',
                    paymentMode: 'PAY_LATER'
                }
            });

            // Update table status if order has a table
            if (order.tableId) {
                const activeOrdersOnTable = await tx.order.count({
                    where: {
                        tableId: order.tableId,
                        status: {
                            in: ['PENDING', 'PREPARING', 'SERVED']
                        }
                    }
                });

                if (activeOrdersOnTable === 0) {
                    await tx.table.update({
                        where: { id: order.tableId },
                        data: {
                            status: 'AVAILABLE',
                            currentBill: 0,
                            orderTime: null,
                            customerName: null,
                            customerPhone: null,
                            reservedFrom: null,
                            reservedUntil: null,
                            updatedAt: new Date()
                        }
                    });
                }
            }
        });

        res.json({
            success: true,
            message: 'Pay Later order created successfully'
        });

    } catch (error) {
        console.error('Create Pay Later order error:', error);
        next(error);
    }
};

// Get pending payments
exports.getPendingPayments = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPaginationParams(req);

        const where = {
            OR: [
                { status: 'PARTIALLY_PAID' },
                { paymentMode: 'PAY_LATER' }
            ]
        };

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                include: {
                    items: {
                        include: {
                            menuItem: true,
                            modifications: true
                        }
                    },
                    table: true,
                    deliveryInfo: true,
                    payments: {
                        orderBy: { createdAt: 'desc' }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.order.count({ where })
        ]);

        // Calculate remaining balance for each order
        const ordersWithBalance = orders.map(order => {
            const totalPaid = order.payments
                .filter(p => p.status === 'SUCCESS')
                .reduce((sum, p) => sum + parseFloat(p.amount), 0);

            const remaining = parseFloat(order.total) - totalPaid;

            return {
                ...order,
                totalPaid,
                remainingBalance: remaining
            };
        });

        res.json({
            success: true,
            orders: ordersWithBalance,
            pagination: formatPaginatedResponse([], total, page, limit).pagination
        });

    } catch (error) {
        console.error('Get pending payments error:', error);
        next(error);
    }
};