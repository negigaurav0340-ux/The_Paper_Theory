(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const events = () => { try { return JSON.parse(localStorage.getItem('tpt-analytics-v1')) || []; } catch { return []; } };
  const today = event => new Date(event.time).toDateString() === new Date().toDateString();
  const lightboxIds = ['LIT-001','LIT-GOKU','LIT-LUFFY'];
  const count = (list, name, productId) => list.filter(event => event.name === name && (!productId || (Array.isArray(productId) ? productId.includes(event.productId) : event.productId === productId))).length;
  const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const pct = (part, whole) => whole ? `${((part / whole) * 100).toFixed(1)}%` : '0%';
  function render() {
    const all = events(), day = all.filter(today), visitors = new Set(day.map(event => event.sessionId).filter(Boolean)).size;
    const orders = day.filter(event => event.name === 'order_placed'), revenue = orders.reduce((sum, event) => sum + Number(event.revenue || 0), 0);
    const checkouts = count(day, 'checkout_started'), carts = count(day, 'add_to_cart');
    $('#visitorsToday').textContent = visitors; $('#ordersToday').textContent = orders.length; $('#revenueToday').textContent = money(revenue); $('#conversionRate').textContent = pct(orders.length, visitors);
    $('#ordersHour').textContent = orders.filter(event => Date.now() - new Date(event.time).getTime() < 3600000).length; $('#checkoutsToday').textContent = checkouts; $('#averageOrder').textContent = money(orders.length ? revenue / orders.length : 0); $('#cartsToday').textContent = carts; $('#lastUpdated').textContent = `Updated ${new Date().toLocaleTimeString('en-IN')}`;
    const lightbox = catalogueProductRows(all); $('#lightboxPerformance').innerHTML = lightbox;
    const stages = [
      ['VIEWED PRODUCT', count(all,'product_view',lightboxIds)], ['INTERACTED', count(all,'comparison_slider_started',lightboxIds)], ['ADDED TO CART', count(all,'add_to_cart',lightboxIds)], ['STARTED CHECKOUT', count(all,'checkout_started')], ['ORDERED', count(all,'order_placed',lightboxIds)]
    ];
    $('#funnel').innerHTML = stages.map((stage,index) => `<article><span>${stage[0]}</span><b>${stage[1]}</b><small>${index ? pct(stage[1],stages[index-1][1])+' from previous stage' : 'real recorded events'}</small></article>`).join('');
    const families = ['Glossy / Regular Stickers','Holographic Stickers','Custom Packages / Bundles','Fridge Magnets'];
    $('#familyPerformance').innerHTML = families.map(family => { const ids = window.CATALOGUE.products.filter(product => product.categories.includes(family)).map(product => product.id), relevant = name => all.filter(event => event.name === name && ids.includes(event.productId)); const familyOrders = relevant('order_placed'); return `<tr><td>${family}</td><td>${relevant('product_view').length}</td><td>${relevant('wishlist_added').length}</td><td>${relevant('add_to_cart').length}</td><td>${familyOrders.length}</td><td>${money(familyOrders.reduce((sum,event)=>sum+Number(event.revenue||0),0))}</td></tr>`; }).join('');
    const groupedSources = Object.entries(orders.reduce((map,event)=>{ const key=event.source||'direct'; map[key]=(map[key]||0)+1; return map; },{})); if(groupedSources.length) $('#sourceReport').innerHTML=groupedSources.map(([key,value])=>`<p><b>${key}</b> · ${value} order${value===1?'':'s'}</p>`).join('');
    if(orders.length) $('#orderFeed').innerHTML=orders.slice().reverse().map(event=>`<p>${event.orderId||'Order'} · ${new Date(event.time).toLocaleString('en-IN')} · ${event.productId||'Multiple products'} · ${money(event.revenue)} · ${event.source||'direct'} · ${event.status||'NEW'}</p>`).join('');
  }
  function catalogueProductRows(all) {
    const products = window.CATALOGUE.products.filter(item=>lightboxIds.includes(item.id));
    const productEvents=all.filter(event=>lightboxIds.includes(event.productId)), overallOrders=productEvents.filter(event=>event.name==='order_placed');
    const overall=`<tr><td><b>All Light Boxes</b></td><td>${count(productEvents,'product_view')}</td><td>${count(productEvents,'comparison_slider_started')}</td><td>${count(productEvents,'product_video_started')}</td><td>${count(productEvents,'add_to_cart')}</td><td>${count(all,'checkout_started')}</td><td>${overallOrders.length}</td><td>${money(overallOrders.reduce((sum,event)=>sum+Number(event.revenue||0),0))}</td><td>${pct(overallOrders.length,count(productEvents,'product_view'))}</td></tr>`;
    const designs=products.map(product=>{ const relevant=all.filter(event=>event.productId===product.id), views=count(relevant,'product_view'), sliders=count(relevant,'comparison_slider_started'), videos=count(relevant,'product_video_started'), carts=count(relevant,'add_to_cart'), checkouts=count(relevant,'checkout_started'), orders=relevant.filter(event=>event.name==='order_placed'), revenue=orders.reduce((sum,event)=>sum+Number(event.revenue||0),0); return `<tr><td>${product.name}</td><td>${views}</td><td>${sliders}</td><td>${videos}</td><td>${carts}</td><td>${checkouts}</td><td>${orders.length}</td><td>${money(revenue)}</td><td>${pct(orders.length,views)}</td></tr>`; }).join('');
    return overall+designs;
  }
  const refreshButton = $('#refreshAdmin');
  refreshButton.addEventListener('click', () => {
    refreshButton.disabled = true; refreshButton.textContent = 'Refreshing…';
    requestAnimationFrame(() => { render(); refreshButton.textContent = 'Updated ✓'; setTimeout(() => { refreshButton.disabled = false; refreshButton.textContent = 'Refresh'; }, 900); });
  });
  window.addEventListener('storage', event => { if (event.key === 'tpt-analytics-v1') render(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  render();
})();
