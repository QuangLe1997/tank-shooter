// fx/realwar.js — Z223 REAL WAR: the small things that make a firefight read as real.
//   · a blast that doesn't kill still THROWS a man flat — dazed, rifle down, head lolling — and shoves him away from the burst
//   · every Nth rifle round is a tracer, coloured by side (theirs green, ours red-orange) so you read who is firing where
//   · spent brass flicks out of the ejection port and a wisp of smoke hangs at the muzzle (only near the player, cheap)
//   · a big shell sends a skirt of dust racing out along the ground — the blast wave you can see
import { REAL } from '../../config.js';
import { BIOME, MOBILE, S, burst, dustRing, ejectBrass, fireFxOn, heightAt, poseSoldier, spawnPart, tracerEvery } from '../hub.js';

export const rndIn = a => a[0]+Math.random()*(a[1]-a[0]);

// a blast's survivor: thrown flat, dazed for a moment (can't move or fire), pushed away from the burst
export function concuss(u, x, z, now){ const C=REAL.concuss, dx=u.pos.x-x, dz=u.pos.z-z, L=Math.hypot(dx,dz)||1, k=1/(1+L*0.15);
  u.dazeUntil=Math.max(u.dazeUntil||0, now+rndIn(C.t)); u.kbx=(u.kbx||0)+dx/L*C.push*k; u.kbz=(u.kbz||0)+dz/L*C.push*k; u.aimT=0;
  const gy=heightAt(u.pos.x,u.pos.z); burst(u.pos, BIOME.ground, 3, 3, { y:gy+0.3, life:0.6, size:0.9, smoke:true, grav:-0.3, drag:2, op:0.4 }); }
export function dazed(u, now){ return (u.dazeUntil||0)>now; }
// the dazed pose: flat on the ground, head rolling, arms limp
export function dazePose(g, now, dt){ poseSoldier(g, 'prone', dt); const u=g.userData; if(u.head) u.head.rotation.z=Math.sin(now*3.1+(u.seed||0))*0.35; if(u.arms) u.arms.rotation.x+=(-0.3-u.arms.rotation.x)*Math.min(1,dt*6); }

// is this man's next round a tracer? (GUNFX 1 by his gun's class: a rifle REAL.tracer.every, an MG's belt SHOTFX.tracer.every.mg)
export function tracerNext(g, cls){ const u=g.userData; u.trN=(u.trN||0)+1; return u.trN%tracerEvery(cls||'rifle')===0; }

// brass out of the port (to the right of the line of fire — GUNFX 1 it flew out to the LEFT: (fz, −fx) is a man's left when he faces (fx, fz)) + a smoke wisp at the muzzle — only within REAL.brass.R of the player
export function rifleFX(x, y, z, ang, heavy, noSmoke){ const p=S.player; if(!p || (p.pos.x-x)**2+(p.pos.z-z)**2 > REAL.brass.R*REAL.brass.R) return;   // (Z355 noSmoke: a suppressed gun — the brass still flies)
  const fx=Math.sin(ang), fz=Math.cos(ang), rx=-fz, rz=fx, gy=heightAt(x,z), by=Math.max(gy+0.6, y-0.1);
  ejectBrass(x-fx*0.5+rx*0.1, by, z-fz*0.5+rz*0.1, rx*(1.6+Math.random()*1.4)-fx*0.6, 2+Math.random()*1.5, rz*(1.6+Math.random()*1.4)-fz*0.6, heavy?'mg':'rifle');   // Z419 a real case that tumbles, bounces and lies
  if(!noSmoke && (!MOBILE || Math.random()<0.4)) spawnPart(x+fx*0.15, y+0.02, z+fz*0.15, fx*0.8, 0.35, fz*0.8, { color:0xc9c4ba, size:heavy?0.6:0.42, life:0.7+Math.random()*0.4, smoke:true, grav:0.5, drag:2.2, grow:2.2, op:heavy?0.32:0.22 }); }

// a big blast: a ring of dust thrown out along the ground (the visible blast wave)
export function dustSkirt(x, z, k){ if(!(k>=REAL.shock.minScale)) return; const gy=heightAt(x,z), n=Math.round((MOBILE?8:16)*Math.min(1.6,k)), dc=BIOME.ground;
  if(fireFxOn()){ dustRing(x, z, Math.min(1.8,k), n, [8,13], [0.8,1.3], gy); return; }   // FIRE 3 the earth's own colour (not the grass's), shaped puffs
  for(let i=0;i<n;i++){ const a=i/n*6.283+Math.random()*0.3, c=Math.cos(a), s=Math.sin(a), sp=(8+Math.random()*5)*Math.min(1.8,k);
    spawnPart(x+c*0.8, gy+0.35, z+s*0.8, c*sp, 0.5+Math.random()*0.6, s*sp, { color:dc, size:(1.1+Math.random()*0.8)*Math.min(1.6,k), life:0.8+Math.random()*0.5, smoke:true, grav:0.15, drag:2.6, grow:1.9, op:0.42 }); } }

// Z223 DRILL — moving under fire a man runs bent low; at the end of a bound he throws himself flat (a puff of dust where he lands)
export function combatDive(g, x, z){ const u=g.userData; u.stAsk=1; const gy=heightAt(x,z);   // stAsk past the 0.35 s hold → the new stance commits this frame
  burst({ x, z }, BIOME.ground, 4, 2.5, { y:gy+0.2, life:0.6, size:0.8, smoke:true, grav:-0.3, drag:2.4, op:0.4 }); }
