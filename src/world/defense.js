// world/defense.js — Z420 THE DEFENCE IN DEPTH → Z423 EVERY LAND ITS OWN DOCTRINE. The forts stand in a ring round our base and the enemy closes
//   the ring as an army holds ground; how depends on the land (DEFENSE.style), so no two battlefields read alike:
//   ring      — round our base from fort to fort (the forts stand on the line) a staggered double row of dragon's teeth, open at its LANES
//   line      — DESERT, a Bar-Lev line: one dense row of teeth fort to fort, a domed pillbox every ~40 m behind it
//   hedgehog  — the ice: fields of steel hedgehogs in threes between the forts (they read on the snow from afar)
//   containers— the works: walls of shipping containers fort to fort, some stacked two high
//   curtain   — CITADEL: real curtain walls of stone fort to fort, a gatehouse in each lane
//   bocage    — the green lands: hedgerows (trees on a log bank) between the forts, the gaps held
//   lava      — VOLCANO: chains of lava craters and glowing rock between the forts, the way through is the gap between two pits
//   terraces  — QUARRY: three staggered rows of T-walls like the quarry's benches; the gaps never line up
//   kopje     — SAVANNA: no line at all — isolated strongpoints (a sandbag ring round a tower) on the open plain, ambush positions round them
//   pockets   — RUINS: resistance nests in the ruins themselves, a sniper in a broken tower
//   streets   — CITY: checkpoints at the crossings toward the enemy, the side streets barricaded
//   Every LANE gets a CHECKPOINT (jersey funnel, T-wall chicane, sandbag MG nest, guard tower); FIGHTING POSITIONS (sandbag U's facing our base)
//   hold the line and the depth; where a river crosses, its crossings are lanes too. Every position names its POSTS: riflemen spawned there hold
//   them (garrisonDefense). planDefense() (planZones, after the forts) chooses the lanes; buildDefense() (buildBlocks, before the scatter) lays it.
import * as THREE from 'three';
import { DEFENSE, HARD, HOME_GAP } from '../../config.js';
import { BIOME, CITY_XING, COVER_HP, COVER_K, COVER_R, FORTS, HEAVY_KINDS, MOBILE, RIVER, S, SCENE, ZONES, blocks, buildTower, coverGeo, coverMat, coverVariant, fieldR, heightAt, homeClear, inField, inZone, makeCoverMesh, onClimb, placeScene, scene, spawnEnemy, trackCover } from '../hub.js';

export const DEF = { rb:0, lanes:[], cps:[], chords:[], river:false, style:'ring', posts:[], positions:[], garrison:[] };
const TAU = Math.PI * 2, E = -Math.PI / 2, SPAWN = Math.PI / 2;   // the enemy's bearing from our base · our spawn's
const rnd = (a, b) => a + Math.random() * (b - a), irnd = r => Math.round(rnd(r[0], r[1])), pick = L => L[(Math.random() * L.length) | 0];
const dA = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const CHORDS = new Set(['ring', 'line', 'hedgehog', 'containers', 'curtain', 'bocage', 'lava']);   // the styles that join the forts

// ---------- planning: the lanes (river crossings first, then the middle of every belt between two forts; DESERT: the forts' own bearings) ----------
export function planDefense(){ for(const k of ['lanes', 'cps', 'chords', 'posts', 'positions', 'garrison']) DEF[k].length = 0; DEF.river = false; if(!DEFENSE.on) return;
  DEF.style = DEFENSE.style[BIOME.name] || 'ring'; DEF.rb = HOME_GAP.wall + (MOBILE ? HOME_GAP.gapMobile : HOME_GAP.gap) + (MOBILE ? DEFENSE.rbMobile : DEFENSE.rb);
  const cr = (RIVER && RIVER.bridges ? RIVER.bridges : []).filter(b => !b.rope).map(b => ({ x:b.x, z:b.z, off:b.hl })).concat((RIVER && RIVER.fords ? RIVER.fords : []).map(f => ({ x:f.x, z:f.z, off:f.r })));
  for(const c of cr){ const d = Math.hypot(c.x, c.z) || 1, a = Math.atan2(c.z, c.x); if(Math.abs(dA(a, E)) > Math.PI * 0.62 || DEF.lanes.length >= DEFENSE.lanes) continue;   // the river holds the line: a checkpoint on the far bank
    const D = c.off + DEFENSE.cp.r + 2, x = c.x + c.x / d * D, z = c.z + c.z / d * D; if(!inField(x, z, 4) || !homeClear(x, z, 4)) continue; DEF.river = true; lane(a, x, z); }
  if(!CHORDS.has(DEF.style)) return;
  for(const C of chords()){ DEF.chords.push(C); if(!C.short) for(let t = 0; t <= 1; t += 10 / C.len){ const [x, z] = C.at(t); ZONES.push({ kind:'belt', x, z, r:7 }); }   // the belt's ground claimed first: the land's set pieces and the scatter keep off it
    for(const g of C.gaps){ const m = C.at(g); if(DEF.lanes.length < DEFENSE.lanes && inField(m[0], m[1], 6)) lane(Math.atan2(m[1], m[0]), m[0], m[1]); } } }   // (past the cap a gap stays open, unguarded)
