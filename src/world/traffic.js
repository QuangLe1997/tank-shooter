// world/traffic.js — Z268 THE CITY MOVES (Z269: app-driver liveries — green, yellow, teal on an electric scooter — plain jackets, head and tail lamps): traffic on every street — mostly scooters (the Tripo scooter with the Tripo xe-ôm driver in the saddle:
// his rig posed seated, hands on the bars, then baked into a plain mesh so a hundred can be drawn at once) and the Meshy cars, keeping right,
// two lanes each way on the boulevards, one on the streets. Each keeps its distance from the one ahead, brakes for your tank when it sits in
// its lane, U-turns at the city's edge; a tank that runs one over flattens it, a blast nearby wrecks it (a burst of fire and parts) and it is
// gone for a while, then another comes. Built once the models are in (world/city.js), drawn as one instanced mesh per model.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { REALCITY, XEOM } from '../../config.js';
import { LAND, MOBILE, REAL_CITY, S, arena, burst, contactShadow, haptic, heightAt, loadGLTF, sfx, spawnPart, loadRealCity, cityProp } from '../hub.js';

const TR = { list:[], runs:[], ims:[], on:false };
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _V = new THREE.Vector3(), _S = new THREE.Vector3(), _E = new THREE.Euler(), _up = new THREE.Vector3(0, 1, 0);
let _moto = null;

// ---------- the scooter with its rider ----------
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _wq = new THREE.Quaternion();
// turn a bone (world space) so the line to its child points along dir
function aim(bone, child, dir){ if(!bone || !child) return; bone.getWorldPosition(_a); child.getWorldPosition(_b); _b.sub(_a).normalize(); _q.setFromUnitVectors(_b, dir.clone().normalize());
  bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq); bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq))); bone.updateMatrixWorld(true); }
// the skinned mesh as it stands now, as a plain geometry in world space
function bake(mesh){ mesh.updateMatrixWorld(true); mesh.skeleton.update(); const g = mesh.geometry, P = g.attributes.position, out = new Float32Array(P.count * 3), v = new THREE.Vector3();
  for(let i = 0; i < P.count; i++){ v.fromBufferAttribute(P, i); mesh.applyBoneTransform(i, v); v.applyMatrix4(mesh.matrixWorld); out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z; }
  let b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.BufferAttribute(out, 3)); if(g.attributes.uv) b.setAttribute('uv', g.attributes.uv.clone()); if(g.index) b.setIndex(g.index.clone());
  b = b.index ? b.toNonIndexed() : b; b.computeVertexNormals(); return b; }
function firstMesh(root, skinned){ let m = null; root.traverse(o => { if(!m && o.isMesh && (!skinned || o.isSkinnedMesh)) m = o; }); return m; }
function plain(o){ let g = o.geometry.clone().applyMatrix4(o.matrixWorld); g = g.index ? g.toNonIndexed() : g; for(const a of Object.keys(g.attributes)) if(a !== 'position' && a !== 'normal' && a !== 'uv') g.deleteAttribute(a); return g; }

// a model's mesh on the ground, its length along z scaled to len, its front (the highest point: mirrors, handlebar) toward +z
function bikeGeo(gl, len){ gl.scene.updateMatrixWorld(true); const sm = firstMesh(gl.scene); let g = plain(sm); g.computeBoundingBox(); let b = g.boundingBox;
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); if(b.max.x - b.min.x > b.max.z - b.min.z) g.rotateY(Math.PI / 2);   // its length along z, whichever way it came
  g.computeBoundingBox(); b = g.boundingBox; const k = len / (b.max.z - b.min.z); g.scale(k, k, k);
  const P = g.attributes.position; let top = 0, tz = 0; for(let i = 0; i < P.count; i++) if(P.getY(i) > top){ top = P.getY(i); tz = P.getZ(i); } if(tz < 0) g.rotateY(Math.PI);
  const m = sm.material.clone(); m.envMapIntensity = REALCITY.env; return { geo:g, mat:m }; }
