// actors/enemies.js — ENEMY tanks: spawn (roster, elites, carrier troops, loot), pooled meshes and floating HP bars
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BALANCE, RAMP, ROSTER, TROOPS, LOOT } from '../../config.js';
import { ENEMY_DEFS, GLOW, S, TANK_SCALE, WAVE, addLootBeacon, bakeTank, buildGunship, buildTank, cMod, camera, diffHpMul, diffScale, heightAt, infMesh, loopDmgMul, loopHpMul, makeSoldierBar, makeSoldierMesh, scene, sfx, spawnBullet, spawnPart, tip } from '../hub.js';

export const enemies=[]; export const enemyPool={};
// floating HP bar over each enemy tank (pooled; reuses the soldier billboard-bar mechanism)
export const enemyBarPool=[];
export function getEnemyBar(){ let b=enemyBarPool.pop(); if(!b){ b=makeSoldierBar(); b.g.scale.setScalar(1.5); scene.add(b.g); } b.g.visible=true; return b; }
export function freeEnemyBar(b){ if(!b) return; b.g.visible=false; enemyBarPool.push(b); }
export function updateEnemyBar(e){ if(!e.bar) return; const f=Math.max(0, e.hp/e.maxHp), ms=e.mesh.scale.x||1;
  e.bar.g.position.set(e.pos.x, (e.def.inf?3.25:e.def.air?(e.pos.y||0)+2.4:2.7 + ms*0.95) + (e.def.air?0:heightAt(e.pos.x,e.pos.z)), e.pos.z); e.bar.g.quaternion.copy(camera.quaternion);   // float above the turret, always face camera
  e.bar.fill.scale.x=Math.max(0.001,f); e.bar.fill.position.x=-(1-f)*0.5;                              // shrink from the right
  e.bar.fill.material.color.setHex(f>0.5?0x7fe06a:(f>0.25?0xffcf5a:0xff5a4a));                         // green → amber → red
}
// per-type silhouette: artillery (mortar) gets a high-angle tube, gunner twin barrels, shield a frontal plate,
// bomber a warhead payload, scout a ram prow → each enemy class reads at a glance (built once per pooled mesh)
export function decorateEnemyMesh(m, type){
  const pal=m.userData.palOverride||ENEMY_DEFS[type].pal, ud=m.userData, T=ud.turret, bg=ud.barrelG;
  const _mc={}, memo=(k,f)=>_mc[k]||(_mc[k]=f());
  const steel=(c)=>memo('s'+c,()=>new THREE.MeshStandardMaterial({color:c,roughness:0.4,metalness:0.85}));
  const dk=(c)=>memo('d'+c,()=>new THREE.MeshStandardMaterial({color:c,roughness:0.6,metalness:0.5}));
  if(type==='mortar'){
    if(bg) bg.visible=false;                                                  // hide the flat cannon
    const tube=new THREE.Mesh(new THREE.CylinderGeometry(0.38,0.46,2.5,16), steel(0x2b2f25)); tube.position.set(0,0.55,0.15); tube.rotation.x=-0.95; T.add(tube);   // big upward mortar tube
    const mouth=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.42,0.42,16), dk(0x14160e)); mouth.position.set(0,1.5,1.18); mouth.rotation.x=-0.95; T.add(mouth);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(0.72,0.84,0.32,12), dk(pal.tread)); base.position.set(0,-0.18,-0.25); T.add(base);   // recoil baseplate
    for(const sx of [-0.75,0.75]){ const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,1.0,8), steel(0x33342c)); leg.position.set(sx,-0.1,-0.7); leg.rotation.x=0.5; T.add(leg); }   // outrigger legs
  } else if(type==='gunner'){
    for(const sx of [-0.36,0.36]){ const b=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.16,2.7,14), steel(pal.barrel)); b.rotation.x=Math.PI/2; b.position.set(sx,0.05,1.7); bg.add(b); }   // twin side barrels → triple-barrel burst look
    const ammo=new THREE.Mesh(new RoundedBoxGeometry(0.7,0.4,0.6,1,0.06), dk(0x2a2a22)); ammo.position.set(0,0.0,-1.0); T.add(ammo);   // ammo box on the back
  } else if(type==='shield'){
    const sh=new THREE.Mesh(new RoundedBoxGeometry(2.8,1.7,0.3,3,0.1), steel(pal.turret)); sh.position.set(0,1.3,1.95); sh.rotation.x=-0.3; m.add(sh);   // big frontal blast shield
    for(const bx of [-0.85,0,0.85]){ const bolt=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.34,10), steel(pal.accent)); bolt.rotation.x=Math.PI/2-0.3; bolt.position.set(bx,1.3,2.12); m.add(bolt); }   // rivets
  } else if(type==='bomber'){
    if(bg) bg.visible=false;
    const wh=new THREE.Mesh(new THREE.SphereGeometry(0.64,16,12), dk(0x3a1410)); wh.position.set(0,0.5,0); T.add(wh);                       // round warhead payload
    const band=new THREE.Mesh(new THREE.TorusGeometry(0.52,0.09,8,20), steel(0xffae20)); band.position.set(0,0.5,0); band.rotation.x=Math.PI/2; T.add(band);   // hazard stripe
    const fuse=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.42,8), steel(0x222222)); fuse.position.set(0,1.18,0); T.add(fuse);
    const tip=new THREE.Mesh(new THREE.SphereGeometry(0.13,10,8), new THREE.MeshStandardMaterial({color:0x000000,emissive:0xff3010,emissiveIntensity:2.4})); tip.position.set(0,1.42,0); tip.name='bombTip'; T.add(tip);   // glowing fuse tip
  } else if(type==='scout'){
    if(bg) bg.visible=false;
    const wedge=new THREE.Mesh(new THREE.ConeGeometry(0.78,1.5,4), steel(pal.accent)); wedge.rotation.set(Math.PI/2,0,Math.PI/4); wedge.position.set(0,0.78,2.15); m.add(wedge);   // ramming prow
  } else if(type==='heavy'){
    const big=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.4,3.2,16), steel(pal.barrel)); big.rotation.x=Math.PI/2; big.position.set(0,0.05,1.9); bg.add(big);   // huge main gun
    const muzz=new THREE.Mesh(new THREE.CylinderGeometry(0.46,0.46,0.6,16), dk(0x26262a)); muzz.rotation.x=Math.PI/2; muzz.position.set(0,0.05,3.4); bg.add(muzz);   // big muzzle brake
    for(const sx of [-1.0,1.0]){ const arm=new THREE.Mesh(new RoundedBoxGeometry(0.45,0.7,2.6,2,0.12), steel(pal.turret)); arm.position.set(sx*1.62,1.1,0); m.add(arm); }   // bolt-on side armour
  } else if(type==='sniper'){
    const lb=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.13,3.9,14), steel(pal.barrel)); lb.rotation.x=Math.PI/2; lb.position.set(0,0.05,2.4); bg.add(lb);   // long thin barrel
    const scope=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.13,0.7,12), dk(0x15151a)); scope.rotation.x=Math.PI/2; scope.position.set(0,0.46,0.4); T.add(scope);
    const lens=new THREE.Mesh(new THREE.CircleGeometry(0.12,12), new THREE.MeshStandardMaterial({color:0x000000,emissive:0xc060ff,emissiveIntensity:1.6})); lens.position.set(0,0.46,0.78); T.add(lens);   // glowing scope lens
  } else if(type==='pyro'){
    if(bg) bg.visible=false;
    const nz=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.3,1.5,14), steel(0x2c2a24)); nz.rotation.x=Math.PI/2; nz.position.set(0,0.2,1.55); T.add(nz);   // stubby projector
    const fl=new THREE.Mesh(new THREE.CylinderGeometry(0.36,0.22,0.36,14), dk(0x1a1814)); fl.rotation.x=Math.PI/2; fl.position.set(0,0.2,2.4); T.add(fl);
    const pilot=new THREE.Mesh(new THREE.SphereGeometry(0.1,8,6), new THREE.MeshStandardMaterial({color:0,emissive:0xff8a20,emissiveIntensity:3})); pilot.position.set(0,0.42,2.45); T.add(pilot);   // pilot flame
    const nzo=new THREE.Object3D(); nzo.position.set(0,0.2,2.65); T.add(nzo); ud.nozzle=nzo;
    for(const sx of [-0.5,0.5]){ const tk=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,1.6,16), dk(0x5a4a2a)); tk.rotation.z=Math.PI/2; tk.position.set(sx*1.7,1.65,-1.55); tk.rotation.y=Math.PI/2; m.add(tk);   // fuel tanks on the back deck
      const band=new THREE.Mesh(new THREE.CylinderGeometry(0.44,0.44,0.16,16), steel(pal.accent)); band.rotation.x=Math.PI/2; band.position.set(sx*1.7,1.65,-1.55); m.add(band); }
  } else if(type==='atgm'){
    if(bg) bg.visible=false;
    const arm=new THREE.Mesh(new RoundedBoxGeometry(0.3,0.9,0.4,2,0.06), steel(pal.turret)); arm.position.set(0.7,0.55,0); T.add(arm);
    const box=new THREE.Group(); box.position.set(0.7,1.05,0.2); T.add(box);
    for(const sy of [-0.17,0.17]){ const tb=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,1.7,12), dk(0x4a4a36)); tb.rotation.x=Math.PI/2; tb.position.set(0,sy,0); box.add(tb);
      const cap=new THREE.Mesh(new THREE.CircleGeometry(0.15,12), new THREE.MeshStandardMaterial({color:0x111111,emissive:0x331008})); cap.position.set(0,sy,0.86); box.add(cap); }
    const sens=new THREE.Mesh(new RoundedBoxGeometry(0.5,0.4,0.5,2,0.06), dk(0x22221c)); sens.position.set(-0.55,0.75,0.3); T.add(sens);
    const lens=new THREE.Mesh(new THREE.CircleGeometry(0.13,12), new THREE.MeshStandardMaterial({color:0,emissive:0xff2020,emissiveIntensity:2.4})); lens.position.set(-0.55,0.75,0.56); T.add(lens);
    const lo=new THREE.Object3D(); lo.position.set(0,0.17,0.95); box.add(lo); ud.launcher=lo;
  } else if(type==='engineer'){
    if(bg) bg.visible=false; T.scale.set(0.8,0.7,0.7);
    const bed=new THREE.Mesh(new RoundedBoxGeometry(2.4,0.35,2.0,2,0.08), dk(pal.hull)); bed.position.set(0,1.5,-0.7); m.add(bed);
    const boom=new THREE.Group(); boom.position.set(0.5,1.7,-0.9); boom.rotation.set(-0.7,0.4,0); m.add(boom);
    const b1=new THREE.Mesh(new RoundedBoxGeometry(0.28,0.28,3.2,1,0.05), steel(pal.accent)); b1.position.z=1.5; boom.add(b1);
    const hk=new THREE.Mesh(new THREE.TorusGeometry(0.16,0.05,6,12,4.5), steel(0x333333)); hk.position.set(0,-0.3,3.0); boom.add(hk);
    const tip=new THREE.Object3D(); tip.position.set(0,0,3.1); boom.add(tip); ud.arm=tip;
    for(const sx of [-0.7,0.7]){ const box=new THREE.Mesh(new RoundedBoxGeometry(0.5,0.4,0.7,2,0.05), dk(0x6a2a1a)); box.position.set(sx,1.85,-1.3); m.add(box); }   // tool lockers
    const bc=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.14,0.2,10), new THREE.MeshStandardMaterial({color:0x332200,emissive:0xffa010,emissiveIntensity:2})); bc.position.set(0,1.0,0.3); T.add(bc); ud.beacon=bc;   // amber work light
  } else if(type==='carrier'){
    if(bg) bg.visible=false;
    const T2=T; T2.scale.set(0.7,0.5,0.8); T2.position.y=0.55;   // (turret now lives in the sprung body, origin y=0.95)                                  // shrink the cab (open transport, not a gun turret)
    const bed=new THREE.Mesh(new RoundedBoxGeometry(2.4,0.4,2.2,2,0.1), dk(pal.hull)); bed.position.set(0,1.5,-0.4); m.add(bed);   // flatbed troop deck
    for(const sx of [-1.18,1.18]){ const rail=new THREE.Mesh(new RoundedBoxGeometry(0.12,0.5,2.2,1,0.05), steel(pal.accent)); rail.position.set(sx,1.85,-0.4); m.add(rail); }   // side rails
    const rp=new THREE.Group(); rp.position.set(0,1.32,-1.52); rp.name='ramp'; m.add(rp);                                   // Z89 rear troop ramp (hinged at the bed)
    const rpl=new THREE.Mesh(new RoundedBoxGeometry(1.7,1.2,0.12,1,0.04), steel(pal.hull)); rpl.position.y=-0.6; rp.add(rpl);
    for(let k=0;k<4;k++){ const st=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.05,0.06), dk(0x2a2a22)); st.position.set(0,-0.2-k*0.26,0.07); rp.add(st); }   // anti-slip treads
    for(let i=0;i<3;i++){ const s=makeSoldierMesh(m.userData.friendly?null:{enemy:true}); s.scale.setScalar(0.66); s.position.set((i-1)*0.66, 1.7, -0.45+(i%2)*0.5); s.rotation.y=(i-1)*0.4; s.name='crew'+i; m.add(s); }   // 3 riflemen riding on top
  }
  m.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
}
export function getEnemyMesh(type){
  enemyPool[type] = enemyPool[type]||[];
  let m = enemyPool[type].pop();
  const _d=ENEMY_DEFS[type];
  if(!m){ if(_d.inf) m=infMesh(type); else if(_d.air) m=buildGunship(_d.pal); else { m = buildTank(_d.pal); decorateEnemyMesh(m, type); bakeTank(m); m.traverse(o=>{ if(o.isMesh && o!==m.userData.blob){ o.castShadow=true; o.receiveShadow=true; } }); scene.add(m); } }
  m.scale.setScalar(_d.scale*(_d.inf?1:TANK_SCALE)); if(_d.inf) m.rotation.set(0,0,0);                       // always reset (elites scaled it up)
  const fx=m.getObjectByName('eliteFX'); if(fx){ m.remove(fx); if(fx.material) fx.material.dispose(); }   // strip old elite glow
  m.visible=true; return m;
}
export function makeElite(e){   // champion: tanky, bigger, glowing gold, pays big + always drops loot
  tip('elite');
  e.elite=true; e.hp=Math.round(e.hp*BALANCE.elite.hpMul); e.maxHp=e.hp; e.r*=1.3; e.loot=true;
  e.mesh.scale.multiplyScalar(BALANCE.elite.sizeMul);
  const g=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffd24a,transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false}));
  g.name='eliteFX'; g.scale.set(7,7,1); g.position.y=1.6; e.mesh.add(g);
}
export function spawnEnemy(type, x, z){
  const def=ENEMY_DEFS[type];
  const mesh=getEnemyMesh(type);
  mesh.position.set(x,0,z);
  const hp0 = Math.round(def.hp*loopHpMul()*cMod('enemyHpMul')*diffHpMul()*(1+RAMP.hpPerStage*(S.stage-1)));   // ×NG+ loop ×CONTRACT ×DIFFICULTY ×stage ramp
  const e={ type, def, mesh, turret:mesh.userData.turret, muzzle:mesh.userData.muzzle,
    pos:new THREE.Vector3(x,0,z), vel:new THREE.Vector3(),
    hp:hp0, maxHp:hp0, r:1.5*def.scale, facing:0, aim:0,
    fireAt:performance.now()/1000 + Math.random()*1.2, burstLeft:def.burst||0, ramAt:0, stunUntil:0, kbx:0, kbz:0, hitT:0,
    loot: Math.random()<BALANCE.drop.enemy*cMod('lootChanceMul')*Math.min(LOOT.source.chanceCap, LOOT.source.chanceBase+def.hp*LOOT.source.chancePerHp), elite:false };   // Z93 tougher hulls carry loot more often  // some tanks carry a power-up (CONTRACT can boost loot)
  // elite: forced by an ELITE wave, else a small chance that grows with stage/loop (not on the bomber kamikaze)
  if(def.inf){ e.r=0.55; e.ph=Math.random()*6; e.aimT=0; e.loot=Math.random()<0.04; e.fireAt+=0.8; }
  if(def.air){ e.ph=Math.random()*6; e.dir=Math.random()<0.5?-1:1; e.pos.y=ROSTER.gunship.alt; e.r=1.9; e.fireAt+=1.5; e.rocketAt=performance.now()/1000+3; }
  e.aimT=0;
  const eliteChance = (type==='bomber'||def.inf) ? 0 : Math.min(BALANCE.elite.capChance, BALANCE.elite.chancePerStage*(S.stage-1) + BALANCE.elite.chancePerLoop*(S.loop||0));
  if(!def.inf && WAVE.eliteForce>0){ WAVE.eliteForce--; makeElite(e); } else if(Math.random()<eliteChance) makeElite(e);
  e.bar=getEnemyBar(); e.bar.g.scale.setScalar(def.inf?0.8:1.5); updateEnemyBar(e);                       // floating HP bar over the tank
  if(def.inf) tip('infantry'); else if(def.air) tip('gunship'); else if(def.engineer) tip('engineer');   // Z94 first sighting → field note
  if(def.carrier){ e.unloaded=false; e.unloading=false; e.unloadT=0; const rmp=mesh.getObjectByName('ramp'); if(rmp) rmp.rotation.x=0;
    const D0=TROOPS.dismount; e.troops = S.stage>=D0.fromStage ? D0.troops[0]+((Math.random()*(D0.troops[1]-D0.troops[0]+1))|0) : 0; }
  if(def.carrier){ const nw=performance.now()/1000; e.crew=[];   // load the riflemen onto the APC (reset the pooled mesh's crew)
    for(let i=0;i<(def.crew||3);i++){ const cm=mesh.getObjectByName('crew'+i); if(cm) cm.visible=true; e.crew.push({hp:26, alive:true, fireAt:nw+0.6+Math.random()*1.4, mesh:cm}); } }
  enemies.push(e);
  if(e.loot) addLootBeacon(e, 'enemy');
  return e;
}
// APC crew: each living rifleman auto-fires at the player from its perch on the carrier
export const _cv=new THREE.Vector3();
export function updateCarrierCrew(e, now){
  if(!e.crew) return; const p=S.player, ds=diffScale(), A=BALANCE.aggro;
  for(const c of e.crew){ if(!c.alive || !c.mesh) continue;
    if(now < c.fireAt) continue;
    c.mesh.getWorldPosition(_cv);
    const dx=p.pos.x-_cv.x, dz=p.pos.z-_cv.z, d=Math.hypot(dx,dz);
    if(d > 30){ c.fireAt = now+0.5; continue; }                 // rifle range
    if(Math.random() > Math.min(1, A.fireChanceBase + ds*A.fireChanceRamp)){ c.fireAt = now+0.4; continue; }
    let a = Math.atan2(dx,dz) + (Math.random()-0.5) * Math.max(0.04, A.spreadBase*(1-ds*A.spreadDrop)*1.3);   // crew a bit less accurate than gun tanks
    const dmg = 5 * (0.7+0.3*ds) * loopDmgMul() * cMod('enemyDmgMul');
    spawnBullet(_cv.x, _cv.z, a, {owner:'e', dmg, speed:44, color:0xffd06a, r:0.3, life:2.4, maxDist:32, arcDist:d});
    spawnPart(_cv.x, _cv.y, _cv.z, Math.sin(a)*6,1,Math.cos(a)*6, {color:0xffd06a, size:0.6, life:0.1, grav:0, drag:7});
    sfx('rifleShot', e.pos); c.fireAt = now + 1.4 + Math.random()*0.7;
  }
}
