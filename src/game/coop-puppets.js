// game/coop-puppets.js — COOP 6 ONE BATTLE: the host is the authority for the enemy. HOST: every enemy unit into the snapshot (coopHostEntities — an id each, no
// garbage), a death / an explosion / a grenade as an event. GUEST (COOP.puppets): his own enemy AI, waves, director and missions do not run — each enemy is a
// PUPPET: a record in enemies[] (so his aim, map, health bars and rounds work unchanged) on a pooled mesh, moved by the interpolated snapshot and posed by the
// same code (animateSoldier / poseSoldier), drawn by the same batch (updateTroopBatch). His rounds strike locally and are REPORTED (HIT); the host applies them.
import * as THREE from 'three';
import { COOP, COOP2, DRONEWAR, FIELDCRAFT, TROOPS } from '../../config.js';
import { CW, DW, SOLDIER, armAlly, camera, damageAlly, droneFree, droneKill, droneSpawn, droneWarGuest, killSoldier, makeSoldierBar, makeSoldierMesh, setRole, sfx, stanceBarK, updateAllyDead, updateGifts, updateLootBeacons, updateObjective, updatePickups, updateTowers, ENEMY_DEFS, FT, MOBILE, NADES, NET_ESTATE, NET_EV, NET_POSE, PERF, S, addTrail, animateSoldier, bigExplode, buildUnitGrid, coopBlastAB, coopBlastColor, coopHitP, coopMU16, coopSendEvent, coopU16M, dazePose, dazed, drawRadar, enemies, enemyPool, fpvCam, freeEnemyBar, getEnemyBar, getEnemyMesh, gunFlash, gunSound, gunshipDown, heightAt, hitFlash, infantryDown, mateGunIndex, netFrameAdd, poseSoldier, scene, soldiers, updateAbilityUI, updateAirAim, updateBuffHUD, updateBullets, updateCamera, updateCavalry, updateCrosshair, updateEnemyBar, updateEquip, updateFieldcraft, updateGore, updateGunStatus, updateHeliDown, updateInfDead, updateInstr, updateLOD, updateLockWarn, updateLogistics, updateRank, updateReload, updateRockets, updateSquadHud, updateWalls, updateWorldBars } from '../hub.js';

let _types = null; const types = () => _types || (_types = Object.keys(ENEMY_DEFS)), _v = new THREE.Vector3();
export const PUPS = { n:0, born:0, died:0, gone:0, hits:0, fx:0, err:0, lastErr:'', nextId:COOP.ids.firstEntity, sent:0, sentE:0, over:0, allies:0, allyBorn:0, allyDied:0, drones:0, droneBorn:0 };
function fail(e){ PUPS.err++; PUPS.lastErr = String(e && e.message || e).slice(0, 200); if(PUPS.err <= 3) console.warn('coop: puppets', e); }

// ================= HOST =================
// every enemy unit into the snapshot f. An id is given the first time a unit is seen (never reused in a session); nothing is allocated per unit.
export function coopHostEntities(f, now){ const E = NET_ESTATE, P = NET_POSE, win = COOP.puppet.fireMs / 1000, T = types();
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(!e.nid){ if(PUPS.nextId > 65535) continue; e.nid = PUPS.nextId++; e.nk = Math.max(0, T.indexOf(e.type)); }
    const def = e.def; let pose = P.STAND; if(def.inf){ const st = e.mesh.userData.stance; pose = now < e.stunUntil || dazed(e, now) ? P.STUNNED : st === 'prone' ? P.PRONE : st === 'crouch' ? P.CROUCH : st === 'low' ? P.RUN : P.STAND; }
    netFrameAdd(f, e.nid, e.nk, e.pos.x, def.air ? e.pos.y : 0, e.pos.z, e.mesh.rotation.y, pose | (now - (e.shotAt || -9) < win ? E.FIRING : 0) | (e.inCover ? E.COVER : 0) | (e.elite ? E.ELITE : 0), e.maxHp > 0 ? e.hp / e.maxHp : 0); }
  PUPS.sentE = f.n; if(CW.sw.allies) hostAllies(f, now); if(CW.sw.drones) hostDrones(f); PUPS.sent = f.n; PUPS.over += f.over; }
