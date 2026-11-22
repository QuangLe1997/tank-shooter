// world/heightfield.js — HEIGHTFIELD: rolling mounds, shell craters & wind drifts; everything (tanks, props, shells, particles) sits on it; blasts dig new craters
import * as THREE from 'three';
import { RELIEF, FIELD, TERRAIN_FLAT, RIVERS, OUTSKIRTS } from '../../config.js';
import { AREA_K, ARENA, BIOMES, DECAL, MOBILE, TERRAIN_STYLE, _R, _canvasTex, crushAt, crushables, decalCrater, fieldDepth, groundMaps, macroGround, scene, carveRivers } from '../hub.js';

// ---- HEIGHTFIELD: rolling mounds, shell craters & wind drifts; everything (tanks, props, shells, particles) sits on it; blasts dig new craters ----
export const HF = { N: Math.min(MOBILE?140:300, Math.round((MOBILE?96:150)*ARENA/60)), S: ARENA*2 };   // Z104 grid scales with the arena (≈1 vertex / 1.3 m), capped for phones
HF.step = HF.S/HF.N; HF.W = HF.N+1; HF.h = new Float32Array(HF.W*HF.W);
export function bedAt(x, z){                                                     // Z405 the ground itself (the river bed under a bridge or the ice)
  const fx=(x+ARENA)/HF.step, fz=(z+ARENA)/HF.step; if(fx<0||fz<0||fx>=HF.N||fz>=HF.N) return outerAt(x, z);   // (Z427 past the field: the outskirts' hills)
  const ix=fx|0, iz=fz|0, tx=fx-ix, tz=fz-iz, W=HF.W, h=HF.h, i=iz*W+ix;
  return (h[i]*(1-tx)+h[i+1]*tx)*(1-tz) + (h[i+W]*(1-tx)+h[i+W+1]*tx)*tz; }
export function heightAt(x, z){ const v=bedAt(x, z);
  if(RIVER.on && v<RIVER.top){ for(const b of RIVER.bridges){ const dx=x-b.x, dz=z-b.z, al=dx*b.ca+dz*b.sa, ac=dz*b.ca-dx*b.sa; if(Math.abs(al)<b.hl && Math.abs(ac)<b.hw) return Math.max(v, b.y); }   // Z139 a bridge deck carries the hull over the water (Z405 its span along (ca, sa) — the way the deck is drawn — bank to bank)
    const I=RIVER.ice; if(I && v<RIVER.y+0.05){ const k=Math.round((z+ARENA)/HF.step)*HF.W+Math.round((x+ARENA)/HF.step); if(I[k]) return RIVER.y+0.05; } }   // Z405 a frozen river carries it on the ice
  return v;
}
// Z139 RIVERS: a river + a side stream are carved into the heightfield (world/river.js, config RIVERS); a water plane sits in the bed; bridges lift the surface; the hull wades slowly
//   Z405 top = the highest a bridge deck lifts the surface · w = each line's half width · ice = per heightfield cell, 1 where the river is frozen · flow / mark = the baked flow field
export const RIVER = { on:false, y:-0.85, top:0.15, bridges:[], fords:[], lines:[], w:[], ice:null, flow:null, mark:null, mesh:null, deck:null, biome:'' };
export function wetAt(x, z, m){ if(!RIVER.on) return false; const W=RIVER.y+0.15; if(bedAt(x,z)<W) return true; const r=m||0; if(r<=0) return false;
  for(const f of [0.4,0.7,1]) for(let k=0;k<8;k++){ const a=k*0.785; if(bedAt(x+Math.cos(a)*r*f, z+Math.sin(a)*r*f)<W) return true; } return false; }   // rings round the point, so a wide structure never straddles water (Z405 the bed, not a bridge or the ice: nothing is built on them)
// Z405 the crossings' ground: a bridge with its approaches and a ford with its banks are kept free of cover, buildings and props (field.js inField)
export function nearCrossing(x, z, m){ if(!RIVER.on) return false; const r=(m||0)+1.5, c=RIVERS.clear;
  for(const b of RIVER.bridges){ const dx=x-b.x, dz=z-b.z, al=dx*b.ca+dz*b.sa, ac=dz*b.ca-dx*b.sa; if(Math.abs(al)<b.hl+c+r && Math.abs(ac)<b.hw+r) return true; }
  for(const f of RIVER.fords){ const R=f.r+c+r; if((x-f.x)**2+(z-f.z)**2<R*R) return true; } return false; }
