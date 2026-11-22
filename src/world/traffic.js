// world/traffic.js — Z268 THE CITY MOVES (Z269: app-driver liveries — green, yellow, teal on an electric scooter — plain jackets, head and tail lamps): traffic on every street — mostly scooters (the Tripo scooter with the Tripo xe-ôm driver in the saddle:
// his rig posed seated, hands on the bars, then baked into a plain mesh so a hundred can be drawn at once) and the Meshy cars, keeping right,
// two lanes each way on the boulevards, one on the streets. Each keeps its distance from the one ahead, brakes for your tank when it sits in
// its lane, U-turns at the city's edge; a tank that runs one over flattens it, a blast nearby wrecks it (a burst of fire and parts) and it is
// gone for a while, then another comes. Built once the models are in (world/city.js), drawn as one instanced mesh per model.
// Z320 THE STREET'S OWN RULES: each keeps to its lane (cars by the boulevards' median, scooters out by the kerb lane, a street's scooters right of its
//   centre line), keeps its distance from whatever is ahead in the band it holds (IDM), steers round what stands in its lane (a parked or abandoned car,
//   a wreck, you) when the other side is clear and waits behind it when not, takes its turn at every crossing (one road at a time, the other waits at its
//   stop line), U-turns in a half circle inside the crossing at the end of its road, and comes to life only where there is room and you cannot see it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { REALCITY, RIDE, XEOM } from '../../config.js';
import { LAND, MOBILE, REAL_CITY, S, arena, burst, contactShadow, crushables, curlHand, fireball, haptic, heightAt, ik2, loadGLTF, rollHand, sfx, spawnPart, MODE } from '../hub.js';

const TR = { list:[], runs:[], ims:[], on:false, juncs:[], pool:[], frame:0, stats:{ mm:0, sw:0, ut:0, jw:0, shot:0 } };
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
// the road segments the city laid (axis, the line's cross coordinate, from / to along it, its width and median) joined into runs across the crossings
function runsOf(segs){ const by = new Map(); for(const s of segs){ const k = s.ax + ':' + s.c; if(!by.has(k)) by.set(k, []); by.get(k).push(s); }
  const runs = []; for(const L of by.values()){ L.sort((p, q) => p.a0 - q.a0); let cur = null;
    for(const s of L){ if(cur && s.a0 - cur.a1 < 22) cur.a1 = s.a1; else { cur = { ax:s.ax, c:s.c, a0:s.a0, a1:s.a1, blvd:s.blvd, w:s.w || (s.blvd ? 17 : 8), med:s.blvd ? (s.med ?? 2.6) : 0 }; runs.push(cur); } } }
  return runs.filter(r => r.a1 - r.a0 > 30); }
const pos = (r, t, off, s) => r.ax ? [r.c - s * off, t] : [t, r.c + s * off];   // keep right: heading +x the right is +z, heading +z it is −x
const yaw = (r, s) => r.ax ? (s > 0 ? 0 : Math.PI) : (s > 0 ? Math.PI / 2 : -Math.PI / 2);
const sig = (r, s) => r.ax ? -s : s;   // a lane offset (to the driver's right) → the road's cross coordinate: w = sig · off
// Z320 how far a box turned to yaw f reaches along a run and across it: [along, across] half-extents
function ext(R, f, hw, hl){ const s = Math.abs(Math.sin(f)), c = Math.abs(Math.cos(f)); return R.ax ? [hl * c + hw * s, hl * s + hw * c] : [hl * s + hw * c, hl * c + hw * s]; }
// Z320 THE CROSSINGS: where two runs cross (and at each run's ends, where it U-turns) one junction box shared by both roads, on the asphalt the city laid
//   (roads.xing); along a run each is { a: its centre, h: its half-length along the run, J: the shared box, end: the run's end }
function netOf(segs){ const runs = runsOf(segs), G = (segs.find(s => s.g) || {}).g || 46, xing = segs.xing, Wd = new Map(), JM = new Map(), line = new Map();
  for(const r of runs){ Wd.set(Math.round(r.c / G), r.w); const q = r.ax + ':' + Math.round(r.c / G); if(!line.has(q)) line.set(q, []); line.get(q).push(r); }
  for(const r of runs){ const i = Math.round(r.c / G); r.junc = []; r.box = []; r.park = [];
    for(let k = Math.floor((r.a0 - 12) / G); k <= Math.ceil((r.a1 + 12) / G); k++){ const a = k * G, h = (Wd.get(k) || 8) / 2; if(a + h < r.a0 - 1 || a - h > r.a1 + 1) continue;
      const key = (r.ax ? i : k) + ',' + (r.ax ? k : i), cross = (line.get((1 - r.ax) + ':' + k) || []).some(q => i * G > q.a0 - r.w / 2 - 1 && i * G < q.a1 + r.w / 2 + 1);
      if(!cross && xing && !xing.has(key)) continue;   // (another road crosses here: a junction, laid or not · a run's end: only on asphalt)
      let J = JM.get(key); if(!J){ J = { key, ax:null, hold:new Set(), want:-1, wantT:0, seen:0 }; JM.set(key, J); }
      r.junc.push({ a, h, J, end:a - h > r.a1 - 1 || a + h < r.a0 + 1 }); }
    r.endJ = r.blvd && r.junc.length ? [r.junc[0], r.junc[r.junc.length - 1]] : [null, null]; r.utv = [null, null];   // where it U-turns [low end, high end]: a boulevard inside its last crossing (round its median's end — a dead end past it is left alone), a street in itself
    r.lo = r.endJ[0] ? r.endJ[0].a + r.endJ[0].h : r.a0; r.hi = r.endJ[1] ? r.endJ[1].a - r.endJ[1].h : r.a1; }   // (the stretch it drives)
  return { runs, juncs:[...JM.values()] }; }
