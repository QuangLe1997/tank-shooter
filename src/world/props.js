// world/props.js — BATTLEFIELD PROPS (procedural, merged geometry, cached)
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { REALPROP } from '../../config.js';
import { BIOME, MOBILE, detailize, loadRealCover, stoneTriMat, trackCover, batchCover } from '../hub.js';

// ----------------------------- BATTLEFIELD PROPS (procedural, merged geometry, cached) -----------------------------
// rocks (displaced + fractured icosahedra, smooth normals, AO vertex colours) · sandbags · fuel drums · tyre stacks · ammo crates ·
// concrete culvert pipes · concrete blocks · HESCO barriers · Czech hedgehogs · jersey-barrier + concertina-wire perimeter
export const _R=(a,b)=>a+Math.random()*(b-a);
export function _canvasTex(W, H, draw, srgb){ const c=document.createElement('canvas'); c.width=W; c.height=H||W; draw(c.getContext('2d'), W, H||W); const t=new THREE.CanvasTexture(c); if(srgb!==false) t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=4; return t; }
export const PROP_TEX = {};
export function propTex(name){
  if(PROP_TEX[name]) return PROP_TEX[name];
  let t;
  if(name==='burlap') t=_canvasTex(128,128,(x,W)=>{ x.fillStyle='#b9a47a'; x.fillRect(0,0,W,W);                          // woven hessian + grime
      for(let y=0;y<W;y+=3){ x.fillStyle='rgba(80,64,40,'+_R(0.12,0.3).toFixed(2)+')'; x.fillRect(0,y,W,1); }
      for(let xx=0;xx<W;xx+=3){ x.fillStyle='rgba(255,240,210,'+_R(0.05,0.14).toFixed(2)+')'; x.fillRect(xx,0,1,W); }
      for(let i=0;i<30;i++){ x.fillStyle='rgba(70,52,30,'+_R(0.05,0.18).toFixed(2)+')'; x.beginPath(); x.arc(_R(0,W),_R(0,W),_R(4,18),0,7); x.fill(); } });
  else if(name==='concrete') t=_canvasTex(256,256,(x,W)=>{ x.fillStyle='#a19d95'; x.fillRect(0,0,W,W);
      for(let i=0;i<5000;i++){ const v=(_R(120,190))|0; x.fillStyle='rgba('+v+','+v+','+(v-6)+','+_R(0.08,0.3).toFixed(2)+')'; x.fillRect(_R(0,W),_R(0,W),_R(1,3),_R(1,3)); }
      for(let i=0;i<140;i++){ x.fillStyle='rgba(60,58,54,'+_R(0.12,0.3).toFixed(2)+')'; x.beginPath(); x.arc(_R(0,W),_R(0,W),_R(0.5,1.3),0,7); x.fill(); }   // air pores (Z236: fainter — they read as black polka dots on pipes and blocks)
      for(let i=0;i<10;i++){ const sx=_R(0,W), sy=_R(0,W*0.5), len=_R(30,120); const g=x.createLinearGradient(sx,sy,sx,sy+len); g.addColorStop(0,'rgba(60,54,44,0.35)'); g.addColorStop(1,'rgba(60,54,44,0)'); x.fillStyle=g; x.fillRect(sx,sy,_R(3,8),len); }   // rain/rust streaks
      x.strokeStyle='rgba(40,38,36,0.5)'; x.lineWidth=1; for(let i=0;i<6;i++){ let px=_R(0,W), py=_R(0,W); x.beginPath(); x.moveTo(px,py); for(let s=0;s<6;s++){ px+=_R(-14,14); py+=_R(-14,14); x.lineTo(px,py); } x.stroke(); } });
  else if(name==='drum') t=_canvasTex(256,256,(x,W)=>{ x.fillStyle='#d8d8d6'; x.fillRect(0,0,W,W);                     // Z236 painted steel, weathered: soft paint fade, scuffs to bare metal, rust only in small chips and thin runs (was big rust polka dots — a cow-hide look on drums and storage tanks)
      for(let i=0;i<26;i++){ const g=x.createRadialGradient(0,0,0,0,0,1); const cx=_R(0,W), cy=_R(0,W), r=_R(18,60); x.save(); x.translate(cx,cy); x.scale(r,r*_R(0.4,1)); g.addColorStop(0,'rgba(255,255,255,'+_R(0.04,0.1).toFixed(2)+')'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(-1,-1,2,2); x.restore(); }   // sun-faded patches
      for(let i=0;i<60;i++){ x.strokeStyle='rgba(235,235,230,'+_R(0.15,0.35).toFixed(2)+')'; x.lineWidth=_R(0.5,1.5); const sx=_R(0,W), sy=_R(0,W); x.beginPath(); x.moveTo(sx,sy); x.lineTo(sx+_R(-14,14), sy+_R(-3,3)); x.stroke(); }   // scuffs to bright metal
      for(let i=0;i<70;i++){ x.fillStyle='rgba(118,66,34,'+_R(0.18,0.45).toFixed(2)+')'; x.beginPath(); x.ellipse(_R(0,W),_R(0,W),_R(0.8,2.6),_R(0.6,1.8),_R(0,3),0,7); x.fill(); }   // small rust chips
      for(let i=0;i<16;i++){ const sx=_R(0,W), sy=_R(0,W*0.7), len=_R(20,70); const g=x.createLinearGradient(sx,sy,sx,sy+len); g.addColorStop(0,'rgba(110,58,26,0.32)'); g.addColorStop(1,'rgba(110,58,26,0)'); x.fillStyle=g; x.fillRect(sx,sy,_R(1,2.5),len); }   // thin rust runs
      for(let i=0;i<4000;i++){ const v=_R(150,250)|0; x.fillStyle='rgba('+v+','+v+','+v+',0.07)'; x.fillRect(_R(0,W),_R(0,W),1,1); } });
  else if(name==='rubber') t=_canvasTex(128,32,(x,W,H)=>{ x.fillStyle='#262624'; x.fillRect(0,0,W,H); for(let i=0;i<W;i+=8){ x.fillStyle='#111110'; x.fillRect(i,0,4,H); x.fillStyle='#3a3936'; x.fillRect(i+4,H*0.3,2,H*0.4); }
      for(let i=0;i<200;i++){ x.fillStyle='rgba(150,130,100,'+_R(0.05,0.2).toFixed(2)+')'; x.fillRect(_R(0,W),_R(0,H),2,1); } });
  else if(name==='wood') t=_canvasTex(128,128,(x,W)=>{ x.fillStyle='#8a6a40'; x.fillRect(0,0,W,W);
      for(let y=0;y<W;y+=32){ x.fillStyle='rgba(30,20,10,0.7)'; x.fillRect(0,y,W,2); }                                 // plank seams
      for(let i=0;i<120;i++){ x.strokeStyle='rgba(60,40,20,'+_R(0.1,0.35).toFixed(2)+')'; x.lineWidth=1; const y=_R(0,W); x.beginPath(); x.moveTo(0,y); x.bezierCurveTo(W*0.3,y+_R(-3,3),W*0.6,y+_R(-3,3),W,y+_R(-2,2)); x.stroke(); }   // grain
      x.fillStyle='rgba(20,20,20,0.55)'; x.font='bold 18px monospace'; x.fillText('7.62', 40, 70); });
  else if(name==='tin') t=_canvasTex(256,128,(x,W,H)=>{ for(let i=0;i<W;i++){ const v=Math.round(186+46*Math.sin(i/W*Math.PI*2*16)); x.fillStyle='rgb('+v+','+v+','+(v-4)+')'; x.fillRect(i,0,1,H); }   // Z236 corrugated galvanised sheet: ribs in light and shade, rust along the laps, zinc bloom
      for(let i=0;i<22;i++){ const sx=_R(0,W), len=_R(20,90); const g=x.createLinearGradient(sx,0,sx,len); g.addColorStop(0,'rgba(116,62,28,0.45)'); g.addColorStop(1,'rgba(116,62,28,0)'); x.fillStyle=g; x.fillRect(sx,0,_R(1,3),len); }
      for(let i=0;i<30;i++){ const g=x.createRadialGradient(0,0,0,0,0,1), cx=_R(0,W), cy=_R(0,H), r=_R(8,26); x.save(); x.translate(cx,cy); x.scale(r,r*0.6); g.addColorStop(0,'rgba(235,238,236,'+_R(0.08,0.2).toFixed(2)+')'); g.addColorStop(1,'rgba(235,238,236,0)'); x.fillStyle=g; x.fillRect(-1,-1,2,2); x.restore(); }
      x.fillStyle='rgba(90,60,36,0.35)'; x.fillRect(0,H-6,W,6); });
  else if(name==='crate') t=_canvasTex(256,256,(x,W)=>{ x.fillStyle='#dcc8a0'; x.fillRect(0,0,W,W);                     // Z236 rough-sawn pine boards: grain, knots, plank joints, a stencilled lot number
      for(let y=0;y<W;y+=64){ x.fillStyle='rgba(70,50,28,0.55)'; x.fillRect(0,y,W,2); x.fillStyle='rgba(255,245,220,0.25)'; x.fillRect(0,y+2,W,1); }
      for(let i=0;i<220;i++){ x.strokeStyle='rgba(120,86,48,'+_R(0.08,0.28).toFixed(2)+')'; x.lineWidth=_R(0.5,1.4); const y=_R(0,W); x.beginPath(); x.moveTo(0,y); x.bezierCurveTo(W*0.3,y+_R(-4,4),W*0.6,y+_R(-4,4),W,y+_R(-3,3)); x.stroke(); }
      for(let i=0;i<7;i++){ const kx=_R(0,W), ky=_R(0,W); x.fillStyle='rgba(110,70,36,0.55)'; x.beginPath(); x.ellipse(kx,ky,_R(3,6),_R(2,4),0,0,7); x.fill(); x.strokeStyle='rgba(120,80,40,0.3)'; x.beginPath(); x.ellipse(kx,ky,_R(7,11),_R(4,6),0,0,7); x.stroke(); }
      x.fillStyle='rgba(30,30,28,0.6)'; x.font='bold 22px monospace'; x.fillText('7.62×39', 60, 110); x.font='bold 13px monospace'; x.fillText('LOT 17-06  440 RDS', 52, 132); });
  else if(name==='mesh') t=_canvasTex(256,256,(x,W)=>{ x.fillStyle='#bfae88'; x.fillRect(0,0,W,W);                        // HESCO: geotextile behind welded wire mesh · Z236 fine 3-inch grid, faint felt weave, dust and damp stains
      for(let i=0;i<5000;i++){ const v=_R(150,215)|0; x.fillStyle='rgba('+v+','+(v-10)+','+(v-30)+',0.16)'; x.fillRect(_R(0,W),_R(0,W),_R(1,3),1); }
      for(let i=0;i<14;i++){ const sx=_R(0,W), len=_R(40,120); const g=x.createLinearGradient(sx,W,sx,W-len); g.addColorStop(0,'rgba(110,90,60,0.35)'); g.addColorStop(1,'rgba(110,90,60,0)'); x.fillStyle=g; x.fillRect(sx,W-len,_R(10,40),len); }
      x.strokeStyle='rgba(80,80,74,0.85)'; x.lineWidth=1.6; for(let i=0;i<=W;i+=16){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,W); x.moveTo(0,i); x.lineTo(W,i); x.stroke(); }
      x.strokeStyle='rgba(235,235,225,0.35)'; x.lineWidth=0.6; for(let i=1;i<=W;i+=16){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,W); x.moveTo(0,i); x.lineTo(W,i); x.stroke(); } });
  else if(name==='bark') t=_canvasTex(128,128,(x,W)=>{ x.fillStyle='#6a5238'; x.fillRect(0,0,W,W);                      // Z193 rough bark: long fissures + lichen
      for(let i=0;i<70;i++){ x.strokeStyle='rgba(30,22,14,'+_R(0.3,0.7).toFixed(2)+')'; x.lineWidth=_R(1,3); const xx=_R(0,W); x.beginPath(); x.moveTo(xx,0); x.bezierCurveTo(xx+_R(-6,6),W*0.3,xx+_R(-6,6),W*0.7,xx+_R(-4,4),W); x.stroke(); }
      for(let i=0;i<25;i++){ x.fillStyle='rgba(120,130,80,'+_R(0.1,0.3).toFixed(2)+')'; x.beginPath(); x.arc(_R(0,W),_R(0,W),_R(2,7),0,7); x.fill(); } });
  else if(name==='steel' || name==='container') t=_canvasTex(256,256,(x,W)=>{ x.fillStyle='#e2e2de'; x.fillRect(0,0,W,W);                    // Z236 container steel, weathered: faded paint, rust runs hanging from the top rail and seams, small chips, a stencilled code (was dark rust blotches all over)
      for(let i=0;i<20;i++){ const g=x.createRadialGradient(0,0,0,0,0,1), cx=_R(0,W), cy=_R(0,W), r=_R(20,70); x.save(); x.translate(cx,cy); x.scale(r,r*_R(0.4,1)); g.addColorStop(0,'rgba(255,255,250,'+_R(0.05,0.12).toFixed(2)+')'); g.addColorStop(1,'rgba(255,255,250,0)'); x.fillStyle=g; x.fillRect(-1,-1,2,2); x.restore(); }
      for(let i=0;i<34;i++){ const sx=_R(0,W), sy=_R(0,W*0.25), len=_R(30,150); const g=x.createLinearGradient(sx,sy,sx,sy+len); g.addColorStop(0,'rgba(104,54,24,'+_R(0.25,0.45).toFixed(2)+')'); g.addColorStop(1,'rgba(104,54,24,0)'); x.fillStyle=g; x.fillRect(sx,sy,_R(1,3),len); }   // rust runs from the top
      for(let i=0;i<80;i++){ x.fillStyle='rgba(112,60,28,'+_R(0.2,0.5).toFixed(2)+')'; x.beginPath(); x.ellipse(_R(0,W),_R(0,W),_R(0.8,2.4),_R(0.6,1.6),_R(0,3),0,7); x.fill(); }
      if(name==='container'){ x.fillStyle='rgba(250,250,245,0.55)'; x.font='bold 15px monospace'; x.fillText('MSKU 284417 3', 18, 40); x.font='bold 10px monospace'; x.fillText('45G1', 18, 56); }   // a container's stencilled code
      for(let i=0;i<3500;i++){ const v=_R(170,255)|0; x.fillStyle='rgba('+v+','+v+','+v+',0.07)'; x.fillRect(_R(0,W),_R(0,W),1,1); } });
  PROP_TEX[name]=t; return t;
}
// merge helper: list of {geo, color, mat-index ignored} → single geometry with vertex colours (keeps uv)
export function _mergeColored(parts){
  const geos=[]; for(const {geo,col} of parts){ let g=geo.index ? geo.toNonIndexed() : geo; if(g===geo) g=geo.clone();
    if(!g.attributes.uv){ g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2)); }
    for(const k of Object.keys(g.attributes)) if(k!=='position'&&k!=='normal'&&k!=='uv') g.deleteAttribute(k);
    const n=g.attributes.position.count, c=new Float32Array(n*3), cc=new THREE.Color(col); for(let i=0;i<n;i++){ c[i*3]=cc.r; c[i*3+1]=cc.g; c[i*3+2]=cc.b; } g.setAttribute('color', new THREE.BufferAttribute(c,3)); geos.push(g); }
  const m=mergeGeometries(geos, false); geos.forEach(g=>g.dispose()); return m;
}
export const _xf=(geo, x,y,z, rx,ry,rz, sx,sy,sz)=>{ const m=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0)), new THREE.Vector3(sx||1,sy||1,sz||1)); geo.applyMatrix4(m); return geo; };
// ---- rocks ----
export function _n3(x,y,z){ return Math.sin(x*1.7+Math.sin(z*1.3+y))*0.5 + Math.sin(y*2.3+x*0.9)*0.3 + Math.sin(z*3.1+y*1.4+x*0.3)*0.2; }
export function makeRockGeo(detail, flat, topCol, baseCol){
  let g=new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g=mergeVertices(g);
  const p=g.attributes.position, n=p.count, col=new Float32Array(n*3), o=[_R(0,50),_R(0,50),_R(0,50)];
  const cuts=[]; for(let k=0;k<4;k++){ const a=_R(0,6.28), e=_R(-0.3,0.9); cuts.push([Math.cos(a)*Math.cos(e), Math.sin(e), Math.sin(a)*Math.cos(e), _R(0.62,0.82)]); }   // fracture planes → flat cleaved faces
  const tc=new THREE.Color(topCol), bc=new THREE.Color(baseCol), tmp=new THREE.Color();
  for(let i=0;i<n;i++){ let x=p.getX(i), y=p.getY(i), z=p.getZ(i); const L=Math.hypot(x,y,z); x/=L; y/=L; z/=L;
    let d = 1 + 0.2*_n3(x*1.8+o[0],y*1.8+o[1],z*1.8+o[2]) + 0.09*_n3(x*4.6+o[1],y*4.6+o[2],z*4.6+o[0]) + 0.04*_n3(x*10+o[2],y*10,z*10+o[1]);
    let px=x*d, py=y*d, pz=z*d;
    for(const c of cuts){ const dd=px*c[0]+py*c[1]+pz*c[2]; if(dd>c[3]){ const k=dd-c[3]; px-=c[0]*k; py-=c[1]*k; pz-=c[2]*k; } }
    if(py<-0.3) py=-0.3+(py+0.3)*0.15;                                                   // flattened base → sits on the ground
    p.setXYZ(i, px, py*flat, pz*0.88);
    const ao=Math.max(0.45, Math.min(1.1, 0.55+(d-0.8)*1.2)), up=Math.max(0, y-0.35)/0.65;
    tmp.copy(bc).lerp(tc, Math.min(1, up*1.2)).multiplyScalar(ao*(0.9+Math.random()*0.15)); col[i*3]=tmp.r; col[i*3+1]=tmp.g; col[i*3+2]=tmp.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col,3)); g.computeVertexNormals(); return g;
}
export const ROCK_TINT = { DESERT:[0xd6bf94,0xa8865a], RUINS:[0xa8a49c,0x7a766e], TUNDRA:[0xf4f8fc,0x6a7078], FOUNDRY:[0x5a504a,0x2e2a28], CITADEL:[0x9a8466,0x5e4c38], MEADOW:[0x7a9a4a,0x7e7c72], CITY:[0x9a9a98,0x6a6a6a], HILLS:[0x8e9082,0x686a5c], VILLAGE:[0x9a9a86,0x6e6e60], SAVANNA:[0xb08a5a,0x7a5a38], ARCTIC:[0xe8f2fa,0x8aa4b8], STEELMILL:[0x5a4a40,0x2e2622], VOLCANO:[0x34302e,0x141212], QUARRY:[0xf0ece2,0xb0a898], CAVERN:[0x9a9282,0x4a443c] };
export const _rockCache={};
export function rockSet(bn){ if(_rockCache[bn]) return _rockCache[bn]; const t=ROCK_TINT[bn]||ROCK_TINT.DESERT; const set={ small:[], big:[] };
  for(let i=0;i<5;i++) set.small.push(makeRockGeo(2, _R(0.5,0.85), t[0], t[1]));
  for(let i=0;i<4;i++) set.big.push(makeRockGeo(MOBILE?3:4, _R(0.55,0.8), t[0], t[1]));
  set.mat=stoneTriMat(bn==='CITY'?'cracked_concrete':'rock_face', bn);   // Z267 the city's loose stones are broken concrete, not field rock   // Z259 photographed rock face, projected three ways (was the Z145 procedural grain)
  _rockCache[bn]=set; return set; }
