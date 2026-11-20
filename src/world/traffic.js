// world/traffic.js — Z268 THE CITY MOVES (Z269: app-driver liveries — green, yellow, teal on an electric scooter — plain jackets, head and tail lamps): traffic on every street — mostly scooters (the Tripo scooter with the Tripo xe-ôm driver in the saddle:
// his rig posed seated, hands on the bars, then baked into a plain mesh so a hundred can be drawn at once) and the Meshy cars, keeping right,
// two lanes each way on the boulevards, one on the streets. Each keeps its distance from the one ahead, brakes for your tank when it sits in
// its lane, U-turns at the city's edge; a tank that runs one over flattens it, a blast nearby wrecks it (a burst of fire and parts) and it is
// gone for a while, then another comes. Built once the models are in (world/city.js), drawn as one instanced mesh per model.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { REALCITY, RIDE, XEOM } from '../../config.js';
import { LAND, MOBILE, REAL_CITY, S, arena, burst, contactShadow, curlHand, fireball, haptic, heightAt, ik2, loadGLTF, rollHand, sfx, spawnPart, loadRealCity, cityProp, MODE } from '../hub.js';

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

// the rider (the rigged Tripo driver) posed in the saddle and baked: hips at the origin, facing +z, sized. Z310 given a bike's grips (its own frame, as
// normalised: the middle of each rubber grip, +x his left) his hands reach them — two-bone IK, elbows out and down, knuckles along the bar, fingers
// closed round it — so each scooter model gets its own pose (before, the arms only pointed "forward and down" and the hands lay on the front shield)
let _rig = null; const _riders = {};
async function riderGeo(grip){ const key = grip ? grip.join() : '-'; if(_riders[key]) return _riders[key]; const C = REALCITY.traffic;
  if(!_rig){ const rg = await loadGLTF('rider_driver'); if(!rg) return null; const sk = firstMesh(rg.scene, true); if(!sk) return null; rg.scene.updateMatrixWorld(true);
    _rig = { rg, sk, rest:new Map(sk.skeleton.bones.map(b => [b, b.quaternion.clone()])) }; }
  const { rg, sk, rest } = _rig; for(const [b, q] of rest) b.quaternion.copy(q); rg.scene.updateMatrixWorld(true);   // (from his rest pose each time)
  // the rider: sized, then posed in the saddle — thighs forward, shins down, a little lean, hands forward on the bars
  const B = n => sk.skeleton.getBoneByName('mixamorig' + n) || sk.skeleton.getBoneByName('mixamorig:' + n);   // three drops the ':' from node names
  const toe = B('LeftToe_End') || B('LeftToeBase'), foot = B('LeftFoot'); foot.getWorldPosition(_a); toe.getWorldPosition(_b); const F = _b.sub(_a).setY(0).normalize().clone();
  B('LeftUpLeg').getWorldPosition(_a); B('RightUpLeg').getWorldPosition(_b); const Lf = _a.clone().sub(_b).setY(0).normalize(), D = new THREE.Vector3(0, -1, 0), U = new THREE.Vector3(0, 1, 0);
  const mix = (...t) => t.reduce((s, [v, w]) => s.addScaledVector(v, w), new THREE.Vector3());
  aim(B('Spine'), B('Spine1'), mix([U, 1], [F, 0.18]));
  for(const sd of [1, -1]){ const n = sd > 0 ? 'Left' : 'Right';
    aim(B(n + 'UpLeg'), B(n + 'Leg'), mix([F, 1], [D, 0.12], [Lf, sd * 0.16]));
    aim(B(n + 'Leg'), B(n + 'Foot'), mix([D, 1], [F, 0.3], [Lf, sd * 0.05]));
    aim(B(n + 'Arm'), B(n + 'ForeArm'), mix([F, 0.8], [D, 0.62], [Lf, sd * 0.22]));
    aim(B(n + 'ForeArm'), B(n + 'Hand'), mix([F, 1], [D, 0.18], [Lf, sd * 0.06])); }
  rg.scene.updateMatrixWorld(true); const hips = B('Hips').getWorldPosition(new THREE.Vector3()), yaw = -Math.atan2(F.x, F.z);
  const place = g => { g.translate(-hips.x, -hips.y, -hips.z); g.rotateY(yaw); return g; };   // (rig → the bike's frame, before sizing)
  let rgeo = place(bake(sk)); rgeo.computeBoundingBox(); const r0 = rgeo.boundingBox, kr = C.riderH * C.seatK / (r0.max.y - r0.min.y);
  if(grip){ const H = {}; for(const b of sk.skeleton.bones) H[b.name.replace(/^mixamorig:?/, '')] = b;
    const toRig = (x, y, z) => new THREE.Vector3(x, y - C.seat[0], z - C.seat[1]).multiplyScalar(1 / kr).applyAxisAngle(U, -yaw).add(hips), lx = Math.sign(Lf.clone().applyAxisAngle(U, yaw).x) || 1;
    for(const sd of [1, -1]){ const n = sd > 0 ? 'Left' : 'Right', gp = toRig(sd * lx * grip[0], grip[1], grip[2]), wrist = gp.clone().addScaledVector(U, 0.035 / kr).addScaledVector(F, -0.065 / kr);   // (the bar in his palm: the wrist just behind and above it)
      const pole = H[n + 'Arm'].getWorldPosition(new THREE.Vector3()).addScaledVector(Lf, sd * 0.5 / kr).addScaledVector(U, -0.35 / kr).addScaledVector(F, -0.15 / kr);   // (elbows out and down)
      ik2(H[n + 'Arm'], H[n + 'ForeArm'], H[n + 'Hand'], wrist, pole); rollHand(H, n, Lf.clone().multiplyScalar(sd)); curlHand(H, n, RIDE.grip, gp.addScaledVector(U, -0.03 / kr)); }
    rg.scene.updateMatrixWorld(true); rgeo = place(bake(sk)); }
  rgeo.scale(kr, kr, kr);
  if(!rgeo.attributes.uv) rgeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(rgeo.attributes.position.count * 2), 2));
  return (_riders[key] = { geo:rgeo, sk }); }

