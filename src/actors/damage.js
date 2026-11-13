// actors/damage.js — HARD TANK SEPARATION: tanks never overlap; a bump knocks the other away
import * as THREE from 'three';
import { BALANCE, INFANTRY, LOOT } from '../../config.js';
import { S, WAVE, _cv, addCoins, addDiamonds, addScore, bigExplode, bumpCombo, cMod, diffRewardMul, dropBeam, dropPowerup, enemies, enemyPool, floatText, freeEnemyBar, gunshipDown, hitFlash, infantryDown, loopRewardMul, maybeAbandon, popSmoke, radio, spawnEnemy, startDying, tankExplode, updateHUD } from '../hub.js';

// ---- HARD TANK SEPARATION: tanks never overlap; a bump knocks the other away ----
export function damageEnemy(e, dmg){
  if(e.def.carrier && e.crew){   // APC: fire wears the chassis AND picks off the exposed crew — down when EITHER is gone
    const live=e.crew.filter(c=>c.alive);
    if(live.length && Math.random()<0.6){ const c=live[(Math.random()*live.length)|0]; c.hp-=dmg*0.85;
      if(c.hp<=0){ c.alive=false; if(c.mesh) c.mesh.visible=false; c.mesh&&c.mesh.getWorldPosition(_cv);
        tankExplode(c.mesh?{x:_cv.x,z:_cv.z}:e.pos, 0xff9a5a, 0.5); floatText('✝','#ff9a7a',{x:e.pos.x,y:2.6,z:e.pos.z},16); } }
    e.hp -= dmg*0.6; hitFlash(e.mesh);                       // crew soak some, so the chassis lasts longer
    if(e.hp<=0 || e.crew.every(c=>!c.alive)) killEnemy(e);   // chassis destroyed OR all crew dead → it's down
    else maybeAbandon(e);                                    // Z116 the crew may bail out
    return;
  }
  e.hp-=dmg; hitFlash(e.mesh);
  if(e.def.smoke && !e.smoked && e.hp>0 && e.hp < (e.maxHp||e.def.hp)*0.55) popSmoke(e, performance.now()/1000);   // Z158 smoke screen
  if(e.hp<=0) killEnemy(e); else maybeAbandon(e);   // Z116 badly hit → the crew may bail out and leave it
}
export function killEnemy(e){
  const i=enemies.indexOf(e); if(i<0) return; enemies.splice(i,1); S.kitKills=(S.kitKills|0)+1;   // Z161 crew XP counts kills
  freeEnemyBar(e.bar); e.bar=null;
  if(e.def.chief){ S.cmdDown={ x:e.pos.x, z:e.pos.z, until:performance.now()/1000+8 }; radio('SCH: Xe chỉ huy địch đã bị hạ — đội hình chúng đang rối loạn, dồn lên!'); }   // Z158   // Z121 first thing: whatever happens below, a dead unit never keeps its HP bar
  if(e.def.bomber) tankExplode(e.pos, 0xff7a3d, e.def.scale*1.5, e.def.pal, e.mesh.scale.x, e._fx||'fire');   // the kamikaze just goes up
  if(e.laser){ dropBeam(e.laser); e.laser=null; } if(e.mesh.userData.weld) e.mesh.userData.weld.visible=false;
  try{ if(e.def.inf) infantryDown(e);                                                                       // Z79 soldier falls / is crushed
    else if(e.def.air) gunshipDown(e);                                                                       // Z80 gunship spirals down
    else startDying(e); }catch(err){ e.mesh.visible=false; (enemyPool[e.type]=enemyPool[e.type]||[]).push(e.mesh); console.error('death fx', err); }   // Z121 a broken effect must never stop the kill (score, loot, bar)
  if(e.def.carrier && e.crew){ const ex=e.pos.x, ez=e.pos.z; e.crew.forEach((c,k)=>{ if(c.alive && Math.random()<INFANTRY.bail) setTimeout(()=>{ if(S.mode==='playing') spawnEnemy('rifle', ex+(Math.random()-0.5)*4, ez+(Math.random()-0.5)*4); }, 300+k*220); }); }   // survivors bail out of the burning APC                                                                                          // knocked out: catches fire & smokes → cooks off → gone
  bumpCombo();
  const mult = (e.elite?BALANCE.elite.coinMul:1) * loopRewardMul() * diffRewardMul();
  addScore(Math.round(e.def.score*mult), new THREE.Vector3(e.pos.x,1.6,e.pos.z));
  addCoins(Math.max(5, Math.round(e.def.score/BALANCE.coinBountyDiv * mult * cMod('coinMul'))));   // coin bounty ≈ 1/10 of base score, ×elite ×loop ×CONTRACT
  const p=S.player; if(p.lifesteal>0 && p.hp<p.maxHp){ p.hp=Math.min(p.maxHp, p.hp+p.lifesteal); updateHUD(); }
  if(e.elite){ addDiamonds(BALANCE.elite.dia); bigExplode(e.pos, 0xffd24a, 2.0); floatText('HẠ TINH NHUỆ  +1 ◆', '#ffd24a', new THREE.Vector3(e.pos.x,2.4,e.pos.z), 22); }
  if(e.loot || WAVE.treasure) dropPowerup(e.pos, e.elite||e.def.hp>=LOOT.source.epicHp ? 2 : e.def.hp>=LOOT.source.rareHp ? 1 : 0);   // Z93 loot quality follows how hard it was to kill   // beacon-marked tanks (and every kill in a TREASURE wave) yield loot
  // recycle mesh + HP bar
  const fx=e.mesh.getObjectByName('eliteFX'); if(fx){ e.mesh.remove(fx); if(fx.material) fx.material.dispose(); }
  if(e.def.bomber){ e.mesh.visible=false; (enemyPool[e.type]=enemyPool[e.type]||[]).push(e.mesh); }   // others are recycled after their death fire (updateDying)
  freeEnemyBar(e.bar); e.bar=null;
}
