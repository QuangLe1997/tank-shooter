// fx/weather.js — Z107 WEATHER: rain squalls (streaks + wet, glossy ground + lightning), sandstorms (driven grit + thick ochre haze), snowfall, ground fog — a particle box that rides with the camera, plus haze/light changes layered on the battlefield atmosphere.
import * as THREE from 'three';
import { WEATHER, WXFX } from '../../config.js';
import { MOBILE, S, ambient, burst, camera, gradePass, groundMat, heightAt, hemi, lightning, renderer, scene, sfx, spawnPart, sun } from '../hub.js';

export const WX = { gust:1, gustT:6, gustE:0, splashA:0, driftA:0, id:'clear', def:null, obj:null, N:0, P:null, V:null, box:[56,26,56], boltT:0, flash:0, exp0:1, wind:new THREE.Vector2(), rough0:null };
export function _wxTex(kind){ const c=document.createElement('canvas'); c.width=c.height=32; const x=c.getContext('2d');
  const g=x.createRadialGradient(16,16,0,16,16,16); g.addColorStop(0, kind==='sand'?'rgba(230,200,150,1)':'rgba(255,255,255,1)'); g.addColorStop(0.5, kind==='sand'?'rgba(200,160,110,.5)':'rgba(255,255,255,.55)'); g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g; x.fillRect(0,0,32,32); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
export function weatherDef(id){ return WEATHER[id]||WEATHER.clear; }
// apply on top of applyAtmosphere() (call right after it): haze, light, ground gloss, particles
export function applyWeather(id, k){
  const W=weatherDef(id); WX.id=WEATHER[id]?id:'clear'; WX.def=W; S.weather=WX.id; k=k==null?1:k;
  // Z144 start from the battlefield's own atmosphere every time — weather used to stack on top of the last weather (a passing storm left the haze thick for good)
  if(!WX.base && scene.fog){ const g=gradePass.uniforms; WX.base={ fogD:scene.fog.density, fogC:scene.fog.color.clone(), sun:sun.intensity, hemi:hemi.intensity, amb:ambient.intensity,
    g:{ sat:g.sat.value, con:g.contrast.value, sh:g.shTint.value.clone(), hi:g.hiTint.value.clone(), vig:g.vig.value, exp:renderer.toneMappingExposure } }; }
  if(WX.base && WX.base.g){ const g=gradePass.uniforms, B=WX.base.g, G=WXFX.grade[WX.id];   // Z224 each sky its own film stock — always from the battlefield's own grade, never stacked
    g.sat.value=B.sat; g.contrast.value=B.con; g.shTint.value.copy(B.sh); g.hiTint.value.copy(B.hi); g.vig.value=B.vig; renderer.toneMappingExposure=B.exp;
    if(G){ g.sat.value=Math.max(0.45, B.sat+G.sat*k); g.contrast.value=B.con+G.con*k; g.shTint.value.x+=G.sh[0]*k; g.shTint.value.y+=G.sh[1]*k; g.shTint.value.z+=G.sh[2]*k;
      g.hiTint.value.x+=G.hi[0]*k; g.hiTint.value.y+=G.hi[1]*k; g.hiTint.value.z+=G.hi[2]*k; g.vig.value=B.vig+G.vig*k; renderer.toneMappingExposure=B.exp*(1+(G.exp-1)*k); } }
  if(WX.base && scene.fog){ const B=WX.base; scene.fog.density=B.fogD; scene.fog.color.copy(B.fogC); if(scene.background && scene.background.isColor) scene.background.copy(B.fogC); sun.intensity=B.sun; hemi.intensity=B.hemi; ambient.intensity=B.amb; }
  if(WX.obj){ scene.remove(WX.obj); WX.obj.geometry.dispose(); WX.obj.material.dispose(); WX.obj=null; }
  if(WX.rough0==null) WX.rough0=groundMat.roughness;
  WX.exp0=renderer.toneMappingExposure; WX.flash=0; WX.boltT=W.bolt?W.bolt[0]:0;
  if(W.fogK!==1 && scene.fog){ scene.fog.density*=1+(W.fogK-1)*k; }
  if(W.tint!=null && scene.fog){ const c=new THREE.Color(W.tint), kk=(S.tod==='night'?0.25:0.6)*k; scene.fog.color.lerp(c, kk); if(scene.background && scene.background.isColor) scene.background.copy(scene.fog.color); }
  sun.intensity*=1+(W.sunK-1)*k; hemi.intensity*=1+(W.hemiK-1)*k; if(WX.id!=='clear') ambient.intensity*=1.15;
  groundMat.roughness = W.wet ? Math.min(groundMat.roughness, 1-W.wet) : groundMat.roughness;   // rain: the dirt turns dark and glossy
  if(W.wet){ groundMat.color && groundMat.color.setScalar(0.82); } else if(groundMat.color) groundMat.color.setScalar(1);
  WX.wind.set(id==='sand'?14:(id==='rain'?2.5:1.2), id==='sand'?4:0.8);
  const n=Math.round((W.n[MOBILE?1:0]|0)*Math.min(1,k)); WX.N=n; if(!n) return;
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
  if(WX.def && WX.def.bolt){ WX.boltT-=dt; if(WX.boltT<=0){ WX.boltT=WX.def.bolt[0]+Math.random()*(WX.def.bolt[1]-WX.def.bolt[0]); WX.flash=0.9+Math.random()*0.6; skyBolt(); } }   // lightning lights the whole field for an instant · Z224 and you see the bolt come down
  airLife(dt);
  const o=WX.obj; if(!o) return; const p=S.player, cx=p?p.pos.x:camera.position.x, cz=p?p.pos.z:camera.position.z;
  o.position.set(cx, 0, cz);
  const P=WX.P, V=WX.V, n=WX.N, [bx,by,bz]=WX.box, hx=bx/2, hz=bz/2, gk=1+(WX.gust-1)*WX.gustE, wx=WX.wind.x*dt*gk, wz=WX.wind.y*dt*gk, rain=WX.id==='rain', t=performance.now()/1000;
  for(let i=0;i<n;i++){ const k=rain?i*6:i*3, v=i*3;
    let x=P[k]+wx+V[v]*dt, y=P[k+1]+V[v+1]*dt, z=P[k+2]+wz+V[v+2]*dt;
    if(WX.id==='snow'){ x+=Math.sin(t*1.3+i)*dt*0.5; }
    if(y<0){ y+=by; } else if(y>by) y-=by;
    if(x>hx) x-=bx; else if(x<-hx) x+=bx; if(z>hz) z-=bz; else if(z<-hz) z+=bz;
    P[k]=x; P[k+1]=y; P[k+2]=z;
    if(rain){ P[k+3]=x-WX.wind.x*0.035*gk; P[k+4]=y-0.9; P[k+5]=z-WX.wind.y*0.035*gk; } }
  o.geometry.attributes.position.needsUpdate=true;
}
// Z224 a bolt you can see: a jagged white-blue stroke from the cloud base to the ground somewhere out in the storm; thunder a beat later
const _a=new THREE.Vector3(), _b=new THREE.Vector3();
function skyBolt(){ const p=S.player; if(!p || S.mode!=='playing') return; const B=WXFX.bolt, ang=Math.random()*6.283, r=B.r[0]+Math.random()*(B.r[1]-B.r[0]);
  const gx=p.pos.x+Math.cos(ang)*r, gz=p.pos.z+Math.sin(ang)*r, gy=heightAt(gx,gz); let x=gx+(Math.random()-0.5)*16, z=gz+(Math.random()-0.5)*16, y=B.h;
  const segs=5; for(let i=1;i<=segs;i++){ const t=i/segs, nx=i===segs?gx:x+(gx-x)/(segs-i+1)+(Math.random()-0.5)*7, nz=i===segs?gz:z+(gz-z)/(segs-i+1)+(Math.random()-0.5)*7, ny=B.h+(gy-B.h)*t;
    lightning(_a.set(x,y,z), _b.set(nx,ny,nz), 0xb8d8ff, 0.3, 1.3); x=nx; y=ny; z=nz; }
  burst({ x:gx, z:gz }, 0xdfeaff, 6, 5, { y:gy+0.5, life:0.25, size:1.4, grav:0, drag:4 });
  const d=Math.min(B.thunder[1], Math.max(B.thunder[0], r/340*4)); setTimeout(()=>{ if(S.mode==='playing') sfx('bigexplode', new THREE.Vector3(p.pos.x+(gx-p.pos.x)*0.3, 0, p.pos.z+(gz-p.pos.z)*0.3)); }, d*1000); }
// Z224 the air is alive: gusts · rain bouncing off the ground · sheets of sand / fog / snow-smoke rolling past at ground level
function airLife(dt){ const p=S.player; if(!p || S.mode!=='playing' || WX.id==='clear') return; const G=WXFX.gust;
  WX.gustT-=dt; if(WX.gustT<=0){ WX.gustT=G.every[0]+Math.random()*(G.every[1]-G.every[0]); WX.gust=G.k[0]+Math.random()*(G.k[1]-G.k[0]); WX.gustAt=performance.now()/1000; }
  { const t=performance.now()/1000-(WX.gustAt||-99); WX.gustE = t<G.t ? Math.sin(Math.min(1,t/G.t)*Math.PI) : 0; }
  const gk=1+(WX.gust-1)*WX.gustE, wx=WX.wind.x*gk, wz=WX.wind.y*gk;
  if(WX.id==='rain'){ const Sp=WXFX.splash, nt=S.tod==='night'; WX.splashA+=dt*Sp.rate[MOBILE?1:0]; while(WX.splashA>=1){ WX.splashA-=1;
      const a=Math.random()*6.283, r=Math.sqrt(Math.random())*Sp.R, x=p.pos.x+Math.cos(a)*r, z=p.pos.z+Math.sin(a)*r;
      spawnPart(x, heightAt(x,z)+0.05, z, (Math.random()-0.5)*0.8, 1.3+Math.random()*1.2, (Math.random()-0.5)*0.8, { color:nt?0x8a98aa:0xd4e0ec, size:0.07+Math.random()*0.04, life:0.2+Math.random()*0.1, grav:-16, drag:1, op:0.8 }); } }
  const D=WXFX.drift[WX.id]; if(D){ WX.driftA+=dt*D[MOBILE?1:0]; while(WX.driftA>=1){ WX.driftA-=1;
      const wl=Math.hypot(wx,wz)||1, up=-1, a=Math.random()*6.283, r=6+Math.random()*24, x=p.pos.x+Math.cos(a)*r+wx/wl*up*10, z=p.pos.z+Math.sin(a)*r+wz/wl*up*10, sand=WX.id==='sand', fog=WX.id==='fog';
      spawnPart(x, heightAt(x,z)+0.5+Math.random()*(fog?0.6:1.2), z, wx*(0.8+Math.random()*0.4)+(Math.random()-0.5), (Math.random()-0.5)*0.3, wz*(0.8+Math.random()*0.4)+(Math.random()-0.5),
        { color:sand?0xc49a64:fog?0xcfd3d6:0xeef2f6, size:3.5+Math.random()*3, life:3+Math.random()*1.6, smoke:true, grav:0, drag:0.15, grow:1.7, op:sand?0.26:fog?0.2:0.14 }); } } }
// your guns reach a little less through rain, sand and fog
export function weatherRange(){ return (WX.def&&WX.def.range)||1; }
