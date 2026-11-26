// actors/gun-reload.js — GUN 2 THE RELOAD AS A SEQUENCE OF REAL STEPS, per weapon family (config GUNFEEL.reload; driven by actors/real-cav.js holdReal):
//   it was one path for every gun — handguard → magazine → pouch → magazine → bolt → handguard, a dark square dropped, one sound at the start, the bolt
//   always racked. Now each family has its own steps, each a share of that gun's own reload time (GUNS[id].reload — unchanged when it ran dry):
//   · mag (rifles, SMGs, the DMR, the cell guns): the hand leaves the handguard → takes the magazine out → drops it (dry) or stows it in the dump pouch
//     at his left hip (a round still chambered) → a fresh one from the vest → up into the well, seated → the charging handle racked ONLY when the gun
//     ran dry (the other reload has no rack: it is that much shorter) → back on the handguard
//   · belt (PKM, minigun, flamer): the feed cover up → the box off (dropped) → a new box from his hip → hung → the belt laid on the tray → the cover
//     slapped shut → racked (dry) → back
//   · bolt (the 12.7): the magazine as a rifle's, then the RIGHT hand leaves the grip and works the bolt — up, back, forward, down (dry)
//   · shell (the shotgun, the M79): round by round into the loading port — as many as are missing, each its share of the time — then the pump (dry)
//   · tube (the B41): a rocket from the bag on his front into the muzzle, pushed home (holdReal's loadPose stands the tube up for it)
//   reloadPlan is pure (combat/guns.js startReload times the reload with it; test.js checks it); reloadState reads where he is in it each frame;
//   reloadHands gives the hands' targets and fires each step's sound at its own moment; reloadProps draws what the left hand holds (a magazine sized off
//   the gun's own, an ammo box, a shell, a rocket, a cell) and lets a dropped magazine fall and lie; handsEase / gunEase take any jump of a hand or of
//   the gun (a reload begun at a sprint, a new weapon, a change of position) and ease it out instead of teleporting.
import * as THREE from 'three';
import { GUNFEEL, GUNHOLD } from '../../config.js';
import { heightAt, ik2, scene, sfx } from '../hub.js';
import { BODYFULL } from '../../config.js';   // BODY 10 the B41's rockets carried on his chest, by the tube

const V3 = () => new THREE.Vector3(), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);

// ---- the plan (pure) ----
export function reloadFamily(kind){ return GUNFEEL.reload.family[kind] || 'mag'; }
const _plans = new Map();
// kind = the hand weapon (INFGUN.guns key), dry = it ran empty, load = the share of its rounds to put in (only a round-by-round gun's time depends on it)
//   → { fam, dry, load, k (share of the gun's full reload time it takes), steps:[{ n, t0, t1 }] (0…1 of this reload) }
export function reloadPlan(kind, dry = true, load = 1){ const C = GUNFEEL.reload, fam = reloadFamily(kind), ld = fam === 'shell' ? clamp(Math.round(load * 20) / 20, 0.1, 1) : 1, key = fam + (dry ? 'd' : 't') + ld;
  let P = _plans.get(key); if(P) return P;
  const raw = C.steps[fam].filter(s => dry || !C.dry.includes(s[0])).map(s => [s[0], s[1] * (s[0] === 'shells' ? ld : 1)]), k = raw.reduce((a, s) => a + s[1], 0); let t = 0;
  P = { fam, dry, load:ld, k, steps:raw.map(([n, w]) => { const t0 = t / k; t += w; return { n, t0, t1:t / k }; }) }; _plans.set(key, P); return P; }

