// world/core-walls.js — Z140 OUR STRONGHOLD: the Core sits inside a walled compound built in the land's own style (regional.js) — an octagon of thick walls
//   with four gates, four bastions and on each bastion a big twin-barrelled GUARD CANNON that turns and fires on enemies that come for the Core.
//   Our walls stop enemy fire but never our own (blocks flagged ours); the guns are indestructible but slow, so the Core still needs you.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BIOME, MOBILE, S, ZONES, blocks, capGeo, capMat, core, enemies, heightAt, makeFlag, scene, sfx, spawnBullet, spawnPart, towerRoof, unwave, vnTex, wallMat } from '../hub.js';

export const CORE_DEF = { R:19, H:4.6, T:1.8, gateW:9, range:54, cd:1.5, dmg:18, turn:2.4, guns:[], g:null };
function box(w,h,d){ const g=new THREE.BoxGeometry(w,h,d), uv=g.attributes.uv, p=g.attributes.position, n=g.attributes.normal;   // UVs in world metres (4 m per tile)
  for(let i=0;i<uv.count;i++){ const ax=Math.abs(n.getX(i)), ay=Math.abs(n.getY(i)); const u=ax>0.5?p.getZ(i):p.getX(i), v=ay>0.5?p.getZ(i):p.getY(i); uv.setXY(i,u/4,v/4); } return g; }
const at=(g,x,y,z,ry)=>{ g.rotateY(ry||0); g.translate(x,y,z); return g; };
const _gm={};
function gunMats(){ if(_gm.hull) return _gm; const M=(c,r,m)=>new THREE.MeshStandardMaterial({ color:c, roughness:r, metalness:m });
  _gm.hull=M(0x4e5c34,0.55,0.55); _gm.dark=M(0x23271c,0.5,0.7); _gm.steel=M(0x5a5e58,0.4,0.85); _gm.lime=new THREE.MeshStandardMaterial({ color:0x9be04a, emissive:0x5fae1c, emissiveIntensity:0.8 }); return _gm; }
function makeGun(){ const m=gunMats(), root=new THREE.Group(), yaw=new THREE.Group(); root.add(yaw);
  const ring=new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.9,0.5,20), m.dark); ring.position.y=0.25; root.add(ring);
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.8,1.3,2.6), m.hull); body.position.y=1.15; body.castShadow=true; yaw.add(body);
  const front=new THREE.Mesh(new THREE.BoxGeometry(2.8,1.0,0.9), m.hull); front.position.set(0,1.05,1.55); front.rotation.x=-0.45; front.castShadow=true; yaw.add(front);   // sloped mantlet
  for(const sx of [-1,1]){ const sh=new THREE.Mesh(new THREE.BoxGeometry(0.18,1.4,2.4), m.hull); sh.position.set(sx*1.5,1.2,0.1); yaw.add(sh); }                          // side shields
  const id=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.05,1.0), m.lime); id.position.set(0,1.83,-0.4); yaw.add(id);                                                       // our ID panel
  const muz=[]; for(const sx of [-0.5,0.5]){ const b=new THREE.Group(); b.position.set(sx,1.25,1.7); yaw.add(b);
    const tube=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.17,4.2,12), m.steel); tube.rotation.x=Math.PI/2; tube.position.z=2.1; tube.castShadow=true; b.add(tube);
    const brake=new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.24,0.5,10), m.dark); brake.rotation.x=Math.PI/2; brake.position.z=4.15; b.add(brake);
    const tip=new THREE.Object3D(); tip.position.z=4.5; b.add(tip); muz.push({ b, tip }); }
  const ant=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.03,2.2,4), m.dark); ant.position.set(-1.1,2.6,-1.0); yaw.add(ant);
  return { root, yaw, muz }; }

