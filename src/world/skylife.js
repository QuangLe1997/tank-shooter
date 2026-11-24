// world/skylife.js — Z235 A LIVING SKY over the battlefield:
//   · SWALLOW FLOCKS over the hills (AMBIENCE.flock.swal): eight to twenty birds on a leader's path — circling a hilltop, a fort's crag, a knoll, a
//     ridge's crest or the land's own high points, darting on to the next, swooping and banking; now and then a flock sweeps low round the soldier.
//     Every bird trails the leader by its own lag (a turn runs back through the flock) at its own offset, weaving; they twitter as they go by
//     (audio/ambience.js), rise and scatter when a blast goes off near them
//   · SEAGULL FLOCKS (AMBIENCE.flock.gull): loose, gliding along the arctic shelf's edge out over the sea and round the icebergs, calling
//   · RAPTORS: a few big birds riding thermals high up, long glides on still wings, wide slow circles
//   · HIGH AIRCRAFT: now and then a big aircraft crosses the whole sky far above the fight, two white contrails behind it that hang, spread and
//     fade; at night only its navigation lights (red / green, the white strobe) blink across the stars
//   Birds are one instanced mesh per kind (the wings flap in the vertex shader; a per-bird gate beats them on a climb and holds them still in a dive),
//   so a whole kind is one draw.
import * as THREE from 'three';
import { AMBIENCE } from '../../config.js';
import { AMB, ARENA, BERGS, BIOME, CRESTS, FORTS, KNOLLS, MOBILE, S, ambienceCall, camera, fieldDepth, fieldR, heightAt, scene } from '../hub.js';

export const SKYLIFE = { biome:'', tod:'', sig:0, g:null, rapt:null, meshes:[], flocks:[], raptors:[], planes:[], planeAt:0, passAt:0, scareX:0, scareZ:0, scareT:-99 };
const BIRD_U = { uT:{ value:0 } };
const NO_BIRDS = new Set(['CAVERN','VOLCANO','FOUNDRY','STEELMILL']);
const _m=new THREE.Matrix4(), _q=new THREE.Quaternion(), _e=new THREE.Euler(0,0,0,'YXZ'), _p=new THREE.Vector3(), _s=new THREE.Vector3();
const rnd=(a, b)=>a+Math.random()*(b-a), pickR=r=>rnd(r[0], r[1]);

