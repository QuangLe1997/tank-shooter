// world/flora.js — Z141 LIVING SCENERY: proper trees (layered conifers, round-crowned broadleaf, curved coconut palms, bamboo clumps), bushes, wild flowers,
//   reeds along the water and haystacks in the village — instanced (one draw per species), tinted per instance, swaying in the wind (vertex shader).
//   Tanks plough through it all: trees topple, bushes / flowers / reeds flatten (decor.js crushables).
import * as THREE from 'three';
import { AREA_K, ARENA, BIOME, MOBILE, RIVER, WTIME, _R, _mergeColored, arena, blocks, crushables, heightAt, inField, inZone, wetAt } from '../hub.js';

let _mat=null;
export function floraMat(){ if(_mat) return _mat; _mat=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.88, metalness:0.0, side:THREE.DoubleSide });
  _mat.onBeforeCompile=(sh)=>{ sh.uniforms.uT=WTIME; sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uT;')
    .replace('#include <begin_vertex>',`#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip=instanceMatrix[3].xyz;
      #else
        vec3 ip=vec3(0.0);
      #endif
      float hy=max(0.0, transformed.y), sway=hy*hy*0.0042;
      transformed.x+=sin(uT*1.55+ip.x*0.31+ip.z*0.17)*sway + sin(uT*3.7+ip.z)*sway*0.25; transformed.z+=cos(uT*1.25+ip.z*0.29)*sway*0.7;`); };
  return _mat; }
const G={};
function geo(k, f){ return G[k]||(G[k]=f()); }
// ---------- species ----------
const conifer=(snow)=>geo('con'+(snow?1:0), ()=>{ const P=[], tr=new THREE.CylinderGeometry(0.16,0.28,2.2,7); tr.translate(0,1.1,0); P.push({geo:tr,col:0x4e3a28});
  for(let k=0;k<6;k++){ const r=2.3-k*0.36, h=2.0-k*0.16, c=new THREE.ConeGeometry(r,h,9,1,true); c.translate(0,1.6+k*1.05,0); const cc=k%2?0x2c5228:0x3a6632; P.push({geo:c,col:cc});
    if(snow){ const sn=new THREE.ConeGeometry(r*0.72,h*0.42,9,1,true); sn.translate(0,1.6+k*1.05+h*0.3,0); P.push({geo:sn,col:0xf2f6fa}); } }
  const tip=new THREE.ConeGeometry(0.35,1.1,7); tip.translate(0,8.2,0); P.push({geo:tip,col:snow?0xf2f6fa:0x3a6632}); return _mergeColored(P); });
const broadleaf=()=>geo('bl', ()=>{ const P=[], tr=new THREE.CylinderGeometry(0.2,0.34,3.2,7); tr.translate(0,1.6,0); P.push({geo:tr,col:0x5a4430});
  for(const [a,l] of [[0.6,1.6],[-0.8,1.4],[2.4,1.3]]){ const b=new THREE.CylinderGeometry(0.07,0.12,l,5); b.translate(0,l/2,0); b.rotateZ(0.7); b.rotateY(a); b.translate(0,2.6,0); P.push({geo:b,col:0x5a4430}); }
  const cols=[0x4a7a30,0x5c8c38,0x3e6a2a,0x6a9a40]; for(let i=0;i<8;i++){ const r=_R(1.0,1.6), s=new THREE.IcosahedronGeometry(r,1), a=i/8*6.28;
    const rr=i===0?0:_R(0.8,1.5); s.translate(Math.cos(a)*rr, 4.2+_R(-0.5,0.9)+(i===0?0.6:0), Math.sin(a)*rr); P.push({geo:s,col:cols[i%4]}); } return _mergeColored(P); });
const palm=()=>geo('pm', ()=>{ const P=[]; let x=0, y=0, ang=0;
  for(let k=0;k<5;k++){ const L=1.45, c=new THREE.CylinderGeometry(0.15-k*0.01,0.2-k*0.01,L,7); c.translate(0,L/2,0); c.rotateZ(-ang); c.translate(x,y,0); P.push({geo:c,col:k%2?0x8a7456:0x7a664a}); x+=Math.sin(ang)*L; y+=Math.cos(ang)*L; ang+=0.07; }
  for(let k=0;k<10;k++){ const a=k/10*6.28, f=new THREE.ConeGeometry(0.42,3.6,4); f.scale(1,1,0.14); f.translate(0,1.8,0); f.rotateZ(-(1.25+(k%3)*0.18)); f.rotateY(a); f.translate(x,y-0.1,0); P.push({geo:f,col:k%2?0x4f8a34:0x66a040}); }
  for(let k=0;k<4;k++){ const n=new THREE.SphereGeometry(0.17,6,5); n.translate(x+Math.cos(k*1.6)*0.25, y-0.35, Math.sin(k*1.6)*0.25); P.push({geo:n,col:0x6a7a34}); } return _mergeColored(P); });
