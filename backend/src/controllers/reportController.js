const { prisma } = require('../prisma');

// Helper to parse date string as local time
const parseLocalDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
};

// Get statistics - accepts optional 'date' query param for historical data
exports.getStats = async (req, res) => {
    try {
        const { date } = req.query;
        console.log('📊 getStats called with date param:', date);

        // If a specific date is provided, use that as the "target" date
        // Otherwise default to today
        let targetDate;
        if (date) {
            targetDate = parseLocalDate(date);
            console.log('📊 Fetching stats for specific date:', date, '-> parsed as:', targetDate);
        } else {
            targetDate = new Date();
            console.log('📊 Fetching stats for today (no date param):', targetDate);
        }
        targetDate.setHours(0, 0, 0, 0);

        const targetNextDay = new Date(targetDate);
        targetNextDay.setDate(targetNextDay.getDate() + 1);

        console.log('📅 Date range: from', targetDate.toISOString(), 'to', targetNextDay.toISOString());

        // Get the day before target for comparison
        const previousDay = new Date(targetDate);
        previousDay.setDate(previousDay.getDate() - 1);

        // Target day's orders
        const targetOrders = await prisma.order.findMany({
            where: {
                createdAt: {
                    gte: targetDate,
                    lt: targetNextDay
                }
            },
            include: {
                items: true
            }
        });

        // Previous day's orders for comparison
        const previousOrders = await prisma.order.findMany({
            where: {
                createdAt: {
                    gte: previousDay,
                    lt: targetDate
                }
            },
            include: {
                items: true
            }
        });

        // Calculate target day's sales (only PAID orders)
        const targetPaidOrders = targetOrders.filter(o => o.status === 'PAID');
        const targetSales = targetPaidOrders.reduce((sum, order) => {
            return sum + parseFloat(order.total);
        }, 0);

        // Calculate previous day's sales for comparison
        const previousPaidOrders = previousOrders.filter(o => o.status === 'PAID');
        const previousSales = previousPaidOrders.reduce((sum, order) => {
            return sum + parseFloat(order.total);
        }, 0);

        // Calculate total items sold on target day
        const totalItemsSold = targetPaidOrders.reduce((sum, order) => {
            return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
        }, 0);

        // Calculate previous day's items sold
        const previousItemsSold = previousPaidOrders.reduce((sum, order) => {
            return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
        }, 0);

        // Low stock items
        const lowStockItems = await prisma.inventory.findMany({
            where: {
                quantity: {
                    lt: 10
                }
            },
            include: {
                menuItem: {
                    include: {
                        category: true
                    }
                }
            }
        });

        // Low stock ingredients
        const allIngredients = await prisma.ingredient.findMany();
        const lowStockIngredients = allIngredients.filter(ing => ing.currentStock <= ing.minStock);

        // Top selling items (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const topSellingData = await prisma.orderItem.groupBy({
            by: ['menuItemId'],
            where: {
                order: {
                    createdAt: {
                        gte: weekAgo
                    },
                    status: 'PAID'
                }
            },
            _sum: {
                quantity: true,
                price: true
            },
            orderBy: {
                _sum: {
                    quantity: 'desc'
                }
            },
            take: 10
        });

        // Get menu item details for top selling (batched query to prevent N+1)
        const topSellingMenuItemIds = topSellingData.map(item => item.menuItemId);
        const menuItemsMap = await prisma.menuItem.findMany({
            where: { id: { in: topSellingMenuItemIds } },
            include: { category: true }
        }).then(items => new Map(items.map(item => [item.id, item])));

        const topSellingItems = topSellingData.map(item => {
            const menuItem = menuItemsMap.get(item.menuItemId);
            return {
                id: item.menuItemId,
                name: menuItem?.name || 'Unknown',
                category: menuItem?.category?.name || 'Uncategorized',
                price: menuItem?.price || 0,
                totalSold: item._sum.quantity || 0,
                revenue: parseFloat(item._sum.price || 0) * (item._sum.quantity || 0)
            };
        });

        // Sales by category (last 7 days)
        const salesByCategory = await prisma.orderItem.groupBy({
            by: ['menuItemId'],
            where: {
                order: {
                    createdAt: {
                        gte: weekAgo
                    },
                    status: 'PAID'
                }
            },
            _sum: {
                quantity: true
            }
        });

        // Group by category (batched query to prevent N+1)
        const categoryMenuItemIds = salesByCategory.map(item => item.menuItemId);
        const categoryMenuItems = await prisma.menuItem.findMany({
            where: { id: { in: categoryMenuItemIds } },
            include: { category: true }
        }).then(items => new Map(items.map(item => [item.id, item])));

        const categoryMap = {};
        for (const item of salesByCategory) {
            const menuItem = categoryMenuItems.get(item.menuItemId);
            const categoryName = menuItem?.category?.name || 'Uncategorized';
            if (!categoryMap[categoryName]) {
                categoryMap[categoryName] = { name: categoryName, value: 0, items: 0 };
            }
            categoryMap[categoryName].value += (item._sum.quantity || 0) * parseFloat(menuItem?.price || 0);
            categoryMap[categoryName].items += item._sum.quantity || 0;
        }
        const salesByCategoryArray = Object.values(categoryMap).sort((a, b) => b.value - a.value);


        // Recent orders (last 10)
        const recentOrders = await prisma.order.findMany({
            take: 10,
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                table: true,
                items: {
                    include: {
                        menuItem: true
                    }
                }
            }
        });

        // Average order value
        const avgOrderValue = targetPaidOrders.length > 0
            ? targetSales / targetPaidOrders.length
            : 0;
        const previousAvgOrderValue = previousPaidOrders.length > 0
            ? previousSales / previousPaidOrders.length
            : 0;

        // Payment method breakdown (target day) - check both uppercase and lowercase for compatibility
        const paymentBreakdown = {
            cash: targetPaidOrders.filter(o => o.paymentMode?.toUpperCase() === 'CASH').length,
            card: targetPaidOrders.filter(o => o.paymentMode?.toUpperCase() === 'CARD').length,
            upi: targetPaidOrders.filter(o => o.paymentMode?.toUpperCase() === 'UPI').length
        };
        console.log('💰 Target day paid orders:', targetPaidOrders.length, 'Payment modes:', targetPaidOrders.map(o => o.paymentMode));

        // Peak hours analysis (target day)
        const hourlyOrders = {};
        targetOrders.forEach(order => {
            const hour = new Date(order.createdAt).getHours();
            hourlyOrders[hour] = (hourlyOrders[hour] || 0) + 1;
        });
        const peakHours = Object.entries(hourlyOrders)
            .map(([hour, count]) => ({ hour: parseInt(hour), orders: count }))
            .sort((a, b) => b.orders - a.orders);

        // Table utilization
        const allTables = await prisma.table.findMany();
        const occupiedTables = allTables.filter(t => t.status === 'OCCUPIED').length;
        const tableUtilization = allTables.length > 0
            ? Math.round((occupiedTables / allTables.length) * 100)
            : 0;

        console.log('✅ Stats result: targetSales=', targetSales, 'targetOrders=', targetOrders.length, 'previousSales=', previousSales);

        res.json({
            // Target day's metrics (labeled as "today" for frontend compatibility)
            todaySales: targetSales,
            todayOrders: targetOrders.length,
            todayPaidOrders: targetPaidOrders.length,
            totalItemsSold,
            avgOrderValue: Math.round(avgOrderValue * 100) / 100,

            // Previous day's metrics for comparison (labeled as "yesterday" for frontend compatibility)
            yesterdaySales: previousSales,
            yesterdayOrders: previousOrders.length,
            yesterdayPaidOrders: previousPaidOrders.length,
            yesterdayItemsSold: previousItemsSold,
            yesterdayAvgOrderValue: Math.round(previousAvgOrderValue * 100) / 100,

            // Growth percentages (target vs previous day)
            salesGrowth: previousSales > 0
                ? Math.round(((targetSales - previousSales) / previousSales) * 1000) / 10
                : 0,
            ordersGrowth: previousOrders.length > 0
                ? Math.round(((targetOrders.length - previousOrders.length) / previousOrders.length) * 1000) / 10
                : 0,
            itemsGrowth: previousItemsSold > 0
                ? Math.round(((totalItemsSold - previousItemsSold) / previousItemsSold) * 1000) / 10
                : 0,

            // Stock info
            lowStockCount: lowStockItems.length,
            lowStockItems: lowStockItems.map(item => ({
                id: item.menuItemId,
                name: item.menuItem?.name,
                category: item.menuItem?.category?.name,
                quantity: item.quantity,
                inventory: {
                    quantity: item.quantity
                }
            })),

            // Sales data
            topSellingItems,
            salesByCategory: salesByCategoryArray,

            // Orders info
            recentOrders: recentOrders.map(order => ({
                id: order.id,
                billNumber: order.billNumber,
                table: order.table,
                total: order.total,
                status: order.status,
                paymentMode: order.paymentMode,
                itemCount: order.items.length,
                createdAt: order.createdAt,
                paidAt: order.paidAt
            })),

            // Additional analytics
            paymentBreakdown,
            peakHours: peakHours.slice(0, 5),
            tableUtilization,
            totalTables: allTables.length,
            occupiedTables
        });

    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            error: 'Failed to fetch statistics',
            message: error.message
        });
    }
};

