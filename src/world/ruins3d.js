// world/ruins3d.js — Z275 RUINS OF WAR: Tripo-built ruins stand about the battlefields — a gothic chapel fallen in (built from the player's
// own reference photo), a shell-holed fortress wall, a bombed-out concrete apartment block, a broken watchtower, a burnt-out French villa —
// each battlefield its own mix (REALRUIN.biomes). The spots are chosen when the battlefield is laid out (kept clear of our base, of zones and of
// each other, and registered as zones so the flora and scatter keep off them); the models rise as soon as they have loaded. Tanks and rounds
// collide with them along their length (a row of solid circles), like the city's buildings.
import * as THREE from 'three';
import { CORE_DEF, REALRUIN } from '../../config.js';
import { ARENA, BIOME, LAND, ZONES, arena, blocks, heightAt, inField, inZone, loadGLTF, nearShape } from '../hub.js';

const PREP = {}; let GEN = 0;
function prep(gl, k, hd){ const id = hd ? k + ':hd' : k; if(PREP[id]) return PREP[id];   // (hd: the whole original, Z395 — made the same way)
  const S = REALRUIN.models[k]; let src = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if(o.isMesh && !src) src = o; });
  const g = src.geometry.clone().applyMatrix4(src.matrixWorld); g.computeBoundingBox(); const b = g.boundingBox, sz = b.getSize(new THREE.Vector3());
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); const f = S.h ? S.h / sz.y : S.w / Math.max(sz.x, sz.z); g.scale(f, f, f);
  g.translate(0, -S.sink * sz.y * f, 0); g.computeBoundingBox(); g.computeBoundingSphere(); const mat = src.material.clone(); mat.envMapIntensity = S.env ?? 0.7;
  return (PREP[id] = { geo:g, mat, size:g.boundingBox.getSize(new THREE.Vector3()) }); }

// lay out this battlefield's ruins: spots now (zones claimed), models when they arrive
export function buildRuins(){ const B = REALRUIN.biomes[BIOME.name]; GEN++; if(!B || typeof window === 'undefined' || /noruins/.test(location.search + location.hash)) return;
  const gen = GEN, keep = (CORE_DEF.R || 24) + REALRUIN.clearCore, spots = [];
  for(let i = 0, tries = 0; i < B.n && tries < 160; tries++){ const k = B.keys[i % B.keys.length], S = REALRUIN.models[k], r = (S.w || S.h) * 0.6;
    const a = Math.random() * Math.PI * 2, d = keep + r + Math.random() * (ARENA * 0.8 - keep - r), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if(!inField(x, z, r + 3) || inZone(x, z, r + 4) || spots.some(p => Math.hypot(p.x - x, p.z - z) < p.r + r + 10)) continue;
    const s = { k, x, z, r, ry:Math.random() * Math.PI * 2 }; spots.push(s); ZONES.push({ kind:'landmark', x, z, r:r * 0.9 }); i++; }
  for(const s of spots) loadGLTF(s.k).then(gl => { if(!gl || gen !== GEN) return; place(s, prep(gl, s.k)); }); }
function place(s, P){ const m = new THREE.Mesh(P.geo, P.mat); m.position.set(s.x, heightAt(s.x, s.z), s.z); m.rotation.y = s.ry; m.castShadow = true; m.receiveShadow = true;
  arena.add(m); LAND.meshes.push(m); nearShape(m, s.k, gl => prep(gl, s.k, true).geo);   // (Z395 whole up close)
  const L = Math.max(P.size.x, P.size.z), W = Math.min(P.size.x, P.size.z), along = P.size.x >= P.size.z ? 0 : Math.PI / 2, a = s.ry + along, ux = Math.cos(a), uz = -Math.sin(a), r = W * 0.42, n = Math.max(1, Math.ceil(L / (r * 1.6)));
  for(let i = 0; i < n; i++){ const t = (n === 1 ? 0 : -L / 2 + r + i * (L - 2 * r) / (n - 1)); blocks.push({ mesh:m, x:s.x + ux * t, z:s.z + uz * t, r, hp:Infinity, maxHp:Infinity, steel:false, heavy:true, loot:false, kind:'ruin' }); } }
