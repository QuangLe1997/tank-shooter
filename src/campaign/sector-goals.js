// campaign/sector-goals.js — SECTOR 2 THE FOUR NEW SECTOR MISSIONS (config.js SECTOR.types · the run and its flow: campaign/sectors.js). Each is a start (what it puts on the
//   field once the sector's fight goes live), a tick every frame of play (its state, its progress g.k 0…1 for the climax and the rail, its clock g.clock, its line g.sub for the
//   rail's objective text — the top band, never the aim zone) returning 'won', a reason (the sector lost: the run replays it from its checkpoint) or nothing, and a clear.
//   · RESCUE: a hostage kneels in a walled cell (four solid walls, a doorway) with guards posted round it; the guards down, stand by him `free` s and he follows at a walk;
//     bring him into the evacuation ring at the sector's start. Enemies who know about us within fireR m of him wound him (the crossfire): his death loses the sector.
//   · BREACH: the field's strongest gate is thickened gateK × (only a charge, the launcher's shells or a rocket really tell); the gate down, the yard is cleared and the fort
//     falls (world/fortress.js: its garrison, its keeper) — before the clock runs out.
//   · INFILTRATE: night (campaign/sectors.js rebuild turns the hour); no waves while unseen; reach the target and plant the charge (plant s within plantR m) and it goes up.
//     A full ALARM (game/quiet.js QUIET.alarmN) turns it into HOLD UNTIL EVAC: holdT s of waves, then a helicopter waits at a landing zone wait s — be in its ring board s.
//   · PURSUIT: a convoy of trucks drives a trail (world/trails.js TRAIL.paths, else a road laid across the field) to its way out; every truck burnt before one gets there.
//     A truck takes rounds like a wall piece (world/cover.js damageBlock → its hit), burns, and its crew bails out.
//   Everything here is taken off the field by sectorGoalClear (the next sector's rebuild, a replay, the battle's end).
import * as THREE from 'three';
import { BAL, SECTOR, TROOPS, HUDUX } from '../../config.js';
import { BIOME, COVER_K, COVER_SET, CONTAINER_PAINT, SECT, buildObjective, buildTower, camera, coverGeo, coverVariant, crushables, makeCoverMesh, ncBattle, ncHit, BUMPS } from '../hub.js';   // SECTOR 3
import { ARENA, FORTS, OBJ, QUIET, S, TRAIL, UGRID, WAVE, animateSoldier, bigExplode, blocks, buildTransport, clampFieldXZ, damageObjective, edgeEntry, edgeNote, enemies, fieldEdgePoint,
  fireball, guardsLeft, heightAt, holoRing, inField, makeSoldierMesh, makeTruck, radio, ringPulse, scene, sfx, soldierKneel, spawnEnemy, spawnGuards, spawnSquad, svgBadgeTex } from '../hub.js';

const Y = SECTOR.types, SAY = SECTOR.say, _pt = { x:0, y:0, z:0 };
const fill = (t, o) => String(t ?? '').replace(/\{(\w+)\}/g, (m, k) => o && o[k] != null ? o[k] : '');
const clock = s => { s = Math.max(0, Math.ceil(s)); return ((s / 60) | 0) + ':' + String(s % 60).padStart(2, '0'); };
// what the goals hold on the field (probes read it): the cell's walls and hostage, the convoy, the helicopter, the markers
export const SGOAL = { g:null, cell:null, man:null, trucks:[], heli:null, props:[], marks:[] };

// ---- markers: up to two rings with a badge (made once, moved, hidden) ----
// SECTOR 3 small (the side missions' ring at most, a badge of 1.5 m) and, in a battle, faded to a ghost while it stands inside the aim zone (ui/nocenter.js ncHit)
const _mv = new THREE.Vector3();
function mark(i, x, z, r, icon, col, h){ let M = SGOAL.marks[i]; if(!M){ const ring = holoRing(6, { kind:'ally', depthTest:true }), badge = new THREE.Sprite(new THREE.SpriteMaterial({ transparent:true, depthWrite:false }));
    badge.scale.set(SECTOR.mark.badge, SECTOR.mark.badge, 1); scene.add(ring); scene.add(badge); M = SGOAL.marks[i] = { ring, badge, icon:'' }; }
  if(M.icon !== icon + col){ M.icon = icon + col; M.badge.material.map = svgBadgeTex(icon, col); M.badge.material.needsUpdate = true; }
  const gy = heightAt(x, z), by = gy + (h || SECTOR.mark.y) + Math.sin(performance.now() / 450) * 0.15; M.ring.visible = M.badge.visible = true; M.ring.position.set(x, gy + 0.12, z); M.ring.scale.setScalar(Math.min(r, SECTOR.mark.ring) / 6); M.badge.position.set(x, by, z);
  _mv.set(x, by, z).project(camera); const sx = (_mv.x + 1) / 2 * innerWidth, sy = (1 - _mv.y) / 2 * innerHeight, q = SECTOR.mark.badge * 14;
  { const k = Math.min(SECTOR.mark.badge, HUDUX.mark.px / Math.max(200, innerHeight) * 2 * camera.position.distanceTo(M.badge.position) * Math.tan(camera.fov * Math.PI / 360)); M.badge.scale.set(k, k, 1); }   // HUDUX at most HUDUX.mark.px on the screen (it grew to ~100 px near)
  M.badge.material.opacity = ncBattle() && _mv.z < 1 && ncHit(sx - q, sy - q, sx + q, sy + q) || ncBattle() && sy < HUDUX.mark.top ? SECTOR.mark.ghost : 1; }   // (HUDUX faint under the top HUD band too)
