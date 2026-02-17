/**
 * Test Script for Platform API Clients
 * Tests both mock and real clients to ensure they work properly
 */

// Load environment variables
require('dotenv').config();

const { createPlatformClient } = require('../integrations/index');

async function testPlatformClient(platform) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${platform} API Client`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Create client (will use mock or real based on env variables)
    const client = createPlatformClient(platform);

    // Test 1: Health Check
    console.log('Test 1: Health Check');
    const healthResult = await client.healthCheck();
    console.log('✓ Health check result:', JSON.stringify(healthResult, null, 2));

    // Test 2: Accept Order
    console.log('\nTest 2: Accept Order');
    const acceptResult = await client.acceptOrder(12345, 30);
    console.log('✓ Accept order result:', JSON.stringify(acceptResult, null, 2));

    // Test 3: Update Order Status
    console.log('\nTest 3: Update Order Status');
    const statusResult = await client.updateOrderStatus(12345, 'PREPARING');
    console.log('✓ Status update result:', JSON.stringify(statusResult, null, 2));

    // Test 4: Get Menu
    console.log('\nTest 4: Get Menu');
    const menuResult = await client.getMenu();
    console.log('✓ Get menu result:', JSON.stringify(menuResult, null, 2));

    // Test 5: Update Item Availability
    console.log('\nTest 5: Update Item Availability');
    const availabilityResult = await client.updateItemAvailability('ITEM-123', false);
    console.log('✓ Availability update result:', JSON.stringify(availabilityResult, null, 2));

    // Test 6: Reject Order
    console.log('\nTest 6: Reject Order');
    const rejectResult = await client.rejectOrder(12346, 'OUT_OF_STOCK');
    console.log('✓ Reject order result:', JSON.stringify(rejectResult, null, 2));

    // Test 7: Menu Sync
    console.log('\nTest 7: Menu Sync');
    const testMenuItems = [
      {
        id: 1,
        name: 'Test Coffee',
        description: 'Delicious coffee',
        price: 150,
        category: { name: 'Beverages' },
        isAvailable: true,
        isVegetarian: true,
      },
      {
        id: 2,
        name: 'Test Sandwich',
        description: 'Fresh sandwich',
        price: 200,
        category: { name: 'Food' },
        isAvailable: true,
        isVegetarian: true,
      },
    ];
    const syncResult = await client.syncMenu(testMenuItems);
    console.log('✓ Menu sync result:', JSON.stringify(syncResult, null, 2));

    console.log(`\n✅ All ${platform} tests passed!\n`);
    return true;
  } catch (error) {
    console.error(`\n❌ ${platform} test failed:`, error.message);
    if (error.details) {
      console.error('Error details:', JSON.stringify(error.details, null, 2));
    }
    return false;
  }
}

async function testRateLimiting(platform) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${platform} Rate Limiting`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    const client = createPlatformClient(platform);
    const promises = [];

    // Send 5 concurrent requests
    console.log('Sending 5 concurrent health check requests...');
    for (let i = 0; i < 5; i++) {
      promises.push(
        client.healthCheck().then(() => {
          console.log(`✓ Request ${i + 1} completed`);
        })
      );
    }

    await Promise.all(promises);
    console.log(`\n✅ ${platform} rate limiting test passed!\n`);
    return true;
  } catch (error) {
    console.error(`\n❌ ${platform} rate limiting test failed:`, error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('Platform API Client Test Suite');
  console.log('='.repeat(60));
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Zomato Sandbox: ${process.env.ZOMATO_SANDBOX_MODE || 'true'}`);
  console.log(`Swiggy Sandbox: ${process.env.SWIGGY_SANDBOX_MODE || 'true'}`);
  console.log('='.repeat(60));

  const results = {
    zomatoBasic: false,
    zomatoRateLimit: false,
    swiggyBasic: false,
    swiggyRateLimit: false,
  };

  // Test Zomato
  results.zomatoBasic = await testPlatformClient('ZOMATO');
  results.zomatoRateLimit = await testRateLimiting('ZOMATO');

  // Test Swiggy
  results.swiggyBasic = await testPlatformClient('SWIGGY');
  results.swiggyRateLimit = await testRateLimiting('SWIGGY');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Zomato Basic Tests: ${results.zomatoBasic ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Zomato Rate Limiting: ${results.zomatoRateLimit ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Swiggy Basic Tests: ${results.swiggyBasic ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Swiggy Rate Limiting: ${results.swiggyRateLimit ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = Object.values(results).every(r => r === true);
  console.log('\n' + (allPassed ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED'));
  console.log('='.repeat(60) + '\n');

  process.exit(allPassed ? 0 : 1);
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
  });
}

module.exports = {
  testPlatformClient,
  testRateLimiting,
  runAllTests,
};