// a bird laid flat: nose +z, wings along x (|x| drives the flap); the swallow's forked tail, the gull's long bent wings with black tips
function birdGeo(kind){ const P=[], C=[], tri=(a,b,c,col)=>{ P.push(...a,...b,...c); for(let k=0;k<3;k++) C.push(...col); };
  const dark=[0.09,0.1,0.14], belly=[0.78,0.74,0.68], wing=kind==='swal'?[0.07,0.08,0.12]:[0.24,0.19,0.14], tip=kind==='swal'?[0.05,0.05,0.08]:[0.12,0.1,0.08];
  if(kind==='swal'){
    tri([0,0.02,0.2],[-0.045,0,0.02],[0.045,0,0.02],dark); tri([-0.045,0,0.02],[0,0.0,-0.13],[0.045,0,0.02],dark); tri([0,-0.015,0.18],[0.04,-0.01,0.0],[-0.04,-0.01,0.0],belly);   // body, white belly
    for(const s of [-1,1]){ tri([s*0.035,0,0.07],[s*0.2,0,0.03],[s*0.035,0,-0.04],wing); tri([s*0.2,0,0.03],[s*0.42,0,-0.1],[s*0.035,0,-0.04],tip);   // swept, pointed wings
      tri([s*0.012,0,-0.11],[s*0.08,0,-0.33],[s*0.03,0,-0.13],dark); } }                                                                          // the forked tail streamers
  else if(kind==='gull'){ const W=[0.92,0.93,0.94], G=[0.68,0.72,0.77], K=[0.07,0.07,0.08], Y=[0.86,0.7,0.22];
    tri([0,0.025,0.3],[-0.06,0,0.05],[0.06,0,0.05],W); tri([-0.06,0,0.05],[0,0,-0.26],[0.06,0,0.05],W); tri([0,0.02,0.3],[0.014,0.012,0.37],[-0.014,0.012,0.37],Y);   // white body, yellow bill
    for(const s of [-1,1]){ const A=[s*0.38,0.07,0.1], B=[s*0.56,0.035,0.07], Cc=[s*0.36,0.07,-0.04], D=[s*0.54,0.035,-0.03];
      tri([s*0.05,0,0.12],A,[s*0.05,0,-0.07],G); tri(A,Cc,[s*0.05,0,-0.07],G);                                                                  // the arm raised …
      tri(A,B,Cc,G); tri(B,D,Cc,G); tri(B,[s*0.74,-0.01,0.0],D,K); }                                                                             // … the hand bent down, its tip black (a gull's shallow M)
    tri([-0.07,0,-0.2],[0.07,0,-0.2],[0,0,-0.33],W); }                                                                                                // the white fan of the tail
  else {
    tri([0,0.03,0.32],[-0.08,0,0.02],[0.08,0,0.02],wing); tri([-0.08,0,0.02],[0,0,-0.24],[0.08,0,0.02],wing);
    for(const s of [-1,1]){ tri([s*0.06,0,0.12],[s*0.5,0,0.1],[s*0.06,0,-0.1],wing); tri([s*0.5,0,0.1],[s*0.95,0,0.0],[s*0.06,0,-0.1],tip);   // broad soaring wings, fingered tips
      tri([s*0.95,0,0.0],[s*1.05,0,-0.06],[s*0.6,0,-0.06],tip); }
    tri([-0.1,0,-0.2],[0.1,0,-0.2],[0,0,-0.42],wing); }                                                                                             // fan tail
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P,3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C,3)); g.computeVertexNormals(); return g; }
// the wings: bursts of beats between glides (rate rad/s, the glide gate, amp the flap's depth); aBird = (the bird's own bias −1 glide … +1 beat, its phase)
function birdMat(rate, glide, amp){ const m=new THREE.MeshLambertMaterial({ vertexColors:true, side:THREE.DoubleSide });
  m.onBeforeCompile=(sh)=>{ sh.uniforms.uT=BIRD_U.uT;
    sh.vertexShader=sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;\nattribute vec2 aBird;').replace('#include <begin_vertex>',
      `vec3 transformed=vec3(position);
       float ph=aBird.y, n0=sin(uT*0.9+ph*1.3)*0.5+0.5;
       float gate=smoothstep(${glide.toFixed(2)}, ${(glide+0.35).toFixed(2)}, clamp(n0+aBird.x, 0.0, 1.0));
       float fl=sin(uT*${rate.toFixed(1)}+ph*7.0)*gate, ax=abs(position.x);
       transformed.y+=fl*ax*${amp.toFixed(2)} + (1.0-gate)*ax*0.06; transformed.x*=1.0-0.12*abs(fl);`); };
  m.customProgramCacheKey=()=>'bird|'+rate+'|'+glide+'|'+amp;   // (each kind its own wingbeat: the shader text differs, the hook's source does not)
  return m; }
function phases(n){ const a=new Float32Array(n*2); for(let i=0;i<n;i++) a[i*2+1]=Math.random()*20; return new THREE.InstancedBufferAttribute(a, 2); }

