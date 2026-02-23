const { prisma } = require('../prisma');

// Helper to parse date string as local time
const parseLocalDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
};

// Get statistics - accepts optional 'date' query param for historical data
exports.getStats = async (req, res, next) => {
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

        // Target day's aggregated sales (PAID orders only)
        const targetAgg = await prisma.order.aggregate({
            where: {
                createdAt: { gte: targetDate, lt: targetNextDay },
                status: 'PAID'
            },
            _sum: { total: true },
            _count: { id: true }
        });
        const targetSales = parseFloat(targetAgg._sum.total || 0);
        const targetPaidCount = targetAgg._count.id;

        // Target day's total order count (all statuses)
        const targetOrderCount = await prisma.order.count({
            where: { createdAt: { gte: targetDate, lt: targetNextDay } }
        });

        // Previous day's aggregated sales
        const previousAgg = await prisma.order.aggregate({
            where: {
                createdAt: { gte: previousDay, lt: targetDate },
                status: 'PAID'
            },
            _sum: { total: true },
            _count: { id: true }
        });
        const previousSales = parseFloat(previousAgg._sum.total || 0);
        const previousPaidCount = previousAgg._count.id;
        const previousOrderCount = await prisma.order.count({
            where: { createdAt: { gte: previousDay, lt: targetDate } }
        });

        // Items sold — aggregate via orderItem
        const targetItemsAgg = await prisma.orderItem.aggregate({
            where: {
                order: {
                    createdAt: { gte: targetDate, lt: targetNextDay },
                    status: 'PAID'
                }
            },
            _sum: { quantity: true }
        });
        const totalItemsSold = targetItemsAgg._sum.quantity || 0;

        const previousItemsAgg = await prisma.orderItem.aggregate({
            where: {
                order: {
                    createdAt: { gte: previousDay, lt: targetDate },
                    status: 'PAID'
                }
            },
            _sum: { quantity: true }
        });
        const previousItemsSold = previousItemsAgg._sum.quantity || 0;

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

        // Low stock ingredients (filter at DB level)
        const lowStockIngredients = await prisma.$queryRaw`
            SELECT * FROM Ingredient WHERE currentStock <= minStock
        `;

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
        const avgOrderValue = targetPaidCount > 0
            ? targetSales / targetPaidCount
            : 0;
        const previousAvgOrderValue = previousPaidCount > 0
            ? previousSales / previousPaidCount
            : 0;

        // Payment method breakdown (target day) — aggregated at DB level
        const paymentBreakdownRaw = await prisma.order.groupBy({
            by: ['paymentMode'],
            where: {
                createdAt: { gte: targetDate, lt: targetNextDay },
                status: 'PAID'
            },
            _count: { id: true }
        });
        const paymentBreakdown = { cash: 0, card: 0, upi: 0 };
        for (const row of paymentBreakdownRaw) {
            const mode = (row.paymentMode || '').toLowerCase();
            if (paymentBreakdown.hasOwnProperty(mode)) {
                paymentBreakdown[mode] = row._count.id;
            }
        }

        // Peak hours analysis (target day) — aggregated via raw SQL
        const hourlyOrdersRaw = await prisma.$queryRaw`
            SELECT HOUR(createdAt) as hour, COUNT(*) as count
            FROM \`Order\`
            WHERE createdAt >= ${targetDate} AND createdAt < ${targetNextDay}
            GROUP BY HOUR(createdAt)
            ORDER BY count DESC
            LIMIT 5
        `;
        const peakHours = hourlyOrdersRaw.map(row => ({
            hour: Number(row.hour),
            orders: Number(row.count)
        }));

        // Table utilization
        const allTables = await prisma.table.findMany();
        const occupiedTables = allTables.filter(t => t.status === 'OCCUPIED').length;
        const tableUtilization = allTables.length > 0
            ? Math.round((occupiedTables / allTables.length) * 100)
            : 0;

        console.log('✅ Stats result: targetSales=', targetSales, 'targetOrders=', targetOrderCount, 'previousSales=', previousSales);

        res.json({
            // Target day's metrics (labeled as "today" for frontend compatibility)
            todaySales: targetSales,
            todayOrders: targetOrderCount,
            todayPaidOrders: targetPaidCount,
            totalItemsSold,
            avgOrderValue: Math.round(avgOrderValue * 100) / 100,

            // Previous day's metrics for comparison (labeled as "yesterday" for frontend compatibility)
            yesterdaySales: previousSales,
            yesterdayOrders: previousOrderCount,
            yesterdayPaidOrders: previousPaidCount,
            yesterdayItemsSold: previousItemsSold,
            yesterdayAvgOrderValue: Math.round(previousAvgOrderValue * 100) / 100,

            // Growth percentages (target vs previous day)
            salesGrowth: previousSales > 0
                ? Math.round(((targetSales - previousSales) / previousSales) * 1000) / 10
                : 0,
            ordersGrowth: previousOrderCount > 0
                ? Math.round(((targetOrderCount - previousOrderCount) / previousOrderCount) * 1000) / 10
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
            peakHours,
            tableUtilization,
            totalTables: allTables.length,
            occupiedTables
        });

    } catch (error) {
        console.error('Error fetching stats:', error);
        next(error);
    }
};

