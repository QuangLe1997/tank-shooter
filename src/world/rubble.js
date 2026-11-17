// world/rubble.js — Z193 WHAT A BROKEN OBSTACLE LEAVES BEHIND: a low heap of its own material where it stood (torn sacks and spilled sand,
//   split planks, cracked concrete with bent rebar, twisted steel, scattered tyres, split stone) — burning for a while if it was fuel, a car or a
//   container — instead of the piece just vanishing. Heaps are pure scenery (tanks roll over them); the oldest go once there are too many.
import * as THREE from 'three';
import { MOBILE, _R, _mergeColored, _xf, heightAt, scene, spawnPart } from '../hub.js';

const RUB=[], CAP=MOBILE?40:90, _geo={};
export const RUBBLE_TYPE = { sandbag:'sand', hesco:'sand', crates:'wood', logs:'wood', drums:'metal', wreck:'metal', container:'metal', hedgehog:'metal', tires:'rubber',
  concrete:'conc', pipes:'conc', jersey:'conc', teeth:'conc', boulder:'stone' };
const TONES = { sand:[0xc2ac80,0xa8936a,0x8f7d58], wood:[0x8a6a40,0x6a4e30,0x3e2e1e], metal:[0x4a423c,0x5a3a28,0x262220], rubber:[0x262624,0x1a1a19,0x2e2c2a],
  conc:[0xaeaaa2,0x96928a,0x76726a], stone:[0xb8ab92,0x9a8e78,0x7e7462] };
let _mat=null;
function chunk(r){ const g=new THREE.IcosahedronGeometry(r, 0), p=g.attributes.position; for(let i=0;i<p.count;i++) p.setXYZ(i, p.getX(i)*_R(0.7,1.3), p.getY(i)*_R(0.45,0.8), p.getZ(i)*_R(0.7,1.3)); g.computeVertexNormals(); return g; }
// one heap per material type (two variants each), built once and shared
function heapGeo(type, v){ const key=type+v; if(_geo[key]) return _geo[key]; const T=TONES[type]||TONES.conc, P=[], tone=()=>T[(Math.random()*T.length)|0];
  const n = type==='sand' ? 5 : 9;
  for(let i=0;i<n;i++){ const a=Math.random()*6.283, d=Math.sqrt(Math.random())*1.25, r=type==='sand'?_R(0.45,0.8):_R(0.16,0.42); P.push({ geo:_xf(chunk(r), Math.cos(a)*d, r*0.25, Math.sin(a)*d, 0, _R(0,6.28), 0), col:tone() }); }
  if(type==='sand'){ for(let i=0;i<7;i++){ const b=new THREE.BoxGeometry(0.8,0.2,0.42); _xf(b, _R(-1.1,1.1), _R(0.05,0.3), _R(-1.1,1.1), _R(-0.3,0.3), _R(0,6.28), _R(-0.3,0.3)); P.push({ geo:b, col:tone() }); } }   // torn sacks
  if(type==='wood'){ for(let i=0;i<6;i++){ const b=new THREE.BoxGeometry(_R(1.0,2.2),0.07,_R(0.15,0.3)); _xf(b, _R(-1,1), _R(0.05,0.35), _R(-1,1), _R(-0.3,0.3), _R(0,6.28), _R(-0.25,0.25)); P.push({ geo:b, col:tone() }); } }   // split planks / logs
  if(type==='conc'){ for(let i=0;i<5;i++){ const b=new THREE.CylinderGeometry(0.025,0.025,_R(0.6,1.4),5); _xf(b, _R(-0.9,0.9), _R(0.3,0.6), _R(-0.9,0.9), _R(-1,1), 0, _R(-1,1)); P.push({ geo:b, col:0x5a3e2a }); }   // bent rebar
    for(let i=0;i<3;i++){ const b=new THREE.BoxGeometry(_R(0.6,1.1),_R(0.18,0.3),_R(0.5,0.9)); _xf(b, _R(-0.8,0.8), 0.12, _R(-0.8,0.8), _R(-0.4,0.4), _R(0,6.28), _R(-0.3,0.3)); P.push({ geo:b, col:tone() }); } }   // slabs
  if(type==='metal'){ for(let i=0;i<5;i++){ const b=new THREE.BoxGeometry(_R(0.6,1.4),0.05,_R(0.4,0.9)); _xf(b, _R(-1,1), _R(0.1,0.45), _R(-1,1), _R(-0.6,0.6), _R(0,6.28), _R(-0.6,0.6)); P.push({ geo:b, col:tone() }); }   // torn plate
    for(let i=0;i<2;i++){ const b=new THREE.CylinderGeometry(0.3,0.3,0.7,10,1,true); _xf(b, _R(-0.8,0.8), 0.28, _R(-0.8,0.8), Math.PI/2, _R(0,6.28), _R(-0.2,0.2)); P.push({ geo:b, col:tone() }); } }   // a crushed drum / tube
  if(type==='rubber'){ for(let i=0;i<5;i++){ const t=new THREE.TorusGeometry(0.5,0.2,6,14); _xf(t, _R(-1,1), 0.18, _R(-1,1), Math.PI/2+_R(-0.4,0.4), 0, _R(-0.3,0.3)); P.push({ geo:t, col:tone() }); } }
  const g=_mergeColored(P); _geo[key]=g; return g; }