// ---- where the flocks fly: the hills (forts' crags, knolls, crests, the land's own high points) · the sea edge (past the fence, round the bergs) ----
function hillAnchors(K){ const P=AMBIENCE.flock.peaks, A=[], st=P.grid, pts=[]; let sum=0, cnt=0;
  for(const f of FORTS) A.push({ x:f.x, z:f.z, top:heightAt(f.x, f.z), R:f.R+rnd(4, 14) });
  for(const k of KNOLLS) A.push({ x:k.x, z:k.z, top:heightAt(k.x, k.z), R:Math.max(12, Math.min(30, k.R*0.7)) });
  for(const c of CRESTS) A.push({ x:c.x, z:c.z, top:heightAt(c.x, c.z), R:pickR(K.R) });
  for(let z=-ARENA+st; z<ARENA; z+=st) for(let x=-ARENA+st; x<ARENA; x+=st){ if(fieldDepth(x, z)<P.edge) continue; const h=heightAt(x, z); sum+=h; cnt++;
    let top=true; for(let j=-1;j<=1 && top;j++) for(let i=-1;i<=1;i++) if((i||j) && heightAt(x+i*st, z+j*st)>h){ top=false; break; }
    if(top) pts.push({ x, z, h }); }
  const mean=cnt ? sum/cnt : 0; pts.sort((a, b)=>b.h-a.h);
  for(let i=0, n=0; i<pts.length && n<P.n; i++){ const p=pts[i]; if(p.h<mean+P.minH) break; if(A.some(q=>Math.hypot(q.x-p.x, q.z-p.z)<P.gap)) continue; A.push({ x:p.x, z:p.z, top:p.h, R:pickR(K.R) }); n++; }
  for(let t=0; t<60 && A.length<4; t++){ const x=(Math.random()*2-1)*ARENA*0.7, z=(Math.random()*2-1)*ARENA*0.7; if(fieldDepth(x, z)>30) A.push({ x, z, top:heightAt(x, z), R:pickR(K.R) }); }   // a flat field: somewhere to circle all the same
  for(const a of A) a.w=1+Math.max(0, a.top-mean)/6;   // the higher the likelier
  return A; }
function seaAnchors(K){ const A=[], n=14;
  for(let k=0;k<n;k++){ const a=(k+Math.random()*0.6)/n*6.283, r=fieldR(a), ca=Math.cos(a), sa=Math.sin(a), o=pickR(K.out); A.push({ x:ca*(r+o), z:sa*(r+o), top:heightAt(ca*(r-6), sa*(r-6)), R:pickR(K.R), w:1 }); }
  for(const b of BERGS) A.push({ x:b.x, z:b.z, top:b.top, R:b.rim(0)+b.moat(0)*0.6, w:K.berg, berg:true });
  return A; }

// ---- a flock: the leader's path is a function of time — an orbit round the anchor it visits, blended into the next one's on the way over — so a bird
//      lag s behind is simply the path lag s ago (plus its own offset and weave), and its heading, climb and bank are read off the path itself ----
function visit(F, A, t1, from){ const R=A.R, dir=Math.random()<0.5 ? -1 : 1, w=F.v/Math.max(6, R), th=Math.atan2(from.z-A.z, from.x-A.x);   // (it comes in on the side it arrives from)
  return { a:A, x:A.x, z:A.z, top:A.top, R, alt:A.alt ?? pickR(A.berg ? F.K.bergAlt : F.K.alt), dir, w, th0:th-dir*w*t1, sw:A.pass ? 0.4 : 1, pass:!!A.pass }; }
function orbitAt(F, V, t, o){ const K=F.K, th=V.th0+V.dir*V.w*t, r=V.R*(1+0.28*Math.sin(0.43*t+F.p1));
  o.x=V.x+Math.cos(th)*r+K.weave*Math.sin(1.1*t+F.p2); o.z=V.z+Math.sin(th)*r*(0.78+0.22*Math.sin(0.23*t+F.p3))+K.weave*Math.cos(0.9*t+F.p4);
  o.y=V.top+V.alt+K.swoop*V.sw*Math.sin(0.7*t+F.p5)*Math.sin(0.29*t+F.p1*1.7); return o; }