function unmark(i){ const M = SGOAL.marks[i]; if(M) M.ring.visible = M.badge.visible = false; }
// a spot d0…d1 m from him, inside the field with m to spare, clear of anything solid; ahead (toward the enemy's side) when it can
function spot(d0, d1, m){ const p = S.player;
  for(let k = 0; k < 60; k++){ const a = Math.PI + (Math.random() - 0.5) * (k < 30 ? 1.6 : 6.28), d = d0 + Math.random() * (d1 - d0), x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d;
    if(!inField(x, z, m)) continue; let ok = true; for(let i = 0; i < blocks.length && ok; i++){ const b = blocks[i], r = (b.r || 1) + m; ok = (b.x - x) ** 2 + (b.z - z) ** 2 >= r * r; } if(ok) return [x, z]; }
  const [x, z] = clampFieldXZ(p.pos.x, p.pos.z - (d0 + d1) / 2, m); return [x, z]; }
// a squad sent at (x, z) over the nearest edge out of his sight; the men told where to go (their search of the last known place does the walking)
export function sectorSquad(x, z){ const e = edgeEntry(Math.atan2(z, x), 1.2); if(!e) return 0; const n0 = enemies.length; spawnSquad({ x:e.x, z:e.z, how:'edge' });
  for(let i = n0; i < enemies.length; i++){ const m = enemies[i]; if(m.lk){ m.lk.x = x + (Math.random() - 0.5) * 6; m.lk.z = z + (Math.random() - 0.5) * 6; m.srAt = 0; } } return enemies.length - n0; }
const alerted = (x, z, R) => { let n = 0; const r2 = R * R; for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(e.def.inf && e.alert >= 2 && e.hp > 0 && (e.pos.x - x) ** 2 + (e.pos.z - z) ** 2 < r2) n++; } return n; };

// ---- RESCUE ----
// SECTOR 3 THE CELL FROM THE FIELD'S OWN PIECES: two shipping containers side by side (the real boxes the field's lone containers wear, painted the same), the pen
//   between them walled at the back with the land's own heavy piece (HESCO / cast concrete / jersey) and the hostage kneeling inside; sandbag nests flank the open end
//   and a guard post (the land's watchtower) stands over it. Every piece is the field's ordinary cover — the real model once loaded, the same collider; the
//   containers hold (wallHp: nothing short of a sustained barrage brings one down) so the pen keeps its walls through the fight.
function pen(x, z, face, K){ const out = [], c = Math.cos(face), s = Math.sin(face), W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const SET = COVER_SET[BIOME.name] || COVER_SET.DESERT, back = ['hesco', 'concrete', 'jersey'].find(k => SET[1].includes(k)) || 'concrete', bag = SET[0].includes('sandbag') ? 'sandbag' : SET[0][0];
  const box = k => { const g = coverGeo(k), b = g.boundingBox || (g.computeBoundingBox(), g.boundingBox); return { hw:(b.max.x - b.min.x) / 2 * COVER_K, hl:(b.max.z - b.min.z) / 2 * COVER_K }; };
  const C = box('container'), gap = K.gap;
  const put = (kind, lx, lz, rot, o) => { const [wx, wz] = W(lx, lz), m = makeCoverMesh(kind, true); if(kind === 'container'){ m.material.color.setHex(CONTAINER_PAINT[(Math.random() * CONTAINER_PAINT.length) | 0]); coverVariant(m); }
    m.scale.setScalar(COVER_K); m.position.set(wx, heightAt(wx, wz) - 0.05, wz); m.rotation.y = face + rot; scene.add(m);
    const b = Object.assign({ mesh:m, x:wx, z:wz, r:(o && o.r) || 1.6 * COVER_K, hp:K.wallHp, maxHp:K.wallHp, steel:true, heavy:true, cover:true, ms:COVER_K, loot:false, kind, pen:true }, o || {}); blocks.push(b); out.push(b); return b; };
  for(const sd of [-1, 1]) put('container', sd * (gap / 2 + C.hw), 0, 0, { r:C.hl * 0.8, obb:{ f:face, hw:C.hw, hl:C.hl } });   // the two boxes, their long sides the pen's walls
  const B = box(back); put(back, 0, -C.hl + B.hw * 0.6, Math.PI / 2, { r:Math.max(B.hw, B.hl) * 0.9, obb:{ f:face + Math.PI / 2, hw:B.hw, hl:Math.max(B.hl, gap / 2 + 0.3) } });   // the back closed
  for(const sd of [-1, 1]) put(bag, sd * (gap / 2 + C.hw * 2 + 1.4), C.hl + 1.2, sd * 0.5, { hp:220, maxHp:220, steel:false, heavy:false });   // the guards' sandbag nests at the open end
  const [tx, tz] = W((Math.random() < 0.5 ? -1 : 1) * (gap / 2 + C.hw * 2 + 6), -C.hl - 3); if(inField(tx, tz, 4)) buildTower(tx, tz);   // the guard post over it
  UGRID.blkAt = 0; return { blocks:out, inner:W(0, -C.hl * 0.35), depth:C.hl }; }
