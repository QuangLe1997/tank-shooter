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
// Z341 HIS FIRING POSITIONS (each change of position eased from the last):
//   · kneeling: down on the right knee, the right foot behind it up on its toes, the left foot flat out in front with the shin upright, hips turned
//     a little to the right (bladed) and the shoulders brought back square to the aim, leaning into the rifle — the left elbow comes over the knee;
//   · prone: the legs spread in a V behind him, the feet turned out on their inside edges; crawling, a knee is drawn up and out to one side, then the other;
//   · the jump: legs driven straight off the ground (toes pointed), tucked up under him at the top, reaching for the ground coming down, a give at the
//     knees on landing;
//   · behind cover: kneeling or crouched behind it at exactly the height that lays the rifle on its top.
import * as THREE from 'three';
import { CAV, SOLDIER_LEGS } from '../../config.js';
import { CV, heightAt, ik2, mountOwn, mountPose } from '../hub.js';

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
  const th = P('LeftUpLeg').distanceTo(P('LeftLeg')), sh = P('LeftLeg').distanceTo(P('LeftFoot'));
  return L.len = { th, sh, leg:th + sh, fl:P('LeftFoot').distanceTo(P('LeftToeBase')), hw:P('LeftUpLeg').distanceTo(P('RightUpLeg')) / 2 }; }
const newFoot = () => ({ p:V3(), y:0, yaw:0, sw:null, ph:0 });
export function legState(R){ return R.ownLegs || (R.ownLegs = { w:0, on:false, mode:null, feet:[newFoot(), newFoot()], t:0, last:-9, v:V3(), prev:null, th:0, br:1, gy:0, snap:new Map(), hp:V3() }); }

// ---- every frame, after the clips (and the puppet) have posed him: which legs he stands on ----
// R = CV.real, G = the soldier's group, P = updateRealCav's state (stance, trans, move, dead), mounted = on the horse / ride
export function soldierLegs(R, G, dt, P, mounted){ const D = R.pup && R.pup.D; if(!D || !D.LeftUpLeg || !D.LeftToeBase || !D.RightToeBase || !dt) return;
  const A = SOLDIER_LEGS, L = legState(R), MV = P.move;
  // where he really goes (from his own displacement, smoothed) and which way he faces
  G.getWorldPosition(_g); if(!L.prev) L.prev = _g.clone(); _a.subVectors(_g, L.prev).divideScalar(dt); _a.y = 0; if(_a.lengthSq() > 144) _a.set(0, 0, 0); L.prev.copy(_g);
  L.v.lerp(_a, Math.min(1, dt * A.velK)); const s = Math.hypot(L.v.x, L.v.z);
  // Z341 which position: in the air, prone, kneeling (crouched and still), crouched or stood on the move
  const T = CV.trans, own = !!(P.trans && T && !T.crash && mountOwn());   // Z342 getting on / off: walking there on his own legs, then the climb (actors/soldier-mount.js)
  const busy = mounted || P.dead || (MV && MV.roll >= 0) || (P.trans && !own); let mode = null;
  if(!busy){ if(own) mode = T.k === 'on' && T.t < (T.walkT || 0) ? 'stand' : 'mount'; else if(MV && MV.air) mode = 'air'; else if(P.stance === 'prone') mode = 'prone';
    else if(P.stance === 'crouch') mode = s > (L.mode === 'crouch' ? A.crouch.minV * 0.5 : A.crouch.minV) ? 'crouch' : 'kneel';
    else if(P.stance === 'stand' && s < A.stand.maxV) mode = 'stand'; }
  L.w += ((mode ? 1 : 0) - L.w) * Math.min(1, dt * A.fade);
  if(mode && mode !== L.mode){ const gait = m => m === 'stand' || m === 'crouch';
    if(L.mode && L.pp && L.w > 0.5) L.tr = { on:true, t:0, dur:A.switchT[mode] || 0.3, q:new Map([...L.pp.q].map(([b, q]) => [b, q.clone()])), hp:L.pp.hp.clone(), hq:L.pp.hq.clone() };
    if(!gait(mode) || !gait(L.mode)) L.on = false; if(mode === 'mount' && !L.mode) L.w = 1; L.mode = mode; }   // (Z342 off a saddle: the climb's first pose is his seat — no easing from the clip, which already stands him on the ground)
  if(!mode && L.w < 0.03){ L.w = 0; L.on = false; L.mode = null; L.tr = null; return; }
  const M = A[L.mode || 'stand']; L.t += dt;
  for(const n of BONES){ const b = D[n]; if(!b) continue; let q = L.snap.get(b); if(!q) L.snap.set(b, q = new THREE.Quaternion()); q.copy(b.quaternion); } L.hp.copy(D.Hips.position);   // (the clip's legs, to ease against)
  const len = lens(D, L), slope = A.slope, ankleH = A.toeH - len.fl * Math.sin(slope);
  G.getWorldQuaternion(_q); _a.set(0, 0, 1).applyQuaternion(_q); const psi = Math.atan2(_a.x, _a.z);
  if(L.mode === 'kneel'){ kneelPose(D, L, A, psi, len, ankleH, MV); return finish(D, L, dt); }
  if(L.mode === 'prone'){ pronePose(D, L, A, psi, len, dt, s); return finish(D, L, dt); }
  if(L.mode === 'air'){ airPose(D, L, A, psi, len, slope); return finish(D, L, dt); }
  if(L.mode === 'mount'){ mountPose(D, len, ankleH, slope); return finish(D, L, dt); }
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
      _e.subVectors(_d, f.p); _e.y = 0; const st = _e.length(), mx = M.maxStride * (back ? A.backStep : 1); if(st > mx) _d.copy(f.p).addScaledVector(_e, mx / st);   // (a foot travels a whole stride: two steps)
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
  if(MV && MV.land > 0) hipY -= A.landDip * Math.sin(Math.PI * clamp(1 - MV.land / CAV.moves.jump.land, 0, 1));   // Z341 down he comes: the knees give, then straighten
  if(MV && MV.cover != null && L.mode === 'stand' && !moving) hipY = clamp(MV.cover + A.coverRest - A.pocket, hipY - A.coverDrop, hipY);   // Z341 behind higher cover: down at the knees until the rifle lies on its top
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
  finish(D, L, dt); }