// the scooters with their riders: one model per livery (the rider's rig posed seated and baked once per bike, his hands on that bike's grips), on the bike that livery rides
async function motoModels(){ if(_moto) return _moto; const C = REALCITY.traffic, bikes = [...new Set(C.liveries.map(l => l.bike))];
  const bg = await Promise.all(bikes.map(k => loadGLTF(k)));
  const BK = {}; bikes.forEach((k, i) => { if(bg[i]) BK[k] = bikeGeo(bg[i], C.motoL); }); if(!Object.keys(BK).length) return null;
  const GEO = {}, out = [];
  for(const L of C.liveries){ const key = L.bike in BK ? L.bike : Object.keys(BK)[0], bk = BK[key];
    const R = await riderGeo(C.grips && C.grips[key]); if(!R) return null; const sk = R.sk;
    if(!GEO[key]){ const rgeo = R.geo.clone(); rgeo.translate(0, C.seat[0], C.seat[1]); GEO[key] = mergeGeometries([bk.geo, rgeo], true); GEO[key].computeBoundingSphere(); }
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

function place(v){ const R = v.r, [x, z] = pos(R, v.t, v.off, v.s); v.x = x + (v.ox || 0); v.z = z + (v.oz || 0); if(v.dead){ _M.makeScale(0, 0, 0); v.im.setMatrixAt(v.k, _M); return; }   // (Z306 a knocked-down scooter has slid off its line)
  _M.compose(_V.set(v.x, heightAt(v.x, v.z) + REALCITY.lift.road - (v.sink || 0), v.z), _Q.setFromEuler(_E.set(0, yaw(R, v.s) + v.wob, v.lean + (v.tip || 0))), _S.setScalar(v.sc)); v.im.setMatrixAt(v.k, _M); }   // (tip: on its side · sink: a burnt-out car on its rims)
export const trafficYaw = v => yaw(v.r, v.s) + (v.wob || 0);
function spawn(v){ const p = S.player, R = TR.runs; let r = null, t = 0;
  for(let n = 0; n < 12; n++){ r = R[(Math.random() * R.length) | 0]; t = r.a0 + 3 + Math.random() * (r.a1 - r.a0 - 6); const [x, z] = pos(r, t, 0, 1); if(!p || Math.hypot(x - p.pos.x, z - p.pos.z) > 40) break; }
  const C = REALCITY.traffic, moto = v.moto; v.r = r; v.t = t; v.s = Math.random() < 0.5 ? 1 : -1;
  v.off = r.blvd ? (moto ? C.laneB[1] + (Math.random() - 0.5) * 1.4 : C.laneB[0]) : (moto ? C.laneS[1] + (Math.random() - 0.5) * 0.4 : C.laneS[0]);
  v.vmax = (moto ? C.motoV : C.carV)[0] + Math.random() * ((moto ? C.motoV : C.carV)[1] - (moto ? C.motoV : C.carV)[0]); v.v = v.vmax * 0.6; v.dead = false; v.wob = 0; v.lean = 0;
  v.st = null; v.stT = 0; v.hp = C.hit.hp[moto ? 1 : 0]; v.tip = v.tipTo = 0; v.ox = v.oz = v.svx = v.svz = 0; v.sink = 0; v.fireT = 0; tint(v, _W); }   // Z306 whole again, in its own paint
const _W = new THREE.Color(1, 1, 1), _CH = new THREE.Color(0x2e2925);
function tint(v, c){ const ic = v.im.instanceColor; if(!ic) return; v.im.setColorAt(v.k, c); ic.needsUpdate = true; }

// Z290 ROLLING WHEELS: each kind's geometry is cloned with a per-vertex tag for the wheels (found from the model itself: the vertices touching
//   the road give the two axles; a wheel is the disc of the real tyre radius round each axle, on the outer side for cars) and every vehicle
//   carries its own roll angle (an instanced attribute): the vertex shader turns the wheel's vertices (and normals) about the axle by it.
// Z310 THE WHEELS FOUND AS WHEELS (the fixed-size disc tore them: half a car wheel's triangles straddled its edge, and a scooter's rear wheel never
//   turned while a bit of mudguard spun with the front): a car's wheels are separate pieces of its mesh — each tyre, with whatever sits inside it (rim,
//   hub cap), turns whole about its own centre; a scooter is one fused mesh, so each tyre is a disc of its own measured radius (the tyre's front- or
//   rear-most point at axle height, in its centre plane) within the tyre's width. Whole triangles are tagged, never one corner, so nothing tears.
function wheelGeo(geo, moto, sc){ const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.computeBoundingBox(); const b = g.boundingBox, P = g.attributes.position, n = P.count;
  const W = (!moto && pieceWheels(P, b)) || discWheels(P, b, moto, sc); if(!W) return null; const A = new Float32Array(n * 3); let cnt = 0;
  for(let t = 0; t < n / 3; t++){ const w = W.tag[t]; if(w < 0) continue; const c = W.wheels[w]; for(let k = 3 * t; k < 3 * t + 3; k++){ A[k * 3] = 1; A[k * 3 + 1] = c.cy; A[k * 3 + 2] = c.cz; cnt++; } }
  if(!cnt) return null; g.setAttribute('aWheel', new THREE.BufferAttribute(A, 3)); const r = W.wheels.reduce((a, c) => a + c.r, 0) / W.wheels.length;
  return { g, rM:r * sc, cnt, wheels:W.wheels.map(c => ({ cy:+(c.cy * sc).toFixed(3), cz:+(c.cz * sc).toFixed(3), r:+(c.r * sc).toFixed(3) })) }; }
// the separate pieces (welded by position) that touch the road and are round from the side: the wheels; pieces lying inside one turn with it
function pieceWheels(P, b){ const n = P.count, T = n / 3, H = b.max.y - b.min.y, Wd = b.max.x - b.min.x, eps = 1e-4 * (b.max.z - b.min.z), id = new Map(), vid = new Int32Array(n);
  for(let i = 0; i < n; i++){ const k = Math.round(P.getX(i) / eps) + ',' + Math.round(P.getY(i) / eps) + ',' + Math.round(P.getZ(i) / eps); let q = id.get(k); if(q === undefined){ q = id.size; id.set(k, q); } vid[i] = q; }
  const par = new Int32Array(id.size).map((_, i) => i), find = x => { while(par[x] !== x) x = par[x] = par[par[x]]; return x; };
  for(let t = 0; t < T; t++){ const a = find(vid[3 * t]); par[find(vid[3 * t + 1])] = a; par[find(vid[3 * t + 2])] = a; }
  const cm = new Map(), tc = new Int32Array(T);
  for(let t = 0; t < T; t++){ const r = find(vid[3 * t]); let C = cm.get(r); if(!C){ C = { mn:[1e9, 1e9, 1e9], mx:[-1e9, -1e9, -1e9], w:-1 }; cm.set(r, C); } tc[t] = r;
    for(let i = 3 * t; i < 3 * t + 3; i++){ const p = [P.getX(i), P.getY(i), P.getZ(i)]; for(let a = 0; a < 3; a++){ C.mn[a] = Math.min(C.mn[a], p[a]); C.mx[a] = Math.max(C.mx[a], p[a]); } } }
  const wheels = [], WC = [];
  for(const C of cm.values()){ const dx = C.mx[0] - C.mn[0], dy = C.mx[1] - C.mn[1], dz = C.mx[2] - C.mn[2];
    if(C.mn[1] < b.min.y + 0.03 * H && dy < 0.6 * H && dx < 0.25 * Wd && Math.abs(dy - dz) < 0.2 * Math.max(dy, dz)){ C.w = wheels.length; wheels.push({ cy:(C.mn[1] + C.mx[1]) / 2, cz:(C.mn[2] + C.mx[2]) / 2, r:dy / 2 }); WC.push(C); } }
  if(wheels.length < 2) return null;
  for(const C of cm.values()){ if(C.w >= 0) continue; for(const K of WC){ const m = 0.05 * (K.mx[1] - K.mn[1]); if([0, 1, 2].every(a => C.mn[a] >= K.mn[a] - m && C.mx[a] <= K.mx[a] + m)){ C.w = K.w; break; } } }   // (rim, hub cap, brake disc)
  const tag = new Int32Array(T); for(let t = 0; t < T; t++) tag[t] = cm.get(tc[t]).w; return { tag, wheels }; }
// a fused mesh: each tyre found at an end of the road contacts (a stand in the middle is no wheel; a flat low-poly patch counts as one), then fitted as
// a circle sitting on the road through the tyre's outermost surface at several heights (the mesh cut along its centre line, so sparse vertices don't
// matter); the triangles lying wholly inside that disc and within the tyre's width are tagged (a scooter: front and rear; a car: four corners)
function cut(P, x0, h){ const zs = []; for(let t = 0; t < P.count / 3; t++){ const q = [];   // (where the mesh crosses the line x = x0, y = h)
    for(let k = 0; k < 3; k++){ const a = 3 * t + k, b = 3 * t + (k + 1) % 3, xa = P.getX(a) - x0, xb = P.getX(b) - x0; if(xa * xb < 0){ const s = xa / (xa - xb); q.push([P.getY(a) + s * (P.getY(b) - P.getY(a)), P.getZ(a) + s * (P.getZ(b) - P.getZ(a))]); } }
    if(q.length === 2 && (q[0][0] - h) * (q[1][0] - h) < 0) zs.push(q[0][1] + (h - q[0][0]) / (q[1][0] - q[0][0]) * (q[1][1] - q[0][1])); } return zs; }
function discWheels(P, b, moto, sc){ const n = P.count, T = n / 3, y0 = b.min.y, xm = (b.min.x + b.max.x) / 2, zm = (b.min.z + b.max.z) / 2, r0 = (moto ? REALCITY.traffic.wheel[1] : REALCITY.traffic.wheel[0]) / sc;
  const hw = (moto ? 0.065 : 0.11) / sc, gap = 0.12 / sc, step = 0.002 / sc, wheels = [];
  for(const sd of moto ? [0] : [-1, 1]){ const C = []; for(let i = 0; i < n; i++) if(P.getY(i) < y0 + 0.012 / sc && (!sd || (P.getX(i) - xm) * sd > 0)) C.push([P.getZ(i), P.getX(i)]); C.sort((a, c) => a[0] - c[0]);
    const cl = []; for(const p of C){ const L = cl[cl.length - 1]; if(L && p[0] - L.z1 < gap){ L.z1 = p[0]; L.x += p[1]; L.n++; } else cl.push({ z0:p[0], z1:p[0], x:p[1], n:1 }); }
    if(cl.length < 2) continue;
    for(const [c, end] of [[cl[cl.length - 1], 1], [cl[0], -1]]){ const z0 = (c.z0 + c.z1) / 2, xc = moto ? xm : c.x / c.n; if((z0 - zm) * end <= 0) continue;   // (a scooter's tyres sit on its centre line: its patch can lie off it)
      const pts = []; for(const f of [0.2, 0.35, 0.5, 0.65, 0.8]){ const h = y0 + f * r0; let e = -Infinity; for(const z of cut(P, xc + 0.003 / sc, h)){ const d = (z - z0) * end; if(d > 0.3 * r0 && d < 1.7 * r0) e = Math.max(e, d); } if(isFinite(e)) pts.push([e, h - y0]); }
      const fit = P2 => { let best = null; if(P2.length >= 2) for(let r = 0.55 * r0; r <= 1.5 * r0; r += step) for(let o = -0.45 * r0; o <= 0.45 * r0; o += step){ let err = 0; for(const [d, h] of P2) err += (Math.hypot(d - o, h - r) - r) ** 2; if(!best || err < best.err) best = { err, r, o }; } return best; };   // (o: the axle's offset from the patch, outward)
      let best = fit(pts); if(best){ const keep = pts.filter(([d, h]) => Math.abs(Math.hypot(d - best.o, h - best.r) - best.r) < 0.01 / sc); if(keep.length >= 2 && keep.length < pts.length) best = fit(keep); }   // (only the tyre's lower half, below anything built over it; a stray point dropped)
      const r = best ? best.r : r0, zc = z0 + (best ? best.o : 0) * end; wheels.push({ cy:y0 + r, cz:zc, r, xc }); } }
  if(!wheels.length) return null; const tag = new Int32Array(T).fill(-1);
  for(let t = 0; t < T; t++) for(let w = 0; w < wheels.length; w++){ const c = wheels[w]; let k = 3 * t; for(; k < 3 * t + 3; k++) if(Math.abs(P.getX(k) - c.xc) > hw || Math.hypot(P.getY(k) - c.cy, P.getZ(k) - c.cz) > c.r * 1.12) break;
    if(k === 3 * t + 3){ tag[t] = w; break; } }   // (every corner inside the tyre: a fork leg or a mudguard always reaches out of it, and stays still)
  return { tag, wheels }; }
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
    const im = new THREE.InstancedMesh(W ? W.g : q.geo, W ? (Array.isArray(q.mats) ? q.mats.map(wheelMat) : wheelMat(q.mats)) : q.mats, n); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.userData.rM = W ? W.rM : 0; im.userData.wheels = W ? W.wheels : null;
    im.castShadow = !MOBILE; im.receiveShadow = true; im.frustumCulled = false; arena.add(im); LAND.meshes.push(im); TR.ims.push(im);
    const lm = new THREE.InstancedMesh(lampGeo(q.size, q.moto, q.sc), LM, n); lm.instanceMatrix = im.instanceMatrix; lm.frustumCulled = false; arena.add(lm); LAND.meshes.push(lm);   // the lamps ride on the same matrices
    contactShadow(q.size.x * (q.moto ? 1.05 : 1.12), q.size.z * 1.06, n, im.instanceMatrix, 0.012 / q.sc);   // Z271 seated on the road
    for(let k = 0; k < n; k++) im.setColorAt(k, _W); im.instanceColor.setUsage(THREE.DynamicDrawUsage);   // Z306 a colour per vehicle (white = its own paint), so a burnt one can char
    for(let k = 0; k < n; k++){ const v = { im, k, len:q.len, moto:q.moto, sc:q.sc, respawn:0, hw:q.moto ? 0.36 : q.size.x * q.sc / 2, hl:q.len / 2 }; spawn(v); place(v); TR.list.push(v); } im.instanceMatrix.needsUpdate = true; }
  TR.on = true; }

