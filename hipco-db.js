/* HIPCO Stocklot — standalone data layer.
   Gives the board the same small API it had inside Claude (db.collection().onSnapshot, db.doc().set/update/delete),
   so the board code does not change.
   - Lists, clients, lock keys: static files in /data (rebuilt by pushing to GitHub) -> auto-updating, deletions included.
   - Ticks (sent), follow-ups, inquiries, sold/hold status: shared live database (Supabase) when config.js has keys,
     otherwise saved on this device only (so the app still works while the database is being set up). */
(function(){
  'use strict';
  var CFG = window.HIPCO_CFG || {};
  var REMOTE = !!(CFG.supabaseUrl && CFG.anonKey);
  var DYN = ['sent', 'followup', 'inquiries', 'stocklots'];   // dynamic collections ('stocklots' holds status overrides only)
  var LS = 'hipco_dyn_v1';
  var seedData = { sent: {}, followup: {}, inquiries: {}, stocklots: {} };

  var stat = { stocklots: [], clients: {}, meta: {} };       // from /data
  var dyn = { sent: {}, followup: {}, inquiries: {}, stocklots: {} };   // id -> data
  var subs = [];       // {kind:'col'|'doc', path, cb, err}
  var statJson = '';
  var loadErr = false;

  function clone(o){ return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function lsGet(){ try{ return JSON.parse(localStorage.getItem(LS) || 'null'); }catch(e){ return null; } }
  function lsSet(){ try{ localStorage.setItem(LS, JSON.stringify(dyn)); }catch(e){} }

  // ---------- password gate: everything in /data is encrypted; the team password opens it ----------
  var PW_STORE = 'hipco_pw_v1';
  var priv = null, cmeta = null, dbCode = CFG.dbCode || '';
  function b64d(x){ var t = atob(x), a = new Uint8Array(t.length); for(var i = 0; i < t.length; i++) a[i] = t.charCodeAt(i); return a; }
  function normPw(p){ return String(p || '').trim().toLowerCase(); }
  async function unwrap(pw){
    var base = await crypto.subtle.importKey('raw', new TextEncoder().encode(normPw(pw)), 'PBKDF2', false, ['deriveKey']);
    var aes = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64d(cmeta.salt), iterations: cmeta.iters, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    var pk = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(cmeta.iv) }, aes, b64d(cmeta.wrapped));   // throws if the password is wrong
    return crypto.subtle.importKey('pkcs8', pk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
  }
  async function openEnv(env){
    var raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, priv, b64d(env.k));
    var key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(env.iv) }, key, b64d(env.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  }
  function askPassword(msg){
    return new Promise(function(res){
      var o = document.createElement('div');
      o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:linear-gradient(160deg,#27499A,#0B1A3F);display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,system-ui,sans-serif';
      o.innerHTML = '<form style="background:#fff;border-radius:20px;padding:26px 22px;max-width:360px;width:100%;text-align:center;box-shadow:0 20px 60px #0006">'
        + '<img src="img/logo-blue.png" alt="HIPCO" style="height:46px;margin-bottom:14px" onerror="this.remove()">'
        + '<div style="font-size:19px;font-weight:700;color:#0F1B3D">Hipco Stocklot</div>'
        + '<div style="font-size:14px;color:#5A6687;margin:6px 0 16px">Enter the team password<br><span dir="rtl">أدخل كلمة مرور الفريق</span></div>'
        + '<input type="password" autocomplete="current-password" style="width:100%;padding:13px 14px;font-size:17px;border:1.5px solid #E3E7F0;border-radius:12px;outline:0;text-align:center" autofocus>'
        + '<div class="e" style="color:#B0374A;font-size:13px;min-height:18px;margin-top:8px"></div>'
        + '<button style="width:100%;padding:13px;font-size:16px;font-weight:700;color:#fff;background:#1B3A7A;border:0;border-radius:12px;margin-top:6px">Open · فتح</button></form>';
      document.body.appendChild(o);
      var f = o.querySelector('form'), i = o.querySelector('input'), e = o.querySelector('.e');
      e.textContent = msg || '';
      f.onsubmit = function(ev){ ev.preventDefault(); res({ pw: i.value, done: function(err){ if(err){ e.textContent = err; i.value = ''; i.focus(); } else o.remove(); } }); };
      setTimeout(function(){ try{ i.focus(); }catch(e){} }, 50);
    });
  }
  async function gate(){
    var r = await fetch('data/crypto.json?t=' + Date.now(), { cache: 'no-store' });
    if(!r.ok) throw new Error('crypto');
    cmeta = await r.json();
    var pw = ''; try{ pw = localStorage.getItem(PW_STORE) || ''; }catch(e){}
    if(pw){ try{ priv = await unwrap(pw); return true; }catch(e){ try{ localStorage.removeItem(PW_STORE); }catch(_){} } }
    var msg = '';
    for(;;){
      var a = await askPassword(msg);
      try{ priv = await unwrap(a.pw); try{ localStorage.setItem(PW_STORE, normPw(a.pw)); }catch(e){} a.done(); return true; }
      catch(e){ msg = 'Wrong password · كلمة المرور غير صحيحة'; a.done(msg); }
    }
  }
  function hdr(extra){
    var h = { apikey: CFG.anonKey, 'x-hipco': dbCode, 'Content-Type': 'application/json' };
    if(!/^sb_/.test(CFG.anonKey)) h.Authorization = 'Bearer ' + CFG.anonKey;   // legacy JWT keys need it, new publishable keys must not send it
    for(var k in (extra || {})) h[k] = extra[k];
    return h;
  }
  async function rest(path, opt){
    var r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + path, opt);
    if(r.status === 401 || r.status === 403){
      var e = new Error('team code rejected'); e.code = 'denied'; throw e;
    }
    if(!r.ok){ var e2 = new Error('db ' + r.status); e2.code = 'db' + r.status; throw e2; }
    return r;
  }

  // ---------- build snapshots ----------
  function stocklotDocs(){
    var ov = dyn.stocklots || {};
    return stat.stocklots.map(function(d){
      var x = clone(d); var o = ov[d._id]; if(o){ if(o.status) x.status = o.status; if(o.statusAt) x.statusAt = o.statusAt; }
      return x;
    });
  }
  function colDocs(name){
    if(name === 'stocklots') return stocklotDocs().map(function(d){ var id = d._id; delete d._id; return { id: id, data: d }; });
    if(name === 'clients') return Object.keys(stat.clients).map(function(id){ return { id: id, data: clone(stat.clients[id]) }; });
    if(name === 'meta') return Object.keys(stat.meta).map(function(id){ return { id: id, data: clone(stat.meta[id]) }; });
    var m = dyn[name] || {};
    return Object.keys(m).map(function(id){ return { id: id, data: clone(m[id]) }; });
  }
  function colSnap(name){
    var arr = colDocs(name).map(function(x){ return { id: x.id, data: function(){ return x.data; } }; });
    return { docs: arr, size: arr.length, forEach: function(f){ arr.forEach(f); } };
  }
  function docSnap(path){
    var p = path.split('/'), col = p[0], id = p[1];
    var hit = colDocs(col).filter(function(x){ return x.id === id; })[0];
    return { id: id, exists: !!hit, data: function(){ return hit ? hit.data : undefined; } };
  }
  function fire(){
    subs.forEach(function(s){
      try{ s.cb(s.kind === 'col' ? colSnap(s.path) : docSnap(s.path)); }catch(e){ if(window.console) console.error(e); }
    });
  }

  // ---------- loading ----------
  async function loadStatic(){
    var r = await fetch('data/vault.json?t=' + Date.now(), { cache: 'no-store' });
    if(!r.ok) throw new Error('static load');
    var t = await r.text();
    if(t === statJson) return false;
    if(!cmeta){ var rc = await fetch('data/crypto.json?t=' + Date.now(), { cache: 'no-store' }); if(rc.ok) cmeta = await rc.json(); }
    var p = JSON.parse(t);
    statJson = t;
    stat.stocklots = p.docs || [];
    stat.clients = p.clients || {};
    stat.meta = { crypto: cmeta, info: { lastUpdated: p.updated || '' } };
    seedData = p.seed || seedData;
    return true;
  }
  function seedLocal(){
    // first run in local mode: start from the history exported from the Claude board
    var have = lsGet();
    var n = 0; if(have) DYN.forEach(function(c){ n += Object.keys(have[c] || {}).length; });
    if(have && n){ dyn = have; return; }
    DYN.forEach(function(c){ dyn[c] = clone(seedData[c] || {}); });
    lsSet();
  }
  async function loadRemote(){
    var r = await rest('kv?select=col,id,data&col=in.(' + DYN.join(',') + ')&limit=20000', { headers: hdr() });
    var rows = await r.json();
    var n = { sent: {}, followup: {}, inquiries: {}, stocklots: {} };
    rows.forEach(function(x){ if(n[x.col]) n[x.col][x.id] = x.data; });
    // keep optimistic writes that have not reached the server yet
    Object.keys(pending).forEach(function(k){ var p = pending[k]; if(n[p.col]){ if(p.del) delete n[p.col][p.id]; else n[p.col][p.id] = p.data; } });
    var same = JSON.stringify(n) === JSON.stringify(dyn);
    dyn = n; return !same;
  }
  async function seedRemoteOnce(){
    // empty server: upload the history exported from the Claude board (never overwrites anything that exists)
    var r = await rest('kv?select=id&col=eq.meta&id=eq.seeded', { headers: hdr() });
    if((await r.json()).length) return;
    var s = seedData;
    var rows = [];
    DYN.forEach(function(c){ Object.keys(s[c] || {}).forEach(function(id){ rows.push({ col: c, id: id, data: s[c][id] }); }); });
    rows.push({ col: 'meta', id: 'seeded', data: { at: Date.now() } });
    for(var i = 0; i < rows.length; i += 200){
      await rest('kv', { method: 'POST', headers: hdr({ Prefer: 'resolution=ignore-duplicates,return=minimal' }), body: JSON.stringify(rows.slice(i, i + 200)) });
    }
  }

  // ---------- writes ----------
  var pending = {};
  async function write(col, id, data, del){
    var key = col + '/' + id;
    if(del) delete dyn[col][id]; else dyn[col][id] = data;
    lsSet(); fire();
    if(!REMOTE) return;
    pending[key] = { col: col, id: id, data: data, del: !!del };
    try{
      if(del) await rest('kv?col=eq.' + encodeURIComponent(col) + '&id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: hdr() });
      else await rest('kv', { method: 'POST', headers: hdr({ Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify({ col: col, id: id, data: data }) });
      delete pending[key];
    }catch(e){ delete pending[key]; if(!del) delete dyn[col][id]; fire(); throw e; }
  }
  function split(path){ var p = path.split('/'); return { col: p[0], id: p.slice(1).join('/') }; }

  var DB = {
    collection: function(name){
      return { onSnapshot: function(cb, err){
        var s = { kind: 'col', path: name, cb: cb, err: err }; subs.push(s);
        setTimeout(function(){ try{ if(loadErr && name === 'stocklots' && err) err({ code: 'no connection' }); else cb(colSnap(name)); }catch(e){} }, 0);
        return function(){ subs = subs.filter(function(x){ return x !== s; }); };
      } };
    },
    doc: function(path){
      var q = split(path);
      return {
        onSnapshot: function(cb, err){
          var s = { kind: 'doc', path: path, cb: cb, err: err }; subs.push(s);
          setTimeout(function(){ try{ cb(docSnap(path)); }catch(e){} }, 0);
          return function(){ subs = subs.filter(function(x){ return x !== s; }); };
        },
        get: async function(){ return docSnap(path); },
        set: async function(data){ if(DYN.indexOf(q.col) < 0) throw new Error('read-only'); return write(q.col, q.id, clone(data)); },
        update: async function(patch){
          if(DYN.indexOf(q.col) < 0) throw new Error('read-only');
          var cur = Object.assign({}, dyn[q.col][q.id] || {}, clone(patch));
          return write(q.col, q.id, cur);
        },
        delete: async function(){ if(DYN.indexOf(q.col) < 0) throw new Error('read-only'); return write(q.col, q.id, null, true); }
      };
    }
  };

  // ---------- downloads (xlsx / pdf saves) ----------
  var DL = { save: async function(o){
    var u = URL.createObjectURL(o.data), a = document.createElement('a');
    a.href = u; a.download = o.filename; a.style.display = 'none'; document.body.appendChild(a); a.click();
    setTimeout(function(){ try{ document.body.removeChild(a); URL.revokeObjectURL(u); }catch(e){} }, 4000);
  } };

  window.claude = { use: async function(name){
    if(name === 'db') return DB;
    if(name === 'downloads') return DL;
    return null;
  } };

  // ---------- start / refresh ----------
  async function refresh(first){
    try{
      var changed = false;
      try{ changed = await loadStatic(); if(loadErr){ loadErr = false; seedLocal(); changed = true; } }catch(e){ if(first) throw e; }
      if(REMOTE){ try{ if(await loadRemote()) changed = true; }catch(e){ if(e.code === 'denied'){ subs.forEach(function(s){ if(s.err) s.err({ code: 'denied' }); }); } } }
      if(changed || first) fire();
    }catch(e){ subs.forEach(function(s){ if(s.err) s.err({ code: 'load' }); }); }
  }
  var ready = (async function(){
    try{
      try{ await loadStatic(); }catch(e){ loadErr = true; throw e; }
      if(REMOTE){ try{ await seedRemoteOnce(); await loadRemote(); }catch(e){ if(window.console) console.error(e); seedLocal(); } } else seedLocal();
    }catch(e){ if(window.console) console.error(e); subs.forEach(function(x){ if(x.err) x.err({ code: 'load' }); }); }
    fire();
    setInterval(function(){ refresh(false); }, REMOTE ? 8000 : 60000);
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) refresh(false); });
  })();
  var origUse = window.claude.use;
  window.claude.use = async function(n){ await ready; return origUse(n); };
  window.HIPCO_REFRESH = function(){ return refresh(false); };
})();
