// actors/riders.js — TANK RIDERS: riflemen on the hull roof — spawn, fire from the tank, take hits, heal while riding (Z100)
import { TROOPS } from '../../config.js';
import { MGR, RIDER, S, TANK_SCALE, _sV, animateSoldier, boss, burst, camera, enemies, floatText, guardFireMul, makeSoldierBar, makeSoldierMesh, scene, sfx, shootGuard, soldierLvl, spawnBullet, spawnPart, towers, updateCrewBtn } from '../hub.js';
   // base 3 + TANK CREW upgrade (+1..3)
export const _RIDER_SLOTS=[[-0.85,1.5,-0.55],[0.85,1.5,-0.55],[0,1.5,-1.05],[0,1.5,0.55],                     // roof posts (tank-local, before facing+scale)
  [-1.25,1.05,0.55],[1.25,1.05,0.55],[-1.25,1.05,-0.35],[1.25,1.05,-0.35],[-1.25,1.05,-1.25],[1.25,1.05,-1.25],   // Z111b fenders, both sides
  [-0.55,1.1,-1.8],[0.55,1.1,-1.8]];                                                                          // rear deck → 12 seats, nobody stacked
export let riders=[], ridersUnlocked=false;
export function spawnRider(){ if(riders.length>=RIDER.cap) return; const g=makeSoldierMesh(); scene.add(g);
  const mhp=Math.round(RIDER.hp + Math.random()*16 - 6);   // each crew member is an individual
  const bar=makeSoldierBar(); scene.add(bar.g);
  riders.push({ g, bar:bar.g, barFill:bar.fill, hp:mhp, maxHp:mhp, fireAt:0, hurtAt:0, hitT:0, dead:false }); }
export function deployRiders(target){ while(riders.length<Math.min(RIDER.cap,target)) spawnRider(); updateCrewBtn(); }
export function clearRiders(){ for(const r of riders){ scene.remove(r.g); scene.remove(r.bar); } riders.length=0; updateCrewBtn(); }
export function damageRider(r, dmg){ if(r.dead) return; r.hp-=dmg; r.hitT=0.16;
  const t=r.g.userData.torso; if(t){ t.material.emissive.setHex(0xff5a2a); t.material.emissiveIntensity=0.85; }
  if(r.hp<=0) killRider(r); }
export function killRider(r){ if(r.dead) return; r.dead=true; const i=riders.indexOf(r); if(i>=0) riders.splice(i,1);
  const wp=r.g.position; burst({x:wp.x,z:wp.z}, 0xb04830, 8, 5, {y:wp.y, life:0.45, size:0.6}); floatText('✝','#ff9a7a',{x:wp.x,y:wp.y+1,z:wp.z},16); sfx('explode'); scene.remove(r.g); scene.remove(r.bar); updateCrewBtn(); }