const _a={ x:0, y:0, z:0 }, P0={ x:0, y:0, z:0 }, P1={ x:0, y:0, z:0 }, P2={ x:0, y:0, z:0 };
function pathAt(F, t, o){ if(t>=F.t1 || !F.prev) return orbitAt(F, F.cur, t, o); if(t<=F.t0) return orbitAt(F, F.prev, t, o);
  orbitAt(F, F.prev, t, _a); orbitAt(F, F.cur, t, o); const u=(t-F.t0)/(F.t1-F.t0), s=u*u*(3-2*u);
  o.x=_a.x+(o.x-_a.x)*s; o.y=_a.y+(o.y-_a.y)*s; o.z=_a.z+(o.z-_a.z)*s; return o; }
// on to the next anchor (to = a given one: a low pass round the soldier, a gull crossing the field); a near-ish one other flocks are not at is likelier
function retarget(F, t, to){ let A=to;
  if(!A){ const P=AMBIENCE.flock.pick, busy=SKYLIFE.flocks.filter(q=>q!==F && q.kind===F.kind).map(q=>q.cur.a); let sum=0;
    const W=F.anchors.map(c=>{ if(c===F.cur.a || busy.includes(c)) return 0; const d=Math.hypot(c.x-F.lx, c.z-F.lz), w=(c.w||1)*(d>=P.near && d<=P.far ? 1 : P.off); sum+=w; return w; });
    let r=Math.random()*sum; A=F.anchors[0]; if(sum>0) for(let i=0;i<W.length;i++){ r-=W[i]; if(r<=0){ A=F.anchors[i]; break; } } }
  const d=Math.hypot(A.x-F.lx, A.z-F.lz), T=Math.min(14, Math.max(2.5, (d-A.R*0.5)/F.v*1.25));
  F.prev=F.cur; F.t0=t; F.t1=t+T; F.cur=visit(F, A, F.t1, { x:F.lx, z:F.lz }); F.until=F.t1+(A.pass ? pickR(F.K.pass.dur) : pickR(F.K.dwell)); }
function makeFlocks(kind, K, nF, size, anchors, t){ if(!anchors.length || nF<=0) return; const sizes=[]; for(let f=0;f<nF;f++) sizes.push(Math.round(pickR(size)));
  const N=sizes.reduce((a, b)=>a+b, 0), geo=birdGeo(kind); geo.setAttribute('aBird', phases(N));
  const mesh=new THREE.InstancedMesh(geo, birdMat(K.rate, K.glide, K.amp), N); mesh.frustumCulled=false; SKYLIFE.g.add(mesh); SKYLIFE.meshes.push(mesh);
  let base=0; for(const n of sizes){ const F={ kind, K, mesh, base, n, anchors, birds:[], v:pickR(K.v), p1:rnd(0, 6.3), p2:rnd(0, 6.3), p3:rnd(0, 6.3), p4:rnd(0, 6.3), p5:rnd(0, 6.3),
      lift:0, lagMax:K.lags[1]+0.25, callAt:0, lx:0, ly:0, lz:0, prev:null, cur:null, t0:-1e9, t1:-1e9, until:0 };
    for(let i=0;i<n;i++) F.birds.push(i===0 ? { lag:0, ox:0, oy:0, w1:0.8, w2:0.7, p1:0, p2:0 }
      : { lag:K.lags[0]+(K.lags[1]-K.lags[0])*Math.sqrt(Math.random()), ox:(Math.random()*2-1)*pickR(K.spread), oy:(Math.random()*2-1)*0.4*K.spread[1], w1:rnd(0.6, 1.6), w2:rnd(0.5, 1.3), p1:rnd(0, 6.3), p2:rnd(0, 6.3) });
    const busy=SKYLIFE.flocks.filter(q=>q.kind===kind).map(q=>q.cur.a), free=anchors.filter(a=>!busy.includes(a)), pool=free.length ? free : anchors, A0=pool[Math.random()*pool.length|0];
    F.lx=A0.x; F.lz=A0.z; F.ly=A0.top+10; F.cur=visit(F, A0, t, { x:A0.x+1, z:A0.z }); F.until=t+pickR(K.dwell)*Math.random();
    SKYLIFE.flocks.push(F); base+=n; } }
