// actors/damage.js — DAMAGE AND DEATH of an enemy unit: hits (the general's hit cap), the kill (score, coins, loot, the soldier's experience), the fall
import * as THREE from 'three';
import { BALANCE, LOOT } from '../../config.js';
import { S, WAVE, addScore, bigExplode, bumpCombo, diffRewardMul, dropBeam, dropPowerup, enemies, enemyPool, floatText, freeEnemyBar, gunshipDown, hitFlash, infantryDown, loopRewardMul, updateHUD, voiceKill, soldierKill, awareHit, awareDeath, dirKill, storyCue } from '../hub.js';

export function damageEnemy(e, dmg){
  if(e.hitCap) dmg=Math.min(dmg, e.hitCap);   // Z353 the general on foot: no single hit (a grenade's core, a 12.7 slug) takes more than a slice of him
  e.hp-=dmg; hitFlash(e.mesh);
  if(e.hp<=0) killEnemy(e); else if(e.def.inf) awareHit(e);   // AI 1 a man who is hit knows at once he is in a fight
}
export function killEnemy(e){
  const i=enemies.indexOf(e); if(i<0) return; enemies.splice(i,1); if(e._big && !e.def.inf){ const n=performance.now()/1000; S.hitStop=n+0.05; S.shake=Math.min(3.2,(S.shake||0)+0.6); } if(!e.def.inf) voiceKill();   // Z168 a heavy round that kills a vehicle: a beat of hit-stop
  freeEnemyBar(e.bar); e.bar=null;
  dirKill();   // DIR 1 the director's clock since the last enemy fell
  storyCue('kill', e);   // STORY 2 the first enemy down near him, a run of them: a word on the radio (campaign/story.js)
  if(e.def.inf) awareDeath(e);   // AI 1 a mate falling beside them alerts the men near him (ai/awareness.js)
  if(e.laser){ dropBeam(e.laser); e.laser=null; }
  try{ if(e.def.inf) infantryDown(e);                                                                       // Z79 soldier falls / is crushed
    else gunshipDown(e); }catch(err){ e.mesh.visible=false; (enemyPool[e.type]=enemyPool[e.type]||[]).push(e.mesh); console.error('death fx', err); }   // Z80 an aircraft spirals down · Z121 a broken effect must never stop the kill (score, loot, bar)
  bumpCombo(); soldierKill(e);   // Z350 the soldier's experience · Z352 his weapon on the ground
  const mult = (e.elite?BALANCE.elite.scoreMul:1) * loopRewardMul() * diffRewardMul();
  addScore(Math.round(e.def.score*mult), new THREE.Vector3(e.pos.x,1.6,e.pos.z));
  const p=S.player; if(p.lifesteal>0 && p.hp<p.maxHp){ p.hp=Math.min(p.maxHp, p.hp+p.lifesteal); updateHUD(); }
  if(e.elite){ bigExplode(e.pos, 0xffd24a, 2.0); floatText('HẠ TINH NHUỆ', '#ffd24a', new THREE.Vector3(e.pos.x,2.4,e.pos.z), 22); }
  if(e.loot || WAVE.treasure) dropPowerup(e.pos, e.elite||e.def.hp>=LOOT.source.epicHp ? 2 : e.def.hp>=LOOT.source.rareHp ? 1 : 0);   // Z93 loot quality follows how hard it was to kill   // beacon-marked tanks (and every kill in a TREASURE wave) yield loot
  // recycle mesh + HP bar
  const fx=e.mesh.getObjectByName('eliteFX'); if(fx){ e.mesh.remove(fx); if(fx.material) fx.material.dispose(); }
  freeEnemyBar(e.bar); e.bar=null;
}
