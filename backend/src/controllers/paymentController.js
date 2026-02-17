const { prisma } = require('../prisma');
const {
    createNotFoundError,
    createValidationError,
    createPaymentAmountError,
    createSplitPaymentError,
    AppError,
    ERROR_CODES,
} = require('../utils/errors');

// Record manual payment (Cash, Card, UPI)
exports.recordManualPayment = async (req, res, next) => {
    try {
        const { orderId, paymentMode, amount, notes } = req.body;

        if (!orderId || !paymentMode || !amount) {
            return res.status(400).json({ error: 'Order ID, payment mode, and amount are required' });
        }

        const order = await prisma.order.findUnique({
            where: { id: parseInt(orderId, 10) }
        });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Use transaction to ensure payment record and order update succeed together
        const payment = await prisma.$transaction(async (tx) => {
            // Create payment record
            const paymentRecord = await tx.payment.create({
                data: {
                    orderId: parseInt(orderId, 10),
                    amount: parseFloat(amount),
                    currency: 'INR',
                    paymentMode: paymentMode.toUpperCase(),
                    status: 'SUCCESS',
                    notes: notes || null
                }
            });

            // Update order
            await tx.order.update({
                where: { id: parseInt(orderId, 10) },
                data: {
                    status: 'PAID',
                    paymentMode: paymentMode.toUpperCase(),
                    paidAt: new Date()
                }
            });

            return paymentRecord;
        });

        res.json({
            success: true,
            message: 'Payment recorded successfully',
            payment
        });

    } catch (error) {
        console.error('Record manual payment error:', error);
        next(error);
    }
};

// Get payment details
exports.getPaymentDetails = async (req, res, next) => {
    try {
        const { paymentId } = req.params;

        // Get from our database
        const dbPayment = await prisma.payment.findFirst({
            where: {
                id: parseInt(paymentId, 10) || 0
            },
            include: {
                order: {
                    include: {
                        table: true,
                        items: {
                            include: {
                                menuItem: true
                            }
                        }
                    }
                }
            }
        });

        res.json({
            success: true,
            payment: dbPayment
        });

    } catch (error) {
        console.error('Get payment details error:', error);
        next(error);
    }
};

