// world/city.js — Z142 · Z216 A REAL CITY THAT BREAKS. The street plan has a hierarchy: wide BOULEVARDS every third line (two carriageways of two
//   lanes, a planted median with palms and double lamps, broad pavements with street trees and bus shelters) and narrow STREETS between them
//   (two lanes, scooters on the pavement, sagging power lines on concrete poles). Blocks are roomy and each is something: rows of tube houses
//   (nhà ống) with shop fronts, signs, AC units and iron cages; French villas in walled gardens (two storeys, porch + balcony, pavilion roof,
//   bougainvillea, a car in the drive); apartment slabs round a courtyard; glass towers; parks with paths, fountains, benches and a gazebo;
//   market squares with umbrella stalls; a football pitch. EVERYTHING BREAKS: every floor of every building is a piece of the merged meshes
//   (switched off in the vertex shader, shadows too) — shells and missiles bring floors down one by one from the top (debris, dust, rubble
//   piling at the foot, the jagged broken top showing), until the ground floor goes and leaves a ruin; poles, street lamps and traffic lights
//   topple (blast, or a tank ramming them) and the wires on a fallen pole drop; cars in a blast burn out.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OPEN_LAND, REALCITY, REALTREE, RIDE_HIT, BREAKUP } from '../../config.js';
import { ARENA, DEBRIS_GEOS, LAND, MOBILE, S, TEX_K, ZONES, _R, _mergeColored, arena, blocks, burst, crushAt, crushables, detailize, drawStreetVehicles, floatText, floraMat, heightAt, inField, inZone, maxAniso, pickCar, sfx, spawnDebris, spawnPart, treeBroadleaf, treePalm , floorBands, pickBuilding , streetSurface , TREES, trackTrees , loadRealCity, realCityReady, cityProp, stoneMat, stoneBox, buildTraffic, trafficBlast, updateTraffic, decalAsh } from '../hub.js';