// Get sales trend (EXISTING - unchanged)
exports.getSalesTrend = async (req, res) => {
    try {
        const { from, to } = req.query;
        console.log('📈 Fetching sales trend from', from, 'to', to);

        // Parse dates properly to avoid timezone issues
        // When parsing YYYY-MM-DD, we need to handle it as local time
        const parseLocalDate = (dateStr) => {
            const [year, month, day] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day);
        };

        // Default to last 7 days if no dates provided
        let endDate, startDate;

        if (to) {
            endDate = parseLocalDate(to);
        } else {
            endDate = new Date();
        }
        endDate.setHours(23, 59, 59, 999);

        if (from) {
            startDate = parseLocalDate(from);
        } else {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
        }
        startDate.setHours(0, 0, 0, 0);

        console.log('📅 Parsed dates - Start:', startDate.toISOString(), 'End:', endDate.toISOString());

        // Get orders in date range (all statuses for trend, but calculate sales from PAID)
        const orders = await prisma.order.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                items: true
            }
        });

        console.log('📦 Found', orders.length, 'orders in date range');

        // Group by day
        const salesByDay = {};

        // Initialize all days in range (use local date formatting)
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            // Format as YYYY-MM-DD in local time
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            salesByDay[dateStr] = {
                sales: 0,
                orders: 0,
                items: 0
            };
            currentDate.setDate(currentDate.getDate() + 1);
        }

        console.log('📆 Initialized days:', Object.keys(salesByDay));

        // Fill in actual data
        orders.forEach(order => {
            // Format order date in local time
            const orderDate = new Date(order.createdAt);
            const year = orderDate.getFullYear();
            const month = String(orderDate.getMonth() + 1).padStart(2, '0');
            const day = String(orderDate.getDate()).padStart(2, '0');
            const date = `${year}-${month}-${day}`;

            if (salesByDay[date]) {
                salesByDay[date].orders += 1;
                if (order.status === 'PAID') {
                    salesByDay[date].sales += parseFloat(order.total);
                    salesByDay[date].items += order.items.reduce((sum, item) => sum + item.quantity, 0);
                }
            }
        });

        // Convert to array format
        const salesTrend = Object.entries(salesByDay)
            .map(([date, data]) => {
                const [year, month, day] = date.split('-').map(Number);
                const dateObj = new Date(year, month - 1, day);
                return {
                    name: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
                    date,
                    fullDate: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    sales: Math.round(data.sales * 100) / 100,
                    orders: data.orders,
                    items: data.items
                };
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        console.log('✅ Sales trend result:', salesTrend);
        res.json(salesTrend);

    } catch (error) {
        console.error('Error fetching sales trend:', error);
        res.status(500).json({
            error: 'Failed to fetch sales trend',
            message: error.message
        });
    }
};

