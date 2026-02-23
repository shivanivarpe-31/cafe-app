/**
 * Middleware for Rate Limiting
 * Protects endpoints from brute force and DDoS attacks
 */

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

// Skip rate limiting in development
const isDevelopment = process.env.NODE_ENV === 'development';

// Authentication rate limiter - very strict (relaxed in development)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDevelopment ? 1000 : 5, // Relaxed in dev, strict in prod
    message: 'Too many login attempts. Please try again after 15 minutes.',
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    skip: (req) => isDevelopment || process.env.NODE_ENV === 'test',
    ...(isDevelopment ? {} : {
        keyGenerator: (req) => {
            // Use IP + email combo to prevent targeting
            return `${ipKeyGenerator(req)}-${req.body.email || 'unknown'}`;
        }
    })
});

// API rate limiter - moderate (relaxed in development)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDevelopment ? 10000 : 100, // Relaxed in dev (10k/15min), strict in prod
    message: 'Too many requests from this IP. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isDevelopment || process.env.NODE_ENV === 'test'
});

// Strict limiter for sensitive operations (relaxed in development)
const sensitiveOpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: isDevelopment ? 1000 : 10, // Relaxed in dev, strict in prod
    message: 'Too many sensitive operations. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isDevelopment || process.env.NODE_ENV === 'test'
});

// Order creation limiter - moderate (relaxed in development)
const createOrderLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: isDevelopment ? 500 : 20, // Relaxed in dev, strict in prod
    message: 'Too many order creation requests. Please wait before creating another order.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isDevelopment || process.env.NODE_ENV === 'test',
    ...(isDevelopment ? {} : {
        keyGenerator: (req) => {
            // Rate limit by user ID if authenticated
            return req.user?.id ? `user-${req.user.id}` : ipKeyGenerator(req);
        }
    })
});

// Payment limiter - very strict (relaxed in development)
const paymentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: isDevelopment ? 500 : 30, // Relaxed in dev, strict in prod
    message: 'Too many payment attempts. Please contact support if this issue persists.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isDevelopment || process.env.NODE_ENV === 'test',
    ...(isDevelopment ? {} : {
        keyGenerator: (req) => {
            return req.user?.id ? `user-${req.user.id}` : ipKeyGenerator(req);
        }
    })
});

module.exports = {
    loginLimiter,
    apiLimiter,
    sensitiveOpLimiter,
    createOrderLimiter,
    paymentLimiter
};