// leave the remains of block b (its kind decides the material; burn = seconds the heap keeps burning)
export function leaveRubble(b, burn){ const type=RUBBLE_TYPE[b.kind]; if(!type || !b.mesh) return null;
  if(!_mat) _mat=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.92, metalness:0.08 });
  const m=new THREE.Mesh(heapGeo(type, (Math.random()*2)|0), _mat), s=(b.mesh.scale.x||1)*(b.kind==='boulder'?0.7:1);
  const len = b.obb ? b.obb.hl/Math.max(0.5,b.obb.hw) : 1;   // a container / car leaves a long heap
  m.scale.set(s*(b.obb?1.1:1), s*(type==='sand'?0.8:1), s*len); m.position.set(b.x, heightAt(b.x,b.z)-0.05, b.z); m.rotation.y = b.obb ? b.obb.f : Math.random()*6.283;
  m.receiveShadow=true; m.castShadow=!MOBILE; scene.add(m);
  const R={ m, x:b.x, z:b.z, burn:burn||0, t:0, s }; RUB.push(R);
  while(RUB.length>CAP){ const o=RUB.shift(); scene.remove(o.m); }
  return R; }
// burning heaps: flames licking up and a column of black smoke that thins as the fire dies
export function updateRubble(dt){ let n=0;
  for(const R of RUB){ if(R.burn<=0) continue; R.burn-=dt; R.t-=dt; if(R.t>0 || n>=(MOBILE?3:6)) continue; n++; R.t=MOBILE?0.18:0.1;
    const k=Math.min(1, R.burn/4), gy=heightAt(R.x,R.z);
    spawnPart(R.x+_R(-0.9,0.9)*R.s, gy+0.4, R.z+_R(-0.9,0.9)*R.s, _R(-0.3,0.3), 2+Math.random()*1.5, _R(-0.3,0.3), { tex:'fire', color:0xffe0a0, color2:0xff3a0a, size:(0.7+Math.random()*0.7)*R.s*(0.5+0.5*k), life:0.5, grav:1.2, drag:1.5, grow:0.7 });
    if(Math.random()<0.7) spawnPart(R.x, gy+1.4*R.s, R.z, 0.5+_R(-0.3,0.3), 2+Math.random(), 0.2+_R(-0.3,0.3), { color:0x16120e, size:(1.1+Math.random()*0.6)*R.s, life:2.2, smoke:true, grav:0.3, drag:0.8, grow:2.4, op:0.5*k+0.15 }); } }
export function clearRubble(){ for(const R of RUB) scene.remove(R.m); RUB.length=0; }
export function rubbleCount(){ return RUB.length; }