// Get category-wise sales (EXISTING - unchanged)
exports.getCategorySales = async (req, res) => {
    try {
        const { from, to } = req.query;

        const endDate = to ? new Date(to) : new Date();
        const startDate = from ? new Date(from) : new Date();
        if (!from) startDate.setDate(startDate.getDate() - 30);

        const orderItems = await prisma.orderItem.findMany({
            where: {
                order: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate
                    },
                    status: 'PAID'
                }
            },
            include: {
                menuItem: {
                    include: {
                        category: true
                    }
                }
            }
        });

        const categoryMap = {};
        orderItems.forEach(item => {
            const categoryName = item.menuItem?.category?.name || 'Uncategorized';
            if (!categoryMap[categoryName]) {
                categoryMap[categoryName] = { name: categoryName, sales: 0, items: 0 };
            }
            categoryMap[categoryName].sales += parseFloat(item.price) * item.quantity;
            categoryMap[categoryName].items += item.quantity;
        });

        const categorySales = Object.values(categoryMap).sort((a, b) => b.sales - a.sales);
        res.json(categorySales);

    } catch (error) {
        console.error('Error fetching category sales:', error);
        res.status(500).json({ error: 'Failed to fetch category sales' });
    }
};

// Get hourly sales pattern (EXISTING - unchanged)
exports.getHourlySales = async (req, res) => {
    try {
        const { date } = req.query;

        const targetDate = date ? new Date(date) : new Date();
        targetDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const orders = await prisma.order.findMany({
            where: {
                createdAt: {
                    gte: targetDate,
                    lt: nextDay
                }
            }
        });

        // Initialize all hours
        const hourlyData = [];
        for (let i = 0; i < 24; i++) {
            hourlyData.push({
                hour: i,
                label: `${i.toString().padStart(2, '0')}:00`,
                orders: 0,
                sales: 0
            });
        }

        // Fill in data
        orders.forEach(order => {
            const hour = new Date(order.createdAt).getHours();
            hourlyData[hour].orders += 1;
            if (order.status === 'PAID') {
                hourlyData[hour].sales += parseFloat(order.total);
            }
        });

        res.json(hourlyData);

    } catch (error) {
        console.error('Error fetching hourly sales:', error);
        res.status(500).json({ error: 'Failed to fetch hourly sales' });
    }
};

