// world/cavern.js — Z225 THE CAVERN (HANG NGẦM, after Sơn Đoòng): the whole battlefield is the floor of one vast cave.
//   · black limestone walls rise ~30 m all round (the heightfield beyond the fence); a brow of huge boulders hangs over them, stalactites under it
//   · no sky. Light comes from TORCHES on timber posts along the walls, the ridges and the old mine frames; BRAZIERS ring the Core; CRYSTAL veins
//     glow at the foot of the walls; and 4–5 SHAFTS of daylight fall through holes in the roof (giếng trời) — each a pale column of dust with a
//     pool of light on the floor and a patch of jungle growing in it
//   · a few colossal stone PILLARS (floor to roof) stand in the field: solid, they thin out when they come between the camera and the tank
//   · real flickering lights ride the torches nearest the tank; far torches still show their glow and their pool on the floor
//   · water drips out of the dark, dust trickles down after every big blast, and now and then the roof gives way (SẬP TRẦN): warning dust, then rock
import * as THREE from 'three';
import { CAVE_DEF } from '../../config.js';
import { ARENA, BIOME, MOBILE, RIDGES, S, UNDER, blocks, burst, camera, damageEnemy, damagePlayer, decalCrater, detailTex, detailize, enemies, fieldDepth, fieldPath, heightAt, inField, inZone, radio, ringPulse, rockSet, scene, sfx, showBanner, spawnDebris, spawnPart } from '../hub.js';

export const CAVE = { on:false, shafts:[], mouths:[], torches:[], extra:[], lights:[], spots:[], pillars:[], motes:[], fall:[], g:null, flames:null, glow:null, crystal:null, pools:null, lightAt:0, dripAt:0, dustAt:0, next:0, uT:{ value:0 } };
const R=(a,b)=>a+Math.random()*(b-a), TAU=Math.PI*2;
const _M=new THREE.Matrix4(), _Q=new THREE.Quaternion(), _V=new THREE.Vector3(), _S=new THREE.Vector3(), _E=new THREE.Euler(), _UP=new THREE.Vector3(0,1,0);

// ---- plan (runs inside applyBiome, after the field outline and BEFORE the terrain: the walls are cut round the tunnel mouths) ----
export function planCavern(){ CAVE.on=!!BIOME.cave; CAVE.shafts.length=0; CAVE.mouths.length=0; if(!CAVE.on) return;
  const C=CAVE_DEF, n=Math.round(R(C.shafts[0], C.shafts[1]+0.99)-0.49);
  for(let t=0;t<300 && CAVE.shafts.length<n;t++){ const r=R(C.shaftR[0], C.shaftR[1]), x=R(-ARENA*0.72, ARENA*0.72), z=R(-ARENA*0.78, ARENA*0.4);
    if(fieldDepth(x,z)<r+12 || Math.hypot(x,z)<r+30 || Math.hypot(x, z-ARENA*0.55)<r+26) continue;
    if(CAVE.shafts.some(s=>Math.hypot(s.x-x, s.z-z)<s.r+r+38)) continue; CAVE.shafts.push({ x, z, r }); }
  const base=[-Math.PI/2, -Math.PI/2+1.05, -Math.PI/2-1.05, 0.15, Math.PI-0.15];   // the enemy side first, then the flanks
  for(let k=0;k<C.mouths;k++) CAVE.mouths.push({ a:base[k%base.length]+R(-0.22,0.22), w:4.4 }); }
// the wall height multiplier round a tunnel mouth: 0 on the mouth's flat floor, 1 in the rock (used by ridgeAt)
export function caveNotch(x, z, out){ if(!CAVE.mouths.length) return 1; const a=Math.atan2(z,x), d=Math.hypot(x,z); let k=1;
  for(const m of CAVE.mouths){ let da=Math.abs(a-m.a); da=Math.min(da, TAU-da); const lat=da*d, side=Math.min(1, Math.max(0, (lat-m.w)/3.2)), deep=Math.min(1, Math.max(0, (out-13)/6));
    k=Math.min(k, Math.max(side*side*(3-2*side), deep)); }
  return k; }

// ---- textures ----
let _glowT=null, _poolT=null;
function glowTex(){ if(_glowT) return _glowT; const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'), g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.18,'rgba(255,220,170,0.75)'); g.addColorStop(0.5,'rgba(255,150,60,0.18)'); g.addColorStop(1,'rgba(255,120,40,0)'); x.fillStyle=g; x.fillRect(0,0,64,64);
  _glowT=new THREE.CanvasTexture(c); _glowT.colorSpace=THREE.SRGBColorSpace; return _glowT; }
