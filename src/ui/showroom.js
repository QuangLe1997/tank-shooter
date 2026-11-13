// ui/showroom.js — Z107 SHOWROOM: the shop shows YOUR battle tank exactly as it rolls out (same hull, paint, flag and the real barrel of each gun) parked on a patch of the current battlefield under its own sky — idling, sweeping the turret, firing — plus a photo of the tank with every gun for the grid cards.
import * as THREE from 'three';
import { ATMOS, BIOME, MOBILE, TANK_SCALE, VIEW, animateTank, barrelGrade, buildTank, currentTank, groundMaps, makeCamoNet, makeCoverMesh, makeFlag, mountBarrel, renderer, shopCam, shopScene, skyEnvTexture, tankModel, tankRecoil, vnTex } from '../hub.js';

export const SHOW = { built:'', tank:null, thumbTank:null, gun:'', thumbGun:'', studio:null, flash:null, flashL:null, puffs:[], dust:null, t:0, fireT:2.4,
  orbit:0.62, drag:0, dragging:false, lastX:0, idleT:0, thumbs:{}, queue:[], emblem:null, focusX:0, firing:true, salvo:0 };
const _vp=new THREE.Vector4(), _v=new THREE.Vector3(), _q=new THREE.Quaternion();
export const thumbCam = new THREE.PerspectiveCamera(30, 1.6, 0.1, 80);

// soft round sprite (smoke puffs, dust motes, muzzle glow)
export let _softTex=null;
export function softTex(){ if(_softTex) return _softTex; const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d');
  const g=x.createRadialGradient(32,32,0,32,32,32); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.45,'rgba(255,255,255,.55)'); g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g; x.fillRect(0,0,64,64); _softTex=new THREE.CanvasTexture(c); _softTex.colorSpace=THREE.SRGBColorSpace; return _softTex; }
// tread prints pressed into the dirt behind the tank (it drove in here)
export function treadTex(){ const c=document.createElement('canvas'); c.width=64; c.height=256; const x=c.getContext('2d'); x.clearRect(0,0,64,256);
  for(let y=0;y<256;y+=10){ x.fillStyle='rgba(0,0,0,'+(0.5+Math.random()*0.25).toFixed(2)+')'; x.fillRect(4,y,56,5); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t; }

// the hero: the player's own tank (detail hull, mighty silhouette, Liên Quân Thép banner) — same builder the battle uses
export function makeShowTank(){
  const id=currentTank(), m=buildTank({detail:true, mighty:true, model:id}); m.scale.setScalar(TANK_SCALE*tankModel(id).stats.size);   // Z155 your garage pick
  const T=m.userData.turret, pole=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.035,2.0,6), new THREE.MeshStandardMaterial({color:0x2a2a26, roughness:0.5, metalness:0.7}));
  pole.position.set(-0.72,1.25,-1.1); T.add(pole); const fl=makeFlag(vnTex(), 1.25, 0.82, -1); fl.position.set(-0.72,1.82,-1.1); T.add(fl);
  m.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } }); if(m.userData.blob) m.userData.blob.visible=false;
  return m; }

