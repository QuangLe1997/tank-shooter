// fx/hitfx.js — Z192 REAL ROUNDS & REAL HITS: a shell flies as a hot streak pointed along its path (not a glowing ball), a missile lays a
//   long lingering smoke ribbon behind a flickering motor flame, an enemy gun barks with flash + smoke at the real muzzle, a hit on armour
//   rocks the hull on its springs and throws molten spall back out of the hole (or skips off thick front plate in a shower of sparks),
//   and an enemy tank that is badly hurt smokes from the engine deck, then burns
import { BIOME, MOBILE, PERF, S, boss, enemies, heightAt, ricochet, spawnPart } from '../hub.js';

// point the pooled round along its velocity (yaw + the pitch of its real climb / fall this frame); the core is stretched at spawn
export function orientShell(b, y, dt){ const m=b.mesh, sp=Math.hypot(b.vx,b.vz)||1, vy=(dt>0 && b._py!=null) ? (y-b._py)/dt : 0; b._py=y;
  m.rotation.y=Math.atan2(b.vx,b.vz); m.rotation.x=-Math.atan2(vy, sp); }
// how long the hot core streak is for a round of this speed (a rocket keeps its own model)
export function shellStretch(sp){ return Math.max(1.3, Math.min(4.2, (sp||60)/24)); }

// a rocket motor: a flickering flame at the nozzle + a dense smoke ribbon laid down along the path, gap-free however fast it flies
export function rocketExhaust(b, x, y, z){ const bk=Math.hypot(b.vx,b.vz)||1, ux=b.vx/bk, uz=b.vz/bk, nx=x-ux*0.75, nz=z-uz*0.75, th=Math.max(0.4, PERF.parts), step=(MOBILE?1.3:0.7)/th;   // under load: fewer, fatter puffs — never a broken ribbon
  if(b._tx==null){ b._tx=nx; b._ty=y; b._tz=nz; }
  const dx=nx-b._tx, dy=y-b._ty, dz=nz-b._tz, L=Math.hypot(dx,dy,dz);
  if(L>=step){ const n=Math.min(14, Math.floor(L/step));
    for(let i=1;i<=n;i++){ const k=i*step/L; spawnPart(b._tx+dx*k, b._ty+dy*k, b._tz+dz*k, (Math.random()-0.5)*0.5, 0.2+Math.random()*0.3, (Math.random()-0.5)*0.5,
      { color:0xd6d1c6, size:((MOBILE?1.2:0.9)+Math.random()*0.25)/Math.sqrt(th), life:1.6+Math.random()*0.7, smoke:true, grav:0.1, drag:1.1, grow:2.6, op:0.8, keep:true }); }
    const k=n*step/L; b._tx+=dx*k; b._ty+=dy*k; b._tz+=dz*k; }
  spawnPart(nx, y, nz, -ux*5+(Math.random()-0.5), (Math.random()-0.5)*0.6, -uz*5+(Math.random()-0.5), { tex:'fire', color:0xfff4d0, color2:0xff6a1a, size:0.5+Math.random()*0.3, life:0.08, grav:0, drag:5, grow:0.4 });   // motor flame
  const rk=b.mesh.userData.rk, gs=rk && rk.userData.glow; if(gs) gs.scale.setScalar(0.7+Math.random()*0.55); }   // the glow at the nozzle flickers

// an enemy gun fires: flash, a tongue of flame, smoke rolling off the muzzle (at the muzzle's real height) — heavy guns kick up the dust too
export function enemyMuzzleFX(x, y, z, a, heavy){ const fx=Math.sin(a), fz=Math.cos(a), k=heavy?1.35:1;
  spawnPart(x+fx*0.5, y, z+fz*0.5, fx*5, 0, fz*5, { tex:'flash', color:0xfff2d8, size:2.0*k, life:0.05, grav:0, drag:8 });
  spawnPart(x+fx*0.9, y, z+fz*0.9, fx*8, 0.3, fz*8, { tex:'fire', color:0xfff0c0, color2:0xff5a14, size:0.9*k, grow:1.2, life:0.12, grav:0, drag:7 });
  for(let i=0;i<(MOBILE?1:3);i++){ const s=0.8+i*0.7; spawnPart(x+fx*s, y, z+fz*s, fx*(3-i)+(Math.random()-0.5), 0.4+Math.random()*0.4, fz*(3-i)+(Math.random()-0.5),
    { color:0xb8b0a2, size:(0.7+i*0.25)*k, life:1.0+Math.random()*0.5, smoke:true, grav:0.2, drag:2.2, grow:1.6, op:0.3 }); }
  if(heavy){ const gy=heightAt(x,z); for(let i=0;i<(MOBILE?2:4);i++){ const t=Math.random()*6.283; spawnPart(x+Math.cos(t)*0.8, gy+0.3, z+Math.sin(t)*0.8, Math.cos(t)*4+fx*3, 0.6, Math.sin(t)*4+fz*3,
    { color:BIOME.ground, size:1.1, life:0.8, smoke:true, grav:-0.2, drag:2.6, grow:1.5, op:0.38 }); } } }

