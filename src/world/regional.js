// world/regional.js — Z140 REGIONAL ARCHITECTURE: every battlefield builds its strongholds its own way — our Core compound and the enemy forts share the
//   look of the land (adobe in the desert, ice blocks on the tundra, riveted plate at the foundry, concrete T-walls in the city, log palisades in the hills,
//   red brick with tiled gate roofs in the Vietnamese village…) but stay military: thick walls, merlons, wire, stakes. Materials + cap / roof geometry, cached.
import * as THREE from 'three';
import { BIOME, _mergeColored, _xf } from '../hub.js';

// pattern · base colour · mortar / seam colour · roughness · metalness · cap on the wall top · roof on gate towers
export const REGION = {
  DESERT:  { pat:'adobe',    base:'#c9a26e', seam:'#9a7448', rough:0.95, metal:0.0,  cap:'merlon', roof:'dome',  trim:0x8a5a2c },
  RUINS:   { pat:'concrete', base:'#8e8f8c', seam:'#5e5f5c', rough:0.9,  metal:0.05, cap:'wire',   roof:'flat',  trim:0x4a4c4e },
  TUNDRA:  { pat:'ice',      base:'#cfe2ee', seam:'#8fb0c6', rough:0.35, metal:0.05, cap:'snow',   roof:'snow',  trim:0x6f8597 },
  FOUNDRY: { pat:'plate',    base:'#6a5a50', seam:'#3a2e28', rough:0.5,  metal:0.75, cap:'spike',  roof:'flat',  trim:0x9a4a2a },
  CITADEL: { pat:'ashlar',   base:'#a8957a', seam:'#6e5e48', rough:0.92, metal:0.02, cap:'merlon', roof:'cone',  trim:0x6a5424 },
  MEADOW:  { pat:'log',      base:'#7a5a3a', seam:'#4a3420', rough:0.88, metal:0.0,  cap:'stake',  roof:'cone',  trim:0x4a5a30 },
  CITY:    { pat:'concrete', base:'#a2a4a6', seam:'#6a6c70', rough:0.88, metal:0.05, cap:'wire',   roof:'flat',  trim:0x3a3d40 },
  HILLS:   { pat:'log',      base:'#6e5034', seam:'#43301c', rough:0.9,  metal:0.0,  cap:'stake',  roof:'cone',  trim:0x56603a },
  VILLAGE: { pat:'brick',    base:'#b5643e', seam:'#d8c8a8', rough:0.9,  metal:0.0,  cap:'tile',   roof:'tile',  trim:0x7a3a22 },
  SAVANNA: { pat:'adobe',    base:'#b0704a', seam:'#7a4a2c', rough:0.95, metal:0.0,  cap:'stake',  roof:'thatch',trim:0x8a5a34 },
  ARCTIC:  { pat:'ice',      base:'#d8ecf6', seam:'#9ab8cc', rough:0.3,  metal:0.05, cap:'snow',   roof:'snow',  trim:0x8aa0b0 },
};
export const regionOf = (name)=>(typeof name==='object' && name) ? name : (REGION[name||BIOME.name]||REGION.CITADEL);
// Z140 every fort of a battlefield is built differently: its own wall material, wall-top, tower roofs and corner towers (square piers or round drums)
const PAT_COL = { adobe:['#c9a26e','#9a7448'], ashlar:['#a8957a','#6e5e48'], concrete:['#9a9c9e','#64666a'], plate:['#6a5a50','#3a2e28'], ice:['#cfe2ee','#8fb0c6'],
  log:['#6e5034','#43301c'], brick:['#b5643e','#d8c8a8'], laterite:['#a4583a','#5a2e1c'], bamboo:['#9aa04a','#5a6228'] };
export const REGION_ALT = {
  DESERT:{ pats:['adobe','ashlar'], caps:['merlon','spike'], roofs:['dome','flat'] },   RUINS:{ pats:['concrete','ashlar'], caps:['wire','merlon'], roofs:['flat','cone'] },
  TUNDRA:{ pats:['ice','concrete'], caps:['snow','wire'], roofs:['snow','cone'] },      FOUNDRY:{ pats:['plate','concrete'], caps:['spike','wire'], roofs:['flat','dome'] },
  CITADEL:{ pats:['ashlar','adobe'], caps:['merlon','spike'], roofs:['cone','dome'] },  MEADOW:{ pats:['log','ashlar'], caps:['stake','merlon'], roofs:['cone','flat'] },
  CITY:{ pats:['concrete','plate'], caps:['wire','spike'], roofs:['flat','dome'] },     HILLS:{ pats:['log','ashlar'], caps:['stake','merlon'], roofs:['cone','flat'] },
  VILLAGE:{ pats:['brick','laterite','bamboo'], caps:['tile','stake','tile'], roofs:['tile','tile','cone'] },
  SAVANNA:{ pats:['adobe','log'], caps:['stake','merlon'], roofs:['thatch','thatch'] }, ARCTIC:{ pats:['ice','concrete'], caps:['snow','wire'], roofs:['snow','flat'] } };
