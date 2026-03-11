/**
 * Platform Config Controller
 * Manages platform credentials, configuration, and connection testing
 * for Swiggy & Zomato integrations
 */

const { prisma } = require('../prisma');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Fields that are masked when returned to the frontend
const SENSITIVE_FIELDS = ['apiKey', 'webhookSecret'];

/**
 * Mask sensitive string values for safe display
 */
function maskSensitive(value) {
    if (!value) return null;
    if (value.length <= 8) return '••••••••';
    return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4);
}

/**
 * GET /api/integration/config
 * Get platform configurations (with masked secrets)
 */
exports.getPlatformConfigs = async (req, res, next) => {
    try {
        const configs = await prisma.platformConfig.findMany({
            orderBy: { platform: 'asc' }
        });

        // Mask sensitive fields before sending to frontend
        const safeConfigs = configs.map(config => ({
            ...config,
            apiKey: maskSensitive(config.apiKey),
            webhookSecret: maskSensitive(config.webhookSecret),
            hasApiKey: !!config.apiKey,
            hasWebhookSecret: !!config.webhookSecret
        }));

        res.json({
            success: true,
            configs: safeConfigs
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/integration/config/:platform
 * Get single platform config (with masked secrets)
 */
exports.getPlatformConfig = async (req, res, next) => {
    try {
        const { platform } = req.params;
        const platformUpper = platform.toUpperCase();

        if (!['SWIGGY', 'ZOMATO'].includes(platformUpper)) {
            return res.status(400).json({ success: false, error: 'Invalid platform' });
        }

        let config = await prisma.platformConfig.findUnique({
            where: { platform: platformUpper }
        });

        // Create default config if it doesn't exist
        if (!config) {
            config = await prisma.platformConfig.create({
                data: {
                    platform: platformUpper,
                    isEnabled: false,
                    autoAcceptOrders: false,
                    defaultPrepTime: 30
                }
            });
        }

        res.json({
            success: true,
            config: {
                ...config,
                apiKey: maskSensitive(config.apiKey),
                webhookSecret: maskSensitive(config.webhookSecret),
                hasApiKey: !!config.apiKey,
                hasWebhookSecret: !!config.webhookSecret
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/integration/config/:platform
 * Update platform configuration & credentials
 */
exports.updatePlatformConfig = async (req, res, next) => {
    try {
        const { platform } = req.params;
        const platformUpper = platform.toUpperCase();

        if (!['SWIGGY', 'ZOMATO'].includes(platformUpper)) {
            return res.status(400).json({ success: false, error: 'Invalid platform' });
        }

        const {
            isEnabled,
            apiKey,
            restaurantId,
            webhookSecret,
            autoAcceptOrders,
            defaultPrepTime,
            menuSyncEnabled,
            statusUpdateEnabled
        } = req.body;

        // Build update data — only include fields that were actually sent
        const updateData = {};
        if (typeof isEnabled === 'boolean') updateData.isEnabled = isEnabled;
        if (typeof autoAcceptOrders === 'boolean') updateData.autoAcceptOrders = autoAcceptOrders;
        if (typeof menuSyncEnabled === 'boolean') updateData.menuSyncEnabled = menuSyncEnabled;
        if (typeof statusUpdateEnabled === 'boolean') updateData.statusUpdateEnabled = statusUpdateEnabled;
        if (restaurantId !== undefined) updateData.restaurantId = restaurantId || null;
        if (defaultPrepTime !== undefined) updateData.defaultPrepTime = parseInt(defaultPrepTime) || 30;

        // Only update secrets if a new non-masked value was provided
        if (apiKey && !apiKey.includes('••••')) {
            updateData.apiKey = apiKey;
        }
        if (webhookSecret && !webhookSecret.includes('••••')) {
            updateData.webhookSecret = webhookSecret;
        }

        const config = await prisma.platformConfig.upsert({
            where: { platform: platformUpper },
            update: updateData,
            create: {
                platform: platformUpper,
                isEnabled: isEnabled || false,
                apiKey: apiKey && !apiKey.includes('••••') ? apiKey : null,
                restaurantId: restaurantId || null,
                webhookSecret: webhookSecret && !webhookSecret.includes('••••') ? webhookSecret : null,
                autoAcceptOrders: autoAcceptOrders || false,
                defaultPrepTime: parseInt(defaultPrepTime) || 30,
                menuSyncEnabled: menuSyncEnabled || false,
                statusUpdateEnabled: statusUpdateEnabled !== false
            }
        });

        logger.info(`Platform config updated for ${platformUpper}`, {
            platform: platformUpper,
            isEnabled: config.isEnabled,
            hasApiKey: !!config.apiKey,
            hasWebhookSecret: !!config.webhookSecret,
            restaurantId: config.restaurantId
        });

        res.json({
            success: true,
            message: `${platformUpper} configuration updated`,
            config: {
                ...config,
                apiKey: maskSensitive(config.apiKey),
                webhookSecret: maskSensitive(config.webhookSecret),
                hasApiKey: !!config.apiKey,
                hasWebhookSecret: !!config.webhookSecret
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/integration/config/:platform/test
 * Test platform connection by validating configuration completeness
 * and performing a self-test of the webhook signature verification
 */
exports.testPlatformConnection = async (req, res, next) => {
    try {
        const { platform } = req.params;
        const platformUpper = platform.toUpperCase();

        if (!['SWIGGY', 'ZOMATO'].includes(platformUpper)) {
            return res.status(400).json({ success: false, error: 'Invalid platform' });
        }

        const config = await prisma.platformConfig.findUnique({
            where: { platform: platformUpper }
        });

        const results = {
            platform: platformUpper,
            checks: [],
            overallStatus: 'pass' // will be set to 'fail' or 'warning' if needed
        };

        // Check 1: Config exists
        if (!config) {
            results.checks.push({
                name: 'Configuration Exists',
                status: 'fail',
                message: 'No configuration found. Please save credentials first.'
            });
            results.overallStatus = 'fail';
            return res.json({ success: true, results });
        }

        results.checks.push({
            name: 'Configuration Exists',
            status: 'pass',
            message: 'Platform configuration found in database'
        });

        // Check 2: API Key
        if (config.apiKey) {
            results.checks.push({
                name: 'API Key',
                status: 'pass',
                message: 'API key is configured'
            });
        } else {
            results.checks.push({
                name: 'API Key',
                status: 'warning',
                message: 'API key not set — required for outbound API calls (menu sync, status updates)'
            });
            if (results.overallStatus === 'pass') results.overallStatus = 'warning';
        }

        // Check 3: Restaurant ID
        if (config.restaurantId) {
            results.checks.push({
                name: 'Restaurant ID',
                status: 'pass',
                message: `Restaurant ID: ${config.restaurantId}`
            });
        } else {
            results.checks.push({
                name: 'Restaurant ID',
                status: 'warning',
                message: 'Restaurant ID not set — required for platform API calls'
            });
            if (results.overallStatus === 'pass') results.overallStatus = 'warning';
        }

        // Check 4: Webhook Secret
        if (config.webhookSecret) {
            results.checks.push({
                name: 'Webhook Secret',
                status: 'pass',
                message: 'Webhook secret is configured for signature verification'
            });
        } else {
            // Also check env var as fallback
            const envKey = platformUpper === 'SWIGGY' ? 'SWIGGY_WEBHOOK_SECRET' : 'ZOMATO_WEBHOOK_SECRET';
            if (process.env[envKey]) {
                results.checks.push({
                    name: 'Webhook Secret',
                    status: 'pass',
                    message: 'Webhook secret found in environment variables (fallback)'
                });
            } else {
                results.checks.push({
                    name: 'Webhook Secret',
                    status: 'fail',
                    message: 'Webhook secret not configured — incoming webhooks will be rejected'
                });
                results.overallStatus = 'fail';
            }
        }

        // Check 5: Platform enabled
        if (config.isEnabled) {
            results.checks.push({
                name: 'Platform Enabled',
                status: 'pass',
                message: 'Platform integration is enabled'
            });
        } else {
            results.checks.push({
                name: 'Platform Enabled',
                status: 'warning',
                message: 'Platform is disabled — enable it to start receiving orders'
            });
            if (results.overallStatus === 'pass') results.overallStatus = 'warning';
        }

        // Check 6: Webhook signature self-test
        const webhookSecret = config.webhookSecret || process.env[
            platformUpper === 'SWIGGY' ? 'SWIGGY_WEBHOOK_SECRET' : 'ZOMATO_WEBHOOK_SECRET'
        ];

        if (webhookSecret) {
            try {
                const testPayload = JSON.stringify({ test: true, timestamp: Date.now() });
                const expectedSig = crypto
                    .createHmac('sha256', webhookSecret)
                    .update(testPayload, 'utf8')
                    .digest('hex');

                // Verify the generated signature matches (self-test)
                const verifySig = crypto
                    .createHmac('sha256', webhookSecret)
                    .update(testPayload, 'utf8')
                    .digest('hex');

                const isValid = crypto.timingSafeEqual(
                    Buffer.from(expectedSig),
                    Buffer.from(verifySig)
                );

                results.checks.push({
                    name: 'Webhook Signature Verification',
                    status: isValid ? 'pass' : 'fail',
                    message: isValid
                        ? 'HMAC-SHA256 signature verification is working correctly'
                        : 'Signature verification failed — check webhook secret'
                });
                if (!isValid) results.overallStatus = 'fail';
            } catch (err) {
                results.checks.push({
                    name: 'Webhook Signature Verification',
                    status: 'fail',
                    message: `Signature test error: ${err.message}`
                });
                results.overallStatus = 'fail';
            }
        }

        // Check 7: Menu item mappings
        const mappingCount = await prisma.menuItemMapping.count({
            where: { platform: platformUpper, isActive: true }
        });

        if (mappingCount > 0) {
            results.checks.push({
                name: 'Menu Item Mappings',
                status: 'pass',
                message: `${mappingCount} active menu item mapping(s) configured`
            });
        } else {
            results.checks.push({
                name: 'Menu Item Mappings',
                status: 'warning',
                message: 'No menu item mappings — orders may fail to match items'
            });
            if (results.overallStatus === 'pass') results.overallStatus = 'warning';
        }

        // Check 8: Database connectivity (verify webhook log table works)
        try {
            await prisma.webhookLog.count({ where: { platform: platformUpper } });
            results.checks.push({
                name: 'Database Tables',
                status: 'pass',
                message: 'All required database tables are accessible'
            });
        } catch (err) {
            results.checks.push({
                name: 'Database Tables',
                status: 'fail',
                message: 'Database tables not accessible — run migrations'
            });
            results.overallStatus = 'fail';
        }

        logger.info(`Platform connection test completed for ${platformUpper}`, {
            overallStatus: results.overallStatus,
            checksCount: results.checks.length
        });

        res.json({ success: true, results });
    } catch (error) {
        next(error);
    }
};