function rescueStart(g, c, now){ const K = g.Y, p = S.player, [x, z] = spot(K.d[0], K.d[1], K.clear), face = Math.atan2(p.pos.x - x, p.pos.z - z);
  SGOAL.cell = pen(x, z, face, K); const [ix, iz] = SGOAL.cell.inner, m = makeSoldierMesh(); m.scale.setScalar(TROOPS.look.scale); m.userData.gun.visible = false; m.position.set(ix, heightAt(ix, iz), iz); m.rotation.y = face; soldierKneel(m, true); scene.add(m);
  SGOAL.man = m; g.x = x; g.z = z; g.zone = { x, z, r:SGOAL.cell.depth + K.ring }; spawnGuards(g.zone, K.guards, K.rpg); g.home = { x:p.pos.x, z:p.pos.z };
  g.who = K.who[c.obj] || K.who.civ; g.ph = 'held'; g.hp = K.hp; g.free = 0; g.clock = K.time; g.hx = ix; g.hz = iz; }
function rescueTick(g, dt, now){ const K = g.Y, p = S.player, m = SGOAL.man; if(!m) return 'CON TIN MẤT TÍCH'; g.clock -= dt;
  const hit = alerted(g.hx, g.hz, K.fireR); if(hit && (g.ph !== 'held' || guardsLeft(g.zone) < K.guards)) g.hp -= hit * K.dps * dt;   // the crossfire (once the shooting has started round him)
  if(g.hp <= 0){ soldierKneel(m, false); m.rotation.x = -Math.PI / 2; m.position.y = heightAt(g.hx, g.hz) + 0.25; SGOAL.props.push(m); SGOAL.man = null; return fill(SAY.rescueDead, { who:g.who }).toLocaleUpperCase('vi'); }
  if(g.clock <= 0) return 'HẾT GIỜ';
  const d = Math.hypot(p.pos.x - g.hx, p.pos.z - g.hz), hpTx = Math.max(0, Math.round(g.hp / K.hp * 100)) + '%';
  if(g.ph === 'held'){ const left = guardsLeft(g.zone); mark(0, g.hx, g.hz, 3, 'heart', '#7fd0ff', 4.2);
    if(!left && d < K.reach){ g.free += dt; g.sub = fill(SAY.rescueFree, { who:g.who }); if(g.free >= K.free){ g.ph = 'follow'; soldierKneel(m, false); sfx('powerup'); edgeNote(fill(SAY.rescueGo, { who:g.who }).toLocaleUpperCase('vi'), '#9be04a'); radio('SCH: ' + fill(SAY.rescueGo, { who:g.who })); } }
    else { g.free = Math.max(0, g.free - dt); g.sub = left ? fill(SAY.rescueGuards, { n:left, who:g.who }) : fill(SAY.rescueReach, { who:g.who, m:Math.round(d) }); }
    g.k = 0.45 * (1 - left / Math.max(1, K.guards)) + 0.05 * Math.min(1, g.free / K.free); return null; }
  // following: a walk behind him (never through the cell's walls — out by the doorway first)
  unmark(0); mark(1, g.home.x, g.home.z, K.evacR, 'flag', '#9be04a');
  const tx = p.pos.x - Math.sin(p.facing || 0) * K.follow, tz = p.pos.z - Math.cos(p.facing || 0) * K.follow, mx = tx - g.hx, mz = tz - g.hz, md = Math.hypot(mx, mz), st = md > 0.6 ? Math.min(md - 0.5, K.walk * dt) : 0;
  if(st > 0){ g.hx += mx / md * st; g.hz += mz / md * st; m.rotation.y = Math.atan2(mx, mz); } m.position.set(g.hx, heightAt(g.hx, g.hz), g.hz); animateSoldier(m, st, dt, false);
  const de = Math.hypot(g.hx - g.home.x, g.hz - g.home.z); g.k = 0.5 + 0.5 * Math.max(0, 1 - de / Math.max(1, g.d0 || (g.d0 = de)));
  g.sub = fill(SAY.rescueWalk, { who:g.who, m:Math.round(de), hp:hpTx });
  return de < K.evacR ? 'won' : null; }

