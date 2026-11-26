// audio/afx-math.js — AUDIO 1 the battle sound layer's PURE maths (no AudioContext, no hub, no DOM — it runs in Node: tools/audio-test.mjs): the distance curves and the delay's cap, the obstruction budget, voice priority / stealing / merging, the round-robin, the soft limiter, the spaces' impulse responses, the samples of every synthesised one-shot, the director → music map, the barks' throttle
// Every function takes its tuning as an argument (a slice of config AUDIOFX): nothing is imported, nothing is read from the world.

const TAU = Math.PI * 2, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const afxClamp = clamp;
// a seeded generator (mulberry32) for the rendered one-shots: the same seed, the same sound — and the tests can repeat a run
export function afxRng(seed){ let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- DISTANCE: one model per sound class K = { ref, pow, lp:[open Hz, floor Hz, e-fold units], cap s, tail:[near, per unit, max], near:[full, gone] } ----
export function afxGain(d, K){ return 1 / (1 + Math.pow(Math.max(0, d) / K.ref, K.pow)); }                          // level: 1 at the ear, ½ at ref, falling for ever
export function afxLowpass(d, K){ return Math.max(K.lp[1], K.lp[0] * Math.exp(-Math.max(0, d) / K.lp[2])); }         // the air takes the highs: a far shot is a thump
export function afxDelay(d, K, unit, c){ return Math.min(K.cap, Math.max(0, d) * unit / c); }                        // it arrives late by distance / the speed of sound — capped, so the fight stays readable
export function afxTail(d, K){ return Math.min(K.tail[2], K.tail[0] + Math.max(0, d) * K.tail[1]); }                 // the share sent to the space's reverb: a far shot is mostly its echo
export function afxNear(d, K){ return 1 - clamp((d - K.near[0]) / (K.near[1] - K.near[0]), 0, 1); }                  // weight of the close layers (the action's click, the crack): 1 inside near[0], 0 past near[1]

// ---- INCOMING: a round passing the ear. The miss distance of the line through (bx, bz) along (vx, vz) from the listener; side > 0 = it passes on the +cross side ----
const _miss = { d:0, side:0 };
export function afxMiss(bx, bz, vx, vz, lx, lz){ const L = Math.hypot(vx, vz) || 1, cr = ((lx - bx) * vz - (lz - bz) * vx) / L; _miss.d = Math.abs(cr); _miss.side = cr < 0 ? -1 : 1; return _miss; }
export function afxCrackGain(miss, C){ return clamp(1 - Math.pow(clamp(miss / C.R, 0, 1), C.pow), C.floor, 1); }    // the closer it passes, the harder the snap (never under C.floor once it cracks at all)
// the thump follows the crack: the shot's sound left with the round and comes at the speed of sound, the round at C.v m/s — the gap grows with the shooter's distance (kept inside C.gap)
export function afxCrackGap(D, C, unit, c){ const m = Math.max(0, D) * unit; return clamp(m / c - m / C.v, C.gap[0], C.gap[1]); }

// ---- OBSTRUCTION: the world in cells of C.cell; a cell somebody asked about keeps one answer ("a wall is between"), refreshed C.every s apart, at most `budget`
//   line checks a frame, the cells nearest the listener first. occ eases 0 ↔ 1 over C.tau (the first answer of a cell is taken at once). ----
export function afxOcclMake(C){ return { C, map:new Map(), list:[], free:[], pick:[] }; }
export function afxOcclGet(O, x, z, now){ const c = O.C.cell, k = (Math.floor(x / c) + 2048) * 4096 + (Math.floor(z / c) + 2048); let r = O.map.get(k);
  if(!r){ r = O.free.pop() || { k:0, x:0, z:0, occ:0, blocked:false, known:false, at:-1e9, want:0, d:0 }; r.k = k; r.occ = 0; r.blocked = false; r.known = false; r.at = -1e9; O.map.set(k, r); O.list.push(r); }
  r.x = x; r.z = z; r.want = now; return r; }
export function afxOcclTick(O, now, dt, lx, lz, budget, check){ const C = O.C, L = O.list, P = O.pick, ease = 1 - Math.exp(-dt / C.tau), far2 = C.maxD * C.maxD; P.length = 0;
  for(let i = L.length - 1; i >= 0; i--){ const r = L[i];
    if(now - r.want > C.keep){ O.map.delete(r.k); L[i] = L[L.length - 1]; L.pop(); O.free.push(r); continue; }       // nobody has asked for a while: the cell is forgotten
    const tgt = r.blocked ? 1 : 0; if(r.occ !== tgt){ r.occ += (tgt - r.occ) * ease; if(Math.abs(tgt - r.occ) < 0.01) r.occ = tgt; }
    if(now - r.at < C.every || budget <= 0) continue; const dx = r.x - lx, dz = r.z - lz; r.d = dx * dx + dz * dz; if(r.d > far2) continue;
    let j = P.length; if(j < budget) P.push(r); else if(r.d < P[j - 1].d) P[j - 1] = r; else continue;              // the `budget` nearest, kept sorted (a handful: an insertion)
    for(j = P.length - 1; j > 0 && P[j - 1].d > P[j].d; j--){ const t = P[j - 1]; P[j - 1] = P[j]; P[j] = t; } }
  for(let i = 0; i < P.length; i++){ const r = P[i]; r.blocked = !check(r.x, r.z); r.at = now; if(!r.known){ r.known = true; r.occ = r.blocked ? 1 : 0; } }
  return P.length; }
export function afxOcclGain(occ, C){ return 1 - occ * (1 - C.gain); }                                                // behind a wall: quieter …
export function afxOcclLp(lp, occ, C){ return occ <= 0 ? lp : lp * Math.pow(Math.min(lp, C.lp) / lp, occ); }         // … and muffled (never brighter than the distance already left it)

// ---- VOICES: a fixed pool; a new sound takes a free slot, or merges into the same sound just started at the same place, or steals the quietest voice of the
//   lowest priority (only from a lower priority, or from an equal one that has faded under it), or is dropped. With cap > 0 one sound never holds more than cap
//   voices: past that it takes over its own oldest (automatic fire: the round before last is already under the new one) ----
export function afxPoolMake(max){ const v = []; for(let i = 0; i < max; i++) v.push({ i, on:false, id:0, prio:0, lvl:0, t0:0, end:0, key:'', cls:'', x:0, z:0, pos:false, n:null }); return { v, max, seq:0, free:0, stolen:0, dropped:0, merged:0 }; }
export function afxVoiceLevel(s, now, tau){ return s.lvl * Math.exp(-Math.max(0, now - s.t0) / tau); }                // what is left of it by now (a shot is its first instant)
const _ask = { slot:-1, how:'drop' };
export function afxPoolAsk(P, now, prio, lvl, key, x, z, pos, C, cap){ const V = P.v; let free = -1, vic = -1, vp = 1e9, vl = 1e9, same = 0, old = -1;
  for(let i = 0; i < V.length; i++){ const s = V[i]; if(s.on && now >= s.end) s.on = false;
    if(!s.on){ if(free < 0) free = i; continue; }
    if(s.key === key){ same++; if(old < 0 || s.t0 < V[old].t0) old = i; }
    if(s.key === key && now - s.t0 < C.mergeMs / 1000 && s.pos === pos && (!pos || Math.abs(s.x - x) < C.mergeR && Math.abs(s.z - z) < C.mergeR)){ _ask.slot = i; _ask.how = 'merge'; P.merged++; return _ask; }
    const l = afxVoiceLevel(s, now, C.tau); if(s.prio < vp || s.prio === vp && l < vl){ vic = i; vp = s.prio; vl = l; } }
  if(cap > 0 && same >= cap){ _ask.slot = old; _ask.how = 'steal'; P.stolen++; return _ask; }
  if(free >= 0){ _ask.slot = free; _ask.how = 'free'; P.free++; return _ask; }
  if(vic >= 0 && (vp < prio || vp === prio && vl < lvl)){ _ask.slot = vic; _ask.how = 'steal'; P.stolen++; return _ask; }
  _ask.slot = -1; _ask.how = 'drop'; P.dropped++; return _ask; }
export function afxPoolTake(P, i, now, prio, lvl, dur, key, cls, x, z, pos){ const s = P.v[i]; s.on = true; s.id = ++P.seq; s.prio = prio; s.lvl = lvl; s.t0 = now; s.end = now + dur; s.key = key; s.cls = cls; s.x = x; s.z = z; s.pos = pos; return s; }
export function afxPoolFree(P, i, id){ const s = P.v[i]; if(s && s.id === id) s.on = false; }
export function afxPoolCount(P, cls, now){ let n = 0; for(let i = 0; i < P.v.length; i++){ const s = P.v[i]; if(s.on && now < s.end && s.cls === cls) n++; } return n; }

// ---- DENSITY: several of the same sound inside C.win s (a squad's rifles in one instant) each play at 1/√n, never under C.min — the volley is wide, not loud. st = { t, n } ----
export function afxDensity(st, now, C){ if(now - st.t < C.win) st.n++; else { st.t = now; st.n = 1; } return Math.max(C.min, 1 / Math.sqrt(st.n)); }
// ---- ROUND-ROBIN: one of n variations, never the one played last (st = { last }) ----
export function afxRR(st, n, rnd){ if(n <= 1){ st.last = 0; return 0; } let i = Math.floor(rnd() * (st.last >= 0 && st.last < n ? n - 1 : n)); if(st.last >= 0 && st.last < n && i >= st.last) i++; if(i >= n) i = n - 1; st.last = i; return i; }

// ---- THE SOFT LIMITER: straight up to thr, then bent over toward `top` (under 1), which it never passes — a pile of blasts rounds off instead of clipping ----
export function afxSoftClip(x, thr, top){ const a = Math.abs(x); if(a <= thr) return x; const h = (top ?? 1) - thr; return Math.sign(x) * (thr + h * Math.tanh((a - thr) / h)); }
// the WaveShaper's table over the input range ±head (the node before it scales by 1 / head)
export function afxClipCurve(n, thr, top, head){ const c = new Float32Array(n); for(let i = 0; i < n; i++) c[i] = afxSoftClip((i / (n - 1) * 2 - 1) * head, thr, top); return c; }

// ---- THE MIXER: an envelope with its own way up and way down; what dips under what ----
export function afxFollow(cur, tgt, dt, up, down){ return cur + (tgt - cur) * (1 - Math.exp(-dt / (tgt > cur ? up : down))); }
export function afxDuckMusic(heat, speech, C){ return Math.max(C.min, (1 - C.gun * clamp(heat, 0, 1)) * (speech ? C.speech : 1)); }   // the music under gunfire and under the radio
export function afxDuckWorld(speech, blast, C){ return Math.max(C.min, (speech ? C.worldSpeech : 1) * (1 - C.blast * clamp(blast, 0, 1))); }   // the fight under the radio, and under a close blast
// a blast d units off, `size` big (1 a grenade, 2 a big one): how deaf it leaves him, 0 … 1
export function afxDeaf(d, size, C){ if(d >= C.R) return 0; return clamp(Math.pow(1 - Math.max(0, d) / C.R, C.pow) * Math.min(1.25, size / C.ref), 0, 1); }
export function afxDeafLp(k, C){ return C.lp[0] * Math.pow(C.lp[1] / C.lp[0], clamp(k, 0, 1)); }                     // the world through cotton wool: open → C.lp[1] at full strength
export function afxDeafHold(k, C){ return C.hold[0] + (C.hold[1] - C.hold[0]) * clamp(k, 0, 1); }

// ---- THE LISTENER'S SPACE: from the ring of rays (wall distances, Infinity = none), the land round him, a roof ----
export function afxSpaceKind(Q, C){ if(Q.roof) return 'roof'; if(Q.walls >= C.wallN) return 'walls'; if(Q.high >= C.valley.n) return 'valley'; return 'open'; }
// the slap-back of a shot off what stands near: the nearest one or two walls → delay there and back, quieter and duller with distance. out = { n, t:[], g:[], lp:[] }
export function afxSlap(dist, n, C, unit, c, out){ let a = -1, b = -1;
  for(let i = 0; i < n; i++){ const d = dist[i]; if(d >= C.min && d <= C.R && (a < 0 || d < dist[a])) a = i; }
  if(a >= 0) for(let i = 0; i < n; i++){ const d = dist[i]; if(d >= dist[a] + C.apart && d <= C.R && (b < 0 || d < dist[b])) b = i; }   // the second: the nearest wall clearly farther (two walls at one distance are one echo)
  out.n = 0; for(let j = 0; j < 2; j++){ const i = j ? b : a; if(i < 0 || out.n >= C.max) continue; const d = dist[i], k = out.n++, f = 1 - d / C.R;
    out.t[k] = clamp(2 * d * unit / c, C.t[0], C.t[1]); out.g[k] = C.g[Math.min(k, C.g.length - 1)] * (0.35 + 0.65 * f); out.lp[k] = C.lp[1] + (C.lp[0] - C.lp[1]) * f; }
  return out.n; }
// one space's impulse response [left, right]: K = { len, rt (the −60 dB time), pre, lp, damp, build, early:[[t, a]…], echo:[[t, a]…], spread }
export function afxIR(sr, K, rnd){ const n = Math.max(8, Math.round(K.len * sr)), out = [new Float32Array(n), new Float32Array(n)];
  for(let c = 0; c < 2; c++){ const d = out[c]; let l = 0;
    for(let i = Math.max(0, Math.round(K.pre * sr)), a = 1, env = 1, kf = Math.pow(10, -3 / (K.rt * sr)), j = 0; i < n; i++, j++){ const t = j / sr;
      if((j & 63) === 0){ a = 1 - Math.exp(-TAU * Math.max(300, K.lp * Math.exp(-t / K.damp)) / sr); env = Math.pow(10, -3 * t / K.rt); } else env *= kf;   // (the filter and the envelope re-read every 64 samples: cheap)
      l += ((rnd() * 2 - 1) - l) * a; d[i] = l * env * Math.min(1, t / K.build); }                                    // the diffuse tail: darker as it dies, thin at first
    for(const [t, a] of K.early || []){ const k = Math.round((t + c * (K.spread || 0)) * sr); if(k < n) d[k] += a; }  // the first reflections: the ground, the walls
    for(const [t, a] of K.echo || []){ const k0 = Math.round((t + c * (K.spread || 0) * 2) * sr), m = Math.round(0.06 * sr); let e = 0;   // a far face answers: a dull burst
      for(let j = 0; j < m && k0 + j < n; j++){ e += ((rnd() * 2 - 1) - e) * 0.07; d[k0 + j] += e * a * 3 * Math.exp(-j / (0.014 * sr)); } }
    for(let i = Math.max(0, n - Math.round(0.02 * sr)); i < n; i++) d[i] *= (n - 1 - i) / Math.round(0.02 * sr); }   // (the end fades out: no step)
  let m = 1e-9; for(const d of out) for(let i = 0; i < n; i++) m = Math.max(m, Math.abs(d[i])); for(const d of out) for(let i = 0; i < n; i++) d[i] *= 0.9 / m;
  return out; }

// ---- THE GROUND UNDER A FOOT and how he is going ----
export function afxSurface(biome, F, C){ return F.water ? 'water' : F.bridge ? F.bridge : F.paved ? C.paved : C.biome[biome] || C.biome._; }
export function afxGait(stance, v, C){ return stance === 'prone' ? 'crawl' : stance === 'crouch' ? 'crouch' : v >= C.sprintV ? 'sprint' : v >= C.runV ? 'run' : 'walk'; }
export function afxStepCad(v, crawl, C){ return v < C.minV ? 0 : crawl ? C.crawlCad : clamp(C.cad[0] + v * C.cad[1], C.cad[0], C.cad[2]); }   // steps a second for a man going v (the legs' own cadence: SOLDIER_LEGS.stand.cad); crawling: a drag every so often

// ---- MUSIC follows the director: phase build | peak | release | finale, P its pressure, held = the last lull before the general, duel = he is here. out = { heat, lp, gain } ----
export function afxMusic(phase, P, held, duel, C, out){ const M = duel ? C.duel : held ? C.held : phase === 'peak' ? C.peak : phase === 'release' ? C.lull : C.build;
  out.heat = clamp(M.heat + (M.byP || 0) * clamp(P, 0, 1), 0, 1); out.lp = M.lp; out.gain = M.gain; return out; }

// ---- BARKS: one at a time (C.gap apart), each kind on its own clock (C.cd[kind]), not on top of a radio line (C.radio s after it). St = { at, by:{} } ----
export function afxBarkOk(kind, now, radioAt, St, C){ const cd = C.cd[kind]; if(cd == null) return false;
  if(now - St.at < C.gap || now - (St.by[kind] ?? -1e9) < cd || now - radioAt < C.radio) return false; St.at = now; St.by[kind] = now; return true; }

// ===================================================================================================================
// THE SYNTHESISED ONE-SHOTS — rendered once into Float32Arrays (mono), seeded. Nothing recorded is added: what the 53 files do not hold
//   (a crack past the ear, a footstep on six grounds, a case landing, a strike on six materials, the kit, a grunt) is computed here.
// ===================================================================================================================
function lp1(x, fc, sr){ const a = 1 - Math.exp(-TAU * Math.min(fc, sr * 0.45) / sr); let y = 0; for(let i = 0; i < x.length; i++){ y += (x[i] - y) * a; x[i] = y; } return x; }
function hp1(x, fc, sr){ const a = 1 - Math.exp(-TAU * Math.min(fc, sr * 0.45) / sr); let y = 0; for(let i = 0; i < x.length; i++){ y += (x[i] - y) * a; x[i] -= y; } return x; }
function bp2(x, f, q, sr){ const w = TAU * Math.min(f, sr * 0.45) / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al, b0 = al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0; let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for(let i = 0; i < x.length; i++){ const v = x[i], y = b0 * v - b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y; } return x; }
const buf = (sec, sr) => new Float32Array(Math.max(8, Math.round(sec * sr)));
function nz(sec, sr, rnd, env){ const x = buf(sec, sr), n = x.length; for(let i = 0; i < n; i++) x[i] = (rnd() * 2 - 1) * env(i / sr, i / n); return x; }
function add(dst, src, at, g, sr){ const o = Math.round((at || 0) * sr); for(let i = 0; i < src.length && o + i < dst.length; i++) dst[o + i] += src[i] * g; return dst; }
function modal(sec, sr, rnd, f0, ratios, decays, amps, jit){ const x = buf(sec, sr), n = ratios.length, w = [], ph = [];
  for(let k = 0; k < n; k++){ w.push(TAU * f0 * ratios[k] * (1 + (rnd() - 0.5) * (jit || 0.03))); ph.push(rnd() * TAU); }
  for(let i = 0; i < x.length; i++){ const t = i / sr; let v = 0; for(let k = 0; k < n; k++) v += amps[k] * Math.exp(-t / decays[k]) * Math.sin(w[k] * t + ph[k]); x[i] = v; } return x; }
function sweep(sec, sr, f0, f1, tau){ const x = buf(sec, sr); let ph = 0; for(let i = 0; i < x.length; i++){ const t = i / sr, u = i / x.length; ph += TAU * (f0 + (f1 - f0) * u) / sr; x[i] = Math.sin(ph) * Math.exp(-t / tau); } return x; }
function done(x, peak, sr){ let m = 1e-9; for(let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); const k = peak / m, f = Math.min(x.length, Math.round(0.004 * sr));
  for(let i = 0; i < x.length; i++) x[i] *= k; for(let i = 0; i < f; i++) x[x.length - 1 - i] *= i / f; return x; }   // levelled, and its end faded (no click)
const dec = tau => t => Math.exp(-t / tau), atk = (a, tau) => t => t < a ? t / a : Math.exp(-(t - a) / tau);
const PLATE = [1, 2.76, 5.4, 8.93];

// the supersonic CRACK of a round passing the ear: an N-wave under a millisecond long, the snap of the air closing behind it, band-limited (no needle above 7.5 kHz)
export function afxCrackBuf(sr, rnd){ const x = buf(0.05, sr), T = Math.round((0.0006 + rnd() * 0.0003) * sr);
  for(let i = 0; i < T; i++) x[i] = (1 - 2 * i / T) * (i < 2 ? (i + 1) / 3 : 1);
  add(x, hp1(nz(0.02, sr, rnd, dec(0.0035)), 1800, sr), 0, 0.6, sr); add(x, bp2(nz(0.045, sr, rnd, dec(0.012)), 5000, 0.7, sr), 0.001, 0.25, sr);
  return done(lp1(hp1(x, 900, sr), 7500, sr), 0.9, sr); }
// the action working: two small steel clicks (the bolt back … and home)
export function afxClickBuf(sr, f0, rnd){ const x = buf(0.09, sr), D = [0.012, 0.008, 0.006, 0.004], A = [1, 0.6, 0.4, 0.25];
  add(x, modal(0.05, sr, rnd, f0, PLATE, D, A, 0.06), 0, 1, sr); add(x, bp2(nz(0.01, sr, rnd, dec(0.002)), 3000, 1, sr), 0, 0.8, sr);
  add(x, modal(0.045, sr, rnd, f0 * 0.8, PLATE, D, A, 0.06), 0.034 + rnd() * 0.008, 0.7, sr); return done(x, 0.8, sr); }
// the report rolling away over the land: low noise, a slow start, a long fall
export function afxTailBuf(sr, len, lp, rnd){ return done(lp1(lp1(nz(len, sr, rnd, (t, u) => Math.min(1, t / 0.015) * Math.exp(-t / (len / 4)) * (1 - u * u)), lp, sr), lp * 1.6, sr), 0.8, sr); }
// a FOOTSTEP on sand | grass | dirt | rock | snow | water | metal | wood; heavy = a hoof (a thump under it)
export function afxStepBuf(sr, surf, rnd, heavy){ const x = buf(surf === 'water' ? 0.32 : 0.24, sr), thud = (f, tau, g) => add(x, lp1(nz(0.12, sr, rnd, dec(tau)), f, sr), 0, g, sr);
  if(surf === 'sand'){ add(x, bp2(nz(0.2, sr, rnd, atk(0.012, 0.05)), 1700, 0.6, sr), 0, 0.8, sr); thud(180, 0.03, 1.8); }                       // a soft hiss as the foot sinks
  else if(surf === 'grass'){ add(x, bp2(nz(0.15, sr, rnd, atk(0.008, 0.035)), 2600, 0.5, sr), 0, 0.3, sr); thud(150, 0.03, 2.6); }                   // a swish and a soft thud
  else if(surf === 'rock'){ add(x, bp2(nz(0.03, sr, rnd, dec(0.006)), 2800, 2, sr), 0, 1.3, sr);                                                 // a hard tick, then grit scraping under the sole
    add(x, bp2(nz(0.16, sr, rnd, t => Math.exp(-t / 0.045) * (0.6 + 0.4 * Math.sin(TAU * 90 * t))), 1800, 0.7, sr), 0.01, 0.55, sr); thud(250, 0.02, 1.4); }
  else if(surf === 'snow'){ for(let k = 0; k < 9; k++) add(x, bp2(nz(0.008 + rnd() * 0.006, sr, rnd, (t, u) => 1 - u), 500 + rnd() * 900, 1.1, sr), rnd() * 0.11, 0.5 + rnd() * 0.6, sr); thud(300, 0.04, 1.2); }   // the crust giving: a run of tiny cracks
  else if(surf === 'water'){ add(x, bp2(nz(0.28, sr, rnd, atk(0.01, 0.1)), 1600, 0.45, sr), 0, 0.6, sr); add(x, sweep(0.09, sr, 180, 90, 0.03), 0, 0.9, sr);   // a plunge, the splash, drops falling back
    for(let k = 0; k < 4; k++) add(x, sweep(0.014, sr, 900 + rnd() * 900, 700, 0.005), 0.06 + rnd() * 0.18, 0.18, sr); }
  else if(surf === 'metal'){ add(x, modal(0.22, sr, rnd, 520 * (0.9 + rnd() * 0.2), [1, 2.76, 5.4], [0.09, 0.05, 0.03], [1, 0.7, 0.45], 0.04), 0, 0.6, sr);   // the plate rings
    add(x, bp2(nz(0.02, sr, rnd, dec(0.004)), 3200, 1.5, sr), 0, 1.0, sr); thud(220, 0.02, 1.2); }
  else if(surf === 'wood'){ add(x, modal(0.14, sr, rnd, 170 * (0.9 + rnd() * 0.2), [1, 2.3, 3.9], [0.05, 0.03, 0.02], [1, 0.5, 0.25], 0.04), 0, 0.9, sr); thud(260, 0.02, 1.0); }   // a hollow knock
  else { thud(220, 0.035, 2.4); add(x, bp2(nz(0.08, sr, rnd, dec(0.02)), 1500, 0.8, sr), 0, 0.35, sr); }                                          // dirt: a thud and a little grit
  if(heavy){ for(let i = 0; i < x.length; i++) x[i] *= 0.7; add(x, sweep(0.14, sr, 110, 50, 0.05), 0, 0.9, sr); }
  return done(x, 0.8, sr); }
// a round STRIKES dirt | sand | stone | metal | wood | water
export function afxImpactBuf(sr, mat, rnd){ const x = buf(0.3, sr);
  if(mat === 'sand'){ add(x, bp2(nz(0.25, sr, rnd, atk(0.003, 0.07)), 3000, 0.5, sr), 0, 1, sr); add(x, lp1(nz(0.1, sr, rnd, dec(0.03)), 260, sr), 0, 1.2, sr); }
  else if(mat === 'stone'){ add(x, bp2(nz(0.02, sr, rnd, dec(0.004)), 3500, 1.5, sr), 0, 1.4, sr); add(x, lp1(nz(0.1, sr, rnd, dec(0.025)), 400, sr), 0, 1.0, sr);
    for(let k = 0; k < 5; k++) add(x, bp2(nz(0.006 + rnd() * 0.006, sr, rnd, (t, u) => 1 - u), 2500 + rnd() * 3500, 1.5, sr), 0.02 + rnd() * 0.13, 0.5, sr); }   // the chips coming down
  else if(mat === 'metal'){ add(x, modal(0.28, sr, rnd, 500 + rnd() * 300, PLATE, [0.08, 0.045, 0.03, 0.018], [1, 0.7, 0.5, 0.3], 0.04), 0, 0.7, sr); add(x, hp1(nz(0.04, sr, rnd, dec(0.008)), 1800, sr), 0, 0.6, sr); }
  else if(mat === 'wood'){ add(x, modal(0.12, sr, rnd, 240 + rnd() * 80, [1, 2.1, 3.3], [0.035, 0.02, 0.012], [1, 0.6, 0.3], 0.04), 0, 1, sr); add(x, bp2(nz(0.06, sr, rnd, dec(0.02)), 1800, 0.8, sr), 0, 0.5, sr); }
  else if(mat === 'water'){ add(x, sweep(0.1, sr, 240 + rnd() * 40, 110, 0.035), 0, 1.0, sr); add(x, bp2(nz(0.22, sr, rnd, atk(0.008, 0.08)), 2000, 0.45, sr), 0, 0.5, sr); }
  else { add(x, lp1(nz(0.12, sr, rnd, dec(0.03)), 300, sr), 0, 2.6, sr); add(x, bp2(nz(0.2, sr, rnd, dec(0.05)), 1400, 0.5, sr), 0, 0.22, sr); }   // dirt: a thump and the grit thrown
  return done(x, 0.8, sr); }
// a spent CASE landing: it rings and skips on a hard ground, thups into a soft one, plips into water
export function afxBrassBuf(sr, surf, rnd){ const x = buf(0.36, sr), F = [3100, 4750, 7200];
  if(surf === 'water') add(x, sweep(0.03, sr, 1300 + rnd() * 300, 900, 0.01), 0, 1, sr);
  else if(surf === 'sand' || surf === 'grass' || surf === 'snow') add(x, lp1(lp1(nz(0.03, sr, rnd, dec(0.008)), 700, sr), 700, sr), 0, 1, sr);
  else { const hard = surf === 'rock' || surf === 'metal', D = hard ? [0.03, 0.02, 0.012] : [0.008, 0.006, 0.004], hops = hard ? [[0, 1], [0.08 + rnd() * 0.03, 0.5], [0.14 + rnd() * 0.04, 0.25]] : [[0, 1], [0.07 + rnd() * 0.03, 0.3]];
    for(const [t, a] of hops){ add(x, modal(0.14, sr, rnd, 1, F.map(f => f * (0.93 + rnd() * 0.14)), D, [1, 0.6, 0.3], 0), t, a * (hard ? 1 : 0.45), sr); add(x, bp2(nz(0.006, sr, rnd, dec(0.0015)), 1800, 1, sr), t, a * 0.8, sr); } }
  return done(x, 0.7, sr); }
// his KIT on the run: webbing and cloth, a buckle or the sling's swivel ticking
export function afxKitBuf(sr, rnd){ const x = buf(0.18, sr); add(x, bp2(nz(0.16, sr, rnd, (t, u) => Math.sin(Math.PI * u)), 900, 0.5, sr), 0, 1, sr); add(x, lp1(nz(0.08, sr, rnd, dec(0.025)), 250, sr), 0, 1.5, sr);
  for(let k = 0, n = 2 + Math.floor(rnd() * 2); k < n; k++) add(x, modal(0.05, sr, rnd, 2200 + rnd() * 1400, [1, 1.7], [0.012, 0.007], [1, 0.5], 0.05), 0.01 + rnd() * 0.1, 0.25, sr);
  return done(x, 0.7, sr); }
// a handset keyed: the squelch's burst, its blip, the release — the click under a squad call (the words are text: no voice is synthesised)
export function afxSquelchBuf(sr, rnd){ const x = buf(0.1, sr); add(x, bp2(nz(0.03, sr, rnd, dec(0.008)), 2100, 1.2, sr), 0, 1, sr); add(x, sweep(0.03, sr, 1750 + rnd() * 150, 1700, 0.01), 0.035, 0.5, sr);
  add(x, bp2(nz(0.02, sr, rnd, dec(0.004)), 2600, 1.5, sr), 0.065, 0.6, sr); return done(lp1(hp1(x, 500, sr), 3800, sr), 0.7, sr); }
// landing a jump: the breath knocked out of him — air through two bands of the throat, a low voiced push under it
export function afxGruntBuf(sr, rnd){ const x = buf(0.24, sr), e = atk(0.015, 0.07), v = buf(0.22, sr); let ph = 0;
  for(let i = 0; i < v.length; i++){ const t = i / sr, u = i / v.length; ph += (115 - 30 * u) / sr; v[i] = ((ph % 1) * 2 - 1) * e(t); }
  for(const [f, q, g] of [[640, 3, 1], [1150, 4, 0.6]]){ add(x, bp2(v.slice(), f, q, sr), 0, g * 0.9, sr); add(x, bp2(nz(0.22, sr, rnd, e), f, q * 0.5, sr), 0, g * 0.7, sr); }
  return done(lp1(x, 3200, sr), 0.7, sr); }
