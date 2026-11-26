#!/usr/bin/env node
// tools/audio-test.mjs — AUDIO 1–3 THE BATTLE'S SOUND TESTED WITHOUT A BROWSER AND WITHOUT EARS: `npm run audio-test` (≈ 8 s, plain Node 22, no GPU, no page).
//   part 1 — the pure maths (src/audio/afx-math.js against config AUDIOFX): the distance curves fall and never rise, the delay is capped, the obstruction budget
//     is kept and the nearest cell is checked first, the pool's priorities / stealing / merging, the round-robin never repeats, the soft limiter never reaches 1,
//     the spaces' impulse responses decay, every synthesised one-shot is finite, levelled and repeatable from its seed
//   part 2 — the LAYER ITSELF (src/audio/afx*.js, unchanged) run against a fake AudioContext that records every node, connection and schedule
//     (tools/audio-test-hub.mjs stands in for the rest of the game): nothing throws without a context or with a suspended one, a shot builds its layers,
//     a far shot is late / dull / quiet, a wall muffles it, the pool's cap holds under a volley, and after the sounds end NOT ONE NODE is left connected
//     — then the space (one ray a frame, four convolvers, the slap-back's timing), the footsteps (ground, gait, cadence, the men near), the mixer (wired in and out
//     by the switch, the music under fire and by the director, the deafened moment and its switch, the soft limiter) and the squad's calls (who, when, how often)
//   What it cannot tell: how any of it SOUNDS. That is the owner's listening checklist (DOCS.md, AUDIO-1 … AUDIO-3).
//   Exit code 0 only when every check passed. options: --json (one line of numbers at the end)
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { AUDIOFX as A } from '../config.js';
import * as M from '../src/audio/afx-math.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), STUB = pathToFileURL(path.join(HERE, 'audio-test-hub.mjs')).href;
let pass = 0, fail = 0; const report = {};
const ok = (c, msg) => { if(c) pass++; else { fail++; console.log('  ✗ ' + msg); } };
const say = (c, msg) => { ok(c, msg); if(c) console.log('  ✓ ' + msg); };
const grp = t => console.log('• ' + t);
const mono = (f, a, b, n, dir) => { let p = f(a); for(let i = 1; i <= n; i++){ const v = f(a + (b - a) * i / n); if(dir < 0 ? v > p + 1e-12 : v < p - 1e-12) return false; p = v; } return true; };
const fin = x => { for(let i = 0; i < x.length; i++) if(!Number.isFinite(x[i])) return false; return true; };
const peak = x => { let m = 0; for(let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); return m; };
const energy = (x, a, b) => { let e = 0; for(let i = Math.floor(a * x.length); i < Math.floor(b * x.length); i++) e += x[i] * x[i]; return e; };
const U = A.unit, CS = A.c;

// =============================== part 1: the pure maths ===============================
grp('distance: each class falls with distance and never rises');
for(const [k, K] of Object.entries(A.cls)){
  ok(M.afxGain(0, K) === 1 && Math.abs(M.afxGain(K.ref, K) - 0.5) < 1e-9 && mono(d => M.afxGain(d, K), 0, 400, 800, -1) && M.afxGain(400, K) > 0, k + ': level 1 at the ear, ½ at ref, monotonic');
  ok(mono(d => M.afxLowpass(d, K), 0, 400, 800, -1) && M.afxLowpass(0, K) === K.lp[0] && M.afxLowpass(9999, K) === K.lp[1], k + ': the low-pass only closes, from lp[0] down to its floor');
  ok(mono(d => M.afxDelay(d, K, U, CS), 0, 400, 800, 1) && M.afxDelay(9999, K, U, CS) === K.cap && M.afxDelay(0, K, U, CS) === 0, k + ': the delay grows and stops at its cap');
  ok(mono(d => M.afxTail(d, K), 0, 400, 800, 1) && M.afxTail(9999, K) === K.tail[2] && mono(d => M.afxNear(d, K), 0, 400, 800, -1) && M.afxNear(0, K) === 1 && M.afxNear(9999, K) === 0, k + ': the tail grows to its cap, the close layers fade out'); }
{ const K = A.cls.gun, d = 10; say(Math.abs(M.afxDelay(d, K, U, CS) - d * U / CS) < 1e-12 && M.afxDelay(200, K, U, CS) === K.cap, `a rifle 10 units off arrives ${(M.afxDelay(d, K, U, CS) * 1000).toFixed(0)} ms late (distance × ${U} m / ${CS} m/s); from 200 units the cap: ${K.cap * 1000} ms`);
  report.gunDelayCapMs = K.cap * 1000; report.blastDelayCapMs = A.cls.big.cap * 1000;
  say(M.afxLowpass(60, K) < 2600 && M.afxLowpass(5, K) > 12000 && M.afxGain(60, K) < 0.25, `a rifle at 60 units: ${M.afxLowpass(60, K).toFixed(0)} Hz, level × ${M.afxGain(60, K).toFixed(2)}, ${(M.afxTail(60, K) * 100).toFixed(0)} % to the reverb (at 5 units: ${M.afxLowpass(5, K).toFixed(0)} Hz, ${(M.afxTail(5, K) * 100).toFixed(0)} %)`); }

grp('incoming: the crack by the miss distance, the thump after it');
{ const C = A.crack; const m = M.afxMiss(2, -30, 0, 80, 0, 0), d1 = m.d, s1 = m.side; ok(Math.abs(d1 - 2) < 1e-9 && M.afxMiss(-2, -30, 0, 80, 0, 0).side === -s1, 'a round flying along z, 2 units to the side: a miss of 2, the side by its sign');
  ok(mono(d => M.afxCrackGain(d, C), 0, C.R * 2, 200, -1) && M.afxCrackGain(0, C) === 1 && M.afxCrackGain(C.R * 2, C) === C.floor, 'the closer the round, the harder the crack (never under its floor)');
  ok(mono(D => M.afxCrackGap(D, C, U, CS), 0, 400, 400, 1) && M.afxCrackGap(0, C, U, CS) === C.gap[0] && M.afxCrackGap(9999, C, U, CS) === C.gap[1], 'the thump comes later the farther the shooter, inside gap[min, max]');
  say(M.afxCrackGap(40, C, U, CS) > C.gap[0], `a shooter 40 units off: the thump ${(M.afxCrackGap(40, C, U, CS) * 1000).toFixed(0)} ms after the crack (never more than ${C.gap[1] * 1000} ms)`); report.crackGapMaxMs = C.gap[1] * 1000; }

grp('obstruction: a budget of line checks a frame, the nearest first');
{ const C = A.occl, O = M.afxOcclMake(C), asked = []; let now = 10, n; const wall = (x, z) => !(x > 40);
  for(let i = 0; i < 20; i++) M.afxOcclGet(O, 6 + i * C.cell, 0, now);
  n = M.afxOcclTick(O, now, 0.016, 0, 0, C.perFrame, (x, z) => { asked.push(x); return wall(x, z); });
  ok(n === C.perFrame && asked.length === C.perFrame && asked.every((x, i) => x === 6 + i * C.cell), `20 sounding cells, ${C.perFrame} checks in the first frame — the ${C.perFrame} nearest, nearest first`);
  let frames = 1, total = n, most = n; while(total < 20 && frames < 50){ now += 0.016; for(let i = 0; i < 20; i++) M.afxOcclGet(O, 6 + i * C.cell, 0, now); n = M.afxOcclTick(O, now, 0.016, 0, 0, C.perFrame, (x, z) => { asked.push(x); return wall(x, z); }); total += n; most = Math.max(most, n); frames++; }
  ok(total === 20 && most <= C.perFrame && frames === Math.ceil(20 / C.perFrame) && new Set(asked).size === 20, 'every cell answered once, never more than the budget in a frame, none asked twice inside `every`');
  const r0 = M.afxOcclGet(O, 6, 0, now), r9 = M.afxOcclGet(O, 6 + 12 * C.cell, 0, now); ok(r0.occ === 0 && r0.known && r9.occ === 1 && r9.blocked, 'the first answer of a cell is taken at once (open: 0, a wall between: 1)');
  const before = asked.length; now += C.every + 0.001; for(let i = 0; i < 20; i++) M.afxOcclGet(O, 6 + i * C.cell, 0, now); M.afxOcclTick(O, now, 0.016, 0, 0, C.perFrame, (x, z) => { asked.push(x); return true; });
  ok(asked.length === before + C.perFrame, '`every` s later they are due again');
  let k = 0; while(r9.occ > 0 && k++ < 400){ now += 0.016; M.afxOcclGet(O, r9.x, r9.z, now); M.afxOcclTick(O, now, 0.016, 0, 0, 0, () => true); } r9.blocked = false;
  r9.blocked = true; r9.occ = 0; k = 0; while(r9.occ < 1 && k++ < 400){ now += 0.016; M.afxOcclGet(O, r9.x, r9.z, now); M.afxOcclTick(O, now, 0.016, 0, 0, 0, () => true); }
  say(k > 3 && k < 120, `a wall coming between eases in over ${(k * 16)} ms (tau ${C.tau * 1000} ms), no step`);
  M.afxOcclGet(O, 0, C.maxD + 20, now); const b2 = asked.length; now += C.every + 0.01; M.afxOcclGet(O, 0, C.maxD + 20, now); M.afxOcclTick(O, now, 0.016, 0, 0, 9, (x, z) => { asked.push(z); return true; }); ok(!asked.slice(b2).includes(C.maxD + 20), 'a cell past maxD is never checked');
  now += C.keep + 1; M.afxOcclTick(O, now, 0.016, 0, 0, C.perFrame, () => true); ok(O.list.length === 0 && O.map.size === 0 && O.free.length >= 20, 'cells nobody sounds in for `keep` s are forgotten (their records kept for reuse)');
  ok(M.afxOcclGain(0, C) === 1 && Math.abs(M.afxOcclGain(1, C) - C.gain) < 1e-12 && M.afxOcclLp(12000, 0, C) === 12000 && Math.abs(M.afxOcclLp(12000, 1, C) - C.lp) < 1e-6 && M.afxOcclLp(600, 1, C) === 600 && mono(o => M.afxOcclLp(12000, o, C), 0, 1, 50, -1), 'behind a wall: × gain, low-passed down to lp — and never brighter than the distance left it');
  report.occlChecksAFrame = C.perFrame; report.occlEveryMs = C.every * 1000; }

