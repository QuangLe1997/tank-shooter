// actors/paradrop.js — Z104 PARATROOPERS: every so often an enemy transport helicopter crosses the field and drops a stick of
//   paratroopers near you (or near your men). They drift down under canopies and fight as infantry the moment they land.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { INFANTRY, PARA, TROOPS } from '../../config.js';
import { ARENA, BIOME, FT, MOBILE, S, WAVE, _canvasTex, _mergeColored, blocks, clampFieldXZ, decal, enemies, floatText, heightAt, heliCamoTex, insigniaMat, makeCoverMesh, makeSoldierMesh, numMat, radio, scene, sfx, spawnAlly, spawnEnemy, spawnPart, tip } from '../hub.js';

export const HELOS=[], PARAS=[];
let _nextAt=0, _heloMats=null, _chuteGeo=null, _chuteMat=null;
const R=(a)=>a[0]+Math.random()*(a[1]-a[0]);
function heloMats(){ return _heloMats||(_heloMats={ body:new THREE.MeshStandardMaterial({ color:0x6a6248, roughness:0.7, metalness:0.35 }), dark:new THREE.MeshStandardMaterial({ color:0x202018, roughness:0.6, metalness:0.5 }),
  glass:new THREE.MeshStandardMaterial({ color:0x223038, roughness:0.15, metalness:0.6 }), light:new THREE.MeshStandardMaterial({ color:0x000000, emissive:0xff2a1a, emissiveIntensity:2.5 }),
  bodyV:new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.65, metalness:0.3, map:heliCamoTex() }), darkV:new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.55, metalness:0.5 }), glassV:new THREE.MeshStandardMaterial({ color:0x1e2a2e, roughness:0.06, metalness:0.9, envMapIntensity:1.4 }),
  green:new THREE.MeshStandardMaterial({ color:0x002000, emissive:0x20ff40, emissiveIntensity:2.4 }), white:new THREE.MeshStandardMaterial({ color:0x202020, emissive:0xffffff, emissiveIntensity:2 }),
  blur:new THREE.MeshBasicMaterial({ color:0x202020, transparent:true, opacity:0.13, depthWrite:false, side:THREE.DoubleSide }) }); }
