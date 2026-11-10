// actors/soldiers.js — infantryman: jointed legs (walk cycle), plate carrier + pouches, covered helmet w/ NVG mount, gloves, boots, M4-pattern carbine with optic
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MOBILE, S, SOLDIER, _R, _canvasTex, boss, burst, camera, core, enemies, floatText, guardBonusHp, guardFireMul, heightAt, scene, sfx, spawnBullet, spawnPart } from '../hub.js';
   // support defenders (cap raised to fit the CORE GUARDS upgrade, +1..3)
export let soldiers=[], soldierLvl=0;
// ---- infantryman: jointed legs (walk cycle), plate carrier + pouches, covered helmet w/ NVG mount, gloves, boots, M4-pattern carbine with optic ----
export const SOLDIER_MAT = {};
export function _soldierMats(){
  if(SOLDIER_MAT.ready) return SOLDIER_MAT;
  const camo=_canvasTex(64,64,(x,W)=>{ x.fillStyle='#55703a'; x.fillRect(0,0,W,W); const cs=['#3e5a2a','#6f8a48','#2c3e1e','#4a6634'];   // Z104 OURS: woodland GREEN camo
    for(let i=0;i<40;i++){ x.fillStyle=cs[i%cs.length]; x.beginPath(); x.ellipse(_R(0,W),_R(0,W),_R(3,9),_R(2,6),_R(0,3),0,7); x.fill(); } });
  SOLDIER_MAT.uni = new THREE.MeshStandardMaterial({ map:camo, roughness:0.9 });
  SOLDIER_MAT.gear= new THREE.MeshStandardMaterial({ color:0x4a4a32, roughness:0.85 });
  SOLDIER_MAT.dark= new THREE.MeshStandardMaterial({ color:0x1e1f1a, roughness:0.75, metalness:0.2 });
  SOLDIER_MAT.skin= new THREE.MeshStandardMaterial({ color:0xb07a52, roughness:0.65 });
  SOLDIER_MAT.gun = new THREE.MeshStandardMaterial({ color:0x1a1b18, roughness:0.45, metalness:0.75 });
  SOLDIER_MAT.helm= new THREE.MeshStandardMaterial({ color:0x3c5426, roughness:0.85 });                                          // olive helmet cover
  SOLDIER_MAT.band= new THREE.MeshStandardMaterial({ color:0x9be04a, emissive:0x5fae1c, emissiveIntensity:0.55, roughness:0.6 });   // lime ID armband — reads at a glance
  SOLDIER_MAT.ready=true; return SOLDIER_MAT;
}
export const ENEMY_SOLDIER_MAT = {};
export function _enemySoldierMats(){
  if(ENEMY_SOLDIER_MAT.ready) return ENEMY_SOLDIER_MAT; const F=_soldierMats();
  const camo=_canvasTex(64,64,(x,W)=>{ x.fillStyle='#a8905e'; x.fillRect(0,0,W,W); const cs=['#8a7048','#c8b080','#6a5636','#b49a6a'];   // desert-tan pattern → reads as the OTHER side
    for(let i=0;i<40;i++){ x.fillStyle=cs[i%cs.length]; x.beginPath(); x.ellipse(_R(0,W),_R(0,W),_R(3,9),_R(2,6),_R(0,3),0,7); x.fill(); } });
  Object.assign(ENEMY_SOLDIER_MAT, F, { uni:new THREE.MeshStandardMaterial({ map:camo, roughness:0.9 }), gear:new THREE.MeshStandardMaterial({ color:0x5a4632, roughness:0.85 }),
    helm:new THREE.MeshStandardMaterial({ color:0x6a2620, roughness:0.8 }),                                                        // Z104 THEIRS: maroon helmet
    band:new THREE.MeshStandardMaterial({ color:0xe03a2a, emissive:0xa01a10, emissiveIntensity:0.55, roughness:0.6 }), ready:true });   // red ID armband
  return ENEMY_SOLDIER_MAT;
}
// Z107 SOLDIER KIT — the body used to be ~19 meshes (one per material per joint) built fresh for every man: on the wider
// field with 20+ soldiers that was ~400 draw calls and 1000+ geometries. Now each joint is ONE mesh drawn from a shared
// per-side atlas (camo · plain · glow armband · gun metal) with vertex colours, and the merged geometry is built ONCE
// per side and shared by every soldier → 7 draw calls a man, near-zero build cost per spawn.
export const SOLDIER_KIT = {};
const _REG = { camo:0, plain:1, glow:2, metal:3 };              // atlas regions (quarters of the u axis)
function _kitTex(draw, srgb){ const c=document.createElement('canvas'); c.width=256; c.height=64; draw(c.getContext('2d'));
  const t=new THREE.CanvasTexture(c); if(srgb) t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
  t.generateMipmaps=false; t.minFilter=THREE.LinearFilter; return t; }
