/**
 * Test Examples for CAFE POS API
 * Using Jest and Supertest for API testing
 * 
 * Install: npm install --save-dev jest supertest @testing-library/jest-dom
 * Run: npm test
 */

const request = require('supertest');
const { prisma } = require('../src/prisma');

// Sample: Authentication Tests
describe('Authentication Endpoints', () => {
    let jwtToken;
    const testUser = {
        email: 'test@cafepos.com',
        password: 'Test@Password123',
        name: 'Test User'
    };

    // Cleanup before tests
    beforeAll(async () => {
        // Delete test user if exists
        await prisma.user.deleteMany({
            where: { email: testUser.email }
        });
    });

    afterAll(async () => {
        // Cleanup
        await prisma.user.deleteMany({
            where: { email: testUser.email }
        });
        await prisma.$disconnect();
    });

    describe('POST /api/auth/register', () => {
        test('should register a new user', async () => {
            const response = await request(require('../server.js'))
                .post('/api/auth/register')
                .send(testUser)
                .expect(201);

            expect(response.body).toHaveProperty('token');
            expect(response.body.user.email).toBe(testUser.email);
            jwtToken = response.body.token;
        });

        test('should fail with invalid email', async () => {
            const response = await request(require('../server.js'))
                .post('/api/auth/register')
                .send({
                    email: 'invalid-email',
                    password: 'Test@Password123',
                    name: 'Test'
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('should fail with weak password', async () => {
            const response = await request(require('../server.js'))
                .post('/api/auth/register')
                .send({
                    email: 'test2@cafepos.com',
                    password: 'weak',
                    name: 'Test'
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('POST /api/auth/login', () => {
        test('should login with valid credentials', async () => {
            const response = await request(require('../server.js'))
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: testUser.password
                })
                .expect(200);

            expect(response.body).toHaveProperty('token');
            expect(response.body.user.email).toBe(testUser.email);
        });

        test('should fail with invalid credentials', async () => {
            const response = await request(require('../server.js'))
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: 'WrongPassword123'
                })
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });

        test('should fail with non-existent email', async () => {
            const response = await request(require('../server.js'))
                .post('/api/auth/login')
                .send({
                    email: 'nonexistent@cafepos.com',
                    password: 'Test@Password123'
                })
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });
    });
});

// Sample: Menu Items Tests
describe('Menu Items Endpoints', () => {
    let jwtToken;
    let categoryId;
    let menuItemId;

    const testCategory = { name: 'Test Category' };
    const testMenuItem = {
        name: 'Test Coffee',
        description: 'A delicious test coffee',
        price: 150.00,
        categoryId: null // Will be set in beforeAll
    };

    beforeAll(async () => {
        // Create auth token
        const authResponse = await request(require('../server.js'))
            .post('/api/auth/login')
            .send({
                email: 'admin@cafepos.com',
                password: 'AdminPassword123'
            });
        jwtToken = authResponse.body.token;

        // Create test category
        const categoryResponse = await prisma.category.create({
            data: testCategory
        });
        categoryId = categoryResponse.id;
        testMenuItem.categoryId = categoryId;
    });

    afterAll(async () => {
        // Cleanup
        if (menuItemId) {
            await prisma.menuItem.delete({ where: { id: menuItemId } }).catch(() => { });
        }
        if (categoryId) {
            await prisma.category.delete({ where: { id: categoryId } }).catch(() => { });
        }
    });

    describe('GET /api/menu', () => {
        test('should get all menu items', async () => {
            const response = await request(require('../server.js'))
                .get('/api/menu')
                .set('Authorization', `Bearer ${jwtToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('POST /api/menu', () => {
        test('should create a menu item', async () => {
            const response = await request(require('../server.js'))
                .post('/api/menu')
                .set('Authorization', `Bearer ${jwtToken}`)
                .send(testMenuItem)
                .expect(201);

            expect(response.body).toHaveProperty('id');
            expect(response.body.name).toBe(testMenuItem.name);
            expect(response.body.price).toBe(testMenuItem.price);
            menuItemId = response.body.id;
        });

        test('should fail with invalid price', async () => {
            const response = await request(require('../server.js'))
                .post('/api/menu')
                .set('Authorization', `Bearer ${jwtToken}`)
                .send({
                    name: 'Invalid Item',
                    price: -50, // Negative price
                    categoryId: categoryId
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('should fail without authorization', async () => {
            const response = await request(require('../server.js'))
                .post('/api/menu')
                .send(testMenuItem)
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('PUT /api/menu/:id', () => {
        test('should update a menu item', async () => {
            const response = await request(require('../server.js'))
                .put(`/api/menu/${menuItemId}`)
                .set('Authorization', `Bearer ${jwtToken}`)
                .send({
                    name: 'Updated Coffee',
                    price: 200.00
                })
                .expect(200);

            expect(response.body.name).toBe('Updated Coffee');
            expect(response.body.price).toBe(200.00);
        });

        test('should fail with invalid menu item id', async () => {
            const response = await request(require('../server.js'))
                .put('/api/menu/99999')
                .set('Authorization', `Bearer ${jwtToken}`)
                .send({ name: 'Test' })
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });
    });
});

// Sample: Orders Tests
describe('Orders Endpoints', () => {
    let jwtToken;
    let orderId;
    let tableId;
    let menuItemId;

    beforeAll(async () => {
        // Setup: Create table and menu item
        const table = await prisma.table.create({
            data: {
                number: 1,
                name: 'Table 1',
                capacity: 4
            }
        });
        tableId = table.id;

        const menuItem = await prisma.menuItem.create({
            data: {
                name: 'Test Item',
                price: 100,
                categoryId: 1,
                inventory: { create: { quantity: 10 } }
            }
        });
        menuItemId = menuItem.id;
    });

    afterAll(async () => {
        // Cleanup
        if (orderId) {
            await prisma.order.delete({ where: { id: orderId } }).catch(() => { });
        }
        if (tableId) {
            await prisma.table.delete({ where: { id: tableId } }).catch(() => { });
        }
        if (menuItemId) {
            await prisma.menuItem.delete({ where: { id: menuItemId } }).catch(() => { });
        }
    });

    describe('POST /api/orders', () => {
        test('should create a dine-in order', async () => {
            const response = await request(require('../server.js'))
                .post('/api/orders')
                .set('Authorization', `Bearer ${jwtToken}`)
                .send({
                    tableId: tableId,
                    orderType: 'DINE_IN',
                    orderItems: [
                        {
                            menuItemId: menuItemId,
                            quantity: 2,
                            price: 100
                        }
                    ]
                })
                .expect(201);

            expect(response.body).toHaveProperty('order.id');
            expect(response.body.order.orderType).toBe('DINE_IN');
            orderId = response.body.order.id;
        });

        test('should fail without table for dine-in', async () => {
            const response = await request(require('../server.js'))
                .post('/api/orders')
                .set('Authorization', `Bearer ${jwtToken}`)
                .send({
                    orderType: 'DINE_IN',
                    orderItems: [
                        {
                            menuItemId: menuItemId,
                            quantity: 1,
                            price: 100
                        }
                    ]
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('should fail with empty order items', async () => {
            const response = await request(require('../server.js'))
                .post('/api/orders')
                .set('Authorization', `Bearer ${jwtToken}`)
                .send({
                    tableId: tableId,
                    orderItems: []
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('GET /api/orders', () => {
        test('should get all orders', async () => {
            const response = await request(require('../server.js'))
                .get('/api/orders')
                .set('Authorization', `Bearer ${jwtToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('GET /api/orders/active', () => {
        test('should get active orders only', async () => {
            const response = await request(require('../server.js'))
                .get('/api/orders/active')
                .set('Authorization', `Bearer ${jwtToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            response.body.forEach(order => {
                expect(['PENDING', 'PREPARING', 'SERVED']).toContain(order.status);
            });
        });
    });

    describe('PUT /api/orders/:id/status', () => {
        test('should update order status', async () => {
            const response = await request(require('../server.js'))
                .put(`/api/orders/${orderId}/status`)
                .set('Authorization', `Bearer ${jwtToken}`)
                .send({ status: 'PREPARING' })
                .expect(200);

            expect(response.body.order.status).toBe('PREPARING');
        });

        test('should fail with invalid status', async () => {
            const response = await request(require('../server.js'))
                .put(`/api/orders/${orderId}/status`)
                .set('Authorization', `Bearer ${jwtToken}`)
                .send({ status: 'INVALID_STATUS' })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });
});

module.exports = {};
