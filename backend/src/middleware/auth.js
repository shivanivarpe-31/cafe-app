const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma');

const auth = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Authentication required. No token provided.'
            });
        }

        // Verify JWT_SECRET is configured
        if (!process.env.JWT_SECRET) {
            console.error('CRITICAL: JWT_SECRET is not configured');
            return res.status(500).json({
                error: 'Server configuration error. JWT_SECRET not set.'
            });
        }

        // Extract token
        const token = authHeader.replace('Bearer ', '');

        // Verify token
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // Find user (include isActive to enforce deactivation)
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true
            }
        });

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        // Block deactivated users even if their JWT is still valid
        if (!user.isActive) {
            return res.status(403).json({ error: 'Account is deactivated. Please contact an administrator.' });
        }

        // Attach user to request
        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }

        res.status(401).json({ error: 'Authentication failed' });
    }
};

module.exports = auth;