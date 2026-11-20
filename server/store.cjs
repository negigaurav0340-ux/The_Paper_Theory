'use strict';
// Shared helpers for the order, lead and inventory APIs: Redis storage, owner auth,
// signed per-order links and a dependency-free Gmail SMTP mailer.
const crypto = require('node:crypto');
const tls = require('node:tls');

const EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,180}\.[A-Za-z]{2,24}$/;
const DEFAULT_SENDER = 'thepapertheory.in@gmail.com';

function config() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  const password = process.env.CATALOGUE_ADMIN_PASSWORD;
  if (!url || !/^https:\/\//.test(url) || !token || !password) return null;
  return { url: url.replace(/\/$/, ''), token, password };
}

// Runs one or more Redis commands in a single REST pipeline call and returns their results in order.
async function redis(cfg, commands) {
  const response = await fetch(cfg.url + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(result) || result.some(x => x && x.error)) throw Error('Storage is unavailable. Please try again.');
  return result.map(x => x.result);
}

function sameSecret(given, expected) {
  if (typeof given !== 'string' || !given || given.length > 512 || typeof expected !== 'string' || !expected) return false;
  return crypto.timingSafeEqual(crypto.createHash('sha256').update(given).digest(), crypto.createHash('sha256').update(expected).digest());
}
const sign = (password, text) => crypto.createHmac('sha256', password).update(String(text)).digest('hex').slice(0, 40);
const clientKey = (req, password) => crypto.createHmac('sha256', password).update(String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim()).digest('hex').slice(0, 24);

// Counts a hit against a named limit and reports whether the caller is still inside it.
async function withinLimit(cfg, name, max, seconds) {
  const key = 'tpt:limit:' + name + ':' + Math.floor(Date.now() / (seconds * 1000));
  const [count] = await redis(cfg, [['INCR', key], ['EXPIRE', key, seconds]]);
  return Number(count) <= max;
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const text = (value, max = 200) => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/g, '').trim().slice(0, max) : '';
const money = value => value == null ? 'To be confirmed' : '₹' + Number(value).toLocaleString('en-IN');
const istTime = iso => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';

function siteUrl(req) {
  const fixed = process.env.SITE_URL;
  if (fixed && /^https:\/\/[\w.-]+$/.test(fixed)) return fixed;
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '');
  if (/^[\w.-]+(:\d+)?$/.test(host)) return (/^(localhost|127\.)/.test(host) ? 'http://' : 'https://') + host;
  return 'https://thepapertheory.in';
}

function body(req) {
  const value = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid request');
  return value;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === (req.headers['x-forwarded-host'] || req.headers.host); } catch { return false; }
}

