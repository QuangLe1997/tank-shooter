// world/core-walls.js — Z140 OUR STRONGHOLD: the Core sits inside a walled compound built in the land's own style (regional.js) — an octagon of thick walls
//   with four gates, four bastions and on each bastion a big twin-barrelled GUARD CANNON that turns and fires on enemies that come for the Core.
//   Our walls stop enemy fire but never our own (blocks flagged ours); the guns are indestructible but slow, so the Core still needs you.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { REALCAMP, WORLD_FLAGS } from '../../config.js';
import { BIOME, MOBILE, S, ZONES, loadGLTF, bakeGroup, blocks, capGeo, capMat, core, enemies, heightAt, makeFlag, makeSoldierMesh, poseSoldier, scene, sfx, spawnBullet, spawnPart, towerRoof, unwave, vnTex, wallMat, dressCoreGun } from '../hub.js';

export const CORE_DEF = { R:24, H:9.4, T:2.8, gateW:9, range:54, cd:1.5, dmg:18, turn:2.4, guns:[], mgs:[], guards:[], g:null, mg:{ range:40, cd:0.07, burst:14, rest:0.9, dmg:4, turn:4.5 } };   // Z227 a bigger, taller citadel
function box(w,h,d){ const g=new THREE.BoxGeometry(w,h,d), uv=g.attributes.uv, p=g.attributes.position, n=g.attributes.normal;   // UVs in world metres (4 m per tile)
  for(let i=0;i<uv.count;i++){ const ax=Math.abs(n.getX(i)), ay=Math.abs(n.getY(i)); const u=ax>0.5?p.getZ(i):p.getX(i), v=ay>0.5?p.getZ(i):p.getY(i); uv.setXY(i,u/4,v/4); } return g; }
const at=(g,x,y,z,ry)=>{ g.rotateY(ry||0); g.translate(x,y,z); return g; };
// Z241 battered block (talus): the top face pulled in to dTop deep (and wTop wide)
function talus(w, h, dBot, dTop, wTop){ const g=box(w, h, dBot), p=g.attributes.position, kz=dTop/dBot, kx=(wTop||w)/w; for(let i=0;i<p.count;i++) if(p.getY(i)>0){ p.setZ(i, p.getZ(i)*kz); p.setX(i, p.getX(i)*kx); } g.computeVertexNormals(); return g; }
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

// Z227 OUR CITADEL — never mistaken for theirs: pale dressed stone, gold trim, lime ID light, our banners and emblem shields on every face;
//   one shared plan (octagon, eight towers, a grand gatehouse facing our lines, three side gates, cannon towers + automatic MG towers) built in
//   five styles by land: Huế imperial (tiled hip roofs), desert domes, northern spires, steel-and-concrete, basalt keep
const OUR_STYLE = {
  hue:  { key:'OUR_hue',  pat:'ashlar',   base:'#dcd4c2', seam:'#8e8672', rough:0.88, metal:0.02, cap:'tile',   roof:'hue',   round:false, trim:0xd8b040 },
  dome: { key:'OUR_dome', pat:'ashlar',   base:'#e8dcc0', seam:'#9c8a66', rough:0.88, metal:0.02, cap:'merlon', roof:'dome',  round:true,  trim:0xd8b040 },
  spire:{ key:'OUR_spire',pat:'ashlar',   base:'#e8ecf0', seam:'#8a96a4', rough:0.8,  metal:0.03, cap:'snow',   roof:'slate', round:true,  trim:0xd8b040 },
  steel:{ key:'OUR_steel',pat:'concrete', base:'#c4c8ca', seam:'#6e7276', rough:0.85, metal:0.05, cap:'wire',   roof:'cornice',round:false,trim:0xd8b040 },
  basalt:{ key:'OUR_bas', pat:'ashlar',   base:'#6a6460', seam:'#2a2624', rough:0.92, metal:0.02, cap:'merlon', roof:'cone',  round:true,  trim:0xe0b848 } };
const LAND_STYLE = { VILLAGE:'hue', HILLS:'hue', MEADOW:'hue', SAVANNA:'dome', DESERT:'dome', CITADEL:'dome', QUARRY:'dome', TUNDRA:'spire', ARCTIC:'spire',
  CITY:'steel', RUINS:'steel', FOUNDRY:'steel', STEELMILL:'steel', VOLCANO:'basalt', CAVERN:'basalt' };
