// Direct ordering and email signup. Sends the bag and delivery details to /api/orders;
// the store confirms by email with the payment request. WhatsApp ordering stays available as a fallback.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const read = (store, key) => { try { return JSON.parse(store.getItem(key)); } catch { return null; } };
  const post = async payload => {
    const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(Error(result.error || 'Something went wrong. Please try again.'), { status: response.status });
    return result;
  };

  const button = $('placeOrder'), status = $('placeOrderStatus'), dialog = $('cartDialog');
  if (button && dialog) {
    // Count a checkout as started when the shopper moves from the bag to delivery details.
    $('checkoutNext')?.addEventListener('click', () => {
      const store = window.TPTStore;
      if (store?.getItemCount() && dialog.dataset.checkoutStep === '1') window.TPTAnalytics?.track('checkout_started', store.checkoutDetail(store.collectCustomer()));
    }, true);

    button.addEventListener('click', async () => {
      const store = window.TPTStore;
      if (!store || !store.getItemCount()) { store?.toast('Your bag is empty'); return; }
      const customer = store.collectCustomer(), error = store.validateCustomer(customer);
      if (error) { $('addressError').textContent = error; window.TPTCheckout?.setStep(2); store.toast(error); return; }
      const items = store.getCart().map(item => {
        if (item.type === 'custom') return { type: 'custom', name: item.name, option: [item.productType, item.size, item.finish].filter(Boolean).join(' · '), selection: [item.drive && 'Drive: ' + item.drive, item.notes, item.fileName && 'Reference file: ' + item.fileName].filter(Boolean).join(' | '), quantity: item.quantity };
        const product = store.byId(item.productId), variant = product?.variants.find(v => v.id === item.variantId);
        return { type: 'product', productId: item.productId, variantId: item.variantId, name: product?.name || item.productId, option: variant ? [variant.size, variant.finish].filter(Boolean).join(' · ') : '', unitPrice: variant?.price ?? null, selection: item.selection || '', quantity: item.quantity };
      });
      const label = button.textContent;
      button.disabled = true; button.textContent = 'Placing your order…'; status.textContent = '';
      try {
        const detail = store.checkoutDetail(customer);
        const result = await post({ action: 'place', customer, items, note: $('orderNote')?.value || '', website: $('orderWebsite')?.value || '', sessionId: read(sessionStorage, 'tpt-session-v2') || '', source: read(sessionStorage, 'tpt-source-v2') || 'direct' });
        window.TPTAnalytics?.track('order_submitted', detail);
        store.clearCart();
        if ($('orderNote')) $('orderNote').value = '';
        $('orderSuccessId').textContent = result.id; $('orderSuccessEmail').textContent = customer.email;
        dialog.dataset.checkoutStep = 'done'; $('orderSuccess').hidden = false; $('orderSuccess').focus(); dialog.scrollTop = 0;
      } catch (error) {
        // 503 means ordering is not configured on the server; point the shopper at WhatsApp instead of a dead end.
        status.textContent = error.status === 503 || !error.status ? 'We could not reach our order desk just now. Please use “Confirm order on WhatsApp” below, or try again in a minute.' : error.message;
        $('continueWa')?.classList.add('needs-attention');
      } finally { button.disabled = false; button.textContent = label; }
    });
    $('orderSuccessClose')?.addEventListener('click', () => { dialog.close(); window.TPTCheckout?.reset(); });
  }

  const form = $('signupForm');
  if (form) form.addEventListener('submit', async event => {
    event.preventDefault();
    const email = $('signupEmail').value.trim(), note = $('signupStatus'), submit = form.querySelector('button');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { note.textContent = 'Enter a valid email address.'; $('signupEmail').focus(); return; }
    submit.disabled = true;
    try {
      await post({ action: 'subscribe', email, consent: true, website: $('signupWebsite').value, source: read(sessionStorage, 'tpt-source-v2') || 'direct', sessionId: read(sessionStorage, 'tpt-session-v2') || '' });
      window.TPTAnalytics?.track('newsletter_signup', { surface: 'footer' });
      form.reset(); note.textContent = 'You are on the list. We will email you when something new drops.';
    } catch (error) { note.textContent = error.status === 503 || !error.status ? 'Sign-up is unavailable right now. Please try again later.' : error.message; }
    finally { submit.disabled = false; }
  });
})();
