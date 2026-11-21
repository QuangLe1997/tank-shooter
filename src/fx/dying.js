// fx/dying.js — KILLED TANKS: Z402 the magazine goes the moment it dies — fireball, torn steel thrown out that fades, a smoke puff, the men round it hurt — and the hull is gone (no burning phase, no wreck)
import { TANK_BLAST } from '../../config.js';
import { aoeDamage, blastAllies, damageEnemy, damageSoldier, decalScorch, enemies, enemyPool, fireball, soldiers, spawnTankWreck, tankExplode } from '../hub.js';

// ---- Z402 KILLED TANKS BLOW APART AND ARE GONE: a knocked-out tank used to burn half a second, then leave its own model charred on the field for 9–13 s
//   (fx/fire-wrecks.js spawnWreck), smoking, solid to drive into. Now all of it happens in the frame it dies: the blast (fx/explosions.js tankExplode), its
//   torn steel flying out, glowing, landing and fading (fx/debris.js spawnTankWreck, pooled meshes), and its hull straight back in the pool — nothing left
//   standing where it was, nothing to collide with (the old DYING list that kept a burning hulk solid is gone with it) ----
export function startDying(e){ const m=e.mesh, s=m.scale.x||1, x=e.pos.x, z=e.pos.z, fx=e._fx||'fire';
  if(e.def.pyro){ fireball(e.pos, 1.8); aoeDamage(x, z, 6, 40, false, performance.now()/1000, 'FIRE'); decalScorch(x,z,5,1); }   // the fuel tanks go up
  { const R=TANK_BLAST.r*s, B=TANK_BLAST;                                                                                   // Z113 the blast kills the men standing around it
    for(const o of enemies.slice()){ if(!o.def.inf) continue; const dd=Math.hypot(o.pos.x-x, o.pos.z-z); if(dd<R){ o._blast={ x, z }; o._fx='blast'; damageEnemy(o, B.dmg*(1-(1-B.edge)*dd/R)); } }
    blastAllies(x, z, R, B.dmg*0.6); for(const so of soldiers.slice()) if(Math.hypot(so.pos.x-x, so.pos.z-z)<R) damageSoldier(so, B.dmg*0.5); }
  tankExplode(e.pos, 0xff7a3d, e.def.scale*1.5, e.def.pal, s, fx); spawnTankWreck(e.pos, s, e.def.pal, fx==='ice'||fx==='shock');   // Z402 it blows apart: torn steel flies, lands and fades
  m.visible=false; (enemyPool[e.type]=enemyPool[e.type]||[]).push(m); }   // the hull leaves the field now (pooled, like every enemy mesh)