grp('voices: the pool, priority, stealing, merging');
{ const V = A.voices, P = A.prio, pool = M.afxPoolMake(4); let t = 0, q;
  ok(P.incoming > P.own && P.blast > P.own && P.radio > P.own && P.own > P.squad && P.squad > P.enemy && P.enemy > P.far && P.far > P.foley, 'rounds coming in, blasts, the radio > his own gun > the squad > the enemy > the far battle > foley');
  for(let i = 0; i < 4; i++){ q = M.afxPoolAsk(pool, t, P.enemy, 0.2 + i * 0.1, 'k' + i, i * 20, 0, true, V); ok(q.how === 'free', 'a free slot'); M.afxPoolTake(pool, q.slot, t, P.enemy, 0.2 + i * 0.1, 1, 'k' + i, 'gun', i * 20, 0, true); }
  q = M.afxPoolAsk(pool, t, P.foley, 0.9, 'step', 0, 0, true, V); ok(q.how === 'drop', 'full: a lower priority is dropped, however loud');
  q = M.afxPoolAsk(pool, t, P.enemy, 0.1, 'new', 99, 0, true, V); ok(q.how === 'drop', 'full: an equal priority quieter than every voice is dropped');
  q = M.afxPoolAsk(pool, t, P.enemy, 0.25, 'new', 99, 0, true, V); ok(q.how === 'steal' && pool.v[q.slot].key === 'k0', 'full: an equal priority louder than the quietest steals the quietest');
  q = M.afxPoolAsk(pool, t, P.incoming, 0.01, 'crack', 1, 0, true, V); ok(q.how === 'steal' && pool.v[q.slot].key === 'k0', 'full: a higher priority always gets in — it takes the quietest of the lowest priority');
  M.afxPoolTake(pool, q.slot, t, P.incoming, 0.5, 1, 'crack', 'crack', 1, 0, true);
  q = M.afxPoolAsk(pool, t, P.own, 0.3, 'own', 0, 0, true, V); ok(q.how === 'steal' && pool.v[q.slot].prio === P.enemy && pool.v[q.slot].key === 'k1', 'his own gun steals from the enemy\'s voices, never from the incoming crack');
  q = M.afxPoolAsk(pool, t + V.mergeMs / 2000, P.enemy, 0.3, 'k2', 41, 1, true, V); ok(q.how === 'merge' && pool.v[q.slot].key === 'k2', 'the same sound at the same place within mergeMs merges into the playing voice');
  q = M.afxPoolAsk(pool, t + V.mergeMs / 2000, P.enemy, 0.0001, 'k2', 40 + V.mergeR * 3, 0, true, V); ok(q.how !== 'merge', '… not from somewhere else');
  q = M.afxPoolAsk(pool, t + V.mergeMs / 500, P.enemy, 0.0001, 'k2', 41, 1, true, V); ok(q.how !== 'merge', '… not after mergeMs');
  { const p2 = M.afxPoolMake(V.same + 6); let st = 0; for(let i = 0; i < V.same + 4; i++){ const a = M.afxPoolAsk(p2, i * 0.05, P.own, 0.3, 'mg', 0, 0, true, V, V.same); if(a.how === 'steal'){ st++; ok(p2.v[a.slot].key === 'mg' && p2.v.every(s => !s.on || s.key !== 'mg' || s.t0 >= p2.v[a.slot].t0), 'past its cap a sound takes over its own oldest'); } M.afxPoolTake(p2, a.slot, i * 0.05, P.own, 0.3, 5, 'mg', 'gun', 0, 0, true); }
    ok(st === 4 && p2.v.filter(s => s.on).length === V.same, `his own gun never holds more than ${V.same} voices, free slots or not (a family of the others': ${V.family})`); }
  ok(M.afxVoiceLevel(pool.v[2], t + V.tau, V.tau) < pool.v[2].lvl * 0.4, 'a playing voice is taken to have faded (the quietest is the one nearly over)');
  q = M.afxPoolAsk(pool, t + 5, P.foley, 0.01, 'late', 0, 0, false, V); ok(q.how === 'free' && pool.v.filter(s => s.on).length === 0, 'ended voices free their slots');
  let on = 0, over = false; const big = M.afxPoolMake(V.max); for(let i = 0; i < 500; i++){ q = M.afxPoolAsk(big, i * 0.001, i % 6, 0.1 + (i % 7) * 0.1, 'v' + i, i, 0, true, V); if(q.how === 'free' || q.how === 'steal') M.afxPoolTake(big, q.slot, i * 0.001, i % 6, 0.1 + (i % 7) * 0.1, 2, 'v' + i, 'gun', i, 0, true); on = big.v.filter(s => s.on).length; if(on > V.max) over = true; }
  say(!over && on === V.max && big.stolen > 0 && big.dropped > 0, `500 sounds in half a second: never more than ${V.max} voices (${big.stolen} stolen, ${big.dropped} dropped); a phone: ${V.phone}`); report.voices = V.max; report.voicesPhone = V.phone; }

grp('density: a volley is wide, not loud');
{ const st = { t:-9, n:0 }, D = A.dens, f = []; for(let i = 0; i < 12; i++) f.push(M.afxDensity(st, 1 + i * 0.001, D)); let sum2 = 0; for(const k of f) sum2 += k * k;
  ok(f[0] === 1 && Math.abs(f[1] - Math.SQRT1_2) < 1e-12 && f.every((k, i) => i === 0 || k <= f[i - 1]) && f[11] === D.min && M.afxDensity(st, 1 + D.win + 0.02, D) === 1, 'the first of a family plays in full, the n-th inside the window at 1/√n (never under min); after the window: in full again');
  say(sum2 < 6, `12 rifles in the same instant carry the energy of ${sum2.toFixed(1)} (not 12)`); }

grp('round-robin: never the same variation twice running');
{ const rnd = M.afxRng(7); let good = true, cover = true; for(const n of [1, 2, 3, 4, 7]){ const st = { last:-1 }, seen = new Set(); let prev = -1; for(let i = 0; i < 20000; i++){ const k = M.afxRR(st, n, rnd); if(k < 0 || k >= n || n > 1 && k === prev) good = false; prev = k; seen.add(k); } if(seen.size !== n) cover = false; }
  ok(good && cover, '20 000 draws each for 1, 2, 3, 4 and 7 variations: in range, every one used, never a repeat');
  ok(Object.values(A.guns).every(F => (F.var || A.vars).length >= 2 && (F.var || A.vars).length <= 4 && (F.var || A.vars).every(v => v.length === 3 && v[0] > 0.9 && v[0] < 1.1 && v[1] >= 0 && v[1] < 0.02)) && A.variants >= 2, 'every gun family has 2–4 variations [rate, start offset, low-pass]; every rendered one-shot ' + A.variants + ' takes'); }

grp('the space: what kind of place, the slap-back, the impulse responses');
{ const C = A.space, K = (roof, walls, high) => M.afxSpaceKind({ roof, walls, high }, C);
  ok(K(true, 8, 8) === 'roof' && K(false, C.wallN, 8) === 'walls' && K(false, C.wallN - 1, C.valley.n) === 'valley' && K(false, C.wallN - 1, C.valley.n - 1) === 'open' && K(false, 0, 0) === 'open', 'a roof first, then walls round him, then a valley, else the open');
  const SL = C.slap, out = { n:0, t:[0, 0], g:[0, 0], lp:[0, 0] }, I = Infinity; let n = M.afxSlap([I, 12, I, 6, I, 20, I, 1], 8, SL, U, CS, out);
  ok(n === 2 && Math.abs(out.t[0] - 2 * 6 * U / CS) < 1e-12 && Math.abs(out.t[1] - 2 * 12 * U / CS) < 1e-12 && out.g[0] > out.g[1] && out.lp[0] > out.lp[1] && out.g[0] <= SL.g[0], 'the two nearest walls past `min` answer: there and back at the speed of sound, the farther one quieter and duller');
  say(true, `a wall 6 units off slaps back after ${(out.t[0] * 1000).toFixed(0)} ms, one 12 off after ${(out.t[1] * 1000).toFixed(0)} ms (never over ${SL.t[1] * 1000} ms)`);
  ok(M.afxSlap([I, I, I, I, I, I, I, 2], 8, SL, U, CS, out) === 0 && M.afxSlap([9, 9 + SL.apart / 2, I, I, I, I, I, I], 8, SL, U, CS, out) === 1 && M.afxSlap([SL.R + 1, I, I, I, I, I, I, I], 8, SL, U, CS, out) === 0 && M.afxSlap([SL.R - 0.5, I, I, I, I, I, I, I], 8, SL, U, CS, out) === 1 && out.t[0] <= SL.t[1], 'no wall in range: no echo; two walls at one distance: one echo; the delay stays inside its bounds');
  const sr = 44100, late = {}; let good = true; for(const [k, S] of Object.entries(C.kinds)){ const ir = M.afxIR(sr, S, M.afxRng(11)), L = ir[0], Rr = ir[1], pre = Math.floor(S.pre * sr) - 1; let silent = true, same = true; for(let i = 0; i < pre; i++) if(L[i] !== 0 || Rr[i] !== 0) silent = false; for(let i = 0; i < L.length; i++) if(L[i] !== Rr[i]){ same = false; break; }
    late[k] = energy(L, 0.5, 1) / energy(L, 0, 1); if(!(L.length === Math.round(S.len * sr) && Rr.length === L.length && fin(L) && fin(Rr) && Math.max(peak(L), peak(Rr)) <= 0.9 + 1e-6 && Math.max(peak(L), peak(Rr)) > 0.89 && silent && !same && energy(L, 0.75, 1) < energy(L, 0, 0.25) * 0.02 && Math.abs(L[L.length - 1]) < 1e-3 && S.rt <= S.len && S.send > 0 && S.send <= 1.5)) good = false; }
  say(good && Object.keys(C.kinds).join() === 'open,walls,roof,valley', `four spaces, each its own stereo response: silent until its pre-delay, peak 0.9, decaying to nothing (lengths ${Object.values(C.kinds).map(S => S.len).join(' / ')} s)`); report.spaces = Object.keys(C.kinds).length;
  ok(C.kinds.valley.rt > C.kinds.open.rt && C.kinds.roof.rt > C.kinds.walls.rt && C.kinds.walls.pre < C.kinds.open.pre && C.kinds.valley.echo.length >= 3 && C.kinds.walls.early.length > C.kinds.open.early.length, 'a valley rings longest and answers late; walls answer at once, short and dense; a roof holds the sound'); }

