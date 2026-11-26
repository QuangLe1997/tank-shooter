// audio/afx.js — AUDIO 1 THE BATTLE'S SOUND LAYER over audio/synth.js: every world sound becomes a VOICE with a place — level, low-pass and delay by distance and by its class, muffled behind a wall (one throttled line check per sounding cell), a fixed pool with priorities — and the guns are built in layers (the recording, the action's click, a tail) with round-robin variations; an enemy round that passes the ear cracks, the shot's thump after it
//   OFF (Cài đặt → Âm thanh → "Âm thanh chân thực", ?oldaudio, AUDIOFX.on) nothing here runs: sfx() plays exactly what it played before.
//   The numbers are config AUDIOFX; the maths (and its tests, tools/audio-test.mjs) is audio/afx-math.js. Nothing is built before the first gesture
//   (audio() makes the context), nothing throws without one, every node is disconnected when its sound ends.
import { AUDIOFX } from '../../config.js';
import { BIOME, LOUD, MOBILE, PROFILE, RIVER, S, SND, actx, afxBrassBuf, afxClamp, afxClickBuf, afxCrackBuf, afxCrackGain, afxCrackGap, afxDelay, afxDensity, afxGain, afxImpactBuf, afxLowpass, afxMiss, afxNear, afxOcclGain, afxOcclGet, afxOcclLp, afxOcclMake, afxOcclTick, afxPoolAsk, afxPoolFree, afxPoolMake, afxPoolTake, afxRR, afxRng, afxSurface, afxTail, afxTailBuf, audio, bankGet, camera, duck, heightAt, lineClear, master, muted, onPaved, sampleGet, sfx, verbSend, wadeAt } from '../hub.js';