// the parked and abandoned cars standing in a run's roadway: boxes the traffic steers round
function parkedOn(runs){ for(const c of crushables){ if(c.kind !== 'car' || !c.alive || !c.im) continue; const g = c.im.geometry; if(!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox, hw = (bb.max.x - bb.min.x) / 2, hl = (bb.max.z - bb.min.z) / 2;
    for(const R of runs){ const a = R.ax ? c.z : c.x, w = (R.ax ? c.x : c.z) - R.c, [ea, ew] = ext(R, c.ry, hw, hl); if(a < R.a0 - 9 || a > R.a1 + 9 || Math.abs(w) > R.w / 2 + ew) continue;
      R.park.push({ c, a, w, ea, ew, x:c.x, z:c.z, yw:c.ry, hw, hl }); } } }

// a vehicle's pose in the world: on its lane (along t, offset off, turned wob), plus where a blow left it (ox, oz), or round its U-turn
function pose(v){ const R = v.r;
  if(v.ut){ const U = v.ut, da = v.s * Math.cos(U.th), dw = -U.sg * Math.sin(U.th), a = U.as + v.s * U.rho * Math.sin(U.th) + da * U.lr, w = U.wc + U.sg * U.rho * Math.cos(U.th) + dw * U.lr;   // (the rear axle on the circle, the body ahead of it)
    v.x = R.ax ? R.c + w : a; v.z = R.ax ? a : R.c + w; v.yw = (R.ax ? Math.atan2(dw, da) : Math.atan2(da, dw)) + v.wob; return; }
  const [x, z] = pos(R, v.t, v.off, v.s); v.x = x + v.ox; v.z = z + v.oz; v.yw = yaw(R, v.s) + v.wob; }
function place(v){ if(v.dead){ _M.makeScale(0, 0, 0); v.im.setMatrixAt(v.k, _M); return; }
  _M.compose(_V.set(v.x, heightAt(v.x, v.z) + REALCITY.lift.road - (v.sink || 0) + (v.hop || 0) + (v.moto ? 0 : v.hw * Math.abs(Math.sin(v.tip || 0))), v.z), _Q.setFromEuler(_E.set(0, v.yw, v.lean + (v.tip || 0))), _S.setScalar(v.sc)); v.im.setMatrixAt(v.k, _M); }   // (tip: on its side · sink: a burnt-out car on its rims, a wreck going)
export const trafficYaw = v => v.yw;
// the lane a vehicle keeps on a run: a car next to the median (a boulevard), a scooter out by the kerb lane, on a street both keep right of the centre line
function laneOf(v, R){ const L = REALCITY.traffic.lane, rnd = (a, b) => a + Math.random() * (b - a);
  return R.blvd ? (v.moto ? rnd(...L.blvdMoto) : R.med / 2 + L.blvdCar + v.hw) : (v.moto ? rnd(...L.street) : v.hw + L.gap[0]); }
// Z320 spawned clear: on a run its kind uses (cars keep to the boulevards), outside the crossings, out of your sight, with room round it — nobody comes to life on top of anyone
function spawn(v, init){ release(v); if(v.ut) endU(v); const C = REALCITY.traffic, p = S.player, runs = v.moto || C.carStreets ? TR.runs : TR.runs.filter(r => r.blvd);
  for(let n = 0; runs.length && n < 40; n++){ const R = runs[(Math.random() * runs.length) | 0], s = Math.random() < 0.5 ? 1 : -1, t = R.lo + 5 + Math.random() * (R.hi - R.lo - 10); if(R.hi - R.lo < 14) continue;
    if(R.junc.some(j => Math.abs(t - j.a) < j.h + v.hl + 2)) continue; const off = laneOf(v, R), [x, z] = pos(R, t, off, s);
    if(!init && p && Math.hypot(x - p.pos.x, z - p.pos.z) < C.spawnR) continue;
    if(!freeAt(v, R, s, t, off, x, z)) continue;
    const V = v.moto ? C.motoV : C.carV; v.r = R; v.t = t; v.s = s; v.lane = v.off = off; v.vmax = V[0] + Math.random() * (V[1] - V[0]); v.v = init ? v.vmax * 0.5 : 0; v.dead = false; v.wob = v.lean = v.spin = 0;
    v.st = null; v.stT = 0; v.hp = C.hit.hp[v.moto ? 1 : 0]; v.tip = v.tipTo = 0; v.ox = v.oz = v.svx = v.svz = 0; v.sink = 0; v.fireT = 0; v.fade = null; v.ut = null; v.wait = 0; v.smk = 0; v.hop = v.vy = 0; tint(v, _W); pose(v); return true; }   // Z306 whole again, in its own paint
  v.dead = true; v.respawn = 1; return false; }
function freeAt(v, R, s, t, off, x, z){ const yw = yaw(R, s), A = { x, z, yw, hw:v.hw + 0.4, hl:v.hl + 2.5 };
  for(const u of TR.list){ if(u === v || u.dead || u.r == null) continue; if(Math.abs(u.x - x) > 14 || Math.abs(u.z - z) > 14) continue; if(mtv(A, u)) return false; }
  for(const b of R.park){ if(Math.abs(b.a - t) < b.ea + v.hl + 2 && Math.abs(sig(R, s) * b.w - off) < b.ew + v.hw + 0.3) return false; }
  return true; }
const _W = new THREE.Color(1, 1, 1), _CH = new THREE.Color(0x2e2925);
function tint(v, c){ const ic = v.im.instanceColor; if(!ic) return; v.im.setColorAt(v.k, c); ic.needsUpdate = true; }
// does box B overlap box A ({ x, z, yw, hw, hl }; a vehicle is one): the least push of B out of A as [nx, nz, depth] (n from A to B), or null
function mtv(A, B){ let best = 1e9, bx = 0, bz = 0; const dx = B.x - A.x, dz = B.z - A.z;
  for(const f of [A.yw, B.yw]){ const sf = Math.sin(f), cf = Math.cos(f);
    for(let k = 0; k < 2; k++){ const ux = k ? cf : sf, uz = k ? -sf : cf, d = dx * ux + dz * uz, o = reach(A, ux, uz) + reach(B, ux, uz) - Math.abs(d); if(o <= 0) return null;
      if(o < best){ best = o; bx = d < 0 ? -ux : ux; bz = d < 0 ? -uz : uz; } } }
  return [bx, bz, best]; }
function reach(A, ux, uz){ const s = Math.sin(A.yw), c = Math.cos(A.yw); return A.hl * Math.abs(s * ux + c * uz) + A.hw * Math.abs(c * ux - s * uz); }

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
export async function buildTraffic(segs){ TR.on = false; TR.list.length = 0; TR.ims.length = 0; const N0 = netOf(segs); TR.runs = N0.runs; TR.juncs = N0.juncs; const C = REALCITY.traffic;
  if(!TR.runs.length || typeof window === 'undefined' || /notraffic/.test(location.search + location.hash)) return;
  const motos = await motoModels(), cars = Object.keys(REALCITY.cars).filter(k => REAL_CITY[k] && k !== 'car_bus'), N = MOBILE ? C.nMobile : C.n;
  const kinds = []; for(const m of motos || []) kinds.push({ geo:m.geo, mats:m.mats, len:m.len, moto:true, sc:1, size:new THREE.Vector3(0.7, 1.15, m.len), w:C.motoShare * m.w });
  for(const k of cars){ const M = REAL_CITY[k], sc = (REALCITY.cars[k].L || 4.6) / M.size.z; kinds.push({ geo:M.geo, mats:M.mat, len:REALCITY.cars[k].L || 4.6, moto:false, sc, size:M.size, w:(1 - C.motoShare) / cars.length }); }
  if(!kinds.length) return; parkedOn(TR.runs); const tot = kinds.reduce((a, q) => a + q.w, 0), LM = lampMats(); for(const m of LM) if(!LAND.mats.includes(m)) LAND.mats.push(m);
  for(const q of kinds){ const n = Math.max(1, Math.round(N * q.w / tot)), W = REALCITY.traffic.wheel && wheelGeo(q.geo, q.moto, q.sc);   // Z290 the wheels turn
    if(W){ W.g.setAttribute('aRoll', new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage)); }
    const im = new THREE.InstancedMesh(W ? W.g : q.geo, W ? (Array.isArray(q.mats) ? q.mats.map(wheelMat) : wheelMat(q.mats)) : q.mats, n); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.userData.rM = W ? W.rM : 0; im.userData.wheels = W ? W.wheels : null;
    im.castShadow = !MOBILE; im.receiveShadow = true; im.frustumCulled = false; arena.add(im); LAND.meshes.push(im); TR.ims.push(im);
    const lm = new THREE.InstancedMesh(lampGeo(q.size, q.moto, q.sc), LM, n); lm.instanceMatrix = im.instanceMatrix; lm.frustumCulled = false; arena.add(lm); LAND.meshes.push(lm);   // the lamps ride on the same matrices
    contactShadow(q.size.x * (q.moto ? 1.05 : 1.12), q.size.z * 1.06, n, im.instanceMatrix, 0.012 / q.sc);   // Z271 seated on the road
    for(let k = 0; k < n; k++) im.setColorAt(k, _W); im.instanceColor.setUsage(THREE.DynamicDrawUsage);   // Z306 a colour per vehicle (white = its own paint), so a burnt one can char
    for(let k = 0; k < n; k++){ const v = { im, k, len:q.len, moto:q.moto, sc:q.sc, respawn:0, hw:q.moto ? 0.36 : q.size.x * q.sc / 2, hl:q.len / 2, J:null, Jr:null }; spawn(v, true); place(v); TR.list.push(v); } im.instanceMatrix.needsUpdate = true; }
  TR.on = true; }