function poolTex(){ if(_poolT) return _poolT; const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'), g=x.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,0.9)'); g.addColorStop(0.35,'rgba(255,255,255,0.45)'); g.addColorStop(0.7,'rgba(255,255,255,0.12)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,128,128);
  _poolT=new THREE.CanvasTexture(c); _poolT.colorSpace=THREE.SRGBColorSpace; return _poolT; }
let _mats=null;
function mats(){ if(_mats) return _mats;
  _mats={ wood:detailize(new THREE.MeshStandardMaterial({ color:0x5a3e26, roughness:0.92 }), { scale:0.5, bump:0.04, alb:0.3 }),
    iron:new THREE.MeshStandardMaterial({ color:0x2a2622, roughness:0.6, metalness:0.7 }),
    rock:detailize(new THREE.MeshStandardMaterial({ color:0x6e665a, roughness:0.93 }), { scale:0.12, bump:0.08, alb:0.4, streak:0.4 }),
    flame:new THREE.MeshBasicMaterial({ color:new THREE.Color(3.2,1.45,0.42), transparent:true, opacity:0.92, blending:THREE.AdditiveBlending, depthWrite:false, fog:false }),
    glow:new THREE.PointsMaterial({ map:glowTex(), size:MOBILE?3.4:4.2, color:0xffa050, transparent:true, opacity:0.85, blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true, fog:false }),
    pool:new THREE.MeshBasicMaterial({ map:poolTex(), color:0xffffff, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2, fog:false }),
    crystal:new THREE.MeshBasicMaterial({ color:new THREE.Color(2.0,2.0,2.0) }),
    void:new THREE.MeshBasicMaterial({ color:0x000000 }),
    mote:new THREE.PointsMaterial({ color:0xeef4ff, size:0.22, transparent:true, opacity:0.75, blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true, fog:false }) };
  return _mats; }
// a column of daylight: soft edges, drifting dust, brighter toward the roof, melting into the floor
function shaftMat(floor){ return new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, fog:false,
  uniforms:{ uT:CAVE.uT, uOp:{ value:MOBILE?0.26:0.3 }, uCol:{ value:new THREE.Color(0xd2e2ff) }, uFloor:{ value:floor }, uDust:{ value:detailTex() } },
  vertexShader:'varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vec4 mv=viewMatrix*w; vV=-mv.xyz; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*mv; }',
  fragmentShader:`uniform float uT,uOp,uFloor; uniform vec3 uCol; uniform sampler2D uDust; varying vec3 vN; varying vec3 vV; varying vec3 vW;
    void main(){ float a=pow(abs(dot(normalize(vN),normalize(vV))),2.0);
      float h=clamp((vW.y-uFloor)/60.0,0.0,1.0); a*=0.45+0.3*h;
      float d=texture2D(uDust, vW.xz*0.05+vec2(uT*0.011,uT*0.007)+vW.y*0.021).g*0.6+texture2D(uDust, vW.xz*0.13+vec2(-uT*0.02,uT*0.012)+vW.y*0.05).r*0.4;
      a*=0.45+0.95*d; a*=smoothstep(uFloor-0.2, uFloor+2.6, vW.y);
      gl_FragColor=vec4(uCol*a*uOp,1.0); }` }); }

// ---- geometry ----
let _G=null;
function geos(){ if(_G) return _G;
  const flame=new THREE.ConeGeometry(0.2, 0.85, 7, 1, true); flame.translate(0, 0.42, 0);
  const box=new THREE.BoxGeometry(1,1,1); box.translate(0,0.5,0);
  const bowl=new THREE.CylinderGeometry(0.85, 0.42, 0.55, 12); bowl.translate(0, 0.27, 0);
  const cry=new THREE.CylinderGeometry(0.17, 0.22, 1, 6); cry.translate(0,0.5,0); const tip=new THREE.ConeGeometry(0.17, 0.4, 6); tip.translate(0,1.2,0);
  const crystal=new THREE.BufferGeometry().copy(cry); { const a=cry.toNonIndexed(), b=tip.toNonIndexed(), pa=a.attributes.position.array, pb=b.attributes.position.array, P=new Float32Array(pa.length+pb.length); P.set(pa); P.set(pb, pa.length);
    crystal.setIndex(null); crystal.setAttribute('position', new THREE.BufferAttribute(P,3)); crystal.deleteAttribute('uv'); crystal.deleteAttribute('normal'); crystal.computeVertexNormals(); }
  const cone=new THREE.ConeGeometry(1, 1, 7); cone.translate(0,0.5,0);
  const pool=new THREE.PlaneGeometry(1,1); pool.rotateX(-Math.PI/2);
  return _G={ flame, box, bowl, crystal, cone, pool }; }
