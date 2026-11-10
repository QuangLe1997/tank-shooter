// actors/fireteam.js — Z89/Z100 friendly FIRETEAM: the APC that brings them, free-roam inside the tank's combat zone, recall.
import * as THREE from 'three';
import { TROOPS } from '../../config.js';
import { ARENA, PLAYER_PAL, RIDER, S, TANK_SCALE, _sV, animateSoldier, animateTank, blocks, boss, buildTank, burst, camera, decorateEnemyMesh, enemies, floatText, heightAt, makeSoldierBar, makeSoldierMesh, playerRange, radio, rangeRing, riders, scene, sfx, solidTank, spawnBullet, spawnPart, spawnRider, updateCrewBtn, wrapAngle } from '../hub.js';

// ---- friendly FIRETEAM ----
export const FT=[]; export let FT_APC=null;
export function callFireteam(now){
  const F=TROOPS.fireteam, p=S.player, want=Math.min(F.cap, Math.round(F.size+(S.stage-1)*F.perStage)), need=want-FT.length;
  if(need<=0){ for(const a of FT) a.hp=a.maxHp; floatText('TỔ BỘ BINH ĐÃ TIẾP TẾ','#9bd14a',p.pos,16); return; }
  if(FT_APC) { FT_APC.load+=need; return; }
  const m=buildTank(PLAYER_PAL); m.userData.friendly=true; m.userData.palOverride={hull:0x5e7a2e,turret:0x6a8434,barrel:0x8aa048,tread:0x2a3514,accent:0xe7b54a};
  decorateEnemyMesh(m,'carrier'); for(let i=0;i<3;i++){ const c=m.getObjectByName('crew'+i); if(c) c.visible=true; }
  m.scale.setScalar(1.34*TANK_SCALE); scene.add(m);
  const ex=Math.max(-ARENA+6, Math.min(ARENA-6, p.pos.x+(Math.random()-0.5)*16)), ez=ARENA-4;                // rolls in from our side of the field
  FT_APC={ mesh:m, pos:new THREE.Vector3(ex,0,ez), vel:new THREE.Vector3(), facing:Math.PI, load:need, state:'in', t:0, dropped:0 };
  radio('SCH: Tổ bộ binh đang tới — xe bọc thép ta ngay sau lưng anh.'); sfx('beep');
}
export function updateFireteamAPC(dt, now){
  const A=FT_APC; if(!A) return; const p=S.player, m=A.mesh, rmp=m.getObjectByName('ramp'); A.t+=dt;
  let tx, tz, spd=14;
  if(A.state==='in'){ tx=p.pos.x-Math.sin(p.facing)*7; tz=p.pos.z-Math.cos(p.facing)*7; if(Math.hypot(tx-A.pos.x,tz-A.pos.z)<4 || A.t>9){ A.state='drop'; A.t=0; } }
  else if(A.state==='drop'){ tx=A.pos.x; tz=A.pos.z; spd=0; if(rmp) rmp.rotation.x=Math.min(1.25, A.t*2.6);
    while(A.t>0.5 && A.dropped<A.load && A.t > 0.5+A.dropped*0.32){ const bx=A.pos.x-Math.sin(A.facing)*3.6, bz=A.pos.z-Math.cos(A.facing)*3.6; spawnAlly(bx,bz, A.facing+Math.PI+(A.dropped%2?0.7:-0.7)); A.dropped++; }
    if(A.dropped>=A.load && A.t>0.5+A.load*0.32+0.5){ A.state='out'; A.t=0; } }
  else { tx=A.pos.x; tz=ARENA+14; if(rmp) rmp.rotation.x=Math.max(0, rmp.rotation.x-dt*2); if(A.pos.z>ARENA+8){ scene.remove(m); FT_APC=null; return; } }
  const dx=tx-A.pos.x, dz=tz-A.pos.z, d=Math.hypot(dx,dz)||1, want=d>1?spd:0;
  A.vel.x+=(dx/d*want-A.vel.x)*Math.min(1,dt*2); A.vel.z+=(dz/d*want-A.vel.z)*Math.min(1,dt*2); A.pos.addScaledVector(A.vel, dt);
  if(A.state!=='out'){ const lim=ARENA-4; A.pos.x=Math.max(-lim,Math.min(lim,A.pos.x)); A.pos.z=Math.max(-lim,Math.min(lim,A.pos.z)); }
  const sp=Math.hypot(A.vel.x,A.vel.z); if(sp>1){ A.facing+=wrapAngle(Math.atan2(A.vel.x,A.vel.z)-A.facing)*Math.min(1,dt*3); }
  m.position.set(A.pos.x,0,A.pos.z); m.rotation.y=A.facing; animateTank(m, A.pos.x, A.pos.z, A.facing, dt);
}
export function spawnAlly(x, z, dirA){ const F=TROOPS.fireteam, g=makeSoldierMesh(); g.scale.setScalar(1.15); scene.add(g); const bar=makeSoldierBar(); bar.g.scale.setScalar(0.7); scene.add(bar.g);
  const k=FT.length; FT.push({ g, bar:bar.g, barFill:bar.fill, pos:new THREE.Vector3(x,0,z), hp:F.hp, maxHp:F.hp, fireAt:0, slot:k, kbx:Math.sin(dirA)*6, kbz:Math.cos(dirA)*6, hitT:0, dead:false, facing:dirA }); }
