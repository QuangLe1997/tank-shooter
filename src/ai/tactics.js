// ai/tactics.js — THE ENEMY'S FRAME: every enemy unit's HP bar, burning, stun and first sighting; then the infantry (actors/infantry.js) or the helicopter
//   (actors/helis.js) moves and fights (no-tanks: Z95 the tactical director, its armoured vehicles' steering, gun laying, smoke and ramming are gone)
import { BALANCE, TACTICS } from '../../config.js';
import { PROFILE, ENEMY_CLASS, ENVMOD, S, armorOf, enemies, heightAt, killEnemy, radio, spawnPart, typeMul, updateEnemyBar, updateHeli, updateInfantry, bloodSpurt, awareFrame, updateEntries, CO, coopFocus, coopFocusEnd } from '../hub.js';

export function aiIQ(){ const T=TACTICS.iq; return Math.max(0, Math.min(T.cap, T.base + T.perStage*(S.stage-1) + (T[PROFILE.difficulty]||0) + (S.loop||0)*T.loop)); }   // Z95 how sharp the enemy fights (the infantry reads it)
export function updateEnemies(dt, now){
  const p=S.player;
  const slow = now < S.enemySlowUntil ? 0.35 : 1;     // Time Warp spell
  updateEntries(dt, now);                             // AI 2 the men whose turn it is to climb out of a hatch (campaign/entries.js)
  awareFrame(dt, now);                                // AI 1 how visible the player is this moment, and the shouts of men just alerted (ai/awareness.js)
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i], def=e.def;
    updateEnemyBar(e);                                  // keep the floating HP bar pinned + facing camera every frame
    if(p && !e.seen && !def.inf){ const q=(e.pos.x-p.pos.x)**2+(e.pos.z-p.pos.z)**2; if(q<62*62){ e.seen=true; announceEnemy(e.type); } }   // Z158 first sighting of each class: the radio names it
    // ON FIRE (flamethrower DoT) — burns down HP over time; the fire grows
    if(e.burn){ const F=BALANCE.flame;
      if(now >= e.burn.until) e.burn=null;
      else if(e.def.inf){ e.hp -= F.dps * Math.max(1, e.burn.lvl) * (e.burn.k||1) * dt * ENVMOD.fire; if(Math.random() < dt*6) bloodSpurt(e.pos.x, e.pos.z, (Math.random()-0.5), (Math.random()-0.5), 0.5); e.burn = e.hp>0 && now < e.burn.until ? e.burn : null; if(e.hp<=0){ killEnemy(e); continue; } }   // Z337 in the soldier's war a man is wounded and bleeds, he is never set alight (only vehicles burn)
      else { e.burn.lvl = Math.min(F.lvlMax, e.burn.lvl + F.grow*dt); const n=e.burn.lvl;   // fire creeps bigger over time
        if(Math.random() < 0.5+0.35*n) spawnPart(e.pos.x+(Math.random()-0.5)*1.3, 1.1+Math.random()*(0.6+n*0.5), e.pos.z+(Math.random()-0.5)*1.3, (Math.random()-0.5)*1.6, 1.7+Math.random()*1.8, (Math.random()-0.5)*1.6, {color:Math.random()<0.5?0xff6a1c:0xffc24a, size:0.5+n*0.22, life:0.4, grav:0.4, drag:2.6});
        if(Math.random()<0.3) spawnPart(e.pos.x,1.7,e.pos.z, (Math.random()-0.5)*1,1.8,(Math.random()-0.5)*1, {color:0x16110b, size:0.9+n*0.4, life:0.7, smoke:true, grav:-0.5, drag:1.5, op:0.4});
        e.hp -= F.dps * n * (e.burn.k||1) * dt * typeMul('FIRE', armorOf(e)) * ENVMOD.fire; if(e.hp<=0){ killEnemy(e); continue; }   // burned to death → drop it (mesh already pooled)
      }
    }
    if(e.held) continue;   // BOSS 1 a fort boss in one of his own moves (campaign/fort-boss.js moves and poses him)
    // stunned (EMP / freeze power-up): hold still, no fire
    if(now < e.stunUntil){
      e.mesh.position.set(e.pos.x, e.def.inf?heightAt(e.pos.x,e.pos.z):(e.def.air?e.pos.y:0), e.pos.z);
      if(Math.random()<0.3) spawnPart(e.pos.x,2,e.pos.z, (Math.random()-0.5)*4,3,(Math.random()-0.5)*4,{color:0x6fd0ff,size:0.7,life:0.3,grav:-2});
      continue;
    }
    const edt = dt * slow;   // movement slow factor (Time Warp); doesn't affect shared dt
    if(def.inf){ if(CO.ai && coopFocus(e, now)){ try{ updateInfantry(e, dt, now, edt); }finally{ coopFocusEnd(); } continue; }   // COOP 5 on a co-op host this man regards the guest's soldier: "the player" is him for this update
      updateInfantry(e, dt, now, edt); continue; }                 // Z79 foot soldiers
    if(def.air) updateHeli(e, dt, now, edt);                                  // Z80 attack helicopter · Z222 bomber / transport
  }
}
// Z158 the radio names a class the first time it shows up in a battle
export function announceEnemy(type){ const C=ENEMY_CLASS[type]; if(!C) return; if(!S.seenTypes) S.seenTypes={}; if(S.seenTypes[type]) return; S.seenTypes[type]=1;
  radio('TÌNH BÁO: '+C.vi+' ('+C.model+') — '+C.tip); }
