// Exercises the order, lead and inventory APIs against an in-memory Redis and a fake mail server. No network is used.
const assert = require('node:assert/strict'), { EventEmitter } = require('node:events');
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test'; process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'; process.env.CATALOGUE_ADMIN_PASSWORD = 'owner-password-for-tests';
delete process.env.MAIL_APP_PASSWORD;

/* In-memory stand-in for the Upstash REST pipeline endpoint. */
const db = new Map();
const run = ([cmd, key, ...a]) => {
  switch (cmd) {
    case 'INCR': db.set(key, (db.get(key) || 0) + 1); return db.get(key);
    case 'EXPIRE': return 1;
    case 'GET': return db.get(key) ?? null;
    case 'SET': db.set(key, a[0]); return 'OK';
    case 'HSET': { const h = db.get(key) || new Map(); h.set(a[0], a[1]); db.set(key, h); return 1; }
    case 'HGET': return db.get(key)?.get(a[0]) ?? null;
    case 'HMGET': return a.map(f => db.get(key)?.get(f) ?? null);
    case 'HVALS': return [...(db.get(key)?.values() || [])];
    case 'HLEN': return db.get(key)?.size || 0;
    case 'HDEL': return db.get(key)?.delete(a[0]) ? 1 : 0;
    case 'ZADD': { const z = db.get(key) || new Map(); z.set(a[1], Number(a[0])); db.set(key, z); return 1; }
    case 'ZREM': return db.get(key)?.delete(a[0]) ? 1 : 0;
    case 'ZREVRANGE': return [...(db.get(key) || [])].sort((x, y) => y[1] - x[1]).map(x => x[0]).slice(a[0], a[1] + 1);
    case 'LPUSH': { const l = db.get(key) || []; l.unshift(a[0]); db.set(key, l); return l.length; }
    case 'LTRIM': return 'OK';
    default: throw Error('Unsupported test command ' + cmd);
  }
};
global.fetch = async (url, options) => { assert.equal(url, 'https://redis.test/pipeline'); assert.equal(options.headers.Authorization, 'Bearer test-token'); return { ok: true, json: async () => JSON.parse(options.body).map(c => ({ result: run(c) })) }; };

const S = require('../server/store.cjs'), orders = require('../api/orders'), inventory = require('../api/inventory');
const sentMail = []; S.sendMail = async message => { sentMail.push(message); return { ok: true }; };
const call = async (handler, method, { body, headers = {}, query = {} } = {}) => { let status = 200, json; await handler({ method, body, query, headers: { host: 'thepapertheory.in', 'x-forwarded-for': '203.0.113.9', ...headers } }, { setHeader() {}, status(s) { status = s; return this; }, json(v) { json = v; return v; } }); return { status, body: json }; };
const owner = { 'x-catalogue-secret': 'owner-password-for-tests' };
const customer = { name: 'Asha Verma', phone: '+91 98765 43210', email: 'asha@example.com', house: '12 Lake View', street: 'Mall Road', city: 'Shimla', district: 'Shimla', state: 'Himachal Pradesh', pin: '171001', country: 'India' };