grp('the ground and the gait');
{ const Sf = A.surface, C = A.step, f = (water, bridge, paved) => M.afxSurface('MEADOW', { water, bridge, paved }, Sf);
  ok(f(true, '', true) === 'water' && f(false, 'wood', true) === 'wood' && f(false, '', true) === Sf.paved && f(false, '', false) === 'grass' && M.afxSurface('NOWHERE', { water:false, bridge:'', paved:false }, Sf) === Sf.biome._ && M.afxSurface('ARCTIC', { water:false, bridge:'', paved:false }, Sf) === 'snow' && M.afxSurface('DESERT', { water:false, bridge:'', paved:false }, Sf) === 'sand' && M.afxSurface('FOUNDRY', { water:false, bridge:'', paved:false }, Sf) === 'metal', 'the shallows before a bridge before a paved yard before the land\'s own ground: sand, snow, steel, grass …');
  ok(new Set(Object.values(Sf.biome)).size >= 6 && [...Object.values(Sf.biome), Sf.paved, Sf.bridge, 'water'].every(s => C.surf[s] > 0), 'six grounds at least across the lands, each with its level');
  ok(M.afxGait('prone', 9, C) === 'crawl' && M.afxGait('crouch', 9, C) === 'crouch' && M.afxGait('stand', C.sprintV, C) === 'sprint' && M.afxGait('stand', C.runV, C) === 'run' && M.afxGait('stand', C.runV - 0.1, C) === 'walk', 'crawl, crouch, walk, run, sprint by stance and speed');
  ok(C.gait.sprint.g > C.gait.run.g && C.gait.run.g > C.gait.walk.g && C.gait.walk.g > C.gait.crouch.g && C.gait.crouch.g > C.gait.crawl.g && C.gait.sprint.rate < C.gait.run.rate, 'heavier (and lower) at a sprint, quiet at a crouch, quietest at a crawl');
  ok(M.afxStepCad(0, false, C) === 0 && M.afxStepCad(C.minV, false, C) === C.cad[0] + C.minV * C.cad[1] && mono(v => M.afxStepCad(v, false, C), C.minV, 12, 200, 1) && M.afxStepCad(99, false, C) === C.cad[2] && M.afxStepCad(1, true, C) === C.crawlCad, 'the cadence: none standing still, quicker with speed up to its top; a crawl drags on its own slow beat'); }

grp('the mixer: the soft limiter, ducking, the deafened moment');
{ const L = A.limit, D = A.duck, C = A.deaf, sc = x => M.afxSoftClip(x, L.thr, L.top); let top = 0, odd = true, same = true; for(let i = 0; i <= 4000; i++){ const x = i / 100; top = Math.max(top, sc(x)); if(Math.abs(sc(-x) + sc(x)) > 1e-12) odd = false; if(x <= L.thr && sc(x) !== x) same = false; }
  ok(same && odd && top <= L.top && sc(1e6) <= L.top && mono(sc, -40, 40, 8000, 1) && Math.abs(sc(L.thr + 1e-6) - L.thr - 1e-6) < 1e-9, `the soft limiter: untouched up to ${L.thr}, odd, monotonic, no step at the knee, never past ${L.top} whatever comes in`);
  let sum = 0; for(let i = 0; i < 10; i++) sum += 0.9; say(sc(sum) <= L.top && sc(sum) > 0.9 && sc(0.5) === 0.5, `ten blasts at 0.9 stacked (a sum of ${sum.toFixed(1)}) leave it at ${sc(sum).toFixed(3)} — no clipping; a lone 0.5 passes untouched`);
  const cv = M.afxClipCurve(L.n, L.thr, L.top, L.head), mid = (L.n - 1) / 2; let cm = true; for(let i = 1; i < L.n; i++) if(cv[i] < cv[i - 1]) cm = false; const at = x => cv[Math.round((x / L.head + 1) / 2 * (L.n - 1))];
  ok(cv.length === L.n && L.n % 2 === 1 && cv[mid] === 0 && cm && Math.abs(cv[L.n - 1] - Math.fround(sc(L.head))) < 1e-6 && cv[0] === -cv[L.n - 1] && Math.abs(at(0.5) - 0.5) < 2 * L.head / L.n && cv[L.n - 1] <= L.top, 'its WaveShaper table: odd length, 0 at the centre, rising, ± the same, covering ±head');
  ok(Math.abs(M.afxFollow(0, 1, 0.1, 0.1, 5) - (1 - Math.exp(-1))) < 1e-12 && Math.abs(M.afxFollow(1, 0, 0.1, 0.1, 5) - Math.exp(-0.02)) < 1e-12 && M.afxFollow(0.3, 0.3, 1, 1, 1) === 0.3, 'an envelope follower with its own way up and way down, never past its target');
  ok(M.afxDuckMusic(0, false, D) === 1 && Math.abs(M.afxDuckMusic(1, false, D) - Math.max(D.min, 1 - D.gun)) < 1e-12 && mono(h => M.afxDuckMusic(h, false, D), 0, 2, 100, -1) && M.afxDuckMusic(9, true, D) >= D.min && M.afxDuckWorld(false, 0, D) === 1 && M.afxDuckWorld(true, 0, D) === D.worldSpeech && M.afxDuckWorld(true, 1, D) >= D.min, 'the music dips under gunfire (never under min); the fight dips a little under a spoken radio line');
  ok(M.afxDeaf(C.R, 2, C) === 0 && M.afxDeaf(C.R + 5, 2, C) === 0 && mono(d => M.afxDeaf(d, 1, C), 0, C.R * 1.5, 200, -1) && M.afxDeaf(1, 2, C) >= M.afxDeaf(1, 1, C) && M.afxDeaf(0, 9, C) === 1 && M.afxDeaf(0, 1, C) <= 1, 'deafness: none from R on, stronger the closer and the bigger the blast, 1 at most');
  ok(M.afxDeafLp(0, C) === C.lp[0] && Math.abs(M.afxDeafLp(1, C) - C.lp[1]) < 1e-6 && mono(k => M.afxDeafLp(k, C), 0, 1, 50, -1) && M.afxDeafHold(0, C) === C.hold[0] && M.afxDeafHold(1, C) === C.hold[1] && C.ring <= 0.03 && C.ringHz[0] > 2000 && C.ringT[1] <= 6, 'deafened: the low-pass from open down to lp[1], held hold[min … max] s; the ringing faint and short');
  say(M.afxDeaf(2, 1, C) > C.min && M.afxDeaf(7, 1, C) < C.min, `a grenade 2 units off: strength ${M.afxDeaf(2, 1, C).toFixed(2)} → the mix low-passed at ${M.afxDeafLp(M.afxDeaf(2, 1, C), C).toFixed(0)} Hz for ${M.afxDeafHold(M.afxDeaf(2, 1, C), C).toFixed(2)} s; at 7 units: ${M.afxDeaf(7, 1, C).toFixed(2)}, under the threshold ${C.min} — nothing`); }

grp('the score by the director; the barks\' throttle');
{ const C = A.music, o = { heat:0, lp:0, gain:0 }, at = (ph, P, held, duel) => ({ ...M.afxMusic(ph, P, held, duel, C, o) }), lull = at('release', 0.5, false, false), b0 = at('build', 0, false, false), b1 = at('build', 1, false, false), pk = at('peak', 1, false, false), held = at('finale', 0.2, true, false), duel = at('finale', 0.2, false, true);
  ok(lull.heat < b0.heat && b0.heat < b1.heat && b1.heat < pk.heat && pk.heat === 1 && duel.heat === 1 && held.heat === 0, 'a lull is calmer than the build-up, the build-up rises with the pressure, a peak (and the duel) brings every stem in');
  ok(held.gain < lull.gain && lull.gain < b0.gain && held.lp < lull.lp && lull.lp < b0.lp && b0.lp < pk.lp && pk.lp <= C.open && held.gain >= 0.2, 'the held breath before the general: the score nearly gone and muffled; a lull darker than the build-up; a peak wide open');
  ok(pk.heat > 0.8 && b1.heat <= 0.8 && lull.heat < 0.3, 'audio/music.js brings the brass in above 0.8: at a peak only; under 0.3 the bass stays out: a lull is the pad and a touch of drums');
  const B = A.barks, St = { at:-1e9, by:{} }; ok(M.afxBarkOk('kill', 100, -1e9, St, B) && !M.afxBarkOk('reload', 100 + B.gap - 0.1, -1e9, St, B) && M.afxBarkOk('reload', 100 + B.gap, -1e9, St, B) && !M.afxBarkOk('kill', 100 + B.gap * 2, -1e9, St, B) && M.afxBarkOk('kill', 100 + Math.max(B.cd.kill, B.gap * 2 + 0.1), -1e9, St, B), 'one call at a time (gap), each kind on its own clock (cd)');
  ok(!M.afxBarkOk('flank', 900, 900 - B.radio + 0.1, St, B) && M.afxBarkOk('flank', 900, 900 - B.radio, St, B) && !M.afxBarkOk('nothing', 9999, -1e9, St, B), 'never on top of a radio line; an unknown kind is never said');
  const { STORY } = await import('../config.js'); ok(Object.keys(B.cd).every(k => k === 'flank' ? ['flank_left', 'flank_right', 'flank_rear'].every(f => B.lines[f].length >= 2) : B.lines[k].length >= 2) && B.lines.down.every(l => l.includes('{who}')) && ['mg', 'medic', 'at'].every(r => STORY.cast[r].field && STORY.cast[r].tag) && Object.values(B.lines).flat().every(l => l.length <= 44), 'every call has two lines or more, short; a man down names him; the cast\'s field mates have their tags'); }

