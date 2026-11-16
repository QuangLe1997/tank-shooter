// fx/cinematic.js — Z189 CINEMATIC COMBAT FX: a shock dome that rips out of every tank kill, real fire light (blasts flash the ground, burning wrecks
//   light it orange and flicker), hot sparks + armour shards off the side of OUR tank that was hit, a red marker at the screen edge pointing at
//   whoever hit you, and a tank that smokes grey when hurt and burns black when it is nearly gone.
import * as THREE from 'three';
import { MOBILE, S, gradePass, heightAt, scene, spawnPart } from '../hub.js';

export const CINE = { domes:[], lights:[], hitDir:[], dmgT:0, sparkT:0 };
const _domeGeo=new THREE.SphereGeometry(1, 32, 14, 0, Math.PI*2, 0, Math.PI/2);
// the shock shell is only bright at its rim (Fresnel) — a thin wave of compressed air, not a solid bubble
function domeMat(){ return new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
  uniforms:{ color:{ value:new THREE.Color(0xffd8a0) }, opacity:{ value:0 } },
  vertexShader:'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
  fragmentShader:'uniform vec3 color; uniform float opacity; varying vec3 vN; varying vec3 vV; void main(){ float f=1.0-abs(dot(normalize(vN),normalize(vV))); f=pow(f,3.0); gl_FragColor=vec4(color*f*1.6, f*opacity); }' }); }
// a hemispherical shock wave that tears out of the blast and fades
export function shockDome(x, z, R, col){ let d=CINE.domes.find(q=>q.t<=0);
  if(!d){ if(CINE.domes.length>=(MOBILE?3:6)) return; const m=new THREE.Mesh(_domeGeo, domeMat()); m.renderOrder=9; scene.add(m); d={ m, t:0 }; CINE.domes.push(d); }
  d.t=0.34; d.R=R; d.m.visible=true; d.m.position.set(x, heightAt(x,z)+0.1, z); d.m.material.uniforms.color.value.setHex(col||0xffd8a0); d.m.scale.setScalar(0.1); }
// a short-lived point light (blast) or a long one that follows a burning wreck — a small pool, desktop only
function lightSlot(){ if(MOBILE) return null; let L=CINE.lights.find(q=>!q.busy); if(!L){ if(CINE.lights.length>=4) return null; const pl=new THREE.PointLight(0xff8a3a, 0, 30, 2); scene.add(pl); L={ pl, busy:false }; CINE.lights.push(L); } return L; }
export function blastLight(x, z, power, life){ const L=lightSlot(); if(!L) return; L.busy=true; L.t=life||0.5; L.t0=L.t; L.p=power||60; L.follow=null; L.pl.color.setHex(0xffb060); L.pl.distance=36; L.pl.position.set(x, heightAt(x,z)+4, z); L.pl.intensity=L.p; }
export function fireLight(wreck, life){ const L=lightSlot(); if(!L) return; L.busy=true; L.t=life; L.t0=life; L.p=24; L.follow=wreck; L.pl.color.setHex(0xff6a24); L.pl.distance=26; }
// our tank was hit: sparks and shards fly off the struck side + a red marker at the screen edge points at the shooter
export function playerHitFX(p, dx, dz, dmg){ const L=Math.hypot(dx||0,dz||0); const ux=L?dx/L:Math.sin(p.facing||0), uz=L?dz/L:Math.cos(p.facing||0);
  const hx=p.pos.x-ux*p.radius*0.9, hz=p.pos.z-uz*p.radius*0.9, hy=heightAt(p.pos.x,p.pos.z)+1.3, n=Math.min(26, 8+Math.round(dmg*0.8));
  for(let i=0;i<n;i++){ const sp=6+Math.random()*12; spawnPart(hx, hy, hz, -ux*sp+(Math.random()-0.5)*8, 2+Math.random()*7, -uz*sp+(Math.random()-0.5)*8, { color:Math.random()<0.6?0xffe6a0:0xff8a3a, size:0.18+Math.random()*0.22, life:0.35+Math.random()*0.3, grav:-18, drag:0.8 }); }   // hot sparks spray back toward the shooter
  spawnPart(hx, hy, hz, 0, 0, 0, { tex:'flash', color:0xfff0d0, size:2.6+dmg*0.05, life:0.08, grav:0, drag:0 });
  if(dmg>=12) for(let i=0;i<Math.min(6, 2+(dmg/10|0));i++) spawnPart(hx, hy, hz, -ux*(4+Math.random()*5)+(Math.random()-0.5)*4, 5+Math.random()*5, -uz*(4+Math.random()*5)+(Math.random()-0.5)*4, { color:0x3a3a34, size:0.4+Math.random()*0.3, life:1.1, grav:-22, drag:0.4 });   // armour shards
  spawnPart(hx, hy, hz, -ux*1.5, 1.6, -uz*1.5, { color:0x2a2620, size:1.6, life:1.2, smoke:true, grav:-0.4, drag:1.2, grow:1.6, op:0.5 });
  blastLight(hx, hz, 30, 0.18);
  if(L) hitMarker(-ux, -uz, dmg);
  if(gradePass && gradePass.uniforms.flash) gradePass.uniforms.flash.value=Math.min(0.14, gradePass.uniforms.flash.value+0.02+dmg*0.002); }
