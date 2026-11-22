// combat/siege-rocket.js — LOBBED ROUNDS: the M79 grenade and the hand grenade in an arc (fireMortar), the aim arc drawn on the ground, the shell and
//   the enemy's artillery rocket meshes (no-tanks: the tank's SIEGE rocket and howitzer are gone)
import * as THREE from 'three';
import { AIM, REALTURRET } from '../../config.js';
import { GLOW, GUNS, MOBILE, PAD, S, _v, aimTarget, clampFieldXZ, dressRound, equippedGun, heightAt, muzzleLight, playerRange, scene, spawnPart } from '../hub.js';

export const rockets=[];
// Z396 one geometry per shape for every rocket / shell: each shot built its own seven and dropped them still on the GPU (+600 a battle)
const _G={}, G=(C, ...a)=>{ const k=C.name+':'+a.join(','); return _G[k] || (_G[k]=new C(...a)); };
// ARC MORTAR shell — a compact glowing round (smaller than the SIEGE rocket); flies the same arc + leaves the same fire trail
export function makeMortarShell(){
  const g=new THREE.Group();
  const body=new THREE.Mesh(G(THREE.CylinderGeometry, 0.2,0.22,0.82,14), new THREE.MeshStandardMaterial({color:0x3e4636,metalness:0.78,roughness:0.4})); g.add(body);
  const nose=new THREE.Mesh(G(THREE.ConeGeometry, 0.22,0.5,14), new THREE.MeshStandardMaterial({color:0x120a08,emissive:0xffb020,emissiveIntensity:1.7,metalness:0.5,roughness:0.4})); nose.position.y=0.64; g.add(nose);
  const band=new THREE.Mesh(G(THREE.CylinderGeometry, 0.235,0.235,0.16,14), new THREE.MeshStandardMaterial({color:0xffc24a,emissive:0xff9a18,emissiveIntensity:0.7,metalness:0.4,roughness:0.5})); band.position.y=0.16; g.add(band);   // glowing band
  for(let k=0;k<4;k++){ const fin=new THREE.Mesh(G(THREE.BoxGeometry, 0.3,0.24,0.04), new THREE.MeshStandardMaterial({color:0x2a2e26,metalness:0.6})); fin.position.y=-0.42; fin.rotation.y=k*1.5708; g.add(fin); }
  const ex=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffd27a,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending,depthWrite:false})); ex.scale.setScalar(1.15); ex.position.y=-0.62; g.add(ex);
  g.userData.plume=ex; g.userData.plume2=ex; g.userData.body=g.children.filter(o=>o.isMesh);
  return dressRound(g, REALTURRET.mortar.len, 'mortar', true, 0.17);   // Z425 the finned mortar bomb scan (ours, the fire teams', the towers')
}
// dedicated ENEMY ARTILLERY missile — bigger & menacing: dark hull, glowing red warhead, hazard band, swept fins, fierce plume
// Z218 the enemy artillery rocket — a real 122 mm field rocket: long olive-drab body, steel ogive nose with a fuse, a red HE band + stencil band,
//   four tail fins round a dark nozzle; a short white-hot flame while the motor burns (hidden once it burns out). It rolls as it flies.
let _artRk=null;
function artRocketTemplate(){ if(_artRk) return _artRk; const g=new THREE.Group(), od=new THREE.MeshStandardMaterial({ color:0x4a5236, roughness:0.62, metalness:0.32 }), st=new THREE.MeshStandardMaterial({ color:0x6e726c, roughness:0.38, metalness:0.8 }),
    dk=new THREE.MeshStandardMaterial({ color:0x1c1d1e, roughness:0.5, metalness:0.6 }), red=new THREE.MeshStandardMaterial({ color:0x8a2018, roughness:0.6, metalness:0.2 }), yel=new THREE.MeshStandardMaterial({ color:0xb89a3a, roughness:0.6, metalness:0.2 });
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.17,2.2,16), od); body.position.y=-0.15; g.add(body);
  const prof=[[0.17,0],[0.165,0.12],[0.15,0.3],[0.12,0.48],[0.08,0.62],[0.04,0.72],[0.025,0.78]].map(([r,y])=>new THREE.Vector2(r,y)); const nose=new THREE.Mesh(new THREE.LatheGeometry(prof,16), st); nose.position.y=0.95; g.add(nose);   // ogive nose
  const fuse=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.03,0.12,8), dk); fuse.position.y=1.78; g.add(fuse);
  const b1=new THREE.Mesh(new THREE.CylinderGeometry(0.172,0.172,0.08,16), red); b1.position.y=0.78; g.add(b1); const b2=new THREE.Mesh(new THREE.CylinderGeometry(0.172,0.172,0.04,16), yel); b2.position.y=0.62; g.add(b2);
  const noz=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.12,0.22,14), dk); noz.position.y=-1.36; g.add(noz);
  for(let k=0;k<4;k++){ const f=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.46,0.3), dk); const a=k*Math.PI/2; f.position.set(Math.cos(a)*0.3,-1.06,Math.sin(a)*0.3); f.rotation.y=-a; g.add(f); }   // tail fins
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.18,0.025,6,16), dk); ring.rotation.x=Math.PI/2; ring.position.y=-1.24; g.add(ring);
  for(const o of g.children) o.userData.drawn=true;   // (Z425 the clones hide these once the 122 mm rocket scan is on)
  _artRk=g; return g; }
