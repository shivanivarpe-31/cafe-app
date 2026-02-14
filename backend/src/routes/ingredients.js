const express = require('express');
const router = express.Router();
const ingredientController = require('../controllers/ingredientController');
const auth = require('../middleware/auth');
const { adminOnly, adminOrManager } = require('../middleware/authorize');

// Ingredient CRUD - Admin and Manager
router.get('/', auth, adminOrManager, ingredientController.getIngredients);
router.post('/', auth, adminOrManager, ingredientController.createIngredient);
router.put('/:id', auth, adminOrManager, ingredientController.updateIngredient);

// Delete ingredient - Admin only
router.delete('/:id', auth, adminOnly, ingredientController.deleteIngredient);

// Stock management - Admin and Manager
router.post('/:id/add-stock', auth, adminOrManager, ingredientController.addStock);
router.post('/:id/wastage', auth, adminOrManager, ingredientController.recordWastage);
router.get('/:id/logs', auth, adminOrManager, ingredientController.getStockLogs);
router.get('/alerts/low-stock', auth, adminOrManager, ingredientController.getLowStock);

// Recipe management - Admin and Manager
router.get('/recipe/:menuItemId', auth, adminOrManager, ingredientController.getMenuItemRecipe);
router.put('/recipe/:menuItemId', auth, adminOrManager, ingredientController.setMenuItemRecipe);

// Check availability - Admin and Manager
router.get('/check/:menuItemId', auth, adminOrManager, ingredientController.checkAvailability);
router.get('/check/:menuItemId/:quantity', auth, adminOrManager, ingredientController.checkAvailability);

module.exports = router;