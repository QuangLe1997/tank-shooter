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
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); const s = X.len / XEOM.k / sz.z; g.scale(s, s, s); if(X.wheels) cutWheels(g, X.wheels); g.computeBoundingBox(); g.computeBoundingSphere();
  return (HERO[kind] = { geo:g, mats:mats.length === 1 ? mats[0] : mats }); }
// Z298 REAL WHEELS: Tripo cannot model 2 mm spokes (it paints them into a blurred disc), so the model's wheels are cut out (every triangle wholly inside a
//   wheel's drum) and real ones built in their place — a treaded rubber tyre, a metal rim, a hub and 36 crossed wire spokes (or a pressed-steel disc) —
//   that roll with the distance driven, the front one steering into the bend
function cutWheels(g, W){ const P = g.attributes.position, I = g.index; if(!I) return; const inW = i => { const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    return W.some(w => Math.abs(x - w.c[0]) < w.w * 0.5 + 0.004 && Math.hypot(y - w.c[1], z - w.c[2]) < w.r * 1.04); };
  const keep = []; const a = I.array; for(let t = 0; t < a.length; t += 3) if(!(inW(a[t]) && inW(a[t + 1]) && inW(a[t + 2]))) keep.push(a[t], a[t + 1], a[t + 2]);
  const grp = g.groups.slice(); if(grp.length <= 1){ g.setIndex(keep); g.clearGroups(); if(grp.length) g.addGroup(0, keep.length, grp[0].materialIndex); return; }
  const out = []; g.clearGroups(); for(const gr of grp){ const st = out.length; for(let t = gr.start; t < gr.start + gr.count; t += 3) if(!(inW(a[t]) && inW(a[t + 1]) && inW(a[t + 2]))) out.push(a[t], a[t + 1], a[t + 2]); g.addGroup(st, out.length - st, gr.materialIndex); } g.setIndex(out); }
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
export function buildBikeMount(kind){ const root = new THREE.Group(), B = new THREE.Group(); root.add(B);
  const H = { root, B, bike:kind, t:0, v:0, lean:0, wantGraze:false, onStep:null, sayAt:0, gait:'stand', phase:0 };
  const put = m => { if(!m) return; const mesh = new THREE.Mesh(m.geo, m.mats); mesh.castShadow = true; mesh.receiveShadow = true; B.add(mesh); H.mesh = mesh; if(!H.wheels) buildWheels(H, kind); };
  loadGLTF('ride_' + kind).then(gl => gl ? put(heroGeo(gl, kind)) : (XEOM[kind].driver ? mountModel(kind).then(put) : null));
  if(RIDE.fit[kind]) makeDriver(H, kind);   // Z296 the driver rides it as his own man
  return H; }
// the bike's motion: lean into the turn, a little bob on the road, a word from the driver now and then
export function animateBike(H, dt, v, yawRate){ H.t += dt; H.v = v; const sp = Math.min(1, Math.abs(v) / 8); H.gait = Math.abs(v) < 0.5 ? 'stand' : 'walk'; H.phase = (H.phase + dt * 0.8) % 1;
  H.lean += (-yawRate * sp * (XEOM[H.bike].lean ?? XEOM.lean) - H.lean) * Math.min(1, dt * 6); H.B.rotation.z = H.lean; H.B.position.y = Math.sin(H.t * 13) * 0.012 * sp;
  const now = performance.now() / 1000, p = S.player;
  if(H.wheels){ H.roll = (H.roll || 0) + v * dt; for(const w of H.wheels){ w.spin.rotation.x = H.roll / w.R; if(w.steer) w.pivot.rotation.y += (Math.max(-0.45, Math.min(0.45, yawRate * 0.35)) - w.pivot.rotation.y) * Math.min(1, dt * 8); } }   // Z298 the wheels roll; the front one steers
  if(H.drv) driveDriver(H, dt, v, yawRate);   // Z296 the driver rides it (lean, wheelie, weave, throttle, gears, ducking, crashing) and does the talking
  else if(p && now > H.sayAt){ H.sayAt = now + 18 + Math.random() * 20; if(H.sayAt > 0 && Math.abs(v) > 1) floatText(XEOM.lines[(Math.random() * XEOM.lines.length) | 0], '#ffe9a8', new THREE.Vector3(p.pos.x, p.pos.y + 3, p.pos.z), 13); } }

