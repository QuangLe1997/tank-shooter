// actors/ragdoll.js — Z254 A REAL FALL for a man shot down (enemy infantry, our fireteam, a general without his real model): the knees give first, then the body topples about the feet under gravity (it accelerates — a plank does not), twisting a little, the way the round pushed him; it strikes the ground, bounces once and settles along the slope. The limbs are damped springs carried by that motion: the arms lag and fling as he goes, slap out on impact and come to rest somewhere different for every man (overhead, across, under him), the head lolls, the hips and knees go slack. Everything moves the rig's own joints, so the troop batch draws it as before.
import * as THREE from 'three';
import { RAGDOLL } from '../../config.js';
import { heightAt } from '../hub.js';

const _q = new THREE.Quaternion(), _qy = new THREE.Quaternion(), _ax = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const R = (a, b) => a + Math.random() * (b - a);
// one damped spring per limb channel: value, velocity, rest target, how much the body's swing drags it (inertia)
const limb = (a, rest, drag) => ({ a, v:0, rest, drag });

// start a fall: m = the soldier root (feet at its origin); dir = [x, z] the way the body falls (the round's push); o.drop = start height above the ground
export function startFall(m, dir, o){ o = o || {}; const u = m.userData, F = RAGDOLL;
  let dx = dir ? dir[0] : Math.sin(m.rotation.y + Math.PI), dz = dir ? dir[1] : Math.cos(m.rotation.y + Math.PI); const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
  const fwd = dx * Math.sin(m.rotation.y) + dz * Math.cos(m.rotation.y) > 0;          // falling the way he faced (shot from behind) → onto his face
  const prone = u.stance === 'prone';
  const d = { t:0, yaw:m.rotation.y, dx, dz, fwd, th:prone ? Math.PI / 2 * 0.9 : R(0.02, 0.08), w:prone ? 0 : R(F.push[0], F.push[1]), twist:R(-F.twist, F.twist),
    phase:prone ? 'fall' : 'buckle', buckle:prone ? 0 : R(F.buckle[0], F.buckle[1]), bounced:false, rest:false, drop:o.drop || 0, vy:0, s:m.scale.y || 1,
    arm:limb(u.arms ? u.arms.rotation.x : 0, fwd ? R(-0.5, 0.7) : R(-2.6, -0.9), fwd ? -0.35 : 0.45),
    armZ:limb(0, R(-0.5, 0.5), 0.1), up:limb(u.up ? u.up.rotation.x : 0, fwd ? R(-0.25, 0.1) : R(-0.1, 0.35), 0.18),
    head:limb(0, fwd ? R(-0.4, 0.1) : R(0.15, 0.55), 0.3), headY:limb(0, R(-0.9, 0.9), 0.05),
    legs:(u.legs || []).map(l => ({ hip:limb(l.hip.rotation.x, R(-0.35, 0.15), 0.12), hipZ:limb(l.hip.rotation.z, l.sx * R(0.05, 0.4), 0.05), knee:limb(Math.max(0, l.knee.rotation.x), R(0.05, 0.7), 0.1) })) };
  if(u.body){ u.body.rotation.set(0, 0, 0); u.body.position.set(0, 0, 0); }
  m.rotation.order = 'XYZ'; u.fall = d; return d; }

