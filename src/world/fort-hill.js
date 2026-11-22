// world/fort-hill.js — Z453 CASTLES ON CRAGS (config FORTHILL, the limestone quarry first): every fort stands on a rocky hill — sheer flanks behind, a gentler shoulder toward its gate for the road up, crags on the slopes — its yard paved in stone; the capital an open citadel with its keep on a paved upper ward reached by a ramp, all of it ground that men and tanks drive up and fight on
import * as THREE from 'three';
import { FORTHILL } from '../../config.js';
import { ARENA, BIOME, HF, MOBILE, ZONES, _R, blocks, buildPerimeter, crushables, dressRock, heightAt, inField, rockSet, scene, sceneDims, scenePiece } from '../hub.js';

export const PAVED = [];   // { x, z, r } the paved yards and wards (trails.js keeps grass and loose stones off them, decals.js paints them into the contact map)
const _Z = new THREE.Matrix4().makeScale(0, 0, 0), PAVE = { mat:null, meshes:[], rocks:[] };
export const hillCfg = () => (FORTHILL.on && FORTHILL.biomes[BIOME.name]) || null;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rag = (a, s) => Math.sin(a * 3 + s) * 0.5 + Math.sin(a * 7 + s * 2.3) * 0.3 + Math.sin(a * 13 + s * 0.7) * 0.2;   // a ragged footprint round the hill
const span = (v, r) => [Math.max(0, Math.floor((v - r + ARENA) / HF.step)), Math.min(HF.N, Math.ceil((v + r + ARENA) / HF.step))];
function dirty(j0, j1){ HF.dj0 = Math.min(HF.dj0 ?? 1e9, j0 - 1); HF.dj1 = Math.max(HF.dj1 ?? -1, j1 + 1); HF.dirty = true; }

// planForts has placed the forts: a crag under each, before anything else is laid on the field (it all finds the new ground)
export function raiseFortHills(forts){ PAVED.length = 0; _HILLS.length = 0; for(const m of PAVE.meshes){ if(m.parent) m.parent.remove(m); m.geometry.dispose(); } for(const m of PAVE.rocks) if(m.parent) m.parent.remove(m); PAVE.meshes.length = PAVE.rocks.length = 0; const C = hillCfg(); if(!C || !forts.length) return;
  const W = HF.W, h = HF.h, st = HF.step;
  for(const f of forts){ const H = C.h[f.tier === 3 ? 0 : f.tier === 2 ? 1 : 2], top = f.R + C.top, base = C.base * (f.tier === 3 ? 1 : 0.8), ga = Math.atan2(ARENA * 0.55 - f.z, -f.x), s = Math.random() * 9;
    f.hillH = H; f.hillGa = ga; _HILLS.push(f); const R = top + base * (1 + C.ramp) * (1 + C.rag) + 2, [i0, i1] = span(f.x, R), [j0, j1] = span(f.z, R);
    for(let j = j0; j <= j1; j++) for(let i = i0; i <= i1; i++){ const x = -ARENA + i * st, z = -ARENA + j * st, dx = x - f.x, dz = z - f.z, d = Math.hypot(dx, dz); if(d > R) continue;
      const a = Math.atan2(dz, dx), fr = Math.max(0, Math.cos(a - ga)), b = base * (1 + C.ramp * fr * fr) * (C.cliff + (1 - C.cliff) * fr) * (1 + C.rag * rag(a, s)), k = 1 - sm(top, top + b, d); if(k <= 0) continue;   // gentle toward the gate, sheer behind
      h[j * W + i] += H * k + C.crag * (Math.sin(x * 0.21 + s) * Math.sin(z * 0.17 - s) + Math.sin((x + z) * 0.43)) * k * (1 - k) * 4; }   // (ledges on the flanks)
    dirty(j0, j1);
    for(const c of crushables) if(c.alive && c.im && Math.hypot(c.x - f.x, c.z - f.z) < R){ c.im.setMatrixAt(c.k, _Z); c.im.instanceMatrix.needsUpdate = true; c.alive = false; }   // (the loose stones and tufts laid on the old ground)
    const Z = ZONES.find(q => q.fort === f); if(Z) Z.r = Math.max(Z.r, top + base * 0.7); }
  buildPerimeter(BIOME, true);   // the fence and the rocks beyond it on the new ground
  crags(forts, C); }