// COOP 9 our own AI soldiers (the Core's guards: kind 0 · the fireteam: its role's place in COOP2.ally.roles) with the ALLY bit, and the drones of both sides
// (kind = COOP2.drone.kind0 + airframe), after the enemy — over the snapshot's cap they are the ones left out
function hostAllies(f, now){ const E = NET_ESTATE, P = NET_POSE, A = COOP2.ally, win = A.fireMs / 1000;
  for(let k = 0; k < 2; k++){ const L = k ? FT : soldiers; for(let i = 0; i < L.length; i++){ const a = L[i]; if(a.dead || !a.g) continue; if(!a.nid){ if(PUPS.nextId > 65535) continue; a.nid = PUPS.nextId++; a._nsh = a.g.userData.shots | 0; a._nfire = -9; }
      const u = a.g.userData, st = u.stance, sh = u.shots | 0; if(sh !== a._nsh){ a._nsh = sh; a._nfire = now; }   // (animateSoldier counts his shots: one more since the last look = he fired)
      const pose = dazed(a, now) ? P.STUNNED : st === 'prone' ? P.PRONE : st === 'crouch' ? P.CROUCH : st === 'low' ? P.RUN : P.STAND;
      netFrameAdd(f, a.nid, k ? Math.max(1, A.roles.indexOf(a.at ? 'at' : a.role)) : 0, a.pos.x, 0, a.pos.z, k ? a.facing || 0 : a.g.rotation.y, E.ALLY | pose | (now - a._nfire < win ? E.FIRING : 0), a.maxHp > 0 ? a.hp / a.maxHp : 0); } } }
function hostDrones(f){ const K = COOP2.drone; for(let i = 0; i < DW.list.length; i++){ const d = DW.list[i]; if(d.dead || d.puppet) continue; if(!d.nid){ if(PUPS.nextId > 65535) continue; d.nid = PUPS.nextId++; d.nk = K.kind0 + Math.max(0, K.kinds.indexOf(d.kind)); }
    netFrameAdd(f, d.nid, d.nk, d.x, d.y, d.z, d.yaw || 0, d.jamT > 0 ? NET_POSE.STUNNED : 0, d.hp > 0 ? Math.min(1, d.hp / 8) : 0); } }
// the host finds the drone a hit report names
export function coopDroneById(id){ for(let i = 0; i < DW.list.length; i++) if(DW.list[i].nid === id) return DW.list[i]; return null; }
// an enemy unit died on the host (actors/damage.js killEnemy): the guest's puppet falls the same way — thrown along the shot, a heavy round, a blast
export function coopHostDeath(e){ if(!e.nid) return; coopSendEvent(NET_EV.DEATH, e.nid, (e._big ? 1 : 0) | (e._blast ? 2 : 0) | (e._quietKill ? 4 : 0), e._blast ? e.pos.x - e._blast.x : (e._hx || 0), Math.min(300, e._hitK || 1), e._blast ? e.pos.z - e._blast.z : (e._hz || 0), 0); }
// the host finds the unit a report names
export function coopEnemyById(id){ for(let i = 0; i < enemies.length; i++) if(enemies[i].nid === id) return enemies[i]; return null; }
let _blastN = 0, _blastT = 0;
// an explosion on the host (fx/explosions.js bigExplode) → the guest shows it too (at most COOP.puppet.blastPerS a second)
export function coopHostBlast(pos, color, scale){ const t = performance.now(); if(t - _blastT > 1000){ _blastT = t; _blastN = 0; } if(++_blastN > COOP.puppet.blastPerS) return; const ab = coopBlastAB(color);
  coopSendEvent(NET_EV.EXPLOSION, ab[0], ab[1], pos.x, pos.y || 0, pos.z, Math.max(1, Math.min(65535, Math.round((scale || 1.5) * 100)))); }
