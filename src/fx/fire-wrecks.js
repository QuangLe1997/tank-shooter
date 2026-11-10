// fx/fire-wrecks.js — REAL FIRE / FLASH / WRECKS
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BIOME, MOBILE, PL_SMOKE, _R, _canvasTex, _tankGeo, burst, decalCrater, heightAt, makePartLayer, panelTex, scene, sfx, spawnPart } from '../hub.js';

// ----------------------------- REAL FIRE / FLASH / WRECKS -----------------------------
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
// ---- burning wreck hulls + blown-off turrets (ammo cook-off) ----
export const WRECKS=[]; export let _wreckGeo=null, _turGeo=null, _emberTex=null;
export function emberTex(){ if(_emberTex) return _emberTex; _emberTex=_canvasTex(128,128,(x,W)=>{ x.fillStyle='#000'; x.fillRect(0,0,W,W);   // glowing seams & hot patches on charred armour
  for(let i=0;i<11;i++){ const cx=_R(0,W), cy=_R(0,W), r=_R(3,9); const g=x.createRadialGradient(cx,cy,0,cx,cy,r); g.addColorStop(0,'rgba(255,200,120,1)'); g.addColorStop(0.5,'rgba(255,90,20,0.6)'); g.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle=g; x.fillRect(cx-r,cy-r,r*2,r*2); }
  x.strokeStyle='rgba(255,110,30,0.8)'; x.lineWidth=1.2; for(let i=0;i<5;i++){ let px=_R(0,W), py=_R(0,W); x.beginPath(); x.moveTo(px,py); for(let k=0;k<5;k++){ px+=_R(-12,12); py+=_R(-12,12); x.lineTo(px,py); } x.stroke(); } }); return _emberTex; }
export function _wreckGeos(){ if(_wreckGeo) return; const G=_tankGeo(), parts=[G.hullLo, G.hullUp, G.track.clone().translate(-1.18,0,0), G.track.clone().translate(1.18,0,0)].map(q=>{ const n=q.index?q.toNonIndexed():q.clone(); n.clearGroups(); for(const a of Object.keys(n.attributes)) if(!['position','normal','uv'].includes(a)) n.deleteAttribute(a); return n; });
  _wreckGeo=mergeGeometries(parts); const bar=new THREE.CylinderGeometry(0.11,0.13,2.6,10).rotateX(Math.PI/2).translate(0,0.02,2.4).toNonIndexed(); const tg=G.turret.index?G.turret.toNonIndexed():G.turret.clone(); for(const a of Object.keys(bar.attributes)) if(!tg.attributes[a]) bar.deleteAttribute(a); _turGeo=mergeGeometries([tg, bar]); }
