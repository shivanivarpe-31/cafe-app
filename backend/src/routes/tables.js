const express = require('express');
const router = express.Router();
const tableController = require('../controllers/tableController');
const auth = require('../middleware/auth');
const { adminOrManager, allRoles } = require('../middleware/authorize');

// Get all tables - All roles can view tables for ordering
router.get('/', auth, allRoles, tableController.getTables);
router.get('/merged-groups', auth, allRoles, tableController.getMergedGroups);

// Table management - Admin and Manager only
router.post('/merge', auth, adminOrManager, tableController.mergeTables);
router.post('/split', auth, adminOrManager, tableController.splitTables);

// Reservation management - Admin and Manager only
router.post('/reserve', auth, adminOrManager, tableController.createReservation);
router.delete('/:id/reservation', auth, adminOrManager, tableController.cancelReservation);
router.put('/:id/extend', auth, adminOrManager, tableController.extendReservation);

// Expiry management - Admin and Manager only
router.post('/release-expired', auth, adminOrManager, tableController.releaseExpired);
router.get('/expiring', auth, adminOrManager, tableController.getExpiring);

// Update table status - Admin and Manager only
router.put('/:id/status', auth, adminOrManager, tableController.updateTableStatus);

module.exports = router;