// a grenade leaves a hand on the host (ai/fieldcraft.js throwNade) → the guest sees it fly and burst
export function coopHostNade(g){ coopSendEvent(NET_EV.GRENADE, coopU16M(g.x0), coopU16M(g.z0), g.x1, g.peak, g.z1, Math.max(1, Math.min(65535, Math.round(g.T * 1000)))); }

// ================= GUEST =================
const PUP = new Map(), ALLY = new Map(), DRN = new Map(), DEAD = new Uint8Array(65536);   // id → the puppet's record · ids whose death has been shown (the delayed samples still carry them for a moment)
let _nadeGeo = null, _nadeMat = null;
function drop(e, i){ if(i == null) i = enemies.indexOf(e); if(i >= 0) enemies.splice(i, 1); if(e.bar){ freeEnemyBar(e.bar); e.bar = null; } }
function pool(e){ e.mesh.visible = false; (enemyPool[e.type] = enemyPool[e.type] || []).push(e.mesh); }
function spawn(id, kind, x, y, z){ const type = types()[kind], def = ENEMY_DEFS[type]; if(!def || (!def.inf && !def.air)) return null; const mesh = getEnemyMesh(type); mesh.position.set(x, def.air ? y : heightAt(x, z), z);
  const e = { type, def, mesh, turret:mesh.userData.turret, muzzle:mesh.userData.muzzle, pos:new THREE.Vector3(x, def.air ? y : 0, z), vel:new THREE.Vector3(), hp:def.hp, maxHp:def.hp, r:def.inf ? 0.55 : 1.9, facing:0, aim:0,
    fireAt:Infinity, burstLeft:0, stunUntil:0, kbx:0, kbz:0, hitT:0, loot:false, elite:false, puppet:true, nid:id, alert:2, sees:true, seen:true, ph:0, aimT:0, _fxAt:0, _goneT:0, _live:true };
  e.bar = getEnemyBar(); e.bar.g.scale.setScalar(def.inf ? 0.8 : 1.5); enemies.push(e); PUP.set(id, e); PUPS.born++; return e; }
