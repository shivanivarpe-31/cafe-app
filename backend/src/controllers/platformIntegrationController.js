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
 * Sync menu items with platform.
 * For Zomato: builds payload, validates, pushes full snapshot.
 * WARNING: Restaurant is toggled OFF during processing until Zomato confirms success.
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

        if (platformUpper === 'ZOMATO') {
            const zomatoApi = require('../integrations/zomato/zomatoApiClient');
            const result = await zomatoApi.syncMenuToZomato();

            return res.json({
                success: true,
                message: 'Menu pushed to Zomato. Restaurant will be temporarily toggled off until processing completes. Watch for the processing callback.',
                platform: platformUpper,
                result
            });
        }

        // Swiggy: preview only (no API client yet)
        const menuItems = await prisma.menuItem.findMany({
            where: { isActive: true },
            include: {
                category: true,
                platformMappings: {
                    where: { platform: platformUpper }
                }
            }
        });

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
            message: `Menu sync preview for ${platformUpper} (API client not yet implemented)`,
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
 * Fetch the current menu from a platform
 */
exports.fetchMenuFromPlatform = async (req, res, next) => {
    try {
        const { platform } = req.params;
        const platformUpper = platform.toUpperCase();

        if (platformUpper === 'ZOMATO') {
            const zomatoApi = require('../integrations/zomato/zomatoApiClient');
            const menu = await zomatoApi.getMenu();
            return res.json({ success: true, platform: platformUpper, menu });
        }

        res.status(400).json({
            success: false,
            error: `Fetch menu not supported for ${platformUpper}`
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Preview what would be sent to a platform (dry run)
 * Includes validation errors so the user can fix issues before pushing.
 */
exports.previewMenuSync = async (req, res, next) => {
    try {
        const { platform } = req.params;
        const platformUpper = platform.toUpperCase();

        if (platformUpper === 'ZOMATO') {
            const zomatoApi = require('../integrations/zomato/zomatoApiClient');
            let payload, validationErrors;
            try {
                payload = await zomatoApi.buildMenuPayload();
                validationErrors = zomatoApi.validateMenuPayload(payload);
            } catch (buildErr) {
                return res.json({
                    success: true,
                    platform: platformUpper,
                    preview: { categories: [], catalogues: [], modifierGroups: [] },
                    summary: { categories: 0, totalCatalogues: 0, rootItems: 0, addonItems: 0, modifierGroups: 0 },
                    validation: { valid: false, errors: [buildErr.message] },
                    notes: ['Configure Zomato integration first in the Configuration tab']
                });
            }

            // Count root catalogues (in subCategory entities)
            const rootCatalogueIds = new Set();
            for (const cat of (payload.categories || [])) {
                for (const sub of (cat.subCategories || [])) {
                    for (const ent of (sub.entities || [])) {
                        rootCatalogueIds.add(ent.vendorEntityId);
                    }
                }
            }

            return res.json({
                success: true,
                platform: platformUpper,
                preview: payload,
                summary: {
                    categories: (payload.categories || []).length,
                    totalCatalogues: (payload.catalogues || []).length,
                    rootItems: rootCatalogueIds.size,
                    addonItems: (payload.catalogues || []).length - rootCatalogueIds.size,
                    modifierGroups: (payload.modifierGroups || []).length
                },
                validation: {
                    valid: validationErrors.length === 0,
                    errors: validationErrors
                },
                notes: [
                    'This is a FULL SNAPSHOT — only items sent will be retained on Zomato',
                    'Restaurant will be temporarily toggled off during processing',
                    'inStock is only honored for NEW entities; use Stock Sync for existing items'
                ]
            });
        }

        res.status(400).json({
            success: false,
            error: `Preview not supported for ${platformUpper}`
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Sync stock status to platform
 */
exports.syncStockWithPlatform = async (req, res, next) => {
    try {
        const { platform } = req.params;
        const platformUpper = platform.toUpperCase();

        if (platformUpper === 'ZOMATO') {
            const zomatoApi = require('../integrations/zomato/zomatoApiClient');
            const result = await zomatoApi.syncStockToZomato();
            return res.json({
                success: true,
                message: 'Stock status synced to Zomato',
                platform: platformUpper,
                result
            });
        }

        res.status(400).json({
            success: false,
            error: `Stock sync not supported for ${platformUpper}`
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Toggle stock for a single item on a platform
 */
exports.toggleItemStock = async (req, res, next) => {
    try {
        const { platform, menuItemId } = req.params;
        const { inStock } = req.body;
        const platformUpper = platform.toUpperCase();

        if (typeof inStock !== 'boolean') {
            return res.status(400).json({ error: 'inStock (boolean) is required' });
        }

        if (platformUpper === 'ZOMATO') {
            const zomatoApi = require('../integrations/zomato/zomatoApiClient');
            const result = await zomatoApi.toggleItemStock(parseInt(menuItemId, 10), inStock);
            return res.json({
                success: true,
                message: `Item ${inStock ? 'marked in stock' : 'marked out of stock'} on Zomato`,
                result
            });
        }

        res.status(400).json({
            success: false,
            error: `Stock toggle not supported for ${platformUpper}`
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

// ─── Outlet Management ──────────────────────────────────────────────

/**
 * Get outlet delivery status from Zomato
 */
exports.getOutletDeliveryStatus = async (req, res, next) => {
    try {
        const zomatoApi = require('../integrations/zomato/zomatoApiClient');
        const result = await zomatoApi.getDeliveryStatus();
        res.json({ success: true, deliveryStatus: result });
    } catch (error) {
        if (error.message?.includes('not enabled') || error.message?.includes('not configured')) {
            return res.json({ success: false, deliveryStatus: null, message: error.message });
        }
        next(error);
    }
};

/**
 * Toggle outlet delivery on/off on Zomato
 */
exports.updateOutletDeliveryStatus = async (req, res, next) => {
    try {
        const { enabled, reason } = req.body;
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'enabled (boolean) is required' });
        }
        const zomatoApi = require('../integrations/zomato/zomatoApiClient');
        const result = await zomatoApi.updateDeliveryStatus(enabled, reason);
        res.json({
            success: true,
            message: `Delivery ${enabled ? 'enabled' : 'disabled'} on Zomato`,
            result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update delivery charge on Zomato
 */
exports.updateDeliveryCharge = async (req, res, next) => {
    try {
        const { charges } = req.body;
        if (!charges || !Array.isArray(charges)) {
            return res.status(400).json({ error: 'charges (array) is required' });
        }
        const zomatoApi = require('../integrations/zomato/zomatoApiClient');
        const result = await zomatoApi.updateDeliveryCharge({ charges });
        res.json({ success: true, message: 'Delivery charges updated', result });
    } catch (error) {
        next(error);
    }
};

/**
 * Get outlet delivery time + surge timings
 */
exports.getOutletDeliveryTime = async (req, res, next) => {
    try {
        const zomatoApi = require('../integrations/zomato/zomatoApiClient');
        const result = await zomatoApi.getDeliveryTime();
        res.json({ success: true, deliveryTime: result });
    } catch (error) {
        if (error.message?.includes('not enabled') || error.message?.includes('not configured')) {
            return res.json({ success: false, deliveryTime: null, message: error.message });
        }
        next(error);
    }
};

/**
 * Add or remove surge delivery time
 */
exports.updateSurgeTime = async (req, res, next) => {
    try {
        const { surgeTime, remove } = req.body;
        if (typeof surgeTime !== 'number' || surgeTime < 0) {
            return res.status(400).json({ error: 'surgeTime (positive number in minutes) is required' });
        }
        const zomatoApi = require('../integrations/zomato/zomatoApiClient');
        const result = await zomatoApi.addOrRemoveSurgeTime(surgeTime, remove === true);
        res.json({
            success: true,
            message: remove ? 'Surge time removed' : `Surge time set to ${surgeTime} minutes`,
            result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get Zomato delivery timings
 */
exports.getZomatoDeliveryTimings = async (req, res, next) => {
    try {
        const zomatoApi = require('../integrations/zomato/zomatoApiClient');
        const result = await zomatoApi.getZomatoDeliveryTimings();
        res.json({ success: true, timings: result });
    } catch (error) {
        if (error.message?.includes('not enabled') || error.message?.includes('not configured')) {
            return res.json({ success: false, timings: null, message: error.message });
        }
        next(error);
    }
};

/**
 * Update Zomato delivery timings
 */
exports.updateZomatoDeliveryTimings = async (req, res, next) => {
    try {
        const { timings } = req.body;
        if (!timings || typeof timings !== 'object') {
            return res.status(400).json({ error: 'timings (object) is required' });
        }
        const zomatoApi = require('../integrations/zomato/zomatoApiClient');
        const result = await zomatoApi.updateZomatoDeliveryTimings(timings);
        res.json({ success: true, message: 'Zomato delivery timings updated', result });
    } catch (error) {
        next(error);
    }
};

/**
 * Get self-delivery timings
 */
exports.getSelfDeliveryTimings = async (req, res, next) => {
    try {
        const zomatoApi = require('../integrations/zomato/zomatoApiClient');
        const result = await zomatoApi.getSelfDeliveryTimings();
        res.json({ success: true, timings: result });
    } catch (error) {
        if (error.message?.includes('not enabled') || error.message?.includes('not configured')) {
            return res.json({ success: false, timings: null, message: error.message });
        }
        next(error);
    }
};

/**
 * Update self-delivery timings
 */
exports.updateSelfDeliveryTimings = async (req, res, next) => {
    try {
        const { timings } = req.body;
        if (!timings || typeof timings !== 'object') {
            return res.status(400).json({ error: 'timings (object) is required' });
        }
        const zomatoApi = require('../integrations/zomato/zomatoApiClient');
        const result = await zomatoApi.updateSelfDeliveryTimings(timings);
        res.json({ success: true, message: 'Self-delivery timings updated', result });
    } catch (error) {
        next(error);
    }
};

/**
 * Get outlet logistics status
 */
exports.getLogisticsStatus = async (req, res, next) => {
    try {
        const zomatoApi = require('../integrations/zomato/zomatoApiClient');
        const result = await zomatoApi.getLogisticsStatus();
        res.json({ success: true, logisticsStatus: result });
    } catch (error) {
        if (error.message?.includes('not enabled') || error.message?.includes('not configured')) {
            return res.json({ success: false, logisticsStatus: null, message: error.message });
        }
        next(error);
    }
};

/**
 * Update self-delivery serviceability status
 */
exports.updateSelfDeliveryServiceability = async (req, res, next) => {
    try {
        const { enabled, reason } = req.body;
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'enabled (boolean) is required' });
        }
        const zomatoApi = require('../integrations/zomato/zomatoApiClient');
        const result = await zomatoApi.updateSelfDeliveryServiceability(enabled, reason);
        res.json({
            success: true,
            message: `Self-delivery ${enabled ? 'enabled' : 'disabled'}`,
            result
        });
    } catch (error) {
        next(error);
    }
};
