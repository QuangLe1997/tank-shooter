// actors/vehicles.js — Z80 enemy VEHICLES: flame tank, ATGM tank-destroyer, engineer repair truck, attack gunship, APC dismount (Z89)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BALANCE, ENV, ROSTER } from '../../config.js';
import { BIOME, ENVMOD, S, aoeDamage, bigExplode, burst, cMod, clampField, core, damageCore, damagePlayer, damageSoldier, decalScorch, deformCrater, diffDmgMul, diffScale, enemies, enemyPool, fireball, floatText, heightAt, inSmoke, launchEnemyMissile, loopDmgMul, loopHpMul, panelTex, radio, scene, sfx, smokeSpread, soldiers, solidTank, spawnBullet, spawnEnemy, spawnPart, tankExplode, tankRecoil, tip, wrapAngle } from '../hub.js';
import { TROOPS } from '../../config.js';

// ===== Z80 · NEW ENEMY VEHICLES — flame tank, ATGM tank-destroyer, combat-engineer repair truck, attack helicopter =====
export const _lineMat={};
export function makeBeam(color, op){ const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6),3));
  const m=_lineMat[color]||(_lineMat[color]=new THREE.LineBasicMaterial({color, transparent:true, opacity:op||0.8, depthWrite:false, blending:THREE.AdditiveBlending}));
  const l=new THREE.Line(g,m); l.frustumCulled=false; l.visible=false; scene.add(l); return l; }
