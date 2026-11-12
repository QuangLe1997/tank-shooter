// world/city.js — Z142 A REAL CITY DISTRICT: a street grid (asphalt, lane marks, zebra crossings, kerbed sidewalks), every block filled its own way —
//   rows of narrow Vietnamese tube houses (nhà ống: colourful fronts, balconies, shop signs, rooftop water tanks) with alleys (ngõ) between them,
//   apartment blocks, glass office towers, French-shuttered villas, small parks. Cars and rows of motorbikes parked along the kerb, street lamps,
//   traffic lights, sagging power lines. Facades are merged per material (a handful of draw calls); towers stay single so a shelled one can collapse.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARENA, LAND, MOBILE, ZONES, _R, _mergeColored, arena, blocks, crushables, floraMat, heightAt, inField, inZone, treeBroadleaf } from '../hub.js';

const G=34, ROAD=8, WALK=2.4;            // grid pitch · carriageway · sidewalk
const SIGNS=['TẠP HOÁ','PHỞ BÒ','CÀ PHÊ','SỬA XE','BÁNH MÌ','NHÀ THUỐC','KARAOKE','NHÀ NGHỈ','ĐIỆN THOẠI','BÚN CHẢ','VÀNG BẠC','GẠO'];
const WALLC=['#e8c86a','#e89a9a','#9fd0b8','#a8c4e8','#f0ece0','#e8b07a','#c8b8e0','#d8e09a'];
// ---------- textures (canvas, cached) ----------
const _tx={};
function tex(key, w, h, paint){ if(_tx[key]) return _tx[key]; const c=document.createElement('canvas'), e=document.createElement('canvas'); c.width=e.width=w; c.height=e.height=h;
  const x=c.getContext('2d'), y=e.getContext('2d'); y.fillStyle='#000'; y.fillRect(0,0,w,h); paint(x, y, w, h);
  const t=new THREE.CanvasTexture(c), em=new THREE.CanvasTexture(e); for(const q of [t,em]){ q.wrapS=q.wrapT=THREE.RepeatWrapping; q.colorSpace=THREE.SRGBColorSpace; q.anisotropy=4; }
  return (_tx[key]={ t, em }); }
const lit=(y,px,py,w,h)=>{ if(Math.random()<0.35){ y.fillStyle='#ffd890'; y.fillRect(px,py,w,h); return true; } return false; };
const tubeFloor=(col)=>tex('tube'+col,128,128,(x,y)=>{ x.fillStyle=col; x.fillRect(0,0,128,128); x.fillStyle='rgba(0,0,0,0.08)'; x.fillRect(0,0,128,6);
  const l=lit(y,22,22,84,70); x.fillStyle=l?'#e8c27a':'#2e3e4c'; x.fillRect(22,22,84,70); x.fillStyle='#f2f2ee'; x.fillRect(20,20,88,4); x.fillRect(20,20,4,74); x.fillRect(104,20,4,74); x.fillRect(62,22,4,70);   // big glass door + frame
  x.fillStyle='rgba(255,255,255,0.15)'; x.fillRect(26,26,30,8); x.fillStyle='#3a3a3a'; for(let k=0;k<9;k++) x.fillRect(16+k*12,92,3,26); x.fillRect(12,92,104,4); x.fillRect(12,116,104,3);   // balcony railing
  if(Math.random()<0.5){ x.fillStyle='#5a8a3a'; for(let k=0;k<4;k++){ x.beginPath(); x.arc(24+k*26,100,7,0,7); x.fill(); } } });   // potted plants
const tubeShop=(col,sign)=>tex('shop'+col+sign,128,128,(x,y)=>{ x.fillStyle=col; x.fillRect(0,0,128,128);
  const sc=['#c8282a','#2a6ac8','#1a8a4a','#e8a41a'][(sign.length)%4]; x.fillStyle=sc; x.fillRect(4,6,120,26); y.fillStyle='#806040'; y.fillRect(4,6,120,26);
  x.fillStyle='#fff'; x.font='bold 17px Arial, sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(sign,64,19);
  x.fillStyle=Math.random()<0.5?'#3a3a3a':'#6a6a68'; x.fillRect(8,38,112,90); if(Math.random()<0.6){ x.fillStyle='#8a8a86'; for(let k=0;k<22;k++) x.fillRect(8,38+k*4,112,1.5); } else { x.fillStyle='#d8c08a'; x.fillRect(14,44,100,84); y.fillStyle='#ffcc80'; y.fillRect(14,44,100,84); } });   // shutter or a lit shop
