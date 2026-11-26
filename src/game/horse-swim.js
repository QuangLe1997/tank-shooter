// game/horse-swim.js — HSWIM 1 THE HORSE SWIMS (config HORSESWIM): the war horse in the river by the depth under it (RIVER.y − the bed). Wading it slows with the
//   depth (wadeV), every hoof that comes down in the water throws a splash instead of dust, and deeper than the knee a wake and rings spread from it. Past
//   HORSESWIM.deep[0] it loses the bed and SWIMS: its body floats (the back line and the saddle just over the surface, the neck and head stretched up out of it,
//   the croup low), bobbing and rolling with the water, at a swimming horse's pace (v), turning slowly, no gallop; its legs paddle under it — the library's
//   walk at a shortened stride (the Idle clip mixed in, actors/real-cav.js poseRealCav) — and the water breaks at its chest every stroke. The rider stays in
//   the saddle (his legs in the water); from a swimming horse he does not fire, throw or use a medkit (one hand on the mane), and neither gets off nor on.
//   It comes out the way it went in: its hooves find the bed, its height eases down onto it, the pitch and the paddle fade back into the gait.
//   The riderless horse answering a whistle swims the same way; the co-op page's puppet of a mounted player reads the same depth (no new bit on the wire:
//   its height comes over as ever in the state's y, the paddle and pose from the depth there — net/protocol.js unchanged). No enemy rides a horse.
import * as THREE from 'three';
import { HORSESWIM } from '../../config.js';
import { CV, RIVER, S, SWST, TIPS, TIP_SHOW, afxHoof, afxOn, floatText, heightAt, spawnPart, swimFxKit, tip, turnBone } from '../hub.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
// mode 'dry' | 'wade' | 'swim' · d the depth under it · k 0–1 the swim eased in (legs, pitch, neck) · y its eased height (null: on the bed) · t the bob's clock
//   · paddleT / wakeT / ringT the water's timers · noteAt the last "can't do that" · swims how many times it has swum · ms / n what it costs (the probe)
function st(H){ return H.hsw || (H.hsw = { mode:'dry', d:0, k:0, y:null, t:0, px:null, pz:null, paddleT:0, wakeT:0, ringT:0, noteAt:-9, swims:0, ms:0, n:0 }); }
export const HSWST = { own:null };   // (the player's horse's state, for the probe and the tests)
const swimming = H => !!(H && H.hsw && H.hsw.mode === 'swim');
export const horseSwimming = () => HORSESWIM.on && !!CV.H && !CV.H.bike && swimming(CV.H);

// ---- every frame, for a horse at (x, z) whose bed is at `bed`, moving at v m/s: its state, and the height to put its root (hooves' plane) at ----
//   own: the player's horse (the water's splashes, wake and rings, the note on entering); the co-op puppet only takes the state (its height comes over the wire)
export function horseSwimStep(H, x, z, bed, v, dt, own){ const C = HORSESWIM; if(!H || H.bike) return bed; const W = st(H), t0 = own ? performance.now() : 0;
  if(!C.on || !RIVER.on || RIVER.ice && RIVER.y - bed < 0.05){ W.mode = 'dry'; W.d = 0; W.k = 0; W.y = null; return bed; }
  if(W.px != null && Math.abs(x - W.px) + Math.abs(z - W.pz) > 4) W.y = null;   // (a respawn / a jump across the map: put down where it is, not eased from where it was)
  W.px = x; W.pz = z; const d = RIVER.y - bed, sw = W.mode === 'swim' ? d > C.deep[1] : d > C.deep[0]; W.d = d;
  if(sw && W.mode !== 'swim'){ W.swims++; if(own && CV.mounted) enter(); }
  W.mode = sw ? 'swim' : d > 0.03 ? 'wade' : 'dry'; W.k = clamp(W.k + (sw ? dt : -dt) / C.k, 0, 1); W.t += dt;
  let y = bed;
  if(sw){ const bob = Math.sin(W.t * C.bob[1]) * C.bob[0], tgt = Math.max(bed, RIVER.y - C.float + bob); if(W.y == null) W.y = bed; W.y += (tgt - W.y) * Math.min(1, dt * C.yRate); y = Math.max(bed, W.y); }
  else if(W.y != null){ W.y += (bed - W.y) * Math.min(1, dt * C.yRate * 1.4); if(W.y - bed < 0.01) W.y = null; else y = Math.max(bed, W.y); }   // (its hooves find the bed: it settles onto it, never dropped)
  if(own){ HSWST.own = W; water(H, W, x, z, v, dt); W.ms += performance.now() - t0; W.n++; }
  return y; }
