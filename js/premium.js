(() => {
  'use strict';
  const catalogue = window.CATALOGUE;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const safeParse = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  window.TPTPrivacy = Object.freeze({
    sessionReplayEnabled: false,
    maskSelectors: ['.customer','input','textarea','[contenteditable]'],
    blockSelectors: ['#cartDialog','#customForm']
  });

  const analyticsKey = 'tpt-analytics-v1';
  const sessionKey = 'tpt-session-v1';
  const sessionId = sessionStorage.getItem(sessionKey) || (crypto.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  sessionStorage.setItem(sessionKey, sessionId);
  const params = new URLSearchParams(location.search);
  const source = params.get('utm_source') || (document.referrer ? new URL(document.referrer).hostname : 'direct');
  const firstSource = localStorage.getItem('tpt-first-source-v1') || source;
  localStorage.setItem('tpt-first-source-v1', firstSource);
  function track(name, detail = {}) {
    const events = safeParse(analyticsKey, []);
    events.push({ name, time: new Date().toISOString(), sessionId, source, firstSource, path: location.pathname, device: innerWidth < 700 ? 'mobile' : innerWidth < 1024 ? 'tablet' : 'desktop', ...detail });
    localStorage.setItem(analyticsKey, JSON.stringify(events.slice(-5000)));
    window.dispatchEvent(new CustomEvent('tpt:analytics', { detail: events.at(-1) }));
  }
  window.TPTAnalytics = { track };

  const designs = {
    eren: { productId: 'LIT-001', variant: 'LIT-EREN-A4', label: 'Eren', off: 'assets/lightbox/lightbox-eren-off.webp', on: 'assets/lightbox/lightbox-eren-on.webp' },
    goku: { productId: 'LIT-GOKU', variant: 'LIT-GOKU-A4', label: 'Goku', off: 'assets/lightbox/lightbox-goku-off.webp', on: 'assets/lightbox/lightbox-goku-on.webp' },
    luffy: { productId: 'LIT-LUFFY', variant: 'LIT-LUFFY-A4', label: 'Luffy', off: 'assets/lightbox/lightbox-luffy-off.webp', on: 'assets/lightbox/lightbox-luffy-on.webp' }
  };
  let design = 'eren';
  const current = () => designs[design];
  track('product_view', { productId: current().productId, variantId: current().variant, surface: 'lightbox_showcase' });
  const comparison = $('#lightCompare');
  let dragging = false, sliderStarted = false;
  function setSplit(clientX) {
    const bounds = comparison.getBoundingClientRect();
    const split = Math.max(0, Math.min(100, ((clientX - bounds.left) / bounds.width) * 100));
    comparison.style.setProperty('--split', `${split}%`);
    comparison.setAttribute('aria-valuenow', String(Math.round(split)));
    if (!sliderStarted) { sliderStarted = true; track('comparison_slider_started', { productId: current().productId, variantId: current().variant }); }
    if (split < 8) track('light_on_viewed', { productId: current().productId, variantId: current().variant });
    if (split > 92) track('light_off_viewed', { productId: current().productId, variantId: current().variant });
  }
  comparison?.addEventListener('pointerdown', event => { dragging = true; comparison.setPointerCapture(event.pointerId); setSplit(event.clientX); });
  comparison?.addEventListener('pointermove', event => { if (dragging) setSplit(event.clientX); });
  comparison?.addEventListener('pointerup', event => { dragging = false; comparison.releasePointerCapture(event.pointerId); track('comparison_slider_completed', { productId: current().productId, variantId: current().variant, split: comparison.getAttribute('aria-valuenow') }); });
  comparison?.addEventListener('keydown', event => { if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return; event.preventDefault(); let value = Number(comparison.getAttribute('aria-valuenow')); if (event.key === 'ArrowLeft') value -= 5; if (event.key === 'ArrowRight') value += 5; if (event.key === 'Home') value = 0; if (event.key === 'End') value = 100; const bounds = comparison.getBoundingClientRect(); setSplit(bounds.left + bounds.width * Math.max(0, Math.min(100, value)) / 100); });

  function chooseDesign(key) {
    design = key; const item = designs[key];
    $('#lightOff').src = item.off; $('#lightOn').src = item.on; $('#lightboxDesign').value = item.variant;
    $('#roomImage').src = $('#roomPreview').classList.contains('dark-room') ? item.on : item.off;
    $('#lightboxWhatsApp').href = `https://wa.me/${catalogue.whatsapp}?text=${encodeURIComponent(`Hi The Paper Theory, I have a question about the ${item.label} Light Box.`)}`;
    $$('[data-light-design]').forEach(button => { const active = button.dataset.lightDesign === key; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    track('product_view', { productId: item.productId, variantId: item.variant, surface: 'design_selector' });
  }
  $$('[data-light-design]').forEach(button => button.addEventListener('click', () => chooseDesign(button.dataset.lightDesign)));
  $('#lightboxDesign')?.addEventListener('change', event => chooseDesign(Object.keys(designs).find(key => designs[key].variant === event.target.value) || 'eren'));

  const flagshipTrack = $('#flagshipTrack');
  const flagshipCards = flagshipTrack ? [...flagshipTrack.querySelectorAll('article')] : [];
  let flagshipIndex = 0, flagshipPausedUntil = 0, flagshipVisible = true;
  function scrollFlagship(direction) {
    if (!flagshipCards.length) return;
    flagshipIndex = (flagshipIndex + direction + flagshipCards.length) % flagshipCards.length;
    flagshipTrack.scrollTo({ left: flagshipCards[flagshipIndex].offsetLeft - flagshipTrack.offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  function pauseFlagship() { flagshipPausedUntil = Date.now() + 10000; }
  $('#flagshipPrev')?.addEventListener('click', () => { pauseFlagship(); scrollFlagship(-1); });
  $('#flagshipNext')?.addEventListener('click', () => { pauseFlagship(); scrollFlagship(1); });
  flagshipTrack?.addEventListener('pointerdown', pauseFlagship, { passive:true });
  flagshipTrack?.addEventListener('focusin', pauseFlagship);
  if ('IntersectionObserver' in window && flagshipTrack) new IntersectionObserver(entries => { flagshipVisible = entries[0].isIntersecting; }, { threshold:.2 }).observe(flagshipTrack);
  setInterval(() => { if (!document.hidden && flagshipVisible && Date.now() > flagshipPausedUntil && !matchMedia('(prefers-reduced-motion: reduce)').matches) scrollFlagship(1); }, 4800);
  $$('[data-feature-design]').forEach(card => card.querySelector('button')?.addEventListener('click', () => { chooseDesign(card.dataset.featureDesign); document.querySelector('#lightboxExperience')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }));
  $('#heroLink')?.addEventListener('click', event => { if (event.currentTarget.dataset.heroDesign) chooseDesign(event.currentTarget.dataset.heroDesign); });

  function selectedLightbox() {
    const selected = current(), product = catalogue.products.find(item => item.id === selected.productId);
    return { product, variant: product.variants.find(item => item.id === selected.variant) };
  }
  $('#lightboxAdd')?.addEventListener('click', () => { const { product, variant } = selectedLightbox(); window.TPTStore.addProduct(product, variant); });
  $('#lightboxBuyNow')?.addEventListener('click', () => { const { product, variant } = selectedLightbox(); window.TPTStore.addProduct(product, variant); track('buy_now_clicked', { productId: product.id, variantId: variant.id }); window.TPTStore.openCart(); });
  $('#lightboxPinCheck')?.addEventListener('click', () => { const pin = $('#lightboxPin').value.trim(); $('#lightboxPinResult').textContent = /^\d{6}$/.test(pin) ? 'PIN noted. Exact dispatch and courier timing will be confirmed before payment.' : 'Enter a valid 6-digit PIN code.'; if (/^\d{6}$/.test(pin)) track('delivery_checked', { productId: current().productId }); });
  $('#lightboxShare')?.addEventListener('click', async () => { const data = { title: `${current().label} A4 Anime Light Box · The Paper Theory`, text: `${current().label} A4 colour-changing Light Box · ₹1,199 · remote included`, url: location.href.split('#')[0] + '#lightboxExperience' }; try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(data.url); window.TPTStore.toast('Light Box link copied'); } track('product_shared', { productId: current().productId, design }); } catch {} });
  $('#lightboxSave')?.addEventListener('click', event => { const saved = new Set(safeParse('tpt-favourites-v4', [])), id = current().productId, add = !saved.has(id); add ? saved.add(id) : saved.delete(id); localStorage.setItem('tpt-favourites-v4', JSON.stringify([...saved])); event.currentTarget.textContent = add ? '♥' : '♡'; event.currentTarget.classList.toggle('saved', add); if (add) track('wishlist_added', { productId: id }); });

  const video = $('#lightboxVideo');
  let videoStarted = false, videoCompleted = false;
  video?.addEventListener('play', () => { if (!videoStarted) { videoStarted = true; track('product_video_started', { productId: current().productId, variantId: current().variant }); } });
  video?.addEventListener('timeupdate', () => { if (!videoCompleted && video.duration && video.currentTime / video.duration > .9) { videoCompleted = true; track('product_video_completed', { productId: current().productId, variantId: current().variant }); } });
  $('#socialVideo')?.addEventListener('click', () => { $('#videoDialog').showModal(); $('#videoDialog video').play(); });

  $('#roomToggle')?.addEventListener('click', event => { const dark = !$('#roomPreview').classList.contains('dark-room'); $('#roomPreview').classList.toggle('dark-room', dark); event.currentTarget.setAttribute('aria-pressed', String(dark)); event.currentTarget.textContent = dark ? '☀ ROOM LIGHTS ON' : '☾ ROOM LIGHTS OFF'; $('#roomImage').src = dark ? designs[design].on : designs[design].off; $('#roomImage').alt = `${designs[design].label} Light Box with room lights ${dark ? 'off' : 'on'}`; });
  $$('.lightbox-faq details').forEach(item => item.addEventListener('toggle', () => { if (item.open) track('faq_opened', { productId: current().productId, question: item.querySelector('summary').textContent }); }));
  const sectionObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => entries.forEach(entry => { if (!entry.isIntersecting) return; if (entry.target.classList.contains('a4-visual')) track('dimensions_viewed', { productId: current().productId }); if (entry.target.classList.contains('remote-demo')) track('remote_demo_viewed', { productId: current().productId }); sectionObserver.unobserve(entry.target); }), { threshold: .35 }) : null;
  $$('.a4-visual,.remote-demo').forEach(node => sectionObserver?.observe(node));

  function familyProducts(category) { return catalogue.products.filter(product => product.categories.includes(category) && product.images?.length).slice(0, 8); }
  const families = [
    { category: 'Glossy / Regular Stickers', host: $('#regularFamily') },
    { category: 'Holographic Stickers', host: $('#holoFamily') },
    { category: 'Fridge Magnets', host: $('#magnetFamily') }
  ];
  families.forEach(family => { family.items = familyProducts(family.category); family.host.innerHTML = family.items.map((product, index) => `<button class="family-item${index === 0 ? ' active' : ''}" data-family-product="${product.id}" aria-label="View ${product.name}"><img src="${product.images[0]}" alt="" loading="lazy"><span>${product.name}</span></button>`).join(''); });
  let familyIndex = 0;
  setInterval(() => { if (document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return; const rect = $('.family-browsers').getBoundingClientRect(); if (rect.bottom < 0 || rect.top > innerHeight) return; familyIndex += 1; families.forEach(family => [...family.host.querySelectorAll('.family-item')].forEach((item, index) => item.classList.toggle('active', index === familyIndex % family.items.length))); }, 4500);
  $$('[data-family-open]').forEach(button => button.addEventListener('click', () => window.TPTStore.setCategory(button.dataset.familyOpen)));
  $$('[data-family-product]').forEach(button => button.addEventListener('click', () => { window.TPTStore.setCategory(catalogue.products.find(item => item.id === button.dataset.familyProduct).categories[0]); }));

  const eligibleStickers = catalogue.products.filter(product => product.variants.some(variant => variant.finish === 'Glossy / Regular') && product.id !== 'PACK-10').slice(0, 24);
  const packSelection = new Set();
  const packPicker = $('#packPicker');
  packPicker.innerHTML = eligibleStickers.map(product => `<button data-pack-product="${product.id}" aria-pressed="false"><img src="${product.images?.[0] || product.variants[0].image}" alt="" loading="lazy"><span>${product.name}</span></button>`).join('');
  function renderPack() { const pack = catalogue.products.find(item => item.id === 'PACK-10'), size = $('#packSize').value, variant = pack.variants.find(item => item.size === size); $('#packCount').textContent = `${packSelection.size} / 10 selected`; $('#packPrice').textContent = `₹${variant.price.toLocaleString('en-IN')}`; $('#packAdd').disabled = packSelection.size !== 10; }
  packPicker.addEventListener('click', event => { const button = event.target.closest('[data-pack-product]'); if (!button) return; const id = button.dataset.packProduct; if (packSelection.has(id)) packSelection.delete(id); else if (packSelection.size < 10) packSelection.add(id); else { window.TPTStore.toast('Exactly 10 stickers can be selected'); return; } button.classList.toggle('selected', packSelection.has(id)); button.setAttribute('aria-pressed', String(packSelection.has(id))); renderPack(); });
  $('#packSize')?.addEventListener('change', renderPack);
  $('#packAdd')?.addEventListener('click', () => { if (packSelection.size !== 10) return; const pack = catalogue.products.find(item => item.id === 'PACK-10'), variant = pack.variants.find(item => item.size === $('#packSize').value), names = [...packSelection].map(id => catalogue.products.find(item => item.id === id)?.name).filter(Boolean); window.TPTStore.addProduct(pack, variant, 1, names.join(', ')); track('bundle_clicked', { productId: 'PACK-10', size: variant.size }); });
  renderPack();

  function renderRecent() { const lightboxIds = new Set(Object.values(designs).map(item => item.productId)), ids = safeParse('tpt-recent-v1', []).filter(id => !lightboxIds.has(id)).slice(0, 4); const products = ids.map(id => catalogue.products.find(item => item.id === id)).filter(Boolean); if (!products.length) return; $('#recentSection').hidden = false; $('#recentProducts').innerHTML = products.map(product => `<button data-recent-category="${product.categories[0]}"><img src="${product.images?.[0] || product.variants[0]?.image || ''}" alt="" loading="lazy"><b>${product.name}</b><span>View again</span></button>`).join(''); $$('#recentProducts button').forEach(button => button.addEventListener('click', () => window.TPTStore.setCategory(button.dataset.recentCategory))); }
  renderRecent();

  const mobileBuy = $('#mobileBuy');
  const heroActions = $('.lightbox-actions');
  if ('IntersectionObserver' in window && mobileBuy && heroActions) new IntersectionObserver(entries => { const visible = !entries[0].isIntersecting && scrollY > heroActions.offsetTop; mobileBuy.classList.toggle('visible', visible); mobileBuy.setAttribute('aria-hidden', String(!visible)); }, { threshold: 0 }).observe(heroActions);
  $('#mobileBuyButton')?.addEventListener('click', () => $('#lightboxBuyNow').click());
})();