const G=46, ST=8, BV=17, MED=2.6, WALK=2.6, BWALK=3.6;     // grid pitch · street · boulevard · median · pavements
const isBlvd=i=>((i%3)+3)%3===0, roadW=i=>isBlvd(i)?BV:ST, walkW=i=>isBlvd(i)?BWALK:WALK;
const SIGNS=['TẠP HOÁ','PHỞ BÒ','CÀ PHÊ','SỬA XE','BÁNH MÌ','NHÀ THUỐC','KARAOKE','NHÀ NGHỈ','ĐIỆN THOẠI','BÚN CHẢ','VÀNG BẠC','GẠO'];
const WALLC=['#d6c48e','#cda59a','#a9bfae','#abb9c8','#e2ded4','#d4b08c','#bab3c4','#c6c9a2'];   // Z242 weathered paint, not candy colours
// ---------- textures (canvas, cached) ----------
const _tx={};
function tex(key, w, h, paint){ if(_tx[key]) return _tx[key]; const c=document.createElement('canvas'), e=document.createElement('canvas'); c.width=e.width=w*TEX_K; c.height=e.height=h*TEX_K;   // Z145 painted 4× finer
  const x=c.getContext('2d'), y=e.getContext('2d'); x.scale(TEX_K,TEX_K); y.scale(TEX_K,TEX_K); y.fillStyle='#000'; y.fillRect(0,0,w,h); paint(x, y, w, h);
  const t=new THREE.CanvasTexture(c), em=new THREE.CanvasTexture(e), A=maxAniso(); for(const q of [t,em]){ q.wrapS=q.wrapT=THREE.RepeatWrapping; q.colorSpace=THREE.SRGBColorSpace; q.anisotropy=A; }
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
const roadT=()=>tex('road',256,64,(x)=>{ x.fillStyle='#3a3c40'; x.fillRect(0,0,256,64); for(let n=0;n<700;n++){ x.fillStyle='rgba('+(Math.random()<0.5?255:0)+','+(Math.random()<0.5?255:0)+',255,0.04)'; x.fillRect(Math.random()*256,Math.random()*64,2,2); }
  x.fillStyle='#e8e4d0'; x.fillRect(0,3,256,2); x.fillRect(0,59,256,2); x.fillStyle='#e8c040'; for(let k=0;k<4;k++) x.fillRect(k*64+8,31,36,2.5);   // edge lines + dashed centre
  x.fillStyle='rgba(20,20,20,0.35)'; for(let n=0;n<6;n++){ x.beginPath(); x.ellipse(Math.random()*256,10+Math.random()*44,8+Math.random()*16,3+Math.random()*5,0,0,7); x.fill(); } });   // oil stains
const walkT=()=>tex('walk',64,64,(x)=>{ x.fillStyle='#a8a49a'; x.fillRect(0,0,64,64); for(let r=0;r<4;r++) for(let c=0;c<4;c++){ x.fillStyle=(r+c)%2?'#b4b0a4':'#9c988e'; x.fillRect(c*16+1,r*16+1,14,14); } });
const zebraT=()=>tex('zebra',64,64,(x)=>{ x.fillStyle='#3a3c40'; x.fillRect(0,0,64,64); x.fillStyle='#e8e8e0'; for(let k=0;k<5;k++) x.fillRect(k*13+2,4,7,56); });
const parkT=()=>tex('park',64,64,(x)=>{ x.fillStyle='#5a7444'; x.fillRect(0,0,64,64); for(let n=0;n<300;n++){ x.fillStyle=Math.random()<0.5?'#687e4c':'#4a623a';   /* Z242 trodden city lawn */ x.fillRect(Math.random()*64,Math.random()*64,2,2); } });
const bvdT=()=>tex('bvd',256,64,(x)=>{ x.fillStyle='#38393d'; x.fillRect(0,0,256,64); for(let n=0;n<700;n++){ x.fillStyle='rgba(255,255,255,0.035)'; x.fillRect(Math.random()*256,Math.random()*64,2,2); }
  x.fillStyle='#ecebe2'; x.fillRect(0,3,256,2.5); x.fillRect(0,58.5,256,2.5); for(let k=0;k<4;k++) x.fillRect(k*64+6,31,40,2.2);   // one carriageway: two lanes, solid edges, dashed divider
  x.fillStyle='rgba(18,18,18,0.3)'; for(let n=0;n<5;n++){ x.beginPath(); x.ellipse(Math.random()*256,12+Math.random()*40,10+Math.random()*16,3+Math.random()*4,0,0,7); x.fill(); } });
const villaBay=(col,sh)=>tex('vb'+col+sh,128,128,(x,y)=>{ x.fillStyle=col; x.fillRect(0,0,128,128); x.fillStyle='rgba(255,255,255,0.35)'; x.fillRect(0,0,128,7); x.fillStyle='rgba(0,0,0,0.12)'; x.fillRect(0,7,128,3); x.fillRect(0,120,128,8);
  const l=lit(y,44,30,40,82); x.fillStyle=l?'#e8c27a':'#26343e'; x.beginPath(); x.moveTo(44,112); x.lineTo(44,48); x.arc(64,48,20,Math.PI,0); x.lineTo(84,112); x.closePath(); x.fill();   // tall arched French window
  x.strokeStyle='#f4f2ea'; x.lineWidth=4; x.stroke(); x.lineWidth=2; x.beginPath(); x.moveTo(64,28); x.lineTo(64,112); x.moveTo(44,70); x.lineTo(84,70); x.moveTo(44,92); x.lineTo(84,92); x.stroke();
  x.fillStyle=sh; for(const px of [22,88]){ x.fillRect(px,34,18,78); x.fillStyle='rgba(0,0,0,0.25)'; for(let k=0;k<12;k++) x.fillRect(px,37+k*6.3,18,1.6); x.fillStyle=sh; }   // louvred shutters
  x.fillStyle='#e8e4d8'; x.fillRect(38,112,52,5); });
const pitchT=()=>tex('pitch',128,64,(x)=>{ for(let k=0;k<8;k++){ x.fillStyle=k%2?'#4c7238':'#567c40'; x.fillRect(k*16,0,16,64); } x.strokeStyle='#f0f0e8'; x.lineWidth=1.5; x.strokeRect(3,3,122,58); x.beginPath(); x.moveTo(64,3); x.lineTo(64,61); x.stroke(); x.beginPath(); x.arc(64,32,9,0,7); x.stroke(); x.strokeRect(3,18,14,28); x.strokeRect(111,18,14,28); });
// ---------- breakable pieces: every floor / scar / ruin / wire span has an id; a tiny texture says which are standing (vertex shader drops the rest) ----------
const PC={ W:256, H:64, data:null, tex:null, n:1 };
function pcInit(){ if(!PC.tex){ PC.data=new Uint8Array(PC.W*PC.H*4); PC.tex=new THREE.DataTexture(PC.data, PC.W, PC.H, THREE.RGBAFormat); PC.tex.magFilter=PC.tex.minFilter=THREE.NearestFilter; } PC.data.fill(255); PC.tex.needsUpdate=true; PC.n=1; }
function newPiece(hidden){ const id=PC.n++; if(id>=PC.W*PC.H) return 0; if(hidden){ PC.data[id*4]=0; PC.tex.needsUpdate=true; } return id; }
function setPiece(id, on){ if(!id) return; PC.data[id*4]=on?255:0; PC.tex.needsUpdate=true; }
function pieceHook(mat){ const prev=mat.onBeforeCompile, pk=mat.customProgramCacheKey;
  mat.onBeforeCompile=(sh,r)=>{ if(prev) prev.call(mat,sh,r); sh.uniforms.uPieces={ value:PC.tex };
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aPiece; uniform sampler2D uPieces;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\n  if(texelFetch(uPieces, ivec2(int(mod(aPiece,256.0)), int(floor(aPiece/256.0))), 0).r < 0.5) transformed = vec3(0.0, -9999.0, 0.0);'); };
  mat.customProgramCacheKey=()=>(pk?pk.call(mat):'')+'|pieces'; return mat; }
let _dm=null; function depthMat(){ return _dm||(_dm=pieceHook(new THREE.MeshDepthMaterial({ depthPacking:THREE.RGBADepthPacking }))); }
let CURP=0; const tag=(g,id)=>{ g.setAttribute('aPiece', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(id==null?CURP:id),1)); return g; };
// ---------- buckets: geometry merged per material ----------
let B=null; function bucket(key, makeMat, pieces){ let b=B.get(key); if(!b){ b={ mat:makeMat(), geos:[], pieces:!!pieces }; B.set(key,b); } return b; }
const facadeMat=(T,metal)=>()=>{ const m=new THREE.MeshStandardMaterial({ map:T.t, emissiveMap:T.em, emissive:0xffffff, emissiveIntensity:0, roughness:metal?0.25:0.85, metalness:metal?0.6:0.04, envMapIntensity:metal?1.4:0.6 }); detailize(m, metal?{ scale:0.3, bump:0.004, alb:0.14, foot:1.2, streak:0.16 }:{ scale:0.45, bump:0.018, alb:0.26, foot:1.5, streak:0.3 }); LAND.mats.push(m); return pieceHook(m); };
const facade=(key,T,metal)=>bucket(key, facadeMat(T,metal), true);
function boxUV(w,h,d,tw,th){ const g=new THREE.BoxGeometry(w,h,d), uv=g.attributes.uv, sc=[[d,h],[d,h],[1,1],[1,1],[w,h],[w,h]];
  for(let f=0;f<6;f++) for(let v=0;v<4;v++){ const i=f*4+v; uv.setXY(i, uv.getX(i)*Math.max(1,Math.round(sc[f][0]/tw)), uv.getY(i)*Math.max(1,Math.round(sc[f][1]/th))); } return g; }
const place=(g,x,y,z,ry)=>{ g.rotateY(ry); g.translate(x,y,z); return tag(g); };
let P=null;   // vertex-coloured details (roofs, parapets, balconies, awnings, kerbs, furniture…) → one mesh, pieces honoured
const det=(geo,x,y,z,ry,col)=>{ geo.rotateY(ry||0); geo.translate(x,y,z); tag(geo); P.push({ geo, col }); };
// a box in a building's local frame (front = +z) → world · tilted variant for broken bits
const L2W=(bx,bz,ox,oz,ry)=>{ const c=Math.cos(ry), s=Math.sin(ry); return [ox+bx*c+bz*s, oz-bx*s+bz*c]; };
function local(bx,by,bz, w,h,d, ox,oz,ry,col){ const [x,z]=L2W(bx,bz,ox,oz,ry); det(new THREE.BoxGeometry(w,h,d), x, by, z, ry, col); }
function localG(geo, bx,by,bz, ox,oz,ry,col){ const [x,z]=L2W(bx,bz,ox,oz,ry); det(geo, x, by, z, ry, col); }
function mergeP(parts){ const geos=[]; for(const { geo, col } of parts){ const g=geo.index?geo.toNonIndexed():geo;
    for(const k of Object.keys(g.attributes)) if(k!=='position'&&k!=='normal'&&k!=='uv'&&k!=='aPiece') g.deleteAttribute(k);
    if(!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    const n=g.attributes.position.count, c=new Float32Array(n*3), cc=new THREE.Color(col); for(let i=0;i<n;i++){ c[i*3]=cc.r; c[i*3+1]=cc.g; c[i*3+2]=cc.b; } g.setAttribute('color', new THREE.BufferAttribute(c,3)); geos.push(g); }
  const m=mergeGeometries(geos, false); geos.forEach(g=>g.dispose()); return m; }
const hex=(c)=>typeof c==='string' ? parseInt(c.slice(1),16) : c;
const dark=(c,k)=>new THREE.Color(hex(c)).multiplyScalar(k).getHex();

// ---------- buildings: floors as pieces, a jagged scar per floor (shown once the floor above is gone), a ruin for the end ----------
const BLD=[]; let _dummy=null;
function newBld(kind, ox, oz, ry, w, d, y0, hpPer, col){ const Bd={ kind, x:ox, z:oz, ry, w, d, y0, hpPer, col:hex(col), floors:[], solids:[], dead:false, top:-1, hp:0, rub:0, casc:0, ruin:0 }; BLD.push(Bd); return Bd; }
function floorPiece(Bd, ya, yb){ CURP=newPiece(); const f={ id:CURP, y0:ya, y1:yb, scar:0 }; Bd.floors.push(f); return f; }
function brokenEdge(Bd, y, k, low){ const hw=Bd.w/2, hd=Bd.d/2, wc=Bd.col, cc=0x8a8680;
  for(let i=0;i<(low?14:9);i++){ const side=i%4, t=Math.random()*2-1, bx= side<2 ? t*hw : (side===2?hw:-hw)-Math.sign(side===2?1:-1)*0.15, bz= side<2 ? (side===0?hd:-hd)-Math.sign(side===0?1:-1)*0.15 : t*hd;
    const h=(low?_R(0.5,2.2):_R(0.25,1.3))*k, g=new THREE.BoxGeometry(side<2?_R(0.8,2.4):0.3, h, side<2?0.3:_R(0.8,2.4)); g.rotateZ((Math.random()-0.5)*0.25); g.rotateX((Math.random()-0.5)*0.25);
    localG(g, bx, y+h/2-0.05, bz, Bd.x, Bd.z, Bd.ry, Math.random()<0.6?dark(wc,0.85):cc); }
  for(let i=0;i<(low?8:5);i++){ const g=new THREE.BoxGeometry(_R(0.5,1.4),_R(0.3,0.8),_R(0.5,1.4)); g.rotateY(Math.random()*3); g.rotateZ((Math.random()-0.5)*0.5); localG(g, _R(-hw,hw)*0.8, y+0.2, _R(-hd,hd)*0.8, Bd.x, Bd.z, Bd.ry, cc); }
  for(let i=0;i<5;i++){ const g=new THREE.BoxGeometry(0.04,_R(0.5,1.2),0.04); g.rotateZ((Math.random()-0.5)*0.9); g.rotateX((Math.random()-0.5)*0.9); localG(g, _R(-hw,hw)*0.9, y+0.5, (Math.random()<0.5?hd:-hd)*0.95, Bd.x, Bd.z, Bd.ry, 0x4a3426); } }   // rebar
function endBld(Bd){ Bd.top=Bd.floors.length-1; Bd.hp=Bd.hpPer*Bd.floors.length;
  for(let i=0;i<Bd.floors.length-1;i++){ const f=Bd.floors[i]; CURP=newPiece(true); f.scar=CURP; brokenEdge(Bd, f.y1, 1, false); }
  CURP=newPiece(true); Bd.ruin=CURP; brokenEdge(Bd, Bd.y0, 1, true); CURP=0;
  const c=Math.cos(Bd.ry), s=Math.sin(Bd.ry), dm=_dummy||(_dummy=new THREE.Object3D());
  for(let a=-Bd.w/2+1.5;a<=Bd.w/2-1.0;a+=2.8) for(let b=-Bd.d/2+1.5;b<=Bd.d/2-1.0;b+=2.8){
    const bl={ mesh:dm, x:Bd.x+a*c+b*s, z:Bd.z-a*s+b*c, r:2.0, hp:Infinity, maxHp:Infinity, steel:false, heavy:true, loot:false, kind:'building', bld:Bd }; blocks.push(bl); Bd.solids.push(bl); } }
// a shell / blast on a building: the hit wears its strength down; each time it crosses a floor's share, the TOP floor comes down
export function buildingHit(b, dmg){ const Bd=b.bld; if(!Bd || Bd.dead) return; Bd.hp-=dmg; while(!Bd.dead && Bd.top>=0 && Bd.hp <= Bd.hpPer*Bd.top) dropFloor(Bd); }
function dropFloor(Bd){ const f=Bd.floors[Bd.top]; if(!f) return; setPiece(f.id,false); Bd.top--; if(Bd.top>=0) setPiece(Bd.floors[Bd.top].scar,true); floorFX(Bd, f); if(Bd.top<0) razeBld(Bd); }
function floorFX(Bd, f){ const c=Math.cos(Bd.ry), s=Math.sin(Bd.ry), ym=(f.y0+f.y1)/2, gy=Bd.y0, p=S.player, near=p && Math.hypot(p.pos.x-Bd.x, p.pos.z-Bd.z)<50, at=(a,b)=>[Bd.x+a*c+b*s, Bd.z-a*s+b*c];
  for(let k=0;k<(MOBILE?2:3);k++){ const [x,z]=at(_R(-Bd.w/2,Bd.w/2)*0.7, _R(-Bd.d/2,Bd.d/2)*0.7); spawnDebris({ x, z, y:ym }, 1.2, Bd.col); }
  for(let k=0;k<(MOBILE?6:12);k++){ const [x,z]=at(_R(-Bd.w/2,Bd.w/2), _R(-Bd.d/2,Bd.d/2)); spawnPart(x, ym, z, (Math.random()-0.5)*3, _R(-1,1.5), (Math.random()-0.5)*3, { color:0xb6b0a6, size:_R(1.8,3.0), life:_R(1.8,2.8), smoke:true, grav:-0.5, drag:1.1, grow:1.8, op:0.55, keep:true }); }   // the floor goes in a cloud
  for(let k=0;k<(MOBILE?8:18);k++){ const [x,z]=at(_R(-Bd.w/2,Bd.w/2)*1.05, _R(-Bd.d/2,Bd.d/2)*1.05); spawnPart(x, ym+_R(-1,1), z, (Math.random()-0.5)*2.5, _R(-1,2), (Math.random()-0.5)*2.5, { color:Math.random()<0.5?0x6e6a64:dark(Bd.col,0.8), size:_R(0.2,0.5), life:1.8, grav:-16, drag:0.3 }); }   // chunks raining down the face
  for(let k=0;k<(MOBILE?5:10);k++){ const t=k/10*6.283, R=Math.max(Bd.w,Bd.d)*0.6; spawnPart(Bd.x+Math.cos(t)*R, gy+0.6, Bd.z+Math.sin(t)*R, Math.cos(t)*5, 0.8, Math.sin(t)*5, { color:0xa8a296, size:2.4, life:2.0, smoke:true, grav:-0.2, drag:1.4, grow:1.8, op:0.45, keep:true }); }   // dust rolling out at street level
  addRubble(Bd, f.y1-f.y0); sfx(near?'bigexplode':'explode', { x:Bd.x, z:Bd.z }, 0.7); sfx('crunch', { x:Bd.x, z:Bd.z }, 0.8); if(near) S.shake=Math.min(4, S.shake+0.9); }
function razeBld(Bd){ Bd.dead=true; for(const b of Bd.solids){ const i=blocks.indexOf(b); if(i>=0) blocks.splice(i,1); } Bd.solids.length=0; setPiece(Bd.ruin,true);
  burst({ x:Bd.x, z:Bd.z }, 0xb0aca4, 10, 9, { y:1.5, life:2.4, size:3.4, smoke:true, grav:-0.2, drag:1.2, up:2, op:0.5 }); floatText('TOÀ NHÀ SẬP', '#ffcf5a', new THREE.Vector3(Bd.x, Bd.y0+5, Bd.z), 16); }
// rubble heaps up at the foot as floors come down (one instanced draw for the whole city)
let RUB=null, RUBn=0;
function addRubble(Bd, h){ if(!BREAKUP.heaps){ decalAsh(Bd.x, Bd.z, Math.max(Bd.w, Bd.d)*0.75+2, 0.45); return; }   // Z418 no chunks heaped at its foot: the dust of the floor and a grey stain round it
  if(!RUB){ const cap=MOBILE?700:1600; RUB=new THREE.InstancedMesh(DEBRIS_GEOS.chunk[0], new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.95, metalness:0.02 }), cap); RUB.count=0; RUB.castShadow=!MOBILE; RUB.receiveShadow=true; RUB.frustumCulled=false; arena.add(RUB); LAND.meshes.push(RUB); }
  const c=Math.cos(Bd.ry), s=Math.sin(Bd.ry), n=Math.round(Math.min(40, Bd.w*Bd.d*0.06*Math.min(1.6,h/3))), cap=RUB.instanceMatrix.count; Bd.rub++;
  for(let i=0;i<n;i++){ const a=_R(-Bd.w/2-1.5,Bd.w/2+1.5), b=_R(-Bd.d/2-1.5,Bd.d/2+1.5), x=Bd.x+a*c+b*s, z=Bd.z-a*s+b*c, edge=Math.max(Math.abs(a)/(Bd.w/2+1.5), Math.abs(b)/(Bd.d/2+1.5)), sc=_R(0.6,1.8)*(1.2-edge*0.5);
    _M4.compose(_v3.set(x, heightAt(x,z)+sc*0.25+Math.min(2.4, Bd.rub*0.35)*(1-edge), z), _qy.setFromEuler(_eu.set(Math.random()*3,Math.random()*6,Math.random()*3)), _sc.set(sc*_R(0.8,1.4),sc*_R(0.5,0.9),sc*_R(0.8,1.4)));
    const k=RUBn%cap; RUB.setMatrixAt(k,_M4); RUB.setColorAt(k, _col.setHex(Math.random()<0.55?Bd.col:0x8a8680).multiplyScalar(_R(0.6,0.95))); RUBn++; RUB.count=Math.min(cap, RUBn); }
  RUB.instanceMatrix.needsUpdate=true; if(RUB.instanceColor) RUB.instanceColor.needsUpdate=true; }