export function spawnWreck(pos, facing, ms, pal, toss){
  _wreckGeos(); if(WRECKS.length >= (MOBILE?3:6)){ const o=WRECKS.shift(); scene.remove(o.hull); scene.remove(o.tur); }
  const burnt=new THREE.Color(pal?pal.hull:0x3a3a30).multiplyScalar(0.28);
  const mat=new THREE.MeshStandardMaterial({ color:burnt, roughness:0.95, metalness:0.3, map:panelTex(), emissive:0xff5a18, emissiveMap:emberTex(), emissiveIntensity:1.4, transparent:true });
  const hull=new THREE.Mesh(_wreckGeo, mat); hull.scale.setScalar(ms); hull.position.set(pos.x,heightAt(pos.x,pos.z),pos.z); hull.rotation.set((Math.random()-0.5)*0.12, facing||0, (Math.random()-0.5)*0.16); hull.castShadow=true; hull.receiveShadow=true; scene.add(hull);
  const tur=new THREE.Mesh(_turGeo, mat); tur.scale.setScalar(ms); tur.castShadow=true; scene.add(tur);
  const w={ hull, tur, mat, t:0, life:3.4+Math.random()*1.0, ms, x:pos.x, z:pos.z,
    tx:pos.x, ty:1.75*ms, tz:pos.z, tvx:0, tvy:0, tvz:0, rx:0, ry:0, rz:0, flying:!!toss, fireT:0, smokeT:0 };
  if(toss){ const a=Math.random()*6.283, sp=(3+Math.random()*6); w.tvx=Math.cos(a)*sp; w.tvz=Math.sin(a)*sp; w.tvy=13+Math.random()*7; w.rx=(Math.random()-0.5)*9; w.ry=(Math.random()-0.5)*7; w.rz=(Math.random()-0.5)*9; }   // magazine detonation throws the turret skyward
  tur.position.set(w.tx,w.ty,w.tz); tur.rotation.y=(facing||0)+(toss?0:(Math.random()-0.5)*0.8);
  WRECKS.push(w);
}
export function updateWrecks(dt){
  for(let i=WRECKS.length-1;i>=0;i--){ const w=WRECKS[i]; w.t+=dt; const k=w.t/w.life;
    if(w.flying){ w.tvy-=30*dt; w.tx+=w.tvx*dt; w.ty+=w.tvy*dt; w.tz+=w.tvz*dt; w.tur.rotation.x+=w.rx*dt; w.tur.rotation.y+=w.ry*dt; w.tur.rotation.z+=w.rz*dt;
      if(Math.random()<0.6) spawnPart(w.tx,w.ty,w.tz,(Math.random()-0.5),0.5,(Math.random()-0.5),{color:0x1a1612,size:1.2*w.ms,life:0.9,smoke:true,grav:-0.5,drag:1.5,op:0.5});   // trails smoke as it tumbles
      const _tg=heightAt(w.tx,w.tz)+0.4*w.ms; if(w.ty<=_tg && w.tvy<0){ w.ty=_tg; if(Math.abs(w.tvy)>6){ w.tvy*=-0.25; w.tvx*=0.4; w.tvz*=0.4; w.rx*=0.3; w.rz*=0.3; burst({x:w.tx,z:w.tz}, BIOME.ground, 4, 4, {y:0.4,life:0.8,size:1.6,smoke:true,grav:-0.4,drag:2,up:1.5,op:0.5}); sfx('thud'); decalCrater(w.tx,w.tz,0.9*w.ms,0.6); }
        else { w.flying=false; w.tur.rotation.x=Math.round(w.tur.rotation.x/Math.PI)*Math.PI+(Math.random()-0.5)*0.4; w.tur.rotation.z=(Math.random()-0.5)*0.5; } }
      w.tur.position.set(w.tx,w.ty,w.tz); }
    w.mat.emissiveIntensity=Math.max(0.06, 1.4*(1-w.t/4))*(0.85+0.15*Math.sin(w.t*9+w.x));             // embers smoulder, flicker and cool
    const burn = w.t < w.life*0.7 ? 1 - w.t/(w.life*0.7) : 0;
    w.fireT-=dt; if(burn>0 && w.fireT<=0){ w.fireT=0.05+(1-burn)*0.12; const ox=(Math.random()-0.5)*2.2*w.ms, oz=(Math.random()-0.5)*3*w.ms;   // flames licking out of the hull hatches
      spawnPart(w.x+ox, 1.3*w.ms, w.z+oz, (Math.random()-0.5)*0.8, 2.4+Math.random()*2, (Math.random()-0.5)*0.8, {tex:'fire', color:0xffd090, color2:0xff3a08, size:(1.1+Math.random()*1.1)*w.ms*(0.5+burn*0.6), life:0.55+Math.random()*0.3, grav:1.5, drag:1.6, grow:0.6}); }
    w.smokeT-=dt; if(w.t<w.life*0.9 && w.smokeT<=0){ w.smokeT=0.09; spawnPart(w.x+(Math.random()-0.5)*1.5, 2*w.ms, w.z+(Math.random()-0.5)*1.5, 0.9+(Math.random()-0.5)*0.6, 2.2+Math.random()*1.2, 0.5+(Math.random()-0.5)*0.6,
        {color: burn>0.3?0x14110e:0x3a3632, size:(1.6+Math.random())*w.ms, life:2.6, smoke:true, grav:0.4, drag:0.6, grow:2.2*w.ms, op:0.55}); }   // black column → grey as it dies, drifting downwind
    if(k>0.8){ const f=(1-k)/0.2; w.mat.opacity=Math.max(0,f); w.hull.position.y=heightAt(w.x,w.z)-(1-f)*0.6*w.ms; }
    if(w.t>=w.life){ scene.remove(w.hull); scene.remove(w.tur); w.mat.dispose(); WRECKS.splice(i,1); } }
}
export function clearWrecks(){ for(const w of WRECKS){ scene.remove(w.hull); scene.remove(w.tur); } WRECKS.length=0; }
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
