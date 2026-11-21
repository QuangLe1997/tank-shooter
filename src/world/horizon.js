// world/horizon.js — Z189 THE HORIZON (Z209 sculpted, lit, never the same twice): the battlefield is not alone in the world. Three rings of distant ranges fade into the haze (shaped and
//   coloured per battlefield: dunes, icy peaks, green hills, karst, a city skyline, smoking stacks, volcanic cones, marble mountains); the war
//   goes on out there — black smoke columns stand on the horizon over burning towns, gun flashes flicker along it, and jets scream across the sky.
import * as THREE from 'three';
import { ARENA, BIOME, MOBILE, REAL_CITY, S, SKY, hillDetail, realCityReady, realHorizon, scene, sfx, smokeTex2, spawnPart, windowLights } from '../hub.js';
import { REALCITY, SKYLINE, STONE } from '../../config.js';

export const HZN = { g:null, cols:[], flashes:[], jets:[], jetAt:0, flashAt:0, smokeTex:null, glowTex:null };
// per battlefield: [base colour, snow/highlight colour, shape kind, height (m)] — Z235 the green lands' ranges are forested blue-green, never the meadow's yellow-green
const LOOK = { DESERT:[0xa8885a,0xd8bc8a,'dune',38], SAVANNA:[0x8a6a40,0xb89a68,'mesa',46], TUNDRA:[0x5a6a78,0xf2f6fa,'peak',120], ARCTIC:[0x7a8ea4,0xffffff,'peak',140],
  MEADOW:[0x3a5644,0x6a8a62,'hill',58], HILLS:[0x34503e,0x62806a,'hill',90], VILLAGE:[0x2e4c40,0x58786a,'karst',110], CITADEL:[0x8a6a4a,0xc49a6a,'peak',85],
  RUINS:[0x5a5a5e,0x8a8a8e,'city',70], CITY:[0x4a5260,0x7a8494,'city',110], FOUNDRY:[0x4a423e,0x6a5e56,'stacks',80], STEELMILL:[0x4a3a32,0x6e5446,'stacks',90],
  VOLCANO:[0x2a2222,0x5a3a30,'volcano',150], QUARRY:[0x9a948a,0xf0ece2,'peak',110] };
