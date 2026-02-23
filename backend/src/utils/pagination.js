/**
 * Pagination Helper
 * Provides consistent pagination across all list endpoints
 */

const getPaginationParams = (req) => {
    let page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 50;

    // Validation
    if (page < 1) page = 1;
    if (limit < 1) limit = 1;
    if (limit > 200) limit = 200; // Max limit to prevent abuse

    const skip = (page - 1) * limit;

    return { page, limit, skip };
};

/**
 * Format pagination response
 */
const formatPaginatedResponse = (data, total, page, limit) => {
    const totalPages = Math.ceil(total / limit);

    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
        }
    };
};

/**
 * Apply pagination to Prisma findMany query
 * Usage:
 * const { skip, limit } = getPaginationParams(req);
 * const [items, total] = await Promise.all([
 *     prisma.model.findMany({ skip, take: limit, ... }),
 *     prisma.model.count()
 * ]);
 * res.json(formatPaginatedResponse(items, total, page, limit));
 */

module.exports = {
    getPaginationParams,
    formatPaginatedResponse
};
