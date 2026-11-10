// Move top-level declarations between modules (Z103):
//   npm run move -- --to ui/settings.js buildSettings openSettings _setQ …        (names may be functions, let/const, classes)
//   options: --after <layer/file>  where a NEW module goes in hub.js (default: right after the first source module)
// • a moved `let x` takes its `__set_x` setter along · the comment block directly above a declaration moves with it
// • the imports the code needs (three / config / data / hub) are rebuilt on both sides (fix-imports)
// • afterwards run `npm test` — deepcheck (R8–R11) proves nothing broke: missing names, read-only writes, evaluation order
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
import { SRC, HUB, listModules, parse, topDecls, rel, hubOrder } from './lib.mjs';
const args=process.argv.slice(2), opt=k=>{ const i=args.indexOf(k); if(i<0) return null; const v=args[i+1]; args.splice(i,2); return v; };
const target=(opt('--to')||'').replace(/^src\//,''), after=opt('--after'); if(!target||!args.length){ console.log('usage: npm run move -- --to <layer/file.js> [--after <layer/file>] name …'); process.exit(1); }
const want=new Set(args); for(const n of args) want.add('__set_'+n);
const tPath=path.join(SRC,target), found=new Set(), chunks=[], srcMods=[], needImports=new Map();
for(const f of listModules()){ if(rel(f)===target) continue; let code=fs.readFileSync(f,'utf8'); const ast=parse(code), decls=topDecls(ast), cuts=[];
  const byStmt=new Map(); for(const d of decls){ if(!byStmt.has(d.stmt)) byStmt.set(d.stmt,[]); byStmt.get(d.stmt).push(d); }
  for(const [st,ds] of byStmt){ const hit=ds.filter(d=>want.has(d.name)); if(!hit.length) continue;
    if(hit.length!==ds.length){ console.log(`✗ ${rel(f)}: "${ds.map(d=>d.name).join(', ')}" share one declaration — split it, or move them all`); process.exit(1); }
    let s=st.start, e=st.end; const ls=code.lastIndexOf('\n',s-1)+1, startsLine=code.slice(ls,s).trim()==='';
    if(code[e]===';') e++;
    const le=code.indexOf('\n',e), rest=code.slice(e, le<0?code.length:le);
    if(startsLine && /^\s*(\/\/.*)?$/.test(rest)){ s=ls; e=le<0?code.length:le+1;                                 // whole line(s) + trailing comment
      const m=code.slice(0,s).match(/(?:^[ \t]*\/\/[^\n]*\n)+$/m); if(m) s-=m[0].length; }                          // + comment block above
    else { while(code[e]===' ') e++; }
    cuts.push([s,e]); hit.forEach(d=>found.add(d.name)); }
  if(!cuts.length) continue; srcMods.push(rel(f).replace(/\.js$/,''));
  for(const st of ast.body) if(st.type==='ImportDeclaration' && !/hub\.js$/.test(st.source.value)) for(const sp of st.specifiers) needImports.set(sp.local.name, { src:st.source.value, sp });
  cuts.sort((a,b)=>a[0]-b[0]); const mine=[]; for(const [s,e] of cuts) mine.push(code.slice(s,e).replace(/\s+$/,''));
  for(const [s,e] of [...cuts].reverse()) code=code.slice(0,s)+code.slice(e);
  chunks.push({ from:rel(f), text:mine.join('\n') }); fs.writeFileSync(f, code.replace(/\n{3,}/g,'\n\n')); }
const missing=args.filter(n=>!found.has(n)); if(missing.length) console.log('⚠ not found at top level: '+missing.join(', '));
if(!chunks.length) process.exit(1);
let body=fs.existsSync(tPath)?fs.readFileSync(tPath,'utf8'):null;
if(body==null){ fs.mkdirSync(path.dirname(tPath),{recursive:true}); body=`// ${target} — TODO one line: what this module owns (shown in ARCHITECTURE.md §2.1). Created by tools/refactor/move.mjs.\n`;
  const h=fs.readFileSync(HUB,'utf8'), anchorMod=after||srcMods[0], anchor=`export * from './${anchorMod}.js';`, line=`export * from './${target}';`;
  if(!h.includes(anchor)){ console.log('✗ hub.js has no '+anchorMod); process.exit(1); }
  fs.writeFileSync(HUB, h.replace(anchor, anchor+'\n'+line)); }
const exportify=t=>t.replace(/^(?!export )((?:async )?function\*? |const |let |class )/gm,'export $1');
for(const c of chunks) body=body.replace(/\s*$/,'\n')+'\n// ---- from '+c.from+' ----\n'+exportify(c.text)+'\n';
// carry the non-hub imports (three / config / data) the moved code uses; fix-imports prunes any that end up unused
const hdr=[]; const bySrc=new Map(); for(const [n,{src,sp}] of needImports){ if(!new RegExp('\\b'+n.replace(/\$/g,'\\$')+'\\b').test(body)) continue; if(new RegExp(`import[^;]*\\b${n}\\b[^;]*from`).test(body)) continue; (bySrc.get(src)||bySrc.set(src,[]).get(src)).push(sp); }
for(const [src,sps] of bySrc){ const ns=sps.find(s=>s.type==='ImportNamespaceSpecifier'); hdr.push(ns?`import * as ${ns.local.name} from '${src}';`:`import { ${sps.map(s=>s.local.name).join(', ')} } from '${src}';`); }
if(hdr.length){ const lines=body.split('\n'); let i=0; while(i<lines.length && /^(\/\/|import )/.test(lines[i])) i++; lines.splice(i,0,...hdr); body=lines.join('\n'); }
fs.writeFileSync(tPath, body.replace(/\s*$/,'\n'));
console.log(`moved ${found.size} declaration(s) → src/${target}  (from ${srcMods.join(', ')})`);
execFileSync(process.execPath, [path.join(path.dirname(new URL(import.meta.url).pathname),'fix-imports.mjs')], { stdio:'inherit' });