function _soldierKit(enemy){
  const key=enemy?'e':'f'; if(SOLDIER_KIT[key]) return SOLDIER_KIT[key];
  const M=enemy?_enemySoldierMats():_soldierMats(), camoImg=M.uni.map.image;
  const map=_kitTex(x=>{ x.drawImage(camoImg,0,0,64,64); x.fillStyle='#fff'; x.fillRect(64,0,192,64); }, true);
  const orm=_kitTex(x=>{ [[0.9,0],[0.8,0.1],[0.6,0],[0.45,0.75]].forEach(([r,m],i)=>{ x.fillStyle=`rgb(0,${Math.round(r*255)},${Math.round(m*255)})`; x.fillRect(i*64,0,64,64); }); }, false);
  const em=_kitTex(x=>{ x.fillStyle='#000'; x.fillRect(0,0,256,64); x.fillStyle='#fff'; x.fillRect(128,0,64,64); }, true);
  const mat=new THREE.MeshStandardMaterial({ map, vertexColors:true, roughness:1, metalness:1, roughnessMap:orm, metalnessMap:orm,
    emissive:M.band.emissive.clone(), emissiveMap:em, emissiveIntensity:0.55 });
  const kind=m=> m===M.uni ? 'camo' : m===M.band ? 'glow' : m===M.gun ? 'metal' : 'plain';
  const rb=(w,h,d,r)=>new RoundedBoxGeometry(w,h,d,2,r||0.04);
  const parts={ up:[], arm:[], gun:[], hip:[], knee:[] };
  const put=(L,geo,m,x,y,z,rx,ry,rz)=>L.push({ geo, m, x, y, z, rx:rx||0, ry:ry||0, rz:rz||0 });
  // legs (one leg's worth — both legs share it)
  put(parts.hip, rb(0.17,0.38,0.19,0.06), M.uni, 0,-0.19,0);
  put(parts.knee, rb(0.15,0.34,0.16,0.05), M.uni, 0,-0.17,0); put(parts.knee, rb(0.16,0.12,0.28,0.04), M.dark, 0,-0.33,0.05);   // shin + boot
  put(parts.hip, rb(0.19,0.1,0.21,0.03), M.gear, 0,-0.36,0.01);                                                                 // knee pad
  // upper body
  put(parts.up, rb(0.44,0.52,0.26,0.07), M.uni, 0,0.3,0);                                                                        // torso
  put(parts.up, rb(0.48,0.42,0.32,0.05), M.gear, 0,0.33,0.02);                                                                   // plate carrier
  for(const px of [-0.13,0,0.13]) put(parts.up, rb(0.11,0.15,0.08,0.02), M.gear, px,0.24,0.2);                                  // mag pouches
  put(parts.up, rb(0.36,0.42,0.2,0.05), M.gear, 0,0.36,-0.25);                                                                   // assault pack
  put(parts.up, new THREE.CylinderGeometry(0.06,0.06,0.3,8), M.dark, 0.2,0.58,-0.25, 0,0,Math.PI/2);                            // bedroll
  put(parts.up, new THREE.CylinderGeometry(0.07,0.08,0.1,10), M.skin, 0,0.6,0);                                                  // neck
  put(parts.up, new THREE.SphereGeometry(0.13,12,10), M.skin, 0,0.75,0.01);                                                      // head
  put(parts.up, new THREE.SphereGeometry(0.165,14,8,0,6.283,0,1.55), M.helm||M.uni, 0,0.77,0);                                 // covered helmet (side colour)
  put(parts.up, new THREE.CylinderGeometry(0.17,0.17,0.03,14), M.gear, 0,0.77,0);                                                // helmet band
  put(parts.up, rb(0.06,0.06,0.05,0.01), M.dark, 0,0.86,0.15);                                                                   // NVG shroud mount
  put(parts.up, rb(0.22,0.04,0.02,0.01), M.dark, 0,0.73,0.13);                                                                   // goggles strap / eyes shadow
  // arms (one rigid group — kicks on each shot)
  put(parts.arm, rb(0.12,0.32,0.13,0.04), M.uni, -0.25,-0.05,0.08, -0.9,0,0.25); put(parts.arm, rb(0.12,0.32,0.13,0.04), M.uni, 0.25,-0.05,0.08, -0.9,0,-0.25);   // upper arms
  put(parts.arm, rb(0.1,0.28,0.11,0.04), M.uni, -0.12,-0.12,0.3, -1.45,0,0.6); put(parts.arm, rb(0.1,0.28,0.11,0.04), M.uni, 0.15,-0.08,0.26, -1.3,0,-0.4);       // forearms
  for(const [hx,hz] of [[-0.02,0.42],[0.1,0.14]]) put(parts.arm, new THREE.SphereGeometry(0.055,8,6), M.dark, hx,-0.08,hz);                                       // gloves
  for(const sx of [-1,1]) put(parts.arm, rb(0.135,0.09,0.145,0.02), M.band||M.gear, sx*0.25,0.04,0.0, -0.9,0,sx*-0.25);                                          // Z104 ID armbands
  // M4-pattern carbine with optic
  put(parts.gun, rb(0.06,0.1,0.42,0.015), M.gun, 0,0,0.12); put(parts.gun, new THREE.CylinderGeometry(0.018,0.02,0.36,8), M.gun, 0,0.01,0.5, Math.PI/2);   // receiver + barrel
  put(parts.gun, rb(0.07,0.07,0.22,0.015), M.gun, 0,0.0,0.34); put(parts.gun, rb(0.045,0.16,0.07,0.01), M.gun, 0,-0.11,0.1, 0.25);                       // handguard + magazine
  put(parts.gun, rb(0.05,0.08,0.2,0.015), M.gun, 0,-0.02,-0.18); put(parts.gun, new THREE.CylinderGeometry(0.03,0.03,0.12,10), M.dark, 0,0.08,0.12, Math.PI/2);   // stock + optic
  const _m4=new THREE.Matrix4(), _e=new THREE.Euler(), _q=new THREE.Quaternion(), _one=new THREE.Vector3(1,1,1), _p=new THREE.Vector3(), col=new THREE.Color();
  const bake=L=>{ const geos=L.map(pt=>{ const g=(pt.geo.index? pt.geo.toNonIndexed() : pt.geo.clone()); pt.geo.dispose();
      for(const a of Object.keys(g.attributes)) if(a!=='position'&&a!=='normal'&&a!=='uv') g.deleteAttribute(a);
      _m4.compose(_p.set(pt.x,pt.y,pt.z), _q.setFromEuler(_e.set(pt.rx,pt.ry,pt.rz)), _one); g.applyMatrix4(_m4);
      const n=g.attributes.position.count, uv=g.attributes.uv ? g.attributes.uv.array : new Float32Array(n*2), r=_REG[kind(pt.m)], c=new Float32Array(n*3);
      if(r===0) col.setRGB(1,1,1); else col.copy(pt.m.color);
      for(let i=0;i<n;i++){ const u=r===0 ? Math.min(1,Math.max(0,uv[i*2]))*0.23+0.01 : r*0.25+0.125; uv[i*2]=u; if(r!==0) uv[i*2+1]=0.5; c[i*3]=col.r; c[i*3+1]=col.g; c[i*3+2]=col.b; }
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2)); g.setAttribute('color', new THREE.Float32BufferAttribute(c,3)); g.clearGroups(); return g; });
    const merged=mergeGeometries(geos,false); geos.forEach(g=>g.dispose()); merged.computeBoundingSphere(); return merged; };
  const kit={ mat, geo:{ up:bake(parts.up), arm:bake(parts.arm), gun:bake(parts.gun), hip:bake(parts.hip), knee:bake(parts.knee) } };
  return (SOLDIER_KIT[key]=kit);
}
export function makeSoldierMesh(opts){
  const K=_soldierKit(!!(opts&&opts.enemy)), g=new THREE.Group(), body=new THREE.Group(); body.scale.setScalar(0.84); g.add(body);   // inner rig keeps the old overall height
  const flash=K.mat.clone(); flash.emissiveMap=null; flash.emissive.setHex(0x000000); flash.emissiveIntensity=0;   // own copy → the hit flash only lights THIS soldier's upper body
  const mk=(par,geo,mat)=>{ const m=new THREE.Mesh(geo,mat); m.castShadow=!MOBILE; par.add(m); return m; };   // Z104 phones: no soldier shadows
  const legs=[];
  for(const sx of [-1,1]){ const hip=new THREE.Group(); hip.position.set(sx*0.12,0.74,0); body.add(hip); mk(hip, K.geo.hip, K.mat);
    const knee=new THREE.Group(); knee.position.set(0,-0.38,0); hip.add(knee); mk(knee, K.geo.knee, K.mat); legs.push({hip,knee,sx}); }
  const up=new THREE.Group(); up.position.y=0.74; body.add(up); const torso=mk(up, K.geo.up, flash);
  const armG=new THREE.Group(); armG.position.set(0,0.48,0.02); up.add(armG); mk(armG, K.geo.arm, K.mat);
  const gun=new THREE.Group(); gun.position.set(0.04,-0.06,0.16); armG.add(gun); mk(gun, K.geo.gun, K.mat);
  const muz=new THREE.Object3D(); muz.position.set(0,0.01,0.7); gun.add(muz);
  g.userData.torso=torso; g.userData.muzzle=muz; g.userData.legs=legs; g.userData.up=up; g.userData.gun=gun; g.userData.walk=0; g.userData.kick=0; g.userData.body=body; g.userData.arms=armG;
  return g;
}
// walk cycle driven by ground covered; idle breathing; carbine kick
export function animateSoldier(g, dist, dt, firing){
  const u=g.userData; if(!u.legs) return;
  u.walk += dist*7.5; const amp=Math.min(0.75, dist/Math.max(dt,1e-3)*0.18);
  for(const l of u.legs){ const ph=u.walk + (l.sx>0?Math.PI:0); l.hip.rotation.x = Math.sin(ph)*amp; l.knee.rotation.x = Math.max(0, -Math.cos(ph))*amp*1.1; }
  u.t=(u.t||0)+dt; u.up.position.y = 0.74 + Math.abs(Math.sin(u.walk))*0.03*Math.min(1,amp*2) + Math.sin(u.t*2.1)*0.006;
  if(firing) u.kick=1; u.kick=Math.max(0,u.kick-dt*9); u.gun.position.z = 0.16 - u.kick*0.06; u.gun.rotation.x = -u.kick*0.12;
}
// Z105 STANCES — call after animateSoldier(): 'stand' (walk cycle as is) · 'crouch' (kneel to fire / hide behind cover) ·
// 'prone' (flat on the ground, rifle forward — the hardest target). Blends smoothly so nobody snaps between poses.
const _ST={ stand:{ rx:0, y:0, z:0, up:0, arm:0, k:0 }, crouch:{ rx:0, y:0, z:0, up:0.15, arm:0, k:1 }, prone:{ rx:1.42, y:0.17, z:-0.55, up:-0.32, arm:-1.08, k:2 } };
export function poseSoldier(g, stance, dt){ const u=g.userData; if(!u.body) return; const T=_ST[stance]||_ST.stand, P=u.pose||(u.pose={ rx:0, y:0, z:0, up:0, arm:0 }), f=1-Math.exp(-dt*9);
  for(const k of ['rx','y','z','up','arm']) P[k]+=(T[k]-P[k])*f;
  u.body.rotation.x=P.rx; u.body.position.y=P.y; u.body.position.z=P.z; u.up.rotation.x=P.up; if(u.arms) u.arms.rotation.x=P.arm;
  u.stance=stance; const L=u.legs;
  if(T.k===1){ u.up.position.y=0.5; L[0].hip.rotation.x=-1.35; L[0].knee.rotation.x=1.35; L[1].hip.rotation.x=0.25; L[1].knee.rotation.x=1.7; }   // one knee down
  else if(T.k===2){ u.up.position.y=0.74; for(const l of L){ l.hip.rotation.x=0.05; l.knee.rotation.x=0.12; l.hip.rotation.z=l.sx*0.14; } }      // legs out straight, a little apart
  if(T.k!==2) for(const l of L) l.hip.rotation.z=0; }
