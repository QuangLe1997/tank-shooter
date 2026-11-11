// fx/dying.js — KNOCKED-OUT tanks: engine dies, fire bursts from the hatches with thick black smoke, a few rounds pop… then the magazine goes
import { TANK_DEATH } from '../../config.js';
import { aoeDamage, burst, decalScorch, enemyPool, fireball, heightAt, sfx, spawnPart, spawnWreck, tankExplode } from '../hub.js';

// ---- KNOCKED-OUT tanks: engine dies, fire bursts from the hatches with thick black smoke, a few rounds pop… then the magazine goes ----
export const DYING=[];
export function startDying(e){ const fx=e._fx||'fire', R=TANK_DEATH[fx]||TANK_DEATH.fire, s=e.mesh.scale.x||1, gy=heightAt(e.pos.x,e.pos.z);   // Z112 how long it burns depends on what killed it
  DYING.push({ e, t:0, dur:R[0]+Math.random()*(R[1]-R[0]), popT:0.12, fx });
  burst(e.pos, 0xffd27a, 10, 8, {y:gy+1.6, life:0.25, size:0.55, grav:-9, drag:2}); sfx('clang');
  if(fx!=='ice' && fx!=='shock'){ fireball({x:e.pos.x, z:e.pos.z}, 0.55*s); for(let k=0;k<6;k++) spawnPart(e.pos.x+(Math.random()-0.5)*1.4*s, gy+1.8*s, e.pos.z+(Math.random()-0.5)*2*s, (Math.random()-0.5)*1.2, 4+Math.random()*3, (Math.random()-0.5)*1.2, {tex:'fire', color:0xfff0b0, color2:0xff3a0a, size:(1.8+Math.random())*s, life:0.6, grav:2, drag:1.4, grow:0.9*s}); }   // flames burst out of every hatch AT ONCE
}
export function updateDying(dt){
  for(let i=DYING.length-1;i>=0;i--){ const d=DYING[i], e=d.e, m=e.mesh, s=m.scale.x||1, x=e.pos.x, z=e.pos.z, gy=heightAt(x,z); d.t+=dt; const k=Math.min(1,d.t/d.dur);
    if(d.fx==='ice'){ if(Math.random()<0.6) spawnPart(x+(Math.random()-0.5)*1.6*s, gy+1.4*s, z+(Math.random()-0.5)*2*s, 0, 0.6, 0, {color:0xd8f6ff, size:0.7*s, life:0.5, smoke:true, grav:-0.2, drag:2, op:0.5}); }
    else if(d.fx==='shock'){ for(let q=0;q<2;q++) spawnPart(x+(Math.random()-0.5)*1.8*s, gy+(1+Math.random()*1.4)*s, z+(Math.random()-0.5)*2.4*s, (Math.random()-0.5)*8, (Math.random()-0.5)*6, (Math.random()-0.5)*8, {color:Math.random()<0.5?0xeaffff:0x4fb0ff, size:0.35*s, life:0.12, grav:0, drag:3}); m.position.x=x+(Math.random()-0.5)*0.18; }
    else { const nF=3+Math.round(k*3); for(let q=0;q<nF;q++) if(Math.random()<0.85){ const ox=(Math.random()-0.5)*1.6*s, oz=(Math.random()-0.5)*2.2*s;
      spawnPart(x+ox, gy+1.9*s, z+oz, (Math.random()-0.5)*0.8, 2.6+Math.random()*2.4, (Math.random()-0.5)*0.8, {tex:'fire', color:0xffe0a0, color2:0xff3a0a, size:(1.6+k*1.3)*s, life:0.5+Math.random()*0.3, grav:2, drag:1.6, grow:0.8*s}); } }   // Z112 big from the first frame
    if(Math.random()<0.7) spawnPart(x+(Math.random()-0.5)*s, gy+2.4*s, z+(Math.random()-0.5)*s, 0.6+(Math.random()-0.5), 2.4+Math.random()*1.5, 0.4+(Math.random()-0.5), {color:0x15120f, size:(1.3+k)*s, life:1.8, smoke:true, grav:0.4, drag:0.8, grow:1.8*s, op:0.6});
    d.popT-=dt; if(d.popT<=0){ d.popT=0.18+Math.random()*0.3; burst({x:x+(Math.random()-0.5)*s, z:z+(Math.random()-0.5)*s}, 0xffe6a0, 6, 6, {y:gy+1.8*s, life:0.22, size:0.35, grav:-10, drag:2}); m.position.x=x+(Math.random()-0.5)*0.12; sfx('hit', e.pos); }   // ammo cooking off
    if(d.t>=d.dur){ if(e.def.pyro){ fireball(e.pos, 1.8); aoeDamage(e.pos.x, e.pos.z, 6, 40, false, performance.now()/1000, 'FIRE'); decalScorch(e.pos.x,e.pos.z,5,1); }   // the fuel tanks go up
      tankExplode(e.pos, 0xff7a3d, e.def.scale*1.5, e.def.pal, s, e._fx||'fire'); spawnWreck(e.pos, e.facing, s, e.def.pal, d.fx==='blast'||d.fx==='pierce'||Math.random()<0.65);   // heavy shells always throw the turret
      m.visible=false; (enemyPool[e.type]=enemyPool[e.type]||[]).push(m); DYING.splice(i,1); } }
}
