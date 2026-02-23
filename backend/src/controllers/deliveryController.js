const { prisma } = require('../prisma');
const config = require('../config/businessConfig');
const { getPaginationParams, formatPaginatedResponse } = require('../utils/pagination');

// Generate unique bill number for delivery/takeaway using crypto for collision resistance
const crypto = require('crypto');
const generateDeliveryBillNumber = (platform = 'DIRECT') => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();

    const prefix = {
        'DIRECT': 'DL',
        'ZOMATO': 'ZM',
        'SWIGGY': 'SW',
        'TAKEAWAY': 'TA'
    };

    return `${prefix[platform] || 'DL'}${year}${month}${day}${random}`;
};

// Helper: Create order from platform data
const createPlatformOrder = async (platformData, platform) => {
    const {
        customerName,
        customerPhone,
        customerEmail,
        deliveryAddress,
        items,
        platformOrderId,
        deliveryFee = 0,
        packagingFee = config.delivery.defaultPackagingFee,
        specialInstructions
    } = platformData;

    // Calculate subtotal from items
    const subtotal = items.reduce((sum, item) => {
        return sum + (parseFloat(item.price) * item.quantity);
    }, 0);

    const tax = subtotal * config.tax.rate;
    const total = subtotal + tax + parseFloat(deliveryFee) + parseFloat(packagingFee);
    const billNumber = generateDeliveryBillNumber(platform);

    const order = await prisma.$transaction(async (tx) => {
        // Create order with items
        const newOrder = await tx.order.create({
            data: {
                billNumber,
                subtotal,
                tax,
                total,
                status: 'PENDING',
                orderType: 'DELIVERY',
                tableId: null,
                items: {
                    create: items.map(item => ({
                        menuItemId: item.menuItemId,
                        quantity: item.quantity,
                        price: parseFloat(item.price),
                        notes: item.notes || null
                    }))
                },
                deliveryInfo: {
                    create: {
                        customerName,
                        customerPhone,
                        customerEmail: customerEmail || null,
                        deliveryAddress,
                        deliveryPlatform: platform,
                        platformOrderId: platformOrderId || null,
                        deliveryStatus: 'PENDING',
                        specialInstructions: specialInstructions || null,
                        deliveryFee: parseFloat(deliveryFee),
                        packagingFee: parseFloat(packagingFee)
                    }
                }
            },
            include: {
                items: {
                    include: {
                        menuItem: { include: { category: true } }
                    }
                },
                deliveryInfo: true
            }
        });

        // Deduct ingredients for each item
        for (const item of items) {
            const recipe = await tx.menuItemIngredient.findMany({
                where: { menuItemId: item.menuItemId },
                include: { ingredient: true }
            });

            for (const recipeItem of recipe) {
                const totalRequired = recipeItem.quantity * item.quantity;

                // Check if ingredient has sufficient stock
                if (recipeItem.ingredient.currentStock < totalRequired) {
                    throw new Error(
                        `Insufficient stock for ${recipeItem.ingredient.name}: need ${totalRequired}, have ${recipeItem.ingredient.currentStock}`
                    );
                }

                await tx.ingredient.update({
                    where: { id: recipeItem.ingredientId },
                    data: {
                        currentStock: { decrement: totalRequired }
                    }
                });

                await tx.ingredientStockLog.create({
                    data: {
                        ingredientId: recipeItem.ingredientId,
                        changeType: 'ORDER_USAGE',
                        quantity: -totalRequired,
                        orderId: newOrder.id,
                        notes: `${platform} order #${billNumber}`
                    }
                });
            }
        }

        return newOrder;
    });

    return order;
};

