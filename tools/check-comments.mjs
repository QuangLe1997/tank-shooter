// tools/check-comments.mjs — guard against an edit that pushes live code behind a `//` comment on a one-line statement.
//   Compares the working tree (or HEAD~1..HEAD with --last) with git: if the tail of a removed line's CODE now sits inside the
//   COMMENT part of an added line in the same hunk, it reports it and exits 1.   usage: node tools/check-comments.mjs [--last]
import { execSync } from 'node:child_process';
const range = process.argv.includes('--last') ? 'HEAD~1 HEAD' : 'HEAD';
let d=''; try{ d=execSync(`git diff -U0 ${range} -- src config.js test.js tools`, { maxBuffer:1e8 }).toString(); }catch(e){ console.log('check-comments: no git diff available — skipped'); process.exit(0); }
const split=(l)=>{ let q=null; for(let i=0;i<l.length-1;i++){ const c=l[i]; if(q){ if(c==='\\') i++; else if(c===q) q=null; } else if(c==='"'||c==="'"||c==='`') q=c; else if(c==='/'&&l[i+1]==='/'&&l[i-1]!==':') return [l.slice(0,i), l.slice(i+2)]; } return [l,'']; };
let file='', rem=[], add=[], hits=0;
const flush=()=>{ for(const a of add){ const [,cm]=split(a); if(!cm) continue; for(const r of rem){ const t=split(r)[0].trim(); if(t.length<12) continue; for(const n of [30,18]){ const tc=t.slice(-n); if(tc.length>=12 && cm.includes(tc)){ hits++; console.log('  ✗ code behind a comment — '+file+' :: …'+cm.slice(-100)); return; } } } } };
for(const l of d.split('\n')){ if(l.startsWith('+++ ')){ flush(); rem=[]; add=[]; file=l.slice(6); } else if(l.startsWith('@@')){ flush(); rem=[]; add=[]; } else if(l.startsWith('-')&&!l.startsWith('---')) rem.push(l.slice(1)); else if(l.startsWith('+')&&!l.startsWith('+++')) add.push(l.slice(1)); }
flush(); console.log('check-comments: '+hits+' problem(s)'); process.exit(hits?1:0);