// a blast wrecks what is near it (Z306: and leaves it burning where it stood)
export function trafficBlast(x, z, r){ if(!TR.on) return; for(const v of TR.list) if(!v.dead && v.st !== 'burn' && Math.hypot(v.x - x, v.z - z) < r * 1.15 + 1) wreck(v, true); }
// Z306 STRUCK, SHOT, BURNING: every vehicle has its own health and a state — 'down' (a scooter knocked over: it slides off on its side, lies there, and is
//   gone once you are clear of it) · 'halt' (a car hit or shot at stops dead for a while, and the street queues behind it) · 'burn' (shot to pieces or caught
//   in a blast: charred, on its rims or its side, flames and a modest smoke column, then gone). Rounds strike the vehicle they cross (any player's)
const HIT = () => REALCITY.traffic.hit;
function local(v, x, z){ const f = trafficYaw(v), dx = x - v.x, dz = z - v.z, s = Math.sin(f), c = Math.cos(f); return [dx * c - dz * s, dx * s + dz * c]; }   // [across (its right), along (its front)]
export function trafficKnock(v, ix, iz){ if(!v || v.dead || v.st === 'burn') return; const C = HIT(), y = heightAt(v.x, v.z), f = trafficYaw(v);
  if(v.moto){ if(v.st === 'down') return; const lx = ix * Math.cos(f) - iz * Math.sin(f); v.st = 'down'; v.stT = C.downT; v.v = 0; v.tipTo = (lx > 0 ? -1 : 1) * 1.4; v.svx = ix * C.knockK; v.svz = iz * C.knockK;   // it goes over away from the blow, and skids
    sfx('crunch', { x:v.x, z:v.z }, 0.7); }
  else { v.st = 'halt'; v.stT = C.haltT; v.v = 0; sfx('clang', { x:v.x, z:v.z }, 0.6); }
  burst({ x:v.x, z:v.z }, 0x8a8a88, 6, 3, { y:y + 0.4, life:0.4, size:0.4 }); }
