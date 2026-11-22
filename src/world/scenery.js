// world/scenery.js — Z374 THE BATTLEFIELD AS A PICTURE: every land is composed from the Meshy community scans (config SCENERY, files from
//   tools/scene-import.mjs) the way a painter lays a scene — a skyline beyond the fence (smoking cones, ice summits), one landmark the field turns
//   on (a marble temple with its lions at the steps, the great tree of the plain, a mountain with a temple gate cut in it), framing groves, a rail
//   siding of tankers, a pole line marching off, a tank farm ringed with drums, rocks and breached walls to fight from.
//   Each piece is drawn at three distances: whole up close (the near scan, up to a million triangles, fetched only once the camera comes near it),
//   a mid copy, a far copy (built offline, nothing is simplified while the game runs); phones take one light copy. The ground is claimed when the
//   field is laid out (cover, camps and lava keep clear); a piece stops tanks and men by its true footprint (a box, an arch's two feet, a trunk),
//   and a lava pit holds live melt that burns like any pool.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { FUEL_DRUM, REALPROP, SCENERY, SKYLINE, FUEL_TANK } from '../../config.js';
import { ARENA, BIOME, FORTS, HZN, LAND, LAVA, MOBILE, WALL_BANDS, WONDER, ZONES, arena, blendIn, blocks, cityBuildings, crushables, fieldR, groundGlowMesh, heightAt, inField, inZone, loadGLTF, loadRealCity, magmaMat, renderer, sectorize } from '../hub.js';

const DIR = 'assets/models/real/scene/', SUB = { d:'', l:'l/', f:'f/', m:'m/' }, LVL = {}, NORM = {};
let _ldr = null, GEN = 0; const ldr = () => _ldr || (_ldr = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder));
export const SCENE = { pieces:[] };
const M = k => SCENERY.models[k];
// a model's size in metres (x, y, z) from its config: h = its height, or w = its widest side
export function sceneDims(k, s = 1){ const C = M(k), a = C.ar; let f = C.h ? C.h : C.w / Math.max(a[0], a[2]); f *= s; return { x:a[0] * f, y:f, z:a[2] * f }; }
// one level of a model: the mesh's geometry (quantized, as the file holds it), its material, the file's node transform
export function sceneLevel(k, lv){ const id = k + ':' + lv; if(LVL[id]) return LVL[id];
  if(typeof window === 'undefined') return (LVL[id] = Promise.resolve(null));
  return (LVL[id] = ldr().loadAsync(DIR + SUB[lv] + k + '.glb').then(gl => { let src = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if(o.isMesh && !src) src = o; });
    if(!src) return null; const g = src.geometry; if(!g.boundingBox) g.computeBoundingBox(); const mat = src.material, C = M(k) || {};
    mat.envMapIntensity = C.env ?? SCENERY.env; blendIn(mat); return { geo:g, mat, m4:src.matrixWorld.clone() }; })
    .catch(e => { console.warn('[scenery]', id, e && e.message); return null; })); }