const A = AUDIOFX, OLD = typeof location !== 'undefined' && /[?&#]oldaudio\b/.test(location.search + location.hash);
// what the layer has built and done (dev/probes read it): bus = the world (dips under a close blast) · hi = what must be heard (never ducked) · send = to the space's reverb
export const AFX = { ready:false, bus:null, hi:null, send:null, slap:null, pool:null, occl:null, rnd:null, bufs:{}, rr:{ p:{}, ally:{}, e:{}, x:{} }, now:0, lx:0, ly:0, lz:0,
  stats:{ played:0, cracks:0, checks:0, peak:0 } };
export function afxOn(){ return !!A.on && !OLD && !(PROFILE && PROFILE.realAudio === false); }
// the graph's fixed part, once, after the context exists
function build(){ const a = actx; if(AFX.ready) return true; if(!a || !master) return false;
  try{ const bus = a.createGain(), hi = a.createGain(), send = a.createGain(); bus.connect(master); hi.connect(master); if(verbSend) send.connect(verbSend);
    AFX.bus = bus; AFX.hi = hi; AFX.send = send; AFX.rnd = afxRng(A.seed); AFX.pool = afxPoolMake(MOBILE ? A.voices.phone : A.voices.max); AFX.occl = afxOcclMake(A.occl); AFX.ready = true; }
  catch(e){ AFX.ready = false; } return AFX.ready; }
function ready(){ if(!afxOn() || muted) return false; const a = audio(); return !!a && a.state === 'running' && build(); }
// where audio/synth.js sends its own synthesised voices (the reload's ticks, a whoosh …) while the layer is on: the same world bus and the same space
export function afxBus(){ return AFX.ready && afxOn() ? AFX.bus : null; }
export function afxSend(){ return AFX.ready && afxOn() ? AFX.send : null; }

// ---- the rendered one-shots: A.variants takes of each, built one per call on first use, then round-robin (never the same take twice running) ----
const _keys = new Map();
export function afxKey(a, b){ let m = _keys.get(a); if(!m) _keys.set(a, m = new Map()); let k = m.get(b); if(k === undefined) m.set(b, k = a + ':' + b); return k; }
export function afxBuf(kind, make, p, q){ let L = AFX.bufs[kind]; if(!L) L = AFX.bufs[kind] = { b:[], rr:{ last:-1 } };
  if(L.b.length < A.variants){ const d = make(actx.sampleRate, AFX.rnd, p, q), b = actx.createBuffer(1, d.length, actx.sampleRate); b.copyToChannel(d, 0); L.b.push(b); L.rr.last = L.b.length - 1; return b; }
  return L.b[afxRR(L.rr, L.b.length, Math.random)]; }
const mkCrack = (sr, r) => afxCrackBuf(sr, r), mkClick = (sr, r, f) => afxClickBuf(sr, f, r), mkTail = (sr, r, len, lp) => afxTailBuf(sr, len, lp, r), mkImpact = (sr, r, mat) => afxImpactBuf(sr, mat, r), mkBrass = (sr, r, surf) => afxBrassBuf(sr, surf, r);
function tailBuf(k){ const T = A.tails[k] || A.tails.s; return afxBuf(afxKey('tail', k), mkTail, T.len, T.lp); }

// ---- A VOICE: level → (the enemy's tone) → low-pass (distance, a wall) → pan → the bus + the reverb send (+ the slap-back, AUDIO 2). Its layers are sources into it. ----
const _o = { lpK:1, lp:0, eq:null, hi:false, wetK:1, at:-1, slapK:1, cap:0 }, _v = { t:0, d:0 }, _pos = { x:0, z:0 }, _org = { x:0, z:0 };
function opt(){ _o.lpK = 1; _o.lp = 0; _o.eq = null; _o.hi = false; _o.wetK = 1; _o.at = -1; _o.slapK = 1; _o.cap = 0; return _o; }
function open(pos, cls, prio, key, lvl, o){ const a = actx, K = A.cls[cls] || A.cls.gun, O = A.occl, V = A.voices, p = S.player, t = a.currentTime; let d = 0, pan = 0, rec = null;
  if(pos && p){ const dx = pos.x - p.pos.x, dz = pos.z - p.pos.z; d = Math.hypot(dx, dz);
    if(d > 0.5){ const e = camera.matrixWorld.elements; pan = afxClamp((dx * e[0] + dz * e[2]) / d, -1, 1) * A.pan * Math.min(1, d / A.panD); }   // (the camera's right, on the ground)
    if(d > O.minD && d < O.maxD) rec = afxOcclGet(AFX.occl, pos.x, pos.z, AFX.now); }
  const occ = rec ? rec.occ : 0, g0 = lvl * afxGain(d, K), g = g0 * afxOcclGain(occ, O); let lp0 = afxLowpass(d, K) * o.lpK; if(o.lp && o.lp < lp0) lp0 = o.lp;
  if(!(g >= A.floor)) return null;                                                                                   // too faint to hear (or a NaN): nothing is built
  const q = afxPoolAsk(AFX.pool, t, prio, g, key, pos ? pos.x : 0, pos ? pos.z : 0, !!pos, V, o.cap); if(q.how === 'drop') return null;
  if(q.how === 'merge'){ const n = AFX.pool.v[q.slot].n; if(n && n.out && n.up < V.mergeMax){ n.up *= V.mergeUp; try{ n.out.gain.setTargetAtTime(n.g0 * afxOcclGain(n.occ, O) * n.up, t, 0.005); }catch(e){} } return null; }   // the same sound, the same place, the same instant: one voice, a little louder
  if(q.how === 'steal') kill(AFX.pool.v[q.slot], t);
  const s = afxPoolTake(AFX.pool, q.slot, t, prio, g, 0.05, key, cls, pos ? pos.x : 0, pos ? pos.z : 0, !!pos);
  const N = s.n || (s.n = { out:null, eq:null, lpf:null, pn:null, snd:null, slp:null, end:null, srcs:[], left:0, g0:0, lp0:0, up:1, occ:0, rec:null });
  N.srcs.length = 0; N.left = 0; N.g0 = g0; N.lp0 = lp0; N.up = 1; N.occ = occ; N.rec = rec; N.eq = N.lpf = N.pn = N.slp = null;
  let node = N.out = a.createGain(); N.out.gain.value = g;
  if(o.eq){ const f = N.eq = a.createBiquadFilter(); f.type = 'peaking'; f.frequency.value = o.eq[0]; f.Q.value = o.eq[1]; f.gain.value = o.eq[2]; node.connect(f); node = f; }
  if(pos || o.lp){ const f = N.lpf = a.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.5; f.frequency.value = afxOcclLp(lp0, occ, O); node.connect(f); node = f; }
  if(pos && pan !== 0 && a.createStereoPanner){ const f = N.pn = a.createStereoPanner(); f.pan.value = pan; node.connect(f); node = f; }
  N.end = node; node.connect(o.hi ? AFX.hi : AFX.bus);
  const sn = N.snd = a.createGain(); sn.gain.value = afxTail(d, K) * o.wetK * (1 - occ * (1 - O.wetK)); node.connect(sn); sn.connect(AFX.send);
  if(AFX.slap && o.slapK > 0 && K.slap){ const sl = N.slp = a.createGain(); sl.gain.value = K.slap * o.slapK * afxNear(d, K); node.connect(sl); sl.connect(AFX.slap); }   // AUDIO 2 the shot off the walls near the listener
  _v.d = d; _v.t = t + (o.at >= 0 ? o.at : afxDelay(d, K, A.unit, A.c)); AFX.stats.played++; return s; }
// one layer of a voice: a buffer at its own level, rate and start offset, from time `at`
function layer(s, b, g, rate, off, at){ const a = actx, N = s.n, id = s.id, src = a.createBufferSource(), gn = a.createGain(); src.buffer = b; src.playbackRate.value = rate; gn.gain.value = g; src.connect(gn); gn.connect(N.out);
  const o = Math.min(Math.max(0, off || 0), Math.max(0, b.duration - 0.02)), end = at + (b.duration - o) / rate + A.voices.hold; if(end > s.end) s.end = end; N.left++; N.srcs.push(src);
  src.onended = () => { try{ src.disconnect(); gn.disconnect(); }catch(e){} if(s.id === id && --N.left <= 0) close(s, id); };
  src.start(at, o); }
// its last layer has ended: every node off the graph, the slot free
function close(s, id){ if(s.id !== id) return; const N = s.n; if(N && N.out){ for(const n of [N.out, N.eq, N.lpf, N.pn, N.snd, N.slp]) if(n){ try{ n.disconnect(); }catch(e){} } N.out = N.eq = N.lpf = N.pn = N.snd = N.slp = N.end = null; N.rec = null; N.srcs.length = 0; }
  afxPoolFree(AFX.pool, s.i, id); }
// a voice is stolen: a few ms of fade, its sources stopped, its nodes off the graph a moment later
function kill(s, t){ const N = s.n; s.on = false; if(!N || !N.out) return; const nodes = [N.out, N.eq, N.lpf, N.pn, N.snd, N.slp], srcs = N.srcs.slice(), F = A.voices.fade;
  try{ N.out.gain.cancelScheduledValues(t); N.out.gain.setTargetAtTime(0, t, F / 3); }catch(e){}
  for(const src of srcs){ src.onended = null; try{ src.stop(t + F * 2); }catch(e){} }
  setTimeout(() => { for(const n of nodes) if(n){ try{ n.disconnect(); }catch(e){} } for(const n of srcs){ try{ n.disconnect(); }catch(e){} } }, 150);
  N.out = N.eq = N.lpf = N.pn = N.snd = N.slp = N.end = null; N.rec = null; N.srcs.length = 0; N.left = 0; }

// ---- GUNS: a family per sfx name (AUDIOFX.guns) — the recording as the body, the action's click near, a tail that grows with distance; who = 'p' | 'ally' | 'e' ----
export function afxGun(name, pos, who, vol){ const F = A.guns[name]; if(!F || !ready()) return false; const D = SND[F.key]; if(!D) return false;
  const body = sampleGet(D.sample || F.key) || (D.sampleOnly ? null : bankGet(F.key)); if(!body) return false;      // (not decoded / rendered yet: the old path has the same answer)
  const p = S.player, W = A.who[who] || A.who.x, P = A.prio, V = A.voices, cls = F.cls || 'gun', K = A.cls[cls], own = who === 'p';
  const d = own || !pos || !p ? 0 : Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z), nw = afxNear(d, K), J = A.jit, RR = AFX.rr[who] || AFX.rr.x, st = RR[name] || (RR[name] = { last:-1, t:-9, n:0, tailAt:-9 }), now = actx.currentTime;
  const vr = F.var || A.vars, v = vr[afxRR(st, vr.length, Math.random)];                                             // [rate, start offset s, low-pass ×]: never the same one twice running
  const rate = (D.rate || 1) * v[0] * W.rate * (1 - J.rate + Math.random() * 2 * J.rate), dens = own ? 1 : afxDensity(st, now, A.dens);                              // (several of them in one instant: each quieter — a volley is wide, not loud)
  const lvl = D.g * (F.g || 1) * W.g * dens * (vol == null ? 1 : afxClamp(vol, 0.15, 1.6)) * (1 - J.gain + Math.random() * 2 * J.gain), src = own ? p && p.pos : pos;
  const o = opt(); o.lpK = v[2] * W.lpK; o.eq = W.eq || null; o.wetK = W.tailK * (F.supp ? A.supp.wet : 1); o.slapK = F.supp ? A.supp.slap : 1; o.cap = own ? V.same : V.family;
  const s = open(src, cls, own ? P.own : d > A.farD ? P.far : P[W.prio] ?? P.enemy, own ? afxKey('own', name) : name, lvl, o); if(!s) return true;   // (his own gun's voices are counted apart from the same rifle in other hands)
  const t0 = _v.t, M = F.mech, T = F.tail; layer(s, body, 1, rate, v[1], t0); LOUD[D.big ? 'big' : 'shot'] += s.lvl;
  if(MOBILE) return true;                                                                                            // (a phone plays the body alone)
  if(M && W.mech > 0 && nw > 0.05) layer(s, afxBuf(afxKey('click', M.f), mkClick, M.f), M.g * W.mech * nw / Math.max(0.05, lvl), 0.96 + Math.random() * 0.08, 0, t0 + M.at);
  if(T && now - st.tailAt >= A.tailGap){ st.tailAt = now; const o2 = opt(); o2.lpK = W.lpK; o2.wetK = W.tailK * A.tailWet; o2.at = t0 - now + 0.015;      // the tail is its own voice, low in the queue: one per family every tailGap s — a burst rolls away once, not once a round
    const s2 = open(src, cls, P.far, afxKey('tail', name), lvl * T.g * W.tailK * (A.tailNear + (1 - A.tailNear) * (1 - nw)), o2); if(s2) layer(s2, tailBuf(T.k), 1, 0.9 + Math.random() * 0.2, 0, _v.t); }
  return true; }
