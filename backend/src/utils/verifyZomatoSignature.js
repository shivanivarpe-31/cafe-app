const crypto = require('crypto');

function verifyZomatoSignature(req, secret) {
    const signature = req.headers['x-zomato-signature'];
    if (!signature) return false;

    const rawBody = JSON.stringify(req.body);

    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(req.rawBody)
        .digest('hex');

    return signature === expectedSignature;
}

module.exports = verifyZomatoSignature;