const bamboo=()=>geo('bb', ()=>{ const P=[]; for(let k=0;k<11;k++){ const a=Math.random()*6.28, r=Math.random()*0.9, h=_R(6.5,9.5), c=new THREE.CylinderGeometry(0.06,0.09,h,5); c.translate(0,h/2,0); c.rotateZ(_R(-0.12,0.12)); c.rotateX(_R(-0.12,0.12)); c.translate(Math.cos(a)*r,0,Math.sin(a)*r); P.push({geo:c,col:k%2?0x9aa04a:0x88923e});
    for(let q=0;q<4;q++){ const lf=new THREE.ConeGeometry(0.5,1.6,4); lf.scale(1,1,0.2); lf.rotateZ(1.2+_R(-0.3,0.3)); lf.rotateY(_R(0,6.28)); lf.translate(Math.cos(a)*r, h*(0.55+q*0.12), Math.sin(a)*r); P.push({geo:lf,col:q%2?0x5f8a30:0x76a03a}); } } return _mergeColored(P); });
const bush=(dry)=>geo('bu'+(dry?1:0), ()=>{ const P=[], cols=dry?[0x8a7a4a,0x7a6a3e,0x9a8a58]:[0x3e6a2a,0x4e7e32,0x5c8c38]; for(let i=0;i<5;i++){ const s=new THREE.IcosahedronGeometry(_R(0.45,0.75),0); s.translate(_R(-0.6,0.6), _R(0.35,0.7), _R(-0.6,0.6)); P.push({geo:s,col:cols[i%3]}); } return _mergeColored(P); });
const flowers=()=>geo('fl', ()=>{ const P=[], cols=[0xf4f0e0,0xffd84a,0xc86ad0,0xff7a5a,0x8ac8ff]; for(let i=0;i<9;i++){ const x=_R(-0.5,0.5), z=_R(-0.5,0.5), h=_R(0.25,0.55), st=new THREE.CylinderGeometry(0.012,0.012,h,3); st.translate(x,h/2,z); P.push({geo:st,col:0x4e7a2e});
    const hd=new THREE.IcosahedronGeometry(_R(0.05,0.08),0); hd.translate(x,h,z); P.push({geo:hd,col:cols[(Math.random()*cols.length)|0]}); } return _mergeColored(P); });
const reeds=()=>geo('rd', ()=>{ const P=[]; for(let i=0;i<10;i++){ const h=_R(1.0,1.9), c=new THREE.ConeGeometry(0.035,h,3); c.translate(0,h/2,0); c.rotateZ(_R(-0.25,0.25)); c.rotateX(_R(-0.25,0.25)); c.translate(_R(-0.35,0.35),0,_R(-0.35,0.35)); P.push({geo:c,col:i%3?0x7a8a46:0xa89a5a});
    if(i%3===0){ const t=new THREE.CylinderGeometry(0.05,0.05,0.25,5); t.translate(0,h*0.85,0); P.push({geo:t,col:0x6a4a2a}); } } return _mergeColored(P); });   // cat-tail heads
const hay=()=>geo('hy', ()=>{ const P=[], d=new THREE.SphereGeometry(1.3,10,7,0,6.28,0,Math.PI*0.62); d.scale(1,1.5,1); P.push({geo:d,col:0xd8b464}); const pole=new THREE.CylinderGeometry(0.05,0.05,1.0,4); pole.translate(0,2.2,0); P.push({geo:pole,col:0x6a4a2a}); return _mergeColored(P); });

