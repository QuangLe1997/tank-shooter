// world/whirlwinds.js — Z229 WIND ON THE LAND
//   · DUST DEVILS: every so often, out on the open ground, a whirl spins up — a thin twisting column of grit that snakes and leans as it climbs,
//     a skirt of dust racing round its foot, bits of debris whirled up the funnel. It wanders with the wind, grows, and dies away; never the same
//     twice (size, spin, lean, path, life all random). On snow it is a snow devil; in the green lands it whirls leaves and chaff.
//     Infantry it passes over are buffeted, and if it crosses our tank the grit sprays across the hull.
//   · AVALANCHE (snow battlefields): a cornice breaks off the mountains at the field's edge — a rumble, then a churning front of snow powder
//     pours across the field, burying men, battering vehicles, leaving drifts behind it.
import * as THREE from 'three';
import { AVALANCHE, WHIRL } from '../../config.js';
import { BIOME, FT, MOBILE, S, UNDER, WX, damageEnemy, damagePlayer, enemies, floatText, heightAt, inField, radio, scene, sfx, showBanner, spawnPart } from '../hub.js';

const rnd=a=>a[0]+Math.random()*(a[1]-a[0]);
export const WHIRLS={ list:[], next:0, av:null, mounds:[] };
const SNOW=new Set(['TUNDRA','ARCTIC']), GREEN=new Set(['MEADOW','VILLAGE','HILLS']);
let _tex=null;
function puffTex(){ if(_tex) return _tex; const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'), g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.35,'rgba(255,255,255,0.55)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,64,64); _tex=new THREE.CanvasTexture(c); return _tex; }
// what this land's whirl is made of: [grain colours], puff colour
function stuff(){ const n=BIOME.name, gc=new THREE.Color(BIOME.ground||0xb89a5e);
  if(SNOW.has(n)) return { grains:[0xffffff,0xeef6ff,0xdde8f2], puff:0xf4f8ff, fun:0xf8fbff, op:0.5, kind:'snow' };
  if(GREEN.has(n)) return { grains:[0x8a7a4a,0x6f8a3a,0xa08850,0x5a4a2a], puff:gc.clone().lerp(new THREE.Color(0xc8b88a),0.5).getHex(), fun:0x9a8a62, op:0.32, kind:'leaf' };
  const light=gc.clone().lerp(new THREE.Color(0xffffff),0.25);
  return { grains:[light.getHex(), gc.getHex(), gc.clone().multiplyScalar(0.7).getHex(), 0x3a3228], puff:light.getHex(), fun:gc.clone().multiplyScalar(0.82).getHex(), op:0.42, kind:n==='VOLCANO'?'ash':'dust' }; }   // the funnel reads a shade darker than the ground it lifts

let _stx=null;
function streakTex(){ if(_stx) return _stx; const c=document.createElement('canvas'); c.width=128; c.height=128; const x=c.getContext('2d');
  for(let i=0;i<70;i++){ const u=Math.random()*128, w=2+Math.random()*7, a=0.08+Math.random()*0.32; x.strokeStyle='rgba(255,255,255,'+a+')'; x.lineWidth=w; x.beginPath(); x.moveTo(u,128); x.bezierCurveTo(u+18,90,u+30,40,u+46,0); x.stroke(); x.beginPath(); x.moveTo(u-128,128); x.bezierCurveTo(u-110,90,u-98,40,u-82,0); x.stroke(); }
  const g=x.createLinearGradient(0,0,0,128); g.addColorStop(0,'rgba(0,0,0,1)'); g.addColorStop(0.25,'rgba(0,0,0,0)'); g.addColorStop(0.8,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.6)');
  x.globalCompositeOperation='destination-out'; x.fillStyle=g; x.fillRect(0,0,128,128);
  _stx=new THREE.CanvasTexture(c); _stx.wrapS=THREE.RepeatWrapping; return _stx; }
// the vortex sheet: an open, flaring tube of streaked dust whose rings follow the snaking axis; the streaks scroll round = it spins
function funnel(d){ const RS=22, HS=14, geo=new THREE.CylinderGeometry(1, 1, 1, RS, HS, true), m=new THREE.MeshBasicMaterial({ map:streakTex().clone(), color:d.st.fun, transparent:true, opacity:0, depthWrite:false, side:THREE.DoubleSide, fog:true });
  m.map.needsUpdate=true; m.map.repeat.set(2,1); const o=new THREE.Mesh(geo, m); o.frustumCulled=false; o.renderOrder=1; scene.add(o);
  const P=geo.attributes.position, base=new Float32Array(P.count*3); for(let i=0;i<P.count;i++){ base[i*3]=P.getX(i); base[i*3+1]=P.getY(i)+0.5; base[i*3+2]=P.getZ(i); } o.userData.base=base; return o; }