export function ourStyle(name){ return OUR_STYLE[LAND_STYLE[name||BIOME.name]||'hue']; }
let _em=null;
function emblemTex(){ if(_em) return _em; const c=document.createElement('canvas'); c.width=c.height=256; const x=c.getContext('2d');   // our emblem: a gold star on green inside a gold ring
  x.fillStyle='#d8b040'; x.beginPath(); x.arc(128,128,124,0,7); x.fill(); x.fillStyle='#1e5a2a'; x.beginPath(); x.arc(128,128,104,0,7); x.fill();
  x.strokeStyle='#f0d070'; x.lineWidth=4; x.beginPath(); x.arc(128,128,92,0,7); x.stroke(); x.fillStyle='#f4d460'; x.beginPath();
  for(let k=0;k<10;k++){ const a=-Math.PI/2+k*Math.PI/5, r=k%2?30:72; x.lineTo(128+Math.cos(a)*r, 128+Math.sin(a)*r); } x.closePath(); x.fill();
  _em=new THREE.CanvasTexture(c); _em.colorSpace=THREE.SRGBColorSpace; _em.anisotropy=4; return _em; }
const _om={};
function ourMats(st){ if(!_om.gold){ _om.gold=new THREE.MeshStandardMaterial({ color:0xd8b040, roughness:0.3, metalness:0.95, envMapIntensity:1.3 });
    _om.lime=new THREE.MeshStandardMaterial({ color:0x1a3a10, emissive:0x8aff4a, emissiveIntensity:2.2 }); _om.emblem=new THREE.MeshStandardMaterial({ map:emblemTex(), roughness:0.4, metalness:0.5 });
    _om.lamp=new THREE.MeshStandardMaterial({ color:0x302010, emissive:0xffd890, emissiveIntensity:2.6 }); }
  return _om; }
// Z241 does the sight line (lx,ly,lz)→(hx,hy,hz) pass below the top of our walls where it crosses their ring? (the camera rises over them)
export function coreBeamBlocked(lx, ly, lz, hx, hy, hz){ if(!CORE_DEF.g) return false; const R=CORE_DEF.R, top=CORE_DEF.g.position.y+CORE_DEF.H+1.2;
  const dx=hx-lx, dz=hz-lz, a=dx*dx+dz*dz; if(a<1e-6) return false; const b=2*(lx*dx+lz*dz), c=lx*lx+lz*lz-R*R, disc=b*b-4*a*c; if(disc<0) return false;
  const q=Math.sqrt(disc); for(const t of [(-b-q)/(2*a), (-b+q)/(2*a)]) if(t>0.02 && t<0.98 && ly+(hy-ly)*t < top) return true;
  return false; }
