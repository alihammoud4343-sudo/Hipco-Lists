// Load the board's history (ticks, follow-ups, inquiries) into the shared database, exactly as the app would. Reports each step.
import fs from 'fs';
const cfg = fs.readFileSync('config.js', 'utf8');
const U = /supabaseUrl: "([^"]*)"/.exec(cfg)[1], K = /anonKey: "([^"]*)"/.exec(cfg)[1], C = /dbCode: "([^"]*)"/.exec(cfg)[1];
const h = (x = {}) => ({ apikey: K, 'x-hipco': C, 'Content-Type': 'application/json', ...x });
const note = (t, m) => console.log(`::notice title=${t}::${String(m).replace(/\n/g, ' ').slice(0, 900)}`);
const seed = JSON.parse(fs.readFileSync('data/vault.json', 'utf8')).seed || {};
const rows = [];
for (const c of ['sent', 'followup', 'inquiries', 'reminders']) for (const id of Object.keys(seed[c] || {})) rows.push({ col: c, id, data: seed[c][id] });
rows.push({ col: 'meta', id: 'seeded', data: { at: Date.now() } });
note('rows-to-load', rows.length);
for (let i = 0; i < rows.length; i += 200) {
  const r = await fetch(U + '/rest/v1/kv', { method: 'POST', headers: h({ Prefer: 'resolution=ignore-duplicates,return=minimal' }), body: JSON.stringify(rows.slice(i, i + 200)) });
  note('batch-' + i, r.status + ' ' + (await r.text()));
  if (!r.ok) process.exitCode = 1;
}
