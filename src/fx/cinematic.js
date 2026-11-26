// fx/cinematic.js — Z189 CINEMATIC COMBAT FX: a shock dome that rips out of every tank kill, real fire light (blasts flash the ground, burning wrecks
//   light it orange and flicker), hot sparks + armour shards off the side of OUR tank that was hit, a red marker at the screen edge pointing at
//   whoever hit you, and a tank that smokes grey when hurt and burns black when it is nearly gone.
import * as THREE from 'three';
import { MOBILE, S, gradePass, heightAt, scene, updateBodyHit } from '../hub.js';

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
// Z190 fire light WITHOUT real lights: adding a PointLight mid-fight changes the scene's light count, so three.js recompiles every
//   material's shader → multi-second freezes, and each light also costs every pixel. Instead a soft additive glow is laid on the ground
//   (blasts flash it, burning wrecks keep it flickering orange) — same look, one cheap quad each, never a recompile.
let _glowTex=null;
export function groundGlowTex(){ if(_glowTex) return _glowTex; const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'), g=x.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.3,'rgba(255,255,255,0.5)'); g.addColorStop(0.65,'rgba(255,255,255,0.14)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,128,128);
  _glowTex=new THREE.CanvasTexture(c); _glowTex.colorSpace=THREE.SRGBColorSpace; return _glowTex; }
const _glowGeo=new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2);
export function groundGlowMesh(col, op){ const m=new THREE.Mesh(_glowGeo, new THREE.MeshBasicMaterial({ color:col, map:groundGlowTex(), transparent:true, opacity:op||0, depthWrite:false, blending:THREE.AdditiveBlending, fog:false, polygonOffset:true, polygonOffsetFactor:-4 })); m.renderOrder=6; return m; }
function lightSlot(){ let L=CINE.lights.find(q=>!q.busy); if(!L){ if(CINE.lights.length>=(MOBILE?4:8)) return null; const m=groundGlowMesh(0xff8a3a, 0); m.visible=false; scene.add(m); L={ m, busy:false }; CINE.lights.push(L); } return L; }
export function blastLight(x, z, power, life){ const L=lightSlot(); if(!L) return; L.busy=true; L.t=life||0.5; L.t0=L.t; L.p=Math.min(1, (power||60)/110); L.follow=null; L.m.material.color.setHex(0xffb060); L.m.scale.setScalar(6+(power||60)*0.09); L.m.position.set(x, heightAt(x,z)+0.25, z); L.m.visible=true; }
export function fireLight(wreck, life){ const L=lightSlot(); if(!L) return; L.busy=true; L.t=life; L.t0=life; L.p=0.26; L.follow=wreck; L.m.material.color.setHex(0xff8a3a); L.m.scale.setScalar(6*(wreck.ms||1));   /* Z312 softer, less red: firelight, not a glowing plate */ L.m.visible=true; }
// he was hit: a red marker at the screen edge points back at the shooter (its strength by the blow)
export function hitMarker(sx, sz, dmg){ let wrap=document.getElementById('hitDir'); if(!wrap){ wrap=document.createElement('div'); wrap.id='hitDir'; document.body.appendChild(wrap); }
  const yaw=S.camYaw||0, a=Math.atan2(sx, -sz)+yaw, el=document.createElement('i'); el.style.setProperty('--a', a+'rad'); el.style.setProperty('--k', Math.min(1, 0.45+dmg/40).toFixed(2)); wrap.appendChild(el);
  setTimeout(()=>el.remove(), 1100); while(wrap.children.length>5) wrap.firstChild.remove(); }
export function updateCinematic(dt, now){
  for(const d of CINE.domes){ if(d.t<=0) continue; d.t-=dt; const k=1-Math.max(0,d.t)/0.34, e=1-Math.pow(1-k,3); d.m.scale.setScalar(0.3+d.R*1.25*e); d.m.material.uniforms.opacity.value=0.9*(1-k)*(1-k); if(d.t<=0) d.m.visible=false; }
  for(const L of CINE.lights){ if(!L.busy) continue; L.t-=dt; if(L.t<=0){ L.busy=false; L.m.visible=false; continue; }
    if(L.follow){ const w=L.follow; L.m.position.set(w.x, heightAt(w.x,w.z)+0.25, w.z); const k=Math.min(1, L.t/L.t0*1.4); L.m.material.opacity=L.p*k*(0.75+0.2*Math.sin(now*17+w.x)+0.1*Math.random()); }
    else { const k=L.t/L.t0; L.m.material.opacity=0.85*L.p*k*k; } }
  if(gradePass && gradePass.uniforms.flash && gradePass.uniforms.flash.value>0) gradePass.uniforms.flash.value=Math.max(0, gradePass.uniforms.flash.value-dt*1.6);
  updateBodyHit(dt, now); }   // HIT 1 he is a man: low on health his edge goes red and his heart and breath are heard (fx/soldier-fx.js) — the tank's smoking, then burning engine deck is gone
