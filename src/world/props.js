// world/props.js — BATTLEFIELD PROPS (procedural, merged geometry, cached)
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MOBILE, detailize } from '../hub.js';

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
      for(let i=0;i<220;i++){ x.fillStyle='rgba(40,38,36,'+_R(0.3,0.6).toFixed(2)+')'; x.beginPath(); x.arc(_R(0,W),_R(0,W),_R(0.6,1.8),0,7); x.fill(); }   // air pores
      for(let i=0;i<10;i++){ const sx=_R(0,W), sy=_R(0,W*0.5), len=_R(30,120); const g=x.createLinearGradient(sx,sy,sx,sy+len); g.addColorStop(0,'rgba(60,54,44,0.35)'); g.addColorStop(1,'rgba(60,54,44,0)'); x.fillStyle=g; x.fillRect(sx,sy,_R(3,8),len); }   // rain/rust streaks
      x.strokeStyle='rgba(40,38,36,0.5)'; x.lineWidth=1; for(let i=0;i<6;i++){ let px=_R(0,W), py=_R(0,W); x.beginPath(); x.moveTo(px,py); for(let s=0;s<6;s++){ px+=_R(-14,14); py+=_R(-14,14); x.lineTo(px,py); } x.stroke(); } });
  else if(name==='drum') t=_canvasTex(128,128,(x,W)=>{ x.fillStyle='#d8d8d8'; x.fillRect(0,0,W,W);                     // painted steel drum: worn paint, rust bloom, drips (tinted by vertex colour)
      for(let i=0;i<40;i++){ x.fillStyle='rgba(120,64,30,'+_R(0.2,0.6).toFixed(2)+')'; x.beginPath(); x.ellipse(_R(0,W),_R(0,W),_R(2,9),_R(2,6),_R(0,3),0,7); x.fill(); }
      for(let i=0;i<14;i++){ const sx=_R(0,W), sy=_R(0,W*0.6), len=_R(15,50); const g=x.createLinearGradient(sx,sy,sx,sy+len); g.addColorStop(0,'rgba(110,56,24,0.6)'); g.addColorStop(1,'rgba(110,56,24,0)'); x.fillStyle=g; x.fillRect(sx,sy,2,len); }
      for(let i=0;i<1500;i++){ const v=_R(150,250)|0; x.fillStyle='rgba('+v+','+v+','+v+',0.12)'; x.fillRect(_R(0,W),_R(0,W),1,1); } });
  else if(name==='rubber') t=_canvasTex(128,32,(x,W,H)=>{ x.fillStyle='#262624'; x.fillRect(0,0,W,H); for(let i=0;i<W;i+=8){ x.fillStyle='#111110'; x.fillRect(i,0,4,H); x.fillStyle='#3a3936'; x.fillRect(i+4,H*0.3,2,H*0.4); }
      for(let i=0;i<200;i++){ x.fillStyle='rgba(150,130,100,'+_R(0.05,0.2).toFixed(2)+')'; x.fillRect(_R(0,W),_R(0,H),2,1); } });
  else if(name==='wood') t=_canvasTex(128,128,(x,W)=>{ x.fillStyle='#8a6a40'; x.fillRect(0,0,W,W);
      for(let y=0;y<W;y+=32){ x.fillStyle='rgba(30,20,10,0.7)'; x.fillRect(0,y,W,2); }                                 // plank seams
      for(let i=0;i<120;i++){ x.strokeStyle='rgba(60,40,20,'+_R(0.1,0.35).toFixed(2)+')'; x.lineWidth=1; const y=_R(0,W); x.beginPath(); x.moveTo(0,y); x.bezierCurveTo(W*0.3,y+_R(-3,3),W*0.6,y+_R(-3,3),W,y+_R(-2,2)); x.stroke(); }   // grain
      x.fillStyle='rgba(20,20,20,0.55)'; x.font='bold 18px monospace'; x.fillText('7.62', 40, 70); });
  else if(name==='mesh') t=_canvasTex(64,64,(x,W)=>{ x.fillStyle='#a8916a'; x.fillRect(0,0,W,W);                        // HESCO: sand behind welded wire mesh
      for(let i=0;i<400;i++){ x.fillStyle='rgba(90,72,44,'+_R(0.1,0.3).toFixed(2)+')'; x.fillRect(_R(0,W),_R(0,W),2,2); }
      x.strokeStyle='#5a5a52'; x.lineWidth=2; for(let i=0;i<=W;i+=16){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,W); x.moveTo(0,i); x.lineTo(W,i); x.stroke(); } });
  else if(name==='bark') t=_canvasTex(128,128,(x,W)=>{ x.fillStyle='#6a5238'; x.fillRect(0,0,W,W);                      // Z193 rough bark: long fissures + lichen
      for(let i=0;i<70;i++){ x.strokeStyle='rgba(30,22,14,'+_R(0.3,0.7).toFixed(2)+')'; x.lineWidth=_R(1,3); const xx=_R(0,W); x.beginPath(); x.moveTo(xx,0); x.bezierCurveTo(xx+_R(-6,6),W*0.3,xx+_R(-6,6),W*0.7,xx+_R(-4,4),W); x.stroke(); }
      for(let i=0;i<25;i++){ x.fillStyle='rgba(120,130,80,'+_R(0.1,0.3).toFixed(2)+')'; x.beginPath(); x.arc(_R(0,W),_R(0,W),_R(2,7),0,7); x.fill(); } });
  else if(name==='steel') t=_canvasTex(128,128,(x,W)=>{ x.fillStyle='#e0e0dc'; x.fillRect(0,0,W,W);                    // Z193 painted container steel: chipped paint, rust runs, dents (tinted per box)
      for(let i=0;i<60;i++){ x.fillStyle='rgba(110,58,26,'+_R(0.25,0.7).toFixed(2)+')'; x.beginPath(); x.ellipse(_R(0,W),_R(0,W),_R(1,6),_R(1,4),_R(0,3),0,7); x.fill(); }
      for(let i=0;i<22;i++){ const sx=_R(0,W), sy=_R(0,W*0.5), len=_R(20,70); const g=x.createLinearGradient(sx,sy,sx,sy+len); g.addColorStop(0,'rgba(100,52,22,0.55)'); g.addColorStop(1,'rgba(100,52,22,0)'); x.fillStyle=g; x.fillRect(sx,sy,_R(1,3),len); }
      for(let i=0;i<1200;i++){ const v=_R(170,255)|0; x.fillStyle='rgba('+v+','+v+','+v+',0.1)'; x.fillRect(_R(0,W),_R(0,W),1,1); } });
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
  set.mat=detailize(new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.93, metalness:0.02, envMapIntensity:0.5 }), { scale:0.7, bump:0.03, alb:0.35, foot:0.5, streak:0.1 });   // Z145 rock grain
  _rockCache[bn]=set; return set; }
