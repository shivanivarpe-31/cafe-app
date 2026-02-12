const { prisma } = require('../prisma');

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

module.exports = {
    releaseExpiredReservations,
    getExpiringReservations,
    startReservationScheduler
};