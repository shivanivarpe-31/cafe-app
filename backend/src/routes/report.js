const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/auth');
const { adminOnly, adminOrManager } = require('../middleware/authorize');

// Reports routes - Admin and Manager only
router.get('/stats', auth, adminOrManager, reportController.getStats);
router.get('/sales', auth, adminOrManager, reportController.getSalesTrend);
router.get('/category-sales', auth, adminOrManager, reportController.getCategorySales);
router.get('/hourly-sales', auth, adminOrManager, reportController.getHourlySales);

// Profit analysis - Admin only (sensitive financial data)
router.get('/profit-analysis', auth, adminOnly, reportController.getProfitAnalysis);

module.exports = router;