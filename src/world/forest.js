// world/forest.js — Z440 WOODS PAST THE FENCE: the land round the field wears real woods of the scanned tree species, not a scatter of single trees
//   Each battlefield's woodland (config FOREST): a share of its land under forest, laid by a noise map into woods, groves and clearings, every tree
//   one of the land's species (world/real-trees.js's scans, their 3k-triangle copies) at its true height, crowns touching, each a shade of its own.
//   From the fence (FOREST.gap; closer in stand the skyline's scans) out FOREST.near m; none on a cliff, above the tree line (the snow line less
//   FOREST.treeline), in the sea or on a road. Lit and hazed by the air like the land under them. Split by bearing (the camera culls the woods
//   behind it); desktop only (phones keep the skyline's trees).
import * as THREE from 'three';
import { DIET, FOREST } from '../../config.js';
import { BIOME, MOBILE, fieldR, heightAt, landform, loadGLTF, scene } from '../hub.js';

const _h = (x, z) => { const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return v - Math.floor(v); };
function _n(x, z){ const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (_h(ix, iz) * (1 - u) + _h(ix + 1, iz) * u) * (1 - v) + (_h(ix, iz + 1) * (1 - u) + _h(ix + 1, iz + 1) * u) * v; }
const _fbm = (x, z) => _n(x, z) * 0.6 + _n(x * 2.3 + 5.1, z * 2.3 + 1.3) * 0.28 + _n(x * 5.1 + 2.7, z * 5.1 + 8.9) * 0.12;
const rnd = (a, b) => a + Math.random() * (b - a), SPECIES = {};
function pick(kinds, u){ let s = 0; for(const [k, w] of kinds){ s += w; if(u <= s) return k; } return kinds[kinds.length - 1][0]; }
// a species' scan as one geometry, its trunk's foot at the origin and 1 m tall (scaled to each tree's height)
function species(k){ return SPECIES[k] || (SPECIES[k] = loadGLTF('woodtree_' + k).then(gl => { if(!gl) return null; let src = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if(o.isMesh && !src) src = o; }); if(!src) return null;
  const g = src.geometry.clone().applyMatrix4(src.matrixWorld); g.computeBoundingBox(); const b = g.boundingBox, H = b.max.y - b.min.y; g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); g.scale(1 / H, 1 / H, 1 / H);
  const m = src.material.clone(); m.envMapIntensity = 0.4; return { g, m }; })); }
// the roads past the fence, as points every few metres in a coarse grid (no tree stands on one)
function roadGrid(){ const R = scene.getObjectByName('outskirt-roads'), G = new Map(); if(!R) return G;
  for(const m of R.children){ const P = m.geometry.attributes.position; for(let i = 0; i < P.count; i += 2){ const x = P.getX(i), z = P.getZ(i), k = Math.floor(x / 20) + ',' + Math.floor(z / 20); (G.get(k) || G.set(k, []).get(k)).push(x, z); } } return G; }
function onRoad(G, x, z, w){ for(let i = -1; i <= 1; i++) for(let j = -1; j <= 1; j++){ const L = G.get((Math.floor(x / 20) + i) + ',' + (Math.floor(z / 20) + j)); if(L) for(let q = 0; q < L.length; q += 2) if(Math.hypot(L[q] - x, L[q + 1] - z) < w) return true; } return false; }

// plant this battlefield's woods into g (the horizon's group: cleared with it)
export function plantForest(g, b){ let B = FOREST.on && !MOBILE && FOREST.biomes[b.name]; if(typeof B === 'string') B = FOREST.biomes[B]; if(!B || typeof window === 'undefined') return;
  const LF = landform(b), sea = LF && LF.plain === 'sea' ? (LF.form === 'plateau' ? -LF.h + 2 : -2) : -1e9, snowY = LF && LF.snow ? LF.snow - FOREST.treeline : 1e9, roads = roadGrid(), kinds = Object.entries(B.kinds);
  const fit = (x, z) => { const y = heightAt(x, z); if(y < sea || y > snowY - 40 * _fbm(x / 60, z / 60)) return null;
    const sl = Math.hypot(heightAt(x + 4, z) - heightAt(x - 4, z), heightAt(x, z + 4) - heightAt(x, z - 4)) / 8; if(sl > FOREST.slope) return null;
    const m = _fbm(x / B.patch + 3.7, z / B.patch + 9.1) + 0.18 * _n(x / 40, z / 40) - (1 - B.cover) * 0.9 - 0.12; if(m < 0 || Math.random() > Math.min(1, m * 6)) return null;
    if(roads.size && onRoad(roads, x, z, 9)) return null; return y; };
  const NEAR = DIET.on ? DIET.forest.near : FOREST.near, MAX = DIET.on ? DIET.forest.max : FOREST.max, by = new Map(), R = 300 + NEAR; let all = 0;   // (PERF 9 the diet's reach and budget)   // one tree a cell, the cells a wood's spacing (B.space), jittered
  for(let x = -R; x <= R; x += B.space) for(let z = -R; z <= R; z += B.space){ const px = x + rnd(-0.45, 0.45) * B.space, pz = z + rnd(-0.45, 0.45) * B.space, o = Math.hypot(px, pz) - fieldR(Math.atan2(pz, px));
    if(o < FOREST.gap || o > NEAR) continue; const y = fit(px, pz); if(y == null) continue; const k = pick(kinds, Math.random()); (by.get(k) || by.set(k, []).get(k)).push([px, y - 0.4, pz, rnd(B.h[0], B.h[1])]); all++; }
  const keep = Math.min(1, MAX / Math.max(1, all)), S = FOREST.sectors;   // (over the budget: thinned evenly, never cut off on one side)
  for(const [k, list0] of by){ const list = list0.filter(() => Math.random() < keep); species(k).then(T => { if(!T || !list.length || BIOME !== b || g.parent !== scene) return;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3(), U = new THREE.Vector3(0, 1, 0), C = new THREE.Color(), arcs = Array.from({ length:S }, () => []);
    for(const t of list) arcs[Math.min(S - 1, Math.floor((Math.atan2(t[2], t[0]) / (2 * Math.PI) + 1) % 1 * S))].push(t);   // split by bearing: the camera culls the woods behind it
    for(const L of arcs){ if(!L.length) continue; const im = new THREE.InstancedMesh(T.g, T.m, L.length);
      L.forEach(([x, y, z, h], i) => { const w = h * rnd(0.88, 1.12); im.setMatrixAt(i, M.compose(V.set(x, y, z), Q.setFromAxisAngle(U, Math.random() * Math.PI * 2), Sc.set(w, h, w)));
        const v = rnd(0.82, 1.1); im.setColorAt(i, C.setRGB(v * rnd(0.95, 1.05), v, v * rnd(0.92, 1.03))); });   // each tree a shade of its own: a wood is never one green
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = false; im.receiveShadow = !DIET.on; im.userData.forest = k; g.add(im); } }); } }
