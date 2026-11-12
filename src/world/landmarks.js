// world/landmarks.js — Z139 BATTLEFIELD LANDMARKS for the three new maps. CITY: a grid of solid buildings (lit windows at night), parked cars.
//   HILLS: conifer woods on the slopes. VILLAGE: tile-roofed houses, rice paddies, palms (the river + bridges live in heightfield.js).
//   Buildings / houses are indestructible cover made of circle blocks (the same collision the walls use); trees and paddies are scenery.
import * as THREE from 'three';
import { AREA_K, ARENA, BIOME, MOBILE, NIGHT, RIVER, ZONES, _R, _mergeColored, _xf, arena, blocks, buildCityDistrict, buildFlora, buildWildlife, crushables, heightAt, inField, inZone } from '../hub.js';

export const LAND = { meshes:[], mats:[], dummy:null };
const WALLS=[ ['#b9b1a4','#6f8aa6'], ['#9fa8b0','#46607a'], ['#c8a98a','#5a6e84'], ['#a99a8a','#3e5670'] ];   // [wall, glass]
const _wt={};
function windowTex(i){                                                                  // wall + a grid of windows (a few lit); emissive twin shows the lit ones at night
  if(_wt[i]) return _wt[i]; const [wall,glass]=WALLS[i%WALLS.length], c=document.createElement('canvas'), e=document.createElement('canvas'); c.width=c.height=e.width=e.height=128;
  const x=c.getContext('2d'), y=e.getContext('2d'); x.fillStyle=wall; x.fillRect(0,0,128,128); y.fillStyle='#000'; y.fillRect(0,0,128,128);
  for(let r=0;r<4;r++) for(let k=0;k<4;k++){ const px=10+k*30, py=8+r*30, lit=Math.random()<0.3; x.fillStyle=lit?'#e6c27a':glass; x.fillRect(px,py,20,20); x.fillStyle='rgba(255,255,255,0.18)'; x.fillRect(px,py,20,4); x.fillStyle='rgba(0,0,0,0.25)'; x.fillRect(px,py+18,20,2); if(lit){ y.fillStyle='#ffd27a'; y.fillRect(px,py,20,20); } }
  for(let n=0;n<260;n++){ x.fillStyle='rgba(0,0,0,'+(Math.random()*0.06).toFixed(3)+')'; x.fillRect(Math.random()*128,Math.random()*128,3,3); }
  const t=new THREE.CanvasTexture(c), em=new THREE.CanvasTexture(e); for(const q of [t,em]){ q.wrapS=q.wrapT=THREE.RepeatWrapping; q.colorSpace=THREE.SRGBColorSpace; q.anisotropy=4; }
  return (_wt[i]={ t, em }); }
function dummy(){ return LAND.dummy||(LAND.dummy=new THREE.Object3D()); }
export function clearLandmarks(){ for(const m of LAND.meshes){ m.parent && m.parent.remove(m); if(m.geometry && !m.isInstancedMesh) m.geometry.dispose(); if(m.isInstancedMesh) m.dispose(); } LAND.meshes.length=0; for(let i=crushables.length-1;i>=0;i--) if(crushables[i].land) crushables.splice(i,1); }   // (instanced geometry is cached & shared)
const add=(m)=>{ arena.add(m); LAND.meshes.push(m); return m; };
const claim=(x,z,r)=>ZONES.push({ kind:'landmark', x, z, r });   // later scatter (cover, camps, depots) keeps clear
const solid=(x,z,r,kind,mesh,land)=>blocks.push({ mesh:mesh||dummy(), x, z, r, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind, land:land||null });   // indestructible cover, like concrete
const free=(x,z,r)=>inField(x,z,r+2) && !inZone(x,z,r) && Math.hypot(x,z)>r+17 && Math.hypot(x,z-ARENA*0.55)>r+11 && !blocks.some(b=>Math.hypot(b.x-x,b.z-z)<b.r+r+1.5);

