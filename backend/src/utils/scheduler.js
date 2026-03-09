const { prisma } = require('../prisma');
const logger = require('./logger');

// Check and release expired reservations
const releaseExpiredReservations = async () => {
    try {
        const now = new Date();


        // Find all reserved tables where reservation time has ended
        const expiredReservations = await prisma.table.findMany({
            where: {
                status: 'RESERVED',
                reservedUntil: {
                    lt: now  // reservedUntil is less than current time (expired)
                }
            },
            include: {
                orders: {
                    where: {
                        status: {
                            in: ['PENDING', 'PREPARING', 'SERVED']
                        }
                    }
                }
            }
        });

        if (expiredReservations.length === 0) {

            return { released: 0, tables: [] };
        }

        const releasedTables = [];

        for (const table of expiredReservations) {
            // Check if there are any active orders on this table
            if (table.orders.length > 0) {
                // Table has active orders, change to OCCUPIED instead
                await prisma.table.update({
                    where: { id: table.id },
                    data: {
                        status: 'OCCUPIED',
                        reservedFrom: null,
                        reservedUntil: null,
                        updatedAt: new Date()
                    }
                });
                console.log(`   Table ${table.number}: Reservation expired but has active orders - marked as OCCUPIED`);
            } else {
                // No active orders, release the table
                await prisma.table.update({
                    where: { id: table.id },
                    data: {
                        status: 'AVAILABLE',
                        customerName: null,
                        customerPhone: null,
                        reservedFrom: null,
                        reservedUntil: null,
                        currentBill: 0,
                        orderTime: null,
                        updatedAt: new Date()
                    }
                });
                console.log(`   Table ${table.number}: Reservation expired with no orders - marked as AVAILABLE`);
                releasedTables.push(table.number);
            }
        }

        console.log(`   ✅ Processed ${expiredReservations.length} expired reservations, released ${releasedTables.length} tables`);

        return {
            released: releasedTables.length,
            tables: releasedTables,
            processed: expiredReservations.length
        };

    } catch (error) {
        console.error('❌ Error releasing expired reservations:', error);
        return { error: error.message };
    }
};

// Check reservations that are about to expire (for notifications)
const getExpiringReservations = async (minutesAhead = 15) => {
    try {
        const now = new Date();
        const soon = new Date(now.getTime() + minutesAhead * 60 * 1000);

        const expiringReservations = await prisma.table.findMany({
            where: {
                status: 'RESERVED',
                reservedUntil: {
                    gt: now,
                    lt: soon
                }
            }
        });

        return expiringReservations;
    } catch (error) {
        console.error('Error getting expiring reservations:', error);
        return [];
    }
};

// Start the scheduler
const startReservationScheduler = (intervalMinutes = 1) => {


    // Run immediately on start
    releaseExpiredReservations();

    // Then run at intervals
    const intervalMs = intervalMinutes * 60 * 1000;
    const intervalId = setInterval(releaseExpiredReservations, intervalMs);

    return intervalId;
};

// ─── End-of-Day Report Scheduler ────────────────────────────────
// Calculates ms until the next HH:MM local time and fires then,
// then reschedules itself every 24 h.
let _eodTimeoutId = null;

function msUntilTime(hh, mm) {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
}

async function runEODReport() {
    try {
        const { readConfig } = require('./eodConfig');
        const cfg = readConfig();
        if (!cfg.enabled) {
            logger.info('EOD scheduler: disabled, skipping');
            return;
        }

        // Delegate entirely to the shared dispatcher in the controller
        const { dispatchReport } = require('../controllers/eodController');
        const results = await dispatchReport(new Date());
        logger.info('EOD scheduler: report dispatched', { results });
    } catch (err) {
        // A 400-style "no channels" error is expected when not configured; log but don't crash
        logger.error('EOD scheduler: unexpected error', { error: err.message });
    }
}

function startEODScheduler(sendTime) {
    const [hh, mm] = (sendTime || '22:00').split(':').map(Number);
    const delay = msUntilTime(hh, mm);
    const nextFire = new Date(Date.now() + delay);
    logger.info(`EOD scheduler armed — next run at ${nextFire.toLocaleString('en-IN')}`);

    if (_eodTimeoutId) clearTimeout(_eodTimeoutId);
    _eodTimeoutId = setTimeout(async () => {
        await runEODReport();
        // Re-arm for next day using latest config (sendTime may have changed)
        const { readConfig: readLatest } = require('./eodConfig');
        const latestCfg = readLatest();
        startEODScheduler(latestCfg.sendTime);
    }, delay);
}

// Allow runtime rescheduling (called from eodController after settings update)
global.rescheduleEOD = (newTime) => { startEODScheduler(newTime); };

module.exports = {
    releaseExpiredReservations,
    getExpiringReservations,
    startReservationScheduler,
    startEODScheduler,
    runEODReport,
};