function enter(){ const p = S.player; if(!p) return;
  if(!HSWST.warned){ HSWST.warned = true; if(TIPS && !TIPS.horseSwim){ TIPS.horseSwim = ['spark', 'Ngựa bơi qua sông', 'Nước sâu quá lưng ngựa thì <b>ngựa bơi</b>: chậm (~1,8 m/s), xoay chậm, <b>không phi nước đại</b>. Anh giữ bờm và cương — <b>không bắn, không ném</b> được, không xuống ngựa giữa dòng. Chân ngựa chạm đáy thì nó lội lên bờ.']; TIP_SHOW.horseSwim = 1; } tip('horseSwim'); }
  floatText('NGỰA ĐANG BƠI', '#9fd8e8', p.pos, 15); }

// ---- the water round the player's horse: a wake astern and rings spreading while it wades deep or swims, the water breaking at its chest each stroke ----
function water(H, W, x, z, v, dt){ const F = HORSESWIM.fx, K = swimFxKit; if(CV.mounted || SWST.mode === 'dry' && SWST.y == null) K.rings(dt); if(S.mode !== 'playing' || W.mode === 'dry') return;   // (the rings' clock: swim.js ticks it only while the man on foot is in the water)
  const deep = W.mode === 'swim' || W.d > HORSESWIM.wakeD, f = CV.mounted ? CV.facing : (H.root ? H.root.rotation.y : 0), fx = Math.sin(f), fz = Math.cos(f), col = 0xe8f2f4;
  if(deep && v > 0.3){ W.wakeT -= dt; if(W.wakeT <= 0){ W.wakeT = F.wake; for(const s of [-1, 1]){ const bx = x - fx * 1.0 + fz * s * 0.45, bz = z - fz * 1.0 - fx * s * 0.45;
      spawnPart(bx, RIVER.y + 0.04, bz, -fx * 0.35 + fz * s * 0.25, 0.05, -fz * 0.35 - fx * s * 0.25, { color:col, size:0.2, life:0.8, smoke:true, grav:0, drag:3, grow:0.35, op:F.wakeOp, keep:true }); } } }   // (the wake: two lines of puffs off its flanks, drifting out)
  if(deep){ W.ringT -= dt * (v > 0.3 ? 1.5 : 1); if(W.ringT <= 0){ W.ringT = F.ring * (0.8 + Math.random() * 0.4); K.ring(x + fx * (0.6 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.5, z + fz * (0.6 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.5); } }
  if(W.mode === 'swim'){ W.paddleT -= dt * (0.8 + Math.min(1, v / HORSESWIM.v) * 0.5); if(W.paddleT <= 0){ W.paddleT = F.paddle * (0.85 + Math.random() * 0.3); const cx = x + fx * 1.05, cz = z + fz * 1.05;
      K.splash(cx, cz, 3 + (v > 0.6 ? 2 : 0), 1.1); K.sound('stroke', { x:cx, y:RIVER.y, z:cz }, 0.85, 0.72 + Math.random() * 0.08); } } }   // (a foreleg breaking the water: lower than a man's stroke)

// ---- game/cavalry.js hoofFall: a hoof coming down in the water splashes (no dust, its own sound by the surface); afloat no hoof strikes at all → true: done ----
export function horseSwimHoof(H, x, z, v){ if(!HORSESWIM.on || !RIVER.on || !H || H.bike) return false; if(swimming(H)) return true;
  const d = RIVER.y - heightAt(x, z); if(d <= 0.02 || RIVER.ice && d < 0.05) return false; const F = HORSESWIM.fx, k = Math.min(1, v / 8);
  swimFxKit.splash(x, z, d > 0.35 ? F.splash[1] : F.splash[0], 1.6 + k * 2.2 * (d > 0.35 ? 0.7 : 1)); if(afxOn()) afxHoof(x, z, v); return true; }

// ---- game/cavalry.js: the top speed the depth allows (m/s) · its turn rate × · what reaches the rider × ----
export function horseSwimTop(H, top){ const C = HORSESWIM; if(!C.on || !H || H.bike || !H.hsw) return top; const W = H.hsw; if(W.mode === 'swim') return Math.min(top, C.v);
  const P = C.wadeV, d = W.d; if(d <= P[0][0]) return top; let cap = P[P.length - 1][1]; for(let i = 1; i < P.length; i++) if(d <= P[i][0]){ const a = P[i - 1], b = P[i]; cap = a[1] + (b[1] - a[1]) * (d - a[0]) / (b[0] - a[0]); break; }
  return Math.min(top, cap); }
export const horseSwimTurn = H => !HORSESWIM.on || !H || !H.hsw ? 1 : 1 - (1 - HORSESWIM.turn) * H.hsw.k;
export const horseSwimDef = H => !HORSESWIM.on || !H || !H.hsw ? 1 : 1 - (1 - HORSESWIM.defK) * H.hsw.k;
// game/cavalry.js: no gallop surge, no getting off or on while it swims (true: refused, with a note)
export function horseSwimBlock(what){ if(!horseSwimming()) return false; note(what === 'surge' ? 'NGỰA ĐANG BƠI — KHÔNG PHI ĐƯỢC' : what === 'on' ? 'NGỰA ĐANG BƠI — CHỜ NÓ LÊN BỜ' : 'NGỰA ĐANG BƠI — KHÔNG XUỐNG ĐƯỢC'); return true; }
// game/swim.js swimFire / swimNoSkill: the trigger and the hand skills on a swimming horse (true: refused)
export function horseSwimFire(){ if(!HORSESWIM.noFire || !CV.mounted || CV.trans || !horseSwimming()) return false; note('NGỰA ĐANG BƠI — KHÔNG BẮN ĐƯỢC'); return true; }
export function horseSwimNoHand(){ if(!HORSESWIM.noFire || !CV.mounted || CV.trans || !horseSwimming()) return false; note('NGỰA ĐANG BƠI — KHÔNG NÉM ĐƯỢC'); return true; }
function note(txt){ const W = CV.H && CV.H.hsw, now = performance.now() / 1000, p = S.player; if(!W || !p || now - W.noteAt < HORSESWIM.msg) return; W.noteAt = now; floatText(txt, '#9fd8e8', p.pos, 14); }

// ---- actors/real-cav.js poseRealCav, before the mixer: the gait it paddles with (null: its own) — and the neck / head turned last frame put back ----
const SWC = { hk:'', ts:1 };
export function horseSwimClip(R, H, v){ const B = R.hsb; if(B && B.on){ for(const e of B.L) e.b.quaternion.copy(e.q); B.on = false; }
  if(!HORSESWIM.on || !H || H.bike || !H.hsw || H.hsw.k < 0.5 || !R.HA) return null; const P = HORSESWIM.pose; if(!R.HA[P.clip]) return null;
  SWC.hk = P.clip; SWC.ts = P.ts[0] + (P.ts[1] - P.ts[0]) * clamp(Math.abs(v) / HORSESWIM.v, 0, 1); return SWC; }
// …after the blend: the Idle clip mixed in, a share of the stride taken off (a paddle, not a walk)
export function horseSwimMix(R, H){ const a = R.HA && R.HA.Idle; if(!a || !H.hsw) return; const w = HORSESWIM.pose.idleW * H.hsw.k; if(a.getEffectiveWeight() < w) a.setEffectiveWeight(w); }
// …after its own pose on the ground (haunchPose): afloat it rides nose-up about the seat (the rider is not swung up and back), the bed's slope no longer
//   pitches it, it rolls a little with the water, and its neck and head come up out of it
const _q = new THREE.Quaternion(), _x = new THREE.Vector3();
export function horseSwimPose(R, H, dt){ const W = H && H.hsw, hr = R.hr; if(!HORSESWIM.on || !W || !hr || W.k <= 0.001) return; const P = HORSESWIM.pose, k = W.k * W.k * (3 - 2 * W.k), K = H.root.scale.x || 1;
  const a = hr.rotation.x * (1 - k) - P.pitch * k, py = P.pivot / K; hr.rotation.x = a; hr.rotation.z = hr.rotation.z * (1 - k) + Math.sin(W.t * HORSESWIM.bob[1] * 0.7 + 1) * HORSESWIM.roll * k;
  hr.position.y = hr.position.y * (1 - k) + py * (1 - Math.cos(a)) * k; hr.position.z = hr.position.z * (1 - k) - py * Math.sin(a) * k;   // (turned about the seat's height, not the hooves)
  const B = R.hsb || (R.hsb = bones(hr)); if(!B.L.length) return;
  H.root.getWorldQuaternion(_q); _x.set(-1, 0, 0).applyQuaternion(_q); hr.updateMatrixWorld(true);   // (its right: + about it tips the neck back / up)
  for(const e of B.L) e.q.copy(e.b.quaternion); B.on = true; for(const e of B.L) turnBone(e.b, _x, P[e.key] * k); }
// the neck's root, the head and the tail's root (the tail floats out behind on the water, it does not stand up out of it)
function bones(hr){ const L = [], add = (b, key) => { if(b) L.push({ b, key, q:new THREE.Quaternion() }); }; let tail = null;
  hr.traverse(o => { if(o.isBone && /tail/i.test(o.name) && !(o.parent && /tail/i.test(o.parent.name)) && !tail) tail = o; });
  add(hr.getObjectByName('neck_01'), 'neck'); add(hr.getObjectByName('head'), 'head'); add(tail, 'tail'); return { L, on:false }; }

// dev / test: what the water is doing to the player's horse
export function horseSwimProbe(){ const W = CV.H && CV.H.hsw; if(!W) return null; return { mode:W.mode, d:+W.d.toFixed(2), k:+W.k.toFixed(2), y:W.y == null ? null : +W.y.toFixed(2), swims:W.swims, msAvg:W.n ? +(W.ms / W.n).toFixed(4) : 0 }; }
