const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const errorHandler = require('./src/middleware/errorHandler');
const { startReservationScheduler } = require('./src/utils/scheduler');

dotenv.config();

const app = express();

// Enhanced CORS with explicit OPTIONS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

    if (req.method === 'OPTIONS') {
        res.sendStatus(200);  // Allow preflight
    } else {
        next();
    }
});

app.use(express.json({ limit: '10mb' }));

// Routes
app.get('/api/health', (req, res) => res.json({ status: 'Backend OK' }));
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
app.get('/api/protected', require('./src/middleware/auth'), (req, res) => {
    res.json({ msg: 'Protected OK', user: req.user });
});

app.use('/api/menu', require('./src/routes/menu'));
app.use('/api/orders', require('./src/routes/order'));
app.use('/api/reports', require('./src/routes/report'));
app.use('/api/inventory', require('./src/routes/inventory'));
app.use('/api/tables', require('./src/routes/tables'));
app.use('/api/ingredients', require('./src/routes/ingredients'));
app.use('/api/modifications', require('./src/routes/modifications'));
app.use('/api/delivery', require('./src/routes/delivery'));
app.use('/api/payment', require('./src/routes/payment'));
app.use('/api/kitchen', require('./src/routes/kitchen'));
app.use('/webhook', express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    }
}));

app.use('/delivery/webhook', express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    }
}));

app.use(errorHandler);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`🚀 Server on http://localhost:${PORT}`);

    // Start the reservation scheduler
    startReservationScheduler(1);
});