/**
 * Zomato Partner API Client
 * Implements real API calls to Zomato's Partner Platform
 * Uses rate limiting (100 req/min) and retry logic
 */

const axios = require('axios');
const RateLimiter = require('../common/rateLimiter');
const RetryHandler = require('../common/retryHandler');
const { logIntegrationEvent } = require('../../utils/integrationLogger');

class ZomatoClient {
  constructor() {
    this.platformName = 'ZOMATO';
    this.apiKey = process.env.ZOMATO_API_KEY;
    this.restaurantId = process.env.ZOMATO_RESTAURANT_ID;
    this.baseURL = process.env.ZOMATO_API_BASE_URL || 'https://api.zomato.com/v3';

    // Initialize rate limiter (100 requests per minute for Zomato)
    this.rateLimiter = new RateLimiter('ZOMATO', 100);

    // Initialize retry handler with custom config
    this.retryHandler = new RetryHandler(5, {
      shouldRetry: this._shouldRetry.bind(this)
    });

    // Configure axios instance
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });

    console.log(`[ZOMATO CLIENT] Initialized in PRODUCTION mode`);
    console.log(`[ZOMATO CLIENT] Restaurant ID: ${this.restaurantId}`);
  }

  /**
   * Accept an order from Zomato
   * @param {number} orderId - Internal order ID
   * @param {number} prepTime - Preparation time in minutes
   * @returns {Promise<Object>} Response from Zomato
   */
  async acceptOrder(orderId, prepTime) {
    const operationName = `Accept Order ${orderId}`;

    return await this.rateLimiter.execute(async () => {
      return await this.retryHandler.executeWithRetry(async () => {
        const endpoint = `/partner/orders/${orderId}/accept`;
        const requestData = {
          restaurant_id: this.restaurantId,
          preparation_time: prepTime,
        };

        console.log(`[ZOMATO] Accepting order ${orderId} with prep time ${prepTime} mins`);

        try {
          const response = await this.client.post(endpoint, requestData);

          // Log successful API call
          await logIntegrationEvent(
            'ZOMATO',
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
            zomatoOrderId: response.data.order_id,
            message: 'Order accepted successfully',
            timestamp: new Date().toISOString(),
            platformResponse: response.data,
          };
        } catch (error) {
          // Log failed API call
          await logIntegrationEvent(
            'ZOMATO',
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
   * Reject an order from Zomato
   * @param {number} orderId - Internal order ID
   * @param {string} reason - Rejection reason
   * @returns {Promise<Object>} Response from Zomato
   */
  async rejectOrder(orderId, reason) {
    const operationName = `Reject Order ${orderId}`;

    return await this.rateLimiter.execute(async () => {
      return await this.retryHandler.executeWithRetry(async () => {
        const endpoint = `/partner/orders/${orderId}/reject`;
        const requestData = {
          restaurant_id: this.restaurantId,
          reason: this._mapRejectionReason(reason),
        };

        console.log(`[ZOMATO] Rejecting order ${orderId}, reason: ${reason}`);

        try {
          const response = await this.client.post(endpoint, requestData);

          await logIntegrationEvent(
            'ZOMATO',
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
            'ZOMATO',
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
   * Update order status to Zomato
   * @param {number} orderId - Internal order ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Response from Zomato
   */
  async updateOrderStatus(orderId, status) {
    const operationName = `Update Order Status ${orderId}`;

    return await this.rateLimiter.execute(async () => {
      return await this.retryHandler.executeWithRetry(async () => {
        const endpoint = `/partner/orders/${orderId}/status`;
        const zomatoStatus = this._mapStatusToZomato(status);
        const requestData = {
          restaurant_id: this.restaurantId,
          status: zomatoStatus,
        };

        console.log(`[ZOMATO] Updating order ${orderId} status to ${status} (${zomatoStatus})`);

        try {
          const response = await this.client.put(endpoint, requestData);

          await logIntegrationEvent(
            'ZOMATO',
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
            zomatoStatus,
            message: 'Status updated successfully',
            timestamp: new Date().toISOString(),
            platformResponse: response.data,
          };
        } catch (error) {
          await logIntegrationEvent(
            'ZOMATO',
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
   * Sync menu to Zomato
   * @param {Array} menuItems - Array of menu items to sync
   * @returns {Promise<Object>} Sync results
   */
  async syncMenu(menuItems) {
    const operationName = 'Menu Sync';

    return await this.rateLimiter.execute(async () => {
      return await this.retryHandler.executeWithRetry(async () => {
        const endpoint = `/partner/menu/sync`;
        const requestData = {
          restaurant_id: this.restaurantId,
          items: menuItems.map(item => ({
            item_id: item.id.toString(),
            name: item.name,
            description: item.description || '',
            price: parseFloat(item.price),
            category: item.category?.name || 'General',
            available: item.isAvailable !== false,
            veg: item.isVegetarian || false,
          })),
        };

        console.log(`[ZOMATO] Syncing ${menuItems.length} menu items`);

        try {
          const response = await this.client.post(endpoint, requestData);

          await logIntegrationEvent(
            'ZOMATO',
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

          const results = response.data.items || [];
          const synced = results.filter(r => r.status === 'success').length;
          const failed = results.filter(r => r.status === 'failed').length;

          return {
            success: true,
            synced,
            failed,
            items: results.map(r => ({
              menuItemId: parseInt(r.item_id, 10),
              name: r.name,
              zomatoItemId: r.zomato_item_id,
              synced: r.status === 'success',
              error: r.error || null,
            })),
            message: `Menu synced: ${synced} successful, ${failed} failed`,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          await logIntegrationEvent(
            'ZOMATO',
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
   * Get menu from Zomato
   * @returns {Promise<Object>} Menu data from Zomato
   */
  async getMenu() {
    const operationName = 'Get Menu';

    return await this.rateLimiter.execute(async () => {
      return await this.retryHandler.executeWithRetry(async () => {
        const endpoint = `/partner/menu`;
        const params = { restaurant_id: this.restaurantId };

        console.log('[ZOMATO] Fetching menu from Zomato');

        try {
          const response = await this.client.get(endpoint, { params });

          await logIntegrationEvent(
            'ZOMATO',
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
              zomatoItemId: item.item_id,
              name: item.name,
              price: item.price,
              available: item.available,
              category: item.category,
            })),
            message: 'Menu fetched successfully',
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          await logIntegrationEvent(
            'ZOMATO',
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
   * Update item availability on Zomato
   * @param {string} itemId - Zomato item ID
   * @param {boolean} isAvailable - Availability status
   * @returns {Promise<Object>} Update result
   */
  async updateItemAvailability(itemId, isAvailable) {
    const operationName = `Update Item Availability ${itemId}`;

    return await this.rateLimiter.execute(async () => {
      return await this.retryHandler.executeWithRetry(async () => {
        const endpoint = `/partner/menu/items/${itemId}/availability`;
        const requestData = {
          restaurant_id: this.restaurantId,
          available: isAvailable,
        };

        console.log(`[ZOMATO] Updating item ${itemId} availability to ${isAvailable}`);

        try {
          const response = await this.client.put(endpoint, requestData);

          await logIntegrationEvent(
            'ZOMATO',
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
            'ZOMATO',
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
      const endpoint = `/partner/health`;
      const params = { restaurant_id: this.restaurantId };

      console.log('[ZOMATO] Performing health check');

      const response = await this.client.get(endpoint, { params });

      await logIntegrationEvent(
        'ZOMATO',
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
        platform: 'ZOMATO',
        mode: 'PRODUCTION',
        status: response.data.status || 'online',
        message: 'API connection healthy',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      await logIntegrationEvent(
        'ZOMATO',
        'HEALTH_CHECK',
        'OUTBOUND',
        '/partner/health',
        { restaurant_id: this.restaurantId },
        error.response?.data,
        error.response?.status,
        false,
        error.message,
        null
      );

      return {
        success: false,
        platform: 'ZOMATO',
        mode: 'PRODUCTION',
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Map POS status to Zomato status codes
   * @private
   */
  _mapStatusToZomato(posStatus) {
    const statusMap = {
      'PENDING': 'order_received',
      'PREPARING': 'restaurant_preparing',
      'READY_FOR_PICKUP': 'food_ready',
      'OUT_FOR_DELIVERY': 'dispatched',
      'DELIVERED': 'delivered',
      'CANCELLED': 'cancelled',
    };

    return statusMap[posStatus] || 'order_received';
  }

  /**
   * Map rejection reasons to Zomato-accepted reasons
   * @private
   */
  _mapRejectionReason(reason) {
    const reasonMap = {
      'OUT_OF_STOCK': 'out_of_stock',
      'RESTAURANT_CLOSED': 'restaurant_closed',
      'TOO_BUSY': 'too_busy',
      'CANNOT_DELIVER': 'cannot_deliver_to_address',
    };

    // If the reason is a predefined key, use the mapped value
    if (reasonMap[reason]) {
      return reasonMap[reason];
    }

    // Otherwise, try to intelligently map the free-text reason
    const lowerReason = reason.toLowerCase();
    if (lowerReason.includes('stock') || lowerReason.includes('unavailable')) {
      return 'out_of_stock';
    } else if (lowerReason.includes('closed')) {
      return 'restaurant_closed';
    } else if (lowerReason.includes('busy')) {
      return 'too_busy';
    } else if (lowerReason.includes('address') || lowerReason.includes('deliver')) {
      return 'cannot_deliver_to_address';
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
      platform: 'ZOMATO',
      message: error.message,
      statusCode: error.response?.status,
      errorData: error.response?.data,
      timestamp: new Date().toISOString(),
    };

    console.error(`[ZOMATO ERROR] ${operationName}:`, errorDetails);

    // Create a structured error
    const structuredError = new Error(
      `Zomato API Error - ${operationName}: ${error.response?.data?.message || error.message}`
    );
    structuredError.details = errorDetails;
    structuredError.statusCode = error.response?.status;
    structuredError.platform = 'ZOMATO';

    return structuredError;
  }
}

module.exports = ZomatoClient;