// a patch of THIS battlefield: its ground texture, sky, sun and haze; sandbags, drums, crates and a camo net round the bay
export function dressShowroom(){
  const key=BIOME.name; if(SHOW.built===key && SHOW.tank) return; SHOW.built=key;
  if(SHOW.studio) shopScene.remove(SHOW.studio);
  const A=ATMOS[key]||ATMOS.DESERT, st=new THREE.Group(); SHOW.studio=st; shopScene.add(st);
  const env=skyEnvTexture(key, A); shopScene.background=env; shopScene.environment=env;
  shopScene.backgroundBlurriness=0.18; shopScene.backgroundIntensity=0.95; shopScene.environmentIntensity=0.75;
  shopScene.fog=new THREE.Fog(A.hor, 18, 52);
  st.add(new THREE.HemisphereLight(A.top, A.hemiG, 0.8));
  const sun=new THREE.DirectionalLight(A.sun, Math.min(3.2, A.sunI)); sun.position.set(7,11,6); sun.target.position.set(0,0.8,0); st.add(sun, sun.target);
  if(renderer.shadowMap.enabled){ sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); const c=sun.shadow.camera; c.left=-8; c.right=8; c.top=8; c.bottom=-8; c.near=1; c.far=40; sun.shadow.bias=-0.0004; sun.shadow.normalBias=0.04; }
  const rim=new THREE.DirectionalLight(0xcfe0ff, 0.9); rim.position.set(-7,5,-8); st.add(rim);
  // ground: the battlefield's own dirt / snow / ash
  const gm=groundMaps(BIOME), rep=(t)=>{ const c=t.clone(); c.wrapS=c.wrapT=THREE.RepeatWrapping; c.repeat.set(4.5,4.5); c.needsUpdate=true; return c; };
  const gmat=new THREE.MeshStandardMaterial({ map:rep(gm.map), normalMap:gm.nrm?rep(gm.nrm):null, roughness:typeof gm.rough==='number'?gm.rough:0.95, metalness:0 });
  const ground=new THREE.Mesh(new THREE.CircleGeometry(42, 72), gmat); ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; st.add(ground);
  const tt=treadTex(); tt.repeat.set(1,5);
  for(const sx of [-1,1]){ const tr=new THREE.Mesh(new THREE.PlaneGeometry(0.62*TANK_SCALE, 16), new THREE.MeshBasicMaterial({ map:tt, transparent:true, opacity:0.32, depthWrite:false, color:0x000000 }));
    tr.rotation.x=-Math.PI/2; tr.position.set(sx*1.12*TANK_SCALE, 0.012, -9.5); st.add(tr); }
  // the bay: a sandbag wall behind, supplies on the right, a camo net on the left — the look of a forward position
  const put=(kind,x,z,ry,s)=>{ const m=makeCoverMesh(kind, false); m.position.set(x,0,z); m.rotation.y=ry||0; if(s) m.scale.setScalar(s); st.add(m); return m; };
  put('sandbag',-4.6,-6.4,0.35); put('sandbag',-1.6,-7.4,0.08); put('sandbag',1.6,-7.4,-0.08); put('sandbag',4.6,-6.4,-0.35);
  put('drums',6.4,-2.6,0.4); put('crates',6.8,0.8,-0.3); put('crates',5.6,-4.6,0.9); put('tires',-6.6,-1.2,0.2);
  { const net=makeCamoNet(), nx=-6.2, nz=-3.6; net.rotation.x=-Math.PI/2; net.rotation.z=0.7; net.position.set(nx,2.7,nz); net.castShadow=true; st.add(net);   // net strung flat on four poles
    const pm=new THREE.MeshStandardMaterial({ color:0x4a4234, roughness:0.8 }), c=Math.cos(0.7), s2=Math.sin(0.7);
    for(const [px,pz] of [[-3.6,-2.6],[3.6,-2.6],[-3.6,2.6],[3.6,2.6]]){ const m=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.07,2.7,6), pm); m.position.set(nx+px*c+pz*s2, 1.35, nz-px*s2+pz*c); m.castShadow=true; st.add(m); } }
  // dust motes drifting through the light
  { const N=MOBILE?60:140, P=new Float32Array(N*3); for(let i=0;i<N;i++){ P[i*3]=(Math.random()-0.5)*18; P[i*3+1]=Math.random()*5; P[i*3+2]=(Math.random()-0.5)*14; }
    const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P,3));
    SHOW.dust=new THREE.Points(g, new THREE.PointsMaterial({ map:softTex(), size:0.09, color:0xfff2d8, transparent:true, opacity:0.5, depthWrite:false, sizeAttenuation:true })); st.add(SHOW.dust); }
  // muzzle flash + its light, and a pool of smoke puffs (exhaust + gun smoke)
  SHOW.flash=new THREE.Sprite(new THREE.SpriteMaterial({ map:softTex(), color:0xffc070, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false })); SHOW.flash.scale.setScalar(2.2); st.add(SHOW.flash);
  SHOW.flashL=new THREE.PointLight(0xffb060, 0, 14, 2); st.add(SHOW.flashL);
  SHOW.puffs.length=0; for(let i=0;i<(MOBILE?14:24);i++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({ map:softTex(), color:0x8a8478, transparent:true, opacity:0, depthWrite:false })); s.visible=false; st.add(s); SHOW.puffs.push({ s, t:9, life:1, vx:0, vy:0, vz:0, g:1 }); }
  if(!SHOW.tank){ SHOW.tank=makeShowTank(); shopScene.add(SHOW.tank); SHOW.tank.rotation.y=0; }
  if(!SHOW.thumbTank){ SHOW.thumbTank=makeShowTank(); SHOW.thumbTank.visible=false; shopScene.add(SHOW.thumbTank); }
}
// put this gun's real barrel on the showroom tank (no-op if it already carries it)
export function setShowGun(id){ if(!SHOW.tank) return; const k=id+':'+barrelGrade(id); if(SHOW.gun===k) return; SHOW.gun=k; mountBarrel(SHOW.tank, id); SHOW.fireT=Math.min(SHOW.fireT, 1.4); }
// a floating upgrade emblem beside the tank (upgrade items) — or nothing (guns)
export function setShowEmblem(obj){ if(SHOW.emblem){ shopScene.remove(SHOW.emblem); SHOW.emblem=null; } if(obj){ obj.position.set(2.9*TANK_SCALE, 2.0, 1.6); obj.scale.multiplyScalar(0.62); shopScene.add(obj); SHOW.emblem=obj; } return obj; }
export function showSalvo(){ SHOW.salvo=3; SHOW.fireT=0; }   // purchase: the tank greets its new gun with three rounds

