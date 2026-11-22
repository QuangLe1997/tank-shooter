// world/fort-hill.js — Z453 CASTLES ON CRAGS (config FORTHILL, the limestone quarry first): every fort stands on a rocky hill — sheer flanks behind, a gentler shoulder toward its gate for the road up, crags on the slopes — its yard paved in stone; the capital an open citadel with its keep on a paved upper ward reached by a ramp, all of it ground that men and tanks drive up and fight on
import * as THREE from 'three';
import { FORTHILL } from '../../config.js';
import { ARENA, BIOME, HF, MOBILE, ZONES, _R, blocks, buildPerimeter, crushables, dressRock, fieldDepth, fieldR, heightAt, inField, rockSet, scene, sceneDims, scenePiece } from '../hub.js';

export const PAVED = [];   // { x, z, r } the paved yards and wards (trails.js keeps grass and loose stones off them, decals.js paints them into the contact map)
const _Z = new THREE.Matrix4().makeScale(0, 0, 0), PAVE = { mat:null, kerb:null, meshes:[], rocks:[] };
export const hillCfg = () => (FORTHILL.on && FORTHILL.biomes[BIOME.name]) || null;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rag = (a, s) => Math.sin(a * 3 + s) * 0.5 + Math.sin(a * 7 + s * 2.3) * 0.3 + Math.sin(a * 13 + s * 0.7) * 0.2;   // a ragged footprint round the hill
const span = (v, r) => [Math.max(0, Math.floor((v - r + ARENA) / HF.step)), Math.min(HF.N, Math.ceil((v + r + ARENA) / HF.step))];
function dirty(j0, j1){ HF.dj0 = Math.min(HF.dj0 ?? 1e9, j0 - 1); HF.dj1 = Math.max(HF.dj1 ?? -1, j1 + 1); HF.dirty = true; }

// planForts has placed the forts: a crag under each, before anything else is laid on the field (it all finds the new ground)
export function raiseFortHills(forts){ PAVED.length = 0; _HILLS.length = 0; for(const m of PAVE.meshes){ if(m.parent) m.parent.remove(m); m.geometry.dispose(); } for(const m of PAVE.rocks) if(m.parent) m.parent.remove(m); PAVE.meshes.length = PAVE.rocks.length = 0; const C = hillCfg(); if(!C) return; roughen(C); if(!forts.length){ buildPerimeter(BIOME, true); return; }
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
  crags(forts, C); edgeCliffs(C); }

// Z453 RUGGED GROUND (FORTHILL.rough): the field is no smooth floor — benches of rock broken by small scarps (a stepped noise, steps over ledge m) and
//   knobs bump m high every few metres, faded out toward the fence, round our compound and at the spawn; what already lies on it (loose stones, tufts)
//   is lifted or lowered with the ground
function roughen(C){ const R = C.rough; if(!R) return; const W = HF.W, h = HF.h, st = HF.step, s = Math.random() * 50, sp = ARENA * 0.55;
  const add = (x, z) => { const fd = fieldDepth(x, z); if(fd < -2) return 0; const k = sm(-2, 8, fd) * sm(R.clear[0], R.clear[1], Math.hypot(x, z)) * sm(8, 16, Math.hypot(x, z - sp)); if(k <= 0) return 0;
    const n = Math.sin(x * 0.19 + s) * Math.sin(z * 0.23 - s) + 0.6 * Math.sin((x - z) * 0.11 + s * 0.7) + 0.4 * Math.sin(x * 0.41 + z * 0.37 + s * 1.3), q = (n * 0.25 + 0.5) * R.steps, f = q - Math.floor(q);
    return k * (R.ledge * ((Math.floor(q) + sm(R.edge, 1, f)) / R.steps - 0.5) * 2 + R.bump * Math.sin(x * 0.7 + s) * Math.sin(z * 0.63 + s * 2)); };
  for(let j = 0; j <= HF.N; j++) for(let i = 0; i <= HF.N; i++) h[j * W + i] += add(-ARENA + i * st, -ARENA + j * st);
  dirty(0, HF.N); const M = new THREE.Matrix4(), seen = new Set();
  for(const c of crushables){ if(!c.alive || !c.im) continue; const d = add(c.x, c.z); if(!d) continue; c.im.getMatrixAt(c.k, M); M.elements[13] += d; c.im.setMatrixAt(c.k, M); seen.add(c.im); }
  for(const im of seen) im.instanceMatrix.needsUpdate = true; }
