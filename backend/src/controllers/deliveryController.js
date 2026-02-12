const { prisma } = require('../prisma');

// Generate unique bill number for delivery/takeaway
const generateDeliveryBillNumber = (platform = 'DIRECT') => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

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
        packagingFee = 10,
        specialInstructions
    } = platformData;

    // Calculate subtotal from items
    const subtotal = items.reduce((sum, item) => {
        return sum + (parseFloat(item.price) * item.quantity);
    }, 0);

    const tax = subtotal * 0.05;
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

// ==========================================
// ZOMATO WEBHOOK - Real Integration
// ==========================================
exports.zomatoWebhook = async (req, res, next) => {
    try {
        const { event, data } = req.body;

        console.log('📦 Zomato webhook received:', event);
        console.log('   Data:', JSON.stringify(data, null, 2));

        // Verify webhook signature (in production)
        // const signature = req.headers['x-zomato-signature'];
        // if (!verifyZomatoSignature(signature, req.body)) {
        //     return res.status(401).json({ error: 'Invalid signature' });
        // }

        switch (event) {
            case 'order.placed':
            case 'order.created':
                // Map Zomato item IDs to your menu item IDs
                // In production, you'd have a mapping table
                const zomatoItems = data.items || [];

                // Try to match items by name (simple matching)
                const mappedItems = [];
                for (const zItem of zomatoItems) {
                    const menuItem = await prisma.menuItem.findFirst({
                        where: {
                            name: { contains: zItem.name, mode: 'insensitive' }
                        }
                    });

                    if (menuItem) {
                        mappedItems.push({
                            menuItemId: menuItem.id,
                            name: menuItem.name,
                            quantity: zItem.quantity || 1,
                            price: parseFloat(menuItem.price),
                            notes: zItem.variant_name || zItem.instructions || null
                        });
                    }
                }

                if (mappedItems.length === 0) {
                    console.log('⚠️ No matching menu items found for Zomato order');
                    return res.status(400).json({ error: 'No matching menu items' });
                }

                const orderData = {
                    customerName: data.customer?.name || 'Zomato Customer',
                    customerPhone: data.customer?.phone || data.customer?.mobile || '',
                    customerEmail: data.customer?.email || null,
                    deliveryAddress: data.delivery?.address?.full_address ||
                        data.delivery_address ||
                        'Address not provided',
                    items: mappedItems,
                    platformOrderId: data.order_id || data.id,
                    deliveryFee: parseFloat(data.delivery_fee || 0),
                    packagingFee: parseFloat(data.packaging_fee || 10),
                    specialInstructions: data.special_instructions || data.customer_note || null
                };

                const order = await createPlatformOrder(orderData, 'ZOMATO');

                console.log(`\n🔔 NEW ZOMATO ORDER: ${order.billNumber}\n`);

                return res.json({
                    success: true,
                    message: 'Order received',
                    orderId: order.id,
                    billNumber: order.billNumber
                });

            case 'order.cancelled':
                if (data.order_id) {
                    const existingOrder = await prisma.deliveryInfo.findFirst({
                        where: { platformOrderId: data.order_id }
                    });

                    if (existingOrder) {
                        await prisma.deliveryInfo.update({
                            where: { id: existingOrder.id },
                            data: { deliveryStatus: 'CANCELLED' }
                        });

                        await prisma.order.update({
                            where: { id: existingOrder.orderId },
                            data: { status: 'CANCELLED' }
                        });

                        console.log(`❌ Zomato order ${data.order_id} cancelled`);
                    }
                }
                break;

            case 'order.picked_up':
                // Delivery partner picked up the order
                if (data.order_id) {
                    await prisma.deliveryInfo.updateMany({
                        where: { platformOrderId: data.order_id },
                        data: {
                            deliveryStatus: 'OUT_FOR_DELIVERY',
                            deliveryPartnerName: data.delivery_boy?.name || null,
                            deliveryPartnerPhone: data.delivery_boy?.phone || null
                        }
                    });
                }
                break;

            default:
                console.log('Unhandled Zomato event:', event);
        }

        res.json({ success: true, message: 'Webhook processed' });

    } catch (error) {
        console.error('Zomato webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
};

// ==========================================
// SWIGGY WEBHOOK - Real Integration
// ==========================================
exports.swiggyWebhook = async (req, res, next) => {
    try {
        const { event_type, payload } = req.body;

        console.log('📦 Swiggy webhook received:', event_type);
        console.log('   Payload:', JSON.stringify(payload, null, 2));

        switch (event_type) {
            case 'ORDER_PLACED':
            case 'NEW_ORDER':
                const swiggyItems = payload.items || payload.order_items || [];

                const mappedItems = [];
                for (const sItem of swiggyItems) {
                    const menuItem = await prisma.menuItem.findFirst({
                        where: {
                            name: { contains: sItem.name || sItem.item_name, mode: 'insensitive' }
                        }
                    });

                    if (menuItem) {
                        mappedItems.push({
                            menuItemId: menuItem.id,
                            name: menuItem.name,
                            quantity: sItem.quantity || 1,
                            price: parseFloat(menuItem.price),
                            notes: sItem.customizations || sItem.variant || null
                        });
                    }
                }

                if (mappedItems.length === 0) {
                    console.log('⚠️ No matching menu items found for Swiggy order');
                    return res.status(400).json({ error: 'No matching menu items' });
                }

                const orderData = {
                    customerName: payload.customer?.name || payload.customer_name || 'Swiggy Customer',
                    customerPhone: payload.customer?.phone || payload.customer_phone || '',
                    customerEmail: payload.customer?.email || null,
                    deliveryAddress: payload.delivery_address?.full_address ||
                        payload.address ||
                        'Address not provided',
                    items: mappedItems,
                    platformOrderId: payload.order_id || payload.id,
                    deliveryFee: parseFloat(payload.delivery_charges || 0),
                    packagingFee: parseFloat(payload.packing_charges || 10),
                    specialInstructions: payload.instructions || payload.special_request || null
                };

                const order = await createPlatformOrder(orderData, 'SWIGGY');

                console.log(`\n🔔 NEW SWIGGY ORDER: ${order.billNumber}\n`);

                return res.json({
                    success: true,
                    orderId: order.id,
                    billNumber: order.billNumber
                });

            case 'ORDER_CANCELLED':
                if (payload.order_id) {
                    const existingOrder = await prisma.deliveryInfo.findFirst({
                        where: { platformOrderId: payload.order_id }
                    });

                    if (existingOrder) {
                        await prisma.deliveryInfo.update({
                            where: { id: existingOrder.id },
                            data: { deliveryStatus: 'CANCELLED' }
                        });

                        await prisma.order.update({
                            where: { id: existingOrder.orderId },
                            data: { status: 'CANCELLED' }
                        });
                    }
                }
                break;

            case 'ORDER_PICKED_UP':
                if (payload.order_id) {
                    await prisma.deliveryInfo.updateMany({
                        where: { platformOrderId: payload.order_id },
                        data: {
                            deliveryStatus: 'OUT_FOR_DELIVERY',
                            deliveryPartnerName: payload.delivery_executive?.name || null,
                            deliveryPartnerPhone: payload.delivery_executive?.phone || null
                        }
                    });
                }
                break;

            default:
                console.log('Unhandled Swiggy event:', event_type);
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Swiggy webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
};

// ==========================================
// EXISTING ENDPOINTS (keep all existing code)
// ==========================================

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

        const subtotal = orderItems.reduce((sum, item) => {
            let itemTotal = parseFloat(item.price) * item.quantity;
            if (item.modifications) {
                for (const mod of item.modifications) {
                    itemTotal += parseFloat(mod.price || 0) * (mod.quantity || 1) * item.quantity;
                }
            }
            return sum + itemTotal;
        }, 0);

        const tax = subtotal * 0.05;
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
                            price: parseFloat(item.price),
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

        const subtotal = orderItems.reduce((sum, item) => {
            let itemTotal = parseFloat(item.price) * item.quantity;
            if (item.modifications) {
                for (const mod of item.modifications) {
                    itemTotal += parseFloat(mod.price || 0) * (mod.quantity || 1) * item.quantity;
                }
            }
            return sum + itemTotal;
        }, 0);

        const tax = subtotal * 0.05;
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

        let orders = await prisma.order.findMany({
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
            orderBy: { createdAt: 'desc' }
        });

        if (platform) {
            orders = orders.filter(
                o => o.deliveryInfo?.deliveryPlatform === platform.toUpperCase()
            );
        }

        res.json(orders);

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