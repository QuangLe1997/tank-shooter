// world/defense.js — Z420 THE DEFENCE IN DEPTH: the forts stand in a ring round our base; the enemy closes the ring the way an army holds a line —
//   the forts are its strongpoints and between every two neighbours runs an OBSTACLE BELT (a staggered double row of dragon's teeth from one fort's
//   flank to the next, never dipping into our home ground), broken once, at its middle: the LANE, the only way through the ring short of storming a
//   fort, under the guns of both. A CHECKPOINT closes every lane (jersey funnel on our side, a T-wall chicane, a sandbag MG nest behind it, a guard
//   tower); behind each belt FIGHTING POSITIONS — sandbag crescents facing our base — hold the line, more in the depth. The sector our spawn
//   looks out on is left open (it is ours). Where a river crosses the field the river is the line instead: each crossing is a lane, its checkpoint on
//   the far bank, short wings of teeth either side. planDefense() (from planZones, once the forts are planned) chooses the lanes and claims the
//   checkpoints' ground; buildDefense() (from buildBlocks, before the maze cover) lays it all. Every piece is ordinary cover (blocks).
import * as THREE from 'three';
import { DEFENSE, HARD, HOME_GAP } from '../../config.js';
import { BIOME, COVER_HP, COVER_K, COVER_R, FORTS, HEAVY_KINDS, MOBILE, RIVER, S, ZONES, blocks, buildTower, coverGeo, coverMat, fieldR, heightAt, homeClear, inField, inZone, makeCoverMesh, scene } from '../hub.js';

export const DEF = { rb:0, lanes:[], cps:[], chords:[], river:false, why:[] };
const TAU = Math.PI * 2, E = -Math.PI / 2;   // E: the enemy's bearing from our base
const rnd = (a, b) => a + Math.random() * (b - a), irnd = r => Math.round(rnd(r[0], r[1]));
const dA = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const conf = () => DEFENSE.biomes[BIOME.name] || {};

// the lanes: the middle of every belt between two forts (at most DEFENSE.lanes); with a river, its crossings
export function planDefense(){ DEF.lanes.length = 0; DEF.cps.length = 0; DEF.chords.length = 0; DEF.why.length = 0; DEF.river = false; if(!DEFENSE.on) return;
  DEF.rb = HOME_GAP.wall + (MOBILE ? HOME_GAP.gapMobile : HOME_GAP.gap) + (MOBILE ? DEFENSE.rbMobile : DEFENSE.rb);
  const cr = (RIVER && RIVER.bridges ? RIVER.bridges : []).map(b => ({ x:b.x, z:b.z, off:b.hl })).concat((RIVER && RIVER.fords ? RIVER.fords : []).map(f => ({ x:f.x, z:f.z, off:f.r })));
  if(cr.length){ DEF.river = true;   // the river holds the line: a checkpoint on the far bank of every crossing that faces the enemy's side
    for(const c of cr){ const d = Math.hypot(c.x, c.z) || 1, a = Math.atan2(c.z, c.x); if(Math.abs(dA(a, E)) > Math.PI * 0.62) continue;
      const D = c.off + DEFENSE.cp.r + 2, x = c.x + c.x / d * D, z = c.z + c.z / d * D; if(!inField(x, z, 4) || !homeClear(x, z, 4)) continue; lane(a, x, z); } }
  else for(const C of chords()){ const m = C.at(0.5), a = Math.atan2(m[1], m[0]); if(DEF.lanes.length >= DEFENSE.lanes) break; if(!inField(m[0], m[1], 6)){ DEF.why.push('mid out ' + m.map(v => v.toFixed(0))); continue; } C.lane = lane(a, m[0], m[1]); DEF.chords.push(C); } }
