#!/usr/bin/env node
// tools/build-id.mjs — PERF 19 THE BUILD'S FINGERPRINT (critic C2-026): build.json = { id, files:{ 'src/…/x.js': hash8, 'config.js': hash8 } } for every module the page
//   loads. index.html reads it (never cached) and maps each module's URL to `?h=<its hash>` in the import map, so a page always loads ONE build's files —
//   a file the browser (or GitHub Pages' 10-minute cache, or the service worker) still holds from the last build has another URL and is never mixed in —
//   and ui/build-watch.js compares `id` with the running build's to offer a reload when a new one is deployed.
//   Run by tools/verify.mjs (so every commit carries a fresh one); `node tools/build-id.mjs --check` exits 1 when build.json is stale.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const list = ['config.js']; (function walk(d){ for(const f of fs.readdirSync(path.join(ROOT, d)).sort()){ const r = d + '/' + f, st = fs.statSync(path.join(ROOT, r)); if(st.isDirectory()) walk(r); else if(f.endsWith('.js')) list.push(r); } })('src');
const h = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8), files = {};
for(const f of list) files[f] = h(fs.readFileSync(path.join(ROOT, f)));
const id = h(JSON.stringify(files)), out = JSON.stringify({ id, files }) + '\n', P = path.join(ROOT, 'build.json');
const old = fs.existsSync(P) ? fs.readFileSync(P, 'utf8') : '';
if(process.argv.includes('--check')){ if(old !== out){ console.log('✗ build.json is stale — run node tools/build-id.mjs'); process.exit(1); } console.log('build.json: ' + id + ' (' + list.length + ' modules)'); }
else { if(old !== out) fs.writeFileSync(P, out); console.log('build.json: ' + id + ' (' + list.length + ' modules)' + (old === out ? '' : ' — written')); }
