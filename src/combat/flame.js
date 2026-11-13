// combat/flame.js — continuous FLAME JET: one cohesive COLUMN of fire (a flamethrower stream, not scattered sparks)
import * as THREE from 'three';
import { BALANCE } from '../../config.js';
import { CASING, GLOW, GUNS, MOBILE, NOW, PAD, PROFILE, S, _RUP, _rdir, _v, addGunXp, aimTarget, armorOf, bigExplode, blocks, boss, cMod, damageBlock, damageBoss, damageEnemy, decalScorch, deformCrater, enemies, fireArty, fireMortar, fireRocket, floatText, fuses, gunDmgMul, gunFireMul, gunMuzzleFX, gunSplash, heightAt, lightning, magCap, muzzleLight, ownGun, playerRange, railBeam, ringPulse, rockets, scene, sfx, spawnBullet, spawnDebris, spawnPart, startReload, strikePoint, tankRecoil, typeMul, updateGunHUD } from '../hub.js';

// FLAMETHROWER — short-range cone of fire that sets enemies ALIGHT (a burn DoT applied/refreshed in updateEnemies)
// ----- continuous FLAME JET: one cohesive COLUMN of fire (a flamethrower stream, not scattered sparks) -----
export let _flameTex=null;
export function flameTex(){
  if(_flameTex) return _flameTex;
  const W=64,H=128, c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d');
  const grad=x.createLinearGradient(0,H,0,0);   // base (nozzle) white-hot → tip fades out
  grad.addColorStop(0.0,'rgba(255,250,220,1)'); grad.addColorStop(0.18,'rgba(255,214,110,0.96)');
  grad.addColorStop(0.45,'rgba(255,135,40,0.82)'); grad.addColorStop(0.75,'rgba(214,60,22,0.42)'); grad.addColorStop(1,'rgba(120,24,10,0)');
  x.fillStyle=grad; x.fillRect(0,0,W,H);
  x.globalCompositeOperation='lighter';          // flame tongues / licks for a living surface
  for(let i=0;i<70;i++){ const px=Math.random()*W, w=2+Math.random()*5, h=18+Math.random()*70, py=Math.random()*H;
    const gg=x.createLinearGradient(0,py+h,0,py); gg.addColorStop(0,'rgba(255,220,120,0)'); gg.addColorStop(0.5,'rgba(255,186,86,'+(0.1+Math.random()*0.22)+')'); gg.addColorStop(1,'rgba(255,240,190,0)');
    x.fillStyle=gg; x.fillRect(px,py,w,h); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(1,2); t.colorSpace=THREE.SRGBColorSpace; _flameTex=t; return t;
}
export function makeFlameJet(){
  const g=new THREE.Group();
  const jmat=(col,op)=>new THREE.MeshBasicMaterial({map:flameTex(), color:col, transparent:true, opacity:op, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide});
  const body=new THREE.Mesh(new THREE.CylinderGeometry(1.7,0.34,1,18,1,true), jmat(0xff7320,0.5));  body.rotation.x=Math.PI/2;   // wide flame envelope (tip→nozzle taper)
  const core=new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.16,1,18,1,true),  jmat(0xffe2a0,0.82)); core.rotation.x=Math.PI/2;   // bright inner stream
  const tip=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW, color:0xff8a30, transparent:true, opacity:0.6, blending:THREE.AdditiveBlending, depthWrite:false}));   // billowing fireball at the tip
  g.add(body,core,tip); g.userData={body,core,tip,bodyMat:body.material,coreMat:core.material}; g.visible=false; scene.add(g);
  return g;
}
export const flameJet = makeFlameJet(); export let flameJetUntil=0, flameJetLen=14;
export function updateFlameJet(dt){
  if(!flameJet.visible) return;
  const now=NOW(), ud=flameJet.userData, fade=(flameJetUntil-now)/0.12;
  if(fade<=0){ flameJet.visible=false; return; }
  const f=Math.min(1,fade), L=flameJetLen;
  ud.body.scale.set(1+Math.sin(now*34)*0.08, L, 1+Math.sin(now*29)*0.08); ud.body.position.z=L/2;   // stretch the column to its reach + flicker its girth
  ud.core.scale.set(1, L, 1); ud.core.position.z=L/2;
  ud.tip.position.set(0, -L*0.05, L*0.98); ud.tip.scale.setScalar(2.3+Math.sin(now*22)*0.45);
  const fl=0.82+Math.sin(now*46)*0.12+Math.random()*0.08;                                            // alive flicker
  ud.bodyMat.opacity=0.5*f*fl; ud.coreMat.opacity=0.84*f*fl; ud.tip.material.opacity=0.6*f*fl;
  ud.bodyMat.map.offset.y -= dt*1.7;                                                                  // fire flows nozzle → tip
}
export function fireFlame(now, g, x, z, ang, k=1){
  const F=BALANCE.flame, range=g.range||F.range, cx=Math.sin(ang), cz=Math.cos(ang);
  // ===== VISUAL: a STREAM of MOVING fire — burning fuel that projects out (like tracers) & cools white→red as it flies =====
  const nx=x+cx*0.8, nz=z+cz*0.8;
  for(let i=0;i<6;i++){
    const a=ang+(Math.random()-0.5)*0.42, v=range*2.8+Math.random()*range, big=Math.random()<0.45;   // fast outward, tight cone near the nozzle
    spawnPart(nx, 1.28+Math.random()*0.32, nz, Math.sin(a)*v, 1.5+Math.random()*1.5, Math.cos(a)*v,
      {color:0xfff0c0, color2:0x8a1c0a, size:0.7+Math.random()*0.5, grow:big?2.7:1.6, life:0.32+Math.random()*0.22, grav:5.5, drag:1.7});   // billows out then cools to ember-red
  }
  spawnPart(nx,1.35,nz, cx*6,0.8,cz*6, {color:0xfff7e2, color2:0xffae3a, size:1.5, grow:0.6, life:0.1, grav:0, drag:6});   // bright nozzle root flash
  if(Math.random()<0.4) spawnPart(x+cx*range*0.8, 2.6, z+cz*range*0.8, (Math.random()-0.5)*2.4, 1.6, (Math.random()-0.5)*2.4, {color:0x241b13, size:2.0, life:0.75, smoke:true, grav:-0.5, drag:1.5, op:0.4});   // rolling smoke
  if(Math.random()<0.5){ const d2=range*(0.35+Math.random()*0.5); spawnPart(x+cx*d2+(Math.random()-0.5)*2.5, 1.5, z+cz*d2+(Math.random()-0.5)*2.5, (Math.random()-0.5)*3, 3+Math.random()*3, (Math.random()-0.5)*3, {color:0xffb24a, color2:0xff5a1c, size:0.3, grow:0.5, life:0.5, grav:-2.5, drag:1.3}); }   // drifting embers
  // ===== DAMAGE: light up every enemy inside the cone (ground-plane) =====
  for(const e of enemies){ if(e.def.bomber||e.def.air) continue; const dx=e.pos.x-x, dz=e.pos.z-z, d=Math.hypot(dx,dz);
    if(d > range + e.r) continue;
    if(((dx*cx+dz*cz)/(d||1)) < F.cone) continue;                 // only enemies inside the flame cone catch fire
    if(!e.burn) e.burn={ lvl:0, until:0 };
    e.burn.lvl = Math.min(F.lvlMax, e.burn.lvl + F.add);          // each spray-tick stokes the fire (sustained → max fast)
    e.burn.until = now + F.duration; e.burn.k = Math.max(e.burn.k||1, k);   // Z149 the fire burns as hot as your damage upgrades
    e.hitT = Math.max(e.hitT, 0.08);
  }
}
export function makeDangerZone(x,z,r){   // ground decal showing the exact kill radius during the fuse
  const grp=new THREE.Group(); grp.position.set(x,0.12,z); grp.rotation.x=-Math.PI/2;
  const disc=new THREE.Mesh(new THREE.CircleGeometry(r,44), new THREE.MeshBasicMaterial({color:0xff3018,transparent:true,opacity:0.12,side:THREE.DoubleSide,depthWrite:false}));
  const ring=new THREE.Mesh(new THREE.RingGeometry(r-0.5,r,52), new THREE.MeshBasicMaterial({color:0xff5028,transparent:true,opacity:0.85,side:THREE.DoubleSide,depthWrite:false}));
  grp.add(disc,ring); scene.add(grp); grp.userData={disc,ring}; return grp;
}
export function updateRockets(dt, now){
  for(let i=rockets.length-1;i>=0;i--){ const r=rockets[i]; r.tt+=dt;
    r.vy-=r.G*dt; r.x+=r.vx*dt; r.y+=r.vy*dt; r.z+=r.vz*dt; r.mesh.position.set(r.x,r.y,r.z);
    _rdir.set(r.vx,r.vy,r.vz); if(_rdir.lengthSq()>0.0001){ _rdir.normalize(); r.mesh.quaternion.setFromUnitVectors(_RUP,_rdir); }   // nose follows velocity
    const tx=r.x-_rdir.x*1.2, ty=r.y-_rdir.y*1.2, tz=r.z-_rdir.z*1.2;   // tail (behind the nozzle)
    for(let k=0;k<2;k++) spawnPart(tx+(Math.random()-0.5)*0.25, ty+(Math.random()-0.5)*0.25, tz+(Math.random()-0.5)*0.25, -_rdir.x*5+(Math.random()-0.5)*1.6, -_rdir.y*5+(Math.random()-0.5)*1.6, -_rdir.z*5+(Math.random()-0.5)*1.6, {color:0xfff0c0, color2:0xff3a10, size:0.7+Math.random()*0.5, grow:1.5, life:0.3+Math.random()*0.22, grav:0.3, drag:3});   // BURNING fire trail (cools white→red)
    if(Math.random()<0.85) spawnPart(tx, ty, tz, (Math.random()-0.5)*1.2, 0.2, (Math.random()-0.5)*1.2, {color:0x261f1a, size:1.0, life:0.6, smoke:true, grav:0.5, drag:1.8, op:0.4});   // dark smoke behind the fire
    const ud=r.mesh.userData; if(ud.plume){ ud.plume.scale.setScalar(1.9+Math.random()*0.5); ud.plume2.scale.setScalar(1.2+Math.random()*0.5); }   // flicker the engine flame
    if((r.vy<0 && r.y<=heightAt(r.x,r.z)+0.35) || r.tt>6){ scene.remove(r.mesh); rockets.splice(i,1);
      if(r.impact){   // ARC MORTAR shell — bursts ON IMPACT where it really hits the ground (no fuse / danger-zone)
        const x=r.x, z=r.z, aoeR=r.aoeR||5, pos=new THREE.Vector3(x,1.1,z);
        bigExplode(pos, 0xffae5c, aoeR/3.2); if(!r.small) deformCrater(x, z, aoeR*0.5, 0.45+aoeR*0.06); else decalScorch(x, z, aoeR*0.6, 0.7);   // mortar / howitzer shell crater (grenades only scorch)
        ringPulse({x,z}, 0xffffff, aoeR*0.9); ringPulse({x,z}, 0xffd27a, aoeR*0.6);
        for(let k=0;k<5;k++){ const aa=Math.random()*6.28, rr=Math.random()*aoeR*0.7; spawnPart(x+Math.cos(aa)*rr,1,z+Math.sin(aa)*rr,(Math.random()-0.5)*4,2+Math.random()*3,(Math.random()-0.5)*4,{color:0xfff0c0,color2:0xff4a14,size:0.8,grow:1.4,life:0.4,grav:3,drag:2}); }
        for(const e of enemies.slice()){ if(e.def.air) continue; const dx=e.pos.x-x, dz=e.pos.z-z; if(dx*dx+dz*dz < aoeR*aoeR) damageEnemy(e, (r.dmg||30)*(r.small?typeMul('HE',armorOf(e)):1)); }   // shells can't reach aircraft
        if(boss&&boss.alive){ const dx=boss.pos.x-x, dz=boss.pos.z-z; if(dx*dx+dz*dz < aoeR*aoeR) damageBoss(r.bossDmg||(r.dmg||30)*0.6); }
        for(const bl of blocks.slice()) if((bl.kind==='obj'||bl.kind==='tower'||bl.kind==='brick'||bl.kind==='camp'||bl.kind==='pylon') && Math.hypot(bl.x-x,bl.z-z) < aoeR+bl.r) damageBlock(bl, (r.dmg||30)*0.8);   // shells wreck structures too
        if(r.small){ S.shake=Math.min(1.4, S.shake+0.18); sfx('explode', {x,z}); } else { S.shake=Math.min(3.0, S.shake + 0.5 + aoeR*0.08); sfx('bigexplode'); }   // ground burst: earth clods come from fireball(), no metal debris   // bigger AoE → bigger boom (howitzer > mortar)
      } else {
        fuses.push({ x:r.x, z:r.z, at:now+(r.fuse!=null?r.fuse:2), blink:0, aoeR:r.aoeR, bossDmg:r.bossDmg, dmg:r.dmg, wipe:r.wipe, zone:makeDangerZone(r.x,r.z,r.aoeR) });
        ringPulse({x:r.tx,z:r.tz}, 0x886054, 3);   // dust puff on impact
      }
    }
  }
}
export function updateFuses(dt, now){
  for(let i=fuses.length-1;i>=0;i--){ const f=fuses[i]; f.blink-=dt;
    const t2d=Math.max(0, f.at-now), k=Math.min(1,Math.max(0,1-t2d/2));   // 0 → 1 as it nears detonation (clamped)
    if(f.zone){ const pul=0.5+0.5*Math.sin(now*(7+k*18));            // danger circle pulses faster + brighter as the boom nears
      f.zone.userData.disc.material.opacity=0.1+0.26*k+0.05*pul;
      f.zone.userData.ring.material.opacity=0.45+0.5*pul; }
    if(f.blink<=0){ f.blink=0.3-0.18*k; sfx('beep');                 // beeps quicken
      spawnPart(f.x,0.5,f.z,(Math.random()-0.5)*4,3,(Math.random()-0.5)*4,{color:0xff5028,size:1.2,life:0.3,grav:-2}); }
    if(now>=f.at){
      if(f.zone){ scene.remove(f.zone); f.zone.children.forEach(c=>{c.geometry.dispose(); c.material.dispose();}); }
      const pos=new THREE.Vector3(f.x,1.2,f.z), wipe=f.wipe!==false;
      bigExplode(pos, 0xffae5c, f.aoeR/3); deformCrater(f.x, f.z, wipe?6.5:f.aoeR*0.5, wipe?1.9:0.6);   // SIEGE rocket blasts a big deep crater
      ringPulse({x:f.x,z:f.z}, 0xffffff, f.aoeR*1.1); ringPulse({x:f.x,z:f.z}, 0xffd27a, f.aoeR); ringPulse({x:f.x,z:f.z}, 0xff5028, f.aoeR*0.7);   // shockwave rings to the kill edge
      for(let k2=0;k2<(wipe?12:5);k2++){ const a=Math.random()*6.28, rr=Math.random()*f.aoeR; setTimeout(()=>{ if(S.mode==='paused')return; bigExplode(new THREE.Vector3(f.x+Math.cos(a)*rr,1,f.z+Math.sin(a)*rr), 0xff7a3d, 1.7); }, k2*38); }
      for(const e of enemies.slice()){ const dx=e.pos.x-f.x, dz=e.pos.z-f.z; if(dx*dx+dz*dz < f.aoeR*f.aoeR) damageEnemy(e, wipe?99999:(f.dmg||36)); }   // SIEGE wipes; HOWITZER deals scaled AoE
      if(boss&&boss.alive){ const dx=boss.pos.x-f.x, dz=boss.pos.z-f.z; if(dx*dx+dz*dz < f.aoeR*f.aoeR) damageBoss(wipe?f.bossDmg:(f.dmg||36)*0.6); }
      spawnDebris(pos, wipe?2.8:1.6, 0xff7a3d);
      S.shake=Math.min(6, S.shake+(wipe?4.2:1.9));                   // siege = ground-quake; howitzer = solid thump
      muzzleLight.position.set(f.x,3,f.z); muzzleLight.color.setHex(0xffae5c); muzzleLight.intensity=wipe?8:5;
      sfx('bigexplode');
      fuses.splice(i,1);
    }
  }
}
// AUTO-FIRE: called every frame while playing. Handles reload + magazine + fragments.
const _tp=new THREE.Vector3(), _mz=new THREE.Vector3();
export function fireGun(now, range){
  const p=S.player; if(!p.guns.length) return;
  const inst=p.guns[p.gunIdx], g=GUNS[inst.id];
  if(inst.rU) return;                                    // this gun is reloading (its own timer; others reload in the background)
  if(!p.infiniteAmmo && inst.ammo<=0){ startReload(now, inst); return; }
  if(now < p.fireAt) return;
  const rapid = (now<p.overUntil || now<p.buffUntil.rapid) ? 0.5 : 1;   // overdrive spell / RAPID buff
  if(g.spinUp){ p.spinT=now; }
  const spinMul = g.spinUp ? 1 + 2.2*(1-(p.spin||0)) : 1;                  // MINIGUN: the barrel cluster must spin up before full rate
  p.fireAt = now + g.fireCd * rapid * p.fireMul * gunFireMul(inst.id) * spinMul;   // MASTERY: higher level fires faster
  if(!p.infiniteAmmo) inst.ammo--;
  (p.muzzles ? p.muzzles[(p.mzI=((p.mzI||0)+1)%p.muzzles.length)] : p.muzzle).getWorldPosition(_v);   // real barrel tip — Z149 twin / multi-tube guns alternate tubes (rhythm, never double damage)
  const ang=p.aimSmoothed;
  const od=p.radius+0.6;                          // spawn bullets at the hull edge so point-blank shots never overshoot a hugging tank
  const x=p.pos.x+Math.sin(ang)*od, z=p.pos.z+Math.cos(ang)*od;
  const crit = Math.random() < p.crit;
  const powerBuff = now<p.buffUntil.power ? 1.6 : 1;     // POWER buff
  const dmg = g.dmg * p.dmgMul * powerBuff * (1 + p.weaponLvl*0.15) * (crit?2:1) * gunDmgMul(inst.id) * cMod('playerDmgMul');   // MASTERY: +dmg per gun level; CONTRACT may boost
  if(g.special==='rocket'){ fireRocket(now, g); }
  else if(g.special==='mortar'){ fireMortar(now, g, dmg); }
  else if(g.special==='arty'){ fireArty(now, g, dmg); }
  else if(g.special==='flame'){ fireFlame(now, g, x, z, ang, dmg/(g.dmg||1)); { const rg=p.mesh.userData.rig; if(rg) rg.vib=Math.min(0.5,rg.vib+0.12); } muzzleLight.position.set(x,1.4,z); muzzleLight.color.setHex(0xff6a1c); muzzleLight.intensity=2.2;
    if(Math.random()<0.12) sfx('shoot_flame'); if(!p.infiniteAmmo && inst.ammo<=0) startReload(now, inst); updateGunHUD(); return; }   // flame handles its own FX; skip the bullet/muzzle path + throttle sound
  else {
    const n=g.frags, maxDist=(range||playerRange())+2;     // bullets only reach within combat range
    const aimTgt = aimTarget(maxDist);                     // arc toward the target (mobile: only one straight ahead); straight if it's close
    const aimDist = ((!MOBILE || PAD.active) && S.pointerActive) ? Math.hypot(S.aimPoint.x-p.pos.x, S.aimPoint.z-p.pos.z)   // desktop: where YOU point
                  : (aimTgt ? Math.hypot(aimTgt.pos.x-p.pos.x, aimTgt.pos.z-p.pos.z) : 0);                    // mobile: the auto-locked target
    // launch from the BARREL MOUTH (rounds visibly leave the muzzle) — unless an enemy hugs the hull closer than the muzzle reach
    const md=Math.hypot(_v.x-p.pos.x, _v.z-p.pos.z);
    const sx0=_v.x, sz0=_v.z, sy0=_v.y, arcD=0, dropD=Math.min(Math.max(4, aimDist-md), Math.max(4,maxDist-md));   // direct fire is FLAT (APFSDS/autocannon) — no lob over the target   // realism: rounds leave the MUZZLE — a tank pressed against yours is inside the barrel's reach (riders/drone handle it)
    if(aimTgt && aimDist < md-0.6 && !p._tooCloseT){ p._tooCloseT=1; floatText('QUÁ GẦN CHO PHÁO CHÍNH','#ffcf5a',new THREE.Vector3(p.pos.x,3.4,p.pos.z),15); setTimeout(()=>{ p._tooCloseT=0; },2500); }
    for(let i=0;i<n;i++){
      const a = ang + (n>1 ? (i-(n-1)/2)*(g.spread/(n-1)) : (Math.random()-0.5)*g.spread);
      spawnBullet(sx0,sz0,a,{owner:'p', dmg, speed:g.bspeed, color:g.color, r:g.r, life:g.life, maxDist, arcDist:arcD, y:sy0, dropTo:1.2, dropDist:dropD, type:g.type, reach:maxDist, fall:g.fall??1,
        pierce:g.pierce||0, homing:g.homing||0, lockOn:!!g.lock, aoe:g.aoe||0, aoeDmg:(g.aoe? dmg*gunSplash(g) : 0),
        freeze:g.freeze||0, chain:g.chain||0, chainR:g.chainR||0, knock:g.knock||1, fx:g.fx||'spark', from:p.pos});
    }
  }
  // RECOIL — the tank kicks back opposite the shot; heavy guns lurch, autos barely nudge
  const rec=g.recoil||0; if(rec){ p.kbx -= Math.sin(ang)*rec; p.kbz -= Math.cos(ang)*rec;
    const km=Math.hypot(p.kbx,p.kbz), kc=6.5; if(km>kc){ p.kbx*=kc/km; p.kbz*=kc/km; } }   // cap so rapid-fire recoil can't fling the tank
  gunMuzzleFX(g, _v.x, _v.y, _v.z, ang, rec);   // Z149 the flash of THIS kind of weapon at the real barrel tip
  if(g.flash==='arc' || g.flash==='rail'){ const R=(range||playerRange())+2, list=boss&&boss.alive ? enemies.concat([boss]) : enemies;
    _mz.set(_v.x,_v.y,_v.z);
    if(g.flash==='arc'){ strikePoint(list, _v.x, _v.z, ang, R*0.9, 0.1, _tp); lightning(_mz, _tp); }      // the bolt jumps to whatever is near the line of fire
    else { _tp.set(_v.x+Math.sin(ang)*R, _v.y-0.2, _v.z+Math.cos(ang)*R); railBeam(_mz, _tp); } }      // the slug punches through everything: the beam runs its full reach
  if(CASING[inst.id]){ const c=CASING[inst.id], rx=Math.cos(p.facing), rz=-Math.sin(p.facing), sc=p.mesh.scale.x;   // spent brass ejected from the turret side
    for(let k=0;k<c.n;k++) spawnPart(p.pos.x+rx*1.0*sc, 2.3*sc, p.pos.z+rz*1.0*sc, rx*(3+Math.random()*2)+(Math.random()-0.5), 3+Math.random()*2, rz*(3+Math.random()*2)+(Math.random()-0.5), {color:0xd8a840, size:c.s, life:0.9, grav:-24, drag:0.4}); }
  tankRecoil(p.mesh, ang, Math.min(1, Math.max(0.12, 0.15 + rec*0.22)), p.facing); // barrel slams back + shivers, hull rocks off the shot (Z125: no rumble on firing — the pad only rumbles for hits, blasts and crashes)
  S.shake = g.special==='rocket' ? Math.min(5, S.shake + 2.4)                                     // SIEGE launch — a strong recoil quake (landing quakes harder still)
          : Math.min(1.6, S.shake + Math.min(0.5, 0.04 + rec*0.07));                               // weightier guns shake more per shot
  sfx(g.special ? 'rocketlaunch' : 'shoot_'+inst.id);   // rocket + howitzer both use the launch thump
  if(!p.infiniteAmmo && inst.ammo<=0) startReload(now, inst);
  updateGunHUD();
}
export function selectGun(i){ const p=S.player; if(i<0||i>=p.guns.length) return; p.gunIdx=i; p.readyUntil=0; p.fireAt=performance.now()/1000+0.1; sfx('click'); updateGunHUD(); }   // keep each gun's own reload running
// Z129 the DEFAULT gun (PROFILE.defaultGun, picked in the arsenal with the ★): the one you start with, and the one LB+RB together jumps back to
export function defaultGunIdx(){ const p=S.player; if(!p||!p.guns.length) return 0; const i=p.guns.findIndex(g=>g.id===PROFILE.defaultGun); return i>=0 ? i : 0; }
export function selectDefaultGun(){ const p=S.player; if(!p||!p.guns.length) return; const i=defaultGunIdx(); if(p.gunIdx!==i) selectGun(i); floatText('SÚNG MẶC ĐỊNH · '+(GUNS[p.guns[i].id]||{name:''}).name, '#ffd24a', p.pos, 15); }
export function cycleGun(d=1){ const p=S.player; if(!p.guns.length) return; selectGun((p.gunIdx+d+p.guns.length)%p.guns.length); }
export function giveGun(id){
  const p=S.player, g=GUNS[id]; let inst=p.guns.find(x=>x.id===id);
  if(inst){ inst.ammo=magCap(g); inst.rU=0; } else { p.guns.push({id, ammo:magCap(g), rU:0, rD:0}); }   // Z129 a gift gun joins the rack — it does NOT take over your hands
  const fresh = ownGun(id);                                  // remember it in the permanent arsenal (persists across runs)
  if(fresh){ floatText(g.name+' — MỚI!', '#ffd24a', p.pos, 22); }   // first time ever → brand-new weapon
  else { addGunXp(id); }                                     // already own it → the duplicate feeds MASTERY (level up the gun)
  updateGunHUD();
}
