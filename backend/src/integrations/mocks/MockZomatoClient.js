/**
 * Mock Zomato API Client for Testing
 * Simulates Zomato API responses without requiring real credentials
 */

class MockZomatoClient {
  constructor() {
    this.platformName = 'ZOMATO';
    console.log('[MOCK ZOMATO] Client initialized in mock mode');
  }

  /**
   * Mock: Accept an order
   */
  async acceptOrder(orderId, prepTime) {
    console.log(`[MOCK ZOMATO] Accepting order ${orderId} with prep time ${prepTime} mins`);

    // Simulate API delay
    await this._delay(500);

    return {
      success: true,
      orderId,
      preparationTime: prepTime,
      message: 'Order accepted successfully (MOCK)',
      timestamp: new Date().toISOString(),
      zomatoOrderId: `ZOM-MOCK-${Date.now()}`,
    };
  }

  /**
   * Mock: Reject an order
   */
  async rejectOrder(orderId, reason) {
    console.log(`[MOCK ZOMATO] Rejecting order ${orderId}, reason: ${reason}`);

    await this._delay(300);

    return {
      success: true,
      orderId,
      reason,
      message: 'Order rejected successfully (MOCK)',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Mock: Update order status
   */
  async updateOrderStatus(orderId, status) {
    console.log(`[MOCK ZOMATO] Updating order ${orderId} status to ${status}`);

    await this._delay(400);

    // Map POS status to Zomato status
    const statusMapping = {
      'PENDING': 'order_received',
      'PREPARING': 'restaurant_preparing',
      'READY_FOR_PICKUP': 'food_ready',
      'OUT_FOR_DELIVERY': 'dispatched',
      'DELIVERED': 'delivered',
      'CANCELLED': 'cancelled',
    };

    return {
      success: true,
      orderId,
      posStatus: status,
      zomatoStatus: statusMapping[status] || 'order_received',
      message: 'Status updated successfully (MOCK)',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Mock: Sync menu to Zomato
   */
  async syncMenu(menuItems) {
    console.log(`[MOCK ZOMATO] Syncing ${menuItems.length} menu items`);

    await this._delay(1000);

    const results = menuItems.map(item => ({
      menuItemId: item.id,
      name: item.name,
      zomatoItemId: `ZOM-ITEM-${item.id}`,
      synced: true,
      price: item.price,
    }));

    return {
      success: true,
      synced: results.length,
      failed: 0,
      items: results,
      message: 'Menu synced successfully (MOCK)',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Mock: Get menu from Zomato
   */
  async getMenu() {
    console.log('[MOCK ZOMATO] Fetching menu from Zomato');

    await this._delay(600);

    return {
      success: true,
      items: [
        {
          zomatoItemId: 'ZOM-ITEM-1',
          name: 'Sample Coffee',
          price: 150,
          available: true,
        },
        {
          zomatoItemId: 'ZOM-ITEM-2',
          name: 'Sample Sandwich',
          price: 200,
          available: true,
        },
      ],
      message: 'Menu fetched successfully (MOCK)',
    };
  }

  /**
   * Mock: Update item availability
   */
  async updateItemAvailability(itemId, isAvailable) {
    console.log(`[MOCK ZOMATO] Updating item ${itemId} availability to ${isAvailable}`);

    await this._delay(300);

    return {
      success: true,
      itemId,
      available: isAvailable,
      message: 'Availability updated successfully (MOCK)',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Mock: Health check
   */
  async healthCheck() {
    console.log('[MOCK ZOMATO] Performing health check');

    await this._delay(200);

    return {
      success: true,
      platform: 'ZOMATO',
      mode: 'MOCK',
      status: 'online',
      message: 'Mock client is healthy',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Simulate network delay
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = MockZomatoClient;
