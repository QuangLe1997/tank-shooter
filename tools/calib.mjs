#!/usr/bin/env node
// tools/calib.mjs — BOT 2 THE MIXER'S CALIBRATION HARNESS: battle specs played headless by the fighting bot (src/dev/bot.js), measured, set beside scoreBattle's predictions,
//   and the score block's coefficients (config.js MIXER.score) fitted so the predictions track what was measured.
//   node tools/calib.mjs <spec.json | dir | name in tools/specs | conq:N>… [--skill average] [--runs 1] [--minutes 6] [--out dir] [--lock file]
//                        [--short] [--land A,B] [--landrun] [--fit] [--dry]
//   --skill novice|average|good   the bot's level        --runs n  battles per spec        --minutes m  each battle stops after m minutes of play (game clock)
//   --out dir   results: <dir>/<run>.json, <dir>/calib.csv, <dir>/fit.json (default: $TMPDIR/xk-calib)   --lock file  each battle under `lockf -t 1800 file` (one GPU test at a time)
//   --short     a short variant: a sector chain cut to its first sector + the general's, a one-stage battle to 2 waves (the variant is what is predicted and played)
//   --land A,B  the spec on each of these lands       --landrun  the land's own sector run (config.js SECTOR.runs) as the chain
//   --fit       no battles: read every result in --out, fit, print the table      --dry  no battles: print what would be played and its prediction
//   Each battle: node tools/ts.mjs <land> 2 --eval <probe> --watchdog … (the GPU smoke path) → the probe composes the battle (composeBattle), clicks through to the fight,
//   starts the bot, samples every 250 ms, stops at the battle's end or the cap. Measured: minutes (game clock and wall), deaths, sector retries, damage taken / min, kills / min,
//   the bot's time to kill, the director's pressure (mean, peak, share of time in a lull), events, loot picked, won / lost / cut, every wave / sector / transit with its minutes,
//   hits from a shooter off the screen, deaths with no warning. The proxies and the fit: analyse() below, DOCS.md "BOT 2".
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { normalizeSpec, scoreBattle } from '../src/data/mixer-math.js';
import { MIXER, SECTOR } from '../config.js';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url))), argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; }, has = k => argv.includes(k);
const VAL = new Set(['--skill', '--runs', '--minutes', '--out', '--lock', '--land']), pos = []; for(let i = 0; i < argv.length; i++){ if(VAL.has(argv[i])){ i++; continue; } if(!argv[i].startsWith('--')) pos.push(argv[i]); }
const SKILL = opt('--skill', 'average'), RUNS = +opt('--runs', 1), MIN = +opt('--minutes', 6), OUT = path.resolve(opt('--out', path.join(os.tmpdir(), 'xk-calib'))), LOCK = opt('--lock');
fs.mkdirSync(OUT, { recursive:true });

// ---- the specs ----
function load(tok){ if(/^conq:\d+$/.test(tok)){ const i = +tok.slice(5) - 1; return [JSON.parse(JSON.stringify(MIXER.presets.conquest[i]))]; }
  let f = fs.existsSync(tok) ? tok : path.join(ROOT, 'tools/specs', tok.replace(/\.json$/, '') + '.json');
  if(fs.statSync(f).isDirectory()) return fs.readdirSync(f).filter(x => x.endsWith('.json')).sort().flatMap(x => load(path.join(f, x)));
  return [JSON.parse(fs.readFileSync(f, 'utf8'))]; }
const tok = t => typeof t === 'string' ? t : [t.place, t.type, t.obj].filter(Boolean).join(':');
function variants(s){ let L = [s]; const lands = opt('--land'); if(lands) L = lands.split(',').map(l => ({ ...s, id:(s.id || 'spec') + '-' + l.toLowerCase(), world:{ ...(s.world || {}), land:l } }));
  return L.map(v => { v = JSON.parse(JSON.stringify(v)); if(has('--landrun')){ const R = SECTOR.runs[v.world.land] || SECTOR.runs._; v.structure = { ...(v.structure || {}), sectors:R.map(tok) }; v.id += '-run'; }
    if(has('--short')){ const sc = v.structure && v.structure.sectors; if(sc && sc.length > 2) v.structure.sectors = [sc[0], sc[sc.length - 1]]; else if(!sc){ v.enemy = { ...(v.enemy || {}), waves:2 }; } v.id += '-short'; }
    return v; }); }