// Z405 how fast a hull / rider gets on here: 1 on land, a bridge or the ice; slower wading the shallows and fords; slowest in deep water
export function wadeAt(x, z){ if(!RIVER.on) return 1; const d=RIVER.y+0.15-heightAt(x, z), K=RIVERS.wade; return d<=0 ? 1 : d<K.fordD ? K.ford : K.deep; }
export function _hfMask(x, z){                                                   // keep the Core plaza, the spawn and the wall strip flat
  const dc=Math.hypot(x,z), ds=Math.hypot(x, z-ARENA*0.55), de=fieldDepth(x,z);   // Z106 flatten a strip inside the (irregular) fence
  const s=(v,a,b)=>Math.max(0,Math.min(1,(v-a)/(b-a)));
  return s(dc,23,30)*s(ds,6,11)*s(de,3,8);   // Z140 the Core plaza is flat out past our compound walls (R 19)
}
// Z91 natural relief: mounds are irregular (lobed outline, rotated + stretched, a steeper lee face like real dunes/spoil heaps),
// craters are torn — ragged lobed rim, deeper bowl with a flat floor, an ejecta apron thicker on the blast side and radial spoil rays.
export function _lobes(){ return [Math.random()*6.283, Math.random()*6.283, Math.random()*6.283, 0.1+Math.random()*0.08, 0.05+Math.random()*0.06]; }
export function craterDV(q, th, d, L){                                                     // q = dist/r, th = bearing; L = lobe params
  const rr = 1 + L[3]*Math.sin(3*th+L[0]) + L[4]*Math.sin(5*th+L[1]), u = q/rr, lop = 0.75 + 0.45*Math.max(0, Math.cos(th-L[2]));   // ragged rim; one side throws more spoil
  if(u<1){ const bowl = u<0.32 ? 1 : 1-((u-0.32)/0.68)**2*0.92; return -d*bowl*1.12 + d*0.34*lop*Math.exp(-((u-0.96)**2)/0.016); }   // flat floor → steep walls → crisp lip
  const ray = Math.max(0, Math.sin(7*th+L[1]*2))**3;                                                                                  // spoil thrown out in streaks
  return d*0.34*lop*Math.exp(-((u-0.96)**2)/0.03) + d*0.1*lop*Math.exp(-((u-1.45)**2)/0.12)*(0.4+ray); }
