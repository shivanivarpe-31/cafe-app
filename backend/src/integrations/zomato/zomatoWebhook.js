/**
 * Zomato Webhook Signature Verification
 * Verifies that webhooks actually come from Zomato
 */

const crypto = require('crypto');

/**
 * Verify Zomato webhook signature
 * @param {string} signature - Signature from request header
 * @param {object} body - Request body
 * @param {string} secret - Webhook secret from environment
 * @returns {boolean} True if signature is valid
 */
function verifyZomatoSignature(signature, body, secret = null) {
  try {
    const webhookSecret = secret || process.env.ZOMATO_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn('[Zomato] No webhook secret configured, skipping verification');
      return true; // Allow in development without secret
    }

    if (!signature) {
      console.error('[Zomato] No signature provided in webhook');
      return false;
    }

    // Zomato uses HMAC-SHA256
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');

    const isValid = expectedSignature === signature;

    if (!isValid) {
      console.error('[Zomato] Webhook signature verification failed');
      console.error(`Expected: ${expectedSignature}`);
      console.error(`Received: ${signature}`);
    }

    return isValid;
  } catch (error) {
    console.error('[Zomato] Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Generate a signature for testing
 * @param {object} body - Request body
 * @returns {string} Generated signature
 */
function generateZomatoSignature(body) {
  const secret = process.env.ZOMATO_WEBHOOK_SECRET || 'test_webhook_secret';

  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(body))
    .digest('hex');
}

/**
 * Extract and verify signature from Express request
 * @param {object} req - Express request object
 * @returns {object} Verification result { valid, signature, error }
 */
function verifyZomatoWebhook(req) {
  const signature = req.headers['x-zomato-signature'];
  const body = req.body;

  const valid = verifyZomatoSignature(signature, body);

  return {
    valid,
    signature,
    error: valid ? null : 'Invalid or missing signature',
  };
}

module.exports = {
  verifyZomatoSignature,
  generateZomatoSignature,
  verifyZomatoWebhook,
};
