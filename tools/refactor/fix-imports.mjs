// Recompute every module's `import { … } from '../hub.js'` from what the code really uses, and prune unused names from its
// other imports (three / config / data). Run after moving code:  npm run imports      (Z103)
import fs from 'fs'; import { listModules, analyse, exportIndex, rel, hubSpec } from './lib.mjs';
const idx=exportIndex(); let changed=0;
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
  const line = need.length ? `import { ${need.join(', ')} } from '${hubSpec(f)}';` : '';
  const re=/^import \{[^}]*\} from '[^']*hub\.js';\n?/m;
  let next = re.test(code) ? code.replace(re, line ? line+'\n' : '') : (line ? code.replace(/^((?:\/\/.*\n)*(?:import .*\n)*)/, m=>m+line+'\n') : code);
  if(next!==fs.readFileSync(f,'utf8')){ fs.writeFileSync(f,next); changed++; console.log('  updated '+rel(f)); } }
console.log(`fix-imports: ${changed} module(s) updated`);