const SPECS = pos.flatMap(load).flatMap(variants);

// ---- the probe (the body of async (H, S) => { … } in the page) ----
const PROBE = `const SPEC = __SPEC__, CAP = __CAP__ * 60, WALL = __WALL__ * 1000, SKILL = __SKILL__;
const wait = ms => new Promise(r => setTimeout(r, ms)), T0 = performance.now(), wall = () => (performance.now() - T0) / 1000, V3 = H.camera.position.constructor, _v = new V3();
const r = H.composeBattle(SPEC); if(!r.ok) return { refused:r.why };
const unhide = () => { for(const id of ['briefing', 'start', 'deploy', 'nick', 'tip']){ const e = document.getElementById(id); if(e) e.classList.add('hidden'); } };
let i = 0; for(; i < 300; i++){ await wait(300); unhide(); if(!(S.run && S.run.mix)) continue;
  if(S.mode === 'intro'){ try{ H.skipIntro(); }catch(e){} } else if(!['playing', 'countdown', 'transit'].includes(S.mode)){ try{ H.launchStage(false); }catch(e){} } if(S.mode === 'playing') break; }
if(S.mode !== 'playing') return { stuck:S.mode, i };
const gt = () => H.MODE.t || 0, g0 = gt(), p0 = S.player, M = { n:0, pSum:0, pPeak:0, lull:0, dmg:0, deaths:0, unwarned:0, hits:0, off:0, unk:0, loot:0, kicks:0, curve:[], units:[], modes:{} };
const mine = () => H.MDL && H.MDL.L ? H.MDL.L.kills | 0 : 0, k0 = S.kills | 0, m0 = mine(), hpQ = [], log0 = H.MIX.log.length, sides0 = { ...H.SIDEM.stats }, lv0 = p0.lives;
const onScr = (x, y, z) => { _v.set(x, y, z).project(H.camera); return _v.z < 1 && Math.abs(_v.x) < 0.98 && Math.abs(_v.y) < 0.98; };
// every hit marker (fx/cinematic.js hitMarker: --a = the shooter's bearing on screen): was the shooter on the screen?
const obs = new MutationObserver(L => { for(const m of L) for(const n of m.addedNodes){ if(n.tagName !== 'I' || !n.parentElement || n.parentElement.id !== 'hitDir') continue; M.hits++;
  const a = parseFloat(n.style.getPropertyValue('--a')) - (S.camYaw || 0), sx = Math.sin(a), sz = -Math.cos(a), p = S.player; let best = null, bd = 95;
  for(const e of H.enemies){ if(!(e.hp > 0)) continue; const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz); if(d > bd || d < 0.5) continue; if((dx * sx + dz * sz) / d < Math.cos(0.4)) continue; bd = d; best = e; }
  if(!best) M.unk++; else if(!onScr(best.pos.x, H.heightAt(best.pos.x, best.pos.z) + 1.1, best.pos.z)) M.off++; } });
obs.observe(document.body, { childList:true, subtree:true });
H.botStart({ skill:SKILL });
let hp = p0.hp, lv = p0.lives, wAct = false, wU = null, sSt = '', sU = null, tU = null, bU = null, end = 'cap', prevP = new Set(H.pickups), still = 0, lastCurve = -9;
while(true){ await wait(250); const t = gt() - g0, p = S.player; if(!p) break; M.modes[S.mode] = (M.modes[S.mode] || 0) + 0.25;
  if(H.MODE.over || S.mode === 'gameover' || S.mode === 'victory'){ end = H.MODE.card ? (H.MODE.card.lost ? 'lost' : 'won') : S.mode === 'victory' ? 'won' : 'lost'; break; }
  if(t >= CAP){ end = 'cap'; break; } if(wall() * 1000 >= WALL){ end = 'wall'; break; }
  if(['briefing', 'deploy', 'start'].includes(S.mode)){ if((still += 0.25) > 4){ still = 0; unhide(); try{ H.launchStage(false); }catch(e){} M.kicks++; } } else still = 0;
  if(p.lives < lv){ M.deaths += lv - p.lives; if(hpQ.length && hpQ[0] >= 0.7 * p.maxHp) M.unwarned++; hpQ.length = 0; }
  else if(p.hp < hp && S.mode === 'playing') M.dmg += hp - p.hp;
  if(S.mode === 'dying' && lv === p.lives && hp > 0 && p.hp <= 0 && hpQ.length && hpQ[0] >= 0.7 * p.maxHp){ /* counted when the life goes */ }
  hp = p.hp; lv = p.lives; hpQ.push(p.hp); if(hpQ.length > 16) hpQ.shift();
  if(S.mode === 'playing'){ const P = H.DIR.P || 0; M.n++; M.pSum += P; M.pPeak = Math.max(M.pPeak, P); if(P < 0.15) M.lull++; if(t - lastCurve >= 5){ lastCurve = t; M.curve.push([+t.toFixed(0), +P.toFixed(2)]); } }
  for(const u of prevP) if(!H.pickups.includes(u) && Math.hypot(u.x - p.pos.x, u.z - p.pos.z) < 4.5) M.loot++; prevP = new Set(H.pickups);
  // the units: waves (a one-stage battle), sectors, transits, the general's duel
  if(!H.SECT.on){ const a = H.WAVE.active; if(a && !wAct){ wU = { k:'wave', i:S.wave, t0:t, lull:M.units.length ? +(t - (M.units[M.units.length - 1].t1 || t)).toFixed(1) : null }; M.units.push(wU); } if(!a && wAct && wU){ wU.t1 = +t.toFixed(1); wU.done = true; wU = null; } wAct = a; }
  const ss = H.SECT.state; if(ss !== sSt){ if(ss === 'fight'){ if(tU){ tU.t1 = +t.toFixed(1); tU.done = true; tU = null; } const c = H.sectorCur(); sU = { k:'sector', ty:c && c.type, i:H.SECT.i, tries:H.SECT.tries, t0:+t.toFixed(1) }; M.units.push(sU); }
    else if(sSt === 'fight' && sU){ sU.t1 = +t.toFixed(1); sU.done = ss === 'won' || ss === 'done' && end !== 'lost'; sU.won = ss === 'won' || ss === 'done'; sU = null; if(ss === 'won' || ss === 'transit'){ tU = { k:'transit', t0:+t.toFixed(1) }; M.units.push(tU); } }
    sSt = ss; }
  const du = H.duelOn(); if(du && !bU){ bU = { k:'boss', t0:+t.toFixed(1) }; M.units.push(bU); } if(!du && bU){ bU.t1 = +t.toFixed(1); bU.done = true; bU = null; } }
obs.disconnect(); H.botStop(); const t = gt() - g0, min = Math.max(1 / 60, t / 60), st = H.modeStats();
if(sU && H.SECT.state === 'done' && end === 'won'){ sU.t1 = +t.toFixed(1); sU.done = sU.won = true; } if(bU && end === 'won'){ bU.t1 = +t.toFixed(1); bU.done = true; }
for(const u of M.units) if(u.t1 == null) u.t1 = +t.toFixed(1);
const ev = { surp:H.SURP ? H.SURP.count | 0 : 0, big:H.BIGEV ? H.BIGEV.count | 0 : 0, side:H.SIDEM.stats.offered - (sides0.offered | 0), sideWon:H.SIDEM.stats.won - (sides0.won | 0), dirLog:H.DIR.log.length, drops:H.DIR.stats.drops, sallies:H.DIR.stats.sallies };
const g = H.SECT.stats || {}, bot = H.botState(), k = H.MDL && H.MDL.on ? mine() - m0 : bot.kills, kAll = (S.kills | 0) - k0;   // his own kills: the medal ledger's (game/medals.js), else the bot's
return { id:SPEC.id || '', skill:SKILL, end, won:end === 'won', gameMin:+(t / 60).toFixed(2), wallMin:+(wall() / 60).toFixed(2), deaths:M.deaths, livesLeft:p0.lives, lives0:lv0, maxHp:p0.maxHp,
  retries:g.restarts | 0, sectorsWon:g.won | 0, sectorsLost:g.lost | 0, dpm:+(M.dmg / min).toFixed(1), kpm:+(k / min).toFixed(2), kills:k, kpmAll:+(kAll / min).toFixed(2), acc:+st.acc.toFixed(2), shots:st.shots,
  pMean:M.n ? +(M.pSum / M.n).toFixed(3) : 0, pPeak:+M.pPeak.toFixed(3), lullShare:M.n ? +(M.lull / M.n).toFixed(3) : 0, events:ev, loot:M.loot, hits:M.hits, offHits:M.off, unkHits:M.unk, unwarned:M.unwarned,
  units:M.units, curve:M.curve, modes:M.modes, kicks:M.kicks, bot, mixLog:H.MIX.log.length > log0 ? H.MIX.log[H.MIX.log.length - 1].meas : null };`;

