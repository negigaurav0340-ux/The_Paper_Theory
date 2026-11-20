'use strict';
// Orders, visitor emails (leads) and payment settings.
//   Public:  POST {action:'place'} places an order · POST {action:'subscribe'} saves a newsletter email.
//   Owner:   x-catalogue-secret header (CATALOGUE_ADMIN_PASSWORD) unlocks everything.
//   Email link: {id, key} unlocks one order only, so the alert email can open it without the password.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const S = require('../server/store.cjs');
const mail = require('../server/order-emails.cjs');
const { bundle } = require('../js/cart-utils.js');

const ORDERS = 'tpt:orders:v1', INDEX = 'tpt:order-index:v1', LEADS = 'tpt:leads:v1', SETTINGS = 'tpt:shop-settings:v1', EVENTS = 'tpt:events:v1';
const STATUSES = ['new', 'awaiting_payment', 'paid', 'shipped', 'delivered', 'cancelled'];
const fail = (status, message) => Object.assign(Error(message), { status });

/* ---------- Catalogue prices (server-side check so a tampered browser cannot set its own price) ---------- */
let catalogue, freeShippingFrom = 699, bundleOffer = null;
function prices() {
  if (catalogue) return catalogue;
  catalogue = new Map();
  try {
    const ctx = { window: {}, structuredClone };
    vm.createContext(ctx);
    for (const file of ['products.js', 'lightbox-data.js', 'product-updates.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), ctx);
    const products = new Map(ctx.window.CATALOGUE.products.map(p => [p.id, p]));
    if (Number.isFinite(ctx.window.CATALOGUE.freeShippingThreshold)) freeShippingFrom = ctx.window.CATALOGUE.freeShippingThreshold;
    bundleOffer = ctx.window.CATALOGUE.bundleOffer || null;
    for (const p of ctx.window.TPT_PRODUCT_UPDATES?.upserts || []) products.set(p.id, { ...products.get(p.id), ...p });
    for (const p of products.values()) catalogue.set(p.id, { name: p.name, categories: p.categories || [], variants: new Map((p.variants || []).map(v => [v.id, v])) });
  } catch { /* prices stay unverified; the owner reviews every order before payment is requested */ }
  return catalogue;
}

/* ---------- Validation ---------- */
function cleanCustomer(input, strict = true) {
  const c = input || {}, t = S.text;
  const customer = { name: t(c.name, 100), phone: t(c.phone, 20), email: t(c.email, 160).toLowerCase(), house: t(c.house, 180), street: t(c.street, 300), landmark: t(c.landmark, 160), city: t(c.city, 100), district: t(c.district, 100), state: t(c.state, 100), pin: t(c.pin, 12), country: t(c.country, 80) || 'India' };
  if (!customer.name) throw fail(400, 'Please enter the customer name.');
  if (customer.email && !S.EMAIL.test(customer.email)) throw fail(400, 'Please enter a valid email address.');
  if (!strict) return customer;
  if (['phone', 'email', 'house', 'street', 'city', 'district', 'state', 'pin'].some(k => !customer[k])) throw fail(400, 'Please complete the required delivery fields, including your email address.');
  if (!/^[+\d ()-]{7,20}$/.test(customer.phone)) throw fail(400, 'Please enter a valid phone number.');
  if (customer.country === 'India' ? !/^\d{6}$/.test(customer.pin) : !/^[A-Za-z0-9 -]{3,12}$/.test(customer.pin)) throw fail(400, 'Please enter a valid PIN / postal code.');
  return customer;
}

function cleanItems(input, trusted) {
  if (!Array.isArray(input) || !input.length || input.length > 40) throw fail(400, 'Add at least one product to the order.');
  const known = prices();
  return input.map(raw => {
    const quantity = Number(raw?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw fail(400, 'Each item needs a quantity between 1 and 999.');
    const declared = raw.unitPrice == null || raw.unitPrice === '' ? null : Number(raw.unitPrice);
    if (declared != null && (!Number.isFinite(declared) || declared < 0 || declared > 1000000)) throw fail(400, 'An item price is invalid.');
    const product = raw.type === 'product' ? known.get(raw.productId) : null, variant = product?.variants.get(raw.variantId);
    let item;
    if (product && variant) {
      const unitPrice = Number.isFinite(variant.price) ? variant.price : null;
      item = { type: 'product', productId: S.text(raw.productId, 40), variantId: S.text(raw.variantId, 40), name: product.name, option: [variant.size, variant.finish].filter(Boolean).join(' · '), unitPrice, verified: true, categories: product.categories };
    } else {
      const name = S.text(raw.name, 160);
      if (!name) throw fail(400, 'Each item needs a name.');
      // Unknown to the published catalogue: keep what was sent, but flag it for the owner unless the owner typed it.
      item = { type: raw.type === 'custom' ? 'custom' : 'product', productId: S.text(raw.productId, 40), variantId: S.text(raw.variantId, 40), name, option: S.text(raw.option, 240), unitPrice: raw.type === 'custom' && !trusted ? null : declared, verified: Boolean(trusted) || raw.type === 'custom' };
    }
    item.selection = S.text(raw.selection, 2000);
    item.quantity = quantity;
    item.lineTotal = item.unitPrice == null ? null : Math.round(item.unitPrice * quantity * 100) / 100;
    return item;
  });
}

// Recomputes subtotal and total. The total stays null ("to be confirmed") until shipping is known.
function totals(order) {
  order.subtotal = order.items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  // The bundle offer applies to catalogue sheets ordered on the website; manual orders carry the price the owner typed.
  const deal = order.origin === 'website' ? bundle(order.items, bundleOffer) : { discount: 0 };
  order.discount = deal.discount; order.discountLabel = deal.discount ? bundleOffer.label : '';
  order.unverified = order.items.some(item => !item.verified);
  order.total = order.shipping == null ? null : Math.max(0, Math.round((order.subtotal - order.discount + (order.adjustment || 0) + order.shipping) * 100) / 100);
  return order;
}

function newId() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: '2-digit', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(x => [x.type, x.value]));
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return `TPT-${p.year}${p.month}${p.day}-${[...crypto.randomBytes(4)].map(b => alphabet[b % alphabet.length]).join('')}`;
}
const stamp = (order, action, note = '') => { order.updatedAt = new Date().toISOString(); order.history.push({ at: order.updatedAt, action, ...(note ? { note } : {}) }); };

/* ---------- Storage ---------- */
const parse = value => { try { return JSON.parse(value); } catch { return null; } };
async function loadOrder(cfg, id) {
  if (!/^TPT-\d{6}-[A-Z0-9]{4}$/.test(id || '')) throw fail(404, 'Order not found.');
  const [value] = await S.redis(cfg, [['HGET', ORDERS, id]]);
  const order = parse(value);
  if (!order) throw fail(404, 'Order not found.');
  return order;
}
const saveOrder = (cfg, order) => S.redis(cfg, [['HSET', ORDERS, order.id, JSON.stringify(order)], ['ZADD', INDEX, Date.parse(order.createdAt), order.id]]);
async function loadSettings(cfg) {
  const [value] = await S.redis(cfg, [['GET', SETTINGS]]);
  return { upiId: '', payeeName: '', instructions: '', qr: '', ...(parse(value) || {}) };
}
async function saveLead(cfg, email, details) {
  if (!S.EMAIL.test(email)) return;
  const [value, count] = await S.redis(cfg, [['HGET', LEADS, email], ['HLEN', LEADS]]);
  const prior = parse(value), now = new Date().toISOString();
  if (!prior && Number(count) >= 20000) return;
  const lead = { email, firstSeen: prior?.firstSeen || now, lastSeen: now, type: prior?.type === 'customer' ? 'customer' : details.type, source: prior?.source || details.source || '', name: details.name || prior?.name || '', city: details.city || prior?.city || '', orders: (prior?.orders || 0) + (details.order ? 1 : 0), subscribed: Boolean(prior?.subscribed || details.subscribed) };
  await S.redis(cfg, [['HSET', LEADS, email, JSON.stringify(lead)]]);
}

function qrAttachment(settings) {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(settings.qr || '');
  return match ? [{ cid: 'payqr', type: 'image/' + match[1], filename: 'payment-qr.' + (match[1] === 'jpeg' ? 'jpg' : 'png'), data: Buffer.from(match[2], 'base64') }] : [];
}

/* ---------- Access ---------- */
async function access(req, input, cfg) {
  const given = req.headers['x-catalogue-secret'];
  if (given) {
    if (S.sameSecret(given, cfg.password)) return 'owner';
    if (!await S.withinLimit(cfg, 'owner-auth:' + S.clientKey(req, cfg.password), 20, 3600)) throw fail(429, 'Too many incorrect attempts. Try again in an hour.');
    throw fail(401, 'Owner password is incorrect.');
  }
  if (input.id && S.sameSecret(input.key, S.sign(cfg.password, 'order:' + input.id))) return 'link';
  throw fail(401, 'Open this order from your alert email, or enter the owner password.');
}
const ownerOnly = level => { if (level !== 'owner') throw fail(401, 'Enter the owner password for this action.'); };

/* ---------- Public actions ---------- */
async function place(req, input, cfg) {
  if (!S.sameOrigin(req)) throw fail(403, 'Place your order on this website.');
  if (JSON.stringify(input).length > 30000) throw fail(413, 'This order is too large. Please split it or contact us.');
  if (input.website) return { ok: true, id: 'TPT-000000-0000' }; // honeypot field filled by a bot
  const customer = cleanCustomer(input.customer), items = cleanItems(input.items, false);
  if (!await S.withinLimit(cfg, 'order:' + S.clientKey(req, cfg.password), 8, 86400)) throw fail(429, 'Too many orders from this connection today. Please message us on WhatsApp.');
  if (!await S.withinLimit(cfg, 'orders-all', 400, 86400)) throw fail(429, 'Ordering is briefly paused. Please message us on WhatsApp.');
  const now = new Date().toISOString();
  const order = totals({ id: newId(), createdAt: now, updatedAt: now, status: 'new', origin: 'website', customer, items, note: S.text(input.note, 1000), ownerNote: '', adjustment: 0, shipping: null, history: [{ at: now, action: 'placed' }], emails: {}, sessionId: /^[-\w]{8,80}$/.test(input.sessionId || '') ? input.sessionId : '', trafficSource: S.text(input.source, 80) });
  // Free domestic shipping above the published threshold is known immediately; anything else is set at confirmation.
  if (customer.country === 'India' && order.subtotal - order.discount >= freeShippingFrom && order.items.every(i => i.lineTotal != null)) { order.shipping = 0; totals(order); }
  await saveOrder(cfg, order);
  await saveLead(cfg, customer.email, { type: 'customer', source: order.trafficSource, name: customer.name, city: customer.city, order: true, subscribed: input.subscribe === true });
  const link = `${S.siteUrl(req)}/orders.html#o=${order.id}&k=${S.sign(cfg.password, 'order:' + order.id)}`;
  const sent = await S.sendMail({ to: S.mailConfig()?.alert, replyTo: customer.email, ...mail.ownerAlert(order, link) });
  order.emails.ownerAlert = sent.ok ? 'sent' : 'failed: ' + sent.error;
  await saveOrder(cfg, order);
  return { ok: true, id: order.id, subtotal: order.subtotal, discount: order.discount, shipping: order.shipping, total: order.total };
}

async function subscribe(req, input, cfg) {
  if (!S.sameOrigin(req)) throw fail(403, 'Sign up on this website.');
  const email = S.text(input.email, 160).toLowerCase();
  if (input.website) return { ok: true };
  if (!S.EMAIL.test(email) || input.consent !== true) throw fail(400, 'Enter a valid email address.');
  if (!await S.withinLimit(cfg, 'lead:' + S.clientKey(req, cfg.password), 6, 86400)) throw fail(429, 'Please try again tomorrow.');
  await saveLead(cfg, email, { type: 'subscriber', source: S.text(input.source, 80), subscribed: true });
  return { ok: true };
}

/* ---------- Owner actions ---------- */
async function notifyCustomer(cfg, order, template, label) {
  if (!order.customer.email) { order.emails[label] = 'skipped: no customer email'; return { ok: false, error: 'This order has no customer email address.' }; }
  const sent = await S.sendMail({ to: order.customer.email, replyTo: S.mailConfig()?.alert, ...template });
  order.emails[label] = sent.ok ? 'sent ' + new Date().toISOString() : 'failed: ' + sent.error;
  return sent;
}

async function confirm(input, cfg) {
  const order = await loadOrder(cfg, input.id);
  if (!['new', 'awaiting_payment'].includes(order.status)) throw fail(409, 'This order is already ' + order.status.replace('_', ' ') + '.');
  const shipping = Number(input.shipping), adjustment = Number(input.adjustment || 0);
  if (!Number.isFinite(shipping) || shipping < 0 || shipping > 100000) throw fail(400, 'Enter the shipping charge (0 for free shipping).');
  if (!Number.isFinite(adjustment) || Math.abs(adjustment) > 1000000) throw fail(400, 'The adjustment amount is invalid.');
  Object.assign(order, { shipping, adjustment, adjustmentLabel: S.text(input.adjustmentLabel, 80), ownerNote: S.text(input.ownerNote, 1000), status: 'awaiting_payment' });
  totals(order); stamp(order, 'confirmed', 'Total ' + S.money(order.total));
  const settings = await loadSettings(cfg), inline = qrAttachment(settings);
  const sent = await notifyCustomerWith(cfg, order, mail.customerConfirm(order, settings, inline.length > 0), 'paymentRequest', inline);
  await saveOrder(cfg, order);
  return { order, mail: sent };
}
async function notifyCustomerWith(cfg, order, template, label, inline) {
  return notifyCustomer(cfg, order, { ...template, inline }, label);
}

async function markPaid(input, cfg) {
  const order = await loadOrder(cfg, input.id);
  if (!['new', 'awaiting_payment'].includes(order.status)) throw fail(409, 'This order is already ' + order.status.replace('_', ' ') + '.');
  if (order.total == null) throw fail(409, 'Confirm the order with a shipping charge before marking it paid.');
  order.status = 'paid'; order.payment = { reference: S.text(input.reference, 120), paidAt: new Date().toISOString() };
  stamp(order, 'paid', order.payment.reference);
  const sent = input.notify === false ? { ok: false, error: 'not requested' } : await notifyCustomer(cfg, order, mail.customerPaid(order), 'paymentReceived');
  await saveOrder(cfg, order);
  // Verified revenue appears in the analytics dashboard only at this point.
  const event = { name: 'order_placed', eventId: 'order-' + order.id, time: order.payment.paidAt, sessionId: order.sessionId || 'order-' + order.id, orderId: order.id, revenue: order.total, productIds: order.items.map(i => i.productId).filter(Boolean), productId: order.items[0]?.productId || '', source: order.trafficSource || (order.origin === 'manual' ? 'manual' : 'direct'), device: 'unknown', path: '/orders', deliveryCity: order.customer.city, deliveryRegion: order.customer.state, deliveryCountry: order.customer.country };
  await S.redis(cfg, [['LPUSH', EVENTS, JSON.stringify(event)], ['LTRIM', EVENTS, 0, 4999]]).catch(() => {});
  return { order, mail: sent };
}

async function markShipped(input, cfg, site) {
  const order = await loadOrder(cfg, input.id);
  if (order.status !== 'paid') throw fail(409, 'Only paid orders can be marked as shipped.');
  order.status = 'shipped'; order.tracking = { courier: S.text(input.courier, 80), number: S.text(input.tracking, 80) };
  stamp(order, 'shipped', [order.tracking.courier, order.tracking.number].filter(Boolean).join(' '));
  const sent = input.notify === false ? { ok: false, error: 'not requested' } : await notifyCustomer(cfg, order, mail.customerShipped(order, site), 'shipped');
  await saveOrder(cfg, order);
  return { order, mail: sent };
}

async function cancel(input, cfg) {
  const order = await loadOrder(cfg, input.id);
  if (['cancelled', 'delivered'].includes(order.status)) throw fail(409, 'This order is already ' + order.status + '.');
  order.status = 'cancelled'; order.cancelReason = S.text(input.reason, 500);
  stamp(order, 'cancelled', order.cancelReason);
  const sent = input.notify === true ? await notifyCustomer(cfg, order, mail.customerCancelled(order), 'cancelled') : { ok: false, error: 'not requested' };
  await saveOrder(cfg, order);
  return { order, mail: sent };
}

async function resend(input, cfg, site) {
  const order = await loadOrder(cfg, input.id), settings = await loadSettings(cfg), inline = qrAttachment(settings);
  const template = { awaiting_payment: () => ({ ...mail.customerConfirm(order, settings, inline.length > 0), inline }), paid: () => mail.customerPaid(order), shipped: () => mail.customerShipped(order, site) }[order.status];
  if (!template) throw fail(409, 'There is no customer email to resend for this status.');
  const sent = await notifyCustomer(cfg, order, template(), 'resent');
  stamp(order, 'email resent'); await saveOrder(cfg, order);
  return { order, mail: sent };
}

async function update(input, cfg) {
  const order = await loadOrder(cfg, input.id);
  if (input.status !== undefined) { if (!STATUSES.includes(input.status)) throw fail(400, 'Unknown status.'); order.status = input.status; }
  if (input.internalNote !== undefined) order.internalNote = S.text(input.internalNote, 1000);
  stamp(order, 'updated', input.status ? 'Status set to ' + input.status.replace('_', ' ') : '');
  await saveOrder(cfg, order);
  return { order };
}

// Adds an order the owner took elsewhere (WhatsApp, Instagram, a stall) so the panel holds every order.
async function create(input, cfg) {
  const customer = cleanCustomer(input.customer, false), items = cleanItems(input.items, true);
  const shipping = input.shipping === '' || input.shipping == null ? null : Number(input.shipping);
  if (shipping != null && (!Number.isFinite(shipping) || shipping < 0 || shipping > 100000)) throw fail(400, 'The shipping charge is invalid.');
  const status = STATUSES.includes(input.status) ? input.status : 'new';
  const placed = /^\d{4}-\d{2}-\d{2}$/.test(input.date || '') ? new Date(input.date + 'T12:00:00+05:30').toISOString() : new Date().toISOString();
  const order = totals({ id: newId(), createdAt: placed, updatedAt: placed, status, origin: 'manual', channel: S.text(input.channel, 40) || 'Manual', customer, items, note: S.text(input.note, 1000), ownerNote: '', adjustment: 0, shipping, history: [{ at: new Date().toISOString(), action: 'added manually' }], emails: {}, sessionId: '', trafficSource: 'manual' });
  if (['paid', 'shipped', 'delivered'].includes(status)) {
    if (order.shipping == null) { order.shipping = 0; totals(order); }
    order.payment = { reference: S.text(input.reference, 120), paidAt: placed };
    const event = { name: 'order_placed', eventId: 'order-' + order.id, time: placed, sessionId: 'order-' + order.id, orderId: order.id, revenue: order.total, productIds: [], productId: '', source: 'manual', device: 'unknown', path: '/orders', deliveryCity: customer.city, deliveryRegion: customer.state, deliveryCountry: customer.country };
    await S.redis(cfg, [['LPUSH', EVENTS, JSON.stringify(event)], ['LTRIM', EVENTS, 0, 4999]]).catch(() => {});
  }
  await saveOrder(cfg, order);
  if (customer.email) await saveLead(cfg, customer.email, { type: 'customer', source: 'manual', name: customer.name, city: customer.city, order: true });
  return { order };
}

async function remove(input, cfg) {
  const order = await loadOrder(cfg, input.id);
  await S.redis(cfg, [['HDEL', ORDERS, order.id], ['ZREM', INDEX, order.id]]);
  return { ok: true };
}

async function saveSettings(input, cfg) {
  const qr = typeof input.qr === 'string' ? input.qr : '';
  if (qr && (qr.length > 420000 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(qr))) throw fail(400, 'Upload the QR code as a PNG or JPG smaller than 300 KB.');
  const upiId = S.text(input.upiId, 80);
  if (upiId && !/^[\w.-]{2,60}@[A-Za-z][\w.-]{1,30}$/.test(upiId)) throw fail(400, 'That UPI ID does not look right (example: name@okhdfcbank).');
  const settings = { upiId, payeeName: S.text(input.payeeName, 80), instructions: S.text(input.instructions, 600), qr };
  await S.redis(cfg, [['SET', SETTINGS, JSON.stringify(settings)]]);
  return { settings };
}

async function listAll(cfg) {
  const [ids, leads, settings] = await Promise.all([
    S.redis(cfg, [['ZREVRANGE', INDEX, 0, 999]]).then(r => r[0] || []),
    S.redis(cfg, [['HVALS', LEADS]]).then(r => (r[0] || []).map(parse).filter(Boolean)),
    loadSettings(cfg)
  ]);
  const orders = ids.length ? (await S.redis(cfg, [['HMGET', ORDERS, ...ids]]))[0].map(parse).filter(Boolean) : [];
  const m = S.mailConfig();
  return { orders, leads: leads.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)), settings, mail: { configured: Boolean(m), sender: m?.user || S.DEFAULT_SENDER, alert: m?.alert || S.DEFAULT_SENDER } };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const cfg = S.config();
  if (!cfg) return res.status(503).json({ error: 'Online ordering is not set up yet. Please order on WhatsApp.' });
  try {
    if (req.method === 'GET') {
      ownerOnly(await access(req, {}, cfg));
      return res.status(200).json(await listAll(cfg));
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const input = S.body(req);
    if (input.action === 'place') return res.status(201).json(await place(req, input, cfg));
    if (input.action === 'subscribe') return res.status(201).json(await subscribe(req, input, cfg));
    const level = await access(req, input, cfg);
    switch (input.action) {
      case 'get': { const order = await loadOrder(cfg, input.id), settings = await loadSettings(cfg); return res.status(200).json({ order, payment: { hasQr: Boolean(settings.qr), upiId: settings.upiId }, mail: { configured: Boolean(S.mailConfig()) } }); }
      case 'confirm': return res.status(200).json(await confirm(input, cfg));
      case 'paid': return res.status(200).json(await markPaid(input, cfg));
      case 'shipped': return res.status(200).json(await markShipped(input, cfg, S.siteUrl(req)));
      case 'cancel': return res.status(200).json(await cancel(input, cfg));
      case 'resend': return res.status(200).json(await resend(input, cfg, S.siteUrl(req)));
      case 'update': ownerOnly(level); return res.status(200).json(await update(input, cfg));
      case 'create': ownerOnly(level); return res.status(201).json(await create(input, cfg));
      case 'delete': ownerOnly(level); return res.status(200).json(await remove(input, cfg));
      case 'settings': ownerOnly(level); return res.status(200).json(await saveSettings(input, cfg));
      case 'test-email': ownerOnly(level); return res.status(200).json({ mail: await S.sendMail({ to: S.mailConfig()?.alert, ...mail.testEmail() }) });
      default: return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message || 'Request failed' });
  }
};
module.exports._test = { cleanCustomer, cleanItems, totals, newId, prices };