function texes(){ if(!HZN.smokeTex){ HZN.smokeTex=smokeTex2(); const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'), g=x.createRadialGradient(32,32,0,32,32,32); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.4,'rgba(255,220,160,0.6)'); g.addColorStop(1,'rgba(255,160,60,0)'); x.fillStyle=g; x.fillRect(0,0,64,64); HZN.glowTex=new THREE.CanvasTexture(c); } }
// Z209 MAJESTIC RANGES: each ring is real relief, not a cut-out curtain — a band of terrain (depth rows × angle) whose crest wanders, raised into
//   a few designed HERO MASSIFS (placed fresh every match: no two horizons alike) over foothills, carved by ridged noise into arêtes and gullies;
//   lit by the sun (Lambert, smooth normals) so faces model in light and shadow; rock shows on steep slopes, snow caps the summits, and every
//   ring is hazed toward the fog colour by distance (aerial perspective). Mesas get cliffs + flat tops, karst rises in towers, volcanoes in a cone.
function hsh(i,j,s){ const h=Math.sin(i*127.1+j*311.7+s*74.7)*43758.5453; return h-Math.floor(h); }
function vn(x,y,s){ const i=Math.floor(x), j=Math.floor(y), fx=x-i, fy=y-j, u=fx*fx*(3-2*fx), v=fy*fy*(3-2*fy), a=hsh(i,j,s), b=hsh(i+1,j,s), c=hsh(i,j+1,s), d=hsh(i+1,j+1,s); return (a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v)*2-1; }
function fbm(x,y,s,o){ let t=0, A=0.5, f=1; for(let k=0;k<o;k++){ t+=A*vn(x*f,y*f,s+k*13); f*=2.03; A*=0.5; } return t; }
function ridged(x,y,s,o){ let t=0, A=0.5, f=1, w=1; for(let k=0;k<o;k++){ let n=1-Math.abs(vn(x*f,y*f,s+k*7)); n*=n; t+=n*A*w; w=Math.min(1,n*1.7); f*=2.1; A*=0.5; } return t; }
const wrapA=(d)=>Math.atan2(Math.sin(d),Math.cos(d));
function ring(R, H, kind, base, hi, fogC, mix, seed){ const skyC=SKY.material.uniforms.top.value.clone(); const n=MOBILE?160:360, rows=MOBILE?10:18, D=Math.max(28, H*0.85), sd=Math.random()*1000+seed*17;
  // hero massifs: a few big named-feeling mountains at random bearings, each its own width and height
  const heroes=[]; const nh=kind==='dune'?2:kind==='volcano'?1:3+((Math.random()*3)|0); for(let k=0;k<nh;k++) heroes.push({ a:Math.random()*Math.PI*2, w:_r(0.12,0.32), h:_r(0.55,1.0), c:_r(-0.35,0.35) });
  const peaky=kind==='peak'||kind==='volcano'||kind==='karst', snowy=peaky && (hi>0xe0e0e0), sharp=kind==='peak'?1.25:kind==='karst'?1.6:kind==='hill'?2.2:1.7;
  const env=(a,x,z)=>{ let e=0.32+0.3*(fbm(x*0.006,z*0.006,sd,3)*0.5+0.5); for(const q of heroes){ const d=wrapA(a-q.a)/q.w; e+=q.h*Math.exp(-d*d); } return e; };
  const crest=(a,x,z)=>{ let c=fbm(x*0.004+5,z*0.004,sd+3,2)*0.45; for(const q of heroes){ const d=wrapA(a-q.a)/q.w; c+=(q.c-c)*Math.exp(-d*d)*0.8; } return c; };
  const pos=new Float32Array((n+1)*rows*3), col=new Float32Array((n+1)*rows*3), hgt=new Float32Array((n+1)*rows), idx=[];
  for(let i=0;i<=n;i++){ const a=i/n*Math.PI*2, ca=Math.cos(a), sa=Math.sin(a), ex=ca*R, ez=sa*R, E=env(a,ex,ez), cr=crest(a,ex,ez);
    for(let j=0;j<rows;j++){ const t=-1+2*j/(rows-1), r=R+t*D, x=ca*r, z=sa*r; let y;
      let pf=Math.max(0, 1-Math.abs(t-cr)/0.95); pf=Math.pow(pf, sharp);
      if(kind==='mesa'){ const m=Math.max(0,1-Math.abs(t-cr)/0.8); pf= m>0.42 ? 1-0.04*fbm(x*0.05,z*0.05,sd,2) : Math.pow(m/0.42,3)*0.95; }
      if(kind==='dune') pf=Math.pow(Math.max(0, 1-Math.abs(t-cr)/1.0),1.6)*(0.85+0.15*Math.sin(x*0.04+z*0.03));
      const rg=ridged(x*0.018,z*0.018,sd+9,5), det=fbm(x*0.05,z*0.05,sd+21,3);
      y=H*E*pf*(peaky ? 0.55+0.7*rg : kind==='hill' ? 0.85+0.25*rg : 0.92+0.12*det);
      if(kind==='karst') y*=0.5+0.9*Math.pow(Math.abs(vn(x*0.035,z*0.035,sd+31)),0.5);
      if(kind==='volcano'){ const q=heroes[0], d=wrapA(a-q.a)/q.w, cone=Math.exp(-d*d*0.6)*Math.max(0,1-Math.abs(t-q.c)/0.9); y=Math.max(y*0.6, H*1.25*Math.pow(cone,1.1)); if(cone>0.92) y-=H*0.12*(cone-0.92)/0.08; }
      if(y>H) y=H+(y-H)*0.4;                                                                                   // summits soft-capped: majestic, not spikes
      y+=H*0.05*det*pf; if(j===0) y=-14; else if(j===rows-1) y=Math.min(y, H*0.15);
      const k=(i*rows+j); pos[k*3]=x; pos[k*3+1]=y; pos[k*3+2]=z; hgt[k]=y; }
    if(i<n) for(let j=0;j<rows-1;j++){ const k=i*rows+j, k2=k+rows; idx.push(k,k2,k+1, k+1,k2,k2+1); } }   // Z235 wound so the normals face up: the ranges were lit from underground (flat dark cut-outs)
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals();
  // colour: vegetation / ground low and on gentle slopes · rock on steep faces · snow above the snowline · then haze by distance (Z235: bluer and paler with each ring)
  const nrm=g.attributes.normal, cB=new THREE.Color(base), cR=new THREE.Color(base).lerp(new THREE.Color(0x6a6660), 0.55).multiplyScalar(0.85), cH=new THREE.Color(hi), cF=new THREE.Color(base).multiplyScalar(0.8), c=new THREE.Color(), snowLine=H*(snowy?0.5:0.8);
  for(let k=0;k<hgt.length;k++){ const y=hgt[k], ny=nrm.getY(k), steep=Math.min(1, Math.max(0, (0.86-ny)/0.3)); c.copy(cB).lerp(cR, peaky||kind==='mesa'?steep:steep*0.4);
    if(kind==='mesa' && steep>0.5) c.lerp(new THREE.Color(hi).multiplyScalar(0.8), 0.5*Math.abs(Math.sin(y*0.45)));   // banded cliff strata
    if((peaky || snowy) && y>snowLine){ const sn=Math.min(1,(y-snowLine)/(H*0.1))*(1-steep*(snowy?0.35:0.65)); c.lerp(cH, sn); }
    if(y<H*0.12) c.lerp(cF, 0.4); c.lerp(skyC, mix*0.2).lerp(fogC, 0.08+mix*0.42); col[k*3]=c.r; col[k*3+1]=c.g; col[k*3+2]=c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col,3));
  const m=new THREE.Mesh(g, hillDetail(new THREE.MeshLambertMaterial({ vertexColors:true, fog:false, emissive:fogC.clone().multiplyScalar(0.03+mix*0.16) }), BIOME.name, Math.max(0, (1-mix)*STONE.hills.near))); m.renderOrder=-8; m.frustumCulled=false; return m; }   // Z259 photographed detail, fading with the haze
const _r=(a,b)=>a+Math.random()*(b-a);
// a skyline: towers / stacks standing on the nearest ring
// Z264 a real skyline: the city's own Meshy towers (glass, apartment, mid-rise) stand round the horizon in their real colours, each scaled to its
//   slot's height and turned at random, set back past the old ring, hazed toward the fog in the shader (they keep the procedural ring's draw order); boxes until loaded
// Z268 no apartment slabs (their open ground floors read as floating), count / depth per ring · Z267 offices too, glass towers twice as often, a lighter veil (REALCITY.skyHaze) so they keep their glass and stone, and all of them in front of
//   the hill ring at R + 65 (behind it their feet were hidden and they floated on the ridge)
function realSkyline(R, H, fogC, mix, count, depth){ const keys=['bld_glass','bld_office','bld_glass','bld_office','bld_hotel'].filter(k=>REAL_CITY[k]); if(!keys.length) return null; const n=Math.round((count||56)*(MOBILE?0.55:1)), per={}, g=new THREE.Group();
  const a0=Math.random()*6.283; for(let i=0;i<n;i++){ const a=a0+(i+0.15+Math.random()*0.7)/n*Math.PI*2, r=R+8+Math.random()*(depth||48),   // Z289 spread evenly round the ring (jittered): no clumps, no empty gaps of sky
    h=H*(0.3+Math.random()*0.75), k=keys[(Math.random()*keys.length)|0]; (per[k]=per[k]||[]).push([a,r,h]); }
  const M4=new THREE.Matrix4(), Q=new THREE.Quaternion(), V=new THREE.Vector3(), S3=new THREE.Vector3(), up=new THREE.Vector3(0,1,0);
  for(const [k,list] of Object.entries(per)){ const Mo=REAL_CITY[k], mat=Mo.mat.clone(); mat.fog=false; const hz={ value:Math.max(REALCITY.skyHaze, mix) }, hc={ value:fogC.clone() };
    mat.onBeforeCompile=sh=>{ sh.uniforms.hzAmt=hz; sh.uniforms.hzCol=hc; sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float hzAmt; uniform vec3 hzCol;').replace('#include <dithering_fragment>','#include <dithering_fragment>\n gl_FragColor.rgb = mix(gl_FragColor.rgb, hzCol, hzAmt);'); };
    mat.customProgramCacheKey=()=>'skylineHaze'; windowLights(mat);   // Z280 the skyline's windows light up at night too
    const im=new THREE.InstancedMesh(Mo.geo, mat, list.length); list.forEach(([a,r,h],i)=>{ const s=h/Mo.size.y; im.setMatrixAt(i, M4.compose(V.set(Math.cos(a)*r, -6, Math.sin(a)*r), Q.setFromAxisAngle(up, Math.random()*6.283), S3.set(s,s,s))); });
    im.instanceMatrix.needsUpdate=true; im.frustumCulled=false; im.renderOrder=-7; g.add(im); }
  return g; }
function skyline(R, H, kind, base, fogC, mix, onlyStacks){ if(kind==='city' && realCityReady() && !MOBILE && !onlyStacks){   // Z292 phones keep the hazed block skyline: ~150 real towers would cost them 2–3M triangles
  const rs=realSkyline(R, H*1.15, fogC, Math.min(0.85, mix+0.12)); if(rs) return rs; }
  const n=onlyStacks?SKYLINE.stacks:MOBILE?40:70, geos=[], c=new THREE.Color(onlyStacks?0x8e877e:base).lerp(fogC, mix);   // Z383 onlyStacks: the works' chimneys alone, among the real tanks and towers (scenery.js realHorizon)
  const a0=Math.random()*6.283; for(let i=0;i<n;i++){ const a=a0+(i+0.15+Math.random()*0.7)/n*Math.PI*2, r=R+(Math.random()-0.5)*30,   // Z289 evenly round, jittered
    w=onlyStacks?5+Math.random()*3.5:kind==='stacks'?3+Math.random()*3:8+Math.random()*16, h=kind==='stacks'?H*(0.6+Math.random()*0.8):H*(0.25+Math.random()*0.75);
    const g=kind==='stacks' && (onlyStacks || Math.random()<0.6) ? new THREE.CylinderGeometry(w*0.4,w*0.55,h,onlyStacks?14:8) : new THREE.BoxGeometry(w,h,w*(0.6+Math.random()*0.8)); g.translate(Math.cos(a)*r, h/2-6, Math.sin(a)*r); g.rotateY(0); geos.push(g); }
  const merged=mergeGeos(geos); if(onlyStacks) merged.computeVertexNormals(); const m=new THREE.Mesh(merged, onlyStacks ? new THREE.MeshLambertMaterial({ color:c, fog:false }) : new THREE.MeshBasicMaterial({ color:c, fog:false })); m.renderOrder=-7; m.frustumCulled=false; return m; }   // (lit, beside the lit models)
function mergeGeos(list){ let n=0; for(const g of list) n+=g.toNonIndexed().attributes.position.count; const out=new Float32Array(n*3); let o=0;
  for(const g0 of list){ const g=g0.toNonIndexed(), p=g.attributes.position.array; out.set(p,o); o+=p.length; g.dispose(); g0.dispose(); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(out,3)); return g; }
export function clearHorizon(){ if(HZN.g){ scene.remove(HZN.g); HZN.g.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material && !o.material.map) o.material.dispose(); }); } HZN.g=null; HZN.cols.length=0; HZN.flashes.length=0; }
export function buildHorizon(b){ clearHorizon(); if(b.cave) return; texes(); const L=LOOK[b.name]||LOOK.DESERT, fogC=scene.fog.color.clone(), g=new THREE.Group(); HZN.g=g; scene.add(g);
  const R0=ARENA*1.55, kind=L[2], H=L[3]*(MOBILE?0.85:1);
  let SK=!MOBILE && SKYLINE.on && !/noscene/.test(location.search+location.hash) && SKYLINE.biomes[b.name]; if(typeof SK==='string') SK=SKYLINE.biomes[SK]; const real=!!(SK && SK.skyline);   // Z383 the scanned summits, forests, ruins and works on this horizon (desktop); real = they are its near skyline
  const rk = SK && SK.rings || (kind==='city'||kind==='stacks' ? 'hill' : kind);   // behind a skyline there are still hills (Z383 or the ranges the real horizon asks for)
  const flatCity = kind==='city' && realCityReady() && REALCITY.flatHorizon;   // Z268 Saigon is flat: no peaks behind the city, more city fading into the haze instead
  if(flatCity){ for(const [dr, hk, hz, n, dp] of REALCITY.flatHorizon){ const s=realSkyline(R0+dr, H*hk, fogC, hz, n, dp); if(s) g.add(s); } }
  else { g.add(ring(R0+170, H*1.35, rk==='dune'?'mesa':rk==='hill'?'peak':rk, L[0], L[1], fogC, 0.8, 3));   // far: tallest, palest
  g.add(ring(R0+95,  H*1.05, rk, L[0], L[1], fogC, 0.52, 2)); }   // Z259 a little less haze
  if(SK) Promise.resolve().then(()=>realHorizon(g, b.name, R0, fogC));   // (a tick later: the first horizon is built while the modules are still loading)
  if(kind==='city'||kind==='stacks'){ if(!real) g.add(skyline(R0+30, H, kind, L[0], fogC, 0.42)); else if(kind==='stacks') g.add(skyline(R0+30, H, kind, L[0], fogC, 0.42, true)); } else if(!real) g.add(ring(R0+30, H*0.7, rk, L[0], L[1], fogC, 0.3, 1));   // near: darkest, crispest (Z259 less haze: its photo detail reads)
  // the war beyond the hills: smoke columns rising over burning places
  const nC=MOBILE?3:6; for(let i=0;i<nC;i++){ const a=Math.random()*Math.PI*2, r=R0+20+Math.random()*90, x=Math.cos(a)*r, z=Math.sin(a)*r, col=new THREE.Group(); col.position.set(x,0,z); g.add(col);
    const parts=[]; for(let k=0;k<7;k++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({ map:HZN.smokeTex, color:new THREE.Color(0x1c1814).lerp(fogC,0.35+k*0.06), transparent:true, opacity:0.85-k*0.08, depthWrite:false, fog:false })); s.position.y=8+k*16; s.scale.setScalar(18+k*9); col.add(s); parts.push(s); }
    const fire=new THREE.Sprite(new THREE.SpriteMaterial({ map:HZN.glowTex, color:0xff7a2a, transparent:true, opacity:0.8, blending:THREE.AdditiveBlending, depthWrite:false, fog:false })); fire.position.y=3; fire.scale.set(26,12,1); col.add(fire);
    HZN.cols.push({ col, parts, fire, ph:Math.random()*10 }); }
  // horizon gun flashes (pooled)
  for(let i=0;i<4;i++){ const f=new THREE.Sprite(new THREE.SpriteMaterial({ map:HZN.glowTex, color:0xffb060, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, fog:false })); g.add(f); HZN.flashes.push({ s:f, t:0 }); }
  HZN.jetAt=performance.now()/1000+8+Math.random()*10; }