// the interpolated world o (net/interp.js sample) onto the puppets
export function coopPuppets(o, dt, now){ const E = NET_ESTATE, C = COOP.puppet;
  for(let k = 0; k < 2; k++){ const L = k ? FT : soldiers; for(let i = L.length - 1; i >= 0; i--){ const a = L[i]; if(a.puppet) a._live = false; else { scene.remove(a.g); scene.remove(a.bar); L.splice(i, 1); } } }   // (COOP 9 our own men are the host's too: the ones this page placed by itself go, the host's are drawn below)
  for(let i = DW.list.length - 1; i >= 0; i--){ const d = DW.list[i]; if(d.puppet) d._live = false; }
  for(let i = enemies.length - 1; i >= 0; i--){ const e = enemies[i]; if(e.puppet) e._live = false; else { drop(e, i); pool(e); } }   // (a unit this page spawned by itself — a garrison placed while the field was built — is not part of the host's battle)
  if(o) for(let k = 0; k < o.n; k++){ const id = o.id[k]; if(DEAD[id]) continue; const x = o.x[k], z = o.z[k], st = o.state[k]; let e = PUP.get(id);
    if(!e && (st & E.ALLY)){ try{ allyAt(id, o.kind[k], x, z, o.heading[k], st, o.hp[k], dt, now); }catch(err){ fail(err); } continue; }
    if(!e && o.kind[k] >= COOP2.drone.kind0){ try{ droneAt(id, o.kind[k], x, o.y[k], z, o.heading[k], st, dt); }catch(err){ fail(err); } continue; }
    if(!e){ try{ e = spawn(id, o.kind[k], x, o.y[k], z); }catch(err){ fail(err); } if(!e) continue; }
    e._live = true; e._goneT = 0; const def = e.def, h = o.heading[k], moved = Math.hypot(x - e.pos.x, z - e.pos.z), firing = !!(st & E.FIRING), pose = st & E.POSE;
    if(dt > 0) e.vel.set((x - e.pos.x) / dt, 0, (z - e.pos.z) / dt); e.facing = h; e.elite = !!(st & E.ELITE); e.inCover = !!(st & E.COVER); e.hp = Math.max(0.01, o.hp[k] * e.maxHp); if(e.hitT > 0) e.hitT -= dt;
    try{
      if(def.inf){ e.pos.x = x; e.pos.z = z; e.mesh.position.set(x, heightAt(x, z), z); e.mesh.rotation.y = h;
        if(pose === NET_POSE.STUNNED){ dazePose(e.mesh, now, dt); e.r = 0.34; }
        else { animateSoldier(e.mesh, moved / def.scale, dt, firing); poseSoldier(e.mesh, pose === NET_POSE.PRONE ? 'prone' : pose === NET_POSE.CROUCH ? 'crouch' : pose === NET_POSE.RUN ? 'low' : 'stand', dt); e.r = pose === NET_POSE.PRONE ? 0.34 : 0.55; } }
      else { e.pos.set(x, o.y[k], z); e.mesh.position.copy(e.pos); e.mesh.rotation.y = h; const r = e.mesh.userData.rotor; if(r && r.rotation) r.rotation.y += dt * 30; }
      if(firing && now >= e._fxAt){ e._fxAt = now + C.fireEvery; shot(e, h); }
      updateEnemyBar(e);
    }catch(err){ fail(err); } }
  for(let i = enemies.length - 1; i >= 0; i--){ const e = enemies[i]; if(!e.puppet || e._live) continue; e._goneT += dt; if(e._goneT > C.goneS || !o){ PUP.delete(e.nid); drop(e, i); pool(e); PUPS.gone++; } }   // (left the host's battle without a death: walked off the field, the stage ended)
  for(let k = 0; k < 2; k++){ const L = k ? FT : soldiers; for(let i = L.length - 1; i >= 0; i--){ const a = L[i]; if(!a.puppet || a._live) continue; a._goneT += dt; if(a._goneT > COOP2.ally.goneS || !o){ ALLY.delete(a.nid); scene.remove(a.g); scene.remove(a.bar); L.splice(i, 1); } } }
  for(let i = DW.list.length - 1; i >= 0; i--){ const d = DW.list[i]; if(!d.puppet || d._live) continue; d._goneT += dt; if(d._goneT > COOP2.drone.goneS || !o){ DRN.delete(d.nid); droneFree(d); } }
  PUPS.n = PUP.size; PUPS.allies = ALLY.size; PUPS.drones = DRN.size; }
