// combat/flame.js — the soldier's FLAMETHROWER cone (fireFlame), lobbed rounds in flight (the M79, the hand grenade: updateRockets) and the gun in hand
//   (selectGun / cycleGun) — no-tanks: the tank's guns, the flame jet, the siege fuses and the gift guns are gone
import * as THREE from 'three';
import { BALANCE, REALCITY } from '../../config.js';
import { bladeCycle, bladeSelect, S, _RUP, _rdir, armorOf, bigExplode, blocks, damageBlock, damageEnemy, decalScorch, deformCrater, enemies, fortIntactCross, fortShellHit, heightAt, ringPulse, rockets, scene, sfx, spawnPart, typeMul, updateGunHUD, trafficCone, fireFxOn, flameJet, lobTrail } from '../hub.js';

// FLAMETHROWER — short-range cone of fire that sets enemies ALIGHT (a burn DoT applied/refreshed in updateEnemies)
export function fireFlame(now, g, x, z, ang, k=1, y){
  const F=BALANCE.flame, range=g.range||F.range, cx=Math.sin(ang), cz=Math.cos(ang);
  // ===== VISUAL: a STREAM of MOVING fire — burning fuel that projects out (like tracers) & cools white→red as it flies =====
  const nx=x+cx*0.8, nz=z+cz*0.8;
  if(fireFxOn()) flameJet(nx, y ?? heightAt(x,z)+1.3, nz, ang, range, now);   // FIRE 3 burning fuel drawn out along its flight, black smoke off the far end, the ground left alight (fx/blasts.js)
  else { for(let i=0;i<6;i++){
    const a=ang+(Math.random()-0.5)*0.42, v=range*2.8+Math.random()*range, big=Math.random()<0.45;   // fast outward, tight cone near the nozzle
    spawnPart(nx, 1.28+Math.random()*0.32, nz, Math.sin(a)*v, 1.5+Math.random()*1.5, Math.cos(a)*v,
      {color:0xfff0c0, color2:0x8a1c0a, size:0.7+Math.random()*0.5, grow:big?2.7:1.6, life:0.32+Math.random()*0.22, grav:5.5, drag:1.7});   // billows out then cools to ember-red
  }
  spawnPart(nx,1.35,nz, cx*6,0.8,cz*6, {color:0xfff7e2, color2:0xffae3a, size:1.5, grow:0.6, life:0.1, grav:0, drag:6});   // bright nozzle root flash
  if(Math.random()<0.4) spawnPart(x+cx*range*0.8, 2.6, z+cz*range*0.8, (Math.random()-0.5)*2.4, 1.6, (Math.random()-0.5)*2.4, {color:0x241b13, size:2.0, life:0.75, smoke:true, grav:-0.5, drag:1.5, op:0.4});   // rolling smoke
  if(Math.random()<0.5){ const d2=range*(0.35+Math.random()*0.5); spawnPart(x+cx*d2+(Math.random()-0.5)*2.5, 1.5, z+cz*d2+(Math.random()-0.5)*2.5, (Math.random()-0.5)*3, 3+Math.random()*3, (Math.random()-0.5)*3, {color:0xffb24a, color2:0xff5a1c, size:0.3, grow:0.5, life:0.5, grav:-2.5, drag:1.3}); }   // drifting embers
  }
  // ===== DAMAGE: light up every enemy inside the cone (ground-plane) =====
  for(const e of enemies){ if(e.def.air) continue; const dx=e.pos.x-x, dz=e.pos.z-z, d=Math.hypot(dx,dz);
    if(d > range + e.r) continue;
    if(fortIntactCross(x, z, e.pos.x, e.pos.z)) continue;          // Z170 fire doesn't pour through a fortress wall
    if(((dx*cx+dz*cz)/(d||1)) < F.cone) continue;                 // only enemies inside the flame cone catch fire
    if(!e.burn) e.burn={ lvl:0, until:0 };
    e.burn.lvl = Math.min(F.lvlMax, e.burn.lvl + F.add);          // each spray-tick stokes the fire (sustained → max fast)
    e.burn.until = now + F.duration; e.burn.k = Math.max(e.burn.k||1, k);   // Z149 the fire burns as hot as your damage upgrades
    e.hitT = Math.max(e.hitT, 0.08);
  }
  trafficCone(x, z, cx, cz, range, F.cone, (g.dmg || 10) * k * REALCITY.traffic.hit.flameK);   // Z320 the street's cars and scooters in the flame catch fire too
}
export function updateRockets(dt, now){
  for(let i=rockets.length-1;i>=0;i--){ const r=rockets[i]; r.tt+=dt;
    r.vy-=r.G*dt; r.x+=r.vx*dt; r.y+=r.vy*dt; r.z+=r.vz*dt; r.mesh.position.set(r.x,r.y,r.z);
    { const px=r.x-r.vx*dt, pz=r.z-r.vz*dt, wb=fortIntactCross(px, pz, r.x, r.z); if(wb){ fortShellHit(wb, px, pz, r.dmg||36, r.aoeR, r.wipe); scene.remove(r.mesh); rockets.splice(i,1); continue; } }   // Z170 mortar / howitzer / siege rocket coming down on a sealed fort bursts on its wall
    _rdir.set(r.vx,r.vy,r.vz); if(_rdir.lengthSq()>0.0001){ _rdir.normalize(); r.mesh.quaternion.setFromUnitVectors(_RUP,_rdir); }   // nose follows velocity
    const tx=r.x-_rdir.x*1.2, ty=r.y-_rdir.y*1.2, tz=r.z-_rdir.z*1.2;   // tail (behind the nozzle)
    if(fireFxOn()) lobTrail(r, tx, ty, tz);   // FIRE 3 a grenade / a shell in the air is a body, not a flame: a breath of grey
    else { for(let k=0;k<2;k++) spawnPart(tx+(Math.random()-0.5)*0.25, ty+(Math.random()-0.5)*0.25, tz+(Math.random()-0.5)*0.25, -_rdir.x*5+(Math.random()-0.5)*1.6, -_rdir.y*5+(Math.random()-0.5)*1.6, -_rdir.z*5+(Math.random()-0.5)*1.6, {color:0xfff0c0, color2:0xff3a10, size:0.7+Math.random()*0.5, grow:1.5, life:0.3+Math.random()*0.22, grav:0.3, drag:3});   // BURNING fire trail (cools white→red)
    if(Math.random()<0.85) spawnPart(tx, ty, tz, (Math.random()-0.5)*1.2, 0.2, (Math.random()-0.5)*1.2, {color:0x261f1a, size:1.0, life:0.6, smoke:true, grav:0.5, drag:1.8, op:0.4}); }   // dark smoke behind the fire
    const ud=r.mesh.userData; if(ud.plume){ ud.plume.scale.setScalar(1.9+Math.random()*0.5); ud.plume2.scale.setScalar(1.2+Math.random()*0.5); }   // flicker the engine flame
    if((r.vy<0 && r.y<=heightAt(r.x,r.z)+0.35) || r.tt>6){ scene.remove(r.mesh); rockets.splice(i,1);
      {   // a lobbed round (the M79, the hand grenade) bursts ON IMPACT where it really hits the ground
        const x=r.x, z=r.z, aoeR=r.aoeR||5, pos=new THREE.Vector3(x,1.1,z);
        bigExplode(pos, 0xffae5c, aoeR/3.2); if(!r.small) deformCrater(x, z, aoeR*0.5, 0.45+aoeR*0.06); else decalScorch(x, z, aoeR*0.6, 0.7);   // mortar / howitzer shell crater (grenades only scorch)
        if(!fireFxOn()){ ringPulse({x,z}, 0xffffff, aoeR*0.9); ringPulse({x,z}, 0xffd27a, aoeR*0.6); }   // FIRE 3 (no flat rings of light on the ground, no balls of fire: the burst is fx/blasts.js heBlast)
        if(!fireFxOn()) for(let k=0;k<5;k++){ const aa=Math.random()*6.28, rr=Math.random()*aoeR*0.7; spawnPart(x+Math.cos(aa)*rr,1,z+Math.sin(aa)*rr,(Math.random()-0.5)*4,2+Math.random()*3,(Math.random()-0.5)*4,{color:0xfff0c0,color2:0xff4a14,size:0.8,grow:1.4,life:0.4,grav:3,drag:2}); }
        for(const e of enemies.slice()){ if(e.def.air) continue; const dx=e.pos.x-x, dz=e.pos.z-z; if(dx*dx+dz*dz < aoeR*aoeR) damageEnemy(e, (r.dmg||30)*(r.small?typeMul('HE',armorOf(e)):1)); }   // shells can't reach aircraft
        for(const bl of blocks.slice()) if((bl.kind==='obj'||bl.kind==='tower'||bl.kind==='brick'||bl.kind==='camp'||bl.kind==='pylon') && Math.hypot(bl.x-x,bl.z-z) < aoeR+bl.r) damageBlock(bl, (r.dmg||30)*0.8);   // shells wreck structures too
        if(r.small){ S.shake=Math.min(1.4, S.shake+0.18); sfx('explode', {x,z}); } else { S.shake=Math.min(3.0, S.shake + 0.5 + aoeR*0.08); sfx('bigexplode'); }   // ground burst: earth clods come from fireball(), no metal debris   // bigger AoE → bigger boom (howitzer > mortar)
      }
    }
  }
}
export function selectGun(i){ const p=S.player; if(bladeSelect(i)) return;   /* BLADE 2 the slot after his guns is the blade (actors/blade.js) */ if(i<0||i>=p.guns.length) return; p.gunIdx=i; p.readyUntil=0; p.fireAt=performance.now()/1000+0.1; sfx('click'); updateGunHUD(); }   // keep each gun's own reload running
export function cycleGun(d=1){ const p=S.player; if(!p.guns.length) return; if(bladeCycle(d)) return;   /* BLADE 2 one more stop on the cycle: the blade */ selectGun((p.gunIdx+d+p.guns.length)%p.guns.length); }
