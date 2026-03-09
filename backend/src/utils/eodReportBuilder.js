/**
 * eodReportBuilder.js
 * Simplified, crash-proof EOD data builder + message formatters.
 *
 * buildEODData(targetDate?)  →  plain data object (all arrays guaranteed non-null)
 * buildWhatsAppText(data)    →  UTF-8 text for WhatsApp
 * buildEmailHtml(data)       →  self-contained HTML email
 */

const { prisma } = require('../prisma');
const config = require('../config/businessConfig');

// Currency formatter
const fmt = (n) =>
    `${config.currency.symbol}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// HTML escape helper to prevent XSS in email templates
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ─── Core data query ─────────────────────────────────────────────────────────
async function buildEODData(targetDate = new Date()) {
    // Guard: coerce invalid inputs to today
    if (!targetDate || isNaN(Date.parse(targetDate))) targetDate = new Date();

    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    const prevStart = new Date(dayStart);
    prevStart.setDate(dayStart.getDate() - 1);

    // ── 1. Revenue aggregates ─────────────────────────────────────
    const [todayAgg, prevAgg, todayCount, cancelledCount] = await Promise.all([
        prisma.order.aggregate({
            where: { createdAt: { gte: dayStart, lt: dayEnd }, status: 'PAID' },
            _sum: { total: true, subtotal: true, tax: true },
            _count: { id: true },
        }),
        prisma.order.aggregate({
            where: { createdAt: { gte: prevStart, lt: dayStart }, status: 'PAID' },
            _sum: { total: true },
            _count: { id: true },
        }),
        prisma.order.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),
        prisma.order.count({ where: { createdAt: { gte: dayStart, lt: dayEnd }, status: 'CANCELLED' } }),
    ]);

    const totalRevenue = parseFloat(todayAgg._sum.total || 0);
    const totalSubtotal = parseFloat(todayAgg._sum.subtotal || 0);
    const totalTax = parseFloat(todayAgg._sum.tax || 0);
    const paidOrders = todayAgg._count.id || 0;
    const prevRevenue = parseFloat(prevAgg._sum.total || 0);
    const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const avgOrderValue = paidOrders > 0 ? totalRevenue / paidOrders : 0;

    // ── 2. Payment split ──────────────────────────────────────────
    const paymentRaw = await prisma.order.groupBy({
        by: ['paymentMode'],
        where: { createdAt: { gte: dayStart, lt: dayEnd }, status: 'PAID' },
        _count: { id: true },
        _sum: { total: true },
    });
    const paymentSplit = {
        cash: { count: 0, amount: 0 },
        card: { count: 0, amount: 0 },
        upi: { count: 0, amount: 0 },
        other: { count: 0, amount: 0 },
    };
    for (const row of paymentRaw) {
        const mode = (row.paymentMode || '').toLowerCase();
        const slot = paymentSplit[mode] || paymentSplit.other;
        slot.count += row._count.id || 0;
        slot.amount += parseFloat(row._sum.total || 0);
    }

    // ── 3. Order type split ───────────────────────────────────────
    const orderTypeRaw = await prisma.order.groupBy({
        by: ['orderType'],
        where: { createdAt: { gte: dayStart, lt: dayEnd }, status: 'PAID' },
        _count: { id: true },
    });
    const orderTypes = {};
    for (const row of orderTypeRaw) orderTypes[row.orderType] = row._count.id;

    // ── 4. Top 5 items ────────────────────────────────────────────
    let topItems = [];
    try {
        const topItemsRaw = await prisma.$queryRaw`
            SELECT oi.menuItemId,
                   SUM(oi.quantity)          AS totalQty,
                   SUM(oi.price * oi.quantity) AS totalRevenue
            FROM   OrderItem oi
            JOIN   \`Order\` o ON o.id = oi.orderId
            WHERE  o.createdAt >= ${dayStart}
              AND  o.createdAt <  ${dayEnd}
              AND  o.status = 'PAID'
            GROUP  BY oi.menuItemId
            ORDER  BY totalQty DESC
            LIMIT  5
        `;
        const menuItemIds = (Array.isArray(topItemsRaw) ? topItemsRaw : []).map(r => r.menuItemId).filter(Boolean);
        const menuItems = menuItemIds.length
            ? await prisma.menuItem.findMany({ where: { id: { in: menuItemIds } }, select: { id: true, name: true } })
            : [];
        const menuMap = new Map(menuItems.map(m => [m.id, m.name]));
        topItems = (Array.isArray(topItemsRaw) ? topItemsRaw : []).map(r => ({
            name: menuMap.get(r.menuItemId) || 'Unknown',
            qty: Number(r.totalQty) || 0,
            revenue: Number(r.totalRevenue) || 0,
        }));
    } catch { /* non-fatal — leave as empty array */ }

    // ── 5. Total items sold ───────────────────────────────────────
    const itemsAgg = await prisma.orderItem.aggregate({
        where: { order: { createdAt: { gte: dayStart, lt: dayEnd }, status: 'PAID' } },
        _sum: { quantity: true },
    });
    const totalItemsSold = itemsAgg._sum.quantity || 0;

    // ── 6. Low-stock ingredients (raw SQL for MySQL GREATEST) ─────
    let rawLowStock = [];
    try {
        rawLowStock = await prisma.$queryRaw`
            SELECT name, currentStock, minStock, unit
            FROM   Ingredient
            WHERE  currentStock <= minStock
            ORDER  BY (currentStock / GREATEST(minStock, 0.001)) ASC
            LIMIT  10
        `;
    } catch { /* non-fatal — leave as empty array */ }
    const lowStock = (Array.isArray(rawLowStock) ? rawLowStock : []).map(r => ({
        name: r.name,
        currentStock: Number(r.currentStock),
        minStock: Number(r.minStock),
        unit: r.unit,
    }));

    // ── 7. Peak hour (raw SQL) ────────────────────────────────────
    let peakHourStr = null;
    try {
        const rows = await prisma.$queryRaw`
            SELECT HOUR(createdAt) as hr, COUNT(*) as cnt
            FROM   \`Order\`
            WHERE  createdAt >= ${dayStart} AND createdAt < ${dayEnd}
            GROUP  BY HOUR(createdAt)
            ORDER  BY cnt DESC
            LIMIT  1
        `;
        if (Array.isArray(rows) && rows.length) {
            const h = Number(rows[0].hr);
            peakHourStr = `${String(h).padStart(2, '0')}:00 – ${String((h + 1) % 24).padStart(2, '0')}:00`;
        }
    } catch { /* non-fatal */ }

    // ── Return canonical data object ──────────────────────────────
    return {
        date: dayStart,
        restaurant: config.restaurant,
        currency: config.currency.symbol,
        taxLabel: config.tax.label,
        totalRevenue,
        totalSubtotal,
        totalTax,
        paidOrders,
        todayOrderCount: todayCount,
        cancelledOrders: cancelledCount,
        prevRevenue,
        revenueGrowth,
        avgOrderValue,
        totalItemsSold,
        topItems,                            // always an array
        paymentSplit,
        orderTypes,
        peakHourStr,
        lowStockIngredients: lowStock,        // always an array
    };
}