function pillarGeo(r, H){ const pts=[]; for(let i=0;i<=28;i++){ const t=i/28, w=r*(1+1.0*Math.pow(Math.max(0,1-t*4),2)+1.6*Math.pow(Math.max(0,(t-0.55)/0.45),2))*(0.92+0.1*Math.sin(t*19)); pts.push(new THREE.Vector2(w, t*H)); }
  const g=new THREE.LatheGeometry(pts, 20), p=g.attributes.position;
  for(let i=0;i<p.count;i++){ const x=p.getX(i), y=p.getY(i), z=p.getZ(i), a=Math.atan2(z,x), k=1+0.13*Math.sin(a*5+y*0.31)+0.07*Math.sin(a*11-y*0.73)+0.05*Math.sin(y*1.7+a*3); p.setX(i,x*k); p.setZ(i,z*k); }   // flowstone ribs
  g.computeVertexNormals(); return g; }

// ---- build (after the blocks: everything here keeps clear of them) ----
export function clearCavern(){ if(CAVE.g){ scene.remove(CAVE.g); CAVE.g.traverse(o=>{ if(o.isInstancedMesh) o.dispose(); if(o.geometry && o.userData.own) o.geometry.dispose(); if(o.material && o.userData.ownMat) o.material.dispose(); }); CAVE.g=null; }
  for(let i=blocks.length-1;i>=0;i--) if(blocks[i].kind==='pillar') blocks.splice(i,1);
  CAVE.torches.length=0; CAVE.pillars.length=0; CAVE.motes.length=0; for(const f of CAVE.fall) for(const r of f.rocks) r.m && scene.remove(r.m); CAVE.fall.length=0; CAVE.flames=null; CAVE.glow=null; CAVE.crystal=null;
  for(const l of CAVE.lights) l.visible=false; for(const s of CAVE.spots) s.visible=false; }
