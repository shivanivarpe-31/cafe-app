/**
 * Swiggy API Client
 * Handles all outbound API calls to Swiggy's restaurant partner API.
 * 
 * NOTE: Swiggy's actual API endpoints, headers, and payload formats
 * will need to be adjusted once their POS integration documentation
 * is received. This client mirrors the Zomato integration pattern.
 */

const { prisma } = require('../../prisma');
const { logIntegrationEvent } = require('../../utils/integrationLogger');
const logger = require('../../utils/logger');

const DEFAULT_BASE_URL = 'https://partner-api.swiggy.com';

/**
 * Get Swiggy config from database
 */
async function getSwiggyConfig() {
    const config = await prisma.platformConfig.findUnique({
        where: { platform: 'SWIGGY' }
    });

    if (!config) {
        throw new Error('Swiggy platform not configured. Add credentials in Integration Settings.');
    }

    let settings = {};
    if (config.settings) {
        try { settings = JSON.parse(config.settings); } catch { /* use defaults */ }
    }

    return {
        apiKey: config.apiKey,
        restaurantId: config.restaurantId,
        baseUrl: settings.baseUrl || DEFAULT_BASE_URL,
        autoAcceptOrders: config.autoAcceptOrders,
        defaultPrepTime: config.defaultPrepTime,
        statusUpdateEnabled: config.statusUpdateEnabled
    };
}

/**
 * Make authenticated API call to Swiggy
 */
async function swiggyApiCall(endpoint, method, body = null) {
    const config = await getSwiggyConfig();
    const url = `${config.baseUrl}${endpoint}`;

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
    };

    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }

    const startTime = Date.now();
    let responseData, statusCode;

    try {
        const response = await fetch(url, options);
        statusCode = response.status;
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }

        // Log the API call
        await logIntegrationEvent({
            platform: 'SWIGGY',
            eventType: 'API_CALL',
            direction: 'OUTBOUND',
            endpoint,
            requestBody: body ? JSON.stringify(body) : null,
            responseBody: typeof responseData === 'string' ? responseData : JSON.stringify(responseData),
            statusCode,
            success: response.ok,
            errorMessage: response.ok ? null : (responseData?.message || `HTTP ${statusCode}`)
        }).catch(() => { });

        if (!response.ok) {
            const errMsg = responseData?.message || responseData?.error || `HTTP ${statusCode}`;
            throw new Error(`Swiggy API error: ${errMsg}`);
        }

        logger.info(`[SWIGGY API] ${method} ${endpoint} → ${statusCode} (${Date.now() - startTime}ms)`);
        return responseData;

    } catch (error) {
        logger.error(`[SWIGGY API] ${method} ${endpoint} failed`, {
            error: error.message,
            statusCode,
            duration: `${Date.now() - startTime}ms`
        });
        throw error;
    }
}

// ─── Order Management APIs ────────────────────────────────────────────

/**
 * Confirm an order from Swiggy
 */
async function confirmOrder(orderId, prepTime) {
    const config = await getSwiggyConfig();
    return swiggyApiCall('/api/v1/order/confirm', 'POST', {
        order_id: orderId,
        preparation_time: prepTime || config.defaultPrepTime
    });
}

/**
 * Reject an order from Swiggy
 */
async function rejectOrder(orderId, reason) {
    return swiggyApiCall('/api/v1/order/reject', 'POST', {
        order_id: orderId,
        reason: reason || 'Restaurant unable to fulfill order'
    });
}

/**
 * Mark an order as ready for pickup
 */
async function markOrderReady(orderId) {
    return swiggyApiCall('/api/v1/order/ready', 'POST', {
        order_id: orderId
    });
}

/**
 * Mark an order as picked up by delivery partner
 */
async function markOrderPickedUp(orderId) {
    return swiggyApiCall('/api/v1/order/pickedup', 'POST', {
        order_id: orderId
    });
}

/**
 * Mark an order as delivered
 */
async function markOrderDelivered(orderId) {
    return swiggyApiCall('/api/v1/order/delivered', 'POST', {
        order_id: orderId
    });
}

/**
 * Get order details from Swiggy
 */
async function getOrderDetails(orderId) {
    return swiggyApiCall(`/api/v1/order/details?order_id=${encodeURIComponent(orderId)}`, 'GET');
}

// ─── Status Notification Helper ─────────────────────────────────────

/**
 * Called whenever a delivery status changes locally for a Swiggy order.
 * Sends the corresponding outbound API call to Swiggy.
 */
async function notifySwiggyStatusChange(platformOrderId, newStatus, extra = {}) {
    try {
        const config = await getSwiggyConfig();
        if (!config.statusUpdateEnabled) {
            logger.info('[SWIGGY API] Status updates disabled, skipping notification');
            return { skipped: true };
        }

        switch (newStatus) {
            case 'CONFIRMED':
            case 'PREPARING':
                return await confirmOrder(platformOrderId, extra.prepTime);
            case 'READY_FOR_PICKUP':
                return await markOrderReady(platformOrderId);
            case 'OUT_FOR_DELIVERY':
                return await markOrderPickedUp(platformOrderId);
            case 'DELIVERED':
                return await markOrderDelivered(platformOrderId);
            case 'CANCELLED':
                return await rejectOrder(platformOrderId, extra.rejectionReason || 'Order cancelled by restaurant');
            default:
                logger.info(`[SWIGGY API] No outbound call needed for status: ${newStatus}`);
                return { skipped: true };
        }
    } catch (error) {
        logger.error('[SWIGGY API] Failed to notify Swiggy of status change', {
            platformOrderId,
            newStatus,
            error: error.message
        });
        return { error: error.message };
    }
}

module.exports = {
    getSwiggyConfig,
    confirmOrder,
    rejectOrder,
    markOrderReady,
    markOrderPickedUp,
    markOrderDelivered,
    getOrderDetails,
    notifySwiggyStatusChange
};
