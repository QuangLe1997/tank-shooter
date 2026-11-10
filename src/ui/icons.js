// ui/icons.js — CUSTOM ICON SET (military line-art; no emoji)
import * as THREE from 'three';
   // current (set by applyBiome from stage or the player's pick)

// ===== CUSTOM ICON SET (military line-art; no emoji) =====
// One coherent stroke style across HUD, menus, drops and cards. currentColor lets CSS theme each.
export const ICON_VB='0 0 24 24';
export const GLYPH={
  heart:'<path d="M12 20S4 14.6 4 9.4A4.3 4.3 0 0 1 12 6.8 4.3 4.3 0 0 1 20 9.4C20 14.6 12 20 12 20Z"/>',
  bunker:'<path d="M3.5 20h17M6 20v-8.5l6-3.2 6 3.2V20"/><rect x="10" y="14.5" width="4" height="5.5"/><path d="M12 8V4M12 4l3.5 1.1L12 6.2"/>',
  tank:'<path d="M3 16.2h2.2L7 13h9l2.4 3.2H21"/><rect x="8.6" y="8.2" width="6" height="3.4" rx="1"/><path d="M14.6 9.3h5"/><circle cx="6.2" cy="17.6" r="1.4"/><circle cx="10" cy="17.6" r="1.4"/><circle cx="13.8" cy="17.6" r="1.4"/>',
  dash:'<path d="M4 7l5 5-5 5M11 7l5 5-5 5"/>',
  bolt:'<path d="M13 2 5 13h5l-1 9 9-12h-5l1-8Z"/>',
  shield:'<path d="M12 3 5 5.8v5.2c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V5.8L12 3Z"/>',
  burst:'<path d="M12 2l2 5 5-2-2 5 4 2-5 1 1 5-4-3-4 3 1-5-5-1 4-2-2-5 5 2 2-5Z"/>',
  infinity:'<circle cx="8" cy="12" r="3.6"/><circle cx="16" cy="12" r="3.6"/>',
  target:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  crosshair:'<circle cx="12" cy="12" r="6.4"/><path d="M12 1.6v4.4M12 18v4.4M1.6 12h4.4M18 12h4.4"/>',
  mag:'<rect x="8.4" y="3" width="7.2" height="4.6" rx="1"/><path d="M9 7.6h6V18a3 3 0 0 1-6 0V7.6Z"/><path d="M9 11h6M9 14h6"/>',
  wrench:'<path d="M20.5 4.2a4.8 4.8 0 0 1-6.2 6.2l-8 8a2 2 0 0 1-2.8-2.8l8-8A4.8 4.8 0 0 1 17.6 1.5l-2.8 2.8 1.9 1.9 2.8-2.8Z"/>',
  bomb:'<circle cx="11" cy="15" r="5.8"/><path d="M15 9.5l2.2-2.2M17.2 7.3H20M17.2 7.3V4.6"/>',
  snow:'<path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2L3.8 16.8"/><path d="M12 6l-2.4-1.6M12 6l2.4-1.6M12 18l-2.4 1.6M12 18l2.4 1.6"/>',
  sound:'<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4Z"/><path d="M15.5 8.6a4.6 4.6 0 0 1 0 6.8M18 6a8 8 0 0 1 0 12"/>',
  mute:'<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4Z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  pause:'<rect x="6.5" y="5" width="3.4" height="14" rx="1"/><rect x="14.1" y="5" width="3.4" height="14" rx="1"/>',
  hourglass:'<path d="M6 3.2h12M6 20.8h12M7.5 3.2c0 4.6 4.5 5.8 4.5 8.8s-4.5 4.2-4.5 8.8M16.5 3.2c0 4.6-4.5 5.8-4.5 8.8s4.5 4.2 4.5 8.8"/>',
  emp:'<circle cx="12" cy="12" r="2"/><path d="M12 5.5a6.5 6.5 0 0 1 6.5 6.5M12 5.5A6.5 6.5 0 0 0 5.5 12M12 18.5a6.5 6.5 0 0 1-6.5-6.5M12 18.5a6.5 6.5 0 0 0 6.5-6.5"/>',
  shell:'<path d="M12 2.4c1.9 1.7 2.5 3.4 2.5 5.1V10h-5V7.5c0-1.7.6-3.4 2.5-5.1Z"/><rect x="9.2" y="10" width="5.6" height="9.6" rx="1"/><path d="M9.2 13.4h5.6M9.2 16.4h5.6"/>',
  rifle:'<path d="M3 9.4h15.5l2.5 1.1v2.2h-4l-1 2h-3l-1-2H3z"/><path d="M6 12.7v3M18.5 10.5V8"/>',
  smg:'<path d="M4 9.4h10.5v2.6h-2.5l-1 1.8H7.5l-1-1.8H4z"/><path d="M7.5 12v3.4M12.5 9.4V7.6"/>',
  shotgun:'<path d="M3 9.6h17.5M3 12.4h17.5"/><path d="M3 9.6v2.8M20.5 8.8v4.4"/><path d="M6 12.4v3"/>',
  flak:'<path d="M5 19l8-8"/><path d="M3 17.2l1.8 1.8 1.8-1.8"/><path d="M11 13l2.4 2.4"/><circle cx="17.5" cy="6.5" r="1.1"/><circle cx="20.5" cy="9.5" r="1.1"/><circle cx="14.6" cy="4.2" r="1.1"/>',
  minigun:'<circle cx="8" cy="12" r="4.6"/><circle cx="8" cy="12" r="1.2"/><circle cx="8" cy="8.2" r="0.8"/><circle cx="8" cy="15.8" r="0.8"/><circle cx="4.4" cy="12" r="0.8"/><path d="M12.6 10.4H21M12.6 12H21M12.6 13.6H20"/>',
  missile:'<path d="M12 2.2c2.2 2.3 3 4.9 3 7.6V15H9V9.8c0-2.7.8-5.3 3-7.6Z"/><path d="M9 13l-3 3.6 3-1M15 13l3 3.6-3-1M10.8 19h2.4l-1.2 2.6z"/>',
  rail:'<path d="M3 7.2h18M3 16.8h18"/><path d="M14 5.4l-4.5 6.6h4.5l-4.5 6.6"/>',
  drop:'<path d="M12 3.2s5.6 6.8 5.6 10.6a5.6 5.6 0 0 1-11.2 0C6.4 10 12 3.2 12 3.2Z"/>',
  up:'<path d="M5 13.5l7-7 7 7M5 19l7-7 7 7"/>',
  gun:'<path d="M4 8.6h13l3 1.6v2.6h-5l-1 2.4H9l-1-2.4H4z"/><path d="M7 13.4v3"/>',
  star:'<path d="M12 3l2.5 6.4L21 10l-5 4.4L17.5 21 12 17.4 6.5 21 8 14.4 3 10l6.5-.6L12 3Z"/>',
  coin:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.4"/><path d="M12 9.2v5.6"/>',
  diamond:'<path d="M12 3 4 9.6 12 21l8-11.4L12 3Z"/><path d="M4 9.6h16M9 3.6 7 9.6l5 11.4M15 3.6l2 6 -5 11.4"/>',
  spark:'<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6.5 6.5l3 3M14.5 14.5l3 3M17.5 6.5l-3 3M9.5 14.5l-3 3"/>',
  rotate:'<rect x="8" y="3" width="8" height="18" rx="2"/><circle cx="12" cy="18" r="0.7"/><path d="M18.6 8.6a8 8 0 0 0-7-4.6M18.6 8.6 19 5.9M18.6 8.6 15.9 8.9"/>',
  swap:'<path d="M4 8h12l-3-3M4 8l3 3M20 16H8l3 3M20 16l-3-3"/>',
  expand:'<path d="M4 10V4h6M20 10V4h-6M4 14v6h6M20 14v6h-6"/>',
  compress:'<path d="M10 4v6H4M14 4v6h6M10 20v-6H4M14 20v-6h6"/>',
  alert:'<path d="M12 3 1.8 20.5h20.4L12 3Z"/><path d="M12 9.5v4.8"/><path d="M12 17.4v.7"/>',
  drone:'<circle cx="12" cy="12" r="2.6"/><circle cx="5.5" cy="6.5" r="2"/><circle cx="18.5" cy="6.5" r="2"/><path d="M7 8l3 2.4M17 8l-3 2.4M12 14.6V18M9.5 18.4h5"/>',
  smoke:'<circle cx="8" cy="14" r="4"/><circle cx="14.5" cy="11" r="5"/><circle cx="17" cy="16.5" r="3.4"/>',
  aps:'<path d="M12 3 5 5.8v5.2c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V5.8L12 3Z"/><path d="M8.5 12h7M12 8.5v7"/>',
  team:'<circle cx="8" cy="7" r="2.4"/><circle cx="16" cy="7" r="2.4"/><path d="M3.5 19v-3.4c0-2.2 2-3.8 4.5-3.8s4.5 1.6 4.5 3.8V19M11.5 19v-3.4c0-2.2 2-3.8 4.5-3.8s4.5 1.6 4.5 3.8V19"/>',
  mine:'<ellipse cx="12" cy="14" rx="8" ry="3.4"/><path d="M4 14v1.6c0 1.9 3.6 3.4 8 3.4s8-1.5 8-3.4V14"/><circle cx="12" cy="12.2" r="1.2"/>',
  agl:'<rect x="3" y="9" width="10" height="5" rx="1"/><path d="M13 10.2h7v2.6h-7"/><circle cx="7.5" cy="17" r="2.6"/><path d="M6 9V7h4v2"/>',
  thermo:'<rect x="3" y="8" width="13" height="8" rx="1.2"/><circle cx="7" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><path d="M16 10l5-2v8l-5-2"/>',
  rocket:'<path d="M12 2.5c2.3 1.7 3.4 4.6 3.4 8l-1 5h-4.8l-1-5c0-3.4 1.1-6.3 3.4-8Z"/><path d="M9.6 13.5 6.6 16.5l2.2.2M14.4 13.5l3 3-2.2.2"/><path d="M10.6 18.5h2.8l-1.4 3Z"/><circle cx="12" cy="8.5" r="1"/>',
};
export function svgMarkup(name, sw){
  const g=GLYPH[name]||GLYPH.spark;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+ICON_VB+'" fill="none" stroke="currentColor" stroke-width="'+(sw||1.9)+'" stroke-linecap="round" stroke-linejoin="round">'+g+'</svg>';
}
export function iconEl(name){ const el=new DOMParser().parseFromString(svgMarkup(name),'image/svg+xml').documentElement; el.setAttribute('aria-hidden','true'); return el; }
export function setIcon(el,name){ if(el) el.replaceChildren(iconEl(name)); }
export function initIcons(){ document.querySelectorAll('[data-icon]').forEach(el=>setIcon(el, el.getAttribute('data-icon'))); }
// power-up world badge: recoloured icon on a dark disc (cached per name+colour)
export const _iconTexCache={};
export function svgBadgeTex(name,color){
  const key=name+'|'+color; if(_iconTexCache[key]) return _iconTexCache[key];
  const SZ=128, c=document.createElement('canvas'); c.width=c.height=SZ; const x=c.getContext('2d');
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; _iconTexCache[key]=tex;
  const img=new Image();
  img.onload=()=>{ x.clearRect(0,0,SZ,SZ);
    x.beginPath(); x.arc(SZ/2,SZ/2,SZ*0.45,0,Math.PI*2); x.fillStyle='rgba(8,12,6,0.85)'; x.fill();
    x.lineWidth=7; x.strokeStyle=color; x.stroke();
    const isz=SZ*0.58; x.drawImage(img,(SZ-isz)/2,(SZ-isz)/2,isz,isz); tex.needsUpdate=true; };
  img.src='data:image/svg+xml;base64,'+btoa(svgMarkup(name,2.3).replace('stroke="currentColor"','stroke="'+color+'"'));
  return tex;
}
