'use strict';
// Stock placed with partner shops ("places").
//   Owner (x-catalogue-secret): read everything, save places and items.
//   A place (x-place-code + ?place=a|b): read-only view of its own items.
const crypto = require('node:crypto');
const S = require('../server/store.cjs');

const KEY = 'tpt:inventory:v1';
const PLACE_IDS = ['a', 'b'];
const fail = (status, message) => Object.assign(Error(message), { status });
const empty = () => ({ rev: 0, updatedAt: '', places: PLACE_IDS.map((id, i) => ({ id, name: 'Place ' + (i + 1), contact: '', codeHash: '' })), items: [] });
const codeHash = (password, placeId, code) => S.sign(password, 'place:' + placeId + ':' + code);

async function load(cfg) {
  const [value] = await S.redis(cfg, [['GET', KEY]]);
  try { return { ...empty(), ...JSON.parse(value) }; } catch { return empty(); }
}
const publicPlace = place => ({ id: place.id, name: place.name, contact: place.contact, hasCode: Boolean(place.codeHash) });
const forOwner = state => ({ rev: state.rev, updatedAt: state.updatedAt, places: state.places.map(publicPlace), items: state.items });

function cleanItems(input) {
  if (!Array.isArray(input) || input.length > 1000) throw fail(400, 'Too many inventory rows.');
  return input.map(raw => {
    const name = S.text(raw?.name, 120), price = Number(raw?.price), quantity = Number(raw?.quantity), sold = Number(raw?.sold || 0);
    if (!PLACE_IDS.includes(raw?.placeId)) throw fail(400, 'Choose a place for every product.');
    if (!name) throw fail(400, 'Every product needs a name.');
    if (!Number.isFinite(price) || price < 0 || price > 1000000) throw fail(400, `Enter a valid price for "${name}".`);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100000) throw fail(400, `Enter a whole-number quantity for "${name}".`);
    if (!Number.isInteger(sold) || sold < 0 || sold > quantity) throw fail(400, `Sold count for "${name}" must be between 0 and the quantity given.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.givenOn || '') || Number.isNaN(Date.parse(raw.givenOn))) throw fail(400, `Choose the date "${name}" was given.`);
    return { id: /^[a-f0-9]{12}$/.test(raw.id || '') ? raw.id : crypto.randomBytes(6).toString('hex'), placeId: raw.placeId, name, price, quantity, sold, givenOn: raw.givenOn, note: S.text(raw.note, 240) };
  });
}

async function save(input, cfg) {
  const state = await load(cfg);
  if (input.rev !== state.rev) throw fail(409, 'The inventory changed since you opened it. Reload, then make your change again.');
  if (!Array.isArray(input.places)) throw fail(400, 'Invalid places.');
  const places = state.places.map(place => {
    const next = input.places.find(p => p?.id === place.id) || {}, code = typeof next.code === 'string' ? next.code.trim() : '';
    if (code && (code.length < 6 || code.length > 64)) throw fail(400, 'Access codes need 6 to 64 characters.');
    return { id: place.id, name: S.text(next.name, 80) || place.name, contact: S.text(next.contact, 120), codeHash: code ? codeHash(cfg.password, place.id, code) : place.codeHash };
  });
  const next = { rev: state.rev + 1, updatedAt: new Date().toISOString(), places, items: cleanItems(input.items) };
  await S.redis(cfg, [['SET', KEY, JSON.stringify(next)]]);
  return forOwner(next);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const cfg = S.config();
  if (!cfg) return res.status(503).json({ error: 'Inventory storage is not set up yet.' });
  try {
    const secret = req.headers['x-catalogue-secret'], owner = S.sameSecret(secret, cfg.password);
    if (secret && !owner) {
      if (!await S.withinLimit(cfg, 'owner-auth:' + S.clientKey(req, cfg.password), 20, 3600)) throw fail(429, 'Too many incorrect attempts. Try again in an hour.');
      throw fail(401, 'Owner password is incorrect.');
    }
    if (req.method === 'GET') {
      const state = await load(cfg);
      if (owner) return res.status(200).json(forOwner(state));
      const place = state.places.find(p => p.id === req.query?.place), code = req.headers['x-place-code'];
      if (!place || typeof code !== 'string' || !code) throw fail(401, 'Enter the access code you were given.');
      if (!await S.withinLimit(cfg, 'place-auth:' + S.clientKey(req, cfg.password), 30, 3600)) throw fail(429, 'Too many attempts. Try again in an hour.');
      if (!place.codeHash || !S.sameSecret(codeHash(cfg.password, place.id, code.trim()), place.codeHash)) throw fail(401, 'That access code is not correct.');
      return res.status(200).json({ place: { name: place.name }, updatedAt: state.updatedAt, items: state.items.filter(i => i.placeId === place.id).map(({ name, price, quantity, sold, givenOn, note }) => ({ name, price, quantity, sold, givenOn, note })) });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!owner) throw fail(401, 'Only the owner can change inventory.');
    const input = S.body(req);
    if (input.action !== 'save') return res.status(400).json({ error: 'Unknown action' });
    return res.status(200).json(await save(input, cfg));
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message || 'Request failed' });
  }
};
