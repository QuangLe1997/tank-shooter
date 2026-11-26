// render/materials.js — procedural textures the world shares: the welded-panel albedo (panelTex), a height map → normal map (_heightToNormal),
//   a vehicle's battlefield side-coat (sideCoat) (no-tanks: moved from tank/; the tank's tracks, wheels, blob shadow, grime and roughness maps are gone)
import * as THREE from 'three';
import { cosmetic } from '../hub.js';

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
export let _PANEL_TEX=null;
export const panelTex=()=>(_PANEL_TEX||(_PANEL_TEX=cosmetic(_makePanelTex)));   // SYNC 1 (made once: not on the battlefield's dice)
// Z403 SIDE COAT — whose tank it is, at a glance and at range. U (per vehicle, shared by its materials): coat = how much of the model's own colour gives way to
//   the side's paint (the material colour) laid over the texture's light and shade (its luminance × gain, gain = 1 / the texture's mean; detail = how much of that
//   light and shade the coat keeps, the rest is flat paint; bright = the paint's albedo × its colour, as a painted plate's), metal = how much of the
//   texture's metal the coat knocks back (paint is not bare steel), rim / pow = a fresnel rim of the side's colour round the silhouette (black: none)
