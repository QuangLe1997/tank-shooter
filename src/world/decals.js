// world/decals.js — GROUND SCARS: tread marks (fade over time) + scorch/craters/impact dirt (permanent per stage) painted into a canvas draped on the field
import * as THREE from 'three';
import { ARENA, MOBILE, arena, bloodSplat, inField, terrainGeo } from '../hub.js';

// ---- GROUND SCARS: tread marks (fade over time) + scorch/craters/impact dirt (permanent per stage) painted into a canvas draped on the field ----
export const DECAL = { W: MOBILE?512:1024, DW: MOBILE?256:512, dirtyS:false, dirtyD:false, tS:0, tD:0, fadeT:0 };
DECAL.ppu = DECAL.W/(ARENA*2); DECAL.dppu = DECAL.DW/(ARENA*2);
DECAL.stat = document.createElement('canvas'); DECAL.stat.width=DECAL.stat.height=DECAL.W;     // scorch / craters (sharp, rarely re-uploaded)
DECAL.dyn  = document.createElement('canvas'); DECAL.dyn.width=DECAL.dyn.height=DECAL.DW;      // tread prints / dirt (soft, fades, cheap to upload)
DECAL.sx = DECAL.stat.getContext('2d'); DECAL.dx = DECAL.dyn.getContext('2d');
export const _decalPlane=(cv, y, ord)=>{ const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.generateMipmaps=true;
  const m=new THREE.Mesh(terrainGeo(), new THREE.MeshLambertMaterial({ map:t, transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-4-2*ord, polygonOffsetUnits:-8-4*ord }));   // Z107 firmer offset (no z-fighting with the ground)
  m.position.y=y; m.receiveShadow=true; m.renderOrder=-3+ord; arena.add(m); return t; };   // drapes the same heightfield
