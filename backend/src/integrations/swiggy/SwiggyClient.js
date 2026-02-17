/**
 * Swiggy Partner API Client
 * Implements real API calls to Swiggy's Partner Platform
 * Uses rate limiting (60 req/min) and retry logic
 */

const axios = require('axios');
const RateLimiter = require('../common/rateLimiter');
const RetryHandler = require('../common/retryHandler');
const { logIntegrationEvent } = require('../../utils/integrationLogger');

class SwiggyClient {
  constructor() {
    this.platformName = 'SWIGGY';
    this.apiKey = process.env.SWIGGY_API_KEY;
    this.partnerId = process.env.SWIGGY_PARTNER_ID;
    this.baseURL = process.env.SWIGGY_API_BASE_URL || 'https://partner-api.swiggy.com/v1';

    // Initialize rate limiter (60 requests per minute for Swiggy)
    this.rateLimiter = new RateLimiter('SWIGGY', 60);

    // Initialize retry handler
    this.retryHandler = new RetryHandler(5, {
      shouldRetry: this._shouldRetry.bind(this)
    });

    // Configure axios instance
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-Partner-Id': this.partnerId,
      },
      timeout: 30000, // 30 second timeout
    });

    console.log(`[SWIGGY CLIENT] Initialized in PRODUCTION mode`);
    console.log(`[SWIGGY CLIENT] Partner ID: ${this.partnerId}`);
  }

  /**
   * Accept an order from Swiggy
   * @param {number} orderId - Internal order ID
   * @param {number} prepTime - Preparation time in minutes
   * @returns {Promise<Object>} Response from Swiggy
   */
  async acceptOrder(orderId, prepTime) {
    const operationName = `Accept Order ${orderId}`;

    return await this.rateLimiter.execute(async () => {
      return await this.retryHandler.executeWithRetry(async () => {
        const endpoint = `/orders/${orderId}/accept`;
        const requestData = {
          partner_id: this.partnerId,
          preparation_time_minutes: prepTime,
          accepted_at: new Date().toISOString(),
        };

        console.log(`[SWIGGY] Accepting order ${orderId} with prep time ${prepTime} mins`);

        try {
          const response = await this.client.post(endpoint, requestData);

          // Log successful API call
          await logIntegrationEvent(
            'SWIGGY',
            'ORDER_ACCEPT',
            'OUTBOUND',
            endpoint,
            requestData,
            response.data,
            response.status,
            true,
            null,
            orderId
          );

          return {
            success: true,
            orderId,
            preparationTime: prepTime,
            swiggyOrderId: response.data.order_id,
            estimatedDeliveryTime: response.data.estimated_delivery_time,
            message: 'Order accepted successfully',
            timestamp: new Date().toISOString(),
            platformResponse: response.data,
          };
        } catch (error) {
          // Log failed API call
          await logIntegrationEvent(
            'SWIGGY',
            'ORDER_ACCEPT',
            'OUTBOUND',
            endpoint,
            requestData,
            error.response?.data,
            error.response?.status,
            false,
            error.message,
            orderId
          );

          throw this._handleError(error, operationName);
        }
      }, operationName);
    });
  }

  /**
   * Reject an order from Swiggy
   * @param {number} orderId - Internal order ID
   * @param {string} reason - Rejection reason
   * @returns {Promise<Object>} Response from Swiggy
   */
  async rejectOrder(orderId, reason) {
    const operationName = `Reject Order ${orderId}`;

    return await this.rateLimiter.execute(async () => {
      return await this.retryHandler.executeWithRetry(async () => {
        const endpoint = `/orders/${orderId}/reject`;
        const requestData = {
          partner_id: this.partnerId,
          rejection_reason: this._mapRejectionReason(reason),
          rejected_at: new Date().toISOString(),
        };

        console.log(`[SWIGGY] Rejecting order ${orderId}, reason: ${reason}`);

        try {
          const response = await this.client.post(endpoint, requestData);

          await logIntegrationEvent(
            'SWIGGY',
            'ORDER_REJECT',
            'OUTBOUND',
            endpoint,
            requestData,
            response.data,
            response.status,
            true,
            null,
            orderId
          );

          return {
            success: true,
            orderId,
            reason,
            message: 'Order rejected successfully',
            timestamp: new Date().toISOString(),
            platformResponse: response.data,
          };
        } catch (error) {
          await logIntegrationEvent(
            'SWIGGY',
            'ORDER_REJECT',
            'OUTBOUND',
            endpoint,
            requestData,
            error.response?.data,
            error.response?.status,
            false,
            error.message,
            orderId
          );

          throw this._handleError(error, operationName);
        }
      }, operationName);
    });
  }

  /**
   * Update order status to Swiggy
   * @param {number} orderId - Internal order ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Response from Swiggy
   */
  async updateOrderStatus(orderId, status) {
    const operationName = `Update Order Status ${orderId}`;

    return await this.rateLimiter.execute(async () => {
      return await this.retryHandler.executeWithRetry(async () => {
        const endpoint = `/orders/${orderId}/status`;
        const swiggyStatus = this._mapStatusToSwiggy(status);
        const requestData = {
          partner_id: this.partnerId,
          status: swiggyStatus,
          updated_at: new Date().toISOString(),
        };

        console.log(`[SWIGGY] Updating order ${orderId} status to ${status} (${swiggyStatus})`);

        try {
          const response = await this.client.put(endpoint, requestData);

          await logIntegrationEvent(
            'SWIGGY',
            'STATUS_UPDATE',
            'OUTBOUND',
            endpoint,
            requestData,
            response.data,
            response.status,
            true,
            null,
            orderId
          );

          return {
            success: true,
            orderId,
            posStatus: status,
            swiggyStatus,
            message: 'Status updated successfully',
            timestamp: new Date().toISOString(),
            platformResponse: response.data,
          };
        } catch (error) {
          await logIntegrationEvent(
            'SWIGGY',
            'STATUS_UPDATE',
            'OUTBOUND',
            endpoint,
            requestData,
            error.response?.data,
            error.response?.status,
            false,
            error.message,
            orderId
          );

          throw this._handleError(error, operationName);
        }
      }, operationName);
    });
  }

  /**
   * Sync menu to Swiggy
   * @param {Array} menuItems - Array of menu items to sync
   * @returns {Promise<Object>} Sync results
   */
  async syncMenu(menuItems) {
    const operationName = 'Menu Sync';

    return await this.rateLimiter.execute(async () => {
      return await this.retryHandler.executeWithRetry(async () => {
        const endpoint = `/menu/sync`;
        const requestData = {
          partner_id: this.partnerId,
          restaurant_id: this.partnerId, // In Swiggy, partner_id often serves as restaurant_id
          items: menuItems.map(item => ({
            item_id: item.id.toString(),
            name: item.name,
            description: item.description || '',
            price: parseFloat(item.price),
            category: item.category?.name || 'General',
            is_veg: item.isVegetarian || false,
            is_available: item.isAvailable !== false,
            food_type: item.isVegetarian ? 'veg' : 'non-veg',
          })),
        };

        console.log(`[SWIGGY] Syncing ${menuItems.length} menu items`);

        try {
          const response = await this.client.post(endpoint, requestData);

          await logIntegrationEvent(
            'SWIGGY',
            'MENU_SYNC',
            'OUTBOUND',
            endpoint,
            { itemCount: menuItems.length },
            response.data,
            response.status,
            true,
            null,
            null
          );

          const results = response.data.results || [];
          const synced = results.filter(r => r.success === true).length;
          const failed = results.filter(r => r.success === false).length;

          return {
            success: true,
            synced,
            failed,
            items: results.map(r => ({
              menuItemId: parseInt(r.item_id, 10),
              name: r.name,
              swiggyItemId: r.swiggy_item_id,
              synced: r.success === true,
              error: r.error_message || null,
            })),
            message: `Menu synced: ${synced} successful, ${failed} failed`,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          await logIntegrationEvent(
            'SWIGGY',
            'MENU_SYNC',
            'OUTBOUND',
            endpoint,
            { itemCount: menuItems.length },
            error.response?.data,
            error.response?.status,
            false,
            error.message,
            null
          );

          throw this._handleError(error, operationName);
        }
      }, operationName);
    });
  }

  /**
   * Get menu from Swiggy
   * @returns {Promise<Object>} Menu data from Swiggy
   */
  async getMenu() {
    const operationName = 'Get Menu';

    return await this.rateLimiter.execute(async () => {
      return await this.retryHandler.executeWithRetry(async () => {
        const endpoint = `/menu`;
        const params = { partner_id: this.partnerId };

        console.log('[SWIGGY] Fetching menu from Swiggy');

        try {
          const response = await this.client.get(endpoint, { params });

          await logIntegrationEvent(
            'SWIGGY',
            'MENU_FETCH',
            'INBOUND',
            endpoint,
            params,
            { itemCount: response.data.items?.length },
            response.status,
            true,
            null,
            null
          );

          return {
            success: true,
            items: response.data.items.map(item => ({
              swiggyItemId: item.item_id,
              name: item.name,
              price: item.price,
              available: item.is_available,
              category: item.category,
              isVeg: item.is_veg,
            })),
            message: 'Menu fetched successfully',
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          await logIntegrationEvent(
            'SWIGGY',
            'MENU_FETCH',
            'INBOUND',
            endpoint,
            params,
            error.response?.data,
            error.response?.status,
            false,
            error.message,
            null
          );

          throw this._handleError(error, operationName);
        }
      }, operationName);
    });
  }

  /**
   * Update item availability on Swiggy
   * @param {string} itemId - Swiggy item ID
   * @param {boolean} isAvailable - Availability status
   * @returns {Promise<Object>} Update result
   */
  async updateItemAvailability(itemId, isAvailable) {
    const operationName = `Update Item Availability ${itemId}`;

    return await this.rateLimiter.execute(async () => {
      return await this.retryHandler.executeWithRetry(async () => {
        const endpoint = `/menu/items/${itemId}/availability`;
        const requestData = {
          partner_id: this.partnerId,
          is_available: isAvailable,
        };

        console.log(`[SWIGGY] Updating item ${itemId} availability to ${isAvailable}`);

        try {
          const response = await this.client.put(endpoint, requestData);

          await logIntegrationEvent(
            'SWIGGY',
            'ITEM_AVAILABILITY',
            'OUTBOUND',
            endpoint,
            requestData,
            response.data,
            response.status,
            true,
            null,
            null
          );

          return {
            success: true,
            itemId,
            available: isAvailable,
            message: 'Availability updated successfully',
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          await logIntegrationEvent(
            'SWIGGY',
            'ITEM_AVAILABILITY',
            'OUTBOUND',
            endpoint,
            requestData,
            error.response?.data,
            error.response?.status,
            false,
            error.message,
            null
          );

          throw this._handleError(error, operationName);
        }
      }, operationName);
    });
  }

  /**
   * Health check - verify API connection
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const operationName = 'Health Check';

    try {
      const endpoint = `/health`;
      const params = { partner_id: this.partnerId };

      console.log('[SWIGGY] Performing health check');

      const response = await this.client.get(endpoint, { params });

      await logIntegrationEvent(
        'SWIGGY',
        'HEALTH_CHECK',
        'OUTBOUND',
        endpoint,
        params,
        response.data,
        response.status,
        true,
        null,
        null
      );

      return {
        success: true,
        platform: 'SWIGGY',
        mode: 'PRODUCTION',
        status: response.data.status || 'online',
        message: 'API connection healthy',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      await logIntegrationEvent(
        'SWIGGY',
        'HEALTH_CHECK',
        'OUTBOUND',
        '/health',
        { partner_id: this.partnerId },
        error.response?.data,
        error.response?.status,
        false,
        error.message,
        null
      );

      return {
        success: false,
        platform: 'SWIGGY',
        mode: 'PRODUCTION',
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Map POS status to Swiggy status codes
   * @private
   */
  _mapStatusToSwiggy(posStatus) {
    const statusMap = {
      'PENDING': 'ORDER_PLACED',
      'PREPARING': 'FOOD_PREPARING',
      'READY_FOR_PICKUP': 'READY_FOR_PICKUP',
      'OUT_FOR_DELIVERY': 'OUT_FOR_DELIVERY',
      'DELIVERED': 'DELIVERED',
      'CANCELLED': 'CANCELLED',
    };

    return statusMap[posStatus] || 'ORDER_PLACED';
  }

  /**
   * Map rejection reasons to Swiggy-accepted reasons
   * @private
   */
  _mapRejectionReason(reason) {
    const reasonMap = {
      'OUT_OF_STOCK': 'item_out_of_stock',
      'RESTAURANT_CLOSED': 'restaurant_closed',
      'TOO_BUSY': 'too_busy',
      'CANNOT_DELIVER': 'delivery_not_possible',
      'INVALID_ADDRESS': 'invalid_address',
    };

    // If the reason is a predefined key, use the mapped value
    if (reasonMap[reason]) {
      return reasonMap[reason];
    }

    // Otherwise, try to intelligently map the free-text reason
    const lowerReason = reason.toLowerCase();
    if (lowerReason.includes('stock') || lowerReason.includes('unavailable')) {
      return 'item_out_of_stock';
    } else if (lowerReason.includes('closed')) {
      return 'restaurant_closed';
    } else if (lowerReason.includes('busy')) {
      return 'too_busy';
    } else if (lowerReason.includes('address')) {
      return 'invalid_address';
    } else if (lowerReason.includes('deliver')) {
      return 'delivery_not_possible';
    }

    // Default fallback
    return 'too_busy';
  }

  /**
   * Determine if an error should be retried
   * @private
   */
  _shouldRetry(error, attempt) {
    // Don't retry on authentication errors
    if (error.response?.status === 401 || error.response?.status === 403) {
      return false;
    }

    // Don't retry on bad request (invalid data)
    if (error.response?.status === 400) {
      return false;
    }

    // Retry on rate limit (429)
    if (error.response?.status === 429) {
      return true;
    }

    // Retry on server errors (5xx)
    if (error.response?.status >= 500) {
      return true;
    }

    // Retry on network errors
    if (error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND') {
      return true;
    }

    // Don't retry after max attempts
    if (attempt >= 4) {
      return false;
    }

    return false;
  }

  /**
   * Handle and format API errors
   * @private
   */
  _handleError(error, operationName) {
    const errorDetails = {
      operation: operationName,
      platform: 'SWIGGY',
      message: error.message,
      statusCode: error.response?.status,
      errorData: error.response?.data,
      timestamp: new Date().toISOString(),
    };

    console.error(`[SWIGGY ERROR] ${operationName}:`, errorDetails);

    // Create a structured error
    const structuredError = new Error(
      `Swiggy API Error - ${operationName}: ${error.response?.data?.message || error.message}`
    );
    structuredError.details = errorDetails;
    structuredError.statusCode = error.response?.status;
    structuredError.platform = 'SWIGGY';

    return structuredError;
  }
}

module.exports = SwiggyClient;