// jets: a pair that screams over the field at low level, contrails behind
function jetMesh(){ const g=new THREE.Group(), M=new THREE.MeshStandardMaterial({ color:0x5a626a, roughness:0.5, metalness:0.6 });
  const f=new THREE.Mesh(new THREE.ConeGeometry(0.9,11,8), M); f.rotation.x=Math.PI/2; g.add(f); const w=new THREE.Mesh(new THREE.BoxGeometry(10,0.25,3.2), M); w.position.z=-1; g.add(w);
  const t=new THREE.Mesh(new THREE.BoxGeometry(4,0.2,1.6), M); t.position.z=-4.6; g.add(t); const fin=new THREE.Mesh(new THREE.BoxGeometry(0.2,2.2,1.8), M); fin.position.set(0,1.1,-4.4); g.add(fin);
  const ab=new THREE.Sprite(new THREE.SpriteMaterial({ map:HZN.glowTex, color:0xffa050, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false })); ab.scale.setScalar(3.4); ab.position.z=-6; g.add(ab); return g; }
function launchJets(now){ const a=Math.random()*Math.PI*2, R=ARENA*1.9, y=48+Math.random()*18, sp=95, dx=-Math.cos(a), dz=-Math.sin(a), off=(Math.random()-0.5)*ARENA*0.6;
  for(let k=0;k<2;k++){ const m=jetMesh(), px=-dz*(off+k*9), pz=dx*(off+k*9); m.position.set(Math.cos(a)*R+px, y+k*3, Math.sin(a)*R+pz); m.rotation.y=Math.atan2(dx,dz); m.rotation.z=(k?-1:1)*0.15; scene.add(m);
    HZN.jets.push({ m, vx:dx*sp, vz:dz*sp, t:0, life:R*2/sp, delay:k*0.35 }); }
  setTimeout(()=>sfx('jet'), 900); }
