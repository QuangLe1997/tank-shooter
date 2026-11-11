// desktop/build.mjs — package Steel Siege as a native Apple-Silicon macOS app.
//   1. stage: copy the web game into ./app with three.js + fonts vendored (tools/stage-offline.mjs) → the app runs fully offline.
//   2. icon: square crop of the start-screen art → .icns (sips + iconutil).
//   3. package: @electron/packager → dist/Steel Siege-darwin-arm64/Steel Siege.app, then install into ~/Applications.
// Usage: node build.mjs            (stage + icon + package + install)
//        node build.mjs --stage    (stage only, for `npm start`)
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url)), ROOT=path.resolve(HERE,'..'), APP=path.join(HERE,'app'), THREE=path.join(HERE,'node_modules','three');
const STAGE_ONLY=process.argv.includes('--stage'), log=(...a)=>console.log('[mac]',...a);

// ---- 1. stage (shared with mobile/ → tools/stage-offline.mjs) ----
const { stageOffline } = await import('../tools/stage-offline.mjs');
await stageOffline({ root:ROOT, out:APP, threeDir:THREE, log });
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