function puff(x,y,z,vx,vy,vz,life,size,col,op){ const P=SHOW.puffs; let o=P[0]; for(const q of P) if(q.t>=q.life){ o=q; break; }
  o.t=0; o.life=life; o.vx=vx; o.vy=vy; o.vz=vz; o.g=size; o.op=op; o.s.position.set(x,y,z); o.s.material.color.setHex(col); o.s.visible=true; }
function fire(){ const T=SHOW.tank, ud=T.userData, mz=ud.barrelG&&ud.barrelG.userData.muzzle; if(!mz) return;
  const yaw=T.rotation.y+ud.turret.rotation.y; tankRecoil(T, yaw, 1.0, T.rotation.y);
  mz.getWorldPosition(_v); SHOW.flash.position.copy(_v); SHOW.flash.material.opacity=1; SHOW.flash.scale.setScalar(2.6+Math.random()*0.8);
  SHOW.flashL.position.copy(_v); SHOW.flashL.intensity=MOBILE?28:40;
  const fx=Math.sin(yaw), fz=Math.cos(yaw);
  for(let i=0;i<5;i++) puff(_v.x+fx*0.3, _v.y, _v.z+fz*0.3, fx*(3+i*1.4)+(Math.random()-0.5), 0.3+Math.random()*0.5, fz*(3+i*1.4)+(Math.random()-0.5), 1.6+Math.random()*0.8, 0.9+i*0.25, 0xb8b0a2, 0.55);
  for(let i=0;i<3;i++) puff(_v.x, 0.35, _v.z, (Math.random()-0.5)*3, 0.2, (Math.random()-0.5)*3, 1.4, 1.2, 0xa89a80, 0.35); }   // muzzle blast kicks up the dust