grp('the synthesised one-shots: finite, levelled, repeatable');
{ const sr = 44100, R = s => M.afxRng(s), all = { crack:r => M.afxCrackBuf(sr, r), click:r => M.afxClickBuf(sr, 1100, r), tail:r => M.afxTailBuf(sr, 1.1, 700, r), kit:r => M.afxKitBuf(sr, r), grunt:r => M.afxGruntBuf(sr, r), squelch:r => M.afxSquelchBuf(sr, r) };
  for(const s of ['sand', 'grass', 'dirt', 'rock', 'snow', 'water', 'metal', 'wood']){ all['step ' + s] = r => M.afxStepBuf(sr, s, r, false); all['hoof ' + s] = r => M.afxStepBuf(sr, s, r, true); all['brass ' + s] = r => M.afxBrassBuf(sr, s, r); }
  for(const m of ['dirt', 'sand', 'stone', 'metal', 'wood', 'water']) all['impact ' + m] = r => M.afxImpactBuf(sr, m, r);
  let n = 0, bad = []; for(const [k, f] of Object.entries(all)){ const a = f(R(1)), b = f(R(1)), c = f(R(2)); n++; let same = a.length === b.length, diff = false; for(let i = 0; i < a.length && same; i++) if(a[i] !== b[i]) same = false; for(let i = 0; i < Math.min(a.length, c.length); i++) if(a[i] !== c[i]){ diff = true; break; }
    if(!(fin(a) && peak(a) <= 0.9 + 1e-6 && peak(a) > 0.3 && same && diff && Math.abs(a[a.length - 1]) < 0.02 && a.length < sr * 3)) bad.push(k); }
  say(bad.length === 0, `${n} one-shots rendered: all finite, peak ≤ 0.9, ended at zero, the same from the same seed, another from another` + (bad.length ? ' — FAILED: ' + bad.join(', ') : ''));
  const cr = M.afxCrackBuf(sr, R(3)); ok(energy(cr, 0, 0.2) > energy(cr, 0.2, 1) * 4 && cr.length <= sr * 0.06, 'the crack is a snap: nearly all of it in its first 10 ms');
  const hz = x => { let a = 0, b = 0; for(let i = 1; i < x.length; i++){ a += (x[i] - x[i - 1]) ** 2; b += x[i] * x[i]; } return Math.sqrt(a / b) * sr / (2 * Math.PI); }, st = k => M.afxStepBuf(sr, k, R(4), false), im = k => M.afxImpactBuf(sr, k, R(4)), late = x => energy(x, 0.25, 1) / energy(x, 0, 1);   // (hz: an energy-weighted mean frequency)
  say(hz(st('sand')) > hz(st('dirt')) * 1.5 && hz(st('rock')) > hz(st('dirt')) * 1.5 && hz(st('wood')) < hz(st('dirt')) && late(st('metal')) > late(st('dirt')) * 2 && hz(im('stone')) > hz(im('dirt')) * 1.5 && hz(im('wood')) < hz(im('dirt')) && hz(M.afxStepBuf(sr, 'rock', R(4), true)) < hz(st('rock')) * 0.5,
    `the grounds differ where they should — mean frequency of a step: sand ${hz(st('sand')).toFixed(0)}, rock ${hz(st('rock')).toFixed(0)}, snow ${hz(st('snow')).toFixed(0)}, dirt ${hz(st('dirt')).toFixed(0)}, wood ${hz(st('wood')).toFixed(0)} Hz; steel rings on (${(late(st('metal')) * 100).toFixed(0)} % of it after the first quarter, dirt ${(late(st('dirt')) * 100).toFixed(0)} %); a hoof sits an octave under a boot`);
  report.oneShots = n; }

// =============================== part 2: the layer against a fake AudioContext ===============================
class Param { constructor(v){ this.value = v; this.ev = []; }
  setValueAtTime(v, t){ this.ev.push(['set', v, t]); this.value = v; return this; } setTargetAtTime(v, t, tc){ this.ev.push(['target', v, t, tc]); return this; }
  linearRampToValueAtTime(v, t){ this.ev.push(['lin', v, t]); return this; } exponentialRampToValueAtTime(v, t){ this.ev.push(['exp', v, t]); return this; } cancelScheduledValues(t){ this.ev.push(['cancel', t]); return this; }
  get target(){ for(let i = this.ev.length - 1; i >= 0; i--) if(this.ev[i][0] !== 'cancel') return this.ev[i][1]; return this.value; } }
class Node { constructor(ctx, kind){ this.ctx = ctx; this.kind = kind; this.outs = new Set(); this.ins = new Set(); ctx.made[kind] = (ctx.made[kind] || 0) + 1; this.id = ++ctx.count; }
  connect(d){ if(!(d instanceof Node)) throw new Error('connect to a non-node from ' + this.kind); this.outs.add(d); d.ins.add(this); return d; }
  disconnect(){ for(const d of this.outs) d.ins.delete(this); this.outs.clear(); } }
class FakeBuffer { constructor(ch, len, sr){ if(!(len > 0)) throw new Error('empty buffer'); this.numberOfChannels = ch; this.length = len; this.sampleRate = sr; this.duration = len / sr; this.d = []; for(let c = 0; c < ch; c++) this.d.push(new Float32Array(len)); }
  getChannelData(c){ return this.d[c]; } copyToChannel(src, c){ if(src.length > this.length) throw new Error('copyToChannel overflow'); this.d[c].set(src); } }
class FakeCtx { constructor(){ this.currentTime = 0; this.sampleRate = 44100; this.state = 'running'; this.made = {}; this.count = 0; this.srcs = []; this.destination = new Node(this, 'destination'); }
  node(kind, params){ const n = new Node(this, kind); for(const k in params) n[k] = new Param(params[k]); return n; }
  createGain(){ return this.node('gain', { gain:1 }); } createBiquadFilter(){ const n = this.node('biquad', { frequency:350, Q:1, gain:0 }); n.type = 'lowpass'; return n; }
  createStereoPanner(){ return this.node('panner', { pan:0 }); } createDelay(max){ const n = this.node('delay', { delayTime:0 }); n.max = max || 1; return n; }
  createConvolver(){ const n = this.node('convolver', {}); n.buffer = null; n.normalize = true; return n; } createWaveShaper(){ const n = this.node('shaper', {}); n.curve = null; n.oversample = 'none'; return n; }
  createDynamicsCompressor(){ return this.node('comp', { threshold:-24, knee:30, ratio:12, attack:0.003, release:0.25 }); }
  createOscillator(){ const n = this.node('osc', { frequency:440, detune:0 }); n.type = 'sine'; this.source(n); return n; }
  createBufferSource(){ const n = this.node('source', { playbackRate:1 }); n.buffer = null; n.loop = false; this.source(n); return n; }
  createBuffer(ch, len, sr){ return new FakeBuffer(ch, len, sr); }
  source(n){ const ctx = this; n.at = null; n.stopAt = Infinity; n.done = false; n.onended = null;
    n.start = function(at, off){ if(n.at != null) throw new Error('start() twice'); if(n.kind === 'source' && !n.buffer) throw new Error('start() without a buffer'); if(off != null && n.buffer && off > n.buffer.duration) throw new Error('offset past the buffer'); n.at = Math.max(ctx.currentTime, at || 0); n.off = off || 0; ctx.srcs.push(n); };
    n.stop = function(t){ if(n.at == null) throw new Error('stop() before start()'); n.stopAt = Math.min(n.stopAt, t == null ? ctx.currentTime : t); }; }
  endOf(n){ const nat = n.kind === 'source' && !n.loop ? n.at + (n.buffer.duration - n.off) / n.playbackRate.value : Infinity; return Math.min(nat, n.stopAt); }
  advance(dt){ this.currentTime += dt; for(let i = this.srcs.length - 1; i >= 0; i--){ const n = this.srcs[i]; if(this.endOf(n) <= this.currentTime){ this.srcs.splice(i, 1); n.done = true; if(n.onended) n.onended(); } } }
  get playing(){ return this.srcs.filter(n => n.at <= this.currentTime).length; } }
