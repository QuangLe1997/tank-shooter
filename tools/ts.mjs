#!/usr/bin/env node
// tools/ts.mjs — TEST 1 THE QUICK TEST: one battle in headless Chrome with the GPU, straight into the fight (?test=, dev/hooks.js), and ONE line of JSON out.
//   node tools/ts.mjs <BIOME> [seconds=5] [--seed 7] [--at x,z] [--eval probe.js] [--shot out.jpg] [--profile '{"unit":"xeom"}']
//                     [--level 3] [--tod noon] [--wx clear] [--size 1280x720] [--dpr 1] [--novsync] [--query 'a=b&c']
//   BIOME: DESERT RUINS ARCTIC FOUNDRY CITADEL MEADOW CITY SAVANNA VOLCANO QUARRY
//   --eval file   its text is the BODY of `async (H, S) => { … }` run in the page after <seconds> (H = the hub namespace, S = the game state); its
//                 return value is printed as "eval". A probe may drive the game itself for a while and sample on a timer.
//   --shot file   a JPEG of the frame.   --seed n  the same battlefield every run.   --at x,z  the soldier put down there.
//   --gpumem      DIET 1 what the page holds on the GPU, counted from its first WebGL call (every texture level / buffer / renderbuffer allocated,
//                 less those deleted; compressed formats at their real size): out.gpu = { texMB, bufMB, rbMB, tex, buf, fmt, footprintMB:{ gpu-process, renderer, … } }
//                 (the last: macOS's footprint of this Chrome's processes at the end), and window.__gpuMem() for a probe.
//   --glslow      DIET 7 out.glslow: every WebGL call over 30 ms [s from the fight's start, ms, call, the stack that made it] (a sync wait on the GPU process)
//   --jsflags 'f' DIET 7 V8 flags for the page (e.g. '--trace-gc'; their output: DEBUG=pw:browser* on the runner)
//   --cpuprofile s DIET 7 sample the main thread for the fight's first s seconds: out.cpu = { top: self time by function, busy: every 50 ms slice over 35 ms busy and what filled it }
//   --gc          DIET 4 window.gc() for a probe (collect before reading the JS heap)
//   --novsync     frames as fast as the GPU allows (to compare frame times; with vsync every frame over 16.7 ms falls to 33).
//   Out: { ok, biome, load, frame:{ p50, p95, max, n }, calls, tris, errors:[…], eval, shot } — exit code 0 only when the page logged no error.
// It serves the repo itself (code never cached, assets cached), keeps ONE Chrome profile between runs (compiled shaders and the files stay, so the
// second run starts fast), lets only one test use the GPU at a time (a lock directory), and always closes the browser.
// Needs playwright-core: `npx playwright-core --version` once, or TS_PLAYWRIGHT=/path/to/playwright-core/index.mjs.
import http from 'node:http'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url))), argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; }, has = k => argv.includes(k);
const VAL = new Set(['--cpuprofile', '--jsflags', '--seed', '--at', '--eval', '--shot', '--profile', '--level', '--tod', '--wx', '--size', '--query', '--dpr']), pos = [];
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
  ctx = await chromium.launchPersistentContext(path.join(os.tmpdir(), 'ts-chrome-profile'), { channel:'chrome', headless:true, viewport:{ width:W, height:Hh }, deviceScaleFactor:+opt('--dpr', 1),
    args:['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required', ...(has('--novsync') ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : []), ...(has('--gc') || opt('--jsflags') ? ['--js-flags=' + [has('--gc') ? '--expose-gc' : '', opt('--jsflags') || ''].join(' ').trim()] : [])] });
  const p = ctx.pages()[0] || await ctx.newPage();
  p.on('pageerror', e => out.errors.length < 8 && out.errors.push('pageerror: ' + e.message.slice(0, 300)));
  p.on('console', m => { if(m.type() === 'error' && out.errors.length < 8 && !/favicon|ERR_|404/.test(m.text())) out.errors.push('console: ' + m.text().slice(0, 300)); });
  const prof = Object.assign({ nickname:'TEST', onboarded:true, coached:true, quality:'high', introSeen:{ DESERT:1, RUINS:1, FOUNDRY:1, CITADEL:1, MEADOW:1, CITY:1, SAVANNA:1, ARCTIC:1, VOLCANO:1, QUARRY:1 }, tips:{ all:1 } }, JSON.parse(opt('--profile', '{}')));
  await p.addInitScript(pr => { try{ localStorage.setItem('steelsiege.profile', JSON.stringify(pr)); }catch(e){} }, prof);
  if(has('--gpumem')) await p.addInitScript(() => {   // DIET 1 the GPU tally (see --gpumem): texture bytes per (texture, face, level), buffers by size, renderbuffers
    try{ performance.setResourceTimingBufferSize(20000); }catch(e){}
    const P = WebGL2RenderingContext.prototype, TX = window.__gpuTX = new Map(), BF = new Map(), RB = new Map(), cur = { tex:{}, unit:0, buf:{}, rb:null }, FMT = {};
    const BPP = { 0x8058:4, 0x8C43:4, 0x1908:4, 0x8051:4, 0x8C41:4, 0x1907:4, 0x881A:8, 0x881B:8, 0x8814:16, 0x8815:16, 0x8229:1, 0x822B:2, 0x822D:2, 0x822E:4, 0x822F:4, 0x8230:8, 0x88F0:4, 0x81A6:4, 0x81A5:2, 0x8CAC:4, 0x8D48:1, 0x1909:1, 0x190A:2, 0x1906:1, 0x8C3A:4, 0x8C3D:4,
      0x8E8C:1, 0x8E8D:1, 0x93B0:1, 0x93D0:1, 0x9278:1, 0x9279:1, 0x9274:0.5, 0x9275:0.5, 0x83F0:0.5, 0x83F1:0.5, 0x8C4C:0.5, 0x8C4D:0.5, 0x83F2:1, 0x83F3:1, 0x8C4E:1, 0x8C4F:1, 0x8D64:0.5, 0x8DBB:0.5, 0x8DBD:1 };
    const bpp = (f, type) => f === 0x1908 && (type === 0x1406) ? 16 : f === 0x1908 && type === 0x140B ? 8 : (BPP[f] != null ? BPP[f] : 4);
    const slot = t => cur.tex[cur.unit + ':' + (t >= 0x8515 && t <= 0x851A ? 0x8513 : t)];
    const put = (tex, key, b, f) => { if(!tex) return; let m = TX.get(tex); if(!m) TX.set(tex, m = new Map()); m.set(key, b); FMT[f] = 1; };
    const wrap = (n, fn) => { const o = P[n]; P[n] = function(...a){ try{ fn.call(this, a); }catch(e){} return o.apply(this, a); }; };
    wrap('activeTexture', a => { cur.unit = a[0]; }); wrap('bindTexture', a => { cur.tex[cur.unit + ':' + a[0]] = a[1]; }); wrap('deleteTexture', a => TX.delete(a[0]));
    wrap('texImage2D', a => { const w = a.length >= 9 ? a[3] : (a[5].videoWidth || a[5].width), h = a.length >= 9 ? a[4] : (a[5].videoHeight || a[5].height), ty = a.length >= 9 ? a[7] : a[4]; put(slot(a[0]), a[0] + ':' + a[1], w * h * bpp(a[2], ty), a[2]); });
    wrap('texImage3D', a => put(slot(a[0]), a[0] + ':' + a[1], a[3] * a[4] * a[5] * bpp(a[2], a[8]), a[2]));
    wrap('texStorage2D', a => { const t = slot(a[0]), f = a[0] === 0x8513 ? 6 : 1; for(let l = 0; l < a[1]; l++) put(t, 's:' + l, Math.max(1, a[3] >> l) * Math.max(1, a[4] >> l) * bpp(a[2]) * f, a[2]); });
    wrap('texStorage3D', a => { const t = slot(a[0]); for(let l = 0; l < a[1]; l++) put(t, 's:' + l, Math.max(1, a[3] >> l) * Math.max(1, a[4] >> l) * (a[0] === 0x8C1A ? a[5] : Math.max(1, a[5] >> l)) * bpp(a[2]), a[2]); });
    wrap('compressedTexImage2D', a => put(slot(a[0]), a[0] + ':' + a[1], a[6] && a[6].byteLength != null ? a[6].byteLength : a[3] * a[4] * bpp(a[2]), a[2]));
    wrap('bindBuffer', a => { cur.buf[a[0]] = a[1]; }); wrap('deleteBuffer', a => BF.delete(a[0]));
    wrap('bufferData', a => { const b = cur.buf[a[0]]; if(b) BF.set(b, typeof a[1] === 'number' ? a[1] : a[1].byteLength); });
    wrap('bindRenderbuffer', a => { cur.rb = a[1]; }); wrap('deleteRenderbuffer', a => RB.delete(a[0]));
    wrap('renderbufferStorage', a => cur.rb && RB.set(cur.rb, a[2] * a[3] * bpp(a[1])));
    wrap('renderbufferStorageMultisample', a => cur.rb && RB.set(cur.rb, a[3] * a[4] * bpp(a[2]) * a[1]));
    const sum = M => { let s = 0; for(const v of M.values()) s += typeof v === 'number' ? v : [...v.values()].reduce((x, y) => x + y, 0); return s; }, mb = b => +(b / 1048576).toFixed(1);
    window.__gpuMem = () => ({ texMB:mb(sum(TX)), bufMB:mb(sum(BF)), rbMB:mb(sum(RB)), tex:TX.size, buf:BF.size, fmt:Object.keys(FMT).map(f => (+f).toString(16)).join(' ') }); });
  if(has('--glslow')) await p.addInitScript(() => {   // DIET 7 every WebGL call that holds the main thread over 30 ms (a sync round-trip to a busy GPU process), with who made it
    const P = WebGL2RenderingContext.prototype, L = window.__glSlow = []; for(const n of Object.getOwnPropertyNames(P)){ const d = Object.getOwnPropertyDescriptor(P, n); if(!d || typeof d.value !== 'function' || n === 'constructor') continue; const o = d.value;
      P[n] = function(...a){ const t = performance.now(); try{ return o.apply(this, a); } finally{ const ms = performance.now() - t; if(ms > 30 && L.length < 30) L.push([Math.round(t), Math.round(ms), n, (new Error().stack || '').split('\n').slice(2, 7).map(s => s.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '').replace(/^.*\/npm\//, '')).join(' < ')]); } }; } });
  const q = ['perf', 'nogov', 'test=' + biome, 'level=' + opt('--level', '3'), 'tod=' + opt('--tod', 'noon'), 'wx=' + opt('--wx', 'clear')];
  if(has('--novsync')) q.push('nopace'); if(opt('--seed')) q.push('seed=' + opt('--seed')); if(opt('--at')) q.push('at=' + opt('--at')); if(opt('--query')) q.push(opt('--query'));
  const t0 = Date.now(); await p.goto('http://127.0.0.1:' + port + '/?' + q.join('&')); await p.waitForFunction(() => window.__ready, null, { timeout:150000 });
  out.load = +((Date.now() - t0) / 1000).toFixed(1);
  // frame times over the watched seconds: the game's own probe (?perf — render/perfhud.js PH.frm, the time between two frames it drew), sampled as it goes
  await p.evaluate(async () => { const H = window.__H = await import('/src/hub.js'), PH = H.PH, F = window.__tsF = []; let seen = PH.frm.i;
    window.__tsI = setInterval(() => { const r = PH.frm, n = r.a.length; while(seen !== r.i){ F.push(r.a[seen]); seen = (seen + 1) % n; } }, 200); });
  let cdpP = null; if(opt('--cpucdpPile')){ cdpP = await ctx.newCDPSession(p); await cdpP.send('Profiler.enable'); await cdpP.send('Profiler.setSamplingInterval', { interval:200 }); await cdpP.send('Profiler.start'); }
  if(cdpP){ const w = Math.min(secs, +opt('--cpucdpPile')) * 1000; await p.waitForTimeout(w); const { profile:P } = await cdpP.send('Profiler.stop'); await p.waitForTimeout(Math.max(0, secs * 1000 - w));   // DIET 7 where the main thread's time went in the fight's first seconds
    const self = new Map(), byId = new Map(P.nodes.map(n => [n.id, n])); P.samples.forEach((id, i) => self.set(id, (self.get(id) || 0) + (P.timeDeltas[i] || 0)));
    const agg = {}; for(const [id, us] of self){ const c = byId.get(id).callFrame, k = (c.functionName || '(anon)') + ' ' + (c.url || '').replace(/^.*\/(src|assets)\//, '$1/').replace(/^.*\/npm\//, '') + ':' + (c.lineNumber + 1); agg[k] = (agg[k] || 0) + us; }
    // the longest gaps between samples' time order are not visible here; the worst 600 ms is found by summing self time in 50 ms buckets
    const B = {}; let t = P.startTime; P.samples.forEach((id, i) => { t += P.timeDeltas[i] || 0; const b = Math.floor((t - P.startTime) / 50000), c = byId.get(id).callFrame, k = (c.functionName || '(anon)') + ' ' + (c.url || '').replace(/^.*\/(src|assets)\//, '$1/').replace(/^.*\/npm\//, '') + ':' + (c.lineNumber + 1);
      if(c.functionName === '(idle)' || c.functionName === '(program)') return; const e = B[b] || (B[b] = {}); e[k] = (e[k] || 0) + (P.timeDeltas[i] || 0); });
    const busy = Object.entries(B).map(([b, e]) => [+b * 0.05, Object.values(e).reduce((x, y) => x + y, 0) / 1000, Object.entries(e).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, v]) => Math.round(v / 1000) + 'ms ' + k)]).filter(x => x[1] > 35);
    out.cpu = { top:Object.entries(agg).filter(([k]) => !/^\((idle|program)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => Math.round(v / 1000) + 'ms ' + k), busy:busy.slice(0, 30) }; }
  else await p.waitForTimeout(secs * 1000);
  Object.assign(out, await p.evaluate(() => { clearInterval(window.__tsI); const H = window.__H, F = window.__tsF.sort((a, b) => a - b), at = k => F.length ? +F[Math.min(F.length - 1, Math.floor(F.length * k))].toFixed(1) : 0;
    return { frame:{ p50:at(0.5), p95:at(0.95), max:at(1), n:F.length }, calls:H.PH.calls, tris:H.PH.tris }; }));
  if(opt('--eval')){ const body = fs.readFileSync(opt('--eval'), 'utf8'); try{ out.eval = await p.evaluate(`(async (H, S) => { ${body}\n})(window.__H, window.__H.S)`); }catch(e){ out.errors.push('eval: ' + String(e.message).slice(0, 400)); } }
  if(has('--glslow')) out.glslow = await p.evaluate(() => { const t1 = window.__H && window.__H.PH && window.__H.PH.t1 || 0; return window.__glSlow.map(([t, ms, n, s]) => [+((t - t1) / 1000).toFixed(2), ms, n, s]); });
  if(has('--gpumem')){ out.gpu = await p.evaluate(() => window.__gpuMem());   // + what macOS charges this Chrome's processes (footprint: the GPU process holds the textures, the renderer the page)
    try{ const { execFileSync } = await import('node:child_process'), prof = path.join(os.tmpdir(), 'ts-chrome-profile'), L = execFileSync('ps', ['-Ao', 'pid=,command='], { encoding:'utf8' }).split('\n').filter(l => l.includes(prof));
      const pid = L.map(l => +l.trim().split(/\s+/)[0]).filter(Boolean), kind = Object.fromEntries(L.map(l => [+l.trim().split(/\s+/)[0], (l.match(/--type=([\w-]+)/) || [, 'browser'])[1]])), f = path.join(os.tmpdir(), 'ts-fp-' + process.pid + '.json');
      execFileSync('footprint', ['-j', f, ...pid.map(String)], { stdio:'ignore' }); const J = JSON.parse(fs.readFileSync(f, 'utf8')); fs.rmSync(f, { force:true }); const by = {};
      for(const q of J.processes || []){ const k = kind[q.pid] || '?'; by[k] = (by[k] || 0) + q.footprint; } for(const k in by) by[k] = Math.round(by[k] / 1048576); out.gpu.footprintMB = by; }catch(e){ out.gpu.footprintMB = 'n/a: ' + String(e.message).slice(0, 80); } }
  if(opt('--shot')){ await p.screenshot({ path:opt('--shot'), type:'jpeg', quality:80 }); out.shot = opt('--shot'); }
  out.ok = !out.errors.length; await done(out.ok ? 0 : 1);
}catch(e){ out.errors.push('runner: ' + String(e.message).slice(0, 400)); await done(2); }
