// actors/soldier-legs.js — Z339 THE SOLDIER'S FEET ON THE GROUND: his clips only ever walk him forward, so backing up or moving sideways while he aimed
//   he moonwalked, and his feet skated round whenever he turned. On his feet (standing, or crouched and moving) his legs are now his own:
//   · each foot is planted where it lands and stays put until it steps; steps come one foot at a time at a real cadence for his speed, each aimed
//     where it should be when it comes down (half a stride ahead of the hips, the way he is going), never across the other foot;
//   · moving sideways his pelvis turns toward the move (his shoulders stay on the aim: the spine takes the twist back) and the legs walk it on the
//     diagonal; backing up the hips stay near square and the foot comes down toes first; going forward it lands heel first and the trailing heel
//     peels up before push-off;
//   · the pelvis dips at each footfall and rises over the foot it stands on, swaying a little over it; long strides bring it down so the legs reach;
//   · stood still he keeps a bladed stance (left foot a little ahead), and a foot left behind by a turn or a drift steps back under him.
// Only the hips and legs are his own — the rifle, arms and torso stay the clip's (laid over afterwards by the hold); the legs are eased in and out
//   against the clips (running is still the run clip).
import * as THREE from 'three';
import { SOLDIER_LEGS } from '../../config.js';
import { heightAt, ik2 } from '../hub.js';

const V3 = () => new THREE.Vector3();
const _a = V3(), _b = V3(), _c = V3(), _d = V3(), _e = V3(), _g = V3(), _h = V3(), _k = V3(), _ank = [V3(), V3()], _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0), F2 = V3(), R2 = V3(), FF = V3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = k => k * k * (3 - 2 * k), wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const SIDES = [['Left', -1], ['Right', 1]];   // (which way is outward for that leg, along his right)
const BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];

// ---- bones (world-space turns laid onto a bone) ----
const _ia = V3(), _ib = V3(), _ip = V3(), _iq = new THREE.Quaternion(), _iqw = new THREE.Quaternion(), _iqp = new THREE.Quaternion();
function aim(b, c, dir){ if(!b || !c) return; b.getWorldPosition(_ia); c.getWorldPosition(_ib); _ib.sub(_ia); if(_ib.lengthSq() < 1e-10 || dir.lengthSq() < 1e-10) return; _ib.normalize();
  _iq.setFromUnitVectors(_ib, _ip.copy(dir).normalize()); b.getWorldQuaternion(_iqw); _iqw.premultiply(_iq); b.parent.getWorldQuaternion(_iqp); b.quaternion.copy(_iqp.invert().multiply(_iqw)); b.updateMatrixWorld(true); }
function turn(b, axis, ang){ if(!b || Math.abs(ang) < 1e-5) return; _iq.setFromAxisAngle(axis, ang); b.getWorldQuaternion(_iqw); _iqw.premultiply(_iq); b.parent.getWorldQuaternion(_iqp); b.quaternion.copy(_iqp.invert().multiply(_iqw)); b.updateMatrixWorld(true); }
const wp = (b, out) => b.getWorldPosition(out);
// his own lengths (world m): thigh + shin, the foot (ankle → ball), half the hips' width
function lens(D, L){ if(L.len) return L.len; const P = n => wp(D[n], V3());
  return L.len = { leg:P('LeftUpLeg').distanceTo(P('LeftLeg')) + P('LeftLeg').distanceTo(P('LeftFoot')), fl:P('LeftFoot').distanceTo(P('LeftToeBase')), hw:P('LeftUpLeg').distanceTo(P('RightUpLeg')) / 2 }; }
const newFoot = () => ({ p:V3(), y:0, yaw:0, sw:null, ph:0 });
export function legState(R){ return R.legs || (R.legs = { w:0, on:false, mode:null, feet:[newFoot(), newFoot()], t:0, last:-9, v:V3(), prev:null, th:0, br:1, gy:0, snap:new Map(), hp:V3() }); }