// Z269 a livery: the rider's green jacket and helmet (read from his own texture) turned to another colour — the app drivers' green, yellow or
//   teal, or a plain navy / red jacket — the rest of the texture as it is
function livery(tex, L){ const img = tex && tex.image; if(!img || !img.width) return tex; const W = img.width, H = img.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d', { willReadFrequently:true }); x.drawImage(img, 0, 0); const D = x.getImageData(0, 0, W, H), d = D.data, c = new THREE.Color(), hsl = {};
  for(let i = 0; i < d.length; i += 4){ c.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255); c.getHSL(hsl); const h = hsl.h * 360;
    if(h < 70 || h > 175 || hsl.s < 0.12 || hsl.l < 0.1 || hsl.l > 0.93) continue;
    c.setHSL(L.h / 360, Math.min(1, Math.max(hsl.s, 0.35) * L.s / 0.6), Math.min(0.95, hsl.l * L.l)); d[i] = c.r * 255; d[i + 1] = c.g * 255; d[i + 2] = c.b * 255; }
  x.putImageData(D, 0, 0); const t = new THREE.CanvasTexture(cv); t.flipY = tex.flipY; t.colorSpace = tex.colorSpace; t.anisotropy = 4; return t; }

// the rider (the rigged Tripo driver) posed in the saddle and baked once: hips at the origin, facing +z, sized
let _rider = null;
async function riderGeo(){ if(_rider) return _rider; const C = REALCITY.traffic, rg = await loadGLTF('rider_driver'); if(!rg) return null;
  // the rider: sized, then posed in the saddle — thighs forward, shins down, a little lean, hands forward on the bars
  const sk = firstMesh(rg.scene, true); if(!sk) return null; rg.scene.updateMatrixWorld(true); const B = n => sk.skeleton.getBoneByName('mixamorig' + n) || sk.skeleton.getBoneByName('mixamorig:' + n);   // three drops the ':' from node names
  const toe = B('LeftToe_End') || B('LeftToeBase'), foot = B('LeftFoot'); foot.getWorldPosition(_a); toe.getWorldPosition(_b); const F = _b.sub(_a).setY(0).normalize().clone();
  B('LeftUpLeg').getWorldPosition(_a); B('RightUpLeg').getWorldPosition(_b); const Lf = _a.clone().sub(_b).setY(0).normalize(), D = new THREE.Vector3(0, -1, 0), U = new THREE.Vector3(0, 1, 0);
  const mix = (...t) => t.reduce((s, [v, w]) => s.addScaledVector(v, w), new THREE.Vector3());
  aim(B('Spine'), B('Spine1'), mix([U, 1], [F, 0.18]));
  for(const sd of [1, -1]){ const n = sd > 0 ? 'Left' : 'Right';
    aim(B(n + 'UpLeg'), B(n + 'Leg'), mix([F, 1], [D, 0.12], [Lf, sd * 0.16]));
    aim(B(n + 'Leg'), B(n + 'Foot'), mix([D, 1], [F, 0.3], [Lf, sd * 0.05]));
    aim(B(n + 'Arm'), B(n + 'ForeArm'), mix([F, 0.8], [D, 0.62], [Lf, sd * 0.22]));
    aim(B(n + 'ForeArm'), B(n + 'Hand'), mix([F, 1], [D, 0.18], [Lf, sd * 0.06])); }
  rg.scene.updateMatrixWorld(true); const hips = B('Hips').getWorldPosition(new THREE.Vector3()); const rgeo = bake(sk);
  rgeo.translate(-hips.x, -hips.y, -hips.z); rgeo.rotateY(-Math.atan2(F.x, F.z)); rgeo.computeBoundingBox();
  const r0 = rgeo.boundingBox, kr = C.riderH * C.seatK / (r0.max.y - r0.min.y); rgeo.scale(kr, kr, kr);
  if(!rgeo.attributes.uv) rgeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(rgeo.attributes.position.count * 2), 2));
  return (_rider = { geo:rgeo, sk }); }