export function genTerrain(b){
  const st0=TERRAIN_STYLE[b.name]||TERRAIN_STYLE.DESERT, st=Object.assign({}, st0, { mh:st0.mh*1.35, cd:st0.cd*1.25 }), W=HF.W, h=HF.h; h.fill(0);
  const dunes = b.name==='DESERT'||b.name==='TUNDRA', feats=[], RR=(r)=>r[0]+Math.random()*(r[1]-r[0]);
  const TF = b.name==='HILLS' ? Object.assign({}, TERRAIN_FLAT, { hills:[16,24], hillR:[16,30], hillH:[3.6,7.0], craters:[0,2], noiseK:0.9 })       // Z139 real hills: tall, broad, rolling
    : b.name==='CITY' ? Object.assign({}, TERRAIN_FLAT, { hills:[0,1], hillH:[0.6,1.0], craters:[5,9] })                                          // flat streets, a few shell holes
    : b.name==='VILLAGE' ? Object.assign({}, TERRAIN_FLAT, { hills:[4,7], hillR:[14,24], hillH:[1.2,2.2], craters:[1,3] }) : TERRAIN_FLAT;
  st.mounds = Math.round(RR(TF.hills))/AREA_K; st.craters = Math.round(RR(TF.craters))/AREA_K; st.noise *= TF.noiseK;   // Z107 mostly flat: a few big hills, a couple of old craters
  for(let i=0;i<Math.round(st.mounds*AREA_K);i++){ const a=Math.random()*Math.PI; feats.push({t:0, x:(Math.random()*2-1)*(ARENA-8), z:(Math.random()*2-1)*(ARENA-8), r:RR(TF.hillR), a:RR(TF.hillH),
    ex:dunes?1.6+Math.random()*0.8:0.7+Math.random()*0.6, ca:Math.cos(a), sa:Math.sin(a), lee:dunes?0.55:0.2, L:_lobes()}); }
  for(let i=0;i<Math.round(st.craters*AREA_K);i++) feats.push({t:1, x:(Math.random()*2-1)*(ARENA-8), z:(Math.random()*2-1)*(ARENA-8), r:2.6+Math.random()*4.2, a:st.cd*(0.5+Math.random()*0.5), L:_lobes()});
  const ph=[Math.random()*9, Math.random()*9, Math.random()*9, Math.random()*9];
  for(let j=0;j<W;j++) for(let i=0;i<W;i++){ const x=-ARENA+i*HF.step, z=-ARENA+j*HF.step; let v=0;
    for(const f of feats){ const dx=x-f.x, dz=z-f.z, d2r=dx*dx+dz*dz, rr=f.r*f.r; if(d2r>rr*5) continue;
      if(f.t===0){ const lx=dx*f.ca+dz*f.sa, lz=(-dx*f.sa+dz*f.ca)*f.ex, th=Math.atan2(lz,lx), wob=1+f.L[3]*Math.sin(3*th+f.L[0])+f.L[4]*1.4*Math.sin(5*th+f.L[1]);
        const lzz = lz>0 ? lz*(1+f.lee) : lz, d2=(lx*lx+lzz*lzz)/(wob*wob);                                                   // steeper lee face
        v += f.a*Math.exp(-d2/(rr*0.45)); }
      else { const q=Math.sqrt(d2r)/f.r; if(q<2) v += craterDV(q, Math.atan2(dz,dx), f.a, f.L); } }
    const n1=Math.sin(x*0.31+ph[0])*Math.sin(z*0.27+ph[1]) + 0.5*Math.sin(x*0.73+z*0.61+ph[2]), n2=Math.sin(x*1.37+ph[3])*Math.sin(z*1.21+ph[0])*0.35 + Math.sin((x+z)*2.3+ph[1])*Math.sin((x-z)*1.9)*0.12;   // macro roll + fine hummocks
    v += st.noise*(n1 + n2);
    h[j*W+i] = v*_hfMask(x,z) + ridgeAt(x, z, n1); }
  carveRivers(h, b);   // Z405 the battlefields with a river (config RIVERS: world/river.js) — Z143 the arctic's frozen river and its open lead
  syncTerrainMesh();
  buildOutskirts(b);   // Z427 the hills past the field, rising from its edge
  try{ if(typeof DECAL!=='undefined' && DECAL.sx) for(const f of feats) if(f.t===1 && _hfMask(f.x,f.z)>0.5) decalCrater(f.x, f.z, f.r*0.9, 0.55); }catch(e){}   // old craters are scarred into the ground too
}
// Z141 REAL WATER — the depth the shader reads comes from a small texture of the heightfield baked when the river is carved (foam on the banks where it is
//   shallow, the deep channel dark). Z405: G / B = the flow field (m/s, ± RIVER_FMAX), A = the frozen cells (1) and the fords' white water (0–0.45)
export const WTIME = { value:0 }, RIVER_FMAX = 2.5;
export function depthTex(){ const W=HF.W, d=new Uint8Array(W*W*4), F=RIVER.flow, M=RIVER.mark, e=v=>Math.max(0, Math.min(255, Math.round(128+127*v/RIVER_FMAX)));
  for(let k=0;k<W*W;k++){ d[k*4]=Math.max(0,Math.min(255, Math.round((HF.h[k]+2.5)/3.5*255))); d[k*4+1]=F?e(F[k*2]):128; d[k*4+2]=F?e(F[k*2+1]):128; d[k*4+3]=M?M[k]:0; }
  const t=new THREE.DataTexture(d, W, W, THREE.RGBAFormat); t.magFilter=t.minFilter=THREE.LinearFilter; t.needsUpdate=true; return t; }
// Z106 HIGHLAND beyond the fence: rises over ridgeW metres, rolls with the macro noise, eases back down at the bounding square's edge
export function ridgeAt(x, z, n){ const out=-fieldDepth(x,z); if(out<-1) return 0; const sq=ARENA-Math.max(Math.abs(x),Math.abs(z));
  const rise=Math.min(1, Math.max(0, (out+1)/FIELD.ridgeW)), fall=Math.min(1, Math.max(0, sq/9));
  return FIELD.ridgeH*rise*rise*(3-2*rise)*fall*(0.72+0.28*(n||0)); }