// ---- BREACH ----
function breachStart(g, c, now){ const K = g.Y; let f = null; for(const q of FORTS){ if(q.captured || !q.gate || q.breached) continue; if(!f || q.tier > f.tier || q.tier === f.tier && Math.hypot(q.x - S.player.pos.x, q.z - S.player.pos.z) < Math.hypot(f.x - S.player.pos.x, f.z - S.player.pos.z)) f = q; }
  g.f = f; g.clock = K.time; if(!f){ SECT.forceObj = K.fallback; buildObjective(); g.door = OBJ; g.gh = OBJ ? OBJ.b.maxHp : 1; return; }   // SECTOR 3 no gated fort stood on this field (a crowded one): the bunker's door is the gate — never a sector won by default
  const b = f.gate, h0 = b.maxHp || b.hp; b.maxHp = Math.max(h0, Math.min(h0 * K.gateK, K.gateMax)); b.hp = b.maxHp; g.gh = b.maxHp; g.u0 = 0; }   // (a gate a fort's threat already thickened stays as it is)
function breachTick(g, dt, now){ const K = g.Y, f = g.f; g.clock -= dt;
  if(!f){ const O = g.door; if(!O || !O.alive) return 'won'; if(g.clock <= 0) return 'HẾT GIỜ'; g.k = Math.max(0, 1 - O.b.hp / g.gh); g.sub = fill(SAY.breachDoor, { hp:Math.max(0, Math.round(O.b.hp / g.gh * 100)) }); mark(0, O.b.x, O.b.z, 5, 'bolt', '#ffb24a'); return null; }   // SECTOR 3 (the door down: in)
  if(f.captured) return 'won'; if(g.clock <= 0) return 'HẾT GIỜ';
  if(!f.breached){ const b = f.gate; g.k = 0.5 * Math.max(0, 1 - b.hp / g.gh); g.sub = fill(SAY.breachGate, { hp:Math.max(0, Math.round(b.hp / g.gh * 100)) }); mark(0, f.gx, f.gz, 5, 'bolt', '#ffb24a'); return null; }
  unmark(0); const U = f.units || [], alive = U.reduce((n, e) => n + (enemies.includes(e) && e.hp > 0 ? 1 : 0), 0); g.u0 = Math.max(g.u0 || 1, alive);   // (a garrison topped up raises the count)
  g.k = 0.5 + 0.45 * (1 - alive / g.u0); g.sub = alive ? fill(SAY.breachYard, { n:alive }) : SAY.breachKeep; mark(1, f.x, f.z, Math.min(14, f.R || 10), 'flag', '#ffb24a'); return null; }

// ---- INFILTRATE ----
function infilStart(g, c, now){ const K = g.Y; g.al0 = QUIET.alarmN; g.ph = 'sneak'; g.clock = K.time; g.plant = 0; g.d0 = OBJ ? Math.hypot(OBJ.b.x - S.player.pos.x, OBJ.b.z - S.player.pos.z) : 1;
  WAVE.betweenUntil = 1e12; WAVE.active = false; WAVE.spawnQueue.length = 0; g.home = { x:S.player.pos.x, z:S.player.pos.z }; }   // no waves while he is unseen
function alarmed(g, now){ const K = g.Y, p = S.player; g.ph = 'hold'; g.clock = K.holdT; WAVE.betweenUntil = now + 2; sectorSquad(p.pos.x, p.pos.z); sfx('alarm');
  edgeNote(SAY.infilAlarm, '#ff7a5a'); radio('SCH: ' + SAY.infilAlarmR); }
