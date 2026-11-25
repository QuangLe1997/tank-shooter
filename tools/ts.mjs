#!/usr/bin/env node
// tools/ts.mjs — TEST 1 THE QUICK TEST: one battle in headless Chrome with the GPU, straight into the fight (?test=, dev/hooks.js), and ONE line of JSON out.
//   node tools/ts.mjs <BIOME> [seconds=5] [--seed 7] [--at x,z] [--eval probe.js] [--shot out.jpg] [--profile '{"unit":"xeom"}']
//                     [--level 3] [--tod noon] [--wx clear] [--size 1280x720] [--novsync] [--query 'a=b&c']
//   BIOME: DESERT RUINS ARCTIC FOUNDRY CITADEL MEADOW CITY SAVANNA VOLCANO QUARRY
//   --eval file   its text is the BODY of `async (H, S) => { … }` run in the page after <seconds> (H = the hub namespace, S = the game state); its
//                 return value is printed as "eval". A probe may drive the game itself for a while and sample on a timer.
//   --shot file   a JPEG of the frame.   --seed n  the same battlefield every run.   --at x,z  the soldier put down there.
//   --novsync     frames as fast as the GPU allows (to compare frame times; with vsync every frame over 16.7 ms falls to 33).
//   Out: { ok, biome, load, frame:{ p50, p95, max, n }, calls, tris, errors:[…], eval, shot } — exit code 0 only when the page logged no error.
// It serves the repo itself (code never cached, assets cached), keeps ONE Chrome profile between runs (compiled shaders and the files stay, so the
// second run starts fast), lets only one test use the GPU at a time (a lock directory), and always closes the browser.
// Needs playwright-core: `npx playwright-core --version` once, or TS_PLAYWRIGHT=/path/to/playwright-core/index.mjs.
import http from 'node:http'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url))), argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; }, has = k => argv.includes(k);
const VAL = new Set(['--seed', '--at', '--eval', '--shot', '--profile', '--level', '--tod', '--wx', '--size', '--query']), pos = [];
for(let i = 0; i < argv.length; i++){ if(VAL.has(argv[i])){ i++; continue; } if(!argv[i].startsWith('--')) pos.push(argv[i]); }
const biome = (pos[0] || '').toUpperCase(), secs = +(pos[1] || 5);
if(!biome){ console.log('usage: node tools/ts.mjs <BIOME> [seconds] [--seed n] [--at x,z] [--eval probe.js] [--shot out.jpg] [--novsync]'); process.exit(2); }

function findPlaywright(){ const c = [process.env.TS_PLAYWRIGHT, path.join(ROOT, 'node_modules/playwright-core/index.mjs'), path.join(ROOT, 'desktop/node_modules/playwright-core/index.mjs')];
  try{ const npx = path.join(os.homedir(), '.npm/_npx'); for(const d of fs.readdirSync(npx)) c.push(path.join(npx, d, 'node_modules/playwright-core/index.mjs')); }catch(e){}
  return c.find(f => f && fs.existsSync(f)); }
const pw = findPlaywright(); if(!pw){ console.log(JSON.stringify({ ok:false, errors:['playwright-core not found — run `npx playwright-core --version` once or set TS_PLAYWRIGHT'] })); process.exit(2); }
const { chromium } = await import(pathToFileURL(pw).href);