// the belts' lines: round our base from one fort's flank to the next fort's (the forts stand on the line), never across our spawn's sector; a long
//   one opens twice. An arc: its bearing runs between the two flanks, its radius between the two forts' — at(t) = the point, th(t) = the way it runs there
function chords(){ const B = DEFENSE.belt, fs = FORTS.map(f => ({ f, a:Math.atan2(f.z, f.x), d:Math.hypot(f.x, f.z) })).sort((p, q) => p.a - q.a), out = [];
  for(let i = 0; i < fs.length && fs.length > 1; i++){ const A = fs[i], Bf = fs[(i + 1) % fs.length], span = ((Bf.a - A.a) % TAU + TAU) % TAU || TAU;
    const a0 = A.a + ((A.f.R || 30) + B.wall) / A.d, a1 = A.a + span - ((Bf.f.R || 30) + B.wall) / Bf.d, mid = (a0 + a1) / 2;
    if(span > B.maxSpan || a1 - a0 < DEFENSE.laneW * 0.6 / Math.min(A.d, Bf.d) || Math.abs(dA(SPAWN, mid)) < (a1 - a0) / 2 + B.spawnGap) continue;   // too far round, wall to wall, or across our spawn's sector
    const rr = t => Math.max(DEF.rb, A.d + (Bf.d - A.d) * t), at = t => { const a = a0 + (a1 - a0) * t, r = rr(t); return [Math.cos(a) * r, Math.sin(a) * r]; };
    const len = (a1 - a0) * (A.d + Bf.d) / 2, gaps = len > B.twoLanes ? [1 / 3, 2 / 3] : [0.5];
    out.push({ at, len, gaps, short:len < DEFENSE.laneW + 12, th:t => a0 + (a1 - a0) * t + Math.PI / 2 }); }   // short: the gap between the two forts is itself the lane
  return out; }
function lane(a, x, z){ const L = { a, x, z }; DEF.lanes.push(L); DEF.cps.push(L); ZONES.push({ kind:'checkpoint', x, z, r:DEFENSE.cp.r }); return L; }

// ---------- pieces ----------
// one piece of cover, the same as the maze lays (own material, its damage shows), or a hedgehog; own: a wall's sections stand against each other
function put(kind, x, z, ry, tag, own){ if(!inField(x, z, 2) || onClimb(x, z, 1) || blocks.some(b => b.def !== own && Math.hypot(b.x - x, b.z - z) < (b.r || 2) + 0.6)) return null;
  let m, b;
  if(kind === 'hedgehog'){ m = new THREE.Mesh(coverGeo('hedgehog'), coverMat('hedgehog')); m.scale.setScalar(COVER_K); m.castShadow = m.receiveShadow = true;
    b = { x, z, r:1.2 * COVER_K, hp:HARD.hedgehog, maxHp:HARD.hedgehog, steel:false, hard:true, loot:false, kind }; }
  else { m = makeCoverMesh(kind, true); if(kind === 'container') coverVariant(m); m.scale.setScalar(COVER_K); const hp = COVER_HP[kind] || 70;
    b = { x, z, r:(COVER_R[kind] || 1.7) * COVER_K, hp, maxHp:hp, steel:HEAVY_KINDS.has(kind), heavy:HEAVY_KINDS.has(kind), cover:true, ms:COVER_K, loot:false, kind }; }
  m.position.set(x, heightAt(x, z) - (kind === 'hedgehog' ? 0 : 0.12), z); m.rotation.y = ry; scene.add(m); b.mesh = m; b.def = tag; blocks.push(b); return b; }
