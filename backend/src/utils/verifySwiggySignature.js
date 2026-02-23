const crypto = require('crypto');

/**
 * Verify Swiggy Webhook Signature
 * @param {Object} req - Express request object
 * @param {string} secret - Webhook secret from Swiggy dashboard
 * @returns {boolean} True if signature is valid
 */
function verifySwiggySignature(req, secret) {
    // Validate inputs
    if (!secret) {
        console.error('[SWIGGY VERIFICATION] No webhook secret provided');
        return false;
    }

    const signature = req.headers['x-swiggy-signature'];
    if (!signature) {
        console.error('[SWIGGY VERIFICATION] No signature header found');
        return false;
    }

    // Get raw body - should be set by rawBodyMiddleware
    const rawBody = req.rawBody;
    if (!rawBody) {
        console.error('[SWIGGY VERIFICATION] No raw body available');
        return false;
    }

    // Calculate expected signature
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody, 'utf8')
        .digest('hex');

    // Compare signatures (use timing-safe comparison)
    try {
        const isValid = crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );

        if (!isValid) {
            console.error(
                '[SWIGGY VERIFICATION] Signature mismatch',
                { received: signature.substring(0, 10) + '...', expected: expectedSignature.substring(0, 10) + '...' }
            );
        }

        return isValid;
    } catch (error) {
        console.error('[SWIGGY VERIFICATION] Signature comparison failed', error.message);
        return false;
    }
}

module.exports = verifySwiggySignature;