const reach = n => { const seen = new Set(), st = [n]; while(st.length){ const x = st.pop(); if(seen.has(x)) continue; seen.add(x); for(const i of x.ins) st.push(i); } return seen.size - 1; };   // every node still wired into n
const STOP = new Set(), BASE = { n:-1 };   // STOP: the slap-back lines' outputs (a search for a voice's nodes does not wander up them) · BASE: the fixed graph's size under the master
const up = (n, kind) => { const seen = new Set(), st = [n], out = []; while(st.length){ const x = st.pop(); if(seen.has(x) || STOP.has(x)) continue; seen.add(x); if(x.kind === kind) out.push(x); for(const i of x.ins) st.push(i); } return out; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let clean = () => false;

register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, next){ if(/(^|\\/)hub\\.js$/.test(s) && c.parentURL && /\\/src\\/audio\\/afx[\\w-]*\\.js$/.test(c.parentURL)) return { url:${JSON.stringify(STUB)}, shortCircuit:true }; return next(s, c); }`));
const H = await import(STUB), T = H.T, AFX = H.AFX;

grp('the layer without a context, with a suspended one, switched off');
{ let threw = ''; try{ ok(H.afxGun('rifleShot', { x:5, z:5 }, 'e') === false && H.afxSfx('explode', { x:1, z:1 }) === false && H.afxIncoming({ x:1, z:1, vx:0, vz:50, ox:0, oz:-40 }, { pos:{ x:0, z:0 } }, false) === false, 'no AudioContext: every entry answers "not played"'); H.afxImpact('stone', 1, 1, 1); H.afxBrass(1, 1); H.updateAfx(0.016, 1); H.gunSound('rifleShot', { x:1, z:1 }, 'e');
    ok(T.sfx.length === 1 && T.sfx[0] === 'rifleShot' && AFX.ready === false, '… gunSound falls back to sfx(), nothing was built'); }catch(e){ threw = e.stack; } ok(!threw, 'nothing throws without a context ' + threw);
  const ctx = new FakeCtx(); ctx.state = 'suspended'; H.__ctx(ctx); H.S.player = { pos:{ x:0, z:0 }, lift:0 }; threw = '';
  try{ ok(H.afxGun('rifleShot', { x:5, z:5 }, 'e') === false && H.afxSfx('hit', { x:1, z:1 }) === false, 'a suspended context: "not played" (the old path decides, as before)'); H.updateAfx(0.016, 2); }catch(e){ threw = e.stack; } ok(!threw && ctx.srcs.length === 0, 'nothing throws, nothing is scheduled on a suspended context ' + threw);
  ctx.state = 'running'; H.PROFILE.realAudio = false; T.sfx.length = 0; ok(H.afxOn() === false && H.afxBus() === null && H.afxSend() === null, 'switched off in the settings: afxOn() is false, the old buses are used'); H.gunSound('shoot_ak', H.S.player.pos, 'p'); ok(T.sfx[0] === 'shoot_ak' && ctx.srcs.length === 0 && !AFX.ready, '… and a shot is sfx() alone');
  H.PROFILE.realAudio = true; H.__muted(true); ok(H.afxGun('rifleShot', { x:5, z:5 }, 'e') === false, 'muted: not played'); H.__muted(false); }

const ctx = H.actx, P0 = H.S.player, V = A.voices; clean = () => reach(H.master) === BASE.n && ctx.srcs.length === 0 && AFX.pool.v.every(s => !s.on);   // nothing but the fixed graph is wired, nothing scheduled, every slot free
const settle = async (sec = 6) => { for(let i = 0; i < sec * 20; i++) ctx.advance(0.05); await sleep(170); };   // every sound ends; a stolen voice's nodes come off 150 ms later
grp('a shot builds its layers and leaves nothing behind');
{ ok(H.afxGun('shoot_ak', P0.pos, 'p') === true && AFX.ready && H.afxBus() === AFX.bus, 'the player\'s AK is played by the layer (built on first use)');
  const srcs = up(AFX.bus, 'source'); ok(srcs.length === 3 && ctx.srcs.length === 3, 'three layers: the recording, the action\'s click, the tail');
  ok(srcs.some(s => s.at > 0.03) && srcs.every(s => s.at < 0.1), 'the click comes with the action, the tail a moment after — nothing delayed at his own muzzle');
  ok(up(AFX.send, 'source').length === 3 && [...AFX.bus.outs][0] === H.master && [...AFX.send.outs][0] === H.verbSend, 'the voice feeds the world bus and the reverb send');
  ok(up(AFX.bus, 'panner').length === 0 && up(AFX.bus, 'biquad').length === 2 && AFX.pool.v.filter(s => s.on).length === 2, 'his own gun: centred; two voices — the shot (its low-pass the variation\'s) and, low in the queue, its tail');
  await settle(); ok(reach(AFX.bus) === 0 && reach(AFX.send) === 0 && ctx.srcs.length === 0 && AFX.pool.v.every(s => !s.on), 'when it has ended not one node is left wired into the bus or the send, and its slot is free');
}

grp('the space he stands in: one ray a tick, four convolvers, the slap-back');
{ const C = A.space, AS = H.AFXS; C.buildGap = 1; let now = 20, most = 0; T.hit = () => null; T.rays = 0;
  for(let i = 0; i < 200; i++){ now += 0.016; const b = T.rays; H.updateAfx(0.016, now); most = Math.max(most, T.rays - b); } for(let k = 0; k < 300 && !AS.live; k++) await sleep(10);   // (the four responses are rendered in slices: wait for the last)
  ok(most === 1 && T.rays >= C.rays * 5 && T.rays <= C.rays * 7.5, `never more than one ray in a frame — a ring of ${C.rays} every ${C.every} s`); report.spaceRaysAFrame = most;
  ok(AS.built && AS.live && Object.keys(AS.conv).length === 4 && AFX.send.outs.size === 4 && !AFX.send.outs.has(H.verbSend) && up(H.master, 'convolver').length === 4 && ctx.made.convolver === 4, 'the four spaces\' convolvers are built once and the layer\'s send moved onto them (off the old outdoor reverb)');
  ok(AS.kind === 'open' && AS.in.open.gain.target === C.kinds.open.send && AS.in.walls.gain.target === 0 && AS.lines.length === C.slap.max && AS.lines.every(L => L.g.gain.value === 0 && !L.on), 'in the open: the open space\'s send alone is up, no slap-back');
  T.hit = (ax, az, bx, bz) => bx > ax + 1 || bz > az + 1 ? 6 / C.R : bx < ax - 1 && Math.abs(bz - az) < 1 ? 13 / C.R : null;   // walls 6 units off on three sides, one 13 off on a fourth
  for(let i = 0; i < 80; i++){ now += 0.016; H.updateAfx(0.016, now); }
  say(AS.kind === 'walls' && AS.walls >= C.wallN && AS.in.walls.gain.target === C.kinds.walls.send && AS.in.open.gain.target === 0, `walls on ${AS.walls} of ${C.rays} rays: the space is 'walls', cross-faded over ${C.fade} s`);
  ok(AS.lines[0].on && Math.abs(AS.lines[0].d.delayTime.target - 2 * 6 * U / CS) < 1e-9 && AS.lines[1].on && Math.abs(AS.lines[1].d.delayTime.target - 2 * 13 * U / CS) < 1e-9 && AS.lines[0].g.gain.target > AS.lines[1].g.gain.target && AFX.slap, 'the two slap-back lines are timed off the walls at 6 and 13 units');
  for(const L of AS.lines) STOP.add(L.g); const ev = AS.lines[0].d.delayTime.ev.length; for(let i = 0; i < 80; i++){ now += 0.016; H.updateAfx(0.016, now); } ok(AS.lines[0].d.delayTime.ev.length === ev, 'a wall that has not moved: the line is not retimed (no pitch bend)');
  H.afxGun('shoot_ak', P0.pos, 'p'); ok([...AFX.slap.ins].length === 1 && [...AFX.slap.ins][0].gain.value === A.cls.gun.slap, 'his shot is sent to the slap-back'); await settle(); H.afxGun('shoot_m4s', P0.pos, 'p'); ok(AFX.slap.ins.size === 0, 'the suppressed M4 is not'); await settle();
  T.roof = true; for(let i = 0; i < 40; i++){ now += 0.016; H.updateAfx(0.016, now); } ok(AS.kind === 'roof' && AS.in.roof.gain.target === C.kinds.roof.send, 'underground: the roof\'s space'); T.roof = false;
  T.hit = () => null; T.high = (x, z) => Math.hypot(x, z) > 20 ? 9 : 0; for(let i = 0; i < 80; i++){ now += 0.016; H.updateAfx(0.016, now); } ok(AS.kind === 'valley' && AS.high >= C.valley.n && !AS.lines[0].on && AS.lines[0].g.gain.target === 0, 'high ground all round and no wall: a valley, the slap-back lines silent');
  T.high = () => 0; for(let i = 0; i < 80; i++){ now += 0.016; H.updateAfx(0.016, now); } ok(AS.kind === 'open', 'and back out in the open (a change of place is known within two rings: ' + C.every * 2 + ' s)');
  BASE.n = reach(H.master); ok(clean(), 'idle: only the fixed graph is wired (' + BASE.n + ' nodes under the master)'); report.fixedNodes = BASE.n; }

grp('footsteps: the ground, the gait, the men near him');
{ const C = A.step, MV = H.AFXM, CV = H.CV, lastGain = () => AFX.pool.v.find(s => s.on && s.key.startsWith('step:')).n.out.gain.value; let now = 400; H.updateAfx(0.016, now);
  H.afxFoot(P0, 0.2, 0.1, 4); ok(AFX.bufs['step:sand'] && up(AFX.bus, 'source').length >= 1 && AFX.pool.v.some(s => s.on && s.cls === 'foley') && MV.steps === 1, 'his foot comes down on the desert: a step on sand, a foley voice'); const gRun = lastGain(); await settle(1);
  H.afxFoot({ pos:{ x:0, z:0 } }, 0.2, 0.1, 4); ok(MV.steps === 1 && ctx.srcs.length === 0, 'somebody else\'s legs: not his step');
  CV.stance = 'crouch'; H.updateAfx(0.016, now += 1); H.afxFoot(P0, 0.2, 0.1, 1); const gCr = lastGain(); await settle(1); CV.stance = 'stand'; H.updateAfx(0.016, now += 1); H.afxFoot(P0, 0.2, 0.1, 6); const srcs = up(AFX.bus, 'source'), gSp = lastGain();
  say(gCr < gRun * 0.6 && gSp > gRun * 0.95 && AFX.bufs.kit && srcs.length === 2, `crouched his step is ${(gCr / gRun * 100).toFixed(0)} % of a run's; at a sprint it is heavier and his kit rattles`); await settle(1);
  let kinds = 0; for(const [b, w, pv, want] of [['ARCTIC', 1, false, 'snow'], ['MEADOW', 1, false, 'grass'], ['CITADEL', 1, false, 'rock'], ['FOUNDRY', 1, false, 'metal'], ['RUINS', 1, false, 'dirt'], ['MEADOW', 0.5, false, 'water'], ['MEADOW', 1, true, 'rock']]){ H.BIOME.name = b; T.wade = () => w; T.paved = () => pv; H.updateAfx(0.016, now += 1); H.afxFoot(P0, 0.2, 0.1, 4); if(AFX.bufs['step:' + want] && up(AFX.bus, 'source').length >= 1) kinds++; await settle(1); }
  ok(kinds === 7, 'snow, grass, rock, steel, dirt, the shallows, a paved yard: each land and each ground its own step'); H.BIOME.name = 'DESERT'; T.wade = () => 1; T.paved = () => false;
  CV.mounted = true; const before = MV.steps; H.afxFoot(P0, 0, 0, 4); ok(MV.steps === before, 'in the saddle: no footsteps of his'); CV.mounted = false;
  CV.stance = 'prone'; P0.vel = { x:0.7, z:0 }; let st = MV.steps; for(let i = 0; i < 250; i++){ now += 0.016; H.updateAfx(0.016, now); ctx.advance(0.016); } const crawl = MV.steps - st; ok(crawl >= 3 && crawl <= 5, `crawling 4 s: ${crawl} drags (no foot-plant comes when he is flat: by cadence)`); CV.stance = 'stand';
  st = MV.steps; P0.vel = { x:4, z:0 }; MV.footAt = -9; for(let i = 0; i < 125; i++){ now += 0.016; H.updateAfx(0.016, now); ctx.advance(0.016); } const fb = MV.steps - st; ok(fb >= 4 && fb <= 7, `no foot-plant for a while (no rig yet): 2 s of running by cadence, ${fb} steps`);
  st = MV.steps; for(let i = 0; i < 125; i++){ now += 0.016; H.afxFoot(P0, 0, 0, 0); MV.steps--; H.updateAfx(0.016, now); ctx.advance(0.016); } ok(MV.steps === st, 'while his feet report their own steps the cadence stays out of it'); P0.vel = { x:0, z:0 }; await settle(1);
  const near = { pos:{ x:6, z:0 } }, far = { pos:{ x:40, z:0 } }, foe = { pos:{ x:0, z:8 } }; H.FT.push(near, far); T.men = [foe]; let ot = MV.others, most = 0;
  for(let i = 0; i < 125; i++){ now += 0.016; near.pos.x += 4 * 0.016; far.pos.x += 4 * 0.016; foe.pos.z += 1.2 * 0.016; H.updateAfx(0.016, now); ctx.advance(0.016); most = Math.max(most, AFX.pool.v.filter(s => s.on && s.cls === 'foley').length); }
  say(MV.others - ot >= 7 && MV.others - ot <= 11 && far._fx === undefined && most <= C.max, `a mate running and an enemy walking within ${C.R} units, 2 s: ${MV.others - ot} of their steps heard (the man 40 units off: none); never more than ${most} foley voices`);
  const crowd = []; for(let k = 0; k < 14; k++) crowd.push({ pos:{ x:3 + k * 0.5, z:(k % 5) - 2 } }); T.men = crowd; most = 0; for(let i = 0; i < 125; i++){ now += 0.016; for(const m of crowd) m.pos.x += 5 * 0.016; H.updateAfx(0.016, now); ctx.advance(0.016); most = Math.max(most, AFX.pool.v.filter(s => s.on && s.cls === 'foley').length); }
  say(most <= C.max + 1, `fourteen men running past: at most ${most} of their steps sounding at once (cap ${C.max})`); H.FT.length = 0; T.men = []; await settle(1);
  H.updateAfx(0.016, now += 1); H.afxLand(P0.pos); ok(AFX.bufs.grunt && up(AFX.bus, 'source').length >= 2, 'landing a jump: the boots and the breath out of him'); await settle(1);
  H.updateAfx(0.016, now += 1); ok(H.afxHoof(2, 1, 9) === true && AFX.bufs['hoof:sand'] && H.afxHoof(2, 1, 9) === true && up(AFX.bus, 'source').length === 1, 'a hoof on the sand is the layer\'s (a second one inside its gap is not played)');
  H.PROFILE.realAudio = false; ok(H.afxHoof(2, 1, 9) === false, 'with the layer off the old hoof beat plays'); H.PROFILE.realAudio = true; await settle(); ok(clean(), 'all ended: only the fixed graph is wired'); }

