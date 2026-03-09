/**
 * emailSender.js
 * Sends the EOD report email via nodemailer SMTP.
 * Supports Gmail app-password, Outlook, Brevo/SendGrid SMTP etc.
 */

const nodemailer = require('nodemailer');
const logger = require('./logger');

let _transporter = null;

function getTransporter() {
    if (_transporter) return _transporter;

    const { EOD_SMTP_HOST, EOD_SMTP_PORT, EOD_SMTP_USER, EOD_SMTP_PASS } = process.env;

    if (!EOD_SMTP_HOST || !EOD_SMTP_USER || !EOD_SMTP_PASS) {
        throw new Error('SMTP not configured. Set EOD_SMTP_HOST, EOD_SMTP_USER, EOD_SMTP_PASS in .env');
    }

    _transporter = nodemailer.createTransport({
        host: EOD_SMTP_HOST,
        port: parseInt(EOD_SMTP_PORT || '587', 10),
        secure: parseInt(EOD_SMTP_PORT || '587', 10) === 465, // SSL for port 465
        auth: { user: EOD_SMTP_USER, pass: EOD_SMTP_PASS },
        tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
        connectionTimeout: 10000,  // 10s connection timeout
        greetingTimeout: 10000,
    });

    return _transporter;
}

// Reset cached transporter (called when settings change)
function resetTransporter() { _transporter = null; }

/**
 * Send EOD report email.
 * @param {string[]} to        Recipient emails
 * @param {string}   subject   Email subject
 * @param {string}   html      HTML body
 * @param {string}   text      Plain-text fallback
 */
async function sendEmail({ to, subject, html, text }) {
    const transporter = getTransporter();
    const from = process.env.EOD_SMTP_FROM || process.env.EOD_SMTP_USER;

    const info = await transporter.sendMail({
        from,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        text,
        html,
    });

    logger.info('EOD email sent', { messageId: info.messageId, to });
    return { messageId: info.messageId };
}

/**
 * Verify SMTP credentials are reachable.
 */
async function verifySmtp() {
    const transporter = getTransporter();
    await transporter.verify();
    return true;
}

module.exports = { sendEmail, verifySmtp, resetTransporter };
