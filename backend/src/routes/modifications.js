const express = require('express');
const router = express.Router();
const modificationController = require('../controllers/modificationController');
const auth = require('../middleware/auth');
const { adminOnly, adminOrManager, allRoles } = require('../middleware/authorize');

// Get active modifications - All roles can view for ordering
router.get('/', auth, allRoles, modificationController.getModifications);

// Modification management - Admin and Manager only
router.get('/all', auth, adminOrManager, modificationController.getAllModifications);
router.post('/', auth, adminOrManager, modificationController.createModification);
router.put('/:id', auth, adminOrManager, modificationController.updateModification);

// Delete modification - Admin only
router.delete('/:id', auth, adminOnly, modificationController.deleteModification);

// Seed default modifications - Admin and Manager only
router.post('/seed', auth, adminOrManager, modificationController.seedModifications);

module.exports = router;