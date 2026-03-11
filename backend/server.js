const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const helmet = require('helmet');
const https = require('https');
const fs = require('fs');
const errorHandler = require('./src/middleware/errorHandler');
const requestLogger = require('./src/middleware/requestLogger');
const { loginLimiter, apiLimiter, createOrderLimiter, paymentLimiter } = require('./src/middleware/rateLimiter');
const { startReservationScheduler, startEODScheduler } = require('./src/utils/scheduler');
const { readConfig } = require('./src/utils/eodConfig');
const logger = require('./src/utils/logger');

dotenv.config();

// Validate critical environment variables on startup
if (!process.env.JWT_SECRET) {
    console.error('❌ CRITICAL: JWT_SECRET is not configured in environment variables');
    process.exit(1);
}

if (!process.env.DATABASE_URL) {
    console.error('❌ CRITICAL: DATABASE_URL is not configured in environment variables');
    process.exit(1);
}

const app = express();

// Trust proxy if running behind reverse proxy
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Request logging middleware
app.use(requestLogger);

// Security headers via Helmet
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // Disabled so the React frontend can load freely
}));

// CORS using the cors package with environment-aware configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(o => o.trim());

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server, same-origin proxy)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // In development, allow all origins to avoid proxy issues
            if (process.env.NODE_ENV !== 'production') {
                callback(null, true);
            } else {
                callback(null, false); // Deny without crashing the server
            }
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
    credentials: true,
    maxAge: 86400, // Cache preflight for 24 hours
}));

// Apply rate limiting only in production
if (process.env.NODE_ENV === 'production') {
    app.use('/api/', apiLimiter);
}

// Capture raw body for webhook signature verification (must run before global JSON parser)
app.use('/api/delivery/webhook', express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
        req.rawBody = buf.toString();
    }
}));

app.use(express.json({ limit: '10mb' }));

// Routes
app.get('/api/health', async (req, res) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    // Check database connectivity
    let dbStatus = 'ok';
    let dbLatencyMs = null;
    try {
        const { prisma } = require('./src/prisma');
        const start = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        dbLatencyMs = Date.now() - start;
    } catch (err) {
        dbStatus = 'error';
        dbLatencyMs = null;
    }

    const healthy = dbStatus === 'ok';

    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(uptime),
        database: { status: dbStatus, latencyMs: dbLatencyMs },
        memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024),
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        },
        version: process.env.npm_package_version || '1.0.0',
    });
});
const authLimiter = process.env.NODE_ENV === 'production' ? loginLimiter : (req, res, next) => next();
app.use('/api/auth', authLimiter, require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
app.get('/api/protected', require('./src/middleware/auth'), (req, res) => {
    res.json({ msg: 'Protected OK', user: req.user });
});

app.use('/api/menu', require('./src/routes/menu'));
const orderLimiter = process.env.NODE_ENV === 'production' ? createOrderLimiter : (req, res, next) => next();
app.use('/api/orders', orderLimiter, require('./src/routes/order'));
app.use('/api/reports', require('./src/routes/report'));
app.use('/api/inventory', require('./src/routes/inventory'));
app.use('/api/tables', require('./src/routes/tables'));
app.use('/api/ingredients', require('./src/routes/ingredients'));
app.use('/api/modifications', require('./src/routes/modifications'));
app.use('/api/delivery', require('./src/routes/delivery'));
const payLimiter = process.env.NODE_ENV === 'production' ? paymentLimiter : (req, res, next) => next();
app.use('/api/payment', payLimiter, require('./src/routes/payment'));
app.use('/api/kitchen', require('./src/routes/kitchen'));
app.use('/api/integration', require('./src/routes/platformIntegration'));
app.use('/api/customers', require('./src/routes/customers'));

// Public digital-menu / QR self-ordering (no auth required, rate-limited in production)
const guestLimiter = process.env.NODE_ENV === 'production' ? createOrderLimiter : (req, res, next) => next();
app.use('/api/guest', guestLimiter, require('./src/routes/guest'));

// End-of-Day report routes
app.use('/api/eod', require('./src/routes/eod'));

// --- Serve React frontend in production ---
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');
if (fs.existsSync(frontendBuildPath)) {
    app.use(express.static(frontendBuildPath));
    // SPA fallback: any non-API route serves index.html
    app.get('/{*splat}', (req, res, next) => {
        if (req.path.startsWith('/api/')) return next();
        res.sendFile(path.join(frontendBuildPath, 'index.html'));
    });
}

app.use(errorHandler);

const PORT = process.env.PORT || 5001;

// Start HTTPS if certs are provided, otherwise plain HTTP
const SSL_KEY = process.env.SSL_KEY_PATH;
const SSL_CERT = process.env.SSL_CERT_PATH;

if (SSL_KEY && SSL_CERT && fs.existsSync(SSL_KEY) && fs.existsSync(SSL_CERT)) {
    const httpsOptions = {
        key: fs.readFileSync(SSL_KEY),
        cert: fs.readFileSync(SSL_CERT),
    };
    https.createServer(httpsOptions, app).listen(PORT, () => {
        logger.info(`🔒 HTTPS server started on https://localhost:${PORT}`, {
            environment: process.env.NODE_ENV || 'development',
            frontend: process.env.FRONTEND_URL || 'http://localhost:3000'
        });
        startReservationScheduler(1);
        const eodCfgHttps = readConfig();
        startEODScheduler(eodCfgHttps.sendTime);
    });
} else {
    app.listen(PORT, () => {
        logger.info(`🚀 Server started on http://localhost:${PORT}`, {
            environment: process.env.NODE_ENV || 'development',
            frontend: process.env.FRONTEND_URL || 'http://localhost:3000'
        });
        startReservationScheduler(1);
        const eodCfgHttp = readConfig();
        startEODScheduler(eodCfgHttp.sendTime);
    });
}