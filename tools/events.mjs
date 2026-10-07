// Sends a push alert to EVERY phone with the app for everything that happens in the shared database:
// new inquiry, inquiry status change, new reminder, WhatsApp sends, client answers, list sold/on hold.
// Runs every few minutes in GitHub Actions. First run only remembers what exists (no flood).
import fs from 'node:fs'; import { createHash } from 'node:crypto';
const APP_ID = '9722a093-2b4b-4002-a1d8-bc4910456d78', KEY = process.env.ONESIGNAL_API_KEY, SITE = 'https://alihammoud4343-sudo.github.io/Hipco-Lists/';
const cfg = fs.readFileSync('config.js', 'utf8'); const U = /supabaseUrl: "([^"]*)"/.exec(cfg)[1], K = /anonKey: "([^"]*)"/.exec(cfg)[1], C = /dbCode: "([^"]*)"/.exec(cfg)[1];
const H = (x = {}) => ({ apikey: K, 'x-hipco': C, 'Content-Type': 'application/json', ...x });
const note = (t, m) => console.log(`::notice title=${t}::${String(m).replace(/\n/g, ' ').slice(0, 600)}`);
if (!KEY) { console.log('::error title=events::No ONESIGNAL_API_KEY secret'); process.exit(1); }
const COLS = ['inquiries', 'reminders', 'sent', 'followup', 'stocklots'];
const INQ = { open: 'Still pending', supplier: 'Sent to supplier', price: 'Price sent to client', neg: 'Negotiating', won: 'Order confirmed', lost: 'Lost', cancel: 'Cancelled / no stock' };
const h8 = s => createHash('sha1').update(s).digest('hex').slice(0, 10), sig = d => createHash('md5').update(JSON.stringify(d)).digest('hex').slice(0, 8);
const ref = id => { const m = /^sl-?(\d+)/i.exec(id || ''); return m ? 'SL' + m[1] : (id || '').slice(0, 12); };
async function getRows(col) {
  let all = [];
  for (let off = 0; off < 20000; off += 1000) {
    const r = await fetch(`${U}/rest/v1/kv?select=id,data&col=eq.${col}&order=id&limit=1000&offset=${off}`, { headers: H() });
    if (!r.ok) throw new Error(col + ' ' + r.status); const p = await r.json(); all = all.concat(p); if (p.length < 1000) break;
  }
  return all;
}
const cur = {}; for (const c of COLS) { cur[c] = {}; for (const r of await getRows(c)) cur[c][h8(r.id)] = { id: r.id, d: r.data || {} }; }
const sr = await fetch(`${U}/rest/v1/kv?select=data&col=eq.meta&id=eq.notify_state`, { headers: H() }); const sj = sr.ok ? await sr.json() : [];
const old = sj[0] && sj[0].data && sj[0].data.seen ? sj[0].data.seen : null;
note('rows', COLS.map(c => c + '=' + Object.keys(cur[c]).length).join(' ') + (old ? '' : ' (first run: baseline)'));
const ev = [];   // {title, body}
const sentG = {}, ansG = {};
const dayAgo = Date.now() - 24 * 3600 * 1000;
for (const c of COLS) for (const [k, { id, d }] of Object.entries(cur[c])) {
  const o = old && old[c] && old[c][k], isNew = old ? !o : false, changed = o && o[0] !== sig(d);
  if (!old) {   // baseline: only announce today's inquiries / reminders that nobody was told about
    if ((c === 'inquiries' || c === 'reminders') && +d.createdAt >= dayAgo) { if (c === 'inquiries') ev.push({ title: 'New inquiry ' + (d.no ? 'INQ-' + String(d.no).replace(/\D/g, '').padStart(3, '0') : ''), body: `${d.salesman || ''}: ${d.client || ''} · ${d.product || ''}${d.qty ? ' · ' + d.qty : ''}` }); else ev.push({ title: 'New reminder', body: `${d.salesman || ''}: ${d.client || ''}${d.note ? ' — ' + d.note : ''}` }); }
    continue;
  }
  if (!isNew && !changed) continue;
  if (c === 'inquiries') {
    if (isNew) ev.push({ title: 'New inquiry ' + (d.no ? 'INQ-' + String(d.no).replace(/\D/g, '').padStart(3, '0') : ''), body: `${d.salesman || ''}: ${d.client || ''} · ${d.product || ''}${d.qty ? ' · ' + d.qty : ''}${d.country ? ' · ' + d.country : ''}` });
    else if (o[1] !== (d.status || '')) ev.push({ title: 'Inquiry update', body: `${d.client || ''} (${d.salesman || ''}): ${INQ[d.status] || d.status || 'updated'}` });
  } else if (c === 'reminders') {
    if (isNew) ev.push({ title: 'New reminder', body: `${d.salesman || ''}: ${d.client || ''}${d.quality ? ' · ' + d.quality : ''}${d.note ? ' — ' + d.note : ''}` });
    else if (o[1] !== (d.status || '') && d.status === 'done') ev.push({ title: 'Reminder done', body: `${d.salesman || ''}: ${d.client || ''}` });
  } else if (c === 'sent') {
    if (isNew) { const g = (d.salesman || '?') + '|' + ref(d.offer); sentG[g] = (sentG[g] || 0) + 1; }
  } else if (c === 'followup') {
    const st = d.status || ''; const g = (d.salesman || '?') + '|' + ref(d.offer) + '|' + (st || 'note');
    if (isNew || o[1] !== st) { ansG[g] = (ansG[g] || 0) + 1; if (d.note && !st) ansG[g + '|n'] = d.note; }
  } else if (c === 'stocklots') {
    if (d.status && (isNew || o[1] !== d.status)) ev.push({ title: 'List ' + ref(id) + ' ' + (d.status === 'available' ? 'available again' : 'marked ' + d.status), body: 'Open the app to see it' });
  }
}
for (const [g, n] of Object.entries(sentG)) { const [sm, r] = g.split('|'); ev.push({ title: `${sm} sent ${r}`, body: `WhatsApp sent to ${n} client${n > 1 ? 's' : ''}` }); }
for (const [g, n] of Object.entries(ansG)) { if (g.endsWith('|n')) continue; const [sm, r, st] = g.split('|'); const nt = ansG[g + '|n']; ev.push({ title: st === 'note' ? `${sm}: new note on ${r}` : `${sm}: ${n} client${n > 1 ? 's' : ''} ${st.replace(/_/g, ' ')} on ${r}`, body: nt ? nt.slice(0, 120) : 'Open the app for details' }); }
import { sendAll } from './pushlib.mjs';
const push = (title, body) => sendAll(title, body, SITE);
note('events', ev.length);
let ok = true; const MAX = 6;
for (const e of ev.slice(0, MAX)) ok = (await push(e.title, e.body)) && ok;
if (ev.length > MAX) ok = (await push('HIPCO: ' + (ev.length - MAX) + ' more updates', 'Open the app to see everything new')) && ok;
// remember the new state (only when every alert went out, so nothing is lost)
if (ok) {
  const seen = {}; for (const c of COLS) { seen[c] = {}; for (const [k, { d }] of Object.entries(cur[c])) seen[c][k] = [sig(d), d.status || '']; }
  const r = await fetch(U + '/rest/v1/kv', { method: 'POST', headers: H({ Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify({ col: 'meta', id: 'notify_state', data: { seen, at: Date.now() } }) });
  note('state-saved', r.status); if (!r.ok) process.exitCode = 1;
} else process.exitCode = 1;