export function clearCoreWalls(){ if(CORE_DEF.g){ unwave(CORE_DEF.g); scene.remove(CORE_DEF.g); CORE_DEF.g.traverse(o=>{ if(o.geometry && !o.userData.shared) o.geometry.dispose(); }); CORE_DEF.g=null; } CORE_DEF.guns.length=0; CORE_DEF.mgs.length=0; CORE_DEF.guards.length=0; }
export function buildCoreWalls(){ clearCoreWalls(); const D=CORE_DEF, R=D.R, H=D.H, TH=D.T, ST=ourStyle(BIOME.name), WM=wallMat(ST), OM=ourMats(ST), g=new THREE.Group(), y0=heightAt(0,0);
  g.position.set(0,y0,0); scene.add(g); D.g=g; ZONES.push({ kind:'landmark', x:0, z:0, r:R+5 });   // scatter keeps clear of our compound
  const N=8, rot=Math.PI/8, V=[]; for(let i=0;i<N;i++){ const a=rot+i/N*Math.PI*2; V.push([Math.cos(a)*R, Math.sin(a)*R]); }
  const geos=[], caps=[], gold=[], lime=[], gm=gunMats(), MAIN=1, WSP=[], TWR=[];   // Z273 the spans and towers, for the concrete compound   // side 1 faces +z: our lines → the grand gatehouse
  const tower=(x,z,s,h,ry,deck)=>{ TWR.push([x,z,h,ry||0]); if(ST.round){ geos.push(at(new THREE.CylinderGeometry(s*0.62+0.2, s*0.62+1.3, 3.6, 16), x, 1.05, z)); gold.push(at(new THREE.CylinderGeometry(s*0.6+0.1, s*0.6+0.1, 0.2, 16), x, h*0.5, z)); }   // Z241 battered foot · gilt mid course
      else { geos.push(at(talus(s+2.4, 3.6, s+2.4, s+0.25, s+0.25), x, 1.05, z, ry)); gold.push(at(new THREE.BoxGeometry(s+0.14, 0.2, s+0.14), x, h*0.5, z, ry)); }
      if(ST.round){ const c=new THREE.CylinderGeometry(s*0.55,s*0.62,h,16); c.translate(x,h/2-0.75,z); geos.push(c); gold.push(at(new THREE.CylinderGeometry(s*0.6,s*0.6,0.28,16), x, h-0.9, z)); }
      else { geos.push(at(box(s,h,s), x, h/2-0.75, z, ry)); gold.push(at(new THREE.BoxGeometry(s*1.06,0.28,s*1.06), x, h-0.9, z, ry)); }
      if(deck){ for(let k=0;k<8;k++){ const a=(ry||0)+k/8*Math.PI*2, r=s*(ST.round?0.52:0.47); geos.push(at(box(1.1,1.0,0.7), x+Math.sin(a)*r, h-0.3, z+Math.cos(a)*r, a)); } return; }   // an open gun deck behind merlons
      const rf=new THREE.Mesh(towerRoof(ST, s, h-0.75), capMat); rf.position.set(x,0,z); rf.rotation.y=ry||0; rf.castShadow=true; g.add(rf); };
  for(let i=0;i<N;i++){ const [x0,z0]=V[i], [x1,z1]=V[(i+1)%N], L=Math.hypot(x1-x0,z1-z0), ux=(x1-x0)/L, uz=(z1-z0)/L, ry=-Math.atan2(z1-z0,x1-x0), gate=i%2===1, main=i===MAIN, gw=main?D.gateW+2:D.gateW;
    const nx=-uz, nz=ux, out=(nx*(x0+x1)+nz*(z0+z1))>0?1:-1;   // outward normal sign
    const spans = gate ? [[0, L/2-gw/2], [L/2+gw/2, L]] : [[0,L]];
    for(const [s0,s1] of spans){ const len=s1-s0; if(len<0.6) continue; const c=(s0+s1)/2, cx=x0+ux*c, cz=z0+uz*c; WSP.push([cx,cz,len,ry]);
      geos.push(at(box(len, H+1.5, TH), cx, (H+1.5)/2-0.75, cz, ry));                                                       // wall
      geos.push(at(talus(len, 3.4, TH+2.6, TH+0.2), cx, 0.95, cz, ry));                                                     // Z241 battered talus
      gold.push(at(new THREE.BoxGeometry(len, 0.18, TH+0.1), cx, H*0.45, cz, ry));                                            // Z241 second gilt course
      { const nP=Math.max(1, Math.round(len/3.2)); for(let k=0;k<nP;k++){ const sc=s0+(k+0.5)*len/nP, px=x0+ux*sc+nx*out*(TH/2+0.3), pz=z0+uz*sc+nz*out*(TH/2+0.3);   // Z241 pilasters + stepped corbels on the outer face
          geos.push(at(box(0.85, H-3.6, 0.6), px, 2.9+(H-3.6)/2-0.75, pz, ry), at(box(0.55, 0.5, 0.95), px+nx*out*0.15, H-1.3, pz+nz*out*0.15, ry), at(box(0.55, 0.4, 0.6), px+nx*out*0.32, H-0.85, pz+nz*out*0.32, ry)); } }
      gold.push(at(new THREE.BoxGeometry(len, 0.22, TH+0.12), cx, H-0.35, cz, ry));                                           // gilt string course
      lime.push(at(new THREE.BoxGeometry(len*0.96, 0.1, 0.08), cx-nx*out*(TH/2+0.05), H-0.9, cz-nz*out*(TH/2+0.05), ry));       // ID light strip on the inner face
      for(let k=0;k<Math.max(1,Math.round(len/3));k++){ const sc=s0+(k+0.5)*len/Math.max(1,Math.round(len/3)), mx=x0+ux*sc, mz=z0+uz*sc; geos.push(at(box(0.9,0.75,TH*0.9), mx, H+0.4, mz, ry)); caps.push([mx,mz,ry,len/Math.max(1,Math.round(len/3))]); }
      for(let s=s0+1.2; s<=s1-0.6; s+=2.4){ const bx=x0+ux*s, bz=z0+uz*s; blocks.push({ mesh:g, x:bx, z:bz, r:1.35, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'corewall', ours:true }); } }   // collision (enemy fire stops here, ours passes)
    if(!gate){ const mx=(x0+x1)/2, mz=(z0+z1)/2; tower(mx, mz, 3.8, H+5.5, ry);   // a roofed watch pavilion over the middle of every curtain wall: the land's own style
      const em=new THREE.Mesh(new THREE.CircleGeometry(1.5,32), OM.emblem); const off=(ST.round?2.15:1.75)+0.06; em.position.set(mx+nx*out*off, H*0.55, mz+nz*out*off); em.rotation.y=Math.atan2(nx*out, nz*out); g.add(em); }   // our emblem on every curtain wall
    if(gate){ const mx=(x0+x1)/2, mz=(z0+z1)/2, th=main?H+9:H+7, ts=main?5.6:3.6;   // Z281 the main gatehouse no longer towers over the whole compound   // Z241 a towering main gatehouse
      for(const sd of [-1,1]){ const px=mx+ux*sd*(gw/2+ts*0.5), pz=mz+uz*sd*(gw/2+ts*0.5); tower(px, pz, ts, th, ry);
        if(main){ const lm=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.9,0.5), OM.lamp); lm.position.set(px+nx*out*(ts*0.55), H+0.5, pz+nz*out*(ts*0.55)); g.add(lm);
          const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.12,7,6), gm.steel); pole.position.set(px, th+2.6, pz); if(WORLD_FLAGS.on) g.add(pole); const fl=makeFlag(vnTex(), 4.2, 2.7, 1); fl.position.set(px, th+5, pz); g.add(fl); } }
      geos.push(at(box(gw+0.8, main?2.2:1.0, TH*1.2), mx, (main?H+2.0:H+1.0), mz, ry)); gold.push(at(new THREE.BoxGeometry(gw+1.0, 0.25, TH*1.3), mx, main?H+0.8:H+0.4, mz, ry));
      if(main){ const em=new THREE.Mesh(new THREE.CircleGeometry(1.9,40), OM.emblem); em.position.set(mx+nx*out*(TH*0.6+0.08), H+2.0, mz+nz*out*(TH*0.6+0.08)); em.rotation.y=Math.atan2(nx*out, nz*out); g.add(em); } } }
  // eight towers on the corners: cannon towers and automatic MG towers in turn
  for(let i=0;i<N;i++){ const [vx,vz]=V[i], s=7.0, a=-rot-i/N*Math.PI*2; tower(vx, vz, s, H+3.4, a, true);
    blocks.push({ mesh:g, x:vx, z:vz, r:3.8, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'corewall', ours:true });
    for(let k=0;k<4;k++){ const la=a+k*Math.PI/2+Math.PI/4, lm=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,0.3), OM.lime); lm.position.set(vx+Math.sin(la)*s*0.5, H+2.2, vz+Math.cos(la)*s*0.5); g.add(lm); }
    const deckY=H+2.65;
    if(i%2===0){ const gun=makeGun(); gun.root.position.set(vx, deckY, vz); gun.root.scale.setScalar(1.4); g.add(gun.root); gun.yaw.rotation.y=Math.atan2(vx,vz); dressCoreGun(gun, 'gun');   // Z424 the real gun turret
      CORE_DEF.guns.push({ x:vx, z:vz, y:y0+deckY, ...gun, aim:Math.atan2(vx,vz), fireAt:performance.now()/1000+2+Math.random()*2, k:0, kick:0, target:null, thinkAt:0 }); }
    else { const mg=makeMG(); mg.root.position.set(vx, deckY, vz); mg.root.scale.setScalar(1.25); g.add(mg.root); dressCoreGun(mg, 'mg');   // Z424 the real weapon station
      CORE_DEF.mgs.push({ x:vx, z:vz, y:y0+deckY+1.5, ...mg, aim:Math.atan2(vx,vz), fireAt:0, burst:0, target:null, thinkAt:0, spin:0 }); }
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.11,8,6), gm.steel), ox=vx*1.06, oz=vz*1.06; pole.position.set(ox, H+7, oz); if(WORLD_FLAGS.on) g.add(pole);
    const fl=makeFlag(vnTex(), 3.2, 2.1, 1); fl.position.set(ox, H+9.8, oz); g.add(fl); }
  const wall=new THREE.Mesh(mergeGeometries(geos.map(q=>q.index?q.toNonIndexed():q), false), WM); geos.forEach(q=>q.dispose()); wall.castShadow=true; wall.receiveShadow=true; g.add(wall);
  const gw=new THREE.Mesh(mergeGeometries(gold.map(q=>q.index?q.toNonIndexed():q), false), OM.gold); gold.forEach(q=>q.dispose()); gw.castShadow=true; g.add(gw);
  const lw=new THREE.Mesh(mergeGeometries(lime.map(q=>q.index?q.toNonIndexed():q), false), OM.lime); lime.forEach(q=>q.dispose()); g.add(lw);
  const cg=capGeo(ST, H-0.35, TH, 3); if(cg){ const im=new THREE.InstancedMesh(cg, capMat, caps.length), m=new THREE.Matrix4(), q=new THREE.Quaternion(), up=new THREE.Vector3(0,1,0), p=new THREE.Vector3(), sc=new THREE.Vector3();
    caps.forEach(([x,z,ry,l],k)=>{ m.compose(p.set(x,0,z), q.setFromAxisAngle(up,ry), sc.set(l/3,1,1)); im.setMatrixAt(k,m); }); im.userData.shared=true; im.instanceMatrix.needsUpdate=true; im.computeBoundingSphere(); im.castShadow=true; g.add(im); }
  // the honour guard: two men at the foot of each stair of the Core's podium, at attention, facing out
  for(let k=0;k<4;k++){ const a=k*Math.PI/2; for(const sd of [-1,1]){ const r=Math.max(10.2, REALCAMP.hq.w/2+1.8), x=Math.sin(a)*r+Math.cos(a)*sd*2.3, z=Math.cos(a)*r-Math.sin(a)*sd*2.3, s=makeSoldierMesh({ enemy:false });
      s.position.set(x, heightAt(x,z), z); s.rotation.y=a; s.scale.setScalar(1.26); g.add(s); poseSoldier(s, 'stand', 1); s.userData.upAdd=-0.05; CORE_DEF.guards.push({ s, a, ph:Math.random()*9 }); } }
  bakeGroup(g);   // Z233 roofs, poles, emblems… that share a material become one draw (flags, guns, guards are their own objects and stay)
  dressWalls(g, WSP, TWR, new Set([WM, OM.gold, OM.lime, OM.emblem, OM.lamp, capMat])); }