// the call for a shot whose owner is known (combat/soldier-fire.js, actors/infantry.js, actors/fireteam.js); with the layer off it is sfx(name, pos, vol)
let _raw = false;
export function gunSound(name, pos, who, vol){ if(afxOn()){ if(afxGun(name, pos, who || 'e', vol)) return; _raw = true; } try{ sfx(name, pos, vol); } finally { _raw = false; } }

// a bank / recorded one-shot through the layer (an impact, a clang, the reload's clack …)
const _last = {};
function gap(key, D){ const t = actx.currentTime; if(t - (_last[key] ?? -9) < (D.gap || 0)) return true; _last[key] = t; return false; }   // the bank's own rate limit (Z151 levelled each sound as a stream at that rate)
export function afxOne(key, pos, vol, cls, prio, o){ if(!ready()) return false; const D = SND[key]; if(!D) return false; const b = sampleGet(D.sample || key) || (D.sampleOnly ? null : bankGet(key)); if(!b) return false; if(gap(key, D)) return true;
  const s = open(pos, cls, prio, key, D.g * (vol == null ? 1 : afxClamp(vol, 0.15, 1.6)) * (0.9 + Math.random() * 0.2), o || opt()); if(!s) return true;
  layer(s, b, 1, (D.rate || 1) * (0.95 + Math.random() * 0.1), 0, _v.t); LOUD[D.big ? 'big' : 'shot'] += s.lvl; return true; }
