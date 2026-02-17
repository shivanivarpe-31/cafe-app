/**
 * Swiggy Webhook Signature Verification
 * Verifies that webhooks actually come from Swiggy
 */

const crypto = require('crypto');

/**
 * Verify Swiggy webhook signature
 * Swiggy includes a timestamp in the signature to prevent replay attacks
 * @param {string} signature - Signature from request header
 * @param {string} timestamp - Timestamp from request header
 * @param {object} body - Request body
 * @param {string} secret - Webhook secret from environment
 * @returns {boolean} True if signature is valid
 */
function verifySwiggySignature(signature, timestamp, body, secret = null) {
  try {
    const webhookSecret = secret || process.env.SWIGGY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn('[Swiggy] No webhook secret configured, skipping verification');
      return true; // Allow in development without secret
    }

    if (!signature || !timestamp) {
      console.error('[Swiggy] Missing signature or timestamp in webhook');
      return false;
    }

    // Check timestamp to prevent replay attacks (allow 5 minutes tolerance)
    const currentTime = Date.now();
    const webhookTime = parseInt(timestamp);
    const timeDiff = Math.abs(currentTime - webhookTime);

    if (timeDiff > 300000) { // 5 minutes
      console.error('[Swiggy] Webhook timestamp too old or invalid');
      return false;
    }

    // Swiggy signature format: HMAC-SHA256(timestamp + "." + body)
    const payload = `${timestamp}.${JSON.stringify(body)}`;

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    const isValid = expectedSignature === signature;

    if (!isValid) {
      console.error('[Swiggy] Webhook signature verification failed');
      console.error(`Expected: ${expectedSignature}`);
      console.error(`Received: ${signature}`);
    }

    return isValid;
  } catch (error) {
    console.error('[Swiggy] Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Generate a signature for testing
 * @param {object} body - Request body
 * @param {number} timestamp - Optional timestamp (defaults to now)
 * @returns {object} Generated signature and timestamp
 */
function generateSwiggySignature(body, timestamp = null) {
  const secret = process.env.SWIGGY_WEBHOOK_SECRET || 'test_webhook_secret';
  const ts = timestamp || Date.now();
  const payload = `${ts}.${JSON.stringify(body)}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return {
    signature,
    timestamp: ts.toString(),
  };
}

/**
 * Extract and verify signature from Express request
 * @param {object} req - Express request object
 * @returns {object} Verification result { valid, signature, timestamp, error }
 */
function verifySwiggyWebhook(req) {
  const signature = req.headers['x-swiggy-signature'];
  const timestamp = req.headers['x-swiggy-timestamp'];
  const body = req.body;

  const valid = verifySwiggySignature(signature, timestamp, body);

  return {
    valid,
    signature,
    timestamp,
    error: valid ? null : 'Invalid or missing signature/timestamp',
  };
}

module.exports = {
  verifySwiggySignature,
  generateSwiggySignature,
  verifySwiggyWebhook,
};