export function damageAlly(a, dmg){ if(a.dead) return; a.hp-=dmg; a.hitT=0.16; const t=a.g.userData.torso; if(t){ t.material.emissive.setHex(0xff5a2a); t.material.emissiveIntensity=0.85; }
  if(a.hp<=0){ a.dead=true; const i=FT.indexOf(a); if(i>=0) FT.splice(i,1); burst(a.pos, 0x2c331c, 5, 4, {y:0.8, life:0.7, size:1.1, smoke:true, op:0.4}); floatText('✝','#ff9a7a',{x:a.pos.x,y:1.7,z:a.pos.z},16);
    scene.remove(a.g); scene.remove(a.bar); FT.forEach((o,j)=>o.slot=j); updateCrewBtn(); } }
export function clearFireteam(){ S.recall=false; for(const a of FT){ scene.remove(a.g); scene.remove(a.bar); } FT.length=0; if(FT_APC){ scene.remove(FT_APC.mesh); FT_APC=null; } updateCrewBtn(); }
export function infPushBlocks(pos){ for(const bl of blocks){ if(bl.obb){ const s_=Math.sin(bl.obb.f), c_=Math.cos(bl.obb.f), dx_=pos.x-bl.x, dz_=pos.z-bl.z, al=dx_*s_+dz_*c_, ac=dx_*c_-dz_*s_, hw=bl.obb.hw+0.4; if(Math.abs(al)<bl.obb.hl+0.3 && Math.abs(ac)<hw){ const push=(ac<0?-hw:hw)-ac; pos.x+=c_*push; pos.z-=s_*push; } continue; }
  const bx=pos.x-bl.x, bz=pos.z-bl.z, q=bx*bx+bz*bz, rr=bl.r+0.45; if(q<rr*rr && q>1e-4){ const qq=Math.sqrt(q); pos.x=bl.x+bx/qq*rr; pos.z=bl.z+bz/qq*rr; } } }
// Z100 FREE-ROAM SQUAD — soldiers are not glued to the tank. Each one fights anywhere inside the tank's COMBAT ZONE (the faint range ring):
// it hunts the nearest enemy it can reach without leaving the zone, takes a post when the field is quiet, keeps personal space,
// and falls back on its own when it drifts outside the zone. HOLD the crew command (G / LÍNH) to recall: everyone runs to the hull and
// climbs aboard; RELEASE ends the recall — whoever has not made it stays on foot.
export function squadZone(){ const F=TROOPS.fireteam; return Math.max(F.zoneMin, playerRange()*F.zoneMul); }
function allyTarget(a, zone){ const F=TROOPS.fireteam, p=S.player; let best=null, bd=F.detect*F.detect;
  const consider=(t)=>{ const qx=t.pos.x-a.pos.x, qz=t.pos.z-a.pos.z, q=qx*qx+qz*qz; if(q>=bd) return; const tz=Math.hypot(t.pos.x-p.pos.x, t.pos.z-p.pos.z); if(tz > zone+F.range*0.85) return; bd=q; best=t; };   // only fights it can win from inside the zone
  for(const e of enemies){ if(e.def.air && Math.random()<0.5) continue; consider(e); }
  if(boss&&boss.alive) consider(boss);
  return best; }