// ==========================================
// SIMULATION ENDPOINT - For Testing
// ==========================================
exports.simulateOnlineOrder = async (req, res, next) => {
    try {
        const { platform = 'ZOMATO' } = req.body;

        // Get random menu items for simulation
        const menuItems = await prisma.menuItem.findMany({
            where: { isActive: true },
            take: 10
        });

        if (menuItems.length === 0) {
            return res.status(400).json({ error: 'No menu items available' });
        }

        // Generate random customer data
        const firstNames = ['Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Neha', 'Arjun', 'Kavya'];
        const lastNames = ['Sharma', 'Patel', 'Kumar', 'Singh', 'Gupta', 'Verma', 'Joshi', 'Reddy'];
        const areas = ['Koregaon Park', 'Viman Nagar', 'Baner', 'Hinjewadi', 'Kharadi', 'Wakad', 'Aundh'];

        const randomName = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
        const randomPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
        const randomArea = areas[Math.floor(Math.random() * areas.length)];

        // Pick 1-3 random items
        const numItems = Math.floor(Math.random() * 3) + 1;
        const shuffled = menuItems.sort(() => 0.5 - Math.random());
        const selectedItems = shuffled.slice(0, numItems).map(item => ({
            menuItemId: item.id,
            name: item.name,
            quantity: Math.floor(Math.random() * 2) + 1,
            price: parseFloat(item.price),
            notes: Math.random() > 0.7 ? 'Extra spicy' : null
        }));

        const platformOrderId = `${platform.substring(0, 2)}${Date.now()}`;

        const orderData = {
            customerName: randomName,
            customerPhone: randomPhone,
            customerEmail: `${randomName.toLowerCase().replace(' ', '.')}@email.com`,
            deliveryAddress: `Flat ${Math.floor(Math.random() * 500) + 1}, Tower ${String.fromCharCode(65 + Math.floor(Math.random() * 5))}, ${randomArea}, Pune - 41100${Math.floor(Math.random() * 9) + 1}`,
            items: selectedItems,
            platformOrderId,
            deliveryFee: platform === 'ZOMATO' ? 30 : 25,
            packagingFee: 15,
            specialInstructions: Math.random() > 0.5 ? 'Please ring the doorbell twice' : null
        };

        const order = await createPlatformOrder(orderData, platform);

        console.log(`\n🔔 NEW ${platform} ORDER RECEIVED!`);
        console.log(`   Order ID: ${order.billNumber}`);
        console.log(`   Customer: ${randomName}`);
        console.log(`   Items: ${selectedItems.map(i => `${i.quantity}x ${i.name}`).join(', ')}`);
        console.log(`   Total: ₹${parseFloat(order.total).toFixed(2)}\n`);

        res.status(201).json({
            success: true,
            message: `Simulated ${platform} order created`,
            order,
            billNumber: order.billNumber
        });

    } catch (error) {
        console.error('Simulate order error:', error);
        next(error);
    }
};

// Create takeaway order (manual entry)
exports.createTakeawayOrder = async (req, res, next) => {
    try {
        const {
            customerName,
            customerPhone,
            customerEmail,
            orderItems,
            estimatedTime,
            specialInstructions,
            packagingFee = 0
        } = req.body;

        if (!customerName || !customerPhone || !orderItems || orderItems.length === 0) {
            return res.status(400).json({
                error: 'Customer name, phone, and order items are required'
            });
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
                return res.status(400).json({ error: `Menu item with ID ${item.menuItemId} not found` });
            }
            if (!dbItem.isActive) {
                return res.status(400).json({ error: `Menu item "${dbItem.name}" is currently unavailable` });
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
        }

        // Calculate totals using server-side prices
        const subtotal = orderItems.reduce((sum, item) => {
            const serverPrice = parseFloat(menuItemPriceMap.get(item.menuItemId).price);
            let itemTotal = serverPrice * item.quantity;
            if (item.modifications) {
                for (const mod of item.modifications) {
                    const serverModPrice = modPriceMap.has(mod.id) ? parseFloat(modPriceMap.get(mod.id).price) : 0;
                    itemTotal += serverModPrice * (mod.quantity || 1) * item.quantity;
                }
            }
            return sum + itemTotal;
        }, 0);

        const tax = subtotal * config.tax.rate;
        const total = subtotal + tax + parseFloat(packagingFee);
        const billNumber = generateDeliveryBillNumber('TAKEAWAY');

        const order = await prisma.$transaction(async (tx) => {
            const newOrder = await tx.order.create({
                data: {
                    billNumber,
                    subtotal,
                    tax,
                    total,
                    status: 'PENDING',
                    orderType: 'TAKEAWAY',
                    tableId: null,
                    items: {
                        create: orderItems.map(item => ({
                            menuItemId: item.menuItemId,
                            quantity: item.quantity,
                            price: parseFloat(menuItemPriceMap.get(item.menuItemId).price),
                            notes: item.notes || null
                        }))
                    },
                    deliveryInfo: {
                        create: {
                            customerName,
                            customerPhone,
                            customerEmail: customerEmail || null,
                            deliveryPlatform: 'DIRECT',
                            deliveryStatus: 'PENDING',
                            estimatedTime: estimatedTime ? new Date(estimatedTime) : null,
                            specialInstructions: specialInstructions || null,
                            packagingFee: parseFloat(packagingFee)
                        }
                    }
                },
                include: {
                    items: {
                        include: {
                            menuItem: { include: { category: true } }
                        }
                    },
                    deliveryInfo: true
                }
            });

            return newOrder;
        });

        res.status(201).json({
            success: true,
            message: 'Takeaway order created',
            order,
            billNumber
        });

    } catch (error) {
        console.error('Create takeaway order error:', error);
        next(error);
    }
};