(async () => {
  /* Mail: message structure and the SMTP conversation. */
  const message = S.buildMessage({ from: 'thepapertheory.in@gmail.com', name: 'The Paper Theory', to: 'asha@example.com', replyTo: 'x@example.com', subject: 'Order ₹198\r\nBcc: attacker@example.com', html: '<b>Hi</b>', plain: 'Hi', inline: [{ cid: 'payqr', type: 'image/png', filename: 'qr.png', data: Buffer.from('png') }] });
  const headerBlock = message.split('\r\n\r\n')[0];
  assert(!/^Bcc:/mi.test(headerBlock), 'A line break in a subject must not create a new header');
  assert(message.includes('multipart/related') && message.includes('Content-ID: <payqr>') && message.includes('From: "The Paper Theory" <thepapertheory.in@gmail.com>'));
  const replies = ['220 ready', '250-smtp.test\r\n250 AUTH PLAIN', '235 ok', '250 ok', '250 ok', '354 go', '250 queued'], written = [];
  const fakeConnect = () => { const socket = new EventEmitter(); Object.assign(socket, { setEncoding() {}, destroy() {}, write(data) { written.push(data); setImmediate(() => socket.emit('data', replies.shift() + '\r\n')); } }); setImmediate(() => socket.emit('data', replies.shift() + '\r\n')); return socket; };
  await S.smtpSend({ host: 'smtp.test', port: 465, user: 'thepapertheory.in@gmail.com', pass: 'app-password' }, 'asha@example.com', 'Subject: x\r\n\r\n.leading dot\r\nbody', fakeConnect);
  assert.equal(written[1], 'AUTH PLAIN ' + Buffer.from('\u0000thepapertheory.in@gmail.com\u0000app-password').toString('base64') + '\r\n');
  assert(written[3].startsWith('RCPT TO:<asha@example.com>') && written[5].includes('\r\n..leading dot\r\n') && written[5].endsWith('\r\n.\r\n') && written[6] === 'QUIT\r\n');
  await assert.rejects(S.smtpSend({ host: 'smtp.test', port: 465, user: 'u@example.com', pass: 'bad' }, 'a@example.com', 'x', () => { const socket = new EventEmitter(); const r = ['220 ready', '250 ok', '535 bad credentials']; Object.assign(socket, { setEncoding() {}, destroy() {}, write() { setImmediate(() => socket.emit('data', r.shift() + '\r\n')); } }); setImmediate(() => socket.emit('data', r.shift() + '\r\n')); return socket; }), /app password/);

  /* Placing an order: server prices win over whatever the browser claims. */
  let r = await call(orders, 'POST', { body: { action: 'place', customer, items: [{ type: 'product', productId: 'PACK-GYM-MOTIVATION', variantId: 'REG', quantity: 2, unitPrice: 1, name: 'Tampered' }], sessionId: 'session-12345678', source: 'instagram' }, headers: { origin: 'https://thepapertheory.in' } });
  assert.equal(r.status, 201, JSON.stringify(r.body)); assert.match(r.body.id, /^TPT-\d{6}-[A-Z0-9]{4}$/); assert.equal(r.body.subtotal, 198); assert.equal(r.body.total, null);
  const id = r.body.id, alert = sentMail.at(-1);
  assert.equal(alert.replyTo, 'asha@example.com'); assert(alert.subject.includes(id) && alert.html.includes('Gym Motivation') && !alert.html.includes('Tampered'));
  const key = alert.html.match(/orders\.html#o=TPT-\d{6}-[A-Z0-9]{4}&amp;k=([a-f0-9]{40})/)[1];
  assert.equal(sentMail.length, 1, 'Nothing is emailed to the customer before the owner confirms');
  r = await call(orders, 'POST', { body: { action: 'place', customer: { ...customer, email: '' }, items: [{ type: 'product', productId: 'PACK-GYM-MOTIVATION', variantId: 'REG', quantity: 1 }] } }); assert.equal(r.status, 400);
  r = await call(orders, 'POST', { body: { action: 'place', customer, items: [{ type: 'product', productId: 'PACK-GYM-MOTIVATION', variantId: 'REG', quantity: 1 }] }, headers: { origin: 'https://evil.example' } }); assert.equal(r.status, 403);
  r = await call(orders, 'POST', { body: { action: 'place', customer, items: [{ type: 'product', productId: 'LIT-001', variantId: [...orders._test.prices().get('LIT-001').variants.keys()][0], quantity: 1 }] } }); assert.equal(r.status, 201); assert.equal(r.body.shipping, 0, 'Free shipping applies automatically at ₹699 or more');

  /* Access control. */
  r = await call(orders, 'GET'); assert.equal(r.status, 401);
  r = await call(orders, 'GET', { headers: { 'x-catalogue-secret': 'wrong' } }); assert.equal(r.status, 401);
  r = await call(orders, 'POST', { body: { action: 'get', id, key: 'f'.repeat(40) } }); assert.equal(r.status, 401);
  r = await call(orders, 'POST', { body: { action: 'delete', id, key } }); assert.equal(r.status, 401, 'The email link cannot delete');
  r = await call(orders, 'POST', { body: { action: 'get', id, key } }); assert.equal(r.status, 200); assert.equal(r.body.order.customer.city, 'Shimla');

  /* Confirm → customer gets details and the payment request, with the saved QR attached. */
  r = await call(orders, 'POST', { headers: owner, body: { action: 'settings', upiId: 'papertheory@okaxis', payeeName: 'The Paper Theory', qr: 'data:image/png;base64,iVBORw0KGgo=' } }); assert.equal(r.status, 200);
  r = await call(orders, 'POST', { headers: owner, body: { action: 'settings', upiId: 'not a upi' } }); assert.equal(r.status, 400);
  r = await call(orders, 'POST', { body: { action: 'paid', id, key } }); assert.equal(r.status, 409, 'An order needs a total before it can be paid');
  r = await call(orders, 'POST', { body: { action: 'confirm', id, key, shipping: 50, ownerNote: 'Ships in 2 days.' } });
  assert.equal(r.status, 200); assert.equal(r.body.order.total, 248); assert.equal(r.body.order.status, 'awaiting_payment'); assert(r.body.mail.ok);
  let m = sentMail.at(-1); assert.equal(m.to, 'asha@example.com'); assert(m.html.includes('₹248') && m.html.includes('papertheory@okaxis') && m.html.includes('cid:payqr') && m.html.includes('Ships in 2 days.')); assert.equal(m.inline[0].cid, 'payqr');
  r = await call(orders, 'POST', { body: { action: 'paid', id, key, reference: 'UPI123' } }); assert.equal(r.body.order.status, 'paid'); assert(sentMail.at(-1).subject.includes('Payment received'));
  assert.equal(JSON.parse(db.get('tpt:events:v1')[0]).revenue, 248, 'Paid orders feed verified revenue into analytics');
  r = await call(orders, 'POST', { body: { action: 'confirm', id, key, shipping: 0 } }); assert.equal(r.status, 409);
  r = await call(orders, 'POST', { body: { action: 'shipped', id, key, courier: 'India Post', tracking: 'EH123' } }); assert.equal(r.body.order.status, 'shipped'); assert(sentMail.at(-1).html.includes('EH123'));

  /* Manual orders, visitor emails and the owner list. */
  r = await call(orders, 'POST', { headers: owner, body: { action: 'create', channel: 'Instagram', status: 'paid', date: '2026-11-10', shipping: 40, customer: { name: 'Ravi <script>' }, items: [{ name: 'Anime sticker sheet', option: 'Holographic', quantity: 3, unitPrice: 199 }] } });
  assert.equal(r.status, 201); assert.equal(r.body.order.total, 637); assert.equal(r.body.order.customer.name, 'Ravi script'); assert.equal(r.body.order.origin, 'manual');
  r = await call(orders, 'POST', { body: { action: 'subscribe', email: 'Fan@Example.com', consent: true, source: 'footer' } }); assert.equal(r.status, 201);
  r = await call(orders, 'POST', { body: { action: 'subscribe', email: 'nope', consent: true } }); assert.equal(r.status, 400);
  r = await call(orders, 'GET', { headers: owner }); assert.equal(r.status, 200); assert.equal(r.body.orders.length, 3); assert.equal(r.body.mail.sender, 'thepapertheory.in@gmail.com');
  assert.deepEqual(r.body.leads.map(l => l.email).sort(), ['asha@example.com', 'fan@example.com']); assert.equal(r.body.leads.find(l => l.email === 'asha@example.com').orders, 2);

  /* Inventory: the owner edits; each place sees only its own stock with its own access code. */
  r = await call(inventory, 'GET'); assert.equal(r.status, 401);
  r = await call(inventory, 'GET', { headers: owner }); assert.equal(r.status, 200); assert.equal(r.body.places.length, 2);
  const places = [{ id: 'a', name: 'Campus Cafe', contact: 'Meera', code: 'cafe-2468' }, { id: 'b', name: 'Book Nook', contact: '', code: 'nook-1357' }];
  r = await call(inventory, 'POST', { headers: owner, body: { action: 'save', rev: r.body.rev, places, items: [{ placeId: 'a', name: 'Gym Motivation sheet', price: 99, quantity: 10, sold: 3, givenOn: '2026-11-01' }, { placeId: 'b', name: 'Eren Light Box', price: 999, quantity: 2, sold: 0, givenOn: '2026-11-05' }] } });
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.items.length, 2); assert(r.body.places.every(p => p.hasCode && !('codeHash' in p)));
  r = await call(inventory, 'POST', { headers: owner, body: { action: 'save', rev: 0, places, items: [] } }); assert.equal(r.status, 409, 'A stale editor cannot overwrite newer stock');
  r = await call(inventory, 'POST', { headers: { 'x-place-code': 'cafe-2468' }, body: { action: 'save', rev: 1, places, items: [] } }); assert.equal(r.status, 401, 'A place code cannot edit');
  r = await call(inventory, 'GET', { query: { place: 'a' }, headers: { 'x-place-code': 'cafe-2468' } }); assert.equal(r.status, 200); assert.equal(r.body.items.length, 1); assert.equal(r.body.items[0].name, 'Gym Motivation sheet'); assert.equal(r.body.place.name, 'Campus Cafe');
  r = await call(inventory, 'GET', { query: { place: 'b' }, headers: { 'x-place-code': 'cafe-2468' } }); assert.equal(r.status, 401, 'One place cannot read the other');
  r = await call(inventory, 'POST', { headers: owner, body: { action: 'save', rev: 1, places, items: [{ placeId: 'a', name: 'x', price: -5, quantity: 1, givenOn: '2026-11-01' }] } }); assert.equal(r.status, 400);
  console.log('PASS: mail structure and SMTP dialogue, server-side pricing, owner-confirm-before-customer-email flow, payment QR email, link/owner access limits, manual orders, visitor emails and two-place inventory.');
})().catch(e => { console.error(e); process.exitCode = 1; });
