// combat/siege-rocket.js — SIEGE ROCKET: a lobbed shell that plants a 2s fuse on landing, then wipes a big radius
import * as THREE from 'three';
import { AIM } from '../../config.js';
import { ARENA, GLOW, GUNS, MOBILE, S, _v, aheadTarget, aimTarget, barrelFixed, enemies, equippedGun, heightAt, muzzleLight, playerRange, ringPulse, scene, spawnPart } from '../hub.js';

// ----- SIEGE ROCKET: a lobbed shell that plants a 2s fuse on landing, then wipes a big radius -----
export const rockets=[], fuses=[];
export function makeRocketMesh(){
  const g=new THREE.Group();
  const hull=new THREE.MeshStandardMaterial({color:0x3c4250,metalness:0.82,roughness:0.32,envMapIntensity:0.9});
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.36,2.2,18), hull); g.add(body);                                                   // longer + thicker
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.36,1.0,18), new THREE.MeshStandardMaterial({color:0x1a0d0a,emissive:0xff5a1e,emissiveIntensity:1.9,metalness:0.5,roughness:0.4})); nose.position.y=1.6; g.add(nose);   // glowing warhead
  const tip=new THREE.Mesh(new THREE.SphereGeometry(0.13,12,10), new THREE.MeshStandardMaterial({color:0x000000,emissive:0xffe08a,emissiveIntensity:2.8})); tip.position.y=2.15; g.add(tip);                                  // white-hot tip
  const band=new THREE.Mesh(new THREE.CylinderGeometry(0.38,0.38,0.34,18), new THREE.MeshStandardMaterial({color:0xffb020,emissive:0xff8a10,emissiveIntensity:0.8,metalness:0.4,roughness:0.5})); band.position.y=0.55; g.add(band);   // glowing hazard band
  const collar=new THREE.Mesh(new THREE.CylinderGeometry(0.39,0.35,0.22,18), new THREE.MeshStandardMaterial({color:0x24262c,metalness:0.7,roughness:0.5})); collar.position.y=-1.0; g.add(collar);
  for(let k=0;k<4;k++){ const fin=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.46,0.07), new THREE.MeshStandardMaterial({color:0x2a2e33,metalness:0.6})); fin.position.y=-1.02; fin.rotation.y=k*1.5708; g.add(fin); }   // 4 swept fins
  const eng=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.3,0.28,16), new THREE.MeshStandardMaterial({color:0x000000,emissive:0xffcaa0,emissiveIntensity:2.2})); eng.position.y=-1.2; g.add(eng);                       // glowing nozzle
  const plume =new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffe6a0,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false})); plume.scale.setScalar(2.1);  plume.position.y=-1.7;  g.add(plume);    // bright core flame
  const plume2=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xff6a20,transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false})); plume2.scale.setScalar(1.4); plume2.position.y=-2.15; g.add(plume2);   // trailing flame
  g.userData.plume=plume; g.userData.plume2=plume2;
  return g;
}
// ARC MORTAR shell — a compact glowing round (smaller than the SIEGE rocket); flies the same arc + leaves the same fire trail
export function makeMortarShell(){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.22,0.82,14), new THREE.MeshStandardMaterial({color:0x3e4636,metalness:0.78,roughness:0.4})); g.add(body);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.22,0.5,14), new THREE.MeshStandardMaterial({color:0x120a08,emissive:0xffb020,emissiveIntensity:1.7,metalness:0.5,roughness:0.4})); nose.position.y=0.64; g.add(nose);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(0.235,0.235,0.16,14), new THREE.MeshStandardMaterial({color:0xffc24a,emissive:0xff9a18,emissiveIntensity:0.7,metalness:0.4,roughness:0.5})); band.position.y=0.16; g.add(band);   // glowing band
  for(let k=0;k<4;k++){ const fin=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.24,0.04), new THREE.MeshStandardMaterial({color:0x2a2e26,metalness:0.6})); fin.position.y=-0.42; fin.rotation.y=k*1.5708; g.add(fin); }
  const ex=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffd27a,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending,depthWrite:false})); ex.scale.setScalar(1.15); ex.position.y=-0.62; g.add(ex);
  g.userData.plume=ex; g.userData.plume2=ex;
  return g;
}
// dedicated ENEMY ARTILLERY missile — bigger & menacing: dark hull, glowing red warhead, hazard band, swept fins, fierce plume
export function makeArtMissileMesh(){
  const g=new THREE.Group();
  const hull=new THREE.MeshStandardMaterial({color:0x23262b,metalness:0.78,roughness:0.34});
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.36,0.40,2.1,14), hull); g.add(body);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.39,1.05,14), new THREE.MeshStandardMaterial({color:0x180a08,emissive:0xff2a12,emissiveIntensity:1.5,metalness:0.5,roughness:0.4})); nose.position.y=1.55; g.add(nose);
  const tip=new THREE.Mesh(new THREE.SphereGeometry(0.13,10,10), new THREE.MeshStandardMaterial({color:0x000000,emissive:0xff4020,emissiveIntensity:2.4})); tip.position.y=2.08; g.add(tip);   // glowing seeker tip
  const band=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,0.32,14), new THREE.MeshStandardMaterial({color:0xffc24a,emissive:0xffae20,emissiveIntensity:0.55,metalness:0.4,roughness:0.5})); band.position.y=0.55; g.add(band);   // hazard stripe
  for(let k=0;k<4;k++){ const fin=new THREE.Mesh(new THREE.BoxGeometry(0.66,0.52,0.07), new THREE.MeshStandardMaterial({color:0x15171a,metalness:0.6,roughness:0.5})); fin.position.y=-0.96; fin.rotation.y=k*1.5708; g.add(fin); }
  const plume=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xff7a1c,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false})); plume.scale.setScalar(2.5); plume.position.y=-1.55; g.add(plume); g._plume=plume;
  const core=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffe06a,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false})); core.scale.setScalar(1.25); core.position.y=-1.42; g.add(core);
  g.scale.setScalar(1.15); return g;
}
export const _RUP=new THREE.Vector3(0,1,0), _rdir=new THREE.Vector3();
// where a SIEGE ROCKET will land — DESKTOP: the mouse cursor; MOBILE / no pointer: auto-lock nearest enemy → aim direction
export function rocketTarget(){
  const p=S.player; let tx,tz;
  if(!MOBILE && S.pointerActive){ tx=S.aimPoint.x; tz=S.aimPoint.z; }
  else { const tgt=aimTarget(playerRange()*1.7, AIM.artyCone); if(tgt){ tx=tgt.pos.x; tz=tgt.pos.z;
      if(tgt.vel && p.muzzle){ p.muzzle.getWorldPosition(_v); const g=equippedGun(), el=g.special==='rocket'?ROCKET_ELEV:MORTAR_ELEV, G=g.special==='rocket'?ROCKET_G:MORTAR_G;
        for(let k=0;k<2;k++){ const T=rocketArc(_v.x,_v.y,_v.z,tx,tz,el,G).T; tx=tgt.pos.x+tgt.vel.x*T; tz=tgt.pos.z+tgt.vel.z*T; } } }   // lead: aim where it WILL be after the flight time
    else { tx=p.pos.x+Math.sin(p.aimSmoothed)*26; tz=p.pos.z+Math.cos(p.aimSmoothed)*26; } }
  const lim=ARENA-2; return { x:Math.max(-lim,Math.min(lim,tx)), z:Math.max(-lim,Math.min(lim,tz)) };
}
export const ROCKET_G=30, ROCKET_LAND_Y=0.8, ROCKET_ELEV=Math.PI/2-0.52;   // SIEGE rocket: steep ~60° lob (matches the tall sky-pointing launcher)
export const MORTAR_ELEV=Math.PI/2-0.82, MORTAR_G=46;                       // mortar/howitzer: MODERATE ~43° lob + stronger gravity → flatter & FAST, low hang-time so moving tanks can't walk out of it
// solve the launch SPEED so a fixed-elevation lob from (sx,sy) lands exactly at (tx,tz): 0.8 = sy + D·tanθ − G·D²/(2 v²cos²θ). flight time = √(2(sy+D·tanθ−0.8)/G)
// BALLISTIC SOLUTION for a fixed tube elevation θ: horizontal range D, height drop Δh = launchY − targetY (real ground at the mark)
//   y(t) = sy + v·sinθ·t − G·t²/2,  x(t) = v·cosθ·t   →   v² = G·D² / (2·cos²θ·(D·tanθ + sy − ty)),   flight time T = D / (v·cosθ)
export function rocketArc(sx,sy,sz,tx,tz, elev, G){
  elev = elev||ROCKET_ELEV; G = G||ROCKET_G;
  const dx=tx-sx, dz=tz-sz, D=Math.max(0.001,Math.hypot(dx,dz)), c=Math.cos(elev), s=Math.sin(elev), ty=heightAt(tx,tz)+0.35;
  const denom=Math.max(0.5, sy + D*Math.tan(elev) - ty);
  const v=Math.sqrt(G*D*D/(2*c*c*denom)), T=D/(v*c);
  return { T, vx:v*c*dx/D, vz:v*c*dz/D, vy:v*s, G };   // return G so the shell carries the matching gravity
}
// aim preview: JUST a slim, faint dotted ARC tracing the rocket's flight path (no landing ring — the danger zone only shows once it's fired)
// normal blending + depthTest:false → the line reads on ANY terrain and isn't occluded by geometry/core; small + low-opacity = subtle "tech" guide
export const aimDots=[]; for(let i=0;i<26;i++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xff2e16,transparent:true,opacity:0,depthTest:false,depthWrite:false})); s.renderOrder=998; s.visible=false; scene.add(s); aimDots.push(s); }   // saturated red reads on any terrain
export function hideRocketAim(){ for(const d of aimDots) if(d.visible) d.visible=false; }
export function updateRocketAim(now){
  const p=S.player; if(S.mode!=='playing'||!p||!p.guns||!p.guns.length){ hideRocketAim(); return; }
  const g=GUNS[p.guns[p.gunIdx].id];
  if(!(g && (g.special==='rocket'||g.special==='mortar') && (!MOBILE ? S.pointerActive : true))){ hideRocketAim(); return; }
  const t=rocketTarget(), tx=t.x, tz=t.z;
  p.muzzle.getWorldPosition(_v); const sx=_v.x, sy=_v.y, sz=_v.z;   // launch from the tube MOUTH (same point the shell fires from)
  const a = g.special==='mortar' ? rocketArc(sx,sy,sz,tx,tz, MORTAR_ELEV, MORTAR_G) : rocketArc(sx,sy,sz,tx,tz);   // mortar/howitzer use the flatter fast arc; rocket the steep one
  for(let i=0;i<aimDots.length;i++){ const f=i/(aimDots.length-1), tt=f*a.T, d=aimDots[i];
    d.position.set(sx+a.vx*tt, Math.max(0.2, sy+a.vy*tt-0.5*a.G*tt*tt), sz+a.vz*tt);
    d.scale.setScalar(0.28+f*0.14); d.material.opacity=0.62*(1-f*0.25); d.visible=true; }   // small + faint (just visible), gently fading toward the impact point
}
export function fireRocket(now, g){
  const p=S.player;
  const t=rocketTarget(), tx=t.x, tz=t.z;
  p.muzzle.getWorldPosition(_v); const sx=_v.x, sy=_v.y, sz=_v.z;   // launch EXACTLY from the tube mouth, along the tube's elevation
  const a=rocketArc(sx,sy,sz,tx,tz);
  const mesh=makeRocketMesh(); mesh.position.set(sx,sy,sz); scene.add(mesh);
  rockets.push({ mesh, x:sx,y:sy,z:sz, vx:a.vx, vz:a.vz, vy:a.vy, G:a.G, tx, tz, aoeR:g.aoeR||15, bossDmg:g.bossDmg||350, wipe:true, fuse:2, tt:0 });   // SIEGE: instakill the whole radius
  // LAUNCH KICK: lurch the tank back (fireGun adds the launch shake + recoil + thump) + a flame burst at the tube mouth + dust/smoke at the cradle
  p.kbx -= Math.sin(p.aimSmoothed)*3.5; p.kbz -= Math.cos(p.aimSmoothed)*3.5;
  for(let i=0;i<10;i++){ const sp=4+Math.random()*9; spawnPart(sx, sy, sz, a.vx*0.12+(Math.random()-0.5)*sp, a.vy*0.12+Math.random()*3, a.vz*0.12+(Math.random()-0.5)*sp, {color:0xfff0c0, color2:0xff3a10, size:0.7+Math.random()*0.6, grow:1.7, life:0.26+Math.random()*0.2, grav:6, drag:3}); }   // muzzle blast at the tube mouth
  const bx=p.pos.x-Math.sin(p.aimSmoothed)*0.5, bz=p.pos.z-Math.cos(p.aimSmoothed)*0.5;
  ringPulse({x:bx,z:bz}, 0xff7a3a, 2.4);
  for(let i=0;i<10;i++){ const ba=Math.random()*6.283, v=3+Math.random()*6; spawnPart(bx, 0.7+Math.random()*0.4, bz, Math.cos(ba)*v, 0.5+Math.random()*1.2, Math.sin(ba)*v, {color:0xffd9a0, color2:0xff5a20, size:0.7+Math.random()*0.5, grow:1.5, life:0.3+Math.random()*0.2, grav:3, drag:3}); }   // backblast fire kicked up around the cradle
  for(let i=0;i<5;i++) spawnPart(bx, 0.7, bz, (Math.random()-0.5)*3, 1.3, (Math.random()-0.5)*3, {color:0x241b13, size:1.6, life:0.8, smoke:true, grav:-0.4, drag:1.6, op:0.45});
  muzzleLight.position.set(sx,sy,sz); muzzleLight.color.setHex(0xff7a3a); muzzleLight.intensity=Math.max(muzzleLight.intensity,4.5);
}
// ARC MORTAR — same lob as the rocket (cursor/nearest aim, over walls) but the shell BURSTS ON IMPACT (no fuse); rapid + lower power
export function fireMortar(now, g, dmg){
  const p=S.player;
  const t=rocketTarget(), tx=t.x, tz=t.z;
  p.muzzle.getWorldPosition(_v); const sx=_v.x, sy=_v.y, sz=_v.z;   // launch from the tube mouth, same arc as the rocket
  const a=rocketArc(sx,sy,sz,tx,tz, MORTAR_ELEV, MORTAR_G);   // flatter + faster arc than the SIEGE rocket → lands quickly (low delay)
  const mesh=makeMortarShell(); mesh.position.set(sx,sy,sz); if(g.small) mesh.scale.setScalar(0.5); scene.add(mesh);
  rockets.push({ mesh, x:sx,y:sy,z:sz, vx:a.vx, vz:a.vz, vy:a.vy, G:a.G, tx, tz, aoeR:g.aoeR||5, dmg, bossDmg:g.bossDmg||60, wipe:false, impact:true, tt:0, small:!!g.small });   // impact:true → detonate on landing, no fuse
  for(let i=0;i<6;i++){ const sp=3+Math.random()*5; spawnPart(sx, sy, sz, a.vx*0.1+(Math.random()-0.5)*sp, a.vy*0.1+Math.random()*2, a.vz*0.1+(Math.random()-0.5)*sp, {color:0xfff0c0, color2:0xff8a20, size:0.4+Math.random()*0.3, grow:1.3, life:0.18+Math.random()*0.12, grav:5, drag:3}); }   // muzzle puff at the tube mouth
  muzzleLight.position.set(sx,sy,sz); muzzleLight.color.setHex(0xffd24a); muzzleLight.intensity=Math.max(muzzleLight.intensity,2.4);
}
// HOWITZER — indirect fire: a STEEP high lob that drops onto the farthest enemy (over walls), moderate AoE (no wipe)
export function fireArty(now, g, dmg){
  const p=S.player;
  // long-range auto-target: the nearest enemy in a generous radius, ignoring walls/line-of-sight (it falls from above)
  let tgt=null, bd=1e18; const RNG=Math.max(40, playerRange()*2.2);
  if(barrelFixed()) tgt=aheadTarget(RNG, AIM.artyCone);                 // Z104 mobile: the shell goes where the hull points
  else for(const e of enemies){ if(e.def.bomber) continue; const q=(e.pos.x-p.pos.x)**2+(e.pos.z-p.pos.z)**2; if(q<bd && q<RNG*RNG){ bd=q; tgt=e; } }
  let tx,tz;
  if(tgt){ tx=tgt.pos.x; tz=tgt.pos.z; }
  else if(!MOBILE && S.pointerActive){ tx=S.aimPoint.x; tz=S.aimPoint.z; }
  else { tx=p.pos.x+Math.sin(p.aimSmoothed)*30; tz=p.pos.z+Math.cos(p.aimSmoothed)*30; }
  const lim=ARENA-2; tx=Math.max(-lim,Math.min(lim,tx)); tz=Math.max(-lim,Math.min(lim,tz));
  const sx=p.pos.x+Math.sin(p.aimSmoothed)*(p.radius+0.4), sz=p.pos.z+Math.cos(p.aimSmoothed)*(p.radius+0.4);
  const T=1.3, G=40;   // long flight + strong gravity → tall arc that clears walls and drops near-vertically
  const mesh=makeRocketMesh(); mesh.position.set(sx,2.0,sz); scene.add(mesh);
  rockets.push({ mesh, x:sx,y:2.0,z:sz, vx:(tx-sx)/T, vz:(tz-sz)/T, vy:G*T/2 + (0.8-2.0)/T, G, tx, tz, aoeR:g.aoeR||5.2, dmg:dmg||36, wipe:false, fuse:0.4, tt:0 });
  if(tgt) ringPulse(tgt.pos, 0xffd24a, 2.0);   // brief "target acquired" mark
}