DECAL.texS = _decalPlane(DECAL.stat, 0.02, 0); DECAL.texD = _decalPlane(DECAL.dyn, 0.025, 1);
export const _dpx=(x)=>(x+ARENA)*DECAL.ppu, _dpz=(z)=>(z+ARENA)*DECAL.ppu, _ddx=(x)=>(x+ARENA)*DECAL.dppu, _ddz=(z)=>(z+ARENA)*DECAL.dppu;
export let _treadCol='rgba(42,30,18,', _treadA=0.16;
export function decalReset(b){
  DECAL.sx.clearRect(0,0,DECAL.W,DECAL.W); DECAL.dx.clearRect(0,0,DECAL.DW,DECAL.DW); DECAL.dirtyS=DECAL.dirtyD=true;
  const nm=b&&b.name; _treadCol = nm==='TUNDRA' ? 'rgba(70,84,100,' : nm==='MEADOW' ? 'rgba(48,40,24,' : nm==='FOUNDRY' ? 'rgba(10,8,6,' : 'rgba(42,30,18,';
  _treadA = nm==='TUNDRA' ? 0.26 : nm==='MEADOW' ? 0.24 : 0.16;
  for(let i=0;i<(MOBILE?8:14);i++){ let x=0,z=0,ok=false; for(let t=0;t<12&&!ok;t++){ x=(Math.random()*2-1)*(ARENA-6); z=(Math.random()*2-1)*(ARENA-6); ok=Math.hypot(x,z)>14 && Math.hypot(x,z-ARENA*0.55)>8 && inField(x,z,4); }   // old shell craters from earlier fighting
    if(ok) decalCrater(x,z,1.4+Math.random()*2.6, 0.6); }
}
export function decalTread(x, z, facing, scale){                                       // one pair of track prints (both belts)
  const c=DECAL.dx, P=DECAL.dppu, s=scale||1, w=0.6*s*P, l=0.6*s*P, off=1.18*s*P;
  c.save(); c.translate(_ddx(x),_ddz(z)); c.rotate(-facing);
  c.fillStyle=_treadCol+_treadA+')'; c.fillRect(-off-w/2,-l/2,w,l); c.fillRect(off-w/2,-l/2,w,l);
  c.fillStyle=_treadCol+(_treadA*1.6).toFixed(3)+')'; for(const sx of [-off,off]) for(let k=0;k<2;k++) c.fillRect(sx-w/2, -l/2+k*l/2, w, Math.max(1,l*0.12));   // cleat bars
  c.restore(); DECAL.dirtyD=true;
}
export function decalScorch(x, z, r, k){                                               // blast scorch: charred core → soot halo
  const c=DECAL.sx, px=_dpx(x), pz=_dpz(z), R=r*DECAL.ppu; k=k==null?1:k;
  const g=c.createRadialGradient(px,pz,0,px,pz,R); g.addColorStop(0,'rgba(12,9,6,'+(0.82*k).toFixed(2)+')'); g.addColorStop(0.45,'rgba(22,16,10,'+(0.55*k).toFixed(2)+')'); g.addColorStop(1,'rgba(30,22,14,0)');
  c.fillStyle=g; c.beginPath(); c.arc(px,pz,R,0,7); c.fill();
  for(let i=0;i<Math.round(6+r*2);i++){ const a=Math.random()*6.283, rr=R*(0.6+Math.random()*0.7); c.strokeStyle='rgba(14,10,6,'+(0.25*k).toFixed(2)+')'; c.lineWidth=Math.max(1,R*0.06); c.beginPath(); c.moveTo(px+Math.cos(a)*R*0.3,pz+Math.sin(a)*R*0.3); c.lineTo(px+Math.cos(a)*rr,pz+Math.sin(a)*rr); c.stroke(); }   // radial blast streaks
  DECAL.dirtyS=true;
}
export function decalCrater(x, z, r, k){                                               // shell crater: dark pit + lighter thrown-out ejecta rim
  const c=DECAL.sx, px=_dpx(x), pz=_dpz(z), R=r*DECAL.ppu; k=k==null?1:k;
  const rim=c.createRadialGradient(px,pz,R*0.55,px,pz,R*1.35); rim.addColorStop(0,'rgba(255,240,210,'+(0.16*k).toFixed(2)+')'); rim.addColorStop(1,'rgba(255,240,210,0)');
  c.fillStyle=rim; c.beginPath(); c.arc(px,pz,R*1.35,0,7); c.fill();
  const pit=c.createRadialGradient(px-R*0.15,pz-R*0.15,0,px,pz,R*0.8); pit.addColorStop(0,'rgba(16,12,8,'+(0.7*k).toFixed(2)+')'); pit.addColorStop(1,'rgba(30,22,14,0)');
  c.fillStyle=pit; c.beginPath(); c.arc(px,pz,R*0.8,0,7); c.fill();
  for(let i=0;i<10;i++){ const a=Math.random()*6.283, rr=R*(0.9+Math.random()*0.6); c.fillStyle='rgba(30,22,14,'+(0.3*k).toFixed(2)+')'; c.beginPath(); c.arc(px+Math.cos(a)*rr,pz+Math.sin(a)*rr,Math.max(1,R*0.08),0,7); c.fill(); }   // clods
  c.strokeStyle='rgba(28,20,12,'+(0.22*k).toFixed(2)+')'; c.lineCap='round';
  for(let i=0;i<9;i++){ const a=Math.random()*6.283, r0=R*(0.85+Math.random()*0.15), r1=R*(1.4+Math.random()*0.9); c.lineWidth=Math.max(1,R*(0.05+Math.random()*0.07));   // radial ejecta streaks
    c.beginPath(); c.moveTo(px+Math.cos(a)*r0,pz+Math.sin(a)*r0); c.lineTo(px+Math.cos(a+(Math.random()-0.5)*0.12)*r1,pz+Math.sin(a+(Math.random()-0.5)*0.12)*r1); c.stroke(); }
  const ring=c.createRadialGradient(px,pz,R*0.62,px,pz,R*0.95); ring.addColorStop(0,'rgba(20,14,8,0)'); ring.addColorStop(0.6,'rgba(20,14,8,'+(0.28*k).toFixed(2)+')'); ring.addColorStop(1,'rgba(20,14,8,0)');   // scorched crater wall
  c.fillStyle=ring; c.beginPath(); c.arc(px,pz,R*0.95,0,7); c.fill();
  DECAL.dirtyS=true;
}
export function decalBlood(x, z, r){ bloodSplat(x, z, r); }   // Z121 blood = soft instanced splats (fx/gore.js); the 2 px/m decal canvas drew it as dark blocky squares
export function decalDirt(x, z, r){                                                    // bullet strike / near miss: small dark puff (fades with treads)
  const c=DECAL.dx, px=_ddx(x), pz=_ddz(z), R=Math.max(1.2,r*DECAL.dppu);
  c.fillStyle=_treadCol+'0.32)'; c.beginPath(); c.arc(px,pz,R,0,7); c.fill(); DECAL.dirtyD=true;
}
export function updateDecals(dt){
  DECAL.fadeT+=dt; if(DECAL.fadeT>2){ DECAL.fadeT=0; const c=DECAL.dx; c.globalCompositeOperation='destination-out'; c.fillStyle='rgba(0,0,0,0.045)'; c.fillRect(0,0,DECAL.DW,DECAL.DW); c.globalCompositeOperation='source-over'; DECAL.dirtyD=true; }   // old tracks weather away
  DECAL.tD+=dt; DECAL.tS+=dt;
  if(DECAL.dirtyD && DECAL.tD > (MOBILE?0.33:0.2)){ DECAL.tD=0; DECAL.dirtyD=false; DECAL.texD.needsUpdate=true; }
  else if(DECAL.dirtyS && DECAL.tS > 0.35){ DECAL.tS=0; DECAL.dirtyS=false; DECAL.texS.needsUpdate=true; }   // never both uploads in one frame
}
