// fx/feel-fx.js — FEEL 1–4 THE CRITIC'S ROUND 1 (config FEELFX; FEELFX.on:false = all as before):
//   · smokeScreen — the smoke grenade's screen (combat/spells.js updateEquip): grey puffs on the fire / smoke layer (lit by the scene: a grey wall by day, a dark
//     one by night — never the old self-lit white), born in a RING round where it fell and never in a bubble round him nor in the lane from the camera to
//     him: he stands in a clearing of his own smoke, the enemy beyond it blind, and the view is not swallowed whole
//   · bossCam — the general's entrance (campaign/fort-boss.js spawn → feelBossReveal): a cut of a couple of seconds, the camera in front of his door looking
//     at him as he strides out (the slow motion is fort-boss.js's own); then the follow camera glides back by itself (game/update.js: a gap → it settles)
//   · feelRideCall — G with the ride out of reach (game/cavalry.js cavToggleMount): it is called as before, the ride chip at the lower-left edge counts the
//     metres down (game/ride-call.js; FEEL 6: not a label over him — that sat in the aim zone), and he is up the moment it is there (no second press)
import * as THREE from 'three';
import { CAV, FEELFX } from '../../config.js';
import { CV, MOBILE, S, camera, cavToggleMount, fxp, heightAt, rideCanCome } from '../hub.js';

const R = (a, b) => a + Math.random() * (b - a), _v = new THREE.Vector3(), _l = new THREE.Vector3();
export const FEELX = { smoke:0, smokeSkip:0, cut:null, cuts:0, chipUntil:0, want:false, mounts:0 };

// ---- the smoke grenade's screen: rate puffs a second while it lasts (thinning over its last seconds) ----
let _acc = 0;
export function smokeScreen(dt, p, left){ const C = FEELFX.smoke, sx = p.smokeX, sz = p.smokeZ, gy = heightAt(sx, sz), cp = camera.position;
  _acc += dt * C.rate * (MOBILE ? C.mob : 1) * Math.min(1, left / 2.5); let n = _acc | 0; _acc -= n; if(n > 6) n = 6;
  const px = p.pos.x, pz = p.pos.z, lx = cp.x - px, lz = cp.z - pz, ll = lx * lx + lz * lz || 1;
  for(let i = 0; i < n * 3 && n > 0; i++){ const a = Math.random() * 6.2832, r = C.r[0] + Math.sqrt(Math.random()) * (C.r[1] - C.r[0]), x = sx + Math.cos(a) * r, z = sz + Math.sin(a) * r;
    const dx = x - px, dz = z - pz; if(dx * dx + dz * dz < C.clear * C.clear){ FEELX.smokeSkip++; continue; }                        // his clearing
    const t = Math.max(0, Math.min(1, (dx * lx + dz * lz) / ll)), ex = dx - lx * t, ez = dz - lz * t; if(t > 0 && ex * ex + ez * ez < C.lane * C.lane){ FEELX.smokeSkip++; continue; }   // the lens's lane to him
    fxp('grey', x, gy + R(0.6, 2.2), z, R(-0.3, 0.3), R(0.15, 0.4), R(-0.3, 0.3), R(C.size[0], C.size[1]) * 1.6, R(C.life[0], C.life[1]), 0, C.col, C.op, gy); FEELX.smoke++; n--; } }

// ---- the general's entrance ----
export function feelBossReveal(B){ if(!FEELFX.on || !B || !B.door || !B.e) return; FEELX.cut = { B, t:0 }; FEELX.cuts++; }
export function bossCam(dt){ const K = FEELX.cut; if(!K) return false; const C = FEELFX.boss, B = K.B, e = B.e, D = B.door;
  K.t += dt; if(K.t > C.cut || !e || !e.pos || S.mode !== 'playing' || B.st === 'dead'){ FEELX.cut = null; return false; }
  const ux = D.ux || 0, uz = D.uz || 0, gy = heightAt(e.pos.x, e.pos.z), k = Math.min(1, K.t / C.cut);
  _v.set(e.pos.x + ux * (C.back - k * 1.5) + uz * 2.2, gy + C.up - k * 0.4, e.pos.z + uz * (C.back - k * 1.5) - ux * 2.2);   // in front of the door, a little to one side, pushing in
  _v.y = Math.max(_v.y, heightAt(_v.x, _v.z) + 1.2); camera.position.copy(_v); camera.lookAt(_l.set(e.pos.x, gy + C.look * (e.rK || 1), e.pos.z)); camera.updateMatrixWorld(); return true; }

// ---- G with the ride on its way: up the moment it comes (the metres: the ride chip at the lower-left edge, game/ride-call.js) ----
export function feelRideCall(){ FEELX.want = true; FEELX.chipUntil = performance.now() / 1000 + FEELFX.horse.chip; }
export function updateFeelFX(){ const p = S.player; if(!FEELX.want) return;   // (FEEL 6 the count itself is on the ride chip at the screen's lower-left edge: game/ride-call.js — never a label over him in the aim zone)
  const now = performance.now() / 1000; if(!p || !p.cav || CV.mounted || S.mode !== 'playing' || now > FEELX.chipUntil){ FEELX.want = false; return; }
  const d = Math.hypot(CV.hPos.x - p.pos.x, CV.hPos.z - p.pos.z);
  if(d <= CAV.mountR && rideCanCome() && !CV.trans){ FEELX.want = false; FEELX.mounts++; cavToggleMount(); } }