// ---------------- CITY ----------------
function box(w,h,d,styleI,glow){ const g=new THREE.BoxGeometry(w,h,d), { t, em }=windowTex(styleI);   // per-face UV scaling so windows keep one size
  const uv=g.attributes.uv, sc=[[d,h],[d,h],[1,1],[1,1],[w,h],[w,h]];
  for(let f=0;f<6;f++) for(let v=0;v<4;v++){ const i=f*4+v; uv.setXY(i, uv.getX(i)*Math.max(1,Math.round(sc[f][0]/8)), uv.getY(i)*Math.max(1,Math.round(sc[f][1]/6.8))); }
  const side=new THREE.MeshStandardMaterial({ map:t, emissiveMap:em, emissive:0xffffff, emissiveIntensity:0, roughness:0.85, metalness:0.05 }), roof=new THREE.MeshStandardMaterial({ color:0x5a5c60, roughness:0.95 });
  LAND.mats.push(side); const m=new THREE.Mesh(g,[side,side,roof,roof,side,side]); m.castShadow=true; m.receiveShadow=true; return m; }
function buildCity(){
  const G=28, n=Math.round(ARENA/G); let built=0;
  for(let i=-n;i<=n;i++) for(let j=-n;j<=n;j++){ if(Math.random()>0.68) continue;
    const w=_R(11,18), d=_R(9,14), h=_R(8,17), rot=Math.random()<0.5?0:Math.PI/2, x=i*G+_R(-3,3), z=j*G+_R(-3,3), R=Math.hypot(w,d)/2;
    if(!free(x,z,R*0.8)) continue;
    const m=box(w,h,d,(Math.random()*WALLS.length)|0); m.position.set(x, heightAt(x,z)+h/2-0.1, z); m.rotation.y=rot; add(m);
    { const ac=new THREE.Mesh(new THREE.BoxGeometry(2,1,1.6), new THREE.MeshStandardMaterial({ color:0x8a8e92, roughness:0.7 })); ac.position.set(_R(-w/4,w/4), h/2+0.5, _R(-d/4,d/4)); m.add(ac);   // rooftop unit
      const par=new THREE.Mesh(new THREE.BoxGeometry(w+0.5,0.5,d+0.5), new THREE.MeshStandardMaterial({ color:0x6a6c70, roughness:0.9 })); par.position.y=h/2+0.05; m.add(par); }
    const ca=Math.cos(rot), sa=Math.sin(rot);                                              // circle blocks tile the footprint (3 m grid)
    let first=true; for(let a=-w/2+1.6;a<=w/2-1.2;a+=3) for(let b=-d/2+1.6;b<=d/2-1.2;b+=3){ const bx=x+a*ca+b*sa, bz=z-a*sa+b*ca; solid(bx,bz,2.35,'building', first?m:null, m); first=false; }
    m.userData.h=h; m.userData.land=true;
    claim(x,z,R*0.95+1); built++; }
  // cars left in the streets (scenery): merged coloured boxes
  const P=[], cols=[0x7a2a26,0x2a4a7a,0xc8c2b0,0x3a3d40,0x6a7a3a]; for(let k=0;k<Math.round(26*AREA_K/3);k++){ const x=_R(-ARENA+10,ARENA-10), z=_R(-ARENA+10,ARENA-10); if(!free(x,z,2.4)) continue;
    const body=new THREE.BoxGeometry(2.0,0.7,4.2), cab=new THREE.BoxGeometry(1.7,0.6,2.0); _xf(body,0,0.55,0,0,0,0); _xf(cab,0,1.15,-0.2,0,0,0); const col=cols[(Math.random()*cols.length)|0], ry=Math.random()<0.5?0:Math.PI/2+_R(-0.12,0.12);
    for(const g of [body,cab]){ g.rotateY(ry); g.translate(x,heightAt(x,z),z); P.push({geo:g,col}); } if(Math.random()<0.5) solid(x,z,1.6,'car'); }
  if(P.length){ const m=new THREE.Mesh(_mergeColored(P), new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.6, metalness:0.4 })); m.castShadow=true; m.receiveShadow=true; add(m); }
  return built; }