// a blast digs a crater (r = radius, d = depth) and throws up a rim — updates the mesh where it changed
export function deformCrater(x, z, r, d){
  d*=TERRAIN_FLAT.blastK; if(!d) return;   // Z107 blastK 0: shells scorch the ground (decal) but never reshape it → no terrain rebuild, no flicker
  const W=HF.W, h=HF.h, R=r*2.0, i0=Math.max(0,Math.floor((x-R+ARENA)/HF.step)), i1=Math.min(HF.N,Math.ceil((x+R+ARENA)/HF.step)), j0=Math.max(0,Math.floor((z-R+ARENA)/HF.step)), j1=Math.min(HF.N,Math.ceil((z+R+ARENA)/HF.step));
  HF.dj0=Math.min(HF.dj0??1e9, j0-1); HF.dj1=Math.max(HF.dj1??-1, j1+1);   // dirty rows for this frame's mesh update
  const L=_lobes();
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ const px=-ARENA+i*HF.step, pz=-ARENA+j*HF.step, q=Math.hypot(px-x,pz-z)/r; if(q>2) continue;
    const dv = craterDV(q, Math.atan2(pz-z,px-x), d, L);
    h[j*W+i] = Math.max(-2.6, Math.min(2.4, h[j*W+i] + dv*_hfMask(px,pz))); }
  HF.dirty=true; for(const c of crushables) if(c.alive && Math.abs(c.x-x)<r*1.4 && Math.abs(c.z-z)<r*1.4) crushAt(c);   // loose stones in the blast are pulverised
}
export let TERRAIN_GEO=null;
export function terrainGeo(){ if(TERRAIN_GEO) return TERRAIN_GEO; const g=new THREE.PlaneGeometry(HF.S, HF.S, HF.N, HF.N); g.rotateX(-Math.PI/2);
  g.setAttribute('aRelief', new THREE.BufferAttribute(new Float32Array(HF.W*HF.W*2), 2));   // Z105 (curvature, slope) per vertex → ground shader
  TERRAIN_GEO=g; return g; }
// heights + analytic normals (central differences) for rows j0..j1 only → craters update a tiny slice of the mesh
export function syncTerrainMesh(j0, j1){ const g=terrainGeo(), p=g.attributes.position, n=g.attributes.normal, W=HF.W, h=HF.h, s2=2*HF.step; j0=Math.max(0,j0||0); j1=Math.min(HF.N, j1==null?HF.N:j1);
  for(let j=j0;j<=j1;j++) for(let i=0;i<W;i++){ const k=j*W+i, hl=h[j*W+Math.max(0,i-1)], hr=h[j*W+Math.min(HF.N,i+1)], hd=h[Math.max(0,j-1)*W+i], hu=h[Math.min(HF.N,j+1)*W+i];
    const nx=-(hr-hl)/s2, nz=-(hu-hd)/s2, L=1/Math.hypot(nx,1,nz); p.setY(k, h[k]); n.setXYZ(k, nx*L, L, nz*L); }   // PlaneGeometry rows run +z after rotateX(-90°) → row j ↔ world z index j
  p.clearUpdateRanges(); n.clearUpdateRanges(); p.addUpdateRange(j0*W*3, (j1-j0+1)*W*3); n.addUpdateRange(j0*W*3, (j1-j0+1)*W*3); p.needsUpdate=true; n.needsUpdate=true;
  syncRelief(j0-RELIEF.R, j1+RELIEF.R);
  if(j0===0 && j1===HF.N) g.computeBoundingSphere(); }
// Z105 relief for rows j0..j1: curvature = height − mean of the 8 samples R cells away (bowls < 0, crests > 0), slope = gradient length
export function syncRelief(j0, j1){ const g=terrainGeo(), a=g.attributes.aRelief, W=HF.W, N=HF.N, h=HF.h, R=RELIEF.R, s2=2*HF.step; j0=Math.max(0,j0|0); j1=Math.min(N, j1==null?N:j1|0);
  const at=(i,j)=>h[Math.max(0,Math.min(N,j))*W+Math.max(0,Math.min(N,i))];
  for(let j=j0;j<=j1;j++) for(let i=0;i<W;i++){ const c=at(i,j);
    const ring=(at(i-R,j)+at(i+R,j)+at(i,j-R)+at(i,j+R) + 0.7*(at(i-R,j-R)+at(i+R,j-R)+at(i-R,j+R)+at(i+R,j+R)))/6.8;
    const sx=(at(i+1,j)-at(i-1,j))/s2, sz=(at(i,j+1)-at(i,j-1))/s2; a.setXY(j*W+i, c-ring, Math.hypot(sx,sz)); }
  a.clearUpdateRanges(); a.addUpdateRange(j0*W*2, (j1-j0+1)*W*2); a.needsUpdate=true; }