grp('automatic fire');
{ const rates = []; for(let i = 0; i < 40; i++){ const n0 = ctx.count; H.afxGun('shoot_ak', P0.pos, 'p'); rates.push(...up(AFX.bus, 'source').filter(s => s.id > n0 && s.buffer.duration === 0.5)); ctx.advance(0.13); }
  const vr = A.guns.shoot_ak.var, seq = rates.map(s => vr.findIndex(v => Math.abs(v[1] - s.off) < 1e-9)); let rep = 0; for(let i = 1; i < seq.length; i++) if(seq[i] === seq[i - 1]) rep++;   // (each variation has its own start offset)
  ok(seq.length === 40 && rep === 0 && new Set(seq).size === vr.length, '40 rounds of automatic fire: the variation changes every round, all ' + vr.length + ' are used');
  await settle(); ok(clean(), '… and nothing is left of them');
  let tl = 0; for(let i = 0; i < 30; i++){ const n0 = ctx.count; H.afxGun('shoot_minigun', P0.pos, 'p'); tl += up(AFX.bus, 'source').filter(s => s.id > n0 && s.buffer.duration > 0.6).length; ctx.advance(0.045); } const alive = AFX.pool.v.filter(s => s.on).length;
  say(tl >= 6 && tl <= Math.ceil(30 * 0.045 / A.tailGap) + 1 && alive <= V.same * 2, `the rotary gun, 30 rounds in 1.35 s: ${tl} tails (one every ${A.tailGap} s, not one a round), ${alive} voices alive at the end of the burst`); await settle(); }

grp('near and far; ours and theirs; suppressed');
{ const near = { x:6, z:0 }, far = { x:120, z:0 }, K = A.cls.gun; H.afxGun('rifleShot', near, 'e'); const a = up(AFX.bus, 'source'), ga = up(AFX.bus, 'gain').find(g => g.outs.size && [...g.outs].some(o => o.kind === 'biquad' && o.type === 'peaking'));
  ok(a.length === 2 && up(AFX.bus, 'biquad').some(f => f.type === 'peaking' && f.frequency.value === A.who.e.eq[0]), 'an enemy rifle: body and tail, no click of ours, and the peak that sets its tone apart');
  ok(up(AFX.bus, 'panner')[0].pan.value > 0.5, 'to the right of the camera: panned right');
  const lpN = up(AFX.bus, 'biquad').find(f => f.type === 'lowpass').frequency.value, gN = ga.gain.value, tN = Math.min(...a.map(s => s.at)) - ctx.currentTime; await settle();
  H.afxGun('rifleShot', far, 'e'); const b = up(AFX.bus, 'source'), lpF = up(AFX.bus, 'biquad').find(f => f.type === 'lowpass').frequency.value, gF = up(AFX.bus, 'gain').find(g => [...g.outs].some(o => o.kind === 'biquad' && o.type === 'peaking')).gain.value, tF = Math.min(...b.map(s => s.at)) - ctx.currentTime;
  say(lpF < lpN * 0.2 && gF < gN * 0.25 && Math.abs(tF - K.cap) < 1e-9 && tN < 0.03, `the same rifle at 6 and at 120 units: ${lpN.toFixed(0)} → ${lpF.toFixed(0)} Hz, level × ${(gF / gN).toFixed(2)}, ${(tN * 1000).toFixed(0)} → ${(tF * 1000).toFixed(0)} ms late`);
  const tailG = s => [...s.outs][0].gain.value, tl = b.find(s => s.buffer.duration > 0.6); ok(tl && tailG(tl) > A.guns.rifleShot.tail.g * A.who.e.tailK * 0.95, 'far off its tail is at full weight'); await settle();
  H.afxGun('rifleShot', near, 'ally'); const al = up(AFX.bus, 'source'), bodyRate = s => { const b = s.find(x => x.buffer.duration === 0.5); return b.playbackRate.value / A.vars.find(v => Math.abs(v[1] - b.off) < 1e-9)[0]; /* the variation's own rate taken out */ }; const rAlly = bodyRate(al); await settle(); H.afxGun('rifleShot', near, 'e'); const rFoe = bodyRate(up(AFX.bus, 'source')); await settle();
  ok(rFoe < rAlly * 0.93 && al.length === 3, 'the same rifle in an enemy\'s hands plays lower than in a mate\'s (and a mate\'s has its click)');
  H.afxGun('shoot_m4s', P0.pos, 'p'); const sp = up(AFX.bus, 'source'), sendG = up(AFX.send, 'gain').find(g => g.outs.has(AFX.send)).gain.value; ok(sp.length === 2 && sendG < A.cls.gun.tail[0] * 0.3, 'the suppressed M4: body and bolt, no tail, hardly any reverb'); await settle();
  ok(clean(), 'all of it gone again'); }

