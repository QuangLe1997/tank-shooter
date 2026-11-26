#!/usr/bin/env node
// tools/licenses.mjs — LICENCE 1 WHERE EVERY 3D MODEL COMES FROM: one row per model (its phone / mid / far / near-HD copies folded into it) in
//   assets/LICENSES.csv — group, licence, the line of evidence from the repo's own source notes, and a flag when it copies a real brand.
//   node tools/licenses.mjs            (npm run licenses) — rewrites the CSV and prints the count per group; exit code 1 while any model is "chưa rõ".
// It only READS what the repo already records: assets/**/SOURCE(S)*.txt (who made each file, which post it was downloaded from),
// tools/meshy-assets.json (models generated with the owner's Meshy plan) and tools/scene-import.json (downloads packed by scene-import).
// Licence rules (checked 2026-11-25; see DOCS "LICENCE 1"): Poly Haven = CC0 · a model posted on the Meshy Community page = CC0 (Meshy Terms §3.3) ·
// Sketchfab scans via Objaverse = CC BY 4.0 (credit the author) · generated with Meshy / Tripo on a PAID plan (the owner's) = his to use commercially.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url))), MOD = path.join(ROOT, 'assets', 'models');
const walk = (d, out = []) => { for(const f of fs.readdirSync(d)){ const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; };
const files = walk(path.join(ROOT, 'assets')), rel = p => path.relative(ROOT, p).replace(/\\/g, '/');
// the notes, cut into entries (a "- …" line and the lines that continue it), each remembering its file's heading
const NOTES = []; for(const f of files.filter(f => /SOURCES?[\w-]*\.txt$/.test(f))){ const L = fs.readFileSync(f, 'utf8').split('\n'), head = L.slice(0, 4).join(' '); let cur = null;
  for(const l of L){ if(/^\S/.test(l) || /^\s*- /.test(l)){ cur = { f:rel(f), head, t:l.trim() }; NOTES.push(cur); } else if(!l.trim()) cur = null; else if(cur) cur.t += ' ' + l.trim(); else NOTES.push(cur = { f:rel(f), head, t:l.trim() }); } }   // (an entry starts at the margin or with a dash; an indented line continues it; a blank line ends it)
// names an entry speaks of: plain "name.glb", "a_{x,y}_{p,q}.glb", "prop_*.glb", "tree/*.glb"
const expand = s => { const m = s.match(/\{([^{}]+)\}/); return m ? m[1].split(',').flatMap(x => expand(s.replace(m[0], x.trim()))) : [s]; };
for(const n of NOTES){ n.pats = []; for(const m of n.t.matchAll(/[\w./*{}, -]*?([\w*{},-]+)\.(?:glb|gltf)/g)) for(const x of expand(m[1].replace(/\s/g, ''))) n.pats.push(new RegExp('^' + x.replace(/[.+?^$()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')); }
const MESHY = (() => { try{ return JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/meshy-assets.json'), 'utf8')); }catch(e){ return {}; } })();
const IMPORT = (() => { try{ return JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/scene-import.json'), 'utf8')); }catch(e){ return {}; } })();
const classify = t => /poly ?haven/i.test(t) ? ['Poly Haven', 'CC0'] : /sketchfab|objaverse/i.test(t) ? ['Sketchfab (scan)', 'CC BY 4.0 — phải ghi tên tác giả']
  : /wikimedia/i.test(t) ? ['Tripo từ ảnh Wikimedia', 'model: gói Tripo trả phí · ảnh gốc CC BY-SA 4.0 — ghi tên người chụp'] : /tripo/i.test(t) && !/meshy community/i.test(t) ? ['Tripo tự sinh', 'gói trả phí của chủ dự án — dùng thương mại được']
  : /meshy community|meshy\.ai\/posts|community gallery/i.test(t) ? ['Meshy cộng đồng', 'CC0 (Meshy Terms §3.3)'] : /meshy/i.test(t) ? ['Meshy tự sinh', 'gói trả phí của chủ dự án — dùng thương mại được'] : null;
const BRAND = /\b(ak[- ]?47|ak|ar[- ]?15|m4|mp5|humvee|hummer|burj|needle|landmark|lm81|bitexco)\b/i;
// one row per model: the copies in m/ l/ f/ and hd/<group>_<name> fold into the base file
const rows = new Map();
for(const f of files.filter(f => f.startsWith(MOD) && /\.(glb|gltf)$/.test(f))){ const r = rel(f), parts = r.split('/'), stem = path.basename(r).replace(/\.(glb|gltf)$/, ''); let dir = parts.slice(0, -1), name = stem;
  if(['m', 'l', 'f', 'd'].includes(dir[dir.length - 1])) dir = dir.slice(0, -1);
  if(dir[dir.length - 1] === 'hd'){ const m = stem.match(/^(scene|tree|fort|camp|city|cover|ruin|wild|ride|inf|gun|air|turret|wonder|proj|drv|base|mil)_(.+)$/);
    if(m){ const keep = m[1] === 'base' || m[1] === 'mil'; dir = dir.slice(0, -1).concat(m[1] === 'inf' ? ['gun', 'inf'] : m[1] === 'drv' ? ['driver'] : keep ? ['camp'] : [m[1]]); name = keep ? stem : m[2]; } }
  const key = dir.join('/') + '/' + name, e = rows.get(key) || { key, files:0, bytes:0 }; e.files++; e.bytes += fs.statSync(f).size; rows.set(key, e); }
for(const e of rows.values()){ const name = path.basename(e.key), dir = path.dirname(e.key), alt = [name, name.replace(/^(tree|fort|camp|city)_/, '')];
  const wild = p => /\.\*/.test(p.source), hit = (n, w) => n.pats.some(p => wild(p) === w && alt.some(a => p.test(a))), word = n => alt.some(a => new RegExp('(^|[^\\w])' + a + '([^\\w]|$)').test(n.t));
  // the most exact note wins: its own file name in its folder's notes → named elsewhere with its folder → named without the extension ("bld_burj = Burj Khalifa") → a wildcard ("prop_*.glb")
  let n = NOTES.find(n => path.dirname(n.f) === dir && hit(n, false)) || NOTES.find(n => hit(n, false) && n.t.includes(path.basename(dir) + '/')) || NOTES.find(n => path.dirname(n.f) === dir && n.pats.length < 40 && word(n) && !/^[A-Z][a-z]+ .*where each/.test(n.t))
    || NOTES.find(n => path.dirname(n.f) === dir && hit(n, true)) || NOTES.find(n => hit(n, true) && n.t.includes(path.basename(dir) + '/')) || NOTES.find(n => hit(n, false));
  let c = n && (classify(n.t) || classify(n.head)), ev = n ? n.f.replace('assets/models/', '') + ': ' + n.t : '';
  if(!c && MESHY[name]){ c = ['Meshy tự sinh', 'gói trả phí của chủ dự án — dùng thương mại được']; ev = 'tools/meshy-assets.json: ' + name; }
  if(!c && IMPORT[name]){ c = ['Meshy cộng đồng', 'CC0 (Meshy Terms §3.3)']; ev = 'tools/scene-import.json: ' + name + ' ← ' + IMPORT[name].src; }
  if(!c){ const h = NOTES.find(n => path.dirname(n.f) === dir); c = h && classify(h.head); if(c) ev = h.f.replace('assets/models/', '') + ' (đầu file): ' + h.head.slice(0, 160); }
  e.group = c ? c[0] : 'chưa rõ'; e.lic = c ? c[1] : 'CẦN DÒ LẠI (git log, ~/Downloads)'; e.ev = ev.slice(0, 420); { const hay = (name + ' ' + (ev.match(/"[^"]*"/g) || []).join(' ')).replace(/_/g, ' '), b = hay.match(BRAND); e.brand = b ? b[0] : ''; } }   // (the model's own name and the title it was posted under — not its neighbours in the note)
const q = s => '"' + String(s).replace(/"/g, '""') + '"', list = [...rows.values()].sort((a, b) => a.group.localeCompare(b.group) || a.key.localeCompare(b.key));
fs.writeFileSync(path.join(ROOT, 'assets', 'LICENSES.csv'), 'model,nhom_nguon,giay_phep,so_ban_sao,MB,nhan_hieu_that,bang_chung\n' + list.map(e => [e.key.replace('assets/models/', ''), e.group, e.lic, e.files, (e.bytes / 1e6).toFixed(1), e.brand, e.ev].map(q).join(',')).join('\n') + '\n');
const by = {}; for(const e of list) by[e.group] = (by[e.group] || 0) + 1;
console.log('models:', list.length, '· files:', list.reduce((s, e) => s + e.files, 0)); for(const [g, n] of Object.entries(by)) console.log(' ', String(n).padStart(4), g);
const br = list.filter(e => e.brand); console.log('real-brand flags:', br.length, br.slice(0, 20).map(e => path.basename(e.key)).join(' '));
const unk = list.filter(e => e.group === 'chưa rõ'); if(unk.length){ console.log('chưa rõ:', unk.map(e => e.key.replace('assets/models/', '')).join(' ')); process.exit(1); }