export function setBeam(l, ax,ay,az, bx,by,bz){ const a=l.geometry.attributes.position; a.setXYZ(0,ax,ay,az); a.setXYZ(1,bx,by,bz); a.needsUpdate=true; l.visible=true; }
export const _beamPool=[]; export function takeBeam(){ return _beamPool.pop()||makeBeam(0xff2a2a,0.75); } export function dropBeam(l){ if(!l) return; l.visible=false; _beamPool.push(l); }
// --- PYRO tank: charges in close and hoses you with burning fuel ---
export const _pv=new THREE.Vector3();
export function enemyFlame(e, d, dt, now, tgt){
  const R=ROSTER.pyro, n=e.mesh.userData.nozzle; if(!n || d > R.range+1 || S.mode!=='playing'){ e.flaming=false; return; }
  e.flaming=true; n.getWorldPosition(_pv); const a=Math.atan2(tgt.x-_pv.x, tgt.z-_pv.z), cx=Math.sin(a), cz=Math.cos(a);
  for(let k=0;k<3;k++){ const aa=a+(Math.random()-0.5)*0.4, v=R.range*2.6+Math.random()*R.range;
    spawnPart(_pv.x, _pv.y, _pv.z, Math.sin(aa)*v, 1+Math.random()*1.4, Math.cos(aa)*v, {tex:'fire', color:0xfff0c0, color2:0x8a1c0a, size:0.6+Math.random()*0.4, grow:2.2, life:0.3+Math.random()*0.18, grav:5, drag:1.8}); }
  if(Math.random()<0.3) spawnPart(_pv.x+cx*R.range*0.7, _pv.y+1.2, _pv.z+cz*R.range*0.7, (Math.random()-0.5)*2, 1.5, (Math.random()-0.5)*2, {color:0x221a12, size:1.8, life:0.7, smoke:true, grav:-0.5, drag:1.5, op:0.4});
  e.flT=(e.flT||0)+dt; if(e.flT < R.tick) return; e.flT=0;
  const dmg=R.dps*R.tick*(0.75+0.25*diffScale())*loopDmgMul()*cMod('enemyDmgMul')*diffDmgMul();
  const p=S.player, px=p.pos.x-_pv.x, pz=p.pos.z-_pv.z, pd=Math.hypot(px,pz)||1;
  if(pd < R.range+p.radius && (px*cx+pz*cz)/pd > R.cone){ damagePlayer(dmg, now, cx, cz); }
  for(const s of soldiers.slice()){ const sx=s.pos.x-_pv.x, sz=s.pos.z-_pv.z, sd=Math.hypot(sx,sz)||1; if(sd<R.range && (sx*cx+sz*cz)/sd > R.cone) damageSoldier(s, dmg*1.4); }
  if(core){ const qx=core.pos.x-_pv.x, qz=core.pos.z-_pv.z, qd=Math.hypot(qx,qz)||1; if(qd<R.range+core.r && (qx*cx+qz*cz)/qd>R.cone) damageCore(dmg*0.7); }
}
// --- ATGM tank-destroyer: stops, paints you with a laser for a beat, then flies a wire-guided missile at you ---
export function updateAtgm(e, d, now, tgt, dt){
  const R=ROSTER.atgm, L=e.mesh.userData.launcher; if(!L) return;
  if(e.aimT>0){ e.aimT-=dt; L.getWorldPosition(_pv); if(!e.laser){ e.laser=takeBeam(); tip('atgm'); }
    const p=S.player, jit=inSmoke(now)?2.5:0.15; setBeam(e.laser, _pv.x,_pv.y,_pv.z, tgt.x+(Math.random()-0.5)*jit, heightAt(tgt.x,tgt.z)+1.3, tgt.z+(Math.random()-0.5)*jit);
    e.laser.material.opacity = 0.45+0.4*Math.abs(Math.sin(now*24));
    if(e.aimT<=0){ dropBeam(e.laser); e.laser=null;
      const a=Math.atan2(tgt.x-_pv.x, tgt.z-_pv.z), dmg=R.dmg*(0.75+0.25*diffScale())*loopDmgMul()*cMod('enemyDmgMul')*diffDmgMul();
      launchEnemyMissile(_pv.x,_pv.y,_pv.z, a, { speed:R.speed, dmg, aoe:R.aoe, guided:R.turn, life:R.life, kind:'atgm', wire:takeBeam(), src:e });
      spawnPart(_pv.x-Math.sin(a)*1.5,_pv.y,_pv.z-Math.cos(a)*1.5, -Math.sin(a)*5,0.6,-Math.cos(a)*5, {color:0xd8d0c0, size:2.2, life:0.9, smoke:true, grav:0.2, drag:1.6, grow:1.4, op:0.5});
      tankRecoil(e.mesh, a, 0.5, e.facing); e.fireAt=now+ROSTER.atgm.cd*(BALANCE.aggro.rateBase-BALANCE.aggro.rateDrop*diffScale())/1.6; }
    return; }
  if(now>e.fireAt && d < e.def.range && S.mode==='playing'){ e.aimT=R.aimT; sfx('beep', e.pos); }
}
// --- combat engineer: hangs back, drives up to the most battered tank and welds it back together (green arc) ---
export function engineerPatient(e){ let best=null, bw=0; for(const o of enemies){ if(o===e || !solidTank(o) || o.def.engineer) continue;
  const miss=1-o.hp/o.maxHp; if(miss<0.05) continue; const dd=Math.hypot(o.pos.x-e.pos.x, o.pos.z-e.pos.z); const w=miss/(1+dd*0.04); if(w>bw){ bw=w; best=o; } } return best; }