/* ---------- Mail ---------- */
function mailConfig() {
  const user = process.env.MAIL_USER || DEFAULT_SENDER;
  const pass = (process.env.MAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  if (!EMAIL.test(user) || !pass) return null;
  const alert = process.env.ORDER_ALERT_EMAIL || user;
  return {
    user, pass,
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    name: header(process.env.MAIL_FROM_NAME || 'The Paper Theory'),
    alert: EMAIL.test(alert) ? alert : user
  };
}
const header = value => String(value ?? '').replace(/[\r\n"<>]/g, ' ').trim().slice(0, 180);
const encodeWord = value => /^[\x20-\x7e]*$/.test(value) ? value : '=?UTF-8?B?' + Buffer.from(value, 'utf8').toString('base64') + '?=';
const wrap64 = buffer => buffer.toString('base64').replace(/(.{76})/g, '$1\r\n');

// Builds a standards-compliant message: text + HTML alternatives, with optional inline images (shown by cid:).
function buildMessage({ from, name, to, replyTo, subject, html, plain, inline = [] }) {
  const boundary = () => 'tpt-' + crypto.randomBytes(12).toString('hex');
  const alt = boundary(), related = boundary();
  const part = (type, content) => `Content-Type: ${type}; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap64(Buffer.from(content, 'utf8'))}\r\n`;
  let content = `Content-Type: multipart/alternative; boundary="${alt}"\r\n\r\n--${alt}\r\n${part('text/plain', plain)}--${alt}\r\n${part('text/html', html)}--${alt}--\r\n`;
  if (inline.length) {
    content = `Content-Type: multipart/related; boundary="${related}"\r\n\r\n--${related}\r\n${content}` + inline.map(file =>
      `--${related}\r\nContent-Type: ${file.type}\r\nContent-Transfer-Encoding: base64\r\nContent-ID: <${file.cid}>\r\nContent-Disposition: inline; filename="${file.filename}"\r\n\r\n${wrap64(file.data)}\r\n`).join('') + `--${related}--\r\n`;
  }
  const headers = [
    `From: "${encodeWord(name)}" <${from}>`,
    `To: <${to}>`,
    ...(replyTo ? [`Reply-To: <${replyTo}>`] : []),
    `Subject: ${encodeWord(header(subject))}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${crypto.randomBytes(16).toString('hex')}@${from.split('@')[1]}>`,
    'MIME-Version: 1.0'
  ];
  return headers.join('\r\n') + '\r\n' + content;
}

// Minimal SMTP-over-TLS client (implicit TLS, AUTH PLAIN). Resolves when the server accepts the message.
function smtpSend(cfg, to, message, connect = tls.connect) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: cfg.host, port: cfg.port, servername: cfg.host, ...(cfg.tlsOptions || {}) });
    const auth = Buffer.from('\u0000' + cfg.user + '\u0000' + cfg.pass).toString('base64');
    const steps = [
      [220, 'EHLO thepapertheory.in'],
      [250, 'AUTH PLAIN ' + auth],
      [235, `MAIL FROM:<${cfg.user}>`],
      [250, `RCPT TO:<${to}>`],
      [250, 'DATA'],
      [354, message.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..') + '\r\n.'],
      [250, 'QUIT']
    ];
    let buffer = '', index = 0, done = false;
    const finish = error => { if (done) return; done = true; clearTimeout(timer); socket.destroy(); error ? reject(error) : resolve(); };
    const timer = setTimeout(() => finish(Error('Mail server timed out')), 9000);
    socket.setEncoding('utf8');
    socket.on('error', error => finish(Error('Mail connection failed: ' + error.message)));
    socket.on('close', () => finish(Error('Mail connection closed early')));
    socket.on('data', chunk => {
      buffer += chunk;
      let match;
      // A reply is complete when a line has the form "NNN text" (a space, not a hyphen, after the code).
      while ((match = buffer.match(/^(?:\d{3}-[^\r\n]*\r?\n)*(\d{3})(?: [^\r\n]*)?\r?\n/))) {
        buffer = buffer.slice(match[0].length);
        const code = Number(match[1]), step = steps[index];
        if (!step) return finish();
        if (code !== step[0]) return finish(Error(index === 2 ? 'Gmail rejected the app password (code ' + code + ')' : 'Mail server refused the message (code ' + code + ')'));
        index++;
        socket.write(step[1] + '\r\n');
        if (index === steps.length) return finish();
      }
    });
  });
}

// Sends one email from the store address. Never throws: returns { ok, error } so an order is never lost to a mail failure.
async function sendMail({ to, subject, html, plain, replyTo, inline }) {
  const cfg = mailConfig();
  if (!cfg) return { ok: false, error: 'Email is not set up yet (add MAIL_APP_PASSWORD in Vercel).' };
  if (!EMAIL.test(to || '')) return { ok: false, error: 'Recipient email address is invalid.' };
  try {
    const message = buildMessage({ from: cfg.user, name: cfg.name, to, replyTo: EMAIL.test(replyTo || '') ? replyTo : '', subject, html, plain, inline });
    await smtpSend(cfg, to, message);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = { EMAIL, DEFAULT_SENDER, config, redis, sameSecret, sign, clientKey, withinLimit, escapeHtml, text, money, istTime, siteUrl, body, sameOrigin, mailConfig, buildMessage, smtpSend, sendMail };