// Z199 tandem-rotor TRANSPORT: a long boxy hull with a cockpit of framed glass, a row of cabin windows, side sponsons, a tall aft pylon,
//   two 3-blade rotors with blur discs, wheels, a refuelling probe, nav lights — and the rear ramp lowered, a jumpmaster in the doorway
function _tx(geo,x,y,z,rx,ry,rz){ geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0)), new THREE.Vector3(1,1,1))); return geo; }
export function buildTransport(){ const M=heloMats(), g=new THREE.Group(), P={ body:[], dark:[], glass:[] }, add=(k,geo,col)=>P[k].push({ geo, col }), OD=0xf0ece4, OD2=0xc8c0b0, BL=0xdadee0;   // Z199b painted camo (texture) + light belly
  add('body', _tx(new RoundedBoxGeometry(2.7,2.7,11.5,3,0.55),0,0,0), OD); add('body', _tx(new RoundedBoxGeometry(2.72,0.6,11.4,2,0.25),0,-1.1,0), BL);   // hull + lighter belly
  add('body', _tx(new THREE.SphereGeometry(1.36,16,10,0,Math.PI*2,0,Math.PI/2),0,-0.1,5.75,Math.PI/2), OD);   // nose
  for(const sx of [-1,1]) add('glass', _tx(new THREE.BoxGeometry(0.06,0.75,1.4),sx*1.12,0.35,6.0,0,sx*0.35,0), 0xffffff); add('glass', _tx(new THREE.BoxGeometry(1.8,0.7,0.06),0,0.55,6.75,-0.5,0,0), 0xffffff);   // cockpit glass
  for(const sx of [-1,1]){ for(let k=0;k<6;k++) add('dark', _tx(new THREE.BoxGeometry(0.05,0.42,0.42),sx*1.36,0.35,3.6-k*1.35), 0x1a2228);   // cabin windows
    add('body', _tx(new RoundedBoxGeometry(0.7,0.9,6.4,2,0.25),sx*1.6,-0.75,-0.4), OD2); for(const z of [3.0,-3.6]) add('dark', _tx(new THREE.CylinderGeometry(0.42,0.42,0.3,14),sx*1.7,-1.55,z,0,0,Math.PI/2), 0x161616); }   // sponsons + wheels
  add('body', _tx(new RoundedBoxGeometry(1.4,2.2,3.0,2,0.3),0,1.9,-4.3), OD); add('body', _tx(new RoundedBoxGeometry(1.1,0.8,1.6,2,0.25),0,1.6,4.0), OD);   // aft + forward pylons
  add('dark', _tx(new THREE.CylinderGeometry(0.35,0.42,0.7,10),0,3.15,-4.3), 0x2a2a24); add('dark', _tx(new THREE.CylinderGeometry(0.35,0.42,0.7,10),0,2.3,4.0), 0x2a2a24);
  for(const sx of [-1,1]) add('dark', _tx(new THREE.CylinderGeometry(0.42,0.42,1.6,12),sx*0.95,2.1,-4.6,Math.PI/2), 0x34342c);   // engine pods
  add('dark', _tx(new THREE.CylinderGeometry(0.06,0.06,2.4,6),0.9,-0.4,7.0,Math.PI/2-0.1), 0x2a2a24);   // refuelling probe
  add('body', _tx(new THREE.BoxGeometry(2.4,0.12,2.4),0,-1.65,-6.6,0.55,0,0), BL);   // the lowered ramp
  add('dark', _tx(new THREE.CylinderGeometry(1.4,1.4,0.5,18),0,0.05,-3.2,Math.PI/2), 0xc81e1e);   // red recognition band
  for(const k in P){ const m=new THREE.Mesh(_mergeColored(P[k]), M[k+'V']); m.castShadow=true; g.add(m); }
  { const num=String(10+((Math.random()*89)|0)); for(const sx of [-1,1]){ decal(g, insigniaMat(), 1.3, 1.3, sx*1.37, 0.2, -1.4, sx*Math.PI/2); decal(g, numMat(num), 1.4, 0.7, sx*1.37, 0.4, 4.6, sx*Math.PI/2); decal(g, insigniaMat(), 1.1, 1.1, sx*0.71, 2.2, -4.6, sx*Math.PI/2); } }
  for(const z of [4.0,-4.3]){ const rot=new THREE.Group(); rot.position.set(0,z>0?2.8:3.6,z); for(let k=0;k<3;k++){ const b=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.06,9.6), M.dark); b.position.z=0; b.rotation.y=k*Math.PI*2/3; b.castShadow=true; rot.add(b); for(const e of [-4.6,4.6]){ const t=new THREE.Mesh(new THREE.BoxGeometry(0.44,0.07,0.4), M.tip||(M.tip=new THREE.MeshStandardMaterial({ color:0xf2c21a, roughness:0.5 }))); t.position.z=e; b.add(t); } }
    const blur=new THREE.Mesh(new THREE.RingGeometry(0.4,4.9,36), M.blur); blur.rotation.x=-Math.PI/2; rot.add(blur); g.add(rot); (g.userData.rotors=g.userData.rotors||[]).push(rot); }
  for(const [mat,x,y,z] of [[M.light,0,-1.45,0],[M.green,1.4,0.3,5.0],[M.light,-1.4,0.3,5.0],[M.white,0,3.0,-5.6]]){ const l=new THREE.Mesh(new THREE.SphereGeometry(0.13,8,6), mat); l.position.set(x,y,z); g.add(l); }
  const jm=makeSoldierMesh({ enemy:true }); jm.scale.setScalar(TROOPS.look.scale); jm.position.set(0.5,-1.3,-5.6); jm.rotation.y=Math.PI; jm.userData.gun.visible=false; g.add(jm);   // the jumpmaster at the ramp
  return g; }