function spring(c, acc, dt){ const F = RAGDOLL; c.v += (F.k * (c.rest - c.a) - F.damp * c.v - acc * c.drag) * dt; c.a += c.v * dt; }
// advance a fall; returns true once he lies still
export function stepFall(m, dt){ const d = m.userData.fall; if(!d) return true; const F = RAGDOLL, u = m.userData; dt = Math.min(dt, 0.05); d.t += dt;
  let acc = 0;
  if(d.phase === 'buckle'){                                                          // the legs go: knees fold, the body sags, a little lean the way he will fall
    const k = Math.min(1, d.t / d.buckle); for(const L of d.legs){ L.knee.rest = 0.9 * k + 0.1; L.hip.rest = -0.55 * k; }
    d.th = 0.05 + 0.12 * k; if(k >= 1){ d.phase = 'fall'; for(const L of d.legs){ L.knee.rest = R(0.05, 0.7); L.hip.rest = R(-0.35, 0.15); } } }
  else if(d.phase === 'fall'){                                                       // topples about the feet: θ'' = (g / ℓ)·sin θ
    const end = endAngle(m, d), a = F.g / F.len * Math.sin(d.th); d.w += a * dt; acc = a; d.th += d.w * dt;
    if(d.th >= end){ d.th = end; if(!d.bounced && d.w > F.bounceMin){ d.bounced = true; const hit = d.w; d.w = -hit * F.bounce;   // strikes, bounces once — the limbs slap out
        d.arm.v += (d.fwd ? 1 : -1) * hit * R(1.5, 3); d.armZ.v += R(-3, 3); d.head.v += (d.fwd ? -1 : 1) * hit * 1.4; for(const L of d.legs){ L.knee.v += hit * R(0, 1.6); L.hipZ.v += R(-1.5, 1.5); } }
      else { d.w = 0; d.phase = 'down'; } } }
  else if(d.phase === 'down'){ d.th = endAngle(m, d); if(d.t > 1.2 && !d.rest){ let still = true; for(const c of [d.arm, d.armZ, d.up, d.head]) if(Math.abs(c.v) > 0.03) still = false; d.rest = still; } }
  if(d.drop > 0){ d.vy -= 9.8 * dt; d.drop = Math.max(0, d.drop + d.vy * dt); }       // starting in the air (thrown off a horse): falls the rest of the way
  // the root: yaw, then the fall about the horizontal axis across the fall direction, with a little twist as he goes
  _ax.set(d.dz, 0, -d.dx); _q.setFromAxisAngle(_ax, d.th); _qy.setFromAxisAngle(_up, d.yaw + d.twist * Math.min(1, d.th)); m.quaternion.copy(_q).multiply(_qy);
  const x = m.position.x, z = m.position.z, lie = Math.sin(Math.min(Math.PI / 2, d.th));
  m.position.y = heightAt(x, z) + d.drop + F.thick * d.s * lie - (d.phase === 'buckle' ? F.sag * d.s * Math.min(1, d.t / d.buckle) : 0) * (1 - lie);
  // the limbs: springs dragged by the body's swing (they lag going down, overshoot when it stops)
  const sgn = d.fwd ? 1 : -1;
  for(const c of [d.arm, d.armZ, d.up, d.head, d.headY]) spring(c, acc * sgn, dt);
  for(const L of d.legs){ spring(L.hip, acc * sgn, dt); spring(L.hipZ, 0, dt); spring(L.knee, 0, dt); }
  if(u.arms){ u.arms.rotation.x = d.arm.a; u.arms.rotation.z = d.armZ.a; }
  if(u.up) u.up.rotation.x = d.up.a; if(u.head){ u.head.rotation.x = d.head.a; u.head.rotation.y = d.headY.a; }
  (u.legs || []).forEach((l, i) => { const L = d.legs[i]; if(!L) return; l.hip.rotation.x = L.hip.a; l.hip.rotation.z = L.hipZ.a; l.knee.rotation.x = Math.max(0, L.knee.a); });
  return d.rest; }
// how far he goes over: flat on the ground, tilted to the slope between his feet and where his head lands
function endAngle(m, d){ const F = RAGDOLL, x = m.position.x, z = m.position.z, hx = x + d.dx * F.len * 1.6 * d.s, hz = z + d.dz * F.len * 1.6 * d.s;
  const dh = heightAt(hx, hz) - heightAt(x, z); return Math.PI / 2 - Math.atan2(dh, F.len * 1.6 * d.s) - 0.02; }
export function endFall(m){ const u = m.userData; u.fall = null; m.quaternion.identity(); m.rotation.set(0, 0, 0); m.rotation.order = 'XYZ';   // back to a standing rig for the pool
  if(u.up) u.up.rotation.set(0, 0, 0); if(u.head) u.head.rotation.set(0, 0, 0); for(const l of (u.legs || [])){ l.hip.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); } }
