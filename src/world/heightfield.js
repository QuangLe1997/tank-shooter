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
  const v=(h[i]*(1-tx)+h[i+1]*tx)*(1-tz) + (h[i+W]*(1-tx)+h[i+W+1]*tx)*tz;
  if(RIVER.on && v<0.05){ for(const b of RIVER.bridges){ const dx=x-b.x, dz=z-b.z, lx=dx*b.ca-dz*b.sa, lz=dx*b.sa+dz*b.ca; if(Math.abs(lx)<b.hw && Math.abs(lz)<b.hl) return Math.max(v, b.y); } }   // Z139 a bridge deck carries the hull over the water
  return v;
}
// Z139 RIVERS (VILLAGE): a meandering river + a stream are carved into the heightfield; a water plane sits in the bed; bridges lift the surface; the hull wades slowly
export const RIVER = { on:false, y:-0.85, bridges:[], lines:[], mesh:null, deck:null };
export function wetAt(x, z, m){ if(!RIVER.on) return false; if(heightAt(x,z)<-0.7) return true; const r=m||0; if(r<=0) return false;
  for(const f of [0.4,0.7,1]) for(let k=0;k<8;k++){ const a=k*0.785; if(heightAt(x+Math.cos(a)*r*f, z+Math.sin(a)*r*f)<-0.7) return true; } return false; }   // rings round the point, so a wide structure never straddles water
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
  RIVER.on=false; RIVER.bridges.length=0; RIVER.lines.length=0; if(RIVER.mesh) RIVER.mesh.visible=false; if(RIVER.deck) RIVER.deck.visible=false;
  if(b.name==='VILLAGE') carveRivers(h);
  syncTerrainMesh();
  try{ if(typeof DECAL!=='undefined' && DECAL.sx) for(const f of feats) if(f.t===1 && _hfMask(f.x,f.z)>0.5) decalCrater(f.x, f.z, f.r*0.9, 0.55); }catch(e){}   // old craters are scarred into the ground too
}
function _river(pts, w, h){                                                          // lower the bed along a polyline (w = half width), soft banks
  const W=HF.W, D=1.7, n=pts.length;
  for(let j=0;j<W;j++) for(let i=0;i<W;i++){ const x=-ARENA+i*HF.step, z=-ARENA+j*HF.step; let d=1e9;
    for(let k=0;k<n-1;k++){ const a=pts[k], b=pts[k+1], vx=b.x-a.x, vz=b.z-a.z, L2=vx*vx+vz*vz||1, t=Math.max(0,Math.min(1,((x-a.x)*vx+(z-a.z)*vz)/L2)), dx=x-(a.x+vx*t), dz=z-(a.z+vz*t), q=dx*dx+dz*dz; if(q<d) d=q; }
    d=Math.sqrt(d); const u=d/w; if(u>1.5) continue;
    const dep = u<0.62 ? 1 : (()=>{ const t=(u-0.62)/0.88; return 1-t*t*(3-2*t); })();
    const k=j*W+i; h[k]=Math.min(h[k], h[k]*0.25 - D*dep); } }