// the flanks: photographed cliffs (FORTHILL.cliffs) and rocks of the land's stone jutting out (thicker on the sheer side, none on the road up), solid
function crags(forts, C){ const rs = rockSet(BIOME.name);
  for(const f of forts){ const no = Math.round(C.outcrops * (f.tier === 3 ? 1 : 0.5) * (MOBILE ? 0.6 : 1)), tone = new THREE.Color().setRGB(...(C.tone || [1, 1, 1]));   // the flanks: photographed cliffs breaking through, the sheer side most, half buried, faces turned out
    for(let t = 0, k = 0; t < no * 8 && k < no; t++){ const key = C.cliffs[k % C.cliffs.length], D = sceneDims(key), back = Math.random() < 0.7, a = f.hillGa + (back ? Math.PI + _R(-1.4, 1.4) : _R(-2.6, 2.6)), off = Math.abs(Math.atan2(Math.sin(a - f.hillGa), Math.cos(a - f.hillGa)));
      if(off < C.roadA + 0.25) continue; const d = f.R + C.top + _R(1, C.base * (back ? 0.4 : 0.6)), x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d, sc = Math.max(0.35, f.hillH * _R(C.outS[0], C.outS[1]) / D.y);
      if(Math.max(Math.abs(x), Math.abs(z)) > ARENA - 3 || PAVE.rocks.some(q => Math.hypot(q.position.x - x, q.position.z - z) < Math.max(D.x, D.z) * sc * 0.35)) continue;   // (past the fence too: the crag's far side is part of the view)
      const m = scenePiece(key, sc, { tone }); m.scale.setScalar(sc); m.position.set(x, heightAt(x, z) - D.y * sc * C.outSink, z); m.rotation.y = -a + Math.PI / 2 + (Math.random() < 0.5 ? Math.PI : 0) + _R(-0.35, 0.35); scene.add(m); PAVE.rocks.push(m);
      blocks.push({ mesh:new THREE.Object3D(), x, z, r:Math.min(D.x, D.z) * sc * 0.5, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'crag' }); k++; } }
  for(const f of forts){ const n = Math.round(C.rocks * (f.tier === 3 ? 1 : 0.6) * (MOBILE ? 0.6 : 1));
    for(let t = 0, k = 0; t < n * 8 && k < n; t++){ const a = Math.random() * 6.283, off = Math.abs(Math.atan2(Math.sin(a - f.hillGa), Math.cos(a - f.hillGa))); if(off < C.roadA) continue;
      const back = off > 1.6, d = f.R + C.top + _R(5, C.base * (back ? 0.45 : 0.85)), x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d; if(Math.max(Math.abs(x), Math.abs(z)) > ARENA - 3 || blocks.some(b => b.kind === 'crag' && Math.hypot(b.x - x, b.z - z) < b.r + 3)) continue;
      const r = _R(C.rock[0], C.rock[1]) * (back ? 1.25 : 1), m = dressRock(new THREE.Mesh(rs.big[(Math.random() * rs.big.length) | 0], rs.mat), BIOME.name);
      m.scale.set(r * _R(1, 1.5), r * _R(0.8, 1.4), r * _R(1, 1.4)); m.position.set(x, heightAt(x, z) - r * 0.3, z); m.rotation.set(_R(-0.3, 0.3), Math.random() * 6.28, _R(-0.3, 0.3)); m.castShadow = m.receiveShadow = true; scene.add(m);
      blocks.push({ mesh:m, x, z, r:r * 1.15, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'crag' }); k++; } } }

// the capital's upper ward: a raised, paved terrace round its keep (opposite the gate), a ramp down toward the gate (called once the fort's yard is levelled)
export function raiseWard(f){ const C = hillCfg(); if(!C || !C.ward || f.tier !== 3) return null; const Wd = C.ward, W = HF.W, h = HF.h, st = HF.step, ux = Math.cos(f.hillGa ?? 0), uz = Math.sin(f.hillGa ?? 0);
  const dd = f.Rin ? f.Rin * 0.42 : f.R * Wd.at, cx = f.x - ux * dd, cz = f.z - uz * dd, base = heightAt(cx, cz), R = Wd.r + Wd.rampL + 4, [i0, i1] = span(cx, R), [j0, j1] = span(cz, R);
  for(let j = j0; j <= j1; j++) for(let i = i0; i <= i1; i++){ const x = -ARENA + i * st, z = -ARENA + j * st, dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
    const al = dx * ux + dz * uz, ac = Math.abs(dz * ux - dx * uz), mound = 1 - sm(Wd.r, Wd.r + Wd.edge, d), ramp = al > 0 && ac < Wd.rampW / 2 ? Math.max(0, 1 - Math.max(0, al - Wd.r) / Wd.rampL) : 0, k = Math.max(mound, ramp);
    if(k > 0) h[j * W + i] = Math.max(h[j * W + i], base + Wd.h * k); }
  dirty(j0, j1); return (f.ward = { x:cx, z:cz, r:Wd.r, h:Wd.h, lx:cx - f.x, lz:cz - f.z }); }

