// Analytics dashboard. Anonymous events come from /api/analytics, real orders and collected emails from /api/orders.
// Without the owner password it falls back to the events recorded in this browser.
(() => {
  'use strict';
  const { esc, money, when, api, csv, setStatus } = window.BO;
  const $ = id => document.getElementById(id);
  const SVG = 'http://www.w3.org/2000/svg';
  const local = () => { try { return JSON.parse(localStorage.getItem('tpt-analytics-v1')) || []; } catch { return []; } };
  const state = { events: local(), orders: null, leads: null, live: false, days: 30 };

  /* ---------- Time helpers (everything is reported in India time) ---------- */
  const istParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' });
  const ist = iso => Object.fromEntries(istParts.formatToParts(new Date(iso)).map(p => [p.type, p.value]));
  const dayKey = iso => { const p = ist(iso); return `${p.year}-${p.month}-${p.day}`; };
  const shiftDay = (key, n) => new Date(Date.parse(key + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const shortDate = key => new Date(key + 'T12:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const longDate = key => new Date(key + 'T12:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hourLabel = h => `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`;
  const pct = (n, d) => d ? (n / d * 100).toFixed(n / d < 0.1 ? 1 : 0) + '%' : '0%';
  const productName = id => window.CATALOGUE?.products.find(p => p.id === id)?.name || id;

  /* ---------- Tooltip (values are written with textContent, never as HTML) ---------- */
  const tip = $('tip');
  function showTip(event, title, rows) {
    tip.replaceChildren(Object.assign(document.createElement('b'), { textContent: title }), ...rows.map(([label, value]) => { const row = document.createElement('div'); row.append(Object.assign(document.createElement('strong'), { textContent: value }), Object.assign(document.createElement('span'), { textContent: label })); return row; }));
    tip.hidden = false;
    const box = tip.getBoundingClientRect(), x = Math.min(innerWidth - box.width - 8, Math.max(8, event.clientX + 14)), y = event.clientY + 18 + box.height > innerHeight ? event.clientY - box.height - 12 : event.clientY + 18;
    tip.style.left = x + 'px'; tip.style.top = Math.max(8, y) + 'px';
  }
  const hideTip = () => { tip.hidden = true; };

  /* ---------- Small renderers ---------- */
  function barList(id, rows, empty, unit = '') {
    const node = $(id), max = Math.max(1, ...rows.map(r => r[1]));
    node.innerHTML = rows.length ? rows.map(([label, n]) => `<div class="bar-item"><span class="label" title="${esc(label)}">${esc(label)}</span><span class="value">${n.toLocaleString('en-IN')}${unit}</span><span class="track"><span class="fill" style="width:${Math.max(2, n / max * 100)}%"></span></span></div>`).join('') : `<p class="muted small">${esc(empty)}</p>`;
  }
  const top = (map, n = 8) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n);
  const tally = (list, fn) => { const m = new Map(); for (const x of list) { const k = fn(x); if (k) m.set(k, (m.get(k) || 0) + 1); } return m; };
  const sessionsOf = list => new Set(list.map(e => e.sessionId).filter(Boolean));
  function delta(id, now, before, { suffix = 'vs previous period', money: isMoney } = {}) {
    const node = $(id);
    if (!before) { node.textContent = now ? 'New this period' : 'No change'; node.className = ''; return; }
    const change = (now - before) / before * 100, up = change >= 0;
    node.innerHTML = `<span class="${up ? 'delta-up' : 'delta-down'}">${up ? '▲' : '▼'} ${Math.abs(change).toFixed(0)}%</span> ${esc(suffix)} (${isMoney ? money(before) : before.toLocaleString('en-IN')})`;
  }

  /* ---------- Charts ---------- */
  const el = (name, attrs = {}, text) => { const n = document.createElementNS(SVG, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text != null) n.textContent = text; return n; };
  const niceMax = v => { if (v <= 4) return 4; const p = 10 ** Math.floor(Math.log10(v)), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };

  // Shared frame: recessive grid, y ticks, first/middle/last date labels. Returns scales for the marks.
  function frame(svg, daily, maxValue, height) {
    const W = 900, H = height, left = 34, right = 12, topPad = 10, bottom = 24, max = niceMax(maxValue);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.replaceChildren();
    const x = i => left + (daily.length === 1 ? (W - left - right) / 2 : i * (W - left - right) / (daily.length - 1)), y = v => topPad + (H - topPad - bottom) * (1 - v / max);
    for (const t of [0, max / 2, max]) { svg.append(el('line', { class: t ? 'grid' : 'axis', x1: left, x2: W - right, y1: y(t), y2: y(t) }), el('text', { x: left - 6, y: y(t) + 4, 'text-anchor': 'end' }, Number.isInteger(t) ? t : t.toFixed(1))); }
    const ticks = [...new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1])];
    ticks.forEach((i, n) => svg.append(el('text', { x: x(i), y: H - 6, 'text-anchor': n === 0 ? 'start' : n === ticks.length - 1 ? 'end' : 'middle' }, shortDate(daily[i].date))));
    return { W, H, left, right, topPad, bottom, x, y };
  }
  // One hover layer per chart: a crosshair snaps to the nearest day and the tooltip lists that day's numbers.
  function hover(svg, daily, f, rows) {
    const cross = el('line', { class: 'cross', y1: f.topPad, y2: f.H - f.bottom, visibility: 'hidden' }), hit = el('rect', { x: f.left, y: 0, width: f.W - f.left - f.right, height: f.H, fill: 'transparent' });
    svg.append(cross, hit);
    const move = event => { const box = svg.getBoundingClientRect(), px = (event.clientX - box.left) / box.width * f.W, i = Math.max(0, Math.min(daily.length - 1, Math.round((px - f.left) / ((f.W - f.left - f.right) / Math.max(1, daily.length - 1))))); cross.setAttribute('x1', f.x(i)); cross.setAttribute('x2', f.x(i)); cross.setAttribute('visibility', 'visible'); showTip(event, longDate(daily[i].date), rows(daily[i])); };
    hit.addEventListener('pointermove', move); hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); hideTip(); });
  }
  const dayRows = d => [['visitors', d.visitors], ['product views', d.views], ['added to bag', d.carts], ['checkouts started', d.checkouts], ['orders placed', d.orders], ...(d.revenue ? [['paid revenue', money(d.revenue)]] : [])];

  function drawVisitors(daily) {
    const svg = $('visitorChart'), f = frame(svg, daily, Math.max(...daily.map(d => d.visitors)), 220);
    svg.append(el('polyline', { class: 'line', points: daily.map((d, i) => `${f.x(i)},${f.y(d.visitors)}`).join(' ') }));
    if (daily.length <= 31) daily.forEach((d, i) => svg.append(el('circle', { class: 'dot', cx: f.x(i), cy: f.y(d.visitors), r: 4 })));
    // Label only the peak day so the busiest moment is readable without hovering.
    const peak = daily.reduce((a, d, i) => d.visitors > a.v ? { v: d.visitors, i } : a, { v: 0, i: 0 });
    if (peak.v) svg.append(el('text', { x: Math.min(f.W - 40, Math.max(f.left + 30, f.x(peak.i))), y: Math.max(10, f.y(peak.v) - 8), 'text-anchor': 'middle', style: 'font-weight:700;fill:#1f211c' }, `${peak.v} on ${shortDate(daily[peak.i].date)}`));
    hover(svg, daily, f, dayRows);
  }
  function drawOrders(daily) {
    const svg = $('orderChart'), f = frame(svg, daily, Math.max(...daily.map(d => d.orders)), 140), slot = (f.W - f.left - f.right) / Math.max(1, daily.length), width = Math.max(2, Math.min(24, slot - 2));
    daily.forEach((d, i) => { if (!d.orders) return; const top = f.y(d.orders), h = f.H - f.bottom - top, r = Math.min(4, width / 2, h); svg.append(el('path', { class: 'bar', d: `M${f.x(i) - width / 2},${top + h}V${top + r}q0,-${r} ${r},-${r}h${width - 2 * r}q${r},0 ${r},${r}V${top + h}Z` })); });
    if (!daily.some(d => d.orders)) svg.append(el('text', { x: f.W / 2, y: f.H / 2, 'text-anchor': 'middle' }, 'No orders placed in this period yet'));
    hover(svg, daily, f, dayRows);
  }

  const HEAT = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#104281'];
  function drawHeat(events) {
    const grid = WEEKDAYS.map(() => Array(24).fill(0)); let max = 0, total = 0;
    for (const e of events) { if (e.name !== 'page_view') continue; const p = ist(e.time), d = WEEKDAYS.indexOf(p.weekday), h = Number(p.hour); if (d < 0) continue; max = Math.max(max, ++grid[d][h]); total++; }
    const node = $('heat'); node.replaceChildren(document.createElement('b'));
    for (let h = 0; h < 24; h++) node.append(Object.assign(document.createElement('span'), { className: 'hour', textContent: h % 6 === 0 ? hourLabel(h) : '' }));
    grid.forEach((row, d) => { node.append(Object.assign(document.createElement('b'), { textContent: WEEKDAYS[d] })); row.forEach((n, h) => { const cell = document.createElement('span'); cell.dataset.n = n; if (n) cell.style.background = HEAT[Math.min(HEAT.length - 1, Math.floor((n - 1) / max * HEAT.length))]; cell.setAttribute('aria-label', `${WEEKDAYS[d]} ${hourLabel(h)}: ${n} page views`); cell.addEventListener('pointermove', event => showTip(event, `${WEEKDAYS[d]}, ${hourLabel(h)}–${hourLabel((h + 1) % 24)}`, [['page views', n]])); cell.addEventListener('pointerleave', hideTip); node.append(cell); }); });
    $('heatScale').innerHTML = HEAT.map(c => `<i style="background:${c}"></i>`).join('');
    const slots = grid.flatMap((row, d) => row.map((n, h) => ({ n, d, h }))).filter(s => s.n).sort((a, b) => b.n - a.n).slice(0, 3);
    $('heatNote').textContent = total ? 'Busiest: ' + slots.map(s => `${WEEKDAYS[s.d]} ${hourLabel(s.h)} (${s.n})`).join(', ') + '.' : 'No visits recorded in this period yet.';
    return slots;
  }

  /* ---------- Main render ---------- */
  function render() {
    const today = dayKey(new Date());
    if (!$('dateTo').value) $('dateTo').value = today;
    if (!$('dateFrom').value) $('dateFrom').value = shiftDay(today, -(state.days - 1));
    const start = $('dateFrom').value, end = $('dateTo').value, span = Math.round((Date.parse(end) - Date.parse(start)) / 864e5) + 1;
    if (!start || !end || start > end || span > 366) return setStatus($('rangeStatus'), 'Choose a valid range of up to 366 days.', 'error');
    const prevStart = shiftDay(start, -span), prevEnd = shiftDay(start, -1);
    const all = [...new Map(state.events.map((e, i) => [e.eventId || 'legacy-' + i, e])).values()].filter(e => e.time);
    const within = (list, a, b, at = e => e.time) => list.filter(x => { const k = dayKey(at(x)); return k >= a && k <= b; });
    const events = within(all, start, end), before = within(all, prevStart, prevEnd);
    $('rangeStatus').className = 'hint'; $('rangeStatus').textContent = `${longDate(start)} to ${longDate(end)} · ${events.length.toLocaleString('en-IN')} events${state.live ? '' : ' (this browser only)'} · compared with the ${span} days before`;

    // Orders: the orders panel is the source of truth when loaded; otherwise fall back to anonymous events.
    const live = state.orders, placedIn = (a, b) => live ? within(live.filter(o => o.status !== 'cancelled'), a, b, o => o.createdAt) : within(all.filter(e => e.name === 'order_submitted'), a, b);
    const paidIn = (a, b) => live ? within(live.filter(o => o.payment?.paidAt && o.status !== 'cancelled'), a, b, o => o.payment.paidAt).map(o => ({ time: o.payment.paidAt, revenue: o.total || 0 })) : within(all.filter(e => e.name === 'order_placed'), a, b).map(e => ({ time: e.time, revenue: Number(e.revenue || 0) }));
    const placed = placedIn(start, end), placedBefore = placedIn(prevStart, prevEnd), paid = paidIn(start, end), paidBefore = paidIn(prevStart, prevEnd);
    const sum = list => list.reduce((s, x) => s + x.revenue, 0), count = (list, name) => list.filter(e => e.name === name).length;
    const visitors = sessionsOf(events).size, visitorsBefore = sessionsOf(before).size, revenue = sum(paid), revenueBefore = sum(paidBefore);

    $('kVisitors').textContent = visitors.toLocaleString('en-IN'); delta('dVisitors', visitors, visitorsBefore);
    $('kOrders').textContent = placed.length; delta('dOrders', placed.length, placedBefore.length);
    $('kRevenue').textContent = money(revenue); delta('dRevenue', revenue, revenueBefore, { money: true });
    $('kRate').textContent = pct(placed.length, visitors); $('dRate').textContent = visitors ? `${placed.length} order${placed.length === 1 ? '' : 's'} from ${visitors} visitors` : 'No visitors yet';
    $('kViews').textContent = count(events, 'product_view').toLocaleString('en-IN'); delta('dViews', count(events, 'product_view'), count(before, 'product_view'));
    $('kCarts').textContent = count(events, 'add_to_cart'); delta('dCarts', count(events, 'add_to_cart'), count(before, 'add_to_cart'));
    $('kAov').textContent = money(paid.length ? Math.round(revenue / paid.length) : 0); $('dAov').textContent = `${paid.length} paid order${paid.length === 1 ? '' : 's'}`;
    $('kLeads').textContent = state.leads ? state.leads.length : '–'; $('dLeads').textContent = state.leads ? `${state.leads.filter(l => l.type === 'customer').length} customers · ${state.leads.filter(l => l.type !== 'customer').length} sign-ups` : 'Load live data to see';

    // Daily series
    const days = new Map(); for (let i = 0; i < span; i++) days.set(shiftDay(start, i), { sessions: new Set(), views: 0, carts: 0, checkouts: 0, orders: 0, revenue: 0 });
    for (const e of events) { const d = days.get(dayKey(e.time)); if (!d) continue; if (e.sessionId) d.sessions.add(e.sessionId); if (e.name === 'product_view') d.views++; if (e.name === 'add_to_cart') d.carts++; if (e.name === 'checkout_started') d.checkouts++; }
    for (const o of placed) { const d = days.get(dayKey(o.createdAt || o.time)); if (d) d.orders++; }
    for (const p of paid) { const d = days.get(dayKey(p.time)); if (d) d.revenue += p.revenue; }
    const daily = [...days].map(([date, d]) => ({ date, visitors: d.sessions.size, views: d.views, carts: d.carts, checkouts: d.checkouts, orders: d.orders, revenue: d.revenue }));
    drawVisitors(daily); drawOrders(daily);
    $('orderChartNote').textContent = live ? 'Every order in your orders panel, by the day it was placed (cancelled orders left out).' : 'Orders submitted through the website checkout in this browser. Load live data for all orders.';
    $('dailyRows').innerHTML = [...daily].reverse().map(d => `<tr><td>${esc(longDate(d.date))}</td><td class="num">${d.visitors}</td><td class="num">${d.views}</td><td class="num">${d.carts}</td><td class="num">${d.checkouts}</td><td class="num">${d.orders}</td><td class="num">${d.revenue ? money(d.revenue) : '–'}</td></tr>`).join('');

    // Funnel (unique sessions per step; the last two steps count orders)
    const reached = names => sessionsOf(events.filter(e => names.includes(e.name))).size;
    const steps = [['Visited the site', visitors], ['Viewed a product', reached(['product_view'])], ['Added to bag', reached(['add_to_cart', 'buy_now_clicked'])], ['Started checkout', reached(['checkout_started', 'whatsapp_clicked', 'order_submitted'])], ['Placed an order', placed.length], ['Paid', paid.length]];
    const widest = Math.max(1, steps[0][1]);
    $('funnel').innerHTML = steps.map(([label, n], i) => `<div class="funnel-row"><span>${label}</span><span class="track"><span class="fill" style="width:${Math.max(n ? 4 : 0, n / widest * 100)}%">${n ? n.toLocaleString('en-IN') : ''}</span></span><span class="drop">${n ? '' : '0 · '}${i ? (steps[i - 1][1] ? pct(n, steps[i - 1][1]) + ' continued' : '–') : 'everyone'}</span></div>`).join('');

    // Breakdowns
    const views = events.filter(e => e.name === 'page_view');
    const sources = tally(views, e => e.source || 'direct'), devices = tally(views, e => e.device || 'unknown');
    barList('sourceReport', top(sources), 'No visits recorded in this period.', ' views');
    barList('deviceReport', top(devices), 'No visits recorded in this period.', ' views');
    barList('pageReport', top(tally(views, e => e.path || '/')), 'No page views in this period.');
    const uniqueBy = fn => { const m = new Map(); for (const e of events) { const k = fn(e); if (!k || !e.sessionId) continue; (m.get(k) || m.set(k, new Set()).get(k)).add(e.sessionId); } return new Map([...m].map(([k, s]) => [k, s.size])); };
    barList('locationReport', top(uniqueBy(e => [e.city, e.region, e.country].filter(Boolean).join(', ')), 6), 'Locations appear for live visits when the host provides them.', ' visitors');
    barList('deliveryReport', top(uniqueBy(e => [e.deliveryCity, e.deliveryRegion].filter(Boolean).join(', ')), 6), 'No checkouts with a delivery city yet.', ' checkouts');
    barList('campaignReport', top(uniqueBy(e => e.campaign)), 'Add utm_campaign to the links you share to compare campaigns here.', ' visitors');
    const productViews = tally(events.filter(e => e.name === 'product_view'), e => e.productId), productCarts = tally(events.filter(e => e.name === 'add_to_cart'), e => e.productId);
    const products = top(productViews, 8).map(([id, n]) => ({ id, name: productName(id), views: n, carts: productCarts.get(id) || 0 }));
    $('productRows').innerHTML = products.length ? products.map(p => `<tr><td>${esc(p.name)}</td><td class="num">${p.views}</td><td class="num">${p.carts}</td><td class="num">${pct(p.carts, p.views)}</td></tr>`).join('') : '<tr><td colspan="4" class="muted">No product views in this period.</td></tr>';
    const slots = drawHeat(events);

    // Recent orders and journeys
    $('orderFeed').innerHTML = live ? (live.length ? `<div class="table-wrap"><table><thead><tr><th>Order</th><th>Placed</th><th>Customer</th><th>Status</th><th class="num">Total</th></tr></thead><tbody>${live.slice(0, 8).map(o => `<tr><td><b>${esc(o.id)}</b></td><td>${esc(when(o.createdAt))}</td><td>${esc(o.customer.name)}${o.customer.city ? ' · ' + esc(o.customer.city) : ''}</td><td><span class="badge ${esc(o.status)}">${esc(o.status.replace('_', ' '))}</span></td><td class="num">${money(o.total ?? o.subtotal)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No orders yet. The first one will appear here and in your inbox.</div>') : '<div class="empty">Load live data with the owner password to see your orders here.</div>';
    const journeys = new Map(); for (const e of events) { if (!e.sessionId) continue; const j = journeys.get(e.sessionId) || { last: e.time, pages: new Set(), source: e.source, device: e.device, steps: new Set() }; if (e.time > j.last) j.last = e.time; if (e.name === 'page_view') j.pages.add(e.path); else j.steps.add(e.name.replaceAll('_', ' ')); journeys.set(e.sessionId, j); }
    $('sessionReport').innerHTML = journeys.size ? `<table><thead><tr><th>Last seen</th><th>Came from</th><th>Device</th><th>Pages</th><th>What they did</th></tr></thead><tbody>${[...journeys.values()].sort((a, b) => b.last.localeCompare(a.last)).slice(0, 40).map(j => `<tr><td>${esc(when(j.last))}</td><td>${esc(j.source || 'direct')}</td><td>${esc(j.device || '')}</td><td class="wrap">${esc([...j.pages].slice(0, 4).join(', ') || '–')}</td><td class="wrap">${esc([...j.steps].slice(0, 6).join(', ') || 'looked around')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">No visits in this period.</p>';

    renderTips({ span, visitors, steps, sources, devices, products, placed, paid, slots, views: views.length });
    state.filtered = [...events].sort((a, b) => b.time.localeCompare(a.time));
  }

  /* ---------- Suggestions drawn from the numbers ---------- */
  function renderTips(d) {
    const tips = [], [, viewed, carted, checkout] = d.steps.map(s => s[1]), perDay = d.visitors / d.span;
    if (!state.live) tips.push(['Load live data first', 'You are looking at this browser only. Enter the owner password above to see every visitor and your real orders.']);
    if (state.live && d.visitors === 0) tips.push(['No visits recorded in this period', 'Either nobody came, or live analytics storage is not connected. Open the shop in a private window, click around, then refresh this page: your visit should appear within a minute.']);
    if (d.visitors > 0 && perDay < 15) tips.push([`Traffic is the main gap: about ${perDay < 1 ? 'under 1' : Math.round(perDay)} visitor${Math.round(perDay) === 1 ? '' : 's'} a day`, `Small online shops usually need tens of visitors for each order, so with ${d.visitors} visitors in ${d.span} days few orders is expected, not a sign the shop is broken. Put the shop link in your Instagram bio and every reel caption, and share product-page links (not just the homepage) on WhatsApp status.`]);
    const direct = d.sources.get('direct') || 0;
    if (d.views > 10 && direct / d.views > 0.7) tips.push([`${pct(direct, d.views)} of visits show as “direct”`, 'You cannot tell which post or story brought them. Add ?utm_source=instagram&utm_campaign=name-of-post to every link you share and this page will name the source.']);
    if (d.visitors >= 10 && viewed / d.visitors < 0.4) tips.push([`Only ${pct(viewed, d.visitors)} of visitors open a product`, 'Most people leave from the homepage. Lead with your best-selling ₹99 sheets and their prices at the very top, and link Instagram posts straight to the product they show.']);
    if (viewed >= 10 && carted / viewed < 0.1) tips.push([`${pct(carted, viewed)} of product viewers add to bag`, 'People look but do not commit. Show the shipping charge and delivery time on the product itself, add real photos of the printed stickers in hand or on a laptop, and ask early buyers for reviews.']);
    if (carted >= 5 && checkout / carted < 0.5) tips.push([`${carted - checkout} of ${carted} shoppers with a bag never start checkout`, 'State the exact shipping charge inside the bag instead of “calculated at confirmation”. Not knowing the final price is the most common reason to stop here.']);
    if (checkout >= 3 && d.placed.length / checkout < 0.5) tips.push([`${checkout - d.placed.length} of ${checkout} checkouts were not completed`, 'The delivery form asks for ten fields. Consider dropping District and Landmark, and tell shoppers on that screen that they pay only after you confirm.']);
    const stuck = d.products.find(p => p.views >= 8 && p.carts === 0);
    if (stuck) tips.push([`“${stuck.name}” gets views but no bag adds`, `${stuck.views} views and nobody added it. Check its price against similar items, its first photo, and whether the size is clear.`]);
    const mobile = d.devices.get('mobile') || 0;
    if (d.views > 10 && mobile / d.views > 0.6) tips.push([`${pct(mobile, d.views)} of visits are on phones`, 'Test every change on your own phone first: open a product, add to bag and place a test order with one hand.']);
    if (d.slots.length && d.views > 20) tips.push([`Your busiest time is ${WEEKDAYS[d.slots[0].d]} around ${hourLabel(d.slots[0].h)}`, 'Post reels and stories shortly before that hour, and be ready to confirm orders quickly then.']);
    const waiting = (state.orders || []).filter(o => o.status === 'new' && Date.now() - Date.parse(o.createdAt) > 6 * 36e5);
    if (waiting.length) tips.push([`${waiting.length} order${waiting.length === 1 ? ' has' : 's have'} waited over 6 hours for your confirmation`, 'Buyers cool off fast. Open the orders panel and confirm or cancel them now.']);
    const unpaid = (state.orders || []).filter(o => o.status === 'awaiting_payment' && Date.now() - Date.parse(o.updatedAt) > 24 * 36e5);
    if (unpaid.length) tips.push([`${unpaid.length} confirmed order${unpaid.length === 1 ? ' is' : 's are'} still unpaid after a day`, 'Send a friendly WhatsApp reminder from the orders panel; the payment email may be sitting in spam.']);
    if (state.leads && state.leads.length === 0 && d.visitors > 20) tips.push(['No emails collected yet', 'The “New drops, first” sign-up sits in the footer. Mention it in a story, or offer early access to the next pack for subscribers.']);
    if (!tips.length) tips.push(['Nothing urgent in these numbers', 'Keep sharing product links and check back after your next post.']);
    $('tips').innerHTML = tips.slice(0, 6).map(([title, body]) => `<li><b>${esc(title)}</b>${esc(body)}</li>`).join('');
  }

  // A fixed checklist from reviewing the storefront; it does not depend on the data above.
  $('checklist').innerHTML = [
    ['Show the shipping charge up front', 'Below ₹699 the shop says shipping is “calculated at confirmation”. Pick a flat rate (for example one price for all of India) and show it in the bag, so the total is known before ordering.'],
    ['Put dispatch time and your damage policy where buyers decide', 'The ordering guide says dispatch takes 2–4 business days, but the product pages and the bag do not. Add that line there, with a plain sentence on what happens if something arrives damaged.'],
    ['Add real photos and first reviews', 'Photograph printed sheets in hand, on a laptop and on a bottle. Ask your first customers and friends who bought to leave a review with a photo; the review system is already built in.'],
    ['Answer new orders within the hour', 'Orders now reach your inbox with a confirm button. A fast payment email is the difference between a paid order and a forgotten one.'],
    ['Send people to products, not the homepage', 'Each product has its own page (products/…). Use those links under the matching reel, with utm tags, so visitors land on what they just saw.'],
    ['Give a reason to order today', 'A bundle, for example any 3 sheets for a set price, lifts order value more than a discount on a single ₹99 sheet, and gets shoppers closer to the ₹699 free-shipping line.']
  ].map(([title, body]) => `<li><b>${esc(title)}</b>${esc(body)}</li>`).join('');

  /* ---------- Loading and controls ---------- */
  async function load() {
    setStatus($('status'), 'Loading live data…');
    const data = await api('/api/analytics');
    state.events = data.events || []; state.live = true;
    try { const shop = await api('/api/orders'); state.orders = shop.orders; state.leads = shop.leads; } catch { state.orders = null; state.leads = null; }
    $('signin').hidden = true; $('dataMode').textContent = 'Live'; $('dataMode').className = 'mode live';
    $('modeNote').textContent = `Showing the latest ${state.events.length.toLocaleString('en-IN')} anonymous events from all visitors (the newest 5,000 are kept)${state.orders ? ', plus your real orders and collected emails' : ''}.`;
    setStatus($('status'), ''); render();
  }
  $('signin').addEventListener('submit', async event => {
    event.preventDefault(); const value = $('analyticsPassword').value.trim(); if (!value) return setStatus($('status'), 'Enter the owner password.', 'error');
    window.BO.remember(value);
    try { await load(); } catch (error) { if (error.status === 401) window.BO.remember(''); state.live = false; setStatus($('status'), error.message + ' Showing this browser only.', 'error'); render(); }
  });
  $('periods').addEventListener('click', event => { const b = event.target.closest('[data-days]'); if (!b) return; state.days = Number(b.dataset.days); $('periods').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); $('dateFrom').value = ''; $('dateTo').value = ''; render(); });
  for (const id of ['dateFrom', 'dateTo']) $(id).addEventListener('change', () => { $('periods').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', 'false')); render(); });
  $('refreshAdmin').addEventListener('click', () => state.live ? load().catch(error => setStatus($('status'), error.message, 'error')) : (state.events = local(), render()));
  $('exportAnalytics').addEventListener('click', () => { const fields = ['time', 'name', 'sessionId', 'source', 'firstSource', 'device', 'path', 'productId', 'variantId', 'itemCount', 'value', 'city', 'region', 'country', 'deliveryCity', 'deliveryRegion', 'deliveryCountry', 'medium', 'campaign', 'surface', 'orderId', 'revenue']; csv('the-paper-theory-analytics.csv', fields, (state.filtered || []).map(e => fields.map(k => e[k] ?? ''))); });
  addEventListener('storage', event => { if (!state.live && event.key === 'tpt-analytics-v1') { state.events = local(); render(); } });
  addEventListener('scroll', hideTip, { passive: true });

  render();
  if (window.BO.password()) load().catch(error => { if (error.status === 401) window.BO.remember(''); setStatus($('status'), error.message + ' Showing this browser only.', 'error'); });
})();
