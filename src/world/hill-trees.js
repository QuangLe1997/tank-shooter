// world/hill-trees.js — Z455 TREES ON THE CRAGS (FORTHILL.trees): on the limestone hills dead trees cling at the lip of a drop — found where the
//   slope is steep, walked uphill till it eases, set back a step from the edge and leaning out over the void — and an ancient oak stands on a
//   knoll's crown beside where its footpath ends. The photographed scans are stood like the set's own pieces (world/scenery.js placeScene:
//   distance levels, the trunk solid, gone with the land at the next stage), after the set has claimed its ground; the foot is set on the ground
//   round the trunk, not under the whole crown (on a lip that would sink the tree metres into the rock).
import { SCENERY } from '../../config.js';
import { ARENA, FORTS, KNOLLS, MOBILE, SCENE, _R, blocks, fieldDepth, heightAt, hillCfg, inField, onPaved, placeScene } from '../hub.js';

const slopeAt = (x, z) => { const e = 2, gx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), gz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e); return [Math.hypot(gx, gz), Math.atan2(gz, gx)]; };
const free = (C, x, z, r, wall) => inField(x, z, r) && Math.hypot(x, z) > C.land.clear[1] && Math.hypot(x, z - ARENA * 0.55) > 24 && !onPaved(x, z)
  && !FORTS.some(f => Math.hypot(f.x - x, f.z - z) < f.R + wall) && !blocks.some(b => Math.hypot(b.x - x, b.z - z) < (b.kind === 'crag' ? (b.r || 1) * 0.6 + 1 : (b.r || 1) + r))   // (among the crag's rocks, not in them; outside a fort's walls, on its crag's lip)
  && !SCENE.pieces.some(p => Math.hypot(p.x - x, p.z - z) < Math.min(p.r || 3, 6) + r);

// a scan h m tall stood at (x, z), its top leaning lean rad toward bearing a: its foot on the lowest ground round the trunk
function stand(k, x, z, h, a, lean){ const M = SCENERY.models[k], s = h / M.h, ry = Math.atan2(Math.cos(a), Math.sin(a)), p = placeScene(k, x, z, ry, s); if(!p) return null;
  const q = SCENE.pieces[SCENE.pieces.length - 1]; if(!q || q.k !== k || q.x !== x || q.z !== z) return p;
  const tr = Math.max(0.6, ((M.solid && M.solid.r) || 1) * s); let y = heightAt(x, z);
  for(let i = 0; i < 6; i++){ const t = i / 6 * Math.PI * 2; y = Math.min(y, heightAt(x + Math.cos(t) * tr, z + Math.sin(t) * tr)); }
  y -= h * (M.sink || 0); const dy = y - q.y; q.lod.position.y = y; q.y = y; q.lod.rotation.order = 'YXZ'; q.lod.rotation.x = lean;
  for(const b of blocks) if(b.mesh === q.lod && b._top != null) b._top += dy;   // (its trunk's top for the rounds that pass over)
  return p; }

export function hillTrees(){ const C = hillCfg(), T = C && C.trees; if(!T || typeof window === 'undefined' || !SCENERY.on) return;
  const cand = [], put = [], cap = Math.round(T.n * (MOBILE ? 0.5 : 1));
  for(let z = -ARENA + T.grid; z < ARENA - T.grid; z += T.grid) for(let x = -ARENA + T.grid; x < ARENA - T.grid; x += T.grid){ const [sl, a] = slopeAt(x, z); if(sl >= T.min && fieldDepth(x, z) > 4) cand.push({ x, z, sl, a }); }
  for(let i = cand.length - 1; i > 0; i--){ const j = (Math.random() * (i + 1)) | 0; [cand[i], cand[j]] = [cand[j], cand[i]]; }
  for(const c of cand){ if(put.length >= cap) break; let x = c.x, z = c.z, a = c.a, lip = false;
    for(let d = 0; d < T.reach; d++){ const [sl, a2] = slopeAt(x, z); if(sl < T.lip){ lip = true; break; } a = a2; x += Math.cos(a2); z += Math.sin(a2); }   // up the face to where it eases: the lip
    if(!lip) continue; x += Math.cos(a) * T.back; z += Math.sin(a) * T.back;
    if(heightAt(x, z) - heightAt(c.x, c.z) < T.drop || put.some(q => Math.hypot(q.x - x, q.z - z) < T.gap) || !free(C, x, z, 3, T.wall)) continue;
    const k = T.keys[(Math.random() * T.keys.length) | 0]; if(stand(k, x, z, _R(T.h[0], T.h[1]), a + Math.PI + _R(-0.3, 0.3), _R(T.lean[0], T.lean[1]))) put.push({ x, z }); }   // (leaning out over the drop)
  const O = T.oak; if(!O) return; let n = 0;
  for(const kn of KNOLLS.slice().sort(() => Math.random() - 0.5)){ if(n >= O.n) break; const t = Math.random() * 6.283, d = kn.R * _R(O.off[0], O.off[1]), x = kn.x + Math.cos(t) * d, z = kn.z + Math.sin(t) * d;
    if(!free(C, x, z, 5, C.top + 2)) continue; if(stand('tree_oak_old', x, z, _R(O.h[0], O.h[1]), Math.random() * 6.283, _R(0, 0.05))) n++; } }