function points(n, size, op){ const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n*3),3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n*3),3));
  const m=new THREE.PointsMaterial({ size, map:puffTex(), vertexColors:true, transparent:true, opacity:op, depthWrite:false, sizeAttenuation:true });
  const o=new THREE.Points(g,m); o.frustumCulled=false; o.renderOrder=2; scene.add(o); return o; }

function spawnWhirl(at){ const p=S.player; if(!p) return false; const W=WHIRL;   // at = [x,z] to place one (tests / scripted), else a random spot in view range
  for(let k=0;k<20;k++){ const a=Math.random()*6.283, r=rnd(W.dist), x=at?at[0]:p.pos.x+Math.cos(a)*r, z=at?at[1]:p.pos.z+Math.sin(a)*r; if(!at && !inField(x,z,6)) continue;
    const st=stuff(), nG=MOBILE?W.grainsMobile:W.grains, nP=MOBILE?W.puffsMobile:W.puffs, H=rnd(W.H), R=rnd(W.R);
    const d={ x, z, t:0, life:rnd(W.life), H, R, spin:rnd(W.spin)*(Math.random()<0.5?-1:1), sp:rnd(W.speed), head:Math.random()*6.283, lean:(Math.random()-0.5)*0.5, ph:Math.random()*10, st,
      g:points(nG, st.kind==='leaf'?0.42:0.36, 1), pf:points(nP, 3.4+R*1.1, st.op), gs:[], ps:[], hit:new Set() }; d.fn=funnel(d);
    const cg=d.g.geometry.attributes.color, cp=d.pf.geometry.attributes.color, _c=new THREE.Color();
    for(let i=0;i<nG;i++){ d.gs.push({ a:Math.random()*6.283, h:Math.random()*H, rr:Math.random(), v:rnd(W.rise)*(0.6+Math.random()*0.8) }); _c.setHex(st.grains[(Math.random()*st.grains.length)|0]); cg.setXYZ(i,_c.r,_c.g,_c.b); }
    for(let i=0;i<nP;i++){ d.ps.push({ a:Math.random()*6.283, h:Math.random()*H*(i%3?0.35:0.8), rr:Math.random(), v:rnd(W.rise)*0.45, top:i%3?0.35:0.8 }); _c.setHex(st.puff).offsetHSL(0,0,(Math.random()-0.5)*0.08); cp.setXYZ(i,_c.r,_c.g,_c.b); }
    cg.needsUpdate=true; cp.needsUpdate=true; WHIRLS.list.push(d); return true; }
  return false; }
function killWhirl(i){ const d=WHIRLS.list[i]; d.fn.material.map.dispose(); for(const o of [d.g,d.pf,d.fn]){ scene.remove(o); o.geometry.dispose(); o.material.dispose(); } WHIRLS.list.splice(i,1); }
export function clearWhirls(){ while(WHIRLS.list.length) killWhirl(0); WHIRLS.next=0; WHIRLS.av=null; for(const m of WHIRLS.mounds){ scene.remove(m.m); } WHIRLS.mounds.length=0; }

