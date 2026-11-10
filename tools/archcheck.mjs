// Architecture guard (Z98) — run: `node tools/archcheck.mjs` (also part of `npm test`).
// Enforces the module rules in ARCHITECTURE.md so the codebase cannot silently drift back into a tangle.
// Zero dependencies: it reads import/export lines with regexes (the code base keeps them one-per-line on purpose).
import fs from 'fs'; import path from 'path';
const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const SRC = path.join(ROOT, 'src');
const files = []; (function walk(d){ for(const f of fs.readdirSync(d)){ const p=path.join(d,f); if(fs.statSync(p).isDirectory()) walk(p); else if(f.endsWith('.js')) files.push(p); } })(SRC);
const rel = p => path.relative(SRC, p).replace(/\\/g,'/');
let errors = [], warns = [];
const err = m => errors.push(m), warn = m => warns.push(m);
const LAYERS = ['data','core','render','audio','world','tank','fx','combat','actors','ai','campaign','loot','input','ui','game','boot'];
const hubSrc = fs.readFileSync(path.join(SRC,'hub.js'),'utf8');
const hubList = [...hubSrc.matchAll(/export \* from '\.\/(.+?)\.js';/g)].map(m=>m[1]);
const exportsBy = new Map();
for(const f of files){
  const r = rel(f), code = fs.readFileSync(f,'utf8'), lines = code.split('\n');
  if(r==='hub.js' || r==='main.js') continue;
  const layer = r.split('/')[0];
  if(!LAYERS.includes(layer)) err(`${r}: unknown layer "${layer}" (allowed: ${LAYERS.join(', ')})`);
  if(r.startsWith('boot/')) continue;                                       // classic scripts, no imports
  // R1 — allowed import sources
  for(const m of code.matchAll(/^import .*? from '([^']+)';/gm)){ const spec=m[1];
    const ok = spec==='three' || spec.startsWith('three/addons/') || /(^|\/)config\.js$/.test(spec) || /\/hub\.js$/.test(spec) || /(^|\/)data\/[\w-]+\.js$/.test(spec) || spec.startsWith('./') && layer==='data';
    if(!ok) err(`${r}: imports '${spec}' directly — system modules import from the hub (or data/*, config.js, three)`); }
  // R2 — data/* is pure: no hub, no three, no DOM, no Math.random at load
  if(layer==='data'){
    if(/from '[^']*hub\.js'/.test(code)) err(`${r}: data module imports the hub (data must be pure)`);
    if(/from 'three/.test(code)) err(`${r}: data module imports three.js (data must be pure)`);
    const bare = code.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');   // ignore comments
    if(/\b(document|window|navigator|localStorage)\b/.test(bare)) err(`${r}: data module touches the DOM/browser (data must be pure)`); }
  // R3 — every system module is in the hub exactly once
  const id = r.replace(/\.js$/,''); const n = hubList.filter(x=>x===id).length;
  if(n!==1) err(`${r}: listed ${n}× in hub.js (must be exactly once)`);
  // R4 — exported names are globally unique (export * silently drops duplicates)
  for(const m of code.matchAll(/^export (?:async )?(?:function\*? |const |let |var |class )([\w$]+)/gm)){ const nm=m[1];
    if(exportsBy.has(nm)) err(`export "${nm}" defined in both ${exportsBy.get(nm)} and ${r}`); else exportsBy.set(nm, r); }
  // R5 — size budget (split a module before it becomes the next index.html)
  if(lines.length > 700) warn(`${r}: ${lines.length} lines (budget 700) — consider splitting`);
}
for(const h of hubList) if(!fs.existsSync(path.join(SRC, h+'.js'))) err(`hub.js lists missing module ${h}.js`);
// R6 — data modules come first in the hub (they must be ready before any system code runs)
const firstSys = hubList.findIndex(h=>!h.startsWith('data/')), lastData = hubList.map(h=>h.startsWith('data/')).lastIndexOf(true);
if(lastData > firstSys) err('hub.js: every data/* module must be listed before the first system module');
// R7 — the HTML shell stays a shell
const html = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
if(/<script type="module">/.test(html)) err('index.html: inline module script found — game code lives in src/');
if(/<style>/.test(html)) err('index.html: inline <style> found — styles live in css/');
const hl = html.split('\n').length; if(hl > 600) warn(`index.html: ${hl} lines — markup only, keep it lean`);
console.log(`archcheck: ${files.length} modules · ${exportsBy.size} exports · ${errors.length} errors · ${warns.length} warnings`);
for(const w of warns) console.log('  ⚠ '+w);
for(const e of errors) console.log('  ✗ '+e);
process.exit(errors.length ? 1 : 0);