// a blast wrecks what is near it (Z306: and leaves it burning where it stood · Z320 thrown from the blast, turning)
export function trafficBlast(x, z, r){ if(!TR.on) return; for(const v of TR.list){ if(v.dead || v.fade != null) continue; const dx = v.x - x, dz = v.z - z, d = Math.hypot(dx, dz); if(d > r * 1.15 + 1) continue;
    const k = HIT().blastV * (1 - 0.6 * Math.min(1, d / (r * 1.15 + 1))) / (v.moto ? 0.6 : 1); if(d > 0.1) hit(v, dx / d * k, dz / d * k, x, z, true); wreck(v, true); } }
// Z306 STRUCK, SHOT, BURNING: every vehicle has its own health and a state — 'down' (a scooter knocked over: it skids off on its side, lies there, and is
//   gone once you are clear of it) · 'halt' (a car struck or shot at stops; Z320 a blow sends it sliding and spinning out of its lane, and once it has
//   come to rest, if it still points down its road, it pulls back into its lane and drives on) · 'burn' (shot to pieces or caught in a blast: charred, on
//   its rims or its side, flames and a modest smoke column, then it sinks away and is gone). Rounds strike the vehicle they cross (any player's)
const HIT = () => REALCITY.traffic.hit;
function local(v, x, z){ const f = v.yw, dx = x - v.x, dz = z - v.z, s = Math.sin(f), c = Math.cos(f); return [dx * c - dz * s, dx * s + dz * c]; }   // [across, along (its front)]
// its velocity in the world: down its lane (or round its U-turn), or the slide a blow gave it
export function trafficVel(v){ if(!v || v.dead) return [0, 0]; if(v.st) return [v.svx, v.svz]; return [Math.sin(v.yw) * v.v, Math.cos(v.yw) * v.v]; }
// it leaves its lane where it stands: what it was doing becomes a slide from here (its pose kept as an offset from the lane point)
function loose(v){ if(v.st) return; const R = v.r, vx = Math.sin(v.yw) * v.v, vz = Math.cos(v.yw) * v.v; release(v);
  if(v.ut){ v.t = v.ut.as; endU(v); }   // (any lane point will do: the offset below holds where it really is)
  const [lx, lz] = pos(R, v.t, v.off, v.s); v.ox = v.x - lx; v.oz = v.z - lz; v.wob = v.yw - yaw(R, v.s); v.svx = vx; v.svz = vz; v.spin = 0; v.v = 0; }
// Z320 A BLOW: dv (m/s, already per its own mass) at the point (px, pz) — it slides, and turns by the lever the blow had on it; a scooter struck hard goes over
export function trafficShove(v, dvx, dvz, px, pz, hard){ if(!v || v.dead || v.fade != null) return; hit(v, dvx, dvz, px, pz, hard); }
function hit(v, dvx, dvz, px, pz, hard){ const C = HIT(), sp = Math.hypot(dvx, dvz), was = v.st; loose(v);
  const rx = px - v.x, rz = pz - v.z, L2 = 4 * (v.hl * v.hl + v.hw * v.hw);
  v.svx += dvx; v.svz += dvz; v.spin = Math.max(-C.spinMax, Math.min(C.spinMax, (v.spin || 0) + (rz * dvx - rx * dvz) * 12 / L2 * C.spinK * (v.moto ? 0.5 : 1)));
  if(v.moto){ if(was !== 'down' && was !== 'burn' && (hard || sp > C.tipV)){ const [lx] = local(v, v.x + dvx, v.z + dvz); v.st = 'down'; v.stT = C.downT; v.tipTo = (lx > 0 ? -1 : 1) * 1.4; sfx('crunch', { x:v.x, z:v.z }, 0.7); }
    else if(!was) { v.st = 'halt'; v.stT = C.haltT * 0.4; } }
  else if(!was || was === 'halt'){ v.st = 'halt'; v.stT = Math.max(v.stT || 0, C.haltT); if(hard) sfx('clang', { x:v.x, z:v.z }, 0.6); }
  if(!v.moto && !v.tipTo && sp > C.flipV){ const [lx] = local(v, v.x + dvx, v.z + dvz); v.tipTo = (lx > 0 ? -1 : 1) * 1.5; sfx('crunch', { x:v.x, z:v.z }, 0.9); }   // Z320 a heavy blow rolls a car onto its side
  if(hard){ const y = heightAt(v.x, v.z); burst({ x:px, z:pz }, 0x8a8a88, 6, 3, { y:y + 0.5, life:0.4, size:0.4 });
    for(let n = 0; n < 6; n++) spawnPart(px, y + 0.5 + Math.random() * 0.4, pz, dvx * 0.3 + (Math.random() - 0.5) * 4, 1 + Math.random() * 2, dvz * 0.3 + (Math.random() - 0.5) * 4, { color:n % 2 ? 0xd8e4ea : 0xffd27a, size:0.06 + Math.random() * 0.08, life:0.45, grav:-12, drag:0.6 }); } }   // glass and sparks