// Z199 a real round military canopy: olive / khaki gores with seams, a vent at the apex, the skirt flared — and the suspension lines down to the risers
let _canopy=null, _cargo=null;
function canopyTex(){ return _canvasTex(128,64,(x,W,H)=>{ for(let i=0;i<16;i++){ x.fillStyle=i%2?'#6a6646':'#7a7652'; x.fillRect(i*W/16,0,W/16+1,H); x.fillStyle='rgba(40,38,26,0.45)'; x.fillRect(i*W/16,0,1,H); } for(let y=10;y<H;y+=14){ x.fillStyle='rgba(40,38,26,0.3)'; x.fillRect(0,y,W,1); } x.fillStyle='#2a281c'; x.fillRect(0,0,W,4); }); }
export function chute(cargo){ if(!_canopy){ const geo=new THREE.SphereGeometry(2.6, 18, 7, 0, Math.PI*2, 0.12, Math.PI/2.15); const p=geo.attributes.position; for(let i=0;i<p.count;i++){ const y=p.getY(i); if(y<1.0) p.setXYZ(i, p.getX(i)*1.06, y, p.getZ(i)*1.06); } geo.computeVertexNormals();
    _canopy={ geo, mat:new THREE.MeshStandardMaterial({ map:canopyTex(), roughness:0.92, side:THREE.DoubleSide }), cargoMat:new THREE.MeshStandardMaterial({ map:_canvasTex(64,32,(x,W,H)=>{ for(let i=0;i<8;i++){ x.fillStyle=i%2?'#b8a070':'#d8c890'; x.fillRect(i*W/8,0,W/8,H); } }), roughness:0.9, side:THREE.DoubleSide }),
      lines:new THREE.LineBasicMaterial({ color:0x3a3a2c, transparent:true, opacity:0.75 }) };
    const pts=[]; for(let k=0;k<12;k++){ const a=k/12*6.283; pts.push(new THREE.Vector3(Math.cos(a)*2.55,3.55,Math.sin(a)*2.55), new THREE.Vector3((k%2?0.18:-0.18),1.55,0)); } _canopy.lineGeo=new THREE.BufferGeometry().setFromPoints(pts); }
  const g=new THREE.Group(), c=new THREE.Mesh(_canopy.geo, cargo?_canopy.cargoMat:_canopy.mat); c.position.y=3.1; c.castShadow=true; g.add(c); g.add(new THREE.LineSegments(_canopy.lineGeo, _canopy.lines)); g.userData.canopy=c; return g; }
// pick a drop zone: near the tank most of the time, otherwise on top of our infantry
// Z107 our drop zone: beside the tank, a little ahead of it
function ourZone(){ const p=S.player, f=p.facing||0, d=R([9,15]); return clampFieldXZ(p.pos.x+Math.sin(f)*d+(Math.random()-0.5)*6, p.pos.z+Math.cos(f)*d+(Math.random()-0.5)*6, 8); }
function dropZone(){ const p=S.player; let cx=p.pos.x, cz=p.pos.z; if(FT.length && Math.random()<0.4){ const a=FT[(Math.random()*FT.length)|0]; cx=a.pos.x; cz=a.pos.z; }
  const ang=Math.random()*6.283, d=R([16,30]); return clampFieldXZ(cx+Math.cos(ang)*d, cz+Math.sin(ang)*d, 8); }
