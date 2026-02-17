/**
 * Integration Logging Utility
 * Logs all API calls and webhook events to the IntegrationLog table
 * Provides audit trail and debugging capabilities
 */

const { prisma } = require('../prisma');

/**
 * Log an integration event (API call or webhook)
 * @param {string} platform - 'ZOMATO' or 'SWIGGY'
 * @param {string} eventType - e.g., 'WEBHOOK_RECEIVED', 'API_CALL', 'MENU_SYNC'
 * @param {string} direction - 'INBOUND' or 'OUTBOUND'
 * @param {string|null} endpoint - API endpoint or webhook path
 * @param {object|null} requestBody - Request payload
 * @param {object|null} responseBody - Response payload
 * @param {number|null} statusCode - HTTP status code
 * @param {boolean} success - Whether the operation succeeded
 * @param {string|null} errorMessage - Error message if failed
 * @param {number|null} orderId - Associated order ID if applicable
 * @returns {Promise<object>} The created log entry
 */
async function logIntegrationEvent(
  platform,
  eventType,
  direction,
  endpoint = null,
  requestBody = null,
  responseBody = null,
  statusCode = null,
  success = true,
  errorMessage = null,
  orderId = null
) {
  try {
    const logEntry = await prisma.integrationLog.create({
      data: {
        platform: platform.toUpperCase(),
        eventType,
        direction: direction.toUpperCase(),
        endpoint,
        requestBody: requestBody ? JSON.stringify(requestBody) : null,
        responseBody: responseBody ? JSON.stringify(responseBody) : null,
        statusCode,
        success,
        errorMessage,
        orderId,
      },
    });

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[IntegrationLog] ${platform} ${eventType} ${direction} - ` +
        `Success: ${success}, Status: ${statusCode || 'N/A'}` +
        (orderId ? `, Order: ${orderId}` : '')
      );
    }

    return logEntry;
  } catch (error) {
    console.error('[IntegrationLog] Failed to create log entry:', error);
    // Don't throw error - logging failure shouldn't break the main operation
    return null;
  }
}

/**
 * Get integration logs with filters
 * @param {object} filters - Filter options
 * @param {string} filters.platform - Filter by platform
 * @param {string} filters.eventType - Filter by event type
 * @param {boolean} filters.success - Filter by success/failure
 * @param {number} filters.orderId - Filter by order ID
 * @param {Date} filters.startDate - Filter by start date
 * @param {Date} filters.endDate - Filter by end date
 * @param {number} filters.limit - Limit results (default 100)
 * @returns {Promise<array>} Array of log entries
 */
async function getIntegrationLogs(filters = {}) {
  const where = {};

  if (filters.platform) {
    where.platform = filters.platform.toUpperCase();
  }

  if (filters.eventType) {
    where.eventType = filters.eventType;
  }

  if (filters.success !== undefined) {
    where.success = filters.success;
  }

  if (filters.orderId) {
    where.orderId = filters.orderId;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate;
    }
  }

  const logs = await prisma.integrationLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.limit || 100,
  });

  return logs;
}

/**
 * Get integration stats
 * @param {string} platform - 'ZOMATO' or 'SWIGGY'
 * @param {Date} since - Get stats since this date
 * @returns {Promise<object>} Stats object
 */
async function getIntegrationStats(platform, since = null) {
  const where = { platform: platform.toUpperCase() };

  if (since) {
    where.createdAt = { gte: since };
  }

  const [total, successful, failed] = await Promise.all([
    prisma.integrationLog.count({ where }),
    prisma.integrationLog.count({ where: { ...where, success: true } }),
    prisma.integrationLog.count({ where: { ...where, success: false } }),
  ]);

  // Get stats by event type
  const byEventType = await prisma.integrationLog.groupBy({
    by: ['eventType'],
    where,
    _count: true,
  });

  return {
    platform,
    total,
    successful,
    failed,
    successRate: total > 0 ? ((successful / total) * 100).toFixed(2) + '%' : '0%',
    byEventType: byEventType.reduce((acc, item) => {
      acc[item.eventType] = item._count;
      return acc;
    }, {}),
  };
}

/**
 * Clear old logs (cleanup utility)
 * @param {number} daysToKeep - Keep logs from the last N days
 * @returns {Promise<number>} Number of deleted logs
 */
async function clearOldLogs(daysToKeep = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await prisma.integrationLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  console.log(`[IntegrationLog] Cleared ${result.count} logs older than ${daysToKeep} days`);
  return result.count;
}

module.exports = {
  logIntegrationEvent,
  getIntegrationLogs,
  getIntegrationStats,
  clearOldLogs,
};
