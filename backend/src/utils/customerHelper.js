/**
 * Customer helper — find-or-create a Customer record and link it to an Order.
 * Accepts a Prisma transaction client (tx) or the global prisma client.
 */

/**
 * Find an existing customer by phone, or create a new one.
 * When found, increments visitCount and totalSpent.
 *
 * @param {Object} client  - Prisma client or transaction client
 * @param {string} name    - Customer name
 * @param {string} phone   - Raw phone string (will be sanitised to 10 digits)
 * @param {number} orderTotal - Order total to add to totalSpent
 * @returns {Promise<Object|null>} Customer record or null if phone not provided
 */
const findOrCreateCustomer = async (client, name, phone, orderTotal = 0) => {
    if (!phone) return null;

    const digits = String(phone).replace(/\D/g, '').slice(-10);
    if (digits.length < 10) return null;

    const cleanName = name ? String(name).trim() : 'Guest';
    const spent = parseFloat(orderTotal) || 0;

    const existing = await client.customer.findUnique({ where: { phone: digits } });

    if (existing) {
        return await client.customer.update({
            where: { phone: digits },
            data: {
                name: cleanName,               // keep name current
                visitCount: { increment: 1 },
                totalSpent: { increment: spent }
            }
        });
    }

    return await client.customer.create({
        data: {
            name: cleanName,
            phone: digits,
            visitCount: 1,
            totalSpent: spent
        }
    });
};

module.exports = { findOrCreateCustomer };
