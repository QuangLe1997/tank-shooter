// fx/fire-wrecks.js — REAL FIRE / FLASH: the flame and flash textures, particle layers and the rolling fireball (no-tanks: the burning tank wrecks are gone)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { BIOME, PL_SMOKE, heightAt, makePartLayer, spawnPart } from '../hub.js';

export function fireTex(){ const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d');   // billowing flame puff: hot core, ragged licks, soft edge
  for(let i=0;i<14;i++){ const a=Math.random()*6.283, r=Math.random()*26, cx=64+Math.cos(a)*r, cy=64+Math.sin(a)*r, R=18+Math.random()*26;
    const g=x.createRadialGradient(cx,cy,0,cx,cy,R); g.addColorStop(0,'rgba(255,255,255,0.55)'); g.addColorStop(0.45,'rgba(255,255,255,0.22)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.beginPath(); x.arc(cx,cy,R,0,7); x.fill(); }
  const img=x.getImageData(0,0,128,128), d=img.data; for(let i=0;i<d.length;i+=4){ const px=(i/4)%128, py=(i/4)/128|0, rr=Math.hypot(px-64,py-64)/64; d[i+3]=Math.min(255, d[i+3]*Math.max(0,1-rr*rr)*(0.8+Math.random()*0.4)); }
  x.putImageData(img,0,0); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
export function flashTex(){ const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'); x.translate(64,64);   // muzzle flash: hot disc + 7 uneven spikes
  for(let i=0;i<7;i++){ const a=i/7*6.283+Math.random()*0.4, L=34+Math.random()*28, w=5+Math.random()*5; x.save(); x.rotate(a);
    const g=x.createLinearGradient(0,0,L,0); g.addColorStop(0,'rgba(255,255,255,0.9)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.beginPath(); x.moveTo(0,-w); x.lineTo(L,0); x.lineTo(0,w); x.closePath(); x.fill(); x.restore(); }
  const g=x.createRadialGradient(0,0,0,0,0,30); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.4,'rgba(255,255,255,0.6)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.beginPath(); x.arc(0,0,30,0,7); x.fill();
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
export function smokeTex2(){ const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d');                 // dense, lumpy smoke with a soft round silhouette
  for(let i=0;i<16;i++){ const a=Math.random()*6.283, r=Math.random()*24, cx=64+Math.cos(a)*r, cy=64+Math.sin(a)*r, R=16+Math.random()*22;
    const g=x.createRadialGradient(cx,cy,0,cx,cy,R); g.addColorStop(0,'rgba(255,255,255,0.32)'); g.addColorStop(0.7,'rgba(255,255,255,0.12)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.beginPath(); x.arc(cx,cy,R,0,7); x.fill(); }
  const img=x.getImageData(0,0,128,128), d=img.data; for(let i=0;i<d.length;i+=4){ const px=(i/4)%128, py=(i/4)/128|0, rr=Math.hypot(px-64,py-64)/62; d[i+3]=d[i+3]*Math.max(0,1-rr*rr*rr); }
  x.putImageData(img,0,0); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
export const PL_FIRE = makePartLayer(fireTex(), true, 7), PL_FLASH = makePartLayer(flashTex(), true, 8);
PL_SMOKE.mesh.material.uniforms.map.value=smokeTex2();   // denser, lumpier smoke
// rolling fireball: white-hot core → orange → deep red, expanding and lifting, followed by a dark mushrooming smoke column
export function fireball(pos, scale, y){ y=y||1.2;
  spawnPart(pos.x, y+0.4*scale, pos.z, 0,1,0, {tex:'flash', color:0xfff2d0, size:5.5*scale, life:0.09, grav:0, drag:0});
  for(let i=0;i<Math.round(10*scale);i++){ const a=Math.random()*6.283, el=Math.random()*1.2, sp=(2+Math.random()*6)*Math.sqrt(scale);
    spawnPart(pos.x, y+Math.random()*scale, pos.z, Math.cos(a)*Math.cos(el)*sp, Math.sin(el)*sp+2.5, Math.sin(a)*Math.cos(el)*sp,
      {tex:'fire', color:0xfff0c0, color2:0xc8280a, size:(1.4+Math.random()*1.4)*scale, life:0.45+Math.random()*0.4, grav:3, drag:2.2, grow:1.6*scale}); }
  for(let i=0;i<Math.round(6*scale);i++){ const a=Math.random()*6.283, sp=Math.random()*2.5;
    spawnPart(pos.x+Math.cos(a)*sp*0.4, y+0.6*scale, pos.z+Math.sin(a)*sp*0.4, Math.cos(a)*sp, 3.5+Math.random()*3, Math.sin(a)*sp,
      {color:0x1a1510, size:(1.6+Math.random())*scale, life:1.8+Math.random()*1.2, smoke:true, grav:0.2, drag:1.0, grow:2.6*scale, op:0.6}); }
  for(let i=0;i<Math.round(12*scale);i++){ const a=i/(12*scale)*6.283, sp=(9+Math.random()*4)*Math.sqrt(scale);   // ground shock: dust thrown outward in a ring
    spawnPart(pos.x, heightAt(pos.x,pos.z)+0.35, pos.z, Math.cos(a)*sp, 0.6, Math.sin(a)*sp, {color:BIOME.ground, size:1.2*scale, life:0.8, smoke:true, grav:-0.2, drag:3.2, grow:1.5*scale, op:0.3}); }
  for(let i=0;i<Math.round(8*scale);i++){ const a=Math.random()*6.283, sp=4+Math.random()*7;                       // dirt clods
    spawnPart(pos.x, 0.5, pos.z, Math.cos(a)*sp, 6+Math.random()*7, Math.sin(a)*sp, {color:0x3a2c1c, size:0.2+Math.random()*0.25, life:0.9, grav:-26, drag:0.6}); }
}
