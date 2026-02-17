const crypto = require('crypto');

function verifySwiggySignature(req, secret) {
    const signature = req.headers['x-swiggy-signature'];

    if (!signature) return false;

    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(req.rawBody)
        .digest('hex');

    return signature === expectedSignature;
}

module.exports = verifySwiggySignature;
