# End-of-Day (EOD) Report Redesign Plan

This document captures the agreed redesign before we touch code. It keeps backend + frontend changes aligned and acts as the checklist for the upcoming steps.

## 1. Data Model

### Base payload (`buildEODData` output)

| Field              | Type       | Notes                                           |
| ------------------ | ---------- | ----------------------------------------------- |
| `date`             | ISO string | Start-of-day boundary used for the report       |
| `totals.revenue`   | number     | GST-inclusive revenue for paid orders           |
| `totals.subtotal`  | number     | Pre-tax subtotal                                |
| `totals.tax`       | number     | Tax collected                                   |
| `orders.paid`      | number     | Count of paid orders                            |
| `orders.placed`    | number     | All orders (any status)                         |
| `orders.byType`    | object     | `{ DINE_IN, TAKEAWAY, DELIVERY }` counts        |
| `orders.cancelled` | number     | Cancelled orders for the day                    |
| `payments`         | object     | per-mode count + amount (cash/card/upi/other)   |
| `topItems`         | array      | Up to 5 entries `{ name, qty, revenue }`        |
| `lowStock`         | array      | Up to 10 entries `{ name, current, min, unit }` |
| `restaurant`       | object     | From `businessConfig` (name, address, phone)    |

### Builder expectations

- Accept optional `targetDate` (default today) and coerce bad inputs to today.
- All numeric fields default to `0` to avoid undefined lookups.
- Always return arrays (possibly empty) for `topItems` and `lowStock` so rendering/templating never fails.
- Prisma queries scoped only to `status = 'PAID'` for revenue/avg order; counts may include other statuses where called out.

## 2. Delivery Channels

| Channel  | Library           | Config Source                       | Payload                                                    |
| -------- | ----------------- | ----------------------------------- | ---------------------------------------------------------- |
| Email    | `nodemailer` SMTP | `.env` for host/port/user/pass/from | `subject`, `html`, `text` (text = WhatsApp/plain fallback) |
| WhatsApp | Twilio REST       | `.env` SID/token/from               | `text` message (same body as WhatsApp preview)             |

Both channels consume one unified `reportMessage`:

```ts
interface ReportMessage {
  subject: string;
  text: string; // WhatsApp/plain fallback
  html: string; // email only
}
```

## 3. Config & Persistence

### `.env`

Holds **credentials only**. Required variables:

- `EOD_ENABLED` (default `true`)
- `EOD_SEND_TIME` (HH:MM, server TZ)
- `EOD_EMAIL_ENABLED`, `EOD_EMAIL_TO` (comma list)
- `EOD_SMTP_HOST`, `EOD_SMTP_PORT`, `EOD_SMTP_USER`, `EOD_SMTP_PASS`, `EOD_SMTP_FROM`
- `EOD_WHATSAPP_ENABLED`, `EOD_WHATSAPP_TO` (comma list)
- `EOD_TWILIO_ACCOUNT_SID`, `EOD_TWILIO_AUTH_TOKEN`, `EOD_TWILIO_WHATSAPP_FROM`

### `data/eod-config.json`

Persists only runtime-editable toggles and recipient arrays:

```json
{
  "enabled": true,
  "sendTime": "22:00",
  "emailEnabled": true,
  "emailTo": ["owner@example.com"],
  "whatsappEnabled": false,
  "whatsappTo": []
}
```

Credential flags (`smtpConfigured`, `twilioConfigured`) are derived on every read and never stored.

## 4. API Surface

| Method | Path                     | Purpose                                                               |
| ------ | ------------------------ | --------------------------------------------------------------------- |
| `GET`  | `/api/eod/settings`      | Read merged config (file + env hints)                                 |
| `PUT`  | `/api/eod/settings`      | Update editable fields (whitelist keys only)                          |
| `GET`  | `/api/eod/preview`       | Return `{ data, message.text, message.html }` for UI                  |
| `POST` | `/api/eod/send`          | Manual trigger (requires auth + at least one channel with recipients) |
| `POST` | `/api/eod/test-smtp`     | Reset transporter + send `verify()`                                   |
| `POST` | `/api/eod/test-whatsapp` | Simple Twilio credential check (optional)                             |

Controllers share one helper `dispatchReport({ targetDate, channels })` that:

1. Builds data via `buildEODData`.
2. Creates `ReportMessage` (subject/text/html).
3. Iterates through enabled channels, collecting `{ ok, error }` results.

## 5. Scheduler

- New module `src/utils/eodScheduler.js` exports `startScheduler()`, `reschedule(sendTime)`, `stopScheduler()`.
- Uses `node-schedule`-style minimal implementation (setTimeout that recalculates after each run).
- Reads latest config before scheduling; manual PUT calls `global.rescheduleEOD?.(newSendTime)` to refresh timer immediately.
- When time fires, it invokes the same `dispatchReport` with current config and logs results.

## 6. Frontend Contract

`GET /api/eod/preview` response:

```json
{
  "data": { ...payload described above },
  "message": {
    "text": "...whatsapp preview...",
    "html": "...email preview..."
  },
  "config": { ...settings }
}
```

`PUT /api/eod/settings` request body mirrors editable fields. Client must ensure at least one recipient before enabling a channel (UI already enforces this, but backend will re-check).

## 7. Error Handling & Logging

- All controller try/catch blocks log structured errors using `logger.error('EOD send failed', { error })`.
- Validation errors return `400` with descriptive `error` text (e.g., "sendTime must be HH:MM").
- If scheduler fails to send (e.g., SMTP outage), it logs and continues; it does **not** retry automatically to avoid double sends.

## 8. Rollout Steps

1. Update backend utils/controllers/routes according to this plan.
2. Refresh scheduler bootstrap in `server.js` (or equivalent) to call `startScheduler()` after app start.
3. Rebuild frontend page to consume the new API shape (already mostly aligned).
4. Update `.env.example` + docs with final variable list.
5. Manual verification: preview loads, SMTP test works, WhatsApp test works, manual send works, scheduler fires once.

---

This plan satisfies the earlier requirements: simplified payload, reliable delivery across email + WhatsApp, automatic + manual triggers, and a clean UI contract. Next step: implement backend changes following sections 1–5.
