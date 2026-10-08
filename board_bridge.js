/* HIPCO board <-> phone app shared database bridge (runs inside the Claude board).
   Wraps the board's own db so every tick / follow-up / inquiry / reminder / sold-hold change is also saved to the
   shared Supabase database the phone app uses, and changes made on the phones appear here within ~8 seconds. */
(function(){
  var CFG = window.HIPCO_CFG || {}; if(!CFG.supabaseUrl || !window.claude || !window.claude.use) return;
  var DYN = ['sent','followup','inquiries','reminders'];
  var base = CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/';
  var realUse = window.claude.use.bind(window.claude), real = null, ok = null, known = {}, first = true, busy = false, offers = {}, chip;
  function hdr(x){ var h = { apikey: CFG.anonKey, 'x-hipco': CFG.dbCode, 'Content-Type': 'application/json' }; if(!/^sb_/.test(CFG.anonKey)) h.Authorization = 'Bearer ' + CFG.anonKey; for(var k in (x||{})) h[k] = x[k]; return h; }
  async function rest(p, o){ var c = new AbortController(), t = setTimeout(function(){ c.abort(); }, 9000); o = o || {}; o.signal = c.signal; try{ var r = await fetch(base + p, o); if(!r.ok) throw new Error('db ' + r.status); return r; } finally { clearTimeout(t); } }
  function paint(){
    if(!chip){ chip = document.createElement('div'); chip.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:130;font:600 11px system-ui;padding:5px 10px;border-radius:999px;color:#fff;cursor:pointer;box-shadow:0 2px 8px #0003;opacity:.92'; chip.onclick = function(){ sync(); }; (document.body || document.documentElement).appendChild(chip); }
    chip.style.background = ok === null ? '#6B7794' : ok ? '#1F9D63' : '#B0374A';
    chip.textContent = ok === null ? 'Shared DB: connecting…' : ok ? 'Shared DB ✓ (phones in sync)' : 'Shared DB ✗ (board only) – tap to retry';
  }
  function same(a, b){ return JSON.stringify(a) === JSON.stringify(b); }
  function strip(d){ var o = {}; for(var k in d){ if(k !== '_id') o[k] = d[k]; } return o; }
  async function push(col, id, data, del){
    try{
      if(del) await rest('kv?col=eq.' + col + '&id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: hdr() });
      else await rest('kv', { method: 'POST', headers: hdr({ Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify({ col: col, id: id, data: data }) });
      ok = true;
    }catch(e){ ok = false; } paint();
  }
  function readCol(name){ return new Promise(function(res){ var un = real.collection(name).onSnapshot(function(s){ var m = {}; s.forEach(function(d){ m[d.id] = d.data(); }); try{ un(); }catch(e){} res(m); }, function(){ res({}); }); }); }
  async function sync(){
    if(busy || !real) return; busy = true;
    try{
      var rows = [];
      for(var off = 0; off < 100000; off += 1000){
        var r = await rest('kv?select=col,id,data&col=in.(' + DYN.join(',') + ',stocklots)&order=col,id&limit=1000&offset=' + off, { headers: hdr() });
        var pg = await r.json(); rows = rows.concat(pg); if(pg.length < 1000) break;
      }
      ok = true;
      var rem = {}; DYN.concat('stocklots').forEach(function(c){ rem[c] = {}; });
      rows.forEach(function(x){ if(rem[x.col]) rem[x.col][x.id] = x.data; });
      var sl = await readCol('stocklots'); offers = sl;
      for(var i = 0; i < DYN.length; i++){
        var c = DYN[i], loc = await readCol(c), k = known[c] || (known[c] = {});
        // remote -> board
        for(var id in rem[c]){ if(!loc[id] || !same(strip(loc[id]), strip(rem[c][id]))){ try{ await real.doc(c + '/' + id).set(rem[c][id]); }catch(e){} } k[id] = 1; }
        // board-only docs: deleted on phones -> delete here; brand new on the board -> send to phones
        for(var id2 in loc){
          if(rem[c][id2]) continue;
          if(k[id2]){ try{ await real.doc(c + '/' + id2).delete(); }catch(e){} delete k[id2]; continue; }
          var off2 = id2.split('__')[0];
          if((c === 'sent' || c === 'followup') && !sl[off2]) continue;     // leftovers of removed lists never come back
          await push(c, id2, loc[id2]); if(ok) k[id2] = 1;
        }
      }
      // sold / hold status
      for(var sid in rem.stocklots){ var o = rem.stocklots[sid], d = sl[sid]; if(d && o && o.status && (d.status !== o.status || d.statusAt !== o.statusAt)){ var p = { status: o.status }; if(o.statusAt) p.statusAt = o.statusAt; try{ await real.doc('stocklots/' + sid).update(p); }catch(e){} } }
      first = false;
    }catch(e){ ok = false; }
    busy = false; paint();
  }
  window.claude.use = async function(n){
    var v = await realUse(n);
    if(n !== 'db' || !v) return v;
    if(!real){ real = v; setTimeout(sync, 1500); setInterval(sync, 8000); document.addEventListener('visibilitychange', function(){ if(!document.hidden) sync(); }); }
    return {
      collection: function(x){ return v.collection(x); },
      doc: function(path){
        var d = v.doc(path), q = path.split('/'), col = q[0], id = q.slice(1).join('/'), isD = DYN.indexOf(col) >= 0, isS = col === 'stocklots';
        if(!isD && !isS) return d;
        return Object.assign({}, d, {
          onSnapshot: function(a, b){ return d.onSnapshot(a, b); },
          get: function(){ return d.get(); },
          set: async function(data){ var r = await d.set(data); if(isD){ push(col, id, data); } else if(data && data.status) push('stocklots', id, { status: data.status, statusAt: data.statusAt }); return r; },
          update: async function(patch){ var r = await d.update(patch);
            if(isD){ try{ var s = await d.get(); push(col, id, s.data()); }catch(e){ push(col, id, patch); } }
            else if(patch && patch.status){ push('stocklots', id, { status: patch.status, statusAt: patch.statusAt }); }
            return r; },
          delete: async function(){ var r = await d.delete(); if(isD){ push(col, id, null, true); if(known[col]) delete known[col][id]; } return r; }
        });
      }
    };
  };
  paint();
})();