export const _sV=new THREE.Vector3();
export function makeSoldierBar(){   // tiny billboarded HP bar above each soldier's head
  const g=new THREE.Group();
  const bg=new THREE.Mesh(new THREE.PlaneGeometry(1.0,0.2), new THREE.MeshBasicMaterial({color:0x080b05,transparent:true,opacity:0.72,depthTest:false,depthWrite:false})); bg.renderOrder=20; g.add(bg);
  const fill=new THREE.Mesh(new THREE.PlaneGeometry(1.0,0.15), new THREE.MeshBasicMaterial({color:0x7fe06a,transparent:true,depthTest:false,depthWrite:false})); fill.position.z=0.01; fill.renderOrder=21; g.add(fill);
  g.scale.setScalar(0.95); g.visible=false; return {g, fill};
}
export function _placeSoldiers(){ const c=core?core.pos:{x:0,z:0}; const n=Math.max(1,soldiers.length);
  soldiers.forEach((s,i)=>{ const a=i/n*6.283 - 1.2; s.postAngle=a; s.home.set(c.x+Math.cos(a)*SOLDIER.ringR, 0, c.z+Math.sin(a)*SOLDIER.ringR);
    if(s.pos.lengthSq()===0) s.pos.copy(s.home); }); }
export function spawnSoldier(){ if(soldiers.length>=SOLDIER.cap) return; const g=makeSoldierMesh(); g.scale.setScalar(SOLDIER.scale); scene.add(g);
  const mhp=Math.round(SOLDIER.hp + guardBonusHp() + Math.random()*22 - 8);   // each soldier is an individual (varied HP) + GUARD ARMOR upgrade
  const bar=makeSoldierBar(); scene.add(bar.g);
  soldiers.push({ g, bar:bar.g, barFill:bar.fill, pos:new THREE.Vector3(), home:new THREE.Vector3(), hp:mhp, maxHp:mhp,
    fireAt:0, hurtAt:0, hitT:0, postAngle:0, bob:Math.random()*6.28, wpx:0, wpz:0, wanderAt:0, dead:false }); _placeSoldiers(); }