// the end of every frame: a change of position eased from the last pose; the whole eased against the clip's own legs; this pose kept for the next change
function finish(D, L, dt){ const h = D.Hips, T = L.tr;
  if(T && T.on){ T.t += dt; const k = smooth(clamp(T.t / T.dur, 0, 1)); if(k >= 1) T.on = false;
    else { h.updateWorldMatrix(true, false); h.getWorldPosition(_a); h.getWorldQuaternion(_qw); _b.copy(T.hp).lerp(_a, k); _q.copy(T.hq).slerp(_qw, k);
      for(const [b, q] of T.q){ if(b === h) continue; _qp.copy(b.quaternion); b.quaternion.copy(q).slerp(_qp, k); }
      h.parent.worldToLocal(_b); h.position.copy(_b); h.parent.getWorldQuaternion(_qp); h.quaternion.copy(_qp.invert().multiply(_q)); h.updateMatrixWorld(true); } }
  if(L.w < 0.999){ for(const [b, q] of L.snap){ _q.copy(b.quaternion); b.quaternion.copy(q).slerp(_q, L.w); } h.position.lerpVectors(L.hp, h.position, L.w); h.updateMatrixWorld(true); }
  const pp = L.pp || (L.pp = { q:new Map(), hp:V3(), hq:new THREE.Quaternion() }); for(const n of BONES){ const b = D[n]; if(!b) continue; let q = pp.q.get(b); if(!q) pp.q.set(b, q = new THREE.Quaternion()); q.copy(b.quaternion); }
  h.updateWorldMatrix(true, false); h.getWorldPosition(pp.hp); h.getWorldQuaternion(pp.hq); }
// a step: from where the foot is to `to`, turning to `yaw`, over `dur` s, lifted `h`; cross = ±1 when it crosses over the other foot (round in front / behind)
function step(f, to, yaw, dur, h, cross = 0){ const from = f.p.clone(); from.y = 0; const d = to.clone(); d.y = 0; _k.subVectors(d, from); const L = _k.length();
  f.sw = { from, to:d, y0:f.yaw, y1:yaw, t:0, dur, h:L > 0.05 ? h : h * 0.5, cross, dir:L > 0.05 ? _k.dot(_e.set(Math.sin(yaw), 0, Math.cos(yaw))) / L : 0 }; }
// where the ankle is: over the foot's spot at its height; heel up it turns about the ball of the foot, toes up about the ankle
function ankle(f, len, ankleH, slope, out){ FF.set(Math.sin(f.yaw), 0, Math.cos(f.yaw)); const y = f.y + (f.lift || 0);
  if(f.ph > 0){ const fc = len.fl * Math.cos(slope), sl = slope - f.ph; out.copy(f.p).addScaledVector(FF, fc); out.y = y + (ankleH + len.fl * Math.sin(slope)); out.addScaledVector(FF, -len.fl * Math.cos(sl)); out.y -= len.fl * Math.sin(sl); }
  else { out.copy(f.p); out.y = y + ankleH; }
  return out; }

