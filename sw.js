// Our own notification-tap handler goes FIRST so tapping an alert always opens/focuses the app (never a blank loading page)
self.addEventListener('notificationclick',function(e){
  try{ e.stopImmediatePropagation(); }catch(_){}
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(list){
    for(var i=0;i<list.length;i++){ var c=list[i]; if(c.url.indexOf(self.registration.scope)===0&&'focus' in c) return c.focus(); }
    return self.clients.openWindow(self.registration.scope);
  }));
});
// OneSignal push support (wrapped so a blocked network never breaks the app's own worker)
try{importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js')}catch(e){}
const C='hipco-v28';
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
// newest file from GitHub; if the network is slow or down (e.g. phone just woke up from a notification) use the saved copy after 3 s.
// Saved copies ignore ?t=… cache-busters so the fallback always finds them.
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET'||!r.url.startsWith(self.location.origin)) return;
  const u=new URL(r.url); if(/\.pdf$/i.test(u.pathname)) return;
  const key=u.origin+u.pathname;
  e.respondWith((async()=>{
    const cache=await caches.open(C); const hit=await cache.match(key);
    const net=fetch(new Request(r.url,{cache:'no-cache',credentials:'same-origin'})).then(res=>{ if(res.ok&&res.status===200){ try{ cache.put(key,res.clone()); }catch(_){} } return res; });
    if(!hit) return net;
    return Promise.race([net.catch(()=>hit),new Promise(ok=>setTimeout(()=>ok(hit),3000))]);
  })());
});