function worldSig(){ const f=FORTS[0]; return FORTS.length+KNOLLS.length*64+CRESTS.length*4096+BERGS.length*262144+(f ? f.x*0.731+f.z*0.317 : 0); }

function clearSkyLife(){ const L=SKYLIFE; if(L.g){ scene.remove(L.g); L.g.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); }); } L.g=null; L.rapt=null; L.meshes.length=0; L.flocks.length=0; L.raptors.length=0;
  for(const P of L.planes) scene.remove(P.root); L.planes.length=0; }
function buildSkyLife(){ clearSkyLife(); const L=SKYLIFE, night=S.tod==='night', g=new THREE.Group(), now=performance.now()/1000, FL=AMBIENCE.flock; L.g=g; scene.add(g);
  L.biome=BIOME.name; L.tod=S.tod; L.sig=worldSig(); L.planeAt=now+6+Math.random()*12; L.passAt=now+pickR(FL.swal.pass.first); if(BIOME.cave) return;
  const birds=!night && !NO_BIRDS.has(BIOME.name), cold=BIOME.name==='ARCTIC'||BIOME.name==='TUNDRA', W=FL.swal, G=FL.gull, nG=night ? 0 : (G.flocks[BIOME.name]||0);
  if(birds && W.biomes.includes(BIOME.name)) makeFlocks('swal', W, MOBILE ? W.phone.flocks : W.flocks, MOBILE ? W.phone.size : W.size, hillAnchors(W), now);
  if(nG) makeFlocks('gull', G, MOBILE ? Math.min(nG, G.phone.flocks) : nG, MOBILE ? G.phone.size : G.size, seaAnchors(G), now);
  if(birds || cold){ const nR=MOBILE?1:3, geo=birdGeo('rapt'); geo.setAttribute('aBird', phases(nR)); L.rapt=new THREE.InstancedMesh(geo, birdMat(7.0, 0.72, 0.85), nR); L.rapt.frustumCulled=false; g.add(L.rapt);
    for(let i=0;i<nR;i++) L.raptors.push({ cx:(Math.random()*2-1)*ARENA*0.5, cz:(Math.random()*2-1)*ARENA*0.5, R:28+Math.random()*40, a:Math.random()*6.283, w:(0.1+Math.random()*0.08)*(Math.random()<0.5?-1:1), y:34+Math.random()*24, k:2.2+Math.random()*0.8 }); } }
// guns going off near a flock send it up and away for a while
export function scareBirds(x, z){ const L=SKYLIFE; L.scareX=x; L.scareZ=z; L.scareT=performance.now()/1000; }
// the bird of a kind nearest a point (audio/ambience.js places a gull's call there)
export function flockBird(kind, E){ let best=null, bd=1e9; for(const F of SKYLIFE.flocks){ if(F.kind!==kind) continue; const d=Math.hypot(F.lx-E.x, F.lz-E.z); if(d<bd){ bd=d; best=F; } }
  return best ? { x:best.lx, y:best.ly, z:best.lz } : null; }

