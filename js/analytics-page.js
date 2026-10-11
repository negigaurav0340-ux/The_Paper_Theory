(()=>{
'use strict';
if(window.TPTAnalytics)return;
const read=(store,key,fallback)=>{try{return JSON.parse(store.getItem(key))??fallback}catch{return fallback}},write=(store,key,value)=>{try{store.setItem(key,JSON.stringify(value))}catch{}};
const sessionId=read(sessionStorage,'tpt-session-v2',null)||crypto.randomUUID();write(sessionStorage,'tpt-session-v2',sessionId);
const params=new URLSearchParams(location.search);let source=params.get('utm_source');if(!source){try{const ref=new URL(document.referrer);source=ref.host===location.host?read(sessionStorage,'tpt-source-v2','direct'):ref.hostname}catch{source='direct'}}
source=String(source||'direct').slice(0,80);write(sessionStorage,'tpt-source-v2',source);
const firstSource=read(localStorage,'tpt-first-source-v2',source);write(localStorage,'tpt-first-source-v2',firstSource);
const recent=new Map();
function track(name,detail={}){
 const signature=[name,detail.productId,detail.variantId,detail.surface].join('|'),now=Date.now();
 const interval=['product_view','light_on_viewed','light_off_viewed','comparison_slider_started','comparison_slider_completed','checkout_started'].includes(name)?30000:0;
 if(interval&&now-(recent.get(signature)||0)<interval)return;recent.set(signature,now);
 const item={...detail,name,eventId:crypto.randomUUID(),time:new Date(now).toISOString(),sessionId,source,firstSource,medium:params.get('utm_medium')||'',campaign:params.get('utm_campaign')||'',path:location.pathname,device:innerWidth<700?'mobile':innerWidth<1024?'tablet':'desktop'};
 const events=read(localStorage,'tpt-analytics-v1',[]);events.push(item);write(localStorage,'tpt-analytics-v1',events.slice(-5000));
 window.dispatchEvent(new CustomEvent('tpt:analytics',{detail:item}));
 if(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname))fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item),keepalive:true}).catch(()=>{});
}
window.TPTAnalytics={track};track('page_view');
})();
