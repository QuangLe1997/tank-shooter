// actors/anim-graph.js — GRAPH 1 THE SOLDIER'S MOTION GRAPH (the PLAYER'S soldier, on his feet; ANIMGRAPH.on — on by default since GRAPH 5, ?noanimgraph turns it off and then none of it runs):
// his hips, legs and (a tunable share of) his spine come from the Mixamo library (actors/anim-lib.js) instead of one forward-only clip + procedural legs.
//   · THE BLEND SPACE: his real velocity in his legs' own frame (speed + bearing) picks the eight-way rifle walk / run / sprint clips (the crouch-walk
//     set when crouched) — two bearings × two gaits at most, the idle below a walk. Every clip rides ONE stride phase (each clip's own offset is measured
//     once from where its feet are: the fundamental of left-toe − right-toe along its heading), and the phase runs at his actual speed ÷ the blend's own
//     ground speed (stride-weighted; each clip's speed measured from its planted foot), so the stride fits the ground he covers.
//     Setting off (or coming back out of a near stop) the stride starts at the phase whose feet are nearest his standing feet, so a foot lifts and steps.
//   · THE FEET: a foot that has come down is LOCKED where it landed (its ball held in the world, the leg re-solved by two-bone IK on the soldier that is
//     seen, the foot's own tilt kept) until the clip lifts it; let go, what it was held back by decays on a spring — no slide while planted, no snap.
//     Pulling up, his feet stay where they were planted; a moment later the further one steps (lifted) to where the idle stands it, then the other.
//   · LAYERS: only Hips + legs are the graph's; Spine / Spine1 / Spine2 are slerped between what the game poses today and the graph (ANIMGRAPH.spine);
//     neck, head, clavicles and arms are never touched, so the aim twist, the hold and the hand-on-weapon IK (GUN 1–4) run on top exactly as before.
//     While he runs the game's own run clip (its upper body is still used) is slaved to the same stride phase, so shoulders and legs keep time.
//   · TRANSITIONS BY INERTIALIZATION, not cross-fades: when the source of a bone's pose changes (idle → turn, stand → knee → belly, ground → air, the
//     graph taking over from / handing back to the old pose: a roll, a mount, a climb, death) the difference between the last pose shown and the new
//     target — and its velocity — becomes an offset that decays on a critically damped spring (ANIMGRAPH.inert). Chosen over cross-fading because
//     (1) only the destination is evaluated: no second set of clips kept alive through a fade (the phone budget is two clips), (2) two unrelated leg
//     poses are never averaged (a kneel half-mixed with a stride puts feet through each other), (3) the joints keep their momentum across the cut, which
//     is what reads as weight, (4) it needs nothing from the source but its last two frames, so it also bridges to poses the graph does not own.
//   · STANCE: stand ↔ knee ↔ belly play the library's own transition clips (lower body); jump = take-off → the tucked loop → the reach for the ground,
//     timed so the feet arrive as he lands; stood still his legs stay planted while the chest follows the aim, then step round with the turn-90 clips.
//   · GRAPH 2 — PULLING UP: let go at a run while the right foot stands, the library's run-to-stop plays (a braking step, the hips down and up),
//     laid on the ground he still has to cover rather than on the clock; let go on the other foot he stops on his own stride, feet planted.
//     A turn past ~115° on the spot takes the about-turn clips. THE GROUND: each foot stands on the ground under IT (a slope, a kerb), laid along
//     it; the hips ride the mean of the two and come down for a leg that would run out — all in world heights, so a kerb is climbed, not jumped.
//   · ONE-SHOTS for the steps to come: graphPlay(id, { mask:'full' | 'upper' | 'lower', rate, from, to, hold, half }) / graphStop() / graphBusy().
// Wired in actors/real-cav.js at the one place the operator's clip is chosen (graphPose wraps the mixer's update; graphFeet stands in for soldierLegs;
// graphHipYaw / graphOwned for the planted hips and the prone height). No allocation per frame; nothing is fetched, built or run with the switch off.
import * as THREE from 'three';
import { ANIMGRAPH, CAV, GRAPHFIT, GUNFEEL, SOLDIER_LEGS } from '../../config.js';
import { CV, MOBILE, S, afxFoot, animClip, animInfo, animRootAt, legState, loadAnimGroup, soleAt } from '../hub.js';

const C = ANIMGRAPH, TAU = Math.PI * 2, Q45 = Math.PI / 4;
// the library's 22 bones in a fixed order: 0 hips · 1–3 spine · 4–13 neck, head, clavicles, arms · 14–21 legs (L up, shin, foot, toes · R the same)
const NB = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
const N = NB.length, LEG0 = 14, PO = N * 4, PL = PO + 3;
const mask = f => { const m = new Uint8Array(N); for(let i = 0; i < N; i++) m[i] = f(i) ? 1 : 0; return m; };
const M_LOW = mask(i => i === 0 || i >= LEG0), M_BODY = mask(i => i <= 3 || i >= LEG0), M_UP = mask(i => i >= 1 && i < LEG0), M_ALL = mask(() => true);
const pose = () => { const p = new Float32Array(PL); for(let i = 0; i < N; i++) p[i * 4 + 3] = 1; return p; };
// a pose = 22 local quaternions + the hips' position. OLD what the game's own mixer posed (OLDP: a frame ago) · TGT the graph's target · PRV the same
// target one frame back (only built on the frame of a cut) · OUT what is shown (OUT1, OUT2: one and two frames ago) · ACC the blend being summed
const OLD = pose(), OLDP = pose(), TGT = pose(), PRV = pose(), OUT = pose(), OUT1 = pose(), OUT2 = pose(), ACC = pose(), AW = new Float32Array(N + 1);
const X = new Float32Array(N * 3 + 3), V = new Float32Array(N * 3 + 3), XON = new Uint8Array(N + 1), WROTE = new Uint8Array(N + 1), NEED = new Uint8Array(N + 1);
const EC = new Array(8).fill(null), ET = new Float64Array(8), EB = new Float64Array(8), EW = new Float64Array(8), EL = new Uint8Array(8), PC = new Array(8).fill(null), PW = new Float64Array(8);
const FK = new Float32Array(12), OFF = [], ARMP = new THREE.Vector3(), ARMQ = new THREE.Quaternion(), CLIPS = new Map(), SETS = {};
const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _h = new THREE.Vector3(), _k = new THREE.Vector3(), _f = new THREE.Vector3(), _t = new THREE.Vector3(), _e = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _fq = new THREE.Quaternion(), _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _r3 = [0, 0, 0];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, smooth = k => k * k * (3 - 2 * k), wrapA = a => Math.atan2(Math.sin(a), Math.cos(a)), frac = x => x - Math.floor(x);
const newFoot = () => ({ on:false, has:false, lx:0, lz:0, ox:0, oz:0, ovx:0, ovz:0, px:0, pz:0, h:0, va:0, last:-9, rest:false, o0:0, ly:0, fly:0, ax:0, ay:0, az:0, gy:0, wy:0, fl:0.16, gok:false, gs:0, gT:0, gx:1e9, gz:1e9, cy:0, cyv:0, se:0, lt:0, rl:false, by:0 });
const TR = { g:null, t:0, t1:0, rate:1, to:0, goal:0, feet:false };   // the transition clip being played (one at a time)
const SH = { g:null, t:0, t1:0, rate:1, mask:M_ALL, hold:false, half:0.1, loop:false };   // the one-shot being played
// what a probe reads (dev): frames it ran, its own cost (ms: the last frame, the mean, the worst), the state, the clips blended, the stride's play rate
export const ANIMGRAPH_STAT = { frames:0, ms:0, msSum:0, msMax:0, st:'off', set:'', clips:0, rate:1, phase:0, kicks:0, locks:0, ready:false, failed:false, live:false, K:1, gaits:null };   // (K, gaits: his stride's scale and each gait's speed on the ground, m/s)
const A = { ready:false, booting:false, cal:false, airOK:false, live:false, R:null, B:null, own:false, st:'off', set:'stand', legMode:null, kick:0, half:0.09, dtPrev:0, EN:0, PN:0, ms:0,
  px:0, pz:0, has:false, spd:0, vl:0, vf:0, psi:0, K:1, as:1, ank0:0.166, toe0:0.046, ph:0, cyc:0, it:0, rate:1, dk:0, ud:0, hy:0, turn:null, tt:0, hy0:0, hyGo:0, wm:0, idleT:0, slow:true, stopG:null, stT:0, offT:9, landFoot:-1, landSnap:false, hipDrop:0, stillT:0, air:0, airT:0, kt:0, pt:0, ct:0, clock:0, leapLeft:0, leapStep:0, leapFoot:-1, af:0, al:0, pvf:0, pvl:0, hd:0, om:0, lp:0, lpv:0, lr:0, lrv:0, hipLift:0, hyX:0, cw:0, rollG:null, rollHy:0, rollT:0, cp:0, cpv:0, cO:0, sole:null,
  feet:[newFoot(), newFoot()], legs:null, sync:new Map() };

// ---- quaternions in flat arrays (scratch scalars: no objects) ----
let QX = 0, QY = 0, QZ = 0, QW = 1, RX = 0, RY = 0, RZ = 0;
function qmulc(a, ao, b, bo){ const ax = a[ao], ay = a[ao + 1], az = a[ao + 2], aw = a[ao + 3], bx = -b[bo], by = -b[bo + 1], bz = -b[bo + 2], bw = b[bo + 3];   // a ⊗ b*
  QX = ax * bw + aw * bx + ay * bz - az * by; QY = ay * bw + aw * by + az * bx - ax * bz; QZ = az * bw + aw * bz + ax * by - ay * bx; QW = aw * bw - ax * bx - ay * by - az * bz; }
function qlog(){ let x = QX, y = QY, z = QZ, w = QW; if(w < 0){ x = -x; y = -y; z = -z; w = -w; } const s = Math.sqrt(x * x + y * y + z * z), k = s < 1e-8 ? 2 : 2 * Math.atan2(s, w) / s; RX = x * k; RY = y * k; RZ = z * k; }   // → the turn as axis × angle
function qexp(rx, ry, rz){ const a = Math.sqrt(rx * rx + ry * ry + rz * rz); if(a < 1e-8){ QX = rx * 0.5; QY = ry * 0.5; QZ = rz * 0.5; QW = 1; } else { const s = Math.sin(a * 0.5) / a; QX = rx * s; QY = ry * s; QZ = rz * s; QW = Math.cos(a * 0.5); } }
function qmulTo(b, bo, out, oo){ const bx = b[bo], by = b[bo + 1], bz = b[bo + 2], bw = b[bo + 3];   // out = Q ⊗ b
  const x = QX * bw + QW * bx + QY * bz - QZ * by, y = QY * bw + QW * by + QZ * bx - QX * bz, z = QZ * bw + QW * bz + QX * by - QY * bx, w = QW * bw - QX * bx - QY * by - QZ * bz, l = 1 / Math.sqrt(x * x + y * y + z * z + w * w);
  out[oo] = x * l; out[oo + 1] = y * l; out[oo + 2] = z * l; out[oo + 3] = w * l; }

