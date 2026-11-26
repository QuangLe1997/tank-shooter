// game/coop-puppets.js — COOP 6 ONE BATTLE: the host is the authority for the enemy. HOST: every enemy unit into the snapshot (coopHostEntities — an id each, no
// garbage), a death / an explosion / a grenade as an event. GUEST (COOP.puppets): his own enemy AI, waves, director and missions do not run — each enemy is a
// PUPPET: a record in enemies[] (so his aim, map, health bars and rounds work unchanged) on a pooled mesh, moved by the interpolated snapshot and posed by the
// same code (animateSoldier / poseSoldier), drawn by the same batch (updateTroopBatch). His rounds strike locally and are REPORTED (HIT); the host applies them.
import * as THREE from 'three';
import { COOP, FIELDCRAFT } from '../../config.js';
import { ENEMY_DEFS, FT, MOBILE, NADES, NET_ESTATE, NET_EV, NET_POSE, PERF, S, addTrail, animateSoldier, bigExplode, buildUnitGrid, clearFireteam, clearSoldiers, coopBlastAB, coopBlastColor, coopHitP, coopMU16, coopSendEvent, coopU16M, dazePose, dazed, drawRadar, enemies, enemyPool, fpvCam, freeEnemyBar, getEnemyBar, getEnemyMesh, gunFlash, gunSound, gunshipDown, heightAt, hitFlash, infantryDown, netFrameAdd, poseSoldier, scene, soldiers, updateAbilityUI, updateAirAim, updateBuffHUD, updateBullets, updateCamera, updateCavalry, updateCrosshair, updateEnemyBar, updateEquip, updateFieldcraft, updateGore, updateGunStatus, updateHeliDown, updateInfDead, updateInstr, updateLOD, updateLockWarn, updateLogistics, updateRank, updateReload, updateRockets, updateSquadHud, updateWalls, updateWorldBars } from '../hub.js';

let _types = null; const types = () => _types || (_types = Object.keys(ENEMY_DEFS)), _v = new THREE.Vector3();
export const PUPS = { n:0, born:0, died:0, gone:0, hits:0, fx:0, err:0, lastErr:'', nextId:COOP.ids.firstEntity, sent:0 };
function fail(e){ PUPS.err++; PUPS.lastErr = String(e && e.message || e).slice(0, 200); if(PUPS.err <= 3) console.warn('coop: puppets', e); }

// ================= HOST =================
// every enemy unit into the snapshot f. An id is given the first time a unit is seen (never reused in a session); nothing is allocated per unit.
export function coopHostEntities(f, now){ const E = NET_ESTATE, P = NET_POSE, win = COOP.puppet.fireMs / 1000, T = types();
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i]; if(!e.nid){ if(PUPS.nextId > 65535) continue; e.nid = PUPS.nextId++; e.nk = Math.max(0, T.indexOf(e.type)); }
    const def = e.def; let pose = P.STAND; if(def.inf){ const st = e.mesh.userData.stance; pose = now < e.stunUntil || dazed(e, now) ? P.STUNNED : st === 'prone' ? P.PRONE : st === 'crouch' ? P.CROUCH : st === 'low' ? P.RUN : P.STAND; }
    netFrameAdd(f, e.nid, e.nk, e.pos.x, def.air ? e.pos.y : 0, e.pos.z, e.mesh.rotation.y, pose | (now - (e.shotAt || -9) < win ? E.FIRING : 0) | (e.inCover ? E.COVER : 0) | (e.elite ? E.ELITE : 0), e.maxHp > 0 ? e.hp / e.maxHp : 0); }
  PUPS.sent = f.n; }
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
const PUP = new Map(), DEAD = new Uint8Array(65536);   // id → the puppet's record · ids whose death has been shown (the delayed samples still carry them for a moment)
let _nadeGeo = null, _nadeMat = null;
function drop(e, i){ if(i == null) i = enemies.indexOf(e); if(i >= 0) enemies.splice(i, 1); if(e.bar){ freeEnemyBar(e.bar); e.bar = null; } }
function pool(e){ e.mesh.visible = false; (enemyPool[e.type] = enemyPool[e.type] || []).push(e.mesh); }
function spawn(id, kind, x, y, z){ const type = types()[kind], def = ENEMY_DEFS[type]; if(!def || (!def.inf && !def.air)) return null; const mesh = getEnemyMesh(type); mesh.position.set(x, def.air ? y : heightAt(x, z), z);
  const e = { type, def, mesh, turret:mesh.userData.turret, muzzle:mesh.userData.muzzle, pos:new THREE.Vector3(x, def.air ? y : 0, z), vel:new THREE.Vector3(), hp:def.hp, maxHp:def.hp, r:def.inf ? 0.55 : 1.9, facing:0, aim:0,
    fireAt:Infinity, burstLeft:0, stunUntil:0, kbx:0, kbz:0, hitT:0, loot:false, elite:false, puppet:true, nid:id, alert:2, sees:true, seen:true, ph:0, aimT:0, _fxAt:0, _goneT:0, _live:true };
  e.bar = getEnemyBar(); e.bar.g.scale.setScalar(def.inf ? 0.8 : 1.5); enemies.push(e); PUP.set(id, e); PUPS.born++; return e; }