// ---- run ----
const runId = (s, k) => (s.id || 'spec') + '-' + SKILL + '-' + k;
function play(s, k){ const id = runId(s, k), pf = path.join(OUT, id + '.probe.js'), wallCap = MIN * 1.8 + 2;
  fs.writeFileSync(pf, PROBE.replace('__SPEC__', JSON.stringify(s)).replace('__CAP__', String(MIN)).replace('__WALL__', String(wallCap * 60)).replace('__SKILL__', JSON.stringify(SKILL)));
  const land = (s.world && s.world.land) || 'DESERT', cmd = ['node', path.join(ROOT, 'tools/ts.mjs'), land, '2', '--eval', pf, '--watchdog', String(Math.round(wallCap * 60 + 120))];
  const full = LOCK ? ['lockf', '-t', '1800', LOCK, ...cmd] : cmd, t0 = Date.now(); console.log('▶ ' + id + ' (' + land + ', ' + SKILL + ', ≤ ' + MIN + ' min)');
  const r = spawnSync(full[0], full.slice(1), { encoding:'utf8', maxBuffer:64 << 20 }); const line = (r.stdout || '').trim().split('\n').filter(l => l.startsWith('{')).pop();
  let out; try{ out = JSON.parse(line); }catch(e){ out = { ok:false, errors:['no JSON from the runner: ' + (r.stderr || r.stdout || '').slice(-400)] }; }
  const rec = { id, spec:s, skill:SKILL, at:new Date().toISOString(), secs:Math.round((Date.now() - t0) / 1000), errors:out.errors || [], load:out.load, frame:out.frame, meas:out.eval };
  fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify(rec, null, 1)); fs.rmSync(pf, { force:true });
  const m = out.eval || {}; console.log('  ' + (rec.errors.length ? '✗ ' + rec.errors[0] : '✓') + ' end ' + m.end + ' · ' + m.gameMin + ' min · deaths ' + m.deaths + ' · sectors ' + m.sectorsWon + ' · kpm ' + m.kpm + ' · dpm ' + m.dpm + ' · P ' + m.pMean); return rec; }

