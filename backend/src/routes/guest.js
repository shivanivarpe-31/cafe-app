const express = require('express');
const router = express.Router();
const guest = require('../controllers/guestController');

// All routes here are intentionally public (no auth middleware).
// A global IP-based rate limiter is applied in server.js via createOrderLimiter.

router.get('/restaurant', guest.getRestaurantInfo);
router.get('/table/:tableId', guest.getTable);
router.get('/menu', guest.getMenu);
router.post('/order', guest.placeOrder);

module.exports = router;
