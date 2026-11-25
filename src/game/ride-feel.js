// game/ride-feel.js — RIDE 2 THE HARD STOP (both mounts; game/cavalry.js asks once a frame in the saddle). Reined in from speed — the push let go, the way
// suddenly shut, or a sharp about-turn — the mount does not coast down: it brakes as hard as the ground lets it (RIDEFEEL.stop: sand, snow, ash and a
// wet ford hold less, so it slides farther; the slide grows with the square of the speed it came in at) and shows it.
//   The horse sits on its haunches: croup dropped, hind legs folded and planted under the belly, forelegs braced out ahead, neck up and nose tucked, the rider
//   leaning back (actors/horse.js for the rig, actors/real-cav.js for the real model, both from H.stop); four furrows and a wave of dust off the hooves.
//   The xe ôm's fork dives and comes back up ONCE (game/xeom.js: a stiffer damper while H.stop.hold runs), its locked rear tyre draws a dark skid and
//   smokes dust, the tail steps out a little; driver and pillion are thrown forward by the same deceleration and settle back (they already ride the springs).
// An about-turn (the way pushed is behind it) plants it the same way, then it comes round on the spot — quicker than it turns at a walk, leant into it.
import { RIDEFEEL } from '../../config.js';
import { BIOME, NIGHT, S, groundMark, heightAt, sfx, spawnPart, wadeAt } from '../hub.js';

// on — braking hard now · k — how far into the pose (0…kMax, eased; H.stop.k for the animators) · v0 — the speed it came in at · d — how far it has slid (m)
//   · grip — the ground's share of the brake · about — ±1: it is coming round that way · n / dMax / tMax: counted for the probes
export const STOP = { on:false, t:0, v0:0, k:0, kMax:0, d:0, grip:1, about:0, hold:0, n:0, dLast:0, tLast:0, vLast:0 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), _hoof = new Float32Array(8), _o = { color:0, size:0.5, life:0.8, grav:-0.5, drag:2.2, smoke:true, grow:1.5, op:0.4 };
let hoofOn = false;
// how much of the brake the ground under (x, z) holds (1: firm)
export function rideGrip(x, z){ const G = RIDEFEEL.stop.grip; return (G[BIOME.name] ?? 1) * (wadeAt(x, z) < 1 ? G.wet : 1); }
export function rideStopReset(H){ const T = STOP; T.on = false; T.k = 0; T.about = 0; T.hold = 0; hoofOn = false; if(H && H.stop){ H.stop.k = 0; H.stop.on = false; H.stop.hold = 0; H.stop.about = 0; } }
// the ride H carrying p at v m/s, asked for `want` m/s (after the avoid's cap), the way pushed df rad off its heading (0: none pushed) → the deceleration
//   to use now (m/s²; 0: not in a hard stop) — and H.stop = { on, k, about, hold, grip } for whoever draws it
// out of the saddle (getting off, on foot, thrown): whatever pose it was in eases away
export function rideStopEase(H, dt){ const T = STOP; if(!T.on && T.k < 1e-3 && !T.hold) return; const K = H && H.bike ? RIDEFEEL.stop.bike : RIDEFEEL.stop.horse; T.on = false; T.k += -T.k * Math.min(1, dt * K.outRate); T.hold = Math.max(0, T.hold - dt); if(T.k < 1e-3) T.k = 0;
  if(H && H.stop){ H.stop.on = false; H.stop.k = T.k; H.stop.hold = T.hold; } if(H && !H.bike && H.inert) H.inert.acc = T.k * K.lean; }