// the repo over http: code fresh every time, assets cached for the day
const MIME = { '.js':'text/javascript', '.mjs':'text/javascript', '.html':'text/html', '.css':'text/css', '.json':'application/json', '.glb':'model/gltf-binary', '.gltf':'model/gltf+json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ktx2':'image/ktx2', '.svg':'image/svg+xml', '.wasm':'application/wasm', '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.wav':'audio/wav', '.hdr':'application/octet-stream', '.bin':'application/octet-stream', '.woff2':'font/woff2', '.ico':'image/x-icon' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if(u.endsWith('/')) u += 'index.html'; const f = path.join(ROOT, u);
  if(!f.startsWith(ROOT)){ r.writeHead(403); return r.end(); }
  fs.stat(f, (e, st) => { if(e || !st.isFile()){ r.writeHead(404); return r.end('404'); }
    r.writeHead(200, { 'Content-Type':MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Content-Length':st.size, 'Cache-Control':u.startsWith('/assets/') ? 'max-age=86400' : 'no-store' }); fs.createReadStream(f).pipe(r); }); });
await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const port = srv.address().port;

// one GPU test at a time on this machine: a lock directory holding the owner's pid (a dead owner's lock is taken over)
const LOCK = path.join(os.tmpdir(), 'ts-gpu.lock'), alive = pid => { try{ process.kill(pid, 0); return true; }catch(e){ return false; } };
for(let i = 0; ; i++){ try{ fs.mkdirSync(LOCK); fs.writeFileSync(path.join(LOCK, 'pid'), String(process.pid)); break; }
  catch(e){ let pid = 0; try{ pid = +fs.readFileSync(path.join(LOCK, 'pid'), 'utf8'); }catch(e2){} if(!pid || !alive(pid)){ try{ fs.rmSync(LOCK, { recursive:true, force:true }); }catch(e3){} continue; }
    if(i > 1800){ console.log(JSON.stringify({ ok:false, errors:['GPU lock held by pid ' + pid + ' for 30 min'] })); process.exit(2); } await new Promise(r => setTimeout(r, 1000)); } }
const unlock = () => { try{ fs.rmSync(LOCK, { recursive:true, force:true }); }catch(e){} };

const out = { ok:false, biome, load:0, frame:null, calls:0, tris:0, errors:[], eval:null, shot:null }; let ctx = null;
const [W, Hh] = (opt('--size', '1280x720')).split('x').map(Number);
const kill = setTimeout(() => { out.errors.push('WATCHDOG: took too long'); done(2); }, (secs + 180) * 1000);
async function done(code){ clearTimeout(kill); try{ if(ctx) await ctx.close(); }catch(e){} unlock(); srv.close(); console.log(JSON.stringify(out)); process.exit(code); }
process.on('SIGINT', () => done(2)); process.on('SIGTERM', () => done(2));
try{
  ctx = await chromium.launchPersistentContext(path.join(os.tmpdir(), 'ts-chrome-profile'), { channel:'chrome', headless:true, viewport:{ width:W, height:Hh }, deviceScaleFactor:1,
    args:['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio', ...(has('--novsync') ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : [])] });
  const p = ctx.pages()[0] || await ctx.newPage();
  p.on('pageerror', e => out.errors.length < 8 && out.errors.push('pageerror: ' + e.message.slice(0, 300)));
  p.on('console', m => { if(m.type() === 'error' && out.errors.length < 8 && !/favicon|ERR_|404/.test(m.text())) out.errors.push('console: ' + m.text().slice(0, 300)); });
  const prof = Object.assign({ nickname:'TEST', onboarded:true, coached:true, quality:'high', introSeen:{ DESERT:1, RUINS:1, FOUNDRY:1, CITADEL:1, MEADOW:1, CITY:1, SAVANNA:1, ARCTIC:1, VOLCANO:1, QUARRY:1 }, tips:{ all:1 } }, JSON.parse(opt('--profile', '{}')));
  await p.addInitScript(pr => { try{ localStorage.setItem('steelsiege.profile', JSON.stringify(pr)); }catch(e){} }, prof);
  const q = ['perf', 'nogov', 'test=' + biome, 'level=' + opt('--level', '3'), 'tod=' + opt('--tod', 'noon'), 'wx=' + opt('--wx', 'clear')];
  if(opt('--seed')) q.push('seed=' + opt('--seed')); if(opt('--at')) q.push('at=' + opt('--at')); if(opt('--query')) q.push(opt('--query'));
  const t0 = Date.now(); await p.goto('http://127.0.0.1:' + port + '/?' + q.join('&')); await p.waitForFunction(() => window.__ready, null, { timeout:150000 });
  out.load = +((Date.now() - t0) / 1000).toFixed(1);
  // frame times over the watched seconds, measured in the page (requestAnimationFrame to requestAnimationFrame)
  await p.evaluate(() => { const F = window.__tsF = []; let last = performance.now(); const f = now => { F.push(now - last); last = now; if(!window.__tsStop) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await p.waitForTimeout(secs * 1000);
  Object.assign(out, await p.evaluate(async () => { window.__tsStop = true; const H = window.__H = await import('/src/hub.js'), F = window.__tsF.slice(2).sort((a, b) => a - b), at = k => F.length ? +F[Math.min(F.length - 1, Math.floor(F.length * k))].toFixed(1) : 0;
    const i = H.renderer.info.render; return { frame:{ p50:at(0.5), p95:at(0.95), max:at(1), n:F.length }, calls:i.calls, tris:i.triangles }; }));
  if(opt('--eval')){ const body = fs.readFileSync(opt('--eval'), 'utf8'); try{ out.eval = await p.evaluate(`(async (H, S) => { ${body}\n})(window.__H, window.__H.S)`); }catch(e){ out.errors.push('eval: ' + String(e.message).slice(0, 400)); } }
  if(opt('--shot')){ await p.screenshot({ path:opt('--shot'), type:'jpeg', quality:80 }); out.shot = opt('--shot'); }
  out.ok = !out.errors.length; await done(out.ok ? 0 : 1);
}catch(e){ out.errors.push('runner: ' + String(e.message).slice(0, 400)); await done(2); }
