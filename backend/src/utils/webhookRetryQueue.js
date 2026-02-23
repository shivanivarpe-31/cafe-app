/**
 * Webhook Retry Queue Manager
 * Handles failed webhook processing with exponential backoff
 * Stores failed webhooks in database for retry
 */

const { prisma } = require('../prisma');
const logger = require('../utils/logger');

class WebhookRetryQueue {
    /**
     * Enqueue a failed webhook for retry
     * @param {string} platform - 'SWIGGY' or 'ZOMATO'
     * @param {string} eventType - Event type (e.g., 'ORDER_PLACED')
     * @param {Object} payload - Original webhook payload
     * @param {string} error - Error message
     * @param {number} attemptCount - Number of retry attempts (optional)
     */
    static async enqueue(platform, eventType, payload, error, attemptCount = 0) {
        try {
            // Calculate next retry time with exponential backoff
            // Attempt 0: 1 minute
            // Attempt 1: 2 minutes
            // Attempt 2: 4 minutes
            // Attempt 3: 8 minutes (max)
            const delayMinutes = Math.min(Math.pow(2, attemptCount), 8);
            const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);

            const webhookLog = await prisma.webhookLog.create({
                data: {
                    platform,
                    eventType,
                    payload: JSON.stringify(payload),
                    status: 'FAILED',
                    error,
                    attemptCount,
                    nextRetryAt,
                    lastAttemptAt: new Date()
                }
            });

            logger.warn('Webhook enqueued for retry', {
                platform,
                eventType,
                webhookLogId: webhookLog.id,
                attemptCount,
                nextRetryAt: nextRetryAt.toISOString(),
                error
            });

            return webhookLog;
        } catch (err) {
            logger.error('Failed to enqueue webhook retry', {
                platform,
                eventType,
                error: err.message
            });
            throw err;
        }
    }

    /**
     * Process pending webhook retries
     * Called periodically (e.g., every 5 minutes via cron/scheduler)
     */
    static async processPendingRetries() {
        try {
            const now = new Date();

            // Find webhooks ready for retry
            const pendingWebhooks = await prisma.webhookLog.findMany({
                where: {
                    status: 'FAILED',
                    nextRetryAt: { lte: now },
                    attemptCount: { lt: 5 } // Max 5 retry attempts
                },
                orderBy: { nextRetryAt: 'asc' },
                take: 10 // Process 10 at a time
            });

            if (pendingWebhooks.length === 0) {
                return { processed: 0, success: 0, failed: 0 };
            }

            logger.info(`Processing ${pendingWebhooks.length} pending webhook retries`);

            let successCount = 0;
            let failedCount = 0;

            for (const webhook of pendingWebhooks) {
                try {
                    const payload = JSON.parse(webhook.payload);

                    // Re-process the webhook based on platform
                    let result;
                    if (webhook.platform === 'SWIGGY') {
                        result = await this._processSwiggyWebhook(webhook.eventType, payload);
                    } else if (webhook.platform === 'ZOMATO') {
                        result = await this._processZomatoWebhook(webhook.eventType, payload);
                    }

                    if (result.success) {
                        // Mark as successful
                        await prisma.webhookLog.update({
                            where: { id: webhook.id },
                            data: {
                                status: 'SUCCESS',
                                attemptCount: webhook.attemptCount + 1
                            }
                        });
                        successCount++;
                    } else {
                        throw new Error(result.error || 'Unknown error');
                    }
                } catch (error) {
                    failedCount++;

                    // Update webhook with retry info
                    await prisma.webhookLog.update({
                        where: { id: webhook.id },
                        data: {
                            attemptCount: webhook.attemptCount + 1,
                            error: error.message,
                            nextRetryAt: new Date(
                                Date.now() + Math.pow(2, webhook.attemptCount + 1) * 60 * 1000
                            ),
                            lastAttemptAt: new Date()
                        }
                    });

                    logger.error('Webhook retry failed', {
                        webhookLogId: webhook.id,
                        platform: webhook.platform,
                        eventType: webhook.eventType,
                        attemptCount: webhook.attemptCount + 1,
                        error: error.message
                    });
                }
            }

            logger.info('Webhook retry processing complete', {
                processed: pendingWebhooks.length,
                success: successCount,
                failed: failedCount
            });

            return { processed: pendingWebhooks.length, success: successCount, failed: failedCount };
        } catch (error) {
            logger.error('Webhook retry processing failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Process Swiggy webhook (internal use)
     * @private
     */
    static async _processSwiggyWebhook(eventType, payload) {
        const { handleSwiggyWebhook } = require('../integrations/swiggy/swiggyWebhookHandler');

        // Create a mock Express req/res to reprocess through the handler
        return new Promise((resolve) => {
            const req = {
                body: { event_type: eventType, payload },
                headers: { 'x-swiggy-webhook-retry': 'true' }
            };
            const res = {
                status: (code) => ({
                    json: (data) => resolve({
                        success: code >= 200 && code < 300,
                        data,
                        error: code >= 400 ? (data.error || 'Handler returned error') : null
                    })
                }),
                json: (data) => resolve({ success: true, data })
            };
            handleSwiggyWebhook(req, res).catch((err) =>
                resolve({ success: false, error: err.message })
            );
        });
    }

    /**
     * Process Zomato webhook (internal use)
     * @private
     */
    static async _processZomatoWebhook(eventType, payload) {
        const { handleZomatoWebhook } = require('../integrations/zomato/zomatoWebhookHandler');

        // Create a mock Express req/res to reprocess through the handler
        return new Promise((resolve) => {
            const req = {
                body: { event_type: eventType, data: payload },
                headers: { 'x-zomato-webhook-retry': 'true' }
            };
            const res = {
                status: (code) => ({
                    json: (data) => resolve({
                        success: code >= 200 && code < 300,
                        data,
                        error: code >= 400 ? (data.error || 'Handler returned error') : null
                    })
                }),
                json: (data) => resolve({ success: true, data })
            };
            handleZomatoWebhook(req, res).catch((err) =>
                resolve({ success: false, error: err.message })
            );
        });
    }

    /**
     * Get webhook retry statistics
     */
    static async getStats() {
        const stats = await prisma.webhookLog.groupBy({
            by: ['platform', 'status'],
            _count: true,
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                }
            }
        });

        return stats;
    }

    /**
     * Get failed webhook logs (for debugging)
     */
    static async getFailedWebhooks(limit = 20) {
        return prisma.webhookLog.findMany({
            where: {
                status: 'FAILED',
                attemptCount: { gte: 1 }
            },
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    }
}

module.exports = WebhookRetryQueue;