// the interpolated world o (net/interp.js sample) onto the puppets
export function coopPuppets(o, dt, now){ const E = NET_ESTATE, C = COOP.puppet;
  if(soldiers.length) clearSoldiers(); if(FT.length) clearFireteam();   // (our own men are the host's too, and are not sent yet: better none than men standing frozen)
  for(let i = enemies.length - 1; i >= 0; i--){ const e = enemies[i]; if(e.puppet) e._live = false; else { drop(e, i); pool(e); } }   // (a unit this page spawned by itself — a garrison placed while the field was built — is not part of the host's battle)
  if(o) for(let k = 0; k < o.n; k++){ const id = o.id[k]; if(DEAD[id]) continue; const x = o.x[k], z = o.z[k], st = o.state[k]; let e = PUP.get(id);
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
  PUPS.n = PUP.size; }
// a puppet's shot as the guest draws it: the flash, the report, a short streak of light along his facing — whether it struck the guest is the host's word (HIT)
function shot(e, h){ const m = e.muzzle || e.mesh.userData.muzzle; if(m) m.getWorldPosition(_v); else _v.set(e.pos.x, heightAt(e.pos.x, e.pos.z) + 1.3, e.pos.z); if(!(_v.y > -50 && _v.y < 500)) return; PUPS.fx++;
  gunFlash(_v.x, _v.y, _v.z, h, 0.6, 0.34, 0xfff0c0, 0.9); gunSound(e.def.air ? 'mg' : 'rifleShot', e.pos, 'e'); const sx = Math.sin(h), sz = Math.cos(h), n = MOBILE ? 5 : 9; for(let k = 1; k <= n; k++){ const d = k * 2.6; addTrail(_v.x + sx * d, _v.y - d * 0.004, _v.z + sz * d, 0xff5a24, 0.3, 0.1 + k * 0.012); } }
// his own round struck a puppet (actors/damage.js damageEnemy / killEnemy): the hit is shown here and reported — the host takes the health off and decides the death
export function coopGuestHit(e, dmg){ if(!e.puppet) return false; try{ hitFlash(e.mesh); }catch(err){} e.hitT = Math.max(e.hitT || 0, 0.16); PUPS.hits++;
  const L = Math.hypot(e._hx || 0, e._hz || 0) || 1; coopSendEvent(NET_EV.HIT, COOP.ids.guest, e.nid, (e._hx || 0) / L, 0, (e._hz || 0) / L, coopHitP(dmg, !!(e._big || e._blast))); return true; }
// the host says a unit died: the puppet is thrown / spirals down exactly as a locally killed one (infantryDown / gunshipDown pool its mesh when done)
export function coopGuestDeath(id, flags, hx, hk, hz){ if(id > 0 && id < 65536) DEAD[id] = 1; const e = PUP.get(id); if(!e) return; PUP.delete(id); drop(e); PUPS.died++;
  e._big = !!(flags & 1); e._blast = (flags & 2) ? { x:e.pos.x - hx, z:e.pos.z - hz } : null; e._quietKill = !!(flags & 4); e._hx = hx; e._hz = hz; e._hitK = hk || 1;
  try{ if(e.def.inf) infantryDown(e); else gunshipDown(e); }catch(err){ fail(err); pool(e); } }
export function coopGuestBlast(a, b, x, y, z, p){ try{ bigExplode(Math.abs(y) > 0.01 ? { x, y, z } : { x, z }, coopBlastColor(a, b), Math.min(6, p / 100)); }catch(err){ fail(err); } }
// a grenade the host saw thrown: it flies and bursts here through the game's own grenade code (ai/fieldcraft.js) — as one that hurts nobody on this page
export function coopGuestNade(a, b, x, y, z, p){ if(NADES.length >= COOP.puppet.nadeN) return; const x0 = coopMU16(a), z0 = coopMU16(b), T = Math.max(0.2, p / 1000);
  _nadeGeo = _nadeGeo || new THREE.SphereGeometry(0.13, 8, 6); _nadeMat = _nadeMat || new THREE.MeshStandardMaterial({ color:0x3a4228, roughness:0.6, metalness:0.4 }); const m = new THREE.Mesh(_nadeGeo, _nadeMat); scene.add(m);
  NADES.push({ side:'e', you:false, dmg:0, m, x0, z0, y0:heightAt(x0, z0) + 1.5, x1:x, z1:z, t:0, T, peak:Math.max(0.5, y), landed:false, boomAt:T + FIELDCRAFT.nade.fuseGround, ring:null, net:true }); }
// a new battlefield (or the room closed): no puppet outlives it
export function coopPuppetsClear(){ for(let i = enemies.length - 1; i >= 0; i--){ const e = enemies[i]; if(e.puppet){ drop(e, i); pool(e); } } PUP.clear(); PUPS.n = 0; }
// THE GUEST'S FRAME while the fight is on (game/loop.js calls it in place of the single-player updates): his own soldier, rounds, grenades, camera and HUD run
// here as ever; the enemy is the host's (sample = this frame's interpolated snapshot)
export function coopGuestPlay(dt, now, sample){ S.timeNow = now; const gdt = dt * S.timeScale * (now < (S.hitStop || 0) ? 0.35 : 1);
  updateReload(now); if((PERF.fc & (MOBILE ? 3 : 1)) === 0) updateGunStatus(now);
  updateCrosshair(gdt, now); updateAirAim(gdt); updateCavalry(gdt, now); updateRank();
  coopPuppets(sample, gdt, now); buildUnitGrid(now);
  updateFieldcraft(gdt, now); updateBullets(gdt, now); updateLockWarn(gdt, now); updateRockets(gdt, now);
  updateInfDead(gdt); updateGore(gdt, now); updateHeliDown(gdt); updateEquip(gdt, now); updateWalls(dt); updateLogistics(gdt, now);
  updateLOD(now); updateBuffHUD(now); updateSquadHud(now);
  if(!fpvCam(dt, now)) updateCamera(dt, now);
  updateWorldBars(); updateAbilityUI(now); if(PERF.fc % (MOBILE ? 3 : 2) === 0) drawRadar(); updateInstr(now); }