// a set piece (a curtain wall, a hedgerow tree, a crater, a pillbox) where nothing already stands
function sp(k, x, z, ry, s, tag){ const r = 3 * s; if(!inField(x, z, 3) || claimed(x, z, 1) || blocks.some(b => Math.hypot(b.x - x, b.z - z) < (b.r || 2) + r * 0.5)) return null; const p = placeScene(k, x, z, ry, s); if(p){ p.tag = tag; (DEF.pieces || (DEF.pieces = [])).push(p); } return p; }
const LONG_Z = new Set(['jersey', 'container']);   // their long side is their z, the other pieces' their x
// a frame at (x, z) whose v runs along bearing a (away from our base) and u across it
function frame(x, z, a){ const c = Math.cos(a), s = Math.sin(a); return (u, v) => [x + c * v - s * u, z + s * v + c * u]; }
const fortNear = (x, z, pad) => FORTS.some(f => Math.hypot(f.x - x, f.z - z) < (f.R || 30) + pad);
const post = (x, z, a, what) => DEF.posts.push({ x, z, a, what });
// a continuous wall from (u0, v0) to (u1, v1) in a frame: whole sections of the kind's true length, end to end, each turned along the wall
function wall(kind, at, u0, v0, u1, v1, tag){ const [x0, z0] = at(u0, v0), [x1, z1] = at(u1, v1), len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / (DEFENSE.cp.len[kind] || 3.6))), th = Math.atan2(z1 - z0, x1 - x0);
  const ry = -th + (LONG_Z.has(kind) ? Math.PI / 2 : 0), out = []; for(let i = 0; i < n; i++){ const t = (i + 0.5) / n, b = put(kind, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, ry, tag, tag); if(b) out.push(b); } return out; }
// a point along a chord, pushed o m outward (away from our base); and the chord's frame there (v outward, u along it)
function onChord(ch, t, o = 0){ const [x0, z0] = ch.at(t), r = Math.hypot(x0, z0) || 1; return [x0 + x0 / r * o, z0 + z0 / r * o, Math.atan2(z0, x0)]; }
const claimed = (x, z, pad) => ZONES.some(q => q.kind !== 'belt' && Math.hypot(q.x - x, q.z - z) < q.r + pad);   // (its own belt claim does not count against it)
const okBelt = (x, z) => homeClear(x, z, 2) && !claimed(x, z, 2) && !fortNear(x, z, DEFENSE.belt.fortPad);
const inGap = (ch, t) => ch.gaps.some(g => Math.abs(t - g) < DEFENSE.laneW / 2 / ch.len);