// ---------- placement ----------
const M=new THREE.Matrix4(), Q=new THREE.Quaternion(), E=new THREE.Euler(), V=new THREE.Vector3(), SC=new THREE.Vector3(), C=new THREE.Color();
export const FLORA = { meshes:[] };
export function clearFlora(){ for(const m of FLORA.meshes){ m.parent && m.parent.remove(m); m.dispose && m.dispose(); } FLORA.meshes.length=0; for(let i=crushables.length-1;i>=0;i--) if(crushables[i].flora) crushables.splice(i,1); }
function okSpot(x,z,r){ return inField(x,z,r+1) && !inZone(x,z,r) && Math.hypot(x,z)>32 && Math.hypot(x,z-ARENA*0.55)>12 && !wetAt(x,z,r+0.5) && !blocks.some(b=>Math.hypot(b.x-x,b.z-z)<b.r+r+0.6); }
function plant(g, n, opt){ const list=[]; const tries=n*6;
  for(let t=0;t<tries && list.length<n;t++){ let x, z; if(opt.near){ const p=opt.near(); if(!p) continue; [x,z]=p; } else { x=_R(-ARENA+6,ARENA-6); z=_R(-ARENA+6,ARENA-6); }
    if(opt.high && heightAt(x,z)<opt.high && Math.random()<0.8) continue; if(!(opt.near?inField(x,z,1)&&!inZone(x,z,1):okSpot(x,z,opt.r||1))) continue;
    list.push({ x, z, s:_R(opt.s[0],opt.s[1]), ry:_R(0,6.28) }); }
  if(!list.length) return; const im=new THREE.InstancedMesh(g, floraMat(), list.length); im.castShadow=!MOBILE && opt.shadow!==false; im.receiveShadow=true;
  list.forEach((o,k)=>{ M.compose(V.set(o.x, heightAt(o.x,o.z)-0.05, o.z), Q.setFromEuler(E.set(0,o.ry,0)), SC.set(o.s,o.s*_R(0.9,1.12),o.s)); im.setMatrixAt(k,M);
    C.setHSL(0, 0, 1); C.offsetHSL(_R(-0.03,0.03), _R(-0.08,0.06), _R(-0.08,0.08)); im.setColorAt(k, C);
    crushables.push({ x:o.x, z:o.z, r:(opt.cr||0.5)*o.s, im, k, alive:true, kind:opt.kind||'grass', ry:o.ry, s:o.s, flora:true }); });
  im.instanceMatrix.needsUpdate=true; if(im.instanceColor) im.instanceColor.needsUpdate=true; im.computeBoundingSphere(); arena.add(im); FLORA.meshes.push(im); }
function bankSpot(){ if(!RIVER.on || !RIVER.lines.length) return null; const L=RIVER.lines[(Math.random()*RIVER.lines.length)|0], p=L[(Math.random()*L.length)|0], w=L===RIVER.lines[0]?5.5:3.2, a=Math.random()*6.28, r=w*_R(0.95,1.35);
  const x=p.x+Math.cos(a)*r, z=p.z+Math.sin(a)*r, h=heightAt(x,z); return (h>RIVER.y-0.05 && h<RIVER.y+0.6) ? [x,z] : null; }
export function buildFlora(){ clearFlora(); const n=BIOME.name, k=(MOBILE?0.5:1)*AREA_K/2, N=(v)=>Math.round(v*k);
  if(n==='HILLS'){ plant(conifer(false), N(90), { s:[0.8,1.5], high:0.6, kind:'tree', cr:0.55 }); plant(broadleaf(), N(30), { s:[0.8,1.2], kind:'tree', cr:0.6 }); plant(bush(false), N(70), { s:[0.7,1.3], shadow:false }); plant(flowers(), N(120), { s:[0.8,1.4], shadow:false }); }
  else if(n==='VILLAGE'){ plant(palm(), N(26), { s:[0.85,1.25], kind:'tree', cr:0.4 }); plant(bamboo(), N(16), { s:[0.9,1.2], kind:'tree', cr:0.9 }); plant(broadleaf(), N(22), { s:[0.8,1.15], kind:'tree', cr:0.6 });
    plant(bush(false), N(60), { s:[0.7,1.2], shadow:false }); plant(flowers(), N(140), { s:[0.8,1.4], shadow:false }); plant(reeds(), N(200), { s:[0.8,1.3], near:bankSpot, shadow:false }); plant(hay(), N(8), { s:[0.9,1.2], cr:1.2 }); }
  else if(n==='MEADOW'){ plant(broadleaf(), N(40), { s:[0.8,1.3], kind:'tree', cr:0.6 }); plant(bush(false), N(70), { s:[0.7,1.3], shadow:false }); plant(flowers(), N(200), { s:[0.8,1.4], shadow:false }); }
  else if(n==='TUNDRA'){ plant(conifer(true), N(40), { s:[0.8,1.4], kind:'tree', cr:0.55 }); }
  else if(n==='DESERT'){ plant(palm(), N(10), { s:[0.8,1.1], kind:'tree', cr:0.4 }); plant(bush(true), N(35), { s:[0.6,1.1], shadow:false }); }
  else if(n==='CITY'){ plant(broadleaf(), N(18), { s:[0.7,1.0], kind:'tree', cr:0.6 }); plant(bush(false), N(20), { s:[0.6,1.0], shadow:false }); }
  else { plant(bush(true), N(22), { s:[0.6,1.0], shadow:false }); } }