export function updateHorizon(dt, now){ if(!HZN.g) return;
  for(const c of HZN.cols){ c.parts.forEach((s,k)=>{ s.position.x=Math.sin(now*0.15+c.ph+k*0.7)*k*1.6; s.material.rotation+=dt*0.03*(k%2?1:-1); }); c.fire.material.opacity=0.55+0.3*Math.sin(now*7+c.ph)+0.15*Math.random(); }
  if(now>HZN.flashAt){ HZN.flashAt=now+0.8+Math.random()*2.8; const f=HZN.flashes.find(q=>q.t<=0); if(f){ const a=Math.random()*Math.PI*2, r=ARENA*1.55+40+Math.random()*130; f.s.position.set(Math.cos(a)*r, 4+Math.random()*10, Math.sin(a)*r); f.s.scale.setScalar(24+Math.random()*40); f.t=0.28; } }
  for(const f of HZN.flashes){ if(f.t>0){ f.t-=dt; f.s.material.opacity=Math.max(0, f.t/0.28)*0.95; } }
  if(S.mode==='playing' && now>HZN.jetAt){ HZN.jetAt=now+(MOBILE?45:28)+Math.random()*25; launchJets(now); }
  for(let i=HZN.jets.length-1;i>=0;i--){ const j=HZN.jets[i]; if(j.delay>0){ j.delay-=dt; continue; } j.t+=dt; j.m.position.x+=j.vx*dt; j.m.position.z+=j.vz*dt;
    if(Math.random()<(MOBILE?0.5:0.95)){ const p=j.m.position; spawnPart(p.x-j.vx*0.06, p.y, p.z-j.vz*0.06, 0, 0, 0, { color:0xf0f2f4, size:1.4, life:3.2, smoke:true, grav:0, drag:0.2, grow:2.4, op:0.45 }); }
    if(j.t>j.life){ scene.remove(j.m); j.m.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); HZN.jets.splice(i,1); } } }