// ---------------- trees (instanced) ----------------
let _conifer=null, _palm=null, _treeMat=null;
function treeMat(){ return _treeMat||(_treeMat=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.92, side:THREE.DoubleSide })); }
function coniferGeo(){ if(_conifer) return _conifer; const P=[], tr=new THREE.CylinderGeometry(0.18,0.26,1.6,6); tr.translate(0,0.8,0); P.push({geo:tr,col:0x5a4430});
  for(let k=0;k<4;k++){ const r=2.0-k*0.42, h=2.6-k*0.3, c=new THREE.ConeGeometry(r,h,8); c.translate(0,1.7+k*1.25,0); P.push({geo:c,col:k%2?0x2f5a2c:0x3a6a34}); }
  return (_conifer=_mergeColored(P)); }
function palmGeo(){ if(_palm) return _palm; const P=[], tr=new THREE.CylinderGeometry(0.13,0.2,6.4,6); tr.translate(0,3.2,0); tr.rotateZ(0.06); P.push({geo:tr,col:0x8a7456});
  for(let k=0;k<8;k++){ const a=k/8*Math.PI*2, f=new THREE.ConeGeometry(0.28,3.2,3); f.rotateZ(-1.15); f.translate(1.5,6.5,0); f.rotateY(a); P.push({geo:f,col:k%2?0x4f8a34:0x5f9a3c}); }
  const nut=new THREE.SphereGeometry(0.2,6,5); nut.translate(0.15,6.3,0.1); P.push({geo:nut,col:0x6a8a3a}); return (_palm=_mergeColored(P)); }
function trees(geo, list, scale){ if(!list.length) return; const im=new THREE.InstancedMesh(geo, treeMat(), list.length); im.castShadow=!MOBILE; im.receiveShadow=true;
  const M=new THREE.Matrix4(), Q=new THREE.Quaternion(), E=new THREE.Euler(), V=new THREE.Vector3(), Sc=new THREE.Vector3();
  list.forEach((o,k)=>{ const s=o.s*(scale||1); M.compose(V.set(o.x,heightAt(o.x,o.z)-0.05,o.z), Q.setFromEuler(E.set(0,o.ry,0)), Sc.set(s,s*_R(0.9,1.15),s)); im.setMatrixAt(k,M); }); add(im); }
function buildHills(){ const list=[], N=Math.round((MOBILE?40:90)*AREA_K/2);
  for(let t=0;t<N*4 && list.length<N;t++){ const x=_R(-ARENA+8,ARENA-8), z=_R(-ARENA+8,ARENA-8), hh=heightAt(x,z);
    if(hh<0.5 && Math.random()<0.8) continue;                                      // woods cling to the high ground
    if(!free(x,z,1.2)) continue; list.push({x,z,s:_R(0.8,1.5),ry:_R(0,6.28)}); }
  return list.length; }   // Z141 the woods themselves are planted by flora.js (they topple under a tank)

// ---------------- VILLAGE ----------------
function paddyTex(){ const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'); x.fillStyle='#8fbf4a'; x.fillRect(0,0,128,128);
  for(let r=0;r<16;r++){ x.fillStyle=r%2?'#a4d05a':'#7aae3c'; x.fillRect(0,r*8,128,5); } for(let n=0;n<40;n++){ x.fillStyle='rgba(200,230,255,0.35)'; x.fillRect(Math.random()*128,Math.random()*128,6,1.5); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; return t; }
function house(){ const g=new THREE.Group(), wall=new THREE.MeshStandardMaterial({ color:0xe6d8b8, roughness:0.9 }), roof=new THREE.MeshStandardMaterial({ color:0xb4562f, roughness:0.85 }), dark=new THREE.MeshStandardMaterial({ color:0x4a3a28, roughness:0.9 });
  const w=_R(6.4,8.4), d=_R(4.6,5.6), h=2.7, body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wall); body.position.y=h/2; body.castShadow=true; body.receiveShadow=true; g.add(body);
  const sh=new THREE.Shape(); sh.moveTo(-d/2-0.6,0); sh.lineTo(d/2+0.6,0); sh.lineTo(0,1.9); sh.closePath();                                   // gable
  const rg=new THREE.ExtrudeGeometry(sh,{depth:w+1.0,bevelEnabled:false}); rg.translate(0,0,-(w+1.0)/2); rg.rotateY(Math.PI/2); const rf=new THREE.Mesh(rg, roof); rf.position.y=h; rf.castShadow=true; g.add(rf);
  const door=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.9,0.12), dark); door.position.set(0,0.95,d/2+0.02); g.add(door);
  for(const sx of [-1,1]){ const win=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.8,0.1), dark); win.position.set(sx*w*0.3,1.5,d/2+0.02); g.add(win); }
  g.userData={ w, d }; return g; }