// ---- where he is in it ----
// what happens once at a moment of a step: [step, how far through it, the sound] ('drop' = the magazine let go: only when the gun ran dry — a belt box always)
const EV = { mag:[['out', 0, 'magOut'], ['stow', 0.3, 'drop'], ['seat', 0.75, 'magIn'], ['rack', 0.55, 'boltRack']], bolt:[['out', 0, 'magOut'], ['stow', 0.3, 'drop'], ['seat', 0.75, 'magIn'], ['rack', 0.42, 'boltRack']],
  belt:[['open', 0, 'magOut'], ['stow', 0.3, 'drop'], ['in', 0.92, 'magIn'], ['close', 0.7, 'magIn'], ['rack', 0.55, 'boltRack']], shell:[['rack', 0.5, 'boltRack']], tube:[['push', 0.85, 'magIn']] };
const _rs = { rk:-1, low:0, step:null, u:0, i:0, fam:'mag', dry:true, P:null, L:null };
// R = CV.real, inst = the gun in his hands (rU / rD / rDry / rLoad / rN from startReload), prone → the shared state object (read it at once)
export function reloadState(R, inst, nowS, prone){ const C = GUNFEEL.reload, O = _rs; O.rk = -1; O.low = 0; O.step = null; O.L = null; O.P = null;
  if(!inst || !inst.rU || !(inst.rD >= GUNHOLD.reload.min)){ R.rl = null; return O; }
  const rk = clamp(1 - (inst.rU - nowS) / inst.rD, 0, 1); let L = R.rl;
  if(!L || L.inst !== inst || L.k !== R.armK || L.end !== inst.rU){ const plan = reloadPlan(R.armK, inst.rDry !== false, inst.rLoad ?? 1);
    L = R.rl = { inst, end:inst.rU, k:R.armK, plan, ev:{}, n:clamp(inst.rN || C.shellMax, 1, C.shellMax) };
    for(const [s, f] of EV[plan.fam] || []){ const st = plan.steps.find(x => x.n === s); if(st && rk > st.t0 + f * (st.t1 - st.t0) + 0.02) L.ev[s + f] = 1; } }   // (taken up part way — a gun switched back to: what is already done makes no sound now)
  const st = L.plan.steps; let i = 0; while(i < st.length - 1 && rk >= st[i].t1) i++;
  const s = st[i]; O.rk = rk; O.i = i; O.step = s.n; O.u = clamp((rk - s.t0) / Math.max(1e-4, s.t1 - s.t0), 0, 1); O.fam = L.plan.fam; O.dry = L.plan.dry; O.L = L;
  O.low = i === 0 ? smooth(O.u) : i === st.length - 1 ? 1 - smooth(O.u) : 1; const P = C.pose[O.fam]; O.P = prone && P.prone ? P.prone : P; return O; }

