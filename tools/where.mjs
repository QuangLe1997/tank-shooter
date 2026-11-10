// Find which module owns a symbol (Z98): `npm run where -- damageBoss`  (partial names OK; lists every match)
import fs from 'fs'; import path from 'path';
const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname)), SRC = path.join(ROOT,'src'), q = (process.argv[2]||'').toLowerCase();
if(!q){ console.log('usage: npm run where -- <symbol>'); process.exit(1); }
(function walk(d){ for(const f of fs.readdirSync(d)){ const p=path.join(d,f); if(fs.statSync(p).isDirectory()) walk(p); else if(f.endsWith('.js')){
  const lines=fs.readFileSync(p,'utf8').split('\n'); lines.forEach((l,i)=>{ const m=l.match(/^export (?:async )?(?:function\*? |const |let |class )([\w$]+)/); if(m && m[1].toLowerCase().includes(q)) console.log(`${m[1].padEnd(28)} src/${path.relative(SRC,p)}:${i+1}`); }); } } })(SRC);
