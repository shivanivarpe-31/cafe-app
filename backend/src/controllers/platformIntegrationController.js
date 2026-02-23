/**
 * Platform Item Mapping Controller
 * Manages mapping between internal menu items and platform-specific item IDs
 * This allows proper matching of orders from Swiggy/Zomato
 */

const { prisma } = require('../prisma');
const logger = require('../utils/logger');
const { getPaginationParams, formatPaginatedResponse } = require('../utils/pagination');

/**
 * Get all menu items with their platform mappings
 */
exports.getMenuItemMappings = async (req, res, next) => {
    try {
        const { platform, isActive, searchTerm } = req.query;
        const { page, limit, skip } = getPaginationParams(req);

        const where = {
            menuItem: {
                isActive: isActive !== 'false'
            }
        };

        if (platform) {
            where.platform = platform.toUpperCase();
        }

        if (searchTerm) {
            where.menuItem.name = { contains: searchTerm, mode: 'insensitive' };
        }

        const [mappings, total] = await Promise.all([
            prisma.menuItemMapping.findMany({
                where,
                include: {
                    menuItem: {
                        select: {
                            id: true,
                            name: true,
                            price: true,
                            category: { select: { name: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.menuItemMapping.count({ where })
        ]);

        res.json({
            success: true,
            ...formatPaginatedResponse(mappings, total, page, limit)
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get mapping for specific menu item
 */
exports.getMenuItemMapping = async (req, res, next) => {
    try {
        const { menuItemId } = req.params;

        const mappings = await prisma.menuItemMapping.findMany({
            where: { menuItemId: parseInt(menuItemId) },
            include: {
                menuItem: {
                    select: {
                        id: true,
                        name: true,
                        price: true,
                        category: { select: { name: true } }
                    }
                }
            }
        });

        if (mappings.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No mappings found for this menu item'
            });
        }

        res.json({
            success: true,
            menuItemId: parseInt(menuItemId),
            platforms: mappings.reduce((acc, m) => {
                acc[m.platform] = {
                    id: m.platformItemId,
                    name: m.platformItemName,
                    price: m.platformPrice,
                    lastSynced: m.lastSyncedAt
                };
                return acc;
            }, {})
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create or update menu item mapping
 */
exports.createOrUpdateMapping = async (req, res, next) => {
    try {
        const {
            menuItemId,
            platform,
            platformItemId,
            platformItemName,
            platformPrice
        } = req.body;

        // Validate menu item exists
        const menuItem = await prisma.menuItem.findUnique({
            where: { id: parseInt(menuItemId) }
        });

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                error: 'Menu item not found'
            });
        }

        // Check if mapping already exists
        const existingMapping = await prisma.menuItemMapping.findFirst({
            where: {
                menuItemId: parseInt(menuItemId),
                platform: platform.toUpperCase(),
                platformItemId: platformItemId.toString()
            }
        });

        let mapping;

        if (existingMapping) {
            // Update existing
            mapping = await prisma.menuItemMapping.update({
                where: { id: existingMapping.id },
                data: {
                    platformItemName: platformItemName || menuItem.name,
                    platformPrice: platformPrice ? parseFloat(platformPrice) : menuItem.price,
                    lastSyncedAt: new Date()
                }
            });
        } else {
            // Create new
            mapping = await prisma.menuItemMapping.create({
                data: {
                    menuItemId: parseInt(menuItemId),
                    platform: platform.toUpperCase(),
                    platformItemId: platformItemId.toString(),
                    platformItemName: platformItemName || menuItem.name,
                    platformPrice: platformPrice ? parseFloat(platformPrice) : menuItem.price,
                    lastSyncedAt: new Date(),
                    isActive: true
                }
            });
        }

        logger.info('Platform item mapping created/updated', {
            mappingId: mapping.id,
            menuItemId,
            platform: mapping.platform,
            platformItemId: mapping.platformItemId
        });

        res.status(existingMapping ? 200 : 201).json({
            success: true,
            message: existingMapping ? 'Mapping updated' : 'Mapping created',
            mapping
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({
                success: false,
                error: 'This platform item is already mapped to another menu item'
            });
        }
        next(error);
    }
};

/**
 * Delete mapping
 */
exports.deleteMapping = async (req, res, next) => {
    try {
        const { mappingId } = req.params;

        const mapping = await prisma.menuItemMapping.findUnique({
            where: { id: parseInt(mappingId) }
        });

        if (!mapping) {
            return res.status(404).json({
                success: false,
                error: 'Mapping not found'
            });
        }

        await prisma.menuItemMapping.delete({
            where: { id: parseInt(mappingId) }
        });

        logger.info('Platform item mapping deleted', {
            mappingId: parseInt(mappingId),
            platform: mapping.platform
        });

        res.json({
            success: true,
            message: 'Mapping deleted'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Bulk import mappings from CSV
 * CSV Format: menuItemId,platform,platformItemId,platformItemName,platformPrice
 */
exports.bulkImportMappings = async (req, res, next) => {
    try {
        const { mappings } = req.body;

        if (!Array.isArray(mappings) || mappings.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid mappings array'
            });
        }

        const results = {
            created: 0,
            updated: 0,
            failed: 0,
            errors: []
        };

        for (const mapping of mappings) {
            try {
                const {
                    menuItemId,
                    platform,
                    platformItemId,
                    platformItemName,
                    platformPrice
                } = mapping;

                // Validate menu item
                const menuItem = await prisma.menuItem.findUnique({
                    where: { id: parseInt(menuItemId) }
                });

                if (!menuItem) {
                    results.failed++;
                    results.errors.push({
                        mapping,
                        error: `Menu item ${menuItemId} not found`
                    });
                    continue;
                }

                // Check if exists
                const existing = await prisma.menuItemMapping.findFirst({
                    where: {
                        menuItemId: parseInt(menuItemId),
                        platform: platform.toUpperCase(),
                        platformItemId: platformItemId.toString()
                    }
                });

                if (existing) {
                    await prisma.menuItemMapping.update({
                        where: { id: existing.id },
                        data: {
                            platformItemName: platformItemName || menuItem.name,
                            platformPrice: platformPrice
                                ? parseFloat(platformPrice)
                                : menuItem.price,
                            lastSyncedAt: new Date()
                        }
                    });
                    results.updated++;
                } else {
                    await prisma.menuItemMapping.create({
                        data: {
                            menuItemId: parseInt(menuItemId),
                            platform: platform.toUpperCase(),
                            platformItemId: platformItemId.toString(),
                            platformItemName: platformItemName || menuItem.name,
                            platformPrice: platformPrice
                                ? parseFloat(platformPrice)
                                : menuItem.price,
                            isActive: true
                        }
                    });
                    results.created++;
                }
            } catch (error) {
                results.failed++;
                results.errors.push({
                    mapping,
                    error: error.message
                });
            }
        }

        logger.info('Bulk import mappings completed', results);

        res.json({
            success: true,
            message: `Imported ${results.created + results.updated} mappings`,
            results
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Export mappings as JSON
 */
exports.exportMappings = async (req, res, next) => {
    try {
        const { platform } = req.query;

        const where = platform
            ? { platform: platform.toUpperCase() }
            : {};

        const mappings = await prisma.menuItemMapping.findMany({
            where,
            include: {
                menuItem: {
                    select: {
                        id: true,
                        name: true,
                        price: true
                    }
                }
            }
        });

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="mappings.json"');
        res.json({
            exportDate: new Date().toISOString(),
            platform: platform || 'ALL',
            total: mappings.length,
            mappings: mappings.map(m => ({
                menuItemId: m.menuItemId,
                menuItemName: m.menuItem.name,
                platform: m.platform,
                platformItemId: m.platformItemId,
                platformItemName: m.platformItemName,
                platformPrice: m.platformPrice,
                isActive: m.isActive,
                lastSynced: m.lastSyncedAt
            }))
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Sync menu items with platform
 * This would call actual Swiggy/Zomato APIs
 */
exports.syncMenuWithPlatform = async (req, res, next) => {
    try {
        const { platform } = req.params;
        const platformUpper = platform.toUpperCase();

        if (!['SWIGGY', 'ZOMATO'].includes(platformUpper)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid platform'
            });
        }

        // Get active menu items
        const menuItems = await prisma.menuItem.findMany({
            where: { isActive: true },
            include: {
                category: true,
                platformMappings: {
                    where: { platform: platformUpper }
                }
            }
        });

        // This would call actual platform API
        // For now, just return what would be synced
        const itemsToSync = menuItems.map(item => ({
            menuItemId: item.id,
            name: item.name,
            price: item.price,
            category: item.category.name,
            mapped: item.platformMappings.length > 0,
            platformMapping: item.platformMappings[0] || null
        }));

        res.json({
            success: true,
            message: 'Menu sync preview (not actually synced)',
            platform: platformUpper,
            itemsToSync: itemsToSync.filter(i => !i.mapped),
            alreadyMapped: itemsToSync.filter(i => i.mapped),
            totalItems: itemsToSync.length,
            unmappedCount: itemsToSync.filter(i => !i.mapped).length
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get webhook integration stats
 */
exports.getIntegrationStats = async (req, res, next) => {
    try {
        const stats = {
            mappings: {
                total: await prisma.menuItemMapping.count(),
                byPlatform: {
                    swiggy: await prisma.menuItemMapping.count({
                        where: { platform: 'SWIGGY', isActive: true }
                    }),
                    zomato: await prisma.menuItemMapping.count({
                        where: { platform: 'ZOMATO', isActive: true }
                    })
                }
            },
            integrationLogs: {
                total: await prisma.integrationLog.count(),
                last24Hours: await prisma.integrationLog.count({
                    where: {
                        createdAt: {
                            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                        }
                    }
                })
            },
            orders: {
                fromPlatforms: await prisma.deliveryInfo.count({
                    where: {
                        deliveryPlatform: {
                            in: ['SWIGGY', 'ZOMATO']
                        }
                    }
                })
            }
        };

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        next(error);
    }
};
