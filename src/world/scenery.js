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
import { SCENERY, SKYLINE } from '../../config.js';
import { ARENA, BIOME, FORTS, HZN, LAND, LAVA, MOBILE, WONDER, ZONES, arena, blendIn, blocks, fieldR, groundGlowMesh, heightAt, inField, inZone, loadGLTF, magmaMat } from '../hub.js';

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
// the transform that stands a model on its foot at the origin, centred, at its config size (one per model: every level shares it, so nothing jumps)
const _b = new THREE.Box3(), _s = new THREE.Vector3(), _c = new THREE.Vector3();
function norm(k, L){ if(NORM[k]) return NORM[k]; _b.copy(L.geo.boundingBox).applyMatrix4(L.m4); _b.getSize(_s); _b.getCenter(_c); const C = M(k), f = C.h ? C.h / _s.y : C.w / Math.max(_s.x, _s.z);
  const N = new THREE.Matrix4().makeScale(f, f, f).multiply(new THREE.Matrix4().makeTranslation(-_c.x, -_b.min.y - (C.sink || 0) * _s.y, -_c.z)); return (NORM[k] = { N }); }
// a piece: its levels swap with the distance; the near (whole) one is fetched once the camera comes close
const _cp = new THREE.Vector3(), _op = new THREE.Vector3();
export class SceneLOD extends THREE.LOD {
  constructor(k, o = {}){ super(); this.key = k; this.lv = {}; this.mat = o.mat || null; this.shadow = o.shadow ?? true; this.dist = o.dist || [40, 120]; this.nearAt = o.nearAt || 0; this.asked = false; this.onLevel = o.onLevel || null; }
  update(cam){ if(this.levels.length > 1) super.update(cam);
    if(this.nearAt && !this.asked){ _cp.setFromMatrixPosition(cam.matrixWorld); _op.setFromMatrixPosition(this.matrixWorld); if(_cp.distanceToSquared(_op) < this.nearAt * this.nearAt){ this.asked = true; sceneLevel(this.key, 'd').then(L => L && this.put('d', L)); } } }
  put(lv, L){ if(this.lv[lv] || !L) return; const n = norm(this.key, L), m = new THREE.Mesh(L.geo, this.mat || L.mat); if(this.mat && (lv === 'd' || !this.mat.map)) takeMaps(this.mat, L.mat); m.matrixAutoUpdate = false; m.matrix.multiplyMatrices(n.N, L.m4);
    m.castShadow = this.shadow; m.receiveShadow = true; this.lv[lv] = m; for(const q of this.levels) this.remove(q.object); this.levels.length = 0;
    [['d', 0], ['l', this.dist[0]], ['f', this.dist[1]], ['m', 0]].filter(([v]) => this.lv[v]).forEach(([v, d], i) => this.addLevel(this.lv[v], i ? d : 0, SCENERY.lod.hys));
    if(this.onLevel) this.onLevel(lv, m); } }
// a piece with a material of its own (a tower fades and flashes alone): it wears the scan's maps once they are in (the sharper ones when the near level comes)
function takeMaps(to, from){ for(const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) to[k] = from[k]; to.color.copy(from.color); to.emissive.copy(from.emissive);
  to.roughness = from.roughness; to.metalness = from.metalness; to.envMapIntensity = from.envMapIntensity; to.needsUpdate = true; }
