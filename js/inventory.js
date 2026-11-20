// Owner inventory editor: two partner places, and the products given to each (name, price, quantity, date given).
(() => {
  'use strict';
  const { esc, money, api, csv, setStatus } = window.BO;
  const $ = id => document.getElementById(id);
  const state = { rev: 0, places: [], items: [], filter: 'all', dirty: false, codes: {} };
  const today = () => new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10);
  const left = i => Math.max(0, Number(i.quantity || 0) - Number(i.sold || 0));
  const placeName = id => state.places.find(p => p.id === id)?.name || id;
  const link = id => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}stock.html?place=${id}`;
  const dirty = (value = true) => { state.dirty = value; $('save').textContent = value ? 'Save changes •' : 'Save changes'; };

  function renderPlaces() {
    $('places').innerHTML = state.places.map(p => {
      const items = state.items.filter(i => i.placeId === p.id), units = items.reduce((n, i) => n + left(i), 0), value = items.reduce((n, i) => n + left(i) * Number(i.price || 0), 0), sold = items.reduce((n, i) => n + Number(i.sold || 0) * Number(i.price || 0), 0);
      return `<div class="card" style="margin-top:0" data-place="${p.id}"><p class="eyebrow">Place ${p.id === 'a' ? 1 : 2}</p>
<div class="grid2"><label>Name<input data-field="name" maxlength="80" value="${esc(p.name)}"></label><label>Contact person / phone<input data-field="contact" maxlength="120" value="${esc(p.contact)}" placeholder="Optional"></label></div>
<p style="margin:12px 0 4px"><b>${units}</b> units there now · worth <b>${money(value)}</b> · sold so far <b>${money(sold)}</b></p>
<label style="margin-top:10px">${p.hasCode ? 'Change access code' : 'Set an access code'}<input data-field="code" maxlength="64" autocomplete="off" value="${esc(state.codes[p.id] || '')}" placeholder="${p.hasCode ? 'Leave empty to keep the current code' : 'At least 6 characters, e.g. cafe-2468'}"><small>${p.hasCode ? 'A code is set. This place opens its link and types the code to see its list.' : 'This place cannot see its list until you set a code and save.'}</small></label>
<div class="row" style="margin-top:10px"><input readonly value="${esc(link(p.id))}" aria-label="Link for ${esc(p.name)}" style="flex:1;min-width:180px" onfocus="this.select()"><button type="button" data-copy="${p.id}">Copy link</button></div></div>`;
    }).join('');
    $('placeFilter').innerHTML = [['all', 'Both places'], ...state.places.map(p => [p.id, p.name])].map(([k, label]) => `<button type="button" data-filter="${k}" aria-pressed="${state.filter === k}">${esc(label)} ${k === 'all' ? state.items.length : state.items.filter(i => i.placeId === k).length}</button>`).join('');
  }

  function renderRows() {
    const shown = state.items.map((item, index) => ({ item, index })).filter(x => state.filter === 'all' || x.item.placeId === state.filter);
    $('rows').innerHTML = shown.length ? shown.map(({ item: i, index }) => `<tr data-index="${index}">
