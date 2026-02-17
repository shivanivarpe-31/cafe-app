/**
 * Mock Swiggy API Client for Testing
 * Simulates Swiggy API responses without requiring real credentials
 */

class MockSwiggyClient {
  constructor() {
    this.platformName = 'SWIGGY';
    console.log('[MOCK SWIGGY] Client initialized in mock mode');
  }

  /**
   * Mock: Accept an order
   */
  async acceptOrder(orderId, prepTime) {
    console.log(`[MOCK SWIGGY] Accepting order ${orderId} with prep time ${prepTime} mins`);

    // Simulate API delay
    await this._delay(600);

    return {
      success: true,
      orderId,
      preparationTime: prepTime,
      message: 'Order accepted successfully (MOCK)',
      timestamp: new Date().toISOString(),
      swiggyOrderId: `SWG-MOCK-${Date.now()}`,
      estimatedDeliveryTime: new Date(Date.now() + prepTime * 60000).toISOString(),
    };
  }

  /**
   * Mock: Reject an order
   */
  async rejectOrder(orderId, reason) {
    console.log(`[MOCK SWIGGY] Rejecting order ${orderId}, reason: ${reason}`);

    await this._delay(350);

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
    console.log(`[MOCK SWIGGY] Updating order ${orderId} status to ${status}`);

    await this._delay(450);

    // Map POS status to Swiggy status
    const statusMapping = {
      'PENDING': 'ORDER_PLACED',
      'PREPARING': 'FOOD_PREPARING',
      'READY_FOR_PICKUP': 'READY_FOR_PICKUP',
      'OUT_FOR_DELIVERY': 'OUT_FOR_DELIVERY',
      'DELIVERED': 'DELIVERED',
      'CANCELLED': 'CANCELLED',
    };

    return {
      success: true,
      orderId,
      posStatus: status,
      swiggyStatus: statusMapping[status] || 'ORDER_PLACED',
      message: 'Status updated successfully (MOCK)',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Mock: Sync menu to Swiggy
   */
  async syncMenu(menuItems) {
    console.log(`[MOCK SWIGGY] Syncing ${menuItems.length} menu items`);

    await this._delay(1200);

    const results = menuItems.map(item => ({
      menuItemId: item.id,
      name: item.name,
      swiggyItemId: `SWG-ITEM-${item.id}`,
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
   * Mock: Get menu from Swiggy
   */
  async getMenu() {
    console.log('[MOCK SWIGGY] Fetching menu from Swiggy');

    await this._delay(700);

    return {
      success: true,
      items: [
        {
          swiggyItemId: 'SWG-ITEM-1',
          name: 'Sample Tea',
          price: 80,
          available: true,
        },
        {
          swiggyItemId: 'SWG-ITEM-2',
          name: 'Sample Burger',
          price: 250,
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
    console.log(`[MOCK SWIGGY] Updating item ${itemId} availability to ${isAvailable}`);

    await this._delay(350);

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
    console.log('[MOCK SWIGGY] Performing health check');

    await this._delay(250);

    return {
      success: true,
      platform: 'SWIGGY',
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

module.exports = MockSwiggyClient;
