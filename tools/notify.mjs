// Sends OneSignal push notifications. Runs inside GitHub Actions (key comes from the ONESIGNAL_API_KEY secret, never from the repo).
// usage: node tools/notify.mjs new <old_vault.json> <new_vault.json>   → one alert per salesman for every NEW list
//        node tools/notify.mjs test <Name>                              → test alert to one salesman
import fs from 'node:fs';
const APP_ID='9722a093-2b4b-4002-a1d8-bc4910456d78', KEY=process.env.ONESIGNAL_API_KEY, URL_='https://alihammoud4343-sudo.github.io/Hipco-Lists/';
console.log('::notice title=notify::key present='+(!!KEY)+' length='+(KEY||'').length+' prefix='+(KEY||'').slice(0,10));
if(!KEY){ console.log('::error title=notify::No ONESIGNAL_API_KEY secret — nothing sent'); process.exit(1); }
// phones registered in the shared database (col 'push'): names -> subscription ids
let PUSH=null;
async function pushRows(){
  if(PUSH) return PUSH; PUSH=[];
  try{
    const cfg=fs.readFileSync('config.js','utf8'); const U=/supabaseUrl: "([^"]*)"/.exec(cfg)[1], K=/anonKey: "([^"]*)"/.exec(cfg)[1], C=/dbCode: "([^"]*)"/.exec(cfg)[1];
    if(U){ const r=await fetch(U+'/rest/v1/kv?select=id,data&col=eq.push',{headers:{apikey:K,'x-hipco':C}}); if(r.ok) PUSH=await r.json(); }
  }catch(e){}
  console.log('::notice title=registered-phones::'+PUSH.length+' '+JSON.stringify(PUSH.map(x=>(x.data||{}).names)));
  return PUSH;
}
import { sendAll } from './pushlib.mjs';
async function send(name,title,body){
  if(name==='ALL') return sendAll(title,body,URL_);
  if(!name.startsWith('ID:')&&name!=='ALL'){
    const rows=await pushRows(), sids=[], oids=[];
    for(const x of rows){ const d=x.data||{}; if((d.names||[]).includes(name)){ if(d.sid) sids.push(d.sid); else if(d.oid) oids.push(d.oid); } }
    if(sids.length||oids.length) return sendTo(name,{...(sids.length?{include_subscription_ids:[...new Set(sids)]}:{include_aliases:{onesignal_id:[...new Set(oids)]}})},title,body);
  }
  return sendTo(name,name.startsWith('ID:')?{include_aliases:{onesignal_id:[name.slice(3)]}}:name==='ALL'?{included_segments:['Subscribed Users']}:{filters:[{field:'tag',key:'n_'+name,relation:'=',value:'1'}]},title,body);
}
async function sendTo(name,target,title,body){
  const r=await fetch('https://api.onesignal.com/notifications?c=push',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Key '+KEY},
    body:JSON.stringify({app_id:APP_ID,target_channel:'push',...target,headings:{en:title},contents:{en:body},url:URL_})});
  const t=await r.text(); console.log('::notice title=send-'+name+'::status '+r.status+' '+t.replace(/\n/g,' ').slice(0,200)); if(!r.ok||/"errors"/.test(t)){ process.exitCode=1; } return r.ok;
}
function buildMsg(d,name){
  const bd=d.client_match_breakdown||{}; const ref=d.reference.split('-')[0];
  const title='New list '+ref+' · '+(d.quality_group||d.product);
  const l1=(d.product||'');
  const l2=[d.gsm,d.qty_mt,d.origin].filter(Boolean).join(' · ');
  const l3= name==='Summary' ? (d.client_match_count||0)+' clients matched: '+Object.entries(bd).map(([k,v])=>k+' '+v).join(', ')
                             : (bd[name]||0)+' of your clients matched — open the app to send';
  return {title, body:[l1,l2,l3].filter(Boolean).join('\n')};
}
const [mode,a,b]=process.argv.slice(2);
if(mode==='inspect'){
  const r=await fetch('https://api.onesignal.com/apps/'+APP_ID+'/users/by/onesignal_id/'+a,{headers:{Authorization:'Key '+KEY}});
  const j=await r.json().catch(()=>({})); console.log('::notice title=inspect-status::'+r.status);
  console.log('::notice title=inspect-identity::'+JSON.stringify(j.identity||{}));
  console.log('::notice title=inspect-tags::'+JSON.stringify((j.properties||{}).tags||{}));
  for(const s of (j.subscriptions||[])) console.log('::notice title=inspect-sub::'+JSON.stringify({type:s.type,enabled:s.enabled,notification_types:s.notification_types,sdk:s.sdk,app_version:s.app_version,web_auth:!!s.web_auth,device_model:s.device_model,device_os:s.device_os,token:(s.token||'').slice(0,40)}));
  process.exit(0);
}
if(mode==='testfile'){
  const j=JSON.parse(fs.readFileSync(a,'utf8'));
  if(j.ref){ const v=JSON.parse(fs.readFileSync('data/vault.json','utf8')); const d=v.docs.find(x=>x.reference.startsWith(j.ref)); const mm=buildMsg(d,j.as); await send(j.to,mm.title,mm.body); process.exit(0); }
  await send(j.to,j.title||'HIPCO test',j.body||'Notifications work ✓ You will get an alert here when a new list is added.'); process.exit(0);
}
if(mode==='test'){ await send(a,'HIPCO test','Notifications work ✓ You will get an alert here when a new list is added.'); process.exit(0); }
if(mode==='new'){
  const old=fs.existsSync(a)?JSON.parse(fs.readFileSync(a,'utf8')):{docs:[]}, cur=JSON.parse(fs.readFileSync(b,'utf8'));
  const seen=new Set((old.docs||[]).map(d=>d.reference));
  const fresh=(cur.docs||[]).filter(d=>!seen.has(d.reference));
  console.log('new lists:',fresh.map(d=>d.reference).join(', ')||'none');
  for(const d of fresh){
    // one alert to EVERYONE who has the app (all subscribed phones) — no names, no per-person setup
    const mm=buildMsg(d,'Summary'); await send('ALL',mm.title,mm.body);
  }
}