function buildVillage(){
  let houses=0; const H=Math.round(7*AREA_K/2);
  for(let t=0;t<H*14 && houses<H;t++){ const x=_R(-ARENA+14,ARENA-14), z=_R(-ARENA+14,ARENA-14); if(!free(x,z,4.2) || (RIVER.on && wetAt2(x,z,9))) continue;
    const m=house(), rot=Math.round(_R(0,3))*Math.PI/2+_R(-0.15,0.15); m.position.set(x, heightAt(x,z)-0.05, z); m.rotation.y=rot; add(m);
    const w=m.userData.w, ca=Math.cos(rot), sa=Math.sin(rot); for(let a=-w/2+1.5;a<=w/2-1;a+=2.6){ const bx=x+a*sa, bz=z+a*ca; solid(bx,bz,2.5,'house', a<-w/2+1.6?m:null); } claim(x,z,w/2+2); houses++; }
  // rice paddies beside the water (scenery, no collision)
  const tex=paddyTex(), pm=new THREE.MeshStandardMaterial({ map:tex, roughness:0.8 }); let paddies=0;
  for(let t=0;t<90 && paddies<Math.round(5*AREA_K/2);t++){ const x=_R(-ARENA+20,ARENA-20), z=_R(-ARENA+20,ARENA-20), w=_R(14,22), d=_R(10,15); if(!free(x,z,Math.max(w,d)/2) || !nearWater(x,z,26)) continue;
    const t2=tex.clone(); t2.needsUpdate=true; t2.repeat.set(w/9,d/9); const p=new THREE.Mesh(new THREE.PlaneGeometry(w,d), new THREE.MeshStandardMaterial({ map:t2, roughness:0.75 })); p.rotation.x=-Math.PI/2; p.rotation.z=_R(0,3.14); p.position.set(x, heightAt(x,z)+0.05, z); p.receiveShadow=true; add(p); paddies++; }
  const list=[]; for(let t=0;t<260 && list.length<Math.round((MOBILE?14:30)*AREA_K/2);t++){ const x=_R(-ARENA+8,ARENA-8), z=_R(-ARENA+8,ARENA-8); if(!free(x,z,0.8) || wetAt2(x,z,3)) continue; list.push({x,z,s:_R(0.8,1.25),ry:_R(0,6.28)}); }
  return houses; }   // Z141 palms / bamboo / reeds now come from flora.js
const wetAt2=(x,z,r)=>{ for(const a of [[0,0],[r,0],[-r,0],[0,r],[0,-r]]) if(heightAt(x+a[0],z+a[1])<-0.7) return true; return false; };
const nearWater=(x,z,R)=>{ for(let a=0;a<6.28;a+=0.7) for(const r of [8,R]) if(heightAt(x+Math.cos(a)*r,z+Math.sin(a)*r)<-0.7) return true; return false; };

export function buildLandmarks(){
  clearLandmarks(); LAND.mats.length=0; const n=BIOME.name;
  if(n==='CITY') buildCityDistrict(); else if(n==='VILLAGE') buildVillage(); }   // Z142 the city is a real district now (city.js)
// Z141 vegetation goes in last, round whatever was built
export function buildScenery(){ buildFlora(); buildWildlife(); }   // Z143 + herds of wild animals
// lit windows glow at night
export function updateLandmarkGlow(){ if(!LAND.mats.length) return; const k=NIGHT.k*1.5; for(const m of LAND.mats) if(Math.abs(m.emissiveIntensity-k)>0.01) m.emissiveIntensity=k; }