grp('a wall between');
{ T.clear = (x, z) => !(x > 30); T.lines = 0; let now = 100, maxLines = 0; const src = { x:50, z:0 }; H.updateAfx(0.016, now);
  H.afxGun('rifleShot', src, 'e'); const g = up(AFX.bus, 'gain').find(n => [...n.outs].some(o => o.kind === 'biquad' && o.type === 'peaking')), lp = up(AFX.bus, 'biquad').find(f => f.type === 'lowpass'), g0 = g.gain.value, lp0 = lp.frequency.value;
  for(let i = 0; i < 30; i++){ now += 0.016; const b = T.lines; H.updateAfx(0.016, now); maxLines = Math.max(maxLines, T.lines - b); ctx.advance(0.016); }
  say(Math.abs(g.gain.target - g0 * A.occl.gain) < g0 * 0.06 && lp.frequency.target <= A.occl.lp * 1.15 && lp.frequency.target < lp0, `while it plays a wall is found between: its level glides to × ${(g.gain.target / g0).toFixed(2)} and its low-pass from ${lp0.toFixed(0)} to ${lp.frequency.target.toFixed(0)} Hz`);
  await settle(1); H.updateAfx(0.016, now += 0.016); H.afxGun('rifleShot', src, 'e'); const g2 = up(AFX.bus, 'gain').find(n => [...n.outs].some(o => o.kind === 'biquad' && o.type === 'peaking'));
  ok(Math.abs(g2.gain.value - g0 * A.occl.gain) < g0 * 0.2, 'the next shot from behind the wall starts muffled');
  for(let k = 0; k < 40; k++){ H.afxGun('rifleShot', { x:40 + k * 5, z:(k % 5) * 9 }, 'e'); } for(let i = 0; i < 20; i++){ now += 0.016; const b = T.lines; H.updateAfx(0.016, now); maxLines = Math.max(maxLines, T.lines - b); }
  say(maxLines <= A.occl.perFrame && maxLines > 0, `40 emitters at once: never more than ${maxLines} line checks in a frame (budget ${A.occl.perFrame})`); T.clear = () => true; await settle(); }

grp('the cap under a volley; what must be heard gets in');
{ let now = 200; H.updateAfx(0.016, now); for(let k = 0; k < 80; k++) H.afxGun('rifleShot', { x:10 + (k % 10) * 7, z:10 + Math.floor(k / 10) * 7 }, 'e');
  const on = AFX.pool.v.filter(s => s.on).length, fam = AFX.pool.v.filter(s => s.on && s.key === 'rifleShot').length; ok(fam === V.family && on <= V.family + 1, `80 enemy rifles in one instant: ${fam} voices (the family's cap), the pool keeps room for the rest`);
  for(let k = 0; k < 48; k++){ H.afxImpact(['stone', 'dirt', 'wood', 'metal', 'sand', 'water'][k % 6], 4 + (k % 12) * 3, 3, 1); ctx.advance(0.006); } ok(AFX.pool.v.filter(s => s.on).length === V.max, 'and a burst of strikes on top (each material at most once every ' + A.impact.gap * 1000 + ' ms): the pool is full');
  const before = AFX.pool.stolen; ok(H.afxGun('shoot_ak', P0.pos, 'p') === true && AFX.pool.stolen > before && AFX.pool.v.some(s => s.on && s.key === 'own:shoot_ak'), 'his own gun is still heard: it steals an enemy\'s voice');
  H.afxBrass(1, 1); ok(!AFX.pool.v.some(s => s.on && s.cls === 'foley'), 'a falling case is not: dropped');
  ok(H.afxIncoming({ x:1.5, z:0.5, vx:0, vz:70, ox:1.5, oz:-60 }, P0, false) === true && AFX.pool.v.some(s => s.on && s.key === 'crack') && AFX.pool.v.some(s => s.on && s.key === 'thump'), 'a round cracking past and its thump both get in');
  ok(AFX.pool.v.filter(s => s.on).length <= V.max, 'never more than the cap'); await settle(); ok(clean(), 'after the volley (stolen voices and all) nothing is left connected'); }

grp('incoming, blasts, impacts, brass');
{ const C = A.crack, t = ctx.currentTime; H.afxIncoming({ x:1.2, z:0.4, vx:0, vz:70, ox:1.2, oz:-80 }, P0, false); const cr = up(AFX.hi, 'source'), th = up(AFX.bus, 'source');
  say(cr.length === 1 && cr[0].at === t && cr[0].buffer.duration < 0.06 && th.length === 1 && Math.abs(th[0].at - t - M.afxCrackGap(Math.hypot(1.2, 80), C, U, CS)) < 1e-9 && th[0].at - t >= C.gap[0], `a round passes 1.2 units off, fired from 80: the crack at once on the bus nothing ducks, the thump ${((th[0].at - t) * 1000).toFixed(0)} ms after it, low-passed at ${up(AFX.bus, 'biquad')[0].frequency.value} Hz`);
  await settle(); H.afxIncoming({ x:1, z:0, vx:0, vz:70, ox:1, oz:-5 }, P0, false); ok(up(AFX.hi, 'source').length === 1 && up(AFX.bus, 'source').length === 0, 'from a shooter a few steps off: the crack alone (his shot is right there)'); await settle();
  H.LOUD.big = 0; ok(H.afxSfx('explode', { x:8, z:0 }) === true && up(AFX.hi, 'source').length === 2 && H.LOUD.big > 0, 'a blast near: the layer plays it (body + rumble) on the bus nothing ducks, and the ambience hears of it');
  ok(H.duck.gain.ev.some(e => e[0] === 'target' && e[1] === A.blast.duck[0]) && AFX.bus.gain.ev.some(e => e[0] === 'target' && e[1] === A.blast.duck[0]) && AFX.bus.gain.target === 1, '… the small arms dip under it and come back');
  await settle(); AFX.bus.gain.ev.length = 0; H.afxSfx('bigexplode', { x:400, z:0 }); const fb = up(AFX.bus, 'source'); ok(fb.length === 2 && Math.abs(Math.min(...fb.map(s => s.at)) - ctx.currentTime - A.cls.big.cap) < 1e-9 && AFX.bus.gain.ev.length === 0, 'a blast far off: late by the cap, on the world bus, no ducking'); await settle();
  T.wade = () => 1; let kinds = 0; for(const m of ['dirt', 'sand', 'stone', 'metal', 'wood', 'water']){ H.afxImpact(m, 5, 5, 1); if(up(AFX.bus, 'source').length >= 1) kinds++; await settle(1); } ok(kinds === 6 && Object.keys(AFX.bufs).filter(k => k.startsWith('imp:')).length === 6, 'a strike on each of the six materials is played from its own rendered sound');
  H.afxImpact('stone', 500, 0, 1); ok(up(AFX.bus, 'source').length === 0, 'a strike past impact.R is not played at all');
  H.updateAfx(0.016, 300); H.afxBrass(1, 1); const b1 = Object.keys(AFX.bufs).filter(k => k.startsWith('brass:')); H.afxBrass(1, 1); ok(b1.length === 1 && b1[0] === 'brass:sand' && up(AFX.bus, 'source').length === 1, 'a case lands on the desert\'s sand: its soft thup — and a second one inside `gap` is not played');
  T.wade = () => 0.4; H.updateAfx(0.016, 301); H.afxBrass(1, 1); T.paved = () => true; T.wade = () => 1; H.updateAfx(0.016, 302); H.afxBrass(1, 1); ok(AFX.bufs['brass:water'] && AFX.bufs['brass:rock'], 'in the shallows it plips, on a paved yard it rings'); T.paved = () => false;
  ok(H.afxSfx('reload', null) === true && H.afxSfx('click', null) === false && H.afxSfx('magIn', null) === false, 'the reload\'s clack goes through the layer; the interface\'s clicks and the reload\'s synthesised ticks stay in synth.js (on the layer\'s bus: afxBus)');
  await settle(); ok(clean(), 'all ended: nothing connected, every slot free'); }