// ---------- the styles along a chord ----------
const BELT = {
  ring(ch){ const B = DEFENSE.belt, kinds = B.kinds[BIOME.name] || B.kinds._, n = Math.max(2, Math.round(ch.len / B.step));
    for(let row = 0; row < 2; row++){ let run = irnd(B.run); for(let i = 0; i <= n; i++){ const t = (i + (row ? 0.5 : 0)) / n; if(t > 1) break; if(run <= 0){ i += irnd(B.hole) - 1; run = irnd(B.run); continue; } run--;
      if(inGap(ch, t)) continue; const [x, z] = onChord(ch, t, row * B.row + Math.sin(t * 9 + ch.len) * B.wob * 0.25); if(okBelt(x, z)) put(pick(kinds), x, z, rnd(0, TAU), 'belt', 'belt'); } } },
  line(ch){ const L = DEFENSE.line, n = Math.max(2, Math.round(ch.len / L.step)); let last = -1;   // DESERT: one dense row of teeth, a domed pillbox behind it every pill m
    for(let i = 0; i <= n; i++){ const t = i / n; if(inGap(ch, t)) continue; const [x, z, a] = onChord(ch, t, 0); if(!okBelt(x, z)) continue; put('teeth', x, z, rnd(0, TAU), 'belt', 'belt');
      if((t - last) * ch.len > L.pill){ const [px, pz] = onChord(ch, t, 9); if(sp(L.box, px, pz, -a - Math.PI / 2, L.boxS, 'pill')){ last = t; post(...onChord(ch, t, 13).slice(0, 2), a, 'pillbox'); } } } },
  hedgehog(ch){ const H = DEFENSE.hedge, n = Math.max(2, Math.round(ch.len / H.step));
    for(let i = 0; i <= n; i++){ const t = i / n; if(inGap(ch, t)) continue; const [x, z, a] = onChord(ch, t, rnd(-2, 2)), at = frame(x, z, a); for(const [u, v] of H.tri){ const [px, pz] = at(u, v); if(okBelt(px, pz)) put('hedgehog', px, pz, rnd(0, TAU), 'belt', 'belt'); } } },
  containers(ch){ const K = DEFENSE.crate, n = Math.max(1, Math.round(ch.len / K.len));
    for(let i = 0; i < n; i++){ const t = (i + 0.5) / n; if(inGap(ch, t)) continue; const [x, z] = onChord(ch, t, 2); if(!okBelt(x, z)) continue; const b = put('container', x, z, -ch.th(t) + Math.PI / 2, 'belt', 'belt'); if(b && Math.random() < K.stack) stack(b); } },
  curtain(ch){ const W = DEFENSE.curtain, g = DEFENSE.laneW / 2 / ch.len, cuts = [0, ...ch.gaps.flatMap(q => [q - g, q + g]), 1];   // between the gaps: whole wall sections, each along the line where it stands
    for(let k = 0; k < cuts.length; k += 2){ const t0 = cuts[k], t1 = cuts[k + 1], free = (t1 - t0) * ch.len, n = Math.max(1, Math.round(free / W.w)), s = free / n / W.w;
      for(let i = 0; i < n; i++){ const t = t0 + (t1 - t0) * (i + 0.5) / n, [x, z] = onChord(ch, t, 1); if(okBelt(x, z)) sp(W.k, x, z, -ch.th(t), s, 'belt'); } } },
  bocage(ch){ const H = DEFENSE.bocage, n = Math.max(2, Math.round(ch.len / H.step));
    for(let i = 0; i <= n; i++){ const t = i / n; if(inGap(ch, t)) continue; const [x, z] = onChord(ch, t, rnd(-0.8, 0.8)); if(!okBelt(x, z)) continue;
      if(i % 2 === 0) sp(pick(H.trees), x, z, rnd(0, TAU), rnd(H.s[0], H.s[1]), 'belt'); else put(H.bank, x, z, -ch.th(t), 'belt', 'belt'); } },
  lava(ch){ const L = DEFENSE.lava, n = Math.max(1, Math.round(ch.len / L.step));
    for(let i = 0; i < n; i++){ const t = (i + 0.5) / n; if(inGap(ch, t)) continue; const [x, z] = onChord(ch, t, (i % 2 ? 3 : -3)); if(!okBelt(x, z)) continue; sp('lava_crater', x, z, rnd(0, TAU), rnd(L.s[0], L.s[1]), 'belt');
      if(t + 0.5 / n > 1) continue; const [rx, rz] = onChord(ch, t + 0.5 / n, rnd(-5, 5)); if(okBelt(rx, rz) && !inGap(ch, t + 0.5 / n)) sp(pick(L.rocks), rx, rz, rnd(0, TAU), rnd(0.8, 1.4), 'belt'); } } };
// a container's second box on top (as the lone stacks): its own paint, half again its strength
function stack(b){ const up = new THREE.Mesh(b.mesh.geometry, coverMat('container').clone()); up.material.userData.own = true; up.position.set(rnd(-0.06, 0.06), 2.0, rnd(-0.2, 0.2)); up.rotation.y = rnd(-0.06, 0.06);
  up.castShadow = up.receiveShadow = true; up.userData.kind = 'container'; coverVariant(up); trackCover(up); b.mesh.add(up); b.hp *= 1.6; b.maxHp = b.hp; }

// ---------- the styles of their own ----------
// QUARRY: rows of T-wall runs at stepped radii, the gaps of one row behind the walls of the next
function terraces(){ const T = DEFENSE.terraces;
  for(let row = 0; row < T.rows; row++){ const r = DEF.rb + row * T.gap, per = (T.run + T.hole) / r; for(let a = E - T.span + (row % 2) * per / 2; a < E + T.span; a += per){ const c = a + T.run / 2 / r, x = Math.cos(c) * r, z = Math.sin(c) * r;
    if(!okBelt(x, z) || fieldR(c) - r < 12) continue; const at = frame(x, z, c); if(wall('concrete', at, -T.run / 2, 0, T.run / 2, 0, 'belt').length > 2) post(...at(rnd(-T.run / 3, T.run / 3), 1.6), c, 'terrace'); } } }