// ---- COOP 9 one of OUR men as the host's puppet: a record in soldiers[] (a Core guard) or FT[] (the fireteam: the map, the squad panel and the tower guards'
//   eyes find him there), on a soldier mesh of his own, moved and posed like the enemy's puppets. Nothing on this page can hurt him (actors/fireteam.js,
//   actors/soldiers.js: a.puppet) — his health and his death are the host's
function allyAt(id, kind, x, z, h, st, hp, dt, now){ const E = NET_ESTATE, A = COOP2.ally; let a = ALLY.get(id);
  if(!a){ const guard = kind === 0, role = A.roles[kind] || 'rifle', g = makeSoldierMesh(), bar = makeSoldierBar(); g.scale.setScalar(guard ? SOLDIER.scale : TROOPS.look.scale); scene.add(g); if(!guard) bar.g.scale.setScalar(0.7); scene.add(bar.g);
    a = { g, bar:bar.g, barFill:bar.fill, pos:new THREE.Vector3(x, 0, z), home:new THREE.Vector3(x, 0, z), hp:100, maxHp:100, fireAt:0, hurtAt:0, hitT:0, slot:FT.length, kbx:0, kbz:0, dead:false, facing:h, postAngle:0, bob:0, wpx:0, wpz:0, wanderAt:0,
      puppet:true, guard, nid:id, _live:true, _goneT:0, _fxAt:0 };
    if(guard) soldiers.push(a); else { FT.push(a); setRole(a, role === 'at' ? 'rifle' : role); if(role === 'at') armAlly(a); } ALLY.set(id, a); PUPS.allyBorn++; }
  a._live = true; a._goneT = 0; const moved = Math.hypot(x - a.pos.x, z - a.pos.z), gy = heightAt(x, z), firing = !!(st & E.FIRING), pose = st & E.POSE; a.pos.x = x; a.pos.z = z; a.facing = h; a.hp = Math.max(0.01, hp * a.maxHp);
  a.g.position.set(x, gy, z); a.g.rotation.y = h;
  if(pose === NET_POSE.STUNNED) dazePose(a.g, now, dt); else { animateSoldier(a.g, moved / (a.guard ? SOLDIER.scale : 1.15), dt, firing); poseSoldier(a.g, pose === NET_POSE.PRONE ? 'prone' : pose === NET_POSE.CROUCH ? 'crouch' : pose === NET_POSE.RUN ? 'low' : 'stand', dt); }
  a.bar.visible = hp < 0.985; if(a.bar.visible){ a.bar.position.set(x, (a.guard ? 3.05 : TROOPS.look.barY * stanceBarK(a.g)) + gy, z); a.bar.quaternion.copy(camera.quaternion); a.barFill.scale.x = Math.max(0.001, hp); a.barFill.position.x = -(1 - hp) * 0.5; a.barFill.material.color.setHex(hp > 0.5 ? 0x7fe06a : hp > 0.25 ? 0xffcf5a : 0xff5a4a); }
  if(firing && now >= a._fxAt){ a._fxAt = now + A.fireEvery; const m = a.g.userData.muzzle; if(m) m.getWorldPosition(_v); else _v.set(x, gy + 1.3, z);
    if(_v.y > -50 && _v.y < 500){ PUPS.fx++; gunFlash(_v.x, _v.y, _v.z, h, 0.5, 0.3, 0xf2f7a0, 0.8); sfx('shoot_rifle', a.pos, 0.5); const sx = Math.sin(h), sz = Math.cos(h), n = MOBILE ? 4 : 7; for(let k = 1; k <= n; k++){ const d = k * 2.6; addTrail(_v.x + sx * d, _v.y - d * 0.004, _v.z + sz * d, A.hex, 0.28, 0.1 + k * 0.012); } } } }
// the host says one of our men fell: he falls here by the game's own code (flung, lying a while — updateAllyDead; a Core guard in a burst)
function allyDown(a){ ALLY.delete(a.nid); a.puppet = false; PUPS.allyDied++; try{ if(a.guard) killSoldier(a); else damageAlly(a, 999); }catch(err){ fail(err); scene.remove(a.g); scene.remove(a.bar); const L = a.guard ? soldiers : FT, i = L.indexOf(a); if(i >= 0) L.splice(i, 1); } }
// ---- COOP 9 a drone of either side as the host flies it: the game's own airframe (actors/drone.js droneSpawn — pooled), where the snapshot puts it; the
//   guest's gun is laid on the enemy's like on his own page's (d.tg), his round on it is a HIT report (actors/drone.js droneHurt → coopDroneHit)
function droneAt(id, kind, x, y, z, h, st, dt){ let d = DRN.get(id);
  if(!d){ const kn = COOP2.drone.kinds[kind - COOP2.drone.kind0]; if(!kn) return; d = droneSpawn(kn, x, y, z, h); if(!d) return; const C = DRONEWAR.enemy && DRONEWAR.enemy[kn]; d.puppet = true; d.nid = id; d.hp = 99; d.t0 = 0; d.jam = false;
    d.tg = { _drn:true, d, pos:{ x, y, z }, def:{ air:true }, r:C && C.hitR || 1, hp:1 }; DRN.set(id, d); PUPS.droneBorn++; }
  d._live = true; d._goneT = 0; if(dt > 0){ d.vx = (x - d.x) / dt; d.vy = (y - d.y) / dt; d.vz = (z - d.z) / dt; } d.x = x; d.y = y; d.z = z; d.yaw = h; d.jamT = (st & NET_ESTATE.POSE) === NET_POSE.STUNNED ? 0.3 : 0; }
