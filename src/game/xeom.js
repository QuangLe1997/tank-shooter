// game/xeom.js — Z282 XE ÔM / XÍCH LÔ MODE: the cavalry mode (game/cavalry.js) with a Vietnamese ride instead of the war horse. On the xe ôm
// the driver — green jacket, helmet, honeycomb sandals (the Tripo driver posed and baked) — rides the scooter and our soldier sits on the pillion,
// turning to fire all round; on the xích lô the driver pedals from the rear saddle and the soldier sits in the passenger seat up front, firing
// ahead. The driver only drives: he goes where you steer and stops when you let go. The bike leans into turns and bobs on the road, and the
// driver has a word or two. It answers to the same calls as the horse (root, body B, animate), so mounting, dismounting, firing from the seat
// and being thrown off all work as they do on horseback.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RIDE, XEOM } from '../../config.js';
import { S, driveDriver, floatText, loadGLTF, makeDriver, mountModel } from '../hub.js';

// Z293 the war ride itself: one Tripo model, vehicle and driver together (the driver modelled in his seat, hands on the bars, feet down), turned nose to
//   +z, set on the ground, centred and scaled to its true length; the old scooter / cyclo assembled from the city's parts stay as the fallback
const HERO = {};
function heroGeo(gl, kind){ if(HERO[kind]) return HERO[kind]; const X = XEOM[kind], geos = [], mats = []; gl.scene.updateMatrixWorld(true);
  gl.scene.traverse(o => { if(o.isMesh){ const g = o.geometry.clone().applyMatrix4(o.matrixWorld); for(const k of Object.keys(g.attributes)) if(!['position','normal','uv'].includes(k)) g.deleteAttribute(k); geos.push(g); const m = o.material.clone(); m.envMapIntensity = 0.8; mats.push(m); } });
  const g = geos.length === 1 ? geos[0] : mergeGeometries(geos, true); if(X.yaw) g.rotateY(X.yaw); g.computeBoundingBox(); const b = g.boundingBox, sz = b.getSize(new THREE.Vector3());
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); const s = X.len / XEOM.k / sz.z; g.scale(s, s, s); if(X.wheels) cutWheels(g, X.wheels); const bar = X.steer ? splitBar(g, X.steer) : null; g.computeBoundingBox(); g.computeBoundingSphere();
  return (HERO[kind] = { geo:g, bar, mats:mats.length === 1 ? mats[0] : mats }); }
// Z298 REAL WHEELS: Tripo cannot model 2 mm spokes (it paints them into a blurred disc), so the model's wheels are cut out (every triangle wholly inside a
//   wheel's drum) and real ones built in their place — a treaded rubber tyre, a metal rim, a hub and 36 crossed wire spokes (or a pressed-steel disc) —
//   that roll with the distance driven, the front one steering into the bend
function cutWheels(g, W){ const P = g.attributes.position, I = g.index; if(!I) return; const inW = i => { const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    return W.some(w => Math.abs(x - w.c[0]) < w.w * 0.5 + 0.004 && Math.hypot(y - w.c[1], z - w.c[2]) < w.r * 1.04); };
  const keep = []; const a = I.array; for(let t = 0; t < a.length; t += 3) if(!(inW(a[t]) && inW(a[t + 1]) && inW(a[t + 2]))) keep.push(a[t], a[t + 1], a[t + 2]);
  const grp = g.groups.slice(); if(grp.length <= 1){ g.setIndex(keep); g.clearGroups(); if(grp.length) g.addGroup(0, keep.length, grp[0].materialIndex); return; }
  const out = []; g.clearGroups(); for(const gr of grp){ const st = out.length; for(let t = gr.start; t < gr.start + gr.count; t += 3) if(!(inW(a[t]) && inW(a[t + 1]) && inW(a[t + 2]))) out.push(a[t], a[t + 1], a[t + 2]); g.addGroup(st, out.length - st, gr.materialIndex); } g.setIndex(out); }
