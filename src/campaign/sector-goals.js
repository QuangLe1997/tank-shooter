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
import { SECTOR, TROOPS } from '../../config.js';
import { ARENA, FORTS, OBJ, QUIET, S, TRAIL, UGRID, WAVE, animateSoldier, bigExplode, blocks, buildTransport, clampFieldXZ, damageObjective, edgeEntry, edgeNote, enemies, fieldEdgePoint,
  fireball, guardsLeft, heightAt, holoRing, inField, makeSoldierMesh, makeTruck, radio, ringPulse, scene, sfx, soldierKneel, spawnEnemy, spawnGuards, spawnSquad, svgBadgeTex } from '../hub.js';

const Y = SECTOR.types, SAY = SECTOR.say, _pt = { x:0, y:0, z:0 };
const fill = (t, o) => String(t ?? '').replace(/\{(\w+)\}/g, (m, k) => o && o[k] != null ? o[k] : '');
const clock = s => { s = Math.max(0, Math.ceil(s)); return ((s / 60) | 0) + ':' + String(s % 60).padStart(2, '0'); };
// what the goals hold on the field (probes read it): the cell's walls and hostage, the convoy, the helicopter, the markers
export const SGOAL = { g:null, cell:null, man:null, trucks:[], heli:null, props:[], marks:[] };

// ---- markers: up to two rings with a badge (made once, moved, hidden) ----
function mark(i, x, z, r, icon, col){ let M = SGOAL.marks[i]; if(!M){ const ring = holoRing(6, { kind:'ally', depthTest:true }), badge = new THREE.Sprite(new THREE.SpriteMaterial({ transparent:true, depthWrite:false }));
    badge.scale.set(2.6, 2.6, 1); scene.add(ring); scene.add(badge); M = SGOAL.marks[i] = { ring, badge, icon:'' }; }
  if(M.icon !== icon + col){ M.icon = icon + col; M.badge.material.map = svgBadgeTex(icon, col); M.badge.material.needsUpdate = true; }
  const gy = heightAt(x, z); M.ring.visible = M.badge.visible = true; M.ring.position.set(x, gy + 0.12, z); M.ring.scale.setScalar(r / 6); M.badge.position.set(x, gy + 5.4 + Math.sin(performance.now() / 450) * 0.2, z); }
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
let _cm = null;
function cellMat(){ return _cm || (_cm = new THREE.MeshStandardMaterial({ color:0x6e665a, roughness:0.95, metalness:0.02 })); }
function buildCell(x, z, face, K){ const g = new THREE.Group(), R = K.cell / 2, T = 0.5, H = K.wallH, gy = heightAt(x, z), box = new THREE.BoxGeometry(1, 1, 1), out = [];
  const wall = (lx, lz, len, ang) => { const m = new THREE.Mesh(box, cellMat()); m.scale.set(T, H, len); const c = Math.cos(face), s = Math.sin(face), wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;
    m.position.set(wx, gy + H / 2 - 0.15, wz); m.rotation.y = face + ang; m.castShadow = m.receiveShadow = true; g.add(m);
    const b = { mesh:m, x:wx, z:wz, r:len / 2, hp:Infinity, maxHp:Infinity, steel:true, hard:true, heavy:true, loot:false, kind:'cell', obb:{ f:face + ang, hw:T / 2 + 0.06, hl:len / 2 } }; blocks.push(b); out.push(b); };
  wall(-R, 0, K.cell, 0); wall(R, 0, K.cell, 0); wall(0, -R, K.cell, Math.PI / 2);   // three whole sides …
  const side = (K.cell - K.door) / 2; wall(-(K.door / 2 + side / 2), R, side, Math.PI / 2); wall(K.door / 2 + side / 2, R, side, Math.PI / 2);   // … and the front with its doorway (toward him)
  scene.add(g); UGRID.blkAt = 0; return { g, blocks:out }; }