const apart=(col)=>tex('ap'+col,128,128,(x,y)=>{ x.fillStyle=col; x.fillRect(0,0,128,128);
  for(const px of [10,70]){ const l=lit(y,px,18,48,58); x.fillStyle=l?'#e8c27a':'#334452'; x.fillRect(px,18,48,58); x.fillStyle='#e8e8e2'; x.fillRect(px-2,16,52,3); x.fillRect(px+22,18,3,58);
    if(Math.random()<0.6){ x.fillStyle=['#c84a4a','#4a7ac8','#e8e0a0','#fff'][(Math.random()*4)|0]; for(let k=0;k<4;k++) x.fillRect(px+4+k*11,82,6,12); } }   // laundry
  x.fillStyle='#b8b4ac'; x.fillRect(0,96,128,10); x.fillStyle='#4a4a48'; for(let k=0;k<16;k++) x.fillRect(k*8,106,2,22); x.fillRect(0,106,128,3);
  if(Math.random()<0.5){ x.fillStyle='#d8d8d0'; x.fillRect(100,60,22,16); } });   // AC unit
const office=(k)=>tex('of'+k,128,128,(x,y)=>{ const base=k?'#5a7a8e':'#3e5e6e'; x.fillStyle=base; x.fillRect(0,0,128,128);
  for(let r=0;r<4;r++) for(let c=0;c<4;c++){ const g=x.createLinearGradient(0,r*32,0,r*32+30); g.addColorStop(0,k?'#8ab4cc':'#6aa0b8'); g.addColorStop(1,base); x.fillStyle=g; x.fillRect(c*32+2,r*32+2,28,28); lit(y,c*32+2,r*32+2,28,28); }
  x.fillStyle='#c8d0d4'; for(let i=0;i<=4;i++){ x.fillRect(i*32-1,0,2,128); x.fillRect(0,i*32-1,128,2); } });
const villa=()=>tex('vl',128,128,(x,y)=>{ x.fillStyle='#f0e4c4'; x.fillRect(0,0,128,128); for(const px of [18,74]){ lit(y,px,30,36,54); x.fillStyle='#2e3e4a'; x.fillRect(px,30,36,54); x.fillStyle='#3a7a4a'; x.fillRect(px-12,30,11,54); x.fillRect(px+37,30,11,54); x.fillStyle='#2a5a36'; for(let k=0;k<9;k++){ x.fillRect(px-12,32+k*6,11,1.5); x.fillRect(px+37,32+k*6,11,1.5); } }   // French shutters
  x.fillStyle='#d8c8a0'; x.fillRect(0,0,128,8); x.fillRect(0,120,128,8); });
const roadT=()=>tex('road',256,64,(x)=>{ x.fillStyle='#3a3c40'; x.fillRect(0,0,256,64); for(let n=0;n<700;n++){ x.fillStyle='rgba('+(Math.random()<0.5?255:0)+','+(Math.random()<0.5?255:0)+',255,0.04)'; x.fillRect(Math.random()*256,Math.random()*64,2,2); }
  x.fillStyle='#e8e4d0'; x.fillRect(0,3,256,2); x.fillRect(0,59,256,2); x.fillStyle='#e8c040'; for(let k=0;k<4;k++) x.fillRect(k*64+8,31,36,2.5);   // edge lines + dashed centre
  x.fillStyle='rgba(20,20,20,0.35)'; for(let n=0;n<6;n++){ x.beginPath(); x.ellipse(Math.random()*256,10+Math.random()*44,8+Math.random()*16,3+Math.random()*5,0,0,7); x.fill(); } });   // oil stains
