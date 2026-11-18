// world/skylife.js — Z235 A LIVING SKY over the battlefield:
//   · SWALLOWS: flocks that hunt low over the field — quick wingbeats broken by glides, sharp banked turns, dives and pull-ups, each bird
//     weaving round its flock's moving centre (never in lockstep); they rise and scatter when the guns get close
//   · RAPTORS: a few big birds riding thermals high up, long glides on still wings, wide slow circles
//   · HIGH AIRCRAFT: now and then a big aircraft crosses the whole sky far above the fight, two white contrails behind it that hang, spread and
//     fade; at night only its navigation lights (red / green, the white strobe) blink across the stars
//   Birds are one instanced mesh per kind (wings flap in the vertex shader), so a whole flock is one draw.
import * as THREE from 'three';
import { ARENA, BIOME, MOBILE, S, scene } from '../hub.js';

export const SKYLIFE = { key:'', g:null, swal:null, rapt:null, flocks:[], raptors:[], planes:[], planeAt:0, scareX:0, scareZ:0, scareT:0 };
const BIRD_U = { uT:{ value:0 } };
const NO_BIRDS = new Set(['CAVERN','VOLCANO','FOUNDRY','STEELMILL']);
const _m=new THREE.Matrix4(), _q=new THREE.Quaternion(), _e=new THREE.Euler(0,0,0,'YXZ'), _p=new THREE.Vector3(), _s=new THREE.Vector3();

// a bird laid flat: nose +z, wings along x (|x| drives the flap), forked tail for the swallow
function birdGeo(kind){ const P=[], C=[], tri=(a,b,c,col)=>{ P.push(...a,...b,...c); for(let k=0;k<3;k++) C.push(...col); };
  const dark=[0.09,0.1,0.14], belly=[0.78,0.74,0.68], wing=kind==='swal'?[0.07,0.08,0.12]:[0.24,0.19,0.14], tip=kind==='swal'?[0.05,0.05,0.08]:[0.12,0.1,0.08];
  if(kind==='swal'){
    tri([0,0.02,0.2],[-0.045,0,0.02],[0.045,0,0.02],dark); tri([-0.045,0,0.02],[0,0.0,-0.13],[0.045,0,0.02],dark); tri([0,-0.015,0.18],[0.04,-0.01,0.0],[-0.04,-0.01,0.0],belly);   // body, white belly
    for(const s of [-1,1]){ tri([s*0.035,0,0.07],[s*0.2,0,0.03],[s*0.035,0,-0.04],wing); tri([s*0.2,0,0.03],[s*0.42,0,-0.1],[s*0.035,0,-0.04],tip);   // swept, pointed wings
      tri([s*0.012,0,-0.11],[s*0.08,0,-0.33],[s*0.03,0,-0.13],dark); } }                                                                          // the forked tail streamers
  else {
    tri([0,0.03,0.32],[-0.08,0,0.02],[0.08,0,0.02],wing); tri([-0.08,0,0.02],[0,0,-0.24],[0.08,0,0.02],wing);
    for(const s of [-1,1]){ tri([s*0.06,0,0.12],[s*0.5,0,0.1],[s*0.06,0,-0.1],wing); tri([s*0.5,0,0.1],[s*0.95,0,0.0],[s*0.06,0,-0.1],tip);   // broad soaring wings, fingered tips
      tri([s*0.95,0,0.0],[s*1.05,0,-0.06],[s*0.6,0,-0.06],tip); }
    tri([-0.1,0,-0.2],[0.1,0,-0.2],[0,0,-0.42],wing); }                                                                                             // fan tail
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P,3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C,3)); g.computeVertexNormals(); return g; }
function birdMat(rate, glide){ const m=new THREE.MeshLambertMaterial({ vertexColors:true, side:THREE.DoubleSide });
  m.onBeforeCompile=(sh)=>{ sh.uniforms.uT=BIRD_U.uT;
    sh.vertexShader=sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;').replace('#include <begin_vertex>',
      `vec3 transformed=vec3(position);
       float ph=instanceMatrix[3].x*0.37+instanceMatrix[3].z*0.61+instanceMatrix[3].y*0.23;
       float gate=smoothstep(${glide.toFixed(2)}, ${(glide+0.35).toFixed(2)}, sin(uT*0.9+ph*1.3)*0.5+0.5);   // bursts of wingbeats between glides
       float fl=sin(uT*${rate.toFixed(1)}+ph*7.0)*gate, ax=abs(position.x);
       transformed.y+=fl*ax*0.85 + (1.0-gate)*ax*0.06; transformed.x*=1.0-0.12*abs(fl);`); };
  return m; }

function clearSkyLife(){ const L=SKYLIFE; if(L.g){ scene.remove(L.g); L.g.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); } L.g=null; L.swal=null; L.rapt=null; L.flocks.length=0; L.raptors.length=0;
  for(const P of L.planes) scene.remove(P.root); L.planes.length=0; }