// SAVANNA: strongpoints on the open plain — a ring of sandbags round a guard tower, open to the rear, two ambush U's on its flanks
function kopjes(){ const K = DEFENSE.kopje, n = Math.round(K.n[Math.min(K.n.length - 1, S.stage - 1)] * (MOBILE ? 0.6 : 1)), got = [];
  for(let t = 0; t < n * 40 && got.length < n; t++){ const a = rnd(-Math.PI, Math.PI); if(Math.abs(dA(a, SPAWN)) < DEFENSE.belt.spawnGap) continue; const r = rnd(DEF.rb + 6, fieldR(a) - 18), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if(r < DEF.rb + 6 || !okBelt(x, z) || got.some(g => Math.hypot(g[0] - x, g[1] - z) < K.gap) || blocks.some(b => Math.hypot(b.x - x, b.z - z) < (b.r || 2) + K.ring + 3)) continue;
    got.push([x, z]); const at = frame(x, z, a);
    for(let i = 0; i < K.bags; i++){ const q = (i + 0.5) / K.bags * TAU; if(Math.abs(dA(q, Math.PI)) < 0.5) continue; const [px, pz] = at(Math.sin(q) * K.ring, -Math.cos(q) * K.ring); put('sandbag', px, pz, -Math.atan2(pz - z, px - x) - Math.PI / 2, 'kopje', 'kopje'); }   // (the gap at v+ = the rear)
    buildTower(x, z); for(const u of [-2.2, 2.2]) post(...at(u, -2.6), a, 'kopje');
    for(const sd of [-1, 1]){ const [cx, cz] = at(sd * 15, -4); crescent(cx, cz, a); } }
  DEF.kopjes = got; }
// RUINS: nests in the ruins themselves — a U at the side of each ruin that faces our base, a sniper's broken tower beside a few
function pockets(){ const P = DEFENSE.pockets; let towers = 0;
  for(const p of SCENE.pieces.filter(q => P.keys.includes(q.k))){ const d = Math.hypot(p.x, p.z) || 1, a = Math.atan2(p.z, p.x); if(Math.abs(dA(a, SPAWN)) < DEFENSE.belt.spawnGap || d < DEF.rb) continue;
    const off = (p.r || 6) + 5, x = p.x - p.x / d * off, z = p.z - p.z / d * off; crescent(x, z, a);
    if(towers < P.towers){ const tx = p.x + Math.cos(a + 1.3) * off, tz = p.z + Math.sin(a + 1.3) * off; if(inField(tx, tz, 4) && !blocks.some(b => Math.hypot(b.x - tx, b.z - tz) < (b.r || 2) + 3)){ buildTower(tx, tz, P.tower); towers++; } } } }
// CITY: the crossings toward the enemy are checkpoints (on the road that leads in), their side streets barricaded
function streets(){ const T = DEFENSE.streets, got = [];
  const cand = CITY_XING.map(c => ({ ...c, d:Math.hypot(c.x, c.z), a:Math.atan2(c.z, c.x) })).filter(c => c.d > DEF.rb - 6 && c.d < fieldR(c.a) - 14 && Math.abs(dA(c.a, SPAWN)) > DEFENSE.belt.spawnGap).sort((p, q) => Math.abs(dA(p.a, E)) - Math.abs(dA(q.a, E)));
  for(const c of cand){ if(got.length >= T.n * (MOBILE ? 0.5 : 1) || got.some(g => Math.hypot(g.x - c.x, g.z - c.z) < T.gap)) continue; got.push(c);
    const ax = Math.abs(c.x) > Math.abs(c.z), a = ax ? (c.x > 0 ? 0 : Math.PI) : (c.z > 0 ? Math.PI / 2 : -Math.PI / 2);   // the road that runs out toward the enemy
    lane(a, c.x, c.z); const side = a + Math.PI / 2;
    for(const sd of [-1, 1]){ const w = (ax ? c.wz : c.wx) / 2 + 6, bx = c.x + Math.cos(side) * sd * w, bz = c.z + Math.sin(side) * sd * w; sp(pick(T.block), bx, bz, -side, 1, 'barricade'); } }   // (across each side street)
  DEF.xings = got; }