const walkT=()=>tex('walk',64,64,(x)=>{ x.fillStyle='#a8a49a'; x.fillRect(0,0,64,64); for(let r=0;r<4;r++) for(let c=0;c<4;c++){ x.fillStyle=(r+c)%2?'#b4b0a4':'#9c988e'; x.fillRect(c*16+1,r*16+1,14,14); } });
const zebraT=()=>tex('zebra',64,64,(x)=>{ x.fillStyle='#3a3c40'; x.fillRect(0,0,64,64); x.fillStyle='#e8e8e0'; for(let k=0;k<5;k++) x.fillRect(k*13+2,4,7,56); });
const parkT=()=>tex('park',64,64,(x)=>{ x.fillStyle='#5a8a3a'; x.fillRect(0,0,64,64); for(let n=0;n<300;n++){ x.fillStyle=Math.random()<0.5?'#6a9a44':'#4e7a32'; x.fillRect(Math.random()*64,Math.random()*64,2,2); } });
// ---------- buckets: geometry merged per material ----------
let B=null; function bucket(key, makeMat){ let b=B.get(key); if(!b){ b={ mat:makeMat(), geos:[] }; B.set(key,b); } return b; }
const facadeMat=(T,metal)=>()=>{ const m=new THREE.MeshStandardMaterial({ map:T.t, emissiveMap:T.em, emissive:0xffffff, emissiveIntensity:0, roughness:metal?0.25:0.85, metalness:metal?0.6:0.04, envMapIntensity:metal?1.4:0.6 }); LAND.mats.push(m); return m; };
function boxUV(w,h,d,tw,th){ const g=new THREE.BoxGeometry(w,h,d), uv=g.attributes.uv, sc=[[d,h],[d,h],[1,1],[1,1],[w,h],[w,h]];
  for(let f=0;f<6;f++) for(let v=0;v<4;v++){ const i=f*4+v; uv.setXY(i, uv.getX(i)*Math.max(1,Math.round(sc[f][0]/tw)), uv.getY(i)*Math.max(1,Math.round(sc[f][1]/th))); } return g; }
const place=(g,x,y,z,ry)=>{ g.rotateY(ry); g.translate(x,y,z); return g; };
let P=null;   // vertex-coloured details (roof tanks, parapets, balconies, awnings, kerbs, poles…) → one mesh
const det=(geo,x,y,z,ry,col)=>{ geo.rotateY(ry||0); geo.translate(x,y,z); P.push({ geo, col }); };
// a box in a building's local frame (front = +z) → world
function local(bx,by,bz, w,h,d, ox,oz,ry,col){ const c=Math.cos(ry), s=Math.sin(ry), x=ox+bx*c+bz*s, z=oz-bx*s+bz*c; det(new THREE.BoxGeometry(w,h,d), x, by, z, ry, col); }
const solid=(x,z,r,kind,land)=>blocks.push({ mesh:LAND.dummy||(LAND.dummy=new THREE.Object3D()), x, z, r, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind, land:land||null });
function footprint(ox,oz,ry,w,d,land){ const c=Math.cos(ry), s=Math.sin(ry); for(let a=-w/2+1.5;a<=w/2-1.0;a+=2.8) for(let b=-d/2+1.5;b<=d/2-1.0;b+=2.8) solid(ox+a*c+b*s, oz-a*s+b*c, 2.0, 'building', land); }
// ---------- building kinds (front faces +z in local frame; ox,oz = footprint centre; ry = rotation) ----------
function tubeHouse(ox,oz,ry,w,d){ const floors=2+((Math.random()*4)|0), col=WALLC[(Math.random()*WALLC.length)|0], y0=heightAt(ox,oz)-0.05, FH=3.2, H=3.6+floors*FH;
  const shop=tubeShop(col, SIGNS[(Math.random()*SIGNS.length)|0]); bucket('shop'+col+shop.t.uuid, facadeMat(shop)).geos.push(place(boxUV(w,3.6,d,w,3.6), ox, y0+1.8, oz, ry));
  const up=tubeFloor(col); bucket('tube'+col, facadeMat(up)).geos.push(place(boxUV(w,floors*FH,d,w,FH), ox, y0+3.6+floors*FH/2, oz, ry));
  for(let f=0;f<floors;f++) local(0, y0+3.6+f*FH+0.05, d/2+0.35, w-0.2, 0.14, 0.7, ox,oz,ry, 0xd8d4c8);                    // balcony slabs
  local(0, y0+3.75, d/2+0.6, w, 0.08, 1.4, ox,oz,ry, [0x2a7ac8,0xc83a2a,0x2a9a5a,0xe8a41a][(Math.random()*4)|0]);           // shop awning
  local(0, y0+H+0.35, 0, w+0.1, 0.7, d+0.1, ox,oz,ry, 0xb8b4aa);                                                            // parapet
  if(Math.random()<0.8){ const t=new THREE.CylinderGeometry(0.55,0.55,1.3,10); t.rotateZ(Math.PI/2); const c=Math.cos(ry), s=Math.sin(ry), bx=_R(-w/4,w/4), bz=-d/4; det(t, ox+bx*c+bz*s, y0+H+1.4, oz-bx*s+bz*c, ry, 0xd8dcde);   // inox water tank
    local(bx, y0+H+0.8, bz, 0.9, 0.4, 0.4, ox,oz,ry, 0x6a6c6e); }
  if(Math.random()<0.4) local(_R(-w/4,w/4), y0+H+1.0, d/4, 1.6, 1.6, 1.6, ox,oz,ry, 0xc8c4b8);                                // stair hut
  footprint(ox,oz,ry,w,d); return H; }
