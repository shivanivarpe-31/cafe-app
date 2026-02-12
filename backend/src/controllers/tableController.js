const { prisma } = require('../prisma');
const { releaseExpiredReservations, getExpiringReservations } = require('../utils/scheduler');

// Get all tables
exports.getTables = async (req, res, next) => {
    try {
        const tables = await prisma.table.findMany({
            include: {
                orders: {
                    where: {
                        status: { in: ['PENDING', 'PREPARING', 'SERVED'] }
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            },
            orderBy: { number: 'asc' }
        });

        // Add reservation status info
        const now = new Date();
        const tablesWithInfo = tables.map(table => {
            let reservationStatus = null;

            if (table.status === 'RESERVED' && table.reservedUntil) {
                const timeLeft = new Date(table.reservedUntil).getTime() - now.getTime();
                const minutesLeft = Math.floor(timeLeft / 60000);

                if (timeLeft <= 0) {
                    reservationStatus = 'expired';
                } else if (minutesLeft <= 15) {
                    reservationStatus = 'expiring_soon';
                } else {
                    reservationStatus = 'active';
                }
            }

            return {
                ...table,
                reservationStatus,
                reservedFromFormatted: table.reservedFrom ? new Date(table.reservedFrom).toLocaleString() : null,
                reservedUntilFormatted: table.reservedUntil ? new Date(table.reservedUntil).toLocaleString() : null
            };
        });

        res.json(tablesWithInfo);
    } catch (error) {
        console.error('Get tables error:', error);
        next(error);
    }
};

// Create reservation
exports.createReservation = async (req, res, next) => {
    try {
        const { tableId, customerName, customerPhone, reservedFrom, reservedUntil } = req.body;

        if (!tableId || !customerName || !reservedFrom || !reservedUntil) {
            return res.status(400).json({
                error: 'Table ID, customer name, start time, and end time are required'
            });
        }

        const fromDate = new Date(reservedFrom);
        const untilDate = new Date(reservedUntil);
        const now = new Date();

        // Validation
        if (fromDate >= untilDate) {
            return res.status(400).json({ error: 'End time must be after start time' });
        }

        if (untilDate <= now) {
            return res.status(400).json({ error: 'Reservation end time must be in the future' });
        }

        // Check if table exists and is available
        const table = await prisma.table.findUnique({
            where: { id: parseInt(tableId, 10) }
        });

        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }

        if (table.status !== 'AVAILABLE') {
            return res.status(400).json({
                error: `Table is currently ${table.status.toLowerCase()}`
            });
        }

        // Create reservation
        const updatedTable = await prisma.table.update({
            where: { id: parseInt(tableId, 10) },
            data: {
                status: 'RESERVED',
                customerName,
                customerPhone: customerPhone || null,
                reservedFrom: fromDate,
                reservedUntil: untilDate,
                updatedAt: new Date()
            }
        });

        res.json({
            success: true,
            message: 'Reservation created successfully',
            table: updatedTable
        });

    } catch (error) {
        console.error('Create reservation error:', error);
        next(error);
    }
};

// Cancel reservation
exports.cancelReservation = async (req, res, next) => {
    try {
        const { id } = req.params;

        const table = await prisma.table.findUnique({
            where: { id: parseInt(id, 10) }
        });

        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }

        if (table.status !== 'RESERVED') {
            return res.status(400).json({ error: 'Table is not reserved' });
        }

        const updatedTable = await prisma.table.update({
            where: { id: parseInt(id, 10) },
            data: {
                status: 'AVAILABLE',
                customerName: null,
                customerPhone: null,
                reservedFrom: null,
                reservedUntil: null,
                updatedAt: new Date()
            }
        });

        res.json({
            success: true,
            message: 'Reservation cancelled',
            table: updatedTable
        });

    } catch (error) {
        console.error('Cancel reservation error:', error);
        next(error);
    }
};

// Extend reservation
exports.extendReservation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { newEndTime } = req.body;

        if (!newEndTime) {
            return res.status(400).json({ error: 'New end time is required' });
        }

        const table = await prisma.table.findUnique({
            where: { id: parseInt(id, 10) }
        });

        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }

        if (table.status !== 'RESERVED') {
            return res.status(400).json({ error: 'Table is not reserved' });
        }

        const newUntilDate = new Date(newEndTime);
        const now = new Date();

        if (newUntilDate <= now) {
            return res.status(400).json({ error: 'New end time must be in the future' });
        }

        if (newUntilDate <= table.reservedUntil) {
            return res.status(400).json({ error: 'New end time must be later than current end time' });
        }

        const updatedTable = await prisma.table.update({
            where: { id: parseInt(id, 10) },
            data: {
                reservedUntil: newUntilDate,
                updatedAt: new Date()
            }
        });

        res.json({
            success: true,
            message: 'Reservation extended',
            table: updatedTable
        });

    } catch (error) {
        console.error('Extend reservation error:', error);
        next(error);
    }
};

// Manually trigger release of expired reservations
exports.releaseExpired = async (req, res, next) => {
    try {
        const result = await releaseExpiredReservations();
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Release expired error:', error);
        next(error);
    }
};

// Get expiring reservations (for notifications)
exports.getExpiring = async (req, res, next) => {
    try {
        const minutes = parseInt(req.query.minutes, 10) || 15;
        const expiring = await getExpiringReservations(minutes);
        res.json(expiring);
    } catch (error) {
        console.error('Get expiring error:', error);
        next(error);
    }
};

// Update table status
exports.updateTableStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const normalizedStatus = String(status || '').toUpperCase();
        const validStatuses = ['AVAILABLE', 'OCCUPIED', 'RESERVED'];

        if (!validStatuses.includes(normalizedStatus)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const updateData = {
            status: normalizedStatus,
            updatedAt: new Date()
        };

        // Clear reservation data if making available
        if (normalizedStatus === 'AVAILABLE') {
            updateData.customerName = null;
            updateData.customerPhone = null;
            updateData.reservedFrom = null;
            updateData.reservedUntil = null;
            updateData.currentBill = 0;
            updateData.orderTime = null;
        }

        const table = await prisma.table.update({
            where: { id: parseInt(id, 10) },
            data: updateData
        });

        res.json(table);
    } catch (error) {
        console.error('Update table status error:', error);
        next(error);
    }
};