// ---- a clip as the graph samples it: one interpolant a bone (its own result buffer, made once), the hips' position, what it is worth on the ground ----
function mkClip(clip, info){ if(!clip) return null; const g = { id:clip.name, dur:clip.duration, q:new Array(N).fill(null), p:null, sp:info ? info.speed || 0 : 0, dx:0, dz:info && info.dir ? 1 : 0, ph:0, ph0:0, phL:0, phLf:0, cyc:1, moves:!!(info && info.dir), loop:info ? !!info.loop : true };
  if(info && info.dir){ g.dx = info.dir[0]; g.dz = info.dir[1]; }
  for(const t of clip.tracks){ const dot = t.name.lastIndexOf('.'), i = NB.indexOf(t.name.slice(0, dot).replace(/^mixamorig:?/, '')), prop = t.name.slice(dot + 1); if(i < 0) continue;
    if(prop === 'quaternion') g.q[i] = t.createInterpolant(); else if(prop === 'position' && i === 0) g.p = t.createInterpolant(); }
  return g; }
function clipOf(id){ let g = CLIPS.get(id); if(g === undefined){ g = mkClip(animClip(id), animInfo(id)); if(g || animInfo(id) === null) CLIPS.set(id, g); } return g || null; }
function zero(m){ for(let i = 0; i < N; i++){ AW[i] = 0; if(m[i]){ const o = i * 4; ACC[o] = ACC[o + 1] = ACC[o + 2] = ACC[o + 3] = 0; } } AW[N] = 0; ACC[PO] = ACC[PO + 1] = ACC[PO + 2] = 0; }
// one clip's pose at t added to the sum with weight w (each quaternion on the side of the sum so far)
function accum(g, t, w, m){ if(t < 0) t = 0; else if(t > g.dur) t = g.dur;
  for(let i = 0; i < N; i++){ const I = g.q[i]; if(!m[i] || !I) continue; const r = I.evaluate(t), o = i * 4, s = ACC[o] * r[0] + ACC[o + 1] * r[1] + ACC[o + 2] * r[2] + ACC[o + 3] * r[3] < 0 ? -w : w;
    ACC[o] += r[0] * s; ACC[o + 1] += r[1] * s; ACC[o + 2] += r[2] * s; ACC[o + 3] += r[3] * s; AW[i] += w; }
  if(m[0] && g.p){ const r = g.p.evaluate(t); ACC[PO] += r[0] * w; ACC[PO + 1] += r[1] * w; ACC[PO + 2] += r[2] * w; AW[N] += w; } }
function norm(m){ for(let i = 0; i < N; i++){ if(!m[i] || !(AW[i] > 0)) continue; const o = i * 4, l = Math.sqrt(ACC[o] * ACC[o] + ACC[o + 1] * ACC[o + 1] + ACC[o + 2] * ACC[o + 2] + ACC[o + 3] * ACC[o + 3]);
    if(l > 1e-9){ const k = 1 / l; ACC[o] *= k; ACC[o + 1] *= k; ACC[o + 2] *= k; ACC[o + 3] *= k; } else { AW[i] = 0; } }
  if(AW[N] > 0){ const k = 1 / AW[N]; ACC[PO] *= k; ACC[PO + 1] *= k; ACC[PO + 2] *= k; } }
// where a pose puts his ankles and the balls of his feet, in the operator's own frame (metres; +x his left, +y up, +z ahead; the ground at y = 0)
function fkFeet(P, out){ _q0.fromArray(P, 0).premultiply(ARMQ); _a.fromArray(P, PO).multiplyScalar(A.as).applyQuaternion(ARMQ).add(ARMP);
  for(let s = 0; s < 2; s++){ const b = LEG0 + s * 4, o = s * 6; _q1.copy(_q0); _b.copy(_a);
    for(let j = 0; j < 4; j++){ _b.add(_v.copy(OFF[b + j]).applyQuaternion(_q1)); if(j < 3) _q1.multiply(_q.fromArray(P, (b + j) * 4)); if(j === 2){ out[o] = _b.x; out[o + 1] = _b.y; out[o + 2] = _b.z; } }
    out[o + 3] = _b.x; out[o + 4] = _b.y; out[o + 5] = _b.z; } return out; }

// ---- once: the files, the clips the graph names, then (against his own skeleton) each stride's phase and ground speed ----
function boot(){ if(A.booting) return; A.booting = true;
  Promise.all(C.groups.map(loadAnimGroup)).then(() => { const need = [];
    for(const k of Object.keys(C.sets)){ const D = C.sets[k], T = SETS[k] = { idle:clipOf(D.idle), g:[], turn:[clipOf(D.turn[0]), clipOf(D.turn[1])], wide:[clipOf(D.wide[0]), clipOf(D.wide[1])], v:[] };
      for(const pre of D.gaits){ const row = C.dirs.map(d => clipOf(pre + d)); T.g.push(row); need.push(...row); } need.push(T.idle); }
    need.push(clipOf(C.kneel.idle), clipOf(C.prone.idle), clipOf(C.prone.crawl)); for(const k of Object.keys(C.trans)) if(Array.isArray(C.trans[k])) need.push(clipOf(C.trans[k][0]));
    if(need.some(g => !g)) throw new Error('a clip the graph names is not in the library');
    A.airOK = !!(clipOf(C.air.up[0]) && clipOf(C.air.loop) && clipOf(C.air.down[0])); A.stopG = clipOf(C.stop.clip); A.rollG = C.roll.on ? clipOf(C.roll.clip) : null; A.ready = ANIMGRAPH_STAT.ready = true;
  }).catch(e => { console.warn('[anim-graph] not started — the old legs stay:', e && e.message); ANIMGRAPH_STAT.failed = true; }); }
function bind(R){ const Sb = R.pup.S, Db = R.pup.D; A.R = R; A.B = NB.map(n => Sb[n] || null); A.cal = false; if(A.B.some(b => !b)){ A.B = null; return false; }
  A.legs = ['Left', 'Right'].map(s => ['UpLeg', 'Leg', 'Foot', 'ToeBase'].map(n => Db[s + n] || null)); A.sole = null;
  { const L = A.legs[0]; if(L[0] && L[1] && L[2]){ L[0].getWorldPosition(_a); L[1].getWorldPosition(_b); L[2].getWorldPosition(_v); A.legLen = _a.distanceTo(_b) + _b.distanceTo(_v); } }   // GRAPH 7 (the seen leg's hip → ankle, world metres: GRAPH 2's hip drop read it and it was never set)   // the legs of the soldier that is seen (the foot lock works on him)
  R.op.updateWorldMatrix(true, true); const arm = Sb.Hips.parent; _m.copy(R.op.matrixWorld).invert().multiply(arm.matrixWorld).decompose(ARMP, ARMQ, _v); const as = A.as = _v.x;   // (the armature's own scale under the operator: 1 on this rig)
  for(let i = 0; i < N; i++) (OFF[i] || (OFF[i] = new THREE.Vector3())).copy(A.B[i].position).multiplyScalar(as); ARMQ.normalize();
  A.K = R.op.getWorldScale(_v).x / (R.pup.legK || 1);   // a metre of the operator's stride is this many on the ground under the soldier that is seen (his legs are longer)
  calibrate(); reset(); ANIMGRAPH_STAT.K = +A.K.toFixed(4); ANIMGRAPH_STAT.gaits = {}; for(const k of Object.keys(SETS)) ANIMGRAPH_STAT.gaits[k] = SETS[k].v.map(v => +(v * A.K).toFixed(3)); return true; }
function reset(){ A.live = ANIMGRAPH_STAT.live = false; A.own = false; A.st = 'off'; A.kick = 0; A.has = false; A.hy = 0; A.turn = null; SH.g = null; A.EN = A.PN = 0; X.fill(0); V.fill(0); XON.fill(0); WROTE.fill(0); for(const F of A.feet){ F.on = F.has = F.rest = false; F.ox = F.oz = F.ovx = F.ovz = F.ly = F.fly = F.gy = F.gs = F.gT = F.cy = F.cyv = 0; F.gok = false; } A.hipDrop = A.cp = A.cpv = A.cO = 0; }
function one(g, t){ zero(M_LOW); accum(g, t, 1, M_LOW); return fkFeet(ACC, FK); }
// a stride clip measured on his own legs: its phase (where in the cycle the left foot is furthest along the heading: the fundamental of L − R), how
// many strides it holds (the game's own run clips hold one or two), and the speed its PLANTED foot goes back under him (what the ground must do)
function measure(g, dx, dz, speed){ const M = 48, dtm = g.dur / M; let re1 = 0, im1 = 0, re2 = 0, im2 = 0, sv = 0, n = 0, fl0 = 0, fl1 = 0, x0 = 0, z0 = 0, x1 = 0, z1 = 0;
  for(let i = 0; i <= M; i++){ one(g, g.dur * i / M); const s = (FK[3] - FK[9]) * dx + (FK[5] - FK[11]) * dz, a = TAU * i / M;
    if(i < M){ re1 += s * Math.cos(a); im1 += s * Math.sin(a); re2 += s * Math.cos(2 * a); im2 += s * Math.sin(2 * a); }
    const f0 = Math.max(FK[1] - A.ank0, FK[4] - A.toe0) < 0.035 ? 1 : 0, f1 = Math.max(FK[7] - A.ank0, FK[10] - A.toe0) < 0.035 ? 1 : 0;
    if(i){ if(f0 && fl0){ sv -= (FK[3] - x0) * dx + (FK[5] - z0) * dz; n++; } if(f1 && fl1){ sv -= (FK[9] - x1) * dx + (FK[11] - z1) * dz; n++; } }
    fl0 = f0; fl1 = f1; x0 = FK[3]; z0 = FK[5]; x1 = FK[9]; z1 = FK[11]; }
  g.cyc = Math.hypot(re2, im2) > Math.hypot(re1, im1) * 1.5 ? 2 : 1; g.ph = frac((g.cyc === 2 ? Math.atan2(im2, re2) : Math.atan2(im1, re1)) / (TAU * g.cyc));
  if(speed && C.calib && n >= 6){ const v = sv / (n * dtm); if(v > g.sp * 0.75 && v < g.sp * 1.3) g.sp = v; } }
// the stride phase at which a clip's ankles are nearest the idle's (where he sets off from)
function nearest(g, I, flat){ let best = Infinity, bp = 0, lf = 0; for(let i = 0; i < 24; i++){ one(g, g.dur * i / 24); let d = 0; for(let c = 0; c < 3; c++){ if(flat && c === 1) continue; const a = FK[c] - I[c], b = FK[6 + c] - I[6 + c]; d += a * a + b * b; }   // (flat: over the ground only — a foot passing in the air above its place counts as there)
    if(d < best){ best = d; bp = i / 24; lf = FK[1] <= FK[7] ? 0 : 1; } } NEAR[0] = frac(bp - g.ph); NEAR[1] = lf; }   // (→ the phase, and which foot stands there)