function apartment(ox,oz,ry,w,d){ const floors=5+((Math.random()*5)|0), col=['#d8d0c0','#c8d4dc','#e0c8a8'][(Math.random()*3)|0], y0=heightAt(ox,oz)-0.05, FH=3.2, H=floors*FH;
  const T=apart(col); bucket('ap'+col, facadeMat(T)).geos.push(place(boxUV(w,H,d,4,FH), ox, y0+H/2, oz, ry));
  local(0, y0+H+0.3, 0, w+0.2, 0.6, d+0.2, ox,oz,ry, 0x9a968e); for(let k=0;k<3;k++) local(_R(-w/3,w/3), y0+H+1.0, _R(-d/4,d/4), 1.4, 1.0, 1.2, ox,oz,ry, 0xc8ccd0);
  footprint(ox,oz,ry,w,d); return H; }
function officeTower(ox,oz,ry,w,d){ const floors=9+((Math.random()*9)|0), FH=3.4, H=floors*FH, y0=heightAt(ox,oz)-0.05, T=office((Math.random()*2)|0);
  const m=new THREE.Mesh(boxUV(w,H,d,8,FH*4), facadeMat(T,true)()); m.position.set(ox,y0+H/2,oz); m.rotation.y=ry; m.castShadow=true; m.receiveShadow=true; arena.add(m); LAND.meshes.push(m); m.userData.land=true; m.userData.h=H;
  if(Math.random()<0.5){ const top=new THREE.Mesh(boxUV(w*0.6,FH*3,d*0.6,8,FH*4), m.material); top.position.y=H/2+FH*1.5; m.add(top); }   // setback crown
  const ant=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.1,6,5), new THREE.MeshStandardMaterial({ color:0x8a8e92, metalness:0.7, roughness:0.4 })); ant.position.set(w*0.2, H/2+(m.children.length?FH*3:0)+3, 0); m.add(ant);
  const c=Math.cos(ry), s=Math.sin(ry); for(let a=-w/2+1.5;a<=w/2-1;a+=2.8) for(let b=-d/2+1.5;b<=d/2-1;b+=2.8) solid(ox+a*c+b*s, oz-a*s+b*c, 2.0, 'building', m); return H; }
function villaHouse(ox,oz,ry,w,d){ const y0=heightAt(ox,oz)-0.05, H=6.4, T=villa(); bucket('villa', facadeMat(T)).geos.push(place(boxUV(w,H,d,w/2,H/2), ox, y0+H/2, oz, ry));
  const sh=new THREE.Shape(); sh.moveTo(-d/2-0.5,0); sh.lineTo(d/2+0.5,0); sh.lineTo(0,2.4); sh.closePath(); const rg=new THREE.ExtrudeGeometry(sh,{depth:w+0.8,bevelEnabled:false}); rg.translate(0,0,-(w+0.8)/2); rg.rotateY(Math.PI/2); det(rg, ox, y0+H, oz, ry, 0xb04a2a);
  local(0, y0+0.6, d/2+2.2, w+2, 1.2, 0.25, ox,oz,ry, 0xe8e0c8);   // front garden wall
  footprint(ox,oz,ry,w,d); return H; }
