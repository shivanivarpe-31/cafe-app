const express = require('express');
const auth = require('../middleware/auth');
const { adminOrManager } = require('../middleware/authorize');
const inventoryController = require('../controllers/inventoryController');
const router = express.Router();

// Inventory routes - Admin and Manager only
router.get('/', auth, adminOrManager, inventoryController.getInventory);
router.put('/:id', auth, adminOrManager, inventoryController.updateInventory);
router.get('/low-stock', auth, adminOrManager, inventoryController.getLowStock);

module.exports = router;