// per frame while the shop is open
export function updateShowroom(dt, detail){
  const T=SHOW.tank; if(!T) return; SHOW.t+=dt; const t=SHOW.t, ud=T.userData;
  // the engine idles: hull shiver, tracks still; the commander sweeps the turret across the arc
  animateTank(T, 0, 0, T.rotation.y, dt, false); T.position.y=0; T.rotation.x=0; T.rotation.z=0;
  ud.turret.rotation.y = Math.sin(t*0.32)*0.5 + Math.sin(t*0.11)*0.2; if(ud.rig) ud.rig.elevT = 0.05+0.04*Math.sin(t*0.5);
  if(detail){ SHOW.fireT-=dt; if(SHOW.fireT<=0){ fire(); if(SHOW.salvo>0){ SHOW.salvo--; SHOW.fireT=0.55; } else SHOW.fireT=3.6+Math.random()*1.6; } }
  const f=SHOW.flash; if(f.material.opacity>0){ f.material.opacity=Math.max(0, f.material.opacity-dt*9); SHOW.flashL.intensity=Math.max(0, SHOW.flashL.intensity-dt*260); }
  // exhaust: a lazy trickle of diesel smoke from the rear deck
  if(ud.exhaust && Math.random()<dt*5){ ud.exhaust.getWorldPosition(_v); puff(_v.x, _v.y+0.1, _v.z, (Math.random()-0.5)*0.3, 0.9+Math.random()*0.4, -0.4, 2.2, 0.5, 0x3a3834, 0.28); }
  for(const q of SHOW.puffs){ if(q.t>=q.life) { if(q.s.visible) q.s.visible=false; continue; } q.t+=dt; const k=q.t/q.life;
    q.s.position.x+=q.vx*dt; q.s.position.y+=q.vy*dt; q.s.position.z+=q.vz*dt; q.vx*=1-dt*1.6; q.vz*=1-dt*1.6; q.vy+=dt*0.25;
    q.s.scale.setScalar(q.g*(0.6+k*2.2)); q.s.material.opacity=q.op*(1-k)*(1-k); }
  if(SHOW.dust){ const a=SHOW.dust.geometry.attributes.position, P=a.array; for(let i=0;i<P.length;i+=3){ P[i]+=dt*0.18; P[i+1]+=Math.sin(t*0.7+i)*dt*0.05; if(P[i]>9) P[i]=-9; } a.needsUpdate=true; }
  if(SHOW.emblem){ SHOW.emblem.rotation.y+=dt*0.8; SHOW.emblem.position.y=2.0+Math.sin(t*1.6)*0.12; if(SHOW.emblem._spinPart) SHOW.emblem._spinPart.rotation.x+=dt*3; }
  // camera: a slow walk round the tank (drag to swing it yourself; it resumes after a few seconds)
  if(!SHOW.dragging){ SHOW.idleT+=dt; if(SHOW.idleT>3) SHOW.orbit+=dt*0.1; }
  const a=SHOW.orbit, R=detail?15.5:17, h=detail?4.8:5.6;
  shopCam.position.set(Math.sin(a)*R, h, Math.cos(a)*R); shopCam.lookAt(0, detail?1.2:1.5, 0);
  const W=VIEW.w, H=VIEW.h, off = detail ? SHOW.focusX*W : 0;        // shift the tank clear of the stat panel
  if(off) shopCam.setViewOffset(W, H, -off, 0, W, H); else if(shopCam.view && shopCam.view.enabled) shopCam.clearViewOffset();
  shopCam.aspect=W/Math.max(1,H); shopCam.updateProjectionMatrix();
}
// ---- card photos: the tank with each gun, rendered into the corner of the canvas right before the frame is drawn over it ----
export function thumbKey(id){ return id+':'+barrelGrade(id); }
export function thumbURL(id){ return SHOW.thumbs[thumbKey(id)]||''; }
export function queueThumbs(ids){ for(const id of ids) if(!SHOW.thumbs[thumbKey(id)] && !SHOW.queue.includes(id)) SHOW.queue.push(id); }
export function pumpThumbs(){
  if(!SHOW.queue.length || !SHOW.thumbTank) return; const id=SHOW.queue.shift(), key=thumbKey(id); if(SHOW.thumbs[key]) return;
  const TT=SHOW.thumbTank, hero=SHOW.tank, emb=SHOW.emblem; mountBarrel(TT, id); SHOW.thumbGun=key;
  TT.userData.turret.rotation.y=0.42; if(TT.userData.rig){ TT.userData.rig.recoil=0; TT.userData.rig.elev=0.06; }
  TT.visible=true; hero.visible=false; if(emb) emb.visible=false; for(const q of SHOW.puffs) q.s.visible=false; SHOW.flash.visible=false; if(SHOW.dust) SHOW.dust.visible=false;
  const W=MOBILE?208:256, H=Math.round(W*0.6), pr=renderer.getPixelRatio();
  thumbCam.aspect=W/H; thumbCam.position.set(-8.2, 3.9, 10.4); thumbCam.lookAt(0.6, 1.0, 0.4); thumbCam.updateProjectionMatrix();
  renderer.getViewport(_vp); renderer.setRenderTarget(null); renderer.setViewport(0,0,W,H); renderer.render(shopScene, thumbCam);
  const cv=document.createElement('canvas'), dw=Math.round(W*Math.min(2,pr)), dh=Math.round(H*Math.min(2,pr)); cv.width=dw; cv.height=dh;
  const src=renderer.domElement; cv.getContext('2d').drawImage(src, 0, src.height-H*pr, W*pr, H*pr, 0, 0, dw, dh);
  renderer.setViewport(_vp);
  TT.visible=false; hero.visible=true; if(emb) emb.visible=true; SHOW.flash.visible=true; if(SHOW.dust) SHOW.dust.visible=true;
  const url=cv.toDataURL('image/jpeg', 0.84); SHOW.thumbs[key]=url;
  document.querySelectorAll('img.case-shot[data-thumb="'+id+'"]').forEach(im=>{ im.src=url; im.closest('.case-disp')?.classList.add('shot-ok'); });
}
// drag anywhere on the 3D view (not on a panel) to walk round the tank
export function _showDragOK(e){ return !(e.target.closest && e.target.closest('.shop-info,.si-panel,.shop-tab,.shop-arrow,.shop-back,.shop-done,.w-chip,#shopTabs,#caseGrid,.btn')); }
addEventListener('pointerdown', e=>{ if(!document.body.classList.contains('shopopen') || !_showDragOK(e)) return; SHOW.dragging=true; SHOW.lastX=e.clientX; SHOW.idleT=0; });
addEventListener('pointermove', e=>{ if(!SHOW.dragging) return; const dx=e.clientX-SHOW.lastX; SHOW.lastX=e.clientX; SHOW.orbit-=dx*0.008; SHOW.idleT=0; });
addEventListener('pointerup', ()=>{ SHOW.dragging=false; }); addEventListener('pointercancel', ()=>{ SHOW.dragging=false; });