// the scooters with their riders: one model per livery (the rider's rig posed seated and baked once), on the bike that livery rides
async function motoModels(){ if(_moto) return _moto; const C = REALCITY.traffic, bikes = [...new Set(C.liveries.map(l => l.bike))];
  const bg = await Promise.all(bikes.map(k => loadGLTF(k)));
  const BK = {}; bikes.forEach((k, i) => { if(bg[i]) BK[k] = bikeGeo(bg[i], C.motoL); }); if(!Object.keys(BK).length) return null;
  const R = await riderGeo(); if(!R) return null; const sk = R.sk, rgeo = R.geo.clone(); rgeo.translate(0, C.seat[0], C.seat[1]);
  const GEO = {}, out = [];
  for(const L of C.liveries){ const bk = BK[L.bike] || Object.values(BK)[0]; const key = L.bike in BK ? L.bike : Object.keys(BK)[0];
    if(!GEO[key]){ GEO[key] = mergeGeometries([bk.geo, rgeo], true); GEO[key].computeBoundingSphere(); }
    const rm = sk.material.clone(); rm.map = livery(sk.material.map, L); rm.envMapIntensity = REALCITY.env;
    out.push({ geo:GEO[key], mats:[bk.mat, rm], len:C.motoL, w:L.w, name:L.name }); }
  return (_moto = out); }

// Z269 head and tail lamps: small lamp blocks at the front and back of a model (its own units), warm white / red; they light up at dusk (LAND.mats)
let _lampM = null;
function lampMats(){ return _lampM || (_lampM = [new THREE.MeshStandardMaterial({ color:0xfff4dc, emissive:0xfff0c8, emissiveIntensity:0, roughness:0.2 }), new THREE.MeshStandardMaterial({ color:0x9a1a10, emissive:0xff2a14, emissiveIntensity:0, roughness:0.3 })]); }
function lampGeo(size, moto, sc){ const hw = size.x / 2, hl = size.z / 2, L = REALCITY.traffic.lamp, q = 1 / sc, parts = [], tail = [];
  const box = (x, y, z, w, h, d, list) => { const g = new THREE.BoxGeometry(w * q, h * q, d * q); g.translate(x, y, z); list.push(g); };
  if(moto){ box(0, size.y * 0.62, hl * 0.86, 0.16, 0.1, 0.05, parts); box(0, size.y * 0.5, -hl * 0.98, 0.12, 0.06, 0.04, tail); }
  else for(const sd of [-1, 1]){ box(sd * hw * L.carX, size.y * L.carY, hl * 0.975, 0.2, 0.07, 0.06, parts); box(sd * hw * L.carX, size.y * (L.carY + 0.06), -hl * 0.975, 0.18, 0.07, 0.06, tail); }
  return mergeGeometries([mergeGeometries(parts, false), mergeGeometries(tail, false)], true); }

// ---------- the roads ----------
// the road segments the city laid (axis, the line's cross coordinate, from / to along it) joined into runs across the crossings
function runsOf(segs){ const by = new Map(); for(const s of segs){ const k = s.ax + ':' + s.c; if(!by.has(k)) by.set(k, []); by.get(k).push(s); }
  const runs = []; for(const L of by.values()){ L.sort((p, q) => p.a0 - q.a0); let cur = null;
    for(const s of L){ if(cur && s.a0 - cur.a1 < 22) cur.a1 = s.a1; else { cur = { ax:s.ax, c:s.c, a0:s.a0, a1:s.a1, blvd:s.blvd }; runs.push(cur); } } }
  return runs.filter(r => r.a1 - r.a0 > 30); }
const pos = (r, t, off, s) => r.ax ? [r.c - s * off, t] : [t, r.c + s * off];   // keep right: heading +x the right is +z, heading +z it is −x
const yaw = (r, s) => r.ax ? (s > 0 ? 0 : Math.PI) : (s > 0 ? Math.PI / 2 : -Math.PI / 2);

function place(v){ const R = v.r, [x, z] = pos(R, v.t, v.off, v.s); v.x = x; v.z = z; if(v.dead){ _M.makeScale(0, 0, 0); v.im.setMatrixAt(v.k, _M); return; }
  _M.compose(_V.set(x, heightAt(x, z) + REALCITY.lift.road, z), _Q.setFromEuler(_E.set(0, yaw(R, v.s) + v.wob, v.lean)), _S.setScalar(v.sc)); v.im.setMatrixAt(v.k, _M); }