// Create delivery order (manual entry)
exports.createDeliveryOrder = async (req, res, next) => {
    try {
        const {
            customerName,
            customerPhone,
            customerEmail,
            deliveryAddress,
            orderItems,
            estimatedTime,
            specialInstructions,
            deliveryFee = 0,
            packagingFee = 0,
            platform = 'DIRECT',
            platformOrderId = null
        } = req.body;

        if (!customerName || !customerPhone || !deliveryAddress || !orderItems || orderItems.length === 0) {
            return res.status(400).json({
                error: 'Customer details, address, and order items are required'
            });
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
                return res.status(400).json({ error: `Menu item with ID ${item.menuItemId} not found` });
            }
            if (!dbItem.isActive) {
                return res.status(400).json({ error: `Menu item "${dbItem.name}" is currently unavailable` });
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
        }

        // Calculate totals using server-side prices
        const subtotal = orderItems.reduce((sum, item) => {
            const serverPrice = parseFloat(menuItemPriceMap.get(item.menuItemId).price);
            let itemTotal = serverPrice * item.quantity;
            if (item.modifications) {
                for (const mod of item.modifications) {
                    const serverModPrice = modPriceMap.has(mod.id) ? parseFloat(modPriceMap.get(mod.id).price) : 0;
                    itemTotal += serverModPrice * (mod.quantity || 1) * item.quantity;
                }
            }
            return sum + itemTotal;
        }, 0);

        const tax = subtotal * config.tax.rate;
        const total = subtotal + tax + parseFloat(deliveryFee) + parseFloat(packagingFee);
        const billNumber = generateDeliveryBillNumber(platform);

        const order = await prisma.$transaction(async (tx) => {
            const newOrder = await tx.order.create({
                data: {
                    billNumber,
                    subtotal,
                    tax,
                    total,
                    status: 'PENDING',
                    orderType: 'DELIVERY',
                    tableId: null,
                    items: {
                        create: orderItems.map(item => ({
                            menuItemId: item.menuItemId,
                            quantity: item.quantity,
                            price: parseFloat(menuItemPriceMap.get(item.menuItemId).price),
                            notes: item.notes || null
                        }))
                    },
                    deliveryInfo: {
                        create: {
                            customerName,
                            customerPhone,
                            customerEmail: customerEmail || null,
                            deliveryAddress,
                            deliveryPlatform: platform,
                            platformOrderId: platformOrderId,
                            deliveryStatus: 'PENDING',
                            estimatedTime: estimatedTime ? new Date(estimatedTime) : null,
                            specialInstructions: specialInstructions || null,
                            deliveryFee: parseFloat(deliveryFee),
                            packagingFee: parseFloat(packagingFee)
                        }
                    }
                },
                include: {
                    items: {
                        include: {
                            menuItem: { include: { category: true } }
                        }
                    },
                    deliveryInfo: true
                }
            });

            return newOrder;
        });

        res.status(201).json({
            success: true,
            message: 'Delivery order created',
            order,
            billNumber
        });

    } catch (error) {
        console.error('Create delivery order error:', error);
        next(error);
    }
};

// Get all delivery/takeaway orders
exports.getDeliveryOrders = async (req, res, next) => {
    try {
        const { type, platform, status, date } = req.query;
        const { page, limit, skip } = getPaginationParams(req);

        const where = {
            orderType: { in: ['DELIVERY', 'TAKEAWAY'] }
        };

        if (type) {
            where.orderType = type.toUpperCase();
        }

        if (status) {
            where.status = status.toUpperCase();
        }

        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            where.createdAt = { gte: startDate, lte: endDate };
        }

        // Filter by platform via deliveryInfo relation
        if (platform) {
            where.deliveryInfo = {
                deliveryPlatform: platform.toUpperCase()
            };
        }

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                include: {
                    items: {
                        include: {
                            menuItem: { include: { category: true } },
                            modifications: { include: { modification: true } }
                        }
                    },
                    deliveryInfo: true
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.order.count({ where })
        ]);

        res.json(formatPaginatedResponse(orders, total, page, limit));
    } catch (error) {
        console.error('Get delivery orders error:', error);
        next(error);
    }
};