// waving cloth flags (Core + the player's Liên Quân Thép banner)
export const WAVING=[];
// Z145 our side flies a FICTIONAL banner (no real nation's flag): "LIÊN QUÂN THÉP" — forest green over steel navy, a bronze hoist chevron
//   bearing a white cog-star, a thin gold rule between the fields. Woven-cloth grain on top.
export function vnFlagTex(){ return _canvasTex(240,160,(x,W,H)=>{ x.fillStyle='#2f5a3a'; x.fillRect(0,0,W,H/2); x.fillStyle='#1e2e4a'; x.fillRect(0,H/2,W,H/2);
  x.fillStyle='#c8a24a'; x.fillRect(0,H/2-3,W,6);
  x.fillStyle='#b8862e'; x.beginPath(); x.moveTo(0,0); x.lineTo(W*0.42,H/2); x.lineTo(0,H); x.closePath(); x.fill();
  x.strokeStyle='#e8c870'; x.lineWidth=3; x.beginPath(); x.moveTo(0,0); x.lineTo(W*0.42,H/2); x.lineTo(0,H); x.stroke();
  const cx=W*0.15, cy=H/2; x.fillStyle='#f4f0e4'; x.beginPath(); for(let i=0;i<24;i++){ const a=i/24*Math.PI*2, r=(i%2)?H*0.13:H*0.17; x.lineTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r); } x.closePath(); x.fill();   // cog
  x.fillStyle='#b8862e'; x.beginPath(); x.arc(cx,cy,H*0.1,0,7); x.fill();
  x.fillStyle='#f4f0e4'; x.beginPath(); for(let i=0;i<12;i++){ const a=-Math.PI/2+i*Math.PI/6, r=i%2?H*0.035:H*0.085; x.lineTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r); } x.closePath(); x.fill();   // six-point star in the cog
  for(let i=0;i<260;i++){ x.fillStyle='rgba(0,0,0,'+_R(0.02,0.07).toFixed(2)+')'; x.fillRect(_R(0,W),_R(0,H),2,2); }
  x.fillStyle='rgba(255,255,255,0.04)'; for(let yy=0;yy<H;yy+=3) x.fillRect(0,yy,W,1); }); }
export let _VN=null; export const vnTex=()=>(_VN||(_VN=vnFlagTex()));
export function makeFlag(tex, w, h, side){ const geo=new THREE.PlaneGeometry(w,h,12,7); geo.translate(w/2*(side||1),0,0);
  const m=new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map:tex, side:THREE.DoubleSide, roughness:0.9 })); m.castShadow=true;
  const f={ mesh:m, base:geo.attributes.position.array.slice(), w, sx:side||1, ph:Math.random()*6 }; WAVING.push(f); m.userData.flag=f; return m; }
