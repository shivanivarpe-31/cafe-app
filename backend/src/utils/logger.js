/**
 * Structured Logging System using Winston
 * Provides production-grade logging with levels, transports, and formatting
 */

const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
const fs = require('fs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Define custom log levels
const customLevels = {
    levels: {
        fatal: 0,
        error: 1,
        warn: 2,
        info: 3,
        debug: 4,
        trace: 5
    },
    colors: {
        fatal: 'red',
        error: 'red',
        warn: 'yellow',
        info: 'green',
        debug: 'blue',
        trace: 'cyan'
    }
};

// Log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }), // Include stack traces
    winston.format.json(), // Output as JSON
    winston.format.printf(info => {
        const { timestamp, level, message, ...meta } = info;
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `[${timestamp}] ${level.toUpperCase()}: ${message} ${metaStr}`;
    })
);

// Transports
const transports = [];

// Always save to files
transports.push(
    new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 5, // Keep 5 files
        tailable: true
    })
);

transports.push(
    new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        maxsize: 10485760, // 10MB
        maxFiles: 10, // Keep 10 files
        tailable: true
    })
);

// Console output in development
if (process.env.NODE_ENV !== 'production') {
    transports.push(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize({ colors: customLevels.colors }),
                winston.format.printf(info => {
                    const { timestamp, level, message, ...meta } = info;
                    const metaStr = Object.keys(meta).length > 0
                        ? '\n' + JSON.stringify(meta, null, 2)
                        : '';
                    return `[${timestamp}] ${level}: ${message}${metaStr}`;
                })
            )
        })
    );
}

// Create logger instance
const logger = winston.createLogger({
    levels: customLevels.levels,
    format: logFormat,
    defaultMeta: {
        service: 'cafe-pos-api',
        environment: process.env.NODE_ENV || 'development'
    },
    transports
});

/**
 * Helper method to log API requests
 */
logger.logRequest = (req, res, duration) => {
    const logData = {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${duration}ms`,
        userId: req.user?.id,
        userRole: req.user?.role,
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    if (res.statusCode >= 500) {
        logger.error('API Error', logData);
    } else if (res.statusCode >= 400) {
        logger.warn('API Client Error', logData);
    } else {
        logger.info('API Request', logData);
    }
};

/**
 * Helper method to log database operations
 */
logger.logDatabase = (operation, model, data = {}) => {
    logger.debug('Database Operation', {
        operation,
        model,
        data
    });
};

/**
 * Helper method to log authentication events
 */
logger.logAuth = (event, userId = null, details = {}) => {
    logger.info('Authentication Event', {
        event,
        userId,
        ...details
    });
};

module.exports = logger;