export function launchParadrop(now, opt){ const fr=!!(opt&&opt.friendly), [dx,dz]=fr ? (opt.at ? clampFieldXZ(opt.at[0]+(Math.random()-0.5)*8, opt.at[1]+(Math.random()-0.5)*8, 8) : ourZone()) : dropZone(), a=fr ? Math.PI+(Math.random()-0.5)*0.8 : Math.random()*Math.PI-Math.PI;   // Z107 ours start close (it must arrive while the fight is on)   // inbound from the enemy side, straight over the zone
  const st=Math.min(4,S.stage-1), nH=fr ? 1 : (MOBILE?PARA.helosMobile:PARA.helos)[st], T=MOBILE?PARA.troopsMobile:PARA.troops, cx=Math.cos(a), cz=-Math.sin(a);   // Z199 a whole formation
  for(let k=0;k<nH;k++){ const lat=(k-(nH-1)/2)*PARA.spread, back=k*PARA.trail, sx=dx+cx*lat-Math.sin(a)*(ARENA*(fr?0.75:1.15)+back), sz=dz+cz*lat-Math.cos(a)*(ARENA*(fr?0.75:1.15)+back);
    const g=buildTransport(); g.position.set(sx, PARA.alt, sz); g.rotation.y=a; scene.add(g);
    const n=fr ? (opt.n|0||4) : Math.round(R(T));
    HELOS.push({ g, x:sx, z:sz, a, dx:dx+cx*lat, dz:dz+cz*lat, n, dropped:0, dropAt:0, mark:null, t:0, fr, cargo:!fr && S.stage>=PARA.cargoFrom ? 1 : 0 }); }
  const mark=new THREE.Mesh(new THREE.RingGeometry(5.2,5.8,40), new THREE.MeshBasicMaterial({ color:fr?0x9be04a:0xff4a2a, transparent:true, opacity:0.6, side:THREE.DoubleSide, depthWrite:false })); mark.rotation.x=-Math.PI/2; mark.position.set(dx, heightAt(dx,dz)+0.1, dz); scene.add(mark); HELOS[HELOS.length-1].mark=mark;
  if(fr){ floatText('LÍNH DÙ QUÂN TA', '#9be04a', {x:dx, y:heightAt(dx,dz)+3, z:dz}, 20); return; }   // Z107 ours: no alarm
  SMOKE_ZONES.push({ x:dx, z:dz, t:14 });   // a red smoke grenade marks the drop zone
  if(S.stage>=PARA.escortFrom && enemies.filter(e=>e.def.air).length<(MOBILE?2:3)){ const [ex,ez]=clampFieldXZ(dx-Math.sin(a)*ARENA*0.7, dz-Math.cos(a)*ARENA*0.7, 8); spawnEnemy('gunship', ex, ez); }   // an attack helicopter flies escort
  radio(nH>1 ? 'SCH: Cả một đội hình trực thăng vận tải địch đang tới — đổ bộ đường không ồ ạt xuống chỗ khói đỏ!' : 'SCH: Trực thăng vận tải địch đang tới — chúng sẽ thả lính dù xuống chỗ vòng đỏ!'); floatText(nH>1?'⚠ ĐỔ BỘ ĐƯỜNG KHÔNG':'⚠ LÍNH DÙ ĐỊCH', '#ff7a5a', {x:dx, y:heightAt(dx,dz)+3, z:dz}, 22); sfx('alarm'); tip('paradrop'); }