// pushed (out of something it overlaps): a car on its lane is solid unless it was struck — this is only for one already loose
export function trafficPush(v, dx, dz){ if(!v || v.dead || !v.st) return; v.ox += dx; v.oz += dz; v.x += dx; v.z += dz; }
export function trafficBurn(v){ if(!v || v.dead || v.st === 'burn' || v.fade != null) return; const C = HIT(), y = heightAt(v.x, v.z); loose(v);
  v.st = 'burn'; v.stT = C.burnT; v.fireT = 0; v.sink = v.moto ? 0 : C.sink; if(v.moto && !v.tipTo) v.tipTo = (Math.random() < 0.5 ? -1 : 1) * 1.4; tint(v, _CH);
  fireball({ x:v.x, z:v.z }, v.moto ? 0.35 : 0.6, y + 0.6);
  for(let n = 0; n < (v.moto ? 5 : 9); n++) spawnPart(v.x, y + 0.5, v.z, (Math.random() - 0.5) * 7, 2 + Math.random() * 4, (Math.random() - 0.5) * 7, { color:Math.random() < 0.5 ? 0x2a2a2a : 0x9a9c9e, size:0.15 + Math.random() * 0.2, life:0.9, grav:-14, drag:0.8 });
  const p = S.player; if(p && Math.hypot(p.pos.x - v.x, p.pos.z - v.z) < 40) sfx('boom', { x:v.x, z:v.z }, v.moto ? 0.45 : 0.7); }
// a round crossing a vehicle: sparks off the panel, health off it (a car stops, Z320 smokes once it is badly hit, catches fire at none); true = the round is spent here
export function trafficShot(b, dt){ if(!TR.on) return false; const C = HIT(), ox = b.x - b.vx * dt, oz = b.z - b.vz * dt, step = Math.hypot(b.x - ox, b.z - oz);
  for(const v of TR.list){ if(v.dead || v.fade != null) continue; const dx = b.x - v.x, dz = b.z - v.z, R = v.hl + 1 + step; if(dx * dx + dz * dz > R * R) continue;
    const [ax, az] = local(v, ox, oz), [lx, lz] = local(v, b.x, b.z), rr = (b.r || 0.2) * 0.4; if(!crosses(ax, az, lx, lz, v.hw + rr, v.hl + rr)) continue;   // swept: a fast round jumps a car's width in a frame
    if(b.by != null && b.by > (v.moto ? 1.5 : 1.7)) continue;   // it flies over
    const y = heightAt(v.x, v.z); for(let n = 0; n < 4; n++) spawnPart(b.x, y + 0.6 + Math.random() * 0.5, b.z, (Math.random() - 0.5) * 4, 1 + Math.random() * 2.5, (Math.random() - 0.5) * 4, { color:Math.random() < 0.5 ? 0xffd27a : 0x9a9c9e, size:0.07 + Math.random() * 0.08, life:0.3, grav:-12, drag:0.6 });
    if(v.st !== 'burn'){ v.hp -= b.dmg || 10; if(!v.st && !v.moto){ loose(v); v.st = 'halt'; v.stT = C.haltT; } const bs = Math.hypot(b.vx, b.vz) || 1;
      if(v.hp <= 0){ const k = C.shotThrow / (v.moto ? 0.6 : 1); hit(v, b.vx / bs * k, b.vz / bs * k, b.x, b.z, true); trafficBurn(v); v.vy = C.hop[v.moto ? 1 : 0]; }   // Z320 the round that sets it alight throws it: off the road, turning, up off its wheels
      else if(v.st && !v.moto){ v.svx += b.vx / bs * 0.4; v.svz += b.vz / bs * 0.4; } }   // (each round jolts it)
    TR.stats.shot++; return true; }
  return false; }
// Z320 fire that is no round: a flame thrower's cone (from x, z along (cx, cz) out to range, cone = the cosine of its half-angle) or a beam (the segment
//   a → b, w wide each side) — what it reaches takes dmg off its health (a car stops) and catches fire at none
export function trafficCone(x, z, cx, cz, range, cone, dmg){ if(!TR.on) return; for(const v of TR.list){ if(v.dead || v.st === 'burn' || v.fade != null) continue; const dx = v.x - x, dz = v.z - z, d = Math.hypot(dx, dz);
    if(d < range + v.hl && (dx * cx + dz * cz) / (d || 1) >= cone) scorch(v, dmg); } }
function scorch(v, dmg){ v.hp -= dmg; if(!v.st && !v.moto){ loose(v); v.st = 'halt'; v.stT = HIT().haltT; } if(v.hp <= 0) trafficBurn(v); }
// does the segment (ax, az) → (bx, bz) cross the box |x| ≤ W, |z| ≤ L (slab clipping)
function crosses(ax, az, bx, bz, W, L){ let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
  for(const [p, d, h] of [[ax, dx, W], [az, dz, L]]){ if(Math.abs(d) < 1e-9){ if(Math.abs(p) > h) return false; continue; }
    let u0 = (-h - p) / d, u1 = (h - p) / d; if(u0 > u1) [u0, u1] = [u1, u0]; t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if(t0 > t1) return false; }
  return true; }
// the vehicles a body at (x, z) of radius R is pressing into: [{ v, nx, nz, d }] (out of the vehicle, how deep)
export function trafficContacts(x, z, R, out = []){ out.length = 0; if(!TR.on) return out;
  for(const v of TR.list){ if(v.dead || v.fade > 0.4) continue; const dx = x - v.x, dz = z - v.z, Q = v.hl + R + 0.5; if(dx * dx + dz * dz > Q * Q) continue;
    const [lx, lz] = local(v, x, z), cx = Math.max(-v.hw, Math.min(v.hw, lx)), cz = Math.max(-v.hl, Math.min(v.hl, lz)); let ex = lx - cx, ez = lz - cz, d = Math.hypot(ex, ez), pen;
    if(d > 1e-4){ if(d >= R) continue; pen = R - d; ex /= d; ez /= d; }
    else { const px = v.hw - Math.abs(lx), pz = v.hl - Math.abs(lz); if(px < pz){ ex = Math.sign(lx) || 1; ez = 0; pen = px + R; } else { ex = 0; ez = Math.sign(lz) || 1; pen = pz + R; } }   // inside it: out the nearest side
    const f = v.yw, s = Math.sin(f), c = Math.cos(f); out.push({ v, nx:ex * c + ez * s, nz:-ex * s + ez * c, d:pen }); }
  return out; }
// a loose vehicle slides and turns as the blow left it, the tarmac taking it off (mu per second)
function slide(v, dt, mu){ if(Math.abs(v.svx) + Math.abs(v.svz) > 0.04){ v.ox += v.svx * dt; v.oz += v.svz * dt; const k = Math.exp(-dt * mu); v.svx *= k; v.svz *= k; } else v.svx = v.svz = 0;
  if(Math.abs(v.spin) > 0.03){ v.wob += v.spin * dt; v.spin *= Math.exp(-dt * mu * 1.3); } else v.spin = 0; }