// Z299 THE STEERING HEAD AS ITS OWN PART: everything ahead of the steering axis (fork, mudguard, headlamp) and the bars above it is lifted out of the
//   body into its own geometry (sharing the vertex buffers), so it turns about the raked axis with the front wheel and the driver's hands go with it
function splitBar(g, st){ const P = g.attributes.position, a = g.index.array, dz = st.b[0] - st.a[0], dy = st.b[1] - st.a[1], L = Math.hypot(dz, dy);
  const isBar = i => { const y = P.getY(i), z = P.getZ(i); return ((z - st.a[0]) * dy - (y - st.a[1]) * dz) / L > -st.back && y > 0.02 || y > st.top && z > st.z; };
  const grp = g.groups.length ? g.groups.slice() : [{ start:0, count:a.length, materialIndex:0 }], body = [], bar = [], bg = [], rg = [];
  for(const gr of grp){ const s0 = body.length, s1 = bar.length; for(let t = gr.start; t < gr.start + gr.count; t += 3){ const on = isBar(a[t]) && isBar(a[t + 1]) && isBar(a[t + 2]); (on ? bar : body).push(a[t], a[t + 1], a[t + 2]); }
    bg.push([s0, body.length - s0, gr.materialIndex]); rg.push([s1, bar.length - s1, gr.materialIndex]); }
  if(!bar.length) return null; const b = new THREE.BufferGeometry(); for(const k of Object.keys(g.attributes)) b.setAttribute(k, g.attributes[k]); b.setIndex(bar);
  g.setIndex(body); g.clearGroups(); for(const [st0, n, m] of bg) g.addGroup(st0, n, m); for(const [st0, n, m] of rg) b.addGroup(st0, n, m); b.computeBoundingBox(); b.computeBoundingSphere(); return b; }
const WMAT = {};
function wheelMats(){ if(!WMAT.r) Object.assign(WMAT, { r:new THREE.MeshStandardMaterial({ color:0x1b1a18, roughness:0.93, metalness:0 }), m:new THREE.MeshStandardMaterial({ color:0x8c8a84, roughness:0.38, metalness:0.9 }),
  s:new THREE.MeshStandardMaterial({ color:0xb4b2ac, roughness:0.28, metalness:0.95 }), d:new THREE.MeshStandardMaterial({ color:0x4a4c3e, roughness:0.6, metalness:0.6 }), mud:new THREE.MeshStandardMaterial({ color:0x4a3c2c, roughness:1, metalness:0 }) }); return WMAT; }
// one wheel, in metres, axle along X: R tyre outer radius, T tyre section, spoke or disc
function realWheel(R, T, spoked){ const M = wheelMats(), w = new THREE.Group(), parts = { r:[], m:[], s:[], d:[] };
  const tyre = new THREE.TorusGeometry(R - T / 2, T / 2, 10, 40); tyre.rotateY(Math.PI / 2); parts.r.push(tyre);
  for(let i = 0; i < 40; i++){ const a = i / 40 * Math.PI * 2, k = new THREE.BoxGeometry(T * 0.75, T * 0.18, T * 0.32); k.translate(0, R - T * 0.02, 0); k.rotateX(a + (i % 2 ? 0.08 : -0.08)); parts.r.push(k); }   // the tread blocks
  const rimR = R - T * 0.95, rim = new THREE.TorusGeometry(rimR, T * 0.16, 6, 40); rim.rotateY(Math.PI / 2); parts.m.push(rim);
  const hub = new THREE.CylinderGeometry(T * 0.42, T * 0.42, T * 1.1, 14); hub.rotateZ(Math.PI / 2); parts.m.push(hub);
  if(spoked){ const n = 36, sr = 0.0022; for(let i = 0; i < n; i++){ const side = i % 2 ? 1 : -1, a = i / n * Math.PI * 2, a2 = a + (i % 4 < 2 ? 0.55 : -0.55);   // crossed lacing, both flanges
      const p0 = new THREE.Vector3(side * T * 0.42, Math.sin(a2) * T * 0.38, Math.cos(a2) * T * 0.38), p1 = new THREE.Vector3(side * T * 0.08, Math.sin(a) * rimR, Math.cos(a) * rimR), d = p1.clone().sub(p0), L = d.length();
      const sp = new THREE.CylinderGeometry(sr, sr, L, 4, 1); sp.translate(0, L / 2, 0); sp.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); sp.translate(p0.x, p0.y, p0.z); parts.s.push(sp); } }
  else { const disc = new THREE.CylinderGeometry(rimR * 0.98, rimR * 0.98, T * 0.5, 28); disc.rotateZ(Math.PI / 2); parts.d.push(disc);
    for(let i = 0; i < 6; i++){ const a = i / 6 * Math.PI * 2, nut = new THREE.CylinderGeometry(T * 0.06, T * 0.06, T * 0.62, 6); nut.rotateZ(Math.PI / 2); nut.translate(0, Math.sin(a) * T * 0.62, Math.cos(a) * T * 0.62); parts.m.push(nut); } }
  for(const [k, list] of Object.entries(parts)) if(list.length){ const m = new THREE.Mesh(mergeGeometries(list.map(q => q.index ? q.toNonIndexed() : q), false), M[k]); m.castShadow = true; m.receiveShadow = true; w.add(m); }
  return w; }
