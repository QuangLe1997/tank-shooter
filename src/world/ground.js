// world/ground.js — ARENA ground: procedural ground maps per biome, macro variation + patch textures (cached)
import * as THREE from 'three';
import { GROUND_PHOTO, RELIEF } from '../../config.js';
import { cosmetic, APPLE, ARENA, GROUND_STYLE, MOBILE, _heightToNormal } from '../hub.js';

// ----------------------------- ARENA -----------------------------
// ---- procedural PBR battlefield ground: tileable fBm albedo + height→normal, per-biome surface features, macro variation (no visible tiling) ----
export function tileNoise(W, periods, gainK){                           // tileable value-noise fBm in [0,1] (each octave wraps exactly on W)
  const out=new Float32Array(W*W); let amp=1, tot=0; gainK=gainK||0.5;
  for(const P of periods){
    const lat=new Float32Array(P*P); for(let i=0;i<P*P;i++) lat[i]=Math.random();
    const cell=W/P;
    for(let y=0;y<W;y++){ const fy=y/cell, iy=fy|0, ty=fy-iy, sy=ty*ty*(3-2*ty), r0=(iy%P)*P, r1=((iy+1)%P)*P;
      for(let x=0;x<W;x++){ const fx=x/cell, ix=fx|0, tx=fx-ix, sx=tx*tx*(3-2*tx), c0=ix%P, c1=(ix+1)%P;
        const a=lat[r0+c0], b=lat[r0+c1], c=lat[r1+c0], d=lat[r1+c1];
        out[y*W+x] += amp*((a+(b-a)*sx)+((c+(d-c)*sx)-(a+(b-a)*sx))*sy); } }
    tot+=amp; amp*=gainK; }
  for(let i=0;i<out.length;i++) out[i]/=tot; return out;
}
export const _gCache={};
export function groundMaps(b){ return _gCache[b.name] || cosmetic(groundMaps0, b); }   // SYNC 1 (made once and kept: not on the battlefield's dice — core/dice.js)
function groundMaps0(b){
  const st=GROUND_STYLE[b.name]||GROUND_STYLE.DESERT, W=MOBILE?512:1024, N=W*W;
  const n1=tileNoise(W,[4,8,16,32,64,128,256],0.52), n2=tileNoise(W,[3,6,12],0.5), n3=tileNoise(W,[32,64,128],0.55);
  const H=new Float32Array(N);
  const col=document.createElement('canvas'); col.width=col.height=W; const cx=col.getContext('2d'); const img=cx.createImageData(W,W), d=img.data;
  const [c0,c1,c2]=st.c, mix=(a,b,t)=>a+(b-a)*t;
  for(let y=0;y<W;y++) for(let x=0;x<W;x++){ const i=y*W+x;
    let h=n1[i], t=h;
    if(b.name==='DESERT'){ const rip=Math.sin((x*0.82+y*0.57)/W*6.283*38 + n2[i]*14)*0.5+0.5;          // wind ripples bent by large-scale flow
      h = n1[i]*0.7 + rip*0.18*n2[i] + n3[i]*0.12; t = h + (n2[i]-0.5)*0.35; }
    else if(b.name==='TUNDRA'||b.name==='ARCTIC'){ h = n1[i]*0.7+n3[i]*0.3; t = 0.3+h*0.8; }
    else if(b.name==='SAVANNA'){ h=n1[i]*0.65+n3[i]*0.35; t=h*0.9+(n2[i]-0.5)*0.4; }                                                          // wind-packed drifts
    else if(b.name==='MEADOW'||b.name==='HILLS'||b.name==='VILLAGE'){ t = n1[i]*0.6+n3[i]*0.4; }
    else if(b.name==='VOLCANO'){ h=n1[i]*0.7+n3[i]*0.3; t=Math.pow(h,1.6); }                                                                   // Z187 black basalt, flows of rougher clinker
    else if(b.name==='QUARRY'){ const band=Math.sin((y/W)*6.283*22 + n2[i]*3)*0.5+0.5; h=n1[i]*0.6+band*0.25+n3[i]*0.15; t=0.35+h*0.65; }      // Z187 saw-cut benches leave parallel bands
    else if(b.name==='FOUNDRY'||b.name==='CITADEL'){ h=n1[i]*0.75+n3[i]*0.25; t=h; }
    else { h=n1[i]*0.6+n3[i]*0.4; t=h*0.9+(n2[i]-0.5)*0.3; }
    H[i]=h; t=Math.max(0,Math.min(1,t));
    let r,g,bl; if(t<0.5){ const k=t*2; r=mix(c0[0],c1[0],k); g=mix(c0[1],c1[1],k); bl=mix(c0[2],c1[2],k); } else { const k=(t-0.5)*2; r=mix(c1[0],c2[0],k); g=mix(c1[1],c2[1],k); bl=mix(c1[2],c2[2],k); }
    const gr=(Math.random()-0.5)*10; d[i*4]=r+gr; d[i*4+1]=g+gr; d[i*4+2]=bl+gr; d[i*4+3]=255; }
  cx.putImageData(img,0,0);
  const hc=document.createElement('canvas'); hc.width=hc.height=W; const hx=hc.getContext('2d'); const himg=hx.createImageData(W,W), hd=himg.data;
  for(let i=0;i<N;i++){ const v=H[i]*255; hd[i*4]=hd[i*4+1]=hd[i*4+2]=v; hd[i*4+3]=255; } hx.putImageData(himg,0,0);
  // surface features painted on BOTH albedo + height (wrapped so the tile stays seamless)
  const both=(fn)=>{ for(const [ctx,isH] of [[cx,false],[hx,true]]) for(const ox of [-W,0,W]) for(const oy of [-W,0,W]){ ctx.save(); ctx.translate(ox,oy); fn(ctx,isH); ctx.restore(); } };
  const R=(a,b)=>a+Math.random()*(b-a);
  const pebbles=(n,rMin,rMax,cols,hv)=>{ const P=[]; for(let i=0;i<n;i++) P.push([Math.random()*W,Math.random()*W,R(rMin,rMax)*W/1024,cols[(Math.random()*cols.length)|0]]);
    both((x,isH)=>{ for(const [px,py,r,cc] of P){ x.fillStyle = isH ? hv : cc; x.beginPath(); x.ellipse(px,py,r,r*R(0.6,1),R(0,3),0,7); x.fill(); } }); };
  const cracks=(n,len,w,colA,hv)=>{ const L=[]; for(let i=0;i<n;i++){ let px=Math.random()*W, py=Math.random()*W, a=R(0,6.28); const pts=[[px,py]]; for(let s=0;s<len;s++){ a+=R(-0.7,0.7); px+=Math.cos(a)*W/90; py+=Math.sin(a)*W/90; pts.push([px,py]); if(Math.random()<0.15){ L.push({pts:pts.slice(-2).concat([[px+Math.cos(a+1.4)*W/60,py+Math.sin(a+1.4)*W/60]]), w:w*0.6}); } } L.push({pts,w}); }
    both((x,isH)=>{ x.strokeStyle=isH?hv:colA; x.lineCap='round'; x.lineJoin='round'; for(const c of L){ x.lineWidth=c.w*W/1024; x.beginPath(); c.pts.forEach((p,k)=>k?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.stroke(); } }); };
  if(b.name==='DESERT'){ pebbles(900,1,3.2,['rgba(120,96,64,0.8)','rgba(150,124,86,0.8)','rgba(96,80,58,0.7)'],'rgba(255,255,255,0.55)'); cracks(10,10,1.4,'rgba(110,86,56,0.35)','rgba(0,0,0,0.25)'); }
  else if(b.name==='RUINS'||b.name==='CITY'){ // broken concrete slabs / city asphalt: seams + spalling + oil stains + rubble grit
    both((x,isH)=>{ x.strokeStyle=isH?'rgba(0,0,0,0.7)':'rgba(40,40,40,0.55)'; x.lineWidth=3*W/1024; const s=W/4; for(let i=0;i<=4;i++){ x.beginPath(); x.moveTo(i*s+R(-3,3),0); x.lineTo(i*s+R(-3,3),W); x.moveTo(0,i*s+R(-3,3)); x.lineTo(W,i*s+R(-3,3)); x.stroke(); } });
    cracks(40,14,1.8,'rgba(30,30,30,0.6)','rgba(0,0,0,0.6)');
    for(let i=0;i<3;i++){ const px=Math.random()*W, py=Math.random()*W, r=R(20,60)*W/1024; cx.fillStyle='rgba(20,18,16,'+R(0.08,0.16).toFixed(2)+')'; cx.beginPath(); cx.ellipse(px,py,r,r*R(0.5,1),R(0,3),0,7); cx.fill(); }
    pebbles(1400,1,3,['rgba(90,88,84,0.9)','rgba(140,136,128,0.9)','rgba(60,58,56,0.9)'],'rgba(255,255,255,0.5)'); }
  else if(b.name==='SAVANNA'){ const Gs=[]; for(let i=0;i<(MOBILE?5000:13000);i++) Gs.push([Math.random()*W,Math.random()*W,R(4,12)*W/1024,R(-3,3)*W/1024, Math.random()<0.4?'rgba(230,200,120,0.6)':(Math.random()<0.5?'rgba(170,130,70,0.55)':'rgba(120,96,50,0.5)')]);   // Z143 dry golden grass + red earth
    both((x,isH)=>{ x.lineWidth=1.2*W/1024; for(const [gx,gy,h,lean,cc] of Gs){ x.strokeStyle=isH?'rgba(255,255,255,0.3)':cc; x.beginPath(); x.moveTo(gx,gy); x.lineTo(gx+lean,gy-h); x.stroke(); } });
    for(let i=0;i<14;i++){ const px=Math.random()*W, py=Math.random()*W, r=R(30,100)*W/1024; cx.fillStyle='rgba(150,80,40,0.28)'; cx.beginPath(); cx.ellipse(px,py,r,r*R(0.4,0.8),R(0,3),0,7); cx.fill(); } cracks(14,10,1.4,'rgba(110,70,40,0.35)','rgba(0,0,0,0.25)'); }
  else if(b.name==='TUNDRA'||b.name==='ARCTIC'){ cracks(b.name==='ARCTIC'?44:26,12,1.2,'rgba(140,170,200,0.4)','rgba(0,0,0,0.2)'); pebbles(500,1,2.4,['rgba(80,86,92,0.7)','rgba(110,116,124,0.7)'],'rgba(255,255,255,0.4)');
    for(let i=0;i<1800;i++){ cx.fillStyle='rgba(255,255,255,'+R(0.4,0.9).toFixed(2)+')'; cx.fillRect(Math.random()*W,Math.random()*W,1,1); } }
  else if(b.name==='FOUNDRY'){ cracks(22,10,2.4,'rgba(150,84,52,0.45)','rgba(0,0,0,0.45)'); cracks(30,10,1.2,'rgba(16,14,12,0.7)','rgba(0,0,0,0.5)'); pebbles(1200,1,3.5,['rgba(30,26,24,0.9)','rgba(80,70,62,0.9)','rgba(60,40,30,0.9)'],'rgba(255,255,255,0.6)');
    for(let i=0;i<12;i++){ const px=Math.random()*W, py=Math.random()*W, r=R(24,80)*W/1024; const g=cx.createRadialGradient(px,py,0,px,py,r); g.addColorStop(0,'rgba(10,10,14,0.5)'); g.addColorStop(1,'rgba(10,10,14,0)'); cx.fillStyle=g; cx.fillRect(px-r,py-r,r*2,r*2); } }
  else if(b.name==='STEELMILL'){ cracks(26,10,2.2,'rgba(30,24,20,0.7)','rgba(0,0,0,0.5)'); pebbles(1500,1,3.4,['rgba(40,32,28,0.9)','rgba(110,70,44,0.9)','rgba(70,58,50,0.9)'],'rgba(255,255,255,0.45)');   // Z187 rust, slag grit, oil, weeds in the cracks
    for(let i=0;i<22;i++){ const px=Math.random()*W, py=Math.random()*W, r=R(20,90)*W/1024; const g=cx.createRadialGradient(px,py,0,px,py,r); g.addColorStop(0,i%3?'rgba(140,64,28,0.42)':'rgba(10,10,12,0.5)'); g.addColorStop(1,'rgba(0,0,0,0)'); cx.fillStyle=g; cx.fillRect(px-r,py-r,r*2,r*2); }
    for(let i=0;i<900;i++){ cx.fillStyle='rgba(90,110,50,'+R(0.3,0.7).toFixed(2)+')'; cx.fillRect(Math.random()*W,Math.random()*W,1.6,R(2,4)); } }
  else if(b.name==='VOLCANO'){ cracks(34,14,2.2,'rgba(255,110,30,0.75)','rgba(0,0,0,0.6)'); cracks(20,10,1.2,'rgba(255,190,80,0.6)','rgba(0,0,0,0.4)');   // Z187 basalt with glowing seams + ash
    pebbles(1600,1,3.2,['rgba(14,12,12,0.9)','rgba(50,44,42,0.9)','rgba(80,40,30,0.8)'],'rgba(255,255,255,0.35)'); for(let i=0;i<1400;i++){ cx.fillStyle='rgba(170,160,150,'+R(0.1,0.35).toFixed(2)+')'; cx.fillRect(Math.random()*W,Math.random()*W,2,2); } }
  else if(b.name==='QUARRY'){ cracks(18,10,1.4,'rgba(150,140,124,0.5)','rgba(0,0,0,0.25)'); pebbles(1700,1,3.6,['rgba(250,248,242,0.95)','rgba(200,194,182,0.9)','rgba(150,144,134,0.8)'],'rgba(255,255,255,0.6)');   // Z187 marble chips, tyre-pressed dust
    for(let i=0;i<18;i++){ const px=Math.random()*W, py=Math.random()*W, r=R(30,110)*W/1024; cx.fillStyle=i%2?'rgba(255,252,244,0.2)':'rgba(120,104,84,0.2)'; cx.beginPath(); cx.ellipse(px,py,r,r*R(0.3,0.7),R(0,3),0,7); cx.fill(); } }
  else if(b.name==='CAVERN'){ cracks(28,12,1.8,'rgba(20,16,14,0.65)','rgba(0,0,0,0.5)'); pebbles(1400,1,3.2,['rgba(40,36,32,0.9)','rgba(96,88,76,0.9)','rgba(150,140,124,0.8)'],'rgba(255,255,255,0.5)');   // Z225 wet limestone, flowstone sheets, black puddles
    for(let i=0;i<20;i++){ const px=Math.random()*W, py=Math.random()*W, r=R(26,100)*W/1024; const g=cx.createRadialGradient(px,py,0,px,py,r); g.addColorStop(0,i%3?'rgba(170,156,130,0.22)':'rgba(8,8,10,0.55)'); g.addColorStop(1,'rgba(0,0,0,0)'); cx.fillStyle=g; cx.fillRect(px-r,py-r,r*2,r*2); } }
  else if(b.name==='CITADEL'){ cracks(30,12,1.6,'rgba(24,18,12,0.6)','rgba(0,0,0,0.5)'); pebbles(1300,1,3.4,['rgba(60,48,34,0.9)','rgba(100,84,60,0.9)','rgba(30,26,22,0.9)'],'rgba(255,255,255,0.55)');
    for(let i=0;i<900;i++){ cx.fillStyle='rgba(30,28,26,'+R(0.2,0.5).toFixed(2)+')'; cx.fillRect(Math.random()*W,Math.random()*W,2,2); } }
  else if(b.name==='MEADOW'||b.name==='HILLS'||b.name==='VILLAGE'){ const Gs=[]; for(let i=0;i<(MOBILE?5000:14000);i++) Gs.push([Math.random()*W,Math.random()*W,R(4,11)*W/1024,R(-3,3)*W/1024, (r=>r<0.3?'rgba(196,216,120,0.55)':r<0.6?'rgba(126,160,66,0.5)':r<0.85?'rgba(150,174,82,0.5)':'rgba(208,192,122,0.45)')(Math.random())]);   // Z147 sunlit blades + straw (no olive: that's the tanks' colour)
    both((x,isH)=>{ x.lineWidth=1.2*W/1024; for(const [gx,gy,h,lean,cc] of Gs){ x.strokeStyle=isH?'rgba(255,255,255,0.35)':cc; x.beginPath(); x.moveTo(gx,gy); x.lineTo(gx+lean,gy-h); x.stroke(); } });
    pebbles(b.name==='HILLS'?900:300,1,2.6,['rgba(110,100,84,0.8)'],'rgba(255,255,255,0.5)');
    if(b.name!=='MEADOW'){ for(let i=0;i<(b.name==='VILLAGE'?10:16);i++){ const px=Math.random()*W, py=Math.random()*W, r=R(30,90)*W/1024; cx.fillStyle=b.name==='VILLAGE'?'rgba(120,96,58,0.32)':'rgba(110,92,62,0.35)'; cx.beginPath(); cx.ellipse(px,py,r,r*R(0.4,0.8),R(0,3),0,7); cx.fill(); } } }   // Z139 bare-earth patches in the grass
  const map=new THREE.CanvasTexture(col); map.colorSpace=THREE.SRGBColorSpace; map.wrapS=map.wrapT=THREE.RepeatWrapping; map.anisotropy=APPLE?8:(MOBILE?2:4);   // Z109 grazing camera → without it the far ground smears
  const nrm=_heightToNormal(hc, st.nrm); nrm.anisotropy=APPLE?8:(MOBILE?2:4);
  const rep=(ARENA*2)/st.tile; map.repeat.set(rep,rep); nrm.repeat.set(rep,rep);
  const out={ map, nrm, rough:st.rough }; _gCache[b.name]=out; return out;
}
// macro variation (one stretch across the whole field): kills visible tiling with broad light/dark + warm/cool patches
export function macroTexture(){
  const W=256, a=tileNoise(W,[2,4,8,16],0.55), b2=tileNoise(W,[3,6],0.5);
  const c=document.createElement('canvas'); c.width=c.height=W; const x=c.getContext('2d'); const img=x.createImageData(W,W), d=img.data;
  for(let i=0;i<W*W;i++){ const v=0.5+(a[i]-0.5)*1.3, w=(b2[i]-0.5)*0.12; d[i*4]=Math.max(0,Math.min(255,(v+w)*255)); d[i*4+1]=Math.max(0,Math.min(255,v*255)); d[i*4+2]=Math.max(0,Math.min(255,(v-w)*255)); d[i*4+3]=255; }
  x.putImageData(img,0,0); const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}
export function patchTexture(){ const W=256, a=tileNoise(W,[3,6,12,24,48],0.55); const c=document.createElement('canvas'); c.width=c.height=W; const x=c.getContext('2d'); const img=x.createImageData(W,W), d=img.data;
  for(let i=0;i<W*W;i++){ const v=Math.max(0,Math.min(255,(0.5+(a[i]-0.5)*1.6)*255)); d[i*4]=d[i*4+1]=d[i*4+2]=v; d[i*4+3]=255; } x.putImageData(img,0,0); const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t; }
export const PATCH_COL = { DESERT:[0x9a7a50,0.55], RUINS:[0x5e5446,0.6], TUNDRA:[0x5c636c,0.75], FOUNDRY:[0x141210,0.7], CITADEL:[0x3e3a36,0.6], MEADOW:[0x6a5232,0.85], CITY:[0x3a3c40,0.55], HILLS:[0x5a4a30,0.7], VILLAGE:[0x5a4a2c,0.7], SAVANNA:[0x8a5a30,0.6], ARCTIC:[0x7a90a4,0.55], STEELMILL:[0x2a1a12,0.65], VOLCANO:[0x0e0a0a,0.75], QUARRY:[0xb8b0a0,0.45], CAVERN:[0x14100c,0.7] };
export const MACRO = { tex:{ value:macroTexture() }, amt:{ value:0.3 }, span:{ value:1/(ARENA*2) }, patch:{ value:patchTexture() }, pcol:{ value:new THREE.Color(0x9a7a50) }, pamt:{ value:0.55 } };
// Z250 the photo ground's second layer (world/ground-photo.js fills it; altOn 0 = the procedural look)
export const PHOTO_U = { altMap:{ value:null }, altOn:{ value:0 }, altScale:{ value:0.5 }, dual:{ value:0 },
  hex:{ value:new THREE.Vector4(1, 1, 7, 0.6) }, nrmVar:{ value:0 } };   // Z405 the hex lattice (hxP, world/ground-photo.js sets it per battlefield) · how far the relief's strength drifts
// Z405 the river banks: just above the waterline the ground is wet — darker and glossy (world/river.js sets it; k = water y, amount, band height m, darkening)
export const WET_U = { k:{ value:new THREE.Vector4(-0.85, 0, 0.5, 0.42) } };
// Z322 past the grass carpet the floor wears the carpet's own colour (world/grass-carpet.js fills it): col = the clumps' average, c = carpet centre xz + fade radii,
//   k = (cover, the floor's average brightness) — far and near read the same, from the intro's high shots down to the tank
export const GRASS_FAR = { col:{ value:new THREE.Color(0.2, 0.25, 0.1) }, c:{ value:new THREE.Vector4(1e6, 1e6, 0, 1) }, k:{ value:new THREE.Vector4(0, 0.3, 0, 0) } };
// Z105 relief shading (see config RELIEF): hollows darker + damper + occluded, steep faces show raw earth, crests/rims sun-bleached
export const RELIEF_U = { rel0:{ value:new THREE.Vector4(RELIEF.bowlDark, RELIEF.bowlAO, RELIEF.crestLift, RELIEF.slopeEarth) }, rel1:{ value:new THREE.Vector4(RELIEF.bowlK, RELIEF.crestK, RELIEF.slopeK, 1) },
  bowlTint:{ value:new THREE.Color().setRGB(...RELIEF.bowlTint) }, earth:{ value:new THREE.Color().setRGB(...RELIEF.earth) } };
export const RELIEF_GLSL = `{ float cv=vRelief.x, sl=vRelief.y; vec3 c=diffuseColor.rgb; float lum=dot(c,vec3(0.333));
  float bowl=smoothstep(0.0, rel1.x, -cv)*rel1.w, crest=smoothstep(0.0, rel1.y, cv)*rel1.w, steep=smoothstep(0.12, 0.12+rel1.z, sl)*rel1.w;
  c = mix(c, altOn>0.5 ? altC : earthCol*(0.55+lum*0.9), steep*rel0.w);   // Z250 steep faces show the photo second layer (rock / dirt)
  c = mix(c, c*bowlTint, bowl*rel0.x); c *= 1.0 - bowl*rel0.y;
  c *= 1.0 + crest*rel0.z;
  diffuseColor.rgb = c; }`;
// Z263 NO TILING: the photo ground is sampled through a stochastic lookup (Quilez) — the field is cut into soft patches by a low-frequency noise and
//   each patch reads the photo at its own offset, two neighbours blended across a seam the photo's own detail hides — so the 1–4 m photo never shows
//   as a grid of repeats; the same offsets for colour, normal, roughness and AO (they stay in register). Same cost class as before: two taps a map.
const NT_GLSL = `float ntH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ntN(vec2 p){ vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f); return mix(mix(ntH(i), ntH(i + vec2(1.0, 0.0)), u.x), mix(ntH(i + vec2(0.0, 1.0)), ntH(i + vec2(1.0, 1.0)), u.x), u.y); }
vec4 ntTex(sampler2D s, vec2 uv){ float k = ntN(uv * ${GROUND_PHOTO.ntFreq.toFixed(3)}) * 8.0, f = fract(k), ia = floor(k); vec2 dx = dFdx(uv), dy = dFdy(uv);
  vec4 a = textureGrad(s, uv + sin(vec2(3.0, 7.0) * ia), dx, dy), b = textureGrad(s, uv + sin(vec2(3.0, 7.0) * (ia + 1.0)), dx, dy);
  return mix(a, b, smoothstep(0.2, 0.8, f - 0.1 * dot(a.rgb - b.rgb, vec3(1.0)))); }`;
// Z405 HEX TILING (Mikkelsen 2022, "Practical Real-Time Hex-Tiling") — the Z263 patches were ~3 photo tiles wide, so inside each one the 1–5 m photo
//   still repeated on a perfect grid (from the turret and from above: a fish-scale lattice over the whole field). Now the photo is laid on a lattice of small
//   hexagons, each slid at random (a random turn is there too, config hex.rot, but off: a ridged photo turned per hex catches a low sun differently in every
//   hex and the lattice shows as a honeycomb), the three nearest blended by their barycentric weight sharpened by the photo's own brightness: no grid at any
//   scale, the detail stays crisp. The colour pass keeps its three lookups (uv, gradients, turns, weights); the normal map reads the same three with
//   each normal turned back into the field's frame, roughness reads the strongest — all in register. hxP = (hexes per tile, share of a full random turn,
//   blend sharpness, how much the brightness steers the blend); the second set and the base at its second scale get their own hex lattices on desktops
//   (one turned lookup each on phones). hxNv: the relief's strength drifts across the field (wind-smoothed / churned ground).
const HX_GLSL = `uniform vec4 hxP; float hxNv = 1.0; vec2 hxU[3]; mat2 hxR[3]; vec2 hxDX, hxDY; vec3 hxW = vec3(0.0);
vec2 hxHash(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
void hxGrid(vec2 st, out vec3 w, out vec2 v1, out vec2 v2, out vec2 v3){ st *= 3.4641016; vec2 sk = vec2(st.x - 0.57735027 * st.y, 1.15470054 * st.y), b = floor(sk);
  vec3 t = vec3(fract(sk), 0.0); t.z = 1.0 - t.x - t.y; float s = step(0.0, -t.z), s2 = 2.0 * s - 1.0;
  w = vec3(-t.z * s2, s - t.y * s2, s - t.x * s2); v1 = b + vec2(s); v2 = b + vec2(s, 1.0 - s); v3 = b + vec2(1.0 - s, s); }
mat2 hxRot(vec2 v){ float a = (hxHash(v + 17.31).x * 2.0 - 1.0) * 3.14159265 * hxP.y, c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
vec2 hxCen(vec2 v){ return vec2(v.x + 0.5 * v.y, 0.8660254 * v.y) / (3.4641016 * hxP.x); }
vec3 hxWeigh(vec3 w, vec4 a, vec4 b, vec4 c){ vec3 L = vec3(dot(a.rgb, vec3(0.299, 0.587, 0.114)), dot(b.rgb, vec3(0.299, 0.587, 0.114)), dot(c.rgb, vec3(0.299, 0.587, 0.114)));
  vec3 W = mix(vec3(1.0), L, hxP.w) * pow(max(w, 0.0), vec3(hxP.z)); return W / max(W.x + W.y + W.z, 1e-5); }
vec4 hxMap(sampler2D s, vec2 st){ vec3 w; vec2 V[3]; hxGrid(st * hxP.x, w, V[0], V[1], V[2]); hxDX = dFdx(st); hxDY = dFdy(st); vec4 c[3];
  for(int i = 0; i < 3; i++){ mat2 R = hxRot(V[i]); vec2 ce = hxCen(V[i]), h = hxHash(V[i]); hxR[i] = R; hxU[i] = R * (st - ce) + ce + h; c[i] = textureGrad(s, hxU[i], R * hxDX, R * hxDY); }
  hxW = hxWeigh(w, c[0], c[1], c[2]); return hxW.x * c[0] + hxW.y * c[1] + hxW.z * c[2]; }
vec4 hxNrm(sampler2D s, vec2 st){ if(hxW.x + hxW.y + hxW.z < 0.5) return texture2D(s, st);
#ifdef GR_LITE_NRM
  { int k = hxW.x > hxW.y ? (hxW.x > hxW.z ? 0 : 2) : (hxW.y > hxW.z ? 1 : 2); vec3 t = textureGrad(s, hxU[k], hxR[k] * hxDX, hxR[k] * hxDY).xyz * 2.0 - 1.0; t.xy = t.xy * hxR[k]; return vec4(normalize(t) * 0.5 + 0.5, 1.0); }
#endif
  vec3 n = vec3(0.0);
  for(int i = 0; i < 3; i++){ vec3 t = textureGrad(s, hxU[i], hxR[i] * hxDX, hxR[i] * hxDY).xyz * 2.0 - 1.0; t.xy = t.xy * hxR[i]; n += hxW[i] * t; }   // (xy · R = the normal turned back by the hex's own turn)
  return vec4(normalize(n) * 0.5 + 0.5, 1.0); }
vec4 hxDom(sampler2D s, vec2 st){ if(hxW.x + hxW.y + hxW.z < 0.5) return texture2D(s, st); int k = hxW.x > hxW.y ? (hxW.x > hxW.z ? 0 : 2) : (hxW.y > hxW.z ? 1 : 2);
  return textureGrad(s, hxU[k], hxR[k] * hxDX, hxR[k] * hxDY); }
vec4 hxTex1(sampler2D s, vec2 st){ return texture2D(s, mat2(0.8, 0.6, -0.6, 0.8) * st); }
#ifdef HX_CHEAP
vec4 hxTex(sampler2D s, vec2 st){ return hxTex1(s, st); }
#else
vec4 hxTex(sampler2D s, vec2 st){ vec3 w; vec2 V[3]; hxGrid(st * hxP.x, w, V[0], V[1], V[2]); vec2 dx = dFdx(st), dy = dFdy(st); vec4 c[3];
  for(int i = 0; i < 3; i++){ mat2 R = hxRot(V[i]); vec2 ce = hxCen(V[i]), h = hxHash(V[i]); c[i] = textureGrad(s, R * (st - ce) + ce + h, R * dx, R * dy); }
  vec3 W = hxWeigh(w, c[0], c[1], c[2]); return W.x * c[0] + W.y * c[1] + W.z * c[2]; }
#endif
`;
const HX_PLAIN = `float hxNv = 1.0; vec4 hxTex(sampler2D s, vec2 st){ return texture2D(s, st); } vec4 hxTex1(sampler2D s, vec2 st){ return texture2D(s, st); }\n`;
function noTile(fs){ const C = THREE.ShaderChunk, H = GROUND_PHOTO.hex || {};
  if(GROUND_PHOTO.noTile && H.on && (!MOBILE || H.mobile)) return fs.replace('#include <common>', '#include <common>\n' + liteDefs() + (MOBILE ? '#define HX_CHEAP\n' : '') + HX_GLSL)   // Z405 (PERF 6 the lite switches first)
    .replace('#include <map_fragment>', C.map_fragment.replace('texture2D( map, vMapUv )', 'hxMap( map, vMapUv )'))
    .replace('#include <normal_fragment_maps>', C.normal_fragment_maps.split('texture2D( normalMap, vNormalMapUv )').join('hxNrm( normalMap, vNormalMapUv )').replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * hxNv;'))
    .replace('#include <roughnessmap_fragment>', C.roughnessmap_fragment.replace('texture2D( roughnessMap, vRoughnessMapUv )', 'hxDom( roughnessMap, vRoughnessMapUv )'));
  if(!GROUND_PHOTO.noTile) return fs.replace('#include <common>', '#include <common>\n' + liteDefs() + HX_PLAIN);
  return fs.replace('#include <common>', '#include <common>\n' + liteDefs() + NT_GLSL + HX_PLAIN)
    .replace('#include <map_fragment>', C.map_fragment.replace('texture2D( map, vMapUv )', 'ntTex( map, vMapUv )'))
    .replace('#include <normal_fragment_maps>', C.normal_fragment_maps.split('texture2D( normalMap, vNormalMapUv )').join('ntTex( normalMap, vNormalMapUv )'))
    .replace('#include <roughnessmap_fragment>', C.roughnessmap_fragment.replace('texture2D( roughnessMap, vRoughnessMapUv )', 'ntTex( roughnessMap, vRoughnessMapUv )'))
    .replace('#include <aomap_fragment>', C.aomap_fragment.replace('texture2D( aoMap, vAoMapUv )', 'ntTex( aoMap, vAoMapUv )')); }
// Z328 the ground scars (scorch, craters, tread prints: world/decals.js) are read by the ground's own shader — they were two more copies of the whole
//   terrain mesh (2 × 180k triangles) drawn transparent, lit and shadowed over it: two extra full-screen passes of the ground every frame
export const DECAL_U = { decalS:{ value:null }, decalD:{ value:null }, decalK:{ value:1/(2*ARENA) }, decalC:{ value:null }, contCol:{ value:new THREE.Color(1, 1, 1) }, contK:{ value:new THREE.Vector2(0, 0) },
  trailMap:{ value:null }, trailK:{ value:new THREE.Vector4(0, 0.5, 0, 0.3) }, trailCol:{ value:new THREE.Color(0.6, 0.58, 0.52) } };   // Z432 the trails (world/trails.js): the gravel photo, (on, 1 / its tile m, how much grass keeps the crown, how dark the ruts), its tint   // Z400 decalC / contCol / contK: the contact map (world/decals.js paintContact)
const DECAL_GLSL = `{ vec2 duv = vec2(vWXZ.x * decalK + 0.5, 0.5 - vWXZ.y * decalK); vec4 ds = texture2D(decalS, duv); diffuseColor.rgb = mix(diffuseColor.rgb, ds.rgb, ds.a);
  vec4 dd = texture2D(decalD, duv); diffuseColor.rgb = mix(diffuseColor.rgb, dd.rgb, dd.a);
  vec3 ct = texture2D(decalC, duv).rgb; diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * contCol, ct.g * contK.y); diffuseColor.rgb *= 1.0 - ct.r * contK.x;
  if(trailK.x > 0.5 && ct.b > 0.004){ vec2 tu = vWXZ * trailK.y; vec3 t0 = texture2D(trailMap, tu).rgb, t1 = texture2D(trailMap, mat2(0.8, 0.6, -0.6, 0.8) * tu * 0.63 + 0.37).rgb, tc = mix(t0, t1, 0.45) * trailCol;
    float tl = dot(t0 - texture2D(trailMap, tu, 8.0).rgb, vec3(0.333)), body = smoothstep(0.1, 0.5, ct.b + tl * 0.7), rut = smoothstep(0.7, 0.93, ct.b), verge = smoothstep(0.0, 0.12, ct.b) * (1.0 - body);
    vec3 c = mix(diffuseColor.rgb, diffuseColor.rgb * contCol, verge * 0.5); float far = smoothstep(0.06, 0.45, length(fwidth(vWXZ))); c = mix(c, tc, max(body * (1.0 - trailK.z * (1.0 - far)), rut)); diffuseColor.rgb = c * (1.0 - rut * trailK.w); } }`;   // Z432 the trail: gravel over its worn body, its edge ragged with the stones' own light, the ruts bare and dark, the verge trodden; from afar (a pixel tens of cm wide) the whole width reads as the worn strip   // Z400 trodden earth round what stands here, shade tight under it
function decalGround(sh){ sh.uniforms.decalS = DECAL_U.decalS; sh.uniforms.decalD = DECAL_U.decalD; sh.uniforms.decalK = DECAL_U.decalK; sh.uniforms.decalC = DECAL_U.decalC; sh.uniforms.contCol = DECAL_U.contCol; sh.uniforms.contK = DECAL_U.contK; sh.uniforms.trailMap = DECAL_U.trailMap; sh.uniforms.trailK = DECAL_U.trailK; sh.uniforms.trailCol = DECAL_U.trailCol;
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D decalS, decalD, decalC, trailMap; uniform float decalK; uniform vec3 contCol, trailCol; uniform vec2 contK; uniform vec4 trailK;').replace('#include <color_fragment>', '#include <color_fragment>\n' + DECAL_GLSL); }
// PERF 6 THE GROUND'S LIGHTER READS (GROUND_PHOTO.hex.lite): the floor read ~23 textures a pixel, three of them per layer for the no-repeat hexes —
//   alt: the second photo set in one turned lookup, dual: the base at its second scale in one turned lookup (both are blended in by masks, their
//   repeats never line up), nrm: the normal from the strongest of the three hexes (as roughness already was); the base colour keeps its three
const liteKey = () => { const L = (GROUND_PHOTO.hex || {}).lite || {}; return '|L' + (L.alt ? 'a' : '') + (L.dual ? 'd' : '') + (L.nrm ? 'n' : ''); };
function liteDefs(){ const L = (GROUND_PHOTO.hex || {}).lite || {}; return (L.nrm ? '#define GR_LITE_NRM\n' : '') + '#define HX_ALT(s, st) ' + (L.alt ? 'hxTex1' : 'hxTex') + '(s, st)\n#define HX_DUAL(s, st) ' + (L.dual ? 'hxTex1' : 'hxTex') + '(s, st)\n'; }
export function macroGround(mat){
  mat.onBeforeCompile=(sh)=>{ sh.uniforms.macroMap=MACRO.tex; sh.uniforms.macroAmt=MACRO.amt; sh.uniforms.macroSpan=MACRO.span; sh.uniforms.patchMap=MACRO.patch; sh.uniforms.patchCol=MACRO.pcol; sh.uniforms.patchAmt=MACRO.pamt;
    sh.uniforms.altMap=PHOTO_U.altMap; sh.uniforms.altOn=PHOTO_U.altOn; sh.uniforms.altScale=PHOTO_U.altScale; sh.uniforms.dual=PHOTO_U.dual; sh.uniforms.hxP=PHOTO_U.hex; sh.uniforms.wetK=WET_U.k; sh.uniforms.nrmVar=PHOTO_U.nrmVar; sh.uniforms.grassCol=GRASS_FAR.col; sh.uniforms.grassC=GRASS_FAR.c; sh.uniforms.grassK=GRASS_FAR.k; sh.uniforms.rel0=RELIEF_U.rel0; sh.uniforms.rel1=RELIEF_U.rel1; sh.uniforms.bowlTint=RELIEF_U.bowlTint; sh.uniforms.earthCol=RELIEF_U.earth;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float macroSpan; varying vec2 vMacroUv; attribute vec2 aRelief; varying vec2 vRelief; varying vec2 vWXZ; varying float vWY;').replace('#include <project_vertex>','#include <project_vertex>\nvec4 mwp = modelMatrix * vec4(transformed,1.0); vMacroUv = mwp.xz*macroSpan + 0.5; vRelief = aRelief; vWXZ = mwp.xz; vWY = mwp.y;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec4 rel0, rel1; uniform vec3 bowlTint, earthCol; varying vec2 vRelief;\nuniform sampler2D macroMap, patchMap; uniform float macroAmt, patchAmt; uniform vec3 patchCol; varying vec2 vMacroUv;\nuniform sampler2D altMap; uniform float altOn, altScale, dual, nrmVar; varying vec2 vWXZ;\nuniform vec3 grassCol; uniform vec4 grassC, grassK; uniform vec4 wetK; varying float vWY; float wetR = 0.0;')
      .replace('#include <map_fragment>','#include <map_fragment>\nvec3 altC = vec3(0.0);\n#ifdef USE_MAP\nif(altOn>0.5){ altC = HX_ALT(altMap, vWXZ*altScale).rgb; float dm = texture2D(macroMap, vMacroUv*5.0).g; diffuseColor.rgb = mix(diffuseColor.rgb, HX_DUAL(map, vMapUv*0.29 + vec2(0.37, 0.11)).rgb, smoothstep(0.38, 0.62, dm)*dual); }\nhxNv = clamp(1.0 + nrmVar*(texture2D(macroMap, vMacroUv*3.7 + 0.31).b*2.0 - 1.0)*1.8, 0.3, 1.8);\n#endif\n{ float gw = grassK.x * smoothstep(grassC.z, grassC.w, distance(vWXZ, grassC.xy)); if(gw > 0.001){ float gl = clamp(dot(diffuseColor.rgb, vec3(0.333)) / max(grassK.y, 1e-3), 0.55, 1.5); diffuseColor.rgb = mix(diffuseColor.rgb, grassCol * gl, gw); } }\n{ vec3 mc = texture2D(macroMap, vMacroUv).rgb; float dl = dot(diffuseColor.rgb, vec3(0.333)); float pv = texture2D(patchMap, vMacroUv*1.6).r + (dl-0.35)*0.5;\n  float pm = smoothstep(0.56, 0.66, pv)*patchAmt; diffuseColor.rgb = mix(diffuseColor.rgb, altOn>0.5 ? altC : patchCol*(0.7+dl*0.9), pm);\n  diffuseColor.rgb *= mix(vec3(1.0), mc*2.0, macroAmt); }\n'+RELIEF_GLSL+'\n{ wetR = wetK.y * (1.0 - smoothstep(wetK.x, wetK.x + wetK.z, vWY)); diffuseColor.rgb *= 1.0 - wetK.w * wetR; }').replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.3, wetR * 0.85);'); sh.fragmentShader=noTile(sh.fragmentShader); };   // Z405 the wet banks
  { const f0=mat.onBeforeCompile; mat.onBeforeCompile=(sh, r)=>{ f0(sh, r); decalGround(sh); }; }
  mat.customProgramCacheKey=()=>'macroGround5'+liteKey(); return mat;
}