// the belts' lines: one between every two forts that neighbour round our base (not across our spawn's sector), from wall to wall, pushed out of our home ground
function chords(){ const B = DEFENSE.belt, fs = FORTS.map(f => ({ f, a:Math.atan2(f.z, f.x) })).sort((p, q) => p.a - q.a), out = [], rMin = DEF.rb;
  for(let i = 0; i < fs.length && fs.length > 1; i++){ const A = fs[i], Bf = fs[(i + 1) % fs.length], span = ((Bf.a - A.a) % TAU + TAU) % TAU || TAU;
    if(span > B.maxSpan || Math.abs(dA(A.a + span / 2, Math.PI / 2)) < B.spawnGap){ DEF.why.push('span ' + span.toFixed(2) + ' mid ' + (A.a + span / 2).toFixed(2)); continue; }   // too far round, or across our own spawn's sector
    const fa = A.f, fb = Bf.f, d = Math.hypot(fb.x - fa.x, fb.z - fa.z) || 1, ux = (fb.x - fa.x) / d, uz = (fb.z - fa.z) / d;
    const p0 = [fa.x + ux * ((fa.R || 30) + B.wall), fa.z + uz * ((fa.R || 30) + B.wall)], p1 = [fb.x - ux * ((fb.R || 30) + B.wall), fb.z - uz * ((fb.R || 30) + B.wall)], len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const short = len < DEFENSE.laneW + 12; if(len < DEFENSE.laneW * 0.6){ DEF.why.push('shut ' + len.toFixed(0)); continue; }   // two forts wall to wall: no way through, nothing to close
    const at = t => { const x = p0[0] + (p1[0] - p0[0]) * t, z = p0[1] + (p1[1] - p0[1]) * t, r = Math.hypot(x, z) || 1, k = Math.max(1, rMin / r); return [x * k, z * k]; };
    out.push({ at, len, short }); }   // short: the gap between the two forts is itself the lane — its checkpoint, no teeth
  return out; }
function lane(a, x, z){ const L = { a, x, z }; DEF.lanes.push(L); DEF.cps.push(L); ZONES.push({ kind:'checkpoint', x, z, r:DEFENSE.cp.r }); return L; }

// ---------- laying it ----------
// one piece of cover, the same as the maze lays (own material, its damage shows), or a hedgehog
function put(kind, x, z, ry, tag, own){ if(!inField(x, z, 2) || blocks.some(b => b.def !== own && Math.hypot(b.x - x, b.z - z) < (b.r || 2) + 0.6)) return null;   // (own: a wall's sections stand against each other)
  let m, b;
  if(kind === 'hedgehog'){ m = new THREE.Mesh(coverGeo('hedgehog'), coverMat('hedgehog')); m.scale.setScalar(COVER_K); m.castShadow = m.receiveShadow = true;
    b = { x, z, r:1.2 * COVER_K, hp:HARD.hedgehog, maxHp:HARD.hedgehog, steel:false, hard:true, loot:false, kind }; }
  else { m = makeCoverMesh(kind, true); m.scale.setScalar(COVER_K); const hp = COVER_HP[kind] || 70;
    b = { x, z, r:(COVER_R[kind] || 1.7) * COVER_K, hp, maxHp:hp, steel:HEAVY_KINDS.has(kind), heavy:HEAVY_KINDS.has(kind), cover:true, ms:COVER_K, loot:false, kind }; }
  m.position.set(x, heightAt(x, z) - (kind === 'hedgehog' ? 0 : 0.12), z); m.rotation.y = ry; scene.add(m); b.mesh = m; b.def = tag; blocks.push(b); return b; }
// the jersey's long side is its z, the other pieces' their x
const LONG_Z = new Set(['jersey']);
// a frame at (x, z) whose v runs along bearing a (away from our base) and u across it
function frame(x, z, a){ const c = Math.cos(a), s = Math.sin(a); return (u, v) => [x + c * v - s * u, z + s * v + c * u]; }
const fortNear = (x, z, pad) => FORTS.some(f => Math.hypot(f.x - x, f.z - z) < (f.R || 30) + pad);

export function buildDefense(){ if(!DEFENSE.on || !DEF.rb) return; DEF.positions = []; const C = conf(), B = DEFENSE.belt, kinds = B.kinds[BIOME.name] || B.kinds._;
  if(!DEF.river && C.belt !== false) for(const ch of DEF.chords.filter(c => !c.short)){   // each belt: runs of teeth, two staggered rows, its lane left open at the middle
    const n = Math.max(2, Math.round(ch.len / B.step)), gap = DEFENSE.laneW / 2 / ch.len;
    for(let row = 0; row < 2; row++){ let run = irnd(B.run);
      for(let i = 0; i <= n; i++){ const t = (i + (row ? 0.5 : 0)) / n; if(t > 1) break; if(run <= 0){ i += irnd(B.hole) - 1; run = irnd(B.run); continue; } run--;
        if(Math.abs(t - 0.5) < gap) continue; const [x0, z0] = ch.at(t), r = Math.hypot(x0, z0) || 1, o = row * B.row + Math.sin(t * 9 + ch.len) * B.wob * 0.25, x = x0 + x0 / r * o, z = z0 + z0 / r * o;
        if(homeClear(x, z, 2) && !inZone(x, z, 2) && !fortNear(x, z, B.fortPad)) put(kinds[(Math.random() * kinds.length) | 0], x, z, rnd(0, TAU), 'belt'); } }
    // its fighting positions: just behind the teeth, facing our base, either side of the lane
    for(const t of [rnd(0.16, 0.34), rnd(0.66, 0.84)]){ const [x0, z0] = ch.at(t), r = Math.hypot(x0, z0) || 1, o = rnd(9, 14); crescent(x0 + x0 / r * o, z0 + z0 / r * o, Math.atan2(z0, x0)); } }
  for(const L of DEF.cps) checkpoint(L);
  positions(); }