const clearOf=(x,z,r)=>!blocks.some(b=>(b.x-x)**2+(b.z-z)**2<(b.r+r)**2);
const nearMouth=(x,z,m)=>CAVE.mouths.some(q=>{ const a=Math.atan2(z,x); let da=Math.abs(a-q.a); da=Math.min(da,TAU-da); return da*Math.hypot(x,z)<q.w+(m||0); });
export function buildCavern(){ clearCavern(); if(!CAVE.on) return; const M=mats(), G=geos(), g=new THREE.Group(); CAVE.g=g; scene.add(g);
  const T=CAVE.torches, timber=[], bowls=[], C=CAVE_DEF;
  const post=(x,z,h,ry)=>{ const y=heightAt(x,z)-0.3; timber.push([x,y,z,0.24,h+0.3,0.24,ry||0,0]); return y+h+0.3; };
  // 1) torches on posts along the foot of the walls
  for(const q of fieldPath(C.torchStep*(MOBILE?1.5:1), 1.8)){ if(!clearOf(q.x,q.z,1.4) || nearMouth(q.x,q.z,4) || inZone(q.x,q.z,1)) continue;
    const top=post(q.x,q.z,2.6,Math.atan2(q.nx,q.nz)); timber.push([q.x-q.nx*0.3,top-0.35,q.z-q.nz*0.3,0.12,0.12,0.7,Math.atan2(q.nx,q.nz),0]); T.push({ x:q.x-q.nx*0.6, y:top-0.25, z:q.z-q.nz*0.6, k:1, ph:Math.random()*9 }); }
  // 2) torches along the rock ridges
  for(const rg of RIDGES){ for(let i=2;i<rg.pts.length;i+=6){ const [x0,z0]=rg.pts[i], [x1,z1]=rg.pts[Math.min(rg.pts.length-1,i+1)], L=Math.hypot(x1-x0,z1-z0)||1, sd=Math.random()<0.5?-1:1, x=x0-(z1-z0)/L*3.4*sd, z=z0+(x1-x0)/L*3.4*sd;
    if(!inField(x,z,3) || !clearOf(x,z,1.2)) continue; const top=post(x,z,2.4,Math.random()*3); T.push({ x, y:top+0.05, z, k:0.95, ph:Math.random()*9 }); } }
  // 3) old mine frames (two posts + a cap beam) out on the floor, a lantern-torch on one post
  for(let i=0, t=0; i<(MOBILE?8:14) && t<300; t++){ const x=R(-ARENA*0.8,ARENA*0.8), z=R(-ARENA*0.8,ARENA*0.7), ry=Math.random()*Math.PI;
    if(!inField(x,z,8) || Math.hypot(x,z)<30 || Math.hypot(x,z-ARENA*0.55)<26 || inZone(x,z,5) || !clearOf(x,z,4.5) || CAVE.shafts.some(s=>Math.hypot(s.x-x,s.z-z)<s.r+4)) continue;
    const cx=Math.cos(ry)*2.1, cz=-Math.sin(ry)*2.1; post(x+cx,z+cz,3.6,ry); const top=post(x-cx,z-cz,3.6,ry); timber.push([x,top,z,4.8,0.34,0.34,ry,0]);
    for(const s of [-1,1]) timber.push([x+cx*0.72*s,top-0.85,z+cz*0.72*s,0.16,1.3,0.16,ry,s*0.7]);
    T.push({ x:x+cx*1.08, y:top-0.4, z:z+cz*1.08, k:0.9, ph:Math.random()*9 }); i++; }
  // 4) braziers ringing the Core
  for(let k=0;k<C.braziers;k++){ const a=k/C.braziers*TAU+0.3, x=Math.cos(a)*17, z=Math.sin(a)*17; if(!clearOf(x,z,1.2)) continue; const gy=heightAt(x,z);
    for(let l=0;l<3;l++){ const la=l/3*TAU; timber.push([x+Math.cos(la)*0.45,gy,z+Math.sin(la)*0.45,0.1,1.5,0.1,-la,0.25]); } bowls.push([x,gy+1.35,z]); T.push({ x, y:gy+1.75, z, k:2.1, ph:Math.random()*9, big:true }); }
  for(let k=0;k<4;k++){ const a=k/4*TAU+0.78, x=Math.cos(a)*13, z=ARENA*0.55+Math.sin(a)*13; if(!clearOf(x,z,1.2) || !inField(x,z,2)) continue; const gy=heightAt(x,z);   // our own camp at the spawn: four braziers
    for(let l=0;l<3;l++){ const la=l/3*TAU; timber.push([x+Math.cos(la)*0.45,gy,z+Math.sin(la)*0.45,0.1,1.5,0.1,-la,0.25]); } bowls.push([x,gy+1.35,z]); T.push({ x, y:gy+1.75, z, k:1.8, ph:Math.random()*9, big:true }); }
  for(const e of CAVE.extra) T.push(e);
  // timber + iron
  const tim=new THREE.InstancedMesh(G.box, M.wood, timber.length||1); tim.count=timber.length; let k=0;
  for(const [x,y,z,sx,sy,sz,ry,rz] of timber){ _E.set(0,ry,rz); _Q.setFromEuler(_E); _M.compose(_V.set(x,y,z), _Q, _S.set(sx,sy,sz)); tim.setMatrixAt(k++, _M); }
  tim.castShadow=!MOBILE; tim.receiveShadow=true; g.add(tim);
  if(bowls.length){ const bw=new THREE.InstancedMesh(G.bowl, M.iron, bowls.length); bowls.forEach(([x,y,z],i)=>{ _M.compose(_V.set(x,y,z), _Q.identity(), _S.set(1,1,1)); bw.setMatrixAt(i,_M); }); g.add(bw); }
  // flames · glow halos · pools of light on the floor
  const fl=new THREE.InstancedMesh(G.flame, M.flame, T.length||1); fl.count=T.length; fl.frustumCulled=false; CAVE.flames=fl; g.add(fl);
  const gp=new Float32Array(T.length*3); T.forEach((t,i)=>{ gp[i*3]=t.x; gp[i*3+1]=t.y+0.35*t.k; gp[i*3+2]=t.z; });
  const gg=new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp,3)); const glow=new THREE.Points(gg, M.glow); glow.userData.own=true; glow.frustumCulled=false; CAVE.glow=glow; g.add(glow);
  const nCry=Math.round(C.crystals[MOBILE?1:0]), pools=[];
  for(const t of T) pools.push([t.x, t.z, t.big?13:8.5, 0xb8662a]);
  for(const s of CAVE.shafts) pools.push([s.x, s.z, s.r*2.5, 0x8ea8d8]);
  // 5) crystal veins at the foot of the walls (unlit, they glow by themselves → bloom), each throwing a cold pool
  const wallFoot=fieldPath(5, -0.6), cry=[], CC=[0x58e0ff, 0xa070ff, 0x40ffc8, 0x7aa8ff];
  for(let i=0;i<nCry;i++){ const q=wallFoot[(Math.random()*wallFoot.length)|0]; if(nearMouth(q.x,q.z,3)) continue; const col=CC[(Math.random()*CC.length)|0], n=4+((Math.random()*4)|0);
    for(let j=0;j<n;j++){ const x=q.x+R(-1.6,1.6)-q.nx*R(0,1.4), z=q.z+R(-1.6,1.6)-q.nz*R(0,1.4), s=R(0.7,2.6); cry.push([x,heightAt(x,z)-0.2,z,s,R(-0.5,0.5),R(-0.5,0.5),col]); }
    pools.push([q.x-q.nx*1.5, q.z-q.nz*1.5, 9, col]); }
  if(cry.length){ const cm=new THREE.InstancedMesh(G.crystal, M.crystal, cry.length), cc=new THREE.Color();
    cry.forEach(([x,y,z,s,rx,rz,col],i)=>{ _E.set(rx,Math.random()*TAU,rz); _Q.setFromEuler(_E); _M.compose(_V.set(x,y,z), _Q, _S.set(s*0.9,s,s*0.9)); cm.setMatrixAt(i,_M); cm.setColorAt(i, cc.setHex(col)); });
    CAVE.crystal=cm; g.add(cm); }
  { const pm=new THREE.InstancedMesh(G.pool, M.pool, pools.length||1), pc=new THREE.Color(); pm.count=pools.length; pm.renderOrder=2;
    pools.forEach(([x,z,r,col],i)=>{ _M.compose(_V.set(x, heightAt(x,z)+0.16, z), _Q.identity(), _S.set(r,1,r)); pm.setMatrixAt(i,_M); pm.setColorAt(i, pc.setHex(col).multiplyScalar(0.55)); });
    CAVE.pools=pm; g.add(pm); }
  // 6) the walls: a brow of boulders hanging over them, stalactites under the brow, stalagmites at their foot
  { const rs=rockSet(BIOME.name), brow=fieldPath(MOBILE?11:7.5, -8), im=new THREE.InstancedMesh(rs.big[1%rs.big.length], rs.mat, brow.length); let n=0;
    for(const q of brow){ const s=R(6,10.5); _E.set(R(-0.4,0.4),R(0,TAU),R(-0.4,0.4)); _Q.setFromEuler(_E); _M.compose(_V.set(q.x-q.nx*R(0,3), heightAt(q.x,q.z)+R(4,9), q.z-q.nz*R(0,3)), _Q, _S.set(s, s*R(0.6,0.9), s)); im.setMatrixAt(n++, _M); }
    im.count=n; im.receiveShadow=true; g.add(im);
    const st=[], hang=fieldPath(MOBILE?4.2:2.8, -2.5);
    for(const q of hang){ if(nearMouth(q.x,q.z,1)) continue; const L=R(4,15), r=R(0.5,1.6), y=R(27,33); st.push([q.x-q.nx*R(-1,1.5), y, q.z-q.nz*R(-1,1.5), r, -L]); }
    for(const q of fieldPath(MOBILE?6:3.6, -1.2)){ if(nearMouth(q.x,q.z,2) || Math.random()<0.35) continue; const h=R(1.6,7.5), r=R(0.45,1.4)*Math.min(1.4,h/4); st.push([q.x+R(-1,1), heightAt(q.x,q.z)-0.3, q.z+R(-1,1), r, h]); }
    const sm=new THREE.InstancedMesh(G.cone, M.rock, st.length); st.forEach(([x,y,z,r,h],i)=>{ _E.set(h<0?Math.PI:0, Math.random()*TAU, R(-0.06,0.06)); _Q.setFromEuler(_E); _M.compose(_V.set(x,y,z), _Q, _S.set(r,Math.abs(h),r)); sm.setMatrixAt(i,_M); });
    sm.castShadow=false; sm.receiveShadow=true; g.add(sm); }
  // 7) the shafts of daylight: a dusty column, a pool on the floor, motes turning in it
  for(const s of CAVE.shafts){ const gy=heightAt(s.x,s.z), H=96, geo=new THREE.CylinderGeometry(s.r*0.78, s.r*1.02, H, 40, 1, true); geo.translate(0, H/2, 0);
    const b=new THREE.Mesh(geo, shaftMat(gy)); b.userData.own=true; b.userData.ownMat=true; b.position.set(s.x, gy-0.5, s.z); b.renderOrder=6; b.frustumCulled=false; g.add(b);
    const nm=MOBILE?28:70, mp=new Float32Array(nm*3), seed=[]; for(let i=0;i<nm;i++){ const a=Math.random()*TAU, r=Math.sqrt(Math.random())*s.r*0.85; seed.push([Math.cos(a)*r, Math.sin(a)*r, R(0.4,26), R(0,9), R(0.15,0.5)]); }
    const mg=new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp,3)); const pts=new THREE.Points(mg, M.mote); pts.userData.own=true; pts.position.set(s.x, gy, s.z); pts.frustumCulled=false; g.add(pts);
    CAVE.motes.push({ pts, seed }); }
  // 8) colossal pillars, floor to roof
  const np=Math.round(R(C.pillars[0], C.pillars[1]+0.99)-0.49);
  for(let i=0, t=0; i<np && t<900; t++){ const r=R(3.2,4.4), x=R(-ARENA*0.8, ARENA*0.8), z=R(-ARENA*0.85, ARENA*0.2);
    if(!inField(x,z,r*2+4) || Math.hypot(x,z)<40 || Math.hypot(x,z-ARENA*0.55)<40 || inZone(x,z,r*1.5) || !clearOf(x,z,r*2+3) || CAVE.shafts.some(s=>Math.hypot(s.x-x,s.z-z)<s.r+r*2+4) || CAVE.pillars.some(p=>Math.hypot(p.x-x,p.z-z)<50)) continue;
    const mat=detailize(new THREE.MeshStandardMaterial({ color:0x726a5e, roughness:0.93, transparent:true }), { scale:0.1, bump:0.09, alb:0.42, streak:0.5 }); const m=new THREE.Mesh(pillarGeo(r, 90), mat); m.userData.own=true; m.userData.ownMat=true; m.position.set(x, heightAt(x,z)-0.6, z); m.castShadow=!MOBILE; m.receiveShadow=true; g.add(m);
    const P={ x, z, r, m, mat, op:1 }; CAVE.pillars.push(P); blocks.push({ mesh:m, x, z, r:r*1.75, hp:1e9, maxHp:1e9, steel:true, hard:false, loot:false, kind:'pillar' }); i++; }
  // the real lights (created once; shared by every cavern battle)
  const want=MOBILE?C.lights.mob:C.lights.desk; while(CAVE.lights.length<want){ const l=new THREE.PointLight(0xff9a48, 0, C.lights.range, 1.5); scene.add(l); CAVE.lights.push(l); }
  const ws=MOBILE?C.shaftLight.mob:C.shaftLight.desk; while(CAVE.spots.length<ws){ const sp=new THREE.SpotLight(0xdce8ff, 0, 140, 0.2, 0.75, 0); scene.add(sp); scene.add(sp.target); CAVE.spots.push(sp); }
  for(const l of CAVE.lights){ l.visible=true; l.userData.t=null; } CAVE.lightAt=0;
  CAVE.spots.forEach((sp,i)=>{ const s=CAVE.shafts[i]; sp.visible=!!s; if(!s) return; const gy=heightAt(s.x,s.z); sp.position.set(s.x, gy+90, s.z); sp.target.position.set(s.x, gy, s.z); sp.target.updateMatrixWorld(); sp.angle=Math.atan((s.r*1.25)/90); sp.intensity=C.shaftLight.I; });
  CAVE.next=0; }