// Z392 a near scan's maps (up to 4K) sent to the GPU one a frame before it is shown: all at once they held a frame 150–400 ms
const WARM = new WeakMap(), _frame = () => new Promise(q => requestAnimationFrame(q));
function warmMaps(L){ if(!L) return L; if(!WARM.has(L)) WARM.set(L, (async () => { for(const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']){ const t = L.mat[k]; if(t && !t.userData.warm){ t.userData.warm = 1; renderer.initTexture(t); await _frame(); } } return L; })());
  return WARM.get(L); }
// the transform that stands a model on its foot at the origin, centred, at its config size (one per model: every level shares it, so nothing jumps)
const _b = new THREE.Box3(), _s = new THREE.Vector3(), _c = new THREE.Vector3();
function norm(k, L){ if(NORM[k]) return NORM[k]; _b.copy(L.geo.boundingBox).applyMatrix4(L.m4); _b.getSize(_s); _b.getCenter(_c); const C = M(k), f = C.h ? C.h / _s.y : C.w / Math.max(_s.x, _s.z);
  const N = new THREE.Matrix4().makeScale(f, f, f).multiply(new THREE.Matrix4().makeTranslation(-_c.x, -_b.min.y - (C.sink || 0) * _s.y, -_c.z)); return (NORM[k] = { N }); }
// a piece: its levels swap with the distance; the near (whole) one is fetched once the camera comes close
const _cp = new THREE.Vector3(), _op = new THREE.Vector3();
export class SceneLOD extends THREE.LOD {
  constructor(k, o = {}){ super(); this.key = k; this.lv = {}; this.mat = o.mat || null; this.shadow = o.shadow ?? true; this.dist = o.dist || [40, 120]; this.nearAt = o.nearAt || 0; this.asked = false; this.onLevel = o.onLevel || null; }
  update(cam){ if(this.watch && this.watch()){ this.visible = false; return; } if(this.levels.length > 1) super.update(cam);   // (watch: the roof it stands on is gone)
    if(this.nearAt && !this.asked){ _cp.setFromMatrixPosition(cam.matrixWorld); _op.setFromMatrixPosition(this.matrixWorld); if(_cp.distanceToSquared(_op) < this.nearAt * this.nearAt){ this.asked = true; sceneLevel(this.key, 'd').then(warmMaps).then(L => L && this.put('d', L)); } } }
  put(lv, L){ if(this.lv[lv] || !L) return; const n = norm(this.key, L), m = new THREE.Mesh(L.geo, this.mat || L.mat); if(this.mat && (lv === 'd' || !this.mat.map)) takeMaps(this.mat, L.mat); m.matrixAutoUpdate = false; m.matrix.multiplyMatrices(n.N, L.m4);
    m.castShadow = this.shadow; m.receiveShadow = true; this.lv[lv] = m; for(const q of this.levels) this.remove(q.object); this.levels.length = 0;
    [['d', 0], ['l', this.dist[0]], ['f', this.dist[1]], ['m', 0]].filter(([v]) => this.lv[v]).forEach(([v, d], i) => this.addLevel(this.lv[v], i ? d : 0, SCENERY.lod.hys));
    if(this.onLevel) this.onLevel(lv, m); } }
// a piece with a material of its own (a tower fades and flashes alone): it wears the scan's maps once they are in (the sharper ones when the near level comes)
function takeMaps(to, from){ for(const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) to[k] = from[k]; to.color.copy(from.color); to.emissive.copy(from.emissive);
  to.roughness = from.roughness; to.metalness = from.metalness; to.envMapIntensity = from.envMapIntensity; to.needsUpdate = true; }
// Z375 a watchtower / water tower of world/tower-kinds.js: the scan stood in the tower's body (it topples with it), its own material returned for the fade
export function towerModel(body, K){ const mat = new THREE.MeshStandardMaterial({ color:0x8a8a84, roughness:0.8 }); mat.userData.own = true; blendIn(mat); body.add(scenePiece(K.model, 1, { mat, tone:landTone() })); return mat; }
// Z420 the land's tone (REALPROP.cast.tint, × share SCENERY.tone) that the forts' bunkers and the guard towers wear over their own colour: one palette per field
export function landTone(){ const t = REALPROP.cast.tint, c = new THREE.Color(t[BIOME.name] ?? t._); return new THREE.Color(1, 1, 1).lerp(c, SCENERY.tone); }
// a piece ready to stand somewhere (its levels fetched in the background): the light ones now, the near one when it is wanted
export function scenePiece(k, s = 1, o = {}){ const C = M(k), D = sceneDims(k, s), R = Math.max(D.x, D.y, D.z) / 2, Z = SCENERY.lod;
  if(o.tone){ const mat = o.mat || new THREE.MeshStandardMaterial({ color:0x8a8a84, roughness:0.8 }), prev = o.onLevel; if(!o.mat){ mat.userData.own = true; blendIn(mat); }   // Z420 tinted: its own material, toned each time it takes a level's maps (and colour)
    o = { ...o, mat, onLevel:(lv, m) => { if(mat.map !== mat.userData.tonedMap){ mat.color.multiply(o.tone); mat.userData.tonedMap = mat.map; } if(prev) prev(lv, m); } }; }
  const dist = [Math.max(Z.mid[0], Z.mid[1] * R), Math.max(Z.far[0], Z.far[1] * R)], one = !!C.one;
  const lod = new SceneLOD(k, { ...o, dist, nearAt:MOBILE || one || o.top ? 0 : dist[0] + Z.near }); lod.userData.scene = k;   // (Z393 top: the most detail a small piece needs — 'l' never fetches the whole scan)
  if(MOBILE) sceneLevel(k, 'm').then(L => lod.put('m', L)); else if(one) sceneLevel(k, 'd').then(L => lod.put('d', L));
  else { sceneLevel(k, 'f').then(L => lod.put('f', L)); if(o.top !== 'f') sceneLevel(k, 'l').then(L => lod.put('l', L)); }
  return lod; }

// ---------------------------------------------------------------------------------------------------------------------------------------
// laying the field out: each beat of the land's composition finds its ground; nothing lands on our base, the spawn, a fort, a zone or another piece
const rnd = (a, b) => a + Math.random() * (b - a), pick = L => L[(Math.random() * L.length) | 0];
const fr = (k, s) => { const D = sceneDims(k, s); return Math.max(D.x, D.z) / 2; };
function clear(x, z, r, placed, edge){ const C = SCENERY, sp = Math.hypot(x, z - ARENA * 0.55);
  if(Math.hypot(x, z) < C.clearCore + r || sp < C.clearSpawn + r || Math.hypot(x - WK.x, z - WK.z) < WK.r + r) return false;   // (nor on the land's wonder, beyond the fence but reaching in)
  if(!edge && (!inField(x, z, r + 3) || inZone(x, z, r + 4))) return false;
  if(FORTS.some(f => Math.hypot(f.x - x, f.z - z) < (f.R || 30) + r + 10)) return false;
  return !placed.some(p => Math.hypot(p.x - x, p.z - z) < p.r + r + C.gap); }
function freeSpot(r, placed, north){ for(let t = 0; t < 220; t++){ const a = north ? rnd(-Math.PI + 0.35, -0.35) : rnd(-Math.PI, Math.PI), d = rnd(SCENERY.clearCore + r, fieldR(a) - r - 6), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if(clear(x, z, r, placed)) return [x, z]; } return null; }
const faceCore = (x, z) => Math.atan2(-x, -z), WK = { x:0, z:-1e4, r:0, a:0 };
const offWonder = a => Math.abs(Math.atan2(Math.sin(a - WK.a), Math.cos(a - WK.a))) > SCENERY.wonderGap;
function plan(beats){ const placed = [], byId = {};
  let beat = null; const add = (k, x, z, ry, s, extra) => { const p = { k, x, z, ry, s, r:fr(k, s), solid:beat && beat.solid, top:beat && beat.top, ...extra }; placed.push(p); return p; };
  const face = (b, x, z, along) => b.face === 'rand' ? Math.random() * Math.PI * 2 : b.face === 'out' ? faceCore(x, z) + Math.PI : b.face === 'along' && along != null ? along : faceCore(x, z) + rnd(-0.18, 0.18);
  for(const b of beats){ beat = b; const n = MOBILE ? Math.ceil((b.n || 1) * 0.5) : (b.n || 1), S = () => b.s ? rnd(b.s[0], b.s[1]) : 1;
    if(b.at === 'far'){ for(let t = 0; t < 40; t++){ const [a0, a1] = pick(b.a), a = rnd(a0, a1), s = S(); if(!offWonder(a)) continue; const d = fieldR(a) + rnd(b.d[0], b.d[1]) + fr(b.k, s) * 0.5, x = Math.cos(a) * d, z = Math.sin(a) * d;
        if(placed.some(p => Math.hypot(p.x - x, p.z - z) < p.r + fr(b.k, s) * 0.8)) continue; add(b.k, x, z, faceCore(x, z) + rnd(-0.6, 0.6), s, { far:true }); break; } continue; }
    if(b.at === 'edge'){ for(let t = 0; t < 60; t++){ const [a0, a1] = pick(b.a), a = rnd(a0, a1); if(!offWonder(a)) continue; const s = S(), r = fr(b.k, s), d = fieldR(a) - b.inset, x = Math.cos(a) * d, z = Math.sin(a) * d;   // (never standing in front of the wonder)
        if(!clear(x, z, r * 0.6, placed, true) || FORTS.some(f => Math.hypot(f.x - x, f.z - z) < (f.R || 30) + r + 6)) continue; const p = add(b.k, x, z, faceCore(x, z), s, { edge:true }); if(b.id) byId[b.id] = p; ZONES.push({ kind:'scenery', x, z, r:r * 0.8 }); break; } continue; }
    if(b.at === 'pair'){ const o = byId[b.of]; if(!o) continue; for(const sd of [-1, 1]){ const c = Math.cos(o.ry), sn = Math.sin(o.ry), lx = sd * b.side, lz = b.fwd, x = o.x + lx * c + lz * sn, z = o.z - lx * sn + lz * c;
        if(inField(x, z, 2)){ const q = add(b.k, x, z, o.ry, o.s || 1, { pair:true }); ZONES.push({ kind:'scenery', x, z, r:q.r + 2 }); } } continue; }
    if(b.at === 'avenue'){ const o = byId[b.of]; if(!o) continue; const L = Math.hypot(o.x, o.z) || 1, ux = -o.x / L, uz = -o.z / L, nx = -uz, nz = ux;   // Z422 an avenue: pairs either side of the axis from a monument toward our base, facing the road
      for(let i = 0; i < n * 2; i++){ const d = (i % 2 ? -1 : 1) * (b.from + (i >> 1) * b.gap); for(const sd of [-1, 1]){ const s = S(), r = fr(b.k, s), x = o.x + ux * d + nx * sd * b.side, z = o.z + uz * d + nz * sd * b.side;   // (both ways from the monument: toward our base and away, as far as the ground allows)
        if(!clear(x, z, r, placed) || !inField(x, z, r + 1)) continue; add(b.k, x, z, Math.atan2(-nx * sd, -nz * sd), s, { avenue:true }); ZONES.push({ kind:'scenery', x, z, r:r + 1.5 }); } } continue; }
    if(b.at === 'around'){ const o = byId[b.of]; if(!o) continue; for(let i = 0, t = 0; i < n && t < n * 30; t++){ const a = Math.random() * Math.PI * 2, d = rnd(b.r[0], b.r[1]), x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d, s = S(), r = fr(b.k, s);
        if(!inField(x, z, r + 2) || placed.some(p => !p.ghost && Math.hypot(p.x - x, p.z - z) < p.r + r + 0.6)) continue; add(b.k, x, z, face(b, x, z), s); i++; } continue; }   // (inside its own ring: the hub's claim is for the others)
    if(b.at === 'line'){ const r = fr(b.k, 1);   // a straight run: a start on open ground, a heading, every post clear — else another start
      for(let t = 0; t < 300; t++){ const c = freeSpot(r, placed); if(!c) break; const h = Math.random() * Math.PI * 2, ux = Math.cos(h), uz = Math.sin(h), pts = [];
        for(let i = 0; i < n; i++){ const x = c[0] + ux * b.gap * i, z = c[1] + uz * b.gap * i; if(!clear(x, z, r, placed)) break; pts.push({ x, z, r }); }   // (its own posts stand gap m apart by design)
        if(pts.length < n) continue; const ry = Math.atan2(-uz, ux);   // (its length, +X, laid along the line)
        for(const q of pts){ add(b.k, q.x, q.z, face(b, q.x, q.z, ry), 1); ZONES.push({ kind:'scenery', x:q.x, z:q.z, r:r + 2 }); } break; } continue; }
    if(b.at === 'cluster'){ const R = b.r + fr(b.k, 1), c = freeSpot(R, placed, b.north); if(!c) continue; const hub = { k:b.k, x:c[0], z:c[1], r:R, ry:0, hub:true }; if(b.id) byId[b.id] = hub;
      for(let i = 0, t = 0; i < n && t < n * 40; t++){ const a = Math.random() * Math.PI * 2, d = n === 1 ? 0 : rnd(0, b.r), x = c[0] + Math.cos(a) * d, z = c[1] + Math.sin(a) * d, s = S(), r = fr(b.k, s);
        if(placed.some(p => Math.hypot(p.x - x, p.z - z) < p.r + r + 1.2) || !inField(x, z, r + 2)) continue; add(b.k, x, z, face(b, x, z), s); i++; }
      ZONES.push({ kind:'scenery', x:c[0], z:c[1], r:R }); placed.push({ ...hub, ghost:true }); continue; }
    for(let i = 0; i < n; i++){ const s = S(), c = freeSpot(fr(b.k, s), placed, b.north); if(!c) break; const p = add(b.k, c[0], c[1], face(b, c[0], c[1]), s); if(b.id && !i) byId[b.id] = p; ZONES.push({ kind:'scenery', x:c[0], z:c[1], r:p.r * 0.9 }); } }
  return placed.filter(p => !p.ghost); }

// what stops a tank or a man: an oriented box (the obb that solid-shape.js pushes bodies out of), an arch's two feet, a trunk or a drum of a circle
// Z393 a beat may stop things its own way (p.solid): a small scan in the field, where the same model on the skyline is scenery only
function solids(p, lod, gy){ const C = p.solid || M(p.k).solid; if(!C) return; const D = sceneDims(p.k, p.s), c = Math.cos(p.ry), sn = Math.sin(p.ry), top = gy + D.y, out = [];
  const box = (lx, hw, hl) => out.push({ x:p.x + lx * c, z:p.z - lx * sn, r:Math.max(0.5, Math.min(hw, hl)), obb:{ f:p.ry, hl:Math.max(0.3, hl), hw:Math.max(0.3, hw) } });
  if(C.box) box(0, D.x / 2 * C.box, D.z / 2 * C.box);
  else if(C.pillars){ const w = D.x * C.pillars; for(const sd of [-1, 1]) box(sd * (D.x / 2 - w / 2), w / 2, D.z / 2 * 0.9); }
  else if(C.disc) out.push({ x:p.x, z:p.z, r:Math.max(D.x, D.z) * C.disc });
  else if(C.r) out.push({ x:p.x, z:p.z, r:C.r * p.s });
  if(M(p.k).fuel){ const F=FUEL_TANK[M(p.k).fuel] || FUEL_DRUM; for(const q of out) blocks.push({ mesh:lod, ...q, hp:F.hp, maxHp:F.hp, steel:false, cover:true, loot:false, kind:'fueldrum', fuel:F, scenery:p.k, _top:top, _topHp:F.hp }); return; }   // Z414 a fuel-farm tank / rail tanker the same, bigger (FUEL_TANK)   // Z402 a fuel drum: shot, it goes up (world/cover.js fuelDrumHit)
  for(const q of out) blocks.push({ mesh:lod, ...q, hp:Infinity, maxHp:Infinity, steel:true, heavy:true, loot:false, kind:'ruin', scenery:p.k, _top:top, _topHp:Infinity }); }   // (kind 'ruin': the same rules as the war's ruins — indestructible stone)
// Z402 a piece blown away (a fuel drum): out of the field and out of the lists that hold the field's pieces (its levels' geometry is shared — kept)
export function dropScenePiece(lod){ lod.parent && lod.parent.remove(lod); const i=LAND.meshes.indexOf(lod); if(i>=0) LAND.meshes.splice(i, 1); const j=SCENE.pieces.findIndex(p=>p.lod===lod); if(j>=0) SCENE.pieces.splice(j, 1); }
// the ground under a footprint: stand on its lowest point (a slope never leaves a corner hanging in the air)
function footY(p){ const D = sceneDims(p.k, p.s), c = Math.cos(p.ry), sn = Math.sin(p.ry); let y = heightAt(p.x, p.z);
  for(const [lx, lz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]){ const ax = lx * D.x, az = lz * D.z; y = Math.min(y, heightAt(p.x + ax * c + az * sn, p.z - ax * sn + az * c)); } return y; }
// a lava pit: live melt inside its ring, a warm glow round it, and it burns like any pool (world/lava.js)
function lavaPit(p, gy){ const r = sceneDims(p.k, p.s).x * M(p.k).lava, y = gy + 0.35, g = new THREE.CircleGeometry(r, 48); g.rotateX(-Math.PI / 2);
  const melt = new THREE.Mesh(g, LAVA.mat || (LAVA.mat = magmaMat({ hot:0.06 }))); melt.position.set(p.x, y, p.z); arena.add(melt); LAND.meshes.push(melt);
  const glow = groundGlowMesh(0xff4a10, 0.16); glow.scale.setScalar(r * 3); glow.position.set(p.x, y + 0.1, p.z); arena.add(glow); LAND.meshes.push(glow);
  LAVA.pools.push({ x:p.x, z:p.z, r, y, glow }); }

// Z375 the enemy fuel depot's tanks (world/supply.js, built after this set, in the same pass): the riveted steel tank scan in place of the drawn
//   cylinder — inside the tank's own group, so its hits, its fire and its blast are untouched (the drawn one is hidden, it still carries the shape)
function realSupply(gen){ if(gen !== GEN) return; for(const b of blocks){ if(b.kind === 'radartower' && b.mesh && !b.mesh.userData.real && !MOBILE){ b.mesh.userData.real = true; realRadar(b, gen); continue; }
    const yk = SCENERY.supply.yard[b.kind]; if(yk && b.mesh && !b.mesh.userData.real){ b.mesh.userData.real = true; b.mesh.traverse(o => { if(o.isMesh) o.visible = false; });   // Z425 the radar yard's pieces: the radome on its tower, the shelter, the radar truck, the generator, the dishes
      const s = b.mesh.userData.s || 1, m = scenePiece(yk, s); m.scale.setScalar(s); b.mesh.add(m); continue; }
    if(b.kind === 'pumphouse' && b.mesh && !b.mesh.userData.real){ b.mesh.userData.real = true; b.mesh.traverse(o => { if(o.isMesh) o.visible = false; });   // Z420 the fuel store: the weathered platform scan
      const s = SCENERY.supply.depot.w / M('fuel_depot').w, m = scenePiece('fuel_depot', s); m.scale.setScalar(s); b.mesh.add(m); continue; }
    if(b.kind !== 'fueltank' || !b.mesh || b.mesh.userData.real) continue; b.mesh.userData.real = true;
    b.mesh.traverse(o => { if(o.isMesh) o.visible = false; }); const s = SCENERY.supply.fueltank.h / M('tank_steel').h, m = scenePiece('tank_steel', s); m.scale.setScalar(s); m.rotation.y = Math.random() * Math.PI * 2; b.mesh.add(m); } }
// a level's geometry as plain floats, carried through a transform (the files are quantized: positions int16 under the node's scale)
const _fv = new THREE.Vector3(), _fn = new THREE.Matrix3();
function floatGeo(L, M4){ const g = L.geo, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, n = P.count, p = new Float32Array(n * 3), q = new Float32Array(n * 3), t = new Float32Array(n * 2); _fn.getNormalMatrix(M4);
  for(let i = 0; i < n; i++){ _fv.fromBufferAttribute(P, i).applyMatrix4(M4); p[i * 3] = _fv.x; p[i * 3 + 1] = _fv.y; p[i * 3 + 2] = _fv.z; _fv.fromBufferAttribute(N, i).applyMatrix3(_fn).normalize(); q[i * 3] = _fv.x; q[i * 3 + 1] = _fv.y; q[i * 3 + 2] = _fv.z;
    t[i * 2] = U.getX(i); t[i * 2 + 1] = U.getY(i); }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.BufferAttribute(p, 3)); o.setAttribute('normal', new THREE.BufferAttribute(q, 3)); o.setAttribute('uv', new THREE.BufferAttribute(t, 2));
  o.setIndex(new THREE.BufferAttribute(Uint32Array.from(g.index.array), 1)); o.computeBoundingBox(); o.computeBoundingSphere(); return o; }
// the triangles of a float geometry whose centre passes a test, compacted (then shifted by -dx, -dy, -dz)
function subGeo(g, keep, dx = 0, dy = 0, dz = 0){ const P = g.attributes.position.array, N = g.attributes.normal.array, T = g.attributes.uv.array, I = g.index.array, re = new Int32Array(P.length / 3).fill(-1), idx = [];
  let n = 0; for(let i = 0; i < I.length; i += 3){ const a = I[i], b = I[i + 1], c = I[i + 2]; if(!keep((P[a * 3] + P[b * 3] + P[c * 3]) / 3, (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) / 3, (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3)) continue;
    for(const v of [a, b, c]){ if(re[v] < 0) re[v] = n++; idx.push(re[v]); } }
  if(!idx.length) return null; const p = new Float32Array(n * 3), q = new Float32Array(n * 3), t = new Float32Array(n * 2);
  for(let v = 0; v < re.length; v++){ const r = re[v]; if(r < 0) continue; p[r * 3] = P[v * 3] - dx; p[r * 3 + 1] = P[v * 3 + 1] - dy; p[r * 3 + 2] = P[v * 3 + 2] - dz; q.set(N.subarray(v * 3, v * 3 + 3), r * 3); t.set(T.subarray(v * 2, v * 2 + 2), r * 2); }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.BufferAttribute(p, 3)); o.setAttribute('normal', new THREE.BufferAttribute(q, 3)); o.setAttribute('uv', new THREE.BufferAttribute(t, 2));
  o.setIndex(new THREE.BufferAttribute(Uint32Array.from(idx), 1)); o.computeBoundingBox(); o.computeBoundingSphere(); return o; }
// a model stood on its foot at the origin, centred, h tall (rot: turned about Y first) — as plain floats
function standing(L, h, rot){ _b.copy(L.geo.boundingBox).applyMatrix4(L.m4); _b.getSize(_s); _b.getCenter(_c); const f = h / _s.y;
  const M4 = new THREE.Matrix4().makeRotationY(rot || 0).multiply(new THREE.Matrix4().makeScale(f, f, f)).multiply(new THREE.Matrix4().makeTranslation(-_c.x, -_b.min.y, -_c.z)).multiply(L.m4); return floatGeo(L, M4); }

// Z384 THE RADAR STATION'S TOWER (world/supply.js + radar.js): the scanned dish on its lattice in place of the drawn tower — split where the dish
//   begins (SCENERY.supply.radar.split of its height): the lattice stands in the tower, the dish rides in the tower's turning head (it sweeps with
//   it, round the lattice's own axis), the drawn pieces hidden; it topples and burns as before
const RAD = {};
function radarParts(){ if(RAD.p) return RAD.p; const C = SCENERY.supply.radar;
  return (RAD.p = sceneLevel(C.k || 'radar_dish', MOBILE ? 'm' : C.lv).then(L => {   // (Z422 the lattice radar tower: its array turns)   // (Z392 phones take the light copy, as every other piece)
    if(!L) return null; const g = standing(L, C.h), P = g.attributes.position.array, sy = C.split * C.h; let ax = 0, az = 0, k = 0;
    for(let i = 0; i < P.length; i += 3) if(P[i + 1] > sy * 0.75 && P[i + 1] < sy){ ax += P[i]; az += P[i + 2]; k++; } ax /= k || 1; az /= k || 1;   // (the lattice's axis, just under the dish)
    return { base:subGeo(g, (x, y) => y <= sy, ax, 0, az), dish:subGeo(g, (x, y) => y > sy, ax, 0, az), mat:L.mat }; })); }
function realRadar(b, gen){ radarParts().then(R => { if(!R || gen !== GEN || !b.mesh) return; const g = b.mesh, head = g.userData.head; g.traverse(o => { if(o.isMesh) o.visible = false; });
    const base = new THREE.Mesh(R.base, R.mat), C = SCENERY.supply.radar; base.castShadow = base.receiveShadow = true; g.add(base);
    if(head){ base.position.set(head.position.x, 0, head.position.z); const dish = new THREE.Mesh(R.dish, R.mat); dish.position.y = -head.position.y; dish.castShadow = dish.receiveShadow = true; head.add(dish); }
    else g.add(new THREE.Mesh(R.dish, R.mat)); }); }

// Z385 THE RUINED BRICK WALLS (world/brick-walls.js) in the scanned breached wall's stone: the scan stood SCENERY.bricks.h tall, turned along the
//   sections, cut into 3 m slices and each slice into the walls' collapse bands — every section takes one slice, band for band, so it still loses its
//   top courses, then its middle, then goes over as before (desktop; phones keep the drawn bricks)
const BRK = {};
function brickSlices(){ if(BRK.p) return BRK.p; const C = SCENERY.bricks;
  return (BRK.p = sceneLevel('wall_breach', C.lv).then(L => { if(!L) return null; const g = standing(L, C.h, Math.PI / 2); g.computeBoundingBox(); const z0 = g.boundingBox.min.z, z1 = g.boundingBox.max.z, out = [];
    // how much of a slice is wall: its face (the side facing across, x) rasterised over a 3 m × h grid — the breach and the ragged ends score low
    const P = g.attributes.position.array, I = g.index.array, NZ = 120, NY = 30, cell = new Uint8Array(Math.ceil((z1 - z0) / 3 * NZ) * NY), cz = (z1 - z0) / (cell.length / NY);
    for(let i = 0; i < I.length; i += 3){ const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3; const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; if(Math.abs(nx) < 0.5 * Math.hypot(nx, ny, nz)) continue;
      const zs = [P[a + 2], P[b + 2], P[c + 2]], ys = [P[a + 1], P[b + 1], P[c + 1]], za = Math.floor((Math.min(...zs) - z0) / cz), zb = Math.floor((Math.max(...zs) - z0) / cz), ya = Math.floor(Math.min(...ys) / C.h * NY), yb = Math.floor(Math.max(...ys) / C.h * NY);
      for(let q = Math.max(0, za); q <= zb && q < cell.length / NY; q++) for(let r = Math.max(0, ya); r <= Math.min(NY - 1, yb); r++) cell[q * NY + r] = 1; }
    const fill = o => { const qa = Math.max(0, Math.floor((o - 1.5 - z0) / cz)), qb = Math.min(cell.length / NY, Math.ceil((o + 1.5 - z0) / cz)); let s = 0; for(let q = qa; q < qb; q++) for(let r = 0; r < NY; r++) s += cell[q * NY + r]; return s / ((qb - qa) * NY || 1); };
    const cand = []; for(let o = z0 + 1.5; o <= z1 - 1.5; o += 0.1) cand.push([o, fill(o)]); cand.sort((a, b) => b[1] - a[1]);
    const picks = []; for(const [o, f] of cand){ if(picks.length >= C.slices || f < C.fill) break; if(picks.every(q => Math.abs(q - o) > 0.45)) picks.push(o); }
    if(!picks.length) picks.push(cand[0][0]); const band = (y, i) => i === 0 ? y < WALL_BANDS[0] : i === 1 ? y >= WALL_BANDS[0] && y < WALL_BANDS[1] : y >= WALL_BANDS[1];
    for(const o of picks) out.push([0, 1, 2].map(i => subGeo(g, (x, y, z) => z >= o - 1.5 && z < o + 1.5 && band(y, i), 0, 0, o))); SCENE.brickFill = picks.map(o => +fill(o).toFixed(2));
    g.dispose(); return { slices:out, mat:L.mat }; })); }
function realBricks(gen){ if(MOBILE || !blocks.some(b => b.kind === 'brick')) return; brickSlices().then(W => { if(!W || gen !== GEN) return; let k = 0;
    for(const b of blocks){ if(b.kind !== 'brick' || !b.wall || b.dead || b.mesh.userData.real) continue; b.mesh.userData.real = true; const sl = W.slices[(k++ * 7 + 3) % W.slices.length];
      b.wall.bands.forEach((m, i) => { if(!m) return; if(sl[i]){ m.geometry = sl[i]; m.material = W.mat; } else m.visible = false; }); } }); }

// Z386 THE CITY'S STREET FURNITURE FOR REAL (world/city.js): the concrete power poles that carry the sagging lines become the scanned transformer
//   pole (lamp arm, transformer can, crossarm — one instanced draw, still toppling with its wires), and roofs get their water tanks and masts
//   (a tank on SCENERY.city.roof.tank.share of the tube houses and flats, a mast on the taller flats and towers; gone when their top floor goes)
function realCity(gen){ if(BIOME.name !== 'CITY') return; const C = SCENERY.city, ims = new Set(); for(const c of crushables) if(c.kind === 'topple' && c.T && c.T.pole && c.im) ims.add(c.im);
  if(ims.size) sceneLevel('power_pole', MOBILE ? 'm' : C.pole.lv).then(L => { if(!L || gen !== GEN) return; const g = standing(L, C.pole.h); for(const im of ims){ im.geometry = g; im.material = L.mat; im.computeBoundingSphere(); } });
  if(!MOBILE) loadRealCity().then(() => { if(gen === GEN) cityRoofs(); }); }   // (after the city has stood its real buildings: they wait for the same load)
function cityRoofs(){ const C = SCENERY.city; for(const Bd of cityBuildings()){ const top = Bd.top, f = Bd.floors[top]; if(!f || Bd.dead || Bd.roofed) continue; Bd.roofed = true;
    for(const [key, R] of [['tank_water', C.roof.tank], ['neon_tower', C.roof.mast]]){ if(!R.kinds.includes(Bd.kind) || Bd.floors.length < (R.minFloors || 0) || Math.random() > R.share) continue;
      const s = R.h / M(key).h, c = Math.cos(Bd.ry), sn = Math.sin(Bd.ry), lx = (Math.random() - 0.5) * Bd.w * 0.4, lz = -Bd.d * R.back, x = Bd.x + lx * c + lz * sn, z = Bd.z - lx * sn + lz * c;
      const lod = scenePiece(key, s, { shadow:true }); lod.position.set(x, f.y1 - R.sink, z); lod.rotation.y = Bd.ry + Math.random() * Math.PI * 2; lod.scale.setScalar(s); lod.watch = () => Bd.dead || Bd.top < top;
      arena.add(lod); LAND.meshes.push(lod); break; } } }
export function buildSceneSet(){ GEN++; SCENE.pieces.length = 0; WONDER.a0 = null; const B = SCENERY.on && SCENERY.biomes[BIOME.name];
  if(typeof window === 'undefined' || /noscene/.test(location.search + location.hash)) return; const gen = GEN; if(SCENERY.on) Promise.resolve().then(() => { realSupply(gen); realBricks(gen); realCity(gen); });   // (once this pass has built the depots, the walls, the city's poles)
  if(!B) return;
  { const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.2, R = Math.min(ARENA - 14, fieldR(a) + 40); WONDER.a0 = a; WK.a = a; WK.x = Math.cos(a) * R; WK.z = Math.sin(a) * R; WK.r = (SCENERY.wonderR[BIOME.name] ?? SCENERY.wonderR._); }   // the wonder's bearing, chosen here so the set is composed round it (world/wonders.js stands it there)
  for(const p of plan(B)){ const lod = scenePiece(p.k, p.s, { shadow:!p.far, top:p.top }), gy = footY(p); lod.position.set(p.x, gy, p.z); lod.rotation.y = p.ry; lod.scale.setScalar(p.s);
    arena.add(lod); LAND.meshes.push(lod); SCENE.pieces.push({ ...p, lod, y:gy }); solids(p, lod, gy);
    if(M(p.k).lava) Promise.resolve().then(() => { if(gen === GEN && BIOME.name === 'VOLCANO') lavaPit(p, gy); }); } }   // (after this stage's lava is laid: buildLava clears the pools first)

// Z423 one piece stood by another builder (world/defense.js: a curtain wall, a hedgerow tree, a lava crater, a pillbox): the same as a beat's — its
//   levels, its foot on the ground, its solids, its lava — and listed with the set (it goes with the land at the next stage)
export function placeScene(k, x, z, ry, s = 1, o = {}){ if(typeof window === 'undefined' || !SCENERY.on || !M(k)) return null; const p = { k, x, z, ry, s, r:fr(k, s), solid:o.solid, def:true };
  const lod = scenePiece(k, s, { shadow:true, tone:o.tone }), gy = footY(p); lod.position.set(x, gy, z); lod.rotation.y = ry; lod.scale.setScalar(s);
  arena.add(lod); LAND.meshes.push(lod); SCENE.pieces.push({ ...p, lod, y:gy }); solids(p, lod, gy);
  if(M(k).lava){ const gen = GEN; Promise.resolve().then(() => { if(gen === GEN && BIOME.name === 'VOLCANO') lavaPit(p, gy); }); }
  return p; }

// ---------------------------------------------------------------------------------------------------------------------------------------
// Z383 THE HORIZON FOR REAL (desktop; world/horizon.js hands over its group): the scanned summits, cones and crags stand between its ranges (the
//   near range hides their feet), forests line the near hills, the ruined city and the works ring the field where the hazed boxes stood. One
//   instanced mesh per model, lit by the sun, veiled toward the fog by its distance (the same veil as the city skyline), no shadows, never culled.
const _hm = new THREE.Matrix4(), _hq = new THREE.Quaternion(), _hv = new THREE.Vector3(), _hs = new THREE.Vector3(), _hu = new THREE.Vector3(0, 1, 0);
// a model stood on its foot at the origin, centred, 1 m tall (U), with its proportions — a scene scan's copy, or one of the war's ruins (models.js)
function unitLevel(k, lv){ const src = k.startsWith('ruin_') ? loadGLTF(k).then(gl => { if(!gl) return null; let m = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if(o.isMesh && !m) m = o; });
    if(!m) return null; if(!m.geometry.boundingBox) m.geometry.computeBoundingBox(); return { geo:m.geometry, mat:m.material, m4:m.matrixWorld.clone() }; }) : sceneLevel(k, lv);
  return src.then(L => { if(!L) return null; _b.copy(L.geo.boundingBox).applyMatrix4(L.m4); _b.getSize(_s); _b.getCenter(_c);
    const U = new THREE.Matrix4().makeScale(1 / _s.y, 1 / _s.y, 1 / _s.y).multiply(new THREE.Matrix4().makeTranslation(-_c.x, -_b.min.y, -_c.z)).multiply(L.m4); return { ...L, U, wx:Math.max(_s.x, _s.z) / _s.y }; }); }
function hazeMat(src, amt, fogC){ const m = src.clone(), hz = { value:amt }, hc = { value:fogC.clone() }; m.fog = false;
  m.onBeforeCompile = sh => { sh.uniforms.hzAmt = hz; sh.uniforms.hzCol = hc; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float hzAmt; uniform vec3 hzCol;').replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.rgb = mix(gl_FragColor.rgb, hzCol, hzAmt);'); };
  m.customProgramCacheKey = () => 'skylineHaze'; return m; }