// ---- the high aircraft: a big four-engined silhouette, contrails, nav lights ----
const _trailMat=new THREE.MeshBasicMaterial({ vertexColors:true, transparent:true, depthWrite:false, fog:false, side:THREE.DoubleSide });
function planeMesh(night){ const g=new THREE.Group(), M=new THREE.MeshLambertMaterial({ color:night?0x30343a:0xb8bec6, emissive:night?0x000000:0x5a6068 }), D=new THREE.MeshLambertMaterial({ color:night?0x22252a:0x8a9098, emissive:night?0x000000:0x40464e });   // skylight on the undersides: a pale shape against the blue, not a black cut-out
  const body=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.2,34,10), M); body.rotation.x=Math.PI/2; g.add(body);
  const nose=new THREE.Mesh(new THREE.SphereGeometry(1.5,10,8), M); nose.position.z=17; nose.scale.z=1.8; g.add(nose);
  const wing=new THREE.Shape(); wing.moveTo(0,4); wing.lineTo(23,-5); wing.lineTo(23,-8.5); wing.lineTo(0,-5); wing.lineTo(-23,-8.5); wing.lineTo(-23,-5); wing.closePath();
  const wg=new THREE.ShapeGeometry(wing); wg.rotateX(Math.PI/2); const w=new THREE.Mesh(wg, D); w.position.y=-0.6; g.add(w);
  const tail=new THREE.Mesh(new THREE.BoxGeometry(14,0.3,3.6), D); tail.position.set(0,0.4,-15.5); g.add(tail); const fin=new THREE.Mesh(new THREE.BoxGeometry(0.3,7,4.6), D); fin.position.set(0,3.6,-15); fin.rotation.x=-0.35; g.add(fin);
  const eng=[]; for(const x of [-14,-7.5,7.5,14]){ const e=new THREE.Mesh(new THREE.CylinderGeometry(0.75,0.65,4.2,8), D); e.rotation.x=Math.PI/2; e.position.set(x,-1.3,-1.5+Math.abs(x)*-0.32); g.add(e); eng.push(e.position.clone()); }
  const lights=[]; for(const [x,c] of [[-23,0xff2a1a],[23,0x22ff6a],[0,0xffffff]]){ const s=new THREE.Mesh(new THREE.SphereGeometry(night?0.9:0.5,6,4), new THREE.MeshBasicMaterial({ color:c, fog:false })); s.position.set(x, x?-0.6:1.6, x?-6.8:-2); g.add(s); lights.push(s); }
  return { g, eng, lights }; }
function launchPlane(now){ const L=SKYLIFE, night=S.tod==='night', a=Math.random()*Math.PI*2, y=150+Math.random()*40, R=ARENA*1.75, sp=48+Math.random()*14;
  const off=(Math.random()-0.5)*ARENA*0.9, dx=-Math.cos(a), dz=-Math.sin(a), x0=Math.cos(a)*R-dz*off, z0=Math.sin(a)*R+dx*off;
  const P=planeMesh(night); P.g.position.set(x0,y,z0); P.g.rotation.y=Math.atan2(dx,dz); const root=new THREE.Group(); root.add(P.g); scene.add(root);
  const N=MOBILE?60:110, trails=[]; for(let k=0;k<2;k++){   // contrails (faint under the moon)
     const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N*2*3),3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N*2*4),4));
    const idx=[]; for(let i=0;i<N-1;i++){ const a0=i*2; idx.push(a0,a0+1,a0+2, a0+1,a0+3,a0+2); } geo.setIndex(idx); geo.setDrawRange(0,0);
    const m=new THREE.Mesh(geo, _trailMat); m.frustumCulled=false; m.renderOrder=-6; root.add(m); trails.push({ m, pts:[], side:k?1:-1 }); }
  L.planes.push({ root, P, vx:dx*sp, vz:dz*sp, t:0, life:R*2.3/sp, at:0, trails, night, N }); }