// actors/drone.js droneHurt on the guest: his round on a puppet drone is reported like one on a man (true = nothing is taken off it here)
export function coopDroneHit(d, dmg){ d.hitT = 0.16; PUPS.hits++; const pl = S.player, gi = pl && pl.guns && pl.guns[pl.gunIdx]; coopSendEvent(NET_EV.HIT, COOP.ids.guest, d.nid, 0, (gi ? mateGunIndex(gi.id) : 0) / 100, 1, coopHitP(dmg, false)); return true; }
// a puppet's shot as the guest draws it: the flash, the report, a short streak of light along his facing — whether it struck the guest is the host's word (HIT)
function shot(e, h){ const m = e.muzzle || e.mesh.userData.muzzle; if(m) m.getWorldPosition(_v); else _v.set(e.pos.x, heightAt(e.pos.x, e.pos.z) + 1.3, e.pos.z); if(!(_v.y > -50 && _v.y < 500)) return; PUPS.fx++;
  gunFlash(_v.x, _v.y, _v.z, h, 0.6, 0.34, 0xfff0c0, 0.9); gunSound(e.def.air ? 'mg' : 'rifleShot', e.pos, 'e'); const sx = Math.sin(h), sz = Math.cos(h), n = MOBILE ? 5 : 9; for(let k = 1; k <= n; k++){ const d = k * 2.6; addTrail(_v.x + sx * d, _v.y - d * 0.004, _v.z + sz * d, 0xff5a24, 0.3, 0.1 + k * 0.012); } }
// his own round struck a puppet (actors/damage.js damageEnemy / killEnemy): the hit is shown here and reported — the host takes the health off and decides the death
export function coopGuestHit(e, dmg){ if(!e.puppet) return false; if(CW.apply) return true;   /* COOP 9 (a blast the host's word set off here — a fuel drum, the objective: the host did its damage himself) */ try{ hitFlash(e.mesh); }catch(err){} e.hitT = Math.max(e.hitT || 0, 0.16); PUPS.hits++;
  const L = Math.hypot(e._hx || 0, e._hz || 0) || 1; const pl = S.player, gi = pl && pl.guns && pl.guns[pl.gunIdx];
  coopSendEvent(NET_EV.HIT, COOP.ids.guest, e.nid, (e._hx || 0) / L, (gi ? mateGunIndex(gi.id) : 0) / 100, (e._hz || 0) / L, coopHitP(dmg, !!(e._big || e._blast))); return true; }   // (y: the weapon's index — the host checks it against his state)
// the host says a unit died: the puppet is thrown / spirals down exactly as a locally killed one (infantryDown / gunshipDown pool its mesh when done)
export function coopGuestDeath(id, flags, hx, hk, hz){ if(id > 0 && id < 65536) DEAD[id] = 1; const a = ALLY.get(id); if(a){ allyDown(a); return; }
  const d = DRN.get(id); if(d){ DRN.delete(id); try{ droneKill(d); }catch(err){ fail(err); } return; } const e = PUP.get(id); if(!e) return; PUP.delete(id); drop(e); PUPS.died++;
  e._big = !!(flags & 1); e._blast = (flags & 2) ? { x:e.pos.x - hx, z:e.pos.z - hz } : null; e._quietKill = !!(flags & 4); e._hx = hx; e._hz = hz; e._hitK = hk || 1;
  try{ if(e.def.inf) infantryDown(e); else gunshipDown(e); }catch(err){ fail(err); pool(e); } }
