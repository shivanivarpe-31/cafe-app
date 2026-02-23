const express = require('express');
const jwt = require('jsonwebtoken');
const { login, register } = require('../controllers/authController');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

router.post('/login', login);

// Register is FIRST-USER-ONLY — only works when no users exist in the database.
// After initial setup, create users via POST /api/users (requires admin auth).
router.post('/register', register);

// Check registration availability (is this a fresh install?)
router.get('/setup-status', async (req, res) => {
    try {
        const { prisma } = require('../prisma');
        const userCount = await prisma.user.count();
        res.json({ needsSetup: userCount === 0 });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/me', authMiddleware, async (req, res) => {
    res.json({ user: req.user });
});

// Refresh token — issue a new access token if the current one is still valid.
// This enables sliding sessions: the frontend calls this periodically to stay logged in.
router.post('/refresh', authMiddleware, async (req, res) => {
    try {
        const JWT_EXPIRY = process.env.JWT_EXPIRY || '8h';
        const newToken = jwt.sign(
            { userId: req.user.id, role: req.user.role },
            process.env.JWT_SECRET,
            { expiresIn: JWT_EXPIRY }
        );
        res.json({ token: newToken, expiresIn: JWT_EXPIRY });
    } catch (error) {
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});


module.exports = router;
