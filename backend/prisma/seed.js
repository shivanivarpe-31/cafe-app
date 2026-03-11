require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting full seed...');

    try {
        // 1. Create Owner User
        const ownerEmail = process.env.SEED_OWNER_EMAIL
        const ownerPassword = process.env.SEED_OWNER_PASSWORD

        if (ownerEmail && ownerPassword) {
            await prisma.user.upsert({
                where: { email: ownerEmail },
                update: {},
                create: {
                    email: ownerEmail,
                    password: bcrypt.hashSync(ownerPassword, 12),
                    role: 'ADMIN'
                }
            });
            console.log('✅ Admin seeded');
        } else {
            console.log('ℹ️ Skipping owner creation. To create an owner, set SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD in your environment.');
        }

        // 2. Categories
        console.log('Creating categories...');
        const categories = await Promise.all([
            prisma.category.upsert({
                where: { name: 'Appetizers' },
                update: {},
                create: { name: 'Appetizers' }
            }),
            prisma.category.upsert({
                where: { name: 'Main Course' },
                update: {},
                create: { name: 'Main Course' }
            }),
            prisma.category.upsert({
                where: { name: 'Beverages' },
                update: {},
                create: { name: 'Beverages' }
            }),
            prisma.category.upsert({
                where: { name: 'Desserts' },
                update: {},
                create: { name: 'Desserts' }
            })
        ]);

        console.log(`✅ Created ${categories.length} categories`);

        // 3. Create Ingredients
        console.log('Creating ingredients...');
        const ingredientData = [
            { name: 'Coffee Powder', unit: 'GRAMS', currentStock: 5000, minStock: 500, costPerUnit: 0.5 },
            { name: 'Milk', unit: 'ML', currentStock: 20000, minStock: 2000, costPerUnit: 0.05 },
            { name: 'Sugar', unit: 'GRAMS', currentStock: 10000, minStock: 1000, costPerUnit: 0.04 },
            { name: 'Vanilla Extract', unit: 'ML', currentStock: 500, minStock: 50, costPerUnit: 2 },
            { name: 'Cocoa Powder', unit: 'GRAMS', currentStock: 2000, minStock: 200, costPerUnit: 0.8 },
            { name: 'Bread', unit: 'PIECES', currentStock: 100, minStock: 20, costPerUnit: 5 },
            { name: 'Butter', unit: 'GRAMS', currentStock: 2000, minStock: 200, costPerUnit: 0.6 },
            { name: 'Garlic', unit: 'GRAMS', currentStock: 1000, minStock: 100, costPerUnit: 0.3 },
            { name: 'Cheese', unit: 'GRAMS', currentStock: 3000, minStock: 300, costPerUnit: 1.2 },
            { name: 'Chicken', unit: 'GRAMS', currentStock: 5000, minStock: 500, costPerUnit: 0.4 },
            { name: 'Paneer', unit: 'GRAMS', currentStock: 3000, minStock: 300, costPerUnit: 0.5 },
            { name: 'Rice', unit: 'GRAMS', currentStock: 10000, minStock: 1000, costPerUnit: 0.06 },
            { name: 'Onion', unit: 'GRAMS', currentStock: 5000, minStock: 500, costPerUnit: 0.03 },
            { name: 'Tomato', unit: 'GRAMS', currentStock: 3000, minStock: 300, costPerUnit: 0.04 },
            { name: 'Cream', unit: 'ML', currentStock: 2000, minStock: 200, costPerUnit: 0.15 },
            { name: 'Potato', unit: 'GRAMS', currentStock: 5000, minStock: 500, costPerUnit: 0.03 },
            { name: 'Oil', unit: 'ML', currentStock: 5000, minStock: 500, costPerUnit: 0.1 },
            { name: 'Lemon', unit: 'PIECES', currentStock: 50, minStock: 10, costPerUnit: 5 },
            { name: 'Ice Cream Base', unit: 'ML', currentStock: 3000, minStock: 500, costPerUnit: 0.2 },
            { name: 'Cake Base', unit: 'PIECES', currentStock: 20, minStock: 5, costPerUnit: 50 },
            { name: 'Coca Cola Syrup', unit: 'ML', currentStock: 5000, minStock: 1000, costPerUnit: 0.1 },
            { name: 'Soda Water', unit: 'ML', currentStock: 10000, minStock: 2000, costPerUnit: 0.02 },
        ];

        const ingredients = {};
        for (const ing of ingredientData) {
            const created = await prisma.ingredient.upsert({
                where: { name: ing.name },
                update: { currentStock: ing.currentStock },
                create: ing
            });
            ingredients[ing.name] = created;
        }
        console.log(`✅ Created ${Object.keys(ingredients).length} ingredients`);

        // 4. Menu Items
        console.log('Creating menu items...');
        const menuItemsData = [
            { name: 'Garlic Bread', price: 120, categoryId: categories[0].id },
            { name: 'French Fries', price: 90, categoryId: categories[0].id },
            { name: 'Paneer Tikka', price: 180, categoryId: categories[0].id },
            { name: 'Butter Chicken', price: 250, categoryId: categories[1].id },
            { name: 'Veg Biryani', price: 180, categoryId: categories[1].id },
            { name: 'Paneer Butter Masala', price: 200, categoryId: categories[1].id },
            { name: 'Coca Cola', price: 50, categoryId: categories[2].id },
            { name: 'Lemonade', price: 60, categoryId: categories[2].id },
            { name: 'Coffee', price: 80, categoryId: categories[2].id },
            { name: 'Chocolate Cake', price: 150, categoryId: categories[3].id },
            { name: 'Ice Cream', price: 100, categoryId: categories[3].id },
        ];

        const menuItems = {};
        for (const item of menuItemsData) {
            const created = await prisma.menuItem.upsert({
                where: { id: -1 }, // Force create
                update: {},
                create: {
                    name: item.name,
                    price: item.price,
                    categoryId: item.categoryId,
                    isActive: true,
                    inventory: {
                        create: {
                            quantity: Math.floor(Math.random() * 50) + 20,
                            lowStock: false
                        }
                    }
                }
            }).catch(async () => {
                // If exists, just fetch it
                return prisma.menuItem.findFirst({ where: { name: item.name } });
            });
            if (created) menuItems[item.name] = created;
        }
        console.log(`✅ Created menu items`);

        // 5. Set up recipes (MenuItemIngredient)
        console.log('Setting up recipes...');
        const recipes = {
            'Coffee': [
                { ingredient: 'Coffee Powder', quantity: 15 },
                { ingredient: 'Milk', quantity: 150 },
                { ingredient: 'Sugar', quantity: 10 },
            ],
            'Garlic Bread': [
                { ingredient: 'Bread', quantity: 2 },
                { ingredient: 'Butter', quantity: 20 },
                { ingredient: 'Garlic', quantity: 10 },
                { ingredient: 'Cheese', quantity: 30 },
            ],
            'French Fries': [
                { ingredient: 'Potato', quantity: 200 },
                { ingredient: 'Oil', quantity: 50 },
            ],
            'Paneer Tikka': [
                { ingredient: 'Paneer', quantity: 150 },
                { ingredient: 'Onion', quantity: 50 },
                { ingredient: 'Cream', quantity: 30 },
            ],
            'Butter Chicken': [
                { ingredient: 'Chicken', quantity: 200 },
                { ingredient: 'Butter', quantity: 30 },
                { ingredient: 'Cream', quantity: 50 },
                { ingredient: 'Tomato', quantity: 100 },
                { ingredient: 'Onion', quantity: 50 },
            ],
            'Veg Biryani': [
                { ingredient: 'Rice', quantity: 150 },
                { ingredient: 'Onion', quantity: 50 },
                { ingredient: 'Paneer', quantity: 50 },
                { ingredient: 'Oil', quantity: 20 },
            ],
            'Paneer Butter Masala': [
                { ingredient: 'Paneer', quantity: 150 },
                { ingredient: 'Butter', quantity: 30 },
                { ingredient: 'Cream', quantity: 50 },
                { ingredient: 'Tomato', quantity: 100 },
            ],
            'Coca Cola': [
                { ingredient: 'Coca Cola Syrup', quantity: 30 },
                { ingredient: 'Soda Water', quantity: 200 },
            ],
            'Lemonade': [
                { ingredient: 'Lemon', quantity: 1 },
                { ingredient: 'Sugar', quantity: 20 },
                { ingredient: 'Soda Water', quantity: 200 },
            ],
            'Chocolate Cake': [
                { ingredient: 'Cake Base', quantity: 1 },
                { ingredient: 'Cocoa Powder', quantity: 20 },
                { ingredient: 'Cream', quantity: 50 },
            ],
            'Ice Cream': [
                { ingredient: 'Ice Cream Base', quantity: 100 },
                { ingredient: 'Milk', quantity: 50 },
            ],
        };

        for (const [menuItemName, recipeItems] of Object.entries(recipes)) {
            const menuItem = menuItems[menuItemName];
            if (!menuItem) continue;

            // Clear existing recipe
            await prisma.menuItemIngredient.deleteMany({
                where: { menuItemId: menuItem.id }
            });

            // Create recipe
            for (const ri of recipeItems) {
                const ingredient = ingredients[ri.ingredient];
                if (!ingredient) continue;

                await prisma.menuItemIngredient.create({
                    data: {
                        menuItemId: menuItem.id,
                        ingredientId: ingredient.id,
                        quantity: ri.quantity
                    }
                });
            }
        }
        console.log('✅ Recipes configured');

        // 6. Create Tables
        console.log('Creating tables...');
        for (let i = 1; i <= 10; i++) {
            await prisma.table.upsert({
                where: { number: i },
                update: {},
                create: {
                    number: i,
                    name: `Table ${i}`,
                    capacity: i <= 4 ? 4 : 6,
                    status: 'AVAILABLE'
                }
            });
        }
        console.log('✅ Created 10 tables');

        console.log('\n🎉 Seed completed successfully!');


    } catch (error) {
        console.error('❌ Seed ERROR:', error);
        // If there's a duplicate error on table number, try using id instead
        if (error.code === 'P2002') {
            console.log('Trying alternative table creation...');
            // Delete existing tables and recreate
            await prisma.table.deleteMany({});
            for (let i = 1; i <= 10; i++) {
                await prisma.table.create({
                    data: {
                        number: i,
                        name: `Table ${i}`,
                        capacity: i <= 4 ? 4 : 6,
                        status: 'AVAILABLE'
                    }
                });
                console.log(`Created: Table ${i}`);
            }
        }
    }
}

// Run the seed
main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });