// One command for every pre-commit check (Z98): `npm test`
//   1. syntax-check every ES module (src/**, config.js, test.js)   2. architecture rules (tools/archcheck.mjs)
//   3. deep scope check (tools/refactor/deepcheck.mjs — R8–R11, needs `npm install`)   4. data + balance tests (test.js)
import { execFileSync } from 'child_process'; import fs from 'fs'; import path from 'path';
const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const files = ['config.js','test.js']; (function walk(d){ for(const f of fs.readdirSync(d)){ const p=path.join(d,f); if(fs.statSync(p).isDirectory()) walk(p); else if(f.endsWith('.js')||f.endsWith('.mjs')) files.push(path.relative(ROOT,p)); } })(path.join(ROOT,'src'));
let bad=0; for(const f of files){ try{ execFileSync(process.execPath, ['--check', f], { cwd:ROOT, stdio:'pipe' }); } catch(e){ bad++; console.log('✗ syntax '+f+'\n'+String(e.stderr||e.message).split('\n').slice(0,4).join('\n')); } }
console.log(`syntax: ${files.length} files · ${bad} failed`); if(bad) process.exit(1);
const deep = fs.existsSync(path.join(ROOT,'node_modules','acorn')) && fs.existsSync(path.join(ROOT,'node_modules','eslint-scope'));
if(!deep) console.log('⚠ deepcheck skipped — run `npm install` once to enable the scope-level module checks (R8–R11)');
for(const script of ['tools/archcheck.mjs', ...(deep?['tools/refactor/deepcheck.mjs']:[]), 'test.js']){ try{ const out=execFileSync(process.execPath, [script], { cwd:ROOT, stdio:'pipe' }).toString(); console.log(out.trim().split('\n').filter(l=>/archcheck:|deepcheck:|PASS|FAIL|✗|⚠/.test(l)).join('\n')); }
  catch(e){ console.log(String(e.stdout||'')+String(e.stderr||'')); process.exit(1); } }
console.log('✓ verify: all checks passed');
