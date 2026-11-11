// actors/drone.js — SUPPORT DRONE (power-up)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BALANCE } from '../../config.js';
import { GLOW, NOW, S, boss, burst, camera, droneBonusHp, droneDmgMul, droneOwned, droneReloadMul, enemies, floatText, makeSoldierBar, muzzleFlash, scene, sfx, shootGuard, spawnBullet, spawnPart, tankExplode, towers, wrapAngle } from '../hub.js';

// ----------------------------- SUPPORT DRONE (power-up) -----------------------------
// A 22s orbiting GUNSHIP: sleek fuselage, 4 spinning rotors, glowing sensor eye + an underslung 6-barrel
// gatling (nòng xoáy) that spins up to hose the nearest enemy inside DRONE.detect (reaches beyond the player).
// It is NOT invincible — enemy fire crossing its orbit chips its HP; at 0 it detonates. Tuning → BALANCE.drone.
export const DRONE = BALANCE.drone;
export function makeDroneMesh(){
  const g=new THREE.Group();
  const hull = ()=> new THREE.MeshStandardMaterial({color:0x232b31, metalness:0.72, roughness:0.4});
  const dark = ()=> new THREE.MeshStandardMaterial({color:0x12181c, metalness:0.6, roughness:0.5});
  const steel= ()=> new THREE.MeshStandardMaterial({color:0x1b2024, metalness:0.88, roughness:0.32});
  const accentMat = new THREE.MeshStandardMaterial({color:0x0a2730, emissive:0x4fd1ff, emissiveIntensity:1.1, metalness:0.5, roughness:0.3});
  const glowMats=[accentMat];
  // fuselage + nose
  const body=new THREE.Mesh(new RoundedBoxGeometry(0.72,0.34,1.2,3,0.13), hull()); g.add(body);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.22,0.5,14), hull()); nose.rotation.x=Math.PI/2; nose.position.set(0,0,0.78); g.add(nose);
  const spine=new THREE.Mesh(new RoundedBoxGeometry(0.34,0.2,0.62,2,0.08), accentMat); spine.position.set(0,0.2,0.05); g.add(spine);
  const fin=new THREE.Mesh(new RoundedBoxGeometry(0.06,0.34,0.34,1,0.04), dark()); fin.position.set(0,0.22,-0.6); g.add(fin);
  // sensor eye + scanner glow
  const eye=new THREE.Mesh(new THREE.SphereGeometry(0.13,16,12), new THREE.MeshStandardMaterial({color:0x0b3340, emissive:0x66e0ff, emissiveIntensity:1.6, roughness:0.2, metalness:0.4})); eye.position.set(0,0.06,0.62); g.add(eye); glowMats.push(eye.material);
  const eyeGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0x66e0ff,transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false})); eyeGlow.scale.set(1.0,1.0,1); eyeGlow.position.set(0,0.06,0.72); g.add(eyeGlow);
  // 4 rotor arms + spinning props (quadcopter)
  const props=[];
  for(const [ax,az] of [[0.62,0.62],[-0.62,0.62],[0.62,-0.62],[-0.62,-0.62]]){
    const L=Math.hypot(ax,az);
    const arm=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.06,L), dark()); arm.position.set(ax/2,0.02,az/2); arm.rotation.y=Math.atan2(ax,az); g.add(arm);
    const pod=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.12,0.16,12), steel()); pod.position.set(ax,0.06,az); g.add(pod);
    const nav=new THREE.Mesh(new THREE.SphereGeometry(0.05,8,6), new THREE.MeshBasicMaterial({color: az>0?0x49ff8a:0xff4040})); nav.position.set(ax,0.15,az); g.add(nav);   // front=green / rear=red
    const rotor=new THREE.Group(); rotor.position.set(ax,0.17,az); g.add(rotor); props.push(rotor);
    for(let b=0;b<2;b++){ const blade=new THREE.Mesh(new THREE.BoxGeometry(0.64,0.015,0.07), steel()); blade.rotation.y=b*Math.PI/2; rotor.add(blade); }
    const disc=new THREE.Mesh(new THREE.CircleGeometry(0.35,20), new THREE.MeshBasicMaterial({color:0x6fd0ff,transparent:true,opacity:0.08,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending})); disc.rotation.x=-Math.PI/2; rotor.add(disc);
  }
  // underslung gatling turret + spinning 6-barrel cluster (the nòng xoáy)
  const turret=new THREE.Mesh(new RoundedBoxGeometry(0.3,0.24,0.4,2,0.08), steel()); turret.position.set(0,-0.24,0.34); g.add(turret);
  const gat=new THREE.Group(); gat.position.set(0,-0.26,0.5); g.add(gat);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.2,12), dark()); hub.rotation.x=Math.PI/2; hub.position.z=0.05; gat.add(hub);
  for(let k=0;k<6;k++){ const a=k*1.0472; const bar=new THREE.Mesh(new THREE.CylinderGeometry(0.038,0.038,0.85,8), steel()); bar.rotation.x=Math.PI/2; bar.position.set(Math.cos(a)*0.085, Math.sin(a)*0.085, 0.42); gat.add(bar); }
  // belly thruster glow + slow tech halo
  const belly=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0x4fd1ff,transparent:true,opacity:0.5,blending:THREE.AdditiveBlending,depthWrite:false})); belly.scale.set(1.4,1.4,1); belly.position.set(0,-0.3,-0.1); g.add(belly);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.7,0.025,8,28), new THREE.MeshBasicMaterial({color:0x4fd1ff,transparent:true,opacity:0.5,blending:THREE.AdditiveBlending,depthWrite:false})); ring.rotation.x=Math.PI/2; ring.position.y=-0.02; g.add(ring);
  g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
  g.userData={ props, gat, ring, glowMats };
  return g;
}
export function spawnDrone(owned){
  const now=NOW();
  owned = !!owned || droneOwned();                                   // own the escort → every (re)spawn is the permanent one
  if(!S.drone){ const g=makeDroneMesh(); scene.add(g);
    const bar=makeSoldierBar(); bar.g.scale.setScalar(1.3); scene.add(bar.g);
    S.drone={ g, bar, owned:false, until:0, fireAt:0, ang:Math.random()*6.283, dmg:DRONE.dmg, fireCd:DRONE.fireCd, reloadT:DRONE.reload, hp:DRONE.hp, maxHp:DRONE.hp, ammo:DRONE.mag, reloadUntil:0, hitT:0, spin:DRONE.idleRot }; }
  const d=S.drone; d.owned = d.owned || owned;
  d.dmg    = DRONE.dmg   * droneDmgMul();                             // bake purchased upgrades: power
  d.fireCd = DRONE.fireCd * droneReloadMul();                        // reload/fire-rate (ROTORS)
  d.reloadT= DRONE.reload * droneReloadMul();
  d.maxHp  = DRONE.hp + droneBonusHp(); d.hp = d.maxHp;              // armor (PLATING) — (re)pickup repairs to full
  d.ammo   = DRONE.mag; d.reloadUntil = 0;
  d.until  = d.owned ? now + 1e9 : now + DRONE.dur;                   // owned = persists the whole stage; power-up = 22s
  updateDroneBar();
  if(S.player) floatText(d.owned?'DRONE HỘ TỐNG':'DRONE ĐÃ BAY', '#6fd0ff', S.player.pos, 18);
  sfx('powerup');
}
export function clearDrone(){ if(S.drone){ scene.remove(S.drone.g); if(S.drone.bar) scene.remove(S.drone.bar.g); S.drone=null; } }
export function updateDroneBar(){ const d=S.drone; if(!d||!d.bar) return; const f=Math.max(0, d.hp/d.maxHp);
  d.bar.fill.scale.x=Math.max(0.001,f); d.bar.fill.position.x=-(1-f)*0.5;
  d.bar.fill.material.color.setHex(f>0.5?0x6fd0ff:(f>0.25?0xffcf5a:0xff5a4a)); }
