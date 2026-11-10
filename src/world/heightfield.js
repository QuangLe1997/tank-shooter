// world/heightfield.js — HEIGHTFIELD: rolling mounds, shell craters & wind drifts; everything (tanks, props, shells, particles) sits on it; blasts dig new craters
import * as THREE from 'three';
import { RELIEF, FIELD, TERRAIN_FLAT } from '../../config.js';
import { AREA_K, ARENA, BIOMES, DECAL, MOBILE, TERRAIN_STYLE, _R, _canvasTex, crushAt, crushables, decalCrater, fieldDepth, groundMaps, macroGround, scene } from '../hub.js';

// ---- HEIGHTFIELD: rolling mounds, shell craters & wind drifts; everything (tanks, props, shells, particles) sits on it; blasts dig new craters ----
export const HF = { N: Math.min(MOBILE?140:240, Math.round((MOBILE?96:150)*ARENA/60)), S: ARENA*2 };   // Z104 grid scales with the arena (≈1 vertex / 1.3 m), capped for phones
HF.step = HF.S/HF.N; HF.W = HF.N+1; HF.h = new Float32Array(HF.W*HF.W);
export function heightAt(x, z){
  const fx=(x+ARENA)/HF.step, fz=(z+ARENA)/HF.step; if(fx<0||fz<0||fx>=HF.N||fz>=HF.N) return 0;
  const ix=fx|0, iz=fz|0, tx=fx-ix, tz=fz-iz, W=HF.W, h=HF.h, i=iz*W+ix;
  return (h[i]*(1-tx)+h[i+1]*tx)*(1-tz) + (h[i+W]*(1-tx)+h[i+W+1]*tx)*tz;
}
export function _hfMask(x, z){                                                   // keep the Core plaza, the spawn and the wall strip flat
  const dc=Math.hypot(x,z), ds=Math.hypot(x, z-ARENA*0.55), de=fieldDepth(x,z);   // Z106 flatten a strip inside the (irregular) fence
  const s=(v,a,b)=>Math.max(0,Math.min(1,(v-a)/(b-a)));
  return s(dc,11,17)*s(ds,6,11)*s(de,3,8);
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
  const dunes = b.name==='DESERT'||b.name==='TUNDRA', feats=[], TF=TERRAIN_FLAT, RR=(r)=>r[0]+Math.random()*(r[1]-r[0]);
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
  syncTerrainMesh();
  try{ if(typeof DECAL!=='undefined' && DECAL.sx) for(const f of feats) if(f.t===1 && _hfMask(f.x,f.z)>0.5) decalCrater(f.x, f.z, f.r*0.9, 0.55); }catch(e){}   // old craters are scarred into the ground too
}
// Z106 HIGHLAND beyond the fence: rises over ridgeW metres, rolls with the macro noise, eases back down at the bounding square's edge
export function ridgeAt(x, z, n){ const out=-fieldDepth(x,z); if(out<-1) return 0; const sq=ARENA-Math.max(Math.abs(x),Math.abs(z));
  const rise=Math.min(1, Math.max(0, (out+1)/FIELD.ridgeW)), fall=Math.min(1, Math.max(0, sq/9));
  return FIELD.ridgeH*rise*rise*(3-2*rise)*fall*(0.72+0.28*(n||0)); }
// a blast digs a crater (r = radius, d = depth) and throws up a rim — updates the mesh where it changed
export function deformCrater(x, z, r, d){
  d*=TERRAIN_FLAT.blastK;   // Z107 shells scar the ground, they don't turn it into a moonscape
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
// waving cloth flags (Core + the player's Vietnamese flag)
export const WAVING=[];
export function vnFlagTex(){ return _canvasTex(240,160,(x,W,H)=>{ x.fillStyle='#da251d'; x.fillRect(0,0,W,H); x.fillStyle='#ffde00'; x.beginPath();
  for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, r=i%2?H*0.15:H*0.38; x.lineTo(W/2+Math.cos(a)*r, H/2+Math.sin(a)*r); } x.closePath(); x.fill();
  for(let i=0;i<200;i++){ x.fillStyle='rgba(0,0,0,'+_R(0.02,0.07).toFixed(2)+')'; x.fillRect(_R(0,W),_R(0,H),2,2); } }); }
export let _VN=null; export const vnTex=()=>(_VN||(_VN=vnFlagTex()));
export function makeFlag(tex, w, h, side){ const geo=new THREE.PlaneGeometry(w,h,12,7); geo.translate(w/2*(side||1),0,0);
  const m=new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map:tex, side:THREE.DoubleSide, roughness:0.9 })); m.castShadow=true;
  const f={ mesh:m, base:geo.attributes.position.array.slice(), w, sx:side||1, ph:Math.random()*6 }; WAVING.push(f); m.userData.flag=f; return m; }
// Z104 stop animating every flag under `root` (call before removing it from the scene — WAVING otherwise grows every stage)
export function unwave(root){ if(!root) return; root.traverse(o=>{ const f=o.userData&&o.userData.flag; if(f){ const i=WAVING.indexOf(f); if(i>=0) WAVING.splice(i,1); } }); }
export function updateFlags(now){
  for(let fi=WAVING.length-1; fi>=0; fi--){ const f=WAVING[fi]; if(!f.mesh.parent){ WAVING.splice(fi,1); continue; } if(!f.mesh.visible) continue;
    const pa=f.mesh.geometry.attributes.position, A=pa.array, B=f.base, w=f.w;
    if(f.dyn){ const sp=f.spd||0, phi=(1-sp)*1.15, amp=0.022+0.09*sp, wv=2.0+5.5*sp, cphi=Math.cos(phi), sphi=Math.sin(phi);   // Z89 a REAL flag: streams taut at speed, hangs limp when the tank stops
      f.t=(f.t||0)+0.016*wv;
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
export const groundMat = macroGround(new THREE.MeshStandardMaterial({ map:_g0.map, normalMap:_g0.nrm, normalScale:new THREE.Vector2(1,1), roughness:_g0.rough, metalness:0.0, envMapIntensity:0.5 }));
export const ground = new THREE.Mesh(terrainGeo(), groundMat);   // displaced heightfield (mounds + craters)
ground.receiveShadow = true; ground.castShadow = !MOBILE && RELIEF.selfShadow; arena.add(ground);   // Z105 mounds throw real shadows across craters (desktop)
// outer terrain past the perimeter (same surface, fades into the haze) — no more void beyond the walls
export const outerGeo = new THREE.PlaneGeometry(ARENA*8, ARENA*8); { const uv=outerGeo.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i, uv.getX(i)*4, uv.getY(i)*4); }
export const outerGround = new THREE.Mesh(outerGeo, groundMat); outerGround.rotation.x=-Math.PI/2; outerGround.position.y=-0.04; outerGround.receiveShadow=true; arena.add(outerGround);
