// mobile/build.mjs — package Steel Siege as a native iPhone/iPad app (Capacitor: the game runs in WKWebView, WebGL on Metal).
//   1. stage: copy the web game into ./www with three.js + fonts vendored (tools/stage-offline.mjs) → plays fully offline.
//   2. sync: copy ./www into the Xcode project (ios/App/App/public) + capacitor config.
//   3. open: Xcode (pick your iPhone at the top, press ▶ Run). Needs the full Xcode app, not just the Command Line Tools.
// Usage: node build.mjs            (stage + sync + open Xcode)
//        node build.mjs --no-open  (stage + sync only)
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync, spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url)), ROOT=path.resolve(HERE,'..'), WWW=path.join(HERE,'www'), THREE=path.join(HERE,'node_modules','three');
const log=(...a)=>console.log('[ios]',...a), cap=(...args)=>execFileSync('npx',['cap',...args],{ cwd:HERE, stdio:'inherit' });

const { stageOffline } = await import('../tools/stage-offline.mjs');
await stageOffline({ root:ROOT, out:WWW, threeDir:THREE, log });
log('staged game →', path.relative(HERE,WWW));

if(!fs.existsSync(path.join(HERE,'ios','App','App.xcodeproj'))) cap('add','ios');   // only on a fresh checkout without ios/
cap('sync','ios');

const xcode=spawnSync('xcodebuild',['-version'],{ encoding:'utf8' });
if(xcode.status!==0){
  log('Xcode chưa có (máy chỉ có Command Line Tools). Cài Xcode từ App Store, rồi chạy:');
  log('  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer');
  log('  cd mobile && npm run ios');
  process.exit(0);
}
if(!process.argv.includes('--no-open')) cap('open','ios');
