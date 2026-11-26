// combat/spells.js — the soldier's SKILLS in hand (one picked, cast on cooldown: combat/trooper-spells.js), his smoke screen, and the blasts every
//   weapon shares — AoE damage, a shell bursting on its spot, enemy ground strikes (no-tanks: the tank's equipment — smoke, APS, mines — is gone)
import * as THREE from 'three';
import { EQUIP, LETHAL, REAL } from '../../config.js';
import { bladeSpecial, TROOPER_SPELLS, COVER_HP, MOBILE, S, fpvDetonate, fpvFlying, armorOf, bigExplode, blastAllies, blocks, burst, cityBlast, concuss, core, damageBlock, damageCore, damageEnemy, damagePlayer, decalScorch, deformCrater, enemies, envDmg, fenceBlast, fortIntactCross, heightAt, ringPulse, sfx, siegeMul, spawnPart, structMul, suppress, tunnelBlast, typeMul, updateSpellHUD, blastTrees, sandBlastProof } from '../hub.js';
import { swimNoSkill } from '../hub.js';   // SWIM 1 (game/swim.js)

export function inSmoke(now){ const p=S.player; return !!(p && now<(p.smokeUntil||0) && Math.hypot(p.pos.x-p.smokeX, p.pos.z-p.smokeZ) < EQUIP.smoke.radius); }
export function updateEquip(dt, now){
  const p=S.player; if(!p) return;
  if(now<(p.smokeUntil||0)){ const left=p.smokeUntil-now, R=EQUIP.smoke.radius;                    // the screen billows, then thins out
    for(let k=0;k<(MOBILE?2:3);k++) if(Math.random()<Math.min(1,left/2)){ const a=Math.random()*6.283, r=Math.sqrt(Math.random())*R;
      spawnPart(p.smokeX+Math.cos(a)*r, heightAt(p.smokeX,p.smokeZ)+0.8+Math.random()*1.5, p.smokeZ+Math.sin(a)*r, (Math.random()-0.5)*0.8, 0.3+Math.random()*0.4, (Math.random()-0.5)*0.8, {color:0xd8dcd4, size:3+Math.random()*2, life:2.2, smoke:true, grav:-0.05, drag:0.8, grow:1.6, op:0.5}); } }
}
export function clearEquip(){ const p=S.player; if(p) p.smokeUntil=0; }
// Z307 the soldier's skills (combat/trooper-spells.js); the pick wraps to the list
export function spellList(){ return TROOPER_SPELLS; }
export function spellNow(){ const L=spellList(); return L[S.spell] || L[0]; }
// DRONE 1 a skill with own:true (the drones: combat/drone-skills.js) keeps a clock of its own (p.ownCd[id]) — launching a drone must not lock the grenade, nor
//   a grenade the jammer — and its cast may return false (nothing to launch, the sky full): then nothing is spent
export function spellReady(sp, p){ return sp.own ? (p.ownCd && p.ownCd[sp.id]) || 0 : p.spellCdUntil; }
export function spellHold(id, until){ const p=S.player; if(p) (p.ownCd || (p.ownCd={}))[id]=until; }
function castSpell(sp){ const p=S.player, now=performance.now()/1000; if(fpvFlying()){ fpvDetonate(); return false; }   // DRONE 2 any skill key while the FPV drone flies sets it off
  if(!p || !sp || now < spellReady(sp, p)) return false;
  if(swimNoSkill(sp)) return false;   // SWIM 1 no grenade, smoke or medkit while he swims (game/swim.js)
  if(sp.own){ if(sp.cast(now)===false) return false; spellHold(sp.id, Math.max(spellReady(sp, p), now + sp.cd * p.spellCdMul)); }
  else { p.spellCdUntil = now + sp.cd * p.spellCdMul; sp.cast(now); }
  sfx('spell'); updateSpellHUD(); return true; }
