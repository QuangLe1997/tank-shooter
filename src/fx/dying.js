// fx/dying.js — KNOCKED-OUT tanks: engine dies, fire bursts from the hatches with thick black smoke, a few rounds pop… then the magazine goes
import { aoeDamage, burst, decalScorch, enemyPool, fireball, heightAt, sfx, spawnPart, spawnWreck, tankExplode } from '../hub.js';

// ---- KNOCKED-OUT tanks: engine dies, fire bursts from the hatches with thick black smoke, a few rounds pop… then the magazine goes ----
export const DYING=[];
export function startDying(e){ DYING.push({ e, t:0, dur:1.15+Math.random()*0.6, popT:0.25 }); burst(e.pos, 0xffd27a, 8, 7, {y:1.6, life:0.25, size:0.5, grav:-9, drag:2}); sfx('clang'); }
export function updateDying(dt){
  for(let i=DYING.length-1;i>=0;i--){ const d=DYING[i], e=d.e, m=e.mesh, s=m.scale.x||1, x=e.pos.x, z=e.pos.z, gy=heightAt(x,z); d.t+=dt; const k=Math.min(1,d.t/d.dur);
    const nF=1+Math.round(k*3); for(let q=0;q<nF;q++) if(Math.random()<0.8){ const ox=(Math.random()-0.5)*1.6*s, oz=(Math.random()-0.5)*2.2*s;
      spawnPart(x+ox, gy+1.9*s, z+oz, (Math.random()-0.5)*0.8, 2.6+Math.random()*2.4, (Math.random()-0.5)*0.8, {tex:'fire', color:0xffe0a0, color2:0xff3a0a, size:(0.8+k*1.2)*s, life:0.5+Math.random()*0.3, grav:2, drag:1.6, grow:0.7*s}); }
    if(Math.random()<0.7) spawnPart(x+(Math.random()-0.5)*s, gy+2.4*s, z+(Math.random()-0.5)*s, 0.6+(Math.random()-0.5), 2.4+Math.random()*1.5, 0.4+(Math.random()-0.5), {color:0x15120f, size:(1.3+k)*s, life:1.8, smoke:true, grav:0.4, drag:0.8, grow:1.8*s, op:0.6});
    d.popT-=dt; if(d.popT<=0){ d.popT=0.18+Math.random()*0.3; burst({x:x+(Math.random()-0.5)*s, z:z+(Math.random()-0.5)*s}, 0xffe6a0, 6, 6, {y:gy+1.8*s, life:0.22, size:0.35, grav:-10, drag:2}); m.position.x=x+(Math.random()-0.5)*0.12; sfx('hit', e.pos); }   // ammo cooking off
    if(d.t>=d.dur){ if(e.def.pyro){ fireball(e.pos, 1.8); aoeDamage(e.pos.x, e.pos.z, 6, 40, false, performance.now()/1000, 'FIRE'); decalScorch(e.pos.x,e.pos.z,5,1); }   // the fuel tanks go up
      tankExplode(e.pos, 0xff7a3d, e.def.scale*1.5, e.def.pal, s, e._fx||'fire'); spawnWreck(e.pos, e.facing, s, e.def.pal, Math.random()<0.65);
      m.visible=false; (enemyPool[e.type]=enemyPool[e.type]||[]).push(m); DYING.splice(i,1); } }
}
