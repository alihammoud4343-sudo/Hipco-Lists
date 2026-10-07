// one-off: put the already-sent "new list" alert into the bell history
import fs from 'node:fs';
const cfg = fs.readFileSync('config.js', 'utf8'); const U = /supabaseUrl: "([^"]*)"/.exec(cfg)[1], K = /anonKey: "([^"]*)"/.exec(cfg)[1], C = /dbCode: "([^"]*)"/.exec(cfg)[1];
const v = JSON.parse(fs.readFileSync('data/vault.json', 'utf8')), ref = process.argv[2], at = +process.argv[3];
const d = v.docs.find(x => x.reference.startsWith(ref)); const bd = d.client_match_breakdown || {};
const t = 'New list ' + d.reference.split('-')[0] + ' · ' + (d.quality_group || d.product);
const b = [d.product, [d.gsm, d.qty_mt, d.origin].filter(Boolean).join(' · '), (d.client_match_count || 0) + ' clients matched: ' + Object.entries(bd).map(([k, x]) => k + ' ' + x).join(', ')].filter(Boolean).join('\n');
const r = await fetch(U + '/rest/v1/kv', { method: 'POST', headers: { apikey: K, 'x-hipco': C, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ col: 'alerts', id: String(at), data: { t, b, at } }) });
console.log('::notice title=backfill::' + r.status + ' ' + t + ' | ' + b.replace(/\n/g, ' / '));
