// world/outposts.js — Z285 ENEMY OUTPOSTS: round every enemy fort a camp of real things (Tripo): a long barracks, field tents, a radar on the
// bigger forts, a concrete bunker covering the gate, and rows of concertina wire across the approach — laid round the walls, clear of the gate's
// own lane (troops sally through it), solid where they should be (tanks and rounds stop at the barracks, bunker and radar — Z402 and at the tents,
// which burn away when hit).
import * as THREE from 'three';
import { OUTPOST } from '../../config.js';
import { addTent, blocks, heightAt, inField, loadGLTF, nearShape } from '../hub.js';

const PREP = {};
function piece(gl, k, hd){ const id = hd ? k + ':hd' : k; if(PREP[id]) return PREP[id];   // (hd: the whole original, Z395 — made the same way)
  let src = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o => { if(o.isMesh && !src) src = o; });
  const g = src.geometry.clone().applyMatrix4(src.matrixWorld); g.computeBoundingBox(); let b = g.boundingBox; g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  if(b.max.z - b.min.z > b.max.x - b.min.x) g.rotateY(Math.PI / 2); g.computeBoundingBox(); b = g.boundingBox; const S = OUTPOST.size[k], sz = b.getSize(new THREE.Vector3()), f = S.h ? S.h / sz.y : S.w / sz.x;
  g.scale(f, f, f); g.computeBoundingBox(); g.computeBoundingSphere(); return (PREP[id] = { geo:g, mat:src.material.clone(), size:g.boundingBox.getSize(new THREE.Vector3()) }); }

// f: a fort just built (its group f.g at the fort's centre); the gate's outward direction keeps a lane clear
// Z311 the concertina coils laid across each outpost's approach: [f, mesh, centre, direction along it, length, flattened]
export const OUTPOST_WIRE = [];
export function buildOutpost(f){ if(typeof window === 'undefined' || !f.g || /nooutpost/.test(location.search + location.hash)) return; const C = OUTPOST;
  for(let i = OUTPOST_WIRE.length - 1; i >= 0; i--) if(!OUTPOST_WIRE[i].f.g || !OUTPOST_WIRE[i].f.g.parent) OUTPOST_WIRE.splice(i, 1);   // Z396 the last battlefield's coils go (only a ride pruned them: in a tank they held every old fort)
  const ga = Math.atan2((f.oz ?? f.z + 1) - f.z, (f.ox ?? f.x) - f.x), list = [], R = f.R || 30;
  const spot = (a, d) => [Math.cos(a) * d, Math.sin(a) * d];
  const away = a => Math.abs(Math.atan2(Math.sin(a - ga), Math.cos(a - ga))) > C.laneA;
  const plan = [['base_barracks', 1], ['base_tent', C.tents], ['base_radar', f.tier >= 2 ? 1 : 0], ...Array.from({ length:C.nVeh }, () => [C.veh[(Math.random() * C.veh.length) | 0], 1])];   // Z291 trucks, APCs, jeeps parked in the camp
  for(const [k, n] of plan) for(let i = 0; i < n; i++){ for(let t = 0; t < 20; t++){ const a = Math.random() * Math.PI * 2, d = R + C.ring[0] + Math.random() * (C.ring[1] - C.ring[0]); if(!away(a)) continue;
      const [lx, lz] = spot(a, d); if(!inField(f.x + lx, f.z + lz, 6) || list.some(q => Math.hypot(q.x - lx, q.z - lz) < 12) || blocks.some(b => b.def && Math.hypot(b.x - f.x - lx, b.z - f.z - lz) < (b.r || 2) + 7)) continue; list.push({ k, x:lx, z:lz, ry:-a + Math.PI / 2 }); break; } }   // (Z420 nor on the belt that joins the fort)
  { const sd = Math.random() < 0.5 ? 1 : -1, a = ga + sd * C.laneA * 1.3, [lx, lz] = spot(a, R + 6); list.push({ k:'base_bunker', x:lx, z:lz, ry:-ga + Math.PI / 2 }); }   // the bunker covering the gate
  for(let r = 0; r < C.wireRows; r++) for(const sd of [-1, 1]){ const a = ga + sd * (C.laneA * 0.9 + r * 0.12), [lx, lz] = spot(a, R + C.wireAt + r * 3); list.push({ k:'base_wire', x:lx, z:lz, ry:-a }); }   // wire across the approach, the lane left open
  const keys = [...new Set(list.map(q => q.k))]; Promise.all(keys.map(k => loadGLTF(k))).then(L => { if(!f.g.parent) return; const by = {}; keys.forEach((k, i) => { if(L[i]) by[k] = piece(L[i], k); });
    for(const q of list){ const P = by[q.k]; if(!P) continue; const wx = f.x + q.x, wz = f.z + q.z, m = new THREE.Mesh(P.geo, P.mat);
      m.position.set(q.x, heightAt(wx, wz) - f.g.position.y - 0.05, q.z); m.rotation.y = q.ry; m.castShadow = m.receiveShadow = true; m.userData.outpost = true; f.g.add(m); nearShape(m, q.k, gl => piece(gl, q.k, true).geo);   // (Z395 whole up close)
      if(C.solid.includes(q.k)) blocks.push({ mesh:m, x:wx, z:wz, r:Math.max(P.size.x, P.size.z) * 0.42, hp:Infinity, maxHp:Infinity, steel:true, heavy:true, loot:false, kind:'outpost' });
      if(q.k === 'base_tent') addTent(m, wx, wz, q.ry, P.size.z / 2, P.size.x / 2, false);   // Z402 a field tent: a wall to hide behind until it burns (world/camps.js)
      if(q.k === 'base_wire'){ const lx = P.size.x >= P.size.z, L = Math.max(P.size.x, P.size.z), dx = lx ? Math.cos(q.ry) : Math.sin(q.ry), dz = lx ? -Math.sin(q.ry) : Math.cos(q.ry);
        OUTPOST_WIRE.push({ f, m, x:wx, z:wz, dx, dz, L, down:false }); } } }); }   // Z311 the coil across the approach holds a ride (flattened if rammed hard)