// ---- per frame ----
const _cam=new THREE.Vector3();
export function updateCavern(dt, now){ if(!CAVE.on || !CAVE.g) return; const p=S.player, T=CAVE.torches, C=CAVE_DEF; CAVE.uT.value+=dt;
  // flames flicker (scale), the real lights ride the nearest torches
  const fl=CAVE.flames; if(fl){ for(let i=0;i<T.length;i++){ const t=T[i], f=0.82+0.16*Math.sin(now*9.3+t.ph)*Math.sin(now*6.1+t.ph*1.7)+0.07*Math.sin(now*23+t.ph); t.f=f;
      _E.set(0.08*Math.sin(now*5+t.ph), now*0.7+t.ph, 0.08*Math.sin(now*4.3+t.ph*2)); _Q.setFromEuler(_E); _M.compose(_V.set(t.x,t.y,t.z), _Q, _S.set(t.k*(0.9+0.12*f), t.k*f*(t.big?1.5:1.15), t.k*(0.9+0.12*f))); fl.setMatrixAt(i,_M); }
    fl.instanceMatrix.needsUpdate=true; CAVE.glow.material.opacity=0.78+0.1*Math.sin(now*7.7); }
  if(p && now>CAVE.lightAt){ CAVE.lightAt=now+0.3; const near=T.map(t=>[t, (t.x-p.pos.x)**2+(t.z-p.pos.z)**2]).filter(q=>q[1]<90*90).sort((a,b)=>a[1]-b[1]); CAVE.lights.forEach((l,i)=>{ const q=near[i]; l.userData.t=q?q[0]:null; }); }
  for(const l of CAVE.lights){ const t=l.userData.t; if(!t){ l.intensity=0; continue; } l.position.set(t.x, t.y+0.5*t.k, t.z); l.intensity=(t.big?C.lights.big:C.lights.I)*(t.f||1); l.distance=t.big?C.lights.range*1.4:C.lights.range; }
  if(CAVE.crystal) CAVE.crystal.material.color.setScalar(1.7+0.45*Math.sin(now*0.9));
  // motes drift in the shafts
  for(const M of CAVE.motes){ const a=M.pts.geometry.attributes.position, arr=a.array; for(let i=0;i<M.seed.length;i++){ const s=M.seed[i];
      arr[i*3]=s[0]+Math.sin(now*0.21*s[4]*3+s[3])*1.4; arr[i*3+1]=s[2]+Math.sin(now*s[4]+s[3])*1.2; arr[i*3+2]=s[1]+Math.cos(now*0.17*s[4]*3+s[3])*1.4; } a.needsUpdate=true; }
  // a pillar between the camera and the tank thins out so the tank stays in sight
  if(p){ _cam.copy(camera.position); const ax=p.pos.x-_cam.x, az=p.pos.z-_cam.z, L2=ax*ax+az*az||1;
    for(const P of CAVE.pillars){ const u=((P.x-_cam.x)*ax+(P.z-_cam.z)*az)/L2, cx=_cam.x+ax*u, cz=_cam.z+az*u, d=Math.hypot(P.x-cx, P.z-cz), hide=u>-0.15 && u<1.02 && d<P.r*2.3+3;
      P.op+=((hide?0.28:1)-P.op)*Math.min(1, dt*5); P.mat.opacity=P.op; const tr=P.op<0.985; if(P.mat.depthWrite===tr){ P.mat.depthWrite=!tr; } } }
  // water drips out of the dark; dust trickles from the roof after a heavy blast
  if(p && !MOBILE && now>CAVE.dripAt){ CAVE.dripAt=now+0.09; const x=p.pos.x+R(-26,26), z=p.pos.z+R(-22,18), y=heightAt(x,z);
    spawnPart(x, y+R(10,16), z, 0, -4, 0, { color:0xcfe4ff, size:0.08, life:0.85, grav:-24, drag:0 }); }
  if(p && S.shake>0.5 && now>CAVE.dustAt){ CAVE.dustAt=now+0.22; for(let i=0;i<(MOBILE?3:6);i++){ const x=p.pos.x+R(-24,24), z=p.pos.z+R(-20,16);
      spawnPart(x, heightAt(x,z)+R(7,12), z, R(-0.3,0.3), -2, R(-0.3,0.3), { color:0x9a9284, size:R(0.5,1.0), life:1.8, smoke:true, grav:-1.4, drag:0.6, grow:1.4, op:0.28 }); } }
  // the roof gives way
  if(S.mode==='playing' && p && !UNDER.on){ if(!CAVE.next) CAVE.next=now+R(C.caveIn.every[0], C.caveIn.every[1]); else if(now>CAVE.next){ CAVE.next=now+R(C.caveIn.every[0], C.caveIn.every[1]); caveIn(now); } }
  updateFall(dt, now); }