// a yard paved in stone: a mesh draped over the ground (a grid inside r), the photographed flagstones repeated every tile m
function paveMat(){ if(PAVE.mat) return PAVE.mat; const C = hillCfg(), L = new THREE.TextureLoader(), d = 'assets/models/real/fortkit/pave/', m = new THREE.MeshStandardMaterial({ color:new THREE.Color().setRGB(...(C.paveTint || [1, 1, 1])), roughness:1, metalness:0, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 });
  const t = (f, srgb, set) => L.loadAsync(d + f).then(x => { x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = MOBILE ? 4 : 8; x.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; set(x); m.needsUpdate = true; }).catch(() => {});
  t('diff.jpg', true, x => { m.map = x; }); t('nor.jpg', false, x => { m.normalMap = x; }); t('arm.jpg', false, x => { m.roughnessMap = x; });
  return (PAVE.mat = m); }
export function paveYard(f, x0, z0, r){ const C = hillCfg(); if(!C || typeof window === 'undefined') return; const step = MOBILE ? 2.2 : 1.4, n = Math.ceil(r / step), P = [], U = [], idx = [], at = {};
  for(let j = -n; j <= n; j++) for(let i = -n; i <= n; i++){ const x = i * step, z = j * step; if(Math.hypot(x, z) > r + step) continue; const k = P.length / 3; at[i + ',' + j] = k;
    const wx = x0 + Math.min(1, r / (Math.hypot(x, z) || 1)) * x, wz = z0 + Math.min(1, r / (Math.hypot(x, z) || 1)) * z; P.push(wx, heightAt(wx, wz) + 0.06, wz); U.push(wx / C.paveTile, wz / C.paveTile); }
  for(let j = -n; j < n; j++) for(let i = -n; i < n; i++){ const a = at[i + ',' + j], b = at[(i + 1) + ',' + j], c = at[i + ',' + (j + 1)], d = at[(i + 1) + ',' + (j + 1)]; if(a == null || b == null || c == null || d == null) continue;
    const ys = [a, b, c, d].map(q => P[q * 3 + 1]); if(Math.max(...ys) - Math.min(...ys) > step * C.paveSteep) continue; idx.push(a, c, b, b, c, d); }   // (no flagstones up a steep face: the ward's revetment is rock)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, paveMat()); m.receiveShadow = true; m.renderOrder = 1; scene.add(m); PAVE.meshes.push(m); if(f){ (f.paved || (f.paved = [])).push(m); } PAVED.push({ x:x0, z:z0, r }); return m; }
export const onPaved = (x, z) => PAVED.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < p.r * p.r);
// boulders and rock clusters along the tracks (FORTHILL.road): on the verges, thicker where a track climbs a fort's hill — the road up between rocks
export function roadRocks(paths){ const C = hillCfg(); if(!C || !C.road || typeof window === 'undefined') return; const tone = new THREE.Color().setRGB(...(C.tone || [1, 1, 1])), cap = MOBILE ? 24 : 70; let n = 0;
  for(const P of paths){ for(let i = 3; i < P.pts.length - 3 && n < cap; i++){ const [x, z] = P.pts[i], hill = (P.hill = P.hill || {})[i] ?? hillAt(x, z), rate = C.roadN * (hill ? 3 : 1);
      if(Math.random() > rate) continue; const [x0, z0] = P.pts[i - 1], [x1, z1] = P.pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0) || 1, nx = -(z1 - z0) / L, nz = (x1 - x0) / L, sd = Math.random() < 0.5 ? -1 : 1, K = Math.random() < 0.6 ? 0 : 1, key = C.road[K], D = sceneDims(key);
      const sc = _R(C.roadS[K][0], C.roadS[K][1]) * (hill ? 1.3 : 1), u = sd * (P.w / 2 + 0.6 + Math.max(D.x, D.z) * sc * 0.5 + _R(0, 1.5)), px = x + nx * u, pz = z + nz * u; if(!inField(px, pz, 1.5) || onPaved(px, pz)) continue;
      const m = scenePiece(key, sc, { tone }); m.scale.setScalar(sc); m.position.set(px, heightAt(px, pz) - D.y * sc * 0.15, pz); m.rotation.y = Math.random() * 6.28; scene.add(m); PAVE.rocks.push(m);
      blocks.push({ mesh:new THREE.Object3D(), x:px, z:pz, r:Math.max(D.x, D.z) * sc * 0.42, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'crag' }); n++; } } }
const hillAt = (x, z) => _HILLS.some(f => Math.hypot(f.x - x, f.z - z) < f.R + 40);
const _HILLS = [];