export function updateEngineer(e, dt, now){
  const R=ROSTER.engineer, pt=e.patient, ud=e.mesh.userData;
  if(pt && enemies.includes(pt) && Math.hypot(pt.pos.x-e.pos.x, pt.pos.z-e.pos.z) < R.range){
    const heal=R.heal*dt*loopHpMul(); pt.hp=Math.min(pt.maxHp, pt.hp+heal*pt.maxHp/60);
    if(!ud.weld) ud.weld=makeBeam(0x7dff8a, 0.85); (ud.arm||e.mesh).getWorldPosition(_pv);
    const tx=pt.pos.x+(Math.random()-0.5)*0.8, tz=pt.pos.z+(Math.random()-0.5)*0.8, ty=heightAt(tx,tz)+1.6;
    setBeam(ud.weld, _pv.x,_pv.y,_pv.z, tx,ty,tz); ud.weld.material.opacity=0.5+0.45*Math.random();
    if(Math.random()<0.6) spawnPart(tx,ty,tz,(Math.random()-0.5)*5,2+Math.random()*3,(Math.random()-0.5)*5,{color:Math.random()<0.5?0xbfffc8:0xfff2a0, size:0.22, life:0.3, grav:-12, drag:2});
    if(Math.random()<0.08) floatText('+', '#7dff8a', {x:pt.pos.x, y:3, z:pt.pos.z}, 16);
  } else if(ud.weld) ud.weld.visible=false;
  e.hp=Math.min(e.maxHp, e.hp+R.selfHeal*dt);
  if(ud.beacon) ud.beacon.material.emissiveIntensity = 1.5+1.5*Math.sin(now*9);
}
// --- ATTACK HELICOPTER: circles the fight at altitude, strafes with a chin cannon and ripples rockets. Only direct fire, flak and missiles reach it ---
export let _heliMats=null;
export function buildGunship(pal){
  if(!_heliMats) _heliMats={ hull:new THREE.MeshStandardMaterial({color:pal.hull, roughness:0.55, metalness:0.45, map:panelTex()}), dark:new THREE.MeshStandardMaterial({color:0x22261e, roughness:0.6, metalness:0.5}),
    glass:new THREE.MeshStandardMaterial({color:0x101a22, roughness:0.08, metalness:0.9, envMapIntensity:1.4}), blade:new THREE.MeshStandardMaterial({color:0x1a1c18, roughness:0.7}),
    blur:new THREE.MeshBasicMaterial({color:0x222222, transparent:true, opacity:0.18, depthWrite:false, side:THREE.DoubleSide}) };
  const H=_heliMats, g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  const put=(geo,mat,x,y,z,rx,ry,rz,par)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.rotation.set(rx||0,ry||0,rz||0); (par||body).add(m); m.castShadow=true; return m; };
  const fus=put(new THREE.SphereGeometry(1,20,14), H.hull, 0,0,0.2); fus.scale.set(0.95,0.95,2.4);                       // tandem-seat fuselage
  put(new THREE.SphereGeometry(0.62,16,12,0,6.283,0,1.6), H.glass, 0,0.55,1.15, -0.25).scale.set(1,0.9,1.9);              // stepped canopy
  put(new THREE.CylinderGeometry(0.2,0.42,4.4,12), H.hull, 0,0.25,-3.3, Math.PI/2);                                       // tail boom
  put(new RoundedBoxGeometry(0.12,1.5,0.9,2,0.05), H.hull, 0,0.95,-5.2, -0.3);                                           // tail fin
  put(new RoundedBoxGeometry(1.6,0.08,0.5,2,0.03), H.hull, 0,0.35,-4.6);                                                 // stabilator
  for(const sx of [-1,1]){ put(new RoundedBoxGeometry(1.6,0.12,0.7,2,0.04), H.hull, sx*1.5,-0.15,0.1, 0,0,sx*-0.12);        // stub wings
    for(const k of [0,1]){ const pod=put(new THREE.CylinderGeometry(0.24,0.24,1.3,12), H.dark, sx*(1.25+k*0.75),-0.45,0.25, Math.PI/2); pod.userData.pod=true; }   // rocket pods
    put(new RoundedBoxGeometry(0.12,0.12,2.6,1,0.03), H.dark, sx*0.75,-1.15,0.2); }                                      // skids
  for(const sx of [-1,1]) put(new THREE.CylinderGeometry(0.05,0.05,0.5,6), H.dark, sx*0.75,-0.9,0.2);
  const chin=new THREE.Group(); chin.position.set(0,-0.75,1.9); body.add(chin);
  put(new THREE.SphereGeometry(0.28,10,8), H.dark, 0,0,0,0,0,0,chin); put(new THREE.CylinderGeometry(0.06,0.06,1.0,8), H.dark, 0,-0.05,0.5, Math.PI/2,0,0,chin);
  const muz=new THREE.Object3D(); muz.position.set(0,-0.05,1.05); chin.add(muz);
  put(new THREE.CylinderGeometry(0.42,0.5,0.5,12), H.dark, 0,1.0,0.3);                                                     // engine / mast
  const rotor=new THREE.Group(); rotor.position.set(0,1.35,0.3); body.add(rotor);
  for(let k=0;k<4;k++) put(new RoundedBoxGeometry(0.34,0.05,5.4,1,0.02), H.blade, 0,0,0, 0,k*Math.PI/4*2,0, rotor);
  const blur=new THREE.Mesh(new THREE.CircleGeometry(5.6,32), H.blur); blur.rotation.x=-Math.PI/2; rotor.add(blur);
  const trot=new THREE.Group(); trot.position.set(0.12,0.95,-5.3); body.add(trot);
  for(let k=0;k<2;k++) put(new RoundedBoxGeometry(0.04,1.3,0.12,1,0.02), H.blade, 0,0,0, k*Math.PI/2,0,0, trot);
  const nav=new THREE.Mesh(new THREE.SphereGeometry(0.09,8,6), new THREE.MeshStandardMaterial({color:0, emissive:0xff2020, emissiveIntensity:3})); nav.position.set(0,1.8,-5.5); body.add(nav);
  g.userData={ body, rotor, trot, chin, muzzle:muz, nav, heli:true };
  scene.add(g); return g;
}
export function updateGunship(e, dt, now, edt){
  const R=ROSTER.gunship, p=S.player, ud=e.mesh.userData;
  e.orb=(e.orb??Math.atan2(e.pos.z-p.pos.z, e.pos.x-p.pos.x)) + (R.speed/R.orbit)*edt*(e.dir||1);
  const tx=p.pos.x+Math.cos(e.orb)*R.orbit, tz=p.pos.z+Math.sin(e.orb)*R.orbit;
  const ax=(tx-e.pos.x), az=(tz-e.pos.z); e.vel.x += (ax*0.9 - e.vel.x)*Math.min(1,dt*1.2); e.vel.z += (az*0.9 - e.vel.z)*Math.min(1,dt*1.2);
  const vl=Math.hypot(e.vel.x,e.vel.z), vmax=R.speed*1.6; if(vl>vmax){ e.vel.x*=vmax/vl; e.vel.z*=vmax/vl; }
  e.pos.x+=e.vel.x*edt; e.pos.z+=e.vel.z*edt; if(e.kbx||e.kbz){ e.pos.x+=e.kbx*edt*0.3; e.pos.z+=e.kbz*edt*0.3; e.kbx*=0.9; e.kbz*=0.9; }
  clampField(e.pos, 3);
  e.pos.y = Math.max(heightAt(e.pos.x,e.pos.z),0) + R.alt + Math.sin(now*1.3+e.ph)*0.35;
  const dx=p.pos.x-e.pos.x, dz=p.pos.z-e.pos.z, d=Math.hypot(dx,dz)||1, want=Math.atan2(dx,dz);
  e.facing += wrapAngle(want-e.facing)*Math.min(1,dt*2.2);
  const side=(e.vel.x*Math.cos(e.facing)-e.vel.z*Math.sin(e.facing)), fwd=(e.vel.x*Math.sin(e.facing)+e.vel.z*Math.cos(e.facing));
  e.bank=(e.bank||0)+((-side*0.05)-(e.bank||0))*Math.min(1,dt*3); e.pitch=(e.pitch||0)+((fwd*0.025)-(e.pitch||0))*Math.min(1,dt*3);
  e.mesh.position.set(e.pos.x, e.pos.y, e.pos.z); e.mesh.rotation.set(0, e.facing, 0); ud.body.rotation.set(e.pitch, 0, e.bank);
  ud.rotor.rotation.y += dt*38; ud.trot.rotation.x += dt*50; ud.nav.visible = Math.floor(now*2)%2===0;
  if(Math.random()<0.25) spawnPart(e.pos.x+(Math.random()-0.5)*9, heightAt(e.pos.x,e.pos.z)+0.3, e.pos.z+(Math.random()-0.5)*9, (Math.random()-0.5)*6, 0.6, (Math.random()-0.5)*6, {color:BIOME.ground, size:1.6, life:0.7, smoke:true, grav:-0.2, drag:2, op:0.22});   // rotor wash kicks up dust
  if(S.mode!=='playing' || d > R.range) return;
  const ds=diffScale(), dmul=(0.75+0.25*ds)*loopDmgMul()*cMod('enemyDmgMul')*diffDmgMul(), smk=smokeSpread(now);
  if(now>e.fireAt){                                                         // CHIN GUN — short strafing bursts
    ud.muzzle.getWorldPosition(_pv); const a=want+(Math.random()-0.5)*0.22*smk*(ENVMOD.night?ENV.night.enemySpread:1);
    spawnBullet(_pv.x,_pv.z,a,{owner:'e', inf:true, dmg:R.gunDmg*dmul, speed:70, color:0xffc070, r:0.24, life:1.4, maxDist:R.range+4, noArc:true, y:_pv.y, dropTo:1.3});
    spawnPart(_pv.x,_pv.y,_pv.z,0,0,0,{tex:'flash', color:0xfff0c0, size:0.9, life:0.05, grav:0, drag:0}); sfx('enemyShoot', e.pos);
    e.burstLeft=(e.burstLeft||R.burst)-1; if(e.burstLeft<=0){ e.burstLeft=R.burst; e.fireAt=now+R.burstCd*(BALANCE.aggro.rateBase-BALANCE.aggro.rateDrop*ds)/1.6; } else e.fireAt=now+R.gunCd; }
  if(now>(e.rocketAt||0)){ e.rocketAt=now+R.salvoCd*(0.8+Math.random()*0.4);  // RIPPLE — a pair of unguided rockets from the pods
    for(let k=0;k<R.salvo;k++) setTimeout(()=>{ if(!enemies.includes(e) || S.mode!=='playing') return;
      const sx=(k%2?1:-1)*1.6, cf=Math.cos(e.facing), sf=Math.sin(e.facing), x=e.pos.x+cf*sx, z=e.pos.z-sf*sx, y=e.pos.y-0.4;
      const lead=0.4, tgx=p.pos.x+p.vel.x*lead+(Math.random()-0.5)*3*smk, tgz=p.pos.z+p.vel.z*lead+(Math.random()-0.5)*3*smk, D=Math.hypot(tgx-x,tgz-z)||1, T=D/R.rocketSpeed;
      const vy=((heightAt(tgx,tgz)+0.5-y) + 0.5*4*T*T)/T;
      launchEnemyMissile(x,y,z, Math.atan2(tgx-x,tgz-z), { speed:R.rocketSpeed, dmg:R.rocketDmg*dmul, aoe:2.6, life:T+1.5, kind:'heli', vy }); }, k*180);
  }
}
export const HELI_DOWN=[];
export function gunshipDown(e){ HELI_DOWN.push({ e, vy:0, spin:(Math.random()<0.5?-1:1)*(5+Math.random()*3) }); sfx('explode', e.pos); bigExplode({x:e.pos.x, z:e.pos.z}, 0xffb050, 0.9); }
export function updateHeliDown(dt){
  for(let i=HELI_DOWN.length-1;i>=0;i--){ const h=HELI_DOWN[i], e=h.e, m=e.mesh, ud=m.userData;
    h.vy-=14*dt; e.pos.y+=h.vy*dt; e.pos.x+=e.vel.x*dt*0.6; e.pos.z+=e.vel.z*dt*0.6; m.rotation.y+=h.spin*dt; ud.body.rotation.z+=dt*0.8; ud.rotor.rotation.y+=dt*14;
    m.position.set(e.pos.x, e.pos.y, e.pos.z);
    spawnPart(e.pos.x,e.pos.y+0.5,e.pos.z,(Math.random()-0.5),1.5,(Math.random()-0.5),{color:0x15120f, size:1.6, life:1.2, smoke:true, grav:0.4, drag:1, grow:1.4, op:0.55});
    spawnPart(e.pos.x,e.pos.y,e.pos.z,(Math.random()-0.5)*2,1,(Math.random()-0.5)*2,{tex:'fire', color:0xffe0a0, color2:0xff3a0a, size:1.0, life:0.35, grav:1, drag:2});
    const gy=heightAt(e.pos.x,e.pos.z);
    if(e.pos.y<=gy+0.6){ const pos={x:e.pos.x,z:e.pos.z}; tankExplode(pos, 0xff7a3d, 1.6, e.def.pal, 1, 'fire'); fireball(pos, 1.6); deformCrater(pos.x,pos.z,2.4,0.55); decalScorch(pos.x,pos.z,4,1);
      aoeDamage(pos.x,pos.z,5,45,false,performance.now()/1000,'HE'); S.shake=Math.min(4,S.shake+1.6);
      m.visible=false; ud.body.rotation.set(0,0,0); (enemyPool[e.type]=enemyPool[e.type]||[]).push(m); HELI_DOWN.splice(i,1); } }
}
export function clearHeliDown(){ for(const h of HELI_DOWN){ h.e.mesh.visible=false; (enemyPool[h.e.type]=enemyPool[h.e.type]||[]).push(h.e.mesh); } HELI_DOWN.length=0; }