export function trySpell(){ if(S.mode!=='playing') return; if(bladeSpecial()) return;   /* BLADE 2 in blade mode the skill key is the blade's special */ castSpell(spellNow()); }
// a skill cast by a key of its own, whichever one is in hand (input/bindings.js: the drones' keys)
export function castSpellId(id){ if(S.mode!=='playing') return; const sp=spellList().find(s=>s.id===id); if(sp) castSpell(sp); }
export function cycleSpell(d=1){ const n=spellList().length; S.spell=((S.spell%n)+d+n)%n; updateSpellHUD(); sfx('click'); }
// Z104 blast vs a man on foot: 1 = killed (inside the core), else the fraction of the blast damage he takes (fades to edgeMin at reach)
export function infBlastK(d, r){ const c=r*LETHAL.core, R=r*LETHAL.reach; if(d<=c) return 1; if(d>=R) return 0; return LETHAL.edgeMin + (1-LETHAL.edgeMin)*(1-(d-c)/(R-c)); }
// Z193 a blast also shreds every piece of field cover (sandbags, crates, concrete…)
export function aoeDamage(x,z,r,dmg,stun,now,type,air,siege){ blastTrees(x, z, r);   // Z262 the trees round the blast go down
  fenceBlast(x, z, r);   // Z205 the wire goes down in a blast
  tunnelBlast(x, z, r, dmg);   // Z225 a blast caves in a tunnel way-in
  cityBlast(x, z, r);    // Z216 poles / lamps topple, parked cars burn out, street trees come down
  for(const b of blocks.slice()) if(b.kind==='building'||b.kind==='tower'||b.kind==='obj'||b.kind==='brick'||b.kind==='camp'||b.kind==='pylon'||b.kind==='gate'||b.kind==='fortwall'||b.kind==='fortcore'||b.hard||b.cover||b.supply||b.ub||(COVER_HP[b.kind]!=null && isFinite(b.hp))){ const dx=b.x-x, dz=b.z-z; if(dx*dx+dz*dz < (r+b.r)*(r+b.r) && !sandBlastProof(b, r, type)) damageBlock(b, dmg*0.7*(type?structMul(type,b):1)*(siege||1)); }   // Z112 + rocks / hedgehogs · Z418 the autocannon's little pop leaves sandbags be   // blasts bring watchtowers down
  for(const e of enemies.slice()){ if(e.def.air && !air) continue; const dx=e.pos.x-x, dz=e.pos.z-z, q=dx*dx+dz*dz; if(q < (r*LETHAL.reach+3)**2 && fortIntactCross(x, z, e.pos.x, e.pos.z)) continue;   // Z170 a blast outside a sealed fort stops at its wall
    if(e.def.inf && q<(r*2.2)**2) suppress(e, 0.6);   // Z173 a blast nearby: heads down
    if(e.def.inf){ const R=r*LETHAL.reach; if(q<R*R){ const k=infBlastK(Math.sqrt(q), r); e._blast={ x, z }; e._hitK=1+1.2*k; e._fx=e._fx||'blast'; if(stun)e.stunUntil=(now||performance.now()/1000)+2; damageEnemy(e, k>=1 ? e.hp+1 : dmg*k); } if(e.hp>0 && q<(r*REAL.concuss.reach)**2) concuss(e, x, z, now||performance.now()/1000); continue; }   // Z223 survivors thrown flat   // Z104 core = dead, ring = wounded
    if(q < r*r){ if(stun)e.stunUntil=(now||performance.now()/1000)+2; damageEnemy(e, dmg*(type?typeMul(type,armorOf(e))*envDmg(type):1)); } }
}
// Z232 a small HE burst: flash, a fistful of burning fragments, a dark puff, a ring the size of the blast — and an occasional scorch mark
function smallBurst(b){ const y=heightAt(b.x,b.z)+Math.max(0.5, Math.min(2.5, b.by||1)), k=b.aoe/1.3, pos={ x:b.x, y, z:b.z };
  spawnPart(b.x, y, b.z, 0,0,0, { tex:'flash', color:0xfff2d0, size:2.2*k, life:0.06, grav:0, drag:0 });
  spawnPart(b.x, y, b.z, 0,0.6,0, { tex:'fire', color:0xfff0c0, color2:0xff5a10, size:1.3*k, grow:1.4, life:0.18, grav:0.5, drag:4 });
  burst(pos, 0xffb050, Math.floor(7*k), 8*k, { y, life:0.28, size:0.5*k, grav:-6, drag:3.5 });
  burst(pos, 0x2a2420, 2, 2.2, { y, life:0.7, size:1.3*k, smoke:true, grav:-0.4, drag:2, op:0.42 });
  ringPulse(pos, 0xffb060, b.aoe*1.1); if(Math.random()<0.35) decalScorch(b.x, b.z, 0.9*k, 0.6); sfx('explode', { x:b.x, z:b.z }, 0.35); }
export function detonate(b){
  aoeDamage(b.x,b.z,b.aoe,b.aoeDmg||b.dmg,false,performance.now()/1000,b.type,true,siegeMul());
  if(b.aoe<2){ smallBurst(b); return; }   // Z232 an autocannon HE-I round (or HE ammo on a light gun): a quick bright pop, not a shell's fireball + screen shake
  bigExplode({x:b.x,y:b.mesh.position.y,z:b.z}, 0xffae5c, b.aoe/3.2, b.mesh.userData.rk ? 'heat' : 'he'); if(b.fx==='blast') deformCrater(b.x,b.z,0.9+b.aoe*0.25,0.28); }   // cannon/missile HE rounds scoop a shallow crater
// enemy AoE that hits the PLAYER + CORE (mortar shells, helicopter bombs)
export function enemyGroundStrike(x,z,r,dmg,now){
  bigExplode({x,z}, 0xff7a3d, r/3); blastAllies(x,z,r,dmg);
  const p=S.player; if(now>=p.invincibleUntil && (p.pos.x-x)**2+(p.pos.z-z)**2 < r*r) damagePlayer(dmg, now, p.pos.x-x, p.pos.z-z, 'blast');   // HIT 1 a blast, not a round
  if(core && (core.pos.x-x)**2+(core.pos.z-z)**2 < r*r) damageCore(dmg*0.7);
}