// ---- the hands ----
const P = { hg:V3(), mag:V3(), out:V3(), pouch:V3(), dump:V3(), bolt:V3(), back:V3(), cover:V3(), up:V3(), port:V3(), fl:V3(), t:V3(), prev:V3(), h0:V3(), h1:V3(), h2:V3() };
const _rh = { l:V3(), r:V3(), rOn:false, lc:0.55, look:0.3 };
let F = null;
const pt = (out, xy, len, dy = 0) => out.set(xy[0] * len, xy[1] + dy, 0).applyQuaternion(F.q).add(F.p);
const mix = (out, a, b, u) => out.copy(a).lerp(b, smooth(u));
const topAt = (g, x) => { if(!g.rows) return (g.bore ?? 0.02) + 0.05; const N = g.rows.length, r = g.rows[clamp(Math.round((x + 0.5) * N - 0.5), 0, N - 1)]; return r ? r[1] : (g.bore ?? 0.02) + 0.05; };
function points(D, g, len, wl, fam){ const H = GUNHOLD, A = GUNFEEL.reload.at, m = g.mag || H.mag, L = g.load;
  P.hg.copy(wl);
  if(fam === 'tube' && L){ pt(P.t, m, len); P.out.copy(P.t).addScaledVector(F.x, -L.ahead[0]); P.mag.copy(P.t).addScaledVector(F.x, -L.ahead[1]);   // (ahead of the muzzle: along the bore, −x)
    const pc = (BODYFULL.tube && BODYFULL.tube.pouch) || L.pouch; D.Spine2.getWorldPosition(P.pouch).addScaledVector(F.r, -pc[0]).addScaledVector(F.u, pc[1]).addScaledVector(F.f, pc[2]); return; }
  pt(P.mag, m, len).addScaledVector(F.y, -0.04); P.out.copy(P.mag).addScaledVector(F.y, -(clamp(g.magSize || 0.14, 0.1, 0.24) * 0.6 + A.clear));
  pt(P.port, m, len).addScaledVector(F.y, -0.035);
  pt(P.bolt, g.bolt || H.bolt, len).addScaledVector(F.y, 0.03); P.back.copy(P.bolt).addScaledVector(F.x, A.rack);
  pt(P.cover, [m[0], topAt(g, m[0]) + 0.02], len); P.up.copy(P.cover).addScaledVector(F.y, A.lid);
  D.Spine2.getWorldPosition(P.pouch).addScaledVector(F.r, -A.pouch[0]).addScaledVector(F.u, A.pouch[1]).addScaledVector(F.f, A.pouch[2]);
  (D.Hips || D.Spine2).getWorldPosition(P.dump).addScaledVector(F.r, -A.dump[0]).addScaledVector(F.u, A.dump[1]).addScaledVector(F.f, A.dump[2]);
  for(const v of [P.pouch, P.dump]){ const gy = heightAt(v.x, v.z) + 0.07; if(v.y < gy) v.y = gy; } }   // (lying down: not under the ground)
// the magazine flicked clear of the gun before it is let go
const flick = out => out.copy(P.out).addScaledVector(F.r, -0.08).addScaledVector(F.u, -0.05);
// the left hand's place at u (0…1) of step n
function leftAt(fam, n, u, dry, L, out){
  if(fam === 'tube') switch(n){ case 'off': return mix(out, P.hg, P.pouch, u); case 'fetch': return out.copy(P.pouch).addScaledVector(F.f, -0.03 * Math.sin(Math.PI * u)); case 'in': return mix(out, P.pouch, P.out, u);
    case 'seat': return out.copy(P.out); case 'push': return mix(out, P.out, P.mag, u); case 'hold': return out.copy(P.mag); default: return mix(out, P.mag, P.hg, u); }
  if(fam === 'shell') switch(n){ case 'off': return mix(out, P.hg, P.dump, u);
    case 'shells': { const N = L.n, c = Math.min(N - 1, Math.floor(u * N)), v = u * N - c;   // one round: taken at the hip, to the port, thumbed in, back for the next
      return v < 0.12 ? out.copy(P.dump) : v < 0.62 ? mix(out, P.dump, P.port, seg(v, 0.12, 0.62)) : v < 0.78 ? mix(out, P.port, P.fl.copy(P.port).addScaledVector(F.x, -0.035), seg(v, 0.62, 0.78)) : c < N - 1 ? mix(out, P.port, P.dump, seg(v, 0.78, 1)) : out.copy(P.port); }
    case 'rack': return u < 0.35 ? mix(out, P.port, P.hg, u / 0.35) : u < 0.6 ? mix(out, P.hg, P.fl.copy(P.hg).addScaledVector(F.x, GUNFEEL.reload.at.pump), seg(u, 0.35, 0.6)) : mix(out, P.fl.copy(P.hg).addScaledVector(F.x, GUNFEEL.reload.at.pump), P.hg, seg(u, 0.6, 0.85));
    default: return out.copy(P.hg); }
  switch(n){ case 'off': return mix(out, P.hg, fam === 'belt' ? P.cover : P.mag, u);
    case 'open': return mix(out, P.cover, P.up, u);
    case 'out': return fam === 'belt' ? (u < 0.5 ? mix(out, P.up, P.mag, u / 0.5) : mix(out, P.mag, P.out, seg(u, 0.5, 1))) : mix(out, P.mag, P.out, u);
    case 'stow': { const to = fam === 'belt' ? P.dump : P.pouch; return dry || fam === 'belt' ? (u < 0.3 ? mix(out, P.out, flick(P.fl), u / 0.3) : mix(out, flick(P.fl), to, seg(u, 0.3, 1))) : mix(out, P.out, P.dump, u); }
    case 'fetch': { const at = fam === 'belt' ? P.dump : P.pouch; return dry || fam === 'belt' ? out.copy(at).addScaledVector(F.f, -0.03 * Math.sin(Math.PI * u)) : mix(out, P.dump, P.pouch, u); }
    case 'in': return fam === 'belt' ? (u < 0.7 ? mix(out, P.dump, P.out, u / 0.7) : mix(out, P.out, P.mag, seg(u, 0.7, 1))) : mix(out, P.pouch, P.out, u);
    case 'seat': return mix(out, P.out, P.mag, u).addScaledVector(F.y, 0.012 * Math.sin(Math.PI * Math.min(1, u * 1.25)));   // (pushed home, a slap)
    case 'belt': return mix(out, P.mag, P.up, u);
    case 'close': return mix(out, P.up, P.cover, u);
    case 'rack': { const from = fam === 'belt' ? P.cover : P.mag; if(fam === 'bolt') return mix(out, P.mag, P.hg, u / 0.6);   // (the bolt gun: the left hand goes back to the handguard — the right works the bolt)
      return u < 0.4 ? mix(out, from, P.bolt, u / 0.4) : u < 0.7 ? mix(out, P.bolt, P.back, seg(u, 0.4, 0.7)) : mix(out, P.back, P.bolt, seg(u, 0.7, 0.85)); }
    default: return out.copy(P.hg); } }
