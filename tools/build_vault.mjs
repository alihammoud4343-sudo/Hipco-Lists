// Builds the encrypted app data. Needs only the PUBLIC key (meta_crypto.json). usage: node build_vault.mjs <dumpdir> <repodir>
import fs from 'node:fs'; import path from 'node:path'; import { webcrypto as crypto } from 'node:crypto';
const [dump, repo] = process.argv.slice(2);
const meta = JSON.parse(fs.readFileSync(dump + '/meta/crypto.json', 'utf8'));
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const dir = d => fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.json')) : [];
const docs = dir(dump + '/stocklots').map(f => { const d = rd(dump + '/stocklots/' + f); d._id = f.slice(0, -5); d.pdf_url = d.reference.replace(/[^A-Za-z0-9_-]/g, '_') + '.pdf'; return d; })
  .sort((a, b) => (a.dateAdded || '').localeCompare(b.dateAdded || '') || a.reference.localeCompare(b.reference));
const info = rd(dump + '/meta/info.json');
const seed = { sent: {}, followup: {}, inquiries: {}, reminders: {}, stocklots: {} };
for (const c of ['sent', 'followup', 'inquiries', 'reminders']) for (const f of dir(dump + '/' + c)) seed[c][f.slice(0, -5)] = rd(dump + '/' + c + '/' + f);
fs.mkdirSync(repo + '/data', { recursive: true });
// lists + open clients are plain; prices, suppliers and protected salesmen's clients stay inside each doc's "sec" (team password)
const payload = { updated: info.lastUpdated || '', docs, clients: { open: rd(dump + '/clients/open.json'), locked: rd(dump + '/clients/locked.json') }, seed };
fs.writeFileSync(repo + '/data/vault.json', JSON.stringify(payload));
fs.writeFileSync(repo + '/data/crypto.json', JSON.stringify(meta));
console.log('docs', docs.length, 'sent', Object.keys(seed.sent).length, 'vault bytes', fs.statSync(repo + '/data/vault.json').size);
