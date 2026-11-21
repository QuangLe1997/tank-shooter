#!/usr/bin/env node
// tools/pose-studio.mjs — Z349 THE POSE STUDIO, HEADLESS: for every soldier × weapon × view, how he holds it — measured and photographed —
//   into one folder: PNGs, report.json and report.html (the pictures in a grid per soldier and stance, the measurements beside them, flags in red).
//   Run it after adding a soldier model (PROFILE.trooper) or regenerating a gun model (assets/models/real/gun/inf/*.glb), then open report.html.
//
//   npm run serve                      (the game on http://127.0.0.1:8765, in another terminal)
//   node tools/pose-studio.mjs [--troopers s2,op] [--guns all|carbine,t_lmg] [--stances stand,crouch,prone,mount]
//                              [--views stand34,handsL,handsR,left,back] [--port 8765] [--out studio-shots] [--suggest]
//   Views per stance: stand → --views; crouch → kneel; prone → prone; mount → mount, mountBack. --suggest adds each gun model's profile and
//   suggested GUNHOLD numbers (butt, grip, palm) to report.json. It needs playwright-core (npm i -D playwright-core, or one already in the npx cache)
//   and Google Chrome.
import { mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const TROOPERS = String(arg('troopers', 's2,op')).split(','), STANCES = String(arg('stances', 'stand,crouch,prone')).split(','), VIEWS = String(arg('views', 'stand34,handsL,handsR,left')).split(',');
const PORT = arg('port', '8765'), OUT = resolve(String(arg('out', 'studio-shots'))), SUGGEST = !!arg('suggest', false), GUNARG = String(arg('guns', 'all'));
const STANCE_VIEWS = { stand:VIEWS, crouch:['kneel'], prone:['prone'], mount:['mount', 'mountBack'] };

async function playwright(){ try { return await import('playwright-core'); } catch {}
  const npx = join(homedir(), '.npm', '_npx'); if(existsSync(npx)) for(const d of readdirSync(npx)){ const p = join(npx, d, 'node_modules', 'playwright-core', 'index.mjs'); if(existsSync(p)) return import(p); }
  throw new Error('pose-studio: needs playwright-core — npm i -D playwright-core'); }

const { chromium } = await playwright(); mkdirSync(OUT, { recursive:true });
const browser = await chromium.launch({ channel:'chrome', headless:true, args:['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const report = { at:new Date().toISOString(), port:PORT, troopers:{} };
try {
  for(const tr of TROOPERS){
    const page = await browser.newPage({ viewport:{ width:1600, height:1000 } }); const errs = []; page.on('pageerror', e => errs.push(e.message));
    const cdp = await page.context().newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled:true });
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil:'load' }); await page.waitForTimeout(2000);
    await page.evaluate(async tr => { const H = await import('/src/hub.js'); window.H = H; await H.poseStudio.start({ trooper:tr }); }, tr);
    const guns = GUNARG === 'all' ? await page.evaluate(() => window.H.poseStudio.guns()) : GUNARG.split(',');
    const R = report.troopers[tr] = { guns:{}, errors:errs };
    for(const g of guns){ const G = R.guns[g] = { stances:{}, shots:{} }; await page.evaluate(g => window.H.poseStudio.equip(g), g);
      if(SUGGEST) G.suggest = await page.evaluate(() => window.H.poseStudio.suggest());
      for(const st of STANCES){ await page.evaluate(st => window.H.poseStudio.stance(st), st); G.stances[st] = await page.evaluate(() => window.H.poseStudio.measure());
        for(const v of STANCE_VIEWS[st] || []){ await page.evaluate(v => window.H.poseStudio.view(v), v); const f = `${tr}-${g}-${st}-${v}.png`; await page.screenshot({ path:join(OUT, f) }); G.shots[`${st}/${v}`] = f; await page.evaluate(() => window.H.poseStudio.resume()); } }
      if(STANCES.includes('mount')) await page.evaluate(() => window.H.poseStudio.stance('stand'));
      process.stdout.write(`${tr} ${g} ${Object.values(G.stances).every(m => m && m.ok) ? 'ok' : 'FLAG ' + Object.values(G.stances).flatMap(m => m ? m.notes : ['?']).join('; ')}\n`); }
    await page.close(); }
} finally { await browser.close(); }

writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
// report.html: per soldier, per weapon a row — each stance's measurements, then its pictures
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
let html = `<!doctype html><meta charset="utf-8"><title>Pose studio ${esc(report.at)}</title><style>body{font:14px system-ui;background:#1b1b1b;color:#ddd;margin:16px}h2{margin:28px 0 8px}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:6px;vertical-align:top}th{background:#262626;text-align:left}.bad{color:#ff6b5b;font-weight:600}.good{color:#7ddc7d}
img{width:300px;display:block;margin:2px 0;border:1px solid #333}.shots{display:flex;flex-wrap:wrap;gap:6px}.cap{font-size:11px;color:#999}</style>
<h1>Pose studio — ${esc(report.at)}</h1><p>Ngưỡng: lòng bàn tay cách mặt súng ≤ 4 cm, tay không duỗi quá 99,5 %. Màu đỏ = cần chỉnh (GUNHOLD trong config.js).</p>`;
for(const [tr, R] of Object.entries(report.troopers)){ html += `<h2>${tr === 's2' ? 'LÍNH ĐẶC NHIỆM' : tr === 'op' ? 'LÍNH THÉP' : esc(tr)} (${esc(tr)})</h2>` + (R.errors.length ? `<p class="bad">Lỗi trang: ${esc(R.errors.join(' | '))}</p>` : '');
  html += '<table><tr><th>Súng</th><th>Số đo</th><th>Ảnh</th></tr>';
  for(const [g, G] of Object.entries(R.guns)){ const meas = Object.entries(G.stances).map(([st, m]) => !m ? `<div class="bad">${st}: không đo được</div>` :
      `<div><b>${st}</b> — tay trái <span class="${m.palmL > 4 ? 'bad' : 'good'}">${m.palmL} cm</span>, tay phải <span class="${m.palmR > 4 ? 'bad' : 'good'}">${m.palmR} cm</span>, duỗi ${Math.round(m.stretchL * 100)}% / ${Math.round(m.stretchR * 100)}%${m.notes.length ? `<div class="bad">${esc(m.notes.join('; '))}</div>` : ''}</div>`).join('');
    const shots = Object.entries(G.shots).map(([k, f]) => `<div><a href="${esc(f)}"><img src="${esc(f)}" loading="lazy"></a><div class="cap">${esc(k)}</div></div>`).join('');
    html += `<tr><td><b>${esc(g)}</b>${G.suggest ? `<div class="cap">gợi ý: ${esc(JSON.stringify(G.suggest.suggest))}</div>` : ''}</td><td>${meas}</td><td><div class="shots">${shots}</div></td></tr>`; }
  html += '</table>'; }
writeFileSync(join(OUT, 'report.html'), html); console.log('report:', join(OUT, 'report.html'));