// ---- Z341 the pelvis set by its own frame: its hip joints' middle to p, up along `up`, right (left hip → right hip) along `rt` ----
const _s1 = V3(), _s2 = V3(), _s3 = V3(), _s4 = V3(), _s5 = V3(), _s6 = V3(), _s7 = V3(), _s8 = V3(), _sm = new THREE.Matrix4(), _sm2 = new THREE.Matrix4(), _sq = new THREE.Quaternion(), _sq2 = new THREE.Quaternion(), _sqw = new THREE.Quaternion(), _sqp = new THREE.Quaternion();
function setHips(D, p, up, rt){ const h = D.Hips;
  wp(h, _s1); wp(D.Spine, _s2); wp(D.RightUpLeg, _s3); wp(D.LeftUpLeg, _s4);
  _s5.subVectors(_s2, _s1).normalize(); _s6.subVectors(_s3, _s4); _s7.crossVectors(_s6, _s5).normalize(); _s6.crossVectors(_s5, _s7); _sm.makeBasis(_s6, _s5, _s7);
  _s5.copy(up).normalize(); _s7.crossVectors(rt, _s5).normalize(); _s8.crossVectors(_s5, _s7); _sm2.makeBasis(_s8, _s5, _s7);   // (right × up points backward, in both frames)
  _sq.setFromRotationMatrix(_sm2); _sq2.setFromRotationMatrix(_sm); _sq.multiply(_sq2.invert());
  h.getWorldQuaternion(_sqw); _sqw.premultiply(_sq); h.parent.getWorldQuaternion(_sqp); h.quaternion.copy(_sqp.invert().multiply(_sqw)); h.updateMatrixWorld(true);
  wp(D.RightUpLeg, _s3); wp(D.LeftUpLeg, _s4); _s3.add(_s4).multiplyScalar(0.5); wp(h, _s1); _s1.add(p).sub(_s3); h.parent.worldToLocal(_s1); h.position.copy(_s1); h.updateMatrixWorld(true); }
// the torso up from the hips along `dir`, its shoulder line brought square to the aim (psi)
const _t1 = V3(), _t2 = V3(), _t3 = V3(), _t4 = V3(), FK = V3(), RK = V3(), FA = V3(), RA = V3();
function torso(D, dir, psi){ aim(D.Spine, D.Neck, dir);
  wp(D.RightArm, _t1); wp(D.LeftArm, _t2); _t1.sub(_t2); _t1.addScaledVector(dir, -_t1.dot(dir)); _t3.set(-Math.cos(psi), 0, Math.sin(psi)); _t3.addScaledVector(dir, -_t3.dot(dir));
  if(_t1.lengthSq() < 1e-6 || _t3.lengthSq() < 1e-6) return; _t1.normalize(); _t3.normalize();
  const a = Math.atan2(_t4.crossVectors(_t1, _t3).dot(dir), _t1.dot(_t3)); turn(D.Spine1, dir, a * 0.5); turn(D.Spine2, dir, a * 0.5); }
const frames = (psi, yaw) => { FA.set(Math.sin(psi), 0, Math.cos(psi)); RA.set(-Math.cos(psi), 0, Math.sin(psi)); FK.set(Math.sin(yaw), 0, Math.cos(yaw)); RK.set(-Math.cos(yaw), 0, Math.sin(yaw)); };

// ---- Z341 kneeling: the right knee down, the right foot up on its toes behind it, the left foot flat in front with the shin upright; hips turned a
//   little right, leaning in; behind low cover, as high or low on the knee as lays the rifle on its top ----
function kneelPose(D, L, A, psi, len, ankleH, MV){ const K = A.kneel, yk = psi - K.turn; frames(psi, yk);
  const bx = L.prev.x, bz = L.prev.z, gy = heightAt(bx, bz), kY = gy + K.kneeH, top = kY + len.th * 0.97;
  let hk = kY + len.th * K.hipK; if(MV && MV.cover != null) hk = clamp(MV.cover + A.coverRest - A.pocket * Math.cos(K.torso), kY + K.low, top);
  _a.set(bx, hk, bz).addScaledVector(FK, K.hipF).addScaledVector(RK, K.hipR);
  setHips(D, _a, _b.copy(UP).multiplyScalar(Math.cos(K.lean)).addScaledVector(FK, Math.sin(K.lean)), RK);
  // the right knee on the ground, under (or, sat back low, ahead of) the hip; the ankle behind it over the ball of the foot
  wp(D.RightUpLeg, _a); const dy = _a.y - kY, d = Math.sqrt(Math.max(0, len.th * len.th - dy * dy)) * 0.98;
  _b.set(_a.x, kY, _a.z).addScaledVector(FK, d);
  const aY = gy + A.toeH + len.fl * 0.96, sy = aY - kY; _c.copy(_b).addScaledVector(FK, -Math.sqrt(Math.max(0, len.sh * len.sh - sy * sy)) * 0.98); _c.y = aY;
  ik2(D.RightUpLeg, D.RightLeg, D.RightFoot, _c, _d.copy(_b).addScaledVector(FK, 0.3).addScaledVector(UP, -0.15));
  aim(D.RightFoot, D.RightToeBase, _e.copy(FK).multiplyScalar(0.28).addScaledVector(UP, -1));   // (up on the toes, the sole to the back)
  if(D.RightToe_End) aim(D.RightToeBase, D.RightToe_End, _e.copy(FK));   // (the toes bent flat on the ground)
  // the left foot flat out in front, far enough that the shin stands upright
  wp(D.LeftUpLeg, _a); const kLy = gy + ankleH + len.sh, dl = Math.sqrt(Math.max(0, len.th * len.th - (kLy - _a.y) ** 2)) * 0.97;
  const yawL = yk + K.footYaw; FF.set(Math.sin(yawL), 0, Math.cos(yawL)); _b.set(_a.x, 0, _a.z).addScaledVector(FK, dl).addScaledVector(RK, -K.footOut); _b.y = heightAt(_b.x, _b.z) + ankleH;
  ik2(D.LeftUpLeg, D.LeftLeg, D.LeftFoot, _b, _d.copy(_b).addScaledVector(FF, 0.4).addScaledVector(UP, 0.8).addScaledVector(RK, -0.1));
  aim(D.LeftFoot, D.LeftToeBase, _e.copy(FF).multiplyScalar(Math.cos(A.slope)).addScaledVector(UP, Math.sin(A.slope)));
  // up from the hips, leaning into the rifle, the shoulders square to the aim
  torso(D, _e.copy(UP).multiplyScalar(Math.cos(K.torso)).addScaledVector(FA, Math.sin(K.torso)), psi); }