// Z273 THE COMPOUND IN CONCRETE: once the Tripo pieces are in, every wall becomes a reinforced-concrete blast-wall section (sandbags and razor wire
//   along the top) and every tower a concrete guard tower with its armoured cabin; the guns, MG nests, flags and poles, guards and the collision
//   stay as they were — only the castle's walls, gilt courses, light strips, emblems and roofs are put away
function dressWalls(g, spans, towers, hideMats){ if(typeof window==='undefined' || /procbase/.test(location.search+location.hash)) return;
  Promise.all([loadGLTF('base_wall'), loadGLTF('base_tower')]).then(([wg, tg])=>{ if(!wg || !tg || CORE_DEF.g!==g) return;
    const piece=gl=>{ let src=null; gl.scene.updateMatrixWorld(true); gl.scene.traverse(o=>{ if(o.isMesh && !src) src=o; }); const geo=src.geometry.clone().applyMatrix4(src.matrixWorld); geo.computeBoundingBox(); const b=geo.boundingBox;
      geo.translate(-(b.min.x+b.max.x)/2, -b.min.y, -(b.min.z+b.max.z)/2); if(b.max.z-b.min.z > b.max.x-b.min.x) geo.rotateY(Math.PI/2); geo.computeBoundingBox(); return { geo, mat:src.material.clone(), size:geo.boundingBox.getSize(new THREE.Vector3()) }; };
    const W=piece(wg), T=piece(tg), C=REALCAMP.walls, k=(CORE_DEF.H+C.wallUp)/W.size.y, M4=new THREE.Matrix4(), Q=new THREE.Quaternion(), P=new THREE.Vector3(), Sc=new THREE.Vector3(), up=new THREE.Vector3(0,1,0), wl=[];
    g.traverse(o=>{ if(o.isMesh && hideMats.has(o.material)) o.visible=false; });
    // Z281 every run shows the wall at its own proportions: each piece draws the whole section shifted (aOff) and cuts away what lies outside its own
    //   length (aHalf) — a short run beside a gate is a true stretch of wall, not the whole wall squeezed into it
    const segL=W.size.x*k; for(const [cx,cz,len,ry] of spans){ const n=Math.max(1, Math.round(len/segL)), l=len/n, ux=Math.cos(ry), uz=-Math.sin(ry);
      for(let i=0;i<n;i++){ const s=-len/2+(i+0.5)*l; wl.push([cx+ux*s, cz+uz*s, ry, l, (Math.random()-0.5)*Math.max(0, segL-l)]); } }
    const wg2=W.geo.clone(); wg2.setAttribute('aOff', new THREE.InstancedBufferAttribute(new Float32Array(wl.map(q=>q[4]/k)), 1)); wg2.setAttribute('aHalf', new THREE.InstancedBufferAttribute(new Float32Array(wl.map(q=>q[3]/2/k)), 1));
    const clip=m=>{ m.onBeforeCompile=sh=>{ sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aOff; attribute float aHalf; varying float vLx; varying float vHalf;').replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.x -= aOff; vLx = transformed.x; vHalf = aHalf;');
        sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vLx; varying float vHalf;').replace('void main() {','void main() {\n if(abs(vLx) > vHalf + 0.01) discard;'); }; m.customProgramCacheKey=()=>'coreClip'; return m; };
    const wi=new THREE.InstancedMesh(wg2, clip(W.mat.clone()), wl.length); wi.customDepthMaterial=clip(new THREE.MeshDepthMaterial({ depthPacking:THREE.RGBADepthPacking })); wi.frustumCulled=false;
    wl.forEach(([x,z,ry],i)=>{ M4.compose(P.set(x,C.sink,z), Q.setFromAxisAngle(up,ry), Sc.set(k,k,k*C.thick)); wi.setMatrixAt(i,M4); });
    const ti=new THREE.InstancedMesh(T.geo, T.mat, towers.length); towers.forEach(([x,z,h,ry],i)=>{ const kt=(h+C.towerUp)/T.size.y; M4.compose(P.set(x,C.sink,z), Q.setFromAxisAngle(up,ry), Sc.set(kt*C.towerW,kt,kt*C.towerW)); ti.setMatrixAt(i,M4); });
    for(const im of [wi,ti]){ im.castShadow=true; im.receiveShadow=true; im.instanceMatrix.needsUpdate=true; im.computeBoundingSphere(); g.add(im); } }); }
// Z227 automatic MG tower: a six-barrel rotary gun on an armoured mount, ammo box, a little search radar spinning on a mast
function makeMG(){ const m=gunMats(), root=new THREE.Group(), yaw=new THREE.Group(); root.add(yaw);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.4,0.6,16), m.dark); base.position.y=0.3; root.add(base);
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.2,1.8), m.hull); body.position.y=1.2; body.castShadow=true; yaw.add(body);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(0.62,16,10,0,Math.PI*2,0,Math.PI/2), new THREE.MeshStandardMaterial({ color:0xe8e8e0, roughness:0.5 })); dome.position.set(0,1.8,-0.4); yaw.add(dome);
  const box=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.6,0.9), m.dark); box.position.set(0.95,1.05,0); yaw.add(box);
  const barrels=new THREE.Group(); barrels.position.set(0,1.25,1.0); yaw.add(barrels);
  for(let k=0;k<6;k++){ const a=k/6*Math.PI*2, b=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,2.2,6), m.steel); b.rotation.x=Math.PI/2; b.position.set(Math.cos(a)*0.16, Math.sin(a)*0.16, 1.1); barrels.add(b); }
  const ring=new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.24,0.25,10), m.dark); ring.rotation.x=Math.PI/2; ring.position.z=2.1; barrels.add(ring);
  const tip=new THREE.Object3D(); tip.position.z=2.3; barrels.add(tip);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,1.4,6), m.steel); mast.position.set(-0.6,2.3,-0.6); yaw.add(mast);
  const radar=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.35,0.06), m.steel); radar.position.set(-0.6,3.0,-0.6); yaw.add(radar);
  const id=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.05,0.6), m.lime); id.position.set(0,1.82,0.4); yaw.add(id);
  return { root, yaw, barrels, tip, radar }; }
