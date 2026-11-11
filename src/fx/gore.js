// fx/gore.js — Z121 GORE: blood on the ground as real soft-edged splats (one instanced draw, they fade out) and bodies torn into
//   chunks with physics (thrown along the shot, spin, bounce, trail blood, splat where they land). Replaces the blocky dark squares the
//   low-resolution ground-decal canvas gave for blood.
import * as THREE from 'three';
import { GORE } from '../../config.js';
import { BIOME, MOBILE, S, heightAt, scene, spawnPart } from '../hub.js';

// ---------- ground splats ----------
function splatTex(){ const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d');
  for(let i=0;i<9;i++){ const a=Math.random()*6.283, d=i?Math.random()*24:0, cx=64+Math.cos(a)*d, cy=64+Math.sin(a)*d, r=i?9+Math.random()*15:28;
    const g=x.createRadialGradient(cx,cy,0,cx,cy,r); g.addColorStop(0,'rgba(255,255,255,0.95)'); g.addColorStop(0.72,'rgba(255,255,255,0.8)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.beginPath(); x.arc(cx,cy,r,0,7); x.fill(); }
  for(let i=0;i<16;i++){ const a=Math.random()*6.283, d=32+Math.random()*26, r=1.2+Math.random()*3.4; x.fillStyle='rgba(255,255,255,0.85)'; x.beginPath(); x.arc(64+Math.cos(a)*d, 64+Math.sin(a)*d, r, 0, 7); x.fill(); }   // droplets flung round the pool
  return new THREE.CanvasTexture(c); }
const NS = MOBILE ? GORE.splats[1] : GORE.splats[0];
const SPL = (()=>{ const base=new THREE.PlaneGeometry(1,1); base.rotateX(-Math.PI/2); const g=new THREE.InstancedBufferGeometry(); g.index=base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  const iPos=new THREE.InstancedBufferAttribute(new Float32Array(NS*3),3).setUsage(THREE.DynamicDrawUsage), iSRA=new THREE.InstancedBufferAttribute(new Float32Array(NS*3),3).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iPos',iPos); g.setAttribute('iSRA',iSRA); g.instanceCount=0;
  const mat=new THREE.ShaderMaterial({ uniforms:{ map:{ value:splatTex() }, col:{ value:new THREE.Color(GORE.color) } }, transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-6, polygonOffsetUnits:-12,
    vertexShader:'attribute vec3 iPos; attribute vec3 iSRA; varying vec2 vUv; varying float vA;\n'+
      'void main(){ float c=cos(iSRA.y), s=sin(iSRA.y); vec3 p=vec3((c*position.x-s*position.z)*iSRA.x, 0.0, (s*position.x+c*position.z)*iSRA.x); vUv=uv; vA=iSRA.z; gl_Position=projectionMatrix*viewMatrix*vec4(iPos+p,1.0); }',
    fragmentShader:'uniform sampler2D map; uniform vec3 col; varying vec2 vUv; varying float vA; void main(){ float a=texture2D(map,vUv).a*vA; if(a<0.01) discard; gl_FragColor=vec4(col, a); }' });
  const mesh=new THREE.Mesh(g, mat); mesh.frustumCulled=false; mesh.renderOrder=-1; scene.add(mesh);
  return { g, iPos, iSRA, items:[], dirty:false, at:0 }; })();
// a pool of blood at (x,z), radius r metres — grows in over a moment, fades out at the end of its life
export function bloodSplat(x, z, r){ if(!isFinite(x) || !isFinite(z)) return; const L=SPL.items; if(L.length>=NS) L.shift();
  L.push({ x, y:heightAt(x,z)+0.05, z, s:Math.max(0.2, r*2), rot:Math.random()*6.283, t:0 }); SPL.dirty=true; }
function flushSplats(){ const L=SPL.items, P=SPL.iPos.array, A=SPL.iSRA.array, T=GORE.splatLife, F=GORE.fade;
  for(let i=0;i<L.length;i++){ const q=L[i], grow=Math.min(1, 0.45+q.t*1.6), a=q.t>T-F ? Math.max(0,(T-q.t)/F) : 1;
    P[i*3]=q.x; P[i*3+1]=q.y; P[i*3+2]=q.z; A[i*3]=q.s*grow; A[i*3+1]=q.rot; A[i*3+2]=a*GORE.alpha; }
  SPL.g.instanceCount=L.length; SPL.iPos.needsUpdate=true; SPL.iSRA.needsUpdate=true; SPL.dirty=false; }

// ---------- body chunks ----------
const NC = MOBILE ? GORE.chunks[1] : GORE.chunks[0], CH=[], CPOOL=[];
let _cg=null, _cm=null;
function chunkKit(){ if(_cg) return; _cg={ torso:new THREE.BoxGeometry(0.34,0.42,0.2), head:new THREE.SphereGeometry(0.13,8,6), limb:new THREE.BoxGeometry(0.1,0.38,0.1), bit:new THREE.BoxGeometry(0.12,0.12,0.12) };
  const L=(c)=>new THREE.MeshLambertMaterial({ color:c }); _cm={ foe:L(0x7a6a4a), ours:L(0x4e6230), skin:L(0xb07a52), gore:L(0x6a0c0a), dark:L(0x1e1f1a) }; }
// tear a body apart: pieces fly along (dx,dz) with `power` (1 = a tank shell), spin, bounce, bleed
export function gibBody(x, y, z, dx, dz, power, ours, scale){ chunkKit(); power=Math.max(0.3, Math.min(2.2, power||1)); const L=Math.hypot(dx,dz)||1; dx/=L; dz/=L; const s=scale||1.5, cloth=ours?_cm.ours:_cm.foe;
  const parts=[['torso',cloth],['head',_cm.skin],['limb',cloth],['limb',cloth],['limb',cloth],['limb',_cm.gore],['bit',_cm.gore],['bit',_cm.dark]], n=MOBILE?5:parts.length;
  for(let i=0;i<n;i++){ const [gk,mat]=parts[i]; let c=CPOOL.pop(); if(!c){ if(CH.length>=NC){ c=CH.shift(); } else { c={ m:new THREE.Mesh(_cg[gk], mat) }; c.m.castShadow=!MOBILE; } }
    c.m.geometry=_cg[gk]; c.m.material=mat; c.m.scale.setScalar(s); c.m.visible=true; if(!c.m.parent) scene.add(c.m);
    const a=Math.atan2(dx,dz)+(Math.random()-0.5)*GORE.cone, sp=(GORE.speed[0]+Math.random()*(GORE.speed[1]-GORE.speed[0]))*power*(gk==='torso'?0.7:1);
    c.x=x+(Math.random()-0.5)*0.4; c.y=y+0.5+Math.random()*0.9; c.z=z+(Math.random()-0.5)*0.4; c.vx=Math.sin(a)*sp; c.vz=Math.cos(a)*sp; c.vy=(GORE.up[0]+Math.random()*(GORE.up[1]-GORE.up[0]))*Math.sqrt(power);
    c.rx=(Math.random()-0.5)*26; c.ry=(Math.random()-0.5)*18; c.rz=(Math.random()-0.5)*26; c.t=0; c.b=0; c.rest=false; c.m.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6); CH.push(c); }
  // the hit itself: a red burst thrown forward + mist
  for(let k=0;k<Math.round((MOBILE?10:18)*Math.min(1.5,power));k++){ const a=Math.atan2(dx,dz)+(Math.random()-0.5)*1.5, sp=(3+Math.random()*11)*power; spawnPart(x, y+0.7+Math.random()*0.8, z, Math.sin(a)*sp, 1+Math.random()*6, Math.cos(a)*sp, {color:Math.random()<0.6?0x8a1410:0x5a0a08, size:0.14+Math.random()*0.22, life:0.5+Math.random()*0.35, grav:-17, drag:0.9}); }
  spawnPart(x+dx*0.5, y+1.0, z+dz*0.5, dx*4*power, 1.2, dz*4*power, {color:0x7a1210, size:1.5, life:0.45, smoke:true, grav:-0.6, drag:2.6, grow:1.4, op:0.5});
  bloodSplat(x, z, 0.6+0.2*power); S.shake=Math.min(2.2, S.shake+0.18*power); }
export function updateGore(dt, now){
  // chunks
  for(let i=CH.length-1;i>=0;i--){ const c=CH[i]; c.t+=dt;
    if(!c.rest){ c.vy-=26*dt; c.x+=c.vx*dt; c.y+=c.vy*dt; c.z+=c.vz*dt; c.m.rotation.x+=c.rx*dt; c.m.rotation.y+=c.ry*dt; c.m.rotation.z+=c.rz*dt;
      if(Math.random()<0.45) spawnPart(c.x, c.y, c.z, 0, -0.5, 0, {color:0x7a1210, size:0.13, life:0.35, grav:-12, drag:1});          // it bleeds as it flies
      const g=heightAt(c.x,c.z)+0.08; if(c.y<=g && c.vy<0){ c.y=g; bloodSplat(c.x, c.z, 0.22+Math.random()*0.3);
        if(c.b<2 && -c.vy>3.5){ c.b++; c.vy*=-0.32; c.vx*=0.55; c.vz*=0.55; c.rx*=0.5; c.ry*=0.5; c.rz*=0.5; spawnPart(c.x, g+0.2, c.z, 0, 0.8, 0, {color:BIOME.ground, size:0.7, life:0.5, smoke:true, grav:-0.3, drag:2, op:0.4}); }
        else { c.rest=true; c.vx=c.vy=c.vz=0; } } }
    c.m.position.set(c.x, c.y, c.z);
    if(c.t>GORE.chunkLife){ c.m.position.y-= (c.t-GORE.chunkLife)*0.5; if(c.t>GORE.chunkLife+0.6){ c.m.visible=false; CH.splice(i,1); CPOOL.push(c); } } }
  // splats: age + refresh the buffers a few times a second (or at once when one was added)
  const L=SPL.items; if(L.length){ for(const q of L) q.t+=dt; while(L.length && L[0].t>GORE.splatLife){ L.shift(); SPL.dirty=true; }
    if(SPL.dirty || now>SPL.at){ SPL.at=now+0.12; flushSplats(); } }
  else if(SPL.g.instanceCount){ SPL.g.instanceCount=0; } }
export function clearGore(){ for(const c of CH){ c.m.visible=false; CPOOL.push(c); } CH.length=0; SPL.items.length=0; SPL.g.instanceCount=0; }
export function goreCount(){ return { chunks:CH.length, splats:SPL.items.length }; }