const NEAR = [0, 0];
// GRAPH 3 where in the shared stride each foot comes down (its ankle reaching the ground): a running jump is timed onto one of these
function touchdowns(g){ const M = 48; let pL = 1, pR = 1; g.td = [-1, -1];
  for(let i = 0; i <= M * 2; i++){ one(g, g.dur * (i % M) / M); const hL = FK[1] - A.ank0, hR = FK[7] - A.ank0;
    if(i > 0){ if(g.td[0] < 0 && hL < 0.03 && pL >= 0.03) g.td[0] = frac((i % M) / M - g.ph); if(g.td[1] < 0 && hR < 0.03 && pR >= 0.03) g.td[1] = frac((i % M) / M - g.ph); } pL = hL; pR = hR; }
  if(g.td[0] < 0) g.td[0] = 0.02; if(g.td[1] < 0) g.td[1] = frac(g.td[0] + 0.5); }
const IDLE = new Float32Array(12);
function calibrate(){ if(A.cal || !A.ready) return; A.cal = true; one(SETS.stand.idle, 0); A.ank0 = (FK[1] + FK[7]) / 2; A.toe0 = (FK[4] + FK[10]) / 2;
  for(const k of Object.keys(SETS)){ const T = SETS[k]; T.v.length = 0; for(const row of T.g){ let s = 0; for(const g of row){ measure(g, g.dx, g.dz, true); s += g.sp; } T.v.push(s / row.length); }
    IDLE.set(one(T.idle, 0)); for(const row of T.g) for(const g of row){ nearest(g, IDLE); g.ph0 = NEAR[0]; touchdowns(g); }
    if(A.airOK){ IDLE.set(one(CLIPS.get(C.air.down[0]), C.air.down[2])); for(const row of T.g) for(const g of row){ nearest(g, IDLE, true); g.phL = NEAR[0]; g.phLf = NEAR[1]; } } }   // (and nearest the feet he lands a jump on)
  for(const t of SETS.stand.turn.concat(SETS.crouch.turn, SETS.stand.wide, SETS.crouch.wide)) if(t && t.yaw === undefined){ animRootAt(t.id, t.dur, _r3); t.yaw = _r3[2] || 1; }
  if(A.stopG){ animRootAt(A.stopG.id, A.stopG.dur, _r3); A.stopG.len = _r3[1]; } }   // (how far the stop clip still travels, in his own metres)

// ---- the plan for this frame: which clips, at what time, how fast each runs, how much of each ----
function put(g, t, rate, w, loop){ if(!g || !(w > 0.004) || A.EN >= 8) return; const n = A.EN++; EC[n] = g; ET[n] = t; EB[n] = rate; EW[n] = w; EL[n] = loop ? 1 : 0; }
function planLoco(dt){ const T = SETS[A.set], K = A.K, s = Math.hypot(A.vl, A.vf), ng = T.g.length, bl = 1 - C.band[0], bh = 1 + C.band[1]; let j0 = 0, j1 = -1, u = 0, a = 1;
  const lo0 = T.v[0] * K * bl; if(s < lo0) a = Math.min(1, Math.pow(s / (lo0 * C.slowAt), C.slowExp));   // under a walk: real steps from early on (shorter, slower), not a shuffle
  else for(let j = 0; j < ng - 1; j++){ let hi = T.v[j] * K * bh, lo = T.v[j + 1] * K * bl; if(lo - hi < C.bandMin){ const m = (hi + lo) / 2; hi = m - C.bandMin / 2; lo = m + C.bandMin / 2; }   // (two gaits close in speed: a narrow blend half-way)
    if(s <= hi){ j0 = j; break; } if(s < lo){ j0 = j; j1 = j + 1; u = smooth((s - hi) / (lo - hi)); break; } j0 = j + 1; }
  if(s > 0.05){ const th = (Math.atan2(A.vl, A.vf) + TAU) % TAU, k = Math.min(7, Math.floor(th / Q45)), be = th - k * Q45, sb = Math.sin(be), sc = Math.sin(Q45 - be); A.dk = k; A.ud = sb + sc > 1e-6 ? sb / (sb + sc) : 0; }   // the two bearings either side, shared so the blend's own heading is his
  const k0 = A.dk, k1 = (k0 + 1) % 8, ud = A.ud; A.EN = 0; let turning = false;
  // stood still: his legs stay where they are planted while the body (the aim) turns over them, then step round with a turn clip once it is too far
  // GRAPH 3 judged on where the body is GOING (the aim he is turning to), not where it has got to: a quick swing round to 150° is an about-turn from its
  //   first step, not a quarter turn that the rest of the swing then drags round on planted feet
  const P0 = S.player, hyE = A.hy - (P0 && P0.aim !== undefined ? wrapA(P0.aim - P0.facing) : 0);
  if(a < 0.04 && !A.turn && Math.abs(hyE) > C.turn.at && Math.abs(A.hy) > C.turn.early){ const w = Math.abs(hyE) > C.turn.wide && T.wide[hyE < 0 ? 0 : 1], g = w || T.turn[hyE < 0 ? 0 : 1]; if(g){ A.turn = g; A.tt = 0; A.hy0 = A.hy; A.hyX = 0; A.hyGo = w ? hyE : clamp(hyE, -C.turn.max, C.turn.max);   // (far round: the about-turn clip takes it whole)
      A.kick = Math.max(A.kick, C.inert.half); } }   // (a clip turns him no more than turn.max: the rest is the next one's)
  // GRAPH 3 the clip keeps up with the body: if the chest has swung round further than the hips can twist (turn.lag), the clip runs on (up to catchUp × its
  //   pace) until the legs are back within it — a quick swing round is a quick pivot on the feet, never planted feet dragged round under him
  if(A.turn){ const g = A.turn, t0 = A.tt, tm = Math.min(g.dur, t0 + dt * C.turn.rate * C.turn.catchUp); let t = Math.min(g.dur, t0 + dt * C.turn.rate), done = 0;
    for(;;){ animRootAt(g.id, t, _r3); done = clamp(_r3[2] / g.yaw, 0, 1); if(Math.abs(A.hy0 + A.hyX - A.hyGo * done) <= C.turn.lag || t >= tm) break; t = Math.min(tm, t + 1 / 240); }
    A.tt = t; A.hy = A.hy0 - A.hyGo * done + A.hyX;   // (+ what the body turned on since the clip began)
    if(A.tt >= g.dur * C.turn.end || a > 0.3){ A.turn = null; A.kick = Math.max(A.kick, C.inert.half); } else { put(g, A.tt, (A.tt - t0) / dt, 1, false); turning = true; } }
  else if(a > 0.04) A.hy *= Math.exp(-dt * C.turn.settle);   // on the move the legs come round under him within a stride
  if(!turning){ A.it = (A.it + dt) % T.idle.dur; put(T.idle, A.it, 1, 1 - a, true);
    const w0 = a * (1 - u), w1 = a * u; put(T.g[j0][k0], 0, 0, w0 * (1 - ud), true); put(T.g[j0][k1], 0, 0, w0 * ud, true); if(j1 >= 0){ put(T.g[j1][k0], 0, 0, w1 * (1 - ud), true); put(T.g[j1][k1], 0, 0, w1 * ud, true); } }
  // phones: the two heaviest only
  const cap = MOBILE ? C.phoneClips : C.maxClips; while(A.EN > cap){ let m = 0; for(let i = 1; i < A.EN; i++) if(EW[i] < EW[m]) m = i; const l = --A.EN; EC[m] = EC[l]; ET[m] = ET[l]; EB[m] = EB[l]; EW[m] = EW[l]; EL[m] = EL[l]; }
  let W = 0, Wm = 0, Dm = 0, vx = 0, vz = 0; for(let i = 0; i < A.EN; i++){ W += EW[i]; if(EC[i].moves){ Wm += EW[i]; Dm += EW[i] * EC[i].dur; vx += EW[i] * EC[i].dx * EC[i].sp * EC[i].dur; vz += EW[i] * EC[i].dz * EC[i].sp * EC[i].dur; } }
  if(W > 0) for(let i = 0; i < A.EN; i++) EW[i] /= W;
  // setting off: the stride begins where its feet are nearest his standing feet (each clip's own, measured once: the aiming idle stands him left
  //   foot ahead — a stride's double support), so the first thing a foot does is lift and step, not slide to where the last stride left off
  if(A.landSnap){ A.landSnap = false; let m = -1; for(let i = 0; i < A.EN; i++) if(EC[i].moves && (m < 0 || EW[i] > EW[m])) m = i; if(m >= 0){ A.ph = EC[m].phL; A.landFoot = EC[m].phLf; A.slow = false; A.kick = Math.max(A.kick, C.inert.half); } }
  const wm = W > 0 ? Wm / W : 0; if(wm < C.startW * 0.6) A.slow = true; if(wm >= C.startW && A.slow){ A.slow = false; let m = -1;   // (also coming back out of a near stop: a change of direction)
    for(let i = 0; i < A.EN; i++) if(EC[i].moves && (m < 0 || EW[i] > EW[m])) m = i; if(m >= 0){ A.ph = EC[m].ph0; A.kick = Math.max(A.kick, C.inert.half); } } A.wm = wm; A.idleT = wm < 0.02 && !turning ? A.idleT + dt : 0;
  // the stride: one phase for every clip, run at his real speed over what the blend covers a second at its natural pace
  if(Dm > 0){ const D = Dm / Wm, Vb = Math.hypot(vx, vz) / Dm * K * (Wm / (W || 1)), r = Wm > 0.02 ? clamp(A.spd / Math.max(0.05, Vb), C.rate[0], C.rate[1]) : 0; A.rate = r || 1;
    A.ph += A.leapStep > 0 ? A.leapStep : r * dt / D; if(A.ph >= 1){ A.ph -= Math.floor(A.ph); A.cyc++; }
    for(let i = 0; i < A.EN; i++){ const g = EC[i]; if(!g.moves) continue; ET[i] = frac(A.ph + g.ph) * g.dur; EB[i] = r * g.dur / D; } }
  else A.rate = 1; }
// GRAPH 3 THE CRAWL LAID ON THE GROUND: a belly crawl does not move evenly (a reach that goes nowhere, then a pull that surges), the game moves him evenly —
//   so the clip is played by the ground he covers, not by the clock: its own root travel is matched to his (within prone.rate × its pace), the reach
//   hurried, the pull at the pace of the ground: elbows and knees stay where they dig in instead of skating through the slow half
function rootAdv(g, t0, t1){ animRootAt(g.id, t0, _r3); const a = _r3[1]; if(t1 <= g.dur){ animRootAt(g.id, t1, _r3); return _r3[1] - a; } return g.len - a + rootAdv(g, 0, t1 - g.dur); }
function planProne(dt){ const s = Math.hypot(A.vl, A.vf), I = CLIPS.get(C.prone.idle), W = CLIPS.get(C.prone.crawl), stop = s < C.prone.stopV, c1 = stop ? (A.stillT < C.prone.holdT ? A.cw : 0) : smooth(clamp(s / C.prone.crawlV, 0, 1)), cw = A.cw += (c1 - A.cw) * Math.min(1, dt / (stop ? C.prone.outT : C.prone.blendT)), r0 = A.spd / Math.max(0.05, W.sp * A.K); let r = stop ? 0 : clamp(r0, C.prone.rate[0], C.prone.rate[1]);   // (stopped he stays as the crawl left him — elbows and knees where they dug in — and only later settles, slowly, into the prone idle)
  if(W.len === undefined){ animRootAt(W.id, W.dur, _r3); W.len = _r3[1] > 0.05 ? _r3[1] : 0; }
  const CR = GRAPHFIT.on && GRAPHFIT.crawl.on && W.len ? GRAPHFIT.crawl : null; if(CR) r = stop ? 0 : clamp(A.spd / (W.len / W.dur * A.K), C.prone.rate[0], C.prone.rate[1]);   // GRAPH 6 (the clip's own pace over the ground: its root's way ÷ its length)
  A.pt = (A.pt + dt) % I.dur; if(cw > 0.004){ const t0 = A.ct; let t = t0 + dt * r;
    if(CR){ A.cO = clamp(A.cO + rootAdv(W, t0, t) * A.K * cw - A.spd * dt, -CR.max, CR.max); }   // GRAPH 6 the body rides the clip's surge: ahead / behind the man by what its root has covered beyond / short of him
    else if(W.len && C.prone.match && r0 > C.prone.rate[0]){ const d = A.spd * dt / A.K, lo = t0 + dt * Math.max(C.prone.rate[0], r0 * C.prone.band[0]), hi = t0 + dt * Math.min(C.prone.rate[1], r0 * C.prone.band[1]); t = lo; while(t < hi && rootAdv(W, t0, t) < d) t = Math.min(hi, t + 1 / 240); r = (t - t0) / dt; }
    A.ct = t % W.dur; } A.EN = 0; put(I, A.pt, 1, 1 - cw, true); put(W, A.ct, r, cw, true); A.rate = r; }