function rescueStart(g, c, now){ const K = g.Y, p = S.player, [x, z] = spot(K.d[0], K.d[1], K.cell), face = Math.atan2(p.pos.x - x, p.pos.z - z);
  SGOAL.cell = buildCell(x, z, face, K); const m = makeSoldierMesh(); m.scale.setScalar(TROOPS.look.scale); m.userData.gun.visible = false; m.position.set(x, heightAt(x, z), z); m.rotation.y = face; soldierKneel(m, true); scene.add(m);
  SGOAL.man = m; g.x = x; g.z = z; g.zone = { x, z, r:K.cell / 2 + K.ring }; spawnGuards(g.zone, K.guards, K.rpg); g.home = { x:p.pos.x, z:p.pos.z };
  g.who = K.who[c.obj] || K.who.civ; g.ph = 'held'; g.hp = K.hp; g.free = 0; g.clock = K.time; g.hx = x; g.hz = z; }
function rescueTick(g, dt, now){ const K = g.Y, p = S.player, m = SGOAL.man; if(!m) return 'CON TIN MẤT TÍCH'; g.clock -= dt;
  const hit = alerted(g.hx, g.hz, K.fireR); if(hit && (g.ph !== 'held' || guardsLeft(g.zone) < K.guards)) g.hp -= hit * K.dps * dt;   // the crossfire (once the shooting has started round him)
  if(g.hp <= 0){ soldierKneel(m, false); m.rotation.x = -Math.PI / 2; m.position.y = heightAt(g.hx, g.hz) + 0.25; SGOAL.props.push(m); SGOAL.man = null; return fill(SAY.rescueDead, { who:g.who }).toLocaleUpperCase('vi'); }
  if(g.clock <= 0) return 'HẾT GIỜ';
  const d = Math.hypot(p.pos.x - g.hx, p.pos.z - g.hz), hpTx = Math.max(0, Math.round(g.hp / K.hp * 100)) + '%';
  if(g.ph === 'held'){ const left = guardsLeft(g.zone); mark(0, g.x, g.z, K.cell / 2 + 1, 'heart', '#7fd0ff');
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
  g.f = f; g.clock = K.time; if(!f) return; const b = f.gate, h0 = b.maxHp || b.hp; b.maxHp = Math.max(h0, Math.min(h0 * K.gateK, K.gateMax)); b.hp = b.maxHp; g.gh = b.maxHp; g.u0 = 0; }   // (a gate a fort's threat already thickened stays as it is)
function breachTick(g, dt, now){ const K = g.Y, f = g.f; g.clock -= dt; if(!f) return 'won';   // (no gate on this field: nothing to do)
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
function road(K){ const p = S.player; let best = null, bl = 0;
  for(const P of TRAIL.paths || []){ const pts = P.pts || P; if(!pts || pts.length < 3) continue; let L = 0; for(let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if(L > bl){ bl = L; best = pts; } }
  let pts; if(best && bl >= K.minL){ pts = best.map(q => [q[0], q[1]]); if(Math.hypot(pts[0][0] - p.pos.x, pts[0][1] - p.pos.z) > Math.hypot(pts[pts.length - 1][0] - p.pos.x, pts[pts.length - 1][1] - p.pos.z)) pts.reverse(); }
  else { const sd = Math.random() < 0.5 ? -1 : 1, a = fieldEdgePoint(sd > 0 ? 0.25 : Math.PI - 0.25, 10), b = fieldEdgePoint(sd > 0 ? -Math.PI + 0.7 : -0.7, 10), m = [0, -ARENA * 0.15];
    pts = []; const add = (P, Q) => { const L = Math.hypot(Q[0] - P[0], Q[1] - P[1]), n = Math.max(1, Math.ceil(L / 6)); for(let i = 0; i < n; i++){ const u = i / n; pts.push(clampFieldXZ(P[0] + (Q[0] - P[0]) * u, P[1] + (Q[1] - P[1]) * u, 6)); } };
    add(a, m); add(m, b); pts.push(clampFieldXZ(b[0], b[1], 6)); }
  const cum = [0]; for(let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum, L:cum[cum.length - 1] }; }
function along(R, s, out){ s = Math.max(0, Math.min(R.L, s)); let i = 1; while(i < R.cum.length - 1 && R.cum[i] < s) i++; const a = R.pts[i - 1], b = R.pts[i], seg = (R.cum[i] - R.cum[i - 1]) || 1, u = (s - R.cum[i - 1]) / seg;
  out.x = a[0] + (b[0] - a[0]) * u; out.z = a[1] + (b[1] - a[1]) * u; out.a = Math.atan2(b[0] - a[0], b[1] - a[1]); return out; }
const _q = { x:0, z:0, a:0 };
function pursuitStart(g, c, now){ const K = g.Y, R = g.R = road(K); g.s = K.lead + (K.trucks - 1) * K.gap; g.n = K.trucks; g.burnt = 0;
  for(let k = 0; k < K.trucks; k++){ const m = makeTruck(); scene.add(m); const t = { g:m, s:g.s - k * K.gap, alive:true, b:null };
    t.b = { mesh:m, x:0, z:0, r:K.r, hp:K.hp, maxHp:K.hp, steel:false, loot:false, kind:'convoy', hit:(dmg) => truckHit(g, t, dmg) }; blocks.push(t.b); SGOAL.trucks.push(t); place(t, R); }
  UGRID.blkAt = 0; g.clock = (R.L - g.s) / K.speed; along(R, R.L, _q); g.ex = _q.x; g.ez = _q.z; sectorSquad(g.ex, g.ez); }
function place(t, R){ along(R, t.s, _q); const gy = heightAt(_q.x, _q.z); t.g.position.set(_q.x, gy, _q.z); t.g.rotation.set(0, _q.a, 0); t.b.x = _q.x; t.b.z = _q.z; }
function truckHit(g, t, dmg){ if(!t.alive) return; t.b.hp -= dmg; if(t.b.hp > 0) return; t.alive = false; g.burnt++; const i = blocks.indexOf(t.b); if(i >= 0) blocks.splice(i, 1); UGRID.blkAt = 0;
  _pt.x = t.b.x; _pt.z = t.b.z; bigExplode(_pt, 0xff8a3a, 2.2); fireball(_pt, 1.4); sfx('bigexplode'); t.g.rotation.z = 0.25; SGOAL.props.push(t.g);
  for(let k = 0; k < g.Y.bail; k++) spawnEnemy('rifle', t.b.x + (Math.random() - 0.5) * 5, t.b.z + (Math.random() - 0.5) * 5);   // the crew bails out
  edgeNote(fill(SAY.pursuitBurn, { n:g.n - g.burnt }), '#ffb24a'); }
function pursuitTick(g, dt, now){ const K = g.Y, R = g.R; let lead = -1;
  for(const t of SGOAL.trucks){ if(!t.alive) continue; t.s += K.speed * dt; place(t, R); if(t.s > lead) lead = t.s; }
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
export function sectorGoalClear(){ const C = SGOAL.cell; if(C){ scene.remove(C.g); for(const b of C.blocks){ const i = blocks.indexOf(b); if(i >= 0) blocks.splice(i, 1); } SGOAL.cell = null; UGRID.blkAt = 0; }
  if(SGOAL.man){ scene.remove(SGOAL.man); SGOAL.man = null; }
  for(const t of SGOAL.trucks){ scene.remove(t.g); const i = blocks.indexOf(t.b); if(i >= 0) blocks.splice(i, 1); } SGOAL.trucks.length = 0;
  for(const m of SGOAL.props) scene.remove(m); SGOAL.props.length = 0; if(SGOAL.heli) SGOAL.heli.visible = false; for(let i = 0; i < SGOAL.marks.length; i++) unmark(i); SGOAL.g = null;
  if(WAVE.betweenUntil >= 1e11) WAVE.betweenUntil = 0; }   // (an infiltration's held waves let go)
// dev / probes: the goal in a line
export function sectorGoalState(){ const g = SGOAL.g; return g ? { type:g.type, ph:g.ph || '', k:+(g.k || 0).toFixed(2), clock:+(g.clock || 0).toFixed(1), sub:g.sub, hp:g.hp, burnt:g.burnt, trucks:SGOAL.trucks.length } : null; }