// ---- predictions, proxies, the fit ----
// the same spec at each skill: how the bot's level shows (every result, an errored one too — the skill table only)
function skills(ALL){ const by = {}; for(const r of ALL){ const k = (r.spec.id || '') + ' · ' + r.spec.world.land; (by[k] || (by[k] = [])).push(r); }
  for(const k in by){ const L = by[k]; if(new Set(L.map(r => r.skill)).size < 2) continue; console.log('skills — ' + k + ':');
    for(const r of L.sort((a, b) => ['novice', 'average', 'good'].indexOf(a.skill) - ['novice', 'average', 'good'].indexOf(b.skill))){ const m = r.meas, s1 = m.units.find(u => u.k === 'sector' && u.i === 0 && u.won);
      console.log('  ' + r.skill.padEnd(8) + ' first sector ' + (s1 ? ((s1.t1 - s1.t0) / 60).toFixed(2) + ' min' : 'not cleared') + ' · sectors ' + m.sectorsWon + ' · deaths ' + m.deaths + ' · retries ' + m.retries + ' · dmg/min ' + m.dpm + ' · kills/min ' + m.kpm + ' · ttk ' + m.bot.ttkMed + ' s · hp lost / kill ' + Math.round(m.dpm * m.gameMin / Math.max(1, m.kills)) + (r.errors.length ? ' (page error: ' + r.errors[0].slice(0, 60) + ')' : '')); } } }