<td><select data-f="placeId" aria-label="Place">${state.places.map(p => `<option value="${p.id}"${p.id === i.placeId ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></td>
<td class="w-name"><input data-f="name" list="productNames" maxlength="120" value="${esc(i.name)}" placeholder="Product name" aria-label="Product name"></td>
<td class="w-num"><input data-f="price" type="number" min="0" step="1" value="${i.price ?? ''}" aria-label="Price"></td>
<td class="w-num"><input data-f="quantity" type="number" min="0" step="1" value="${i.quantity ?? ''}" aria-label="Quantity given"></td>
<td class="w-num"><input data-f="sold" type="number" min="0" step="1" value="${i.sold ?? 0}" aria-label="Sold"></td>
<td class="num"><span class="pill${left(i) === 0 && i.quantity ? ' out' : left(i) <= 2 && i.quantity ? ' low' : ''}" data-left>${left(i)}</span></td>
<td class="w-date"><input data-f="givenOn" type="date" value="${esc(i.givenOn || '')}" aria-label="Date given"></td>
<td><input data-f="note" maxlength="240" value="${esc(i.note || '')}" placeholder="Optional" aria-label="Note"></td>
<td><button type="button" class="quiet" data-remove aria-label="Remove ${esc(i.name || 'row')}">Remove</button></td></tr>`).join('') : '<tr><td colspan="9" class="muted" style="padding:22px 10px">No products recorded here yet. Press “+ Add product”.</td></tr>';
    renderTotals();
  }
  function renderTotals() {
    const items = state.items.filter(i => state.filter === 'all' || i.placeId === state.filter), n = fn => items.reduce((s, i) => s + fn(i), 0);
    $('totals').innerHTML = items.length ? `<tr class="total"><td colspan="3">Total · stock value ${money(n(i => left(i) * Number(i.price || 0)))} · sold value ${money(n(i => Number(i.sold || 0) * Number(i.price || 0)))}</td><td class="num">${n(i => Number(i.quantity || 0))}</td><td class="num">${n(i => Number(i.sold || 0))}</td><td class="num">${n(left)}</td><td colspan="3"></td></tr>` : '';
  }
  const render = () => { renderPlaces(); renderRows(); };

  async function load() {
    setStatus($('status'), 'Loading inventory…');
    const data = await api('/api/inventory');
    Object.assign(state, { rev: data.rev, places: data.places, items: data.items, codes: {} }); dirty(false);
    $('signin').hidden = true; $('app').hidden = false; setStatus($('status'), ''); render();
  }

  $('signin').addEventListener('submit', async event => { event.preventDefault(); const value = $('password').value.trim(); if (!value) return; window.BO.remember(value); try { await load(); } catch (error) { window.BO.remember(''); setStatus($('status'), error.message, 'error'); } });
  $('places').addEventListener('input', event => { const card = event.target.closest('[data-place]'), field = event.target.dataset.field; if (!card || !field) return; const p = state.places.find(x => x.id === card.dataset.place); if (field === 'code') state.codes[p.id] = event.target.value; else p[field] = event.target.value; dirty(); });
  $('places').addEventListener('change', event => { if (event.target.dataset.field === 'name') { renderPlaces(); renderRows(); } });
  $('places').addEventListener('click', async event => { const id = event.target.closest('[data-copy]')?.dataset.copy; if (!id) return; try { await navigator.clipboard.writeText(link(id)); setStatus($('saveStatus'), `Link for ${placeName(id)} copied. Send it with the access code.`, 'ok'); } catch { setStatus($('saveStatus'), 'Copy is blocked by this browser. Select the link and copy it yourself.', 'error'); } });
  $('placeFilter').addEventListener('click', event => { const b = event.target.closest('[data-filter]'); if (b) { state.filter = b.dataset.filter; render(); } });
  $('rows').addEventListener('input', event => {
    const row = event.target.closest('[data-index]'), f = event.target.dataset.f; if (!row || !f) return;
    const item = state.items[row.dataset.index]; item[f] = ['price', 'quantity', 'sold'].includes(f) ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value;
    // Picking a catalogue product fills its starting price when the price is still empty.
    if (f === 'name' && (item.price === '' || item.price == null)) { const match = (window.CATALOGUE?.products || []).find(p => p.name === item.name), price = match?.variants?.find(v => Number.isFinite(v.price))?.price; if (price != null) { item.price = price; row.querySelector('[data-f=price]').value = price; } }
    const pill = row.querySelector('[data-left]'); pill.textContent = left(item); renderTotals(); dirty();
  });
  $('rows').addEventListener('change', event => { if (event.target.dataset.f === 'placeId') render(); });
  $('rows').addEventListener('click', event => { const b = event.target.closest('[data-remove]'); if (!b) return; const index = Number(b.closest('[data-index]').dataset.index), item = state.items[index]; if (item.name && !confirm(`Remove “${item.name}” from ${placeName(item.placeId)}?`)) return; state.items.splice(index, 1); dirty(); render(); });
  $('addRow').addEventListener('click', () => { state.items.push({ placeId: state.filter === 'all' ? state.places[0].id : state.filter, name: '', price: '', quantity: 1, sold: 0, givenOn: today(), note: '' }); dirty(); render(); const inputs = $('rows').querySelectorAll('[data-f=name]'); inputs[inputs.length - 1]?.focus(); });
  $('save').addEventListener('click', async () => {
    const button = $('save'); button.disabled = true; setStatus($('saveStatus'), 'Saving…');
    try {
      const data = await api('/api/inventory', { method: 'POST', body: { action: 'save', rev: state.rev, places: state.places.map(p => ({ id: p.id, name: p.name, contact: p.contact, code: state.codes[p.id] || '' })), items: state.items.map(i => ({ ...i, price: i.price === '' ? NaN : i.price, quantity: i.quantity === '' ? NaN : i.quantity, sold: i.sold === '' ? 0 : i.sold })) } });
      Object.assign(state, { rev: data.rev, places: data.places, items: data.items, codes: {} }); dirty(false); render(); setStatus($('saveStatus'), 'Saved. Both places see the update when they refresh their link.', 'ok');
    } catch (error) { setStatus($('saveStatus'), error.message, 'error'); } finally { button.disabled = false; }
  });
  $('exportInv').addEventListener('click', () => csv('the-paper-theory-inventory.csv', ['Place', 'Product', 'Price', 'Qty given', 'Sold', 'Left', 'Date given', 'Note'], state.items.map(i => [placeName(i.placeId), i.name, i.price, i.quantity, i.sold || 0, left(i), i.givenOn, i.note])));
  addEventListener('beforeunload', event => { if (state.dirty) event.preventDefault(); });
  addEventListener('DOMContentLoaded', () => { $('productNames').innerHTML = (window.CATALOGUE?.products || []).map(p => `<option value="${esc(p.name)}">`).join(''); });
  if (window.BO.password()) load().catch(error => { if (error.status === 401) window.BO.remember(''); setStatus($('status'), error.message, 'error'); });
})();
