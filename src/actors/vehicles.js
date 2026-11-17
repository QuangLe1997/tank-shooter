// actors/vehicles.js — Z80 enemy VEHICLES: flame tank, ATGM tank-destroyer, engineer repair truck, attack gunship, APC dismount (Z89)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BALANCE, ENV, ROSTER } from '../../config.js';
import { BIOME, ENVMOD, MOBILE, S, _canvasTex, _mergeColored, aoeDamage, bigExplode, bullets, burst, cMod, clampField, core, damageCore, damagePlayer, damageSoldier, decalScorch, deformCrater, diffDmgMul, diffScale, enemies, enemyPool, fireball, floatText, grimeMat, heightAt, inSmoke, launchEnemyMissile, loopDmgMul, loopHpMul, panelTex, radio, realCol, scene, sfx, smokeSpread, soldiers, solidTank, spawnBullet, spawnEnemy, spawnPart, tankExplode, tankRecoil, tip, wrapAngle } from '../hub.js';
import { TROOPS } from '../../config.js';

// ===== Z116 · ROCKET TRUCK — 6×6 cab-over truck with an 8-tube rocket pod on a turntable (enemy salvo launcher / our hijacked AA + siege truck) =====
export function makeLauncherMesh(pal){ const g=new THREE.Group(); g.rotation.order='YXZ'; const _m={}, mm=(k,f)=>_m[k]||(_m[k]=f());
  const paint=(c)=>mm('p'+c,()=>grimeMat(new THREE.MeshStandardMaterial({ color:realCol(c), roughness:0.8, metalness:0.35, map:panelTex() }), 1));
  const steel=mm('s',()=>new THREE.MeshStandardMaterial({ color:0x3a3b35, roughness:0.4, metalness:0.85 })), dark=mm('d',()=>new THREE.MeshStandardMaterial({ color:0x18181a, roughness:0.7, metalness:0.3 }));
  const rub=mm('r',()=>new THREE.MeshStandardMaterial({ color:0x161512, roughness:0.95, metalness:0.05 })), glass=mm('g',()=>new THREE.MeshStandardMaterial({ color:0x0a1418, roughness:0.08, metalness:1, envMapIntensity:1.6 }));
  const add=(par,geo,mat,x,y,z,rx,ry,rz)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.rotation.set(rx||0,ry||0,rz||0); par.add(m); return m; };
  const body=new THREE.Group(); g.add(body);
  add(body, new THREE.BoxGeometry(1.9,0.28,4.7), steel, 0,0.78,-0.1);                                                    // ladder frame
  for(const z of [1.55,-0.75,-1.75]) for(const sx of [-1,1]){ const w=add(g, new THREE.CylinderGeometry(0.5,0.5,0.42,16), rub, sx*1.05,0.5,z, 0,0,Math.PI/2); add(g, new THREE.CylinderGeometry(0.26,0.26,0.44,10), steel, sx*1.06,0.5,z, 0,0,Math.PI/2); }   // 6 wheels + hubs
  for(const z of [1.55,-1.25]) add(body, new THREE.BoxGeometry(2.45,0.12,1.5), paint(pal.tread), 0,1.04,z);               // mudguards
  add(body, new RoundedBoxGeometry(2.25,1.2,1.35,2,0.12), paint(pal.hull), 0,1.65,1.6);                                 // cab
  add(body, new THREE.BoxGeometry(1.95,0.5,0.05), glass, 0,1.86,2.29, -0.12); for(const sx of [-1,1]) add(body, new THREE.BoxGeometry(0.05,0.42,0.7), glass, sx*1.13,1.85,1.7);   // windscreen + side windows
  add(body, new THREE.BoxGeometry(2.1,0.32,0.12), steel, 0,1.05,2.3);                                                     // bumper
  for(const sx of [-0.8,0.8]) add(body, new THREE.CylinderGeometry(0.09,0.1,0.06,10), mm('hl',()=>new THREE.MeshStandardMaterial({color:0xfff2d0,emissive:0xffeec0,emissiveIntensity:0.35})), sx,1.18,2.37, Math.PI/2,0,0);   // headlights
  add(body, new THREE.BoxGeometry(2.3,0.22,3.0), paint(pal.hull), 0,1.02,-0.85);                                         // rear deck
  for(const sx of [-1,1]) add(body, new THREE.BoxGeometry(0.28,0.5,0.9), paint(pal.tread), sx*0.95,1.38,0.3);           // fuel / stowage boxes
  for(const sx of [-1,1]) add(body, new THREE.CylinderGeometry(0.06,0.06,0.9,6), steel, sx*1.0,0.95,-2.3, 0,0,0.6*sx); // stabiliser jacks
  const tur=new THREE.Group(); tur.position.set(0,1.18,-1.0); body.add(tur);                                               // turntable (yaws like a turret)
  add(tur, new THREE.CylinderGeometry(0.75,0.85,0.22,18), steel, 0,0,0);
  const pod=new THREE.Group(); pod.position.set(0,0.55,0.2); pod.rotation.x=-0.42; tur.add(pod);                           // elevated pod
  add(pod, new RoundedBoxGeometry(1.75,0.95,2.3,2,0.06), paint(pal.turret), 0,0,0);
  for(const sx of [-1,1]) add(pod, new THREE.BoxGeometry(0.06,0.7,1.9), steel, sx*0.9,0,0);                              // side rails
  for(let r=0;r<2;r++) for(let c=0;c<4;c++){ const x=-0.6+c*0.4, y=-0.2+r*0.4; add(pod, new THREE.CircleGeometry(0.15,14), dark, x,y,1.155);
    if((r+c)%3) add(pod, new THREE.ConeGeometry(0.12,0.22,12), mm('w',()=>new THREE.MeshStandardMaterial({color:0x2a2a24,emissive:0xff6a2a,emissiveIntensity:0.35,roughness:0.5})), x,y,1.2, Math.PI/2,0,0); }   // loaded rockets peeking out
  const muz=new THREE.Object3D(); muz.position.set(0,0.1,1.25); pod.add(muz);
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  g.userData.turret=tur; g.userData.pod=pod; g.userData.muzzle=muz; g.userData.body=body; g.userData.truck=true; g.userData.paint=Object.keys(_m).filter(k=>k[0]==='p').map(k=>[_m[k], _m[k].color.getHex()]); return g; }   // Z179 paint list for world/sidepaint.js
// Z116 rocket salvo — enemy truck lobs it at you; arcs over cover (it is a howitzer-style launcher)
export function truckSalvo(e, tx, tz, now){ const R=ROSTER.launcher, mz=e.mesh.userData.muzzle; if(!mz) return; const _w=new THREE.Vector3();
  for(let k=0;k<R.salvo;k++) setTimeout(()=>{ if(S.mode!=='playing' || !enemies.includes(e) || e.abandoned) return; mz.getWorldPosition(_w);
    const gx=tx+(Math.random()-0.5)*R.spread*2, gz=tz+(Math.random()-0.5)*R.spread*2, D=Math.hypot(gx-_w.x,gz-_w.z)||1, T=D/R.speed, vy=(heightAt(gx,gz)+0.5-_w.y)/T + 0.5*4*T;
    launchEnemyMissile(_w.x,_w.y,_w.z, Math.atan2(gx-_w.x,gz-_w.z), { speed:R.speed, dmg:R.dmg*diffDmgMul(), aoe:R.aoe, life:T+1.5, kind:'heli', vy }); spawnPart(_w.x,_w.y,_w.z, 0,1.5,0, {color:0xd8d0c0, size:1.4, life:0.7, smoke:true, grav:0.3, drag:2, op:0.5}); }, k*R.gap*1000); }
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
// Z198 a modern ATTACK HELICOPTER: a narrow armoured fuselage with a stepped tandem cockpit (faceted armoured glazing, frames), twin engine
//   nacelles with down-turned exhaust deflectors, a tapered boom with a swept fin, stabilator + end plates, a 3-blade tail rotor, a 5-blade
//   main rotor on a real hub, stub wings carrying rocket pods and quad ATGM racks, a chin cannon turret that tracks you, a nose sensor ball,
//   fixed landing gear, IR jammer, antennas, and nav lights (red/green wingtips, white tail) + a red strobe. Static parts are merged per
//   material (a handful of draw calls a helicopter); the rotors and the turret move.
const _hx=(geo,x,y,z,rx,ry,rz,sx,sy,sz)=>{ geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0)), new THREE.Vector3(sx||1,sy||1,sz||1))); return geo; };
// Z199b heli paint: a two-tone splinter camouflage (sand / olive / brown) with panel lines, the faction roundel and a white tactical number
let _hcT=null, _insM=null, _numM={};
export function heliCamoTex(){ if(_hcT) return _hcT; const c=document.createElement('canvas'); c.width=c.height=256; const x=c.getContext('2d'); x.fillStyle='#c2ab72'; x.fillRect(0,0,256,256);
  const poly=(col,n)=>{ for(let i=0;i<n;i++){ x.fillStyle=col; x.beginPath(); const cx=Math.random()*256, cy=Math.random()*256; x.moveTo(cx,cy); for(let k=0;k<5;k++) x.lineTo(cx+(Math.random()-0.5)*110, cy+(Math.random()-0.5)*70); x.closePath(); x.fill(); } };
  poly('#6e7a3c',9); poly('#7a5232',7); x.strokeStyle='rgba(30,26,18,0.35)'; x.lineWidth=1.2; for(let k=0;k<256;k+=32){ x.beginPath(); x.moveTo(k,0); x.lineTo(k,256); x.moveTo(0,k+12); x.lineTo(256,k+12); x.stroke(); }
  for(let i=0;i<80;i++){ x.fillStyle='rgba(30,26,18,0.5)'; x.fillRect(Math.random()*256,Math.random()*256,2,2); }   // rivets
  _hcT=new THREE.CanvasTexture(c); _hcT.colorSpace=THREE.SRGBColorSpace; _hcT.wrapS=_hcT.wrapT=THREE.RepeatWrapping; _hcT.anisotropy=4; return _hcT; }