// ---------- vehicles (instanced; white body is tinted per instance, wheels/glass stay dark) ----------
let _car=null, _van=null, _moto=null, _vmat=null;
function vmat(){ return _vmat||(_vmat=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.35, metalness:0.45, envMapIntensity:1.2 })); }
function carGeo(){ if(_car) return _car; const Q=[], b=(w,h,d,x,y,z,col,rx)=>{ const g=new THREE.BoxGeometry(w,h,d); if(rx) g.rotateX(rx); g.translate(x,y,z); Q.push({geo:g,col}); };
  b(1.8,0.55,4.3,0,0.6,0,0xffffff); b(1.7,0.12,1.2,0,0.9,1.45,0xffffff,-0.12); b(1.6,0.62,2.1,0,1.18,-0.2,0xffffff);
  b(1.62,0.48,0.08,0,1.2,0.86,0x18242e,0.55); b(1.62,0.44,0.08,0,1.2,-1.26,0x18242e,-0.5); b(0.06,0.42,1.7,0.81,1.2,-0.2,0x18242e); b(0.06,0.42,1.7,-0.81,1.2,-0.2,0x18242e);   // glass
  for(const [x,z] of [[0.82,1.35],[-0.82,1.35],[0.82,-1.35],[-0.82,-1.35]]){ const w=new THREE.CylinderGeometry(0.36,0.36,0.26,12); w.rotateZ(Math.PI/2); w.translate(x,0.36,z); Q.push({geo:w,col:0x151515}); }
  b(0.4,0.14,0.05,0.6,0.7,2.16,0xf8f8e8); b(0.4,0.14,0.05,-0.6,0.7,2.16,0xf8f8e8); b(0.4,0.12,0.05,0.6,0.72,-2.16,0xc82020); b(0.4,0.12,0.05,-0.6,0.72,-2.16,0xc82020);
  return (_car=_mergeColored(Q)); }
function vanGeo(){ if(_van) return _van; const Q=[], b=(w,h,d,x,y,z,col)=>{ const g=new THREE.BoxGeometry(w,h,d); g.translate(x,y,z); Q.push({geo:g,col}); };
  b(1.9,1.5,4.8,0,1.15,-0.1,0xffffff); b(1.84,0.6,0.08,0,1.55,2.31,0x18242e); b(0.06,0.5,1.0,0.96,1.55,1.6,0x18242e); b(0.06,0.5,1.0,-0.96,1.55,1.6,0x18242e);
  for(const [x,z] of [[0.86,1.5],[-0.86,1.5],[0.86,-1.6],[-0.86,-1.6]]){ const w=new THREE.CylinderGeometry(0.38,0.38,0.28,12); w.rotateZ(Math.PI/2); w.translate(x,0.38,z); Q.push({geo:w,col:0x151515}); }
  return (_van=_mergeColored(Q)); }
function motoGeo(){ if(_moto) return _moto; const Q=[];
  for(const z of [0.62,-0.62]){ const w=new THREE.TorusGeometry(0.27,0.07,6,14); w.rotateY(Math.PI/2); w.translate(0,0.3,z); Q.push({geo:w,col:0x151515}); }
  const body=new THREE.BoxGeometry(0.34,0.32,1.05); body.translate(0,0.55,-0.1); Q.push({geo:body,col:0xffffff}); const seat=new THREE.BoxGeometry(0.3,0.1,0.62); seat.translate(0,0.8,-0.25); Q.push({geo:seat,col:0x202020});
  const front=new THREE.BoxGeometry(0.3,0.62,0.14); front.rotateX(0.25); front.translate(0,0.72,0.5); Q.push({geo:front,col:0xffffff}); const bar=new THREE.BoxGeometry(0.62,0.05,0.05); bar.translate(0,1.05,0.55); Q.push({geo:bar,col:0x303030});
  const lamp=new THREE.BoxGeometry(0.12,0.1,0.06); lamp.translate(0,0.95,0.62); Q.push({geo:lamp,col:0xf8f8e0}); return (_moto=_mergeColored(Q)); }
