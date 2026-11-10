// Deep module check (Z103) — scope analysis, so it catches what the regex archcheck cannot. Part of `npm test` when the
// devDependencies are installed. Rules (ARCHITECTURE.md §3):
//   R8  hub imports are exact: nothing missing (→ ReferenceError at runtime), nothing stale (warning)
//   R9  every free name resolves: a hub export or a known browser/language global
//   R10 no module assigns to an imported binding (imports are read-only → TypeError); write through a __set_x setter
//   R11 top-level code only reads let/const/class from modules evaluated EARLIER in hub.js (else a TDZ ReferenceError)
import fs from 'fs'; import { listModules, analyse, exportIndex, rel, hubOrder, GLOBALS } from './lib.mjs';
const idx=exportIndex(), order=hubOrder().map(h=>h.replace(/\.js$/,'')), pos=new Map(order.map((m,i)=>[m,i]));
const errors=[], warns=[];
for(const f of listModules()){ const me=rel(f).replace(/\.js$/,''); const A=analyse(fs.readFileSync(f,'utf8'));
  const need=new Set([...A.free].filter(n=>idx.has(n)&&idx.get(n).mod!==me));
  if(!me.startsWith('data/')){
    for(const n of need) if(!A.hubBound.has(n)) errors.push(`R8 ${me}: uses "${n}" (from ${idx.get(n).mod}) without importing it — run npm run imports`);
    for(const n of A.hubBound) if(!need.has(n)) warns.push(`R8 ${me}: imports "${n}" but never uses it`); }
  for(const n of A.free) if(!idx.has(n) && !GLOBALS.has(n)) errors.push(`R9 ${me}: "${n}" resolves nowhere (typo, unexported, or add it to GLOBALS in tools/refactor/lib.mjs)`);
  for(const v of A.mod.variables) if(A.hubBound.has(v.name)||A.other.has(v.name)) for(const r of v.references) if(r.isWrite()) errors.push(`R10 ${me}:${r.identifier.loc.start.line} assigns to imported "${v.name}" — use __set_${v.name}()`);
  for(const r of A.refs){ const n=r.identifier.name, d=idx.get(n); if(!d || d.kind==='function' || r.from.variableScope.type!=='module') continue;
    if(pos.get(d.mod)>pos.get(me)) errors.push(`R11 ${me}:${r.identifier.loc.start.line} top-level code reads "${n}" from ${d.mod}, which is evaluated later in hub.js`); } }
console.log(`deepcheck: ${listModules().length} modules · ${errors.length} errors · ${warns.length} warnings`);
for(const w of warns) console.log('  ⚠ '+w); for(const e of errors) console.log('  ✗ '+e);
process.exit(errors.length?1:0);