export function insigniaMat(){ return _insM||(_insM=new THREE.MeshStandardMaterial({ map:_canvasTex(128,128,(x,W)=>{ x.clearRect(0,0,W,W); x.fillStyle='#f0e8d0'; x.beginPath(); x.arc(64,64,62,0,7); x.fill(); x.fillStyle='#161616'; x.beginPath(); x.arc(64,64,54,0,7); x.fill();
    x.fillStyle='#c81e1e'; x.fillRect(10,48,108,32); x.fillStyle='#f0e8d0'; x.beginPath(); x.arc(64,64,17,0,7); x.fill(); x.fillStyle='#c81e1e'; x.beginPath(); for(let k=0;k<10;k++){ const r=k%2?6:14, a=-Math.PI/2+k*Math.PI/5; x.lineTo(64+Math.cos(a)*r, 64+Math.sin(a)*r); } x.fill(); }), transparent:true, alphaTest:0.4, roughness:0.6, polygonOffset:true, polygonOffsetFactor:-2 })); }
export function numMat(n){ return _numM[n]||(_numM[n]=new THREE.MeshStandardMaterial({ map:_canvasTex(128,64,(x,W,H)=>{ x.clearRect(0,0,W,H); x.font='900 52px "Saira Condensed", Arial'; x.textAlign='center'; x.textBaseline='middle'; x.fillStyle='#f4f0e4'; x.fillText(n,W/2,H/2+2); }), transparent:true, alphaTest:0.4, roughness:0.6, polygonOffset:true, polygonOffsetFactor:-2 })); }
export function decal(par, mat, w, h, x, y, z, ry){ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h), mat); m.position.set(x,y,z); m.rotation.y=ry||0; par.add(m); return m; }
function _side(pts, w, bev){ const sh=new THREE.Shape(); sh.moveTo(pts[0][0],pts[0][1]); for(const q of pts.slice(1)) sh.lineTo(q[0],q[1]); sh.closePath();
  const g=new THREE.ExtrudeGeometry(sh,{ depth:w, bevelEnabled:!!bev, bevelThickness:bev||0, bevelSize:bev||0, bevelSegments:2 }); g.translate(0,0,-w/2); g.rotateY(-Math.PI/2); return g; }   // profile (z,y) extruded across x
