const crypto=require('node:crypto');
const HASH='tpt:reviews:v1', INDEX='tpt:review-index:v1';
const known=require('../review-products.json'),groups=require('../review-groups.json');
const auth=(given,expected)=>typeof given==='string'&&given.length<513&&crypto.timingSafeEqual(crypto.createHash('sha256').update(given).digest(),crypto.createHash('sha256').update(expected).digest());
function validate(input){
 if(!input||JSON.stringify(input).length>4000||!known.includes(input.productId)||!Number.isInteger(input.rating)||input.rating<1||input.rating>5||typeof input.text!=='string'||input.text.trim().length<10||input.text.length>1200||input.website||input.consent!==true)throw Error('Choose a product, rating and 10–1,200 characters. Confirm anonymous publication.');
 return {productId:input.productId,rating:input.rating,text:input.text.trim().replace(/[\u0000-\u0008]/g,''),author:'Anonymous'};
}
const publicReview=r=>({id:r.id,productId:r.productId,rating:r.rating,text:r.text,author:'Anonymous',createdAt:r.createdAt,edited:Boolean(r.edited),productName:groups[r.productId]?.name||r.productId,group:groups[r.productId]?.group||'Other'});
module.exports=async(req,res)=>{
 const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN,password=process.env.CATALOGUE_ADMIN_PASSWORD;
 res.setHeader('Cache-Control','no-store');
 if(!url||!token||!password)return res.status(503).json({error:'Review submissions are not open yet. Please check back soon.',configured:false});
 const command=async args=>{const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args)}),data=await r.json();if(!r.ok||data.error)throw Error('Reviews storage unavailable');return data.result;};
 try{
  const manage=req.query?.manage==='1';
  if((manage||req.method==='PATCH')&&!auth(req.headers['x-catalogue-secret'],password))return res.status(401).json({error:'Incorrect owner password'});
  if(req.method==='GET'){
   const ids=await command(['ZREVRANGE',INDEX,0,499]);const values=ids.length?await command(['HMGET',HASH,...ids]):[];
   const reviews=values.filter(Boolean).map(v=>typeof v==='string'?JSON.parse(v):v);
   const group=groups[req.query.productId]?.group;return res.status(200).json({configured:true,group:group||'All products',reviews:manage?reviews:reviews.filter(r=>r.status==='approved'&&(!req.query.productId||groups[r.productId]?.group===group)).map(publicReview)});
  }
  const host=req.headers['x-forwarded-host']||req.headers.host,origin=req.headers.origin;
  if(origin&&new URL(origin).host!==host)return res.status(403).json({error:'Use the review form on this website.'});
  const input=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(req.method==='POST'){
   const clean=validate(input);
   const fingerprint=crypto.createHmac('sha256',password).update(String(req.headers['x-forwarded-for']||'unknown').split(',')[0]).digest('hex');
   const script="local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],86400) end;return n";
   if(await command(['EVAL',script,1,'tpt:review-limit:'+fingerprint])>3)return res.status(429).json({error:'Review limit reached. Please try again tomorrow.'});
   const review={...clean,id:crypto.randomUUID(),createdAt:new Date().toISOString(),status:'pending',edited:false};
   await command(['EVAL',"redis.call('HSET',KEYS[1],ARGV[1],ARGV[2]);redis.call('ZADD',KEYS[2],ARGV[3],ARGV[1]);redis.call('ZADD',KEYS[3],ARGV[3],ARGV[1]);return 1",3,HASH,INDEX,INDEX+':'+review.productId,review.id,JSON.stringify(review),Date.now()]);
   return res.status(201).json({message:'Thank you! Your anonymous review was saved and is awaiting moderation.'});
  }
  if(req.method==='PATCH'){
   if(!/^[a-f0-9-]{36}$/.test(input?.id||''))throw Error('Invalid review');
   const value=await command(['HGET',HASH,input.id]);if(!value)return res.status(404).json({error:'Review not found'});
   const review=typeof value==='string'?JSON.parse(value):value;
   if(!['approved','pending','hidden'].includes(input.status))throw Error('Invalid review status');
   const clean=validate({...input,productId:review.productId,consent:true});
   review.edited=review.edited||review.text!==clean.text||review.rating!==clean.rating;
   review.text=clean.text;review.rating=clean.rating;review.status=input.status;review.updatedAt=new Date().toISOString();
   await command(['HSET',HASH,review.id,JSON.stringify(review)]);return res.status(200).json({message:'Review updated',review});
  }
  return res.status(405).json({error:'Method not allowed'});
 }catch(error){return res.status(400).json({error:error.message||'Could not save review'});}
};
module.exports._test={validate,publicReview,auth};
