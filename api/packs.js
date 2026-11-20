const crypto = require('node:crypto');
const path = 'js/pack-updates.js';
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
const validate = require('../server/pack-validation.cjs').validate;
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
  if(!file)return {upserts:[],hiddenIds:[]};
  const source=Buffer.from(file.content.replace(/\s/g,''),'base64').toString('utf8');
  const match=source.match(/window\.TPT_PACK_UPDATES\s*=\s*([\s\S]*);\s*$/);
  if(!match)throw Error('Product update file format is invalid');
  return validate(JSON.parse(match[1]));
}
module.exports=async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  const cfg=config();
  if(!cfg)return res.status(503).json({error:'Live product manager is not configured'});
  try{
    if(req.method==='GET')return res.status(200).json({data:parse(await github(cfg,'GET')),live:true});
    if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
    if(!authorized(req.headers['x-catalogue-secret'],cfg.password))return res.status(401).json({error:'Incorrect manager password'});
    const data=validate(typeof req.body==='string'?JSON.parse(req.body):req.body);
    const existing=await github(cfg,'GET');
    const source='/* The Paper Theory product updates */\nwindow.TPT_PACK_UPDATES = '+JSON.stringify(data,null,2)+';\n';
    await github(cfg,'PUT',source,existing?.sha);
    return res.status(200).json({data,live:true});
  }catch(error){return res.status(400).json({error:error.message || 'Could not publish products'});}
};
module.exports._test={validate,parse,authorized};
