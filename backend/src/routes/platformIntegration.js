/**
 * Platform Integration Routes
 * Manages menu item mappings and integration configuration
 */

const express = require('express');
const router = express.Router();
const platformController = require('../controllers/platformIntegrationController');
const configController = require('../controllers/platformConfigController');
const auth = require('../middleware/auth');
const { adminOrManager } = require('../middleware/authorize');

// All routes require authentication and admin/manager role
router.use(auth, adminOrManager);

// ── Platform Configuration & Connection Testing ──

/** GET /api/integration/config - Get all platform configs */
router.get('/config', configController.getPlatformConfigs);

/** GET /api/integration/config/:platform - Get single platform config */
router.get('/config/:platform', configController.getPlatformConfig);

/** PUT /api/integration/config/:platform - Update platform config & credentials */
router.put('/config/:platform', configController.updatePlatformConfig);

/** POST /api/integration/config/:platform/test - Test platform connection */
router.post('/config/:platform/test', configController.testPlatformConnection);

// ── Menu Item Mappings ──

/**
 * GET /api/integration/mappings
 * Get all or filtered menu item mappings
 * Query params: platform, isActive, searchTerm
 */
router.get('/mappings', platformController.getMenuItemMappings);

/**
 * GET /api/integration/mappings/:menuItemId
 * Get mappings for specific menu item across all platforms
 */
router.get('/mappings/:menuItemId', platformController.getMenuItemMapping);

/**
 * POST /api/integration/mappings
 * Create or update a menu item mapping
 * Body: { menuItemId, platform, platformItemId, platformItemName?, platformPrice? }
 */
router.post('/mappings', platformController.createOrUpdateMapping);

/**
 * DELETE /api/integration/mappings/:mappingId
 * Delete a mapping
 */
router.delete('/mappings/:mappingId', platformController.deleteMapping);

/**
 * POST /api/integration/mappings/bulk-import
 * Import multiple mappings at once
 * Body: { mappings: [ { menuItemId, platform, platformItemId, ... } ] }
 */
router.post('/mappings/bulk-import', platformController.bulkImportMappings);

/**
 * GET /api/integration/mappings/export
 * Export all mappings as JSON
 * Query params: platform (optional - filter by platform)
 */
router.get('/export', platformController.exportMappings);

/**
 * POST /api/integration/sync/:platform
 * Push full menu to platform (ZOMATO supported)
 */
router.post('/sync/:platform', platformController.syncMenuWithPlatform);

/**
 * GET /api/integration/sync/:platform/preview
 * Preview the menu payload that would be sent (dry run)
 */
router.get('/sync/:platform/preview', platformController.previewMenuSync);

/**
 * GET /api/integration/menu/:platform
 * Fetch current menu from platform
 */
router.get('/menu/:platform', platformController.fetchMenuFromPlatform);

/**
 * POST /api/integration/stock/:platform
 * Sync all item stock statuses to platform
 */
router.post('/stock/:platform', platformController.syncStockWithPlatform);

/**
 * PUT /api/integration/stock/:platform/:menuItemId
 * Toggle stock for a single item on platform
 * Body: { inStock: true/false }
 */
router.put('/stock/:platform/:menuItemId', platformController.toggleItemStock);

/**
 * GET /api/integration/stats
 * Get integration statistics and webhook logs
 */
router.get('/stats', platformController.getIntegrationStats);

// ── Outlet Management (Zomato) ──

/** GET /api/integration/outlet/delivery-status - Get outlet delivery status */
router.get('/outlet/delivery-status', platformController.getOutletDeliveryStatus);

/** PUT /api/integration/outlet/delivery-status - Toggle delivery on/off */
router.put('/outlet/delivery-status', platformController.updateOutletDeliveryStatus);

/** PUT /api/integration/outlet/delivery-charge - Update delivery charges */
router.put('/outlet/delivery-charge', platformController.updateDeliveryCharge);

/** GET /api/integration/outlet/delivery-time - Get delivery time + surge */
router.get('/outlet/delivery-time', platformController.getOutletDeliveryTime);

/** POST /api/integration/outlet/surge-time - Add or remove surge time */
router.post('/outlet/surge-time', platformController.updateSurgeTime);

/** GET /api/integration/outlet/zomato-timings - Get Zomato delivery timings */
router.get('/outlet/zomato-timings', platformController.getZomatoDeliveryTimings);

/** PUT /api/integration/outlet/zomato-timings - Update Zomato delivery timings */
router.put('/outlet/zomato-timings', platformController.updateZomatoDeliveryTimings);

/** GET /api/integration/outlet/self-delivery-timings - Get self-delivery timings */
router.get('/outlet/self-delivery-timings', platformController.getSelfDeliveryTimings);

/** PUT /api/integration/outlet/self-delivery-timings - Update self-delivery timings */
router.put('/outlet/self-delivery-timings', platformController.updateSelfDeliveryTimings);

/** GET /api/integration/outlet/logistics-status - Get logistics status */
router.get('/outlet/logistics-status', platformController.getLogisticsStatus);

/** PUT /api/integration/outlet/self-delivery-serviceability - Toggle self-delivery */
router.put('/outlet/self-delivery-serviceability', platformController.updateSelfDeliveryServiceability);

module.exports = router;
