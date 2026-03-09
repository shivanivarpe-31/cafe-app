/**
 * whatsappSender.js
 * Sends the EOD text report to WhatsApp using Twilio's WhatsApp API.
 * Uses plain HTTP (axios) — no Twilio SDK required.
 *
 * Twilio sandbox is free for testing:
 *   https://www.twilio.com/docs/whatsapp/sandbox
 *
 * Required .env vars:
 *   EOD_TWILIO_ACCOUNT_SID
 *   EOD_TWILIO_AUTH_TOKEN
 *   EOD_TWILIO_WHATSAPP_FROM  (e.g. "whatsapp:+14155238886" for sandbox)
 *   EOD_WHATSAPP_TO           (e.g. "whatsapp:+919876543210")
 */

const axios = require('axios');
const logger = require('./logger');

async function sendWhatsApp(to, body) {
    const { EOD_TWILIO_ACCOUNT_SID, EOD_TWILIO_AUTH_TOKEN, EOD_TWILIO_WHATSAPP_FROM } = process.env;

    if (!EOD_TWILIO_ACCOUNT_SID || !EOD_TWILIO_AUTH_TOKEN || !EOD_TWILIO_WHATSAPP_FROM) {
        throw new Error('Twilio WhatsApp not configured. Set EOD_TWILIO_ACCOUNT_SID, EOD_TWILIO_AUTH_TOKEN, EOD_TWILIO_WHATSAPP_FROM in .env');
    }

    const numbers = Array.isArray(to) ? to : [to];
    const results = [];

    for (const number of numbers) {
        const toFmt = number.startsWith('whatsapp:') ? number : `whatsapp:${number}`;

        const params = new URLSearchParams();
        params.append('From', EOD_TWILIO_WHATSAPP_FROM);
        params.append('To', toFmt);
        params.append('Body', body);

        const url = `https://api.twilio.com/2010-04-01/Accounts/${EOD_TWILIO_ACCOUNT_SID}/Messages.json`;

        const res = await axios.post(url, params, {
            auth: { username: EOD_TWILIO_ACCOUNT_SID, password: EOD_TWILIO_AUTH_TOKEN },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        logger.info('WhatsApp message sent', { sid: res.data.sid, to: toFmt });
        results.push({ sid: res.data.sid, to: toFmt, status: res.data.status });
    }

    return results;
}

module.exports = { sendWhatsApp };