function buildWheels(H, kind){ const X = XEOM[kind]; if(!X.wheels) return; H.wheels = []; for(const wd of X.wheels){ const R = wd.r * XEOM.k, pivot = new THREE.Group(), spin = realWheel(R, wd.w * XEOM.k * 0.9, wd.spoke !== false);
    spin.scale.setScalar(1 / XEOM.k); pivot.add(spin); pivot.position.fromArray(wd.c); H.B.add(pivot); H.wheels.push({ pivot, spin, R, steer:!!wd.steer }); } }
const _sa = new THREE.Vector3(), _sp = new THREE.Vector3(), _sq = new THREE.Quaternion();
// Z299 the parts: root → B (the machine's lean / wheelie; the wheels, unsprung, on the road) → body (sprung: frame, seat, driver, passenger, its own
//   heave / pitch / roll on the suspension) → bar (the steering head, turning about the raked axis)
export function buildBikeMount(kind){ const root = new THREE.Group(), B = new THREE.Group(), body = new THREE.Group(); root.add(B); B.add(body); const X = XEOM[kind];
  const H = { root, B, body, bike:kind, t:0, v:0, lean:0, wantGraze:false, onStep:null, sayAt:0, gait:'stand', phase:0, steer:0, roll:0,
    sus:{ y:0, vy:0, p:0, vp:0, r:0, vr:0, acc:0, lastV:0, gy:null, gvy:0 }, inert:{ acc:0, lat:0, vy:0, p:0, r:0 } };
  if(X.steer){ const st = X.steer; H.axisP = new THREE.Vector3(0, st.a[1], st.a[0]); H.axis = new THREE.Vector3(0, st.b[1] - st.a[1], st.b[0] - st.a[0]).normalize(); }
  // a point fixed to the body (or, steered, to the bars) in the world
  H.toWorld = (arr, out, steered) => { out.fromArray(arr); if(steered && H.axis && H.steer){ out.sub(H.axisP).applyAxisAngle(H.axis, H.steer).add(H.axisP); } return body.localToWorld(out); };
  const put = m => { if(!m) return; const mesh = new THREE.Mesh(m.geo, m.mats); mesh.castShadow = true; mesh.receiveShadow = true; body.add(mesh); H.mesh = mesh;
    if(m.bar && H.axis){ const piv = new THREE.Group(), bm = new THREE.Mesh(m.bar, m.mats); bm.castShadow = true; bm.receiveShadow = true; piv.position.copy(H.axisP); bm.position.copy(H.axisP).negate(); piv.add(bm); body.add(piv); H.bar = piv; }
    if(!H.wheels) buildWheels(H, kind); };
  loadGLTF('ride_' + kind).then(gl => gl ? put(heroGeo(gl, kind)) : (XEOM[kind].driver ? mountModel(kind).then(put) : null));
  if(RIDE.fit[kind]) makeDriver(H, kind);   // Z296 the driver rides it as his own man
  return H; }