// ---------- checkpoints and positions ----------
// a checkpoint closing a lane, in the lane's frame (v toward the enemy): the walls, its tower behind; CITADEL: the curtain's gatehouse instead
function checkpoint(L){ const P = DEFENSE.cp, at = frame(L.x, L.z, L.a);
  if(DEF.style === 'curtain' && !DEF.river){ sp(DEFENSE.curtain.gate, L.x, L.z, -L.a - Math.PI / 2, DEFENSE.curtain.gateS, 'gate'); for(const u of [-3, 3]) post(...at(u, 6), L.a, 'gate'); return; }
  for(const [kind, u0, v0, u1, v1] of P.walls) wall(DEF.style === 'containers' && kind === 'concrete' ? 'container' : kind, at, u0, v0, u1, v1, 'cp');
  { const [x, z] = at(P.tower[0], P.tower[1]); if(inField(x, z, 4) && !blocks.some(b => Math.hypot(b.x - x, b.z - z) < (b.r || 2) + 3)) buildTower(x, z); }
  for(const [u, v, what] of P.posts) post(...at(u, v), L.a, what);
  if(DEF.river) for(const sd of [-1, 1]) for(let k = 0; k < P.wing; k++){ const [x, z] = at(sd * (P.r * 0.75 + k * DEFENSE.belt.step), -2 + (k % 2) * 2); put('teeth', x, z, rnd(0, TAU), 'wing'); } }
// a fighting position: a U of cover (DEFENSE.pos.walls), face and arms toward our base (bearing a points away from it), its stores and its men behind
function crescent(x, z, a){ const P = DEFENSE.pos, kinds = P.kinds[BIOME.name] || P.kinds._; if(!inField(x, z, 6) || !homeClear(x, z, 4) || claimed(x, z, 4) || fortNear(x, z, P.fortPad) || blocks.some(b => Math.hypot(b.x - x, b.z - z) < (b.r || 2) + 4)) return false;
  const kind = pick(kinds), at = frame(x, z, a);
  for(const [u0, v0, u1, v1] of P.walls) wall(kind, at, u0, v0, u1, v1, 'pos');
  if(Math.random() < P.back){ const [px, pz] = at(rnd(-2, 2), 3.4); put(Math.random() < 0.5 ? 'drums' : 'crates', px, pz, rnd(0, TAU), 'pos'); }
  for(const u of [-1.6, 1.6]) post(...at(u, 1.3), a, 'pos');
  DEF.positions.push([x, z]); return true; }
// the depth: more positions between the ring and the fence, away from each other
function positions(){ const P = DEFENSE.pos, n = Math.round(P.n[Math.min(P.n.length - 1, S.stage - 1)] * (MOBILE ? P.mobileK : 1)); let got = 0;
  for(let t = 0; t < n * 40 && got < n; t++){ const a = rnd(-Math.PI, Math.PI); if(Math.abs(dA(a, SPAWN)) < DEFENSE.belt.spawnGap) continue;
    const r = rnd(DEF.rb + 14, fieldR(a) - 12); if(r <= DEF.rb + 14) continue; const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if(DEF.positions.some(g => Math.hypot(g[0] - x, g[1] - z) < P.gap) || inZone(x, z, P.pad)) continue; if(crescent(x, z, a)) got++; } }

export function buildDefense(){ if(!DEFENSE.on || !DEF.rb) return; DEF.posts.length = 0; DEF.positions.length = 0; DEF.pieces = []; const st = DEF.style, C = DEFENSE.biomes[BIOME.name] || {};
  if(st === 'streets') streets();
  if(C.belt !== false && CHORDS.has(st)) for(const ch of DEF.chords.filter(c => !c.short)){ BELT[st](ch);
    for(const t of [rnd(0.16, 0.34), rnd(0.66, 0.84)]){ const [x, z, a] = onChord(ch, t, rnd(9, 14)); crescent(x, z, a); } }   // its fighting positions, behind it either side of the lane
  if(st === 'terraces') terraces(); if(st === 'kopje') kopjes(); if(st === 'pockets') pockets();
  for(const L of DEF.cps) checkpoint(L);
  positions(); }
// the men at their posts (after the stage's other garrisons): riflemen, the odd RPG from stage 2, each holding his spot behind his cover
export function garrisonDefense(){ const G = DEFENSE.garrison, cap = Math.round(G.max[Math.min(G.max.length - 1, S.stage - 1)] * (MOBILE ? G.mobileK : 1)); DEF.garrison.length = 0;
  const L = DEF.posts.slice().sort(() => Math.random() - 0.5).sort((p, q) => (q.what === 'mg') - (p.what === 'mg'));   // the MG nests manned first
  for(const p of L){ if(DEF.garrison.length >= cap) break; const e = spawnEnemy(S.stage >= 2 && Math.random() < G.rpg ? 'rpg' : 'rifle', p.x, p.z); if(!e) continue;
    e.guard = { kind:'post' }; e.post = [p.x, p.z]; e.loot = Math.random() < G.loot; DEF.garrison.push(e); } }
