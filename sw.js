// always ask GitHub for the newest file (no stale copies); use the saved copy only when offline
// OneSignal push support (wrapped so a blocked network never breaks the app's own worker)
try{importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js')}catch(e){}
const C='hipco-v16';
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||!r.url.startsWith(self.location.origin))return;
// newest file from GitHub, but never leave the screen waiting: if the network takes over 3 s and a saved copy exists, use the saved copy
const net=fetch(new Request(r.url,{cache:'no-cache',credentials:'same-origin'})).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r.url,cp))}return res});
const slow=caches.match(r.url).then(hit=>hit?new Promise(ok=>setTimeout(()=>ok(hit),3000)):new Promise(()=>{}));
e.respondWith(Promise.race([net,slow]).catch(()=>caches.match(r.url)))});