// ---- every frame, after the clips (and the puppet) have posed him: which legs he stands on ----
// R = CV.real, G = the soldier's group, P = updateRealCav's state (stance, trans, move, dead), mounted = on the horse / ride
export function soldierLegs(R, G, dt, P, mounted){ const D = R.pup && R.pup.D; if(!D || !D.LeftUpLeg || !D.LeftToeBase || !D.RightToeBase || !dt) return;
  const A = SOLDIER_LEGS, L = legState(R), MV = P.move;
  // where he really goes (from his own displacement, smoothed) and which way he faces
  G.getWorldPosition(_g); if(!L.prev) L.prev = _g.clone(); _a.subVectors(_g, L.prev).divideScalar(dt); _a.y = 0; if(_a.lengthSq() > 144) _a.set(0, 0, 0); L.prev.copy(_g);
  L.v.lerp(_a, Math.min(1, dt * A.velK)); const s = Math.hypot(L.v.x, L.v.z);
  const busy = mounted || P.trans || P.dead || (MV && (MV.roll >= 0 || MV.air || MV.land > 0));
  const mode = busy ? null : P.stance === 'stand' ? (s < A.stand.maxV ? 'stand' : null) : P.stance === 'crouch' ? (s > (L.mode === 'crouch' ? A.crouch.minV * 0.5 : A.crouch.minV) ? 'crouch' : null) : null;
  L.w += ((mode ? 1 : 0) - L.w) * Math.min(1, dt * A.fade); if(mode) L.mode = mode;
  if(!mode && L.w < 0.03){ L.w = 0; L.on = false; L.mode = null; return; }
  const M = A[L.mode || 'stand']; L.t += dt;
  for(const n of BONES){ const b = D[n]; if(!b) continue; let q = L.snap.get(b); if(!q) L.snap.set(b, q = new THREE.Quaternion()); q.copy(b.quaternion); } L.hp.copy(D.Hips.position);   // (the clip's legs, to ease against)
  const len = lens(D, L), slope = A.slope, ankleH = A.toeH - len.fl * Math.sin(slope);
  G.getWorldQuaternion(_q); _a.set(0, 0, 1).applyQuaternion(_q); const psi = Math.atan2(_a.x, _a.z);
  if(!L.on){ for(const [L1, sd] of SIDES){ const f = L.feet[sd < 0 ? 0 : 1]; wp(D[L1 + 'Foot'], _a); wp(D[L1 + 'ToeBase'], _b); f.p.set(_a.x, 0, _a.z); f.yaw = Math.atan2(_b.x - _a.x, _b.z - _a.z); f.sw = null; f.ph = 0; }
    L.on = true; L.th = 0; L.last = L.t; L.br = 1; }
  // the pelvis turns toward a move off to the side (forward branch), or square-ish to a move backward (backward branch) — kept on a branch past the side
  const moving = s > A.moveV, rel = s > A.turnV ? wrapA(Math.atan2(L.v.x, L.v.z) - psi) : 0;
  if(s > A.turnV){ if(L.br > 0 && Math.abs(rel) > Math.PI / 2 + A.hyst) L.br = -1; else if(L.br < 0 && Math.abs(rel) < Math.PI / 2 + A.hyst * 0.3) L.br = 1; } else if(!moving) L.br = 1;   // (straight to the side is walked hips-open, forward)
  const thT = s > A.turnV ? (L.br > 0 ? clamp(rel, -M.turn, M.turn) : clamp(wrapA(rel - Math.PI), -M.turnBack, M.turnBack)) * Math.min(1, s / A.turnFull) : 0;
  L.th += clamp(thT - L.th, -A.turnRate * dt, A.turnRate * dt);
  const hy = psi + L.th; F2.set(Math.sin(hy), 0, Math.cos(hy)); R2.set(-Math.cos(hy), 0, Math.sin(hy));
  // ---- the steps ----
  const back = L.br < 0 && moving, c = clamp(M.cad[0] + s * M.cad[1], M.cad[0], M.cad[2]) * (back ? A.backCad : 1), Tsw = M.swing / c;
  const home = (sd, cx, cz, out, still) => out.set(cx + R2.x * sd * (still ? M.stance : M.half) + (still ? F2.x * -sd * M.stagger : 0), 0, cz + R2.z * sd * (still ? M.stance : M.half) + (still ? F2.z * -sd * M.stagger : 0));
  const swinging = L.feet.find(f => f.sw);
  // a foot left too far behind (setting off, speeding up) steps now — even before the other is quite down
  let lag = 0; if(moving) for(const [, sd] of SIDES){ const f = L.feet[sd < 0 ? 0 : 1]; if(f.sw) continue; home(sd, _g.x, _g.z, _d); lag = Math.max(lag, -((f.p.x - _d.x) * L.v.x + (f.p.z - _d.z) * L.v.z) / Math.max(0.1, s)); }
  const urgent = lag > M.maxStride * A.urgent;
  if(!swinging || urgent && swinging.sw.t > A.overlap && !L.feet.every(f => f.sw)){
    if(moving && (L.t - L.last >= 1 / c || urgent)){ _h.copy(L.v).normalize(); let best = -1, bs = -Infinity;
      _c.copy(_g).addScaledVector(L.v, Tsw);   // where the hips will be when the foot comes down
      for(const [, sd] of SIDES){ const i = sd < 0 ? 0 : 1, f = L.feet[i]; home(sd, _c.x, _c.z, _d); const sc = _d.sub(f.p).dot(_h); if(sc > bs){ bs = sc; best = i; } }   // (setting off: the foot furthest behind)
      if(L.lastFoot != null && L.t - L.last < 2.5 / c) best = 1 - L.lastFoot;   // (under way: left, right, left — never the same foot twice)
      if(L.feet[best].sw) best = 1 - best;
      const sd = best ? 1 : -1, f = L.feet[best], o = L.feet[1 - best]; home(sd, _c.x, _c.z, _d).addScaledVector(L.v, M.lead / c);
      _e.subVectors(_d, f.p); _e.y = 0; const st = _e.length(), mx = M.maxStride * (back ? A.backStep : 1);   // (a foot travels a whole stride: two steps) if(st > mx) _d.copy(f.p).addScaledVector(_e, mx / st);
      // side by side the feet keep apart; going on the diagonal the trailing foot crosses over the other — in front of it (or behind, backing up), round it
      const lat = (_d.x - o.p.x) * R2.x * sd + (_d.z - o.p.z) * R2.z * sd, ahead = (_d.x - o.p.x) * F2.x + (_d.z - o.p.z) * F2.z;
      if(lat < M.gap && Math.abs(ahead) < A.crossF) _d.addScaledVector(R2, sd * (M.gap - lat));
      step(f, _d, hy + sd * A.toeOut, Tsw, M.lift * (0.7 + 0.3 * Math.min(1, s / 1.5)), lat < M.gap ? Math.sign(ahead || 1) : 0); L.last = L.t; L.lastFoot = best; }
    else if(!moving && L.t - L.last > A.idleGap){ for(const [, sd] of SIDES){ const i = sd < 0 ? 0 : 1, f = L.feet[i], want = hy + sd * A.toeOut; home(sd, _g.x, _g.z, _d, true);
        if(_d.distanceTo(_e.copy(f.p).setY(0)) > M.idle || Math.abs(wrapA(f.yaw - want)) > A.yawStep){ step(f, _d, want, A.idleT, M.lift * 0.6); L.last = L.t; L.lastFoot = i; break; } } } }
  // the swing: the foot up and over, heel-and-toe by which way it goes
  for(const f of L.feet){ const w = f.sw; let phT = 0;
    if(w){ w.t = Math.min(1, w.t + dt / w.dur); const e = smooth(w.t); f.p.lerpVectors(w.from, w.to, e); if(w.cross) f.p.addScaledVector(F2, w.cross * A.crossArc * Math.sin(Math.PI * w.t)); f.yaw = w.y0 + wrapA(w.y1 - w.y0) * e; f.lift = Math.sin(Math.PI * w.t) * w.h;
      phT = w.dir > 0.3 ? (w.t < 0.35 ? 0.45 * (1 - w.t / 0.35) : w.t > 0.65 ? -0.28 * (w.t - 0.65) / 0.35 : 0) : w.dir < -0.3 ? (w.t < 0.35 ? -0.2 * (1 - w.t / 0.35) : w.t > 0.6 ? 0.38 * (w.t - 0.6) / 0.4 : 0) : 0;
      if(w.t >= 1){ f.sw = null; f.lift = 0; } }
    else { f.lift = 0; if(moving && !back){ const behind = -((f.p.x - _g.x) * L.v.x + (f.p.z - _g.z) * L.v.z) / Math.max(0.1, s); phT = clamp((behind - 0.12) / 0.25, 0, 1) * 0.45; } }   // the trailing heel peels up
    f.ph += (phT - f.ph) * Math.min(1, dt * 16); f.y = heightAt(f.p.x, f.p.z); }
  // ---- the pelvis: down at each footfall, up over the standing foot, swayed over it; low enough for both legs to reach ----
  const sw = L.feet.find(f => f.sw), k = sw ? sw.sw.t : 0, sdS = sw ? (sw === L.feet[0] ? -1 : 1) : 0;
  const gY = (L.feet[0].y + L.feet[1].y) / 2; let hipY = gY + ankleH + len.leg * M.hipK - M.dip * Math.min(1, s / 1.4) + (sw ? M.bob * (Math.sin(Math.PI * k) - 0.5) : 0);
  _c.set(_g.x, 0, _g.z); if(sw){ const st = L.feet[sdS < 0 ? 1 : 0], lat = (st.p.x - _g.x) * R2.x + (st.p.z - _g.z) * R2.z; _c.addScaledVector(R2, lat * A.sway * Math.sin(Math.PI * k)); }
  const ank = _ank; for(const [, sd] of SIDES){ const i = sd < 0 ? 0 : 1; ankle(L.feet[i], len, ankleH, slope, ank[i]); }
  for(const [, sd] of SIDES){ const i = sd < 0 ? 0 : 1, hx = _c.x + R2.x * sd * len.hw, hz = _c.z + R2.z * sd * len.hw, hd = Math.hypot(hx - ank[i].x, hz - ank[i].z), rr = len.leg * A.reach;
    if(hd < rr) hipY = Math.min(hipY, ank[i].y + Math.sqrt(rr * rr - hd * hd)); }
  hipY = Math.max(hipY, gY + ankleH + len.leg * M.hipK - A.maxDrop);   // (never down into a squat: past that the leg stays long and the foot trails)
  _c.y = hipY;
  // the pelvis turned (and swung a touch with the stride, rolled over the swinging side), its hip joints' middle onto the spot; the spine takes the turn back
  const gyaw = L.th + (sw ? sdS * A.gaitYaw * Math.sin(Math.PI * k) : 0), h = D.Hips;
  turn(h, UP, gyaw); if(sw) turn(h, F2, -sdS * A.roll * Math.sin(Math.PI * k));
  wp(D.RightUpLeg, _a); wp(D.LeftUpLeg, _b); _a.add(_b).multiplyScalar(0.5); wp(h, _b); _b.add(_c).sub(_a); h.parent.worldToLocal(_b); h.position.copy(_b); h.updateMatrixWorld(true);
  turn(D.Spine, UP, -gyaw * 0.45); turn(D.Spine1, UP, -gyaw * 0.33); turn(D.Spine2, UP, -gyaw * 0.22);
  if(M.lean){ _k.set(-Math.cos(psi), 0, Math.sin(psi)); turn(D.Spine, _k, -M.lean * 0.6); turn(D.Spine1, _k, -M.lean * 0.4); }   // (crouched: leaning into it from the hips, the head up)
  // ---- the legs onto the feet: knees over the toes, each foot laid along its own heading at its heel / toe pitch ----
  for(const [L1, sd] of SIDES){ const i = sd < 0 ? 0 : 1, f = L.feet[i]; FF.set(Math.sin(f.yaw), 0, Math.cos(f.yaw));
    _d.copy(ank[i]).addScaledVector(FF, 0.7).addScaledVector(UP, 0.45).addScaledVector(R2, sd * 0.06);
    ik2(D[L1 + 'UpLeg'], D[L1 + 'Leg'], D[L1 + 'Foot'], ank[i], _d);
    const sl = slope - f.ph; aim(D[L1 + 'Foot'], D[L1 + 'ToeBase'], _e.copy(FF).multiplyScalar(Math.cos(sl)).addScaledVector(UP, Math.sin(sl)));
    if(f.ph > 0.05 && D[L1 + 'Toe_End']) aim(D[L1 + 'ToeBase'], D[L1 + 'Toe_End'], _e.copy(FF).multiplyScalar(Math.cos(A.toeFlat)).addScaledVector(UP, Math.sin(A.toeFlat))); }   // (heel up: the toes stay on the ground)
  // ---- eased against the clip's own legs ----
  if(L.w < 0.999){ for(const [b, q] of L.snap){ _q.copy(b.quaternion); b.quaternion.copy(q).slerp(_q, L.w); } h.position.lerpVectors(L.hp, h.position, L.w); h.updateMatrixWorld(true); } }
