// tools/stage-offline.mjs — copy the web game into a folder that runs with NO network: three.js (core + only the addon files the
// game imports, plus their own imports) and the Google fonts are vendored, index.html is rewritten to load them locally.
// Shared by the native shells: desktop/ (macOS, Electron) and mobile/ (iOS, Capacitor).
//   await stageOffline({ root, out, threeDir, log })   → out/ is ready to serve from app:// or capacitor://
import fs from 'node:fs'; import path from 'node:path';

export async function stageOffline({ root, out, threeDir, log=console.log }){
  fs.rmSync(out,{recursive:true,force:true}); fs.mkdirSync(out,{recursive:true});
  for(const f of ['index.html','config.js']) fs.copyFileSync(path.join(root,f), path.join(out,f));
  for(const d of ['src','css','assets']) fs.cpSync(path.join(root,d), path.join(out,d), { recursive:true });
  // three.js: the core module + the closure of every addon the game imports
  const vend=path.join(out,'vendor','three'); fs.mkdirSync(path.join(vend,'build'),{recursive:true});
  fs.copyFileSync(path.join(threeDir,'build','three.module.js'), path.join(vend,'build','three.module.js'));
  const roots=new Set(); const scan=(dir)=>{ for(const e of fs.readdirSync(dir,{withFileTypes:true})){ const p=path.join(dir,e.name); if(e.isDirectory()) scan(p); else if(p.endsWith('.js')) for(const m of fs.readFileSync(p,'utf8').matchAll(/three\/addons\/([\w./-]+\.js)/g)) roots.add(m[1]); } };
  scan(path.join(root,'src'));
  const seen=new Set(), queue=[...roots];
  while(queue.length){ const rel=queue.shift(); if(seen.has(rel)) continue; seen.add(rel); const src=path.join(threeDir,'examples','jsm',rel); const txt=fs.readFileSync(src,'utf8');
    const o=path.join(vend,'examples','jsm',rel); fs.mkdirSync(path.dirname(o),{recursive:true}); fs.writeFileSync(o,txt);
    for(const m of txt.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1]))); }
  log('three addons vendored:', seen.size, 'files');
  // fonts: download the Google Fonts CSS + woff2 files once, serve them from ./fonts
  let html=fs.readFileSync(path.join(out,'index.html'),'utf8');
  const fontHref=(html.match(/https:\/\/fonts\.googleapis\.com\/css2\?[^"']+/)||[])[0];
  if(fontHref){ try{ const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
      let css=await (await fetch(fontHref.replace(/&amp;/g,'&'),{headers:{'User-Agent':UA}})).text(); const fd=path.join(out,'fonts'); fs.mkdirSync(fd,{recursive:true}); let i=0;
      for(const m of [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)]){ const name='f'+(i++)+'.woff2'; fs.writeFileSync(path.join(fd,name), Buffer.from(await (await fetch(m[1])).arrayBuffer())); css=css.replace(m[1], name); }
      fs.writeFileSync(path.join(fd,'fonts.css'), css); html=html.replace(/<link[^>]+fonts\.googleapis\.com\/css2[^>]+>/, '<link rel="stylesheet" href="fonts/fonts.css" />'); log('fonts vendored:', i, 'files'); }
    catch(e){ log('fonts: offline download failed, falling back to system fonts —', e.message); } }
  html=html.replace(/<link[^>]+rel="preconnect"[^>]*>\s*/g,'')
    .replace(/<link[^>]+rel="manifest"[^>]*>\s*/g,'')                     // the installed shells are not web apps: no manifest, no service worker
    .replaceAll('https://cdn.jsdelivr.net/npm/three@0.169.0/build/', './vendor/three/build/')
    .replaceAll('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/', './vendor/three/examples/jsm/')
    .replace(/\s*crossorigin(?=[\s/>])/g,'');
  if(/cdn\.jsdelivr\.net/.test(html)) throw new Error('index.html still points at the CDN');
  fs.writeFileSync(path.join(out,'index.html'), html);
  return out;
}