// a BLAST: the recording, a long tail the farther it is; near, it goes out on the bus nothing ducks and the small arms dip under it (as Z151 did)
export function afxBlast(M, pos, vol){ if(!ready()) return false; const D = SND[M.key], B = A.blast; if(!D) return false; const b = sampleGet(D.sample || M.key) || bankGet(M.key); if(!b) return false; if(gap(M.key, D)) return true;
  const p = S.player, d = pos && p ? Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z) : 0, near = d < B.nearD, o = opt(); o.hi = near;
  const s = open(pos, 'big', near ? A.prio.blast : A.prio.far, M.key, D.g * (vol == null ? 1 : afxClamp(vol, 0.15, 1.6)) * (0.92 + Math.random() * 0.16), o); if(!s) return true;
  const t0 = _v.t; layer(s, b, 1, (D.rate || 1) * (0.95 + Math.random() * 0.1), 0, t0);
  LOUD.big += s.lvl; if(!MOBILE) layer(s, tailBuf('x'), B.tail * (A.tailNear + (1 - A.tailNear) * (1 - afxNear(d, A.cls.big))), 0.85 + Math.random() * 0.2, 0, t0 + 0.03);
  if(near){ const k = B.duck; for(const g of [duck, AFX.bus]) if(g){ try{ g.gain.cancelScheduledValues(t0); g.gain.setTargetAtTime(k[0], t0, k[1]); g.gain.setTargetAtTime(1, t0 + k[2], k[3]); }catch(e){} } }
  return true; }

