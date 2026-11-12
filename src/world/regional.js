// world/regional.js — Z140 REGIONAL ARCHITECTURE: every battlefield builds its strongholds its own way — our Core compound and the enemy forts share the
//   look of the land (adobe in the desert, ice blocks on the tundra, riveted plate at the foundry, concrete T-walls in the city, log palisades in the hills,
//   red brick with tiled gate roofs in the Vietnamese village…) but stay military: thick walls, merlons, wire, stakes. Materials + cap / roof geometry, cached.
import * as THREE from 'three';
import { BIOME, TEX_K, _mergeColored, _xf, detailize, hiResMaps } from '../hub.js';

// pattern · base colour · mortar / seam colour · roughness · metalness · cap on the wall top · roof on gate towers
export const REGION = {
  DESERT:  { pat:'ashlar',   base:'#d2b47c', seam:'#9a7448', rough:0.95, metal:0.0,  cap:'merlon', roof:'cornice',trim:0x8a5a2c },  // Z144 Egyptian sandstone, pylon cornices
  RUINS:   { pat:'concrete', base:'#8e8f8c', seam:'#5e5f5c', rough:0.9,  metal:0.05, cap:'wire',   roof:'flat',  trim:0x4a4c4e },
  TUNDRA:  { pat:'brick',    base:'#a8402e', seam:'#e0d8cc', rough:0.85, metal:0.0,  cap:'swallow',roof:'tent',  trim:0x6f8597 },   // Z144 Kremlin-style red brick, swallowtail merlons, tent roofs
  FOUNDRY: { pat:'plate',    base:'#6a5a50', seam:'#3a2e28', rough:0.5,  metal:0.75, cap:'spike',  roof:'flat',  trim:0x9a4a2a },
  CITADEL: { pat:'ashlar',   base:'#b8805a', seam:'#7a4a30', rough:0.92, metal:0.02, cap:'merlon', roof:'chhatri',trim:0x6a5424 },  // Z144 Rajasthan red sandstone, chhatri pavilions
  MEADOW:  { pat:'log',      base:'#7a5a3a', seam:'#4a3420', rough:0.88, metal:0.0,  cap:'stake',  roof:'cone',  trim:0x4a5a30 },
  CITY:    { pat:'concrete', base:'#a2a4a6', seam:'#6a6c70', rough:0.88, metal:0.05, cap:'wire',   roof:'flat',  trim:0x3a3d40 },
  HILLS:   { pat:'ashlar',   base:'#8a8a80', seam:'#5a5a52', rough:0.92, metal:0.0,  cap:'merlon', roof:'pagoda',trim:0x56603a },   // Z144 Great-Wall grey stone, Chinese tiled roofs
  VILLAGE: { pat:'brick',    base:'#b5643e', seam:'#d8c8a8', rough:0.9,  metal:0.0,  cap:'tile',   roof:'tile',  trim:0x7a3a22 },
  SAVANNA: { pat:'adobe',    base:'#b0704a', seam:'#7a4a2c', rough:0.95, metal:0.0,  cap:'toron',  roof:'pinnacle',trim:0x8a5a34 },  // Z144 Sudano-Sahelian mud: toron beams, pinnacles
  ARCTIC:  { pat:'ice',      base:'#d8ecf6', seam:'#9ab8cc', rough:0.3,  metal:0.05, cap:'snow',   roof:'snow',  trim:0x8aa0b0 },
};
export const regionOf = (name)=>(typeof name==='object' && name) ? name : (REGION[name||BIOME.name]||REGION.CITADEL);
// Z140 every fort of a battlefield is built differently: its own wall material, wall-top, tower roofs and corner towers (square piers or round drums)
const PAT_COL = { adobe:['#b8784e','#7a4a2c'], ashlar:['#a8957a','#6e5e48'], concrete:['#9a9c9e','#64666a'], plate:['#6a5a50','#3a2e28'], ice:['#cfe2ee','#8fb0c6'],
  log:['#6e5034','#43301c'], brick:['#b5643e','#d8c8a8'], laterite:['#a4583a','#5a2e1c'], bamboo:['#9aa04a','#5a6228'] };