// ---- cover pieces: each a single merged mesh with vertex colours (one draw call per block) ----
// Z236 planar box mapping: a merged prop takes its texture from where each face sits on the whole piece (the stencil on a container reads once
//   per wall; its corrugations carry the wall's paint instead of a squashed copy of the whole texture each)
export function boxUV(g, su, sv){ const P=g.attributes.position, N=g.attributes.normal, U=g.attributes.uv;
  for(let i=0;i<P.count;i++){ const ax=Math.abs(N.getX(i)), ay=Math.abs(N.getY(i)), az=Math.abs(N.getZ(i)), x=P.getX(i), y=P.getY(i), z=P.getZ(i);
    if(ax>=ay && ax>=az) U.setXY(i, 0.5+z*su, y*sv); else if(az>=ay) U.setXY(i, 0.5+x*su, y*sv); else U.setXY(i, 0.5+x*su, 0.5+z*su); }
  U.needsUpdate=true; return g; }
export const COVER_GEO = {};
// Z174 real heights: a sandbag breastwork ~1.2 m (was 1.7) · Czech hedgehog ~1.6 m (was 2.0) · drums on a pallet ~1.05 m (was 1.3); crates, tyres, pipes, HESCO, T-wall stacks are already true
export const COVER_REAL_Y = { sandbag:0.7, hedgehog:0.8, drums:0.8 };
export function coverGeo(kind){
  if(COVER_GEO[kind]) return COVER_GEO[kind];
  const P=[]; let g;
  if(kind==='sandbag'){ const tones=[0xc9b48a,0xb8a276,0xa8936a,0xd4c29a,0x9c8a64];                          // 5 courses, alternating bond, slight sag/jitter
    for(let L=0;L<5;L++){ const along=L%2===0, y=0.19+L*0.33;
      for(let a=-1;a<=1;a++) for(let b=0;b<6;b++){ const bag=new RoundedBoxGeometry(0.96,0.34,0.48,1,0.14),   /* Z233 1 bevel segment: 108 tris a bag (was 300) — 90 bags × 300 made every sandbag wall 27k tris, ~2.3M on screen */ u=a*1.0+_R(-0.05,0.05), v=-1.25+b*0.5+_R(-0.03,0.03);
        _xf(bag, along?u:v, y+_R(-0.02,0.02), along?v:u, _R(-0.06,0.06), (along?0:Math.PI/2)+_R(-0.08,0.08), _R(-0.05,0.05), 1, _R(0.9,1.08), 1); P.push({geo:bag, col:tones[(Math.random()*tones.length)|0]}); } }
    g=_mergeColored(P); g.userData.h=1.85; }
  else if(kind==='drums'){ const paints=[0xa83a28,0x55663a,0x3c5a7e,0xc0962a,0x7a7a70,0x9a5228];   // Z236 lighter, sun-faded drum paint
    for(let i=0;i<9;i++){ if(Math.random()<0.12) continue; const cx=(i%3-1)*1.0+_R(-0.08,0.08), cz=((i/3|0)-1)*1.0+_R(-0.08,0.08), col=paints[(Math.random()*paints.length)|0];
      const body=new THREE.CylinderGeometry(0.42,0.42,1.25,16); _xf(body,cx,0.63,cz,_R(-0.04,0.04),_R(0,6),_R(-0.04,0.04)); P.push({geo:body,col});
      for(const ry of [0.32,0.94]){ const rib=new THREE.TorusGeometry(0.425,0.025,4,16); _xf(rib,cx,ry,cz,Math.PI/2); P.push({geo:rib,col:new THREE.Color(col).multiplyScalar(0.7).getHex()}); }
      const lid=new THREE.CylinderGeometry(0.4,0.4,0.03,16); _xf(lid,cx,1.265,cz); P.push({geo:lid,col:0x6a6a62});
      const cap=new THREE.CylinderGeometry(0.06,0.06,0.04,8); _xf(cap,cx+0.22,1.29,cz); P.push({geo:cap,col:0x3a3a36}); }
    g=_mergeColored(P); g.userData.h=1.3; }
  else if(kind==='tires'){ for(const [sx,sz] of [[-0.75,-0.75],[0.75,-0.75],[-0.75,0.75],[0.75,0.75]]){ const n=2+(Math.random()*3|0);
      for(let k=0;k<n;k++){ const t=new THREE.TorusGeometry(0.52,0.22,8,18); _xf(t,sx+_R(-0.06,0.06),0.22+k*0.42,sz+_R(-0.06,0.06),Math.PI/2+_R(-0.08,0.08),0,_R(-0.06,0.06)); P.push({geo:t,col:k%2?0x2a2a28:0x222220}); } }
    g=_mergeColored(P); g.userData.h=1.4; }
  else if(kind==='crates'){ const crate=(w,h,d,x,y,z,ry,col)=>{ P.push({ geo:_xf(new RoundedBoxGeometry(w,h,d,1,0.03),x,y,z,0,ry), col });   // Z236 pine ammo crates: framing battens on every face, steel corner caps, rope handles
      const c=Math.cos(ry), s2=Math.sin(ry), at=(lx,lz)=>[x+lx*c+lz*s2, z-lx*s2+lz*c], B=0x8a6a44, M=0x4a4a44;
      for(const [lx,lz,bw,bd] of [[0,d/2+0.015,w+0.02,0.04],[0,-d/2-0.015,w+0.02,0.04],[w/2+0.015,0,0.04,d+0.02],[-w/2-0.015,0,0.04,d+0.02]]) for(const yy of [y-h/2+0.07,y+h/2-0.07]){ const [px,pz]=at(lx,lz); P.push({ geo:_xf(new THREE.BoxGeometry(bw,0.1,bd),px,yy,pz,0,ry), col:B }); }
      for(const [lx,lz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) for(const yy of [y-h/2+0.05,y+h/2-0.05]){ const [px,pz]=at(lx*(w/2-0.02),lz*(d/2-0.02)); P.push({ geo:_xf(new THREE.BoxGeometry(0.09,0.1,0.09),px,yy,pz,0,ry), col:M }); }
      for(const sd of [-1,1]){ const [px,pz]=at(sd*(w/2+0.04),0); P.push({ geo:_xf(new THREE.TorusGeometry(0.08,0.018,4,8,Math.PI),px,y+0.05,pz,0,ry+Math.PI/2,Math.PI), col:0x6a5a3a }); } };
    const tone=()=>[0xd6b27e,0xc9a26c,0xdcbc8a,0xbf9a66][(Math.random()*4)|0];
    for(const [sx,sz] of [[-0.72,-0.72],[0.72,-0.72],[-0.72,0.72],[0.72,0.72]]) crate(1.32,1.0,1.32,sx,0.5,sz,_R(-0.08,0.08),tone());
    for(let k=0;k<2;k++) crate(1.26,0.9,1.26,k?0.5:-0.6,1.45,_R(-0.5,0.5),_R(-0.4,0.4),tone());
    g=_mergeColored(P); g.userData.h=1.9; }
  else if(kind==='pipes'){ const pipe=(len)=>{ const s=new THREE.Shape(); s.absarc(0,0,0.78,0,Math.PI*2,false); const h=new THREE.Path(); h.absarc(0,0,0.6,0,Math.PI*2,true); s.holes.push(h);
      const gg=new THREE.ExtrudeGeometry(s,{depth:len,bevelEnabled:true,bevelThickness:0.03,bevelSize:0.03,bevelSegments:1,curveSegments:22}); gg.translate(0,0,-len/2); const uv=gg.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*0.35,uv.getY(i)*0.35); return gg; };
    for(const sx of [-0.8,0.8]){ P.push({geo:_xf(pipe(2.9),sx,0.8,0,0,_R(-0.05,0.05)),col:0xb0aca4}); }
    P.push({geo:_xf(pipe(2.6),0,2.12,_R(-0.15,0.15),0,_R(-0.1,0.1)),col:0xa6a29a});
    g=_mergeColored(P); g.userData.h=2.9; }
  else if(kind==='concrete'){ const b=new RoundedBoxGeometry(2.9,2.0,2.9,3,0.16); _xf(b,0,1.0,0); P.push({geo:b,col:0xb4b0a8});
    const cap=new RoundedBoxGeometry(2.4,0.18,2.4,2,0.06); _xf(cap,0,2.08,0); P.push({geo:cap,col:0x9c9890});
    for(const [lx,lz] of [[-0.8,-0.8],[0.8,0.8]]){ const loop=new THREE.TorusGeometry(0.16,0.035,6,12,Math.PI); _xf(loop,lx,2.17,lz,0,Math.PI/4); P.push({geo:loop,col:0x5a4a3a}); }   // rusty lifting loops
    for(let i=0;i<3;i++){ const r=new THREE.CylinderGeometry(0.025,0.025,_R(0.4,0.9),5); _xf(r,_R(-1.3,1.3),2.0+_R(0,0.2),1.45,_R(-0.6,0.6),0,_R(-0.6,0.6)); P.push({geo:r,col:0x6a4a32}); }   // exposed rebar
    g=_mergeColored(P); g.userData.h=2.2; }
  else if(kind==='hesco'){   // Z236 HESCO bastion: geotextile bags inside welded-wire cages — the fabric bulges between the wires, the cage's posts and top rails stand proud,
    //   soil heaped in the top with a few weeds (was four plain boxes that read as a cardboard crate)
    for(const [sx,sz] of [[-0.74,-0.74],[0.74,-0.74],[-0.74,0.74],[0.74,0.74]]){ const ry=_R(-0.03,0.03), h=2.1+_R(-0.05,0.04);
      const b=new THREE.BoxGeometry(1.36,h,1.36,4,6,4), bp=b.attributes.position; for(let i=0;i<bp.count;i++){ const x=bp.getX(i), y=bp.getY(i), z=bp.getZ(i), ex=Math.abs(x)/0.68, ez=Math.abs(z)/0.68, ey=Math.abs(y)/(h/2);
        const bulge=0.05*(1-Math.min(1,Math.max(ex>0.99?ez:ex, ez>0.99?ex:ez)**4))*(1-ey**6); bp.setX(i, x*(1+bulge/0.68*(ex>0.99?1:0))); bp.setZ(i, z*(1+bulge/0.68*(ez>0.99?1:0))); }
      b.computeVertexNormals(); _xf(b,sx,h/2,sz,0,ry); P.push({ geo:b, col:0xd2c09a });
      for(const [px,pz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) P.push({ geo:_xf(new THREE.BoxGeometry(0.04,h+0.04,0.04),sx+px*0.7,h/2,sz+pz*0.7), col:0x6a6a62 });   // cage corner posts
      for(const [a,b2] of [[0,1],[1,0]]) for(const o of [-1,1]) P.push({ geo:_xf(new THREE.BoxGeometry(a?1.42:0.03,0.03,b2?1.42:0.03),sx+(b2?o*0.7:0),h+0.01,sz+(a?o*0.7:0)), col:0x6a6a62 });   // top rails
      const soil=new THREE.SphereGeometry(0.72,10,5,0,Math.PI*2,0,Math.PI/2); _xf(soil,sx,h-0.06,sz,0,_R(0,6),0,0.95,0.16,0.95); P.push({ geo:soil, col:0x8a7454 });   // soil mounded in the top
      if(Math.random()<0.6){ const w=new THREE.ConeGeometry(0.1,0.28,4); _xf(w,sx+_R(-0.4,0.4),h+0.12,sz+_R(-0.4,0.4)); P.push({ geo:w, col:0x6a7a3a }); } }
    g=_mergeColored(P); boxUV(g, 0.7, 0.7); g.userData.h=2.1; }
  else if(kind==='hedgehog'){ const beam=()=>{ const s=new THREE.Shape(); s.moveTo(-0.14,-0.14); s.lineTo(0.14,-0.14); s.lineTo(0.14,-0.1); s.lineTo(0.02,-0.1); s.lineTo(0.02,0.1); s.lineTo(0.14,0.1); s.lineTo(0.14,0.14); s.lineTo(-0.14,0.14); s.lineTo(-0.14,0.1); s.lineTo(-0.02,0.1); s.lineTo(-0.02,-0.1); s.lineTo(-0.14,-0.1); s.closePath();
      const gg=new THREE.ExtrudeGeometry(s,{depth:2.6,bevelEnabled:false}); gg.translate(0,0,-1.3); return gg; };   // I-beam section
    const ax=[[Math.PI/4,0,0],[0,0,Math.PI/4],[0.62,Math.PI/2,0.62]];
    for(const [rx,ry,rz] of ax){ const b=beam(); _xf(b,0,0.95,0,rx,ry,rz,1.25,1.25,1); P.push({geo:b,col:0x6a5e56}); }   // Z236 heavier I-beams, weathered steel going to rust (was a thin dark-brown cross that read as wood)
    for(const [rx,ry,rz] of ax){ const pl=new THREE.BoxGeometry(0.42,0.42,0.03); _xf(pl,0,0.95,0,rx,ry,rz); P.push({geo:pl,col:0x5a4a3e}); }   // the gusset plates where they cross
    g=_mergeColored(P); g.userData.h=1.9; }
  else if(kind==='jersey'){ const prof=new THREE.Shape(); prof.moveTo(-0.4,0); prof.lineTo(0.4,0); prof.lineTo(0.4,0.08); prof.lineTo(0.2,0.33); prof.lineTo(0.12,1.05); prof.lineTo(-0.12,1.05); prof.lineTo(-0.2,0.33); prof.lineTo(-0.4,0.08); prof.closePath();   // Z193 New-Jersey barrier section
    const sec=(L)=>{ const gg=new THREE.ExtrudeGeometry(prof,{ depth:L, bevelEnabled:true, bevelThickness:0.025, bevelSize:0.02, bevelSegments:1 }); gg.translate(0,0,-L/2); const uv=gg.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*0.4,uv.getY(i)*0.4); return gg; };
    for(const [sx,o] of [[-0.55,-0.36],[0.55,0.36]]) for(const k of [-1,1]){ P.push({ geo:_xf(sec(1.42), sx+_R(-0.04,0.04), 0, k*0.74+o, 0, _R(-0.06,0.06), 0), col:[0xb6b2aa,0xaaa69e,0xbfbab0][(Math.random()*3)|0] }); }
    for(let i=0;i<4;i++){ const st=new THREE.BoxGeometry(0.9,0.05,0.12); _xf(st,(i<2?-0.55:0.55),0.55+_R(-0.1,0.25),_R(-1.2,1.2),0,Math.PI/2,0); P.push({ geo:st, col:i%2?0xc8a020:0x2a2a28 }); }   // hazard stripes
    g=_mergeColored(P); g.userData.h=1.05; }
  else if(kind==='teeth'){ for(const [sx,sz] of [[-0.75,-0.75],[0.75,-0.75],[-0.75,0.75],[0.75,0.75]]){ const h=_R(1.2,1.45), t=new THREE.CylinderGeometry(0.2,0.68,h,4,1); _xf(t,sx+_R(-0.08,0.08),h/2,sz+_R(-0.08,0.08),_R(-0.05,0.05),Math.PI/4+_R(-0.2,0.2),_R(-0.05,0.05));   // Z193 dragon's teeth: cast pyramids
      P.push({ geo:t, col:[0xaaa69a,0x9e9a8c,0xb4b0a4][(Math.random()*3)|0] }); const ft=new THREE.BoxGeometry(1.25,0.16,1.25); _xf(ft,sx,0.06,sz,0,Math.PI/4+_R(-0.2,0.2),0); P.push({ geo:ft, col:0x8a8678 }); }
    g=_mergeColored(P); g.userData.h=1.4; }
  else if(kind==='logs'){ const L=[[-0.57,0.28],[0,0.28],[0.57,0.28],[-0.29,0.76],[0.29,0.76],[0,1.22]];   // Z193 felled-timber barricade, 3-2-1, pinned by stakes
    for(const [lx,ly] of L){ const r=_R(0.25,0.3), lg=new THREE.CylinderGeometry(r,r*1.06,_R(2.7,3.0),12); _xf(lg,lx,ly,_R(-0.1,0.1),Math.PI/2,0,_R(-0.04,0.04)); P.push({ geo:lg, col:[0x8a6c4a,0x7a5e3e,0x96785a][(Math.random()*3)|0] }); }
    for(const [sx,sz] of [[-1.0,-1.25],[1.0,-1.25],[-1.0,1.25],[1.0,1.25]]){ const s=new THREE.CylinderGeometry(0.08,0.1,1.3,6); _xf(s,sx,0.6,sz,0,0,sx*-0.15); P.push({ geo:s, col:0x5a4430 }); }
    g=_mergeColored(P); g.userData.h=1.5; }
  else if(kind==='wreck'){   // Z236 a burnt-out car that reads as one: wheel arches cut into the body, an open cabin (pillars, a sagging roof, charred seats seen through the empty windows),
    //   bare rusted rims sitting low, a sprung bonnet, a hanging bumper, empty lamp sockets; rust brown below, charred black above, one door still showing its old paint
    const ex=(shape, w)=>{ const gg=new THREE.ExtrudeGeometry(shape,{ depth:w, bevelEnabled:true, bevelThickness:0.05, bevelSize:0.05, bevelSegments:2, curveSegments:8 }); gg.translate(0,0,-w/2); gg.rotateY(-Math.PI/2); const uv=gg.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*0.3,uv.getY(i)*0.3); return gg; };
    const body=new THREE.Shape(); body.moveTo(-1.74,0.3); body.lineTo(-1.36,0.3); body.absarc(-0.95,0.32,0.4,Math.PI,0,true); body.lineTo(0.55,0.3); body.absarc(0.95,0.32,0.4,Math.PI,0,true);
    body.lineTo(1.74,0.3); body.lineTo(1.8,0.56); body.lineTo(1.72,0.76); body.lineTo(1.0,0.9); body.lineTo(-1.4,0.96); body.lineTo(-1.76,0.84); body.closePath();
    P.push({ geo:ex(body,1.6), col:0x9a6a46 });                                                                         // rusted shell
    const RU=0x5a4434, CH=0x3a332e;
    // the cabin: four pillars a side, a sagging roof, sills — the glass is gone, you can see in
    const pil=(x0,y0,x1,y1,z)=>{ const L=Math.hypot(x1-x0,y1-y0), b=new THREE.BoxGeometry(0.09,L,0.08); _xf(b,(x0+x1)/2,(y0+y1)/2,z,0,0,Math.atan2(-(x1-x0),y1-y0)); P.push({ geo:b, col:CH }); };
    for(const z of [-0.7,0.7]){ pil(0.95,0.9,0.45,1.4,z); pil(-0.25,0.94,-0.25,1.42,z); pil(-0.95,0.95,-1.32,1.0,z); pil(-0.95,0.95,-0.95,1.42,z); }
    { const roof=new THREE.BoxGeometry(1.42,0.06,1.46); _xf(roof,-0.25,1.42,0,0,0,0.03); const p=roof.attributes.position; for(let i=0;i<p.count;i++){ const rx=p.getX(i)+0.25, rz=p.getZ(i); p.setY(i, p.getY(i)-0.09*(1-(rx/0.71)**2)*(1-(rz/0.73)**2)); } P.push({ geo:roof, col:CH }); }   // sagging where the fire softened it
    for(const z of [-0.74,0.74]) P.push({ geo:_xf(new THREE.BoxGeometry(2.0,0.05,0.07),-0.2,0.93,z), col:RU });       // window sills
    P.push({ geo:_xf(new THREE.BoxGeometry(2.1,0.05,1.4),-0.25,0.62,0), col:0x1c1916 });                                 // the burnt floor pan
    for(const [sx,sz] of [[0.2,-0.35],[0.2,0.35],[-0.75,0]]){ P.push({ geo:_xf(new THREE.BoxGeometry(0.42,0.12,sz?0.5:1.2),sx,0.72,sz), col:0x221e1b }); P.push({ geo:_xf(new THREE.BoxGeometry(0.1,0.42,sz?0.48:1.18),sx-0.2,0.92,sz,0,0,-0.2), col:0x221e1b }); }   // seat frames
    P.push({ geo:_xf(new THREE.TorusGeometry(0.15,0.025,5,12),0.42,1.0,0.35,0,Math.PI/2,0), col:0x1a1816 });              // steering wheel rim
    // the doors on one side still carry the old paint under the soot
    P.push({ geo:_xf(new THREE.BoxGeometry(1.25,0.42,0.02),-0.25,0.66,0.81), col:[0x8a7a5a,0x6a7a86,0x8a5a4a][(Math.random()*3)|0] });
    // sprung bonnet, hanging bumper, empty lamp sockets, a tail light
    P.push({ geo:_xf(new THREE.BoxGeometry(0.78,0.04,1.4),1.38,0.88,0,0,0,0.18), col:CH });
    P.push({ geo:_xf(new THREE.BoxGeometry(0.12,0.16,1.6),1.82,0.36,0.08,0.22,0,0), col:0x4a3c32 });
    for(const z of [-0.55,0.55]){ P.push({ geo:_xf(new THREE.CylinderGeometry(0.09,0.09,0.05,10),1.79,0.62,z,0,0,Math.PI/2), col:0x0e0d0c }); P.push({ geo:_xf(new THREE.BoxGeometry(0.04,0.1,0.22),-1.77,0.74,z), col:0x5a1e16 }); }
    // bare rims sitting low (tyres burnt away), one flattened tyre left
    for(const [wx,wz] of [[-0.95,0.7],[0.95,0.7],[-0.95,-0.7],[0.95,-0.7]]){ const k=wx<0&&wz<0; const r=new THREE.CylinderGeometry(0.27,0.27,0.18,14); _xf(r,wx,0.27,wz,0,0,Math.PI/2); P.push({ geo:r, col:0x5a3e2c });
      P.push({ geo:_xf(new THREE.CylinderGeometry(0.1,0.1,0.2,8),wx,0.27,wz,0,0,Math.PI/2), col:0x2a2420 });
      if(k){ const t=new THREE.TorusGeometry(0.3,0.09,6,16); _xf(t,wx,0.22,wz*1.02,0,Math.PI/2,0,1,0.72,1); P.push({ geo:t, col:0x161514 }); } }
    g=_mergeColored(P); g.rotateZ(0.04); g.translate(0,-0.04,0); g.userData.h=1.45; }
  else if(kind==='container'){ const Lh=2.35, Wh=0.98, H=2.0;   // Z193 ISO shipping container (×COVER_K → 6.1 × 2.55 × 2.6 m): corrugated walls, corner posts, door bars
    P.push({ geo:_xf(new THREE.BoxGeometry(Wh*2-0.06,H-0.12,Lh*2-0.06),0,H/2,0), col:0xf0f0f0 });
    for(let z=-Lh+0.2;z<Lh-0.1;z+=0.27) for(const sx of [-1,1]){ const rb=new THREE.BoxGeometry(0.05,H-0.22,0.13); _xf(rb,sx*(Wh-0.01),H/2,z); P.push({ geo:rb, col:0xd8d8d8 }); }
    for(let x=-Wh+0.2;x<Wh-0.1;x+=0.27){ const rb=new THREE.BoxGeometry(0.13,H-0.22,0.05); _xf(rb,x,H/2,-(Lh-0.01)); P.push({ geo:rb, col:0xd8d8d8 }); }
    for(const [cx,cz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ P.push({ geo:_xf(new THREE.BoxGeometry(0.16,H,0.16),cx*(Wh-0.06),H/2,cz*(Lh-0.06)), col:0x8a8a86 }); }
    for(const y of [0.06,H-0.06]) for(const sx of [-1,1]) P.push({ geo:_xf(new THREE.BoxGeometry(0.14,0.12,Lh*2),sx*(Wh-0.05),y,0), col:0x8a8a86 });
    for(const x of [-0.6,-0.2,0.2,0.6]){ P.push({ geo:_xf(new THREE.CylinderGeometry(0.03,0.03,H-0.3,6),x,H/2,Lh+0.03), col:0x6a6a66 }); }   // door locking bars
    P.push({ geo:_xf(new THREE.BoxGeometry(0.03,H-0.2,0.02),0,H/2,Lh+0.01), col:0x3a3a38 });
    for(const z of [-1,1]) for(const y of [0.5,1.5]) P.push({ geo:_xf(new THREE.BoxGeometry(0.06,0.14,0.05),z*0.85,y,Lh+0.02), col:0x5a5a56 });   // Z236 door hinges + cam keepers
    g=_mergeColored(P); boxUV(g, 1/(Lh*2), 1/H); g.userData.h=H; }
  { const ky=COVER_REAL_Y[kind]; if(ky && ky!==1) g.scale(1,ky,1); }   // Z174 real heights
  COVER_GEO[kind]=g; return g;
}
export const COVER_MAT = {};
export function coverMat(kind){
  if(COVER_MAT[kind]) return COVER_MAT[kind];
  const M=(o)=>detailize(new THREE.MeshStandardMaterial(Object.assign({ vertexColors:true, roughness:0.9, metalness:0.05, envMapIntensity:0.6 }, o)), { scale:0.9, bump:0.01, alb:0.28, foot:0.5, streak:0.15 });
  const m = kind==='sandbag' ? M({ map:propTex('burlap'), roughness:0.97 })
    : kind==='drums' ? M({ map:propTex('drum'), roughness:0.6, metalness:0.2 })   /* Z236 painted steel is a dielectric surface: high metalness turned every painted prop near-black under the sky light */
    : kind==='tires' ? M({ map:propTex('rubber'), roughness:0.95 })
    : kind==='crates' ? M({ map:propTex('crate'), roughness:0.85 })
    : kind==='hesco' ? M({ map:propTex('mesh'), roughness:0.9 })
    : kind==='hedgehog' ? M({ roughness:0.7, metalness:0.45, map:propTex('steel') })
    : kind==='logs' ? M({ map:propTex('bark'), roughness:0.95 })
    : kind==='wreck' ? M({ map:propTex('drum'), roughness:0.88, metalness:0.08 })
    : kind==='container' ? M({ map:propTex('container'), roughness:0.62, metalness:0.12 })
    : M({ map:propTex('concrete'), roughness:0.92 });
  COVER_MAT[kind]=m; return m;
}
// which real-world pieces each battlefield uses: [destructible kinds] + [solid kinds]
export const COVER_SET = {   // Z193 + jersey barriers · dragon's teeth (solid) · timber barricades (breakable) · Z431 no concrete pipes, no log piles: they read fake
  DESERT: [['sandbag','sandbag','drums','crates'], ['hesco','concrete','jersey','teeth']],
  RUINS:  [['sandbag','tires','drums','crates'],   ['concrete','jersey','teeth']],
  TUNDRA: [['sandbag','crates','drums'],    ['concrete','hesco','teeth']],
  FOUNDRY:[['drums','tires','drums','crates'],     ['concrete','jersey']],
  CITADEL:[['sandbag','sandbag','tires','drums'],  ['concrete','hesco','teeth']],
  MEADOW: [['sandbag','crates','tires'],    ['hesco','concrete','teeth']],
  CITY:   [['sandbag','crates','tires','drums'],   ['concrete','jersey','hesco','jersey']],
  HILLS:  [['sandbag','crates'],     ['hesco','concrete','teeth']],
  VILLAGE:[['sandbag','crates','tires'],    ['hesco','jersey']],
  SAVANNA:[['sandbag','sandbag','drums'],   ['hesco','concrete','teeth']],
  ARCTIC: [['sandbag','crates'],            ['concrete','hesco','teeth']],
  STEELMILL:[['drums','tires','crates','drums'],   ['concrete','jersey']],
  VOLCANO:[['sandbag','drums','crates'],          ['concrete','hesco','teeth']],
  QUARRY: [['crates','sandbag','drums'],          ['concrete','jersey','teeth']],
  CAVERN: [['crates','sandbag','drums'],    ['concrete','hesco']],
};
// Z193 lone big pieces per battlefield: shipping containers (some stacked two high) + burnt-out car wrecks
export const LONE_SET = { DESERT:[3,4], RUINS:[3,5], TUNDRA:[2,2], FOUNDRY:[6,3], CITADEL:[2,3], MEADOW:[1,3], CITY:[6,6], HILLS:[1,2], VILLAGE:[2,4], SAVANNA:[2,3], ARCTIC:[2,2], STEELMILL:[7,3], VOLCANO:[2,2], QUARRY:[6,3], CAVERN:[3,1] };
export const CONTAINER_PAINT = [0xae4632,0x41698c,0x5b7a52,0xc8923a,0x8e8e86,0x96603c,0xd8d3c6];   // Z236 sun-faded paint (the deep navy / green read as black boxes)
export function makeCoverMesh(kind, destructible){
  const mat = destructible ? coverMat(kind).clone() : coverMat(kind); if(destructible) mat.userData.own=true;     // destructible pieces flash on hit → own material
  if(destructible && REALPROP.cast.kinds.includes(kind)) mat.color.setHex(REALPROP.cast.tint[BIOME.name] ?? REALPROP.cast.tint._);   // Z420 the land's tone on cast concrete (kept when the real piece swaps in)
  const m=new THREE.Mesh(coverGeo(kind), mat); m.castShadow=true; m.receiveShadow=true; m.userData.kind=kind;
  trackCover(m); batchCover(m); loadRealCover();   // Z252 the Meshy piece takes its place once loaded
  return m;
}