// the funnel's axis: it leans and snakes as it climbs (the top lags the foot)
function axis(d, h, t, out){ const k=h/d.H; out.x=d.x + (Math.sin(t*0.9+d.ph+h*0.35)*0.5+d.lean*h*0.35)*k*1.6 - Math.sin(d.head)*k*k*1.2; out.z=d.z + Math.cos(t*0.7+d.ph*1.3+h*0.3)*0.5*k*1.6 - Math.cos(d.head)*k*k*1.2; return out; }
const _ax={x:0,z:0};
function stepWhirl(d, dt, now){ const W=WHIRL; d.t+=dt; const u=d.t/d.life, env=Math.min(1, d.t/2.5, (d.life-d.t)/3.5); if(env<=0) return false;
  // wander: drift with the wind + a slow meander
  d.head+=(Math.sin(now*0.37+d.ph)*0.8)*dt; const wl=Math.hypot(WX.wind.x, WX.wind.y)||1, wk=Math.min(1, wl/6);
  const vx=Math.sin(d.head)*d.sp*(1-wk*0.5)+WX.wind.x/wl*d.sp*wk*0.5, vz=Math.cos(d.head)*d.sp*(1-wk*0.5)+WX.wind.y/wl*d.sp*wk*0.5;
  const nx=d.x+vx*dt, nz=d.z+vz*dt; if(inField(nx,nz,4)){ d.x=nx; d.z=nz; } else d.head+=Math.PI*0.6;
  const gy=heightAt(d.x,d.z), Hn=d.H*(0.55+0.45*env), R=d.R*(0.6+0.4*env), t=now;
  const pg=d.g.geometry.attributes.position, pp=d.pf.geometry.attributes.position;
  d.gs.forEach((q,i)=>{ q.h+=q.v*dt*(0.7+0.6*env); const rad=R*(0.25+q.rr*0.75)*(0.45+0.9*q.h/d.H)+0.12; q.a+=d.spin*dt*(1.4/(0.6+rad)); if(q.h>Hn*(0.75+q.rr*0.25)){ q.h=Math.random()*0.4; q.a=Math.random()*6.283; }
    axis(d, q.h, t, _ax); pg.setXYZ(i, _ax.x+Math.cos(q.a)*rad, gy+0.1+q.h, _ax.z+Math.sin(q.a)*rad); });
  d.ps.forEach((q,i)=>{ q.h+=q.v*dt; const rad=R*(0.7+q.rr*0.8)*(0.8+0.6*q.h/d.H); q.a+=d.spin*dt*(0.9/(0.8+rad)); if(q.h>Hn*q.top){ q.h=Math.random()*0.6; q.a=Math.random()*6.283; }
    axis(d, q.h, t, _ax); pp.setXYZ(i, _ax.x+Math.cos(q.a)*rad, gy+0.4+q.h, _ax.z+Math.sin(q.a)*rad); });
  pg.needsUpdate=true; pp.needsUpdate=true; d.g.material.opacity=env; d.pf.material.opacity=d.st.op*env;
  { const F=d.fn, FP=F.geometry.attributes.position, b=F.userData.base;   // the vortex sheet follows the snaking axis, flaring as it climbs
    for(let i=0;i<FP.count;i++){ const h=b[i*3+1]*Hn, rad=R*(0.32+1.25*b[i*3+1]**1.4); axis(d, h, t, _ax); FP.setXYZ(i, _ax.x+b[i*3]*rad, gy+h, _ax.z+b[i*3+2]*rad); }
    FP.needsUpdate=true; F.material.map.offset.x-=d.spin*dt*0.05; F.material.map.offset.y-=dt*0.35; F.material.opacity=(d.st.kind==='snow'?0.6:0.78)*env; }
  // the skirt: dust racing round the foot, flung outward
  if(Math.random()<dt*(MOBILE?6:14)*env){ const a=Math.random()*6.283, r=R*1.1, tx=-Math.sin(a)*d.spin*0.9, tz=Math.cos(a)*d.spin*0.9;
    spawnPart(d.x+Math.cos(a)*r, gy+0.25, d.z+Math.sin(a)*r, tx+Math.cos(a)*1.5, 0.6+Math.random(), tz+Math.sin(a)*1.5, { color:d.st.puff, size:1.3+Math.random()*1.2, life:1.1+Math.random()*0.6, smoke:true, grav:0.1, drag:1.8, grow:1.8, op:0.42*env }); }
  // men in its path are buffeted; our tank gets sprayed
  if(env>0.5){ const R2=(R*1.6+0.8)**2;
    for(const e of enemies){ if(!e.def.inf || d.hit.has(e)) continue; const dx=e.pos.x-d.x, dz=e.pos.z-d.z; if(dx*dx+dz*dz<R2){ d.hit.add(e); const L=Math.hypot(dx,dz)||1; e.kbx=(e.kbx||0)+(-dz/L*Math.sign(d.spin)+dx/L*0.4)*W.shove; e.kbz=(e.kbz||0)+(dx/L*Math.sign(d.spin)+dz/L*0.4)*W.shove; e.aimT=0; } }
    for(const a of FT){ if(d.hit.has(a)) continue; const dx=a.pos.x-d.x, dz=a.pos.z-d.z; if(dx*dx+dz*dz<R2){ d.hit.add(a); a.aimT=0; } }
    const p=S.player; if(p && (p.pos.x-d.x)**2+(p.pos.z-d.z)**2<(R*2+2)**2 && Math.random()<dt*20){ const a=Math.random()*6.283; spawnPart(p.pos.x+Math.cos(a)*2, heightAt(p.pos.x,p.pos.z)+1.2+Math.random()*1.5, p.pos.z+Math.sin(a)*2, -Math.sin(a)*d.spin, 0.5, Math.cos(a)*d.spin, { color:d.st.puff, size:1.2, life:0.6, smoke:true, grav:0, drag:2, grow:1.5, op:0.35 }); } }
  return u<1; }