// ---- from actors/troops.js ----
// ===== Z89 · TROOP CARRIERS — enemy APCs dismount squads; your FIRETEAM rides in on a friendly APC and fights beside the tank =====
export let _dismountRadioAt=0;
export function updateDismount(e, dt, now, dpl){
  const D0=TROOPS.dismount, rmp=e.mesh.getObjectByName('ramp');
  if(!e.unloading && !e.unloaded && e.troops>0 && dpl < D0.range && S.mode==='playing'){ e.unloading=true; e.unloadT=0; e.dropped=0;
    tip('apc'); if(now-_dismountRadioAt>12){ _dismountRadioAt=now; radio('SCH: Xe bọc thép địch đang thả bộ binh — coi chừng tổ RPG!'); } }
  if(!e.unloading){ if(rmp) rmp.rotation.x=Math.max(0, rmp.rotation.x-dt*2); return; }
  e.unloadT+=dt; if(rmp) rmp.rotation.x=Math.min(1.25, e.unloadT*2.6);                                   // ramp swings down onto the dirt
  const due=Math.floor((e.unloadT-0.5)/D0.interval)+1;
  while(e.unloadT>0.5 && e.dropped<Math.min(due, e.troops)){ const k=e.dropped++, bx=e.pos.x-Math.sin(e.facing)*2.9*e.def.scale, bz=e.pos.z-Math.cos(e.facing)*2.9*e.def.scale;
    const t=spawnEnemy(k===0&&S.stage>=D0.rpgFrom?'rpg':'rifle', bx+(Math.random()-0.5)*1.2, bz+(Math.random()-0.5)*1.2);
    if(t){ const a=e.facing+Math.PI+(k%2?0.6:-0.6)*(1+k*0.25); t.kbx=Math.sin(a)*7; t.kbz=Math.cos(a)*7; t.fireAt=now+0.9+Math.random()*0.6; }   // they jog out and fan to the flanks
    burst({x:bx,z:bz}, BIOME.ground, 2, 2, {y:0.4, life:0.6, size:1.0, smoke:true, grav:-0.3, drag:2, up:0.6, op:0.35}); }
  if(e.dropped>=e.troops && e.unloadT > 0.5+e.troops*D0.interval+0.6){ e.unloading=false; e.unloaded=true; }
}