function spawn(v){ const p = S.player, R = TR.runs; let r = null, t = 0;
  for(let n = 0; n < 12; n++){ r = R[(Math.random() * R.length) | 0]; t = r.a0 + 3 + Math.random() * (r.a1 - r.a0 - 6); const [x, z] = pos(r, t, 0, 1); if(!p || Math.hypot(x - p.pos.x, z - p.pos.z) > 40) break; }
  const C = REALCITY.traffic, moto = v.moto; v.r = r; v.t = t; v.s = Math.random() < 0.5 ? 1 : -1;
  v.off = r.blvd ? (moto ? C.laneB[1] + (Math.random() - 0.5) * 1.4 : C.laneB[0]) : (moto ? C.laneS[1] + (Math.random() - 0.5) * 0.4 : C.laneS[0]);
  v.vmax = (moto ? C.motoV : C.carV)[0] + Math.random() * ((moto ? C.motoV : C.carV)[1] - (moto ? C.motoV : C.carV)[0]); v.v = v.vmax * 0.6; v.dead = false; v.wob = 0; v.lean = 0; }

// Z290 ROLLING WHEELS: each kind's geometry is cloned with a per-vertex tag for the wheels (found from the model itself: the vertices touching
//   the road give the two axles; a wheel is the disc of the real tyre radius round each axle, on the outer side for cars) and every vehicle
//   carries its own roll angle (an instanced attribute): the vertex shader turns the wheel's vertices (and normals) about the axle by it.
function wheelGeo(geo, moto, sc){ const g = geo.clone(); g.computeBoundingBox(); const b = g.boundingBox, P = g.attributes.position, n = P.count, H = b.max.y - b.min.y, W = b.max.x - b.min.x, y0 = b.min.y, zm = (b.min.z + b.max.z) / 2, xm = (b.min.x + b.max.x) / 2;
  const zs = [[], []]; for(let i = 0; i < n; i++) if(P.getY(i) < y0 + 0.025 * H) zs[P.getZ(i) > zm ? 0 : 1].push(P.getZ(i)); if(zs[0].length < 3 || zs[1].length < 3) return null;
  const zc = zs.map(L => L.reduce((a, q) => a + q, 0) / L.length), r = (moto ? REALCITY.traffic.wheel[1] : REALCITY.traffic.wheel[0]) / sc, A = new Float32Array(n * 3); let cnt = 0;
  for(let i = 0; i < n; i++){ const x = P.getX(i), y = P.getY(i), z = P.getZ(i); for(const c of (moto ? zc.slice(0, 1) : zc)){ const dy = y - (y0 + r), dz = z - c; if(dy * dy + dz * dz < r * r * 1.02 && (moto ? Math.abs(x - xm) < 0.07 / sc : Math.abs(x - xm) > W * 0.3)){   // a scooter: the front tyre only (its body hides the rear one)
      A[i * 3] = 1; A[i * 3 + 1] = y0 + r; A[i * 3 + 2] = c; cnt++; break; } } }
  if(!cnt) return null; g.setAttribute('aWheel', new THREE.BufferAttribute(A, 3)); return { g, rM:r * sc, cnt }; }
function wheelMat(m){ const w = m.clone(); w.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aWheel; attribute float aRoll;')
    .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  float wc = cos(aRoll * aWheel.x), ws = sin(aRoll * aWheel.x); objectNormal.yz = vec2(objectNormal.y * wc - objectNormal.z * ws, objectNormal.y * ws + objectNormal.z * wc);')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n  if(aWheel.x > 0.5){ vec2 wq = transformed.yz - aWheel.yz; transformed.yz = aWheel.yz + vec2(wq.x * wc - wq.y * ws, wq.x * ws + wq.y * wc); }'); };
  w.customProgramCacheKey = () => 'trafficWheel' + (m.customProgramCacheKey ? m.customProgramCacheKey() : ''); return w; }
