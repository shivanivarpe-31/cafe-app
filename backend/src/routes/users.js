const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { adminOnly, adminOrManager } = require('../middleware/authorize');
const userController = require('../controllers/userController');

// All routes require authentication
// Some routes have additional role-based authorization

// Get all users (Admin and Manager can view)
router.get('/', auth, adminOrManager, userController.getAllUsers);

// Get single user by ID (Admin and Manager can view)
router.get('/:id', auth, adminOrManager, userController.getUserById);

// Create new user (Admin and Manager can create)
router.post('/', auth, adminOrManager, userController.createUser);

// Update user (Admin and Manager can update)
router.put('/:id', auth, adminOrManager, userController.updateUser);

// Delete user (Admin only)
router.delete('/:id', auth, adminOnly, userController.deleteUser);

// Deactivate user (Admin only)
router.put('/:id/deactivate', auth, adminOnly, userController.deactivateUser);

// Activate user (Admin only)
router.put('/:id/activate', auth, adminOnly, userController.activateUser);

module.exports = router;
