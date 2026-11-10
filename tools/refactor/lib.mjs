// Shared helpers for the maintainer refactor tools (Z103). Needs the devDependencies (`npm install`); the game never loads this.
import fs from 'fs'; import path from 'path'; import * as acorn from 'acorn'; import * as escope from 'eslint-scope';
export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
export const SRC = path.join(ROOT, 'src');
export const rel = p => path.relative(SRC, p).replace(/\\/g,'/');
export const read = r => fs.readFileSync(path.join(SRC, r), 'utf8');
export const HUB = path.join(SRC, 'hub.js');
// hub order = module evaluation order
export const hubOrder = () => [...fs.readFileSync(HUB,'utf8').matchAll(/export \* from '\.\/(.+?)';/g)].map(m=>m[1]);
export function listModules(){ return hubOrder().filter(r=>!r.startsWith('boot/')).map(r=>path.join(SRC,r)); }
export function parse(code){ return acorn.parse(code, { ecmaVersion:'latest', sourceType:'module', locations:true, ranges:true }); }
export function scopeOf(ast){ const sm=escope.analyze(ast,{ecmaVersion:2022,sourceType:'module'}); return { sm, mod: sm.scopes.find(s=>s.type==='module') }; }
const patNames=(p,out)=>{ if(!p) return; if(p.type==='Identifier') out.push(p.name); else if(p.type==='ObjectPattern') p.properties.forEach(q=>patNames(q.value||q.argument,out)); else if(p.type==='ArrayPattern') p.elements.forEach(e=>patNames(e,out)); else if(p.type==='AssignmentPattern') patNames(p.left,out); else if(p.type==='RestElement') patNames(p.argument,out); };
// every top-level declaration: { name, kind:'function'|'let'|'const'|'class', stmt, exported }
export function topDecls(ast){ const out=[];
  for(const st0 of ast.body){ const exp=st0.type==='ExportNamedDeclaration'&&!!st0.declaration, st=exp?st0.declaration:st0;
    if(st.type==='FunctionDeclaration'||st.type==='ClassDeclaration') out.push({ name:st.id.name, kind:st.type==='ClassDeclaration'?'class':'function', stmt:st0, exported:exp });
    else if(st.type==='VariableDeclaration'){ const ns=[]; st.declarations.forEach(d=>patNames(d.id,ns)); for(const n of ns) out.push({ name:n, kind:st.kind, stmt:st0, exported:exp }); } }
  return out; }
// names a module takes from the hub: used, not declared locally, not imported from three/config/data
export function analyse(code){ const ast=parse(code), { mod }=scopeOf(ast), decls=topDecls(ast);
  const local=new Set(decls.map(d=>d.name)), other=new Set(), hubBound=new Set();
  for(const st of ast.body) if(st.type==='ImportDeclaration') for(const sp of st.specifiers) (/hub\.js$/.test(st.source.value)?hubBound:other).add(sp.local.name);
  const refs=[]; for(const r of mod.through) refs.push(r);
  for(const v of mod.variables) if(hubBound.has(v.name)) for(const r of v.references) refs.push(r);
  const free=new Set(refs.map(r=>r.identifier.name).filter(n=>!local.has(n)&&!other.has(n)));
  return { ast, mod, decls, local, other, hubBound, free, refs }; }
export function exportIndex(){ const idx=new Map(); for(const f of listModules()){ for(const d of topDecls(parse(fs.readFileSync(f,'utf8')))) if(d.exported) idx.set(d.name,{ mod:rel(f).replace(/\.js$/,''), kind:d.kind }); } return idx; }
// browser + language globals a module may use without importing (anything else must come from the hub)
export const GLOBALS = new Set(('window document navigator location history localStorage sessionStorage performance console screen visualViewport innerWidth innerHeight devicePixelRatio '+
 'requestAnimationFrame cancelAnimationFrame requestIdleCallback setTimeout clearTimeout setInterval clearInterval queueMicrotask structuredClone fetch alert confirm prompt '+
 'addEventListener removeEventListener dispatchEvent getComputedStyle matchMedia Image Audio AudioContext OfflineAudioContext OffscreenCanvas HTMLElement Event CustomEvent KeyboardEvent DOMParser XMLSerializer '+
 'Math JSON Date Promise Map Set WeakMap WeakSet Array Object Number String Boolean Symbol Error TypeError RangeError Float32Array Float64Array Uint8Array Uint16Array Uint32Array Int8Array Int16Array Int32Array Uint8ClampedArray ArrayBuffer DataView '+
 'parseInt parseFloat isNaN isFinite Infinity NaN undefined globalThis encodeURIComponent decodeURIComponent btoa atob URL Blob Intl Reflect Proxy BigInt arguments').split(/\s+/));
export function hubSpec(file){ const r=path.relative(path.dirname(file), HUB).replace(/\\/g,'/'); return r.startsWith('.')?r:'./'+r; }
