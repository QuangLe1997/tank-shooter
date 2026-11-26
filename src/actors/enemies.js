// actors/enemies.js — ENEMY units: spawn (infantry, helicopters; elites, loot), pooled meshes and floating HP bars (no-tanks: no armoured vehicles)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BALANCE, RAMP, ROSTER, TROOPS, LOOT } from '../../config.js';
import { AIR_SCALE, reviveSoldierMesh, ENEMY_DEFS, GLOW, S, WAVE, addLootBeacon, barWanted, buildGunship, buildHind, buildHip, cMod, camera, diffHpMul, heightAt, heliRoll, infMesh, loopHpMul, makeSoldierBar, scene, stanceBarK, tip, entryCheck, CO, netRand } from '../hub.js';

export const enemies=[]; export const enemyPool={};
// floating HP bar over each enemy tank (pooled; reuses the soldier billboard-bar mechanism)
export const enemyBarPool=[];
export function getEnemyBar(){ let b=enemyBarPool.pop(); if(!b){ b=makeSoldierBar(); b.g.scale.setScalar(1.5); scene.add(b.g); } b.g.visible=true; return b; }
export function freeEnemyBar(b){ if(!b) return; b.g.visible=false; enemyBarPool.push(b); }
export const _cv=new THREE.Vector3();   // (a shared temp)
export function updateEnemyBar(e){ if(!e.bar) return; { const w=barWanted(e); if(e.bar.g.visible!==w) e.bar.g.visible=w; if(!w) return; } const f=Math.max(0, e.hp/e.maxHp), ms=e.mesh.scale.x||1;   // Z107 hidden while at full health
  e.bar.g.position.set(e.pos.x, (e.def.inf?TROOPS.look.barY*stanceBarK(e.mesh):e.def.air?(e.pos.y||0)+2.4:2.7 + ms*0.95) + (e.def.air?0:heightAt(e.pos.x,e.pos.z)), e.pos.z); e.bar.g.quaternion.copy(camera.quaternion);   // float above the turret, always face camera
  e.bar.fill.scale.x=Math.max(0.001,f); e.bar.fill.position.x=-(1-f)*0.5;                              // shrink from the right
  e.bar.fill.material.color.setHex(f>0.5?0x7fe06a:(f>0.25?0xffcf5a:0xff5a4a));                         // green → amber → red
}
// a pooled mesh per type: a man (infantry) or an airframe (the gunship, the bomber helicopter, the transport)
export function getEnemyMesh(type){
  enemyPool[type] = enemyPool[type]||[];
  let m = enemyPool[type].pop();
  const _d=ENEMY_DEFS[type];
  if(!m){ const dice = CO.live ? Math.random : null; if(dice) Math.random = netRand;   // COOP 4 in a co-op battle a NEW mesh's own variations (his build, his tint) are not drawn from the battlefield's dice: the two pages' pools hold different numbers of men, and a garrison placed while the field is built must cost the same draws on both
    try{ if(_d.inf) m=infMesh(type); else if(_d.air) m=_d.bombHeli ? buildHind() : _d.troopHeli ? buildHip() : buildGunship(_d.pal); }finally{ if(dice) Math.random = dice; } }
  m.scale.setScalar(_d.scale*(_d.inf?1:AIR_SCALE)); if(_d.inf){ m.rotation.set(0,0,0); reviveSoldierMesh(m); const u=m.userData; u.pose=null; if(u.body){ u.body.rotation.set(0,0,0); u.body.position.set(0,0,0); } if(u.arms) u.arms.rotation.x=0; if(u.up) u.up.rotation.x=0; }   // Z105 a recycled man stands up again                       // always reset (elites scaled it up)   · (an airframe at the world's vehicle scale)
  const fx=m.getObjectByName('eliteFX'); if(fx){ m.remove(fx); if(fx.material) fx.material.dispose(); }   // strip old elite glow
  m.visible=true; return m;
}
export function makeElite(e){   // champion: tanky, bigger, glowing gold, pays big + always drops loot
  tip('elite');
  e.elite=true; e.hp=Math.round(e.hp*BALANCE.elite.hpMul); e.maxHp=e.hp; e.r*=1.3; e.loot=true;
  e.mesh.scale.multiplyScalar(BALANCE.elite.sizeMul);
  const g=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffd24a,transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false}));
  g.name='eliteFX'; g.scale.set(7,7,1); g.position.y=1.6; e.mesh.add(g);
}
// AI 2 how = the way in its caller vouches for ('edge' · 'gate' · 'door' · 'rope' · 'para' · 'fall' · 'hatch'); none named and the player would see the man appear:
//   he climbs out of a hatch instead (campaign/entries.js entryCheck)
export function spawnEnemy(type, x, z, how){
  if(!ENEMY_DEFS[type]) type = 'rifle';   // (no-tanks: an armoured type asked for by an old table is a rifleman)
  if(type==='gunship') type=heliRoll();   // Z222 a call for air support may bring the bomber or the transport instead
  const def=ENEMY_DEFS[type];
  const mesh=getEnemyMesh(type);
  mesh.position.set(x,0,z);
  const hp0 = Math.round(def.hp*loopHpMul()*cMod('enemyHpMul')*diffHpMul()*(1+RAMP.hpPerStage*(S.stage-1)));   // ×NG+ loop ×CONTRACT ×DIFFICULTY ×stage ramp
  const e={ type, def, mesh, turret:mesh.userData.turret, muzzle:mesh.userData.muzzle,
    pos:new THREE.Vector3(x,0,z), vel:new THREE.Vector3(),
    hp:hp0, maxHp:hp0, r:(def.inf?1.5:1.85)*def.scale, facing:0, aim:0,
    fireAt:performance.now()/1000 + Math.random()*1.2, burstLeft:0, stunUntil:0, kbx:0, kbz:0, hitT:0,
    loot: Math.random()<BALANCE.drop.enemy*cMod('lootChanceMul')*Math.min(LOOT.source.chanceCap, LOOT.source.chanceBase+def.hp*LOOT.source.chancePerHp), elite:false };   // Z93 tougher hulls carry loot more often  // some tanks carry a power-up (CONTRACT can boost loot)
  // elite: forced by an ELITE wave, else a small chance that grows with stage/loop (not on a man)
  if(def.inf){ e.r=0.55; e.ph=Math.random()*6; e.aimT=0; e.loot=Math.random()<0.04; e.fireAt+=0.8; }
  if(def.air){ e.ph=Math.random()*6; e.dir=Math.random()<0.5?-1:1; e.pos.y=ROSTER.gunship.alt; e.r=1.9; e.fireAt+=1.5; e.rocketAt=performance.now()/1000+3; }
  e.aimT=0;
  const eliteChance = def.inf ? 0 : Math.min(BALANCE.elite.capChance, BALANCE.elite.chancePerStage*(S.stage-1) + BALANCE.elite.chancePerLoop*(S.loop||0));
  if(!def.inf && WAVE.eliteForce>0){ WAVE.eliteForce--; makeElite(e); } else if(Math.random()<eliteChance) makeElite(e);
  e.bar=getEnemyBar(); e.bar.g.scale.setScalar(def.inf?0.8:1.5); updateEnemyBar(e);                       // floating HP bar over the tank
  if(def.inf) tip('infantry'); else if(def.air) tip('gunship');   // Z94 first sighting → field note
  enemies.push(e);
  if(def.inf) entryCheck(e, how);
  if(e.loot) addLootBeacon(e, 'enemy');
  return e;
}