// lay this land's horizon into g (round R0, the horizon's base radius); true when it brings its own skyline (the boxes are not wanted)
export function realHorizon(g, name, R0, fogC){ let P = SKYLINE.on && !MOBILE && SKYLINE.biomes[name]; if(typeof P === 'string') P = SKYLINE.biomes[P]; if(!P || typeof window === 'undefined') return false;
  const Z = SKYLINE.haze;
  for(const e of P.set){ const lv = e.lv || (M(e.k) && M(e.k).one ? 'd' : 'l'), list = [], a0 = Math.random() * Math.PI * 2, mid = (e.r[0] + e.r[1]) / 2, hz = e.hz ?? Z[0] + (Z[1] - Z[0]) * Math.min(1, Math.max(0, (mid + 10) / 100));
    for(let i = 0; i < e.n; i++) list.push([a0 + (i + 0.15 + Math.random() * 0.7) / e.n * Math.PI * 2, R0 + rnd(e.r[0], e.r[1]), e.h ? rnd(e.h[0], e.h[1]) : rnd(e.w[0], e.w[1]), Math.random() * Math.PI * 2]);
    unitLevel(e.k, lv).then(L => { if(!L || HZN.g !== g) return; const im = new THREE.InstancedMesh(L.geo, hazeMat(L.mat, hz, fogC), list.length);
      list.forEach(([a, r, sz, ry], i) => { const h = e.h ? sz : sz / L.wx; _hm.compose(_hv.set(Math.cos(a) * r, e.y ?? SKYLINE.y, Math.sin(a) * r), _hq.setFromAxisAngle(_hu, ry), _hs.set(h, h, h)); im.setMatrixAt(i, _hm.multiply(L.U)); });
      im.instanceMatrix.needsUpdate = true; im.renderOrder = -7; im.userData.skyline = e.k; g.add(sectorize(im, SKYLINE.arcs, M(e.k) && M(e.k).one ? 0 : SKYLINE.keep)); }); }   // Z412 culled by arc, simplified past the field
  return !!P.skyline; }
