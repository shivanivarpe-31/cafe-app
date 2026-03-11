const express = require('express');
const router = express.Router();
const eod = require('../controllers/eodController');
const auth = require('../middleware/auth');
const { adminOrManager } = require('../middleware/authorize');

// All EOD routes require authentication
router.get('/settings', auth, adminOrManager, eod.getSettings);
router.put('/settings', auth, adminOrManager, eod.updateSettings);
router.get('/preview', auth, adminOrManager, eod.preview);
router.post('/send', auth, adminOrManager, eod.sendReport);
router.post('/test-smtp', auth, adminOrManager, eod.testSmtp);
router.post('/test-whatsapp', auth, adminOrManager, eod.testWhatsApp);

module.exports = router;
