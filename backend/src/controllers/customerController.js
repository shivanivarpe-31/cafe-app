const { prisma } = require('../prisma');
const { getPaginationParams, formatPaginatedResponse } = require('../utils/pagination');

// GET /api/customers — list all customers with order counts
exports.getCustomers = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPaginationParams(req);
        const { search } = req.query;

        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { phone: { contains: search } }
            ];
        }

        const [customers, total] = await Promise.all([
            prisma.customer.findMany({
                where,
                include: {
                    orders: {
                        select: { id: true, total: true, status: true, createdAt: true },
                        orderBy: { createdAt: 'desc' }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.customer.count({ where })
        ]);

        res.json(formatPaginatedResponse(customers, total, page, limit));
    } catch (error) {
        next(error);
    }
};

// POST /api/customers/:id/whatsapp — log a WhatsApp message intent
exports.logWhatsAppMessage = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const customer = await prisma.customer.findUnique({ where: { id } });
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Build the wa.me URL for the client to open
        const phone = customer.phone.replace(/\D/g, '');
        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

        res.json({ success: true, waUrl, customer: { id: customer.id, name: customer.name, phone: customer.phone } });
    } catch (error) {
        next(error);
    }
};

// GET /api/customers/:id — single customer with full order history
exports.getCustomerById = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        const customer = await prisma.customer.findUnique({
            where: { id },
            include: {
                orders: {
                    include: {
                        items: {
                            include: { menuItem: { select: { name: true } } }
                        },
                        table: { select: { number: true } }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.json({ customer });
    } catch (error) {
        next(error);
    }
};