let _tm=null; function _tipM(){ return _tm||(_tm=new THREE.MeshStandardMaterial({ color:0xf2c21a, roughness:0.5 })); }
export function buildGunship(pal){
  if(!_heliMats){ _heliMats={ hull:new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.5, metalness:0.35, map:heliCamoTex() }),
    dark:new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.55, metalness:0.6 }), glass:new THREE.MeshStandardMaterial({ color:0x1e2a26, roughness:0.05, metalness:0.95, envMapIntensity:1.6 }),
    blade:new THREE.MeshStandardMaterial({ color:0x1a1c18, roughness:0.6, metalness:0.3 }), blur:new THREE.MeshBasicMaterial({ color:0x202020, transparent:true, opacity:0.14, depthWrite:false, side:THREE.DoubleSide }),
    lens:new THREE.MeshStandardMaterial({ color:0x101418, emissive:0x3a6a8a, emissiveIntensity:0.8, roughness:0.1, metalness:0.9 }),
    red:new THREE.MeshStandardMaterial({ color:0x200000, emissive:0xff2020, emissiveIntensity:3 }), green:new THREE.MeshStandardMaterial({ color:0x002000, emissive:0x20ff40, emissiveIntensity:2.6 }), white:new THREE.MeshStandardMaterial({ color:0x202020, emissive:0xffffff, emissiveIntensity:2.2 }) }; }
  const H=_heliMats, g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  const hullC=0xffffff, camo=0xb8b0a0, belly=0xd8dcde, D=0x26281f, M2=0x3a3c36, RED=0xc81e1e;   // Z199b painted: the camo lives in the texture, vertex colours only tint
  const P={ hull:[], dark:[], glass:[] }, add=(k,geo,col)=>P[k].push({ geo, col });
  add('hull', _side([[4.35,-0.15],[4.05,-0.72],[2.6,-0.98],[-0.4,-1.02],[-1.7,-0.62],[-1.85,0.42],[0.0,0.88],[0.5,0.92],[2.6,0.52],[3.65,0.12],[4.35,0.0]], 1.18, 0.12), hullC);   // armoured fuselage
  add('hull', _hx(new THREE.BoxGeometry(1.36,0.32,3.2),0,-0.86,0.9), belly);   // belly
  for(const [z0,w] of [[2.2,0.5],[0.6,0.8],[-1.0,0.6]]) add('hull', _hx(new THREE.BoxGeometry(1.42,0.5,w),0,0.25,z0), camo);   // camouflage bands
  add('glass', _side([[3.7,0.1],[2.7,0.78],[1.75,0.86],[1.55,1.24],[0.3,1.3],[0.05,0.86],[0.1,0.5],[3.4,0.1]], 1.02, 0.03), 0xffffff);   // stepped tandem canopy
  for(const z of [2.75,1.65,0.95,0.3]) add('dark', _hx(new THREE.BoxGeometry(1.08,0.08,0.07),0,z>1.6?(z>2.6?0.72:0.92):1.29,z), D);   // canopy frames
  add('dark', _hx(new THREE.BoxGeometry(0.06,0.55,2.9),0,1.05,1.9,-0.18), D);
  for(const sx of [-1,1]){ add('hull', _hx(new THREE.CylinderGeometry(0.4,0.42,2.4,16),sx*0.78,1.0,-0.2,Math.PI/2), hullC); add('dark', _hx(new THREE.CylinderGeometry(0.3,0.3,0.12,14),sx*0.78,1.0,1.02,Math.PI/2), D);   // engines + intakes
    add('dark', _hx(new THREE.CylinderGeometry(0.3,0.42,0.9,12),sx*1.05,0.8,-1.55,Math.PI/2+0.35,0,sx*0.7), M2);   // down-turned exhaust deflectors
    add('hull', _hx(new THREE.BoxGeometry(1.35,0.13,0.95),sx*1.32,-0.12,0.45,0,0,sx*-0.1), hullC);   // stub wing
    add('dark', _hx(new THREE.BoxGeometry(0.12,0.35,0.5),sx*1.25,-0.35,0.45), D); add('dark', _hx(new THREE.BoxGeometry(0.12,0.35,0.5),sx*1.85,-0.38,0.45), D);   // pylons
    add('hull', _hx(new THREE.CylinderGeometry(0.28,0.28,1.55,14),sx*1.25,-0.68,0.5,Math.PI/2), camo); add('dark', _hx(new THREE.CylinderGeometry(0.26,0.26,0.04,14),sx*1.25,-0.68,1.28,Math.PI/2), 0x111111);   // rocket pod
    for(const [ox,oy] of [[-0.11,-0.6],[0.11,-0.6],[-0.11,-0.82],[0.11,-0.82]]) add('dark', _hx(new THREE.CylinderGeometry(0.095,0.095,1.6,10),sx*1.88+ox,oy,0.55,Math.PI/2), 0x4a5038);   // quad ATGM rack
    add('dark', _hx(new THREE.CylinderGeometry(0.04,0.05,0.85,6),sx*0.95,-0.95,1.25,0,0,sx*0.35), D); add('dark', _hx(new THREE.CylinderGeometry(0.25,0.25,0.18,12),sx*1.1,-1.32,1.25,0,0,Math.PI/2), 0x161616); }   // main gear
  add('hull', _hx(new THREE.CylinderGeometry(0.2,0.44,5.3,14),0,0.42,-4.0,Math.PI/2), hullC);   // tapered boom
  add('dark', _hx(new THREE.CylinderGeometry(0.3,0.32,0.45,14),0,0.42,-5.0,Math.PI/2), RED); add('dark', _hx(new THREE.CylinderGeometry(0.36,0.38,0.4,14),0,0.42,-2.4,Math.PI/2), RED);   // red recognition bands
  add('hull', _side([[-6.0,0.45],[-6.75,0.45],[-7.35,2.15],[-6.85,2.2]], 0.14, 0.03), camo);   // swept fin
  add('hull', _hx(new THREE.BoxGeometry(2.4,0.07,0.55),0,0.55,-6.0), hullC); for(const sx of [-1.2,1.2]) add('hull', _hx(new THREE.BoxGeometry(0.06,0.5,0.6),sx,0.6,-6.0), camo);   // stabilator + end plates
  add('dark', _hx(new THREE.CylinderGeometry(0.05,0.07,0.9,6),0,-0.1,-6.2,0.4), D); add('dark', _hx(new THREE.CylinderGeometry(0.13,0.13,0.1,10),0,-0.5,-6.35,0,0,Math.PI/2), 0x161616);   // tail wheel
  add('dark', _hx(new THREE.CylinderGeometry(0.3,0.36,0.55,14),0,1.5,0.2), D); add('dark', _hx(new THREE.BoxGeometry(0.5,0.35,0.5),0,1.35,-1.05), M2); add('dark', _hx(new THREE.CylinderGeometry(0.12,0.16,0.3,10),0,1.65,-1.05), 0x2a2c26);   // mast fairing, IR jammer
  for(const [x,z,h] of [[0.35,-1.6,0.6],[-0.3,2.2,0.4]]) add('dark', _hx(new THREE.BoxGeometry(0.03,h,0.18),x,0.9+h/2,z,0,0,0.2), D);   // blade antennas
  for(const k in P){ if(!P[k].length) continue; const m=new THREE.Mesh(_mergeColored(P[k]), H[k]); m.castShadow=true; body.add(m); }
  { const num=String(10+((Math.random()*89)|0)); for(const sx of [-1,1]){ decal(body, insigniaMat(), 0.75, 0.75, sx*0.4, 0.42, -3.6, sx*Math.PI/2); decal(body, numMat(num), 0.9, 0.45, sx*0.62, 0.05, 2.9, sx*Math.PI/2); decal(body, insigniaMat(), 0.6, 0.6, sx*0.08, 1.45, -6.75, sx*Math.PI/2); } }   // faction roundel on the boom + fin, the tactical number on the nose
  // chin turret (tracks you), nose sensor ball, lights
  const chin=new THREE.Group(); chin.position.set(0,-0.95,3.25); body.add(chin);
  { const b=new THREE.Mesh(new THREE.SphereGeometry(0.32,14,10), H.dark); b.castShadow=true; chin.add(b); const el=new THREE.Group(); chin.add(el); chin.userData.el=el;
    const br=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.08,1.7,10), H.dark); br.rotation.x=Math.PI/2; br.position.z=0.9; el.add(br); const mb=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.11,0.25,10), H.dark); mb.rotation.x=Math.PI/2; mb.position.z=1.75; el.add(mb); }
  const muz=new THREE.Object3D(); muz.position.set(0,0,1.9); chin.userData.el.add(muz);
  { const s=new THREE.Mesh(new THREE.SphereGeometry(0.3,14,10), H.dark); s.position.set(0,-0.2,4.3); body.add(s); for(const ox of [-0.12,0.12]){ const l=new THREE.Mesh(new THREE.CircleGeometry(0.1,12), H.lens); l.position.set(ox,-0.2,4.6); body.add(l); } }
  const lt=(mat,x,y,z)=>{ const m=new THREE.Mesh(new THREE.SphereGeometry(0.08,8,6), mat); m.position.set(x,y,z); body.add(m); return m; }; lt(H.red,-2.0,-0.1,0.45); lt(H.green,2.0,-0.1,0.45); lt(H.white,0,2.25,-7.0);
  const nav=lt(H.red,0,0.15,-1.6);   // anti-collision strobe under the boom
  // 5-blade main rotor on a hub with pitch links; a 3-blade tail rotor on the right of the fin
  const rotor=new THREE.Group(); rotor.position.set(0,1.92,0.2); body.add(rotor);
  { const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.3,0.28,12), H.dark); rotor.add(hub); const cap=new THREE.Mesh(new THREE.SphereGeometry(0.2,10,6,0,6.283,0,1.5), H.dark); cap.position.y=0.14; rotor.add(cap);
    for(let k=0;k<5;k++){ const a=k*Math.PI*2/5, bl=new THREE.Mesh(new RoundedBoxGeometry(0.4,0.05,6.3,1,0.02), H.blade); bl.position.set(Math.sin(a)*3.4,0,Math.cos(a)*3.4); bl.rotation.set(0.03,a,0); bl.castShadow=true; rotor.add(bl);
      const tip=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.06,0.35), _tipM()); tip.position.set(Math.sin(a)*6.4,0.01,Math.cos(a)*6.4); tip.rotation.y=a; rotor.add(tip);   // yellow blade tips
      const pl=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.3,5), H.dark); pl.position.set(Math.sin(a)*0.3,-0.15,Math.cos(a)*0.3); rotor.add(pl); } }
  const blur=new THREE.Mesh(new THREE.RingGeometry(0.5,6.6,40), H.blur); blur.rotation.x=-Math.PI/2; rotor.add(blur);
  const trot=new THREE.Group(); trot.position.set(0.2,1.65,-7.0); body.add(trot);
  for(let k=0;k<3;k++){ const b=new THREE.Mesh(new RoundedBoxGeometry(0.04,1.4,0.16,1,0.02), H.blade); b.position.y=0.7; const arm=new THREE.Group(); arm.rotation.x=k*Math.PI*2/3; arm.add(b); trot.add(arm); }
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
  ud.rotor.rotation.y += dt*38; ud.trot.rotation.x += dt*50; ud.nav.visible = (now*1.4)%1 < 0.12;   // Z198 a short strobe flash
  { const lyaw=wrapAngle(want-e.facing), ch=ud.chin; ch.rotation.y += wrapAngle(lyaw-ch.rotation.y)*Math.min(1,dt*5); if(ch.userData.el){ const el=Math.atan2(e.pos.y-heightAt(p.pos.x,p.pos.z)-1.2, d); ch.userData.el.rotation.x += (el-ch.userData.el.rotation.x)*Math.min(1,dt*5); } }   // the chin gun tracks you
  if(Math.random()<0.5){ const cf=Math.cos(e.facing), sf=Math.sin(e.facing); for(const sx of [-1,1]) spawnPart(e.pos.x+cf*sx*1.3-sf*1.6, e.pos.y+0.7, e.pos.z-sf*sx*1.3-cf*1.6, cf*sx*1.5-sf*2, -0.5, -sf*sx*1.5-cf*2, { color:0x3a3632, size:0.55, life:0.6, smoke:true, grav:0.2, drag:2, grow:1.2, op:0.18 }); }   // hot exhaust haze
  if(now>(e.flareAt||0)){ for(const b of bullets){ if(b.owner!=='p' || !b.lockOn || b.tgt!==e) continue; if((b.x-e.pos.x)**2+(b.z-e.pos.z)**2 > 26*26) continue;   // Z198 a missile locked on: FLARES
      e.flareAt=now+7; for(let k=0;k<(MOBILE?8:16);k++){ const a=e.facing+Math.PI+(k%2?1:-1)*(0.6+Math.random()*0.9); spawnPart(e.pos.x, e.pos.y-0.3, e.pos.z, Math.sin(a)*(6+Math.random()*6), 2+Math.random()*4, Math.cos(a)*(6+Math.random()*6), { tex:'fire', color:0xffffff, color2:0xffa040, size:0.8, life:1.6+Math.random()*0.6, grav:-5, drag:0.6 }); }
      if(Math.random()<R.flareDecoy*(b.smart?0.45:1)) { b.tgt=null; b.flared=now+(b.smart?0.6:1.2); } sfx('rocketlaunch', e.pos, 0.4); break; } }
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