function stateStep(v, dt, p){ const C = HIT(); v.stT -= dt; v.tip += (v.tipTo - v.tip) * Math.min(1, dt * 7); if(v.vy || v.hop > 0){ v.hop += v.vy * dt; v.vy -= 15 * dt; if(v.hop <= 0){ v.hop = 0; v.vy = v.vy < -3 ? -v.vy * 0.25 : 0; } }   // (thrown up, it lands and bounces once)
  if(!v.hop) slide(v, dt, C.mu[v.moto ? 1 : 0]); else { v.ox += v.svx * dt; v.oz += v.svz * dt; v.wob += v.spin * dt; }
  if(v.fade != null){ v.fade += dt / C.fadeT; v.sink = v.sink0 + v.fade * (v.moto ? 0.9 : 1.6); if(v.fade >= 1){ v.dead = true; v.respawn = REALCITY.traffic.respawn; v.fade = null; v.st = null; } return; }
  const far = !p || Math.hypot(p.pos.x - v.x, p.pos.z - v.z) > C.clearR, still = !v.svx && !v.svz && !v.spin;
  if(v.st === 'down'){ if(Math.hypot(v.svx, v.svz) > 0.6 && Math.random() < 0.5) spawnPart(v.x, heightAt(v.x, v.z) + 0.1, v.z, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, { color:0xffd27a, size:0.08 + Math.random() * 0.1, life:0.35, grav:-9, drag:1 });   // sparks off the tarmac
    if(v.stT <= 0 && far) spawn(v); else if(v.stT < -C.downT * 2) gone(v); }   // gone once nobody is watching (or sinks away where it lies)
  else if(v.st === 'halt'){ if(v.hp < C.hp[v.moto ? 1 : 0] * C.smoke) smoulder(v, dt);
    if(v.stT <= 0 && still){ if(rejoin(v)) return; if(far) spawn(v); else if(v.stT < -C.haltT * 3) gone(v); } }
  else if(v.st === 'burn'){ burnFx(v, dt); if(v.stT <= 0) gone(v); } }
// a wreck goes: it sinks away in a last puff of smoke
function gone(v){ if(v.fade != null) return; v.fade = 0; v.sink0 = v.sink || 0; const y = heightAt(v.x, v.z), m = v.moto ? 0.6 : 1;
  for(let n = 0; n < 4; n++) spawnPart(v.x + (Math.random() - 0.5) * v.hw * 2, y + 0.4, v.z + (Math.random() - 0.5) * v.hl * 1.5, (Math.random() - 0.5) * 0.8, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8,
    { color:0x4a4640, size:(1.0 + Math.random() * 0.6) * m, life:2.2, smoke:true, grav:0.2, drag:0.6, grow:1.6 * m, op:0.4 }); }
// come to rest still pointing down its road, inside it: it pulls back into its lane and drives on (Z320)
function rejoin(v){ const R = v.r; if(v.hp <= 0 || v.tipTo) return false; let f = v.wob % (2 * Math.PI); if(f > Math.PI) f -= 2 * Math.PI; if(f < -Math.PI) f += 2 * Math.PI;
  const da = R.ax ? v.oz : v.ox, dw = R.ax ? v.ox : v.oz, off = v.off + sig(R, v.s) * dw, L = REALCITY.traffic.lane;
  if(Math.abs(f) > 0.6 || off > R.w / 2 - L.kerb || off < (R.blvd ? R.med / 2 + 0.2 : -R.w / 2 + L.kerb) + v.hw) return false;
  v.t += da; v.off = off; v.ox = v.oz = 0; v.wob = f; v.st = null; v.v = 0; v.wait = 0; v.svx = v.svz = v.spin = 0; return true; }
function smoulder(v, dt){ v.smk -= dt; if(v.smk > 0) return; v.smk = MOBILE ? 0.35 : 0.2; const y = heightAt(v.x, v.z), f = v.yw;
  spawnPart(v.x + Math.sin(f) * v.hl * 0.6, y + 0.9, v.z + Math.cos(f) * v.hl * 0.6, 0.3 * (Math.random() - 0.5), 1.2 + Math.random() * 0.6, 0.3 * (Math.random() - 0.5), { color:0x5a5650, size:0.6 + Math.random() * 0.4, life:1.8, smoke:true, grav:0.2, drag:0.6, grow:1.2, op:0.35 }); }   // a hit engine: grey smoke off the bonnet
function burnFx(v, dt){ const C = HIT(), k = Math.max(0, v.stT / C.burnT), y = heightAt(v.x, v.z), m = v.moto ? 0.55 : 1; v.fireT -= dt; if(v.fireT > 0) return; v.fireT = (MOBILE ? 0.11 : 0.06) / Math.max(0.45, k);
  if(k > 0.08) for(let n = 0; n < (v.moto ? 2 : 3); n++){ const hot = n === 0;   // Z320 a hot core low in the body and redder tongues licking up out of it
    spawnPart(v.x + (Math.random() - 0.5) * v.hw * (hot ? 0.8 : 1.5), y + (hot ? 0.35 : 0.5) * m + 0.3, v.z + (Math.random() - 0.5) * v.hl * (hot ? 0.7 : 1.3), (Math.random() - 0.5) * 0.6, (hot ? 1.0 : 1.8) + Math.random() * 1.4, (Math.random() - 0.5) * 0.6,
      { tex:'fire', color:hot ? 0xfff0b8 : 0xffb040, color2:hot ? 0xff7a14 : 0xe02a04, size:(hot ? 0.8 : 1.0 + Math.random() * 0.9) * m * (0.6 + k * 0.6), life:(hot ? 0.4 : 0.6) + Math.random() * 0.3, grav:1.5, drag:1.6, grow:hot ? 0.3 : 0.6 }); }
  if(Math.random() < 0.55) spawnPart(v.x + (Math.random() - 0.5) * 0.6, y + 1.1 * m + 0.3, v.z + (Math.random() - 0.5) * 0.6, 0.5 + (Math.random() - 0.5) * 0.4, 1.6 + Math.random() * 0.8, 0.3 + (Math.random() - 0.5) * 0.4,
    { color:k > 0.4 ? 0x16130f : 0x3a3632, size:(0.8 + Math.random() * 0.5) * m, life:MOBILE ? 2.2 : 3.2, smoke:true, grav:0.25, drag:0.5, grow:1.8 * m, op:0.45, keep:true }); }   // a modest column, not a tank's