function planAir(){ const U = C.air.up, Dn = C.air.down; A.EN = 0;
  if(A.air === 0) put(CLIPS.get(U[0]), A.tt, (U[2] - U[1]) / C.air.upT, 1, false); else if(A.air === 1) put(CLIPS.get(C.air.loop), A.tt, 1, 1, true); else put(CLIPS.get(Dn[0]), A.tt, A.air === 3 ? C.air.landRate : 1, 1, false); }
// the sum of the plan, `back` seconds ago (0 = now) → ACC (normalised)
function evalPlan(back, m){ zero(m); for(let i = 0; i < A.EN; i++){ const g = EC[i]; let t = ET[i] - EB[i] * back; if(EL[i]){ if(t < 0) t += g.dur; } accum(g, t, EW[i], m); } norm(m); }
// the target pose: what the game posed, then the graph's hips and legs over it, its spine by ANIMGRAPH.spine, a one-shot on top
function target(out, back, old){ out.set(old);
  if(A.own && A.EN){ evalPlan(back, M_BODY); for(let i = 0; i < N; i++){ if(!M_BODY[i] || !(AW[i] > 0)) continue; const o = i * 4;
      if(i >= 1 && i <= 3) THREE.Quaternion.slerpFlat(out, o, old, o, ACC, o, A.st === 'roll' ? 1 : C.spine[i - 1]); else { out[o] = ACC[o]; out[o + 1] = ACC[o + 1]; out[o + 2] = ACC[o + 2]; out[o + 3] = ACC[o + 3]; } }
    if(AW[N] > 0){ out[PO] = ACC[PO]; out[PO + 1] = ACC[PO + 1]; out[PO + 2] = ACC[PO + 2]; }
    if(A.lp || A.lr){ _q0.fromArray(out, 0).premultiply(ARMQ).invert(); _a.set(1, 0, 0).applyQuaternion(_q0); _b.set(0, 0, 1).applyQuaternion(_q0);   // (his own across / ahead, in the hips' frame)
      _q.setFromAxisAngle(_a, A.lp); _q1.setFromAxisAngle(_b, -A.lr); _q.multiply(_q1); _q1.fromArray(out, 4).premultiply(_q); _q1.toArray(out, 4); } }
  if(SH.g){ const m = SH.mask; zero(m); let t = SH.t - SH.rate * back; if(t < 0) t = SH.loop ? t + SH.g.dur : 0; accum(SH.g, t, 1, m);
    for(let i = 0; i < N; i++){ if(!m[i] || !(AW[i] > 0)) continue; const o = i * 4; out[o] = ACC[o]; out[o + 1] = ACC[o + 1]; out[o + 2] = ACC[o + 2]; out[o + 3] = ACC[o + 3]; }
    if(m[0] && AW[N] > 0){ out[PO] = ACC[PO]; out[PO + 1] = ACC[PO + 1]; out[PO + 2] = ACC[PO + 2]; } } }

// GRAPH 3 WEIGHT: his trunk leans into what his legs are doing to him — forward as he drives off, back as he brakes on his own stride, into a bend
//   (the pull round it: speed × how fast his way turns) — on a critically damped spring, so it swings in and settles, never snaps. Laid on the lowest
//   spine bone (the hips and legs stay the clip's, the planted feet stay put), less while he fires, little in the braking clip (it leans by itself)
function lean(dt, wx, wz, own){ const L = C.lean, k = 1 - Math.exp(-dt * 0.6931 / L.accHalf), af = (A.vf - A.pvf) / dt, al = (A.vl - A.pvl) / dt; A.pvf = A.vf; A.pvl = A.vl;
  let om = 0; if(A.spd > L.turnV){ const hd = Math.atan2(wx, wz); om = wrapA(hd - A.hd) / dt; A.hd = hd; } else A.hd = Math.atan2(wx, wz);
  const ok = L.on && own && (A.st === 'loco' || A.st === 'stop') && A.set === 'stand'; A.af += ((ok ? af : 0) - A.af) * k; A.al += ((ok ? al : 0) - A.al) * k; A.om += ((ok ? clamp(om, -L.omMax, L.omMax) : 0) - A.om) * k;
  const g = !ok ? 0 : (A.st === 'stop' ? L.stop : 1) * (S.firing ? L.aim : 1), tp = clamp(L.k * A.af, -L.back, L.fwd) * g, tr = clamp(L.kr * (A.al + A.spd * A.om), -L.side, L.side) * g;
  const y = 2 * 0.6931 / L.half, ey = Math.exp(-y * dt); let j = A.lpv + (A.lp - tp) * y; A.lp = tp + ey * (A.lp - tp + j * dt); A.lpv = ey * (A.lpv - j * y * dt);
  j = A.lrv + (A.lr - tr) * y; A.lr = tr + ey * (A.lr - tr + j * dt); A.lrv = ey * (A.lrv - j * y * dt); if(Math.abs(A.lp) + Math.abs(A.lr) + Math.abs(A.lpv) + Math.abs(A.lrv) < 1e-5) A.lp = A.lr = A.lpv = A.lrv = 0; }
// ---- which state: 0 stood (the blend space) · 1 crouched on the move (its crouch set) · 2 on a knee · 3 on his belly; a transition clip between ----
const code = () => A.st === 'loco' ? (A.set === 'crouch' ? 1 : 0) : A.st === 'kneel' ? 2 : A.st === 'prone' ? 3 : -1;
function settle(c, half){ A.st = c <= 1 ? 'loco' : c === 2 ? 'kneel' : 'prone'; if(c <= 1) A.set = c ? 'crouch' : 'stand'; A.turn = null; A.kick = Math.max(A.kick, half); }
function trans(key, to, goal, fast){ const D = C.trans[key], g = clipOf(D[0]); if(!g){ settle(to, C.inert.stance); return; }
  TR.g = g; TR.t = D[1]; TR.t1 = D[2]; TR.rate = D[3] * (fast || 1); TR.to = to; TR.goal = goal; TR.feet = key === 'standKneel' || key === 'kneelStand' || (C.feet.proneLock && (key === 'proneKneel' || key === 'kneelProne')); A.st = 'trans'; A.turn = null; A.kick = Math.max(A.kick, C.inert.stance); }
function route(cur, want, still){ const I = C.inert; if(cur === want){ if(A.st !== 'loco' && A.st !== 'kneel' && A.st !== 'prone') settle(want, I.half); return; }
  if(cur < 0) return settle(want, I.stance);                                                       // from the game's own pose (a roll, a ride, a wall): straight in
  if(want === 3) return cur === 0 ? trans('standKneel', 2, want, C.trans.fast) : trans('kneelProne', 3, want);   // down: onto a knee, then onto his belly
  if(cur === 3) return trans('proneKneel', 2, want);                                               // up: onto a knee first, on from there
  if(cur === 0 && want === 2 && still) return trans('standKneel', 2, want);
  if(cur === 1 && want === 2 && still && C.trans.crouchKneel) return trans('standKneel', 2, want);   // GRAPH 5 crouched and stopped: down onto the knee by the clip too (the feet planted through it), not a cut from the crouch to the kneel
  if(cur === 2 && want === 0 && still) return trans('kneelStand', 0, want);
  settle(want, I.stance); }
function airStep(dt, inAir){ const J = CV.jump, U = C.air.up, Dn = C.air.down; A.airT += dt;
  if(A.air === 4){ if(!inAir) return false; let tl = 0.5; if(J && !J.climb){ const g = CAV.moves.jump.g; tl = (J.vy + Math.sqrt(Math.max(0, J.vy * J.vy + 2 * g * Math.max(0, J.y)))) / g; }   // (the leap: what is left of the stride spread over what is left of the flight)
    A.leapStep = A.leapLeft * Math.min(1, dt / Math.max(dt, tl)); A.leapLeft -= A.leapStep; return true; }
  if(inAir){ let tl = 9; if(J && !J.climb){ const g = CAV.moves.jump.g; tl = (J.vy + Math.sqrt(Math.max(0, J.vy * J.vy + 2 * g * Math.max(0, J.y)))) / g; }   // how long until he is down
    if(A.air === 3){ A.air = 0; A.airT = 0; A.kick = Math.max(A.kick, C.inert.half); }
    if(tl < Dn[2] - Dn[1]){ if(A.air !== 2){ A.air = 2; A.kick = Math.max(A.kick, C.inert.half); } A.tt = Dn[2] - tl; }   // the reach for the ground, timed to arrive with it
    else if(A.air === 0){ A.tt = U[1] + (U[2] - U[1]) * Math.min(1, A.airT / C.air.upT); if(A.airT >= C.air.upT){ A.air = 1; A.tt = 0; } }
    else if(A.air === 1) A.tt = (A.tt + dt) % CLIPS.get(C.air.loop).dur;
    return true; }
  if(A.spd > C.trans.cutV) return false;                                                           // down at a run: straight back into his stride (the landing clip stands still)
  if(A.air !== 3){ if(A.air !== 2) A.kick = Math.max(A.kick, C.inert.half); A.tt = Math.max(A.air === 2 ? A.tt : 0, Dn[2]); A.air = 3; }
  A.tt += dt * C.air.landRate; return A.tt < Dn[3]; }                                                  // stood: the give at the knees, then up
