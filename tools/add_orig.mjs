// usage: node tools/add_orig.mjs "<REFERENCE>" "<path to original supplier file>"
// Stores the supplier's original file ENCRYPTED (public repo): per-file AES-GCM key wrapped with the team RSA public key; only the team password opens it in the app.
import fs from 'node:fs'; import path from 'node:path'; import {webcrypto as c} from 'node:crypto';
const [ref, file] = process.argv.slice(2);
const e = u => Buffer.from(u).toString('base64');
const m = JSON.parse(fs.readFileSync('data/crypto.json','utf8'));
const pub = await c.subtle.importKey('jwk', m.pub, {name:'RSA-OAEP', hash:'SHA-256'}, false, ['encrypt']);
const k2 = await c.subtle.generateKey({name:'AES-GCM', length:256}, true, ['encrypt']); const iv = c.getRandomValues(new Uint8Array(12));
const raw = fs.readFileSync(file);
const ct = await c.subtle.encrypt({name:'AES-GCM', iv}, k2, raw);
const k = await c.subtle.encrypt({name:'RSA-OAEP'}, pub, await c.subtle.exportKey('raw', k2));
const safe = ref.replace(/[^A-Za-z0-9_-]/g, '_');
const name = path.basename(file).replace(/^[0-9a-f]{8}-/, '');
fs.mkdirSync('orig', {recursive:true});
fs.writeFileSync('orig/' + safe + '.json', JSON.stringify({name, iv:e(iv), k:e(k), ct:e(ct)}));
const ip = 'orig/index.json'; const idx = fs.existsSync(ip) ? JSON.parse(fs.readFileSync(ip,'utf8')) : {};
idx[safe] = name; fs.writeFileSync(ip, JSON.stringify(idx));
console.log('ok', safe, name, raw.length);