// Z299 THE SUSPENSION: the body rides on springs over the wheels — it squats when the throttle opens and dives when braking hard (and rocks back after),
//   rolls out of the bend on three wheels, heaves over the ground's rises and dips and is kicked by the rough road at speed; the engine buzzes.
//   What the body feels (H.inert: acceleration, cornering, heave) is passed on to the people on it, who sway with it and catch themselves.
function suspension(H, dt, v, yr, two){ const U = XEOM.sus, s = H.sus, k = XEOM.k, sp = Math.min(1, Math.abs(v) / 8); dt = Math.min(dt, 0.05);
  const a = (v - s.lastV) / Math.max(dt, 1e-3); s.lastV = v; s.acc += (Math.max(-25, Math.min(25, a)) - s.acc) * Math.min(1, dt * 10);
  // the ground under it: how fast it rises / falls (a crest throws the body up, a dip drops it)
  H.root.getWorldPosition(_sp); if(s.gy == null) s.gy = _sp.y; const gvy = (_sp.y - s.gy) / Math.max(dt, 1e-3); s.gy = _sp.y; const gac = Math.max(-40, Math.min(40, (gvy - s.gvy) / Math.max(dt, 1e-3))); s.gvy = gvy;
  s.vy -= gac * U.gY * dt;
  // the rough road: a kick now and then, more often and harder the faster
  if(Math.random() < Math.abs(v) * dt * U.rough){ const j = U.bump * (0.35 + Math.random()) * sp; s.vy -= j; s.vp += (Math.random() < 0.5 ? 1 : -1) * j * U.kickP * 3; if(!two) s.vr += (Math.random() - 0.5) * j * 2; }
  const pT = Math.max(U.pitch[0], Math.min(U.pitch[1], s.acc * U.pitchAcc)), lat = v * yr, rT = two ? 0 : Math.max(-U.rollMax, Math.min(U.rollMax, lat * U.rollLat));
  const spr = (x, vx, t, kk, z) => vx + (-kk * (x - t) - 2 * z * Math.sqrt(kk) * vx) * dt;
  s.vy = spr(s.y, s.vy, 0, U.k, U.z); s.y += s.vy * dt; s.vp = spr(s.p, s.vp, pT, U.kp, U.zp); s.p += s.vp * dt; s.vr = spr(s.r, s.vr, rT, U.kr, U.zr); s.r += s.vr * dt;
  s.y = Math.max(-0.05, Math.min(0.05, s.y)); s.p = Math.max(-0.12, Math.min(0.1, s.p)); s.r = Math.max(-0.09, Math.min(0.09, s.r));
  // about a point between the axles at hub height: nose up = +p, rolled out of the bend (to its right on a left turn) = +r
  const W = XEOM[H.bike].wheels, pz = W ? (W[0].c[2] + W[W.length - 1].c[2]) / 2 : 0, py = W ? W[0].c[1] : 0.15, b = H.body;
  b.rotation.set(-s.p, 0, s.r); _sa.set(0, py, pz); _sp.copy(_sa).applyEuler(b.rotation); b.position.subVectors(_sa, _sp); b.position.y += (s.y + Math.sin(H.t * 47) * U.buzz * (0.4 + sp)) / k;
  const I = H.inert; I.acc = s.acc; I.lat = lat; I.vy = s.vy; I.p = s.p; I.r = s.r; }
// the bike's motion: lean into the turn, a little bob on the road, a word from the driver now and then
export function animateBike(H, dt, v, yawRate){ H.t += dt; H.v = v; const sp = Math.min(1, Math.abs(v) / 8); H.gait = Math.abs(v) < 0.5 ? 'stand' : 'walk'; H.phase = (H.phase + dt * 0.8) % 1;
  const X = XEOM[H.bike], two = H.two = !!(X.wheels && X.wheels.length === 2);
  H.lean += (-yawRate * sp * (X.lean ?? XEOM.lean) - H.lean) * Math.min(1, dt * 6); H.B.rotation.z = two ? H.lean : 0; H.B.position.y = 0;   // two wheels bank into the bend; three stay flat on the road
  suspension(H, dt, v, yawRate, two);
  const now = performance.now() / 1000, p = S.player;
  if(H.wheels){ H.roll = (H.roll || 0) + v * dt; const U = XEOM.sus, wb = Math.abs(X.wheels[0].c[2] - X.wheels[X.wheels.length - 1].c[2]) * XEOM.k;
    const want = Math.max(-U.steerMax, Math.min(U.steerMax, Math.atan(wb * yawRate / Math.max(1.4, Math.abs(v))))) * Math.sign(v || 1);   // Z299 the steer a turn this tight needs at this speed (a lot slow, a touch fast)
    H.steer += (want - H.steer) * Math.min(1, dt * U.steerRate);
    for(const w of H.wheels){ w.spin.rotation.x = H.roll / w.R; if(w.steer){ if(H.axis) w.pivot.quaternion.setFromAxisAngle(H.axis, H.steer); else w.pivot.rotation.y = H.steer; } }   // Z298 the wheels roll; the front one steers
    if(H.bar) H.bar.quaternion.setFromAxisAngle(H.axis, H.steer); }
  if(H.drv) driveDriver(H, dt, v, yawRate);   // Z296 the driver rides it (lean, wheelie, weave, throttle, gears, ducking, crashing) and does the talking
  else if(p && now > H.sayAt){ H.sayAt = now + 18 + Math.random() * 20; if(H.sayAt > 0 && Math.abs(v) > 1) floatText(XEOM.lines[(Math.random() * XEOM.lines.length) | 0], '#ffe9a8', new THREE.Vector3(p.pos.x, p.pos.y + 3, p.pos.z), 13); } }