// what the left hand holds at u of step n: 'old' (the spent magazine / box), 'new' (a fresh one, a round, a rocket), or nothing
function holding(fam, n, u, dry, L){
  if(fam === 'tube') return n === 'fetch' ? (u >= 0.5 ? 'new' : null) : n === 'in' || n === 'seat' ? 'new' : n === 'push' ? (u < 0.85 ? 'new' : null) : null;
  if(fam === 'shell'){ if(n !== 'shells') return null; const v = (u * L.n) % 1; return v >= 0.1 && v < 0.7 ? 'new' : null; }
  const drop = dry || fam === 'belt';
  switch(n){ case 'out': return fam === 'belt' && u < 0.5 ? null : 'old'; case 'stow': return u < (drop ? 0.3 : 0.92) ? 'old' : null; case 'fetch': return u >= (drop ? 0.5 : 0.9) ? 'new' : null;
    case 'in': return fam === 'belt' && u >= 0.92 ? null : 'new'; case 'seat': return u < 0.75 ? 'new' : null; default: return null; } }
// RS = reloadState's result (rk ≥ 0); FR = the gun's frame and his own { p, q, x, y, z, r, u, f }; wl / wr = where the hands hold the gun (the handguard, the
//   grip) → { l: the left hand's target, r: the right hand's when rOn (the bolt), lc: how far the left hand's fingers close, look: how far he looks down }
export function reloadHands(R, RS, D, g, len, FR, wl, wr){ F = FR; const L = RS.L, fam = RS.fam, n = RS.step, u = RS.u, dry = RS.dry, st = L.plan.steps, O = _rh; points(D, g, len, wl, fam);
  if(RS.i === st.length - 1 && RS.i > 0){ leftAt(fam, st[RS.i - 1].n, 1, dry, L, P.prev); mix(O.l, P.prev, P.hg, u); } else leftAt(fam, n, u, dry, L, O.l);
  L.have = holding(fam, n, u, dry, L); O.lc = L.have ? 0.7 : n === 'rack' || n === 'close' || n === 'open' ? 0.6 : 0.35; O.look = RS.P.look; O.rOn = false;
  // the bolt gun: the right hand off the grip — to the handle, up, back, forward, down, and home
  if(fam === 'bolt' && n === 'rack'){ const A = GUNFEEL.reload.at; pt(P.h0, g.bolt || GUNHOLD.bolt, len).addScaledVector(F.z, -A.handle[0]).addScaledVector(F.y, A.handle[1]).addScaledVector(F.x, 0.03);
    P.h1.copy(P.h0).addScaledVector(F.y, A.lift); P.h2.copy(P.h1).addScaledVector(F.x, A.rack + 0.03);
    if(u < 0.2) mix(O.r, wr, P.h0, u / 0.2); else if(u < 0.32) mix(O.r, P.h0, P.h1, seg(u, 0.2, 0.32)); else if(u < 0.5) mix(O.r, P.h1, P.h2, seg(u, 0.32, 0.5)); else if(u < 0.68) mix(O.r, P.h2, P.h1, seg(u, 0.5, 0.68));
    else if(u < 0.8) mix(O.r, P.h1, P.h0, seg(u, 0.68, 0.8)); else mix(O.r, P.h0, wr, seg(u, 0.8, 1)); O.rOn = true; }
  // each step's sound at its own moment; the spent magazine let go
  for(const [s, f, what] of EV[fam] || []){ const k = s + f; if(L.ev[k]) continue; const stp = st.find(x => x.n === s); if(!stp || RS.rk < stp.t0 + f * (stp.t1 - stp.t0)) continue; L.ev[k] = 1;
    if(what === 'drop'){ if(fam === 'belt' || dry && g.magDrop !== false) L.drop = true; } else sfx(what); }   // (only a magazine drops: a gun loaded through a port has none)
  if(fam === 'shell' && (n === 'shells' || RS.i > 1)){ const done = n === 'shells' ? Math.floor(u * L.n + 0.3) : L.n; if((L.sc || 0) < Math.min(L.n, done)){ L.sc = Math.min(L.n, done); sfx('shellIn'); } }   // (each round thumbed in: its click — a long frame that passes two plays one)
  return O; }

