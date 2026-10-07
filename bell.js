// Notification bell: shows the history of every alert ("5 min ago · Ahmad sent SL124 ..."), with an unread badge.
(function(){
  var CFG = window.HIPCO_CFG || {}; if(!CFG.supabaseUrl) return;
  var SEEN = 'hipco_bell_seen', items = [], open = false, timer = null, armAll = false, armTimer = null;
  function lsg(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lss(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function ago(ms){
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if(s < 60) return 'just now';
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
    if(/inquiry/.test(t)) return '❓'; if(/reminder/.test(t)) return '⏰'; if(/deleted|removed/.test(t)) return '🗑️';
    if(/sent/.test(t)) return '📤'; if(/sold|hold|available/.test(t)) return '📦'; if(/new list|list sl/.test(t)) return '📄';
    return '🔔';
  }
  var btn = document.createElement('button');
  btn.id = 'bellBtn'; btn.type = 'button'; btn.className = 'icon-btn'; btn.title = 'Notifications'; btn.setAttribute('aria-label', 'Notifications');
  btn.style.position = 'relative';
  btn.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg><span id="bellBadge" style="display:none;position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;border-radius:9px;background:#E5484D;color:#fff;font:700 11px/18px system-ui;text-align:center;padding:0 4px"></span>';
  var panel = document.createElement('div');
  panel.id = 'bellPanel'; panel.hidden = true;
  panel.style.cssText = 'position:fixed;inset:0;z-index:140;background:rgba(8,14,33,.55);display:flex;justify-content:flex-end';
  panel.innerHTML = '<div id="bellCard" style="width:min(420px,100%);height:100%;background:var(--surface);color:var(--ink);display:flex;flex-direction:column;box-shadow:var(--shadow-lift)">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:calc(14px + env(safe-area-inset-top,0px)) 16px 12px;border-bottom:1px solid var(--line)"><div style="font:400 24px var(--f-display)">Notifications</div><button id="bellX" type="button" aria-label="Close" style="border:0;background:var(--chip);color:var(--ink);width:36px;height:36px;border-radius:50%;font-size:20px;cursor:pointer">×</button></div>' +
    '<div id="bellList" style="flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:6px 16px calc(24px + env(safe-area-inset-bottom,0px))"></div></div>';
  function badge(){
    var seen = +lsg(SEEN) || 0, n = items.filter(function(x){ return x.at > seen; }).length, b = document.getElementById('bellBadge'); if(!b) return;
    b.style.display = n ? 'block' : 'none'; b.textContent = n > 99 ? '99+' : n;
  }
  function draw(){
    var el = document.getElementById('bellList'); if(!el) return;
    if(!items.length){ el.innerHTML = '<div style="text-align:center;color:var(--ink-2);padding:48px 12px;font-size:13px">No notifications yet.<br>Every new list, inquiry, reminder and update will appear here.</div>'; return; }
    var seen = +lsg(SEEN) || 0;
    el.innerHTML = '<div style="display:flex;justify-content:flex-end;padding:8px 0 0"><button type="button" id="bellClear" style="border:1px solid var(--line);background:transparent;color:var(--sold);font:600 12.5px var(--f-body);border-radius:999px;padding:7px 14px;cursor:pointer">' + (armAll ? 'Tap again to delete all' : 'Clear all') + '</button></div>' + items.map(function(x){
      return '<div style="display:flex;gap:12px;padding:13px 0;border-bottom:1px solid var(--line)"><div style="flex:none;font-size:20px;width:28px;text-align:center">' + icon(x.t) + '</div><div style="min-width:0;flex:1"><div style="font-weight:700;font-size:14px;line-height:1.35">' + esc(x.t) + (x.at > seen ? ' <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#E5484D;vertical-align:1px"></span>' : '') + '</div>' +
        (x.b ? '<div style="font-size:13px;color:var(--ink);margin-top:2px;line-height:1.45;word-break:break-word;white-space:pre-line">' + esc(x.b) + '</div>' : '') +
        '<div style="font-size:11.5px;color:var(--ink-2);margin-top:4px">' + ago(x.at) + ' · ' + when(x.at) + '</div></div><button type="button" data-del="' + esc(x.id) + '" aria-label="Delete notification" style="flex:none;align-self:flex-start;border:0;background:var(--chip);color:var(--ink-2);width:36px;height:36px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/></svg></button></div>';
    }).join('');
  }
  function hdrs(){ var h = { apikey: CFG.anonKey, 'x-hipco': CFG.dbCode || '', 'Content-Type': 'application/json' }; if(!/^sb_/.test(CFG.anonKey)) h.Authorization = 'Bearer ' + CFG.anonKey; return h; }
  async function del(id){   // id === null -> delete every notification
    var u = CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/kv?col=eq.alerts' + (id ? '&id=eq.' + encodeURIComponent(id) : '');
    items = id ? items.filter(function(x){ return x.id !== id; }) : []; badge(); draw();
    try{ await fetch(u, { method: 'DELETE', headers: hdrs() }); }catch(e){}
  }
  async function load(){
    try{
      var h = { apikey: CFG.anonKey, 'x-hipco': CFG.dbCode || '' }; if(!/^sb_/.test(CFG.anonKey)) h.Authorization = 'Bearer ' + CFG.anonKey;
      var c = new AbortController(), t = setTimeout(function(){ c.abort(); }, 8000);
      var r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/kv?select=id,data&col=eq.alerts&order=id.desc&limit=80', { headers: h, signal: c.signal }); clearTimeout(t);
      if(!r.ok) return; var rows = await r.json();
      items = rows.map(function(x){ var d = x.data || {}; return { id: x.id, t: d.t || '', b: d.b || '', at: +d.at || +x.id || 0 }; }).filter(function(x){ return x.at; }).sort(function(a, b){ return b.at - a.at; });
      badge(); if(open) draw();
    }catch(e){}
  }
  function show(){ open = true; panel.hidden = false; draw(); load(); document.documentElement.style.overflow = 'hidden'; lss(SEEN, String(Date.now())); badge(); timer = setInterval(function(){ load(); draw(); }, 20000); }
  function hide(){ open = false; panel.hidden = true; document.documentElement.style.overflow = ''; clearInterval(timer); lss(SEEN, String(Date.now())); badge(); }
  function init(){
    var bar = document.querySelector('.hero-actions'); if(!bar || document.getElementById('bellBtn')) return;
    bar.insertBefore(btn, bar.firstChild); document.body.appendChild(panel);
    btn.addEventListener('click', show);
    panel.addEventListener('click', function(e){
      if(e.target === panel || e.target.id === 'bellX'){ hide(); return; }
      var b = e.target.closest ? e.target.closest('[data-del]') : null; if(b){ del(b.getAttribute('data-del')); return; }
      if(e.target.id === 'bellClear'){ if(armAll){ armAll = false; clearTimeout(armTimer); del(null); } else { armAll = true; draw(); armTimer = setTimeout(function(){ armAll = false; draw(); }, 4000); } }
    });
    load(); setInterval(function(){ if(!open) load(); }, 60000);
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) load(); });
    if(!+lsg(SEEN)) lss(SEEN, '0');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
