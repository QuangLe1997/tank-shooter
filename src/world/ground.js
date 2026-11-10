// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.
import * as THREE from 'three';
import { ARENA, GROUND_STYLE, MOBILE, _heightToNormal } from '../hub.js';

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
export function groundMaps(b){
  if(_gCache[b.name]) return _gCache[b.name];
  const st=GROUND_STYLE[b.name]||GROUND_STYLE.DESERT, W=MOBILE?512:1024, N=W*W;
  const n1=tileNoise(W,[4,8,16,32,64,128,256],0.52), n2=tileNoise(W,[3,6,12],0.5), n3=tileNoise(W,[32,64,128],0.55);
  const H=new Float32Array(N);
  const col=document.createElement('canvas'); col.width=col.height=W; const cx=col.getContext('2d'); const img=cx.createImageData(W,W), d=img.data;
  const [c0,c1,c2]=st.c, mix=(a,b,t)=>a+(b-a)*t;
  for(let y=0;y<W;y++) for(let x=0;x<W;x++){ const i=y*W+x;
    let h=n1[i], t=h;
    if(b.name==='DESERT'){ const rip=Math.sin((x*0.82+y*0.57)/W*6.283*38 + n2[i]*14)*0.5+0.5;          // wind ripples bent by large-scale flow
      h = n1[i]*0.7 + rip*0.18*n2[i] + n3[i]*0.12; t = h + (n2[i]-0.5)*0.35; }
    else if(b.name==='TUNDRA'){ h = n1[i]*0.7+n3[i]*0.3; t = 0.3+h*0.8; }                                                          // wind-packed drifts
    else if(b.name==='MEADOW'){ t = n1[i]*0.6+n3[i]*0.4; }
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
  else if(b.name==='RUINS'){ // broken concrete slabs: seams + spalling + oil stains + rubble grit
    both((x,isH)=>{ x.strokeStyle=isH?'rgba(0,0,0,0.7)':'rgba(40,40,40,0.55)'; x.lineWidth=3*W/1024; const s=W/4; for(let i=0;i<=4;i++){ x.beginPath(); x.moveTo(i*s+R(-3,3),0); x.lineTo(i*s+R(-3,3),W); x.moveTo(0,i*s+R(-3,3)); x.lineTo(W,i*s+R(-3,3)); x.stroke(); } });
    cracks(40,14,1.8,'rgba(30,30,30,0.6)','rgba(0,0,0,0.6)');
    for(let i=0;i<3;i++){ const px=Math.random()*W, py=Math.random()*W, r=R(20,60)*W/1024; cx.fillStyle='rgba(20,18,16,'+R(0.08,0.16).toFixed(2)+')'; cx.beginPath(); cx.ellipse(px,py,r,r*R(0.5,1),R(0,3),0,7); cx.fill(); }
    pebbles(1400,1,3,['rgba(90,88,84,0.9)','rgba(140,136,128,0.9)','rgba(60,58,56,0.9)'],'rgba(255,255,255,0.5)'); }
  else if(b.name==='TUNDRA'){ cracks(26,12,1.2,'rgba(140,170,200,0.4)','rgba(0,0,0,0.2)'); pebbles(500,1,2.4,['rgba(80,86,92,0.7)','rgba(110,116,124,0.7)'],'rgba(255,255,255,0.4)');
    for(let i=0;i<1800;i++){ cx.fillStyle='rgba(255,255,255,'+R(0.4,0.9).toFixed(2)+')'; cx.fillRect(Math.random()*W,Math.random()*W,1,1); } }
  else if(b.name==='FOUNDRY'){ cracks(22,10,2.4,'rgba(150,84,52,0.45)','rgba(0,0,0,0.45)'); cracks(30,10,1.2,'rgba(16,14,12,0.7)','rgba(0,0,0,0.5)'); pebbles(1200,1,3.5,['rgba(30,26,24,0.9)','rgba(80,70,62,0.9)','rgba(60,40,30,0.9)'],'rgba(255,255,255,0.6)');
    for(let i=0;i<12;i++){ const px=Math.random()*W, py=Math.random()*W, r=R(24,80)*W/1024; const g=cx.createRadialGradient(px,py,0,px,py,r); g.addColorStop(0,'rgba(10,10,14,0.5)'); g.addColorStop(1,'rgba(10,10,14,0)'); cx.fillStyle=g; cx.fillRect(px-r,py-r,r*2,r*2); } }
  else if(b.name==='CITADEL'){ cracks(30,12,1.6,'rgba(24,18,12,0.6)','rgba(0,0,0,0.5)'); pebbles(1300,1,3.4,['rgba(60,48,34,0.9)','rgba(100,84,60,0.9)','rgba(30,26,22,0.9)'],'rgba(255,255,255,0.55)');
    for(let i=0;i<900;i++){ cx.fillStyle='rgba(30,28,26,'+R(0.2,0.5).toFixed(2)+')'; cx.fillRect(Math.random()*W,Math.random()*W,2,2); } }
  else if(b.name==='MEADOW'){ const Gs=[]; for(let i=0;i<(MOBILE?5000:14000);i++) Gs.push([Math.random()*W,Math.random()*W,R(4,11)*W/1024,R(-3,3)*W/1024, Math.random()<0.3?'rgba(170,200,100,0.55)':(Math.random()<0.5?'rgba(80,110,46,0.55)':'rgba(60,84,34,0.6)')]);
    both((x,isH)=>{ x.lineWidth=1.2*W/1024; for(const [gx,gy,h,lean,cc] of Gs){ x.strokeStyle=isH?'rgba(255,255,255,0.35)':cc; x.beginPath(); x.moveTo(gx,gy); x.lineTo(gx+lean,gy-h); x.stroke(); } });
    pebbles(300,1,2.6,['rgba(110,100,84,0.8)'],'rgba(255,255,255,0.5)'); }
  const map=new THREE.CanvasTexture(col); map.colorSpace=THREE.SRGBColorSpace; map.wrapS=map.wrapT=THREE.RepeatWrapping; map.anisotropy=MOBILE?2:4;
  const nrm=_heightToNormal(hc, st.nrm); nrm.anisotropy=MOBILE?2:4;
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
export const PATCH_COL = { DESERT:[0x9a7a50,0.55], RUINS:[0x5e5446,0.6], TUNDRA:[0x5c636c,0.75], FOUNDRY:[0x141210,0.7], CITADEL:[0x3e3a36,0.6], MEADOW:[0x6a5232,0.85] };
export const MACRO = { tex:{ value:macroTexture() }, amt:{ value:0.3 }, span:{ value:1/(ARENA*2) }, patch:{ value:patchTexture() }, pcol:{ value:new THREE.Color(0x9a7a50) }, pamt:{ value:0.55 } };
export function macroGround(mat){
  mat.onBeforeCompile=(sh)=>{ sh.uniforms.macroMap=MACRO.tex; sh.uniforms.macroAmt=MACRO.amt; sh.uniforms.macroSpan=MACRO.span; sh.uniforms.patchMap=MACRO.patch; sh.uniforms.patchCol=MACRO.pcol; sh.uniforms.patchAmt=MACRO.pamt;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float macroSpan; varying vec2 vMacroUv;').replace('#include <project_vertex>','#include <project_vertex>\nvec4 mwp = modelMatrix * vec4(transformed,1.0); vMacroUv = mwp.xz*macroSpan + 0.5;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D macroMap, patchMap; uniform float macroAmt, patchAmt; uniform vec3 patchCol; varying vec2 vMacroUv;')
      .replace('#include <map_fragment>','#include <map_fragment>\n{ vec3 mc = texture2D(macroMap, vMacroUv).rgb; float dl = dot(diffuseColor.rgb, vec3(0.333)); float pv = texture2D(patchMap, vMacroUv*1.6).r + (dl-0.35)*0.5;\n  float pm = smoothstep(0.56, 0.66, pv)*patchAmt; diffuseColor.rgb = mix(diffuseColor.rgb, patchCol*(0.7+dl*0.9), pm);\n  diffuseColor.rgb *= mix(vec3(1.0), mc*2.0, macroAmt); }'); };
  mat.customProgramCacheKey=()=>'macroGround'; return mat;
}