export function clearCoreWalls(){ if(CORE_DEF.g){ unwave(CORE_DEF.g); scene.remove(CORE_DEF.g); CORE_DEF.g.traverse(o=>{ if(o.geometry && !o.userData.shared) o.geometry.dispose(); }); CORE_DEF.g=null; } CORE_DEF.guns.length=0; }
export function buildCoreWalls(){ clearCoreWalls(); const D=CORE_DEF, R=D.R, H=D.H, TH=D.T, name=BIOME.name, WM=wallMat(name), g=new THREE.Group(), y0=heightAt(0,0);
  g.position.set(0,y0,0); scene.add(g); D.g=g; ZONES.push({ kind:'landmark', x:0, z:0, r:R+4 });   // scatter keeps clear of our compound
  const N=8, rot=Math.PI/8, V=[]; for(let i=0;i<N;i++){ const a=rot+i/N*Math.PI*2; V.push([Math.cos(a)*R, Math.sin(a)*R]); }
  const geos=[], caps=[];
  for(let i=0;i<N;i++){ const [x0,z0]=V[i], [x1,z1]=V[(i+1)%N], L=Math.hypot(x1-x0,z1-z0), ux=(x1-x0)/L, uz=(z1-z0)/L, ry=-Math.atan2(z1-z0,x1-x0), gate=i%2===0;
    const spans = gate ? [[0, L/2-D.gateW/2], [L/2+D.gateW/2, L]] : [[0,L]];
    for(const [s0,s1] of spans){ const len=s1-s0; if(len<0.6) continue; const c=(s0+s1)/2, cx=x0+ux*c, cz=z0+uz*c;
      geos.push(at(box(len, H+1.5, TH), cx, (H+1.5)/2-0.75, cz, ry));                                                       // wall
      for(let k=0;k<Math.max(1,Math.round(len/3));k++){ const sc=s0+(k+0.5)*len/Math.max(1,Math.round(len/3)), mx=x0+ux*sc, mz=z0+uz*sc; geos.push(at(box(0.9,0.75,TH*0.9), mx, H+0.4, mz, ry)); caps.push([mx,mz,ry,len/Math.max(1,Math.round(len/3))]); }
      for(let s=s0+1.2; s<=s1-0.6; s+=2.4){ const bx=x0+ux*s, bz=z0+uz*s; blocks.push({ mesh:g, x:bx, z:bz, r:1.35, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'corewall', ours:true }); } }   // collision (enemy fire stops here, ours passes)
    if(gate){ const mx=(x0+x1)/2, mz=(z0+z1)/2;
      for(const sd of [-1,1]){ const px=mx+ux*sd*(D.gateW/2+1.1), pz=mz+uz*sd*(D.gateW/2+1.1); geos.push(at(box(2.8, H+4, 2.8), px, (H+4)/2-0.5, pz, ry));
        const rf=new THREE.Mesh(towerRoof(name, 2.8, H+3.5), capMat); rf.position.set(px,0,pz); rf.rotation.y=ry; rf.castShadow=true; g.add(rf); }
      const lintel=at(box(D.gateW+0.6, 1.0, TH*1.1), mx, H+1.0, mz, ry); geos.push(lintel); } }
  // bastions on the four corners between the gates, a guard cannon on each
  const gm=gunMats();
  for(let i=1;i<N;i+=2){ const [vx,vz]=V[i], s=6.6; geos.push(at(box(s, H+2.2, s), vx, (H+2.2)/2-0.75, vz, -rot-i/N*Math.PI*2)); geos.push(at(box(s*1.12, 0.6, s*1.12), vx, H+0.95, vz, -rot-i/N*Math.PI*2));   // bastion + its overhanging gun deck
    for(const q of [[-1,-1],[1,-1],[-1,1],[1,1]]){ const a=-rot-i/N*Math.PI*2, ca=Math.cos(a), sa=Math.sin(a), lx=q[0]*s*0.42, lz=q[1]*s*0.42; geos.push(at(box(1.0,1.0,1.0), vx+lx*ca+lz*sa, H+1.75, vz-lx*sa+lz*ca, a)); }
    blocks.push({ mesh:g, x:vx, z:vz, r:3.6, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'corewall', ours:true });
    const gun=makeGun(); gun.root.position.set(vx, H+1.25, vz); gun.root.scale.setScalar(1.4); g.add(gun.root); gun.yaw.rotation.y=Math.atan2(vx,vz);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.11,8,6), gm.steel); const ox=vx*1.1, oz=vz*1.1; pole.position.set(ox, H+5.2, oz); g.add(pole);
    const fl=makeFlag(vnTex(), 3.2, 2.1, 1); fl.position.set(ox, H+8.0, oz); g.add(fl);
    CORE_DEF.guns.push({ x:vx, z:vz, y:y0+H+1.25, ...gun, aim:Math.atan2(vx,vz), fireAt:performance.now()/1000+2+Math.random()*2, k:0, kick:0, target:null, thinkAt:0 }); }
  const wall=new THREE.Mesh(mergeGeometries(geos.map(q=>q.index?q.toNonIndexed():q), false), WM); geos.forEach(q=>q.dispose()); wall.castShadow=true; wall.receiveShadow=true; g.add(wall);
  const cg=capGeo(name, H-0.35, TH, 3); if(cg){ const im=new THREE.InstancedMesh(cg, capMat, caps.length), m=new THREE.Matrix4(), q=new THREE.Quaternion(), up=new THREE.Vector3(0,1,0), p=new THREE.Vector3(), sc=new THREE.Vector3();
    caps.forEach(([x,z,ry,l],k)=>{ m.compose(p.set(x,0,z), q.setFromAxisAngle(up,ry), sc.set(l/3,1,1)); im.setMatrixAt(k,m); }); im.userData.shared=true; im.instanceMatrix.needsUpdate=true; im.computeBoundingSphere(); im.castShadow=true; g.add(im); }
}
// the guard cannons: pick the enemy nearest the Core (inside range), swing round, fire alternate barrels
const _w=new THREE.Vector3();
export function updateCoreGuns(dt, now){ const D=CORE_DEF; if(!D.guns.length || !core || core.hp<=0) return;
  for(const G of D.guns){
    if(now>=G.thinkAt){ G.thinkAt=now+0.4; let best=null, bs=D.range;
      for(const e of enemies){ if(e.dead || e.abandoned || e.def.air) continue; const d=Math.hypot(e.pos.x-G.x, e.pos.z-G.z); if(d>D.range) continue; const s=d*0.6+Math.hypot(e.pos.x,e.pos.z)*0.4; if(s<bs){ bs=s; best=e; } }
      G.target=best; }
    const T=G.target && enemies.includes(G.target) ? G.target : null;
    const want=T ? Math.atan2(T.pos.x-G.x, T.pos.z-G.z) : G.aim, da=Math.atan2(Math.sin(want-G.aim), Math.cos(want-G.aim)); G.aim+=Math.sign(da)*Math.min(Math.abs(da), D.turn*dt); G.yaw.rotation.y=G.aim;
    G.kick=Math.max(0, G.kick-dt*3); for(const mz of G.muz) mz.b.position.z=1.7-(mz===G.muz[G.k^1]?G.kick*0.6:0);
    if(!T || S.mode!=='playing' || now<G.fireAt || Math.abs(da)>0.07) continue;
    G.fireAt=now+D.cd*(MOBILE?1.2:1)*(0.85+Math.random()*0.3); const mz=G.muz[G.k]; G.k^=1; mz.tip.getWorldPosition(_w); G.kick=1;
    const dmg=D.dmg*(1+(S.stage-1)*0.12);
    spawnBullet(_w.x, _w.z, G.aim+(Math.random()-0.5)*0.02, { owner:'p', dmg, speed:85, color:0xfff0a0, r:0.45, life:1.3, maxDist:D.range+6, noArc:true, y:_w.y, dropTo:1.2, type:'AP', fx:'blast', aoe:2.2, aoeDmg:dmg*0.55, knock:2 });
    for(let i=0;i<5;i++) spawnPart(_w.x, _w.y, _w.z, Math.sin(G.aim)*(6+Math.random()*4), 0.5+Math.random(), Math.cos(G.aim)*(6+Math.random()*4), { tex:'flash', color:0xfff0b0, size:1.1+Math.random()*0.6, life:0.08, grav:0, drag:6 });
    spawnPart(_w.x, _w.y, _w.z, Math.sin(G.aim)*2, 1, Math.cos(G.aim)*2, { color:0xd8d0c0, size:1.6, life:0.7, smoke:true, grav:0.4, drag:2, op:0.45 });
    sfx('enemyShoot', { x:G.x, z:G.z }); }
}