export async function buildTraffic(segs){ TR.on = false; TR.list.length = 0; TR.ims.length = 0; TR.runs = runsOf(segs); const C = REALCITY.traffic;
  if(!TR.runs.length || typeof window === 'undefined' || /notraffic/.test(location.search + location.hash)) return;
  const motos = await motoModels(), cars = Object.keys(REALCITY.cars).filter(k => REAL_CITY[k] && k !== 'car_bus'), N = MOBILE ? C.nMobile : C.n;
  const kinds = []; for(const m of motos || []) kinds.push({ geo:m.geo, mats:m.mats, len:m.len, moto:true, sc:1, size:new THREE.Vector3(0.7, 1.15, m.len), w:C.motoShare * m.w });
  for(const k of cars){ const M = REAL_CITY[k], sc = (REALCITY.cars[k].L || 4.6) / M.size.z; kinds.push({ geo:M.geo, mats:M.mat, len:REALCITY.cars[k].L || 4.6, moto:false, sc, size:M.size, w:(1 - C.motoShare) / cars.length }); }
  if(!kinds.length) return; const tot = kinds.reduce((a, q) => a + q.w, 0), LM = lampMats(); for(const m of LM) if(!LAND.mats.includes(m)) LAND.mats.push(m);
  for(const q of kinds){ const n = Math.max(1, Math.round(N * q.w / tot)), W = REALCITY.traffic.wheel && wheelGeo(q.geo, q.moto, q.sc);   // Z290 the wheels turn
    if(W){ W.g.setAttribute('aRoll', new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage)); }
    const im = new THREE.InstancedMesh(W ? W.g : q.geo, W ? (Array.isArray(q.mats) ? q.mats.map(wheelMat) : wheelMat(q.mats)) : q.mats, n); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.userData.rM = W ? W.rM : 0;
    im.castShadow = !MOBILE; im.receiveShadow = true; im.frustumCulled = false; arena.add(im); LAND.meshes.push(im); TR.ims.push(im);
    const lm = new THREE.InstancedMesh(lampGeo(q.size, q.moto, q.sc), LM, n); lm.instanceMatrix = im.instanceMatrix; lm.frustumCulled = false; arena.add(lm); LAND.meshes.push(lm);   // the lamps ride on the same matrices
    contactShadow(q.size.x * (q.moto ? 1.05 : 1.12), q.size.z * 1.06, n, im.instanceMatrix, 0.012 / q.sc);   // Z271 seated on the road
    for(let k = 0; k < n; k++){ const v = { im, k, len:q.len, moto:q.moto, sc:q.sc, respawn:0 }; spawn(v); place(v); TR.list.push(v); } im.instanceMatrix.needsUpdate = true; }
  TR.on = true; }

// a blast wrecks what is near it
export function trafficBlast(x, z, r){ if(!TR.on) return; for(const v of TR.list) if(!v.dead && Math.hypot(v.x - x, v.z - z) < r * 1.15 + 1) wreck(v, true); }
function wreck(v, fire){ v.dead = true; v.respawn = REALCITY.traffic.respawn; const y = heightAt(v.x, v.z);
  burst({ x:v.x, z:v.z }, fire ? 0xff7a2a : 0x8a8a88, v.moto ? 6 : 12, 5, { y:y + 0.6, life:0.5, size:v.moto ? 0.5 : 0.8 });
  for(let n = 0; n < (v.moto ? 5 : 9); n++) spawnPart(v.x, y + 0.5, v.z, (Math.random() - 0.5) * 7, 2 + Math.random() * 4, (Math.random() - 0.5) * 7, { color:Math.random() < 0.5 ? 0x2a2a2a : 0x9a9c9e, size:0.15 + Math.random() * 0.2, life:0.9, grav:-14, drag:0.8 });
  const p = S.player; if(p && Math.hypot(p.pos.x - v.x, p.pos.z - v.z) < 30){ sfx('crunch', { x:v.x, z:v.z }, 0.6); if(!fire) haptic(6); } }