// the guard cannons: pick the enemy nearest the Core (inside range), swing round, fire alternate barrels
const _w=new THREE.Vector3();
export function updateCoreGuns(dt, now){ const D=CORE_DEF; updateCoreMG(dt, now); if(!D.guns.length || !core || core.hp<=0) return;
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

// Z227 the automatic MG towers: lock the nearest enemy (infantry and low helicopters too), spin up, hose it in long bursts; the radar never stops
const _m=new THREE.Vector3();
function updateCoreMG(dt, now){ const D=CORE_DEF, C=D.mg;
  for(const q of D.guards){ q.s.rotation.y=q.a+Math.sin(now*0.3+q.ph)*0.12; poseSoldier(q.s, 'stand', dt); }   // the honour guard: still, eyes moving
  if(!D.mgs.length || !core || core.hp<=0) return;
  for(const G of D.mgs){ G.radar.rotation.y+=dt*3; G.spin=Math.max(0, G.spin-dt*1.5);
    if(now>=G.thinkAt){ G.thinkAt=now+0.3; let best=null, bs=C.range; for(const e of enemies){ if(e.dead || e.abandoned || e.hp<=0) continue; const d=Math.hypot(e.pos.x-G.x, e.pos.z-G.z); if(d<bs){ bs=d; best=e; } } G.target=best; }
    const T=G.target && enemies.includes(G.target) ? G.target : null, want=T ? Math.atan2(T.pos.x-G.x, T.pos.z-G.z) : G.aim+dt*0.25, da=Math.atan2(Math.sin(want-G.aim), Math.cos(want-G.aim));
    G.aim+=Math.sign(da)*Math.min(Math.abs(da), C.turn*dt); G.yaw.rotation.y=G.aim; G.barrels.rotation.z+=dt*G.spin*40;
    if(!T || S.mode!=='playing' || now<G.fireAt || Math.abs(da)>0.12) continue; G.spin=1;
    if(G.burst<C.burst){ G.burst++; G.fireAt=now+C.cd; G.tip.getWorldPosition(_m); const air=!!T.def.air;
      spawnBullet(_m.x, _m.z, G.aim+(Math.random()-0.5)*0.05, { owner:'p', dmg:C.dmg*(1+(S.stage-1)*0.1), speed:95, color:0xb8ff70, r:0.2, life:0.6, maxDist:C.range+4, noArc:true, y:_m.y, dropTo:air?6:1.0, inf:true, air });
      spawnPart(_m.x, _m.y, _m.z, 0, 0, 0, { tex:'flash', color:0xfff0a0, size:0.9, life:0.04, grav:0, drag:6 });
      if(G.burst%2===0) spawnPart(G.x+Math.cos(G.aim)*0.8, _m.y-0.3, G.z-Math.sin(G.aim)*0.8, Math.cos(G.aim)*2.5, 2, -Math.sin(G.aim)*2.5, { color:0xe0ac44, size:0.07, life:0.5, grav:-22, drag:0.5 });   // brass
      if(G.burst%4===0) sfx('mg', { x:G.x, z:G.z }); }
    else { G.burst=0; G.fireAt=now+C.rest; } } }