export function trafficBurn(v){ if(!v || v.dead || v.st === 'burn') return; const C = HIT(), y = heightAt(v.x, v.z);
  v.st = 'burn'; v.stT = C.burnT; v.v = 0; v.fireT = 0; v.svx = v.svz = 0; v.sink = v.moto ? 0 : C.sink; if(v.moto && !v.tipTo) v.tipTo = (Math.random() < 0.5 ? -1 : 1) * 1.4; tint(v, _CH);
  fireball({ x:v.x, z:v.z }, v.moto ? 0.35 : 0.6, y + 0.6);
  for(let n = 0; n < (v.moto ? 5 : 9); n++) spawnPart(v.x, y + 0.5, v.z, (Math.random() - 0.5) * 7, 2 + Math.random() * 4, (Math.random() - 0.5) * 7, { color:Math.random() < 0.5 ? 0x2a2a2a : 0x9a9c9e, size:0.15 + Math.random() * 0.2, life:0.9, grav:-14, drag:0.8 });
  const p = S.player; if(p && Math.hypot(p.pos.x - v.x, p.pos.z - v.z) < 40) sfx('boom', { x:v.x, z:v.z }, v.moto ? 0.45 : 0.7); }
// a round crossing a vehicle: sparks off the panel, health off it (a car stops); true = the round is spent here
export function trafficShot(b, dt){ if(!TR.on) return false; const C = HIT(), ox = b.x - b.vx * dt, oz = b.z - b.vz * dt, step = Math.hypot(b.x - ox, b.z - oz);
  for(const v of TR.list){ if(v.dead) continue; const dx = b.x - v.x, dz = b.z - v.z, R = v.hl + 1 + step; if(dx * dx + dz * dz > R * R) continue;
    const [ax, az] = local(v, ox, oz), [lx, lz] = local(v, b.x, b.z), rr = (b.r || 0.2) * 0.4; if(!crosses(ax, az, lx, lz, v.hw + rr, v.hl + rr)) continue;   // swept: a fast round jumps a car's width in a frame
    if(b.by != null && b.by > (v.moto ? 1.5 : 1.7)) continue;   // it flies over
    const y = heightAt(v.x, v.z); for(let n = 0; n < 4; n++) spawnPart(b.x, y + 0.6 + Math.random() * 0.5, b.z, (Math.random() - 0.5) * 4, 1 + Math.random() * 2.5, (Math.random() - 0.5) * 4, { color:Math.random() < 0.5 ? 0xffd27a : 0x9a9c9e, size:0.07 + Math.random() * 0.08, life:0.3, grav:-12, drag:0.6 });
    if(v.st !== 'burn'){ v.hp -= b.dmg || 10; if(!v.st && !v.moto){ v.st = 'halt'; v.stT = C.haltT; v.v = 0; } if(v.hp <= 0) trafficBurn(v); }
    return true; }
  return false; }