// ---- INCOMING: an enemy round has just gone by (fx/hitfx.js nearMiss). The CRACK now, at the round; the THUMP of the shot that sent it, from where it was fired, a moment after ----
export function afxIncoming(b, P, heavy){ if(!ready() || !P) return false; const C = A.crack, m = afxMiss(b.x, b.z, b.vx, b.vz, P.pos.x, P.pos.z), o = opt(); o.hi = true; o.wetK = C.wet; o.slapK = 0; _pos.x = b.x; _pos.z = b.z;
  const s = open(_pos, 'crack', A.prio.incoming, 'crack', C.g * afxCrackGain(m.d, C) * (heavy ? C.heavyK : 1), o);
  if(s){ layer(s, afxBuf('crack', mkCrack), 1, (heavy ? C.heavyRate : 1) * (0.94 + Math.random() * 0.12), 0, _v.t); if(heavy && !MOBILE) layer(s, tailBuf('s'), C.rush, 1.5, 0, _v.t + 0.008); AFX.stats.cracks++; }
  if(b.ox != null){ const D = Math.hypot(b.ox - P.pos.x, b.oz - P.pos.z), k = heavy ? 'enemy' : 'rifleE', G = SND[k], tb = D >= C.thumpMin && G ? sampleGet(G.sample || k) || bankGet(k) : null;
    if(tb){ const o2 = opt(); o2.lp = C.thumpLp; o2.at = afxCrackGap(D, C, A.unit, A.c); o2.wetK = C.thumpWet; _org.x = b.ox; _org.z = b.oz;
      const s2 = open(_org, 'gun', A.prio.squad, 'thump', G.g * C.thump, o2); if(s2) layer(s2, tb, 1, C.thumpRate * (0.95 + Math.random() * 0.1), 0, _v.t); } }
  return true; }

// ---- A ROUND STRIKES (fx/gunfx.js bulletImpact knows the material): its own sound; steel and stone send some rounds whining off ----
export function afxImpact(mat, x, z, k){ if(!ready()) return; const I = A.impact, p = S.player; if(p){ const dx = x - p.pos.x, dz = z - p.pos.z; if(dx * dx + dz * dz > I.R * I.R) return; }
  _pos.x = x; _pos.z = z; const key = afxKey('imp', I.g[mat] != null ? mat : 'dirt'); if(gap(key, I)) return;                                         // (a burst walking across the dirt: I.gap apart)
  const s = open(_pos, 'impact', A.prio.far, key, (I.g[mat] ?? I.g.dirt) * Math.min(1.5, k || 1), opt());
  if(s) layer(s, afxBuf(key, mkImpact, mat), 1, 0.92 + Math.random() * 0.16, 0, _v.t);
  const rc = I.rico[mat]; if(rc && Math.random() < rc) afxOne('ricochet', _pos, I.ricoG, 'impact', A.prio.far); }
