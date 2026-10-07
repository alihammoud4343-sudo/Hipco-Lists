// Send one push to EVERY phone that has the app. Tries OneSignal's "all subscriptions" segments, then the phones registered in the shared database.
import fs from 'node:fs';
const APP_ID = '9722a093-2b4b-4002-a1d8-bc4910456d78', KEY = process.env.ONESIGNAL_API_KEY;
const note = (t, m) => console.log(`::notice title=${t}::${String(m).replace(/\n/g, ' ').slice(0, 500)}`);
const cfg = fs.readFileSync('config.js', 'utf8'); const U = /supabaseUrl: "([^"]*)"/.exec(cfg)[1], K = /anonKey: "([^"]*)"/.exec(cfg)[1], C = /dbCode: "([^"]*)"/.exec(cfg)[1];
let segNames = null, regIds = null;
async function api(body) {
  const r = await fetch('https://api.onesignal.com/notifications?c=push', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Key ' + KEY }, body: JSON.stringify({ app_id: APP_ID, target_channel: 'push', ...body }) });
  const t = await r.text(); return { ok: r.ok && !/"errors"/.test(t), t, status: r.status };
}
async function segments() {
  if (segNames) return segNames; segNames = [];
  try { const r = await fetch('https://api.onesignal.com/apps/' + APP_ID + '/segments', { headers: { Authorization: 'Key ' + KEY } }); const j = await r.json(); segNames = (j.segments || j || []).map(s => s.name).filter(Boolean); note('segments', r.status + ' ' + segNames.join(' | ')); } catch (e) { note('segments', 'error ' + e.message); }
  return segNames;
}
async function registered() {
  if (regIds) return regIds; regIds = [];
  try { const r = await fetch(U + '/rest/v1/kv?select=id,data&col=eq.push&limit=1000', { headers: { apikey: K, 'x-hipco': C } }); if (r.ok) for (const x of await r.json()) { const d = x.data || {}; if (d.sid) regIds.push(d.sid); } } catch (e) {}
  regIds = [...new Set(regIds)]; note('registered-phones', regIds.length); return regIds;
}
async function logAlert(title, body) {   // keep a copy in the shared database so the app's bell shows the history
  try { const at = Date.now(); await fetch(U + '/rest/v1/kv', { method: 'POST', headers: { apikey: K, 'x-hipco': C, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ col: 'alerts', id: String(at), data: { t: title, b: body, at } }) }); } catch (e) {}
}
export async function sendAll(title, body, url) {
  const ok = await sendAll0(title, body, url); if (ok) await logAlert(title, body); return ok;
}
async function sendAll0(title, body, url) {
  const base = { headings: { en: title }, contents: { en: body }, url };
  const names = await segments(); const order = ['Total Subscriptions', 'Subscribed Users', 'Active Subscriptions', ...names.filter(n => /subscri/i.test(n))];
  let last = '';
  for (const s of [...new Set(order)]) { if (names.length && !names.includes(s)) continue; const r = await api({ ...base, included_segments: [s] }); last = s + ' ' + r.status + ' ' + r.t.slice(0, 100); if (r.ok) { note('push-ok', title + ' via segment ' + s); return true; } }
  const ids = await registered();
  if (ids.length) { const r = await api({ ...base, include_subscription_ids: ids }); last += ' | ids ' + r.status + ' ' + r.t.slice(0, 100); if (r.ok) { note('push-ok', title + ' via ' + ids.length + ' registered phones'); return true; } }
  note('push-FAILED', title + ' :: ' + last); return false;
}