function wreck(v, fire){ if(fire){ trafficBurn(v); return; } release(v); v.dead = true; v.respawn = REALCITY.traffic.respawn; const y = heightAt(v.x, v.z);   // (flattened under a tank: gone)
  burst({ x:v.x, z:v.z }, 0x8a8a88, v.moto ? 6 : 12, 5, { y:y + 0.6, life:0.5, size:v.moto ? 0.5 : 0.8 });
  for(let n = 0; n < (v.moto ? 5 : 9); n++) spawnPart(v.x, y + 0.5, v.z, (Math.random() - 0.5) * 7, 2 + Math.random() * 4, (Math.random() - 0.5) * 7, { color:Math.random() < 0.5 ? 0x2a2a2a : 0x9a9c9e, size:0.15 + Math.random() * 0.2, life:0.9, grav:-14, drag:0.8 });
  const p = S.player; if(p && Math.hypot(p.pos.x - v.x, p.pos.z - v.z) < 30){ sfx('crunch', { x:v.x, z:v.z }, 0.6); haptic(6); } }

// ---------- Z320 THE STREET'S OWN RULES ----------
// what is on a run this frame, in the run's own terms: a = along it, w = across from its centre line, ea / ew = half-extents, va = speed along it,
//   st = standing (struck, burning, parked — or you, stopped): something to steer round, not to queue behind
function boxes(p){ let k = 0; const P = TR.pool; for(const R of TR.runs) R.box.length = 0;
  const add = (R, a, w, ea, ew, va, st, u) => { const b = P[k] || (P[k] = {}); k++; b.a = a; b.w = w; b.ea = ea; b.ew = ew; b.va = va; b.st = st; b.u = u; R.box.push(b); };
  const anywhere = (x, z, yw, hw, hl, vx, vz, st, u, own) => { for(const R of TR.runs){ const a = R.ax ? z : x, w = (R.ax ? x : z) - R.c, [ea, ew] = ext(R, yw, hw, hl);
      if(R !== own && (a < R.a0 - 9 - ea || a > R.a1 + 9 + ea || Math.abs(w) > R.w / 2 + 1 + ew)) continue; add(R, a, w, ea, ew, R.ax ? vz : vx, st, u); } };
  for(const v of TR.list){ if(v.dead) continue; const R = v.r;
    if(!v.st && !v.ut){ const sw = Math.abs(Math.sin(v.wob)), cw = Math.abs(Math.cos(v.wob)); add(R, v.t, sig(R, v.s) * v.off, v.hl * cw + v.hw * sw, v.hw * cw + v.hl * sw, v.s * v.v, false, v); continue; }
    const [vx, vz] = trafficVel(v); if(v.ut){ const [ea, ew] = ext(R, v.yw, v.hw, v.hl); add(R, R.ax ? v.z : v.x, (R.ax ? v.x : v.z) - R.c, ea, ew, R.ax ? vz : vx, false, v); continue; }
    anywhere(v.x, v.z, v.yw, v.hw, v.hl, vx, vz, true, v, R); }
  for(const R of TR.runs) for(const b of R.park) if(b.c.alive) add(R, b.a, b.w, b.ea, b.ew, 0, true, null);
  if(p && p.pos){ const r = p.radius || 1, sp = Math.hypot(p.vel.x, p.vel.z); anywhere(p.pos.x, p.pos.z, 0, r, r, p.vel.x, p.vel.z, sp < 1.5, null, null); } }
// the junction a vehicle comes to next (or is in): the first along its way whose far side it has not yet cleared
function nextJ(v){ const L = v.r.junc, s = v.s; if(s > 0){ for(const j of L) if(j.a + j.h - v.t + v.hl > 0) return j; } else for(let i = L.length - 1; i >= 0; i--){ const j = L[i]; if(v.t - j.a + j.h + v.hl > 0) return j; } return null; }
function take(v, j){ const J = j.J; J.ax = v.r.ax; J.hold.add(v); v.J = J; v.Jr = j; if(J.want === v.r.ax){ J.want = -1; J.wantT = 0; } }
function release(v){ const J = v.J; if(!J) return; J.hold.delete(v); if(!J.hold.size) J.ax = null; v.J = v.Jr = null; }
// may it enter the crossing: one road at a time (the other waits at its stop line, and is let through once it has waited yieldT), never without room on the far side
function grant(v, j){ const J = j.J, ax = v.r.ax, Y = REALCITY.traffic.junc;
  if(J.hold.size && J.ax !== ax){ if(J.want !== ax){ J.want = ax; J.wantT = 0; } J.seen = TR.frame; return false; }
  if(J.want >= 0 && J.want !== ax && J.wantT > Y.yieldT) return false;
  if(v.r.endJ[v.s > 0 ? 1 : 0] === j ? !landClear(v, turnAt(v)) : !roomBeyond(v, j)) return false;
  take(v, j); return true; }
function roomBeyond(v, j){ const R = v.r, s = v.s, sg = sig(R, s), ex = (j.a + s * j.h - v.t) * s;   // (its far side, ahead of our centre)
  for(const b of R.box){ if(b.u === v) continue; if(Math.abs(sg * b.w - v.off) >= b.ew + v.hw + 0.2) continue; const d = (b.a - v.t) * s;
    if(d + b.ea < ex - 2 * j.h || d - b.ea > ex + v.len + 1.2) continue; if(!b.st && b.va * s > 2.5) continue; return false; }
  return true; }
// where its U-turn begins: just inside the crossing at the end of its road — or, where no crossing is laid there, in the road itself short of its end
function turnAt(v){ const R = v.r, s = v.s, J = R.endJ[s > 0 ? 1 : 0]; if(J) return J.a - s * J.h + s * 0.3; const g = v.lane + v.hw + 1.4; return s > 0 ? R.a1 - g : R.a0 + g; }
// room where it comes out of the U-turn: its new lane, heading back, clear about the turn point
function landClear(v, tu){ const R = v.r, s = v.s, sg = sig(R, s), s2 = -s, sg2 = -sg, as = tu + s2 * 2 * v.hl * 0.55, rho = (v.off + v.lane) / 2; if(R.utv[s > 0 ? 1 : 0] && R.utv[s > 0 ? 1 : 0] !== v) return false;   // (one U-turn at a time at each end of a road)
  for(const b of R.box){ if(b.u === v) continue;
    if(Math.abs(sg2 * b.w - v.lane) < b.ew + v.hw + 0.3){ const d = (b.a - as) * s2; if(d + b.ea > -v.hl - 0.6 && d - b.ea < v.hl + 3) return false; }   // where it comes out
    const o = sg * b.w; if(o + b.ew > -v.lane - v.hw - 0.3 && o - b.ew < v.off - v.hw && b.va * s > -0.5){ const d = (b.a - tu) * s; if(d + b.ea > -v.hl - 0.5 && d - b.ea < rho + 2 * v.hl + 0.5) return false; } }   // what it sweeps across (the inner lane turns first)
  return true; }
