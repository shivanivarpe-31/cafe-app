const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const auth = require('../middleware/auth');
const { adminOnly, adminOrManager, allRoles } = require('../middleware/authorize');

// All menu routes require authentication + role-based authorization

// GET routes - accessible to all authenticated users
router.get('/items', auth, allRoles, menuController.getMenuItems);  // All roles can view menu for ordering
router.get('/categories', auth, allRoles, menuController.getCategories);  // All roles can view categories

// Management routes - Admin and Manager only
router.get('/items/detailed', auth, adminOrManager, menuController.getDetailedMenuItems);  // Full data for management
router.post('/items', auth, adminOrManager, menuController.createMenuItem);
router.put('/items/:id', auth, adminOrManager, menuController.updateMenuItem);

// Delete route - Admin only
router.delete('/items/:id', auth, adminOnly, menuController.deleteMenuItem);

module.exports = router;
