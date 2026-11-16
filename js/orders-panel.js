// Orders panel: list, confirm, mark paid/shipped, add manual orders, payment settings and visitor emails.
(() => {
  'use strict';
  const { esc, money, when, day, api, csv, setStatus } = window.BO;
  const $ = id => document.getElementById(id);
  const LABEL = { new: 'New', awaiting_payment: 'Awaiting payment', paid: 'Paid', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
  const state = { orders: [], leads: [], settings: {}, mail: {}, filter: 'open', open: new Set(), link: null, qr: undefined };
  const hash = new URLSearchParams(location.hash.slice(1));
  if (/^TPT-\d{6}-[A-Z0-9]{4}$/.test(hash.get('o') || '') && /^[a-f0-9]{40}$/.test(hash.get('k') || '')) state.link = { id: hash.get('o'), key: hash.get('k') };

  const address = c => [c.house, c.street, c.landmark, c.city, c.district, c.state, c.pin, c.country].filter(Boolean).join(', ');
  const waLink = (order, message) => { let n = (order.customer.phone || '').replace(/\D/g, ''); if (n.length === 10) n = '91' + n; return n.length >= 10 ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : ''; };
  const send = (action, id, fields = {}) => api('/api/orders', { method: 'POST', body: { action, id, ...(state.link && state.link.id === id && !window.BO.password() ? { key: state.link.key } : {}), ...fields } });

  /* ---------- One order ---------- */
  function actions(o) {
    const first = esc(o.customer.name.split(' ')[0]), noEmail = !o.customer.email;
    const emailNote = noEmail ? '<p class="hint">This order has no email address, so nothing is emailed. Use WhatsApp instead.</p>' : '';
    if (o.status === 'new' || o.status === 'awaiting_payment') {
      const again = o.status === 'awaiting_payment';
      return `<form class="action-box" data-action="confirm" data-id="${esc(o.id)}"><h3>${again ? 'Change the amount and email it again' : 'Confirm this order'}</h3>
<p class="hint">${again ? `${first} has the payment request. Change shipping or the message below only if something was wrong.` : `Check the items are available, set shipping, then confirm. ${first} gets the order details and the payment request by email.`}</p>${emailNote}
<div class="grid3" style="margin-top:10px"><label>Shipping charge (₹)<input name="shipping" type="number" min="0" step="1" required value="${o.shipping ?? ''}" placeholder="0 for free"></label><label>Extra / discount (₹)<input name="adjustment" type="number" step="1" value="${o.adjustment || ''}" placeholder="e.g. 150 or -50"><small>For custom quotes or a discount</small></label><label>Label for that line<input name="adjustmentLabel" maxlength="80" value="${esc(o.adjustmentLabel || '')}" placeholder="Custom artwork"></label></div>
<label style="margin-top:10px">Message to ${first} (optional)<textarea name="ownerNote" maxlength="1000" placeholder="e.g. Dispatches within 2 working days.">${esc(o.ownerNote || '')}</textarea></label>
<div class="row"><button class="primary" type="submit">${again ? 'Update &amp; resend payment email' : 'Confirm &amp; email payment request'}</button></div></form>
${again ? `<form class="action-box" data-action="paid" data-id="${esc(o.id)}"><h3>Payment arrived?</h3><div class="grid2"><label>UPI reference or note (optional)<input name="reference" maxlength="120"></label></div><div class="row"><button class="good" type="submit">Mark as paid &amp; email receipt</button><button type="button" data-do="resend" data-id="${esc(o.id)}">Resend payment email</button></div></form>` : ''}
<form class="action-box" data-action="cancel" data-id="${esc(o.id)}"><div class="grid2"><label>Reason for cancelling (optional)<input name="reason" maxlength="500"></label><label style="align-self:end;display:flex;gap:8px;align-items:center;min-height:42px"><input type="checkbox" name="notify" style="width:18px;min-height:18px"${noEmail ? ' disabled' : ''}>Email ${first} about it</label></div><div class="row"><button class="danger" type="submit">Cancel order</button></div></form>`;
    }
    if (o.status === 'paid') return `<form class="action-box" data-action="shipped" data-id="${esc(o.id)}"><h3>Dispatch</h3>${emailNote}<div class="grid2"><label>Courier<input name="courier" maxlength="80" placeholder="India Post, Delhivery…"></label><label>Tracking number<input name="tracking" maxlength="80"></label></div><div class="row"><button class="good" type="submit">Mark as shipped &amp; email tracking</button><button type="button" data-do="resend" data-id="${esc(o.id)}">Resend receipt</button></div></form>`;
    if (o.status === 'shipped') return `<div class="action-box"><div class="row"><button type="button" class="good" data-do="status" data-status="delivered" data-id="${esc(o.id)}">Mark as delivered</button><button type="button" data-do="resend" data-id="${esc(o.id)}">Resend tracking email</button></div></div>`;
    return '';
  }

  function card(o, forceOpen) {
    const c = o.customer, total = o.total ?? o.subtotal;
    const mailBits = Object.entries(o.emails || {}).map(([k, v]) => `<li>${esc(k.replace(/([A-Z])/g, ' $1').toLowerCase())}: ${esc(String(v).replace(/ \d{4}-\d\d-\d\dT.*$/, ''))}</li>`).join('');
    const wa = waLink(o, `Hi ${c.name.split(' ')[0]}, this is The Paper Theory about your order ${o.id}.`);
    return `<details class="order" data-order="${esc(o.id)}"${forceOpen || state.open.has(o.id) ? ' open' : ''}>
<summary><span class="oid">${esc(o.id)}</span><span class="who">${esc(c.name)} <small>· ${esc(c.city || o.channel || '')} · ${esc(when(o.createdAt))}${o.origin === 'manual' ? ' · ' + esc(o.channel || 'manual') : ''}</small></span><span class="amt">${money(total)}${o.total == null ? '<small class="muted"> + shipping</small>' : ''}</span><span class="badge ${esc(o.status)}">${LABEL[o.status] || esc(o.status)}</span></summary>
<div class="order-body"><div class="order-cols"><div>
<p class="block-title">Items</p><div class="table-wrap"><table><tbody>${o.items.map(i => `<tr><td><b>${esc(i.name)}</b>${i.option ? `<br><span class="muted small">${esc(i.option)}</span>` : ''}${i.selection ? `<br><span class="muted small wrap">${esc(i.selection)}</span>` : ''}${i.verified === false ? '<br><span class="pill low">Price not matched to catalogue</span>' : ''}</td><td class="num">× ${i.quantity}</td><td class="num">${i.lineTotal == null ? 'Quote' : money(i.lineTotal)}</td></tr>`).join('')}
<tr><td colspan="2">Subtotal</td><td class="num">${money(o.subtotal)}</td></tr>${o.adjustment ? `<tr><td colspan="2">${esc(o.adjustmentLabel || 'Extra / discount')}</td><td class="num">${money(o.adjustment)}</td></tr>` : ''}
<tr><td colspan="2">Shipping</td><td class="num">${o.shipping == null ? 'To confirm' : o.shipping === 0 ? 'Free' : money(o.shipping)}</td></tr><tr class="total"><td colspan="2">Total</td><td class="num">${o.total == null ? 'To confirm' : money(o.total)}</td></tr></tbody></table></div>
${o.note ? `<p class="block-title">Customer note</p><p class="wrap">${esc(o.note)}</p>` : ''}${actions(o)}
</div><div>
<p class="block-title">Customer</p><p class="wrap"><b>${esc(c.name)}</b>${c.phone ? `<br>${esc(c.phone)}` : ''}${c.email ? `<br><a href="mailto:${esc(c.email)}?subject=${encodeURIComponent('Your order ' + o.id + ' · The Paper Theory')}">${esc(c.email)}</a>` : ''}</p>
${address(c) ? `<p class="block-title">Deliver to</p><p class="wrap">${esc(address(c))}</p>` : ''}
<div class="row">${wa ? `<a class="btn" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp ${esc(c.name.split(' ')[0])}</a>` : ''}<button type="button" data-do="copy" data-id="${esc(o.id)}">Copy address</button></div>
${o.payment ? `<p class="block-title">Payment</p><p>Paid ${esc(when(o.payment.paidAt))}${o.payment.reference ? ' · ' + esc(o.payment.reference) : ''}</p>` : ''}${o.tracking && (o.tracking.courier || o.tracking.number) ? `<p class="block-title">Tracking</p><p>${esc([o.tracking.courier, o.tracking.number].filter(Boolean).join(' · '))}</p>` : ''}
<p class="block-title">History</p><ul class="history">${(o.history || []).map(h => `<li>${esc(when(h.at))} · ${esc(h.action)}${h.note ? ' · ' + esc(h.note) : ''}</li>`).join('')}${mailBits}</ul>
${o.trafficSource ? `<p class="small muted">Came from: ${esc(o.trafficSource)}</p>` : ''}
${window.BO.password() ? `<div class="row"><button type="button" class="quiet" data-do="delete" data-id="${esc(o.id)}">Delete this order</button></div>` : ''}
</div></div><p class="status-line" data-status-for="${esc(o.id)}" role="status" aria-live="polite"></p></div></details>`;
  }

  /* ---------- Rendering ---------- */
  const matches = (o, q) => !q || [o.id, o.customer.name, o.customer.phone, o.customer.email, o.customer.city, ...o.items.map(i => i.name)].join(' ').toLowerCase().includes(q);
  const inFilter = o => state.filter === 'all' || (state.filter === 'open' ? ['new', 'awaiting_payment', 'paid'].includes(o.status) : o.status === state.filter);

  function render() {
    const by = s => state.orders.filter(o => o.status === s), since = Date.now() - 30 * 864e5;
    const revenue = state.orders.filter(o => o.payment?.paidAt && Date.parse(o.payment.paidAt) >= since && o.status !== 'cancelled');
    $('kNew').textContent = by('new').length; $('kAwait').textContent = by('awaiting_payment').length; $('kPaid').textContent = by('paid').length;
    $('kAwaitValue').textContent = by('awaiting_payment').length ? money(by('awaiting_payment').reduce((s, o) => s + (o.total || 0), 0)) + ' outstanding' : 'Nothing outstanding';
    $('kRevenue').textContent = money(revenue.reduce((s, o) => s + (o.total || 0), 0)); $('kRevenueNote').textContent = `${revenue.length} paid order${revenue.length === 1 ? '' : 's'}`;
    $('cOrders').textContent = state.orders.length; $('cLeads').textContent = state.leads.length;
    const counts = { open: state.orders.filter(o => ['new', 'awaiting_payment', 'paid'].includes(o.status)).length, all: state.orders.length };
    $('filters').innerHTML = [['open', 'To do'], ['new', 'New'], ['awaiting_payment', 'Awaiting payment'], ['paid', 'Paid'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled'], ['all', 'All']].map(([k, label]) => `<button type="button" data-filter="${k}" aria-pressed="${state.filter === k}">${label} ${counts[k] ?? by(k).length}</button>`).join('');
    const q = $('search').value.trim().toLowerCase(), shown = state.orders.filter(o => (q ? true : inFilter(o) || state.open.has(o.id)) && matches(o, q)); // an order you are working on stays visible after its status changes
    $('list').innerHTML = shown.length ? shown.map(o => card(o)).join('') : `<div class="empty">${state.orders.length ? 'No orders match this view.' : 'No orders yet. When someone places an order on the website it appears here and in your inbox.'}</div>`;
    const alerts = [];
    if (!state.mail.configured) alerts.push('<div class="alert bad"><b>Order emails are off.</b> Orders are still saved here, but no alert reaches your inbox and customers get no email. Open “Payment &amp; email” for the 4-step setup.</div>');
    if (!state.settings.qr && !state.settings.upiId) alerts.push('<div class="alert"><b>No payment QR or UPI ID saved.</b> Until you add one in “Payment &amp; email”, the confirmation email asks the customer to reply for payment details.</div>');
    const failed = state.orders.filter(o => Object.values(o.emails || {}).some(v => String(v).startsWith('failed')) && ['new', 'awaiting_payment'].includes(o.status));
    if (failed.length && state.mail.configured) alerts.push(`<div class="alert bad"><b>${failed.length} order${failed.length === 1 ? ' has' : 's have'} an email that did not send:</b> ${failed.map(o => esc(o.id)).join(', ')}. Open the order and resend.</div>`);
    $('alerts').innerHTML = alerts.join('');
    renderLeads(); renderPayment();
  }

  function renderLeads() {
    const q = $('leadSearch').value.trim().toLowerCase(), type = $('leadType').value;
    const rows = state.leads.filter(l => (!type || (type === 'customer' ? l.type === 'customer' : l.type !== 'customer')) && (!q || [l.email, l.name, l.city].join(' ').toLowerCase().includes(q)));
    state.shownLeads = rows;
    $('leadRows').innerHTML = rows.length ? rows.map(l => `<tr><td class="wrap"><a href="mailto:${esc(l.email)}">${esc(l.email)}</a></td><td>${l.type === 'customer' ? 'Customer' : 'Subscriber'}${l.subscribed && l.type === 'customer' ? ' · subscribed' : ''}</td><td>${esc(l.name)}</td><td>${esc(l.city)}</td><td class="num">${l.orders || 0}</td><td>${esc(l.source)}</td><td>${esc(day(l.firstSeen))}</td><td>${esc(day(l.lastSeen))}</td></tr>`).join('') : '<tr><td colspan="8" class="muted">No emails yet. They appear when someone orders or signs up in the website footer.</td></tr>';
  }

  function renderPayment() {
    const f = $('payForm'), s = state.settings, qr = state.qr === undefined ? s.qr : state.qr;
    if (document.activeElement?.form !== f) { f.upiId.value = s.upiId || ''; f.payeeName.value = s.payeeName || ''; f.instructions.value = s.instructions || ''; }
    $('qrPreview').hidden = !qr; if (qr) $('qrPreview').src = qr; $('qrRemove').hidden = !qr;
    $('mailState').innerHTML = state.mail.configured ? `Emails are <b>on</b>. They are sent from <b>${esc(state.mail.sender)}</b>; new-order alerts go to <b>${esc(state.mail.alert)}</b>.` : `Emails are <b>off</b>. Add the Gmail app password in Vercel (steps below) to send from <b>${esc(state.mail.sender)}</b>.`;
  }

  /* ---------- Loading ---------- */
  async function loadAll() {
    setStatus($('status'), 'Loading orders…');
    const data = await api('/api/orders');
    Object.assign(state, { orders: data.orders, leads: data.leads, settings: data.settings, mail: data.mail, qr: undefined });
    $('signin').hidden = true; $('app').hidden = false; $('single').hidden = true; setStatus($('status'), '');
    if (state.link) state.open.add(state.link.id);
    render();
    if (state.link) document.querySelector(`[data-order="${state.link.id}"]`)?.scrollIntoView({ block: 'start' });
  }
  async function loadSingle() {
    const data = await api('/api/orders', { method: 'POST', secret: '', body: { action: 'get', ...state.link } });
    showSingle(data.order, data);
  }
  function showSingle(order, extra) {
    state.single = order; if (extra) state.singleExtra = extra;
    const e = state.singleExtra || {}, notes = [];
    if (e.mail && !e.mail.configured) notes.push('<div class="alert bad"><b>Order emails are off</b>, so confirming will not email the customer. Enter the owner password and open “Payment &amp; email”.</div>');
    if (e.payment && !e.payment.hasQr && !e.payment.upiId) notes.push('<div class="alert"><b>No payment QR or UPI ID saved yet.</b> The confirmation email will ask the customer to reply for payment details.</div>');
    $('single').hidden = false; $('single').innerHTML = notes.join('') + card(order, true);
    $('signin').querySelector('button').textContent = 'See all orders';
  }

  function replaceOrder(order) {
    if (state.single && state.single.id === order.id && $('app').hidden) return showSingle(order);
    const i = state.orders.findIndex(o => o.id === order.id);
    if (i >= 0) state.orders[i] = order; else state.orders.unshift(order);
    state.open.add(order.id); render();
  }
  const note = (id, message, kind) => { const n = document.querySelector(`[data-status-for="${id}"]`); if (n) setStatus(n, message, kind); };
  const outcome = (result, done) => result.mail?.ok ? [done + ' The customer has been emailed.', 'ok'] : result.mail && result.mail.error !== 'not requested' ? [done + ' The email was NOT sent: ' + result.mail.error, 'error'] : [done, 'ok'];

  /* ---------- Events ---------- */
  document.addEventListener('toggle', event => { const id = event.target.dataset?.order; if (id) event.target.open ? state.open.add(id) : state.open.delete(id); }, true);

  document.addEventListener('submit', async event => {
    const form = event.target.closest('form[data-action]'); if (!form) return;
    event.preventDefault();
    const action = form.dataset.action, id = form.dataset.id, f = Object.fromEntries(new FormData(form)), button = form.querySelector('button[type=submit]');
    if (action === 'cancel' && !confirm(`Cancel order ${id}?`)) return;
    const fields = action === 'confirm' ? { shipping: Number(f.shipping), adjustment: Number(f.adjustment || 0), adjustmentLabel: f.adjustmentLabel, ownerNote: f.ownerNote } : action === 'paid' ? { reference: f.reference } : action === 'shipped' ? { courier: f.courier, tracking: f.tracking } : { reason: f.reason, notify: f.notify === 'on' };
    button.disabled = true;
    try {
      const result = await send(action, id, fields);
      replaceOrder(result.order);
      note(id, ...outcome(result, { confirm: 'Order confirmed.', paid: 'Marked as paid.', shipped: 'Marked as shipped.', cancel: 'Order cancelled.' }[action]));
    } catch (error) { note(id, error.message, 'error'); button.disabled = false; }
  });

  document.addEventListener('click', async event => {
    const filter = event.target.closest('[data-filter]');
    if (filter) { state.filter = filter.dataset.filter; return render(); }
    const tab = event.target.closest('[data-tab]');
    if (tab) { document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b === tab)); document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.tab; }); return; }
    const button = event.target.closest('[data-do]'); if (!button) return;
    const id = button.dataset.id, order = state.orders.find(o => o.id === id) || state.single;
    try {
      if (button.dataset.do === 'copy') { await navigator.clipboard.writeText(`${order.customer.name}\n${order.customer.phone}\n${address(order.customer)}`); return note(id, 'Address copied.', 'ok'); }
      if (button.dataset.do === 'delete') { if (!confirm(`Delete order ${id} permanently? This cannot be undone.`)) return; await send('delete', id); state.orders = state.orders.filter(o => o.id !== id); return render(); }
      button.disabled = true;
      const result = button.dataset.do === 'resend' ? await send('resend', id) : await send('update', id, { status: button.dataset.status });
      replaceOrder(result.order);
      note(id, ...(button.dataset.do === 'resend' ? outcome(result, 'Done.') : ['Status updated.', 'ok']));
    } catch (error) { note(id, error.message, 'error'); button.disabled = false; }
  });

  $('signin').addEventListener('submit', async event => {
    event.preventDefault();
    const value = $('password').value.trim(); if (!value) return setStatus($('status'), 'Enter the owner password.', 'error');
    window.BO.remember(value);
    try { await loadAll(); } catch (error) { window.BO.remember(''); setStatus($('status'), error.message, 'error'); }
  });
  $('search').addEventListener('input', render); $('leadSearch').addEventListener('input', renderLeads); $('leadType').addEventListener('change', renderLeads);
  $('refresh').addEventListener('click', () => loadAll().catch(error => setStatus($('status'), error.message, 'error')));
  $('exportOrders').addEventListener('click', () => csv('the-paper-theory-orders.csv', ['Order', 'Placed (IST)', 'Status', 'Name', 'Phone', 'Email', 'Address', 'Items', 'Subtotal', 'Shipping', 'Total', 'Paid on', 'Reference', 'Source'], state.orders.map(o => [o.id, when(o.createdAt), LABEL[o.status], o.customer.name, o.customer.phone, o.customer.email, address(o.customer), o.items.map(i => `${i.quantity} x ${i.name}${i.option ? ' (' + i.option + ')' : ''}`).join('; '), o.subtotal, o.shipping ?? '', o.total ?? '', o.payment ? when(o.payment.paidAt) : '', o.payment?.reference || '', o.trafficSource || o.channel || ''])));
  $('exportLeads').addEventListener('click', () => csv('the-paper-theory-emails.csv', ['Email', 'Type', 'Name', 'City', 'Orders', 'Source', 'First seen', 'Last seen'], (state.shownLeads || []).map(l => [l.email, l.type, l.name, l.city, l.orders || 0, l.source, l.firstSeen, l.lastSeen])));
  $('copyLeads').addEventListener('click', async () => { try { await navigator.clipboard.writeText((state.shownLeads || []).map(l => l.email).join(', ')); setStatus($('leadStatus'), `${state.shownLeads.length} email addresses copied.`, 'ok'); } catch { setStatus($('leadStatus'), 'Copy is blocked by this browser. Use Export CSV instead.', 'error'); } });

  /* Add a manual order */
  const itemRow = () => `<div class="item-row"><label>Item<input name="itemName" maxlength="160" required placeholder="Gym Motivation sticker sheet"></label><label>Option<input name="itemOption" maxlength="240" placeholder="Holographic"></label><label>Qty<input name="itemQty" type="number" min="1" max="999" value="1" required></label><label>Price each (₹)<input name="itemPrice" type="number" min="0" step="1" required></label><button type="button" data-remove-item aria-label="Remove item">×</button></div>`;
  const addTotal = () => { const f = $('addForm'), rows = [...f.querySelectorAll('.item-row')], sum = rows.reduce((s, r) => s + Number(r.querySelector('[name=itemQty]').value || 0) * Number(r.querySelector('[name=itemPrice]').value || 0), 0) + Number(f.shipping.value || 0); $('addTotal').textContent = 'Total ' + money(sum); };
  $('itemRows').innerHTML = itemRow();
  $('addItem').addEventListener('click', () => $('itemRows').insertAdjacentHTML('beforeend', itemRow()));
  $('addForm').addEventListener('click', event => { const b = event.target.closest('[data-remove-item]'); if (b && $('itemRows').children.length > 1) { b.closest('.item-row').remove(); addTotal(); } });
  $('addForm').addEventListener('input', addTotal);
  $('addForm').date.value = new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10);
  $('addForm').addEventListener('submit', async event => {
    event.preventDefault();
    const f = event.target, button = f.querySelector('button[type=submit]');
    const items = [...f.querySelectorAll('.item-row')].map(r => ({ type: 'manual', name: r.querySelector('[name=itemName]').value, option: r.querySelector('[name=itemOption]').value, quantity: Number(r.querySelector('[name=itemQty]').value), unitPrice: Number(r.querySelector('[name=itemPrice]').value) }));
    button.disabled = true;
    try {
      const result = await api('/api/orders', { method: 'POST', body: { action: 'create', channel: f.channel.value, date: f.date.value, status: f.status.value, reference: f.reference.value, shipping: f.shipping.value, note: f.note.value, customer: { name: f.name.value, phone: f.phone.value, email: f.email.value, city: f.city.value, street: f.street.value }, items } });
      state.orders.unshift(result.order); state.orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); state.open.add(result.order.id); state.filter = 'all';
      const keep = f.date.value; f.reset(); f.date.value = keep; $('itemRows').innerHTML = itemRow(); addTotal(); render();
      setStatus($('addStatus'), `Order ${result.order.id} added. Find it under Orders → All.`, 'ok');
    } catch (error) { setStatus($('addStatus'), error.message, 'error'); } finally { button.disabled = false; }
  });

  /* Payment settings */
  $('qrFile').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      const image = await createImageBitmap(file), scale = Math.min(1, 720 / Math.max(image.width, image.height)), canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.imageSmoothingEnabled = scale < 1; ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      let data = canvas.toDataURL('image/png'); if (data.length > 400000) data = canvas.toDataURL('image/jpeg', 0.92);
      if (data.length > 400000) throw Error('too large');
      state.qr = data; renderPayment(); setStatus($('payStatus'), 'QR code ready. Press “Save payment details” to start using it.');
    } catch { setStatus($('payStatus'), 'That image could not be used. Upload a PNG or JPG screenshot of your QR code.', 'error'); }
  });
  $('qrRemove').addEventListener('click', () => { state.qr = ''; $('qrFile').value = ''; renderPayment(); setStatus($('payStatus'), 'QR code removed. Press “Save payment details” to confirm.'); });
  $('payForm').addEventListener('submit', async event => {
    event.preventDefault(); const f = event.target, button = f.querySelector('button[type=submit]'); button.disabled = true;
    try { const result = await api('/api/orders', { method: 'POST', body: { action: 'settings', upiId: f.upiId.value.trim(), payeeName: f.payeeName.value, instructions: f.instructions.value, qr: state.qr === undefined ? state.settings.qr : state.qr } }); state.settings = result.settings; state.qr = undefined; render(); setStatus($('payStatus'), 'Saved. New payment emails use these details.', 'ok'); }
    catch (error) { setStatus($('payStatus'), error.message, 'error'); } finally { button.disabled = false; }
  });
  $('testMail').addEventListener('click', async event => {
    event.target.disabled = true; setStatus($('mailStatus'), 'Sending…');
    try { const result = await api('/api/orders', { method: 'POST', body: { action: 'test-email' } }); result.mail.ok ? setStatus($('mailStatus'), `Sent. Check the ${state.mail.alert} inbox (and spam).`, 'ok') : setStatus($('mailStatus'), result.mail.error, 'error'); }
    catch (error) { setStatus($('mailStatus'), error.message, 'error'); } finally { event.target.disabled = false; }
  });

  /* ---------- Start ---------- */
  (async () => {
    try {
      if (window.BO.password()) return await loadAll();
      if (state.link) return await loadSingle();
    } catch (error) {
      if (error.status === 401) window.BO.remember('');
      if (state.link && $('single').hidden) { try { return await loadSingle(); } catch (inner) { return setStatus($('status'), inner.message, 'error'); } }
      setStatus($('status'), error.message, 'error');
    }
  })();
})();
