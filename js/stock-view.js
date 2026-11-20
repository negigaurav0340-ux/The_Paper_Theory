// Read-only stock list for one partner place. Opened as stock.html?place=a or stock.html?place=b with that place's access code.
(() => {
  'use strict';
  const { esc, money, day, api, setStatus } = window.BO;
  const $ = id => document.getElementById(id);
  const place = new URLSearchParams(location.search).get('place'), KEY = 'tpt-place-code-' + place;
  if (!['a', 'b'].includes(place)) { $('signin').hidden = true; return setStatus($('status'), 'This link is incomplete. Ask The Paper Theory to send your stock link again.', 'error'); }
  const saved = () => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } };

  async function load(code) {
    setStatus($('status'), 'Loading…');
    const data = await api('/api/inventory?place=' + place, { secret: '', headers: { 'x-place-code': code } });
    try { sessionStorage.setItem(KEY, code); } catch {}
    const items = [...data.items].sort((a, b) => b.givenOn.localeCompare(a.givenOn) || a.name.localeCompare(b.name));
    const sum = fn => items.reduce((n, i) => n + fn(i), 0), left = i => i.quantity - (i.sold || 0);
    $('title').textContent = data.place.name; $('lede').textContent = 'Products The Paper Theory has placed with you.';
    $('kLines').textContent = items.length; $('kGiven').textContent = sum(i => i.quantity); $('kSold').textContent = sum(i => i.sold || 0) + ' recorded as sold'; $('kLeft').textContent = sum(left); $('kValue').textContent = money(sum(i => left(i) * i.price));
    $('rows').innerHTML = items.length ? items.map(i => `<tr><td><b>${esc(i.name)}</b></td><td class="num"><span class="pill${left(i) === 0 ? ' out' : ''}">${left(i)}</span></td><td class="num">${money(i.price)}</td><td class="num">${i.quantity}</td><td class="num">${i.sold || 0}</td><td>${esc(day(i.givenOn + 'T12:00:00+05:30'))}</td><td class="wrap">${esc(i.note)}</td></tr>`).join('') : '<tr><td colspan="7" class="muted">Nothing has been recorded for you yet.</td></tr>';
    $('updated').textContent = data.updatedAt ? 'Last updated by The Paper Theory on ' + new Date(data.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + '.' : '';
    $('signin').hidden = true; $('app').hidden = false; setStatus($('status'), '');
  }
  $('signin').addEventListener('submit', event => { event.preventDefault(); load($('code').value.trim()).catch(error => setStatus($('status'), error.message, 'error')); });
  $('print').addEventListener('click', () => print());
  $('signout').addEventListener('click', () => { try { sessionStorage.removeItem(KEY); } catch {} location.reload(); });
  if (saved()) load(saved()).catch(error => { try { sessionStorage.removeItem(KEY); } catch {} setStatus($('status'), error.message, 'error'); });
})();
