const crypto = require('node:crypto');
const path = 'js/site-settings.js';
const code = /^[A-Z0-9-]{3,32}$/;
const variantCode = /^[A-Za-z0-9-]{2,40}$/;
const image = /^(?:data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/=]+|assets\/[A-Za-z0-9_./-]+\.(?:webp|png|jpe?g))$/;
const text = (value,max=2000) => typeof value === 'string' && value.length > 0 && value.length <= max;
function config() {
  const repo=process.env.CATALOGUE_REPO || '', token=process.env.CATALOGUE_GITHUB_TOKEN, password=process.env.CATALOGUE_ADMIN_PASSWORD;
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) && token && password ? {repo,token,password,branch:process.env.CATALOGUE_BRANCH || 'main'} : null;
}
function authorized(given,expected) {
  if (typeof given !== 'string' || !given || given.length > 512) return false;
  const a=crypto.createHash('sha256').update(given).digest(),b=crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a,b);
}
function validate(input) {
 const limits={heroTitle:120,heroDescription:500,announcement:200,whatsapp:20,instagram:200,shipping:600,seoTitle:100,seoDescription:250};
 if(!input || typeof input!=='object' || JSON.stringify(input).length>6000)throw Error('Invalid settings');
 const output={};for(const [key,max] of Object.entries(limits)){if(typeof input[key]!=='string'||input[key].length>max)throw Error('Invalid '+key);output[key]=input[key];}
 if(!/^\d{10,15}$/.test(output.whatsapp))throw Error('WhatsApp needs country code and digits only');
 if(!/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]+\/?$/.test(output.instagram))throw Error('Use your Instagram profile URL');
 return output;
}
async function github(cfg,method,content,sha) {
  const url=`https://api.github.com/repos/${cfg.repo}/contents/${path}`;
  const options={method,headers:{Authorization:`Bearer ${cfg.token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'The-Paper-Theory-Products'}};
  if(method==='PUT'){options.headers['Content-Type']='application/json';options.body=JSON.stringify({message:'Update products from owner manager',content:Buffer.from(content).toString('base64'),branch:cfg.branch,...(sha?{sha}:{})});}
  const response=await fetch(method==='GET'?`${url}?ref=${encodeURIComponent(cfg.branch)}`:url,options);
  const body=await response.json().catch(()=>({}));
  if(response.status===404 && method==='GET')return null;
  if(!response.ok)throw Error(`Repository request failed (${response.status})`);
  return body;
}
function parse(file) {
  if(!file)return {"heroTitle": "Your fandom. Off-screen.", "heroDescription": "A little anime for your laptop. A favourite moment for your fridge. A whole new world for your space.", "announcement": "", "whatsapp": "918219578050", "instagram": "https://instagram.com/thepapertheory.in", "shipping": "Free shipping on product subtotals of ₹699 or more. Below ₹699, shipping is calculated at order confirmation using the delivery PIN code.", "seoTitle": "Anime Stickers ₹99 & A4 Light Boxes ₹999 | The Paper Theory", "seoDescription": "Shop anime sticker sheets and long sticker packs from ₹99. Four 6 × 2 inch or two 10 × 2 inch stickers; custom gifts and A4 anime Light Boxes at ₹999."};
  const source=Buffer.from(file.content.replace(/\s/g,''),'base64').toString('utf8');
  const match=source.match(/window\.TPT_SITE_SETTINGS\s*=\s*([\s\S]*);\s*$/);
  if(!match)throw Error('Product update file format is invalid');
  return validate(JSON.parse(match[1]));
}
module.exports=async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  const cfg=config();
  if(!cfg)return res.status(503).json({error:'Live website editor is not configured'});
  try{
    if(req.method==='GET')return res.status(200).json({data:parse(await github(cfg,'GET')),live:true});
    if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
    if(!authorized(req.headers['x-catalogue-secret'],cfg.password))return res.status(401).json({error:'Incorrect manager password'});
    const data=validate(typeof req.body==='string'?JSON.parse(req.body):req.body);
    const existing=await github(cfg,'GET');
    const source='/* The Paper Theory website settings */\nwindow.TPT_SITE_SETTINGS = '+JSON.stringify(data,null,2)+';\n';
    await github(cfg,'PUT',source,existing?.sha);
    return res.status(200).json({data,live:true});
  }catch(error){return res.status(400).json({error:error.message || 'Could not publish settings'});}
};
module.exports._test={validate,parse,authorized};
