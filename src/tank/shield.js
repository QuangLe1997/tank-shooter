// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.
import * as THREE from 'three';
import { ARENA, NIGHT, PLAYER, TANK_SCALE, _canvasTex, buildTank, makeFlag, scene, vnTex } from '../hub.js';

// ----- premium energy SHIELD: hex force-field + rim glow + orbiting rings (animated in the loop) -----
export let _shieldTex=null;
export function shieldHexTex(){
  if(_shieldTex) return _shieldTex;
  const S2=256, c=document.createElement('canvas'); c.width=c.height=S2; const x=c.getContext('2d');
  x.clearRect(0,0,S2,S2); x.strokeStyle='rgba(190,244,255,0.95)'; x.lineWidth=2.4; x.lineJoin='round';
  const R=30, h=R*Math.sqrt(3)/2;
  const hex=(cx,cy)=>{ x.beginPath(); for(let i=0;i<6;i++){ const a=i*Math.PI/3; const px=cx+Math.cos(a)*R, py=cy+Math.sin(a)*R; i?x.lineTo(px,py):x.moveTo(px,py); } x.closePath(); x.stroke(); };
  for(let col=-2; col*R*1.5 < S2+R; col++) for(let row=-2; row*h*2 < S2+R; row++){ hex(col*R*1.5, row*h*2 + (col&1?h:0)); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(3,2); t.colorSpace=THREE.SRGBColorSpace; _shieldTex=t; return t;
}
export function makeShieldRig(){
  const g=new THREE.Group(); g.position.y=1.2;
  const add=(m)=>{ g.add(m); return m; };
  const fill = add(new THREE.Mesh(new THREE.SphereGeometry(2.5,24,18),  new THREE.MeshBasicMaterial({color:0x2fa8e0, transparent:true, opacity:0.12, depthWrite:false, blending:THREE.AdditiveBlending})));
  const shell= add(new THREE.Mesh(new THREE.SphereGeometry(2.6,32,24),  new THREE.MeshBasicMaterial({map:shieldHexTex(), color:0x7fe0ff, transparent:true, opacity:0.5, depthWrite:false, blending:THREE.AdditiveBlending})));
  const rim  = add(new THREE.Mesh(new THREE.SphereGeometry(2.82,28,20), new THREE.MeshBasicMaterial({color:0xbff4ff, transparent:true, opacity:0.32, side:THREE.BackSide, depthWrite:false, blending:THREE.AdditiveBlending})));   // back-side shell → glowing Fresnel-ish rim
  const ring1= add(new THREE.Mesh(new THREE.TorusGeometry(2.66,0.055,10,52), new THREE.MeshBasicMaterial({color:0x9ff0ff, transparent:true, opacity:0.85, depthWrite:false, blending:THREE.AdditiveBlending}))); ring1.rotation.x=Math.PI/2;
  const ring2= add(new THREE.Mesh(new THREE.TorusGeometry(2.66,0.05,10,52),  ring1.material.clone())); ring2.rotation.set(0.6,0.4,0);
  g.userData={fill, shell, rim, ring1, ring2}; g.visible=false; return g;
}
export function makePlayer(){
  const mesh = buildTank({detail:true, mighty:true}); mesh.scale.setScalar(TANK_SCALE);   // player = the hero unit: heavier, more imposing silhouette
  const shield = makeShieldRig(); mesh.add(shield); mesh.userData.shield=shield;           // energy force-field (Aegis / shield power-up)
  { const T=mesh.userData.turret, pole=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.035,2.0,6), new THREE.MeshStandardMaterial({color:0x2a2a26, roughness:0.5, metalness:0.7}));
    pole.position.set(-0.72,1.25,-1.1); T.add(pole); const fl=makeFlag(vnTex(), 1.25, 0.82, -1); fl.position.set(-0.72,1.82,-1.1); T.add(fl); fl.userData.flag.dyn=true; mesh.userData.flag=fl; }
  { const B=mesh.userData.body, hz=_canvasTex(64,16,(x,W,H)=>{ x.fillStyle='#e8b830'; x.fillRect(0,0,W,H); x.fillStyle='#1a1a16'; for(let i=-2;i<10;i++){ x.beginPath(); x.moveTo(i*10,H); x.lineTo(i*10+8,0); x.lineTo(i*10+13,0); x.lineTo(i*10+5,H); x.fill(); } });
    const steelM=new THREE.MeshStandardMaterial({color:0x4a4a44,roughness:0.45,metalness:0.85}), dz=new THREE.Group(); dz.visible=false; B.add(dz); mesh.userData.dozer=dz;   // Z93 DOZER BLADE (ram buff)
    const bl=new THREE.Mesh(new THREE.BoxGeometry(3.4,0.9,0.14), [steelM,steelM,steelM,steelM,new THREE.MeshStandardMaterial({map:hz,roughness:0.6,metalness:0.4}),steelM]); bl.position.set(0,-0.42,2.42); bl.rotation.x=-0.22; dz.add(bl);
    for(let k=0;k<7;k++){ const t=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.34,5), steelM); t.rotation.x=Math.PI/2; t.position.set(-1.5+k*0.5,-0.86,2.58); dz.add(t); }   // ripper teeth
    for(const sx of [-1.15,1.15]){ const arm=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.16,0.9), steelM); arm.position.set(sx,-0.38,1.95); arm.rotation.x=0.18; dz.add(arm); }
    const eraM=new THREE.MeshStandardMaterial({color:0xa89868,roughness:0.75,metalness:0.3}), tiles=[];                  // Z93 REACTIVE ARMOUR bricks (one per charge)
    for(const sx of [-1,1]) for(const zz of [1.15,0.4,-0.35]){ const t=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.34,0.62), eraM); t.position.set(sx*1.6,0.12,zz); t.rotation.z=sx*0.12; t.visible=false; B.add(t); tiles.push(t); }
    mesh.userData.eraTiles=tiles; }   // 🇻🇳 the player's tank flies the Vietnamese flag
  { const hl=new THREE.SpotLight(0xfff2dc, 0, 34, 0.5, 0.6, 0); hl.position.set(0,1.2,2.1); const tg=new THREE.Object3D(); tg.position.set(0,0,14); mesh.userData.body.add(hl); mesh.userData.body.add(tg); hl.target=tg; NIGHT.head=hl; }   // driving lights (night)
  scene.add(mesh);
  return {
    mesh, turret: mesh.userData.turret, muzzle: mesh.userData.muzzle,
    pos: new THREE.Vector3(0, 0, ARENA*0.55), vel: new THREE.Vector3(),
    facing: -Math.PI, aim: -Math.PI, aimSmoothed: -Math.PI, shieldMesh: mesh.userData.shield,
    hp:100, maxHp:100, lives:3, fireAt:0, weaponLvl:0,
    guns:[{id:'rifle', ammo:24, rU:0, rD:0}], gunIdx:0,   // gun inventory (R2; per-gun reload rU/rD)
    infiniteAmmo:false, ammoMul:1, magMul:1,                  // ammoMul derived from buffs each frame; magMul = persistent BIG MAGAZINE upgrade
    buffUntil:{ rapid:0, power:0, speed:0, infammo:0, ammoup:0, range:0, turbo:0, ram:0 }, buffLv:{ turbo:0 }, era:0,   // timed power-up buffs (+Z93 turbo/ram levels, ERA tiles)
    rangeMul:1, radius:PLAYER.radius, scale:1,                   // combat-range upgrade + boss-parity scale
    dashUntil:0, dashCdUntil:0, invincibleUntil:0, dashDir:new THREE.Vector3(),
    overUntil:0, spellCdUntil:0, shieldUntil:0, charge:0,
    // roguelite upgrade multipliers (P7)
    dmgMul:1, fireMul:1, speedMul:1, dashCdMul:1, spellCdMul:1, crit:0, lifesteal:0, kbx:0, kbz:0, reloadMul:1, armor:0, bossMul:1,
  };
}