function think(dt, P){ const MV = P.move, sm = Math.hypot(A.vl, A.vf), still = sm < C.kneel.stillV, inAir = !!(MV && MV.air); A.stillT = still ? A.stillT + dt : 0;
  // GRAPH 3 THE ROLL IS THE LIBRARY'S: over the shoulder with the whole trunk (the clip's dive-and-roll, from where his hands go down to where he is up on
  //   his feet again), laid on the game's own roll clock — the body is no longer a stiff tuck turned over as one piece; legs turned the way he rolls
  if(MV && MV.roll >= 0 && A.rollG){ const RL = C.roll, t = RL.t[0] + (RL.t[1] - RL.t[0]) * MV.roll; if(A.st !== 'roll'){ A.st = 'roll'; A.turn = null; A.kick = Math.max(A.kick, RL.half); A.rollT = t; A.rollHy = CV.roll && S.player ? wrapA(CV.roll.a - S.player.facing) : 0; }
    A.hy = A.rollHy; A.EN = 0; put(A.rollG, t, Math.max(0, t - A.rollT) / dt, 1, false); A.rollT = t; A.legMode = 'roll'; return; }
  if(A.st === 'roll'){ A.st = 'off'; A.kick = Math.max(A.kick, C.roll.half); }
  if(inAir && A.st !== 'air'){ const J = CV.jump; A.air = 0; A.airT = 0; A.turn = null;
    // GRAPH 3 A RUNNING JUMP IS A LEAP: off at a run, the stride itself carries on through the air — slowed so that the next foot to come down (at least
    //   leap.min of a stride on: the legs scissor) arrives exactly as he lands, and on from there without a cut — not the stood jump's tuck and a new stride
    if(C.leap.on && A.st === 'loco' && A.set === 'stand' && A.spd > C.leap.v && J && !J.climb && A.EN){ let best = 9, foot = 0; let m = -1; for(let i = 0; i < A.EN; i++) if(EC[i].moves && (m < 0 || EW[i] > EW[m])) m = i;
      if(m >= 0 && EC[m].td){ for(let s = 0; s < 2; s++){ let d = frac(EC[m].td[s] - A.ph); while(d < C.leap.min) d += 1; if(d < best){ best = d; foot = s; } } A.air = 4; A.leapLeft = best; A.leapFoot = foot; } }
    A.st = 'air'; if(A.air !== 4) A.kick = Math.max(A.kick, C.inert.half); }
  if(A.st === 'air'){ if(airStep(dt, inAir)){ if(A.air === 4){ planLoco(dt); A.leapStep = 0; } else planAir(); A.legMode = 'air'; return; }
    if(A.air === 4){ A.st = 'loco'; A.landFoot = A.leapFoot; A.slow = false; A.leapStep = 0; A.air = 0; }
    else { A.st = 'off'; if(A.spd > C.trans.cutV && A.spd < C.air.snapV) A.landSnap = true; } }   // down on the move, at a walk's pace: into the stride where its feet are nearest the pair he lands on (planLoco), the standing one planted where
  //   it came down, the other lifted off at once. (At a run this measured no better than going straight back into the stride — it wants a running-jump clip.)
  // PULLING UP FROM A RUN (the push let go — CV.moveT back to 0 — while he still runs ahead): the library's run-to-stop, a braking step. It is laid on the
  //   ground, not on the clock: the clip stands where the ground it still has to cover equals the ground HE still has to cover (v² / 2a at the game's braking)
  const SG = A.stopG; A.offT = CV.moveT ? 0 : A.offT + dt; if(SG && A.st === 'loco' && A.set === 'stand' && P.stance === 'stand' && !CV.moveT && A.offT < C.stop.late && !A.turn && A.spd > C.stop.minV && A.spd < C.stop.maxV && A.vf > C.stop.ahead * sm && frac(A.ph - C.stop.phase[0]) < C.stop.phase[1] - C.stop.phase[0]){ A.st = 'stop';   // (only at once, and only as the right foot stands and the left swings through — where the clip begins; let go on the other foot he pulls up on his own stride, feet planted)
    A.stT = 0; A.kick = Math.max(A.kick, C.inert.stance); }
  if(A.st === 'stop'){ if(CV.moveT > 0 || P.stance !== 'stand'){ A.st = 'loco'; A.kick = Math.max(A.kick, C.inert.stance); }
    else { const t0 = A.stT; let t = t0; if(A.spd > C.stop.stillV){ const rem = A.spd * A.spd / (2 * CAV.foot.decel) / A.K, tm = Math.min(SG.dur, t0 + dt * C.stop.maxRate); while(t < tm && SG.len - animRootAt(SG.id, t, _r3)[1] > rem) t += 1 / 240; } else t += dt * C.stop.rate;
      A.stT = Math.min(SG.dur, t); if(A.stT >= SG.dur * C.stop.end){ settle(0, C.inert.half); A.slow = true; }
      else { A.EN = 0; put(SG, A.stT, (A.stT - t0) / dt, 1, false); A.legMode = 'stand'; A.hy *= Math.exp(-dt * C.turn.settle); return; } } }
  const want = P.stance === 'prone' ? 3 : P.stance === 'crouch' ? (A.st === 'kneel' ? (sm > C.kneel.stillV * 1.6 ? 1 : 2) : A.stillT > C.kneel.wait ? 2 : 1) : 0;
  if(A.st === 'trans'){ TR.t += dt * TR.rate;
    if(want !== TR.goal || TR.t >= TR.t1) route(TR.to, want, still);                               // done (or he changed his mind): on from where this clip leads
    else if(TR.to <= 1 && want <= 1 && A.spd > C.trans.cutV) settle(want, C.inert.stance); }       // already off at a run: no waiting for the clip
  else route(code(), want, still);
  if(A.st === 'trans'){ A.EN = 0; put(TR.g, Math.min(TR.t, TR.t1), TR.rate, 1, false); A.legMode = TR.to === 3 ? 'prone' : TR.to === 2 ? 'kneel' : 'stand'; }
  else if(A.st === 'loco'){ planLoco(dt); A.legMode = A.set === 'crouch' ? 'crouch' : 'stand'; }
  else if(A.st === 'kneel'){ const g = CLIPS.get(C.kneel.idle); A.kt = (A.kt + dt) % g.dur; A.EN = 0; put(g, A.kt, 1, 1, true); A.legMode = 'kneel'; }
  else { planProne(dt); A.legMode = 'prone'; }
  if(A.st !== 'loco') A.hy *= Math.exp(-dt * C.turn.settle); }
// a clip that came or went with weight between two frames (the phone cap, a hitch) is a cut too
function jumped(){ let j = false; for(let i = 0; i < A.EN && !j; i++){ let w = 0; for(let k = 0; k < A.PN; k++) if(PC[k] === EC[i]){ w = PW[k]; break; } if(Math.abs(EW[i] - w) > C.inert.jump) j = true; }
  for(let k = 0; k < A.PN && !j; k++){ let w = 0; for(let i = 0; i < A.EN; i++) if(EC[i] === PC[k]){ w = EW[i]; break; } if(Math.abs(PW[k] - w) > C.inert.jump) j = true; }
  A.PN = A.EN; for(let i = 0; i < A.EN; i++){ PC[i] = EC[i]; PW[i] = EW[i]; } return j; }