// Z104 stop animating every flag under `root` (call before removing it from the scene — WAVING otherwise grows every stage)
export function unwave(root){ if(!root) return; root.traverse(o=>{ const f=o.userData&&o.userData.flag; if(f){ const i=WAVING.indexOf(f); if(i>=0) WAVING.splice(i,1); } }); }
let _flagF=0;
export function updateFlags(now){ _flagF^=1;
  for(let fi=WAVING.length-1; fi>=0; fi--){ const f=WAVING[fi]; if(!f.mesh.parent){ WAVING.splice(fi,1); continue; } if(!f.mesh.visible) continue;
    if(((fi&1)^_flagF) || f.mesh.layers.mask===128) continue;   // Z192 each flag re-shapes every other frame (half the cloth + normals work), none while lost in the fog
    const pa=f.mesh.geometry.attributes.position, A=pa.array, B=f.base, w=f.w;
    if(f.dyn){ const sp=f.spd||0, phi=(1-sp)*1.15, amp=0.022+0.09*sp, wv=2.0+5.5*sp, cphi=Math.cos(phi), sphi=Math.sin(phi);   // Z89 a REAL flag: streams taut at speed, hangs limp when the tank stops
      f.t=(f.t||0)+0.032*wv;   // Z192 (stepped every other frame)
      for(let i=0;i<pa.count;i++){ const x=B[i*3], y=B[i*3+1], u=Math.abs(x)/w, sag=phi*(0.6+0.4*u);
        A[i*3]   = x*Math.cos(sag) ;
        A[i*3+1] = y - Math.abs(x)*Math.sin(sag) - u*u*0.04*w;
        A[i*3+2] = Math.sin(x*f.sx*(6.2/w) - f.t*5.4 + y*0.9 + f.ph)*amp*w*u + Math.sin(x*f.sx*(13/w) - f.t*8.6)*amp*0.25*w*u + (1-sp)*Math.sin(now*0.9+f.ph)*0.04*u; } }
    else for(let i=0;i<pa.count;i++){ const x=B[i*3], y=B[i*3+1], u=Math.abs(x)/w;
      A[i*3+2] = Math.sin(x*f.sx*(6.2/w) - now*5.4 + y*0.9 + f.ph)*0.085*w*u + Math.sin(x*f.sx*(13/w) - now*8.6)*0.02*w*u; A[i*3+1] = y - u*u*0.05*w; }
    pa.needsUpdate=true; f.mesh.geometry.computeVertexNormals(); }
}
performance.mark('boot:preground');
export const arena = new THREE.Group(); scene.add(arena);
export const _g0 = groundMaps(BIOMES[0]);
export const groundMat = macroGround(new THREE.MeshStandardMaterial({ map:_g0.map, normalMap:_g0.nrm, normalScale:new THREE.Vector2(TERRAIN_FLAT.nrmK, TERRAIN_FLAT.nrmK), roughness:_g0.rough, metalness:0.0, envMapIntensity:0.5 }));
export const ground = new THREE.Mesh(terrainGeo(), groundMat);   // displaced heightfield (mounds + craters)
ground.receiveShadow = true; ground.castShadow = !MOBILE && RELIEF.selfShadow; arena.add(ground);   // Z105 mounds throw real shadows across craters (desktop)
// outer terrain past the perimeter (same surface, fades into the haze) — no more void beyond the walls
// Z427 OUTSKIRTS: it rolls. Hills rise from the field's edge (meeting its last row exactly), crest, and sink back to the plain by OUTSKIRTS.fade × ARENA
//   out, so where the near world is cut off at the far plane it is flat land like the backdrop's (world/backdrop.js); heightAt reads the same hills
//   (things set out past the fence stand on them). A ring of columns from the square's edge outward, denser near the field; rebuilt each battlefield
const OUT = { amp:0, wave:200, dune:0, seed:0 }, _sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const _oh = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7 + OUT.seed * 74.7) * 43758.5453; return v - Math.floor(v); };
function _on(x, z){ const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (_oh(ix, iz) * (1 - u) + _oh(ix + 1, iz) * u) * (1 - v) + (_oh(ix, iz + 1) * (1 - u) + _oh(ix + 1, iz + 1) * u) * v; }
const _ofbm = (x, z) => (_on(x, z) * 0.55 + _on(x * 2.1 + 3.1, z * 2.1 + 1.7) * 0.3 + _on(x * 4.3 + 7.7, z * 4.3 + 5.3) * 0.15);
export function outerAt(x, z){ const q = Math.max(Math.abs(x), Math.abs(z)) - ARENA; if(q <= 0 || !OUT.amp) return 0; const C = OUTSKIRTS, A = ARENA;
  const e = _sm(0, C.ramp * A, q) * (1 - _sm(C.crest * A, C.fade * A, q)); if(e <= 0) return 0; const w = OUT.wave;
  const n = OUT.dune ? Math.pow(1 - Math.abs(Math.sin((x * 0.82 + z * 0.57) / w * Math.PI + _ofbm(x / w, z / w) * 4)), 1.8) * (0.5 + 0.5 * _ofbm(x / w * 0.6, z / w * 0.6)) : _ofbm(x / w, z / w);
  return OUT.amp * e * (0.15 + 0.85 * n); }