function carveRivers(h){
  const A=ARENA, ph=Math.random()*6.28, z0=-A*0.5+(Math.random()-0.5)*10, main=[], stream=[];
  for(let i=0;i<=56;i++){ const x=-A-6+(2*A+12)*i/56; main.push({ x, z:z0+Math.sin(x*0.045+ph)*10+Math.sin(x*0.11+ph*2)*3 }); }
  const x0=-A*0.46+(Math.random()-0.5)*8, zEnd=main.reduce((m,p)=>Math.abs(p.x-x0)<Math.abs(m.x-x0)?p:m).z;
  for(let j=0;j<=30;j++){ const z=A+6-(A+6-zEnd)*j/30; stream.push({ x:x0+Math.sin(z*0.07+ph)*6, z }); }
  _river(main, 5.5, h); _river(stream, 3.2, h);
  RIVER.on=true; RIVER.lines.push(main, stream);
  // bridges: two over the river, one over the stream — decks run across the channel
  const at=(line,u)=>{ const k=Math.max(1,Math.min(line.length-2,Math.round(u*(line.length-1)))), a=line[k-1], b=line[k+1]; return { x:line[k].x, z:line[k].z, ang:Math.atan2(b.z-a.z, b.x-a.x) }; };
  for(const [line,u,w] of [[main,0.30,5.5],[main,0.66,5.5],[stream,0.2,3.2]]){ const p=at(line,u), ang=p.ang+Math.PI/2; RIVER.bridges.push({ x:p.x, z:p.z, ang, ca:Math.cos(ang), sa:Math.sin(ang), hw:3.6, hl:w*1.9+2, y:0.14 }); }
  riverMeshes();
}
function riverMeshes(){
  if(!RIVER.mesh){ const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'); x.fillStyle='#7fb4c8'; x.fillRect(0,0,128,128);
    for(let i=0;i<70;i++){ x.strokeStyle='rgba(255,255,255,'+(0.08+Math.random()*0.16).toFixed(2)+')'; x.lineWidth=1+Math.random()*1.5; const px=Math.random()*128, py=Math.random()*128, L=6+Math.random()*16; x.beginPath(); x.moveTo(px,py); x.quadraticCurveTo(px+L/2,py+(Math.random()-0.5)*5,px+L,py); x.stroke(); }
    const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(36,36); tex.colorSpace=THREE.SRGBColorSpace;
    RIVER.mesh=new THREE.Mesh(new THREE.PlaneGeometry(ARENA*2.4, ARENA*2.4), new THREE.MeshStandardMaterial({ color:0x3a86a8, map:tex, transparent:true, opacity:0.82, roughness:0.1, metalness:0.15, envMapIntensity:1.4 }));
    RIVER.mesh.rotation.x=-Math.PI/2; RIVER.mesh.receiveShadow=true; RIVER.mesh.renderOrder=1; arena.add(RIVER.mesh); }
  RIVER.mesh.position.y=RIVER.y; RIVER.mesh.visible=true;
  if(RIVER.deck){ arena.remove(RIVER.deck); RIVER.deck.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); RIVER.deck=null; }
  const g=new THREE.Group(), wood=new THREE.MeshStandardMaterial({ color:0x8a6a44, roughness:0.9 }), rail=new THREE.MeshStandardMaterial({ color:0x5e472c, roughness:0.9 });
  for(const b of RIVER.bridges){ const br=new THREE.Group(); br.position.set(b.x, b.y, b.z); br.rotation.y=-b.ang;
    const deck=new THREE.Mesh(new THREE.BoxGeometry(b.hl*2, 0.3, b.hw*2), wood); deck.position.y=-0.16; deck.castShadow=true; deck.receiveShadow=true; br.add(deck);
    for(let k=-Math.floor(b.hl); k<=Math.floor(b.hl); k+=1){ const pl=new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, b.hw*2.02), rail); pl.position.set(k, 0.0, 0); br.add(pl); }   // plank seams
    for(const sz of [-1,1]){ const r=new THREE.Mesh(new THREE.BoxGeometry(b.hl*2, 0.12, 0.16), rail); r.position.set(0, 0.6, sz*(b.hw-0.1)); br.add(r);
      for(let k=-1;k<=1;k++){ const post=new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.2), rail); post.position.set(k*b.hl*0.9, 0.3, sz*(b.hw-0.1)); br.add(post); } }
    g.add(br); }
  RIVER.deck=g; arena.add(g); }
// wave the water (called every frame)
export function updateWater(dt){ if(RIVER.on && RIVER.mesh && RIVER.mesh.visible){ const t=RIVER.mesh.material.map; t.offset.x+=dt*0.012; t.offset.y+=dt*0.007; } }
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
export const groundMat = macroGround(new THREE.MeshStandardMaterial({ map:_g0.map, normalMap:_g0.nrm, normalScale:new THREE.Vector2(TERRAIN_FLAT.nrmK, TERRAIN_FLAT.nrmK), roughness:_g0.rough, metalness:0.0, envMapIntensity:0.5 }));
export const ground = new THREE.Mesh(terrainGeo(), groundMat);   // displaced heightfield (mounds + craters)
ground.receiveShadow = true; ground.castShadow = !MOBILE && RELIEF.selfShadow; arena.add(ground);   // Z105 mounds throw real shadows across craters (desktop)
// outer terrain past the perimeter (same surface, fades into the haze) — no more void beyond the walls
export const outerGeo = (()=>{ const R=ARENA*4, H=ARENA-0.4, sh=new THREE.Shape(); sh.moveTo(-R,-R); sh.lineTo(R,-R); sh.lineTo(R,R); sh.lineTo(-R,R); sh.closePath();
  const hole=new THREE.Path(); hole.moveTo(-H,-H); hole.lineTo(-H,H); hole.lineTo(H,H); hole.lineTo(H,-H); hole.closePath(); sh.holes.push(hole);   // Z139 a hole where the field is, so carved river beds are not roofed over
  const g=new THREE.ShapeGeometry(sh), uv=g.attributes.uv, p=g.attributes.position; for(let i=0;i<uv.count;i++) uv.setXY(i, (p.getX(i)/(R*2)+0.5)*4, (p.getY(i)/(R*2)+0.5)*4); return g; })();
export const outerGround = new THREE.Mesh(outerGeo, groundMat); outerGround.rotation.x=-Math.PI/2; outerGround.position.y=-0.04; outerGround.receiveShadow=true; arena.add(outerGround);
