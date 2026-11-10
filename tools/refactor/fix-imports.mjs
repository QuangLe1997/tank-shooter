// Recompute every module's `import { … } from '../hub.js'` from what the code really uses, and prune unused names from its
// other imports (three / config / data). Run after moving code:  npm run imports      (Z103)
import fs from 'fs'; import path from 'path'; import { ROOT, listModules, analyse, exportIndex, rel, hubSpec, parse, topDecls } from './lib.mjs';
const idx=exportIndex(); let changed=0;
// names exported by the root config.js (balance tables) — added to a module's config import when it starts using one
const CONFIG=new Set(topDecls(parse(fs.readFileSync(path.join(ROOT,'config.js'),'utf8'))).filter(d=>d.exported).map(d=>d.name));
for(const f of listModules()){ const me=rel(f).replace(/\.js$/,''); if(me.startsWith('data/')) continue;
  let code=fs.readFileSync(f,'utf8'); const A=analyse(code);
  const need=[...A.free].filter(n=>idx.has(n)&&idx.get(n).mod!==me).sort();
  // prune unused specifiers of the non-hub imports
  const used=new Set(A.mod.variables.filter(v=>v.references.length).map(v=>v.name));
  for(const st of [...A.ast.body].reverse()) if(st.type==='ImportDeclaration' && !/hub\.js$/.test(st.source.value)){
    const keep=st.specifiers.filter(sp=>used.has(sp.local.name)); if(keep.length===st.specifiers.length) continue;
    let rep=''; if(keep.length){ const ns=keep.find(s=>s.type==='ImportNamespaceSpecifier'); rep = ns ? `import * as ${ns.local.name} from '${st.source.value}';`
      : `import { ${keep.map(s=>s.imported.name===s.local.name?s.local.name:s.imported.name+' as '+s.local.name).join(', ')} } from '${st.source.value}';`; }
    let end=st.end; if(!rep && code[end]==='\n') end++; code=code.slice(0,st.start)+rep+code.slice(end); }
  // config.js names used but not imported → merge into (or create) the config import
  const cfgNeed=[...A.free].filter(n=>CONFIG.has(n) && !idx.has(n));
  if(cfgNeed.length){ const cre=/^import \{([^}]*)\} from '((?:\.\.\/)+config\.js)';$/m, m=code.match(cre);
    if(m){ const names=[...new Set(m[1].split(',').map(s=>s.trim()).filter(Boolean).concat(cfgNeed))]; code=code.replace(cre, `import { ${names.join(', ')} } from '${m[2]}';`); }
    else { const spec=path.relative(path.dirname(f), path.join(ROOT,'config.js')).replace(/\\/g,'/'); code=code.replace(/^((?:\/\/.*\n)*(?:import \* as THREE.*\n)?)/, mm=>mm+`import { ${cfgNeed.join(', ')} } from '${spec}';\n`); } }
  const line = need.length ? `import { ${need.join(', ')} } from '${hubSpec(f)}';` : '';
  const re=/^import \{[^}]*\} from '[^']*hub\.js';\n?/m;
  let next = re.test(code) ? code.replace(re, line ? line+'\n' : '') : (line ? code.replace(/^((?:\/\/.*\n)*(?:import .*\n)*)/, m=>m+line+'\n') : code);
  if(next!==fs.readFileSync(f,'utf8')){ fs.writeFileSync(f,next); changed++; console.log('  updated '+rel(f)); } }
console.log(`fix-imports: ${changed} module(s) updated`);