// the flanks: photographed cliffs (FORTHILL.cliffs) and rocks of the land's stone jutting out (thicker on the sheer side, none on the road up), solid
function crags(forts, C){ const rs = rockSet(BIOME.name);
  for(const f of forts){ const no = Math.round(C.outcrops * (f.tier === 3 ? 1 : 0.5) * (MOBILE ? 0.6 : 1)), tone = new THREE.Color().setRGB(...(C.tone || [1, 1, 1]));   // the flanks: photographed cliffs breaking through, the sheer side most, half buried, faces turned out
    for(let t = 0, k = 0; t < no * 8 && k < no; t++){ const key = C.cliffs[k % C.cliffs.length], D = sceneDims(key), back = Math.random() < 0.7, a = f.hillGa + (back ? Math.PI + _R(-1.4, 1.4) : _R(-2.6, 2.6)), off = Math.abs(Math.atan2(Math.sin(a - f.hillGa), Math.cos(a - f.hillGa)));
      if(off < C.roadA + 0.25) continue; const d = f.R + C.top + _R(1, C.base * (back ? 0.4 : 0.6)), x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d, sc = Math.max(0.35, f.hillH * _R(C.outS[0], C.outS[1]) / D.y);
      if(Math.max(Math.abs(x), Math.abs(z)) > ARENA - 3 || PAVE.rocks.some(q => Math.hypot(q.position.x - x, q.position.z - z) < Math.max(D.x, D.z) * sc * 0.35)) continue;   // (past the fence too: the crag's far side is part of the view)
      const m = scenePiece(key, sc, { tone }); m.scale.setScalar(sc); m.position.set(x, heightAt(x, z) - D.y * sc * C.outSink, z); m.rotation.y = -a + Math.PI / 2 + (Math.random() < 0.5 ? Math.PI : 0) + _R(-0.35, 0.35); scene.add(m); PAVE.rocks.push(m);
      blocks.push({ mesh:new THREE.Object3D(), x, z, r:Math.min(D.x, D.z) * sc * 0.5, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'crag' }); k++; } }
  for(const f of forts){ const np = Math.round((C.perch ? C.perch.n : 0) * (f.tier === 3 ? 1 : 0.6) * (MOBILE ? 0.6 : 1)), tone = new THREE.Color().setRGB(...(C.tone || [1, 1, 1]));   // Z453 boulders perched on the flanks: big, barely bedded, tilted as they came to rest
    for(let t = 0, k = 0; t < np * 8 && k < np; t++){ const a = Math.random() * 6.283, off = Math.abs(Math.atan2(Math.sin(a - f.hillGa), Math.cos(a - f.hillGa))); if(off < C.roadA) continue;
      const d = f.R + C.top + _R(2, C.base * 0.75), x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d, key = C.perch.keys[(Math.random() * C.perch.keys.length) | 0], D = sceneDims(key), sc = _R(C.perch.h[0], C.perch.h[1]) / D.y;
      if(Math.max(Math.abs(x), Math.abs(z)) > ARENA - 3 || blocks.some(b => b.kind === 'crag' && Math.hypot(b.x - x, b.z - z) < b.r + Math.max(D.x, D.z) * sc * 0.5)) continue;
      const m = scenePiece(key, sc, { tone }); m.scale.setScalar(sc); m.position.set(x, heightAt(x, z) - D.y * sc * C.perch.sink, z); m.rotation.set(_R(-0.25, 0.25), Math.random() * 6.28, _R(-0.25, 0.25)); scene.add(m); PAVE.rocks.push(m);
      blocks.push({ mesh:new THREE.Object3D(), x, z, r:Math.max(D.x, D.z) * sc * 0.45, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'crag' }); k++; } }
  for(const f of forts){ const n = Math.round(C.rocks * (f.tier === 3 ? 1 : 0.6) * (MOBILE ? 0.6 : 1));
    for(let t = 0, k = 0; t < n * 8 && k < n; t++){ const a = Math.random() * 6.283, off = Math.abs(Math.atan2(Math.sin(a - f.hillGa), Math.cos(a - f.hillGa))); if(off < C.roadA) continue;
      const back = off > 1.6, d = f.R + C.top + _R(5, C.base * (back ? 0.45 : 0.85)), x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d; if(Math.max(Math.abs(x), Math.abs(z)) > ARENA - 3 || blocks.some(b => b.kind === 'crag' && Math.hypot(b.x - x, b.z - z) < b.r + 3)) continue;
      const r = _R(C.rock[0], C.rock[1]) * (back ? 1.25 : 1), m = dressRock(new THREE.Mesh(rs.big[(Math.random() * rs.big.length) | 0], rs.mat), BIOME.name);
      m.scale.set(r * _R(1, 1.5), r * _R(0.8, 1.4), r * _R(1, 1.4)); m.position.set(x, heightAt(x, z) - r * 0.3, z); m.rotation.set(_R(-0.3, 0.3), Math.random() * 6.28, _R(-0.3, 0.3)); m.castShadow = m.receiveShadow = true; scene.add(m);
      blocks.push({ mesh:m, x, z, r:r * 1.15, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'crag' }); k++; } } }