// is a lateral move to offset q clear: the band it sweeps, from beside us to past what we are going round (end m ahead of our centre); an oncoming
//   vehicle counts as far off as it will come while we pass
function clearBand(v, q, ob, end, m){ const R = v.r, s = v.s, sg = sig(R, s), lo = Math.min(v.off, q) - v.hw - m, hi = Math.max(v.off, q) + v.hw + m, tp = end / Math.max(v.v, 2.5) + 1;
  for(const b of R.box){ if(b.u === v || b === ob) continue; const o = sg * b.w; if(o + b.ew < lo || o - b.ew > hi) continue;
    const d = (b.a - v.t) * s, near = d - b.ea - v.hl, vl = b.va * s; if(d + b.ea + v.hl < -1.5) continue;   // well behind us
    if(!b.st && vl > 1 && near > 0) continue;   // going our way ahead of us: we follow it
    if(near > end + (vl < -0.5 ? -vl * tp : 0)) continue; return false; }
  return true; }
// a vehicle on its lane: steer round what stands in it, wait its turn at a crossing, keep its distance (IDM), U-turn at the end of the road
function drive(v, dt, p, now){ const R = v.r, s = v.s, sg = sig(R, s), C = REALCITY.traffic, D = C.drive, L = C.lane, mi = v.moto ? 1 : 0, m = L.gap[mi];
  if(v.ut){ uturn(v, dt); return; }
  // ---- across: keep to its lane; something standing in it within sight → the nearer clear side of it (left first), or hold its line and stop behind it ----
  let tgt = v.off, ob = null, obD = 1e9; const look = 8 + v.v * 2.2;
  for(const b of R.box){ if(b.u === v || !b.st) continue; const d = (b.a - v.t) * s; if(d + b.ea < -v.hl - 0.3 || d - b.ea - v.hl > look) continue;
    if(Math.abs(sg * b.w - v.lane) < b.ew + v.hw + m && d < obD){ obD = d; ob = b; } }
  if(ob){ const o = sg * ob.w, hi = R.w / 2 - L.kerb - v.hw, lo = R.blvd ? R.med / 2 + L.kerb + v.hw : -hi, end = (ob.a - v.t) * s + ob.ea + v.hl + 2;
    const cs = [o - ob.ew - v.hw - m, o + ob.ew + v.hw + m].filter(q => q >= lo && q <= hi).sort((a, b) => Math.abs(a - v.off) - Math.abs(b - v.off));
    for(const q of cs) if(clearBand(v, q, ob, end, m)){ tgt = q; break; }
    if(tgt === v.off && Math.abs(v.off - v.lane) > 0.05 && clearBand(v, v.lane, ob, v.hl + 1, m)) tgt = v.lane;   // no way round yet: back into its own lane to wait behind it, out of the oncoming one
    if(tgt !== v.lane) TR.stats.sw++; }
  else if(Math.abs(v.off - v.lane) > 0.02 && clearBand(v, v.lane, null, v.hl + 5, m)) tgt = v.lane;
  // ---- along: the nearest thing ahead in the band it holds now, the crossing's stop line if it may not go, the U-turn point if its way out is blocked ----
  let gap = 1e9, vl = 0;
  for(const b of R.box){ if(b.u === v) continue; const d = (b.a - v.t) * s; if(d <= 0) continue; if(Math.abs(sg * b.w - v.off) >= b.ew + v.hw + m * 0.6) continue;
    const g = d - b.ea - v.hl; if(g < gap){ gap = g; vl = b.va * s; } }
  const j = nextJ(v);
  if(j && v.J !== j.J && !(j.end && !R.endJ.includes(j))){ const dE = (j.a - s * j.h - v.t) * s - v.hl;
    if(dE < -v.len) take(v, j);   // (already in it: it holds it)
    else if(dE < v.v * v.v / (3 * D.brake) + 2.5 && !grant(v, j) && dE - 0.3 < gap){ gap = dE - 0.3; vl = 0; TR.stats.jw++; } }
  const tu = turnAt(v), dT = (tu - v.t) * s; if(!R.endJ[s > 0 ? 1 : 0] && dT < v.v * v.v / (2 * D.brake) + 3 && !landClear(v, tu) && dT < gap){ gap = dT; vl = 0; }
  // IDM: free road → its own pace; something ahead → the gap it wants at this speed and closing rate
  const a = D.acc[mi], T = D.T[mi], s0 = D.s0[mi], dv = v.v - vl, want = s0 + Math.max(0, v.v * T + v.v * dv / (2 * Math.sqrt(a * D.brake)));
  let acc = a * (1 - (v.v / v.vmax) ** 4 - (gap < 1e8 ? (want / Math.max(gap, 0.05)) ** 2 : 0)); acc = Math.max(-9, Math.min(a, acc));
  v.v = Math.max(0, v.v + acc * dt); v.v = Math.min(v.v, Math.max(0, gap - 0.1) / dt + Math.max(0, vl));   // never into what is in front, whatever the model says
  const lr = D.lat[mi] * (0.4 + 0.6 * Math.min(1, v.v / 4)), dOff = Math.max(-lr * dt, Math.min(lr * dt, tgt - v.off)); v.off += dOff;
  const sway = v.moto ? Math.sin(now * 0.0013 + v.k) * 0.03 : 0, wy = Math.max(-0.35, Math.min(0.35, -Math.atan2(dOff / dt, Math.max(v.v, 1.5))));
  v.wob += (wy + sway - v.wob) * Math.min(1, dt * 6); if(v.moto) v.lean = Math.sin(now * 0.0009 + v.k * 1.7) * 0.025;
  v.t += v.v * s * dt; roll(v, dt);
  if(v.J && (v.Jr.a + s * v.Jr.h - v.t) * s + v.hl < 0) release(v);   // its tail is out of the crossing
  else if(v.J && v.wait > 4 && v.J.want >= 0 && v.J.want !== R.ax && (v.Jr.a - s * v.Jr.h - v.t) * s - v.hl > 0.5) release(v);   // held up short of it while the other road queues: it gives its turn back
  if((v.t - tu) * s >= 0 && (!R.endJ[s > 0 ? 1 : 0] || v.J === R.endJ[s > 0 ? 1 : 0].J)){ if(landClear(v, tu)) startU(v, tu); else { v.t = tu - s * 0.01; v.v = 0; } }   // (its way out blocked: it waits at the turn)
  v.wait = v.v < 0.2 ? v.wait + dt : 0; }
