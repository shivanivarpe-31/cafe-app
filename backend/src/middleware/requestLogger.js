/**
 * Request Logging Middleware
 * Logs all API requests with duration, status, and user info
 */

const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
    // Record start time
    const start = Date.now();

    // Capture original send function
    const originalSend = res.send;

    // Override send to log response
    res.send = function (data) {
        const duration = Date.now() - start;

        // Log the request
        logger.logRequest(req, res, duration);

        // Call original send
        return originalSend.call(this, data);
    };

    next();
};

module.exports = requestLogger;