// ---- SẬP TRẦN: dust trickles at a spot near the tank (red ring), then rock comes down ----
export function caveIn(now){ const p=S.player; if(!p) return false; const C=CAVE_DEF.caveIn, f=p.facing??p.aimSmoothed??0; let x=0, z=0, ok=false;
  for(let t=0;t<20 && !ok;t++){ const a=f+R(-0.9,0.9), r=R(6,17); x=p.pos.x+Math.sin(a)*r; z=p.pos.z+Math.cos(a)*r; ok=inField(x,z,3) && Math.hypot(x,z)>14 && !CAVE.shafts.some(s=>Math.hypot(s.x-x,s.z-z)<s.r); }
  if(!ok) return false; const n=Math.round(R(C.rocks[0], C.rocks[1]+0.99)-0.49), rs=rockSet(BIOME.name), rocks=[];
  for(let i=0;i<n;i++){ const rx=x+R(-2.6,2.6), rz=z+R(-2.6,2.6), s=R(0.9,1.8), m=new THREE.Mesh(rs.big[i%rs.big.length], rs.mat); m.scale.setScalar(s); m.visible=false; m.castShadow=true; scene.add(m);
    rocks.push({ m, x:rx, z:rz, s, y:R(30,38), vy:0, delay:C.warn+i*0.22+R(0,0.15), land:false, t:0 }); }
  CAVE.fall.push({ x, z, t:0, pulse:0, rocks }); showBanner('SẬP TRẦN HANG!', '#ffb35a'); radio('SCH: Trần hang đang nứt — tránh chỗ bụi rơi!'); sfx('alarm'); return true; }