export function coopGuestBlast(a, b, x, y, z, p){ try{ bigExplode(Math.abs(y) > 0.01 ? { x, y, z } : { x, z }, coopBlastColor(a, b), Math.min(6, p / 100)); }catch(err){ fail(err); } }
// a grenade the host saw thrown: it flies and bursts here through the game's own grenade code (ai/fieldcraft.js) — as one that hurts nobody on this page
export function coopGuestNade(a, b, x, y, z, p){ if(NADES.length >= COOP.puppet.nadeN) return; const x0 = coopMU16(a), z0 = coopMU16(b), T = Math.max(0.2, p / 1000);
  _nadeGeo = _nadeGeo || new THREE.SphereGeometry(0.13, 8, 6); _nadeMat = _nadeMat || new THREE.MeshStandardMaterial({ color:0x3a4228, roughness:0.6, metalness:0.4 }); const m = new THREE.Mesh(_nadeGeo, _nadeMat); scene.add(m);
  NADES.push({ side:'e', you:false, dmg:0, m, x0, z0, y0:heightAt(x0, z0) + 1.5, x1:x, z1:z, t:0, T, peak:Math.max(0.5, y), landed:false, boomAt:T + FIELDCRAFT.nade.fuseGround, ring:null, net:true }); }
// a new battlefield (or the room closed): no puppet outlives it
export function coopPuppetsClear(){ for(let i = enemies.length - 1; i >= 0; i--){ const e = enemies[i]; if(e.puppet){ drop(e, i); pool(e); } } PUP.clear(); PUPS.n = 0;
  for(let k = 0; k < 2; k++){ const L = k ? FT : soldiers; for(let i = L.length - 1; i >= 0; i--){ const a = L[i]; if(a.puppet){ scene.remove(a.g); scene.remove(a.bar); L.splice(i, 1); } } } ALLY.clear();
  for(let i = DW.list.length - 1; i >= 0; i--){ const d = DW.list[i]; if(d.puppet) droneFree(d); } DRN.clear(); PUPS.allies = PUPS.drones = 0; }
// THE GUEST'S FRAME while the fight is on (game/loop.js calls it in place of the single-player updates): his own soldier, rounds, grenades, camera and HUD run
// here as ever; the enemy is the host's (sample = this frame's interpolated snapshot)
export function coopGuestPlay(dt, now, sample){ S.timeNow = now; const gdt = dt * S.timeScale * (now < (S.hitStop || 0) ? 0.35 : 1);
  updateReload(now); if((PERF.fc & (MOBILE ? 3 : 1)) === 0) updateGunStatus(now);
  CW.mine = true;   // COOP 9 from here to the rockets: what breaks is his own doing (his rounds, his grenades, his ride) — reported to the host, not done here
  try{ updateCrosshair(gdt, now); updateAirAim(gdt); updateCavalry(gdt, now); updateRank();
    coopPuppets(sample, gdt, now); buildUnitGrid(now);
    updateFieldcraft(gdt, now); updateBullets(gdt, now); updateLockWarn(gdt, now); updateRockets(gdt, now); updateEquip(gdt, now); }finally{ CW.mine = false; }
  updateInfDead(gdt); updateGore(gdt, now); updateHeliDown(gdt); updateWalls(dt); updateLogistics(gdt, now);
  try{ updatePickups(gdt, now); updateGifts(gdt, now); updateLootBeacons(dt); updateTowers(gdt, now); updateObjective(gdt, now); updateAllyDead(gdt); droneWarGuest(gdt, now); }catch(err){ fail(err); }   // COOP 9 the shared world as drawn: loot, crates, towers and their fallers, the objective's bar, our fallen, the drones
  updateLOD(now); updateBuffHUD(now); updateSquadHud(now);
  if(!fpvCam(dt, now)) updateCamera(dt, now);
  updateWorldBars(); updateAbilityUI(now); if(PERF.fc % (MOBILE ? 3 : 2) === 0) drawRadar(); updateInstr(now); }
