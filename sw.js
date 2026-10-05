// always ask GitHub for the newest file (no stale copies); use the saved copy only when offline
const C='hipco-v8';
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||!r.url.startsWith(self.location.origin))return;
e.respondWith(fetch(new Request(r.url,{cache:'no-cache',credentials:'same-origin'})).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r.url,cp))}return res}).catch(()=>caches.match(r.url)))});