// Update delivery status
exports.updateDeliveryStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { deliveryStatus, deliveryPartnerName, deliveryPartnerPhone, actualTime } = req.body;

        if (!id || isNaN(parseInt(id, 10))) {
            return res.status(400).json({ error: 'Valid order ID is required' });
        }

        const validStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
        const normalizedStatus = deliveryStatus?.toUpperCase();
        if (!normalizedStatus || !validStatuses.includes(normalizedStatus)) {
            return res.status(400).json({
                error: 'Invalid delivery status',
                validStatuses
            });
        }

        const deliveryInfo = await prisma.deliveryInfo.update({
            where: { orderId: parseInt(id, 10) },
            data: {
                deliveryStatus: deliveryStatus?.toUpperCase(),
                deliveryPartnerName,
                deliveryPartnerPhone,
                actualTime: actualTime ? new Date(actualTime) : undefined
            },
            include: {
                order: true
            }
        });

        let orderStatus = null;
        switch (deliveryStatus?.toUpperCase()) {
            case 'CONFIRMED':
            case 'PREPARING':
                orderStatus = 'PREPARING';
                break;
            case 'READY_FOR_PICKUP':
                orderStatus = 'SERVED';
                break;
            case 'OUT_FOR_DELIVERY':
            case 'DELIVERED':
                orderStatus = 'PAID';
                break;
            case 'CANCELLED':
                orderStatus = 'CANCELLED';
                break;
        }

        if (orderStatus) {
            await prisma.order.update({
                where: { id: parseInt(id, 10) },
                data: {
                    status: orderStatus,
                    paidAt: orderStatus === 'PAID' ? new Date() : undefined
                }
            });
        }

        res.json({ success: true, deliveryInfo });

    } catch (error) {
        console.error('Update delivery status error:', error);
        next(error);
    }
};

// Get delivery statistics
exports.getDeliveryStats = async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayOrders = await prisma.order.findMany({
            where: {
                orderType: { in: ['DELIVERY', 'TAKEAWAY'] },
                createdAt: { gte: today, lt: tomorrow }
            },
            include: { deliveryInfo: true }
        });

        const stats = {
            totalOrders: todayOrders.length,
            takeawayOrders: todayOrders.filter(o => o.orderType === 'TAKEAWAY').length,
            deliveryOrders: todayOrders.filter(o => o.orderType === 'DELIVERY').length,
            byPlatform: {
                direct: todayOrders.filter(o => o.deliveryInfo?.deliveryPlatform === 'DIRECT').length,
                zomato: todayOrders.filter(o => o.deliveryInfo?.deliveryPlatform === 'ZOMATO').length,
                swiggy: todayOrders.filter(o => o.deliveryInfo?.deliveryPlatform === 'SWIGGY').length
            },
            byStatus: {
                pending: todayOrders.filter(o => o.deliveryInfo?.deliveryStatus === 'PENDING').length,
                preparing: todayOrders.filter(o => o.deliveryInfo?.deliveryStatus === 'PREPARING').length,
                ready: todayOrders.filter(o => o.deliveryInfo?.deliveryStatus === 'READY_FOR_PICKUP').length,
                outForDelivery: todayOrders.filter(o => o.deliveryInfo?.deliveryStatus === 'OUT_FOR_DELIVERY').length,
                delivered: todayOrders.filter(o => o.deliveryInfo?.deliveryStatus === 'DELIVERED').length,
                cancelled: todayOrders.filter(o => o.deliveryInfo?.deliveryStatus === 'CANCELLED').length
            },
            totalRevenue: todayOrders
                .filter(o => o.status === 'PAID')
                .reduce((sum, o) => sum + parseFloat(o.total), 0)
        };

        res.json(stats);

    } catch (error) {
        console.error('Get delivery stats error:', error);
        next(error);
    }
};