// Get sales trend (EXISTING - unchanged)
exports.getSalesTrend = async (req, res, next) => {
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

        // Aggregate sales by day using raw SQL
        const dailySalesRaw = await prisma.$queryRaw`
            SELECT
                DATE(createdAt) as orderDate,
                COUNT(*) as totalOrders,
                SUM(CASE WHEN status = 'PAID' THEN total ELSE 0 END) as paidSales
            FROM \`Order\`
            WHERE createdAt >= ${startDate} AND createdAt <= ${endDate}
            GROUP BY DATE(createdAt)
        `;

        const dailyItemsRaw = await prisma.$queryRaw`
            SELECT
                DATE(o.createdAt) as orderDate,
                SUM(oi.quantity) as totalItems
            FROM OrderItem oi
            JOIN \`Order\` o ON oi.orderId = o.id
            WHERE o.createdAt >= ${startDate} AND o.createdAt <= ${endDate}
                AND o.status = 'PAID'
            GROUP BY DATE(o.createdAt)
        `;

        // Build lookup maps from aggregated data
        const salesMap = {};
        for (const row of dailySalesRaw) {
            const d = new Date(row.orderDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            salesMap[key] = {
                sales: parseFloat(row.paidSales || 0),
                orders: Number(row.totalOrders || 0)
            };
        }
        const itemsMap = {};
        for (const row of dailyItemsRaw) {
            const d = new Date(row.orderDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            itemsMap[key] = Number(row.totalItems || 0);
        }

        // Build result with all days in range (fill zeros for missing days)
        const salesTrend = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const dateObj = new Date(year, currentDate.getMonth(), currentDate.getDate());

            salesTrend.push({
                name: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
                date: dateStr,
                fullDate: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                sales: Math.round((salesMap[dateStr]?.sales || 0) * 100) / 100,
                orders: salesMap[dateStr]?.orders || 0,
                items: itemsMap[dateStr] || 0
            });

            currentDate.setDate(currentDate.getDate() + 1);
        }

        res.json(salesTrend);

    } catch (error) {
        console.error('Error fetching sales trend:', error);
        next(error);
    }
};

// Get category-wise sales (EXISTING - unchanged)
exports.getCategorySales = async (req, res, next) => {
    try {
        const { from, to } = req.query;

        const endDate = to ? new Date(to) : new Date();
        const startDate = from ? new Date(from) : new Date();
        if (!from) startDate.setDate(startDate.getDate() - 30);

        // Aggregate category sales using Prisma groupBy + batched category lookup
        const itemSales = await prisma.orderItem.groupBy({
            by: ['menuItemId'],
            where: {
                order: {
                    createdAt: { gte: startDate, lte: endDate },
                    status: 'PAID'
                }
            },
            _sum: { quantity: true, price: true }
        });

        // Batch fetch menu items with categories
        const menuItemIds = itemSales.map(i => i.menuItemId);
        const menuItemsMap = new Map();
        if (menuItemIds.length > 0) {
            const menuItems = await prisma.menuItem.findMany({
                where: { id: { in: menuItemIds } },
                include: { category: true }
            });
            for (const mi of menuItems) menuItemsMap.set(mi.id, mi);
        }

        const categoryMap = {};
        for (const item of itemSales) {
            const menuItem = menuItemsMap.get(item.menuItemId);
            const categoryName = menuItem?.category?.name || 'Uncategorized';
            if (!categoryMap[categoryName]) {
                categoryMap[categoryName] = { name: categoryName, sales: 0, items: 0 };
            }
            categoryMap[categoryName].sales += parseFloat(item._sum.price || 0) * (item._sum.quantity || 0);
            categoryMap[categoryName].items += item._sum.quantity || 0;
        }

        const categorySales = Object.values(categoryMap).sort((a, b) => b.sales - a.sales);
        res.json(categorySales);

    } catch (error) {
        console.error('Error fetching category sales:', error);
        next(error);
    }
};

// Get hourly sales pattern (EXISTING - unchanged)
exports.getHourlySales = async (req, res, next) => {
    try {
        const { date } = req.query;

        const targetDate = date ? new Date(date) : new Date();
        targetDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);

        // Aggregate hourly data using raw SQL
        const hourlyRaw = await prisma.$queryRaw`
            SELECT
                HOUR(createdAt) as hour,
                COUNT(*) as totalOrders,
                SUM(CASE WHEN status = 'PAID' THEN total ELSE 0 END) as paidSales
            FROM \`Order\`
            WHERE createdAt >= ${targetDate} AND createdAt < ${nextDay}
            GROUP BY HOUR(createdAt)
        `;

        const hourlyMap = {};
        for (const row of hourlyRaw) {
            hourlyMap[Number(row.hour)] = {
                orders: Number(row.totalOrders),
                sales: parseFloat(row.paidSales || 0)
            };
        }

        // Initialize all hours
        const hourlyData = [];
        for (let i = 0; i < 24; i++) {
            hourlyData.push({
                hour: i,
                label: `${i.toString().padStart(2, '0')}:00`,
                orders: hourlyMap[i]?.orders || 0,
                sales: Math.round((hourlyMap[i]?.sales || 0) * 100) / 100
            });
        }

        res.json(hourlyData);

    } catch (error) {
        console.error('Error fetching hourly sales:', error);
        next(error);
    }
};

// ============================================
// NEW: Get profit analysis for all menu items
// ============================================
exports.getProfitAnalysis = async (req, res, next) => {
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
        next(error);
    }
};