// ---- cover pieces: each a single merged mesh with vertex colours (one draw call per block) ----
export const COVER_GEO = {};
// Z174 real heights: a sandbag breastwork ~1.2 m (was 1.7) · Czech hedgehog ~1.6 m (was 2.0) · drums on a pallet ~1.05 m (was 1.3); crates, tyres, pipes, HESCO, T-wall stacks are already true
export const COVER_REAL_Y = { sandbag:0.7, hedgehog:0.8, drums:0.8 };
export function coverGeo(kind){
  if(COVER_GEO[kind]) return COVER_GEO[kind];
  const P=[]; let g;
  if(kind==='sandbag'){ const tones=[0xc9b48a,0xb8a276,0xa8936a,0xd4c29a,0x9c8a64];                          // 5 courses, alternating bond, slight sag/jitter
    for(let L=0;L<5;L++){ const along=L%2===0, y=0.19+L*0.33;
      for(let a=-1;a<=1;a++) for(let b=0;b<6;b++){ const bag=new RoundedBoxGeometry(0.96,0.34,0.48,2,0.14), u=a*1.0+_R(-0.05,0.05), v=-1.25+b*0.5+_R(-0.03,0.03);
        _xf(bag, along?u:v, y+_R(-0.02,0.02), along?v:u, _R(-0.06,0.06), (along?0:Math.PI/2)+_R(-0.08,0.08), _R(-0.05,0.05), 1, _R(0.9,1.08), 1); P.push({geo:bag, col:tones[(Math.random()*tones.length)|0]}); } }
    g=_mergeColored(P); g.userData.h=1.85; }
  else if(kind==='drums'){ const paints=[0x8a2a1e,0x3e4a2a,0x2a3e5a,0x9a7a1e,0x5a5a52,0x7a3a1a];
    for(let i=0;i<9;i++){ if(Math.random()<0.12) continue; const cx=(i%3-1)*1.0+_R(-0.08,0.08), cz=((i/3|0)-1)*1.0+_R(-0.08,0.08), col=paints[(Math.random()*paints.length)|0];
      const body=new THREE.CylinderGeometry(0.42,0.42,1.25,16); _xf(body,cx,0.63,cz,_R(-0.04,0.04),_R(0,6),_R(-0.04,0.04)); P.push({geo:body,col});
      for(const ry of [0.32,0.94]){ const rib=new THREE.TorusGeometry(0.425,0.025,4,16); _xf(rib,cx,ry,cz,Math.PI/2); P.push({geo:rib,col:new THREE.Color(col).multiplyScalar(0.7).getHex()}); }
      const lid=new THREE.CylinderGeometry(0.4,0.4,0.03,16); _xf(lid,cx,1.265,cz); P.push({geo:lid,col:0x6a6a62});
      const cap=new THREE.CylinderGeometry(0.06,0.06,0.04,8); _xf(cap,cx+0.22,1.29,cz); P.push({geo:cap,col:0x3a3a36}); }
    g=_mergeColored(P); g.userData.h=1.3; }
  else if(kind==='tires'){ for(const [sx,sz] of [[-0.75,-0.75],[0.75,-0.75],[-0.75,0.75],[0.75,0.75]]){ const n=2+(Math.random()*3|0);
      for(let k=0;k<n;k++){ const t=new THREE.TorusGeometry(0.52,0.22,8,18); _xf(t,sx+_R(-0.06,0.06),0.22+k*0.42,sz+_R(-0.06,0.06),Math.PI/2+_R(-0.08,0.08),0,_R(-0.06,0.06)); P.push({geo:t,col:k%2?0x2a2a28:0x222220}); } }
    g=_mergeColored(P); g.userData.h=1.4; }
  else if(kind==='crates'){ for(const [sx,sz] of [[-0.72,-0.72],[0.72,-0.72],[-0.72,0.72],[0.72,0.72]]){ const c=new RoundedBoxGeometry(1.36,1.0,1.36,1,0.04); _xf(c,sx,0.5,sz,0,_R(-0.08,0.08)); P.push({geo:c,col:0xb08a56}); }
    for(let k=0;k<2;k++){ const c=new RoundedBoxGeometry(1.3,0.9,1.3,1,0.04); _xf(c,k?0.5:-0.6,1.45,_R(-0.5,0.5),0,_R(-0.4,0.4)); P.push({geo:c,col:0xa07a48}); }
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
  else if(kind==='hesco'){ for(const [sx,sz] of [[-0.74,-0.74],[0.74,-0.74],[-0.74,0.74],[0.74,0.74]]){ const b=new THREE.BoxGeometry(1.42,2.1,1.42); _xf(b,sx,1.05,sz,0,_R(-0.03,0.03)); P.push({geo:b,col:0xc8b48c}); }
    g=_mergeColored(P); g.userData.h=2.1; }
  else if(kind==='hedgehog'){ const beam=()=>{ const s=new THREE.Shape(); s.moveTo(-0.14,-0.14); s.lineTo(0.14,-0.14); s.lineTo(0.14,-0.1); s.lineTo(0.02,-0.1); s.lineTo(0.02,0.1); s.lineTo(0.14,0.1); s.lineTo(0.14,0.14); s.lineTo(-0.14,0.14); s.lineTo(-0.14,0.1); s.lineTo(-0.02,0.1); s.lineTo(-0.02,-0.1); s.lineTo(-0.14,-0.1); s.closePath();
      const gg=new THREE.ExtrudeGeometry(s,{depth:2.6,bevelEnabled:false}); gg.translate(0,0,-1.3); return gg; };   // I-beam section
    const ax=[[Math.PI/4,0,0],[0,0,Math.PI/4],[0.62,Math.PI/2,0.62]];
    for(const [rx,ry,rz] of ax){ const b=beam(); _xf(b,0,0.95,0,rx,ry,rz); P.push({geo:b,col:0x5a4a3c}); }
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
  else if(kind==='wreck'){ const side=(pts)=>{ const s=new THREE.Shape(); s.moveTo(pts[0][0],pts[0][1]); for(const q of pts.slice(1)) s.lineTo(q[0],q[1]); s.closePath(); return s; };   // Z193 a burnt-out car: body, cabin, three wheels left, stripped of paint
    const ex=(shape, w)=>{ const gg=new THREE.ExtrudeGeometry(shape,{ depth:w, bevelEnabled:true, bevelThickness:0.04, bevelSize:0.04, bevelSegments:1 }); gg.translate(0,0,-w/2); gg.rotateY(-Math.PI/2); const uv=gg.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*0.3,uv.getY(i)*0.3); return gg; };
    P.push({ geo:ex(side([[-1.7,0.32],[1.7,0.32],[1.76,0.72],[1.05,0.92],[-1.45,0.98],[-1.74,0.86]]),1.62), col:0x5a3a28 });
    P.push({ geo:ex(side([[0.95,0.9],[0.45,1.42],[-0.95,1.44],[-1.35,0.96]]),1.42), col:0x2c2622 });
    for(const [wx,wz] of [[-0.82,1.1],[0.82,1.1],[0.82,-1.15]]){ const w=new THREE.CylinderGeometry(0.34,0.34,0.24,14); _xf(w,wx,0.34,wz,0,0,Math.PI/2); P.push({ geo:w, col:0x1a1918 }); }
    const ax=new THREE.CylinderGeometry(0.06,0.06,1.6,6); _xf(ax,0,0.2,-1.15,0,0,Math.PI/2); P.push({ geo:ax, col:0x3a2a20 });   // the bare axle where a wheel was
    g=_mergeColored(P); g.rotateZ(0.05); g.userData.h=1.45; }
  else if(kind==='container'){ const Lh=2.35, Wh=0.98, H=2.0;   // Z193 ISO shipping container (×COVER_K → 6.1 × 2.55 × 2.6 m): corrugated walls, corner posts, door bars
    P.push({ geo:_xf(new THREE.BoxGeometry(Wh*2-0.06,H-0.12,Lh*2-0.06),0,H/2,0), col:0xf0f0f0 });
    for(let z=-Lh+0.2;z<Lh-0.1;z+=0.27) for(const sx of [-1,1]){ const rb=new THREE.BoxGeometry(0.05,H-0.22,0.13); _xf(rb,sx*(Wh-0.01),H/2,z); P.push({ geo:rb, col:0xd8d8d8 }); }
    for(let x=-Wh+0.2;x<Wh-0.1;x+=0.27){ const rb=new THREE.BoxGeometry(0.13,H-0.22,0.05); _xf(rb,x,H/2,-(Lh-0.01)); P.push({ geo:rb, col:0xd8d8d8 }); }
    for(const [cx,cz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ P.push({ geo:_xf(new THREE.BoxGeometry(0.16,H,0.16),cx*(Wh-0.06),H/2,cz*(Lh-0.06)), col:0x8a8a86 }); }
    for(const y of [0.06,H-0.06]) for(const sx of [-1,1]) P.push({ geo:_xf(new THREE.BoxGeometry(0.14,0.12,Lh*2),sx*(Wh-0.05),y,0), col:0x8a8a86 });
    for(const x of [-0.6,-0.2,0.2,0.6]){ P.push({ geo:_xf(new THREE.CylinderGeometry(0.03,0.03,H-0.3,6),x,H/2,Lh+0.03), col:0x6a6a66 }); }   // door locking bars
    P.push({ geo:_xf(new THREE.BoxGeometry(0.03,H-0.2,0.02),0,H/2,Lh+0.01), col:0x3a3a38 });
    g=_mergeColored(P); g.userData.h=H; }
  { const ky=COVER_REAL_Y[kind]; if(ky && ky!==1) g.scale(1,ky,1); }   // Z174 real heights
  COVER_GEO[kind]=g; return g;
}
export const COVER_MAT = {};
export function coverMat(kind){
  if(COVER_MAT[kind]) return COVER_MAT[kind];
  const M=(o)=>detailize(new THREE.MeshStandardMaterial(Object.assign({ vertexColors:true, roughness:0.9, metalness:0.05, envMapIntensity:0.6 }, o)), { scale:0.9, bump:0.01, alb:0.28, foot:0.5, streak:0.15 });
  const m = kind==='sandbag' ? M({ map:propTex('burlap'), roughness:0.97 })
    : kind==='drums' ? M({ map:propTex('drum'), roughness:0.55, metalness:0.55 })
    : kind==='tires' ? M({ map:propTex('rubber'), roughness:0.95 })
    : kind==='crates' ? M({ map:propTex('wood'), roughness:0.85 })
    : kind==='hesco' ? M({ map:propTex('mesh'), roughness:0.9 })
    : kind==='hedgehog' ? M({ roughness:0.6, metalness:0.7, map:propTex('drum') })
    : kind==='logs' ? M({ map:propTex('bark'), roughness:0.95 })
    : kind==='wreck' ? M({ map:propTex('drum'), roughness:0.8, metalness:0.35 })
    : kind==='container' ? M({ map:propTex('steel'), roughness:0.6, metalness:0.45 })
    : M({ map:propTex('concrete'), roughness:0.92 });
  COVER_MAT[kind]=m; return m;
}
// which real-world pieces each battlefield uses: [destructible kinds] + [solid kinds]
export const COVER_SET = {   // Z193 + jersey barriers · dragon's teeth (solid) · timber barricades (breakable)
  DESERT: [['sandbag','sandbag','drums','crates'], ['hesco','concrete','pipes','jersey','teeth']],
  RUINS:  [['sandbag','tires','drums','crates'],   ['concrete','pipes','jersey','teeth']],
  TUNDRA: [['sandbag','crates','drums','logs'],    ['concrete','pipes','hesco','teeth']],
  FOUNDRY:[['drums','tires','drums','crates'],     ['pipes','concrete','jersey']],
  CITADEL:[['sandbag','sandbag','tires','drums'],  ['concrete','hesco','pipes','teeth']],
  MEADOW: [['sandbag','crates','tires','logs'],    ['hesco','pipes','concrete','teeth']],
  CITY:   [['sandbag','crates','tires','drums'],   ['concrete','jersey','hesco','pipes','jersey']],
  HILLS:  [['sandbag','crates','logs','logs'],     ['hesco','concrete','teeth']],
  VILLAGE:[['sandbag','crates','tires','logs'],    ['pipes','hesco','jersey']],
  SAVANNA:[['sandbag','sandbag','drums','logs'],   ['hesco','concrete','teeth']],
  ARCTIC: [['sandbag','crates','logs'],            ['concrete','hesco','teeth']],
  STEELMILL:[['drums','tires','crates','drums'],   ['pipes','concrete','jersey']],
  VOLCANO:[['sandbag','drums','crates'],          ['concrete','hesco','teeth']],
  QUARRY: [['crates','sandbag','drums'],          ['concrete','jersey','pipes','teeth']],
  CAVERN: [['crates','sandbag','logs','drums'],    ['concrete','hesco','logs']],
};
// Z193 lone big pieces per battlefield: shipping containers (some stacked two high) + burnt-out car wrecks
export const LONE_SET = { DESERT:[3,4], RUINS:[3,5], TUNDRA:[2,2], FOUNDRY:[6,3], CITADEL:[2,3], MEADOW:[1,3], CITY:[6,6], HILLS:[1,2], VILLAGE:[2,4], SAVANNA:[2,3], ARCTIC:[2,2], STEELMILL:[7,3], VOLCANO:[2,2], QUARRY:[6,3], CAVERN:[3,1] };
export const CONTAINER_PAINT = [0x9a2e22,0x2a4e74,0x3c6040,0xc0802a,0x76766e,0x7a4a2a,0xd0cbbd];
export function makeCoverMesh(kind, destructible){
  const mat = destructible ? coverMat(kind).clone() : coverMat(kind); if(destructible) mat.userData.own=true;     // destructible pieces flash on hit → own material
  const m=new THREE.Mesh(coverGeo(kind), mat); m.castShadow=true; m.receiveShadow=true; m.userData.kind=kind; return m;
}