export function updateTraffic(dt){ if(!TR.on) return; if(!TR.ims.length || !TR.ims[0].parent){ TR.on = false; return; } dt = Math.min(dt, 0.05);
  const p = S.player, lanes = new Map();
  for(const v of TR.list){ if(v.dead){ v.respawn -= dt; if(v.respawn <= 0){ spawn(v); } else continue; }
    const key = v.r.c + ':' + v.r.ax + ':' + v.s + ':' + (v.r.blvd ? (v.moto ? 'm' : 'c') : 's'); if(!lanes.has(key)) lanes.set(key, []); lanes.get(key).push(v); }   // boulevards: scooters and cars in their own lanes
  for(const L of lanes.values()){ L.sort((a, b) => (a.t - b.t) * a.s);
    for(let i = 0; i < L.length; i++){ const v = L[i], R = v.r, lead = L[i + 1]; let gap = lead && lead.r === R ? Math.abs(lead.t - v.t) - (lead.len + v.len) / 2 - (v.moto ? 1.2 : 2.5) : 99;
      if(p){ const al = R.ax ? p.pos.z : p.pos.x, cr = R.ax ? p.pos.x : p.pos.z, [lx, lz] = pos(R, v.t, v.off, v.s), lc = R.ax ? lx : lz, ahead = (al - v.t) * v.s;
        if(Math.abs(cr - lc) < 3.2 && ahead > -2 && ahead < 16) gap = Math.min(gap, ahead - 4.5);
        if(Math.hypot(p.pos.x - v.x, p.pos.z - v.z) < (v.moto ? 1.9 : 2.8)){ wreck(v, false); continue; } }   // run over
      const vt = Math.max(0, Math.min(v.vmax, gap * 1.1)); v.v += Math.max(-14 * dt, Math.min(3.5 * dt, vt - v.v)); v.t += v.v * v.s * dt;
      const RA = v.im.geometry.attributes.aRoll; if(RA){ v.roll = ((v.roll || 0) + v.v * dt / v.im.userData.rM) % 6.2832; RA.setX(v.k, v.roll); }   // Z290 roll as far as it went
      if(v.moto){ v.wob = Math.sin(performance.now() * 0.0013 + v.k) * 0.03; v.lean = Math.sin(performance.now() * 0.0009 + v.k * 1.7) * 0.025; }
      if(v.s > 0 && v.t > R.a1 - 2){ v.s = -1; v.t = R.a1 - 2; } else if(v.s < 0 && v.t < R.a0 + 2){ v.s = 1; v.t = R.a0 + 2; }   // U-turn at the end of the road
      place(v); } }
  for(const v of TR.list) if(v.dead) place(v);
  for(const im of TR.ims){ im.instanceMatrix.needsUpdate = true; if(im.geometry.attributes.aRoll) im.geometry.attributes.aRoll.needsUpdate = true; } }
export const TRAFFIC = TR;
// Z282 a mount for the xe-ôm / xích-lô mode: the bike (green-jacket driver on the scooter, or the cyclo with its driver on the rear saddle) as one
//   geometry with its materials, in metres, front toward +z — the player's soldier sits on it where XEOM says
export async function mountModel(kind){ const X = XEOM[kind]; if(!X) return null; const R = await riderGeo(); if(!R) return null;
  let bike = null; if(kind === 'xeom'){ const gl = await loadGLTF('moto_scooter'); if(gl) bike = bikeGeo(gl, REALCITY.traffic.motoL); }
  else { await loadRealCity(); const P = cityProp('prop_cyclo'); if(P){ const g = P.geo.clone(); if(X.yaw) g.rotateY(X.yaw); bike = { geo:g, mat:Array.isArray(P.mats) ? P.mats[0] : P.mats }; } }
  if(!bike) return null; const rgeo = R.geo.clone(); rgeo.translate(0, X.driver[0], X.driver[1]);
  const rm = R.sk.material.clone(); if(X.livery != null) rm.map = livery(R.sk.material.map, REALCITY.traffic.liveries[X.livery]);
  const geo = mergeGeometries([bike.geo, rgeo], true); geo.computeBoundingSphere(); return { geo, mats:[bike.mat, rm] }; }

