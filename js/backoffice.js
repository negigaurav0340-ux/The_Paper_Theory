// Shared helpers for the owner tools (orders, inventory, analytics).
window.BO = (() => {
  'use strict';
  const KEY = 'tpt-owner-session';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = value => value == null || value === '' ? 'To confirm' : '₹' + Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const when = iso => iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
  const day = iso => iso ? new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }) : '';
  // The password is kept for this browser tab only, so moving between Orders, Inventory and Analytics does not ask again.
  const password = () => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } };
  const remember = value => { try { value ? sessionStorage.setItem(KEY, value) : sessionStorage.removeItem(KEY); } catch {} };
  async function api(path, { method = 'GET', body, secret = password(), headers = {} } = {}) {
    let response;
    try { response = await fetch(path, { method, cache: 'no-store', headers: { ...(secret ? { 'x-catalogue-secret': secret } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
    catch { throw Error('Could not reach the server. Check your connection and try again.'); }
    const text = await response.text();
    let data; try { data = JSON.parse(text); } catch { data = null; }
    if (!data) throw Error(response.status === 404 ? 'This tool only works on the live website (thepapertheory.in), not from a file on your computer.' : 'The server returned an unexpected reply. Please try again.');
    if (!response.ok) throw Object.assign(Error(data.error || 'Request failed'), { status: response.status });
    return data;
  }
  const csv = (name, header, rows) => {
    const cell = v => '"' + String(v ?? '').replaceAll('"', '""') + '"';
    const url = URL.createObjectURL(new Blob(['﻿' + [header, ...rows].map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const setStatus = (node, message, kind = '') => { node.textContent = message; node.className = 'status-line' + (kind ? ' ' + kind : ''); };
  return { esc, money, when, day, password, remember, api, csv, setStatus };
})();
