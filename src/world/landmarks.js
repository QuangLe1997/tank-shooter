// world/landmarks.js — Z139 BATTLEFIELD LANDMARKS for the three new maps (Z327: the old box-city and hill-woods builders are gone — the real city
//   and flora.js build those now). VILLAGE: tile-roofed houses, rice paddies, palms (the river + bridges live in heightfield.js).
//   Buildings / houses are indestructible cover made of circle blocks (the same collision the walls use); trees and paddies are scenery.
import * as THREE from 'three';
import { OPEN_LAND, REALCITY } from '../../config.js';
import { AREA_K, ARENA, BIOME, MOBILE, NIGHT, RIVER, ZONES, _R, arena, blocks, buildCityDistrict, buildFlora, buildWildlife, buildWonder, crushables, floraMat, heightAt, inField, inZone, resetCity, villageHouse, buildRuins, WIN_K, POOL_K } from '../hub.js';

export const LAND = { meshes:[], mats:[], dummy:null };
function dummy(){ return LAND.dummy||(LAND.dummy=new THREE.Object3D()); }
export function clearLandmarks(){ resetCity(); for(const m of LAND.meshes){ m.parent && m.parent.remove(m); if(m.geometry && !m.isInstancedMesh) m.geometry.dispose(); if(m.isInstancedMesh) m.dispose(); } LAND.meshes.length=0; for(let i=crushables.length-1;i>=0;i--) if(crushables[i].land) crushables.splice(i,1); }   // (instanced geometry is cached & shared)
const add=(m)=>{ arena.add(m); LAND.meshes.push(m); return m; };
const claim=(x,z,r)=>ZONES.push({ kind:'landmark', x, z, r });   // later scatter (cover, camps, depots) keeps clear
const solid=(x,z,r,kind,mesh,land)=>blocks.push({ mesh:mesh||dummy(), x, z, r, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind, land:land||null });   // indestructible cover, like concrete
const free=(x,z,r)=>inField(x,z,r+2) && !inZone(x,z,r) && Math.hypot(x,z)>r+17 && Math.hypot(x,z-ARENA*0.55)>r+11 && !blocks.some(b=>Math.hypot(b.x-x,b.z-z)<b.r+r+1.5);

// ---------------- trees (instanced) ----------------
function treeMat(){ return floraMat(); }   // Z146 the same leaf-card trees as the open field (atlas + sway)
function trees(geo, list, scale){ if(!list.length) return; const im=new THREE.InstancedMesh(geo, treeMat(), list.length); im.castShadow=!MOBILE; im.receiveShadow=true;
  const M=new THREE.Matrix4(), Q=new THREE.Quaternion(), E=new THREE.Euler(), V=new THREE.Vector3(), Sc=new THREE.Vector3();
  list.forEach((o,k)=>{ const s=o.s*(scale||1); M.compose(V.set(o.x,heightAt(o.x,o.z)-0.05,o.z), Q.setFromEuler(E.set(0,o.ry,0)), Sc.set(s,s*_R(0.9,1.15),s)); im.setMatrixAt(k,M); }); add(im); }

// ---------------- VILLAGE ----------------
function paddyTex(){ const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'); x.fillStyle='#7c9650'; x.fillRect(0,0,128,128);   // Z242 young rice, not lime paint
  for(let r=0;r<16;r++){ x.fillStyle=r%2?'#8aa25a':'#6a8642'; x.fillRect(0,r*8,128,5); } for(let n=0;n<40;n++){ x.fillStyle='rgba(200,230,255,0.35)'; x.fillRect(Math.random()*128,Math.random()*128,6,1.5); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; return t; }
function buildVillage(){
  let houses=0; const H=Math.round(7*AREA_K/2*OPEN_LAND.VILLAGE.houses);   // Z242 fewer homes, more open countryside
  for(let t=0;t<H*14 && houses<H;t++){ const x=_R(-ARENA+14,ARENA-14), z=_R(-ARENA+14,ARENA-14); if(!free(x,z,4.2) || (RIVER.on && wetAt2(x,z,9))) continue;
    const m=villageHouse(), rot=Math.round(_R(0,3))*Math.PI/2+_R(-0.15,0.15); m.position.set(x, heightAt(x,z)-0.05, z); m.rotation.y=rot; add(m);   // Z207 a real village home
    const w=m.userData.w, d=m.userData.d, ca=Math.cos(rot), sa=Math.sin(rot); let first=true;
    for(let a=-w/2+1.5;a<=w/2-1;a+=2.6) for(let b=-d/2+1.5;b<=d/2-1.2;b+=2.6){ solid(x+a*ca+b*sa, z-a*sa+b*ca, 2.2,'house', first?m:null); first=false; }
    claim(x,z,Math.max(w,d)/2+7); houses++; }   // Z242 each home keeps a yard of open ground round it
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
  if(n==='CITY') buildCityDistrict(); else if(n==='VILLAGE') buildVillage(); buildRuins(); }   // Z275 the war's ruins on the open battlefields   // Z142 the city is a real district now (city.js)
// Z141 vegetation goes in last, round whatever was built
export function buildScenery(){ buildFlora(); buildWildlife(); buildWonder(); }   // Z144 + the land's famous landmark   // Z143 + herds of wild animals
// lit windows glow at night
export function updateLandmarkGlow(){ WIN_K.value=NIGHT.k*1.5; POOL_K.value=NIGHT.k*(REALCITY.pools?REALCITY.pools.k:0); if(!LAND.mats.length) return; const k=NIGHT.k*1.5; for(const m of LAND.mats) if(Math.abs(m.emissiveIntensity-k)>0.01) m.emissiveIntensity=k; }   // Z287 the lamp pools come up with the windows