// Get all payments
exports.getAllPayments = async (req, res, next) => {
    try {
        const { status, paymentMode, startDate, endDate, limit = 50 } = req.query;

        const where = {};

        if (status) {
            where.status = status.toUpperCase();
        }

        if (paymentMode) {
            where.paymentMode = paymentMode.toUpperCase();
        }

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                where.createdAt.gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        const payments = await prisma.payment.findMany({
            where,
            include: {
                order: {
                    select: {
                        id: true,
                        billNumber: true,
                        orderType: true,
                        tableId: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit, 10)
        });

        // Calculate summary
        const summary = await prisma.payment.aggregate({
            where: { ...where, status: 'SUCCESS' },
            _sum: { amount: true },
            _count: true
        });

        res.json({
            success: true,
            payments,
            summary: {
                totalAmount: summary._sum.amount || 0,
                totalCount: summary._count || 0
            }
        });

    } catch (error) {
        console.error('Get all payments error:', error);
        next(error);
    }
};

// Get payment by order
exports.getPaymentByOrder = async (req, res, next) => {
    try {
        const { orderId } = req.params;

        const payments = await prisma.payment.findMany({
            where: { orderId: parseInt(orderId, 10) },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            success: true,
            payments
        });

    } catch (error) {
        console.error('Get payment by order error:', error);
        next(error);
    }
};

// Refund payment (manual refund recording only - no online payment gateway)
exports.refundPayment = async (req, res, next) => {
    try {
        const { paymentId, amount, orderId, reason } = req.body;

        if (!paymentId) {
            return res.status(400).json({ error: 'Payment ID is required' });
        }

        // Find the payment record
        const paymentRecord = await prisma.payment.findFirst({
            where: { id: parseInt(paymentId, 10) }
        });

        if (!paymentRecord) {
            return res.status(404).json({ error: 'Payment record not found' });
        }

        // Update database records in transaction
        await prisma.$transaction(async (tx) => {
            // Update payment record
            await tx.payment.update({
                where: { id: paymentRecord.id },
                data: {
                    status: 'REFUNDED',
                    refundAmount: amount ? parseFloat(amount) : paymentRecord.amount,
                    refundedAt: new Date(),
                    notes: JSON.stringify({
                        ...JSON.parse(paymentRecord.notes || '{}'),
                        refundReason: reason || 'Manual refund'
                    })
                }
            });

            // Update order status
            if (orderId) {
                await tx.order.update({
                    where: { id: parseInt(orderId, 10) },
                    data: {
                        status: 'CANCELLED',
                        paymentMode: 'REFUNDED'
                    }
                });
            }
        });

        res.json({
            success: true,
            message: 'Refund recorded successfully'
        });

    } catch (error) {
        console.error('Refund payment error:', error);
        next(error);
    }
};

// Process split payment (multiple payment methods for one order)
exports.processSplitPayment = async (req, res, next) => {
    try {
        const { orderId, payments } = req.body;

        // Validation: Check required fields
        if (!orderId || !payments || !Array.isArray(payments)) {
            return res.status(400).json({ error: 'Order ID and payments array are required' });
        }

        // Validation: Exactly 2 payment methods
        if (payments.length !== 2) {
            return res.status(400).json({ error: 'Split payment requires exactly 2 payment methods' });
        }

        // Validation: Both payment methods have required fields
        for (const payment of payments) {
            if (!payment.paymentMode || !payment.amount) {
                return res.status(400).json({ error: 'Each payment must have paymentMode and amount' });
            }
        }

        // Validation: Only manual payment methods allowed (CASH, CARD, UPI)
        const allowedMethods = ['CASH', 'CARD', 'UPI'];
        for (const payment of payments) {
            if (!allowedMethods.includes(payment.paymentMode.toUpperCase())) {
                return res.status(400).json({
                    error: 'Only Cash, Card, and UPI are allowed in split payments'
                });
            }
        }

        // Validation: No duplicate methods
        if (payments[0].paymentMode.toUpperCase() === payments[1].paymentMode.toUpperCase()) {
            return res.status(400).json({ error: 'Cannot use the same payment method twice' });
        }

        // Validation: All amounts must be positive
        for (const payment of payments) {
            if (parseFloat(payment.amount) <= 0) {
                return res.status(400).json({ error: 'All payment amounts must be greater than zero' });
            }
        }

        // Get order and verify it exists
        const order = await prisma.order.findUnique({
            where: { id: parseInt(orderId, 10) },
            include: {
                table: true,
                deliveryInfo: true
            }
        });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Validation: Order not already paid or cancelled
        if (order.status === 'PAID') {
            return res.status(400).json({ error: 'Order already paid' });
        }

        if (order.status === 'CANCELLED') {
            return res.status(400).json({ error: 'Cannot pay for cancelled order' });
        }

        // Validation: Sum of amounts must equal order total (with tolerance for rounding)
        const totalAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        const orderTotal = parseFloat(order.total);
        if (Math.abs(totalAmount - orderTotal) >= 0.01) {
            return res.status(400).json({
                error: `Total split amount (₹${totalAmount.toFixed(2)}) does not match order total (₹${orderTotal.toFixed(2)})`
            });
        }

        // Process split payment using transaction (atomic operation)
        const result = await prisma.$transaction(async (tx) => {
            // Create first payment record
            const payment1 = await tx.payment.create({
                data: {
                    orderId: order.id,
                    amount: parseFloat(payments[0].amount),
                    currency: 'INR',
                    paymentMode: payments[0].paymentMode.toUpperCase(),
                    status: 'SUCCESS',
                    notes: JSON.stringify({
                        isSplitPayment: true,
                        splitIndex: 1,
                        totalSplits: 2
                    })
                }
            });

            // Create second payment record
            const payment2 = await tx.payment.create({
                data: {
                    orderId: order.id,
                    amount: parseFloat(payments[1].amount),
                    currency: 'INR',
                    paymentMode: payments[1].paymentMode.toUpperCase(),
                    status: 'SUCCESS',
                    notes: JSON.stringify({
                        isSplitPayment: true,
                        splitIndex: 2,
                        totalSplits: 2
                    })
                }
            });

            // Update order status to PAID
            const updatedOrder = await tx.order.update({
                where: { id: order.id },
                data: {
                    status: 'PAID',
                    paymentMode: `${payments[0].paymentMode.toUpperCase()}+${payments[1].paymentMode.toUpperCase()}`,
                    paidAt: new Date()
                }
            });

            // If dine-in order, update table status
            if (order.tableId) {
                const activeOrdersOnTable = await tx.order.count({
                    where: {
                        tableId: order.tableId,
                        status: { in: ['PENDING', 'PREPARING', 'SERVED'] }
                    }
                });

                // If no more active orders on the table, mark it as available
                if (activeOrdersOnTable === 0) {
                    await tx.table.update({
                        where: { id: order.tableId },
                        data: {
                            status: 'AVAILABLE',
                            currentBill: 0,
                            orderTime: null,
                            customerName: null,
                            customerPhone: null,
                            reservedFrom: null,
                            reservedUntil: null
                        }
                    });
                }
            }

            // If delivery order, update delivery status
            if (order.deliveryInfo) {
                await tx.deliveryInfo.update({
                    where: { orderId: order.id },
                    data: { deliveryStatus: 'DELIVERED' }
                });
            }

            return { payment1, payment2, updatedOrder };
        }, {
            maxWait: 5000,
            timeout: 10000
        });

        res.json({
            success: true,
            message: 'Split payment processed successfully',
            payments: [result.payment1, result.payment2],
            order: result.updatedOrder
        });

    } catch (error) {
        console.error('Process split payment error:', error);
        next(error);
    }
};

// Get payment statistics
exports.getPaymentStats = async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Today's stats
        const todayStats = await prisma.payment.groupBy({
            by: ['paymentMode'],
            where: {
                status: 'SUCCESS',
                createdAt: { gte: today, lt: tomorrow }
            },
            _sum: { amount: true },
            _count: true
        });

        // Total stats
        const totalStats = await prisma.payment.aggregate({
            where: { status: 'SUCCESS' },
            _sum: { amount: true },
            _count: true
        });

        // Failed payments today
        const failedToday = await prisma.payment.count({
            where: {
                status: 'FAILED',
                createdAt: { gte: today, lt: tomorrow }
            }
        });

        // Refunds today
        const refundsToday = await prisma.payment.aggregate({
            where: {
                status: 'REFUNDED',
                refundedAt: { gte: today, lt: tomorrow }
            },
            _sum: { refundAmount: true },
            _count: true
        });

        res.json({
            success: true,
            today: {
                byMode: todayStats.reduce((acc, item) => {
                    acc[item.paymentMode] = {
                        amount: item._sum.amount || 0,
                        count: item._count
                    };
                    return acc;
                }, {}),
                totalAmount: todayStats.reduce((sum, item) => sum + (parseFloat(item._sum.amount) || 0), 0),
                totalCount: todayStats.reduce((sum, item) => sum + item._count, 0),
                failed: failedToday,
                refunds: {
                    amount: refundsToday._sum.refundAmount || 0,
                    count: refundsToday._count
                }
            },
            allTime: {
                totalAmount: totalStats._sum.amount || 0,
                totalCount: totalStats._count || 0
            }
        });

    } catch (error) {
        console.error('Get payment stats error:', error);
        next(error);
    }
};