grp('the mixer wired in and out; the music under fire and by the director');
{ const X = H.AFXX, D = A.duck, Mu = A.music, DIR = H.DIR; let now = 600; const run = (sec, f) => { for(let i = 0; i < sec / 0.016; i++){ now += 0.016; if(f) f(i); H.updateAfx(0.016, now); ctx.advance(0.016); H.LOUD.shot = H.LOUD.big = 0; } };   // (audio/ambience.js clears LOUD after the layer each frame)
  run(0.5); ok(X.built && X.wired && !X.fail && [...H.limiter.outs][0] === X.dLp && [...X.clip.outs][0] === ctx.destination && [...AFX.bus.outs][0] === X.world && [...X.world.outs][0] === H.master && [...H.musicBus.outs][0] === X.mLp && [...X.mDuck.outs][0] === H.master, 'on: limiter → deafened low-pass → soft limiter → out · world bus → its dip → master · music → low-pass → duck → master');
  ok(X.clip.curve.length === A.limit.n && X.pre.gain.value === 1 / A.limit.head && X.dLp.frequency.value === A.deaf.lp[0], 'the limiter\'s table is in, the deafened low-pass stands open');
  H.PROFILE.realAudio = false; H.updateAfx(0.016, now += 0.016); ok(!X.wired && [...H.limiter.outs][0] === ctx.destination && H.limiter.outs.size === 1 && X.clip.outs.size === 0 && [...H.musicBus.outs][0] === H.master && X.mDuck.outs.size === 0, 'switched off in the settings: at the next frame the limiter goes straight out and the music straight to the master, as before');
  H.PROFILE.realAudio = true; H.updateAfx(0.016, now += 0.016); ok(X.wired && [...H.limiter.outs][0] === X.dLp && [...H.musicBus.outs][0] === X.mLp, '… and back on: wired in again');
  DIR.on = true; DIR.phase = 'build'; DIR.P = 0; run(1); const calm = X.mDuck.gain.target; run(1.5, i => { if(i % 6 === 0) H.afxGun('shoot_ak', P0.pos, 'p'); }); const hot = X.mDuck.gain.target, heat = X.heat; run(5); const after = X.mDuck.gain.target;
  say(calm > 0.95 && hot < calm * (1 - D.gun * 0.4) && hot >= D.min && heat > 0.4 && after > 0.95, `1.5 s of his AK: the music dips to × ${hot.toFixed(2)} (heat ${heat.toFixed(2)}), back to × ${after.toFixed(2)} five quiet seconds later`);
  H.VOICE.playing = 'arty'; run(0.3); ok(X.world.gain.target === D.worldSpeech, 'a radio line is spoken: the fight dips to × ' + D.worldSpeech); H.VOICE.playing = null; run(0.3); ok(X.world.gain.target === 1, '… and comes back');
  DIR.phase = 'peak'; DIR.P = 0.9; run(0.3); const pk = [H.afxMusicHeat(true, false), X.mLp.frequency.target, X.mDuck.gain.target]; DIR.phase = 'release'; run(0.3); const lu = [H.afxMusicHeat(true, false), X.mLp.frequency.target, X.mDuck.gain.target];
  DIR.phase = 'finale'; DIR.fin = now + 20; run(0.3); const he = [H.afxMusicHeat(true, false), X.mLp.frequency.target, X.mDuck.gain.target]; T.duel = true; DIR.fin = -1; run(0.3); const du = [H.afxMusicHeat(true, true), X.mLp.frequency.target];
  say(pk[0] === 1 && pk[1] === Mu.peak.lp && lu[0] === Mu.lull.heat && lu[1] === Mu.lull.lp && Math.abs(lu[2] - Mu.lull.gain) < 0.02 && he[0] === 0 && he[1] === Mu.held.lp && Math.abs(he[2] - Mu.held.gain) < 0.02 && du[0] === 1 && du[1] === Mu.duel.lp,
    `the director's phase → the score: peak heat ${pk[0]} / ${pk[1]} Hz · lull ${lu[0]} / ${lu[1]} Hz × ${lu[2].toFixed(2)} · the held breath ${he[0]} / ${he[1]} Hz × ${he[2].toFixed(2)} · the duel ${du[0]}`); T.duel = false; DIR.fin = 0;
  DIR.on = false; ok(H.afxMusicHeat(true, false) === -1 && H.afxMusicHeat(false, false) === -1, 'the director off (or no battle): audio/music.js decides as before'); run(0.3); ok(X.mLp.frequency.target === Mu.open, '… and the score is left open'); DIR.on = true; DIR.phase = 'build'; DIR.P = 0; run(0.3); await settle(); }

grp('a blast close by: the deafened moment, and its switch');
{ const X = H.AFXX, C = A.deaf; let now = 700; H.updateAfx(0.016, now); const o0 = ctx.made.osc || 0, t = ctx.currentTime, k = M.afxDeaf(2, 1, C); X.dLp.frequency.ev.length = 0;
  H.afxSfx('explode', { x:2, z:0 }); const ev = X.dLp.frequency.ev.filter(e => e[0] === 'target'), ring = [...X.pre.ins].find(n => n !== X.dLp);
  say(ev.length === 2 && Math.abs(ev[0][1] - M.afxDeafLp(k, C)) < 1e-6 && ev[1][1] === C.lp[0] && ev[1][2] > ev[0][2] + C.hold[0] && ctx.made.osc === o0 + 2 && ring && ring.gain.ev.some(e => e[0] === 'lin' && e[1] > 0 && e[1] <= C.ring) && X.deafs === 1, `a grenade 2 units off: everything low-passed to ${ev[0] ? ev[0][1].toFixed(0) : '?'} Hz, open again from ${ev[1] ? (ev[1][2] - t).toFixed(2) : '?'} s; a ringing at level ${ring ? ring.gain.ev.find(e => e[0] === 'lin')[1].toFixed(4) : '?'} after the limiter's low-pass`);
  ok(X.blast > 0.4, 'and the music dips under it'); ctx.advance(0.3); H.afxSfx('explode', { x:2.5, z:0 }); ok(ctx.made.osc === o0 + 2 && X.deafs === 2, 'a second blast while his ears ring: deaf again, no second ringing on top');
  await settle(9); ok(X.pre.ins.size === 1 && ctx.srcs.length === 0, 'the ringing has ended: its oscillators are stopped and off the graph');
  H.PROFILE.tinnitus = false; X.dLp.frequency.ev.length = 0; H.afxSfx('explode', { x:2, z:0 }); ok(X.dLp.frequency.ev.length === 0 && ctx.made.osc === o0 + 2 && X.pre.ins.size === 1 && up(AFX.hi, 'source').length === 2, '"Ù tai khi nổ gần" off: the same blast is played, nothing is low-passed, nothing rings'); H.PROFILE.tinnitus = true; await settle();
  X.dLp.frequency.ev.length = 0; X.blast = 0; H.afxSfx('explode', { x:20, z:0 }); ok(X.dLp.frequency.ev.length === 0 && X.blast >= A.duck.near, 'a blast 20 units off: no deafness — the music still dips'); await settle();
  X.blast = 0; H.afxSfx('bigexplode', null); ok(X.dLp.frequency.ev.length === 0, 'a blast with no place (a menu preview): never deafening'); await settle(); ok(clean(), 'nothing left connected'); }

grp('the squad calls out: text over the man and a radio click');
{ const X = H.AFXX, B = A.barks, DIR = H.DIR, hung = { role:'mg', name:'Hùng', a:{ pos:{ x:2, z:1 } }, dead:false }, tam = { role:'rifle', name:'Tám', a:{ pos:{ x:-3, z:2 } }, dead:false }; let now = 800; H.FT.push(hung.a, tam.a); T.squad = [hung, tam]; T.floats.length = 0; H.radio.at = -1e9;
  const tick = n => { for(let i = 0; i < n; i++){ now += 0.05; H.updateAfx(0.05, now); ctx.advance(0.05); } }; P0.guns = [{ id:'carbine', rU:0 }]; P0.gunIdx = 0; DIR.near = 2; tick(8);
  ok(T.floats.length === 0, 'nothing to call: silence'); P0.guns[0].rU = now + 2; tick(8);
  say(T.floats.length === 1 && /^(HÙNG|TÁM): /.test(T.floats[0]) && B.lines.reload.includes(T.floats[0].replace(/^[^:]+: /, '')) && AFX.bufs.squelch && X.said === 1, `he reloads with the enemy near → "${T.floats[0]}" over the nearest mate, and a radio click at his place`);
  ok(T.floats[0].startsWith('HÙNG') && T.floatAt.x === 2 && T.floatAt.y === B.h, 'the nearest mate says it, by the cast\'s tag (STORY.cast)'); P0.guns[0].rU = 0; tick(4); P0.guns[0].rU = now + 2; tick(8); ok(T.floats.length === 1, 'reloading again inside its cooldown: not said twice');
  now += B.gap; H.updateAfx(0.05, now); ok(H.afxBark('kill', -3, 3) === true && T.floats.length === 2 && T.floats[1].startsWith('TÁM') && B.lines.kill.includes(T.floats[1].slice(5)), 'a target down near Tám: he calls it'); ok(H.afxBark('kill', -3, 3) === false && H.afxBark('nade', 4, 1) === false, 'no second call inside the gap');
  now += B.gap + 1; H.updateAfx(0.05, now); H.radio.at = now; ok(H.afxBark('nade', 4, 1) === false, 'the radio has just spoken: the squad waits'); H.radio.at = -1e9;
  H.NADES.push({ side:'e', x0:4, z0:1 }, { side:'p', x0:4, z0:1 }); tick(6); ok(T.floats.length === 3 && B.lines.nade.includes(T.floats[2].replace(/^[^:]+: /, '')) && H.NADES[1]._bk && !H.NADES[0]._bk, 'a grenade of ours leaves a hand: called once (the enemy\'s is the old "LỰU ĐẠN! TẢN RA!")'); H.NADES.length = 0;
  now += B.gap + B.cd.flank; DIR.flank = { side:'left', n:4 }; tick(6); ok(T.floats.length === 4 && /trái/i.test(T.floats[3]), 'the director sends men round his left: "' + T.floats[3] + '"'); tick(20); ok(T.floats.length === 4, 'the same flank is called once');
  now += B.gap + 1; hung.dead = true; H.FT.splice(H.FT.indexOf(hung.a), 1); hung.a = null; tick(6); ok(T.floats.length === 5 && T.floats[4].startsWith('TÁM') && T.floats[4].includes('Hùng'), 'Hùng falls: the mate left names him — "' + T.floats[4] + '"');
  now += 60; tam.dead = true; tick(6); ok(T.floats.length === 5 && H.afxBark('kill', 0, 0) === false, 'nobody left standing: nobody calls');
  tam.dead = false; now += 60; H.updateAfx(0.05, now); H.S.mode = 'paused'; ok(H.afxBark('kill', -3, 2) === false, 'not while the game is paused'); H.S.mode = 'playing'; H.PROFILE.realAudio = false; ok(H.afxBark('kill', -3, 2) === false, 'not with the layer off'); H.PROFILE.realAudio = true; H.updateAfx(0.05, now += 0.05);
  B.on = false; ok(H.afxBark('kill', -3, 2) === false, 'AUDIOFX.barks.on:false: none'); B.on = true; H.FT.length = 0; T.squad = []; DIR.flank = null; DIR.near = 0; await settle(); ok(clean(), 'nothing left connected'); report.barks = X.said; }

report.nodesMade = ctx.count; report.pass = pass; report.fail = fail;
console.log((fail ? '✗ FAIL' : '✓ PASS') + ` — audio-test: ${pass} checks passed, ${fail} failed` + ` · ${ctx.count} fake nodes built and released`);
if(process.argv.includes('--json')) console.log(JSON.stringify(report));
process.exit(fail ? 1 : 0);