// does the segment (ax, az) → (bx, bz) cross the box |x| ≤ W, |z| ≤ L (slab clipping)
function crosses(ax, az, bx, bz, W, L){ let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
  for(const [p, d, h] of [[ax, dx, W], [az, dz, L]]){ if(Math.abs(d) < 1e-9){ if(Math.abs(p) > h) return false; continue; }
    let u0 = (-h - p) / d, u1 = (h - p) / d; if(u0 > u1) [u0, u1] = [u1, u0]; t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if(t0 > t1) return false; }
  return true; }
// the vehicles a body at (x, z) of radius R is pressing into: [{ v, nx, nz, d }] (out of the vehicle, how deep)
export function trafficContacts(x, z, R, out = []){ out.length = 0; if(!TR.on) return out;
  for(const v of TR.list){ if(v.dead) continue; const dx = x - v.x, dz = z - v.z, Q = v.hl + R + 0.5; if(dx * dx + dz * dz > Q * Q) continue;
    const [lx, lz] = local(v, x, z), cx = Math.max(-v.hw, Math.min(v.hw, lx)), cz = Math.max(-v.hl, Math.min(v.hl, lz)); let ex = lx - cx, ez = lz - cz, d = Math.hypot(ex, ez), pen;
    if(d > 1e-4){ if(d >= R) continue; pen = R - d; ex /= d; ez /= d; }
    else { const px = v.hw - Math.abs(lx), pz = v.hl - Math.abs(lz); if(px < pz){ ex = Math.sign(lx) || 1; ez = 0; pen = px + R; } else { ex = 0; ez = Math.sign(lz) || 1; pen = pz + R; } }   // inside it: out the nearest side
    const f = trafficYaw(v), s = Math.sin(f), c = Math.cos(f); out.push({ v, nx:ex * c + ez * s, nz:-ex * s + ez * c, d:pen }); }
  return out; }