const _M4=new THREE.Matrix4(), _v3=new THREE.Vector3(), _qy=new THREE.Quaternion(), _qf=new THREE.Quaternion(), _eu=new THREE.Euler(), _sc=new THREE.Vector3(), _one=new THREE.Vector3(1,1,1), _ax=new THREE.Vector3(), _col=new THREE.Color();

// ---------- things that topple: power poles, street lamps, traffic lights (instanced; a fallen one lies where it fell, its wires gone) ----------
const TOP=[];
function regTopple(ims, list, h){ list.forEach((o,k)=>{ const T={ ims, k, x:o.x, z:o.z, y:heightAt(o.x,o.z)+REALCITY.lift.walk, ry:o.ry||0, h, alive:true, fall:null, spans:o.spans||[], pole:h>7 }; TOP.push(T);
  crushables.push({ x:o.x, z:o.z, r:0.45, im:ims[0], k, alive:true, kind:'topple', T, ry:T.ry, s:1, land:true }); }); }
// a light piece knocked over by a ride: it tips away from the blow onto its side, where it lies
export function knockProp(P, dx, dz){ if(!P || P.down) return; P.down=true; const L=Math.hypot(dx,dz)||1; _ax.set(dz/L, 0, -dx/L);
  _qy.setFromEuler(_eu.set(0,P.ry,0)); _qf.setFromAxisAngle(_ax, 1.45).multiply(_qy); _M4.compose(_v3.set(P.x+dx/L*P.h*0.45, P.y+Math.min(P.h, P.r)*0.4, P.z+dz/L*P.h*0.45), _qf, _one);
  P.im.setMatrixAt(P.k, _M4); P.im.instanceMatrix.needsUpdate=true; }
export function toppleAt(T, dx, dz){ if(!T || !T.alive) return; T.alive=false; const L=Math.hypot(dx,dz)||1; T.fall={ t:0, dx:dx/L, dz:dz/L, done:false }; for(const s of T.spans) setPiece(s,false);
  if(T.pole) for(let i=0;i<10;i++) spawnPart(T.x, T.y+T.h, T.z, (Math.random()-0.5)*6, Math.random()*4, (Math.random()-0.5)*6, { color:0xfff2b0, color2:0xff6a10, size:0.14, life:0.5+Math.random()*0.4, grav:-14, drag:0.8 });   // the wires snap in a shower of sparks
  sfx('clang', { x:T.x, z:T.z }, 0.5); }
function updateTopple(dt){ for(const T of TOP){ const F=T.fall; if(!F || F.done) continue; F.t+=dt; const k=Math.min(1, (F.t/0.9)**2);
  _ax.set(F.dz,0,-F.dx); _qf.setFromAxisAngle(_ax, k*Math.PI/2*0.95); _qy.setFromEuler(_eu.set(0,T.ry,0)); _qf.multiply(_qy); _M4.compose(_v3.set(T.x,T.y,T.z), _qf, _one);
  for(const im of T.ims){ im.setMatrixAt(T.k,_M4); im.instanceMatrix.needsUpdate=true; }
  if(k>=1){ F.done=true; const tx=T.x+F.dx*T.h*0.9, tz=T.z+F.dz*T.h*0.9; burst({ x:tx, z:tz }, 0xa8a296, 3, 3, { y:0.4, life:1.0, size:1.4, smoke:true, grav:-0.2, drag:2, up:0.6, op:0.4 }); sfx('thud', { x:tx, z:tz }, 0.6); } } }
// a blast in town: what stands near it goes over, parked cars burn out, trees come down
export function cityBlast(x, z, r){ trafficBlast(x, z, r); if(!TOP.length && !BLD.length) return;
  for(const T of TOP){ if(!T.alive) continue; const dx=T.x-x, dz=T.z-z; if(dx*dx+dz*dz < (r+1.2)*(r+1.2)) toppleAt(T, dx||0.1, dz); }
  for(const c of crushables){ if(!c.alive) continue; const dx=c.x-x, dz=c.z-z, d2=dx*dx+dz*dz;
    if(c.kind==='car' && !c.burnt && d2 < (r*0.95)*(r*0.95)){ c.burnt=true; c.im.setColorAt(c.k, _col.setHex(0x2a2420)); c.im.instanceColor.needsUpdate=true; if(c.ims) for(const t of c.ims){ t.setColorAt(c.k, _col.setHex(0x5a5050)); t.instanceColor.needsUpdate=true; }
      for(let k=0;k<4;k++) spawnPart(c.x, heightAt(c.x,c.z)+1, c.z, (Math.random()-0.5)*2, 1.5, (Math.random()-0.5)*2, { tex:'fire', color:0xfff0c0, color2:0xff4a10, size:1.2, grow:1.3, life:0.6, grav:1, drag:2 });
      spawnPart(c.x, heightAt(c.x,c.z)+1.2, c.z, 0, 1, 0, { color:0x1e1c1a, size:2.2, life:3, smoke:true, grav:0.4, drag:1, grow:1.8, op:0.5, keep:true }); }
    else if(c.kind==='tree' && d2 < (r*0.6)*(r*0.6)) crushAt(c); } }
// the radio event: a shelled block nearby gives way, floor after floor
export function cityCollapse(p){ if(!p) return false; const cand=BLD.filter(b=>!b.dead && b.floors.length>=3).map(b=>({ b, d:Math.hypot(b.x-p.pos.x, b.z-p.pos.z) })).filter(o=>o.d>14 && o.d<70).sort((a,b)=>a.d-b.d);
  if(!cand.length) return false; cand[0].b.casc=0.05; return true; }
export function updateCity(dt){ updateTraffic(dt); if(TOP.length) updateTopple(dt); for(const Bd of BLD) if(Bd.casc>0){ Bd.casc-=dt; if(Bd.casc<=0 && !Bd.dead){ Bd.hp=Bd.hpPer*Bd.top; dropFloor(Bd); Bd.casc = Bd.dead ? 0 : 0.38; } } }
export const CITY_XING=[];   // Z423 the laid crossings { x, z, wx, wz } (world/defense.js closes the enemy's with checkpoints)
export function resetCity(){ BLD.length=0; TOP.length=0; CITY_PROPS.length=0; CITY_XING.length=0; RUB=null; RUBn=0; CITY_GEN++; }   // Z267 anything still waiting for the models belongs to a city that is gone
export function cityBuildings(){ return BLD; }

// ---------- building kinds (front faces +z in the local frame; ox,oz = footprint centre; ry = rotation) ----------
// Z264 a Meshy building on the lot: scaled into the footprint (the same scale up, so it keeps its own proportions), cut into floor slices that are
//   pieces of the breakable-floor system like every other floor (shells bring them down from the top; scars, ruin, solid footprint as before)
// Z280 WINDOWS AT NIGHT: on the Meshy buildings, the glass (bluish or dark in the facade photo) lights up after dusk, cell by cell (a world-space
//   grid of rooms, hashed): about half the rooms on, most warm, some cool-white office light, each a little brighter or dimmer — the emissive
//   strength is the landmark glow (LAND.mats, 0 by day), so the city's towers become constellations of lit windows as night falls
// Z287 LIGHT POOLS: at night each street lamp throws a warm pool on the pavement under its head — a soft additive disc (one instanced draw),
// brightest at the centre, fading out; it follows NIGHT.k with the windows (POOL_K, set in updateLandmarkGlow)
export const POOL_K = { value:0 };
let _poolTex = null;
function poolTex(){ if(_poolTex) return _poolTex; const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'), g=x.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.35,'rgba(255,255,255,0.55)'); g.addColorStop(0.7,'rgba(255,255,255,0.14)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,128,128);
  return (_poolTex=new THREE.CanvasTexture(c)); }