export const SMOKE_ZONES=[], CANOPIES=[];
export function clearParadrops(){ for(const h of HELOS){ scene.remove(h.g); if(h.mark) scene.remove(h.mark); } HELOS.length=0; for(const q of PARAS) scene.remove(q.g); PARAS.length=0; for(const c of CANOPIES) scene.remove(c.g); CANOPIES.length=0; SMOKE_ZONES.length=0; _nextAt=0; }
export function updateParadrops(dt, now){
  if(!_nextAt) _nextAt=now+R(MOBILE?PARA.everyMobile:PARA.every)*0.6;
  const infN=enemies.reduce((n,e)=>n+(e.def.inf?1:0),0), cap=(MOBILE?INFANTRY.squad.maxMobile:INFANTRY.squad.maxOnField)+(MOBILE?6:14);   // Z199 an airborne assault may overfill the field
  if(now>=_nextAt && !HELOS.some(h=>!h.fr) && WAVE.active && S.stage>=PARA.fromStage && S.wave>=PARA.fromWave && infN<cap){ launchParadrop(now); _nextAt=now+R(MOBILE?PARA.everyMobile:PARA.every); }
  else if(now>=_nextAt) _nextAt=now+6;
  for(let i=HELOS.length-1;i>=0;i--){ const h=HELOS[i]; h.t+=dt; const sx=Math.sin(h.a), sz=Math.cos(h.a);
    const spd=PARA.speed*(h.fr?1.7:1); h.x+=sx*spd*dt; h.z+=sz*spd*dt; h.g.position.set(h.x, PARA.alt+Math.sin(h.t*1.3)*0.3, h.z); h.g.rotation.z=Math.sin(h.t*0.8)*0.04;
    for(const r of h.g.userData.rotors) r.rotation.y+=dt*(r.position.z>0?24:-24);
    if(h.mark) h.mark.material.opacity=0.35+0.3*Math.sin(now*7);
    const along=(h.x-h.dx)*sx+(h.z-h.dz)*sz;                                                // signed distance past the drop zone
    if(h.dropped<h.n+h.cargo && along>-PARA.gap*spd*h.n*0.5 && now>=h.dropAt){ h.dropAt=now+PARA.gap; const cargo=h.dropped>=h.n; h.dropped++;   // Z199 out of the ramp, one after another (the cargo bundle last)
      const px=h.x-sx*6.6+(Math.random()-0.5)*1.2, pz=h.z-sz*6.6+(Math.random()-0.5)*1.2, gy=heightAt(px,pz), y0=PARA.alt-1.8;
      if(cargo){ const g=new THREE.Group(), box=makeCoverMesh('crates', false); box.scale.setScalar(0.55); g.add(box); for(const ox of [-1.2,1.2]){ const c=chute(true); c.position.x=ox; c.scale.setScalar(0.8); g.add(c); } g.position.set(px,y0,pz); scene.add(g);
        PARAS.push({ g, x:px, z:pz, y:y0, vy:-8, ph:Math.random()*6, open:0, cargo:true, fr:h.fr, vyOpen:-(y0-gy-8)/(PARA.fall*1.1) }); continue; }
      const s=makeSoldierMesh(h.fr?null:{enemy:true}); s.scale.setScalar(TROOPS.look.scale); const c=chute(); c.scale.setScalar(0.08); s.add(c);
      s.position.set(px, y0, pz); s.rotation.y=h.a+Math.PI; scene.add(s);
      PARAS.push({ g:s, c, x:px, z:pz, y:y0, vy:-6, ph:Math.random()*6, open:0, rpg:S.stage>=PARA.rpgFrom && h.dropped%4===1, fr:h.fr, vyOpen:-(y0-gy-6)/PARA.fall }); }
    if(h.dropped>=h.n && h.mark && !h.markGone){ h.markGone=true; const mk=h.mark; setTimeout(()=>scene.remove(mk), 4000); }   // the zone marker fades out after the last jumper
    if(Math.abs(h.x)>ARENA*1.9 || Math.abs(h.z)>ARENA*1.9){ if(h.dropped>=h.n+h.cargo || h.t>30){ scene.remove(h.g); if(h.mark && !h.markGone) scene.remove(h.mark); HELOS.splice(i,1); } } }
  for(let i=PARAS.length-1;i>=0;i--){ const q=PARAS[i]; q.ph+=dt;
    if(q.open<1){ q.open=Math.min(1, q.open+dt*(q.open>0?2.2:0)); if(q.open===0 && q.vy<-14+1e-3) q.open=0.001; q.vy=Math.max(-16, q.vy-9.8*dt); if(q.open>0){ q.vy+= (q.vyOpen-q.vy)*Math.min(1,dt*3.5); } if(q.y<PARA.alt-5 && q.open===0) q.open=0.001;   // freefall a beat, then the canopy cracks open
      const k=q.open, cs=q.cargo?1:Math.max(0.08, k*k*(3-2*k)); if(q.c) q.c.scale.set(cs/TROOPS.look.scale*1.15, (0.3+0.7*cs)/TROOPS.look.scale*1.15, cs/TROOPS.look.scale*1.15); }
    else { q.vy=q.vyOpen; if(q.c){ const br=1+Math.sin(q.ph*3.1)*0.03; q.c.userData.canopy.scale.set(br,1/br,br); } }   // the canopy breathes
    q.y+=q.vy*dt; q.x+=Math.sin(q.ph*0.9)*0.7*dt; q.z+=Math.cos(q.ph*0.7)*0.6*dt;
    q.g.position.set(q.x, q.y, q.z); q.g.rotation.z=Math.sin(q.ph*1.4)*0.14*q.open; q.g.rotation.x=Math.cos(q.ph*1.1)*0.1*q.open;
    const gy=heightAt(q.x,q.z); if(q.y<=gy){ PARAS.splice(i,1);
      spawnPart(q.x, gy+0.4, q.z, 0, 0.3, 0, {color:BIOME.ground, size:2.2, life:0.8, smoke:true, grav:0.2, drag:2, op:0.4});   // dust as he lands
      const lay=(c,x,z)=>{ if(!c) return; c.removeFromParent(); c.position.set(x+_r(1.5), gy+0.05, z+_r(1.5)); c.rotation.set(0, Math.random()*6.283, 0); c.scale.setScalar(1.15); scene.add(c); CANOPIES.push({ g:c, t:0 }); };   // the canopy sags down onto the ground and lies there
      if(q.cargo){ const kids=q.g.children.slice(); for(const ch of kids) if(ch!==q.g.children[0]) lay(ch, q.x, q.z); scene.remove(q.g);
        if(!q.fr){ const m=makeCoverMesh('crates', true); m.scale.setScalar(0.7); m.position.set(q.x, gy-0.05, q.z); m.rotation.y=Math.random()*6.283; scene.add(m); blocks.push({ mesh:m, x:q.x, z:q.z, r:1.3, hp:60, maxHp:60, steel:false, cover:true, ms:0.7, loot:Math.random()<0.5, kind:'crates' }); }   // a supply bundle: cover to fight from
        continue; }
      lay(q.c, q.x, q.z); scene.remove(q.g);
      if(q.fr){ const a=spawnAlly(q.x, q.z, Math.random()*6.283); if(a) a.thinkAt=0; continue; }   // Z107 our paratrooper joins the squad
      const e=spawnEnemy(q.rpg?'rpg':'rifle', q.x, q.z); if(e){ e.fireAt=now+0.8; } } }
  for(let i=CANOPIES.length-1;i>=0;i--){ const C=CANOPIES[i]; C.t+=dt; const k=Math.min(1,C.t/1.2); C.g.scale.y=1.15*(1-0.88*k); if(C.t>9){ scene.remove(C.g); CANOPIES.splice(i,1); } }
  while(CANOPIES.length>(MOBILE?14:36)){ scene.remove(CANOPIES.shift().g); }
  for(let i=SMOKE_ZONES.length-1;i>=0;i--){ const Z=SMOKE_ZONES[i]; Z.t-=dt; if(Z.t<=0){ SMOKE_ZONES.splice(i,1); continue; } if(Math.random()<(MOBILE?0.4:0.8)) spawnPart(Z.x, heightAt(Z.x,Z.z)+0.4, Z.z, 0.6+_r(0.4), 1.6+Math.random(), 0.3+_r(0.4), { color:0xd8382a, size:1.0, life:3.2, smoke:true, grav:0.25, drag:0.6, grow:3.2, op:0.6 }); } }   // red smoke billowing off the drop zone
const _r=(a)=>(Math.random()-0.5)*2*a;