// ---- every frame, in place of the operator's own mixer update (actors/real-cav.js): true = the mixer has been run here ----
// cv = whose (only the player's: the hub's CV), R = cv.real, G = his rig group, P = updateRealCav's state, ok = the clip the game chose for him
export function graphPose(cv, R, G, dt, P, mounted, ok){
  if(!C.on && !A.live) return false;                                                               // the switch off: nothing here runs
  if(cv !== CV || !R.pup || !R.om || !(dt > 0)) return false;
  if(!A.ready){ if(C.on) boot(); return false; }
  if(A.R !== R && !bind(R)) return false; if(!A.B) return false;
  const t0 = performance.now(), B = A.B, ST = ANIMGRAPH_STAT;
  // what was written over the game's pose last frame is taken back first: its mixer only writes a value that changed, and reads none
  for(let i = 0; i < N; i++) if(WROTE[i]){ const o = i * 4; B[i].quaternion.set(OLD[o], OLD[o + 1], OLD[o + 2], OLD[o + 3]); WROTE[i] = 0; } if(WROTE[N]){ B[0].position.set(OLD[PO], OLD[PO + 1], OLD[PO + 2]); WROTE[N] = 0; }
  if(!C.on){ const L = R.ownLegs; if(L){ L.w = 0; L.on = false; L.mode = null; L.tr = null; L.prev = null; } reset(); ST.st = 'off'; R.om.update(dt); return true; }   // switched off while it ran: handed back whole
  const MV = P.move, own = !mounted && !P.dead && !P.trans && (!P.climb || P.climb === 'top') && !(MV && MV.roll >= 0 && !A.rollG) && !(MV && MV.air && !A.airOK);
  // his run clip (its shoulders are still his) keeps the graph's stride
  if(own && A.own && A.st === 'loco' && C.sync[ok] && R.OA && R.OA[ok] && Math.hypot(A.vl, A.vf) > 0.5){ const act = R.OA[ok]; let g = A.sync.get(ok);
    if(g === undefined){ g = mkClip(act.getClip(), null); if(g){ g.sp = 0; measure(g, 0, 1, false); } A.sync.set(ok, g || null); }
    if(g){ act.time = frac((A.cyc % g.cyc + A.ph) / g.cyc + g.ph) * g.dur; act.timeScale = 0; } }
  const t1 = performance.now(); R.om.update(dt); const t2 = performance.now();
  OLDP.set(OLD); for(let i = 0; i < N; i++) B[i].quaternion.toArray(OLD, i * 4); B[0].position.toArray(OLD, PO);
  if(!A.live){ A.live = ST.live = true; OLDP.set(OLD); OUT1.set(OLD); OUT2.set(OLD); A.dtPrev = dt; A.has = false; }
  // how he really moves over the ground, in his legs' own frame (the body's facing + the planted hips' turn)
  G.getWorldPosition(_v); G.getWorldQuaternion(_q); _a.set(0, 0, 1).applyQuaternion(_q); const psi = Math.atan2(_a.x, _a.z); let wx = 0, wz = 0;
  if(A.has){ wx = (_v.x - A.px) / dt; wz = (_v.z - A.pz) / dt; if(wx * wx + wz * wz > 400){ wx = wz = 0; A.feet[0].has = A.feet[1].has = false; A.feet[0].on = A.feet[1].on = false; } }   // (moved, not walking: a respawn)
  if(A.has && own && A.st === 'loco' && !A.turn && Math.hypot(A.vl, A.vf) < C.turn.moveV) A.hy = wrapA(A.hy - wrapA(psi - A.psi));   // stood still: the legs keep their heading as the body turns
  else if(A.has && A.turn) A.hyX -= wrapA(psi - A.psi);
  A.px = _v.x; A.pz = _v.z; A.has = true; A.psi = psi; A.spd = Math.hypot(wx, wz); A.clock += dt;
  const pl = psi + A.hy, vf = wx * Math.sin(pl) + wz * Math.cos(pl), vl = wx * Math.cos(pl) - wz * Math.sin(pl), kv = 1 - Math.exp(-dt * 0.6931 / C.velHalf); A.vf += (vf - A.vf) * kv; A.vl += (vl - A.vl) * kv;
  lean(dt, wx, wz, own);
  if(own !== A.own){ A.own = own; A.kick = Math.max(A.kick, C.inert.stance); if(!own){ A.st = 'off'; A.EN = 0; A.turn = null; A.cp = A.cpv = A.cO = 0; for(const F of A.feet) F.cy = F.cyv = 0; const L = R.ownLegs; if(L){ L.w = 0; L.on = false; L.mode = null; L.tr = null; L.prev = null; } } }
  if(own){ think(dt, P); if(jumped()) A.kick = Math.max(A.kick, C.inert.half); } else { A.hy *= Math.exp(-dt * C.turn.settle); A.PN = 0; }
  if(SH.g){ SH.t += dt * SH.rate; if(SH.t >= SH.t1){ if(SH.loop) SH.t -= SH.t1; else if(SH.hold) SH.t = SH.t1; else { SH.g = null; A.kick = Math.max(A.kick, SH.half); } } }
  // the target; on a cut, what is shown and how fast it was turning carry over as an offset that dies away
  target(TGT, 0, OLD); const sm = SH.g ? SH.mask : null; let any = false;
  for(let i = 0; i < N; i++){ NEED[i] = (own && M_BODY[i]) || (sm && sm[i]) || XON[i] ? 1 : 0; } NEED[N] = own || (sm && sm[0]) || XON[N] ? 1 : 0;
  if(A.kick > 0){ target(PRV, dt, OLDP); A.half = A.kick; ST.kicks++; const idp = 1 / Math.max(1e-3, A.dtPrev), idt = 1 / dt, vm = C.inert.vmax;
    for(let i = 0; i < N; i++){ const o = i * 4, x = i * 3; qmulc(OUT1, o, PRV, o); qlog(); const ax = RX, ay = RY, az = RZ; if(ax * ax + ay * ay + az * az < 1e-10 && !XON[i]) continue;
      qmulc(OUT1, o, OUT2, o); qlog(); let ux = RX * idp, uy = RY * idp, uz = RZ * idp; qmulc(TGT, o, PRV, o); qlog(); ux -= RX * idt; uy -= RY * idt; uz -= RZ * idt;
      const ul = Math.sqrt(ux * ux + uy * uy + uz * uz), k = ul > vm ? vm / ul : 1; X[x] = ax; X[x + 1] = ay; X[x + 2] = az; V[x] = ux * k; V[x + 1] = uy * k; V[x + 2] = uz * k; XON[i] = 1; NEED[i] = 1; }
    for(let c = 0; c < 3; c++){ const x = N * 3 + c; X[x] = OUT1[PO + c] - PRV[PO + c]; V[x] = clamp((OUT1[PO + c] - OUT2[PO + c]) * idp - (TGT[PO + c] - PRV[PO + c]) * idt, -6, 6); } XON[N] = 1; NEED[N] = 1; A.kick = 0; }
  const y = 2 * 0.6931 / Math.max(0.01, A.half), ey = Math.exp(-y * dt);   // a critically damped spring: x(t) = e^(−yt)·(x + (v + x·y)·t)
  for(let i = 0; i < N; i++){ const o = i * 4; if(!NEED[i]){ OUT[o] = TGT[o]; OUT[o + 1] = TGT[o + 1]; OUT[o + 2] = TGT[o + 2]; OUT[o + 3] = TGT[o + 3]; continue; }
    if(XON[i]){ const x = i * 3; let m = 0; for(let c = 0; c < 3; c++){ const j1 = V[x + c] + X[x + c] * y; X[x + c] = ey * (X[x + c] + j1 * dt); V[x + c] = ey * (V[x + c] - j1 * y * dt); m += X[x + c] * X[x + c] + V[x + c] * V[x + c] * 1e-3; }
      if(m < 1e-9){ XON[i] = 0; X[x] = X[x + 1] = X[x + 2] = V[x] = V[x + 1] = V[x + 2] = 0; } qexp(X[x], X[x + 1], X[x + 2]); qmulTo(TGT, o, OUT, o); }
    else { OUT[o] = TGT[o]; OUT[o + 1] = TGT[o + 1]; OUT[o + 2] = TGT[o + 2]; OUT[o + 3] = TGT[o + 3]; }
    B[i].quaternion.set(OUT[o], OUT[o + 1], OUT[o + 2], OUT[o + 3]); WROTE[i] = 1; any = true; }
  if(NEED[N]){ let m = 0; for(let c = 0; c < 3; c++){ const x = N * 3 + c; if(XON[N]){ const j1 = V[x] + X[x] * y; X[x] = ey * (X[x] + j1 * dt); V[x] = ey * (V[x] - j1 * y * dt); m += X[x] * X[x] + V[x] * V[x] * 1e-3; } OUT[PO + c] = TGT[PO + c] + X[x]; }
    if(XON[N] && m < 1e-10){ XON[N] = 0; for(let c = 0; c < 3; c++) X[N * 3 + c] = V[N * 3 + c] = 0; } B[0].position.set(OUT[PO], OUT[PO + 1], OUT[PO + 2]); WROTE[N] = 1; }
  else { OUT[PO] = TGT[PO]; OUT[PO + 1] = TGT[PO + 1]; OUT[PO + 2] = TGT[PO + 2]; }
  OUT2.set(OUT1); OUT1.set(OUT); A.dtPrev = dt;
  A.ms = t1 - t0 + (performance.now() - t2); ST.st = own ? A.st : any ? 'handing' : 'off'; ST.set = A.set; ST.clips = own ? A.EN : 0; ST.rate = A.rate; ST.phase = A.ph;
  return true; }

// ---- his feet (in place of actors/soldier-legs.js while the graph has his legs): true = the legs are the graph's this frame ----
function rotW(b, q){ b.getWorldQuaternion(_qw); _qw.premultiply(q); b.parent.getWorldQuaternion(_qp); b.quaternion.copy(_qp.invert().multiply(_qw)); b.updateMatrixWorld(true); }
// the ankle to (tx, ty, tz): the knee keeps the side it bends to; the foot keeps the tilt the clip gave it. false = out of reach (the leg is laid straight at it)
// GRAPH 6 a leg is never laid dead straight: from reach.soft of its length the reach eases toward reach.max (IKS = how far short it falls); it gives up
//   (false) only past reach.let short — at the hard limit a locked foot was let go and caught again on alternate frames: the knee snapping at toe-off
let IKS = 0;
function legIK(up, lg, ft, tx, ty, tz){ up.getWorldPosition(_h); lg.getWorldPosition(_k); ft.getWorldPosition(_f); ft.getWorldQuaternion(_fq); IKS = 0;
  const l1 = _h.distanceTo(_k), l2 = _k.distanceTo(_f), FR = GRAPHFIT.reach, soft = GRAPHFIT.on, max = (l1 + l2) * (soft ? FR.max : C.feet.stretch); _t.set(tx, ty, tz).sub(_h); let d = _t.length(), ok = true; if(d < 1e-5) return true; _e.copy(_t).divideScalar(d);
  if(soft){ const s0 = Math.max((l1 + l2) * FR.soft, Math.min(_h.distanceTo(_f), max - 1e-4)); if(d > s0){ const w = max - s0, d1 = s0 + w * (1 - Math.exp(-(d - s0) / w)); IKS = d - d1; d = d1; if(IKS > FR.let) ok = false; } }   // (from the clip's own reach, never short of it: a leg the clip lays out straight — lying down — is not pulled in)
  else if(d > max){ d = max; ok = false; } d = Math.max(d, Math.abs(l1 - l2) + 1e-3);
  _c.subVectors(_f, _h); const c0 = _c.length(); if(c0 < 1e-5) return ok; _c.divideScalar(c0); _n.subVectors(_k, _h); _n.addScaledVector(_c, -_n.dot(_c));   // the knee's own side of the hip → ankle line
  if(_n.lengthSq() < 1e-8){ _n.set(0, 0, 1).applyQuaternion(_fq); _n.addScaledVector(_c, -_n.dot(_c)); if(_n.lengthSq() < 1e-8) return ok; } _n.normalize(); _n.applyQuaternion(_q.setFromUnitVectors(_c, _e));
  const ca = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), sa = Math.sqrt(1 - ca * ca); _c.copy(_e).multiplyScalar(ca).addScaledVector(_n, sa);   // where the thigh must point
  _k.sub(_h).normalize(); rotW(up, _q.setFromUnitVectors(_k, _c)); lg.getWorldPosition(_k); ft.getWorldPosition(_f); _f.sub(_k).normalize(); _c.copy(_h).addScaledVector(_e, d).sub(_k).normalize(); rotW(lg, _q.setFromUnitVectors(_f, _c));
  lg.getWorldQuaternion(_qp); ft.quaternion.copy(_qp.invert().multiply(_fq)); ft.updateMatrixWorld(true); return ok; }
// GRAPH 6 the boot as the ground meets it: the skinned vertices riding each foot / toe bone (bone-local, from the bind) cut down to the extreme one along each of
//   98 directions (however the foot is turned its lowest point is near one of them) → per foot [bone, x, y, z, …]; false when the rig has no skinned feet
const HULL = []; for(let x = -2; x <= 2; x++) for(let y = -2; y <= 2; y++) for(let z = -2; z <= 2; z++) if(Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) === 2) HULL.push([x, y, z]);
function soleHull(R){ const ft = new Map(); for(let s = 0; s < 2; s++) for(let j = 2; j < 4; j++) if(A.legs[s][j]) ft.set(A.legs[s][j], s);
  const pts = new Map(), root = R.pup && R.pup.dst; if(!root || ft.size < 4) return false;
  root.traverse(o => { const g = o.geometry, sk = o.skeleton; if(!o.isSkinnedMesh || !sk || !g) return; const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, Pa = g.attributes.position, B = sk.bones; if(!si || !sw || !Pa || !B.some(b => ft.has(b))) return;
    for(let i = 0; i < Pa.count; i++){ let bi = -1, bw = 0; for(let k = 0; k < 4; k++){ const w = sw.getComponent(i, k); if(w > bw){ bw = w; bi = si.getComponent(i, k); } } const b = B[bi]; if(bw < 0.5 || !ft.has(b) || !sk.boneInverses[bi]) continue;
      _v.fromBufferAttribute(Pa, i).applyMatrix4(o.bindMatrix).applyMatrix4(sk.boneInverses[bi]); let L = pts.get(b); if(!L) pts.set(b, L = []); L.push(_v.x, _v.y, _v.z); } });
  const out = [[], []]; for(const [b, L] of pts){ const pick = new Set(); for(const d of HULL){ let bi = 0, bv = -Infinity; for(let i = 0; i < L.length; i += 3){ const v = L[i] * d[0] + L[i + 1] * d[1] + L[i + 2] * d[2]; if(v > bv){ bv = v; bi = i; } } pick.add(bi); }
    for(const i of pick) out[ft.get(b)].push(b, L[i], L[i + 1], L[i + 2]); }
  return out[0].length && out[1].length ? out : false; }