// ---------------- AVALANCHE ----------------
let _snowM=null; const snowMat=()=>_snowM||(_snowM=new THREE.MeshStandardMaterial({ color:0xf2f6fa, roughness:0.92, metalness:0 }));
export function startAvalanche(now){ const p=S.player; if(!p || !SNOW.has(BIOME.name) || WHIRLS.av) return false; const A=AVALANCHE;
  // the nearest stretch of the field's edge: the snow comes off the mountains there
  let best=null, bd=1e9; for(let k=0;k<24;k++){ const a=k/24*6.283, ux=Math.sin(a), uz=Math.cos(a); let d=6; while(d<95 && inField(p.pos.x+ux*d, p.pos.z+uz*d, 2)) d+=3; if(d<bd){ bd=d; best=[ux,uz]; } }
  if(!best) return false; const dist=Math.min(bd-2, 56), ox=p.pos.x+best[0]*dist, oz=p.pos.z+best[1]*dist;
  WHIRLS.av={ t:0, ox, oz, dx:-best[0], dz:-best[1], run:rnd(A.run), s:0, v:A.v0, hit:new Set(), lobes:Array.from({ length:9 }, ()=>({ k:0.85+Math.random()*0.3, o:0 })), balls:[] };
  showBanner('⚠ TUYẾT LỞ!', '#bfe6ff'); radio('SCH: Tuyết lở từ sườn núi đổ xuống — chạy ngang ra khỏi đường lở!'); sfx('alarm'); sfx('bigexplode', { x:ox, z:oz }, 0.5); S.shake=Math.max(S.shake, 0.6); return true; }