// a step: from where the foot is to `to`, turning to `yaw`, over `dur` s, lifted `h`; cross = ±1 when it crosses over the other foot (round in front / behind)
function step(f, to, yaw, dur, h, cross = 0){ const from = f.p.clone(); from.y = 0; const d = to.clone(); d.y = 0; _k.subVectors(d, from); const L = _k.length();
  f.sw = { from, to:d, y0:f.yaw, y1:yaw, t:0, dur, h:L > 0.05 ? h : h * 0.5, cross, dir:L > 0.05 ? _k.dot(_e.set(Math.sin(yaw), 0, Math.cos(yaw))) / L : 0 }; }
// where the ankle is: over the foot's spot at its height; heel up it turns about the ball of the foot, toes up about the ankle
function ankle(f, len, ankleH, slope, out){ FF.set(Math.sin(f.yaw), 0, Math.cos(f.yaw)); const y = f.y + (f.lift || 0);
  if(f.ph > 0){ const fc = len.fl * Math.cos(slope), sl = slope - f.ph; out.copy(f.p).addScaledVector(FF, fc); out.y = y + (ankleH + len.fl * Math.sin(slope)); out.addScaledVector(FF, -len.fl * Math.cos(sl)); out.y -= len.fl * Math.sin(sl); }
  else { out.copy(f.p); out.y = y + ankleH; }
  return out; }