function clampToZone(x, z, zone){ const p=S.player, dx=x-p.pos.x, dz=z-p.pos.z, d=Math.hypot(dx,dz); if(d<=zone) return [x,z]; return [p.pos.x+dx/d*zone, p.pos.z+dz/d*zone]; }
export function updateFireteam(dt, now){
  updateFireteamAPC(dt, now); if(!FT.length) return;
  const F=TROOPS.fireteam, p=S.player, zone=squadZone();
  if(S.recall){ rangeRing.material.opacity = 0.3+0.15*Math.sin(now*10); }                            // recall in progress: the zone ring pulses
  for(const a of FT.slice()){ a.mounting = !!S.recall;
    if(a.mounting){ const dx=p.pos.x-a.pos.x, dz=p.pos.z-a.pos.z, d=Math.hypot(dx,dz)||1, ox=a.pos.x, oz=a.pos.z;   // run back to the tank and climb aboard
      if(d < p.radius+2.4 && riders.length<RIDER.cap){ const i=FT.indexOf(a); FT.splice(i,1); scene.remove(a.g); scene.remove(a.bar); spawnRider(); const r=riders[riders.length-1]; r.hp=Math.max(6, a.hp/a.maxHp*r.maxHp); S.recallIn=(S.recallIn||0)+1; floatText('LÊN XE '+S.recallIn, '#9bd14a', p.pos, 14); FT.forEach((o,j)=>o.slot=j); updateCrewBtn(); continue; }
      a.pos.x+=dx/d*F.sprint*dt; a.pos.z+=dz/d*F.sprint*dt; infPushBlocks(a.pos); a.facing=Math.atan2(dx,dz);
      a.g.position.set(a.pos.x, heightAt(a.pos.x,a.pos.z), a.pos.z); a.g.rotation.y=a.facing; animateSoldier(a.g, Math.hypot(a.pos.x-ox,a.pos.z-oz)/1.15, dt, false);
      a.bar.position.set(a.pos.x, 2.5+heightAt(a.pos.x,a.pos.z), a.pos.z); a.bar.quaternion.copy(camera.quaternion); continue; }
    const ox=a.pos.x, oz=a.pos.z, dT=Math.hypot(a.pos.x-p.pos.x, a.pos.z-p.pos.z);
    if(dT > zone) a.falling=true; else if(dT < zone*0.75) a.falling=false;                          // drifted out (or the tank drove off) → fall back inside
    const best = a.falling ? null : allyTarget(a, zone);
    let gx, gz, sprint=false;
    if(a.falling){ const k=zone*0.6/(dT||1); gx=p.pos.x+(a.pos.x-p.pos.x)*k; gz=p.pos.z+(a.pos.z-p.pos.z)*k; sprint=true; }
    else if(best){ const qx=best.pos.x-a.pos.x, qz=best.pos.z-a.pos.z, qd=Math.hypot(qx,qz)||1;
      if(qd > F.range*0.85){ [gx,gz]=clampToZone(best.pos.x-qx/qd*F.range*0.7, best.pos.z-qz/qd*F.range*0.7, zone*0.95); }          // close to firing range, but never past the zone edge
      else { if(now>(a.strafeAt||0)){ a.strafeAt=now+1.4+Math.random()*1.6; a.strafe=(Math.random()<0.5?-1:1)*(1.5+Math.random()*2); }   // in range: hold and shuffle sideways (harder to hit)
        [gx,gz]=clampToZone(a.pos.x - qz/qd*a.strafe, a.pos.z + qx/qd*a.strafe, zone*0.95); } }
    else { if(!a.post || now>(a.postAt||0) || Math.hypot(a.post[0]-p.pos.x, a.post[1]-p.pos.z) > zone*0.85){   // quiet: take up a post around the tank
        const ang=Math.random()*6.283, r=F.patrol[0]+Math.random()*(F.patrol[1]-F.patrol[0]); a.post=[p.pos.x+Math.sin(ang)*r, p.pos.z+Math.cos(ang)*r]; a.postAt=now+4+Math.random()*3; }
      gx=a.post[0]; gz=a.post[1]; }
    let mx=gx-a.pos.x, mz=gz-a.pos.z; const md=Math.hypot(mx,mz);
    for(const o of FT){ if(o===a) continue; const sx=a.pos.x-o.pos.x, sz=a.pos.z-o.pos.z, sq=sx*sx+sz*sz; if(sq < F.spread*F.spread && sq>1e-4){ const k=(F.spread-Math.sqrt(sq))*2; mx+=sx*k; mz+=sz*k; } }   // personal space
    const ml=Math.hypot(mx,mz); if(ml>0.3){ const sp=(sprint||md>12) ? F.sprint : F.speed; a.pos.x+=mx/ml*Math.min(ml,sp*dt); a.pos.z+=mz/ml*Math.min(ml,sp*dt); }
    if(a.kbx||a.kbz){ a.pos.x+=a.kbx*dt; a.pos.z+=a.kbz*dt; const kf=Math.max(0,1-dt*5); a.kbx*=kf; a.kbz*=kf; if(Math.abs(a.kbx)+Math.abs(a.kbz)<0.1){ a.kbx=a.kbz=0; } }
    const px=a.pos.x-p.pos.x, pz=a.pos.z-p.pos.z, pd=Math.hypot(px,pz); if(pd<p.radius+1.4 && pd>1e-3){ a.pos.x=p.pos.x+px/pd*(p.radius+1.4); a.pos.z=p.pos.z+pz/pd*(p.radius+1.4); }   // step clear of our own tracks
    infPushBlocks(a.pos); const lim=ARENA-2; a.pos.x=Math.max(-lim,Math.min(lim,a.pos.x)); a.pos.z=Math.max(-lim,Math.min(lim,a.pos.z));
    let fired=false;
    const shoot = best && Math.hypot(best.pos.x-a.pos.x, best.pos.z-a.pos.z) < F.range;
    if(shoot){ const ang=Math.atan2(best.pos.x-a.pos.x, best.pos.z-a.pos.z); a.facing+=wrapAngle(ang-a.facing)*Math.min(1,dt*10);
      if(now>=a.fireAt && Math.abs(wrapAngle(ang-a.facing))<0.3){ a.fireAt=now+F.fireCd*(0.8+Math.random()*0.4); fired=true; a.g.userData.muzzle.getWorldPosition(_sV);
        spawnBullet(_sV.x,_sV.z,ang+(Math.random()-0.5)*0.06,{owner:'p', dmg:F.dmg*(1+(S.stage-1)*0.12), speed:80, color:0xe8ef86, r:0.24, life:1.4, maxDist:F.range+2, noArc:true, y:_sV.y});
        spawnPart(_sV.x,_sV.y,_sV.z, Math.sin(ang)*6,0.4,Math.cos(ang)*6, {tex:'flash', color:0xf2f7a0, size:0.5, life:0.06, grav:0, drag:9}); sfx('rifleShot', a.pos); } }
    else { const mv=Math.hypot(a.pos.x-ox,a.pos.z-oz); if(mv>0.01) a.facing+=wrapAngle(Math.atan2(a.pos.x-ox,a.pos.z-oz)-a.facing)*Math.min(1,dt*8); }
    let jy=0; if(a.jumpT>0){ a.jumpT-=dt; const u=Math.max(0,a.jumpT)/0.4; jy=Math.max(0,(a.jy-heightAt(a.pos.x,a.pos.z)))*u*u + Math.sin((1-u)*Math.PI)*0.5; }   // hop off the hull
    a.g.position.set(a.pos.x, heightAt(a.pos.x,a.pos.z)+jy, a.pos.z); a.g.rotation.y=a.facing;
    animateSoldier(a.g, Math.hypot(a.pos.x-ox,a.pos.z-oz)/1.15, dt, fired);
    for(const e of enemies){ if(!solidTank(e)) continue; const qx=e.pos.x-a.pos.x, qz=e.pos.z-a.pos.z; if(qx*qx+qz*qz < (e.r+0.8)**2){ if(Math.hypot(e.vel.x,e.vel.z)>4) damageAlly(a, 999); else { const L=Math.hypot(qx,qz)||1; a.pos.x-=qx/L*0.5; a.pos.z-=qz/L*0.5; } } }   // enemy tracks crush them too
    if(a.dead) continue;
    a.bar.visible=true; a.bar.position.set(a.pos.x, 2.5+heightAt(a.pos.x,a.pos.z), a.pos.z); a.bar.quaternion.copy(camera.quaternion);
    const f=Math.max(0,a.hp/a.maxHp); a.barFill.scale.x=Math.max(0.001,f); a.barFill.position.x=-(1-f)*0.5; a.barFill.material.color.setHex(f>0.5?0x7fe06a:(f>0.25?0xffcf5a:0xff5a4a));
    if(a.hitT>0){ a.hitT-=dt; if(a.hitT<=0){ const t=a.g.userData.torso; if(t){ t.material.emissive.setHex(0x000000); t.material.emissiveIntensity=0; } } }
  }
}