// a continuous wall from (u0, v0) to (u1, v1) in a frame: whole sections of the kind's true length, end to end, each turned along the wall
function wall(kind, at, u0, v0, u1, v1, tag){ const [x0, z0] = at(u0, v0), [x1, z1] = at(u1, v1), len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / (DEFENSE.cp.len[kind] || 3.6))), th = Math.atan2(z1 - z0, x1 - x0);
  const ry = -th + (LONG_Z.has(kind) ? Math.PI / 2 : 0); for(let i = 0; i < n; i++){ const t = (i + 0.5) / n; put(kind, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, ry, tag, tag); } }
// a checkpoint closing a lane: built in the lane's frame (v toward the enemy), its tower on the enemy side; with a river, wings of teeth either side
function checkpoint(L){ const P = DEFENSE.cp, at = frame(L.x, L.z, L.a);
  for(const [kind, u0, v0, u1, v1] of P.walls) wall(kind, at, u0, v0, u1, v1, 'cp');
  { const [x, z] = at(P.tower[0], P.tower[1]); if(inField(x, z, 4) && !blocks.some(b => Math.hypot(b.x - x, b.z - z) < (b.r || 2) + 3)) buildTower(x, z); }
  if(DEF.river) for(const sd of [-1, 1]) for(let k = 0; k < P.wing; k++){ const [x, z] = at(sd * (P.r * 0.75 + k * DEFENSE.belt.step), -2 + (k % 2) * 2); put('teeth', x, z, rnd(0, TAU), 'wing'); } }
// a fighting position: a U of cover (DEFENSE.pos.walls), its face and arms toward our base (bearing a points away from it), its stores behind; false where it cannot stand
function crescent(x, z, a){ const P = DEFENSE.pos, kinds = P.kinds[BIOME.name] || P.kinds._; if(!inField(x, z, 6) || !homeClear(x, z, 4) || inZone(x, z, 4) || fortNear(x, z, P.fortPad) || blocks.some(b => Math.hypot(b.x - x, b.z - z) < (b.r || 2) + 4)) return false;
  const kind = kinds[(Math.random() * kinds.length) | 0], at = frame(x, z, a);
  for(const [u0, v0, u1, v1] of P.walls) wall(kind, at, u0, v0, u1, v1, 'pos');   // a U of one kind: its face to our base, its arms reaching forward, open behind
  if(Math.random() < P.back){ const [px, pz] = at(rnd(-2, 2), 3.4); put(Math.random() < 0.5 ? 'drums' : 'crates', px, pz, rnd(0, TAU), 'pos'); }
  (DEF.positions || (DEF.positions = [])).push([x, z]); return true; }
// the depth: more positions between the ring and the fence, away from each other
function positions(){ const P = DEFENSE.pos, n = Math.round(P.n[Math.min(P.n.length - 1, S.stage - 1)] * (MOBILE ? P.mobileK : 1)); let got = 0; DEF.positions = DEF.positions || [];
  for(let t = 0; t < n * 40 && got < n; t++){ const a = rnd(-Math.PI, Math.PI); if(Math.abs(dA(a, Math.PI / 2)) < DEFENSE.belt.spawnGap) continue;
    const FR = fieldR(a), r = rnd(DEF.rb + 14, FR - 12); if(r <= DEF.rb + 14) continue; const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if(DEF.positions.some(g => Math.hypot(g[0] - x, g[1] - z) < P.gap) || inZone(x, z, P.pad)) continue; if(crescent(x, z, a)) got++; } }