// ---- what the hand holds, drawn ----
const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10).rotateZ(Math.PI / 2), CONE = new THREE.ConeGeometry(0.5, 1, 12).rotateZ(Math.PI / 2);   // (along the gun: its x)
function props(R){ if(R.rlp) return R.rlp; const C = GUNFEEL.reload.prop, mk = (geo, col, em) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color:col, roughness:0.62, metalness:0.3, emissive:em || 0 })); m.visible = false; m.castShadow = true; m.frustumCulled = false; scene.add(m); return m; };
  const rocket = new THREE.Group(), head = mk(CONE, C.col.rocket), body = mk(CYL, C.col.rocket), stem = mk(CYL, 0x3a3d36); for(const m of [head, body, stem]){ scene.remove(m); m.visible = true; rocket.add(m); }
  head.scale.set(C.rocket[0] * 0.45, C.rocket[1], C.rocket[1]); head.position.x = -C.rocket[0] * 0.325; body.scale.set(C.rocket[0] * 0.2, C.rocket[1], C.rocket[1]); stem.scale.set(C.rocket[0] * 0.45, C.rocket[1] * 0.42, C.rocket[1] * 0.42); stem.position.x = C.rocket[0] * 0.325;
  rocket.visible = false; scene.add(rocket);
  return (R.rlp = { box:mk(BOX, C.col.mag), cell:mk(BOX, C.col.cell, 0x153a6a), shell:mk(CYL, C.col.shell), rocket, fall:mk(BOX, C.col.mag), f:{ on:false, v:V3(), life:0, rest:false, w:0 }, all:null }); }