export function rideStopStep(H, p, dt, want, v, df){ const C = RIDEFEEL.stop, K = H.bike ? C.bike : C.horse, T = STOP, about = Math.abs(df) > C.aboutA, HS = H.stop || (H.stop = { on:false, k:0, about:0, hold:0, grip:1 });
  if(!T.on){ if(v > C.minV && (want < v * C.rein || about)){ T.on = true; T.t = 0; T.v0 = v; T.d = 0; T.n++; T.grip = rideGrip(p.pos.x, p.pos.z); T.about = about ? Math.sign(df) : 0; hoofOn = false;
      T.kMax = clamp((v - C.minV) / (K.fullV - C.minV), C.kMin, 1); S.shake = Math.min(1.4, S.shake + C.shake * T.kMax); sfx('crunch', undefined, 0.3 + 0.3 * T.kMax); } }
  else { T.t += dt; T.d += Math.abs(v) * dt; if(v < (T.about ? C.aboutV + 0.25 : C.endV) || !about && want > v + C.resume){ T.on = false; T.hold = K.hold || 0; T.dLast = T.d; T.tLast = T.t; T.vLast = T.v0; } }   // pulled up (or slow enough to come round) · or he pushes on again
  T.k += ((T.on ? T.kMax : 0) - T.k) * Math.min(1, dt * (T.on ? K.inRate : K.outRate)); T.hold = Math.max(0, T.hold - dt); if(!T.on && T.k < 0.02) T.about = 0;
  if(!H.bike){ const I = H.inert || (H.inert = { acc:0, lat:0, vy:0, p:0, r:0 }); I.acc = T.k * K.lean; }   // (the rider braces back: actors/real-cav.js rideSway reads it as a push from ahead)
  HS.on = T.on; HS.k = T.k; HS.about = T.about; HS.hold = T.on ? 1 : T.hold; HS.grip = T.grip;
  if(T.on && v > 0.6) (H.bike ? bikeSkid : hoofPlough)(H, p, dt, v, K);
  return T.on ? K.decel * T.grip : 0; }
const dustHex = k => { const c = BIOME.ground || 0xb8a888, d = (1 - 0.7 * (NIGHT.k || 0)) * k; return (Math.min(255, (c >> 16 & 255) * d) << 16) | (Math.min(255, (c >> 8 & 255) * d) << 8) | Math.min(255, (c & 255) * d) | 0; };
// the horse: its four planted hooves plough the ground — a furrow under each, a wave of dust thrown ahead of them (more of it, and longer, on loose ground)
function hoofPlough(H, p, dt, v, K){ const f = p.facing, fx = Math.sin(f), fz = Math.cos(f), lx = fz, lz = -fx, k = STOP.k, loose = 1 / STOP.grip;
  for(let i = 0; i < 4; i++){ const z = (i < 2 ? K.plant[0] : K.plant[1]) * k + (i < 2 ? K.feet[0] : K.feet[1]), sx = (i & 1 ? -1 : 1) * K.feet[2], x = p.pos.x + fx * z + lx * sx, zz = p.pos.z + fz * z + lz * sx;
    if(hoofOn) groundMark(_hoof[i * 2], _hoof[i * 2 + 1], x, zz, K.mark[0], K.mark[1]); _hoof[i * 2] = x; _hoof[i * 2 + 1] = zz;
    if(Math.random() < dt * v * K.dust * loose){ _o.color = dustHex(0.95); _o.size = 0.5 + Math.random() * 0.5 + v * 0.03; _o.life = 0.7 + Math.random() * 0.5 * loose; _o.op = 0.42;
      spawnPart(x + fx * 0.15, heightAt(x, zz) + 0.1, zz + fz * 0.15, fx * v * (0.25 + Math.random() * 0.3) + (Math.random() - 0.5) * 1.6, 0.7 + Math.random() * 1.3, fz * v * (0.25 + Math.random() * 0.3) + (Math.random() - 0.5) * 1.6, _o); } }
  hoofOn = true; }
// the xe ôm: the locked rear tyre smokes dust off the ground behind it (its skid is drawn with the tyre tracks: game/xeom.js tyreTrail reads H.stop)
function bikeSkid(H, p, dt, v, K){ if(Math.random() > dt * v * K.dust / STOP.grip) return; const f = p.facing, fx = Math.sin(f), fz = Math.cos(f), x = p.pos.x - fx * K.rear, z = p.pos.z - fz * K.rear;
  _o.color = dustHex(0.9); _o.size = 0.45 + Math.random() * 0.4; _o.life = 0.6 + Math.random() * 0.5 / STOP.grip; _o.op = 0.4;
  spawnPart(x, heightAt(x, z) + 0.08, z, fx * v * 0.2 + (Math.random() - 0.5) * 1.4, 0.5 + Math.random() * 0.9, fz * v * 0.2 + (Math.random() - 0.5) * 1.4, _o); }
