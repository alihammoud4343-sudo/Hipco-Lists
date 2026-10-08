const APP='9722a093-2b4b-4002-a1d8-bc4910456d78',KEY=process.env.ONESIGNAL_API_KEY;
const n=(t,m)=>console.log(`::notice title=${t}::${String(m).replace(/\n/g,' ').slice(0,900)}`);
const H={Authorization:'Key '+KEY};
let r=await fetch('https://api.onesignal.com/notifications?app_id='+APP+'&limit=6',{headers:H}); let j=await r.json().catch(()=>({}));
n('list-status',r.status);
for(const x of (j.notifications||[])) n('notif',JSON.stringify({id:x.id,h:(x.headings||{}).en,sent:x.send_after||x.completed_at,successful:x.successful,failed:x.failed,errored:x.errored,remaining:x.remaining,converted:x.converted,seg:x.included_segments,canceled:x.canceled,errors:x.errors}));
r=await fetch('https://api.onesignal.com/apps/'+APP,{headers:H}); j=await r.json().catch(()=>({})); n('app',JSON.stringify({players:j.players,messageable:j.messageable_players,name:j.name}));
r=await fetch('https://api.onesignal.com/apps/'+APP+'/users/by/onesignal_id/c8b7832d-5f94-43cf-9c16-4fef981b2fdc',{headers:H}); j=await r.json().catch(()=>({})); n('ali-status',r.status);
for(const s of (j.subscriptions||[])) n('ali-sub',JSON.stringify({id:s.id,type:s.type,enabled:s.enabled,nt:s.notification_types,sdk:s.sdk,os:s.device_os,model:s.device_model,token:(s.token||'').slice(0,30)}));