function infilTick(g, dt, now){ const K = g.Y, p = S.player; g.clock -= dt;
  if(g.ph === 'sneak'){ if(QUIET.alarmN > g.al0){ alarmed(g, now); return null; } if(g.clock <= 0) return 'HẾT GIỜ'; if(!OBJ) return 'won';
    if(!OBJ.alive) return 'won'; const d = Math.hypot(OBJ.b.x - p.pos.x, OBJ.b.z - p.pos.z) - (OBJ.def ? OBJ.def.r * 1.5 : 4); mark(0, OBJ.b.x, OBJ.b.z, 6, 'bolt', '#9fd0ff');
    if(d < K.plantR){ g.plant += dt; g.sub = fill(SAY.infilPlant, { s:Math.max(0, Math.ceil(K.plant - g.plant)) }); if(g.plant >= K.plant){ damageObjective(OBJ.b, OBJ.b.hp + 1); return 'won'; } }
    else { g.plant = Math.max(0, g.plant - dt * 0.5); g.sub = fill(SAY.infilGo, { m:Math.round(Math.max(0, d)) }); }
    g.k = 0.4 * Math.max(0, 1 - Math.max(0, d) / Math.max(1, g.d0)) + 0.6 * (g.plant / K.plant); return null; }
  unmark(0);
  if(g.ph === 'hold'){ g.k = 0.5 + 0.3 * (1 - g.clock / K.holdT); g.sub = SAY.infilHold; if(g.clock > 0) return null;   // the helicopter comes
    const [x, z] = spot(K.lzD[0], K.lzD[1], 6); g.lz = { x, z }; g.ph = 'lz'; g.clock = K.wait; if(!SGOAL.heli){ SGOAL.heli = buildTransport(); scene.add(SGOAL.heli); } SGOAL.heli.visible = true; g.hy = 30; g.board = 0;
    edgeNote(SAY.infilHeli, '#9be04a'); radio('SCH: ' + SAY.infilHeliR); return null; }
  const H = SGOAL.heli, L = g.lz; g.hy = Math.max(2.2, g.hy - dt * 9); H.position.set(L.x, heightAt(L.x, L.z) + g.hy, L.z); const rt = H.userData.rotors; if(rt) for(let i = 0; i < rt.length; i++) rt[i].rotation.y += dt * 24;
  mark(1, L.x, L.z, K.lzR, 'flag', '#9be04a'); const d = Math.hypot(p.pos.x - L.x, p.pos.z - L.z); if(d < K.lzR) g.board += dt; else g.board = Math.max(0, g.board - dt);
  g.k = 0.8 + 0.2 * (g.board / K.board); g.sub = fill(SAY.infilBoard, { m:Math.round(Math.max(0, d - K.lzR)) });
  if(g.board >= K.board) return 'won'; return g.clock <= 0 ? SAY.infilLeft : null; }

// ---- PURSUIT ----
// the convoy's road: the longest trail long enough, driven from its end nearer to him; else one laid across the field from a flank to the enemy's far edge
// SECTOR 3 every trail long enough and a road laid across the field are the candidates; the one with the fewest solid things the road clearing may not take
//   (a fort's wall, a building, a ruin, our own compound) within the trucks' width wins — a long one on a tie
function blockers(pts, w){ let n = 0; for(const b of blocks){ if(b.cover || ROADOFF.has(b.kind) || b.pen || b.kind === 'convoy') continue; const q = (b.r || 1) + w;
    for(let i = 1; i < pts.length; i++){ const a = pts[i - 1], c = pts[i], dx = c[0] - a[0], dz = c[1] - a[1], L2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((b.x - a[0]) * dx + (b.z - a[1]) * dz) / L2));
      if((a[0] + dx * u - b.x) ** 2 + (a[1] + dz * u - b.z) ** 2 < q * q){ n++; break; } } } return n; }