export function updateRiders(dt, now){
  const p=S.player; if(!p || !riders.length) return;
  const ms=p.scale*TANK_SCALE, cf=Math.cos(p.facing), sf=Math.sin(p.facing);
  const enemyNear = enemies.some(e=>{ const dx=e.pos.x-p.pos.x, dz=e.pos.z-p.pos.z; return dx*dx+dz*dz < (p.radius+3)*(p.radius+3); });
  riders.forEach((r,i)=>{
    if(i===0 && MGR.on && MGR.gunner===r){ if(r.hp<r.maxHp) r.hp=Math.min(r.maxHp, r.hp+TROOPS.crewHeal*dt); const gp=r.g.position; r.bar.visible=r.hp<r.maxHp-0.5; r.bar.position.set(gp.x, gp.y+1.6*RIDER.scale*p.scale, gp.z); r.bar.quaternion.copy(camera.quaternion); r.bar.scale.setScalar(0.72); const f0=Math.max(0,r.hp/r.maxHp); r.barFill.scale.x=Math.max(0.001,f0); r.barFill.position.x=-(1-f0)*0.5; return; }   // Z167 the man on the roof gun is placed and animated by tank/roofmg.js
    if(r.hp<r.maxHp){ r.hp=Math.min(r.maxHp, r.hp+TROOPS.crewHeal*dt); if(Math.random()<dt*1.5) spawnPart(r.g.position.x, r.g.position.y+1.2, r.g.position.z, 0, 1.2, 0, {color:0x7dff8a, size:0.35, life:0.5, grav:0, drag:2}); }   // Z100 the tank is their aid station
    const o=_RIDER_SLOTS[i%_RIDER_SLOTS.length];
    const wx=p.pos.x+(o[0]*cf+o[2]*sf)*ms, wz=p.pos.z+(-o[0]*sf+o[2]*cf)*ms, wy=o[1]*ms+p.mesh.position.y;
    r.g.position.set(wx,wy,wz); r.g.scale.setScalar(RIDER.scale*p.scale); animateSoldier(r.g, 0, dt, false);
    let best=null, bd=RIDER.range*RIDER.range;   // small combat range (smaller than the tank's)
    for(const e of enemies){ if(e.abandoned) continue; const dx=e.pos.x-wx, dz=e.pos.z-wz, q=dx*dx+dz*dz; if(q<bd){ bd=q; best=e; } }
    if(boss&&boss.alive){ const dx=boss.pos.x-wx, dz=boss.pos.z-wz, q=dx*dx+dz*dz; if(q<bd){ bd=q; best=boss; } }
    let gBest=null;   // Z122 nobody on the field to shoot → the men on the wall / tower (they stand outside the `enemies` list, so the crew never saw them)
    if(!best){ let gq=RIDER.guardR*RIDER.guardR; for(const t of towers){ if(t.falling) continue; for(const gd of t.guards){ if(!gd.alive || gd.wx==null) continue; const dx=gd.wx-wx, dz=gd.wz-wz, q=dx*dx+dz*dz; if(q<gq){ gq=q; gBest={ t, gd }; } } } }
    if(best){ const ang=Math.atan2(best.pos.x-wx, best.pos.z-wz); r.g.rotation.y=ang;
      if(now>=r.fireAt){ r.fireAt=now + RIDER.fireCd*guardFireMul(); r.g.userData.kick=1;   // slow fire — GUARD: DRILL upgrade speeds it up
        r.g.userData.muzzle.getWorldPosition(_sV);
        spawnBullet(_sV.x,_sV.z,ang,{owner:'p', inf:true, dmg:RIDER.dmg*(1+soldierLvl*0.22), speed:80, color:0xe8ef86, r:0.24, life:1.0, maxDist:RIDER.range+2});
        spawnPart(_sV.x,_sV.y,_sV.z, Math.sin(ang)*5,0.4,Math.cos(ang)*5, {color:0xf2f7a0, size:0.4, life:0.06, grav:0, drag:9}); } }
    else if(gBest){ const G=gBest.gd, ang=Math.atan2(G.wx-wx, G.wz-wz); r.g.rotation.y=ang;
      if(now>=r.fireAt){ r.fireAt=now + RIDER.fireCd*guardFireMul()*1.3; r.g.userData.kick=1; r.g.userData.muzzle.getWorldPosition(_sV); const d=Math.hypot(G.wx-_sV.x, G.wz-_sV.z)||1;
        spawnPart(_sV.x,_sV.y,_sV.z, (G.wx-_sV.x)/d*80, (G.wy-_sV.y)/d*80, (G.wz-_sV.z)/d*80, {tex:'flash', color:0xe8ef86, size:0.32, life:d/80, grav:0, drag:0});   // tracer up at the platform
        if(Math.random()<RIDER.guardHit) shootGuard(gBest.t, G, wx, wz); } }   // a hit knocks him off the parapet
    else r.g.rotation.y += (p.facing - r.g.rotation.y)*Math.min(1,dt*4);   // ride facing forward
    if(enemyNear && now>=r.hurtAt){ damageRider(r, 5+S.stage); r.hurtAt=now+0.7; }   // exposed: crowding tanks chip the crew
    r.bar.visible = r.hp < r.maxHp-0.5; r.bar.position.set(wx, wy+1.6*RIDER.scale*p.scale, wz); r.bar.quaternion.copy(camera.quaternion); r.bar.scale.setScalar(0.72);
    const f=Math.max(0,r.hp/r.maxHp); r.barFill.scale.x=Math.max(0.001,f); r.barFill.position.x=-(1-f)*0.5;
    r.barFill.material.color.setHex(f>0.5?0x7fe06a:(f>0.25?0xffcf5a:0xff5a4a));
    if(r.hitT>0){ r.hitT-=dt; if(r.hitT<=0){ const t=r.g.userData.torso; if(t){ t.material.emissive.setHex(0x000000); t.material.emissiveIntensity=0; } } }
  });
}
export function __set_ridersUnlocked(v){ ridersUnlocked=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