function updatePlanes(dt, now){ const L=SKYLIFE;
  if(S.mode==='playing' && now>L.planeAt && !BIOME.cave){ L.planeAt=now+(MOBILE?70:38)+Math.random()*40; launchPlane(now); }
  for(let i=L.planes.length-1;i>=0;i--){ const Q=L.planes[i], g=Q.P.g; Q.t+=dt; g.position.x+=Q.vx*dt; g.position.z+=Q.vz*dt;
    for(let k=0;k<Q.P.lights.length;k++){ const s=Q.P.lights[k]; s.visible = k<2 ? true : (Q.t%1.2)<0.08; }                                       // nav lights steady, strobe blinks
    Q.at-=dt; if(Q.at<=0){ Q.at=0.35; const c=Math.cos(g.rotation.y), sn=Math.sin(g.rotation.y);
      for(const T of Q.trails){ const lx=T.side*10.5, x=g.position.x+lx*c, z=g.position.z-lx*sn; T.pts.unshift({ x:x-Q.vx*0.12, y:g.position.y-1.3, z:z-Q.vz*0.12, t:Q.t }); if(T.pts.length>Q.N) T.pts.pop(); } }
    for(const T of Q.trails){ const pos=T.m.geometry.attributes.position, col=T.m.geometry.attributes.color, n=T.pts.length; if(n<2) continue; const tint=Q.night?0.42:1;
      for(let j=0;j<n;j++){ const p=T.pts[j], age=Q.t-p.t, q=T.pts[Math.min(n-1,j+1)], r=T.pts[Math.max(0,j-1)], dx=q.x-r.x, dz=q.z-r.z, L2=Math.hypot(dx,dz)||1, w=0.6+age*0.55, ox=-dz/L2*w, oz=dx/L2*w;
        pos.setXYZ(j*2, p.x+ox, p.y+age*0.15, p.z+oz); pos.setXYZ(j*2+1, p.x-ox, p.y+age*0.15, p.z-oz);
        const a=Math.min(1, age*3)*Math.max(0, 1-age/26)*0.62*tint; for(const v of [j*2, j*2+1]) col.setXYZW(v, 0.95*tint+0.05, 0.96*tint+0.04, tint, a); }
      pos.needsUpdate=true; col.needsUpdate=true; T.m.geometry.setDrawRange(0, (n-1)*6); }
    if(Q.t>Q.life+20){ scene.remove(Q.root); Q.root.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); L.planes.splice(i,1); } } }