export function deploySoldiers(target){ while(soldiers.length<Math.min(SOLDIER.cap,target)) spawnSoldier(); _placeSoldiers(); }
export function clearSoldiers(){ for(const s of soldiers){ scene.remove(s.g); scene.remove(s.bar); } soldiers.length=0; }
export function damageSoldier(s, dmg){ if(s.dead) return; s.hp-=dmg; s.hitT=0.16;
  const t=s.g.userData.torso; if(t){ t.material.emissive.setHex(0xff5a2a); t.material.emissiveIntensity=0.85; }
  if(s.hp<=0) killSoldier(s); }
export function killSoldier(s){ if(s.dead) return; s.dead=true; const i=soldiers.indexOf(s); if(i>=0) soldiers.splice(i,1);
  burst(s.pos, 0xb04830, 10, 6, {y:1.0, life:0.5, size:0.8}); burst(s.pos, 0x2c331c, 5, 4, {y:0.8, life:0.7, size:1.1, smoke:true, op:0.4});
  floatText('✝', '#ff9a7a', {x:s.pos.x,y:1.7,z:s.pos.z}, 18); sfx('explode'); scene.remove(s.g); scene.remove(s.bar); _placeSoldiers(); }
export function updateSoldiers(dt, now){
  if(!soldiers.length) return;
  for(const s of soldiers){
    // amble back & forth around the guard post
    if(now>=s.wanderAt){ s.wanderAt=now+0.9+Math.random()*1.5; s.wpx=(Math.random()*2-1)*1.9; s.wpz=(Math.random()*2-1)*1.9; }
    const tx=s.home.x+s.wpx, tz=s.home.z+s.wpz, mk=Math.min(1,dt*1.7), ox=s.pos.x, oz=s.pos.z;
    s.pos.x+=(tx-s.pos.x)*mk; s.pos.z+=(tz-s.pos.z)*mk; let _fired=false;
    s.bob+=dt; s.g.position.set(s.pos.x, heightAt(s.pos.x,s.pos.z), s.pos.z);
    // target nearest enemy in (moderate) range
    let best=null, bd=SOLDIER.range*SOLDIER.range;
    for(const e of enemies){ const dx=e.pos.x-s.pos.x, dz=e.pos.z-s.pos.z, q=dx*dx+dz*dz; if(q<bd){ bd=q; best=e; } }
    if(boss&&boss.alive){ const dx=boss.pos.x-s.pos.x, dz=boss.pos.z-s.pos.z, q=dx*dx+dz*dz; if(q<bd){ bd=q; best=boss; } }
    if(best){ const ang=Math.atan2(best.pos.x-s.pos.x, best.pos.z-s.pos.z); s.g.rotation.y=ang;
      if(now>=s.fireAt){ s.fireAt=now + SOLDIER.fireCd*guardFireMul(); _fired=true;   // GUARD: DRILL upgrade → faster fire
        s.g.userData.muzzle.getWorldPosition(_sV);
        spawnBullet(_sV.x,_sV.z,ang,{owner:'p', inf:true, dmg:SOLDIER.dmg*(1+soldierLvl*0.22), speed:84, color:0xe8ef86, r:0.26, life:1.4, maxDist:SOLDIER.range+2});
        spawnPart(_sV.x,_sV.y,_sV.z, Math.sin(ang)*6,0.4,Math.cos(ang)*6, {color:0xf2f7a0, size:0.55, life:0.07, grav:0, drag:9}); } }
    else { const mvx=tx-s.pos.x, mvz=tz-s.pos.z; if(mvx*mvx+mvz*mvz>0.02){ const wf=Math.atan2(mvx,mvz); let df=((wf-s.g.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI; s.g.rotation.y+=df*Math.min(1,dt*4); } }   // face where they walk
    animateSoldier(s.g, Math.hypot(s.pos.x-ox, s.pos.z-oz)/SOLDIER.scale, dt, _fired);
    if(now>=s.hurtAt){ let adj=0; for(const e of enemies){ const dx=e.pos.x-s.pos.x, dz=e.pos.z-s.pos.z; if(dx*dx+dz*dz < (e.r+1.0)*(e.r+1.0)) adj++; }
      if(adj){ damageSoldier(s, (7+S.stage*1.6)*adj); s.hurtAt=now+0.55; } }   // a swarm at the post overwhelms them fast
    // billboarded HP bar above the head
    s.bar.visible = s.hp < s.maxHp-0.5; s.bar.position.set(s.pos.x, 3.05+heightAt(s.pos.x,s.pos.z), s.pos.z); s.bar.quaternion.copy(camera.quaternion);
    const f=Math.max(0,s.hp/s.maxHp); s.barFill.scale.x=Math.max(0.001,f); s.barFill.position.x=-(1-f)*0.5;
    s.barFill.material.color.setHex(f>0.5?0x7fe06a:(f>0.25?0xffcf5a:0xff5a4a));
    if(s.hitT>0){ s.hitT-=dt; if(s.hitT<=0){ const t=s.g.userData.torso; if(t){ t.material.emissive.setHex(0x000000); t.material.emissiveIntensity=0; } } }
  }
}
export function __set_soldierLvl(v){ soldierLvl=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