export const REGION_ALT = {
  DESERT:{ pats:['ashlar','adobe'], caps:['merlon','merlon'], roofs:['cornice','dome'] },   RUINS:{ pats:['concrete','ashlar'], caps:['merlon','wire'], roofs:['flat','cone'] },
  TUNDRA:{ pats:['brick','ice'], caps:['snow','swallow'], roofs:['tent','onion'] },      FOUNDRY:{ pats:['plate','concrete'], caps:['wire','spike'], roofs:['flat','dome'] },
  CITADEL:{ pats:['ashlar','adobe'], caps:['merlon','merlon'], roofs:['chhatri','onion'] },  MEADOW:{ pats:['ashlar','log'], caps:['stake','merlon'], roofs:['slate','cone'] },
  CITY:{ pats:['concrete','plate'], caps:['spike','wire'], roofs:['flat','dome'] },     HILLS:{ pats:['ashlar','log'], caps:['stake','merlon'], roofs:['pagoda','pagoda'] },
  VILLAGE:{ pats:['brick','laterite','bamboo'], caps:['stake','tile','tile'], roofs:['hue','tile','tile'] },
  SAVANNA:{ pats:['adobe','adobe'], caps:['stake','toron'], roofs:['pinnacle','thatch'] }, ARCTIC:{ pats:['ice','concrete'], caps:['snow','wire'], roofs:['snow','flat'] } };
export function fortStyle(name, i){ const n=name||BIOME.name, st=regionOf(n), A=REGION_ALT[n]||{ pats:[st.pat], caps:[st.cap], roofs:[st.roof] };
  const pat=A.pats[i%A.pats.length], c=PAT_COL[pat]||[st.base,st.seam];
  const base = (pat===st.pat) ? st.base : c[0];
  return Object.assign({}, st, { key:n+'#'+pat+'#'+A.caps[(i+1)%A.caps.length]+'#'+A.roofs[i%A.roofs.length], pat, base, seam:(pat===st.pat)?st.seam:c[1], cap:A.caps[(i+1)%A.caps.length], roof:A.roofs[i%A.roofs.length],
    rough: pat==='ice'?0.35:pat==='plate'?0.5:0.9, metal: pat==='plate'?0.75:0.03, round: i%2===1 }); }

const R=(a,b)=>a+Math.random()*(b-a);
// Z145 one dressed stone: face tone, worn chisel texture, lit top/left arris, shadowed bottom/right arris, chipped corners
function stone(x, px, py, w, h, col, small){ x.fillStyle=col; x.fillRect(px, py, w, h);
  const e=small?1:1.6; x.fillStyle='rgba(255,248,230,0.22)'; x.fillRect(px, py, w, e); x.fillRect(px, py, e, h);
  x.fillStyle='rgba(20,12,6,0.32)'; x.fillRect(px, py+h-e, w, e); x.fillRect(px+w-e, py, e, h);
  if(!small){ for(let n=0;n<10;n++){ x.fillStyle=Math.random()<0.5?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.07)'; x.fillRect(px+R(1,w-4), py+R(1,h-3), R(2,w*0.4), R(0.6,1.4)); }   // tooling marks
    if(Math.random()<0.35){ x.fillStyle='rgba(20,12,6,0.4)'; x.beginPath(); const cx=Math.random()<0.5?px:px+w, cy=Math.random()<0.5?py:py+h; x.arc(cx,cy,R(1.5,4),0,7); x.fill(); } } }   // chipped corner