export function graphFeet(cv, R, G, dt, P){ if(cv !== CV || !A.live || !A.own || A.R !== R) return false;
  const L = legState(R); L.w = 1; L.on = true; L.mode = A.legMode; L.tr = null; L.feet[0].sw = L.feet[1].sw = null;   // (for the readers of his legs' state: the clip the game picks, the upper body)
  const Fc = C.feet, t0 = performance.now(), ST = ANIMGRAPH_STAT; if(!Fc.on || !(dt > 0)){ ST.frames++; ST.ms = A.ms; ST.msSum += A.ms; if(A.ms > ST.msMax) ST.msMax = A.ms; return true; }
  fkFeet(OUT, FK); const can = (A.st === 'loco' || A.st === 'stop' || A.st === 'kneel' || (A.st === 'trans' && TR.feet) || (A.st === 'air' && A.air === 3)) && !(SH.g && SH.mask[LEG0]), sp = A.spd, y0 = 2 * 0.6931 / Fc.half, ey0 = Math.exp(-y0 * dt), y1 = 2 * 0.6931 / Fc.stepHalf, ey1 = Math.exp(-y1 * dt), y2 = 2 * 0.6931 / GRAPHFIT.release.half, ey2 = Math.exp(-y2 * dt); let locks = 0;
  // GRAPH 6 the hips as last frame's fit left them: down / up for the boots (below), and on his belly ahead / behind on the crawl's own surge (planProne)
  if(GRAPHFIT.on && A.sole === null) A.sole = soleHull(R);
  if(A.cO){ A.cO -= A.cO * Math.min(1, dt * GRAPHFIT.crawl.leak[A.st === 'prone' ? 0 : 1]); if(Math.abs(A.cO) < 1e-4) A.cO = 0; }
  if(A.cp || A.cO){ const hip = A.legs[0][0] && A.legs[0][0].parent; if(hip){ hip.getWorldPosition(_v); const pl = A.psi + A.hy; _v.x += Math.sin(pl) * A.cO; _v.y -= A.cp; _v.z += Math.cos(pl) * A.cO; hip.parent.worldToLocal(_v); hip.position.copy(_v); hip.updateMatrixWorld(true); } }
  for(let s = 0; s < 2; s++){ const F = A.feet[s], L4 = A.legs[s], up = L4[0], lg = L4[1], ft = L4[2], tb = L4[3]; if(!up || !lg || !ft || !tb) continue;
    ft.getWorldPosition(_a); tb.getWorldPosition(_b); const h = Math.min(FK[s * 6 + 1] - A.ank0 + Fc.heel, FK[s * 6 + 4] - A.toe0), va = F.has ? Math.hypot(_b.x - F.px, _b.z - F.pz) / dt : 99;   // how high the clip holds this foot, how fast it carries its ball over the ground
    // held from the moment it comes down — slow over the ground, or still fast but braking and not rising (a sprint's foot lands skidding in the clip) —
    //   until the clip lifts it, or carries it off faster and faster (a low swing). Under slowV (pulling up, setting off, edging along) a foot the clip has
    //   on the ground is simply held: a pose that changes under a body that is not going anywhere must not drag his feet — it steps when the leg runs out
    // down from a jump at a run: the foot the stride stands on is planted where it came down; the other is already on its way — lifted off at once, not dragged
    if(A.landFoot >= 0 && can && F.has){ if(A.landFoot === s){ if(!F.on && h < Fc.hOff){ F.on = true; F.rest = false; F.lx = F.px + F.ox; F.lz = F.pz + F.oz; } } else { F.on = false; F.fly = Fc.flyT; } if(s) A.landFoot = -1; }
    if(F.fly > 0){ F.fly -= dt; if(h > Fc.hOff) F.fly = 0; }
    // GRAPH 3 below a run (a walk, a change of direction, setting off) a planted foot is not let go just because the blend carries its pose off fast — that
    //   dragged it along the ground: it stays put until the clip lifts it, or, pulled more than feet.pull from where the clip wants it, it STEPS there (below)
    if(F.on && can && sp > Fc.slowV && sp < Fc.vRelV && h <= Fc.hOff && Math.hypot(F.ox, F.oz) > Fc.pull && !A.feet[1 - s].rest){ F.on = false; F.rest = true; F.st = -1; F.o0 = Math.hypot(F.ox, F.oz); F.ovx = F.ovz = 0; }
    if(F.on){ if(!can || h > Fc.hOff || (sp > Fc.vRelV && va > Fc.vOff[0] + Fc.vOff[1] * sp && va > F.va)){ F.on = false; const k = va > Fc.peel ? Fc.peel / va : 1; F.ovx = -(_b.x - F.px) / dt * k; F.ovz = -(_b.z - F.pz) / dt * k; F.rl = GRAPHFIT.on && sp > Fc.vRelV; } }   // let go: it leaves the ground from rest, then catches the clip up
    else if(can && F.has && !F.rest && !(F.fly > 0) && h < Fc.hOn && (sp < Fc.slowV || (Fc.walkLock && sp < Fc.vRelV && h <= F.h + 0.001) || va < Fc.vOn[0] + Fc.vOn[1] * sp || (sp > Fc.landV && va < Fc.vLand[0] + Fc.vLand[1] * sp && va < F.va - Fc.brake * dt && h < F.h + 0.002))){ F.on = true; F.lt = 0; F.rl = false; const rx = F.px - _b.x, rz = F.pz - _b.z, rl = Math.hypot(rx, rz), rk = rl > Fc.retro ? Fc.retro / rl : 1; F.lx = _b.x + F.ox + rx * rk; F.lz = _b.z + F.oz + rz * rk;   // down: held where it was SHOWN a frame ago (no further back than `retro`) — it does not move on the frame it lands either
      if(sp > Fc.stepV && A.clock - F.last > Fc.stepGap){ F.last = A.clock; afxFoot(S.player, F.lx, F.lz, sp); } }
    // stood still a while on feet left a stride apart — or gone onto a knee / changing stance, where the clip's own footing matters at once: one at a
    //   time, the further one steps (lifted) to where the clip stands it
    if(F.on && (A.st === 'loco' ? A.idleT > Fc.restT && !A.turn : A.st !== 'stop' && sp < Fc.slowV)){ const O = A.feet[1 - s], d2 = F.ox * F.ox + F.oz * F.oz; if(d2 > Fc.rest * Fc.rest && !O.rest && d2 >= O.ox * O.ox + O.oz * O.oz){ F.on = false; F.rest = true; F.st = -1; F.o0 = Math.sqrt(d2); F.ovx = F.ovz = 0; } }
    // GRAPH 6 A RUNNING FOOT SETTLES AS IT LANDS: the clip's foot comes down still travelling (~3 m/s) and stops a few cm on — held at first touch, that
    //   gap (10–17 cm) was carried through the stance and whipped back at toe-off (the knee's snap). For land.t after touching down at speed the hold
    //   eases onto where the clip stands it (time constant land.tau): it stops over a few frames instead of in one, and leaves the ground where the clip does
    if(F.on && GRAPHFIT.on && sp > GRAPHFIT.land.v[0] && sp < GRAPHFIT.land.v[1] && F.lt < GRAPHFIT.land.t){ const k = 1 - Math.exp(-dt / GRAPHFIT.land.tau); F.lx += (_b.x - F.lx) * k; F.lz += (_b.z - F.lz) * k; }
    if(F.on){ F.lt = (F.lt || 0) + dt; F.ox = F.lx - _b.x; F.oz = F.lz - _b.z; locks++; }
    // GRAPH 3 A STEP IS A STEP: up, over, down — the foot leaves the ground before it travels and is down before it stops (a timed arc of feet.stepT ×
    //   its length), never a glide along the ground that only lifts in the middle
    else if(F.rest && F.st !== undefined && Fc.arc){ if(F.st < 0){ F.st = 0; F.rx = F.ox; F.rz = F.oz; F.o0 = Math.max(F.o0 || 0, Math.hypot(F.ox, F.oz)); } F.st += dt; const T = clamp(Fc.stepT[0] + Fc.stepT[1] * F.o0, Fc.stepT[0], Fc.stepT[2]), u = Math.min(1, F.st / T), k = 1 - smooth(clamp((u - Fc.stepWin[0]) / (Fc.stepWin[1] - Fc.stepWin[0]), 0, 1));   // (it travels only while well clear of the ground)
      F.ox = F.rx * k; F.oz = F.rz * k; F.ovx = F.ovz = 0; if(u >= 1){ F.rest = false; F.ox = F.oz = 0; } }
    else if(F.ox || F.oz){ const y = F.rest ? y1 : F.rl ? y2 : y0, ey = F.rest ? ey1 : F.rl ? ey2 : ey0, jx = F.ovx + F.ox * y, jz = F.ovz + F.oz * y;   // (GRAPH 6 let go at a run: its gap closes over the swing, GRAPHFIT.release.half)   // (a deliberate step takes its time)
      F.ox = ey * (F.ox + jx * dt); F.ovx = ey * (F.ovx - jx * y * dt); F.oz = ey * (F.oz + jz * dt); F.ovz = ey * (F.ovz - jz * y * dt); if(F.ox * F.ox + F.oz * F.oz < 1e-8) F.ox = F.oz = F.ovx = F.ovz = 0; }
    // GRAPH 5 NO BLEND DRAGS A FOOT: a foot that is not planted, low, and carried fast over the ground by the pose (the blend's weights swinging at a change of
    //   direction, a stance coming in, the stop's last shuffle) is lifted clear — at least feet.drag[2] off the ground for as long as it travels — so it
    //   steps through the air instead of skating; it comes down as it slows (and is planted where it lands)
    const drag = Fc.drag && !F.on && can && sp < Fc.drag[3] && h < Fc.hOn && va > Fc.drag[0] + Fc.drag[1] * sp ? Math.max(0, Fc.drag[2] - Math.max(0, h)) : 0;
    let lift = 0; if(F.rest && !Fc.arc){ const o = Math.hypot(F.ox, F.oz), u = F.o0 > 1e-4 ? 1 - o / F.o0 : 1; if(o < Fc.rest * 0.12 || sp > Fc.slowV * 2) F.rest = false; else lift = Math.min(Fc.liftMax, Fc.lift * F.o0) * 4 * u * (1 - u); } else if(F.rest){ {   /* (a step once begun is finished, whatever the speed does meanwhile) */ const T = clamp(Fc.stepT[0] + Fc.stepT[1] * F.o0, Fc.stepT[0], Fc.stepT[2]), u = Math.min(1, Math.max(0, F.st) / T); lift = Math.max(Fc.liftMin, Math.min(Fc.liftMax, Fc.lift * F.o0)) * Math.sin(Math.PI * u); } } if(F.fly > 0) lift = Fc.liftMax; if(drag > lift) lift = drag; if(lift > 0 && h < 0) lift -= Math.max(h, -0.05);   // (clearance over the ground, wherever the clip holds the foot)
    if(F.rest && Fc.arc && !drag) F.ly = lift; else F.ly += (lift - F.ly) * Math.min(1, dt * (drag && F.ly < lift ? Fc.dragRate : 30));   // (a step's arc is its own curve; a drag is lifted quickly — in a few frames, not one: no pop)
    F.px = _b.x; F.pz = _b.z; F.by = _b.y - _a.y; F.has = true; F.h = h; F.va = va; F.ax = _a.x; F.ay = _a.y; F.az = _a.z; F.fl = Math.hypot(_b.x - _a.x, _b.z - _a.z); }
  // GRAPH 6 THE BOOTS ON THE GROUND: each boot's lowest point (A.sole: the skinned mesh's hull on the foot / toe bones) over the ground — a planted foot is put
  //   on it, any other kept out of it (kneeling, lying, changing stance: lifted only); on the move the hips (next frame, above) come down when even the lower
  //   foot floats higher than a stride at this speed lifts it (GRAPHFIT.contact.flight: a run's own flight is left alone), and up when it would go in
  { const CF = GRAPHFIT.contact, fit = GRAPHFIT.on && CF.on && !!A.sole && A.st !== 'roll' && A.st !== 'off' && (A.st !== 'air' || A.air === 3), onM = A.st === 'loco' || A.st === 'stop' || A.st === 'air'; let lo = 1e9;
    if(fit){ const g0 = soleAt(A.px, A.pz); for(let s = 0; s < 2; s++){ const F = A.feet[s], P = A.sole[s]; let m = 1e9; for(let i = 0; i < P.length; i += 4){ const e = P[i].matrixWorld.elements, y = e[1] * P[i + 1] + e[5] * P[i + 2] + e[9] * P[i + 3] + e[13]; if(y < m) m = y; } F.se = m - g0 + F.ly; if(F.se < lo) lo = F.se; } }
    const lc = lo + A.cp, al = CF.flight[0] + CF.flight[1] * Math.max(0, sp - CF.flight[2]), pt = !fit || !onM ? 0 : lc > al ? Math.min(CF.hip[0], lc - al) : lc < 0 ? Math.max(-CF.hip[1], lc) : 0;   // (the lower foot as the clip has it: the hips are already down by cp)
    let y = 2 * 0.6931 / CF.half, ey = Math.exp(-y * dt), j = A.cpv + (A.cp - pt) * y; A.cp = pt + ey * (A.cp - pt + j * dt); A.cpv = ey * (A.cpv - j * y * dt); if(Math.abs(A.cp) + Math.abs(A.cpv) < 1e-6) A.cp = A.cpv = 0;
    y = 2 * 0.6931 / CF.foot; ey = Math.exp(-y * dt);
    for(let s = 0; s < 2; s++){ const F = A.feet[s], pl = fit && onM && F.on, w = !fit ? 0 : clamp(pl ? -F.se : Math.max(0, -F.se), -CF.max, CF.max); j = F.cyv + (F.cy - w) * y; F.cy = w + ey * (F.cy - w + j * dt); F.cyv = ey * (F.cyv - j * y * dt);
      if(fit && !pl && F.cy < w){ F.cy = w; F.cyv = 0; } if(Math.abs(F.cy) + Math.abs(F.cyv) < 1e-6) F.cy = F.cyv = 0; } }   // (out of the ground at once; onto it on a spring)
  // SLOPE 1 THE GROUND UNDER EACH FOOT (as the old legs had it — actors/soldier-legs.js; its numbers kept: GUNFEEL.feet.slope, SOLDIER_LEGS.maxDrop): a
  //   foot stands on the ground under IT, not on the level through his middle — up onto a rise at once (it must clear it), down into a dip only as it
  //   comes down; his hips ride the mean of the two (so crossing a step he rises through it, not at its edge) and come down further, at most maxDrop,
  //   when the lower leg would run out; a planted foot lies along the slope under it
  const SL = C.slope, GS = GUNFEEL.feet.slope, onG = SL.on && can && A.st !== 'air'; let dH = 0;
  if(SL.on){ const base = soleAt(A.px, A.pz), dmax = SL.vmax * dt, HF = C.stop.hipMin; let any = A.hipDrop !== 0;
    // GRAPH 3 pulling up he brakes on a long step, but his hips stay up over it (the clip sinks them ~0.3 m: it read as a fall): lifted to no lower than
    //   stop.hipMin above the ground, smoothly (a soft floor `hipSoft` wide), the feet kept where they are — the knees straighten, nothing else moves
    { const hip = A.legs[0][0] && A.legs[0][0].parent; let want = 0; if(hip && HF > 0 && A.st === 'stop'){ hip.getWorldPosition(_v); const hh = _v.y - base, w = C.stop.hipSoft; want = hh >= HF + w ? 0 : hh <= HF - w ? HF - hh : (HF + w - hh) * (HF + w - hh) / (4 * w); }
      A.hipLift += (want - A.hipLift) * Math.min(1, dt * (want > A.hipLift ? 30 : 8)); if(A.hipLift < 1e-4 && !want) A.hipLift = 0; if(A.hipLift) any = true; }   // (kept in WORLD heights, so the level through his middle jumping at a kerb moves nothing that is seen)
    for(let s = 0; s < 2; s++){ const F = A.feet[s], x = F.px + F.ox, z = F.pz + F.oz; let g = onG ? soleAt(x, z) : base; if(g < base) g = base + (g - base) * (1 - clamp(F.h / SL.fade, 0, 1)); g = clamp(g, base - SL.max, base + SL.max);
      if(!F.gok){ F.gok = true; F.wy = g; } F.wy += clamp(g - F.wy, -dmax, dmax); F.gy = F.wy - base; if(Math.abs(F.gy) < 1e-4) F.gy = 0; else any = true;
      // the slope along the foot, read again only when the planted foot is somewhere new
      if(onG && F.on){ if(F.gx !== F.lx || F.gz !== F.lz){ F.gx = F.lx; F.gz = F.lz; A.legs[s][3].getWorldPosition(_b); let fx = _b.x - F.ax, fz = _b.z - F.az; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
          F.gT = clamp(Math.atan2(soleAt(x + fx * GS.ahead, z + fz * GS.ahead) - soleAt(x - fx * GS.back, z - fz * GS.back), GS.ahead + GS.back), -GS.max, GS.max) * GS.k; } }
      else { F.gT = 0; F.gx = 1e9; } F.gs += (F.gT - F.gs) * Math.min(1, dt * GS.rate); if(Math.abs(F.gs) < 1e-4 && !F.gT) F.gs = 0; }
    if(any){ const F0 = A.feet[0], F1 = A.feet[1], hip = A.legs[0][0] && A.legs[0][0].parent, hy = (F0.gy + F1.gy) / 2; let drop = 0;
      for(let s = 0; s < 2; s++){ const F = A.feet[s], up = A.legs[s][0]; if(!F.on || !up) continue; up.getWorldPosition(_h); const hd = Math.hypot(F.ax + F.ox - _h.x, F.az + F.oz - _h.z), rr = (GRAPHFIT.on && GRAPHFIT.hipDrop ? A.legLen : NaN) * Fc.stretch;   // low enough for a standing leg to reach (GRAPH 7: A.legLen was never set — NaN, no drop — before)
        if(hd < rr) drop = Math.max(drop, _h.y + hy - (F.ay + F.gy - F.fl * Math.sin(F.gs) + Math.sqrt(rr * rr - hd * hd))); }
      drop = Math.min(drop, SOLDIER_LEGS.maxDrop); A.hipDrop += (drop - A.hipDrop) * Math.min(1, dt * SL.rate * (drop > A.hipDrop ? 3 : 1));   // (down at once for a leg that runs out, back up at ease)
      if(A.hipDrop < 1e-4 && !drop) A.hipDrop = 0; dH = hy - A.hipDrop + A.hipLift;
      if(dH && hip){ hip.getWorldPosition(_v); _v.y += dH; hip.parent.worldToLocal(_v); hip.position.copy(_v); hip.updateMatrixWorld(true); } } }
  for(let s = 0; s < 2; s++){ const F = A.feet[s], L4 = A.legs[s], up = L4[0], lg = L4[1], ft = L4[2], tb = L4[3]; if(!up || !lg || !ft || !tb) continue;
    const gy = F.gy - F.fl * Math.sin(F.gs);   // (the ball on the ground under it: laid along the slope, the ankle sits that much lower / higher)
    if(F.ox || F.oz || F.ly > 1e-4 || F.cy || Math.abs(gy - dH) > 1e-4){ if(!legIK(up, lg, ft, F.ax + F.ox, F.ay + F.ly + F.cy + gy, F.az + F.oz) && F.on && (F.ox * F.ox + F.oz * F.oz > 1e-4) && !(sp < Fc.vRelV && A.feet[1 - s].rest)){ F.on = false; F.ovx = F.ovz = 0; tb.getWorldPosition(_b); F.ox = _b.x - F.px; F.oz = _b.z - F.pz; if(sp < Fc.vRelV){ F.rest = true; F.st = -1; F.o0 = Math.hypot(F.ox, F.oz); } }
      else if(F.on && IKS > 1e-4){ ft.getWorldPosition(_a); tb.getWorldPosition(_b); _e.subVectors(_b, _a); _t.set(F.lx, F.ay + F.ly + F.cy + gy + F.by, F.lz).sub(_a);   // GRAPH 7 THE HEEL COMES UP: the leg held as far as it reaches, the
        if(_e.lengthSq() > 1e-8 && _t.lengthSq() > 1e-8){ _e.normalize(); _t.normalize(); if(_e.dot(_t) > GRAPHFIT.reach.heel) rotW(ft, _q.setFromUnitVectors(_e, _t)); else { F.on = false; F.ovx = F.ovz = 0; tb.getWorldPosition(_b); F.ox = _b.x - F.px; F.oz = _b.z - F.pz; } } } }   //   foot turns on its ball so the ball stays where it was put (GRAPH 6 let the ball go along with the leg: 1.1–1.3 m/s at a sprint); past reach.heel it is let go from where the leg got
    if(F.gs){ ft.getWorldPosition(_a); tb.getWorldPosition(_b); _b.sub(_a); _b.y = 0; if(_b.lengthSq() > 1e-8){ _b.normalize(); rotW(ft, _q.setFromAxisAngle(_n.set(-_b.z, 0, _b.x), F.gs)); } } }   // (about the line across the foot: toes up the slope)
  ST.locks = locks; A.ms += performance.now() - t0; ST.frames++; ST.ms = A.ms; ST.msSum += A.ms; if(A.ms > ST.msMax) ST.msMax = A.ms; return true; }
