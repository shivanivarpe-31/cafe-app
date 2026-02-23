const crypto = require('crypto');

/**
 * Verify Zomato Webhook Signature
 * @param {Object} req - Express request object
 * @param {string} secret - Webhook secret from Zomato dashboard
 * @returns {boolean} True if signature is valid
 */
function verifyZomatoSignature(req, secret) {
    // Validate inputs
    if (!secret) {
        console.error('[ZOMATO VERIFICATION] No webhook secret provided');
        return false;
    }

    const signature = req.headers['x-zomato-signature'];
    if (!signature) {
        console.error('[ZOMATO VERIFICATION] No signature header found');
        return false;
    }

    // Get raw body - should be set by rawBodyMiddleware
    const rawBody = req.rawBody;
    if (!rawBody) {
        console.error('[ZOMATO VERIFICATION] No raw body available');
        return false;
    }

    // Calculate expected signature using raw body
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody, 'utf8')
        .digest('hex');

    // Compare signatures (use timing-safe comparison to prevent timing attacks)
    try {
        const isValid = crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
        return isValid;
    } catch (error) {
        console.error('[ZOMATO VERIFICATION] Signature comparison failed', error.message);
        return false;
    }
}

module.exports = verifyZomatoSignature;