// a spent case lands (fx/gunfx.js updateBrass, its first bounce): by the ground it lands on
let _brassAt = -9;
export function afxBrass(x, z){ const B = A.brass; if(AFX.now - _brassAt < B.gap || !ready()) return; _brassAt = AFX.now; _pos.x = x; _pos.z = z;
  const surf = afxSurfaceAt(x, z), key = afxKey('brass', surf), s = open(_pos, 'foley', A.prio.foley, key, B.g * (B.soft.includes(surf) ? B.softK : 1), opt()); if(s) layer(s, afxBuf(key, mkBrass, surf), 1, 0.9 + Math.random() * 0.2, 0, _v.t); }

// ---- the ground at a spot: water in the shallows, a bridge's deck, a paved yard, else the land's own (AUDIOFX.surface) ----
const _sf = { water:false, bridge:'', paved:false };
export function afxSurfaceAt(x, z){ const U = A.surface; _sf.water = wadeAt(x, z) < 1; _sf.bridge = '';
  if(RIVER.on && !_sf.water){ const L = RIVER.bridges; for(let i = 0; i < L.length; i++){ const b = L[i], dx = x - b.x, dz = z - b.z; if(Math.abs(dx * b.ca + dz * b.sa) < b.hl && Math.abs(dz * b.ca - dx * b.sa) < b.hw){ _sf.bridge = U.bridge; break; } } }
  _sf.paved = !_sf.water && !_sf.bridge && onPaved(x, z); return afxSurface(BIOME.name, _sf, U); }

// ---- sfx() asks first (audio/synth.js): true = the layer has played it ----
export function afxSfx(name, pos, vol){ if(_raw) return false; const p = S.player;
  const F = A.guns[name]; if(F) return afxGun(name, pos, p && pos === p.pos ? 'p' : F.foe ? 'e' : 'x', vol);   // (a caller that does not say whose shot it is: the player's own at his spot, else by the family)
  const M = A.map[name]; if(!M) return false; if(M.blast) return afxBlast(M, pos || null, vol);
  return afxOne(M.rico && Math.random() < M.rico ? 'ricochet' : M.key, M.own ? null : pos || null, vol, M.cls || 'impact', M.own ? A.prio.own : A.prio.enemy); }

// ---- once a frame (game/loop.js): the listener, the obstruction budget, the playing voices follow their cell's answer ----
function occCheck(x, z){ return lineClear(AFX.lx, AFX.ly, AFX.lz, x, heightAt(x, z) + A.occl.src, z); }
export function updateAfx(dt, now){ AFX.now = now; if(!AFX.ready || !actx || actx.state !== 'running' || !afxOn()) return; const p = S.player, O = A.occl; if(!p) return;
  AFX.lx = p.pos.x; AFX.lz = p.pos.z; AFX.ly = heightAt(p.pos.x, p.pos.z) + (p.lift || 0) + O.eye;
  const V = AFX.pool.v, t = actx.currentTime;
  for(let i = 0; i < V.length; i++){ const s = V[i], N = s.n; if(!s.on || !N || !N.rec || !N.out) continue; const r = N.rec; r.want = now;   // (a sounding cell stays on the list)
    if(Math.abs(r.occ - N.occ) > O.step){ N.occ = r.occ; try{ N.out.gain.setTargetAtTime(N.g0 * afxOcclGain(r.occ, O) * N.up, t, O.glide); if(N.lpf) N.lpf.frequency.setTargetAtTime(afxOcclLp(N.lp0, r.occ, O), t, O.glide); }catch(e){} } }
  AFX.stats.checks = afxOcclTick(AFX.occl, now, dt, AFX.lx, AFX.lz, MOBILE ? O.perFramePhone : O.perFrame, occCheck); }