const _pp = V3(), _pm = V3(), _sc = V3(), _q1 = new THREE.Quaternion(), _ax = V3();
// every frame at the end of holdReal: the thing in his left hand moves with the palm (turned as the gun is); a magazine let go falls, bounces, lies a while
export function reloadProps(R, RS, D, g, len, FR, dt){ if(!R.rlp && RS.rk < 0) return; const Q = props(R), C = GUNFEEL.reload.prop, L = RS.L, fam = RS.fam, kind = R.armK;
  const cell = C.cells.includes(kind), shape = !L || !L.have ? null : fam === 'tube' ? 'rocket' : fam === 'shell' ? 'shell' : cell ? 'cell' : 'box';
  for(const k of ['box', 'cell', 'shell', 'rocket']) Q[k].visible = k === shape;
  let size = null; if(shape === 'box' || shape === 'cell' || (L && L.drop)){ if(fam === 'belt') size = C.belt; else { const sp = g.parts && g.parts.mag; size = [clamp(sp ? (sp[1] - sp[0] + 0.025) * len : C.mag[0], 0.03, 0.1), clamp((g.magSize || C.mag[1] / 0.72) * 0.72, 0.08, 0.2), C.mag[2]]; } }
  if(shape){ const m = Q[shape], h = D.LeftHand, k1 = D.LeftHandMiddle1; h.getWorldPosition(_pp); if(k1) _pp.lerp(k1.getWorldPosition(_pm), 0.55);
    if(shape === 'rocket'){ m.position.copy(_pp).addScaledVector(FR.x, -C.rocket[0] * 0.2).addScaledVector(FR.y, 0.02); m.quaternion.copy(FR.q); }
    else if(shape === 'shell'){ const s = kind === 'gl' ? C.gl : C.shell; m.scale.set(s[0], s[1], s[1]); m.material.color.setHex(kind === 'gl' ? C.col.gl : C.col.shell); m.position.copy(_pp).addScaledVector(FR.y, 0.015); m.quaternion.copy(FR.q); }
    else { m.scale.set(size[0], size[1], size[2]); if(shape === 'box') m.material.color.setHex(fam === 'belt' ? C.col.belt : C.col.mag); m.position.copy(_pp).addScaledVector(FR.y, size[1] * 0.5 - 0.035); m.quaternion.copy(FR.q); } }
  // the spent magazine: let go where the hand is, thrown a little to his left, falling
  const f = Q.f; if(L && L.drop){ L.drop = false; const m = Q.fall; D.LeftHand.getWorldPosition(m.position); m.quaternion.copy(FR.q); m.scale.set(size[0], size[1], size[2]); m.material.color.setHex(fam === 'belt' ? C.col.belt : cell ? C.col.cell : C.col.mag);
    m.visible = true; f.on = true; f.rest = false; f.life = C.lie; f.h = size[2] * 0.5 + 0.004; f.w = (Math.random() - 0.5) * 9; f.v.copy(FR.r).multiplyScalar(-0.7).addScaledVector(FR.f, 0.15); f.v.y = -0.4; _ax.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(); f.ax = _ax.clone(); }
  if(f.on){ const m = Q.fall; f.life -= dt; if(f.life <= 0){ f.on = false; m.visible = false; }
    else if(!f.rest){ f.v.y += C.grav * dt; m.position.addScaledVector(f.v, dt); m.quaternion.premultiply(_q1.setFromAxisAngle(f.ax, f.w * dt)); const gy = heightAt(m.position.x, m.position.z) + f.h;
      if(m.position.y <= gy){ m.position.y = gy; if(f.v.y < -1.6 && !f.hit){ f.hit = true; f.v.y *= -0.28; f.v.x *= 0.5; f.v.z *= 0.5; f.w *= 0.4; } else { f.rest = true; f.hit = false; m.quaternion.setFromAxisAngle(_ax.set(0, 1, 0), Math.random() * 6.283).multiply(_q1.setFromAxisAngle(_ax.set(1, 0, 0), Math.PI / 2)); } } }   // (it lies on its side)
    else if(f.life < 0.4) m.scale.multiplyScalar(Math.max(0.01, 1 - dt * 5)); } }