export function fortStyle(name, i){ const n=name||BIOME.name, st=regionOf(n), A=REGION_ALT[n]||{ pats:[st.pat], caps:[st.cap], roofs:[st.roof] };
  const pat=A.pats[i%A.pats.length], c=PAT_COL[pat]||[st.base,st.seam];
  return Object.assign({}, st, { key:n+'#'+pat+'#'+A.caps[(i+1)%A.caps.length]+'#'+A.roofs[i%A.roofs.length], pat, base:c[0], seam:c[1], cap:A.caps[(i+1)%A.caps.length], roof:A.roofs[i%A.roofs.length],
    rough: pat==='ice'?0.35:pat==='plate'?0.5:0.9, metal: pat==='plate'?0.75:0.03, round: i%2===1 }); }

const R=(a,b)=>a+Math.random()*(b-a);
function paint(st){ const c=document.createElement('canvas'); c.width=c.height=256; const x=c.getContext('2d'); x.fillStyle=st.base; x.fillRect(0,0,256,256);
  const shade=(k)=>{ const v=parseInt(st.base.slice(1),16), r=(v>>16)&255, g=(v>>8)&255, b=v&255; return `rgb(${Math.min(255,r*k)|0},${Math.min(255,g*k)|0},${Math.min(255,b*k)|0})`; };
  if(st.pat==='ashlar' || st.pat==='brick'){ const rowH = st.pat==='brick'?16:32, bw = st.pat==='brick'?42:64;
    for(let r=0;r<256/rowH;r++){ const off=(r%2)*bw/2; for(let k=-1;k<256/bw+1;k++){ x.fillStyle=shade(R(0.82,1.12)); x.fillRect(k*bw+off+2, r*rowH+2, bw-4, rowH-4); } }
    x.fillStyle=st.seam; for(let r=0;r<=256/rowH;r++) x.fillRect(0, r*rowH-1, 256, st.pat==='brick'?3:2);
    if(st.pat==='brick') for(let n=0;n<90;n++){ x.fillStyle='rgba(70,96,40,'+R(0.05,0.18).toFixed(2)+')'; x.beginPath(); x.ellipse(R(0,256),R(180,256),R(6,22),R(3,9),0,0,7); x.fill(); } }   // moss low on old village brick
  else if(st.pat==='adobe'){ for(let n=0;n<500;n++){ x.fillStyle=shade(R(0.88,1.08)); x.beginPath(); x.ellipse(R(0,256),R(0,256),R(4,18),R(3,10),R(0,3),0,7); x.fill(); }
    x.strokeStyle=st.seam; x.lineWidth=1.2; for(let n=0;n<14;n++){ let px=R(0,256), py=R(0,256); x.beginPath(); x.moveTo(px,py); for(let s=0;s<6;s++){ px+=R(-14,14); py+=R(4,16); x.lineTo(px,py); } x.stroke(); }
    for(let r=0;r<4;r++) for(let k=0;k<6;k++){ x.fillStyle='rgba(60,40,20,0.5)'; x.beginPath(); x.arc(20+k*44, 40+r*60, 3, 0, 7); x.fill(); } }   // beam ends (vigas)
  else if(st.pat==='concrete'){ for(let k=0;k<4;k++){ x.fillStyle=shade(R(0.9,1.06)); x.fillRect(k*64+2,0,60,256); x.fillStyle=st.seam; x.fillRect(k*64,0,3,256); }
    for(let n=0;n<26;n++){ const g=x.createLinearGradient(0,R(0,200),0,256); g.addColorStop(0,'rgba(40,36,30,0)'); g.addColorStop(1,'rgba(40,36,30,0.18)'); x.fillStyle=g; x.fillRect(R(0,250),0,R(4,14),256); }   // rain streaks
    for(let n=0;n<40;n++){ x.fillStyle='rgba(30,30,30,0.35)'; x.fillRect(R(0,256),R(0,256),2,2); } x.fillStyle='rgba(220,180,40,0.75)'; for(let k=0;k<4;k++) x.fillRect(k*64+8, 214, 48, 10); }   // hazard band
  else if(st.pat==='plate'){ for(let r=0;r<2;r++) for(let k=0;k<2;k++){ x.fillStyle=shade(R(0.85,1.1)); x.fillRect(k*128+3,r*128+3,122,122);
      x.fillStyle='rgba(150,70,30,0.35)'; for(let n=0;n<10;n++){ x.beginPath(); x.ellipse(k*128+R(10,118), r*128+R(10,118), R(4,16), R(2,8), 0, 0, 7); x.fill(); }
      x.fillStyle='#2a221c'; for(let q=0;q<8;q++){ x.beginPath(); x.arc(k*128+10+q*15, r*128+9, 2.6, 0, 7); x.fill(); x.beginPath(); x.arc(k*128+10+q*15, r*128+119, 2.6, 0, 7); x.fill(); } } }   // rivets
  else if(st.pat==='ice'){ for(let r=0;r<4;r++) for(let k=0;k<3;k++){ const off=(r%2)*42; x.fillStyle=shade(R(0.9,1.08)); x.fillRect(k*86+off-40, r*64+3, 82, 58); x.fillStyle='rgba(255,255,255,0.35)'; x.fillRect(k*86+off-40, r*64+3, 82, 6); }
    x.strokeStyle='rgba(120,160,190,0.5)'; for(let n=0;n<20;n++){ x.beginPath(); x.moveTo(R(0,256),R(0,256)); x.lineTo(R(0,256),R(0,256)); x.stroke(); } }
  else if(st.pat==='laterite'){ for(let r=0;r<8;r++){ const off=(r%2)*32; for(let k=-1;k<5;k++){ x.fillStyle=shade(R(0.85,1.1)); x.fillRect(k*64+off+2, r*32+2, 60, 28); } }   // đá ong: pitted laterite blocks
    for(let n=0;n<700;n++){ x.fillStyle='rgba(50,22,10,'+R(0.2,0.5).toFixed(2)+')'; x.beginPath(); x.arc(R(0,256),R(0,256),R(0.8,2.4),0,7); x.fill(); } x.fillStyle=st.seam; for(let r=0;r<=8;r++) x.fillRect(0,r*32-1,256,2); }
  else if(st.pat==='bamboo'){ for(let k=0;k<16;k++){ const g=x.createLinearGradient(k*16,0,k*16+16,0); g.addColorStop(0,st.seam); g.addColorStop(0.4,shade(R(1.05,1.25))); g.addColorStop(1,st.seam); x.fillStyle=g; x.fillRect(k*16,0,16,256);   // lũy tre: bamboo culms with nodes
      x.fillStyle='rgba(60,60,20,0.6)'; for(let y=R(10,30);y<256;y+=R(30,44)) x.fillRect(k*16+1,y,14,3); }
    x.fillStyle='rgba(80,110,40,0.5)'; for(let n=0;n<60;n++){ x.beginPath(); x.ellipse(R(0,256),R(0,60),R(6,14),R(2,4),R(0,3),0,7); x.fill(); } }
  else if(st.pat==='log'){ for(let k=0;k<8;k++){ const g=x.createLinearGradient(k*32,0,k*32+32,0); g.addColorStop(0,st.seam); g.addColorStop(0.35,shade(R(1.0,1.2))); g.addColorStop(0.7,shade(R(0.85,1.0))); g.addColorStop(1,st.seam); x.fillStyle=g; x.fillRect(k*32,0,32,256);
      x.strokeStyle='rgba(40,26,14,0.4)'; for(let n=0;n<6;n++){ x.beginPath(); x.moveTo(k*32+R(6,26),R(0,256)); x.lineTo(k*32+R(6,26),R(0,256)); x.stroke(); }
      x.fillStyle='#3a2a18'; x.fillRect(0, 60, 256, 5); x.fillRect(0, 190, 256, 5); } }                                                                  // lashing ropes
  for(let n=0;n<1400;n++){ x.fillStyle='rgba(0,0,0,'+R(0,0.06).toFixed(3)+')'; x.fillRect(R(0,256),R(0,256),1.5,1.5); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=4; return t; }
const _mat={};
export function wallMat(name){ const st=regionOf(name), k=(typeof name==='object' && name) ? name.key : (name||BIOME.name); if(_mat[k]) return _mat[k];
  return (_mat[k]=new THREE.MeshStandardMaterial({ map:paint(st), roughness:st.rough, metalness:st.metal, envMapIntensity:st.pat==='ice'?1.3:0.6 })); }
// geometry that sits on top of ONE 3 m wall section (instanced along the walls); null = the merlons are enough
const _cap={};
export function capGeo(name, H, TH, L){ const st=regionOf(name), key=st.cap+'|'+H+'|'+TH+'|'+L; if(_cap[key]!==undefined) return _cap[key]; const P=[];
  if(st.cap==='stake'){ for(let k=0;k<5;k++){ const s=new THREE.ConeGeometry(0.22,1.1,6); _xf(s, -L/2+0.3+k*(L-0.6)/4, H+1.35, 0); P.push({geo:s,col:0x7a5a38}); } }
  else if(st.cap==='snow'){ const s=new THREE.BoxGeometry(L*1.02, 0.28, TH*1.1); _xf(s,0,H+0.92,0); P.push({geo:s,col:0xf6fbff}); for(const sx of [-L*0.25,L*0.25]){ const c=new THREE.BoxGeometry(L*0.32,0.2,TH); _xf(c,sx,H+1.0,0); P.push({geo:c,col:0xffffff}); } }
  else if(st.cap==='wire'){ for(let k=0;k<3;k++){ const c=new THREE.TorusGeometry(0.34,0.025,4,10); c.rotateY(Math.PI/2); _xf(c, -L/2+0.5+k*(L-1)/2, H+1.25, 0); P.push({geo:c,col:0x9a9a92}); }
    const post=new THREE.BoxGeometry(0.06,0.9,0.06); _xf(post,0,H+1.15,0); P.push({geo:post,col:0x4a4a44}); }
  else if(st.cap==='spike'){ for(let k=0;k<6;k++){ const s=new THREE.ConeGeometry(0.09,0.7,4); _xf(s, -L/2+0.25+k*(L-0.5)/5, H+1.15, 0); P.push({geo:s,col:0x3a3632}); } }
  else if(st.cap==='tile'){ const sh=new THREE.Shape(); sh.moveTo(-TH*0.75,0); sh.lineTo(TH*0.75,0); sh.lineTo(0,0.55); sh.closePath();   // a little tiled coping, like a village wall
    const g=new THREE.ExtrudeGeometry(sh,{depth:L*1.01,bevelEnabled:false}); g.translate(0,0,-L*0.505); g.rotateY(Math.PI/2); _xf(g,0,H+0.82,0); P.push({geo:g,col:0x9e4a2a}); }
  return (_cap[key] = P.length ? _mergeColored(P) : null); }
// roof for a square tower of side s whose top sits at height y (local coords) — merged, vertex-coloured
export function towerRoof(name, s, y){ const st=regionOf(name), P=[];
  if(st.roof==='tile'){ const r=new THREE.ConeGeometry(s*0.95, s*0.7, 4); r.rotateY(Math.PI/4); _xf(r,0,y+s*0.35,0); P.push({geo:r,col:0xa84a2a});   // hip roof (cổng làng)
    const ridge=new THREE.ConeGeometry(0.18, 0.7, 6); _xf(ridge,0,y+s*0.7+0.3,0); P.push({geo:ridge,col:0x7a3a22});
    for(const q of [[1,1],[1,-1],[-1,1],[-1,-1]]){ const c=new THREE.ConeGeometry(0.16,0.5,5); c.rotateZ(q[0]*0.9); _xf(c, q[0]*s*0.62, y+0.12, q[1]*s*0.62); P.push({geo:c,col:0x7a3a22}); } }   // upturned eaves
  else if(st.roof==='thatch'){ const c=new THREE.ConeGeometry(s*0.9, s*0.95, 10); _xf(c,0,y+s*0.47,0); P.push({geo:c,col:0xc8a460}); const r=new THREE.TorusGeometry(s*0.82,0.08,4,12); r.rotateX(Math.PI/2); _xf(r,0,y+0.12,0); P.push({geo:r,col:0x8a6a3a}); }   // straw thatch
  else if(st.roof==='dome'){ const d=new THREE.SphereGeometry(s*0.55, 12, 8, 0, Math.PI*2, 0, Math.PI/2); _xf(d,0,y,0); P.push({geo:d,col:0xd8b884}); }
  else if(st.roof==='cone'){ const c=new THREE.ConeGeometry(s*0.8, s*0.9, 8); _xf(c,0,y+s*0.45,0); P.push({geo:c,col:st.pat==='log'?0x5a4028:0x7a6248}); }
  else if(st.roof==='snow'){ const c=new THREE.BoxGeometry(s*1.05,0.4,s*1.05); _xf(c,0,y+0.2,0); P.push({geo:c,col:0xf6fbff}); }
  else { const c=new THREE.BoxGeometry(s*1.1,0.3,s*1.1); _xf(c,0,y+0.15,0); P.push({geo:c,col:0x5a5c5e}); }
  return _mergeColored(P); }
export const capMat = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.85, metalness:0.15 });
