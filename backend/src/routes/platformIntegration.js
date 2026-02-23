/**
 * Platform Integration Routes
 * Manages menu item mappings and integration configuration
 */

const express = require('express');
const router = express.Router();
const platformController = require('../controllers/platformIntegrationController');
const auth = require('../middleware/auth');
const { adminOrManager } = require('../middleware/authorize');

// All routes require authentication and admin/manager role
router.use(auth, adminOrManager);

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
 * Sync menu with platform (SWIGGY or ZOMATO)
 * This previews what would be synced - doesn't actually sync yet
 */
router.post('/sync/:platform', platformController.syncMenuWithPlatform);

/**
 * GET /api/integration/stats
 * Get integration statistics and webhook logs
 */
router.get('/stats', platformController.getIntegrationStats);

module.exports = router;
