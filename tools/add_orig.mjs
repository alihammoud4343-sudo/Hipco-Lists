// usage: node tools/add_orig.mjs "<REFERENCE>" "<path to original supplier file or screenshot>" ["<name>"]   |   node tools/add_orig.mjs "<REFERENCE>" --none
// Stores the supplier's original file ENCRYPTED (public repo): per-file AES-GCM key wrapped with the team RSA public key; the file name is encrypted too. index.json only says which lists have a file.
import fs from 'node:fs'; import path from 'node:path'; import {webcrypto as c} from 'node:crypto';
const [ref, file, nm] = process.argv.slice(2);
const e = u => Buffer.from(u).toString('base64');
const safe = ref.replace(/[^A-Za-z0-9_-]/g, '_');
fs.mkdirSync('orig', {recursive:true});
const ip = 'orig/index.json'; const idx = fs.existsSync(ip) ? JSON.parse(fs.readFileSync(ip,'utf8')) : {};
if (file === '--none') { idx[safe] = 0; fs.writeFileSync(ip, JSON.stringify(idx)); console.log('name-only', safe); process.exit(0); }
const m = JSON.parse(fs.readFileSync('data/crypto.json','utf8'));
const pub = await c.subtle.importKey('jwk', m.pub, {name:'RSA-OAEP', hash:'SHA-256'}, false, ['encrypt']);
const k2 = await c.subtle.generateKey({name:'AES-GCM', length:256}, true, ['encrypt']);
const iv = c.getRandomValues(new Uint8Array(12)), iv2 = c.getRandomValues(new Uint8Array(12));
const raw = fs.readFileSync(file);
const name = nm || path.basename(file).replace(/^[0-9a-f]{8}-/, '');
const ct = await c.subtle.encrypt({name:'AES-GCM', iv}, k2, raw);
const nc = await c.subtle.encrypt({name:'AES-GCM', iv:iv2}, k2, new TextEncoder().encode(name));
const k = await c.subtle.encrypt({name:'RSA-OAEP'}, pub, await c.subtle.exportKey('raw', k2));
fs.writeFileSync('orig/' + safe + '.json', JSON.stringify({iv:e(iv), iv2:e(iv2), nm:e(nc), k:e(k), ct:e(ct)}));
idx[safe] = 1; fs.writeFileSync(ip, JSON.stringify(idx));
console.log('ok', safe, name, raw.length);
