/**
 * eodConfig.js
 * Read / write EOD report settings.
 *
 * SECURITY RULE: Credentials (SMTP password, Twilio token) live ONLY in .env
 * and are NEVER written to the JSON file.
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../../data/eod-config.json');

// ─── Editable defaults (can be seeded from .env, then overridden via UI) ─────
const DEFAULTS = {
    enabled: process.env.EOD_ENABLED !== 'false',
    sendTime: process.env.EOD_SEND_TIME || '22:00',
    emailEnabled: process.env.EOD_EMAIL_ENABLED === 'true',
    emailTo: (process.env.EOD_EMAIL_TO || '').split(',').map(s => s.trim()).filter(Boolean),
    whatsappEnabled: process.env.EOD_WHATSAPP_ENABLED === 'true',
    whatsappTo: (process.env.EOD_WHATSAPP_TO || '').split(',').map(s => s.trim()).filter(Boolean),
};

// Credential flags — always computed fresh from env, never persisted
function credFlags() {
    return {
        smtpConfigured: !!(process.env.EOD_SMTP_HOST && process.env.EOD_SMTP_USER && process.env.EOD_SMTP_PASS),
        twilioConfigured: !!(process.env.EOD_TWILIO_ACCOUNT_SID && process.env.EOD_TWILIO_AUTH_TOKEN),
    };
}

function ensureDir() {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readStored() {
    ensureDir();
    if (!fs.existsSync(CONFIG_PATH)) return {};
    try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
    catch { return {}; }
}

/** Returns merged config: defaults + stored overrides + live credential flags */
function readConfig() {
    return { ...DEFAULTS, ...readStored(), ...credFlags() };
}

/**
 * Persists only whitelisted editable fields.
 * Credential flags are never written.  Returns the fresh config after saving.
 */
function writeConfig(patch) {
    ensureDir();
    const ALLOWED = ['enabled', 'sendTime', 'emailEnabled', 'emailTo', 'whatsappEnabled', 'whatsappTo'];
    const stored = readStored();
    for (const key of ALLOWED) {
        if (key in patch) stored[key] = patch[key];
    }
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(stored, null, 2), 'utf8');
    } catch (err) {
        throw new Error(`Failed to save EOD config: ${err.message}`);
    }
    return readConfig();
}

module.exports = { readConfig, writeConfig };
