// fx/weather.js — Z107 WEATHER: rain squalls (streaks + wet, glossy ground + lightning), sandstorms (driven grit + thick ochre haze), snowfall, ground fog — a particle box that rides with the camera, plus haze/light changes layered on the battlefield atmosphere.
import * as THREE from 'three';
import { WEATHER } from '../../config.js';
import { MOBILE, S, ambient, camera, groundMat, hemi, renderer, scene, sun } from '../hub.js';

export const WX = { id:'clear', def:null, obj:null, N:0, P:null, V:null, box:[56,26,56], boltT:0, flash:0, exp0:1, wind:new THREE.Vector2(), rough0:null };
export function _wxTex(kind){ const c=document.createElement('canvas'); c.width=c.height=32; const x=c.getContext('2d');
  const g=x.createRadialGradient(16,16,0,16,16,16); g.addColorStop(0, kind==='sand'?'rgba(230,200,150,1)':'rgba(255,255,255,1)'); g.addColorStop(0.5, kind==='sand'?'rgba(200,160,110,.5)':'rgba(255,255,255,.55)'); g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g; x.fillRect(0,0,32,32); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
export function weatherDef(id){ return WEATHER[id]||WEATHER.clear; }
// apply on top of applyAtmosphere() (call right after it): haze, light, ground gloss, particles
export function applyWeather(id){
  const W=weatherDef(id); WX.id=WEATHER[id]?id:'clear'; WX.def=W; S.weather=WX.id;
  if(WX.obj){ scene.remove(WX.obj); WX.obj.geometry.dispose(); WX.obj.material.dispose(); WX.obj=null; }
  if(WX.rough0==null) WX.rough0=groundMat.roughness;
  WX.exp0=renderer.toneMappingExposure; WX.flash=0; WX.boltT=W.bolt?W.bolt[0]:0;
  if(W.fogK!==1 && scene.fog){ scene.fog.density*=W.fogK; }
  if(W.tint!=null && scene.fog){ const c=new THREE.Color(W.tint), k=S.tod==='night'?0.25:0.6; scene.fog.color.lerp(c, k); if(scene.background && scene.background.isColor) scene.background.copy(scene.fog.color); }
  sun.intensity*=W.sunK; hemi.intensity*=W.hemiK; if(WX.id!=='clear') ambient.intensity*=1.15;
  groundMat.roughness = W.wet ? Math.min(groundMat.roughness, 1-W.wet) : groundMat.roughness;   // rain: the dirt turns dark and glossy
  if(W.wet){ groundMat.color && groundMat.color.setScalar(0.82); } else if(groundMat.color) groundMat.color.setScalar(1);
  WX.wind.set(id==='sand'?14:(id==='rain'?2.5:1.2), id==='sand'?4:0.8);
  const n=W.n[MOBILE?1:0]|0; WX.N=n; if(!n) return;
  const [bx,by,bz]=WX.box, rain=id==='rain';
  const P=new Float32Array(n*(rain?6:3)), V=new Float32Array(n*3);
  for(let i=0;i<n;i++){ const x=(Math.random()-0.5)*bx, y=Math.random()*by, z=(Math.random()-0.5)*bz;
    if(rain){ P.set([x,y,z,x,y-0.9,z], i*6); V.set([0, -(26+Math.random()*8), 0], i*3); }
    else { P.set([x,y,z], i*3); V.set(id==='sand'?[0, (Math.random()-0.5)*1.2, 0]:[(Math.random()-0.5)*0.6, -(1.4+Math.random()*1.2), (Math.random()-0.5)*0.6], i*3); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P,3)); WX.P=P; WX.V=V;
  if(rain) WX.obj=new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color:0xb8c8d8, transparent:true, opacity:S.tod==='night'?0.32:0.4, depthWrite:false, fog:true }));
  else WX.obj=new THREE.Points(g, new THREE.PointsMaterial({ map:_wxTex(id), size:id==='sand'?0.34:0.26, color:id==='sand'?0xd8b080:0xffffff, transparent:true, opacity:id==='sand'?0.55:0.85, depthWrite:false, sizeAttenuation:true, fog:true }));
  WX.obj.frustumCulled=false; WX.obj.renderOrder=5; scene.add(WX.obj);
}
// the box follows the camera's ground target; particles wrap round it, so the storm never runs out
export function updateWeather(dt){
  if(WX.flash>0){ WX.flash=Math.max(0, WX.flash-dt*5); renderer.toneMappingExposure = WX.exp0*(1+WX.flash*0.7); }   // Z107 softer lightning (a full-screen 160% flash read as flicker)
  if(WX.def && WX.def.bolt){ WX.boltT-=dt; if(WX.boltT<=0){ WX.boltT=WX.def.bolt[0]+Math.random()*(WX.def.bolt[1]-WX.def.bolt[0]); WX.flash=0.9+Math.random()*0.6; } }   // lightning lights the whole field for an instant
  const o=WX.obj; if(!o) return; const p=S.player, cx=p?p.pos.x:camera.position.x, cz=p?p.pos.z:camera.position.z;
  o.position.set(cx, 0, cz);
  const P=WX.P, V=WX.V, n=WX.N, [bx,by,bz]=WX.box, hx=bx/2, hz=bz/2, wx=WX.wind.x*dt, wz=WX.wind.y*dt, rain=WX.id==='rain', t=performance.now()/1000;
  for(let i=0;i<n;i++){ const k=rain?i*6:i*3, v=i*3;
    let x=P[k]+wx+V[v]*dt, y=P[k+1]+V[v+1]*dt, z=P[k+2]+wz+V[v+2]*dt;
    if(WX.id==='snow'){ x+=Math.sin(t*1.3+i)*dt*0.5; }
    if(y<0){ y+=by; } else if(y>by) y-=by;
    if(x>hx) x-=bx; else if(x<-hx) x+=bx; if(z>hz) z-=bz; else if(z<-hz) z+=bz;
    P[k]=x; P[k+1]=y; P[k+2]=z;
    if(rain){ P[k+3]=x-WX.wind.x*0.035; P[k+4]=y-0.9; P[k+5]=z-WX.wind.y*0.035; } }
  o.geometry.attributes.position.needsUpdate=true;
}
// your guns reach a little less through rain, sand and fog
export function weatherRange(){ return (WX.def&&WX.def.range)||1; }