// Z375 a watchtower / water tower of world/tower-kinds.js: the scan stood in the tower's body (it topples with it), its own material returned for the fade
export function towerModel(body, K){ const mat = new THREE.MeshStandardMaterial({ color:0x8a8a84, roughness:0.8 }); mat.userData.own = true; blendIn(mat); body.add(scenePiece(K.model, 1, { mat })); return mat; }
// a piece ready to stand somewhere (its levels fetched in the background): the light ones now, the near one when it is wanted
export function scenePiece(k, s = 1, o = {}){ const C = M(k), D = sceneDims(k, s), R = Math.max(D.x, D.y, D.z) / 2, Z = SCENERY.lod;
  const dist = [Math.max(Z.mid[0], Z.mid[1] * R), Math.max(Z.far[0], Z.far[1] * R)], one = !!C.one;
  const lod = new SceneLOD(k, { ...o, dist, nearAt:MOBILE || one ? 0 : dist[0] + Z.near }); lod.userData.scene = k;
  if(MOBILE) sceneLevel(k, 'm').then(L => lod.put('m', L)); else if(one) sceneLevel(k, 'd').then(L => lod.put('d', L));
  else { sceneLevel(k, 'f').then(L => lod.put('f', L)); sceneLevel(k, 'l').then(L => lod.put('l', L)); }
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
  const add = (k, x, z, ry, s, extra) => { const p = { k, x, z, ry, s, r:fr(k, s), ...extra }; placed.push(p); return p; };
  const face = (b, x, z, along) => b.face === 'rand' ? Math.random() * Math.PI * 2 : b.face === 'out' ? faceCore(x, z) + Math.PI : b.face === 'along' && along != null ? along : faceCore(x, z) + rnd(-0.18, 0.18);
  for(const b of beats){ const n = MOBILE ? Math.ceil((b.n || 1) * 0.5) : (b.n || 1), S = () => b.s ? rnd(b.s[0], b.s[1]) : 1;
    if(b.at === 'far'){ for(let t = 0; t < 40; t++){ const [a0, a1] = pick(b.a), a = rnd(a0, a1), s = S(); if(!offWonder(a)) continue; const d = fieldR(a) + rnd(b.d[0], b.d[1]) + fr(b.k, s) * 0.5, x = Math.cos(a) * d, z = Math.sin(a) * d;
        if(placed.some(p => Math.hypot(p.x - x, p.z - z) < p.r + fr(b.k, s) * 0.8)) continue; add(b.k, x, z, faceCore(x, z) + rnd(-0.6, 0.6), s, { far:true }); break; } continue; }
    if(b.at === 'edge'){ for(let t = 0; t < 60; t++){ const [a0, a1] = pick(b.a), a = rnd(a0, a1); if(!offWonder(a)) continue; const s = S(), r = fr(b.k, s), d = fieldR(a) - b.inset, x = Math.cos(a) * d, z = Math.sin(a) * d;   // (never standing in front of the wonder)
        if(!clear(x, z, r * 0.6, placed, true) || FORTS.some(f => Math.hypot(f.x - x, f.z - z) < (f.R || 30) + r + 6)) continue; const p = add(b.k, x, z, faceCore(x, z), s, { edge:true }); if(b.id) byId[b.id] = p; ZONES.push({ kind:'scenery', x, z, r:r * 0.8 }); break; } continue; }
    if(b.at === 'pair'){ const o = byId[b.of]; if(!o) continue; for(const sd of [-1, 1]){ const c = Math.cos(o.ry), sn = Math.sin(o.ry), lx = sd * b.side, lz = b.fwd, x = o.x + lx * c + lz * sn, z = o.z - lx * sn + lz * c;
        if(inField(x, z, 2)){ const q = add(b.k, x, z, o.ry, o.s || 1, { pair:true }); ZONES.push({ kind:'scenery', x, z, r:q.r + 2 }); } } continue; }
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
function solids(p, lod, gy){ const C = M(p.k).solid; if(!C) return; const D = sceneDims(p.k, p.s), c = Math.cos(p.ry), sn = Math.sin(p.ry), top = gy + D.y, out = [];
  const box = (lx, hw, hl) => out.push({ x:p.x + lx * c, z:p.z - lx * sn, r:Math.max(0.5, Math.min(hw, hl)), obb:{ f:p.ry, hl:Math.max(0.3, hl), hw:Math.max(0.3, hw) } });
  if(C.box) box(0, D.x / 2 * C.box, D.z / 2 * C.box);
  else if(C.pillars){ const w = D.x * C.pillars; for(const sd of [-1, 1]) box(sd * (D.x / 2 - w / 2), w / 2, D.z / 2 * 0.9); }
  else if(C.disc) out.push({ x:p.x, z:p.z, r:Math.max(D.x, D.z) * C.disc });
  else if(C.r) out.push({ x:p.x, z:p.z, r:C.r * p.s });
  for(const q of out) blocks.push({ mesh:lod, ...q, hp:Infinity, maxHp:Infinity, steel:true, heavy:true, loot:false, kind:'ruin', scenery:p.k, _top:top, _topHp:Infinity }); }   // (kind 'ruin': the same rules as the war's ruins — indestructible stone)
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
function realSupply(gen){ if(gen !== GEN) return; for(const b of blocks){ if(b.kind !== 'fueltank' || !b.mesh || b.mesh.userData.real) continue; b.mesh.userData.real = true;
    b.mesh.traverse(o => { if(o.isMesh) o.visible = false; }); const s = SCENERY.supply.fueltank.h / M('tank_steel').h, m = scenePiece('tank_steel', s); m.scale.setScalar(s); m.rotation.y = Math.random() * Math.PI * 2; b.mesh.add(m); } }
export function buildSceneSet(){ GEN++; SCENE.pieces.length = 0; WONDER.a0 = null; const B = SCENERY.on && SCENERY.biomes[BIOME.name];
  if(typeof window === 'undefined' || /noscene/.test(location.search + location.hash)) return; const gen = GEN; if(SCENERY.on) Promise.resolve().then(() => realSupply(gen));   // (once this pass has built the depots)
  if(!B) return;
  { const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.2, R = Math.min(ARENA - 14, fieldR(a) + 40); WONDER.a0 = a; WK.a = a; WK.x = Math.cos(a) * R; WK.z = Math.sin(a) * R; WK.r = (SCENERY.wonderR[BIOME.name] ?? SCENERY.wonderR._); }   // the wonder's bearing, chosen here so the set is composed round it (world/wonders.js stands it there)
  for(const p of plan(B)){ const lod = scenePiece(p.k, p.s, { shadow:!p.far }), gy = footY(p); lod.position.set(p.x, gy, p.z); lod.rotation.y = p.ry; lod.scale.setScalar(p.s);
    arena.add(lod); LAND.meshes.push(lod); SCENE.pieces.push({ ...p, lod, y:gy }); solids(p, lod, gy);
    if(M(p.k).lava) Promise.resolve().then(() => { if(gen === GEN && BIOME.name === 'VOLCANO') lavaPit(p, gy); }); } }   // (after this stage's lava is laid: buildLava clears the pools first)

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
      im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; im.renderOrder = -7; im.userData.skyline = e.k; g.add(im); }); }
  return !!P.skyline; }