function stateStep(v, dt, p){ const C = HIT(); v.stT -= dt; v.tip += (v.tipTo - v.tip) * Math.min(1, dt * 7);
  if(v.st === 'down'){ if(Math.hypot(v.svx, v.svz) > 0.2){ v.ox += v.svx * dt; v.oz += v.svz * dt; const k = Math.exp(-dt * 3); v.svx *= k; v.svz *= k;
      if(Math.random() < 0.5) spawnPart(v.x, heightAt(v.x, v.z) + 0.1, v.z, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, { color:0xffd27a, size:0.08 + Math.random() * 0.1, life:0.35, grav:-9, drag:1 }); }   // sparks off the tarmac
    if(v.stT <= 0 && (!p || Math.hypot(p.pos.x - v.x, p.pos.z - v.z) > C.clearR || v.stT < -C.downT * 3)) spawn(v); }   // gone once nobody is watching
  else if(v.st === 'halt'){ v.v = 0; if(v.stT <= 0) v.st = null; }
  else if(v.st === 'burn'){ burnFx(v, dt); if(v.stT <= 0){ v.dead = true; v.respawn = REALCITY.traffic.respawn; v.st = null; } } }
function burnFx(v, dt){ const C = HIT(), k = Math.max(0, v.stT / C.burnT), y = heightAt(v.x, v.z), m = v.moto ? 0.55 : 1; v.fireT -= dt; if(v.fireT > 0) return; v.fireT = (MOBILE ? 0.13 : 0.07) / Math.max(0.45, k);
  if(k > 0.15) spawnPart(v.x + (Math.random() - 0.5) * v.hw * 1.4, y + 0.5 * m + 0.3, v.z + (Math.random() - 0.5) * v.hl * 1.2, (Math.random() - 0.5) * 0.6, 1.6 + Math.random() * 1.4, (Math.random() - 0.5) * 0.6,
    { tex:'fire', color:0xffd090, color2:0xff3a08, size:(0.8 + Math.random() * 0.7) * m * (0.6 + k * 0.6), life:0.5 + Math.random() * 0.3, grav:1.5, drag:1.6, grow:0.5 });
  if(Math.random() < 0.55) spawnPart(v.x + (Math.random() - 0.5) * 0.6, y + 1.1 * m + 0.3, v.z + (Math.random() - 0.5) * 0.6, 0.5 + (Math.random() - 0.5) * 0.4, 1.6 + Math.random() * 0.8, 0.3 + (Math.random() - 0.5) * 0.4,
    { color:k > 0.4 ? 0x16130f : 0x3a3632, size:(0.8 + Math.random() * 0.5) * m, life:MOBILE ? 2.2 : 3.2, smoke:true, grav:0.25, drag:0.5, grow:1.8 * m, op:0.45, keep:true }); }   // a modest column, not a tank's