// ---- Z341 prone: the legs in a V behind him, the feet turned out on their inside edges; crawling, a knee drawn up and out on one side, then the other ----
function pronePose(D, L, A, psi, len, dt, s){ const K = A.prone; frames(psi, psi); const crawl = s > A.moveV; L.cph = (L.cph || 0) + (crawl ? dt * K.crawlRate : 0);
  for(const [L1, sd] of SIDES){ wp(D[L1 + 'UpLeg'], _a); const g = heightAt(_a.x, _a.z), pull = crawl ? Math.max(0, Math.sin(L.cph + (sd < 0 ? 0 : Math.PI))) : 0;
    _k.copy(FA).multiplyScalar(-Math.cos(K.spread)).addScaledVector(RA, sd * Math.sin(K.spread));   // the leg's line, out from straight back
    _b.copy(_a).addScaledVector(_k, len.leg * (K.reach - K.pullIn * pull)).addScaledVector(RA, sd * K.pullOut * pull); _b.y = g + K.ankleY;
    ik2(D[L1 + 'UpLeg'], D[L1 + 'Leg'], D[L1 + 'Foot'], _b, _d.copy(_a).addScaledVector(_k, len.th * 0.6).addScaledVector(RA, sd * (0.15 + 0.4 * pull)).addScaledVector(UP, -0.4));
    aim(D[L1 + 'Foot'], D[L1 + 'ToeBase'], _e.copy(_k).multiplyScalar(0.35).addScaledVector(RA, sd * 0.9).addScaledVector(UP, -0.3)); } }   // (toes out, the inside of the foot down)

// ---- Z341 the jump: driven straight off the ground (toes pointed), tucked up under him at the top, reaching for the ground coming down ----
function airPose(D, L, A, psi, len, slope){ const J = CV.jump, Q = A.air; if(!J) return; frames(psi, psi); const vy0 = CAV.moves.jump.vy;
  const u = J.vy >= 0 ? 1 - J.vy / vy0 : 1 + Math.min(1, -J.vy / vy0), tuck = u < 1 ? smooth(Math.min(1, u * Q.rise)) : smooth(clamp((2 - u) * Q.reachK, 0, 1));
  for(const [L1, sd] of SIDES){ wp(D[L1 + 'UpLeg'], _a); const r = len.leg * (Q.ext + (Q.tuck - Q.ext) * tuck);
    _b.copy(_a).addScaledVector(UP, -r).addScaledVector(FA, (Q.fwd + (sd < 0 ? Q.lead : 0)) * tuck).addScaledVector(RA, sd * Q.out);
    ik2(D[L1 + 'UpLeg'], D[L1 + 'Leg'], D[L1 + 'Foot'], _b, _d.copy(_a).addScaledVector(FA, 0.8).addScaledVector(UP, -0.2));
    const sl = slope - (Q.point * (1 - tuck) + 0.15 * tuck); aim(D[L1 + 'Foot'], D[L1 + 'ToeBase'], _e.copy(FA).multiplyScalar(Math.cos(sl)).addScaledVector(UP, Math.sin(sl))); } }
// Z342 the bone tools, for the climb on and off (actors/soldier-mount.js)
export const LEGKIT = { aim, turn, setHips, torso, wp };
