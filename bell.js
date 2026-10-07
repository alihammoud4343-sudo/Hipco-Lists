// Notification bell + per-section notifications.
// Every alert is saved in the shared database (col 'alerts'). Each one belongs to a section:
//   stock = lists / sends / client answers / sold-hold, inq = inquiries, rem = reminders.
// Inside a section the bell shows only that section's notifications; the home cards show unread counts.
(function(){
  var CFG = window.HIPCO_CFG || {}; if(!CFG.supabaseUrl) return;
  var SECS = { stock: 'Stocklot offers', inq: 'Inquiries', rem: 'Reminders' };
  var items = [], open = false, timer = null, cur = 'home', bannerT = null, lastBannerAt = {};
  function lsg(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lss(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
  function seen(c){ return +lsg('hipco_seen_' + c) || 0; }
  function mark(c){ lss('hipco_seen_' + c, String(Date.now())); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function cat(t){ t = (t || '').toLowerCase(); if(/inquiry/.test(t)) return 'inq'; if(/reminder/.test(t)) return 'rem'; return 'stock'; }
  function ago(ms){
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000)); if(s < 60) return 'just now';
    var m = Math.round(s / 60); if(m < 60) return m + ' min ago';
    var h = Math.round(m / 60); if(h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    var d = Math.round(h / 24); return d + (d === 1 ? ' day ago' : ' days ago');
  }
  function when(ms){
    try{
      var d = new Date(ms), n = new Date(), tm = d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true });
      var sd = function(x){ return x.getFullYear() + '-' + x.getMonth() + '-' + x.getDate(); }, y = new Date(n.getTime() - 86400000);
      if(sd(d) === sd(n)) return 'Today, ' + tm; if(sd(d) === sd(y)) return 'Yesterday, ' + tm;
      return d.toLocaleDateString('en-US', { day:'numeric', month:'short' }) + ', ' + tm;
    }catch(e){ return ''; }
  }
  function icon(t){
    t = (t || '').toLowerCase();
    if(/deleted|removed/.test(t)) return '🗑️'; if(/inquiry/.test(t)) return '❓'; if(/reminder/.test(t)) return '⏰';
    if(/sent/.test(t)) return '📤'; if(/sold|hold|available/.test(t)) return '📦'; if(/new list|list sl/.test(t)) return '📄'; return '🔔';
  }
  // which section is on screen right now (read from the page, so Back/Home/popstate all work)
  function section(){
    var h = document.querySelector('.home'), iq = document.getElementById('inqView'), rm = document.getElementById('remView');
    if(h && !h.hidden) return 'home'; if(iq && !iq.hidden) return 'inq'; if(rm && !rm.hidden) return 'rem'; return 'stock';
  }
  function unread(c){ return items.filter(function(x){ return x.cat === c && x.at > seen(c); }).length; }
  var btn = document.createElement('button');
  btn.id = 'bellBtn'; btn.type = 'button'; btn.className = 'icon-btn'; btn.title = 'Notifications'; btn.setAttribute('aria-label', 'Notifications'); btn.style.position = 'relative';
  btn.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg><span id="bellBadge" style="display:none;position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;border-radius:9px;background:#E5484D;color:#fff;font:700 11px/18px system-ui;text-align:center;padding:0 4px"></span>';
  var panel = document.createElement('div');
  panel.id = 'bellPanel'; panel.hidden = true;
  panel.style.cssText = 'position:fixed;inset:0;z-index:140;background:rgba(8,14,33,.55);display:flex;justify-content:flex-end';
  panel.innerHTML = '<div style="width:min(420px,100%);height:100%;background:var(--surface);color:var(--ink);display:flex;flex-direction:column;box-shadow:var(--shadow-lift)">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:calc(14px + env(safe-area-inset-top,0px)) 16px 12px;border-bottom:1px solid var(--line)"><div><div id="bellTitle" style="font:400 24px var(--f-display)">Notifications</div><div id="bellSub" style="font-size:12px;color:var(--ink-2);margin-top:2px"></div></div><button id="bellX" type="button" aria-label="Close" style="flex:none;border:0;background:var(--chip);color:var(--ink);width:36px;height:36px;border-radius:50%;font-size:20px;cursor:pointer">×</button></div>' +
    '<div id="bellList" style="flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:6px 16px calc(24px + env(safe-area-inset-bottom,0px))"></div></div>';
  var homeBadges = {};
  function badges(){
    cur = section();
    var n = cur === 'home' ? unread('stock') + unread('inq') + unread('rem') : unread(cur), b = document.getElementById('bellBadge');
    [b, document.getElementById('bellBadge2')].forEach(function(x){ if(x){ x.style.display = n ? 'block' : 'none'; x.textContent = n > 99 ? '99+' : n; } });
    ['stock', 'inq', 'rem'].forEach(function(c){ var e = homeBadges[c]; if(!e) return; var k = unread(c); e.style.display = k ? 'inline-block' : 'none'; e.textContent = k + ' new'; });
  }
  function draw(){
    var el = document.getElementById('bellList'); if(!el) return;
    cur = section();
    document.getElementById('bellTitle').textContent = cur === 'home' ? 'Notifications' : SECS[cur];
    document.getElementById('bellSub').textContent = cur === 'home' ? 'Everything, newest first' : 'Notifications for this section';
    var list = cur === 'home' ? items : items.filter(function(x){ return x.cat === cur; });
    if(!list.length){ el.innerHTML = '<div style="text-align:center;color:var(--ink-2);padding:48px 12px;font-size:13px">No notifications yet.</div>'; return; }
    var lastSeen = open ? (panel._seen || {}) : {};
    el.innerHTML = list.map(function(x){
      var isNew = x.at > ((panel._seen || {})[x.cat] || 0);
      return '<div style="display:flex;gap:12px;padding:13px 0;border-bottom:1px solid var(--line)"><div style="flex:none;font-size:20px;width:28px;text-align:center">' + icon(x.t) + '</div><div style="min-width:0;flex:1"><div style="font-weight:700;font-size:14px;line-height:1.35">' + esc(x.t) + (isNew ? ' <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#E5484D;vertical-align:1px"></span>' : '') + '</div>' +
        (cur === 'home' ? '<div style="font-size:10.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--navy);margin-top:2px">' + SECS[x.cat] + '</div>' : '') +
        (x.b ? '<div style="font-size:13px;color:var(--ink);margin-top:2px;line-height:1.45;word-break:break-word;white-space:pre-line">' + esc(x.b) + '</div>' : '') +
        '<div style="font-size:11.5px;color:var(--ink-2);margin-top:4px">' + ago(x.at) + ' · ' + when(x.at) + '</div></div>' +
        '<button type="button" data-del="' + esc(x.id) + '" aria-label="Delete notification" style="flex:none;align-self:flex-start;border:0;background:var(--chip);color:var(--ink-2);width:36px;height:36px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/></svg></button></div>';
    }).join('');
  }
  function hdrs(){ var h = { apikey: CFG.anonKey, 'x-hipco': CFG.dbCode || '', 'Content-Type': 'application/json' }; if(!/^sb_/.test(CFG.anonKey)) h.Authorization = 'Bearer ' + CFG.anonKey; return h; }
  async function del(id){
    items = items.filter(function(x){ return x.id !== id; }); badges(); draw();
    try{ await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/kv?col=eq.alerts&id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: hdrs() }); }catch(e){}
  }
  // small banner when you enter a section that has new notifications
  function banner(c){
    var fresh = items.filter(function(x){ return x.cat === c && x.at > seen(c); }); if(!fresh.length) return;
    var el = document.getElementById('bellBanner');
    if(!el){ el = document.createElement('div'); el.id = 'bellBanner'; el.style.cssText = 'position:fixed;left:12px;right:12px;top:calc(10px + env(safe-area-inset-top,0px));z-index:135;max-width:520px;margin:0 auto;background:var(--navy);color:#fff;border-radius:14px;padding:11px 14px;box-shadow:var(--shadow-lift);font:600 13px/1.4 var(--f-body);cursor:pointer'; document.body.appendChild(el); el.addEventListener('click', function(){ el.style.display = 'none'; show(); }); }
    el.innerHTML = '🔔 ' + fresh.length + ' new in ' + SECS[c] + '<div style="font-weight:500;opacity:.9;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(fresh[0].t) + (fresh[0].b ? ' — ' + esc(fresh[0].b.split('\n')[0]) : '') + '</div>';
    el.style.display = 'block'; clearTimeout(bannerT); bannerT = setTimeout(function(){ el.style.display = 'none'; }, 7000);
  }
  var lastSec = null;
  function onSection(){
    var s = section(); if(s === lastSec) return;
    if(lastSec && lastSec !== 'home' && !open) mark(lastSec);   // leaving a section: what was shown there counts as seen
    lastSec = s; badges();
    if(s !== 'home' && !open){ banner(s); }
    var el = document.getElementById('bellBanner'); if(el && s === 'home') el.style.display = 'none';
  }
  async function load(){
    try{
      var c = new AbortController(), t = setTimeout(function(){ c.abort(); }, 8000);
      var r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/kv?select=id,data&col=eq.alerts&order=id.desc&limit=120', { headers: hdrs(), signal: c.signal }); clearTimeout(t);
      if(!r.ok) return; var rows = await r.json();
      items = rows.map(function(x){ var d = x.data || {}; return { id: x.id, t: d.t || '', b: d.b || '', at: +d.at || +x.id || 0, cat: cat(d.t) }; }).filter(function(x){ return x.at; }).sort(function(a, b){ return b.at - a.at; });
      badges(); if(open) draw();
      var s = section(); if(s !== 'home' && !open && !lastBannerAt[s]){ lastBannerAt[s] = 1; banner(s); }
    }catch(e){}
  }
  function show(){
    open = true; panel.hidden = false; panel._seen = { stock: seen('stock'), inq: seen('inq'), rem: seen('rem') };
    document.documentElement.style.overflow = 'hidden';
    var s = section(); if(s === 'home'){ mark('stock'); mark('inq'); mark('rem'); } else mark(s);
    badges(); draw(); load(); timer = setInterval(function(){ load(); draw(); }, 20000);
  }
  function hide(){ open = false; panel.hidden = true; document.documentElement.style.overflow = ''; clearInterval(timer); badges(); }
  function init(){
    var bar = document.querySelector('.hero-actions'); if(!bar || document.getElementById('bellBtn')) return;
    bar.insertBefore(btn, bar.firstChild); document.body.appendChild(panel);
    // the home screen covers the top bar, so it gets its own bell
    var hs = document.querySelector('.home');
    if(hs){ var b2 = btn.cloneNode(true); b2.id = 'bellBtn2'; b2.querySelector('#bellBadge').id = 'bellBadge2'; b2.style.cssText = 'position:absolute;top:calc(14px + env(safe-area-inset-top,0px));right:16px;z-index:2'; hs.appendChild(b2); b2.addEventListener('click', show); }
    // unread counters on the three home cards
    var map = { stock: "__go('stock')", inq: "__go('inq')", rem: "__go('rem')" };
    document.querySelectorAll('.home-card').forEach(function(card){
      Object.keys(map).forEach(function(c){
        if((card.getAttribute('onclick') || '').indexOf(map[c]) !== -1){
          var tt = card.querySelector('.tt'); if(!tt) return;
          var b = document.createElement('span'); b.style.cssText = 'display:none;margin-left:8px;background:#E5484D;color:#fff;border-radius:999px;font:700 11px/1 system-ui;padding:3px 8px;vertical-align:2px'; tt.appendChild(b); homeBadges[c] = b;
        }
      });
    });
    btn.addEventListener('click', show);
    panel.addEventListener('click', function(e){
      if(e.target === panel || e.target.id === 'bellX'){ hide(); return; }
      var b = e.target.closest ? e.target.closest('[data-del]') : null; if(b) del(b.getAttribute('data-del'));
    });
    try{ var mo = new MutationObserver(onSection); ['.home', '#inqView', '#remView'].forEach(function(q){ var n = document.querySelector(q); if(n) mo.observe(n, { attributes: true, attributeFilter: ['hidden', 'class', 'style'] }); }); }catch(e){}
    setInterval(onSection, 700);
    load(); setInterval(function(){ if(!open) load(); }, 45000);
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) load(); });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