// ─── WhatsApp text ────────────────────────────────────────────────────────────
function buildWhatsAppText(d) {
    const date = d.date instanceof Date ? d.date : new Date(d.date);
    const dateStr = date.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const growth = d.revenueGrowth >= 0
        ? `📈 +${Number(d.revenueGrowth).toFixed(1)}%`
        : `📉 ${Number(d.revenueGrowth).toFixed(1)}%`;

    let t = '';
    t += `🍽️ *${d.restaurant.name}* — End of Day Summary\n`;
    t += `📅 ${dateStr}\n`;
    t += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    t += `💰 *REVENUE*\n`;
    t += `Total  : *${fmt(d.totalRevenue)}*  (${growth} vs yesterday)\n`;
    t += `Subtotal: ${fmt(d.totalSubtotal)} | Tax: ${fmt(d.totalTax)}\n\n`;

    t += `📋 *ORDERS*\n`;
    t += `Paid: *${d.paidOrders}* | Placed: ${d.todayOrderCount}\n`;
    t += `Avg value: ${fmt(d.avgOrderValue)}\n`;
    if (d.cancelledOrders > 0) t += `⚠️ Cancelled: ${d.cancelledOrders}\n`;
    if (d.peakHourStr) t += `⏰ Peak hour : ${d.peakHourStr}\n`;
    t += `\n`;

    if (d.topItems && d.topItems.length) {
        t += `🏆 *TOP ITEMS*\n`;
        d.topItems.forEach((item, i) => {
            t += `${i + 1}. ${item.name} — ${item.qty} sold (${fmt(item.revenue)})\n`;
        });
        t += `\n`;
    }

    t += `💳 *PAYMENT SPLIT*\n`;
    const ps = d.paymentSplit || {};
    const p = (k) => ps[k] || { count: 0, amount: 0 };
    t += `Cash : ${p('cash').count} orders (${fmt(p('cash').amount)})\n`;
    t += `Card : ${p('card').count} orders (${fmt(p('card').amount)})\n`;
    t += `UPI  : ${p('upi').count} orders (${fmt(p('upi').amount)})\n\n`;

    if (d.orderTypes && Object.keys(d.orderTypes).length) {
        t += `🪑 *ORDER TYPES*\n`;
        const labels = { DINE_IN: 'Dine-In', TAKEAWAY: 'Takeaway', DELIVERY: 'Delivery' };
        for (const [k, v] of Object.entries(d.orderTypes)) {
            t += `${labels[k] || k}: ${v}\n`;
        }
        t += `\n`;
    }

    const ls = d.lowStockIngredients || [];
    if (ls.length) {
        t += `⚠️ *LOW STOCK (${ls.length})*\n`;
        ls.forEach(s => {
            t += `• ${s.name}: ${Number(s.currentStock).toFixed(1)} ${s.unit} (min ${Number(s.minStock).toFixed(1)})\n`;
        });
        t += `\n`;
    } else {
        t += `✅ All ingredients stocked\n\n`;
    }

    t += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    t += `_${d.restaurant.name} POS · ${new Date().toLocaleTimeString('en-IN')}_`;
    return t;
}

