const Razorpay = require('razorpay');
const crypto = require('crypto');
const prisma = require('../prisma');

// Initialize Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create Razorpay order
exports.createPaymentOrder = async (req, res, next) => {
    try {
        const { orderId, amount } = req.body;

        if (!orderId || !amount) {
            return res.status(400).json({ error: 'Order ID and amount are required' });
        }

        // Verify the order exists
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

        if (order.status === 'PAID') {
            return res.status(400).json({ error: 'Order already paid' });
        }

        // Create Razorpay order
        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(amount * 100), // Razorpay expects amount in paise
            currency: 'INR',
            receipt: order.billNumber,
            notes: {
                orderId: order.id.toString(),
                billNumber: order.billNumber,
                tableId: order.tableId?.toString() || 'delivery',
                orderType: order.orderType
            }
        });

        // Create pending payment record in database
        await prisma.payment.create({
            data: {
                orderId: order.id,
                amount: parseFloat(amount),
                currency: 'INR',
                paymentMode: 'RAZORPAY',
                status: 'PENDING',
                razorpayOrderId: razorpayOrder.id,
                notes: JSON.stringify({
                    billNumber: order.billNumber,
                    orderType: order.orderType
                })
            }
        });

        res.json({
            success: true,
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            billNumber: order.billNumber,
            keyId: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error('Create payment order error:', error);
        next(error);
    }
};

// Verify payment and update order
exports.verifyPayment = async (req, res, next) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
            return res.status(400).json({ error: 'Missing payment verification data' });
        }

        // Verify signature
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        const isAuthentic = expectedSignature === razorpay_signature;

        // Find the payment record
        const paymentRecord = await prisma.payment.findUnique({
            where: { razorpayOrderId: razorpay_order_id }
        });

        if (!isAuthentic) {
            // Update payment record with failure
            if (paymentRecord) {
                await prisma.payment.update({
                    where: { id: paymentRecord.id },
                    data: {
                        status: 'FAILED',
                        errorMessage: 'Invalid signature - verification failed'
                    }
                });
            }

            return res.status(400).json({
                success: false,
                error: 'Payment verification failed - invalid signature'
            });
        }

        // Update payment record with success
        await prisma.payment.update({
            where: { razorpayOrderId: razorpay_order_id },
            data: {
                status: 'SUCCESS',
                razorpayPaymentId: razorpay_payment_id,
                razorpaySignature: razorpay_signature
            }
        });

        // Update order status to PAID
        const order = await prisma.order.update({
            where: { id: parseInt(orderId, 10) },
            data: {
                status: 'PAID',
                paymentMode: 'RAZORPAY',
                paidAt: new Date()
            },
            include: {
                table: true,
                deliveryInfo: true
            }
        });

        // If dine-in order, update table status
        if (order.tableId) {
            const activeOrdersOnTable = await prisma.order.count({
                where: {
                    tableId: order.tableId,
                    status: { in: ['PENDING', 'PREPARING', 'SERVED'] }
                }
            });

            if (activeOrdersOnTable === 0) {
                await prisma.table.update({
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
            await prisma.deliveryInfo.update({
                where: { orderId: order.id },
                data: { deliveryStatus: 'DELIVERED' }
            });
        }

        res.json({
            success: true,
            message: 'Payment verified successfully',
            order,
            paymentId: razorpay_payment_id
        });

    } catch (error) {
        console.error('Verify payment error:', error);
        next(error);
    }
};

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

        // Create payment record
        const payment = await prisma.payment.create({
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
        await prisma.order.update({
            where: { id: parseInt(orderId, 10) },
            data: {
                status: 'PAID',
                paymentMode: paymentMode.toUpperCase(),
                paidAt: new Date()
            }
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

        // Try to get from Razorpay
        let razorpayPayment = null;
        try {
            razorpayPayment = await razorpay.payments.fetch(paymentId);
        } catch (err) {
            // Not a Razorpay payment ID, check our database
        }

        // Get from our database
        const dbPayment = await prisma.payment.findFirst({
            where: {
                OR: [
                    { razorpayPaymentId: paymentId },
                    { id: parseInt(paymentId, 10) || 0 }
                ]
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
            payment: dbPayment,
            razorpayPayment
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

// Refund payment
exports.refundPayment = async (req, res, next) => {
    try {
        const { paymentId, amount, orderId, reason } = req.body;

        if (!paymentId) {
            return res.status(400).json({ error: 'Payment ID is required' });
        }

        // Find the payment record
        const paymentRecord = await prisma.payment.findFirst({
            where: { razorpayPaymentId: paymentId }
        });

        if (!paymentRecord) {
            return res.status(404).json({ error: 'Payment record not found' });
        }

        // Process refund with Razorpay
        const refund = await razorpay.payments.refund(paymentId, {
            amount: amount ? Math.round(amount * 100) : undefined,
            speed: 'normal',
            notes: {
                orderId: orderId?.toString(),
                reason: reason || 'Customer requested refund'
            }
        });

        // Update payment record
        await prisma.payment.update({
            where: { id: paymentRecord.id },
            data: {
                status: 'REFUNDED',
                refundId: refund.id,
                refundAmount: parseFloat(refund.amount) / 100,
                refundedAt: new Date(),
                notes: JSON.stringify({
                    ...JSON.parse(paymentRecord.notes || '{}'),
                    refundReason: reason
                })
            }
        });

        // Update order status
        if (orderId) {
            await prisma.order.update({
                where: { id: parseInt(orderId, 10) },
                data: {
                    status: 'CANCELLED',
                    paymentMode: 'REFUNDED'
                }
            });
        }

        res.json({
            success: true,
            refund,
            message: 'Refund processed successfully'
        });

    } catch (error) {
        console.error('Refund payment error:', error);
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