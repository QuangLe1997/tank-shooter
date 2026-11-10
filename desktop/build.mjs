// desktop/build.mjs — package Steel Siege as a native Apple-Silicon macOS app.
//   1. stage: copy the web game into ./app, vendor three.js (only the addon files the game imports + their deps) and the
//      Google fonts, rewrite index.html to load them locally → the app runs fully offline.
//   2. icon: square crop of the start-screen art → .icns (sips + iconutil).
//   3. package: @electron/packager → dist/Steel Siege-darwin-arm64/Steel Siege.app, then install into ~/Applications.
// Usage: node build.mjs            (stage + icon + package + install)
//        node build.mjs --stage    (stage only, for `npm start`)
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url)), ROOT=path.resolve(HERE,'..'), APP=path.join(HERE,'app'), THREE=path.join(HERE,'node_modules','three');
const STAGE_ONLY=process.argv.includes('--stage'), log=(...a)=>console.log('[mac]',...a);

// ---- 1. stage ----
fs.rmSync(APP,{recursive:true,force:true}); fs.mkdirSync(APP,{recursive:true});
for(const f of ['index.html','config.js']) fs.copyFileSync(path.join(ROOT,f), path.join(APP,f));
for(const d of ['src','css','assets']) fs.cpSync(path.join(ROOT,d), path.join(APP,d), { recursive:true });
// three.js: the core module + the closure of every addon the game imports
const vend=path.join(APP,'vendor','three'); fs.mkdirSync(path.join(vend,'build'),{recursive:true});
fs.copyFileSync(path.join(THREE,'build','three.module.js'), path.join(vend,'build','three.module.js'));
const roots=new Set(); const scan=(dir)=>{ for(const e of fs.readdirSync(dir,{withFileTypes:true})){ const p=path.join(dir,e.name); if(e.isDirectory()) scan(p); else if(p.endsWith('.js')) for(const m of fs.readFileSync(p,'utf8').matchAll(/three\/addons\/([\w./-]+\.js)/g)) roots.add(m[1]); } };
scan(path.join(ROOT,'src'));
const seen=new Set(), queue=[...roots];
while(queue.length){ const rel=queue.shift(); if(seen.has(rel)) continue; seen.add(rel); const src=path.join(THREE,'examples','jsm',rel); const txt=fs.readFileSync(src,'utf8');
  const out=path.join(vend,'examples','jsm',rel); fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,txt);
  for(const m of txt.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1]))); }
log('three addons vendored:', seen.size, 'files');
// fonts: download the Google Fonts CSS + woff2 files once, serve them from ./fonts
let html=fs.readFileSync(path.join(APP,'index.html'),'utf8');
const fontHref=(html.match(/https:\/\/fonts\.googleapis\.com\/css2\?[^"']+/)||[])[0];
if(fontHref){ try{ const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
    let css=await (await fetch(fontHref.replace(/&amp;/g,'&'),{headers:{'User-Agent':UA}})).text(); const fd=path.join(APP,'fonts'); fs.mkdirSync(fd,{recursive:true}); let i=0;
    for(const m of [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)]){ const name='f'+(i++)+'.woff2'; fs.writeFileSync(path.join(fd,name), Buffer.from(await (await fetch(m[1])).arrayBuffer())); css=css.replace(m[1], name); }
    fs.writeFileSync(path.join(fd,'fonts.css'), css); html=html.replace(/<link[^>]+fonts\.googleapis\.com\/css2[^>]+>/, '<link rel="stylesheet" href="fonts/fonts.css" />'); log('fonts vendored:', i, 'files'); }
  catch(e){ log('fonts: offline download failed, falling back to system fonts —', e.message); } }
html=html.replace(/<link[^>]+rel="preconnect"[^>]*>\s*/g,'')
  .replaceAll('https://cdn.jsdelivr.net/npm/three@0.169.0/build/', './vendor/three/build/')
  .replaceAll('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/', './vendor/three/examples/jsm/')
  .replace(/\s*crossorigin(?=[\s/>])/g,'');
if(/cdn\.jsdelivr\.net/.test(html)) throw new Error('index.html still points at the CDN');
fs.writeFileSync(path.join(APP,'index.html'), html);
log('staged game →', path.relative(HERE,APP));
if(STAGE_ONLY) process.exit(0);

// ---- 2. icon ----
const BUILD=path.join(HERE,'build'); fs.mkdirSync(BUILD,{recursive:true}); const ICNS=path.join(BUILD,'icon.icns');
try{ const set=path.join(BUILD,'icon.iconset'), sq=path.join(BUILD,'square.png'); fs.rmSync(set,{recursive:true,force:true}); fs.mkdirSync(set);
  const src=path.join(ROOT,'assets','banner-desktop.jpg'); const info=execFileSync('sips',['-g','pixelWidth','-g','pixelHeight',src]).toString(); const W=+info.match(/pixelWidth: (\d+)/)[1], H=+info.match(/pixelHeight: (\d+)/)[1], S=Math.min(W,H);
  execFileSync('sips',['-s','format','png','--cropToHeightWidth',String(S),String(S),'--cropOffset','0',String(Math.round((W-S)*0.62)),src,'--out',sq],{stdio:'ignore'});
  for(const s of [16,32,128,256,512]){ execFileSync('sips',['-z',String(s),String(s),sq,'--out',path.join(set,`icon_${s}x${s}.png`)],{stdio:'ignore'}); execFileSync('sips',['-z',String(s*2),String(s*2),sq,'--out',path.join(set,`icon_${s}x${s}@2x.png`)],{stdio:'ignore'}); }
  execFileSync('iconutil',['-c','icns',set,'-o',ICNS]); log('icon →', path.relative(HERE,ICNS)); }
catch(e){ log('icon skipped —', e.message); }

// ---- 3. package (arm64 = Apple Silicon M-series) + install ----
const { packager } = await import('@electron/packager');
const pkg=JSON.parse(fs.readFileSync(path.join(HERE,'package.json'),'utf8'));
const [out] = await packager({ dir:HERE, out:path.join(HERE,'dist'), overwrite:true, platform:'darwin', arch:'arm64', name:'Steel Siege', executableName:'Steel Siege',
  appBundleId:'vn.quangle.steelsiege', appCategoryType:'public.app-category.action-games', appVersion:pkg.version, buildVersion:String(Date.now()).slice(-8),
  icon: fs.existsSync(ICNS) ? ICNS : undefined, asar:true, prune:true, darwinDarkModeSupport:true,
  ignore:[/^\/dist($|\/)/, /^\/build($|\/)/, /^\/build\.mjs$/, /^\/README/] });
const appPath=path.join(out,'Steel Siege.app'); log('packaged →', path.relative(HERE,appPath));
const dest=path.join(os.homedir(),'Applications'); fs.mkdirSync(dest,{recursive:true}); const inst=path.join(dest,'Steel Siege.app');
fs.rmSync(inst,{recursive:true,force:true}); execFileSync('ditto',[appPath,inst]); log('installed →', inst);
