/**
 * eodController.js  –  End-of-Day report endpoints
 *
 *  GET  /api/eod/settings    read merged config
 *  PUT  /api/eod/settings    update editable fields
 *  GET  /api/eod/preview     build today's report data (no send)
 *  POST /api/eod/send        manual trigger (send now)
 *  POST /api/eod/test-smtp   verify SMTP credentials
 */

const { buildEODData, buildWhatsAppText, buildEmailHtml } = require('../utils/eodReportBuilder');
const { readConfig, writeConfig } = require('../utils/eodConfig');
const logger = require('../utils/logger');
const config = require('../config/businessConfig');

// Lazy-load delivery helpers so missing packages don't crash the whole server
function getEmailSender() { return require('../utils/emailSender'); }
function getWhatsAppSender() { return require('../utils/whatsappSender'); }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseDate(str) {
    if (!str) return new Date();
    const [y, m, d] = str.split('-').map(Number);
    return (y && m && d) ? new Date(y, m - 1, d) : new Date();
}

/**
 * Core dispatcher — called by both the manual /send endpoint and the scheduler.
 * Returns { email, whatsapp, errors[] }
 */
async function dispatchReport(targetDate = new Date()) {
    const cfg = readConfig();
    const emailTo = (Array.isArray(cfg.emailTo) ? cfg.emailTo : []).filter(Boolean);
    const whatsappTo = (Array.isArray(cfg.whatsappTo) ? cfg.whatsappTo : []).filter(Boolean);
    const emailEnabled = cfg.emailEnabled && emailTo.length > 0;
    const whatsappEnabled = cfg.whatsappEnabled && whatsappTo.length > 0;

    if (!emailEnabled && !whatsappEnabled) {
        throw Object.assign(new Error('No delivery channels configured. Enable email or WhatsApp and add at least one recipient.'), { status: 400 });
    }

    // Build the report — if this throws, caller gets a useful error
    const data = await buildEODData(targetDate);

    const dateStr = targetDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const subject = `📊 EOD Report — ${config.restaurant.name} — ${dateStr}`;
    const html = buildEmailHtml(data);
    const text = buildWhatsAppText(data);

    const results = { email: null, whatsapp: null, errors: [] };

    if (emailEnabled) {
        try {
            const { sendEmail } = getEmailSender();
            results.email = await sendEmail({ to: emailTo, subject, html, text });
        } catch (err) {
            results.errors.push({ channel: 'email', error: err.message });
            logger.error('EOD email failed', { error: err.message });
        }
    }

    if (whatsappEnabled) {
        try {
            const { sendWhatsApp } = getWhatsAppSender();
            results.whatsapp = await sendWhatsApp(whatsappTo, text);
        } catch (err) {
            results.errors.push({ channel: 'whatsapp', error: err.message });
            logger.error('EOD whatsapp failed', { error: err.message });
        }
    }

    logger.info('EOD report dispatched', { date: targetDate, results });
    return results;
}

// Expose for scheduler use
exports.dispatchReport = dispatchReport;

// ─── GET /api/eod/settings ────────────────────────────────────────────────────
exports.getSettings = (_req, res) => res.json(readConfig());

// ─── PUT /api/eod/settings ────────────────────────────────────────────────────
exports.updateSettings = (req, res) => {
    const patch = {};
    const { enabled, sendTime, emailEnabled, emailTo, whatsappEnabled, whatsappTo } = req.body || {};

    if (enabled !== undefined) {
        if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be a boolean' });
        patch.enabled = enabled;
    }
    if (sendTime !== undefined) {
        if (!/^\d{2}:\d{2}$/.test(sendTime)) return res.status(400).json({ error: 'sendTime must be HH:MM (24-hour)' });
        const [hh, mm] = sendTime.split(':').map(Number);
        if (hh > 23 || mm > 59) return res.status(400).json({ error: 'sendTime out of range (00:00–23:59)' });
        patch.sendTime = sendTime;
    }
    if (emailEnabled !== undefined) {
        if (typeof emailEnabled !== 'boolean') return res.status(400).json({ error: 'emailEnabled must be a boolean' });
        patch.emailEnabled = emailEnabled;
    }
    if (emailTo !== undefined) {
        if (!Array.isArray(emailTo) || !emailTo.every(e => typeof e === 'string')) return res.status(400).json({ error: 'emailTo must be an array of strings' });
        patch.emailTo = emailTo;
    }
    if (whatsappEnabled !== undefined) {
        if (typeof whatsappEnabled !== 'boolean') return res.status(400).json({ error: 'whatsappEnabled must be a boolean' });
        patch.whatsappEnabled = whatsappEnabled;
    }
    if (whatsappTo !== undefined) {
        if (!Array.isArray(whatsappTo) || !whatsappTo.every(e => typeof e === 'string')) return res.status(400).json({ error: 'whatsappTo must be an array of strings' });
        patch.whatsappTo = whatsappTo;
    }

    const updated = writeConfig(patch);
    if (typeof global.rescheduleEOD === 'function') global.rescheduleEOD(updated.sendTime);
    logger.info('EOD settings updated', patch);
    res.json(updated);
};

// ─── GET /api/eod/preview ─────────────────────────────────────────────────────
exports.preview = async (req, res, next) => {
    try {
        const targetDate = parseDate(req.query.date);
        const data = await buildEODData(targetDate);
        res.json({
            data,
            whatsapp: buildWhatsAppText(data),
            emailHtml: buildEmailHtml(data),
            config: readConfig(),
        });
    } catch (err) { next(err); }
};

// ─── POST /api/eod/send ───────────────────────────────────────────────────────
exports.sendReport = async (req, res, next) => {
    try {
        const targetDate = parseDate(req.body && req.body.date);
        const results = await dispatchReport(targetDate);
        res.json({ success: true, date: targetDate, results });
    } catch (err) {
        logger.error('EOD send failed', { error: err.message, stack: err.stack });
        if (err.status) return res.status(err.status).json({ error: err.message });
        next(err);
    }
};

// ─── POST /api/eod/test-smtp ──────────────────────────────────────────────────
exports.testSmtp = async (req, res) => {
    try {
        const { verifySmtp, resetTransporter } = getEmailSender();
        resetTransporter();
        await verifySmtp();
        res.json({ ok: true, message: 'SMTP connection verified.' });
    } catch (err) {
        logger.error('SMTP test failed', { error: err.message, code: err.code, stack: err.stack });
        res.status(400).json({ ok: false, error: err.message });
    }
};

// ─── POST /api/eod/test-whatsapp ──────────────────────────────────────────────
exports.testWhatsApp = async (req, res) => {
    try {
        const { verifyTwilio } = getWhatsAppSender();
        await verifyTwilio();
        res.json({ ok: true, message: 'Twilio WhatsApp credentials verified.' });
    } catch (err) {
        logger.error('Twilio test failed', { error: err.message, code: err.code, stack: err.stack });
        const msg = err.response?.data?.message || err.message;
        res.status(400).json({ ok: false, error: msg });
    }
};