// Z453 the plateau's edge: where the land past the fence drops away (the quarry's sea cliff), great photographed rock faces stand along the drop,
//   overlapping, their tops at the plateau's lip — the castles stand over a cliff of rock, not a slope of sand (FORTHILL.edge)
function edgeCliffs(C){ const E = C.edge; if(!E) return; const tone = new THREE.Color().setRGB(...(C.tone || [1, 1, 1])); let a = Math.random() * 6.283; const a1 = a + Math.PI * 2;
  while(a < a1){ const r0 = fieldR(a), top = heightAt(Math.cos(a) * (r0 + 3), Math.sin(a) * (r0 + 3)), low = heightAt(Math.cos(a) * (r0 + 34), Math.sin(a) * (r0 + 34)), key = E.keys[(Math.random() * E.keys.length) | 0], D = sceneDims(key);
    const Hh = _R(E.h[0], E.h[1]), sc = Hh / D.y, wide = D.x * sc; if(top - low < E.drop){ a += 0.12; continue; }
    const o = _R(E.o[0], E.o[1]), x = Math.cos(a) * (r0 + o), z = Math.sin(a) * (r0 + o), m = scenePiece(key, sc, { tone, shadow:!MOBILE }); m.scale.setScalar(sc);
    m.position.set(x, top - D.y * sc * E.lip, z); m.rotation.y = -a + Math.PI / 2 + (Math.random() < 0.5 ? Math.PI : 0) + _R(-0.12, 0.12); scene.add(m); PAVE.rocks.push(m);
    a += wide * E.overlap / (r0 + o) * (MOBILE ? 1.6 : 1); } }
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
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
    #ifdef USE_MAP
    { vec3 lo = texture2D(map, mat2(0.8, 0.6, -0.6, 0.8) * vMapUv * 0.071 + 0.37).rgb, lo2 = texture2D(map, vMapUv * 0.023 + 0.71).rgb;   // Z453 slabs worn and stained unevenly: the photo itself, far coarser, as the patchwork
      diffuseColor.rgb *= mix(0.8, 1.14, smoothstep(0.15, 0.55, dot(lo, vec3(0.333)))) * mix(0.9, 1.06, smoothstep(0.2, 0.5, dot(lo2, vec3(0.333)))); }
    #endif`); };
  m.customProgramCacheKey = () => 'paveYard1';
  return (PAVE.mat = m); }
function kerbMat(){ if(PAVE.kerb) return PAVE.kerb; const m = paveMat().clone(), C = hillCfg(); m.color.multiplyScalar(C.kerbK || 0.72); m.onBeforeCompile = paveMat().onBeforeCompile; m.customProgramCacheKey = () => 'paveYard1';
  return (PAVE.kerb = m); }
// a border of bigger, darker stone round a paved yard (w m wide, its stones scale × the yard's)
function kerb(x0, z0, r, w){ const C = hillCfg(), n = Math.max(24, Math.round(Math.PI * 2 * r / 1.5)), P = [], U = [], idx = [];
  for(let i = 0; i <= n; i++){ const a = i / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    for(const [rr, v] of [[r - w, 0], [r, w]]){ const x = x0 + ca * rr, z = z0 + sa * rr; P.push(x, heightAt(x, z) + 0.09, z); U.push(a * r / (C.paveTile * 1.8), v / (C.paveTile * 1.8)); } }
  for(let i = 0; i < n; i++){ const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, kerbMat()); m.receiveShadow = true; m.renderOrder = 2; scene.add(m); PAVE.meshes.push(m); return m; }
