#!/usr/bin/env node
// tools/pose-studio.mjs — Z349 THE POSE STUDIO, HEADLESS: for every soldier × weapon × view, how he holds it — measured and photographed —
//   into one folder: PNGs, report.json and report.html (the pictures in a grid per soldier and stance, the measurements beside them, flags in red).
//   Run it after adding a soldier model (PROFILE.trooper) or regenerating a gun model (assets/models/real/gun/inf/*.glb), then open report.html.
//
//   npm run serve                      (the game on http://127.0.0.1:8765, in another terminal)
//   node tools/pose-studio.mjs [--troopers s2,op] [--guns all|carbine,t_lmg] [--stances stand,crouch,prone,mount]
//                              [--views stand34,handsL,handsR,left,back] [--port 8765] [--out studio-shots] [--suggest] [--sheet]
//   Views per stance: stand → --views; crouch → kneel; prone → prone; mount → mount, mountBack. --suggest adds each gun model's profile and
//   suggested GUNHOLD numbers (butt, grip, palm) to report.json. It needs playwright-core (npm i -D playwright-core, or one already in the npx cache)
//   and Google Chrome. Z360 --sheet adds each gun's FIT SHEET (sheet-<gun>.png: the gun side on, what actors/gun-fit.js read off it drawn over it) at the
//   top of the report; --stances none photographs no soldier (the sheets alone: a new gun model checked in a few seconds). --actions adds, standing,
//   the recoil at its peak, the reload at the magazine / the pouch / the bolt, and the sprint carry (port arms).
import { mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const TROOPERS = String(arg('troopers', 's2,op')).split(','), STANCES = String(arg('stances', 'stand,crouch,prone')).split(',').filter(s => s !== 'none'), VIEWS = String(arg('views', 'stand34,handsL,handsR,left')).split(',');
const PORT = arg('port', '8765'), OUT = resolve(String(arg('out', 'studio-shots'))), SUGGEST = !!arg('suggest', false), SHEET = !!arg('sheet', false), ACTIONS = !!arg('actions', false), GUNARG = String(arg('guns', 'all'));
const STANCE_VIEWS = { stand:VIEWS, crouch:['kneel'], prone:['prone'], mount:['mount', 'mountBack'] };

async function playwright(){ try { return await import('playwright-core'); } catch {}
  const npx = join(homedir(), '.npm', '_npx'); if(existsSync(npx)) for(const d of readdirSync(npx)){ const p = join(npx, d, 'node_modules', 'playwright-core', 'index.mjs'); if(existsSync(p)) return import(p); }
  throw new Error('pose-studio: needs playwright-core — npm i -D playwright-core'); }

const { chromium } = await playwright(); mkdirSync(OUT, { recursive:true });
const browser = await chromium.launch({ channel:'chrome', headless:true, args:['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const report = { at:new Date().toISOString(), port:PORT, troopers:{}, sheets:{} };
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
      if(SHEET && !report.sheets[g]){ const u = await page.evaluate(() => window.H.poseStudio.sheet()); if(u){ const f = `sheet-${g}.png`; writeFileSync(join(OUT, f), Buffer.from(u.split(',')[1], 'base64')); report.sheets[g] = f; } }
      for(const st of STANCES){ await page.evaluate(st => window.H.poseStudio.stance(st), st); G.stances[st] = await page.evaluate(() => window.H.poseStudio.measure());
        for(const v of STANCE_VIEWS[st] || []){ await page.evaluate(v => window.H.poseStudio.view(v), v); const f = `${tr}-${g}-${st}-${v}.png`; await page.screenshot({ path:join(OUT, f) }); G.shots[`${st}/${v}`] = f; await page.evaluate(() => window.H.poseStudio.resume()); } }
      if(STANCES.includes('mount')) await page.evaluate(() => window.H.poseStudio.stance('stand'));
      if(ACTIONS){ await page.evaluate(() => window.H.poseStudio.stance('stand'));
        const shoot = async (name, view) => { await page.evaluate(v => window.H.poseStudio.view(v), view); const f = `${tr}-${g}-act-${name}.png`; await page.screenshot({ path:join(OUT, f) }); G.shots[`act/${name}`] = f; await page.evaluate(() => window.H.poseStudio.resume()); };
        await shoot('truoc-giat', 'kick'); await page.evaluate(() => window.H.poseStudio.kick()); await shoot('giat', 'kick');
        for(const [t, n] of [[0.2, 'nap-hopdan'], [0.48, 'nap-tui'], [0.86, 'nap-khoa']]){ await page.evaluate(t => window.H.poseStudio.reloadAt(t), t); await shoot(n, 'stand34'); }
        await page.evaluate(() => window.H.poseStudio.reloadEnd()); await page.evaluate(() => window.H.poseStudio.carry(true)); await shoot('gac-sung', 'stand34'); await page.evaluate(() => window.H.poseStudio.carry(false)); }
      process.stdout.write(`${tr} ${g} ${Object.values(G.stances).every(m => m && m.ok) ? 'ok' : 'FLAG ' + Object.values(G.stances).flatMap(m => m ? m.notes : ['?']).join('; ')}\n`); }
    await page.close(); }
} finally { await browser.close(); }

writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
// report.html: per soldier, per weapon a row — each stance's measurements, then its pictures
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
let html = `<!doctype html><meta charset="utf-8"><title>Pose studio ${esc(report.at)}</title><style>body{font:14px system-ui;background:#1b1b1b;color:#ddd;margin:16px}h2{margin:28px 0 8px}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:6px;vertical-align:top}th{background:#262626;text-align:left}.bad{color:#ff6b5b;font-weight:600}.good{color:#7ddc7d}
img{width:300px;display:block;margin:2px 0;border:1px solid #333}.shots{display:flex;flex-wrap:wrap;gap:6px}.cap{font-size:11px;color:#999}</style>
<h1>Pose studio — ${esc(report.at)}</h1><p>Ngưỡng (GUNFIT.ok trong config.js): lòng bàn tay cách mặt súng ≤ 4 cm, tay không duỗi quá 99,5 %, súng không bị kéo khỏi hõm vai quá 3 cm, điểm bắn lệch đầu nòng ≤ 1,5 cm. Màu đỏ = cần chỉnh.</p>`;
if(Object.keys(report.sheets).length) html += '<h2>PHIẾU ĐO SÚNG — công thức đọc từ mẫu 3D</h2><p class="cap">Xanh lơ = đường bao đo được · trắng đứt = trục nòng · cam = báng tay cầm · lam = hộp đạn · tím = tay cầm trước · xám = báng vai · đỏ = tay phải · xanh lá = tay trái (vòng rỗng: trượt tới khi tay ngắn) · hồng = điểm tì vai · vàng = điểm ngắm. Vòng rỗng đỏ/xanh = số chỉnh tay hiện tại (súng chưa theo công thức).</p><div class="shots">' +
  Object.entries(report.sheets).map(([g, f]) => `<div><a href="${esc(f)}"><img src="${esc(f)}" style="width:560px" loading="lazy"></a><div class="cap">${esc(g)}</div></div>`).join('') + '</div>';
for(const [tr, R] of Object.entries(report.troopers)){ html += `<h2>${tr === 's2' ? 'LÍNH ĐẶC NHIỆM' : tr === 'op' ? 'LÍNH THÉP' : esc(tr)} (${esc(tr)})</h2>` + (R.errors.length ? `<p class="bad">Lỗi trang: ${esc(R.errors.join(' | '))}</p>` : '');
  html += '<table><tr><th>Súng</th><th>Số đo</th><th>Ảnh</th></tr>';
  for(const [g, G] of Object.entries(R.guns)){ const meas = Object.entries(G.stances).map(([st, m]) => !m ? `<div class="bad">${st}: không đo được</div>` :
      `<div><b>${st}</b> — tay trái <span class="${m.palmL > 4 ? 'bad' : 'good'}">${m.palmL} cm</span>, tay phải <span class="${m.palmR > 4 ? 'bad' : 'good'}">${m.palmR} cm</span>, duỗi ${Math.round(m.stretchL * 100)}% / ${Math.round(m.stretchR * 100)}%, kéo khỏi vai <span class="${m.pull > 3 ? 'bad' : 'good'}">${m.pull} cm</span>${m.slide != null ? `, tay trái trượt ${m.slide} cm` : ''}, nòng lệch ${m.muzzle} cm · ${m.hold === 'fit' ? 'công thức' : 'chỉnh tay'}${m.notes.length ? `<div class="bad">${esc(m.notes.join('; '))}</div>` : ''}</div>`).join('');
    const shots = Object.entries(G.shots).map(([k, f]) => `<div><a href="${esc(f)}"><img src="${esc(f)}" loading="lazy"></a><div class="cap">${esc(k)}</div></div>`).join('');
    html += `<tr><td><b>${esc(g)}</b>${G.suggest && G.suggest.fit ? `<div class="cap">công thức: tay phải [${G.suggest.fit.grip}] · tay trái ${G.suggest.fit.palm} · báng ${G.suggest.fit.butt[1]}${G.suggest.now ? ` — chỉnh tay: [${G.suggest.now.grip}] · ${G.suggest.now.palm}` : ''}</div>` : ''}</td><td>${meas}</td><td><div class="shots">${shots}</div></td></tr>`; }
  html += '</table>'; }
writeFileSync(join(OUT, 'report.html'), html); console.log('report:', join(OUT, 'report.html'));
