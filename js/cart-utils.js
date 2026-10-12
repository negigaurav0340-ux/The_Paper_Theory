(function(root){'use strict';
 function normalize(items,products){if(!Array.isArray(items))return [];const result=[];
  for(const item of items){if(!item||!Number.isInteger(item.quantity)||item.quantity<1)continue;
   if(item.type==='product'){const product=products.find(p=>p.id===item.productId),variant=product?.variants?.find(v=>v.id===item.variantId);if(!product||!variant||!Number.isFinite(variant.price)||variant.price<0)continue;const selection=typeof item.selection==='string'?item.selection.slice(0,8000):'',key=product.id+'|'+variant.id+'|'+selection,prior=result.find(r=>r.key===key);if(prior)prior.quantity=Math.min(99,prior.quantity+item.quantity);else result.push({type:'product',key,productId:product.id,variantId:variant.id,selection,quantity:Math.min(99,item.quantity)});
   }else if(item.type==='custom'&&typeof item.key==='string'&&typeof item.name==='string'&&item.name.trim())result.push({...item,quantity:Math.min(99,item.quantity)});
  }return result;
 }const api={normalize};if(typeof module!=='undefined')module.exports=api;if(root)root.TPTCartUtils=api;
})(typeof window!=='undefined'?window:null);