const SC = MIXER.score, REF0 = JSON.parse(JSON.stringify(SC));
const predict = s => { const n = normalizeSpec(s, { device:'desktop' }), sc = scoreBattle(n); return { n, sc }; };
const rawOf = (s, key) => { const o = SC[key]; SC[key] = 1; const v = scoreBattle(normalizeSpec(s, { device:'desktop' }))[key === 'diffK' ? 'difficulty' : 'intensity'] - 50; SC[key] = o; return v; };   // log2 of the predicted multiplier
function unitPred(n, sc){ const V = n.plan.params, k = id => V[id].k, se = k('sim.timeScale') * Math.pow(k('clock.events'), 0.3) * Math.pow(k('enemy.cadence'), 0.2);
  return { fightK:Math.pow(sc.est.numX, 0.7) * Math.pow(sc.est.hpX, 0.45) / Math.pow(se, 0.8), lull:15 / 60 * k('pace.lull') / (k('clock.events') * k('sim.timeScale')), bossK:Math.sqrt(k('boss.tough')) }; }
const lg2 = x => Math.log(x) / Math.LN2, med = a => { const b = a.filter(x => x != null).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; }, mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const mae = (P, Q) => P.length ? +mean(P.map((p, i) => Math.abs(p - Q[i]))).toFixed(1) : null;
function analyse(){ const ALL = fs.readdirSync(OUT).filter(f => f.endsWith('.json') && f !== 'fit.json').map(f => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'))).filter(r => r.meas && r.meas.units), R = ALL.filter(r => !r.errors.length);
  skills(ALL);
  if(!R.length){ console.log('no results in ' + OUT); return; }
  const rows = R.map(r => { const { n, sc } = predict(r.spec), m = r.meas, up = unitPred(n, sc), hpMax = m.maxHp || 150, ttk = m.bot && m.bot.ttkMed;
    return { r, n, sc, m, up, H:(m.dpm / hpMax) * Math.sqrt(Math.max(0.2, ttk || REF0.ref.ttk) / REF0.ref.ttk), ttk, lootPM:m.loot / Math.max(0.5, m.gameMin) }; });
  // the reference: the standard spec at average (else the first row) — its measured proxies are "50"; several of them (on several lands): their geometric mean
  const rs = rows.filter(x => /^standard/.test(x.r.spec.id || '') && x.r.skill === 'average'), r0 = rs.length ? rs : [rows[0]], gm = f => Math.exp(mean(r0.map(x => Math.log(Math.max(1e-3, f(x))))));
  const ref = { r:r0[0].r, H:gm(x => x.H), ttk:gm(x => x.ttk || REF0.ref.ttk), lootPM:gm(x => x.lootPM), m:{ pMean:gm(x => x.m.pMean), kpm:gm(x => x.m.kpm) } };
  const dMeas = x => 50 + 20 * lg2(Math.max(1e-3, x.H) / Math.max(1e-3, ref.H)), iMeas = x => 50 + 24 * lg2(Math.max(0.01, x.m.pMean) / Math.max(0.01, ref.m.pMean));
  const jMeas = x => { const t = x.ttk && ref.ttk ? Math.abs(Math.log(x.ttk / ref.ttk)) / Math.log(2.5) : 0; return Math.max(0, Math.min(100, 50 + 25 * (1 - t) - 12.5 + Math.max(-15, Math.min(15, 12 * lg2(Math.max(0.05, x.m.kpm) / Math.max(0.05, ref.m.kpm))))
    + Math.max(-12, Math.min(10, 8 * lg2(Math.max(0.05, x.lootPM) / Math.max(0.05, ref.lootPM)))) + 3 * x.m.sectorsWon + 2 * (x.m.events.sideWon | 0))); };
  const fMeas = x => { const h = Math.max(1, x.m.hits), off = (x.m.offHits + 0.5 * x.m.unkHits) / h; return Math.max(0, Math.min(100, 85 - 60 * Math.max(0, off - 0.3) - 8 * x.m.unwarned / Math.max(1, x.m.gameMin / 10))); };
  // fit: diffK / intK = the model's points per doubling × the measured slope of log2(measured ratio) on log2(predicted multiplier) — through the reference (50 = 50)
  const rd = rows.map(x => rawOf(x.r.spec, 'diffK')), ri = rows.map(x => rawOf(x.r.spec, 'intK'));
  const slope = (X, Y) => { const sxy = X.reduce((a, x, i) => a + x * Y[i], 0), sxx = X.reduce((a, x) => a + x * x, 0); return sxx > 1e-9 ? sxy / sxx : 1; };
  const yd = rows.map(x => (dMeas(x) - 50) / 20), yi = rows.map(x => (iMeas(x) - 50) / 24), use = rows.map(x => x.r.skill === ref.r.skill);
  const fd = (X, Y) => slope(X.filter((_, i) => use[i]), Y.filter((_, i) => use[i]));
  const diffK = +(20 * Math.max(0.25, Math.min(2.5, fd(rd, yd)))).toFixed(1), intK = +(24 * Math.max(0.25, Math.min(2.5, fd(ri, yi)))).toFixed(1);
  // minutes per unit: waveMin from the waves' fights, typeMin[t] from the sectors won, transitMin from the transits, bossMin from the duels
  const W = [], Sx = {}, Tr = [], Bo = []; rows.filter((x, i) => use[i]).forEach(x => { for(const u of x.m.units){ if(!u.done || u.t1 - u.t0 < 3) continue; const mins = (u.t1 - u.t0) / 60;
    if(u.k === 'wave') W.push([x.up.fightK, mins]); else if(u.k === 'sector' && u.won && u.ty) (Sx[u.ty] || (Sx[u.ty] = [])).push([(0.6 + 0.4 * x.up.fightK) * (u.ty === 'boss' ? x.up.bossK : 1), mins]);
    else if(u.k === 'boss') Bo.push([x.up.bossK, mins]); } });   // (a transit is timed on the game clock, which stands still through it: not fitted)
  const ls = P => P.length ? P.reduce((a, [f, m]) => a + f * m, 0) / P.reduce((a, [f]) => a + f * f, 0) : null, r2 = v => v == null ? null : +v.toFixed(2);
  const fit = { diffK, intK, ref:{ ...REF0.ref }, typeMin:{ ...REF0.typeMin }, n:{ waves:W.length, boss:Bo.length } }; if(W.length >= 2) fit.ref.waveMin = r2(ls(W)); if(Bo.length >= 2) fit.ref.bossMin = r2(ls(Bo));   // (a coefficient moves on 2+ samples)
  for(const t in Sx){ fit.n[t] = Sx[t].length; if(Sx[t].length >= 2) fit.typeMin[t] = r2(ls(Sx[t])); }
  const ttks = rows.filter((x, i) => use[i] && x.ttk).map(x => x.ttk / x.sc.est.hpX), kpms = rows.filter((x, i) => use[i]).map(x => x.m.kpm / (x.sc.est.kpm / REF0.ref.kpm));
  if(ttks.length) fit.ref.ttk = r2(med(ttks)); if(kpms.length) fit.ref.kpm = r2(med(kpms));
  // the unit errors before / after
  const uErr = (ref_, tm) => { const P = [], Q = []; rows.filter((x, i) => use[i]).forEach(x => { for(const u of x.m.units){ if(!u.done || u.t1 - u.t0 < 3) continue; const mins = (u.t1 - u.t0) / 60; let p = null;
      if(u.k === 'wave') p = ref_.waveMin * x.up.fightK; else if(u.k === 'sector' && u.won && u.ty) p = (tm[u.ty] || 4) * (0.6 + 0.4 * x.up.fightK) * (u.ty === 'boss' ? x.up.bossK : 1); else if(u.k === 'boss') p = ref_.bossMin * x.up.bossK;
      if(p != null){ P.push(p); Q.push(mins); } } }); return { n:P.length, mae:mae(P, Q), pred:+mean(P).toFixed(2), meas:+mean(Q).toFixed(2) }; };
  // after: the scores again with the fitted block
  const after = s => { const o = JSON.parse(JSON.stringify(SC)); Object.assign(SC, { diffK:fit.diffK, intK:fit.intK }); Object.assign(SC.ref, fit.ref); Object.assign(SC.typeMin, fit.typeMin); const v = predict(s).sc; Object.assign(SC, o); SC.ref = o.ref; SC.typeMin = o.typeMin; return v; };
  const A = rows.map(x => after(x.r.spec));
  const tab = [['run', 'end', 'min', 'deaths', 'retries', 'dpm', 'kpm', 'ttk', 'P mean/peak', 'lull', 'loot', 'off/hits', 'diff p→a / m', 'int p→a / m', 'joy p / m', 'fair p / m']];
  rows.forEach((x, i) => tab.push([x.r.id, x.m.end, x.m.gameMin, x.m.deaths, x.m.retries, x.m.dpm, x.m.kpm, x.ttk, x.m.pMean + '/' + x.m.pPeak, x.m.lullShare, x.m.loot, x.m.offHits + '/' + x.m.hits,
    x.sc.difficulty + '→' + A[i].difficulty + ' / ' + Math.round(dMeas(x)), x.sc.intensity + '→' + A[i].intensity + ' / ' + Math.round(iMeas(x)), x.sc.joy + ' / ' + Math.round(jMeas(x)), x.sc.fairness + ' / ' + Math.round(fMeas(x))]));
  const sel = (f, g) => rows.map((x, i) => [f(x, i), g(x, i)]).filter((_, i) => use[i]), E = (pr, ms) => { const L = sel(pr, ms); return mae(L.map(v => v[0]), L.map(v => v[1])); };
  const corr = (pr, ms) => { const L = sel(pr, ms); if(L.length < 3) return null; const mx = mean(L.map(v => v[0])), my = mean(L.map(v => v[1])); let a = 0, b = 0, c = 0; for(const [p, q] of L){ a += (p - mx) * (q - my); b += (p - mx) ** 2; c += (q - my) ** 2; } return b && c ? +(a / Math.sqrt(b * c)).toFixed(2) : null; };
  const summary = { ref:r0.map(x => x.r.id), n:rows.length, fitN:use.filter(Boolean).length,
    difficulty:{ before:E(x => x.sc.difficulty, dMeas), after:E((x, i) => A[i].difficulty, dMeas), r:corr(x => x.sc.difficulty, dMeas) },
    intensity:{ before:E(x => x.sc.intensity, iMeas), after:E((x, i) => A[i].intensity, iMeas), r:corr(x => x.sc.intensity, iMeas) },
    joy:{ before:E(x => x.sc.joy, jMeas), after:E((x, i) => A[i].joy, jMeas), r:corr(x => x.sc.joy, jMeas) },
    fairness:{ before:E(x => x.sc.fairness, fMeas), after:E((x, i) => A[i].fairness, fMeas), r:corr(x => x.sc.fairness, fMeas) },
    unitMinutes:{ before:uErr(REF0.ref, REF0.typeMin), after:uErr(fit.ref, fit.typeMin) },
    ttk:{ before:E(x => x.sc.est.ttk, x => x.ttk || x.sc.est.ttk), after:E((x, i) => A[i].est.ttk, x => x.ttk || A[rows.indexOf(x)].est.ttk) },
    kpm:{ before:E(x => x.sc.est.kpm, x => x.m.kpm), after:E((x, i) => A[i].est.kpm, x => x.m.kpm) } };
  const w = tab[0].map((_, c) => Math.max(...tab.map(r => String(r[c] ?? '').length)));
  console.log(tab.map(r => r.map((v, c) => String(v ?? '').padEnd(w[c])).join(' │ ')).join('\n'));
  console.log('\nerror (mean |pred − meas|, before → after the fit; r = correlation before):'); for(const k of ['difficulty', 'intensity', 'joy', 'fairness', 'ttk', 'kpm']) console.log('  ' + k.padEnd(10) + ' ' + summary[k].before + ' → ' + summary[k].after + (summary[k].r != null ? '  (r ' + summary[k].r + ')' : ''));
  console.log('  minutes/unit ' + JSON.stringify(summary.unitMinutes)); console.log('\nfitted MIXER.score: ' + JSON.stringify(fit));
  fs.writeFileSync(path.join(OUT, 'fit.json'), JSON.stringify({ summary, fit, before:REF0 }, null, 1));
  const cols = ['id', 'skill', 'end', 'gameMin', 'wallMin', 'deaths', 'retries', 'sectorsWon', 'dpm', 'kpm', 'ttk', 'pMean', 'pPeak', 'lullShare', 'events', 'loot', 'hits', 'offHits', 'unwarned', 'pDiff', 'pInt', 'pJoy', 'pFair', 'pMin', 'mDiff', 'mInt', 'mJoy', 'mFair'];
  const csv = [cols.join(',')].concat(rows.map(x => { const m = x.m, e = m.events; return [x.r.id, x.r.skill, m.end, m.gameMin, m.wallMin, m.deaths, m.retries, m.sectorsWon, m.dpm, m.kpm, x.ttk, m.pMean, m.pPeak, m.lullShare, e.surp + e.big + e.side + e.drops,
    m.loot, m.hits, m.offHits, m.unwarned, x.sc.difficulty, x.sc.intensity, x.sc.joy, x.sc.fairness, x.sc.minutes, Math.round(dMeas(x)), Math.round(iMeas(x)), Math.round(jMeas(x)), Math.round(fMeas(x))].join(','); }));
  fs.writeFileSync(path.join(OUT, 'calib.csv'), csv.join('\n') + '\n'); console.log('\n→ ' + path.join(OUT, 'calib.csv') + ', fit.json'); }

if(has('--fit')) analyse();
else if(has('--dry')){ for(const s of SPECS){ const { n, sc } = predict(s); console.log(s.id + ' · ' + n.plan.world.land + ' · ' + (n.plan.structure.sectors || ['waves ' + n.plan.params['enemy.waves'].v]).join(' → ') + ' · d ' + sc.difficulty + ' i ' + sc.intensity + ' j ' + sc.joy + ' f ' + sc.fairness + ' · ' + sc.minutes + ' min'); } }
else { if(!SPECS.length){ console.log('usage: node tools/calib.mjs <spec.json | dir | name | conq:N>… [--skill average] [--runs 1] [--minutes 6] [--out dir] [--lock file] [--short] [--land A,B] [--landrun] [--fit] [--dry]'); process.exit(2); }
  for(const s of SPECS) for(let k = 1; k <= RUNS; k++) play(s, k); analyse(); }