// ─── HTML email ───────────────────────────────────────────────────────────────
function buildEmailHtml(d) {
    const date = d.date instanceof Date ? d.date : new Date(d.date);
    const dateStr = date.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const growthColor = Number(d.revenueGrowth) >= 0 ? '#16a34a' : '#dc2626';
    const growthLabel = `${Number(d.revenueGrowth) >= 0 ? '▲' : '▼'} ${Math.abs(Number(d.revenueGrowth)).toFixed(1)}% vs yesterday`;

    const row = (label, val) =>
        `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">${esc(label)}</td>
             <td style="padding:6px 0;text-align:right;font-size:14px;color:#111827;">${esc(val)}</td></tr>`;

    const topItems = Array.isArray(d.topItems) ? d.topItems : [];
    const topItemRows = topItems.map((item, i) =>
        `<tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
           <td style="padding:8px 12px;font-size:13px;color:#374151;">${i + 1}. ${esc(item.name)}</td>
           <td style="padding:8px 12px;font-size:13px;text-align:center;color:#6b7280;">${item.qty}</td>
           <td style="padding:8px 12px;font-size:13px;text-align:right;font-weight:600;color:#059669;">${fmt(item.revenue)}</td>
         </tr>`
    ).join('');

    const ls = Array.isArray(d.lowStockIngredients) ? d.lowStockIngredients : [];
    const lowStockRows = ls.map(s => {
        const pctLeft = s.minStock > 0 ? (s.currentStock / s.minStock) * 100 : 100;
        const color = pctLeft <= 30 ? '#dc2626' : pctLeft <= 70 ? '#d97706' : '#2563eb';
        return `<tr>
          <td style="padding:6px 12px;font-size:13px;color:#374151;">${esc(s.name)}</td>
          <td style="padding:6px 12px;font-size:13px;text-align:center;">
            <span style="color:${color};font-weight:600;">${Number(s.currentStock).toFixed(1)} ${esc(s.unit)}</span>
          </td>
          <td style="padding:6px 12px;font-size:13px;text-align:center;color:#9ca3af;">${Number(s.minStock).toFixed(1)} ${esc(s.unit)}</td>
        </tr>`;
    }).join('');

    const ps = d.paymentSplit || {};
    const p = (k) => ps[k] || { count: 0, amount: 0 };

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>EOD Report — ${esc(d.restaurant.name)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:28px 32px;">
    <p style="margin:0;color:rgba(255,255,255,.75);font-size:12px;text-transform:uppercase;letter-spacing:1px;">End of Day Report</p>
    <h1 style="margin:6px 0 4px;color:#fff;font-size:24px;font-weight:700;">${esc(d.restaurant.name)}</h1>
    <p style="margin:0;color:rgba(255,255,255,.85);font-size:14px;">📅 ${dateStr}</p>
  </div>

  <!-- Revenue hero -->
  <div style="padding:24px 32px;background:#fff8f5;border-bottom:1px solid #fee2e2;">
    <p style="margin:0 0 4px;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Total Revenue</p>
    <p style="margin:0;font-size:40px;font-weight:800;color:#111827;">${fmt(d.totalRevenue)}</p>
    <p style="margin:4px 0 0;font-size:13px;color:${growthColor};font-weight:600;">${growthLabel}</p>
  </div>

  <!-- Key stats grid -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border-bottom:1px solid #f3f4f6;">
    ${[
            ['Paid Orders', d.paidOrders, ''],
            ['Items Sold', d.totalItemsSold, ''],
            ['Avg Order', fmt(d.avgOrderValue), ''],
        ].map(([l, v]) => `
    <div style="padding:16px;text-align:center;border-right:1px solid #f3f4f6;">
      <p style="margin:0 0 4px;color:#9ca3af;font-size:11px;text-transform:uppercase;">${l}</p>
      <p style="margin:0;font-size:20px;font-weight:700;color:#111827;">${v}</p>
    </div>`).join('')}
  </div>

  <div style="padding:24px 32px;">

    <!-- Payment split -->
    <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#374151;">💳 Payment Split</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${row('Cash', `${p('cash').count} orders — ${fmt(p('cash').amount)}`)}
      ${row('Card', `${p('card').count} orders — ${fmt(p('card').amount)}`)}
      ${row('UPI', `${p('upi').count} orders — ${fmt(p('upi').amount)}`)}
      ${d.cancelledOrders > 0 ? row('⚠️ Cancelled', `${d.cancelledOrders} orders`) : ''}
      ${d.peakHourStr ? row('⏰ Peak Hour', d.peakHourStr) : ''}
    </table>

    ${topItems.length ? `
    <!-- Top items -->
    <h2 style="margin:0 0 10px;font-size:15px;font-weight:700;color:#374151;">🏆 Top Items Today</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:8px 12px;font-size:11px;text-align:left;color:#6b7280;text-transform:uppercase;">Item</th>
        <th style="padding:8px 12px;font-size:11px;text-align:center;color:#6b7280;text-transform:uppercase;">Qty</th>
        <th style="padding:8px 12px;font-size:11px;text-align:right;color:#6b7280;text-transform:uppercase;">Revenue</th>
      </tr></thead>
      <tbody>${topItemRows}</tbody>
    </table>` : ''}

    ${ls.length ? `
    <!-- Low stock -->
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px;margin-bottom:24px;">
      <h2 style="margin:0 0 10px;font-size:15px;font-weight:700;color:#c2410c;">⚠️ Low Stock Alerts (${ls.length})</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          <th style="padding:4px 12px;font-size:11px;text-align:left;color:#9a3412;text-transform:uppercase;">Ingredient</th>
          <th style="padding:4px 12px;font-size:11px;text-align:center;color:#9a3412;text-transform:uppercase;">Current</th>
          <th style="padding:4px 12px;font-size:11px;text-align:center;color:#9a3412;text-transform:uppercase;">Min</th>
        </tr></thead>
        <tbody>${lowStockRows}</tbody>
      </table>
    </div>` : `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;margin-bottom:24px;">
      <p style="margin:0;color:#15803d;font-size:14px;font-weight:600;">✅ All ingredients stocked — no alerts</p>
    </div>`}

  </div>

  <!-- Footer -->
  <div style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:16px 32px;text-align:center;">
    <p style="margin:0;color:#9ca3af;font-size:12px;">${esc(d.restaurant.name)} · ${esc(d.restaurant.address)}</p>
    <p style="margin:4px 0 0;color:#d1d5db;font-size:11px;">Cafe POS · ${new Date().toLocaleTimeString('en-IN')}</p>
  </div>

</div>
</body>
</html>`;
}

// ── Public ───────────────────────────────────────────────────────
module.exports = { buildEODData, buildWhatsAppText, buildEmailHtml, fmt };