export function damageDrone(dmg, b){ const d=S.drone; if(!d) return; d.hp-=dmg; d.hitT=0.16;
  const pos=d.g.position;
  spawnPart(pos.x,pos.y,pos.z,(Math.random()-0.5)*7,2+Math.random()*4,(Math.random()-0.5)*7,{color:0xffd27a,size:0.4,life:0.3,grav:6,drag:2});   // sparks fly off the hull
  updateDroneBar();
  if(d.hp<=0) destroyDrone();
}
export function destroyDrone(){ const d=S.drone; if(!d) return; const pos=d.g.position.clone();
  tankExplode(pos, 0x6fd0ff, 1.5, null, null, 'shock');                                    // electric-tech blast + shrapnel
  burst(pos, 0x4fd1ff, 14, 12, {life:0.4, size:0.8, up:4, drag:2});
  floatText('DRONE BỊ HẠ', '#ff7a4a', pos, 20); sfx('bigexplode'); S.shake=Math.min(4.5, S.shake+1.4);
  clearDrone();
}
export function updateDrone(dt, now){
  const d=S.drone; if(!d) return;
  if(now>=d.until){ burst(d.g.position.clone(), 0x4fd1ff, 8, 6, {life:0.3, size:0.6, up:3}); if(S.player) floatText('DRONE HẾT GIỜ', '#9fd0ff', d.g.position, 16); clearDrone(); return; }
  const p=S.player; if(!p) return;
  d.ang += dt*1.5;
  // Z122 TOWER STRIKE: nothing to fight near the tank → the drone climbs out to the nearest tower / wall guard, circles his parapet at his height and shoots him off
  let strike=null; { let near=!!(boss&&boss.alive); const R2=DRONE.detect*DRONE.detect; if(!near) for(const e of enemies){ if(e.abandoned) continue; const dx=e.pos.x-p.pos.x, dz=e.pos.z-p.pos.z; if(dx*dx+dz*dz<R2){ near=true; break; } }
    if(!near){ let gq=DRONE.guardR*DRONE.guardR; for(const t of towers){ if(t.falling) continue; for(const gd of t.guards){ if(!gd.alive || gd.wx==null) continue; const dx=gd.wx-p.pos.x, dz=gd.wz-p.pos.z, q=dx*dx+dz*dz; if(q<gq){ gq=q; strike={ t, gd }; } } } } }
  let tx=p.pos.x+Math.cos(d.ang)*DRONE.orbit, tz=p.pos.z+Math.sin(d.ang)*DRONE.orbit, ty=DRONE.height;
  if(strike){ tx=strike.gd.wx+Math.cos(d.ang)*DRONE.strikeR; tz=strike.gd.wz+Math.sin(d.ang)*DRONE.strikeR; ty=strike.gd.wy+1.2; }
  if(d.cx==null){ d.cx=tx; d.cy=ty; d.cz=tz; }
  { const k=Math.min(1, dt*(strike?2.4:4)); d.cx+=(tx-d.cx)*k; d.cy+=(ty-d.cy)*k; d.cz+=(tz-d.cz)*k; }
  const ox=d.cx, oz=d.cz, oy=d.cy+Math.sin(now*2.6)*0.22*(strike?0.35:1);
  d.g.position.set(ox, oy, oz);
  const ud=d.g.userData;
  if(ud.props) for(const pr of ud.props) pr.rotation.y += dt*40;                            // rotors always whirring
  if(ud.ring) ud.ring.rotation.z += dt*1.2;
  if(d.hitT>0) d.hitT-=dt;
  const flash=d.hitT>0;
  if(ud.glowMats) for(const m of ud.glowMats){ m.emissive.setHex(flash?0xff5a2a:0x4fd1ff); m.emissiveIntensity=flash?1.9:1.1; }   // flash orange when shot
  if(d.ammo<=0 && now>=d.reloadUntil) d.ammo=DRONE.mag;                                     // belt refilled after the reload window
  const reloading = d.ammo<=0;
  let best=null, bd=DRONE.detect*DRONE.detect;                                              // acquire nearest target within reach
  for(const e of enemies){ const dx=e.pos.x-ox, dz=e.pos.z-oz, q=dx*dx+dz*dz; if(q<bd){ bd=q; best=e; } }
  if(boss&&boss.alive){ const dx=boss.pos.x-ox, dz=boss.pos.z-oz, q=dx*dx+dz*dz; if(q<bd){ bd=q; best=boss; } }
  const wantSpin = ((best||strike)&&!reloading) ? DRONE.fireRot : (reloading? DRONE.fireRot*0.5 : DRONE.idleRot);   // gatling spin-up / spin-down
  d.spin += (wantSpin-d.spin)*Math.min(1, dt*6);
  if(ud.gat) ud.gat.rotation.z += dt*d.spin;
  if(best){
    const ang=Math.atan2(best.pos.x-ox, best.pos.z-oz);
    const da=wrapAngle(ang-d.g.rotation.y); d.g.rotation.y += da*Math.min(1, dt*10);         // smooth turn-to-target
    if(!reloading && now>=d.fireAt){
      d.fireAt=now+d.fireCd; d.ammo--;
      const a=d.g.rotation.y, mx=ox+Math.sin(a)*0.95, mz=oz+Math.cos(a)*0.95;
      spawnBullet(mx, mz, a, {owner:'p', inf:true, dmg:d.dmg, speed:DRONE.bspeed, color:0x8fe0ff, r:0.26, life:1.2, maxDist:DRONE.detect+4});
      muzzleFlash(mx, mz, a, 0x8fe0ff);
      if(d.ammo%3===0) sfx('beep');
      if(d.ammo<=0) d.reloadUntil=now+d.reloadT;                                              // belt empty → short reload
    }
  } else if(strike){ const G=strike.gd, ang=Math.atan2(G.wx-ox, G.wz-oz); const da=wrapAngle(ang-d.g.rotation.y); d.g.rotation.y += da*Math.min(1, dt*10);
    if(!reloading && now>=d.fireAt && Math.hypot(G.wx-ox, G.wz-oz)<DRONE.strikeFireR){ d.fireAt=now+d.fireCd*1.5; d.ammo--; const dd=Math.hypot(G.wx-ox, G.wz-oz)||1, mx=ox+Math.sin(ang)*0.95, mz=oz+Math.cos(ang)*0.95;
      spawnPart(mx, oy, mz, (G.wx-mx)/dd*70, (G.wy-oy)/dd*70, (G.wz-mz)/dd*70, {tex:'flash', color:0x8fe0ff, size:0.34, life:dd/70, grav:0, drag:0});   // tracer at the platform
      muzzleFlash(mx, mz, ang, 0x8fe0ff); if(Math.random()<DRONE.guardHit) shootGuard(strike.t, G, ox, oz);   // a hit knocks him off the parapet — he falls
      if(d.ammo%3===0) sfx('beep'); if(d.ammo<=0) d.reloadUntil=now+d.reloadT; } }
  else { d.g.rotation.y += dt*1.1; }                                                       // idle scan spin
  if(d.bar){ d.bar.g.position.set(ox, oy+1.05, oz); d.bar.g.quaternion.copy(camera.quaternion); d.bar.g.visible = d.hp < d.maxHp - 0.5; }
}