// ---- no hand and no gun ever teleports ----
// the gun: its pose in his chest's frame; a jump (faster than E.v m/s or E.w rad/s — a reload begun at a sprint, a hold that flips) is taken into an
//   offset that eases out at E.rate /s. Call it when the gun's place (FR.p, FR.q) is first decided; it rewrites them (and the axes) with the offset on
const _cp = V3(), _lp = V3(), _cq = new THREE.Quaternion(), _lq = new THREE.Quaternion(), _iq = new THREE.Quaternion(), ID = new THREE.Quaternion();
export function gunEase(R, D, FR, dt){ const E = GUNFEEL.reload.ease, c = D.Spine2; if(!c || !dt) return; c.getWorldPosition(_cp); c.getWorldQuaternion(_cq); _iq.copy(_cq).invert();
  _lp.copy(FR.p).sub(_cp).applyQuaternion(_iq); _lq.copy(_iq).multiply(FR.q); let G = R.ge;
  if(!G || G.k !== R.armK){ R.ge = { k:R.armK, p:_lp.clone(), q:_lq.clone(), op:V3(), oq:new THREE.Quaternion(), on:false }; return; }
  if(_lp.distanceTo(G.p) > E.v * dt){ G.op.add(G.p).sub(_lp); G.on = true; }
  if(_lq.angleTo(G.q) > E.w * dt){ G.oq.multiply(G.q).multiply(_iq.copy(_lq).invert()); G.on = true; }   // (oq′ · lq = oq · the last lq: it stays where it was)
  G.p.copy(_lp); G.q.copy(_lq); if(!G.on) return;
  const k = Math.exp(-dt * E.rate); G.op.multiplyScalar(k); G.oq.slerp(ID, 1 - k); if(G.op.lengthSq() < 1e-8 && G.oq.angleTo(ID) < 2e-3){ G.on = false; G.op.set(0, 0, 0); G.oq.identity(); return; }
  _lp.add(G.op); _lq.premultiply(G.oq); FR.p.copy(_lp).applyQuaternion(_cq).add(_cp); FR.q.copy(_cq).multiply(_lq);
  FR.x.set(1, 0, 0).applyQuaternion(FR.q); FR.y.set(0, 1, 0).applyQuaternion(FR.q); FR.z.set(0, 0, 1).applyQuaternion(FR.q); }
// the hands: each wrist in his chest's frame; a jump is held back and eased out — the arm laid again to where the wrist is let get to. Call it last
const _hw = V3(), _hl = V3();
export function handsEase(R, D, dt, poleL, poleR){ const E = GUNFEEL.reload.ease, c = D.Spine2; if(!c || !dt) return; c.getWorldPosition(_cp); c.getWorldQuaternion(_cq); _iq.copy(_cq).invert();
  const S = R.he || (R.he = { Left:{ p:V3(), o:V3(), on:false, seen:false }, Right:{ p:V3(), o:V3(), on:false, seen:false } });
  for(const sd of ['Left', 'Right']){ const h = D[sd + 'Hand'], s = S[sd]; if(!h) continue; h.getWorldPosition(_hw); _hl.copy(_hw).sub(_cp).applyQuaternion(_iq);
    if(!s.seen){ s.p.copy(_hl); s.seen = true; continue; }
    if(_hl.distanceTo(s.p) > E.hand * dt){ s.o.add(s.p).sub(_hl); s.on = true; } s.p.copy(_hl); if(!s.on) continue;
    s.o.multiplyScalar(Math.exp(-dt * E.rate)); if(s.o.lengthSq() < 4e-6){ s.on = false; s.o.set(0, 0, 0); continue; }
    _hl.add(s.o).applyQuaternion(_cq).add(_cp); ik2(D[sd + 'Arm'], D[sd + 'ForeArm'], h, _hl, sd === 'Left' ? poleL : poleR); } }