// a flock this frame: on to the next anchor when its time is up (a swallow flock now and then sweeps low round the soldier, a gull flock across the
//   field), up and away from a blast, then every bird placed on the path lag s ago, banked into its turn, beating its wings on a climb
function updateFlock(F, t, dt, E){ const K=F.K, Sc=AMBIENCE.flock.scare, L=SKYLIFE, ab=F.mesh.geometry.attributes.aBird.array, p=S.player;
  const scared=t-L.scareT<Sc.t && Math.hypot(F.lx-L.scareX, F.lz-L.scareZ)<Sc.r;
  if(scared && F.lift<1) F.until=Math.min(F.until, t);
  if(t>=F.until && t>=F.t1+F.lagMax){ const P=K.pass;
    if(F.kind==='swal' && S.mode==='playing' && p && t>=L.passAt && AMB.heat<P.heat && !scared){ L.passAt=t+pickR(P.every); retarget(F, t, { x:p.pos.x, z:p.pos.z, top:heightAt(p.pos.x, p.pos.z), R:pickR(P.R), alt:pickR(P.alt), pass:true }); }
    else if(F.kind==='gull' && Math.random()<K.cross){ let x=0, z=0; for(let k=0;k<20;k++){ x=(Math.random()*2-1)*ARENA*0.6; z=(Math.random()*2-1)*ARENA*0.6; if(fieldDepth(x, z)>20) break; }
      retarget(F, t, { x, z, top:heightAt(x, z), R:pickR(K.R), alt:pickR(K.crossAlt) }); }
    else retarget(F, t); }
  if(F.cur.pass && p){ const k=Math.min(1, dt*0.4); F.cur.x+=(p.pos.x-F.cur.x)*k; F.cur.z+=(p.pos.z-F.cur.z)*k; F.cur.top=heightAt(F.cur.x, F.cur.z); }   // (the sweep keeps round him as he moves)
  F.lift+=((scared ? Sc.lift : 0)-F.lift)*Math.min(1, dt*(scared ? 1.5 : 0.25));
  const cx=camera.position.x, cy=camera.position.y, cz=camera.position.z, sc=K.scale, sd=K.scaleD, spread=1+F.lift*0.035;
  for(let i=0;i<F.n;i++){ const b=F.birds[i], tau=t-b.lag;
    pathAt(F, tau, P0); pathAt(F, tau-0.08, P1); pathAt(F, tau-0.16, P2);
    const vx=(P0.x-P1.x)*12.5, vy=(P0.y-P1.y)*12.5, vz=(P0.z-P1.z)*12.5, vh=Math.hypot(vx, vz)||1e-3, yaw=Math.atan2(vx, vz), yaw2=Math.atan2(P1.x-P2.x, P1.z-P2.z);
    const yr=Math.atan2(Math.sin(yaw-yaw2), Math.cos(yaw-yaw2))*12.5, c=Math.cos(yaw), s=Math.sin(yaw);
    const ox=(b.ox+K.jit*Math.sin(t*b.w1+b.p1))*spread, oy=(b.oy+0.6*Math.sin(t*b.w2+b.p2))*spread+F.lift;
    const x=P0.x+c*ox, z=P0.z-s*ox, g=heightAt(x, z)+K.low; let y=P0.y+oy; const m=y-g; if(m<2) y=g+(m>-2 ? (m+2)*(m+2)/8 : 0);   // (eased onto the least height over the ground, never through it)
    if(i===0){ F.lx=x; F.ly=y; F.lz=z; }
    const roll=Math.max(-K.bank, Math.min(K.bank, -0.8*Math.atan(vh*yr/9.8)))+0.1*Math.sin(t*b.w1*1.3+b.p2);   // banked into the turn as the turn is tight (never on a knife edge)
    _e.set(-Math.atan2(vy, vh)*0.8, yaw, roll); _q.setFromEuler(_e); _p.set(x, y, z);
    const k=Math.min(1, Math.max(0, (Math.hypot(x-cx, y-cy, z-cz)-sd[0])/(sd[1]-sd[0]))); _s.setScalar(sc[0]+(sc[1]-sc[0])*k);   // small up close, still readable far off
    _m.compose(_p, _q, _s); F.mesh.setMatrixAt(F.base+i, _m);
    ab[(F.base+i)*2]=scared ? 1 : Math.max(-1, Math.min(1, vy/2.5))+K.fly; }
  if(Math.hypot(F.lx-E.x, F.ly-E.y, F.lz-E.z)<K.call.r && t>=F.callAt){ F.callAt=t+pickR(K.call.cd); ambienceCall(F.kind==='swal' ? 'swallow' : 'gull', F.lx, F.ly, F.lz); } }

export function updateSkyLife(dt, now){ const L=SKYLIFE; if(BIOME.name!==L.biome || S.tod!==L.tod || worldSig()!==L.sig) buildSkyLife();
  BIRD_U.uT.value+=dt; updatePlanes(dt, now);
  const t=now;
  if(L.flocks.length){ const p=S.player, E=p && S.mode==='playing' ? p.pos : camera.position; for(const F of L.flocks) updateFlock(F, t, dt, E);
    for(const m of L.meshes){ m.instanceMatrix.needsUpdate=true; m.geometry.attributes.aBird.needsUpdate=true; } }
  if(L.rapt){ L.raptors.forEach((r,i)=>{ r.a+=r.w*dt; const x=r.cx+Math.cos(r.a)*r.R, z=r.cz+Math.sin(r.a)*r.R, y=r.y+Math.sin(t*0.2+i)*3;
      _e.set(0, Math.atan2(-Math.sin(r.a)*Math.sign(r.w), Math.cos(r.a)*Math.sign(r.w)), -Math.sign(r.w)*0.35); _q.setFromEuler(_e); _p.set(x,y,z); _s.setScalar(r.k); _m.compose(_p,_q,_s); L.rapt.setMatrixAt(i,_m); });
    L.rapt.instanceMatrix.needsUpdate=true; } }