// Record partial payment
exports.recordPartialPayment = async (req, res, next) => {
    try {
        const { orderId, amount, paymentMode } = req.body;

        if (!orderId || !amount || !paymentMode) {
            return res.status(400).json({
                error: 'Order ID, amount, and payment mode are required'
            });
        }

        const order = await prisma.order.findUnique({
            where: { id: parseInt(orderId, 10) },
            include: {
                payments: {
                    where: { status: 'SUCCESS' }
                }
            }
        });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Calculate remaining balance
        const totalPaid = order.payments.reduce(
            (sum, p) => sum + parseFloat(p.amount),
            0
        );
        const remaining = parseFloat(order.total) - totalPaid;

        if (parseFloat(amount) > remaining + 0.01) {
            return res.status(400).json({
                error: `Payment amount (₹${amount}) exceeds remaining balance (₹${remaining.toFixed(2)})`
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            // Create payment record
            const payment = await tx.payment.create({
                data: {
                    orderId: order.id,
                    amount: parseFloat(amount),
                    currency: 'INR',
                    paymentMode: paymentMode.toUpperCase(),
                    status: 'SUCCESS',
                    notes: JSON.stringify({
                        isPartialPayment: true,
                        previousBalance: remaining,
                        paymentNumber: order.payments.length + 1
                    })
                }
            });

            // Check if fully paid
            const newTotalPaid = totalPaid + parseFloat(amount);
            const fullyPaid = Math.abs(newTotalPaid - parseFloat(order.total)) < 0.01;

            // Update order status
            const updatedOrder = await tx.order.update({
                where: { id: order.id },
                data: {
                    status: fullyPaid ? 'PAID' : 'PARTIALLY_PAID',
                    paymentMode: fullyPaid
                        ? paymentMode.toUpperCase()
                        : `PAY_LATER+${paymentMode.toUpperCase()}`,
                    paidAt: fullyPaid ? new Date() : null
                }
            });

            return { payment, updatedOrder, fullyPaid };
        });

        res.json({
            success: true,
            message: result.fullyPaid
                ? 'Payment completed - order fully paid'
                : 'Partial payment recorded',
            payment: result.payment,
            order: result.updatedOrder,
            fullyPaid: result.fullyPaid
        });

    } catch (error) {
        console.error('Record partial payment error:', error);
        next(error);
    }
};