// the blow rocks the hull on its suspension: pitched by a hit to the nose / tail, rolled by one to the side (heavier hulls barely move)
export function rockHull(t, ux, uz, dmg){ const rig=t && t.mesh && t.mesh.userData.rig; if(!rig) return;
  const rel=Math.atan2(ux,uz)-(t.facing||0), K=Math.min(1.3, (dmg||0)*0.018)/((t.def&&t.def.heavy) || t===boss ? 1.7 : 1);
  rig.pv += Math.cos(rel)*K; rig.rv += Math.sin(rel)*K*0.75; rig.vib=Math.min(1, (rig.vib||0)+K*0.4); }

// a round strikes a tank's armour at (x,y,z) travelling along (ux,uz): k = the round's weight, glance = it did not get through
export function armourHit(t, x, y, z, ux, uz, dmg, glance){ rockHull(t, ux, uz, dmg); const back=Math.atan2(-ux,-uz), small=dmg<15;
  if(glance){ ricochet(x, y, z, ux, uz);   // skips off the plate…
    for(let i=0;i<(small?2:(MOBILE?4:8));i++){ const a=back+(Math.random()-0.5)*2.4, sp=6+Math.random()*10; spawnPart(x, y, z, Math.sin(a)*sp, 1+Math.random()*4, Math.cos(a)*sp, { color:0xfff2c0, size:0.11, life:0.2+Math.random()*0.15, grav:-12, drag:1.5 }); }   // … in a shower of sparks
    return; }
  if(small){ for(let i=0;i<2;i++){ const a=back+(Math.random()-0.5)*1.8, sp=5+Math.random()*6; spawnPart(x, y, z, Math.sin(a)*sp, 1+Math.random()*3, Math.cos(a)*sp, { color:0xffe6a0, size:0.1, life:0.18, grav:-12, drag:1.5 }); } return; }
  const n=Math.min(MOBILE?6:12, 3+Math.round(dmg/12));
  for(let i=0;i<n;i++){ const a=back+(Math.random()-0.5)*1.5, sp=5+Math.random()*9; spawnPart(x, y, z, Math.sin(a)*sp, 1.5+Math.random()*5, Math.cos(a)*sp,
    { color:0xfff0b0, color2:0xff4a0a, size:0.13+Math.random()*0.1, life:0.4+Math.random()*0.4, grav:-16, drag:0.7 }); }   // molten spall blown back out of the hole
  spawnPart(x, y, z, 0, 0, 0, { tex:'fire', color:0xfff0c0, color2:0xff5a14, size:0.9+dmg*0.012, life:0.12, grav:0, drag:0, grow:0.8 });   // the strike's own fireball
  spawnPart(x-ux*0.3, y+0.2, z-uz*0.3, -ux*0.6, 1.0, -uz*0.6, { color:0x3a3530, size:0.9+dmg*0.01, life:1.5, smoke:true, grav:0.25, drag:1.2, grow:1.8, op:0.5 }); }   // and the hole smokes

// a hurt enemy tank smokes grey from the engine deck; nearly dead it pours black smoke and flames (near you only, on a small budget per frame)
export function enemyDamageFX(dt){ const p=S.player; if(!p || S.mode!=='playing') return; let budget=MOBILE?3:6;
  for(const e of enemies){ const D=e.def; if(D.inf || D.air || D.bomber || e.abandoned || !e.mesh || !e.mesh.visible) continue;
    const f=e.hp/(e.maxHp||D.hp||1); if(f>=0.55) continue;
    if((e.pos.x-p.pos.x)**2+(e.pos.z-p.pos.z)**2 > 85*85) continue;
    e._dsT=(e._dsT||0)-dt; if(e._dsT>0) continue; if(budget--<=0) break;
    const bad=f<0.28, s=e.mesh.scale.x||1, fa=e.facing||0; e._dsT=(MOBILE?0.2:0.11)*(bad?0.75:1.3);
    const bx=e.pos.x-Math.sin(fa)*1.4*s, bz=e.pos.z-Math.cos(fa)*1.4*s, by=heightAt(e.pos.x,e.pos.z)+1.7*s;
    spawnPart(bx+(Math.random()-0.5)*0.6, by, bz+(Math.random()-0.5)*0.6, 0.4+(Math.random()-0.5)*0.5, 1.8+Math.random()*1.2, 0.2+(Math.random()-0.5)*0.5,
      { color:bad?0x17130f:0x6c665e, size:(0.8+Math.random()*0.5)*s, life:1.6, smoke:true, grav:0.3, drag:0.9, grow:2, op:bad?0.55:0.36 });
    if(bad && Math.random()<0.6) spawnPart(bx+(Math.random()-0.5)*0.5, by-0.1, bz+(Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5, 2+Math.random()*1.4, (Math.random()-0.5)*0.5,
      { tex:'fire', color:0xffe0a0, color2:0xff3a0a, size:(0.6+Math.random()*0.5)*s, life:0.4, grav:1.4, drag:1.6, grow:0.6 }); } }