function hitMarker(sx, sz, dmg){ let wrap=document.getElementById('hitDir'); if(!wrap){ wrap=document.createElement('div'); wrap.id='hitDir'; document.body.appendChild(wrap); }
  const yaw=S.camYaw||0, a=Math.atan2(sx, -sz)+yaw, el=document.createElement('i'); el.style.setProperty('--a', a+'rad'); el.style.setProperty('--k', Math.min(1, 0.45+dmg/40).toFixed(2)); wrap.appendChild(el);
  setTimeout(()=>el.remove(), 1100); while(wrap.children.length>5) wrap.firstChild.remove(); }
export function updateCinematic(dt, now){
  for(const d of CINE.domes){ if(d.t<=0) continue; d.t-=dt; const k=1-Math.max(0,d.t)/0.34, e=1-Math.pow(1-k,3); d.m.scale.setScalar(0.3+d.R*1.25*e); d.m.material.uniforms.opacity.value=0.9*(1-k)*(1-k); if(d.t<=0) d.m.visible=false; }
  for(const L of CINE.lights){ if(!L.busy) continue; L.t-=dt; if(L.t<=0){ L.busy=false; L.pl.intensity=0; continue; }
    if(L.follow){ const w=L.follow; L.pl.position.set(w.x, heightAt(w.x,w.z)+2.2*(w.ms||1), w.z); const k=Math.min(1, L.t/L.t0*1.4); L.pl.intensity=L.p*k*(0.7+0.3*Math.sin(now*17+w.x)+0.15*Math.random()); }
    else { const k=L.t/L.t0; L.pl.intensity=L.p*k*k; } }
  if(gradePass && gradePass.uniforms.flash && gradePass.uniforms.flash.value>0) gradePass.uniforms.flash.value=Math.max(0, gradePass.uniforms.flash.value-dt*1.6);
  // damage state: a hurt tank smokes grey; nearly gone it burns and pours black smoke
  const p=S.player; if(!p || !p.mesh || !p.mesh.visible || S.mode!=='playing') return; const f=p.hp/p.maxHp; if(f>=0.5) return;
  CINE.dmgT-=dt; if(CINE.dmgT>0) return; CINE.dmgT=(MOBILE?0.12:0.06)*(f<0.25?0.7:1.3);
  const bx=p.pos.x-Math.sin(p.facing||0)*p.radius*0.55, bz=p.pos.z-Math.cos(p.facing||0)*p.radius*0.55, by=heightAt(p.pos.x,p.pos.z)+1.9;   // engine deck at the back
  spawnPart(bx+(Math.random()-0.5)*0.8, by, bz+(Math.random()-0.5)*0.8, 0.5+(Math.random()-0.5)*0.6, 2.2+Math.random()*1.4, 0.3+(Math.random()-0.5)*0.6, { color:f<0.25?0x14110e:0x6a645c, size:0.9+Math.random()*0.6, life:1.8, smoke:true, grav:0.3, drag:0.9, grow:2, op:f<0.25?0.6:0.42 });
  if(f<0.25 && Math.random()<0.7) spawnPart(bx+(Math.random()-0.5)*0.7, by-0.2, bz+(Math.random()-0.5)*0.7, (Math.random()-0.5)*0.6, 2.4+Math.random()*1.6, (Math.random()-0.5)*0.6, { tex:'fire', color:0xffe0a0, color2:0xff3a0a, size:0.8+Math.random()*0.6, life:0.45, grav:1.5, drag:1.6, grow:0.6 });
  if(f<0.25 && Math.random()<0.08) spawnPart(bx, by, bz, (Math.random()-0.5)*6, 5+Math.random()*4, (Math.random()-0.5)*6, { color:0xffd27a, size:0.2, life:0.5, grav:-18, drag:0.6 }); }   // sparks from the burning deck