function outerGeoFor(){ const A = ARENA, [S, M] = MOBILE ? OUTSKIRTS.phone : OUTSKIRTS.seg, R = A * OUTSKIRTS.out, Ruv = A * 4, P = [], U = [], idx = [];
  for(let i = 0; i <= S; i++){ const a = i / S * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), rin = A / Math.max(Math.abs(c), Math.abs(sn));
    for(let j = 0; j <= M; j++){ const t = Math.pow(j / M, 1.6), r = rin + (R - rin) * t, x = c * r, z = sn * r;
      const y = j === 0 ? bedAt(Math.max(-A + 0.01, Math.min(A - 0.01, x)), Math.max(-A + 0.01, Math.min(A - 0.01, z))) : outerAt(x, z);   // (the first row on the field's own last row)
      P.push(x, y - 0.04, z); U.push((x / (Ruv * 2) + 0.5) * 4, (-z / (Ruv * 2) + 0.5) * 4); } }
  for(let i = 0; i < S; i++) for(let j = 0; j < M; j++){ const a = i * (M + 1) + j, b = a + M + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; }
export const outerGround = new THREE.Mesh(outerGeoFor(), groundMat); outerGround.receiveShadow=true; arena.add(outerGround);
export function buildOutskirts(b){ let C = OUTSKIRTS.on ? (OUTSKIRTS.biomes[b.name] ?? OUTSKIRTS.biomes._) : null; if(typeof C === 'string') C = OUTSKIRTS.biomes[C];
  OUT.amp = C ? C.amp : 0; OUT.wave = C ? C.wave : 200; OUT.dune = C && C.dune ? 1 : 0; OUT.seed = Math.random() * 100;
  const old = outerGround.geometry; outerGround.geometry = outerGeoFor(); old.dispose(); outskirtRoads(b, C); }
// the tracks that lead away from the field over the hills (behind our lines, toward the enemy's, and off to one side): a ribbon on the ground, its
//   edges soft, winding as it goes, fading into the plain
const ROADS = new THREE.Group(); ROADS.name = 'outskirt-roads'; arena.add(ROADS); let _roadTex = null;
function roadTex(){ return _roadTex || (_roadTex = _canvasTex(64, 256, (x, W, H) => { for(let i = 0; i < W; i++){ const e = Math.min(i, W - 1 - i) / (W * 0.22), a = Math.min(1, e) * 0.9;
    for(let j = 0; j < H; j += 4){ const n = 0.75 + 0.25 * Math.random(); x.fillStyle = `rgba(${Math.round(255 * n)},${Math.round(255 * n)},${Math.round(255 * n)},${a * (0.8 + 0.2 * Math.random())})`; x.fillRect(i, j, 1, 4); } }
    const r = Math.max(1, W * 0.18); x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(Math.round(W * 0.3 - r / 2), 0, r, H); x.fillRect(Math.round(W * 0.7 - r / 2), 0, r, H); })); }   // (two wheel ruts)
function outskirtRoads(b, C){ for(const m of [...ROADS.children]){ ROADS.remove(m); m.geometry.dispose(); m.material.dispose(); } if(!C || C.roads === 0 || b.name === 'CITY') return;
  const A = ARENA, col = new THREE.Color(b.ground).multiplyScalar(0.62), w = 6, L = A * (OUTSKIRTS.out - 1.4);
  for(const a0 of [Math.PI / 2 + _R(-0.3, 0.3), -Math.PI / 2 + 0.5 + _R(-0.25, 0.25), (Math.random() < 0.5 ? 0 : Math.PI) + _R(-0.4, 0.4)]){ const c = Math.cos(a0), sn = Math.sin(a0), rin = A / Math.max(Math.abs(c), Math.abs(sn)), ph = Math.random() * 9, P = [], U = [], idx = [];
    let x = c * rin, z = sn * rin, hd = a0, n = 0; for(let d = 0; d <= L; d += 5, n++){ hd = a0 + Math.sin(d / 140 + ph) * 0.35 + Math.sin(d / 47 + ph * 2) * 0.08;
      const px = -Math.sin(hd), pz = Math.cos(hd); for(const sd of [-1, 1]){ const vx = x + px * sd * w / 2, vz = z + pz * sd * w / 2; P.push(vx, heightAt(vx, vz) + 0.12, vz); U.push(sd < 0 ? 0 : 1, d / 24); }
      x += Math.cos(hd) * 5; z += Math.sin(hd) * 5; }
    for(let i = 0; i < n - 1; i++){ const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color:col, map:roadTex(), transparent:true, depthWrite:false, roughness:1, metalness:0, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 }));
    m.receiveShadow = true; m.renderOrder = 1; ROADS.add(m); } }