export function paveYard(f, x0, z0, r){ const C = hillCfg(); if(!C || typeof window === 'undefined') return; const step = MOBILE ? 2.2 : 1.4, n = Math.ceil(r / step), P = [], U = [], idx = [], at = {};
  for(let j = -n; j <= n; j++) for(let i = -n; i <= n; i++){ const x = i * step, z = j * step; if(Math.hypot(x, z) > r + step) continue; const k = P.length / 3; at[i + ',' + j] = k;
    const wx = x0 + Math.min(1, r / (Math.hypot(x, z) || 1)) * x, wz = z0 + Math.min(1, r / (Math.hypot(x, z) || 1)) * z; P.push(wx, heightAt(wx, wz) + 0.06, wz); U.push(wx / C.paveTile, wz / C.paveTile); }
  for(let j = -n; j < n; j++) for(let i = -n; i < n; i++){ const a = at[i + ',' + j], b = at[(i + 1) + ',' + j], c = at[i + ',' + (j + 1)], d = at[(i + 1) + ',' + (j + 1)]; if(a == null || b == null || c == null || d == null) continue;
    const ys = [a, b, c, d].map(q => P[q * 3 + 1]); if(Math.max(...ys) - Math.min(...ys) > step * C.paveSteep) continue; idx.push(a, c, b, b, c, d); }   // (no flagstones up a steep face: the ward's revetment is rock)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, paveMat()); m.receiveShadow = true; m.renderOrder = 1; scene.add(m); PAVE.meshes.push(m); if(f){ (f.paved || (f.paved = [])).push(m); } PAVED.push({ x:x0, z:z0, r }); kerb(x0, z0, r, C.kerbW || 1.6); return m; }
export const onPaved = (x, z) => PAVED.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < p.r * p.r);
// boulders and rock clusters along the tracks (FORTHILL.road): on the verges, thicker where a track climbs a fort's hill — the road up between rocks
export function roadRocks(paths){ const C = hillCfg(); if(!C || !C.road || typeof window === 'undefined') return; const tone = new THREE.Color().setRGB(...(C.tone || [1, 1, 1])), cap = MOBILE ? 24 : 70; let n = 0;
  for(const P of paths){ for(let i = 3; i < P.pts.length - 3 && n < cap; i++){ const [x, z] = P.pts[i], hill = (P.hill = P.hill || {})[i] ?? hillAt(x, z), rate = C.roadN * (hill ? 3 : 1);
      if(Math.random() > rate) continue; const [x0, z0] = P.pts[i - 1], [x1, z1] = P.pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0) || 1, nx = -(z1 - z0) / L, nz = (x1 - x0) / L, sd = Math.random() < 0.5 ? -1 : 1, K = Math.random() < 0.6 ? 0 : 1, key = C.road[K], D = sceneDims(key);
      const sc = _R(C.roadS[K][0], C.roadS[K][1]) * (hill ? 1.3 : 1), u = sd * (P.w / 2 + 0.6 + Math.max(D.x, D.z) * sc * 0.5 + _R(0, 1.5)), px = x + nx * u, pz = z + nz * u; if(!inField(px, pz, 1.5) || onPaved(px, pz)) continue;
      const m = scenePiece(key, sc, { tone }); m.scale.setScalar(sc); m.position.set(px, heightAt(px, pz) - D.y * sc * 0.15, pz); m.rotation.y = Math.random() * 6.28; scene.add(m); PAVE.rocks.push(m);
      blocks.push({ mesh:new THREE.Object3D(), x:px, z:pz, r:Math.max(D.x, D.z) * sc * 0.42, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'crag' }); n++; } }
  fieldRocks(C, tone); }
// Z453 rock clusters big and small across the open field (FORTHILL.scatter): off the tracks, the yards and whatever stands, a few each in loose groups
function fieldRocks(C, tone){ const F = C.scatter; if(!F) return; const n = Math.round(F.n * (MOBILE ? 0.4 : 1)); let k = 0;
  for(let t = 0; t < n * 10 && k < n; t++){ const x0 = _R(-ARENA + 10, ARENA - 10), z0 = _R(-ARENA + 10, ARENA - 10); if(!inField(x0, z0, 6) || Math.hypot(x0, z0) < 40 || Math.hypot(x0, z0 - ARENA * 0.55) < 18) continue;
    const g = 1 + ((Math.random() * F.group) | 0);
    for(let q = 0; q < g && k < n; q++){ const x = x0 + _R(-5, 5), z = z0 + _R(-5, 5), big = Math.random() < F.big, key = C.road[big ? 1 : 0], D = sceneDims(key), sc = (big ? _R(F.bigS[0], F.bigS[1]) : _R(F.smallS[0], F.smallS[1])) / Math.max(D.x, D.z);
      const rr = Math.max(D.x, D.z) * sc * 0.5; if(onPaved(x, z) || blocks.some(b => Math.hypot(b.x - x, b.z - z) < (b.r || 1) + rr + 1.5) || ZONES.some(q2 => q2.kind !== 'scenery' && Math.hypot(q2.x - x, q2.z - z) < q2.r)) continue;
      const m = scenePiece(key, sc, { tone }); m.scale.setScalar(sc); m.position.set(x, heightAt(x, z) - D.y * sc * 0.18, z); m.rotation.y = Math.random() * 6.28; scene.add(m); PAVE.rocks.push(m);
      blocks.push({ mesh:new THREE.Object3D(), x, z, r:rr * 0.85, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'crag' }); k++; } } }
const hillAt = (x, z) => _HILLS.some(f => Math.hypot(f.x - x, f.z - z) < f.R + 40);
const _HILLS = [];