export function makeArtMissileMesh(){ const g=artRocketTemplate().clone();
  const tongue=new THREE.Mesh(new THREE.ConeGeometry(0.15,1.5,10,1,true), new THREE.MeshBasicMaterial({ color:0xffc070, transparent:true, opacity:0.85, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide })); tongue.rotation.x=Math.PI; tongue.position.y=-2.2; g.add(tongue); g._tongue=tongue;
  const inner=new THREE.Mesh(new THREE.ConeGeometry(0.08,0.8,8,1,true), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide })); inner.rotation.x=Math.PI; inner.position.y=-1.85; g.add(inner); g._inner=inner;
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({ map:GLOW, color:0xffd8a0, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false })); glow.scale.setScalar(1.4); glow.position.y=-1.5; g.add(glow); g._plume=glow;
  g.scale.setScalar(1.25); return dressRound(g, REALTURRET.art.len, 'art', true, 0.18); }   // Z425 the 122 mm field rocket scan
export const _RUP=new THREE.Vector3(0,1,0), _rdir=new THREE.Vector3();
// where a SIEGE ROCKET will land — DESKTOP: the mouse cursor; MOBILE / no pointer: auto-lock nearest enemy → aim direction
export function rocketTarget(){
  const p=S.player; let tx,tz;
  if((!MOBILE || PAD.active) && S.pointerActive){ tx=S.aimPoint.x; tz=S.aimPoint.z; }
  else { const tgt=aimTarget(playerRange()*1.7, AIM.artyCone); if(tgt){ tx=tgt.pos.x; tz=tgt.pos.z;
      if(tgt.vel && p.muzzle){ p.muzzle.getWorldPosition(_v); const g=equippedGun(), el=MORTAR_ELEV, G=MORTAR_G;
        for(let k=0;k<2;k++){ const T=rocketArc(_v.x,_v.y,_v.z,tx,tz,el,G).T; tx=tgt.pos.x+tgt.vel.x*T; tz=tgt.pos.z+tgt.vel.z*T; } } }   // lead: aim where it WILL be after the flight time
    else { tx=p.pos.x+Math.sin(p.aimSmoothed)*26; tz=p.pos.z+Math.cos(p.aimSmoothed)*26; } }
  const [cx,cz]=clampFieldXZ(tx, tz, 2); return { x:cx, z:cz };
}
export const MORTAR_ELEV=Math.PI/2-0.82, MORTAR_G=46;                       // mortar/howitzer: MODERATE ~43° lob + stronger gravity → flatter & FAST, low hang-time so moving tanks can't walk out of it
// solve the launch SPEED so a fixed-elevation lob from (sx,sy) lands exactly at (tx,tz): 0.8 = sy + D·tanθ − G·D²/(2 v²cos²θ). flight time = √(2(sy+D·tanθ−0.8)/G)
// BALLISTIC SOLUTION for a fixed tube elevation θ: horizontal range D, height drop Δh = launchY − targetY (real ground at the mark)
//   y(t) = sy + v·sinθ·t − G·t²/2,  x(t) = v·cosθ·t   →   v² = G·D² / (2·cos²θ·(D·tanθ + sy − ty)),   flight time T = D / (v·cosθ)
export function rocketArc(sx,sy,sz,tx,tz, elev, G){
  elev = elev||MORTAR_ELEV; G = G||MORTAR_G;
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