function lampPools(lamps){ if(typeof document==='undefined' || !REALCITY.pools) return; const P=REALCITY.pools, geo=new THREE.PlaneGeometry(1,1); geo.rotateX(-Math.PI/2);
  const mat=new THREE.MeshBasicMaterial({ map:poolTex(), color:P.col, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, polygonOffset:true, polygonOffsetFactor:-2, toneMapped:true });
  mat.onBeforeCompile=sh=>{ sh.uniforms.uK=POOL_K; sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uK;').replace('#include <opaque_fragment>','outgoingLight*=uK;\n#include <opaque_fragment>'); };
  const im=new THREE.InstancedMesh(geo, mat, lamps.length), M=new THREE.Matrix4(), q=new THREE.Quaternion(), s=new THREE.Vector3(P.r*2,1,P.r*2), v=new THREE.Vector3();
  lamps.forEach((o,k)=>{ const ry=o.ry||0, x=o.x+Math.sin(ry)*P.reach, z=o.z+Math.cos(ry)*P.reach; M.compose(v.set(x, heightAt(x,z)+0.06, z), q, s); im.setMatrixAt(k,M); });
  im.frustumCulled=false; im.renderOrder=2; arena.add(im); LAND.meshes.push(im); }
export const WIN_K={ value:0 };   // the night's window glow (world/landmarks.js updateLandmarkGlow)
// Z399 THE CURTAIN WALL DRAWN CRISP: the towers' AI-made skins smear their window grids (wavy panes, soft mullions) and no texture size fixes that
//   from a tank's seat. On the glass (the same mask the night windows use) a grid is drawn in world metres — a mullion every cell wide, a
//   spandrel at every floor, each pane a slightly different reflection — anti-aliased by its own screen footprint, so it fades out into the
//   texture once a pane is a pixel or less (the far skyline keeps its texture). Vertical faces only (a face's own normal from the derivatives).
const FACADE_GLSL = `{ vec3 fN = normalize(cross(dFdx(vWinP), dFdy(vWinP))); float vert = 1.0 - smoothstep(0.35, 0.7, abs(fN.y)), alongZ = step(abs(fN.z), abs(fN.x));
        vec2 q = vec2(mix(vWinP.x, vWinP.z, alongZ) / ${REALCITY.windows.cell[0].toFixed(2)}, vWinP.y / ${REALCITY.windows.cell[1].toFixed(2)}), fq = fwidth(q), fade = clamp(1.6 - fq * 4.0, 0.0, 1.0);
        vec2 e = min(fract(q), 1.0 - fract(q)); float mul = (1.0 - smoothstep(0.035, 0.035 + fq.x * 1.2, e.x)) * fade.x, spd = (1.0 - smoothstep(0.07, 0.07 + fq.y * 1.2, fract(q.y))) * fade.y;
        vec2 pc = floor(q); float ph = fract(sin(dot(vec3(pc, alongZ), vec3(41.31, 289.17, 11.7))) * 23758.5453), k = glassy * vert * uWinF;
        diffuseColor.rgb *= 1.0 + k * min(fade.x, fade.y) * (ph - 0.5) * 0.32;                                // each pane its own reflection
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.38 + vec3(0.03), k * max(mul, spd) * 0.9); }   // the frame and the floor slab`;
export const WIN_F={ value:REALCITY.windows.frame ?? 1 };   // Z399 the curtain wall's frame by day (0 = the bare texture: before / after)
export function windowLights(m){ const prev=m.onBeforeCompile, pk=m.customProgramCacheKey;
  m.onBeforeCompile=(sh,r)=>{ if(prev) prev.call(m,sh,r); sh.uniforms.uWinShare={ value:REALCITY.windows.share }; sh.uniforms.uWinK=WIN_K; sh.uniforms.uWinF=WIN_F;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWinP;').replace('#include <begin_vertex>','#include <begin_vertex>\n vWinP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWinP; uniform float uWinShare, uWinK, uWinF;').replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      { vec3 bc = diffuseColor.rgb; float lum = dot(bc, vec3(0.299, 0.587, 0.114)), glassy = clamp(smoothstep(0.06, 0.18, bc.b - bc.r) * smoothstep(0.55, 0.2, lum) + smoothstep(0.18, 0.06, lum) * 0.5, 0.0, 1.0);
        ${FACADE_GLSL}
        vec3 cell = floor(vWinP / vec3(${REALCITY.windows.cell[0].toFixed(2)}, ${REALCITY.windows.cell[1].toFixed(2)}, ${REALCITY.windows.cell[0].toFixed(2)})); float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        vec3 tint = mix(vec3(1.0, 0.7, 0.36), vec3(0.78, 0.88, 1.0), step(0.78, fract(h * 7.3)));
        totalEmissiveRadiance += uWinK * glassy * step(1.0 - uWinShare, h) * tint * (0.55 + 0.45 * fract(h * 13.1)) * ${REALCITY.windows.k.toFixed(2)}; }`); };
  m.customProgramCacheKey=()=>(pk?pk.call(m):'')+'|win'; return m; }
function meshyBuilding(M, kind, ox,oz,ry,w,d,hpPer,col,FH){ const y0=heightAt(ox,oz)-0.05, s=M.size, k=Math.min(w/s.x, d/s.z), H=s.y*k, n=Math.max(2, Math.min(40, Math.round(H/FH)));
  const Bd=newBld(kind, ox,oz,ry, s.x*k, s.z*k, y0, hpPer, col), bands=floorBands(M, n), b=bucket('mb_'+M.key, ()=>pieceHook(windowLights(M.mat.clone())), true);   // Z280 lit windows at night
  bands.forEach((band,i)=>{ floorPiece(Bd, y0+H*i/n, y0+H*(i+1)/n); if(!band.attributes.position.count) return; const g=band.clone(); g.scale(k,k,k); b.geos.push(place(g, ox, y0, oz, ry)); });
  endBld(Bd); return H; }
function tubeHouse(ox,oz,ry,w,d){ const floors=2+((Math.random()*4)|0), col=WALLC[(Math.random()*WALLC.length)|0], y0=heightAt(ox,oz)-0.05, FH=3.2, H=3.6+floors*FH;
  const Bd=newBld('tube', ox,oz,ry,w,d,y0, 105, col), shop=tubeShop(col, SIGNS[(Math.random()*SIGNS.length)|0]), up=tubeFloor(col);
  floorPiece(Bd, y0, y0+3.6); facade('shop'+col+shop.t.uuid, shop).geos.push(place(boxUV(w,3.6,d,w,3.6), ox, y0+1.8, oz, ry));
  local(0, y0+3.75, d/2+0.6, w, 0.08, 1.4, ox,oz,ry, [0x2a7ac8,0xc83a2a,0x2a9a5a,0xe8a41a][(Math.random()*4)|0]);                                            // shop awning
  if(Math.random()<0.5) for(let k=0;k<2;k++) local(-w/2+0.5+k*0.7, y0+0.25, d/2+0.6, 0.45, 0.45, 0.45, ox,oz,ry, [0xc82a2a,0x2a6ac8][k]);                      // plastic stools out front
  for(let f=0;f<floors;f++){ const fy=y0+3.6+f*FH; floorPiece(Bd, fy, fy+FH); facade('tube'+col, up).geos.push(place(boxUV(w,FH,d,w,FH), ox, fy+FH/2, oz, ry));
    local(0, fy+0.05, d/2+0.35, w-0.2, 0.14, 0.7, ox,oz,ry, 0xd8d4c8);                                                                                       // balcony slab
    if(Math.random()<0.55){ const ax=_R(-w/2+0.6,w/2-0.6); local(ax, fy+2.3, d/2+0.2, 0.8, 0.55, 0.32, ox,oz,ry, 0xdcdcd4); local(ax, fy+2.3, d/2+0.37, 0.42, 0.42, 0.02, ox,oz,ry, 0x3a3c3e); }   // AC condenser
    if(Math.random()<0.3){ const cw=w*0.7; for(let k=0;k<=6;k++) local(-cw/2+k*cw/6, fy+1.9, d/2+0.75, 0.04, 1.9, 0.04, ox,oz,ry, 0x3a3a38); for(const yy of [0.95,1.9,2.85]) local(0, fy+yy, d/2+0.75, cw, 0.05, 0.05, ox,oz,ry, 0x3a3a38); local(0, fy+2.85, d/2+0.42, cw, 0.05, 0.7, ox,oz,ry, 0x4a4a46); }   // iron cage (chuồng cọp)
    else if(Math.random()<0.5) for(let k=0;k<3;k++) localG(new THREE.SphereGeometry(_R(0.22,0.34),7,5), _R(-w/2+0.5,w/2-0.5), fy+0.45, d/2+0.45, ox,oz,ry, [0x3e7a2e,0x5a8a3a,0x2e6a2a][k]);   // potted plants
    if(f===0 && Math.random()<0.5) local(w/2-0.35, fy+FH*0.55, d/2+0.75, 0.14, FH*0.9, 0.95, ox,oz,ry, [0xd82a2a,0x2a6ad8,0xf0c020,0x1a9a5a,0xe8e8e0][(Math.random()*5)|0]); }   // vertical shop sign
  local(0, y0+H+0.35, 0, w+0.1, 0.7, d+0.1, ox,oz,ry, 0xb8b4aa);                                                                                            // parapet
  if(Math.random()<0.3){ const sh=new THREE.Shape(); sh.moveTo(-1.6,0); sh.lineTo(1.6,0); sh.lineTo(0,1.3); sh.closePath(); const g=new THREE.ExtrudeGeometry(sh,{ depth:w+0.3, bevelEnabled:false }); g.translate(0,0,-(w+0.3)/2); g.rotateY(Math.PI/2); localG(g, 0, y0+H+0.7, d/2-1.6, ox,oz,ry, 0xa84a2a); }   // little tiled roof over the front (mái thái)
  else if(Math.random()<0.8){ const t=new THREE.CylinderGeometry(0.55,0.55,1.3,10); t.rotateZ(Math.PI/2); const bx=_R(-w/4,w/4), bz=-d/4; localG(t, bx, y0+H+1.4, bz, ox,oz,ry, 0xd8dcde); local(bx, y0+H+0.8, bz, 0.9, 0.4, 0.4, ox,oz,ry, 0x6a6c6e); }   // inox water tank
  if(Math.random()<0.35){ const g=new THREE.CylinderGeometry(0.45,0.08,0.18,12); g.rotateX(-0.9); localG(g, _R(-w/3,w/3), y0+H+1.3, d/4, ox,oz,ry, 0xe8e8e4); }   // satellite dish
  endBld(Bd); return H; }
function apartment(ox,oz,ry,w,d){ { const h=realOrWait('apartment', 'apartment', ox,oz,ry,w,d, 130, '#d0c8b8', 3.2); if(h!=null) return h; }   // Z264 · Z267
  const floors=5+((Math.random()*5)|0), col=['#d8d0c0','#c8d4dc','#e0c8a8','#d0c8b8'][(Math.random()*4)|0], y0=heightAt(ox,oz)-0.05, FH=3.2, H=floors*FH, T=apart(col);
  const Bd=newBld('apartment', ox,oz,ry,w,d,y0, 130, col);
  for(let f=0;f<floors;f++){ const fy=y0+f*FH; floorPiece(Bd, fy, fy+FH); facade('ap'+col, T).geos.push(place(boxUV(w,FH,d,4,FH), ox, fy+FH/2, oz, ry));
    if(f>0) for(const px of [-w/4, w/4]) if(Math.random()<0.6) local(px+_R(-1,1), fy+0.4, d/2+0.2, 0.8, 0.55, 0.32, ox,oz,ry, 0xdcdcd4); }
  local(0, y0+H+0.3, 0, w+0.2, 0.6, d+0.2, ox,oz,ry, 0x9a968e); for(let k=0;k<3;k++) local(_R(-w/3,w/3), y0+H+1.0, _R(-d/4,d/4), 1.4, 1.0, 1.2, ox,oz,ry, 0xc8ccd0);
  endBld(Bd); return H; }
function officeTower(ox,oz,ry,w,d){ { const h=realOrWait('tower', 'tower', ox,oz,ry,w,d, 190, '#8a98a2', 3.4); if(h!=null) return h; }   // Z264 · Z267
  const floors=9+((Math.random()*9)|0), FH=3.4, y0=heightAt(ox,oz)-0.05, T=office((Math.random()*2)|0), Bd=newBld('tower', ox,oz,ry,w,d,y0, 190, '#8a98a2');
  for(let f=0;f<floors;f+=3){ const n=Math.min(3, floors-f), fy=y0+f*FH; floorPiece(Bd, fy, fy+n*FH); facade('of'+T.t.uuid, T, true).geos.push(place(boxUV(w,n*FH,d,8,FH*4), ox, fy+n*FH/2, oz, ry)); }
  const top=y0+floors*FH; local(0, top+0.3, 0, w+0.2, 0.6, d+0.2, ox,oz,ry, 0x6a7078);
  if(Math.random()<0.5) facade('of'+T.t.uuid, T, true).geos.push(place(boxUV(w*0.6,FH*3,d*0.6,8,FH*4), ox, top+FH*1.5, oz, ry));                       // setback crown
  localG(new THREE.CylinderGeometry(0.06,0.1,6,5), w*0.2, top+FH*3+3, 0, ox,oz,ry, 0x8a8e92); endBld(Bd); return top-y0; }
const VWALL=['#e2d4a8','#e8e4da','#d8bc84','#dcc2b6','#c8d6c8','#e6dac2'], VSHUT=['#3e6a4a','#34546e','#4a6040','#5e7484'];   // Z242 faded villa ochres
function villaHouse(ox,oz,ry,w,d){ { const h=realOrWait('villa', 'villa', ox,oz,ry,w,d, 150, '#e2d4a8', 3.6); if(h!=null) return h; }   // Z266 · Z267
  const y0=heightAt(ox,oz)-0.05, FH=3.6, PL=0.6, col=VWALL[(Math.random()*VWALL.length)|0], T=villaBay(col, VSHUT[(Math.random()*VSHUT.length)|0]), Bd=newBld('villa', ox,oz,ry,w,d,y0, 150, col);
  floorPiece(Bd, y0, y0+PL+FH); local(0, y0+PL/2, 0.6, w+0.8, PL, d+2.6, ox,oz,ry, 0xc8c2b4);                                                                // stone plinth (porch included)
  facade('vl'+col+T.t.uuid, T).geos.push(place(boxUV(w,FH,d,4.2,FH), ox, y0+PL+FH/2, oz, ry));
  for(const sx of [-1.7,-0.6,0.6,1.7]){ localG(new THREE.CylinderGeometry(0.16,0.18,FH,10), sx, y0+PL+FH/2, d/2+1.6, ox,oz,ry, 0xf4f0e6); local(sx, y0+PL+0.12, d/2+1.6, 0.42, 0.24, 0.42, ox,oz,ry, 0xd8d2c4); }   // porch columns
  for(let k=0;k<3;k++) local(0, y0+PL*(1-k/3)-0.1, d/2+2.0+k*0.35, 3.2, 0.2, 0.36, ox,oz,ry, 0xc8c2b4);                                                       // front steps
  local(0, y0+PL+FH+0.12, 0, w+0.36, 0.24, d+0.36, ox,oz,ry, 0xf2eee4);                                                                                       // cornice
  floorPiece(Bd, y0+PL+FH, y0+PL+FH*2); facade('vl'+col+T.t.uuid, T).geos.push(place(boxUV(w,FH,d,4.2,FH), ox, y0+PL+FH*1.5, oz, ry));
  local(0, y0+PL+FH+0.1, d/2+1.1, 4.4, 0.22, 2.4, ox,oz,ry, 0xf2eee4);                                                                                      // porch roof = balcony
  for(let k=0;k<12;k++) localG(new THREE.CylinderGeometry(0.05,0.07,0.8,6), -2.0+k*0.364, y0+PL+FH+0.62, d/2+2.2, ox,oz,ry, 0xf4f0e6); local(0, y0+PL+FH+1.05, d/2+2.2, 4.4, 0.1, 0.16, ox,oz,ry, 0xf2eee4);   // balustrade
  local(0, y0+PL+FH*2+0.12, 0, w+0.5, 0.24, d+0.5, ox,oz,ry, 0xf2eee4);                                                                                       // eaves cornice
  const hR=2.6, rf=new THREE.ConeGeometry(1, hR, 4, 1).toNonIndexed(); rf.rotateY(Math.PI/4); rf.scale((w+1.4)/1.414, 1, (d+1.4)/1.414); rf.computeVertexNormals();
  localG(rf, 0, y0+PL+FH*2+0.24+hR/2, 0, ox,oz,ry, [0xb5532e,0xa04628,0x8a4a3a][(Math.random()*3)|0]);                                                      // pavilion roof, old terracotta
  local(w*0.28, y0+PL+FH*2+2.0, -d*0.18, 0.6, 1.6, 0.6, ox,oz,ry, 0xd8d0c0);                                                                                 // chimney
  endBld(Bd); }
// a villa's own walled garden: lawn, a drive with a car (or one under a tarp), trees, painted block walls, a wrought-iron gate
function villaLot(cx,cz,ry,lw,ld,cars,trees){ const vw=_R(10.5,12.5), vd=_R(8.5,10), vz=-ld/2+vd/2+2.2, [vx0,vz0]=L2W(0,vz,cx,cz,ry);
  strip('lawn', ()=>new THREE.MeshStandardMaterial({ map:parkT().t, roughness:0.95 }), cx, cz, lw-0.6, ld-0.6, ry, 0.06, 4, 4);
  villaHouse(vx0, vz0, ry, vw, vd); CURP=0;
  const wc=0xe4dcc8, cap=0xb07a5a, local=vwall;   // Z267 the garden walls in photographed rendered concrete, painted cream, a terracotta coping
  for(const sd of [-1,1]){ local(sd*lw/2, 0.8, 0, 0.3, 1.6, ld, cx,cz,ry, wc); local(sd*lw/2, 1.65, 0, 0.42, 0.12, ld+0.1, cx,cz,ry, cap); }
  local(0, 0.8, -ld/2, lw, 1.6, 0.3, cx,cz,ry, wc); local(0, 1.65, -ld/2, lw+0.1, 0.12, 0.42, cx,cz,ry, cap);
  const gw=3.4; for(const sd of [-1,1]){ const L=(lw-gw)/2; local(sd*(gw/2+L/2), 0.8, ld/2, L, 1.6, 0.3, cx,cz,ry, wc); local(sd*(gw/2+L/2), 1.65, ld/2, L+0.1, 0.12, 0.42, cx,cz,ry, cap);
    local(sd*gw/2, 1.5, ld/2, 0.55, 3.0, 0.55, cx,cz,ry, 0xf0e8d4); local(sd*gw/2, 3.07, ld/2, 0.7, 0.14, 0.7, cx,cz,ry, cap); }   // gate pillars, as tall as the gate
  { const [gx,gz]=L2W(0, ld/2, cx,cz,ry); prop('prop_gate', gx, gz, ry, ()=>{ for(let k=0;k<9;k++){ const [bx,bz]=L2W(-gw/2+0.25+k*0.11, ld/2+0.6+k*0.06, cx,cz,ry); det(new THREE.BoxGeometry(0.04,1.7,0.04), bx, 0.95, bz, ry, 0x1e1e1c); } }); }   // Z267 the photoscanned wrought-iron gate (bars only if it fails)
  strip('drive', ()=>detailize(new THREE.MeshStandardMaterial({ map:walkT().t, roughness:0.9 }), { scale:0.6, bump:0.01, alb:0.3, foot:0, streak:0 }), ...L2W(0,ld/2-2.6,cx,cz,ry), 3.2, 5.2, ry, 0.08, 2, 2);
  if(Math.random()<0.8){ const [x,z]=L2W(_R(-0.4,0.4), ld/2-2.8, cx,cz,ry), cry=ry+(Math.random()<0.5?0:Math.PI); if(Math.random()<0.25) prop('prop_tarpcar', x, z, cry); else cars.push(pickCar({ x, z, ry:cry }, 0.03)); }   // Z267 now and then a car kept under a tarp
  for(let k=0;k<2+((Math.random()*2)|0);k++){ const [x,z]=L2W(_R(-lw/2+1.5,lw/2-1.5), _R(ld/2-2.5,ld/2-1.2)*(Math.random()<0.5?1:-0.6), cx,cz,ry); trees.push({ x, z, s:_R(0.8,1.15), ry:_R(0,6.28) }); } }
// ---------- city furniture ----------
function benchP(x,z,ry){ det(new THREE.BoxGeometry(1.6,0.08,0.45), x, heightAt(x,z)+0.45, z, ry, 0x7a5a3a); const [bx,bz]=L2W(0,-0.22,x,z,ry); det(new THREE.BoxGeometry(1.6,0.45,0.06), bx, heightAt(x,z)+0.72, bz, ry, 0x7a5a3a);
  for(const s of [-0.7,0.7]){ const [lx,lz]=L2W(s,0,x,z,ry); det(new THREE.BoxGeometry(0.08,0.45,0.42), lx, heightAt(x,z)+0.22, lz, ry, 0x2a2a28); } }
function busStopP(x,z,ry){ const y=heightAt(x,z); for(const s of [-1.6,1.6]){ const [px,pz]=L2W(s,-0.6,x,z,ry); det(new THREE.BoxGeometry(0.08,2.6,0.08), px, y+1.3, pz, ry, 0x6a6c6e); }
  const [rx,rz]=L2W(0,-0.1,x,z,ry); det(new THREE.BoxGeometry(3.6,0.1,1.6), rx, y+2.65, rz, ry, 0x2a5a8a); const [gx,gz]=L2W(0,-0.65,x,z,ry); det(new THREE.BoxGeometry(3.4,1.8,0.04), gx, y+1.4, gz, ry, 0x9ab4c4);
  det(new THREE.BoxGeometry(3.0,0.08,0.4), rx, y+0.5, rz, ry, 0x8a8c8e); }
function stallP(x,z,ry){ const y=heightAt(x,z), uc=[0xd83a2a,0x2a7ad8,0xf0c020,0x2aa05a,0xe8e8e0][(Math.random()*5)|0];
  det(new THREE.BoxGeometry(1.4,0.08,0.9), x, y+0.75, z, ry, 0x9a7a52); for(const [a,b] of [[-0.6,-0.38],[0.6,-0.38],[-0.6,0.38],[0.6,0.38]]){ const [lx,lz]=L2W(a,b,x,z,ry); det(new THREE.BoxGeometry(0.05,0.75,0.05), lx, y+0.37, lz, ry, 0x4a4a48); }
  det(new THREE.BoxGeometry(1.2,0.18,0.7), x, y+0.88, z, ry, [0xd8b060,0xc84a3a,0x6aa04a,0xe8e0c8][(Math.random()*4)|0]);                                        // the goods
  det(new THREE.CylinderGeometry(0.03,0.03,2.2,5), x, y+1.1, z, 0, 0x6a6a6a); const um=new THREE.ConeGeometry(1.5,0.55,8); det(um, x, y+2.3, z, ry, uc);
  for(let k=0;k<2;k++){ const [sx,sz]=L2W(_R(-1,1),_R(0.9,1.5),x,z,ry); det(new THREE.BoxGeometry(0.34,0.36,0.34), sx, y+0.18, sz, 0, [0xc82a2a,0x2a6ac8][k]); } }
function fountainP(x,z){ const y=heightAt(x,z); det(new THREE.CylinderGeometry(4.2,4.4,0.6,28), x, y+0.3, z, 0, 0xc8c2b4); det(new THREE.CylinderGeometry(3.8,3.8,0.04,28), x, y+0.52, z, 0, 0x4a8ab0);
  det(new THREE.CylinderGeometry(0.5,0.7,1.6,12), x, y+1.2, z, 0, 0xd8d2c4); det(new THREE.CylinderGeometry(1.4,0.6,0.3,16), x, y+2.0, z, 0, 0xd8d2c4); det(new THREE.SphereGeometry(0.3,10,8), x, y+2.4, z, 0, 0xd8d2c4); }
function gazeboP(x,z){ const y=heightAt(x,z); det(new THREE.CylinderGeometry(3,3,0.3,6), x, y+0.15, z, 0, 0xc8c2b4); for(let k=0;k<6;k++){ const a=k/6*6.283; det(new THREE.CylinderGeometry(0.12,0.12,2.8,8), x+Math.cos(a)*2.6, y+1.7, z+Math.sin(a)*2.6, 0, 0xf2eee4); }
  det(new THREE.ConeGeometry(3.4,1.6,6), x, y+3.9, z, 0, 0xa84a2a); }
// Z267 REAL STREET FURNITURE: benches, bus stops, market stalls, park fountains, bins, hydrants, pavement cafés, concrete blocks, villa gates and
//   tarp-covered cars are photoscanned (Poly Haven) or Meshy models, instanced per model once they have loaded; the procedural piece is only the
//   fallback when a model fails. The villa walls are photographed concrete (world/stone.js) instead of flat paint.
let PP=null;
const prop=(k,x,z,ry,fb,y)=>{ PP.push({ k, x, z, ry:ry||0, y:y||0, fb }); };
function bench(x,z,ry){ prop('prop_bench', x, z, ry, ()=>benchP(x,z,ry)); }
function busStop(x,z,ry){ const y=heightAt(x,z), [sx,sz]=L2W(1.9,0,x,z,ry); det(new THREE.BoxGeometry(0.06,2.2,0.06), sx, y+1.1, sz, ry, 0x6a6c6e); det(new THREE.BoxGeometry(0.5,0.5,0.04), sx, y+2.2, sz, ry, 0x2a6ad8);   // the stop's sign
  prop('prop_bench', x-Math.sin(ry)*0.3, z-Math.cos(ry)*0.3, ry, ()=>busStopP(x,z,ry)); const [hx,hz]=L2W(-2.1,0.1,x,z,ry); prop('prop_bin', hx, hz, _R(0,6.28)); }
function stall(x,z,ry){ prop('city_stall', x, z, ry, ()=>stallP(x,z,ry)); for(let k=0;k<1+((Math.random()*2)|0);k++){ const [cx,cz]=L2W(_R(-1.2,1.2), _R(1.1,1.7)*(Math.random()<0.5?1:-1), x,z,ry); prop('prop_chair', cx, cz, _R(0,6.28)); } }
function fountain(x,z,fb){ prop('city_fountain', x, z, _R(0,6.28), fb||(()=>fountainP(x,z))); }
const vwall=(bx,by,bz,w,h,d,ox,oz,ry,tone)=>{ const [x,z]=L2W(bx,bz,ox,oz,ry); bucket('vwall', ()=>stoneMat('t_concrete_wall_002')).geos.push(tag(stoneBox(w,h,d,x,by,z,2.4,tone,ry),0)); };
// the street furniture in: one instanced mesh per model (its material list), each piece on the ground, turned; whatever has no model falls back
// Z311 the street furniture is solid for a ride (a bike, a horse): its footprint and height off its own model; the light pieces (RIDE_HIT.knock) can be
//   knocked over — they lie where they fell and no longer stop anything
export const CITY_PROPS=[];
function placeProps(list, gen, anchor){ if(gen!==CITY_GEN || (anchor && !anchor.parent)) return; const by=new Map(), fbs=[];
  for(const q of list){ const m=cityProp(q.k); if(m){ if(!by.has(m)) by.set(m,[]); by.get(m).push(q); } else if(q.fb) fbs.push(q.fb); }
  for(const [m,L] of by){ const im=new THREE.InstancedMesh(m.geo, m.mats, L.length); if(!m.geo.boundingBox) m.geo.computeBoundingBox(); const bb=m.geo.boundingBox, ph=bb.max.y-bb.min.y, pr=Math.max(0.3, 0.42*Math.max(bb.max.x-bb.min.x, bb.max.z-bb.min.z));
    const sink=(REALCITY.props[m.key]||{}).sink||0; L.forEach((q,k)=>{ const y=heightAt(q.x,q.z)+REALCITY.lift.prop+q.y-sink; _M4.compose(_v3.set(q.x, y, q.z), _qy.setFromEuler(_eu.set(0,q.ry,0)), _one); im.setMatrixAt(k,_M4);
      CITY_PROPS.push({ x:q.x, z:q.z, y, ry:q.ry, r:pr, h:ph, key:m.key, knock:RIDE_HIT.knock.includes(m.key), im, k, down:false }); });
    im.castShadow=!MOBILE; im.receiveShadow=true; im.computeBoundingSphere(); arena.add(im); LAND.meshes.push(im); for(const g of m.glows) if(!LAND.mats.includes(g)) LAND.mats.push(g); }
  if(fbs.length){ B=new Map(); P=[]; CURP=0; for(const f of fbs) f(); flushBuckets(); B=null; P=null; } }
// the lamps and signals are built at once (they topple): their meshes take the real models when these are in — the lantern post (its glass and
//   bulb light at night), the signal head on its steel pole
function dressPoles(lampIm, headIm, sigIm){ const L=cityProp('prop_lamp'), Sg=cityProp('city_signal');
  if(L && lampIm){ lampIm.geometry=L.geo; lampIm.material=L.mats; lampIm.computeBoundingSphere(); for(const g of L.glows) if(!LAND.mats.includes(g)) LAND.mats.push(g);
    if(headIm){ const b=L.bulb||{ y:L.size.y*0.85, r:0.06 }, g=new THREE.SphereGeometry(Math.max(0.05,b.r),10,8); g.translate(0,b.y,0); headIm.geometry=g; headIm.computeBoundingSphere(); } }
  if(Sg && sigIm){ const y0=REALCITY.signalAt, pole=new THREE.CylinderGeometry(0.075,0.09,y0+0.4,10); pole.translate(0,(y0+0.4)/2,0);
    const top=Sg.geo.clone(); top.translate(0,y0,0); const groups=top.groups.length?top.groups:[{ start:0, count:top.attributes.position.count, materialIndex:0 }];
    const p=pole.toNonIndexed(); p.clearGroups(); const g=mergeGeometries([p, top.index?top.toNonIndexed():top], false), n=p.attributes.position.count;
    g.clearGroups(); g.addGroup(0, n, 0); groups.forEach(G0=>g.addGroup(n+G0.start, G0.count, G0.materialIndex+1));
    sigIm.geometry=g; sigIm.material=[new THREE.MeshStandardMaterial({ color:0x7a7e80, roughness:0.45, metalness:0.7 }), ...Sg.mats]; sigIm.computeBoundingSphere(); } }
// ---------- road strips ----------
let strip=null;

// ---------- the district ----------
// Z265 street ironwork: cast-iron manhole covers (raised pattern, a rim, rust in the grooves) and gutter grates (slots), instanced, flush with the road
const ironT=(k)=>tex(k,128,128,(x)=>{ x.fillStyle='#2e2c2a'; x.fillRect(0,0,128,128);
  if(k==='mh'){ x.strokeStyle='#4a4642'; x.lineWidth=6; x.beginPath(); x.arc(64,64,58,0,7); x.stroke(); x.lineWidth=3; for(let r=14;r<54;r+=10){ x.beginPath(); x.arc(64,64,r,0,7); x.stroke(); }
    for(let a=0;a<12;a++){ x.beginPath(); x.moveTo(64+Math.cos(a/12*6.283)*14,64+Math.sin(a/12*6.283)*14); x.lineTo(64+Math.cos(a/12*6.283)*52,64+Math.sin(a/12*6.283)*52); x.stroke(); } }
  else { x.fillStyle='#4a4642'; x.fillRect(4,4,120,120); x.fillStyle='#0c0b0a'; for(let i=0;i<9;i++) x.fillRect(12+i*12.5,14,6,100); }
  for(let n=0;n<160;n++){ x.fillStyle='rgba('+(110+Math.random()*60|0)+','+(60+Math.random()*30|0)+',30,'+(Math.random()*0.25)+')'; x.fillRect(Math.random()*128,Math.random()*128,3,3); } });
function drawFixtures(fix){ const M4=new THREE.Matrix4(), Q=new THREE.Quaternion(), V=new THREE.Vector3(), S1=new THREE.Vector3(1,1,1), up=new THREE.Vector3(0,1,0);
  for(const k of ['mh','dr']){ const L=fix.filter(f=>f.k===k); if(!L.length) continue; const T=ironT(k), geo=k==='mh'?new THREE.CylinderGeometry(0.42,0.42,0.03,24):new THREE.BoxGeometry(0.42,0.03,0.85);
    const m=new THREE.MeshStandardMaterial({ map:T.t, bumpMap:T.t, bumpScale:2, roughness:0.62, metalness:0.55, envMapIntensity:0.8 }), im=new THREE.InstancedMesh(geo, m, L.length);
    L.forEach((f,i)=>{ const [x,z]=f.p; im.setMatrixAt(i, M4.compose(V.set(x, heightAt(x,z)+0.05, z), Q.setFromAxisAngle(up, f.ry), S1)); });
    im.instanceMatrix.needsUpdate=true; im.receiveShadow=true; arena.add(im); LAND.meshes.push(im); } }
// one mesh per material bucket + the merged detail mesh (pieces honoured), into the scene
function flushBuckets(){ for(const [k,b] of B){ if(!b.geos.length) continue; const g=mergeGeometries(b.geos.map(q=>q.index?q.toNonIndexed():q), false); b.geos.forEach(q=>q.dispose()); const m=new THREE.Mesh(g, b.mat);
    m.castShadow=!/road|walk|zebra|park|bvd|median|path|lawn|drive|pitch/.test(k); m.receiveShadow=true; if(b.pieces) m.customDepthMaterial=depthMat(); arena.add(m); LAND.meshes.push(m); }
  if(P.length){ const m=new THREE.Mesh(mergeP(P), pieceHook(detailize(new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.8, metalness:0.1 }), { scale:0.6, bump:0.012, alb:0.3, foot:0.8, streak:0.2 }))); m.customDepthMaterial=depthMat(); m.castShadow=true; m.receiveShadow=true; arena.add(m); LAND.meshes.push(m); } }
// Z267 NO BLOCKY STAND-INS: a lot built before the Meshy buildings have loaded waits (empty) and its building rises the moment they arrive —
//   same lot, same breakable floors — instead of a procedural block; only a city whose models failed outright keeps procedural buildings
const PENDING=[]; let CITY_GEN=0;
function realOrWait(role, kind, ox,oz,ry,w,d,hpPer,col,FH){ const M=pickBuilding(role); if(M) return meshyBuilding(M, kind, ox,oz,ry,w,d,hpPer,col,FH);
  if(typeof window==='undefined' || realCityReady() || REALCITY.share<1) return null; PENDING.push({ role, kind, ox,oz,ry,w,d,hpPer,col,FH, gen:CITY_GEN }); return 3*FH; }
function flushPending(){ const list=PENDING.splice(0).filter(q=>q.gen===CITY_GEN); if(!list.length || !realCityReady()) return; B=new Map(); P=[];
  for(const q of list){ const M=pickBuilding(q.role); if(M) meshyBuilding(M, q.kind, q.ox,q.oz,q.ry,q.w,q.d,q.hpPer,q.col,q.FH); }
  CURP=0; flushBuckets(); B=null; P=null; }
export function buildCityDistrict(){ resetCity(); pcInit(); B=new Map(); P=[]; PP=[]; CURP=0; const fix=[]; CITY_GEN++; PENDING.length=0;
  const lantern=typeof window!=='undefined' && REALCITY.share>=1;   // Z267 one lantern post stands where the procedural median had a lamp each way
  const n=Math.ceil(ARENA/G), cars=[], trees=[], palms=[], lamps=[], lights=[], poles=[], chains=[], roads=[];
  const inCity=(x,z,m)=>inField(x,z,m||4) && !inZone(x,z,3) && Math.hypot(x,z)>30 && Math.hypot(x,z)<ARENA*0.86;
  const RT=roadT(), BT=bvdT(), WT=walkT(), ZT=zebraT(), PT=parkT();
  const ASP={ set:'asphalt_01', tile:2.08, lanes:true, marks:true, hi:!MOBILE, tint:REALCITY.asphalt }, roadMat=()=>streetSurface(new THREE.MeshStandardMaterial({ map:RT.t, roughness:0.82 }), ASP), bvdMat=()=>streetSurface(new THREE.MeshStandardMaterial({ map:BT.t, roughness:0.8 }), ASP);   // Z265 real asphalt: wheel paths, oil, gutters, patches, cracks, worn paint, puddles
  const walkMat=()=>streetSurface(new THREE.MeshStandardMaterial({ map:WT.t, roughness:0.9 }), { set:'pavement_02', tile:2.12, wet:0.3, tint:REALCITY.pavement }), zebMat=()=>streetSurface(new THREE.MeshStandardMaterial({ map:ZT.t, roughness:0.8 }), { ...ASP, lanes:false }), grassMat=()=>streetSurface(new THREE.MeshStandardMaterial({ map:PT.t, roughness:0.95 }), { set:'sparse_grass', tile:3.12, hard:false, wet:0.12, hi:!MOBILE, tint:REALCITY.lawn });   // Z265 photographed lawn on the medians and parks
  strip=(key,mk,x,z,len,wid,ang,y,tl,tw)=>{ const g=new THREE.PlaneGeometry(len,wid), uv=g.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i, uv.getX(i)*len/tl, uv.getY(i)*(tw?wid/tw:1)); g.rotateX(-Math.PI/2); g.rotateY(ang); g.translate(x, heightAt(x,z)+y, z); bucket(key,mk).geos.push(tag(g,0)); };
  const kerb=(x,z,len,ang)=>{ CURP=0; det(new THREE.BoxGeometry(len,0.18,0.16), x, heightAt(x,z)+0.09, z, ang, 0x8a8a84); };
  const sideRy=(ax,sd)=>ax?(sd>0?-Math.PI/2:Math.PI/2):(sd>0?Math.PI:0);
  // ---- roads: every grid edge between two crossings, if that stretch is open ground ----
  for(let i=-n;i<=n;i++) for(let j=-n;j<n;j++) for(const ax of [0,1]){
    const W=roadW(i), WW=walkW(i), blvd=isBlvd(i), a0=j*G+roadW(j)/2, a1=(j+1)*G-roadW(j+1)/2, L=a1-a0, mid=(a0+a1)/2;
    const at=(s,t)=>ax ? [i*G+t, mid+s] : [mid+s, i*G+t], ang=ax?Math.PI/2:0, [cx,cz]=at(0,0); if(L<6 || !inCity(cx,cz)) continue;
    roads.push({ ax, c:i*G, a0:mid-L/2, a1:mid+L/2, blvd, w:W, med:MED, g:G });   // Z268 for the traffic (Z320 with its width, median and the grid pitch)
    if(blvd){ const cw=(BV-MED)/2; for(const sd of [-1,1]) strip('bvd', bvdMat, ...at(0, sd*(MED/2+cw/2)), L, cw, ang, 0.04, 8);
      strip('median', grassMat, ...at(0,0), L, MED-0.3, ang, 0.14, 4, 4); for(const sd of [-1,1]) kerb(...at(0, sd*MED/2), L, ang);
      for(let s=-L/2+4; s<L/2-3; s+=10){ const [x,z]=at(s,0); if((s/10|0)%2) palms.push({ x, z, s:_R(0.85,1.05), ry:_R(0,6.28) }); else { lamps.push({ x, z, ry:ang+Math.PI/2 }); if(!lantern) lamps.push({ x, z, ry:ang-Math.PI/2 }); } } }
    else strip('road', roadMat, cx, cz, L, W, ang, 0.04, 8);
    { const half=blvd?BV/2:W/2, lanes=blvd?[-(MED/2+(BV-MED)/4), MED/2+(BV-MED)/4]:[0];   // Z265 manhole covers down the lanes, drain grates at the kerbs
      for(let s=-L/2+4; s<L/2-4; s+=_R(16,30)){ const lc=lanes[(Math.random()*lanes.length)|0]+_R(-1.6,1.6); fix.push({ k:'mh', p:at(s, lc), ry:Math.random()*6.28 }); }
      for(const sd of [-1,1]) for(let s=-L/2+5; s<L/2-4; s+=_R(14,24)) fix.push({ k:'dr', p:at(s, sd*(half-0.32)), ry:ang }); }
    const polesSide = !blvd && Math.random()<0.75 ? (Math.random()<0.5?1:-1) : 0, chain=[];
    for(const sd of [-1,1]){ const ow=sd*(W/2+WW/2); strip('walk', walkMat, ...at(0,ow), L, WW, ang, 0.12, 2, 2); kerb(...at(0, sd*(W/2+0.08)), L, ang);
      if(blvd){ for(let s=-L/2+3; s<L/2-2; s+=9){ const [x,z]=at(s, sd*(W/2+WW-0.9)); trees.push({ x, z, s:_R(0.85,1.1), ry:_R(0,6.28) }); }
        for(let s=-L/2+6; s<L/2-4; s+=18){ const [x,z]=at(s, sd*(W/2+0.6)); lamps.push({ x, z, ry:sideRy(ax,sd) }); }
        if(Math.random()<0.35){ const [x,z]=at(_R(-L/4,L/4), sd*(W/2+WW*0.55)); busStop(x, z, sideRy(ax,sd)+Math.PI); } }
      else for(let s=-L/2+3; s<L/2-2; s+=_R(5,9)){ const [x,z]=at(s, ow), r=Math.random();
        if(r<0.1) trees.push({ x, z, s:_R(0.75,1.0), ry:_R(0,6.28) }); else if(r<0.17) lamps.push({ x, z, ry:sideRy(ax,sd) });
        else if(r<0.25){}   // (Z333 no parked scooter rows: the hand-built stand-in scooters are gone)
        else if(r<0.28) prop('prop_bin', x, z, _R(0,6.28), ()=>{ CURP=0; det(new THREE.CylinderGeometry(0.28,0.25,0.9,10), x, heightAt(x,z)+0.45, z, 0, 0x2a7a3a); });   // a bin
        else if(r<0.3){ const [hx,hz]=at(s, sd*(W/2+0.45)); prop('prop_hydrant', hx, hz, sideRy(ax,sd)); }                                                   // Z267 a hydrant at the kerb
        else if(r<0.34){ prop('prop_cafe', x, z, ang+Math.PI/2); s+=2; } }   // Z269 a cyclo parked on the pavement (Tripo, from a photo)                                                                               // Z267 a pavement café table
      if(sd===polesSide) for(let s=-L/2+2; s<=L/2-2; s+=_R(10,13)){ const [x,z]=at(s, sd*(W/2+0.45)); const o={ x, z, ry:ang, spans:[] }; poles.push(o); chain.push(o); }
      // parked cars along the kerb lane
      const lane=sd*(W/2-1.3); for(let s=-L/2+4; s<L/2-4; s+=_R(6,13)) if(Math.random()<(blvd?0.2:0.26)){ const [x,z]=at(s, lane);   // Z242 fewer parked cars
 cars.push(pickCar({ x, z, ry:(ax?(sd>0?0:Math.PI):(sd>0?Math.PI/2:-Math.PI/2))+(Math.random()-0.5)*0.06 })); s+=2; } }
    if(chain.length>1) chains.push(chain);
    if(Math.random()<0.1){ const [x,z]=at(_R(-L/3,L/3), _R(-W/4,W/4)); cars.push(pickCar({ x, z, ry:ang+_R(-0.8,0.8) }, 0.6)); } }   // a car abandoned in the road, often burnt out
  // ---- crossings: asphalt, zebra crossings on every arm, traffic lights ----
  roads.xing=new Set();   // Z320 the crossings that are laid (the traffic crosses and U-turns only on asphalt)
  for(let i=-n;i<=n;i++) for(let j=-n;j<=n;j++){ const x=i*G, z=j*G, wx=roadW(i), wz=roadW(j); if(!inCity(x,z)) continue;
    roads.xing.add(i+','+j); CITY_XING.push({ x, z, wx, wz }); strip('road', roadMat, x, z, wx, wz, 0, 0.035, 64);
    for(const sd of [-1,1]){ strip('zebra', zebMat, x, z+sd*(wz/2+1.8), wx, 3, 0, 0.05, 8, 3); strip('zebra', zebMat, x+sd*(wx/2+1.8), z, wz, 3, Math.PI/2, 0.05, 8, 3); }
    const big=isBlvd(i)||isBlvd(j); for(const [sx,sz] of (big?[[1,1],[-1,1],[1,-1],[-1,-1]]:(Math.random()<0.55?[[1,1]]:[]))) lights.push({ x:x+sx*(wx/2+1.0), z:z+sz*(wz/2+1.0), ry:Math.atan2(-sx,-sz) });
    if(Math.random()<0.22){ const sx=Math.random()<0.5?1:-1, sz=Math.random()<0.5?1:-1; for(let q=0;q<2+((Math.random()*2)|0);q++) prop('prop_barrier', x+sx*(wx/2+2.6+q*1.9), z+sz*(wz/2+1.2), _R(-0.12,0.12)); } }   // Z267 concrete blocks dragged to a corner
  // ---- blocks ----
  let towers=0;
  for(let i=-n;i<n;i++) for(let j=-n;j<n;j++){ const x0=i*G+roadW(i)/2+walkW(i)+0.4, x1=(i+1)*G-roadW(i+1)/2-walkW(i+1)-0.4, z0=j*G+roadW(j)/2+walkW(j)+0.4, z1=(j+1)*G-roadW(j+1)/2-walkW(j+1)-0.4;
    const cx=(x0+x1)/2, cz=(z0+z1)/2, w=x1-x0, d=z1-z0, R=Math.max(w,d)/2, dC=Math.hypot(cx,cz);
    if(w<14 || d<14 || !inField(cx,cz,R+2) || inZone(cx,cz,R*0.9) || dC<R+24 || dC>ARENA*0.82) continue;
    const OB=OPEN_LAND.CITY.built, k=OB/0.66; let r=Math.random(); if(dC<80 && r<0.45) r=OB+Math.random()*(1-OB);                    // room to fight near the middle: squares, parks, a pitch · Z242 fewer blocks built up (OPEN_LAND)
    const built = r<OB; if(built) ZONES.push({ kind:'landmark', x:cx, z:cz, r:Math.min(w,d)/2*0.95 });
    if(r<0.34*k){ const dep=_R(9.5,12); for(const side of [1,-1]){ let a=-w/2+0.2; const ry=side>0?0:Math.PI;                                  // tube-house rows on both long edges, a back alley between
        while(a<w/2-3.5){ const big=REALCITY.share>=1 || !!pickBuilding('row'), hw=big?Math.min(_R(11,14), w/2-a):_R(4,6.4); if(a+hw>w/2 || (big && hw<9)) break; if(!big || realOrWait('row', 'tube', cx+a+hw/2, cz+side*(d/2-dep/2), ry, hw, dep, 100, '#d6c48e', 3.2)==null) tubeHouse(cx+a+hw/2, cz+side*(d/2-dep/2), ry, hw, dep); a+=hw; if(Math.random()<0.25) a+=_R(2.5,5); } }   // Z264 · Z266 the rows are Meshy townhouse rows (procedural only before the models load)   // Z242 gaps in the row: yards, alleys
      CURP=0; for(let k=0;k<3;k++) trees.push({ x:cx+_R(-w/2,w/2)*0.8, z:cz+_R(-1,1)*Math.max(0,d/2-dep-1), s:_R(0.7,0.95), ry:_R(0,6.28) }); }
    else if(r<0.5*k){ for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) villaLot(cx+sx*w/4, cz+sz*d/4, sz>0?0:Math.PI, w/2-0.6, d/2-0.6, cars, trees); }   // four walled villas
    else if(r<0.6*k){ for(const side of [1,-1]) apartment(cx, cz+side*(d/2-6), side>0?0:Math.PI, w*0.8, 11); CURP=0;                           // two slabs round a courtyard
      strip('walk', walkMat, cx, cz, w*0.8, Math.max(4,d-24), 0, 0.1, 2, 2); for(let k=0;k<4;k++) trees.push({ x:cx+_R(-w/3,w/3), z:cz+_R(-2,2), s:_R(0.8,1.05), ry:_R(0,6.28) });
      for(let k=0;k<3;k++) cars.push(pickCar({ x:cx+_R(-w/3,w/3), z:cz+_R(-1.5,1.5), ry:Math.PI/2*(Math.random()<0.5?1:-1) }, 0.05)); }
    else if(r<OB && towers<4 && dC>95){ officeTower(cx, cz, (Math.random()<0.5?0:Math.PI/2), _R(14,18), _R(14,18)); towers++; CURP=0; strip('walk', walkMat, cx, cz, w, d, 0, 0.1, 2, 2);
      for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) trees.push({ x:cx+sx*(w/2-2), z:cz+sz*(d/2-2), s:1.0, ry:_R(0,6.28) }); }
    else if(r<OB){ for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) villaLot(cx+sx*w/4, cz+sz*d/4, sz>0?0:Math.PI, w/2-0.6, d/2-0.6, cars, trees); }
    else if(r<0.7){ CURP=0; strip('park', grassMat, cx, cz, w, d, 0, 0.06, 4, 4);                                                          // a PARK: cross paths, fountain or gazebo, benches, lamps, trees, flower beds
      strip('path', walkMat, cx, cz, w, 3, 0, 0.09, 2, 2); strip('path', walkMat, cx, cz, 3, d, 0, 0.091, 2, 2);
      fountain(cx, cz, Math.random()<0.6?null:()=>gazeboP(cx,cz));   // Z267 a real stone fountain (the gazebo only as a fallback)
      for(const [sx,sz] of [[-1,0],[1,0],[0,-1],[0,1]]){ const bx=cx+sx*(w/4), bz=cz+sz*(d/4); bench(bx+(sz?2.2:0), bz+(sx?2.2:0), sx?0:Math.PI/2); lamps.push({ x:bx+(sz?-2.2:0), z:bz+(sx?-2.2:0), ry:0 }); }
      for(let k=0;k<(MOBILE?5:9);k++){ let x, z, t=0; do { x=cx+_R(-w/2+2,w/2-2); z=cz+_R(-d/2+2,d/2-2); t++; } while(t<8 && (Math.abs(x-cx)<3.5 || Math.abs(z-cz)<3.5)); trees.push({ x, z, s:_R(0.9,1.35), ry:_R(0,6.28) }); }
      for(let k=0;k<2;k++){ const x=cx+_R(-w/2+3,w/2-3), z=cz+_R(-d/2+3,d/2-3); if(Math.abs(x-cx)<4 || Math.abs(z-cz)<4) continue; det(new THREE.BoxGeometry(_R(2,3.5),0.3,_R(1.2,2)), x, heightAt(x,z)+0.2, z, _R(0,3), 0x7a5a3a);
        for(let q=0;q<6;q++) det(new THREE.SphereGeometry(_R(0.18,0.3),6,4), x+_R(-1,1), heightAt(x,z)+0.45, z+_R(-0.6,0.6), 0, [0xe03a5a,0xf0c020,0xf0f0f0,0xa04ad0][(Math.random()*4)|0]); } }
    else if(r<0.84){ CURP=0; strip('park', grassMat, cx, cz, w, d, 0, 0.06, 4, 4); strip('path', walkMat, cx, cz, w*0.55, d*0.55, 0, 0.09, 2, 2);   // Z242 an OPEN SQUARE: a paved plaza on a lawn, a tree at each corner, a couple of benches
      for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) trees.push({ x:cx+sx*(w/2-3), z:cz+sz*(d/2-3), s:_R(0.95,1.2), ry:_R(0,6.28) }); bench(cx-w*0.2, cz, Math.PI/2); bench(cx+w*0.2, cz, -Math.PI/2); }
    else if(r<0.93){ CURP=0; strip('walk', walkMat, cx, cz, w, d, 0, 0.1, 2, 2);                                                            // a MARKET SQUARE: umbrella stalls, stools, a few trees
      for(let k=0;k<(MOBILE?4:7);k++) stall(cx+_R(-w/2+2.5,w/2-2.5), cz+_R(-d/2+2.5,d/2-2.5), _R(0,6.28));
      for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) trees.push({ x:cx+sx*(w/2-1.5), z:cz+sz*(d/2-1.5), s:_R(0.9,1.1), ry:_R(0,6.28) }); }
    else { CURP=0; const pw=Math.min(w-4, 36), pd=Math.min(d-4, 22);                                                                         // a FOOTBALL PITCH with goals and a low fence
      strip('pitch', ()=>new THREE.MeshStandardMaterial({ map:pitchT().t, roughness:0.95 }), cx, cz, pw, pd, 0, 0.07, pw, pd);
      for(const sx of [-1,1]){ const gx=cx+sx*(pw/2-0.3), y=heightAt(gx,cz); for(const sz of [-1.6,1.6]) det(new THREE.BoxGeometry(0.1,2.1,0.1), gx, y+1.05, cz+sz, 0, 0xf2f2ee); det(new THREE.BoxGeometry(0.1,0.1,3.3), gx, y+2.1, cz, 0, 0xf2f2ee); }
      for(let a=-pw/2-1; a<=pw/2+1; a+=3) for(const sz of [-1,1]) det(new THREE.BoxGeometry(0.06,1.2,0.06), cx+a, heightAt(cx+a,cz)+0.6, cz+sz*(pd/2+1), 0, 0x4a5a4a); } }
  CURP=0;
  // ---- street lamps (pole + arm · glowing head) · traffic lights · power poles: instanced and topple-able ----
  const inst=(geo, mat, list)=>{ const im=new THREE.InstancedMesh(geo, mat, list.length); list.forEach((o,k)=>{ _M4.compose(_v3.set(o.x, heightAt(o.x,o.z)+REALCITY.lift.walk, o.z), _qy.setFromEuler(_eu.set(0,o.ry||0,0)), _one); im.setMatrixAt(k,_M4); }); im.castShadow=!MOBILE; im.computeBoundingSphere(); im.frustumCulled=false; arena.add(im); LAND.meshes.push(im); return im; };
  let lampIm=null, headIm=null, sigIm=null;
  if(lamps.length){ const Q=[]; const pole=new THREE.CylinderGeometry(0.07,0.1,6,6); pole.translate(0,3,0); Q.push({geo:pole,col:0x4a4c4e}); const arm=new THREE.BoxGeometry(0.08,0.08,1.6); arm.translate(0,5.9,0.75); Q.push({geo:arm,col:0x4a4c4e});
    const head=new THREE.BoxGeometry(0.5,0.16,0.3); head.translate(0,5.8,1.5); const hm=new THREE.MeshStandardMaterial({ color:0xfff4d0, emissive:0xffe0a0, emissiveIntensity:0 }); LAND.mats.push(hm);
    lampIm=inst(_mergeColored(Q), vmat(), lamps); headIm=inst(head, hm, lamps); regTopple([lampIm, headIm], lamps, 6); lampPools(lamps); }
  if(lights.length){ const Q=[]; const pole=new THREE.CylinderGeometry(0.08,0.1,4.6,6); pole.translate(0,2.3,0); Q.push({geo:pole,col:0x3a3c3e}); const bx=new THREE.BoxGeometry(0.4,1.1,0.4); bx.translate(0,4.4,0.3); Q.push({geo:bx,col:0x2a2a2a});
    for(const [yy,c] of [[0.35,0xe82020],[0,0xe8b020],[-0.35,0x20c840]]){ const s=new THREE.SphereGeometry(0.11,8,6); s.translate(0,4.4+yy,0.52); Q.push({geo:s,col:c}); }
    sigIm=inst(_mergeColored(Q), vmat(), lights); regTopple([sigIm], lights, 4.6); }
  if(poles.length){ const Q=[]; const pole=new THREE.CylinderGeometry(0.1,0.15,7.6,6); pole.translate(0,3.8,0); Q.push({geo:pole,col:0x9a968c}); const arm=new THREE.BoxGeometry(0.1,0.1,1.5); arm.translate(0,7.05,0); Q.push({geo:arm,col:0x5a5650});
    for(const s of [-0.6,0,0.6]){ const ins=new THREE.CylinderGeometry(0.04,0.05,0.16,6); ins.translate(0,7.18,s); Q.push({geo:ins,col:0xe8e4dc}); } const tr=new THREE.CylinderGeometry(0.28,0.28,0.7,10); tr.translate(0.32,5.6,0); Q.push({geo:tr,col:0x6a6e70});
    // wires: three on the crossarm + a sagging low bundle, one piece per span (they drop when either pole falls)
    const pts=[], ids=[]; for(const ch of chains) for(let q=0;q<ch.length-1;q++){ const A=ch[q], Bp=ch[q+1], id=newPiece(); A.spans.push(id); Bp.spans.push(id); const yA=heightAt(A.x,A.z), yB=heightAt(Bp.x,Bp.z), nx=-(Bp.z-A.z), nz=Bp.x-A.x, nl=Math.hypot(nx,nz)||1;
      for(const [off,hh,sag] of [[-0.6,7.22,0.9],[0,7.22,0.9],[0.6,7.22,0.9],[0.25,6.3,1.6]]){ const ox=nx/nl*off, oz=nz/nl*off; let px=A.x+ox, py=yA+hh, pz=A.z+oz;
        for(let k=1;k<=8;k++){ const u=k/8, x=A.x+ox+(Bp.x-A.x)*u, z=A.z+oz+(Bp.z-A.z)*u, y=yA+(yB-yA)*u+hh-Math.sin(u*Math.PI)*sag; pts.push(px,py,pz,x,y,z); ids.push(id,id); px=x; py=y; pz=z; } } }
    if(pts.length){ const lg=new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts,3)); lg.setAttribute('aPiece', new THREE.Float32BufferAttribute(ids,1));
      const ln=new THREE.LineSegments(lg, pieceHook(new THREE.LineBasicMaterial({ color:0x161616 }))); ln.frustumCulled=false; arena.add(ln); LAND.meshes.push(ln); }
    regTopple([inst(_mergeColored(Q), vmat(), poles)], poles, 7.6); }
  // ---- flush the buckets (one mesh per material) and the detail mesh ----
  flushBuckets(); const anchor=arena.children[arena.children.length-1], gen=CITY_GEN, plist=PP; PP=null;
  loadRealCity().then(()=>{ if(gen!==CITY_GEN || !anchor.parent) return; flushPending(); placeProps(plist, gen, anchor); dressPoles(lampIm, headIm, sigIm); drawStreetVehicles(cars); buildTraffic(roads); });   // Z333 the parked cars too: drawn once their real models are in, never as hand-built stand-ins   // Z267 the waiting lots rise, the furniture and poles go real, once the models are in
  drawFixtures(fix);   // Z265
  // Z266 the street trees and median palms as real Meshy species: the trees split into groups, each group one species of the city's mix (linden,
  //   oak, birch, poplar…), the palms coconut palms; each tree its own size, turn and lean; they sway in the wind and go down to shells, blasts and tanks
  for(const [list, geo, tk, nv] of [[trees, treeBroadleaf(), 'broadleaf', MOBILE?3:6], [palms, treePalm(), 'palm', 1]]){ if(!list.length) continue;
    const groups=Array.from({ length:nv }, ()=>[]); list.forEach(o=>groups[(Math.random()*nv)|0].push(o));
    groups.forEach((g,vi)=>{ if(!g.length) return; const im=new THREE.InstancedMesh(geo, floraMat(), g.length);
      g.forEach((o,k)=>{ const sy=o.s*_R(0.88,1.15); _M4.compose(_v3.set(o.x,heightAt(o.x,o.z)-0.05,o.z), _qy.setFromEuler(_eu.set(_R(-0.04,0.04),o.ry,_R(-0.04,0.04))), _sc.set(o.s,sy,o.s)); im.setMatrixAt(k,_M4);
        const c={ x:o.x, z:o.z, r:0.55*o.s, im, k, alive:true, kind:'tree', ry:o.ry, s:o.s, land:true }; crushables.push(c); TREES.push(c); });
      im.castShadow=!MOBILE; im.receiveShadow=true; im.computeBoundingSphere(); im.userData.tree={ tk, vi, sMid:REALTREE.citySize }; arena.add(im); LAND.meshes.push(im); trackTrees(im); }); }
  B=null; P=null; strip=null; }
let _vmat=null;
function vmat(){ return _vmat||(_vmat=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.35, metalness:0.45, envMapIntensity:1.2 })); }