function stepAvalanche(dt, now){ const V=WHIRLS.av; if(!V) return; const A=AVALANCHE, p=S.player; V.t+=dt;
  const lx=-V.dz, lz=V.dx, W=A.width;
  if(V.t<A.warn){ if(Math.random()<dt*14){ const o=(Math.random()-0.5)*W; spawnPart(V.ox+lx*o, heightAt(V.ox+lx*o,V.oz+lz*o)+2+Math.random()*4, V.oz+lz*o, V.dx*2, 1.5, V.dz*2, { color:0xf4f8ff, size:2.5+Math.random()*2, life:1.8, smoke:true, grav:-0.6, drag:1.2, grow:1.6, op:0.5 }); }   // the cornice crumbling
    S.shake=Math.max(S.shake, 0.25+0.3*V.t/A.warn); return; }
  const run=V.s/V.run; V.v = run<0.65 ? Math.min(A.vmax, V.v+A.accel*dt) : Math.max(1.5, V.v-A.accel*1.6*dt); V.s+=V.v*dt;
  const fx=V.ox+V.dx*V.s, fz=V.oz+V.dz*V.s, dying=run>0.85, op=dying ? Math.max(0,(1-run)/0.15) : 1;
  // the churning front: billowing powder at every lobe, chunks flung forward, the snow smoking up behind
  for(const L of V.lobes){ L.o+=(Math.random()-0.5)*dt*3; }
  const n=MOBILE?5:9; for(let i=0;i<n;i++){ const L=V.lobes[i%V.lobes.length], o=(i/(n-1)-0.5)*W+L.o, ahead=(L.k-1)*6, x=fx+lx*o+V.dx*ahead, z=fz+lz*o+V.dz*ahead, gy=heightAt(x,z);
    if(Math.random()<dt*(MOBILE?10:22)*op) spawnPart(x, gy+0.8+Math.random()*1.5, z, V.dx*V.v*0.55+(Math.random()-0.5)*3, 2.5+Math.random()*3*V.v/A.vmax, V.dz*V.v*0.55+(Math.random()-0.5)*3, { color:0xf6f9fc, color2:0xdfe8f0, size:3.2+Math.random()*3.5, life:2.2+Math.random()*1.2, smoke:true, grav:-0.25, drag:0.9, grow:2.2, op:0.62*op });
    if(Math.random()<dt*8*op) spawnPart(x, gy+0.5, z, V.dx*V.v*1.1+(Math.random()-0.5)*4, 2+Math.random()*3, V.dz*V.v*1.1+(Math.random()-0.5)*4, { color:0xffffff, size:0.35+Math.random()*0.3, life:0.9, grav:-12, drag:0.6 }); }
  // tumbling snow blocks riding the front
  if(V.balls.length<(MOBILE?4:9) && Math.random()<dt*4*op){ const o=(Math.random()-0.5)*W*0.9, s=0.5+Math.random()*0.9, m=new THREE.Mesh(new THREE.IcosahedronGeometry(s,1), snowMat()); m.castShadow=true; scene.add(m); V.balls.push({ m, o, s, lag:Math.random()*2, life:3+Math.random()*2 }); }
  for(let i=V.balls.length-1;i>=0;i--){ const b=V.balls[i]; b.life-=dt; const x=fx+lx*b.o-V.dx*b.lag, z=fz+lz*b.o-V.dz*b.lag; b.m.position.set(x, heightAt(x,z)+b.s*0.7+Math.abs(Math.sin(V.t*5+b.o))*0.3, z); b.m.rotation.x+=V.v*dt/b.s; b.m.rotation.y+=dt;
    if(b.life<=0){ b.m.scale.multiplyScalar(1-dt*4); if(b.m.scale.x<0.1){ scene.remove(b.m); b.m.geometry.dispose(); V.balls.splice(i,1); } } }
  // what the front runs over
  if(!dying){ const hitBand=(x,z,r)=>{ const rx=x-fx, rz=z-fz, along=rx*V.dx+rz*V.dz, lat=rx*lx+rz*lz; return along<A.band+r && along>-A.band-r && Math.abs(lat)<W/2+r; };
    for(const e of enemies){ if(e.def.air || V.hit.has(e) || !hitBand(e.pos.x, e.pos.z, e.r||1)) continue; V.hit.add(e); damageEnemy(e, e.def.inf ? A.dmg.inf : A.dmg.veh); e.kbx=(e.kbx||0)+V.dx*A.push; e.kbz=(e.kbz||0)+V.dz*A.push; }
    if(p && !V.hit.has(p) && hitBand(p.pos.x, p.pos.z, 1.6)){ V.hit.add(p); damagePlayer(A.dmg.player, now, V.dx, V.dz); p.kbx+=V.dx*A.push; p.kbz+=V.dz*A.push; floatText('TUYẾT LỞ!', '#bfe6ff', { x:p.pos.x, y:4, z:p.pos.z }, 15); }
    if(p){ const d=Math.hypot(p.pos.x-fx, p.pos.z-fz); S.shake=Math.max(S.shake, Math.max(0, 0.9-d/45)); }
    // drifts left behind
    if(WHIRLS.mounds.length<A.mounds && Math.random()<dt*3){ const o=(Math.random()-0.5)*W*0.9, x=fx+lx*o-V.dx*3, z=fz+lz*o-V.dz*3; if(inField(x,z,1)){ const m=new THREE.Mesh(new THREE.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2), snowMat()); const s=1.4+Math.random()*2; m.scale.set(s*1.4, s*0.32, s); m.rotation.y=Math.atan2(V.dx,V.dz); m.position.set(x, heightAt(x,z)-0.05, z); m.receiveShadow=true; scene.add(m); WHIRLS.mounds.push({ m, t:0 }); } } }
  if(run>=1 && !V.balls.length) WHIRLS.av=null; }
function stepMounds(dt){ for(let i=WHIRLS.mounds.length-1;i>=0;i--){ const M=WHIRLS.mounds[i]; M.t+=dt; if(M.t>AVALANCHE.moundLife){ M.m.scale.y*=Math.max(0, 1-dt*0.6); if(M.m.scale.y<0.03){ scene.remove(M.m); M.m.geometry.dispose(); WHIRLS.mounds.splice(i,1); } } } }

export function updateWhirls(dt, now){
  const show=!UNDER.on && !BIOME.cave; for(const d of WHIRLS.list){ d.g.visible=show; d.pf.visible=show; d.fn.visible=show; } if(!show) return;
  for(let i=WHIRLS.list.length-1;i>=0;i--) if(!stepWhirl(WHIRLS.list[i], dt, now)) killWhirl(i);
  stepAvalanche(dt, now); stepMounds(dt);
  if(S.mode!=='playing' || !S.player) return;
  if(!WHIRLS.next){ WHIRLS.next=now+rnd(WHIRL.first); return; }
  if(now<WHIRLS.next) return; WHIRLS.next=now+rnd(WHIRL.every);
  if(WHIRLS.list.length < (MOBILE?WHIRL.maxMobile:WHIRL.max) && S.weather!=='rain') spawnWhirl(); }
export { spawnWhirl };