function wreck(v, fire){ if(fire){ trafficBurn(v); return; } v.dead = true; v.respawn = REALCITY.traffic.respawn; const y = heightAt(v.x, v.z);   // (flattened under a tank: gone)
  burst({ x:v.x, z:v.z }, fire ? 0xff7a2a : 0x8a8a88, v.moto ? 6 : 12, 5, { y:y + 0.6, life:0.5, size:v.moto ? 0.5 : 0.8 });
  for(let n = 0; n < (v.moto ? 5 : 9); n++) spawnPart(v.x, y + 0.5, v.z, (Math.random() - 0.5) * 7, 2 + Math.random() * 4, (Math.random() - 0.5) * 7, { color:Math.random() < 0.5 ? 0x2a2a2a : 0x9a9c9e, size:0.15 + Math.random() * 0.2, life:0.9, grav:-14, drag:0.8 });
  const p = S.player; if(p && Math.hypot(p.pos.x - v.x, p.pos.z - v.z) < 30){ sfx('crunch', { x:v.x, z:v.z }, 0.6); if(!fire) haptic(6); } }

export function updateTraffic(dt){ if(!TR.on) return; if(!TR.ims.length || !TR.ims[0].parent){ TR.on = false; return; } dt = Math.min(dt, 0.05);
  const p = S.player, lanes = new Map();
  for(const v of TR.list){ if(v.dead){ v.respawn -= dt; if(v.respawn <= 0){ spawn(v); } else continue; }
    const key = v.r.c + ':' + v.r.ax + ':' + v.s + ':' + (v.r.blvd ? (v.moto ? 'm' : 'c') : 's'); if(!lanes.has(key)) lanes.set(key, []); lanes.get(key).push(v); }   // boulevards: scooters and cars in their own lanes
  for(const L of lanes.values()){ L.sort((a, b) => (a.t - b.t) * a.s);
    for(let i = 0; i < L.length; i++){ const v = L[i], R = v.r, lead = L[i + 1]; let gap = lead && lead.r === R ? Math.abs(lead.t - v.t) - (lead.len + v.len) / 2 - (v.moto ? 1.2 : 2.5) : 99;
      const tank = p && MODE.crushes;   // Z306 only a tank flattens what it drives into — the soldier's ride has its own collisions (game/ride-impact.js)
      if(tank && Math.hypot(p.pos.x - v.x, p.pos.z - v.z) < (v.moto ? 1.9 : 2.8)){ wreck(v, false); continue; }   // run over
      if(v.st){ stateStep(v, dt, p); if(!v.dead) place(v); continue; }   // Z306 knocked down / stopped / burning: it stays where it is
      if(p){ const al = R.ax ? p.pos.z : p.pos.x, cr = R.ax ? p.pos.x : p.pos.z, [lx, lz] = pos(R, v.t, v.off, v.s), lc = R.ax ? lx : lz, ahead = (al - v.t) * v.s;
        if(Math.abs(cr - lc) < 3.2 && ahead > -2 && ahead < 16) gap = Math.min(gap, ahead - 4.5); }   // it brakes for you in its lane
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