function updateFall(dt, now){ const p=S.player, C=CAVE_DEF.caveIn;
  for(let i=CAVE.fall.length-1;i>=0;i--){ const F=CAVE.fall[i]; F.t+=dt;
    if(F.t<C.warn+0.6){ F.pulse-=dt; if(F.pulse<=0){ F.pulse=0.35; ringPulse(_V.set(F.x,0,F.z), 0xff3a2a, C.R*0.8); }
      if(Math.random()<dt*24) spawnPart(F.x+R(-2.5,2.5), heightAt(F.x,F.z)+R(14,22), F.z+R(-2.5,2.5), 0, -3, 0, { color:0xa89e8c, size:R(0.5,1.2), life:1.6, smoke:true, grav:-3, drag:0.4, grow:1.4, op:0.45 });
      if(Math.random()<dt*10) spawnPart(F.x+R(-2,2), heightAt(F.x,F.z)+R(12,18), F.z+R(-2,2), 0, -6, 0, { color:0x6a6258, size:0.18, life:1.2, grav:-26, drag:0 }); }
    let alive=false;
    for(const r of F.rocks){ if(r.delay>0){ r.delay-=dt; alive=true; continue; } const gy=heightAt(r.x,r.z)+r.s*0.5;
      if(!r.land){ r.m.visible=true; r.vy-=34*dt; r.y+=r.vy*dt; r.m.rotation.x+=dt*2.5; r.m.rotation.z+=dt*1.7; alive=true;
        if(r.y<=gy){ r.y=gy; r.land=true; r.t=0; burst({ x:r.x, z:r.z }, 0x9a9284, 8, 6, { y:gy, life:1.6, size:2.4, smoke:true, grav:-0.3, drag:1.4, up:1.5, op:0.5 }); spawnDebris({ x:r.x, z:r.z }, 0.8*r.s, 0x6e665a);
          decalCrater(r.x, r.z, 1.2*r.s, 0.6); sfx('bigexplode', _V.set(r.x,0,r.z)); S.shake=Math.max(S.shake, 0.7);
          if(p && Math.hypot(p.pos.x-r.x, p.pos.z-r.z)<C.R*0.6+1.6) damagePlayer(C.dmg*r.s, now, p.pos.x-r.x, p.pos.z-r.z);
          for(const e of enemies){ if(e.def.air || e.hp<=0) continue; if(Math.hypot(e.pos.x-r.x, e.pos.z-r.z)<C.R*0.6+(e.r||1)) damageEnemy(e, 70*r.s); } }
        r.m.position.set(r.x, r.y, r.z); }
      else { r.t+=dt; if(r.t<6) alive=true; else { r.m.scale.multiplyScalar(Math.max(0, 1-dt*1.5)); if(r.m.scale.x>0.08) alive=true; else r.m.visible=false; } } }
    if(!alive){ for(const r of F.rocks) scene.remove(r.m); CAVE.fall.splice(i,1); } } }
// for flora: a spot inside one of the daylight shafts (the jungle grows in the light)
export function shaftSpot(){ const s=CAVE.shafts[(Math.random()*CAVE.shafts.length)|0]; if(!s) return null; const a=Math.random()*TAU, r=Math.sqrt(Math.random())*s.r*1.2; return [s.x+Math.cos(a)*r, s.z+Math.sin(a)*r]; }