// ============================================
// NEW: Get profit analysis for all menu items
// ============================================
exports.getProfitAnalysis = async (req, res) => {
    try {
        const { from, to } = req.query;

        const endDate = to ? new Date(to) : new Date();
        endDate.setHours(23, 59, 59, 999);

        const startDate = from ? new Date(from) : new Date();
        if (!from) startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);

        // Get all menu items with ingredients
        const menuItems = await prisma.menuItem.findMany({
            include: {
                category: true,
                ingredients: {
                    include: { ingredient: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        // Get sales data for each item in date range
        const salesData = await prisma.orderItem.groupBy({
            by: ['menuItemId'],
            where: {
                order: {
                    createdAt: { gte: startDate, lte: endDate },
                    status: 'PAID'
                }
            },
            _sum: { quantity: true }
        });

        // Create sales map for quick lookup
        const salesMap = {};
        salesData.forEach(s => {
            salesMap[s.menuItemId] = s._sum.quantity || 0;
        });

        // Calculate profit for each item
        const profitAnalysis = menuItems.map(item => {
            // Calculate total ingredient cost for one unit of this item
            const ingredientCost = item.ingredients.reduce((total, ing) => {
                const costPerUnit = parseFloat(ing.ingredient.costPerUnit || 0);
                return total + (ing.quantity * costPerUnit);
            }, 0);

            const sellingPrice = parseFloat(item.price);
            const profit = sellingPrice - ingredientCost;
            const profitMargin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
            const unitsSold = salesMap[item.id] || 0;
            const totalRevenue = sellingPrice * unitsSold;
            const totalCost = ingredientCost * unitsSold;
            const totalProfit = profit * unitsSold;

            return {
                id: item.id,
                name: item.name,
                category: item.category?.name || 'Uncategorized',
                isActive: item.isActive,
                sellingPrice: Math.round(sellingPrice * 100) / 100,
                ingredientCost: Math.round(ingredientCost * 100) / 100,
                profit: Math.round(profit * 100) / 100,
                profitMargin: Math.round(profitMargin * 10) / 10,
                unitsSold,
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                totalCost: Math.round(totalCost * 100) / 100,
                totalProfit: Math.round(totalProfit * 100) / 100,
                ingredientCount: item.ingredients.length,
                ingredients: item.ingredients.map(ing => ({
                    name: ing.ingredient.name,
                    quantity: ing.quantity,
                    unit: ing.ingredient.unit,
                    costPerUnit: parseFloat(ing.ingredient.costPerUnit || 0),
                    totalCost: Math.round(ing.quantity * parseFloat(ing.ingredient.costPerUnit || 0) * 100) / 100
                }))
            };
        });

        // Sort by profit margin (highest first)
        const sortedByMargin = [...profitAnalysis].sort((a, b) => b.profitMargin - a.profitMargin);

        // Calculate summary
        const totalRevenue = profitAnalysis.reduce((sum, item) => sum + item.totalRevenue, 0);
        const totalCost = profitAnalysis.reduce((sum, item) => sum + item.totalCost, 0);
        const totalProfit = profitAnalysis.reduce((sum, item) => sum + item.totalProfit, 0);

        const itemsWithSales = profitAnalysis.filter(i => i.unitsSold > 0);
        const avgProfitMargin = itemsWithSales.length > 0
            ? itemsWithSales.reduce((sum, item) => sum + item.profitMargin, 0) / itemsWithSales.length
            : 0;

        // Find best and worst performers (only items with sales)
        const bestPerformers = sortedByMargin.filter(i => i.unitsSold > 0).slice(0, 5);
        const worstPerformers = sortedByMargin.filter(i => i.unitsSold > 0).slice(-5).reverse();
        const noRecipe = profitAnalysis.filter(i => i.ingredientCount === 0);

        res.json({
            summary: {
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                totalCost: Math.round(totalCost * 100) / 100,
                totalProfit: Math.round(totalProfit * 100) / 100,
                avgProfitMargin: Math.round(avgProfitMargin * 10) / 10,
                itemsAnalyzed: profitAnalysis.length,
                itemsWithSales: itemsWithSales.length,
                itemsWithRecipe: profitAnalysis.filter(i => i.ingredientCount > 0).length,
                itemsWithoutRecipe: noRecipe.length
            },
            bestPerformers,
            worstPerformers,
            noRecipe: noRecipe.slice(0, 10), // Limit to 10
            allItems: sortedByMargin
        });

    } catch (error) {
        console.error('Error fetching profit analysis:', error);
        res.status(500).json({
            error: 'Failed to fetch profit analysis',
            message: error.message
        });
    }
};