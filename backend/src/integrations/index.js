/**
 * Platform Client Factory
 * Creates the appropriate API client based on environment configuration
 * - In development/sandbox mode: Returns mock clients
 * - In production with real credentials: Returns real API clients
 */

const MockZomatoClient = require('./mocks/MockZomatoClient');
const MockSwiggyClient = require('./mocks/MockSwiggyClient');

/**
 * Create a platform API client
 * @param {string} platform - 'ZOMATO' or 'SWIGGY'
 * @returns {Object} Platform API client instance
 */
function createPlatformClient(platform) {
  const platformUpper = platform.toUpperCase();

  // Check if we're in sandbox/development mode
  const isMockMode =
    process.env.NODE_ENV === 'development' ||
    process.env[`${platformUpper}_SANDBOX_MODE`] === 'true';

  if (isMockMode) {
    // Return mock clients for testing
    console.log(`[Platform Factory] Creating MOCK client for ${platformUpper}`);

    switch (platformUpper) {
      case 'ZOMATO':
        return new MockZomatoClient();
      case 'SWIGGY':
        return new MockSwiggyClient();
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  } else {
    // Return real API clients
    console.log(`[Platform Factory] Creating REAL client for ${platformUpper}`);

    switch (platformUpper) {
      case 'ZOMATO':
        const ZomatoClient = require('./zomato/ZomatoClient');
        return new ZomatoClient();
      case 'SWIGGY':
        const SwiggyClient = require('./swiggy/SwiggyClient');
        return new SwiggyClient();
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  }
}

/**
 * Get all platform clients
 * @returns {Object} Object with zomato and swiggy clients
 */
function getAllPlatformClients() {
  return {
    zomato: createPlatformClient('ZOMATO'),
    swiggy: createPlatformClient('SWIGGY'),
  };
}

module.exports = {
  createPlatformClient,
  getAllPlatformClients,
};
