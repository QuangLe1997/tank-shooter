// tank/materials.js — procedural PBR textures for armour: welded panels (albedo/height/normal/rough), tracks, wheels, blob shadow
import * as THREE from 'three';

// ----------------------------- PLAYER TANK -----------------------------
// ---- shared procedural tank textures (built ONCE, referenced by every tank) ----
export const _SEAMH=[38,128,212], _SEAMV=[58,150,228];
export function _makePanelTex(){                                                          // ALBEDO — worn painted armor (tints with material color)
  const c=document.createElement('canvas'); c.width=c.height=256; const x=c.getContext('2d');
  x.fillStyle='#cfcfcf'; x.fillRect(0,0,256,256);
  // disruptive CAMO (rằn ri) — irregular tonal blotches; tinted by the material colour they read as faction camo
  const blob=(cx,cy,r,fill)=>{ x.fillStyle=fill; x.beginPath(); const n=7+(Math.random()*4|0);
    for(let a=0;a<n;a++){ const ang=a/n*6.283, rr=r*(0.55+Math.random()*0.6), px=cx+Math.cos(ang)*rr, py=cy+Math.sin(ang)*rr; a?x.lineTo(px,py):x.moveTo(px,py); } x.closePath(); x.fill(); };
  for(let t=0;t<2;t++) for(let i=0;i<11;i++){ const cx=Math.random()*256, cy=Math.random()*256, r=22+Math.random()*40;
    blob(cx,cy,r, i%3===0 ? 'rgba(236,234,226,0.24)' : (i%3===1 ? 'rgba(140,142,128,0.36)' : 'rgba(104,106,94,0.3)')); }   // light highlight + 2 darker camo tones, layered & overlapping
  for(let i=0;i<3200;i++){ const v=(188+Math.random()*66)|0; x.fillStyle='rgba('+v+','+v+','+v+','+(Math.random()*0.06).toFixed(3)+')'; x.fillRect(Math.random()*256,Math.random()*256,2,2); } // grain
  for(let i=0;i<26;i++){ const cx=Math.random()*256, cy=Math.random()*256, r=3+Math.random()*9, g=(150+Math.random()*44)|0; // chipped paint → bare primer/metal patches
    x.fillStyle='rgba('+g+','+g+','+((g-8)|0)+','+(0.22+Math.random()*0.3).toFixed(2)+')'; x.beginPath(); x.ellipse(cx,cy,r,r*0.66,Math.random()*6,0,7); x.fill(); }
  x.strokeStyle='rgba(58,58,58,0.6)'; x.lineWidth=2;                                // panel seams
  for(const gy of _SEAMH){ x.beginPath(); x.moveTo(0,gy); x.lineTo(256,gy); x.stroke(); }
  for(const gx of _SEAMV){ x.beginPath(); x.moveTo(gx,0); x.lineTo(gx,256); x.stroke(); }
  x.strokeStyle='rgba(214,214,214,0.22)'; x.lineWidth=1.4;                          // weld beads beside seams (slightly wavy, lighter)
  for(const gy of _SEAMH){ x.beginPath(); for(let xx=0;xx<=256;xx+=8) x.lineTo(xx,gy-2+Math.sin(xx*0.42)*0.9); x.stroke(); }
  x.fillStyle='rgba(48,48,48,0.6)';                                                // rivet rows along seams
  for(let i=12;i<256;i+=22){ x.beginPath(); x.arc(i,38,1.8,0,7); x.fill(); x.beginPath(); x.arc(i,212,1.8,0,7); x.fill(); }
  for(let i=0;i<22;i++){ const sx=Math.random()*256, sy=Math.random()*170, len=14+Math.random()*42; // rust streaks dripping down
    const grd=x.createLinearGradient(sx,sy,sx,sy+len); grd.addColorStop(0,'rgba(122,68,34,0.34)'); grd.addColorStop(1,'rgba(122,68,34,0)'); x.fillStyle=grd; x.fillRect(sx-1,sy,2.4,len); }
  x.strokeStyle='rgba(255,255,255,0.16)'; x.lineWidth=1;                            // scuff/scratches
  for(let i=0;i<32;i++){ const sx=Math.random()*256, sy=Math.random()*256; x.beginPath(); x.moveTo(sx,sy); x.lineTo(sx+(Math.random()*44-22),sy+(Math.random()*14-7)); x.stroke(); }
  for(let i=0;i<20;i++){ x.fillStyle='rgba(86,66,46,'+(Math.random()*0.1).toFixed(3)+')'; x.beginPath(); x.arc(Math.random()*256,Math.random()*256,8+Math.random()*22,0,7); x.fill(); } // dirt/rust smudges
  x.strokeStyle='rgba(238,232,206,0.16)'; x.lineWidth=4; x.beginPath(); x.moveTo(176,170); x.lineTo(196,186); x.lineTo(176,202); x.stroke(); // faint painted chevron marking
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=8; return t;
}
export function _makePanelHeight(){                                                        // grayscale height: grooves=dark, weld/rivets=bright
  const c=document.createElement('canvas'); c.width=c.height=256; const x=c.getContext('2d');
  x.fillStyle='#808080'; x.fillRect(0,0,256,256);
  for(let i=0;i<2200;i++){ const v=(118+Math.random()*22)|0; x.fillStyle='rgb('+v+','+v+','+v+')'; x.fillRect(Math.random()*256,Math.random()*256,2,2); } // grain
  x.strokeStyle='#3a3a3a'; x.lineWidth=3;                                           // seams sunk in
  for(const gy of _SEAMH){ x.beginPath(); x.moveTo(0,gy); x.lineTo(256,gy); x.stroke(); }
  for(const gx of _SEAMV){ x.beginPath(); x.moveTo(gx,0); x.lineTo(gx,256); x.stroke(); }
  x.strokeStyle='#cccccc'; x.lineWidth=2;                                           // weld beads raised
  for(const gy of _SEAMH){ x.beginPath(); for(let xx=0;xx<=256;xx+=6) x.lineTo(xx,gy+2+Math.sin(xx*0.5)); x.stroke(); }
  for(let i=12;i<256;i+=22){ for(const gy of [38,212]){ const g=x.createRadialGradient(i,gy,0,i,gy,3.4);   // rivets pop out
    g.addColorStop(0,'#f2f2f2'); g.addColorStop(1,'#808080'); x.fillStyle=g; x.beginPath(); x.arc(i,gy,3.4,0,7); x.fill(); } }
  return c;
}
export function _heightToNormal(hc, strength){                                             // Sobel-ish height→tangent-space normal map (tileable)
  const W=hc.width,H=hc.height, src=hc.getContext('2d').getImageData(0,0,W,H).data;
  const out=document.createElement('canvas'); out.width=W; out.height=H; const ox=out.getContext('2d'); const od=ox.createImageData(W,H), d=od.data;
  const at=(px,py)=>{ px=(px+W)%W; py=(py+H)%H; return src[(py*W+px)*4]/255; };
  for(let y=0;y<H;y++) for(let x2=0;x2<W;x2++){
    const dx=(at(x2-1,y)-at(x2+1,y))*strength, dy=(at(x2,y-1)-at(x2,y+1))*strength, nz=1, inv=1/Math.hypot(dx,dy,nz), i=(y*W+x2)*4;
    d[i]=(dx*inv*0.5+0.5)*255; d[i+1]=(dy*inv*0.5+0.5)*255; d[i+2]=(nz*inv*0.5+0.5)*255; d[i+3]=255;
  }
  ox.putImageData(od,0,0); const t=new THREE.CanvasTexture(out); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=4; return t;
}
export function _makeRoughTex(){                                                           // ROUGHNESS — paint matte, worn metal/scratches shiny
  const c=document.createElement('canvas'); c.width=c.height=256; const x=c.getContext('2d');
  x.fillStyle='#c6c6c6'; x.fillRect(0,0,256,256);
  for(let i=0;i<28;i++){ const cx=Math.random()*256, cy=Math.random()*256, r=3+Math.random()*10; x.fillStyle='rgba(64,64,64,'+(0.4+Math.random()*0.4).toFixed(2)+')'; x.beginPath(); x.ellipse(cx,cy,r,r*0.66,Math.random()*6,0,7); x.fill(); } // polished wear
  x.strokeStyle='rgba(56,56,56,0.5)'; x.lineWidth=1;
  for(let i=0;i<32;i++){ const sx=Math.random()*256, sy=Math.random()*256; x.beginPath(); x.moveTo(sx,sy); x.lineTo(sx+(Math.random()*44-22),sy+(Math.random()*14-7)); x.stroke(); } // bright scratches
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=4; return t;
}
// ---- running gear textures: segmented steel track shoes (u runs ALONG the belt → scrolls with travel) + road-wheel face ----
export function _makeTrackTex(){
  const c=document.createElement('canvas'); c.width=64; c.height=64; const x=c.getContext('2d');
  x.fillStyle='#151411'; x.fillRect(0,0,64,64);                                    // hinge gap between shoes
  x.fillStyle='#3a3832'; x.fillRect(5,2,54,60);                                    // steel shoe plate
  x.fillStyle='#24231f'; x.fillRect(5,25,54,14);                                   // centre guide groove
  x.fillStyle='#5a574d'; x.fillRect(11,4,7,56); x.fillRect(46,4,7,56);            // raised grouser bars (worn bright by the ground)
  x.fillStyle='#121110'; x.fillRect(26,27,12,10);                                  // guide horn
  x.fillStyle='#2b2a26'; for(const yy of [8,52]){ x.fillRect(22,yy,20,5); }       // rubber pads
  for(let i=0;i<160;i++){ x.fillStyle='rgba(150,128,96,'+(Math.random()*0.2).toFixed(2)+')'; x.fillRect(Math.random()*64,Math.random()*64,2,2); }   // packed mud / grit
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(3.4,1.6); t.anisotropy=4; return t;
}
export function _makeWheelTex(){
  const S2=128, c=document.createElement('canvas'); c.width=c.height=S2; const x=c.getContext('2d'), m=S2/2;
  x.fillStyle='#151512'; x.fillRect(0,0,S2,S2);                                    // rubber tyre
  x.fillStyle='#4b4a41'; x.beginPath(); x.arc(m,m,m*0.8,0,7); x.fill();           // pressed-steel disc
  x.fillStyle='#3a3a33'; x.beginPath(); x.arc(m,m,m*0.7,0,7); x.fill();
  for(let i=0;i<6;i++){ const a=i/6*6.283; x.fillStyle='#11110e'; x.beginPath(); x.arc(m+Math.cos(a)*m*0.46, m+Math.sin(a)*m*0.46, m*0.12, 0, 7); x.fill(); }   // lightening holes → the spin reads clearly
  x.fillStyle='#5e5d52'; x.beginPath(); x.arc(m,m,m*0.24,0,7); x.fill();          // hub cap
  for(let i=0;i<8;i++){ const a=i/8*6.283; x.fillStyle='#24241f'; x.beginPath(); x.arc(m+Math.cos(a)*m*0.16, m+Math.sin(a)*m*0.16, 2.3, 0, 7); x.fill(); }   // hub bolts
  x.strokeStyle='rgba(150,126,92,0.4)'; x.lineWidth=6; x.beginPath(); x.arc(m,m,m*0.88,0,7); x.stroke();   // dust caked on the tyre shoulder
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
export function _makeBlobTex(){                                                             // soft contact shadow / ambient occlusion under each tank (grounds it, esp. on mobile without shadow maps)
  const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,4,64,64,63); g.addColorStop(0,'rgba(0,0,0,0.9)'); g.addColorStop(0.5,'rgba(0,0,0,0.55)'); g.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=g; x.fillRect(0,0,128,128); return new THREE.CanvasTexture(c);
}
export let _PANEL_TEX=null,_PANEL_NRM=null,_PANEL_RGH=null,_TRACK_TEX=null,_WHEEL_TEX=null,_BLOB_TEX=null;
export const panelTex=()=>(_PANEL_TEX||(_PANEL_TEX=_makePanelTex()));
export const panelNrm=()=>(_PANEL_NRM||(_PANEL_NRM=_heightToNormal(_makePanelHeight(),2.4)));
export const panelRgh=()=>(_PANEL_RGH||(_PANEL_RGH=_makeRoughTex()));
export const trackTex=()=>(_TRACK_TEX||(_TRACK_TEX=_makeTrackTex()));
export const wheelTex=()=>(_WHEEL_TEX||(_WHEEL_TEX=_makeWheelTex()));
export const blobTex=()=>(_BLOB_TEX||(_BLOB_TEX=_makeBlobTex()));
// ---- field grime: dust/mud climbs the lower hull, running gear and skirts (world-height mask, tinted by the battlefield) ----
export const GRIME = { col:{ value:new THREE.Color(0x9a8358) }, amt:{ value:0.55 } };
export function grimeMat(mat, k){
  mat.onBeforeCompile = (sh)=>{
    sh.uniforms.grimeCol=GRIME.col; sh.uniforms.grimeAmt=GRIME.amt;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vGrimeY;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGrimeY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 grimeCol; uniform float grimeAmt; varying float vGrimeY;')
      .replace('#include <map_fragment>', '#include <map_fragment>\nfloat gk = (1.0 - smoothstep(0.1, 1.55, vGrimeY)) * grimeAmt * '+k.toFixed(2)+';\ndiffuseColor.rgb = mix(diffuseColor.rgb, grimeCol * (0.78 + 0.45 * diffuseColor.g), gk);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 1.0, gk * 0.85);');
  };
  mat.customProgramCacheKey = ()=>'grime'+k.toFixed(2);
  return mat;
}
// real armour paint is dull: knock saturation + value down so faction colours read as military paint, not toy plastic
export const _rcC=new THREE.Color(), _rcH={};
export function realCol(hex, sat=0.62, val=0.92){ _rcC.setHex(hex).getHSL(_rcH); _rcC.setHSL(_rcH.h, _rcH.s*sat, _rcH.l*val); return _rcC.getHex(); }