function paint(st){ const c=document.createElement('canvas'); c.width=c.height=256*TEX_K; const x=c.getContext('2d'); x.scale(TEX_K,TEX_K); x.fillStyle=st.base; x.fillRect(0,0,256,256);   // Z145 painted 4× finer
  const shade=(k)=>{ const v=parseInt(st.base.slice(1),16), r=(v>>16)&255, g=(v>>8)&255, b=v&255; return `rgb(${Math.min(255,r*k)|0},${Math.min(255,g*k)|0},${Math.min(255,b*k)|0})`; };
  if(st.pat==='ashlar' || st.pat==='brick'){ const rowH = st.pat==='brick'?16:32, bw = st.pat==='brick'?42:64, br=st.pat==='brick';
    x.fillStyle=st.seam; x.fillRect(0,0,256,256);                                                                           // Z145 mortar bed everywhere, stones laid into it
    for(let r=0;r<256/rowH;r++){ let px=-(r%2)*bw/2 - R(0,bw*0.3); while(px<256){ const w=br?bw:bw*R(0.7,1.35);              // ashlar: uneven stone lengths, like real coursed masonry
        stone(x, px+1.5, r*rowH+1.5, w-3, rowH-3, shade(R(0.78,1.14)), br); px+=w; } }
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
  else if(st.pat==='ice'){ x.fillStyle=st.seam; x.fillRect(0,0,256,256); for(let r=0;r<4;r++) for(let k=-1;k<4;k++){ const off=(r%2)*42; stone(x, k*86+off-40, r*64+3, 82, 58, shade(R(0.9,1.08)), false); x.fillStyle='rgba(255,255,255,0.35)'; x.fillRect(k*86+off-40, r*64+3, 82, 6); }
    x.strokeStyle='rgba(120,160,190,0.5)'; for(let n=0;n<20;n++){ x.beginPath(); x.moveTo(R(0,256),R(0,256)); x.lineTo(R(0,256),R(0,256)); x.stroke(); } }
  else if(st.pat==='laterite'){ x.fillStyle=st.seam; x.fillRect(0,0,256,256); for(let r=0;r<8;r++){ const off=(r%2)*32; for(let k=-1;k<5;k++) stone(x, k*64+off+2, r*32+2, 60, 28, shade(R(0.85,1.1)), false); }   // đá ong: pitted laterite blocks
    for(let n=0;n<700;n++){ x.fillStyle='rgba(50,22,10,'+R(0.2,0.5).toFixed(2)+')'; x.beginPath(); x.arc(R(0,256),R(0,256),R(0.8,2.4),0,7); x.fill(); } x.fillStyle=st.seam; for(let r=0;r<=8;r++) x.fillRect(0,r*32-1,256,2); }
  else if(st.pat==='bamboo'){ for(let k=0;k<16;k++){ const g=x.createLinearGradient(k*16,0,k*16+16,0); g.addColorStop(0,st.seam); g.addColorStop(0.4,shade(R(1.05,1.25))); g.addColorStop(1,st.seam); x.fillStyle=g; x.fillRect(k*16,0,16,256);   // lũy tre: bamboo culms with nodes
      x.fillStyle='rgba(60,60,20,0.6)'; for(let y=R(10,30);y<256;y+=R(30,44)) x.fillRect(k*16+1,y,14,3); }
    x.fillStyle='rgba(80,110,40,0.5)'; for(let n=0;n<60;n++){ x.beginPath(); x.ellipse(R(0,256),R(0,60),R(6,14),R(2,4),R(0,3),0,7); x.fill(); } }
  else if(st.pat==='log'){ for(let k=0;k<8;k++){ const g=x.createLinearGradient(k*32,0,k*32+32,0); g.addColorStop(0,st.seam); g.addColorStop(0.35,shade(R(1.0,1.2))); g.addColorStop(0.7,shade(R(0.85,1.0))); g.addColorStop(1,st.seam); x.fillStyle=g; x.fillRect(k*32,0,32,256);
      x.strokeStyle='rgba(40,26,14,0.4)'; for(let n=0;n<6;n++){ x.beginPath(); x.moveTo(k*32+R(6,26),R(0,256)); x.lineTo(k*32+R(6,26),R(0,256)); x.stroke(); }
      x.fillStyle='#3a2a18'; x.fillRect(0, 60, 256, 5); x.fillRect(0, 190, 256, 5); } }                                                                  // lashing ropes
  for(let n=0;n<1400;n++){ x.fillStyle='rgba(0,0,0,'+R(0,0.06).toFixed(3)+')'; x.fillRect(R(0,256),R(0,256),1.5,1.5); }
  grain(c, st); return c; }
// Z145 per-pixel grain at the full resolution: every block gets its own surface (tooling marks, pores, sand) instead of a flat fill
function grain(c, st){ const W=c.width, x=c.getContext('2d'), im=x.getImageData(0,0,W,W), d=im.data, amp = st.pat==='ice'?6 : st.pat==='plate'?10 : 18;
  let s=7; const rnd=()=>((s=(s*16807)%2147483647)/2147483647);
  for(let i=0;i<d.length;i+=4){ const v=(rnd()+rnd()-1)*amp; d[i]=Math.max(0,Math.min(255,d[i]+v)); d[i+1]=Math.max(0,Math.min(255,d[i+1]+v)); d[i+2]=Math.max(0,Math.min(255,d[i+2]+v*0.9)); }
  x.putImageData(im,0,0); }
const _lum=(h)=>{ const v=parseInt(h.slice(1),16); return ((v>>16)&255)*0.299+((v>>8)&255)*0.587+(v&255)*0.114; };
const _mat={};
export function wallMat(name){ const st=regionOf(name), k=(typeof name==='object' && name) ? name.key : (name||BIOME.name); if(_mat[k]) return _mat[k];
  const M=hiResMaps(paint(st), { inv:_lum(st.seam)>_lum(st.base), rough:st.rough, nrm:st.pat==='ice'?1.6:st.pat==='plate'?2.0:3.0 });   // Z145 colour + normal + roughness
  const m=new THREE.MeshStandardMaterial({ map:M.map, normalMap:M.normalMap, roughnessMap:M.roughnessMap, roughness:1, metalness:st.metal, envMapIntensity:st.pat==='ice'?1.3:0.6 });
  m.userData.rough=st.rough; detailize(m, { scale:0.37, bump:st.pat==='ice'?0.012:st.pat==='plate'?0.01:0.03, alb:st.pat==='ice'?0.12:0.3, foot:1.6, streak:st.pat==='ice'?0.05:0.26 });
  return (_mat[k]=m); }
// geometry that sits on top of ONE 3 m wall section (instanced along the walls); null = the merlons are enough
const _cap={};
export function capGeo(name, H, TH, L){ const st=regionOf(name), key=st.cap+'|'+H+'|'+TH+'|'+L; if(_cap[key]!==undefined) return _cap[key]; const P=[];
  if(st.cap==='stake'){ for(let k=0;k<5;k++){ const s=new THREE.ConeGeometry(0.22,1.1,6); _xf(s, -L/2+0.3+k*(L-0.6)/4, H+1.35, 0); P.push({geo:s,col:0x7a5a38}); } }
  else if(st.cap==='snow'){ const s=new THREE.BoxGeometry(L*1.02, 0.28, TH*1.1); _xf(s,0,H+0.92,0); P.push({geo:s,col:0xf6fbff}); for(const sx of [-L*0.25,L*0.25]){ const c=new THREE.BoxGeometry(L*0.32,0.2,TH); _xf(c,sx,H+1.0,0); P.push({geo:c,col:0xffffff}); } }
  else if(st.cap==='wire'){ for(let k=0;k<3;k++){ const c=new THREE.TorusGeometry(0.34,0.025,4,10); c.rotateY(Math.PI/2); _xf(c, -L/2+0.5+k*(L-1)/2, H+1.25, 0); P.push({geo:c,col:0x9a9a92}); }
    const post=new THREE.BoxGeometry(0.06,0.9,0.06); _xf(post,0,H+1.15,0); P.push({geo:post,col:0x4a4a44}); }
  else if(st.cap==='swallow'){ for(const sx of [-L*0.25,L*0.25]) for(const q of [-0.28,0.28]){ const m=new THREE.BoxGeometry(0.32,0.9,TH*0.9); m.rotateZ(q*0.9); _xf(m, sx+q, H+1.25, 0); P.push({geo:m,col:0xa8402e}); } }   // Kremlin swallowtail merlons
  else if(st.cap==='toron'){ for(let k=0;k<5;k++) for(const sd of [-1,1]){ const t=new THREE.CylinderGeometry(0.06,0.07,0.9,5); t.rotateX(Math.PI/2); _xf(t, -L/2+0.3+k*(L-0.6)/4, H*(sd>0?0.55:0.85), sd*(TH/2+0.3)); P.push({geo:t,col:0x6a4a2a}); } }   // Djenné toron palm beams
  else if(st.cap==='spike'){ for(let k=0;k<6;k++){ const s=new THREE.ConeGeometry(0.09,0.7,4); _xf(s, -L/2+0.25+k*(L-0.5)/5, H+1.15, 0); P.push({geo:s,col:0x3a3632}); } }
  else if(st.cap==='tile'){ const sh=new THREE.Shape(); sh.moveTo(-TH*0.75,0); sh.lineTo(TH*0.75,0); sh.lineTo(0,0.55); sh.closePath();   // a little tiled coping, like a village wall
    const g=new THREE.ExtrudeGeometry(sh,{depth:L*1.01,bevelEnabled:false}); g.translate(0,0,-L*0.505); g.rotateY(Math.PI/2); _xf(g,0,H+0.82,0); P.push({geo:g,col:0x9e4a2a}); }
  return (_cap[key] = P.length ? _mergeColored(P) : null); }
// roof for a square tower of side s whose top sits at height y (local coords) — merged, vertex-coloured
export function towerRoof(name, s, y){ const st=regionOf(name), P=[];
  if(st.roof==='tile'){ const r=new THREE.ConeGeometry(s*0.95, s*0.7, 4); r.rotateY(Math.PI/4); _xf(r,0,y+s*0.35,0); P.push({geo:r,col:0xa84a2a});   // hip roof (cổng làng)
    const ridge=new THREE.ConeGeometry(0.18, 0.7, 6); _xf(ridge,0,y+s*0.7+0.3,0); P.push({geo:ridge,col:0x7a3a22});
    for(const q of [[1,1],[1,-1],[-1,1],[-1,-1]]){ const c=new THREE.ConeGeometry(0.16,0.5,5); c.rotateZ(q[0]*0.9); _xf(c, q[0]*s*0.62, y+0.12, q[1]*s*0.62); P.push({geo:c,col:0x7a3a22}); } }   // upturned eaves
  else if(st.roof==='tent'){ const c=new THREE.ConeGeometry(s*0.78, s*2.0, 4); c.rotateY(Math.PI/4); _xf(c,0,y+s*1.0,0); P.push({geo:c,col:0x3a6a4a}); const f=new THREE.CylinderGeometry(0.06,0.06,1.2,5); _xf(f,0,y+s*2.0+0.5,0); P.push({geo:f,col:0xd8b040}); }   // Kremlin tent roof
  else if(st.roof==='onion'){ const d=new THREE.CylinderGeometry(s*0.32,s*0.36,s*0.5,10); _xf(d,0,y+s*0.25,0); P.push({geo:d,col:0xe8e0d0}); const o=new THREE.SphereGeometry(s*0.42,12,10); o.scale(1,1.15,1); _xf(o,0,y+s*0.85,0); P.push({geo:o,col:[0x2a8a5a,0xd8a830,0x3a6ac8,0xc83a3a][(Math.random()*4)|0]});
    const t=new THREE.ConeGeometry(s*0.14,s*0.7,8); _xf(t,0,y+s*1.4,0); P.push({geo:t,col:0xd8a830}); }   // onion dome
  else if(st.roof==='pagoda' || st.roof==='hue'){ const cols = st.roof==='hue' ? [0xd8a828,0x3a8a5a] : [0x2a6a4a,0xc8a030];   // two-tier curved tiled roof (Chinese / Huế Ngọ Môn yellow-green glaze)
    for(let k=0;k<2;k++){ const r=new THREE.ConeGeometry(s*(1.0-k*0.3), s*0.42, 4); r.rotateY(Math.PI/4); _xf(r,0,y+0.3+k*s*0.5,0); P.push({geo:r,col:cols[k%2]});
      for(const q of [[1,1],[1,-1],[-1,1],[-1,-1]]){ const c=new THREE.ConeGeometry(0.12,0.55,4); c.rotateZ(q[0]*1.1); c.rotateX(-q[1]*0.4); _xf(c, q[0]*s*(0.72-k*0.22), y+0.3+k*s*0.5, q[1]*s*(0.72-k*0.22)); P.push({geo:c,col:cols[k%2]}); } }   // upturned eaves
    const cp=new THREE.BoxGeometry(s*0.5,s*0.45,s*0.5); _xf(cp,0,y+0.1+s*0.25,0); P.push({geo:cp,col:0xa8302a}); const fn=new THREE.SphereGeometry(0.2,8,6); _xf(fn,0,y+s*1.05,0); P.push({geo:fn,col:0xd8a828}); }
  else if(st.roof==='chhatri'){ for(const q of [[1,1],[1,-1],[-1,1],[-1,-1]]){ const pl=new THREE.CylinderGeometry(0.1,0.1,s*0.6,6); _xf(pl, q[0]*s*0.3, y+s*0.3, q[1]*s*0.3); P.push({geo:pl,col:0xc89a70}); }   // Rajasthani chhatri
    const sl=new THREE.BoxGeometry(s*0.8,0.15,s*0.8); _xf(sl,0,y+s*0.62,0); P.push({geo:sl,col:0xb8805a}); const d=new THREE.SphereGeometry(s*0.38,12,8,0,6.28,0,Math.PI/2); _xf(d,0,y+s*0.68,0); P.push({geo:d,col:0xe8d8c0}); const t=new THREE.ConeGeometry(0.08,0.5,6); _xf(t,0,y+s*1.1,0); P.push({geo:t,col:0xd8a830}); }
  else if(st.roof==='pinnacle'){ const c=new THREE.CylinderGeometry(s*0.12,s*0.42,s*1.4,8); _xf(c,0,y+s*0.7,0); P.push({geo:c,col:0xb0704a}); const e=new THREE.SphereGeometry(s*0.13,8,6); e.scale(1,1.3,1); _xf(e,0,y+s*1.48,0); P.push({geo:e,col:0xf4f0e8});   // mud pinnacle + ostrich egg
    for(let k=0;k<6;k++){ const t=new THREE.CylinderGeometry(0.05,0.05,0.8,4); t.rotateZ(Math.PI/2); t.rotateY(k/6*6.28); _xf(t,0,y+s*(0.35+(k%2)*0.4),0); P.push({geo:t,col:0x6a4a2a}); } }
  else if(st.roof==='cornice'){ const c=new THREE.CylinderGeometry(s*0.82, s*0.66, 0.6, 4); c.rotateY(Math.PI/4); _xf(c,0,y+0.3,0); P.push({geo:c,col:0xd8b884}); const b=new THREE.BoxGeometry(s*1.0,0.14,s*1.0); _xf(b,0,y+0.65,0); P.push({geo:b,col:0xb08a4a}); }   // Z145 ochre-painted band (the blue read as a plastic lid from above)   // Egyptian cavetto cornice
  else if(st.roof==='slate'){ const c=new THREE.ConeGeometry(s*0.82, s*1.5, 12); _xf(c,0,y+s*0.75,0); P.push({geo:c,col:0x4a5a78}); }   // European castle slate spire
  else if(st.roof==='thatch'){ const c=new THREE.ConeGeometry(s*0.9, s*0.95, 10); _xf(c,0,y+s*0.47,0); P.push({geo:c,col:0xc8a460}); const r=new THREE.TorusGeometry(s*0.82,0.08,4,12); r.rotateX(Math.PI/2); _xf(r,0,y+0.12,0); P.push({geo:r,col:0x8a6a3a}); }   // straw thatch
  else if(st.roof==='dome'){ const d=new THREE.SphereGeometry(s*0.55, 12, 8, 0, Math.PI*2, 0, Math.PI/2); _xf(d,0,y,0); P.push({geo:d,col:0xd8b884}); }
  else if(st.roof==='cone'){ const c=new THREE.ConeGeometry(s*0.8, s*0.9, 8); _xf(c,0,y+s*0.45,0); P.push({geo:c,col:st.pat==='log'?0x5a4028:0x7a6248}); }
  else if(st.roof==='snow'){ const c=new THREE.BoxGeometry(s*1.05,0.4,s*1.05); _xf(c,0,y+0.2,0); P.push({geo:c,col:0xf6fbff}); }
  else { const c=new THREE.BoxGeometry(s*1.1,0.3,s*1.1); _xf(c,0,y+0.15,0); P.push({geo:c,col:0x5a5c5e}); }
  return _mergeColored(P); }
export const capMat = detailize(new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.85, metalness:0.1 }), { scale:0.6, bump:0.03, alb:0.28, foot:0, streak:0.18, tiles:1 });   // Z145 roofs and caps weather too; pitched roofs get tile courses
