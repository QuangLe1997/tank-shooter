// actors/paradrop.js — Z104 PARATROOPERS: every so often an enemy transport helicopter crosses the field and drops a stick of
//   paratroopers near you (or near your men). They drift down under canopies and fight as infantry the moment they land.
import * as THREE from 'three';
import { INFANTRY, PARA, TROOPS } from '../../config.js';
import { ARENA, FT, MOBILE, S, WAVE, _canvasTex, enemies, floatText, heightAt, makeSoldierMesh, radio, scene, sfx, spawnEnemy, spawnPart, tip } from '../hub.js';

export const HELOS=[], PARAS=[];
let _nextAt=0, _heloMats=null, _chuteGeo=null, _chuteMat=null;
const R=(a)=>a[0]+Math.random()*(a[1]-a[0]);
function heloMats(){ return _heloMats||(_heloMats={ body:new THREE.MeshStandardMaterial({ color:0x6a6248, roughness:0.7, metalness:0.35 }), dark:new THREE.MeshStandardMaterial({ color:0x202018, roughness:0.6, metalness:0.5 }),
  glass:new THREE.MeshStandardMaterial({ color:0x223038, roughness:0.15, metalness:0.6 }), light:new THREE.MeshStandardMaterial({ color:0x000000, emissive:0xff2a1a, emissiveIntensity:2.5 }) }); }
// tandem-rotor transport (reads differently from the attack gunship)
function buildTransport(){ const M=heloMats(), g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(1.35, 6.4, 6, 12), M.body); body.rotation.x=Math.PI/2; g.add(body);
  const nose=new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8, 0, Math.PI*2, 0, Math.PI/2), M.glass); nose.rotation.x=Math.PI/2; nose.position.set(0,0.35,4.1); g.add(nose);
  for(const z of [3.4,-3.4]){ const py=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.5,0.9,8), M.dark); py.position.set(0,1.75,z); g.add(py);
    const rot=new THREE.Group(); rot.position.set(0,2.3,z); for(let k=0;k<3;k++){ const b=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.05,8.4), M.dark); b.rotation.y=k*Math.PI/3; rot.add(b); } g.add(rot); (g.userData.rotors=g.userData.rotors||[]).push(rot); }
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.16,8,6), M.light); lamp.position.set(0,-1.35,0); g.add(lamp);
  for(const sx of [-1,1]){ const gear=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.6,0.18), M.dark); gear.position.set(sx*1.0,-1.5,2.4); g.add(gear); const g2=gear.clone(); g2.position.z=-2.6; g.add(g2); }
  g.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); return g; }
function chute(){ if(!_chuteGeo){ _chuteGeo=new THREE.SphereGeometry(1.7, 14, 6, 0, Math.PI*2, 0, Math.PI/2.3);
    _chuteMat=new THREE.MeshStandardMaterial({ map:_canvasTex(64,32,(x,W,H)=>{ for(let i=0;i<8;i++){ x.fillStyle=i%2?'#8a2a20':'#d8cfb8'; x.fillRect(i*W/8,0,W/8,H); } }), roughness:0.9, side:THREE.DoubleSide }); }
  const g=new THREE.Group(); const c=new THREE.Mesh(_chuteGeo, _chuteMat); c.position.y=3.4; g.add(c);
  const lm=new THREE.LineBasicMaterial({ color:0x2a2a22 }); const pts=[]; for(let k=0;k<6;k++){ const a=k/6*6.283; pts.push(new THREE.Vector3(Math.cos(a)*1.55,3.2,Math.sin(a)*1.55), new THREE.Vector3(0,1.35,0)); }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lm)); return g; }
// pick a drop zone: near the tank most of the time, otherwise on top of our infantry
function dropZone(){ const p=S.player; let cx=p.pos.x, cz=p.pos.z; if(FT.length && Math.random()<0.4){ const a=FT[(Math.random()*FT.length)|0]; cx=a.pos.x; cz=a.pos.z; }
  const ang=Math.random()*6.283, d=R([16,30]), lim=ARENA-8; return [Math.max(-lim,Math.min(lim,cx+Math.cos(ang)*d)), Math.max(-lim,Math.min(lim,cz+Math.sin(ang)*d))]; }