const VCOL=[0xc8c8c8,0xf0f0f0,0x2a2a2a,0x8a1a1a,0x1a3a7a,0x6a6a6a,0xd8c8a0,0x3a5a3a];
function fleet(geo, list, cr){ if(!list.length) return; const im=new THREE.InstancedMesh(geo, vmat(), list.length), M=new THREE.Matrix4(), Q=new THREE.Quaternion(), E=new THREE.Euler(), V=new THREE.Vector3(), S=new THREE.Vector3(1,1,1), C=new THREE.Color();
  list.forEach((o,k)=>{ M.compose(V.set(o.x, heightAt(o.x,o.z), o.z), Q.setFromEuler(E.set(0,o.ry,0)), S); im.setMatrixAt(k,M); im.setColorAt(k, C.setHex(o.col));
    crushables.push({ x:o.x, z:o.z, r:cr, im, k, alive:true, kind:'grass', ry:o.ry, s:1, land:true }); });
  im.instanceMatrix.needsUpdate=true; im.instanceColor.needsUpdate=true; im.castShadow=!MOBILE; im.receiveShadow=true; im.computeBoundingSphere(); arena.add(im); LAND.meshes.push(im); }
// ---------- the district ----------
export function buildCityDistrict(){ B=new Map(); P=[]; const n=Math.floor(ARENA/G), cars=[], vans=[], motos=[], trees=[], lamps=[], poles=[];
  const roadOK=(x,z)=>inField(x,z,4) && !inZone(x,z,3) && Math.hypot(x,z)>30 && Math.hypot(x,z)<158;
  const RT=roadT(), WT=walkT(), ZT=zebraT();
  const roadMat=()=>new THREE.MeshStandardMaterial({ map:RT.t, roughness:0.82 }), walkMat=()=>new THREE.MeshStandardMaterial({ map:WT.t, roughness:0.9 }), zebMat=()=>new THREE.MeshStandardMaterial({ map:ZT.t, roughness:0.8 });
  const strip=(key,mk,x,z,len,wid,ang,y,tl,tw)=>{ const g=new THREE.PlaneGeometry(len,wid), uv=g.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i, uv.getX(i)*len/tl, uv.getY(i)*(tw?wid/tw:1)); g.rotateX(-Math.PI/2); g.rotateY(ang); g.translate(x, heightAt(x,z)+y, z); bucket(key,mk).geos.push(g); };
  // roads: every grid edge between two intersections, if that stretch is open ground
  for(let i=-n;i<=n;i++) for(let j=-n;j<n;j++) for(const ax of [0,1]){ const x0=ax?i*G:j*G+G/2, z0=ax?j*G+G/2:i*G, ang=ax?Math.PI/2:0;   // ax=1: runs along z
    const cx=ax?x0:x0, cz=ax?z0:z0; if(!roadOK(cx,cz)) continue; const L=G-ROAD;
    strip('road',roadMat, cx, cz, L, ROAD, ang, 0.04, 8);
    for(const sd of [-1,1]){ const ox=ax?sd*(ROAD/2+WALK/2):0, oz=ax?0:sd*(ROAD/2+WALK/2); strip('walk',walkMat, cx+ox, cz+oz, L, WALK, ang, 0.12, 2, 2);
      const kx=ax?sd*(ROAD/2+0.08):0, kz=ax?0:sd*(ROAD/2+0.08); det(new THREE.BoxGeometry(ax?0.16:L,0.18,ax?L:0.16), cx+kx, heightAt(cx,cz)+0.09, cz+kz, 0, 0x8a8a84);   // kerb
      // street furniture along this sidewalk
      for(let s=-L/2+3; s<L/2-2; s+=_R(5,9)){ const px=ax?cx+ox:cx+s, pz=ax?cz+s:cz+oz;
        const r=Math.random(); if(r<0.12) trees.push({ x:px, z:pz, s:_R(0.75,1.0), ry:_R(0,6.28) }); else if(r<0.2) lamps.push({ x:px, z:pz, ry:ax?(sd>0?-Math.PI/2:Math.PI/2):(sd>0?Math.PI:0) });
        else if(r<0.42){ const rowN=3+((Math.random()*6)|0); for(let q=0;q<rowN;q++){ const ss=s+q*0.85; if(ss>L/2-1) break; motos.push({ x:ax?cx+ox:cx+ss, z:ax?cz+ss:cz+oz, ry:(ax?Math.PI/2:0)+(Math.random()<0.5?0:Math.PI)+(Math.random()-0.5)*0.3, col:VCOL[(Math.random()*VCOL.length)|0] }); } s+=rowN*0.85; } }
      if(Math.random()<0.5) poles.push([ax?cx+ox+sd*0.9:cx-L/2+1, ax?cz-L/2+1:cz+oz+sd*0.9, ax?cx+ox+sd*0.9:cx+L/2-1, ax?cz+L/2-1:cz+oz+sd*0.9]);
      // parked cars along the kerb
      for(let s=-L/2+4; s<L/2-4; s+=_R(6,14)) if(Math.random()<0.45){ const lx=ax?sd*(ROAD/2-1.2):0, lz=ax?0:sd*(ROAD/2-1.2), list=Math.random()<0.25?vans:cars;
        list.push({ x:ax?cx+lx:cx+s, z:ax?cz+s:cz+lz, ry:ax?(sd>0?0:Math.PI):(sd>0?Math.PI/2:-Math.PI/2), col:Math.random()<0.12?0xf0c020:VCOL[(Math.random()*VCOL.length)|0] }); } } }
  // intersections: plain asphalt + zebra crossings + a traffic light on one corner
  for(let i=-n;i<=n;i++) for(let j=-n;j<=n;j++){ const x=i*G, z=j*G; if(!roadOK(x,z)) continue; strip('road',roadMat, x, z, ROAD, ROAD, 0, 0.035, 64);
    for(const [dx,dz,a] of [[0,ROAD/2+1.6,0],[0,-ROAD/2-1.6,0],[ROAD/2+1.6,0,Math.PI/2],[-ROAD/2-1.6,0,Math.PI/2]]) strip('zebra',zebMat, x+dx, z+dz, ROAD, 3, a, 0.05, 8, 3);
    if(Math.random()<0.6){ const px=x+ROAD/2+1.2, pz=z+ROAD/2+1.2, y=heightAt(px,pz); det(new THREE.CylinderGeometry(0.08,0.1,4.6,6), px, y+2.3, pz, 0, 0x3a3c3e); det(new THREE.BoxGeometry(0.4,1.1,0.4), px, y+4.4, pz-0.3, 0, 0x2a2a2a);
      for(const [yy,c] of [[0.35,0xe82020],[0,0xe8b020],[-0.35,0x20c840]]) det(new THREE.SphereGeometry(0.11,8,6), px, y+4.4+yy, pz-0.52, 0, c); } }
  // blocks: each cell between roads becomes a row of tube houses with alleys, an apartment pair, an office tower, villas or a little park
  let towers=0;
  for(let i=-n;i<n;i++) for(let j=-n;j<n;j++){ const cx=i*G+G/2, cz=j*G+G/2, half=(G-ROAD)/2-WALK-0.4; if(!inField(cx,cz,half+2) || inZone(cx,cz,half) || Math.hypot(cx,cz)<half+26 || Math.hypot(cx,cz)>150) continue;
    ZONES.push({ kind:'landmark', x:cx, z:cz, r:half*0.95 }); const r=Math.random(), dep=9.2;
    if(r<0.5){ for(const side of [1,-1]){ let a=-half+0.2; const ry=side>0?0:Math.PI;                                  // two rows back to back, a back alley between them
        while(a<half-3.5){ const w=_R(4,6.2); if(a+w>half) break; const ox=cx+a+w/2, oz=cz+side*(half-dep/2); tubeHouse(ox, oz, ry, w, dep); a+=w;
          if(Math.random()<0.18){ a+=_R(2.2,3); } } } }                                                                   // a ngõ (alley) through the row
    else if(r<0.68){ for(const side of [1,-1]) apartment(cx, cz+side*(half-5), side>0?0:Math.PI, half*1.7, 9); }
    else if(r<0.82 && towers<8){ officeTower(cx, cz, (Math.random()<0.5?0:Math.PI/2), _R(13,17), _R(13,17)); towers++; }
    else if(r<0.93){ for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) villaHouse(cx+sx*half*0.5, cz+sz*half*0.5, sz>0?0:Math.PI, 7.5, 7); }
    else { strip('park', ()=>new THREE.MeshStandardMaterial({ map:parkT().t, roughness:0.95 }), cx, cz, half*2, half*2, 0, 0.06, 4, 4); for(let k=0;k<6;k++) trees.push({ x:cx+_R(-half,half)*0.8, z:cz+_R(-half,half)*0.8, s:_R(0.9,1.3), ry:_R(0,6.28) }); } }
  // lamps: pole + arm + glowing head (head material glows at night)
  if(lamps.length){ const Q=[]; const pole=new THREE.CylinderGeometry(0.07,0.1,6,6); pole.translate(0,3,0); Q.push({geo:pole,col:0x4a4c4e}); const arm=new THREE.BoxGeometry(0.08,0.08,1.6); arm.translate(0,5.9,0.75); Q.push({geo:arm,col:0x4a4c4e});
    const lg=_mergeColored(Q), head=new THREE.BoxGeometry(0.5,0.16,0.3); head.translate(0,5.8,1.5); const hm=new THREE.MeshStandardMaterial({ color:0xfff4d0, emissive:0xffe0a0, emissiveIntensity:0 }); LAND.mats.push(hm);
    for(const [g,m] of [[lg,vmat()],[head,hm]]){ const im=new THREE.InstancedMesh(g, m, lamps.length), M=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler(), v=new THREE.Vector3(), s=new THREE.Vector3(1,1,1);
      lamps.forEach((o,k)=>{ M.compose(v.set(o.x, heightAt(o.x,o.z), o.z), q.setFromEuler(e.set(0,o.ry,0)), s); im.setMatrixAt(k,M); }); im.castShadow=!MOBILE; im.computeBoundingSphere(); arena.add(im); LAND.meshes.push(im); } }
  // power poles + three sagging wires
  if(poles.length){ const pts=[]; for(const [x0,z0,x1,z1] of poles){ const y0=heightAt(x0,z0), y1=heightAt(x1,z1);
      for(const [x,z,y] of [[x0,z0,y0],[x1,z1,y1]]){ det(new THREE.CylinderGeometry(0.1,0.14,7.5,6), x, y+3.75, z, 0, 0x9a968c); det(new THREE.BoxGeometry(1.4,0.1,0.1), x, y+7.0, z, Math.atan2(x1-x0,z1-z0)+Math.PI/2, 0x5a5650); }
      for(const off of [-0.55,0,0.55]){ const nx=-(z1-z0), nz=(x1-x0), L=Math.hypot(nx,nz)||1, ox=nx/L*off, oz=nz/L*off; let px=x0+ox, pz=z0+oz, py=y0+7.05;
        for(let k=1;k<=8;k++){ const u=k/8, x=x0+ox+(x1-x0)*u, z=z0+oz+(z1-z0)*u, y=y0+(y1-y0)*u+7.05-Math.sin(u*Math.PI)*0.9; pts.push(px,py,pz,x,y,z); px=x; py=y; pz=z; } } }
    const lg=new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts,3)); const ln=new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color:0x1a1a1a })); arena.add(ln); LAND.meshes.push(ln); }
  // flush the buckets: one mesh per material
  for(const [k,b] of B){ if(!b.geos.length) continue; const g=mergeGeometries(b.geos.map(q=>q.index?q.toNonIndexed():q), false); b.geos.forEach(q=>q.dispose()); const m=new THREE.Mesh(g, b.mat); m.castShadow=!/road|walk|zebra|park/.test(k); m.receiveShadow=true; arena.add(m); LAND.meshes.push(m); }
  if(P.length){ const m=new THREE.Mesh(_mergeColored(P), new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.8, metalness:0.1 })); m.castShadow=true; m.receiveShadow=true; arena.add(m); LAND.meshes.push(m); }
  fleet(carGeo(), cars, 1.6); fleet(vanGeo(), vans, 1.8); fleet(motoGeo(), motos, 0.45);
  if(trees.length){ const im=new THREE.InstancedMesh(treeBroadleaf(), floraMat(), trees.length), M=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler(), v=new THREE.Vector3(), s=new THREE.Vector3();
    trees.forEach((o,k)=>{ M.compose(v.set(o.x,heightAt(o.x,o.z),o.z), q.setFromEuler(e.set(0,o.ry,0)), s.set(o.s,o.s,o.s)); im.setMatrixAt(k,M); crushables.push({ x:o.x, z:o.z, r:0.55*o.s, im, k, alive:true, kind:'tree', ry:o.ry, s:o.s, land:true }); });
    im.castShadow=!MOBILE; im.receiveShadow=true; im.computeBoundingSphere(); arena.add(im); LAND.meshes.push(im); }
  B=null; P=null; }