function buildSkyLife(){ clearSkyLife(); const L=SKYLIFE, night=S.tod==='night', g=new THREE.Group(); L.g=g; scene.add(g);
  L.planeAt=performance.now()/1000+6+Math.random()*12; if(BIOME.cave) return;
  const birds=!night && !NO_BIRDS.has(BIOME.name), cold=BIOME.name==='ARCTIC'||BIOME.name==='TUNDRA';
  if(birds && !cold){ const nF=MOBILE?2:3, per=MOBILE?8:14; L.swal=new THREE.InstancedMesh(birdGeo('swal'), birdMat(26.0, 0.42), nF*per); L.swal.frustumCulled=false; g.add(L.swal);
    for(let f=0;f<nF;f++){ const hx=(Math.random()*2-1)*ARENA*0.55, hz=(Math.random()*2-1)*ARENA*0.55, birdsOf=[];
      for(let i=0;i<per;i++) birdsOf.push({ r:3+Math.random()*9, th:Math.random()*6.283, w:(0.9+Math.random()*1.4)*(Math.random()<0.5?-1:1), dy:Math.random()*6.283, h:1+Math.random()*3, ph:Math.random()*20, px:0, py:0, pz:0, roll:0 });
      L.flocks.push({ hx, hz, R:22+Math.random()*30, sp:0.08+Math.random()*0.07, a0:Math.random()*6.283, alt:5+Math.random()*5, birds:birdsOf, lift:0, base:f*per }); } }
  if(birds || cold){ const nR=MOBILE?1:3; L.rapt=new THREE.InstancedMesh(birdGeo('rapt'), birdMat(7.0, 0.72), nR); L.rapt.frustumCulled=false; g.add(L.rapt);
    for(let i=0;i<nR;i++) L.raptors.push({ cx:(Math.random()*2-1)*ARENA*0.5, cz:(Math.random()*2-1)*ARENA*0.5, R:28+Math.random()*40, a:Math.random()*6.283, w:(0.1+Math.random()*0.08)*(Math.random()<0.5?-1:1), y:34+Math.random()*24, k:2.2+Math.random()*0.8 }); }
  L.key=BIOME.name+'|'+S.tod; }
// guns going off near a flock send it up and away for a while
export function scareBirds(x, z){ const L=SKYLIFE; L.scareX=x; L.scareZ=z; L.scareT=performance.now()/1000; }

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

export function updateSkyLife(dt, now){ const L=SKYLIFE; const key=BIOME.name+'|'+S.tod; if(key!==L.key) buildSkyLife();
  BIRD_U.uT.value+=dt; updatePlanes(dt, now);
  const t=now, scared=now-L.scareT<6;
  if(L.swal){ for(const F of L.flocks){ const a=F.a0+t*F.sp;
      const cx=F.hx+Math.cos(a)*F.R+Math.sin(t*0.37+F.a0)*8, cz=F.hz+Math.sin(a*1.3)*F.R*0.7, dS=Math.hypot(cx-L.scareX, cz-L.scareZ);
      F.lift+=((scared && dS<45 ? 22 : 0)-F.lift)*Math.min(1, dt*(scared?1.5:0.25));
      F.birds.forEach((b,i)=>{ const th=b.th+t*b.w, dive=Math.sin(t*0.8+b.dy)*Math.sin(t*0.31+b.dy*2.0);
        const x=cx+Math.cos(th)*b.r+Math.sin(t*1.7+b.ph)*1.5, z=cz+Math.sin(th)*b.r*0.8+Math.cos(t*1.3+b.ph)*1.5, y=F.alt+b.h+dive*3.2+F.lift;
        const vx=x-b.px, vy=y-b.py, vz=z-b.pz, sp=Math.hypot(vx,vz)||1e-4, yaw=Math.atan2(vx,vz), turn=b.yaw==null?0:Math.atan2(Math.sin(yaw-b.yaw),Math.cos(yaw-b.yaw));
        b.roll+=(Math.max(-1.1,Math.min(1.1,-turn/Math.max(dt,1e-3)*0.09))-b.roll)*Math.min(1,dt*6); b.yaw=yaw; b.px=x; b.py=y; b.pz=z;
        _e.set(-Math.atan2(vy, sp)*0.8, yaw, b.roll); _q.setFromEuler(_e); _p.set(x,y,z); _s.setScalar(2.4); _m.compose(_p,_q,_s); L.swal.setMatrixAt(F.base+i, _m); }); }
    L.swal.instanceMatrix.needsUpdate=true; }
  if(L.rapt){ L.raptors.forEach((r,i)=>{ r.a+=r.w*dt; const x=r.cx+Math.cos(r.a)*r.R, z=r.cz+Math.sin(r.a)*r.R, y=r.y+Math.sin(t*0.2+i)*3;
      _e.set(0, Math.atan2(-Math.sin(r.a)*Math.sign(r.w), Math.cos(r.a)*Math.sign(r.w)), -Math.sign(r.w)*0.35); _q.setFromEuler(_e); _p.set(x,y,z); _s.setScalar(r.k); _m.compose(_p,_q,_s); L.rapt.setMatrixAt(i,_m); });
    L.rapt.instanceMatrix.needsUpdate=true; } }
