// Sends OneSignal push notifications. Runs inside GitHub Actions (key comes from the ONESIGNAL_API_KEY secret, never from the repo).
// usage: node tools/notify.mjs new <old_vault.json> <new_vault.json>   → one alert per salesman for every NEW list
//        node tools/notify.mjs test <Name>                              → test alert to one salesman
import fs from 'node:fs';
const APP_ID='9722a093-2b4b-4002-a1d8-bc4910456d78', KEY=process.env.ONESIGNAL_API_KEY, URL_='https://alihammoud4343-sudo.github.io/Hipco-Lists/';
console.log('::notice title=notify::key present='+(!!KEY)+' length='+(KEY||'').length+' prefix='+(KEY||'').slice(0,10));
if(!KEY){ console.log('::error title=notify::No ONESIGNAL_API_KEY secret — nothing sent'); process.exit(1); }
async function send(name,title,body){
  const r=await fetch('https://api.onesignal.com/notifications?c=push',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Key '+KEY},
    body:JSON.stringify({app_id:APP_ID,target_channel:'push',filters:[{field:'tag',key:'n_'+name,relation:'=',value:'1'}],headings:{en:title},contents:{en:body},url:URL_})});
  const t=await r.text(); console.log('::notice title=send-'+name+'::status '+r.status+' '+t.replace(/\n/g,' ').slice(0,200)); if(!r.ok||/"errors"/.test(t)){ process.exitCode=1; } return r.ok;
}
const [mode,a,b]=process.argv.slice(2);
if(mode==='test'){ await send(a,'HIPCO test','Notifications work ✓ You will get an alert here when a new list is added.'); process.exit(0); }
if(mode==='new'){
  const old=fs.existsSync(a)?JSON.parse(fs.readFileSync(a,'utf8')):{docs:[]}, cur=JSON.parse(fs.readFileSync(b,'utf8'));
  const seen=new Set((old.docs||[]).map(d=>d.reference));
  const fresh=(cur.docs||[]).filter(d=>!seen.has(d.reference));
  console.log('new lists:',fresh.map(d=>d.reference).join(', ')||'none');
  for(const d of fresh){
    const bd=d.client_match_breakdown||{}; const prod=(d.product||'').replace(/\s*\((Sheets|Rolls)[^)]*\)\s*$/i,'');
    const title='New list '+d.reference.split('-')[0]+' · '+(d.quality_group||prod);
    for(const [name,n] of Object.entries(bd)){ if(!n) continue;
      await send(name,title,[d.type,d.qty_mt,d.gsm].filter(Boolean).join(' · ')+' — '+n+' of your clients matched'); }
    await send('Summary',title+' (summary)',[d.type,d.qty_mt].filter(Boolean).join(' · ')+' — '+(d.client_match_count||0)+' clients matched: '+Object.entries(bd).map(([k,v])=>k+' '+v).join(', '));
  }
}