function roll(v, dt){ const RA = v.im.geometry.attributes.aRoll; if(RA){ v.roll = ((v.roll || 0) + v.v * dt / v.im.userData.rM) % 6.2832; RA.setX(v.k, v.roll); } }   // Z290 roll as far as it went
// Z320 THE U-TURN: a half circle to the left from its lane into the other one, the rear axle on the circle (so the tail never swings out into the next
//   lane), at a walking pace, one at a time at each end of a road; a boulevard's inside the crossing past its median (held the whole way round)
function startU(v, tu){ const R = v.r, sg = sig(R, v.s), rho = Math.max(0.6, (v.off + v.lane) / 2), lr = v.hl * 0.55; v.t = tu; v.ut = { as:tu - v.s * lr, th:0, rho, wc:sg * (v.off - v.lane) / 2, sg, lr }; v.wob = 0; R.utv[v.s > 0 ? 1 : 0] = v; TR.stats.ut++; }
function uturn(v, dt){ const U = v.ut, D = REALCITY.traffic.drive, f = v.yw, nx = v.x + Math.sin(f) * (v.hl + 0.7), nz = v.z + Math.cos(f) * (v.hl + 0.7);
  let blocked = false; for(const u of TR.list){ if(u === v || u.dead) continue; if(Math.abs(u.x - nx) > 6 || Math.abs(u.z - nz) > 6) continue; const [lx, lz] = local(u, nx, nz); if(Math.abs(lx) < u.hw + 0.3 && Math.abs(lz) < u.hl + 0.3){ blocked = true; break; } }
  const vu = blocked ? 0 : D.uturnV[v.moto ? 1 : 0]; v.v += (vu - v.v) * Math.min(1, dt * (blocked ? 8 : 2)); U.th += v.v * dt / U.rho; roll(v, dt);
  if(U.th >= Math.PI){ endU(v); v.t = U.as - v.s * U.lr; v.s = -v.s; v.off = v.lane; v.wob = 0; } }
function endU(v){ const R = v.r; if(!v.ut) return; for(let e = 0; e < 2; e++) if(R.utv[e] === v) R.utv[e] = null; v.ut = null; }
// what a loose vehicle runs into: another (a blow passed on — a car slid into a scooter knocks it over), or a parked car (it stops against it)
function bumps(){ const Lst = TR.list, n = Lst.length, I = HIT();
  for(let i = 0; i < n; i++){ const a = Lst[i]; if(a.dead || a.fade != null) continue;
    for(let k = i + 1; k < n; k++){ const b = Lst[k]; if(b.dead || b.fade != null) continue; const dx = b.x - a.x, dz = b.z - a.z, rr = a.hl + b.hl; if(dx * dx + dz * dz > rr * rr) continue;
      const M = mtv(a, b); if(!M) continue; if(!a.st && !b.st){ TR.stats.mm++; continue; } meet(a, b, M, I); }
    if(a.st) for(const B of a.r.park.concat(nearPark(a))){ if(!B.c.alive) continue; const M = mtv(B, a); if(!M) continue; const [nx, nz, d] = M; a.ox += nx * d; a.oz += nz * d; a.x += nx * d; a.z += nz * d;
      const vn = a.svx * nx + a.svz * nz; if(vn < 0){ a.svx -= 1.2 * vn * nx; a.svz -= 1.2 * vn * nz; a.spin *= 0.5; } } } }
function nearPark(v){ const out = []; for(const R of TR.runs) if(R !== v.r) for(const b of R.park) if(Math.abs(b.x - v.x) < 6 && Math.abs(b.z - v.z) < 6) out.push(b); return out; }
function meet(a, b, [nx, nz, d], I){ const ma = a.moto ? I.motoM : 1, mb = b.moto ? I.motoM : 1, ia = 1 / ma, ib = 1 / mb, [avx, avz] = trafficVel(a), [bvx, bvz] = trafficVel(b), vn = (avx - bvx) * nx + (avz - bvz) * nz;
  if(vn > 0.8){ const jn = 1.25 * vn / (ia + ib), hard = vn > 3, cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2; hit(a, -nx * jn * ia, -nz * jn * ia, cx, cz, hard); hit(b, nx * jn * ib, nz * jn * ib, cx, cz, hard); }
  const ka = a.st ? (b.st ? ia / (ia + ib) : 1) : 0, kb = 1 - ka; if(a.st){ a.ox -= nx * d * ka; a.oz -= nz * d * ka; a.x -= nx * d * ka; a.z -= nz * d * ka; }
  if(b.st){ b.ox += nx * d * kb; b.oz += nz * d * kb; b.x += nx * d * kb; b.z += nz * d * kb; } }

export function updateTraffic(dt){ if(!TR.on) return; if(!TR.ims.length || !TR.ims[0].parent){ TR.on = false; return; } dt = Math.min(dt, 0.05); if(!(dt > 0)) return;
  const p = S.player, C = REALCITY.traffic, now = performance.now(); TR.frame++;
  for(const v of TR.list){ if(v.dead){ v.respawn -= dt; if(v.respawn <= 0) spawn(v); continue; }
    if(p && MODE.crushes && Math.hypot(p.pos.x - v.x, p.pos.z - v.z) < (v.moto ? 1.9 : 2.8)){ wreck(v, false); continue; }   // run over (Z306 only a tank flattens what it drives into — the soldier's ride has its own collisions, game/ride-impact.js)
    if(v.st) stateStep(v, dt, p);
    else if(v.wait > C.stuckT && (!p || Math.hypot(p.pos.x - v.x, p.pos.z - v.z) > C.farR)) spawn(v); }   // (stuck a long while where nobody sees it: it goes round another way)
  for(const v of TR.list) if(!v.dead) pose(v);
  bumps(); boxes(p);
  for(const J of TR.juncs) if(J.want >= 0){ J.wantT += dt; if(TR.frame - J.seen > 3){ J.want = -1; J.wantT = 0; } }
  for(const v of TR.list) if(!v.dead && !v.st){ drive(v, dt, p, now); pose(v); }
  for(const v of TR.list) place(v);
  for(const im of TR.ims){ im.instanceMatrix.needsUpdate = true; if(im.geometry.attributes.aRoll) im.geometry.attributes.aRoll.needsUpdate = true; } }
export const TRAFFIC = TR;
// Z282 a mount for the xe-ôm mode: the bike (green-jacket driver on the scooter) as one
//   geometry with its materials, in metres, front toward +z — the player's soldier sits on it where XEOM says
export async function mountModel(kind){ const X = XEOM[kind]; if(!X) return null; const R = await riderGeo(); if(!R) return null;
  let bike = null; if(kind === 'xeom'){ const gl = await loadGLTF('moto_scooter'); if(gl) bike = bikeGeo(gl, REALCITY.traffic.motoL); }   // (Z332 the xích lô is gone: only the xe ôm has a stand-in)
  if(!bike) return null; const rgeo = R.geo.clone(); rgeo.translate(0, X.driver[0], X.driver[1]);
  const rm = R.sk.material.clone(); if(X.livery != null) rm.map = livery(R.sk.material.map, REALCITY.traffic.liveries[X.livery]);
  const geo = mergeGeometries([bike.geo, rgeo], true); geo.computeBoundingSphere(); return { geo, mats:[bike.mat, rm] }; }