export function launchParadrop(now){ const [dx,dz]=dropZone(), a=Math.random()*Math.PI-Math.PI, sx=dx-Math.sin(a)*(ARENA*1.6), sz=dz-Math.cos(a)*(ARENA*1.6);   // inbound from the enemy side, straight over the zone
  const g=buildTransport(); g.position.set(sx, PARA.alt, sz); g.rotation.y=a; scene.add(g);
  const T=MOBILE?PARA.troopsMobile:PARA.troops, n=Math.round(R(T));
  const mark=new THREE.Mesh(new THREE.RingGeometry(5.2,5.8,40), new THREE.MeshBasicMaterial({ color:0xff4a2a, transparent:true, opacity:0.6, side:THREE.DoubleSide, depthWrite:false })); mark.rotation.x=-Math.PI/2; mark.position.set(dx, heightAt(dx,dz)+0.1, dz); scene.add(mark);
  HELOS.push({ g, x:sx, z:sz, a, dx, dz, n, dropped:0, dropAt:0, mark, t:0 });
  radio('SCH: Trực thăng vận tải địch đang tới — chúng sẽ thả lính dù xuống chỗ vòng đỏ!'); floatText('⚠ LÍNH DÙ ĐỊCH', '#ff7a5a', {x:dx, y:heightAt(dx,dz)+3, z:dz}, 20); sfx('alarm'); tip('paradrop'); }
export function clearParadrops(){ for(const h of HELOS){ scene.remove(h.g); scene.remove(h.mark); } HELOS.length=0; for(const q of PARAS) scene.remove(q.g); PARAS.length=0; _nextAt=0; }
export function updateParadrops(dt, now){
  if(!_nextAt) _nextAt=now+R(MOBILE?PARA.everyMobile:PARA.every)*0.6;
  const infN=enemies.reduce((n,e)=>n+(e.def.inf?1:0),0), cap=(MOBILE?INFANTRY.squad.maxMobile:INFANTRY.squad.maxOnField)+4;
  if(now>=_nextAt && !HELOS.length && WAVE.active && S.stage>=PARA.fromStage && S.wave>=PARA.fromWave && infN<cap){ launchParadrop(now); _nextAt=now+R(MOBILE?PARA.everyMobile:PARA.every); }
  else if(now>=_nextAt) _nextAt=now+6;
  for(let i=HELOS.length-1;i>=0;i--){ const h=HELOS[i]; h.t+=dt; const sx=Math.sin(h.a), sz=Math.cos(h.a);
    h.x+=sx*PARA.speed*dt; h.z+=sz*PARA.speed*dt; h.g.position.set(h.x, PARA.alt+Math.sin(h.t*1.3)*0.3, h.z); h.g.rotation.z=Math.sin(h.t*0.8)*0.04;
    for(const r of h.g.userData.rotors) r.rotation.y+=dt*(r.position.z>0?24:-24);
    h.mark.material.opacity=0.35+0.3*Math.sin(now*7);
    const along=(h.x-h.dx)*sx+(h.z-h.dz)*sz;                                                // signed distance past the drop zone
    if(h.dropped<h.n && along>-PARA.gap*PARA.speed*h.n*0.5 && now>=h.dropAt){ h.dropAt=now+PARA.gap; h.dropped++;
      const s=makeSoldierMesh({enemy:true}); s.scale.setScalar(TROOPS.look.scale); const c=chute(); c.scale.setScalar(1/TROOPS.look.scale*1.2); s.add(c);
      const px=h.x-sx*2.6+(Math.random()-0.5)*1.5, pz=h.z-sz*2.6+(Math.random()-0.5)*1.5; s.position.set(px, PARA.alt-1.6, pz); scene.add(s);
      const gy=heightAt(px,pz); PARAS.push({ g:s, c, x:px, z:pz, y:PARA.alt-1.6, vy:-(PARA.alt-1.6-gy)/PARA.fall, ph:Math.random()*6, rpg:S.stage>=PARA.rpgFrom && h.dropped===1 }); }
    if(h.dropped>=h.n && !h.markGone){ h.markGone=true; const mk=h.mark; setTimeout(()=>scene.remove(mk), 2500); }   // the zone marker fades out after the last jumper
    if(Math.abs(h.x)>ARENA*1.9 || Math.abs(h.z)>ARENA*1.9){ if(h.dropped>=h.n || h.t>25){ scene.remove(h.g); scene.remove(h.mark); HELOS.splice(i,1); } } }
  for(let i=PARAS.length-1;i>=0;i--){ const q=PARAS[i]; q.ph+=dt; q.y+=q.vy*dt; q.x+=Math.sin(q.ph*0.9)*0.6*dt; q.z+=Math.cos(q.ph*0.7)*0.5*dt;
    q.g.position.set(q.x, q.y, q.z); q.g.rotation.z=Math.sin(q.ph*1.4)*0.12; q.g.rotation.x=Math.cos(q.ph*1.1)*0.08;
    const gy=heightAt(q.x,q.z); if(q.y<=gy){ scene.remove(q.g); PARAS.splice(i,1);
      spawnPart(q.x, gy+0.6, q.z, 0, 0.4, 0, {color:0xd8cfb8, size:2.6, life:0.7, smoke:true, grav:0.4, drag:2, op:0.45});   // the canopy collapses into the dirt
      const e=spawnEnemy(q.rpg?'rpg':'rifle', q.x, q.z); if(e){ e.fireAt=now+0.8; } } } }
