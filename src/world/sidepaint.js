// world/sidepaint.js — Z179 BATTLEFIELD-AWARE PAINT: soldiers and vehicles of both sides are recoloured for each battlefield so they stand out from its ground (tan troops on sand, olive tanks on grass used to vanish)
import * as THREE from 'three';
import { BIOME, GROUND_STYLE, SOLDIER_KIT, _R } from '../hub.js';

// each side keeps its identity: ours = cool greens, theirs = warm tans / reds. When the ground is the same hue, ours turn slate-teal and theirs turn crimson;
// when the ground is the same brightness, the paint goes darker (light ground) or darker / lighter (dark ground) until it separates
export const SIDE_PAINT = { gap:0.2, lightGap:0.24, snowGap:0.45, floor:0.12, hueNear:0.11, groundSat:0.18, hue:{ f:0.5, e:0.985 }, sat:[0.28,0.55],
  troops:{ f:{ base:'#55703a', blot:['#3e5a2a','#6f8a48','#2c3e1e','#4a6634'], gear:'#4a4a32', helm:'#3c5426' },
           e:{ base:'#a8905e', blot:['#8a7048','#c8b080','#6a5636','#b49a6a'], gear:'#5a4632', helm:null } } };   // helm:null = the side colour helmet stays as it is (maroon)
const _a=new THREE.Color(), _h={ h:0, s:0, l:0 }, _g={ h:0, s:0, l:0 };
const hueDist=(a,b)=>{ const d=Math.abs(a-b)%1; return Math.min(d, 1-d); };
// the ground as the eye sees it on this battlefield (mid tone of its ground texture)
export function groundTone(){ const st=GROUND_STYLE[BIOME.name], c=st ? st.c[1] : null;
  if(c) _a.setRGB(c[0]/255, c[1]/255, c[2]/255, THREE.SRGBColorSpace); else _a.setHex(BIOME.ground); _a.getHSL(_g, THREE.SRGBColorSpace); return _g; }
// how one side's main colour must move on this ground: { h: new hue or null, s, sm: saturation ×, dl: lightness shift }
export function sideShift(baseHex, side){ const P=SIDE_PAINT, G=groundTone(); _a.setHex(baseHex); _a.getHSL(_h, THREE.SRGBColorSpace);
  let h=null, s=_h.s, sm=1, l=_h.l; const grey=G.s<=P.groundSat;
  if(grey){   // grey ground (concrete, ash, rubble): colour itself is the contrast → keep the hue, make it richer; only a grey vehicle also moves in brightness
    if(_h.s>=0.1) sm=1.7; else if(Math.abs(l-G.l)<P.gap) l = G.l-P.gap>=P.floor+0.05 ? Math.min(l, G.l-P.gap) : G.l+P.gap;
    return { h, s, sm, dl:l-_h.l }; }
  if(_h.s>0.12 && hueDist(_h.h, G.h)<P.hueNear){ h=P.hue[side==='e'?'e':'f']; s=Math.min(P.sat[1], Math.max(P.sat[0], _h.s)); }   // same hue as the ground → the side's own contrast hue
  const gap = G.l>0.75 ? P.snowGap : P.lightGap;
  if(G.l>=0.5){ if(l>G.l-gap) l=Math.max(P.floor, G.l-gap); }                                                                     // light ground (sand, snow, sunny grass) → darker paint
  else if(Math.abs(l-G.l)<P.gap){ const dn=G.l-P.gap; l = dn>=P.floor+0.05 ? Math.min(l, dn) : G.l+P.gap; }                       // mid ground → darker too (a pale soldier reads as a hit flash)
  return { h, s, sm, dl:l-_h.l }; }
export function shiftHex(hex, sh){ _a.setHex(hex); _a.getHSL(_h, THREE.SRGBColorSpace); const S1=SIDE_PAINT.sat[1];
  const s = sh.h==null ? Math.min(Math.max(S1, _h.s), _h.s*sh.sm) : Math.min(S1, Math.max(sh.s*0.8, _h.s));
  _a.setHSL(sh.h==null ? _h.h : sh.h, s, Math.min(0.92, Math.max(0.05, _h.l+sh.dl)), THREE.SRGBColorSpace); return _a.getHex(); }
const cssOf=hex=>'#'+hex.toString(16).padStart(6,'0'), hexOf=css=>parseInt(css.slice(1),16);
// a vehicle's painted armour (buildTank / launcher record it in userData.paint as [material, original colour]) → this battlefield's paint
export function paintVehicle(mesh, side){ const P=mesh && mesh.userData.paint; if(!P || !P.length) return;
  const sh=sideShift(P[0][1], side); for(const [m,c0] of P) m.color.setHex(shiftHex(c0, sh)); }
// the soldiers' shared atlas: camo (u 0–64 px), gear stripe (64–80), helmet stripe (80–96) → redrawn for this battlefield
export function paintTroops(){ for(const side of ['f','e']){ const K=SOLDIER_KIT[side]; if(!K) continue; const T=SIDE_PAINT.troops[side], sh=sideShift(hexOf(T.base), side);
    const map=K.mat.map, x=map.image.getContext('2d'), c=v=>cssOf(shiftHex(hexOf(v), sh));
    x.fillStyle=c(T.base); x.fillRect(0,0,64,64); for(let i=0;i<40;i++){ x.fillStyle=c(T.blot[i%T.blot.length]); x.beginPath(); x.ellipse(_R(0,64),_R(0,64),_R(3,9),_R(2,6),_R(0,3),0,7); x.fill(); }
    x.fillStyle=c(T.gear); x.fillRect(64,0,16,64); if(T.helm){ x.fillStyle=c(T.helm); x.fillRect(80,0,16,64); }
    map.needsUpdate=true; } }
