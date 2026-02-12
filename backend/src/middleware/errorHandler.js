const { AppError } = require('../utils/errors');

module.exports = (err, req, res, next) => {
    console.error('❌ Error:', err);

    // Handle our custom AppError
    if (err.isOperational && err instanceof AppError) {
        return res.status(err.statusCode).json(err.toJSON());
    }

    // Prisma errors with more context
    if (err.code === 'P2002') {
        return res.status(400).json({
            error: 'Item already exists',
            code: 'DUPLICATE_RESOURCE',
            details: {
                constraint: err.meta?.target,
            },
        });
    }
    if (err.code === 'P2025') {
        return res.status(404).json({
            error: 'Record not found',
            code: 'RESOURCE_NOT_FOUND',
            details: {
                cause: err.meta?.cause,
            },
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Invalid token',
            code: 'AUTH_TOKEN_INVALID',
        });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'Token expired',
            code: 'AUTH_TOKEN_EXPIRED',
        });
    }

    // Default error - don't expose internals in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(err.status || err.statusCode || 500).json({
        error: err.message || 'Internal server error',
        code: 'INTERNAL_ERROR',
        ...(isDevelopment && { stack: err.stack }),
    });
};