const lenOf = pts => { let L = 0; for(let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
function laid(){ const sd = Math.random() < 0.5 ? -1 : 1, a = fieldEdgePoint(sd > 0 ? 0.25 : Math.PI - 0.25, 10), b = fieldEdgePoint(sd > 0 ? -Math.PI + 0.7 : -0.7, 10), m = [(Math.random() - 0.5) * ARENA * 0.4, -ARENA * 0.15], pts = [];
  const add = (P, Q) => { const L = Math.hypot(Q[0] - P[0], Q[1] - P[1]), n = Math.max(1, Math.ceil(L / 6)); for(let i = 0; i < n; i++){ const u = i / n; pts.push(clampFieldXZ(P[0] + (Q[0] - P[0]) * u, P[1] + (Q[1] - P[1]) * u, 6)); } };
  add(a, m); add(m, b); pts.push(clampFieldXZ(b[0], b[1], 6)); return pts; }
// SECTOR 3 a road found round them: A* over a grid of cell m squares, a cell shut when a fixed solid (as above, its radius + the trucks' half width) or the fence covers it,
//   from a flank's edge to the enemy's far edge; the cell path thinned to every other point (the trucks' own easing does the rest). null: no way through
function findRoad(w, sd, ja){ const cs = SECTOR.types.pursuit.cell, A = ARENA, N = Math.ceil(2 * A / cs), shut = new Uint8Array(N * N), cx = i => -A + (i + 0.5) * cs;
  for(let j = 0; j < N; j++) for(let i = 0; i < N; i++) if(!inField(cx(i), cx(j), 4)) shut[j * N + i] = 1;
  for(const b of blocks){ if(b.cover || ROADOFF.has(b.kind) || b.pen || b.kind === 'convoy') continue; const R = (b.r || 1) + w, i0 = Math.max(0, Math.floor((b.x - R + A) / cs)), i1 = Math.min(N - 1, Math.floor((b.x + R + A) / cs)), j0 = Math.max(0, Math.floor((b.z - R + A) / cs)), j1 = Math.min(N - 1, Math.floor((b.z + R + A) / cs));
    for(let j = j0; j <= j1; j++) for(let i = i0; i <= i1; i++) if((cx(i) - b.x) ** 2 + (cx(j) - b.z) ** 2 < (R + cs * 0.5) ** 2) shut[j * N + i] = 1; }
  const free = (x, z) => { let bi = -1, bd = 1e9; const i0 = Math.floor((x + A) / cs), j0 = Math.floor((z + A) / cs); for(let j = Math.max(0, j0 - 6); j <= Math.min(N - 1, j0 + 6); j++) for(let i = Math.max(0, i0 - 6); i <= Math.min(N - 1, i0 + 6); i++){ const d = (i - i0) ** 2 + (j - j0) ** 2; if(!shut[j * N + i] && d < bd){ bd = d; bi = j * N + i; } } return bi; };
  const a = fieldEdgePoint((sd > 0 ? 0.25 : Math.PI - 0.25) + ja, 10), z = fieldEdgePoint((sd > 0 ? -Math.PI + 0.7 : -0.7) - ja, 10), s0 = free(a[0], a[1]), s1 = free(z[0], z[1]); if(s0 < 0 || s1 < 0) return null;
  const g = new Float32Array(N * N).fill(1e9), from = new Int32Array(N * N).fill(-1), H = [], hv = [], push = (k, f) => { H.push(k); hv.push(f); let c = H.length - 1; while(c){ const q = (c - 1) >> 1; if(hv[q] <= hv[c]) break; [H[q], H[c]] = [H[c], H[q]]; [hv[q], hv[c]] = [hv[c], hv[q]]; c = q; } };
  const pop = () => { const k = H[0], lk = H.pop(), lv = hv.pop(); if(H.length){ H[0] = lk; hv[0] = lv; let c = 0; for(;;){ const l = 2 * c + 1, r = l + 1; let m = c; if(l < H.length && hv[l] < hv[m]) m = l; if(r < H.length && hv[r] < hv[m]) m = r; if(m === c) break; [H[m], H[c]] = [H[c], H[m]]; [hv[m], hv[c]] = [hv[c], hv[m]]; c = m; } } return k; };
  const ei = s1 % N, ej = (s1 / N) | 0, h = k => Math.hypot(k % N - ei, ((k / N) | 0) - ej); g[s0] = 0; push(s0, h(s0)); let it = 0;
  while(H.length && it++ < N * N * 4){ const k = pop(); if(k === s1) break; const i = k % N, j = (k / N) | 0;
    for(let dj = -1; dj <= 1; dj++) for(let di = -1; di <= 1; di++){ if(!di && !dj) continue; const ni = i + di, nj = j + dj; if(ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const q = nj * N + ni; if(shut[q] || di && dj && (shut[j * N + ni] || shut[nj * N + i])) continue;
      const ng = g[k] + (di && dj ? 1.414 : 1); if(ng < g[q]){ g[q] = ng; from[q] = k; push(q, ng + h(q)); } } }
  if(from[s1] < 0) return null; const cells = []; for(let k = s1; k >= 0; k = from[k]) cells.push(k); cells.reverse();
  return cells.filter((k, n) => n % 2 === 0 || n === cells.length - 1).map(k => [cx(k % N), cx((k / N) | 0)]); }
function road(K){ const p = S.player, w = K.r + 0.6, C = [], s0 = Math.random() < 0.5 ? -1 : 1;
  for(const [sd, ja] of [[s0, 0], [-s0, 0], [s0, 0.35], [-s0, 0.35], [s0, -0.3], [-s0, -0.3]]){ const f = findRoad(w, sd, ja); if(f && f.length >= 3 && lenOf(f) >= K.minL * 0.7){ C.push(f); break; } }   // (both flanks, a few ways in, until one goes through)
  for(const P of TRAIL.paths || []){ const pts = P.pts || P; if(pts && pts.length >= 3 && lenOf(pts) >= K.minL) C.push(pts.map(q => [q[0], q[1]])); }
  for(let k = 0; k < 8; k++) C.push(laid());
  let best = null, bs = 1e9, bn = 0; for(const pts of C){ const n = blockers(pts, w), sc = n * 1000 - lenOf(pts); if(sc < bs){ bs = sc; best = pts; bn = n; } }
  const pts = best; if(Math.hypot(pts[0][0] - p.pos.x, pts[0][1] - p.pos.z) > Math.hypot(pts[pts.length - 1][0] - p.pos.x, pts[pts.length - 1][1] - p.pos.z)) pts.reverse();
  const cum = [0]; for(let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum, L:cum[cum.length - 1], fixed:bn }; }
function along(R, s, out){ s = Math.max(0, Math.min(R.L, s)); let i = 1; while(i < R.cum.length - 1 && R.cum[i] < s) i++; const a = R.pts[i - 1], b = R.pts[i], seg = (R.cum[i] - R.cum[i - 1]) || 1, u = (s - R.cum[i - 1]) / seg;
  out.x = a[0] + (b[0] - a[0]) * u; out.z = a[1] + (b[1] - a[1]) * u; out.a = Math.atan2(b[0] - a[0], b[1] - a[1]); return out; }
const _q = { x:0, z:0, a:0 };
// SECTOR 3 the road cleared before the convoy rolls: loose cover, rocks, wrecks and containers within the trucks' width of it are taken off the field (scene and collider),
//   the scattered stones, bushes and trees on it flattened (their instances zeroed) — the trucks never drive through a solid thing. Forts, towers, buildings stay (the trail skirts them).
const _Z0 = new THREE.Matrix4().makeScale(0, 0, 0), ROADOFF = new Set(['boulder', 'hedgehog', 'container', 'wreck', 'brick']);
function clearRoad(R, w){ const near = (x, z, r) => { const q = r + w; for(let i = 1; i < R.pts.length; i++){ const a = R.pts[i - 1], b = R.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
    if((a[0] + dx * u - x) ** 2 + (a[1] + dz * u - z) ** 2 < q * q) return true; } return false; };
  let n = 0; for(let i = blocks.length - 1; i >= 0; i--){ const b = blocks[i]; if(!(b.cover || ROADOFF.has(b.kind)) || b.pen || !near(b.x, b.z, b.r || 1)) continue;
    blocks.splice(i, 1); if(b.mesh) scene.remove(b.mesh); if(b.bump){ const j = BUMPS.indexOf(b.bump); if(j >= 0) BUMPS.splice(j, 1); } n++; }
  const seen = new Set(); for(const c of crushables){ if(!c.alive || !c.im || !near(c.x, c.z, c.r || 0.5)) continue; c.alive = false; for(const im of [c.im, ...(c.ims || [])]){ im.setMatrixAt(c.k, _Z0); seen.add(im); } n++; }
  for(const im of seen) im.instanceMatrix.needsUpdate = true; UGRID.blkAt = 0; return n; }
function pursuitStart(g, c, now){ const K = g.Y, R = g.R = road(K); g.cleared = clearRoad(R, K.r + 0.6); g.s = K.lead + (K.trucks - 1) * K.gap; g.n = K.trucks; g.burnt = 0;
  for(let k = 0; k < K.trucks; k++){ const m = makeTruck(); scene.add(m); const t = { g:m, s:g.s - k * K.gap, alive:true, b:null };
    t.b = { mesh:m, x:0, z:0, r:K.r, hp:K.hp, maxHp:K.hp, steel:false, loot:false, kind:'convoy', hit:(dmg) => truckHit(g, t, dmg) }; blocks.push(t.b); SGOAL.trucks.push(t); place(t, R); }
  UGRID.blkAt = 0; g.clock = (R.L - g.s) / K.speed; along(R, R.L, _q); g.ex = _q.x; g.ez = _q.z; sectorSquad(g.ex, g.ez); }
function place(t, R){ along(R, t.s, _q); const gy = heightAt(_q.x, _q.z); t.g.position.set(_q.x, gy, _q.z); t.g.rotation.set(0, _q.a, 0); t.b.x = _q.x; t.b.z = _q.z; }
function truckHit(g, t, dmg){ if(!t.alive) return; t.b.hp -= dmg; if(dmg >= BAL.pursuit.stopDmg) t.stopUntil = performance.now() / 1000 + BAL.pursuit.stopT;   /* BAL 4 a charge or a rocket: its tyres gone for a moment */ if(t.b.hp > 0) return; t.alive = false; g.burnt++; const i = blocks.indexOf(t.b); if(i >= 0) blocks.splice(i, 1); UGRID.blkAt = 0;
  _pt.x = t.b.x; _pt.z = t.b.z; bigExplode(_pt, 0xff8a3a, 2.2); fireball(_pt, 1.4); sfx('bigexplode'); t.g.rotation.z = 0.25; SGOAL.props.push(t.g);
  for(let k = 0; k < g.Y.bail; k++) spawnEnemy('rifle', t.b.x + (Math.random() - 0.5) * 5, t.b.z + (Math.random() - 0.5) * 5);   // the crew bails out
  edgeNote(fill(SAY.pursuitBurn, { n:g.n - g.burnt }), '#ffb24a'); }
function pursuitTick(g, dt, now){ const K = g.Y, R = g.R; let lead = -1;
  const P = BAL.pursuit; for(const t of SGOAL.trucks){ if(!t.alive) continue; t.s += now < (t.stopUntil || 0) ? 0 : K.speed * (P.limp + (1 - P.limp) * Math.max(0, t.b.hp) / t.b.maxHp) * dt; place(t, R); if(t.s > lead) lead = t.s; }   // BAL 4 a shot-up truck limps
  if(g.burnt >= g.n) return 'won'; if(lead >= R.L - K.exitR) return SAY.pursuitGone;
  if(((g.ut = (g.ut || 0) + dt)) > 0.4){ g.ut = 0; UGRID.blkAt = 0; }   // (the grid of solid things follows the trucks)
  g.clock = (R.L - lead) / K.speed; g.k = Math.max(g.burnt / g.n, lead / R.L * 0.6); g.sub = fill(SAY.pursuitLeft, { n:g.n - g.burnt, of:g.n });
  for(const t of SGOAL.trucks) if(t.alive){ mark(0, t.b.x, t.b.z, 4, 'bolt', '#ff7a5a'); break; } mark(1, g.ex, g.ez, K.exitR, 'flag', '#ff7a5a'); return null; }

// ---- the climaxes the run asks for (campaign/sectors.js climax: a big event's name, else one of these) ----
export function sectorClimax(ev, g){ const p = S.player; if(ev === 'squad'){ const x = g.hx ?? g.x ?? p.pos.x, z = g.hz ?? g.z ?? p.pos.z; return sectorSquad(x, z) > 0; }
  if(ev === 'patrol'){ const at = OBJ ? OBJ.b : p.pos; spawnGuards({ x:at.x, z:at.z, r:14 }, 3, 0); return true; } return false; }

// ---- the run's calls ----
const GO = { rescue:[rescueStart, rescueTick], breach:[breachStart, breachTick], infiltrate:[infilStart, infilTick], pursuit:[pursuitStart, pursuitTick] };
export const sectorGoalHas = type => !!GO[type];
export function sectorGoalStart(type, c, g, now){ sectorGoalClear(); SGOAL.g = g; g.sub = ''; g.clock = 0; GO[type][0](g, c, now); }
export function sectorGoalTick(g, dt, now){ return GO[g.type][1](g, dt, now); }
export function sectorGoalClock(g){ return g.clock > 0 ? clock(g.clock) : ''; }
export function sectorGoalClear(){ const C = SGOAL.cell; if(C){ for(const b of C.blocks){ scene.remove(b.mesh); const i = blocks.indexOf(b); if(i >= 0) blocks.splice(i, 1); } SGOAL.cell = null; UGRID.blkAt = 0; }   // (the guard post goes with the field's towers)
  if(SGOAL.man){ scene.remove(SGOAL.man); SGOAL.man = null; }
  for(const t of SGOAL.trucks){ scene.remove(t.g); const i = blocks.indexOf(t.b); if(i >= 0) blocks.splice(i, 1); } SGOAL.trucks.length = 0;
  for(const m of SGOAL.props) scene.remove(m); SGOAL.props.length = 0; if(SGOAL.heli) SGOAL.heli.visible = false; for(let i = 0; i < SGOAL.marks.length; i++) unmark(i); SGOAL.g = null; SECT.forceObj = '';
  if(WAVE.betweenUntil >= 1e11) WAVE.betweenUntil = 0; }   // (an infiltration's held waves let go)
// dev / probes: the goal in a line
export function sectorGoalState(){ const g = SGOAL.g; return g ? { type:g.type, ph:g.ph || '', k:+(g.k || 0).toFixed(2), clock:+(g.clock || 0).toFixed(1), sub:g.sub, hp:g.hp, burnt:g.burnt, trucks:SGOAL.trucks.length } : null; }