// the planted hips' turn against the body (the operator is turned by it, the chest's twist takes it back), and whether the graph has his legs
export function graphHipYaw(cv, hy){ return cv === CV && A.live && A.own ? A.hy : hy; }
export function graphOwned(cv){ return cv === CV && A.live && A.own; }
export function graphRolls(){ return A.live && A.own && A.st === 'roll'; }   // (game/soldier-moves.js: the clip rolls him — the body is not also turned over as one piece)
export const graphState = () => A;   // (dev: a probe reads the phase, the feet, the planted turn)

// ---- one-shots for the steps to come: a library clip over the body (or its upper / lower half), cut in and out by the same inertialization ----
// opts: mask 'full' | 'upper' | 'lower' · rate · from / to (s) · hold (stay on the last frame until graphStop) · loop · half (the cut's half-life, s).
// → true = playing. false = not yet: the graph is off / not up, or the clip's group is still on its way (it is fetched now: ask again)
export function graphPlay(id, opts){ if(!C.on || !A.ready || !A.live) return false; const o = opts || {}, g = clipOf(id);
  if(!g){ const m = animInfo(id); if(m) loadAnimGroup(m.g); return false; }
  SH.g = g; SH.mask = o.mask === 'upper' ? M_UP : o.mask === 'lower' ? M_LOW : M_ALL; SH.rate = o.rate || C.shot.rate; SH.t = o.from || 0; SH.t1 = Math.min(g.dur, o.to || g.dur); SH.hold = !!o.hold; SH.loop = !!o.loop; SH.half = o.half || C.shot.half;
  A.kick = Math.max(A.kick, SH.half); return true; }
export function graphStop(half){ if(!SH.g) return; SH.g = null; A.kick = Math.max(A.kick, half || SH.half); }
export function graphBusy(){ return SH.g ? SH.g.id : null; }
