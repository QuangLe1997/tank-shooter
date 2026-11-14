// actors/soldiers.js — infantryman: jointed legs (walk cycle), plate carrier + pouches, covered helmet w/ NVG mount, gloves, boots, M4-pattern carbine with optic
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MOBILE, S, SOLDIER, _R, _canvasTex, boss, burst, camera, core, enemies, floatText, guardBonusHp, guardFireMul, heightAt, paintTroops, scene, sfx, spawnBullet, spawnPart } from '../hub.js';
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
  const hx=c=>'#'+c.getHexString();   // Z179 gear (64–80 px) and helmet (80–96 px) get their own stripes so world/sidepaint.js can repaint them per battlefield
  const map=_kitTex(x=>{ x.drawImage(camoImg,0,0,64,64); x.fillStyle='#fff'; x.fillRect(64,0,192,64); x.fillStyle=hx(M.gear.color); x.fillRect(64,0,16,64); if(M.helm){ x.fillStyle=hx(M.helm.color); x.fillRect(80,0,16,64); } }, true);
  const orm=_kitTex(x=>{ [[0.9,0],[0.8,0.1],[0.6,0],[0.45,0.75]].forEach(([r,m],i)=>{ x.fillStyle=`rgb(0,${Math.round(r*255)},${Math.round(m*255)})`; x.fillRect(i*64,0,64,64); }); }, false);
  const em=_kitTex(x=>{ x.fillStyle='#000'; x.fillRect(0,0,256,64); x.fillStyle='#fff'; x.fillRect(128,0,64,64); }, true);
  const mat=new THREE.MeshStandardMaterial({ map, vertexColors:true, roughness:1, metalness:1, roughnessMap:orm, metalnessMap:orm,
    emissive:M.band.emissive.clone(), emissiveMap:em, emissiveIntensity:0.55 });
  const kind=m=> m===M.uni ? 'camo' : m===M.band ? 'glow' : m===M.gun ? 'metal' : 'plain';
  const rb=(w,h,d,r)=>new RoundedBoxGeometry(w,h,d,1,r||0.04);   // Z172 one bevel step: ~1/4 the triangles, same silhouette at game distance
  const parts={ up:[], head:[], arm:[], lh:[], gun:[], hip:[], knee:[] };
  const put=(L,geo,m,x,y,z,rx,ry,rz)=>L.push({ geo, m, x, y, z, rx:rx||0, ry:ry||0, rz:rz||0 });
  const cyl=(r0,r1,h,n)=>new THREE.CylinderGeometry(r0,r1,h,n||10), sph=(r,a,b)=>new THREE.SphereGeometry(r,a||12,b||10);
  // legs (one leg's worth — both legs share it): thigh with a cargo pocket, knee pad, shin, laced boot with a sole
  put(parts.hip, rb(0.17,0.38,0.19,0.06), M.uni, 0,-0.19,0); put(parts.hip, rb(0.06,0.13,0.12,0.02), M.uni, 0.095,-0.2,0.0);    // thigh + cargo pocket
  put(parts.hip, rb(0.19,0.1,0.21,0.03), M.gear, 0,-0.36,0.01);                                                                 // knee pad
  put(parts.knee, rb(0.15,0.34,0.16,0.05), M.uni, 0,-0.17,0); put(parts.knee, rb(0.165,0.13,0.29,0.04), M.dark, 0,-0.33,0.05);   // shin + boot
  put(parts.knee, rb(0.175,0.035,0.31,0.01), M.gear, 0,-0.395,0.05); put(parts.knee, rb(0.155,0.06,0.17,0.02), M.dark, 0,-0.24,0.0);   // sole · boot cuff
  // upper body: torso, plate carrier with mag pouches, frag grenades, radio, belt with canteen, assault pack + bedroll, collar, shoulder pads
  put(parts.up, rb(0.44,0.52,0.26,0.07), M.uni, 0,0.3,0);                                                                        // torso
  put(parts.up, rb(0.48,0.42,0.32,0.05), M.gear, 0,0.33,0.02);                                                                   // plate carrier
  for(const px of [-0.13,0,0.13]) put(parts.up, rb(0.11,0.15,0.08,0.02), M.gear, px,0.24,0.2);                                  // mag pouches
  for(const px of [-0.2,0.2]) put(parts.up, sph(0.045,8,6), M.dark, px,0.36,0.19);                                              // frag grenades
  put(parts.up, rb(0.08,0.14,0.07,0.015), M.dark, -0.22,0.44,0.1); put(parts.up, cyl(0.007,0.007,0.42,4), M.dark, -0.24,0.68,-0.02, 0.15);   // radio + whip antenna
  put(parts.up, rb(0.5,0.07,0.3,0.02), M.gear, 0,0.05,0.0); put(parts.up, cyl(0.06,0.06,0.15,10), M.gear, 0.24,0.06,-0.1);     // belt + canteen
  put(parts.up, rb(0.36,0.42,0.2,0.05), M.gear, 0,0.36,-0.25); put(parts.up, rb(0.24,0.16,0.07,0.03), M.gear, 0,0.27,-0.37);   // assault pack + lid pocket
  put(parts.up, cyl(0.06,0.06,0.3,8), M.dark, 0.2,0.58,-0.25, 0,0,Math.PI/2);                                                   // bedroll
  put(parts.up, cyl(0.1,0.12,0.07,12), M.uni, 0,0.56,0);                                                                         // collar
  for(const sx of [-1,1]) put(parts.up, rb(0.13,0.07,0.17,0.03), M.gear, sx*0.24,0.55,0.0, 0,0,sx*-0.35);                     // shoulder pads
  // head (own joint → looks around): neck, face, nose, ears, covered helmet with brim + band + chin strap, NVG mount, goggles
  put(parts.head, cyl(0.06,0.07,0.1,10), M.skin, 0,0.0,0);
  put(parts.head, sph(0.13,10,8), M.skin, 0,0.15,0.01); put(parts.head, rb(0.035,0.05,0.04,0.01), M.skin, 0,0.14,0.14);       // face + nose
  for(const sx of [-1,1]) put(parts.head, sph(0.03,6,5), M.skin, sx*0.128,0.15,0.0);                                            // ears
  put(parts.head, new THREE.SphereGeometry(0.165,12,6,0,6.283,0,1.55), M.helm||M.uni, 0,0.17,0);                               // covered helmet (side colour)
  put(parts.head, cyl(0.178,0.178,0.03,12), M.gear, 0,0.17,0); put(parts.head, cyl(0.185,0.185,0.012,12), M.helm||M.uni, 0,0.155,0);   // band + brim
  for(const sx of [-1,1]) put(parts.head, rb(0.012,0.12,0.02,0.004), M.dark, sx*0.12,0.08,0.03);                              // chin strap
  put(parts.head, rb(0.06,0.06,0.05,0.01), M.dark, 0,0.26,0.15);                                                                 // NVG shroud mount
  put(parts.head, rb(0.22,0.05,0.03,0.01), M.dark, 0,0.205,0.14); put(parts.head, rb(0.08,0.04,0.025,0.01), M.gear, 0,0.205,0.16);   // goggles strap + lenses (on the helmet)
  // arms: right arm + left upper arm ride the rifle; the left forearm + glove is its own joint (reload, grip)
  put(parts.arm, rb(0.12,0.32,0.13,0.04), M.uni, -0.25,-0.05,0.08, -0.9,0,0.25); put(parts.arm, rb(0.12,0.32,0.13,0.04), M.uni, 0.25,-0.05,0.08, -0.9,0,-0.25);   // upper arms
  put(parts.arm, rb(0.1,0.28,0.11,0.04), M.uni, 0.15,-0.08,0.26, -1.3,0,-0.4); put(parts.arm, sph(0.055,8,6), M.dark, 0.1,-0.08,0.14);                           // right forearm + glove (on the grip)
  for(const sx of [-1,1]) put(parts.arm, rb(0.135,0.09,0.145,0.02), M.band||M.gear, sx*0.25,0.04,0.0, -0.9,0,sx*-0.25);                                          // Z104 ID armbands
  for(const sx of [-1,1]) put(parts.arm, rb(0.13,0.07,0.12,0.03), M.gear, sx*0.205,-0.16,0.2, -1.2,0,sx*-0.3);                                                   // elbow pads
  put(parts.lh, rb(0.1,0.28,0.11,0.04), M.uni, 0.08,0.03,0.1, -1.45,0,0.6); put(parts.lh, sph(0.055,8,6), M.dark, 0.18,0.07,0.22);                               // left forearm + glove (on the handguard)
  // M4-pattern carbine: receiver, barrel + muzzle brake, railed handguard + vertical grip, magazine, stock, optic, charging handle, sling
  put(parts.gun, rb(0.06,0.1,0.42,0.015), M.gun, 0,0,0.12); put(parts.gun, cyl(0.018,0.02,0.36,8), M.gun, 0,0.01,0.5, Math.PI/2);   // receiver + barrel
  put(parts.gun, cyl(0.026,0.026,0.06,8), M.gun, 0,0.01,0.69, Math.PI/2);                                                           // muzzle brake
  put(parts.gun, rb(0.07,0.07,0.22,0.015), M.gun, 0,0.0,0.34); put(parts.gun, rb(0.02,0.015,0.24,0.004), M.dark, 0,0.045,0.34);   // handguard + top rail
  put(parts.gun, rb(0.03,0.08,0.035,0.008), M.gun, 0,-0.07,0.38);                                                                    // vertical foregrip
  put(parts.gun, rb(0.045,0.16,0.07,0.01), M.gun, 0,-0.11,0.1, 0.25);                                                               // magazine
  put(parts.gun, rb(0.05,0.08,0.2,0.015), M.gun, 0,-0.02,-0.18); put(parts.gun, rb(0.035,0.07,0.06,0.01), M.gun, 0,-0.08,0.0, -0.35);   // stock + pistol grip
  put(parts.gun, cyl(0.03,0.03,0.12,10), M.dark, 0,0.08,0.12, Math.PI/2); put(parts.gun, cyl(0.036,0.03,0.025,10), M.dark, 0,0.08,0.185, Math.PI/2);   // optic + objective bell
  put(parts.gun, rb(0.012,0.012,0.5,0.004), M.gear, -0.04,-0.02,0.12);                                                              // sling
  const _m4=new THREE.Matrix4(), _e=new THREE.Euler(), _q=new THREE.Quaternion(), _one=new THREE.Vector3(1,1,1), _p=new THREE.Vector3(), col=new THREE.Color();
  const bake=L=>{ const geos=L.map(pt=>{ const g=(pt.geo.index? pt.geo.toNonIndexed() : pt.geo.clone()); pt.geo.dispose();
      for(const a of Object.keys(g.attributes)) if(a!=='position'&&a!=='normal'&&a!=='uv') g.deleteAttribute(a);
      _m4.compose(_p.set(pt.x,pt.y,pt.z), _q.setFromEuler(_e.set(pt.rx,pt.ry,pt.rz)), _one); g.applyMatrix4(_m4);
      const n=g.attributes.position.count, uv=g.attributes.uv ? g.attributes.uv.array : new Float32Array(n*2), r=_REG[kind(pt.m)], c=new Float32Array(n*3);
      const st = pt.m===M.gear ? 72/256 : (M.helm && pt.m===M.helm) ? 88/256 : 0;   // a stripe carries its own colour
      if(r===0 || st) col.setRGB(1,1,1); else col.copy(pt.m.color);
      for(let i=0;i<n;i++){ const u=r===0 ? Math.min(1,Math.max(0,uv[i*2]))*0.23+0.01 : st || r*0.25+0.125; uv[i*2]=u; if(r!==0) uv[i*2+1]=0.5; c[i*3]=col.r; c[i*3+1]=col.g; c[i*3+2]=col.b; }
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2)); g.setAttribute('color', new THREE.Float32BufferAttribute(c,3)); g.clearGroups(); return g; });
    const merged=mergeGeometries(geos,false); geos.forEach(g=>g.dispose()); merged.computeBoundingSphere(); return merged; };
  const kit={ mat, key, geo:{ up:bake(parts.up), head:bake(parts.head), arm:bake(parts.arm), lh:bake(parts.lh), gun:bake(parts.gun), hip:bake(parts.hip), knee:bake(parts.knee) } };
  SOLDIER_KIT[key]=kit; paintTroops(); return kit;   // Z179 dressed for the current battlefield
}
// Z172 BATCHED TROOPS — a soldier is now a skeleton of plain Object3D joints; nothing of his is drawn on its own. Every frame the joints of every
// visible man are written into ONE InstancedMesh per body part per side (×2: near men cast shadows, far ones don't) → ~28 draw calls for
// the whole battlefield instead of 7 a man, so a crowded assault costs about the same as a quiet one. All the existing animation, stance,
// death and fling code keeps moving the same joints.
export const TROOP_BATCH = { roots:new Set(), im:{}, kinds:['up','head','arm','lh','gun','hip','knee'] };
export function makeSoldierMesh(opts){
  const K=_soldierKit(!!(opts&&opts.enemy)), g=new THREE.Group(), body=new THREE.Group(); body.scale.setScalar(0.84); g.add(body);   // inner rig keeps the old overall height
  const parts=[], mk=(par,kind)=>{ const o=new THREE.Object3D(); par.add(o); parts.push({ o, kind }); return o; };
  const legs=[];
  for(const sx of [-1,1]){ const hip=new THREE.Group(); hip.position.set(sx*0.12,0.74,0); body.add(hip); mk(hip, 'hip');
    const knee=new THREE.Group(); knee.position.set(0,-0.38,0); hip.add(knee); mk(knee, 'knee'); legs.push({hip,knee,sx}); }
  const up=new THREE.Group(); up.position.y=0.74; body.add(up); mk(up, 'up');
  const head=new THREE.Group(); head.position.set(0,0.6,0); up.add(head); mk(head, 'head');
  const armG=new THREE.Group(); armG.position.set(0,0.48,0.02); up.add(armG); mk(armG, 'arm');
  const lh=new THREE.Group(); lh.position.set(-0.2,-0.15,0.2); armG.add(lh); mk(lh, 'lh');
  const gun=new THREE.Group(); gun.position.set(0.04,-0.06,0.16); armG.add(gun); mk(gun, 'gun');
  const muz=new THREE.Object3D(); muz.position.set(0,0.01,0.7); gun.add(muz);
  const torso={ material:{ emissive:new THREE.Color(0), emissiveIntensity:0 } };   // the old per-man hit-flash material, now just data the batch reads
  Object.assign(g.userData, { torso, muzzle:muz, legs, up, gun, walk:0, kick:0, body, arms:armG, head, lh, parts, kitKey:K.key, seed:Math.random()*100, magN:8+((Math.random()*7)|0), shots:0 });
  g.addEventListener('added', ()=>TROOP_BATCH.roots.add(g)); g.addEventListener('removed', ()=>TROOP_BATCH.roots.delete(g));
  return g;
}
const _tbWhite=new THREE.Color(1,1,1), _tbHit=new THREE.Color(2.4,1.05,0.8), _tbBk={}, _tbFr=new THREE.Frustum(), _tbPM=new THREE.Matrix4(), _tbSp=new THREE.Sphere();
function tbIM(key, kind, sh, need){ const id=key+'_'+kind+'_'+(sh?1:0); let m=TROOP_BATCH.im[id];
  if(m && m.instanceMatrix.count>=need) return m;
  const cap=Math.max(64, 1<<Math.ceil(Math.log2(Math.max(1,need)*1.25))); if(m){ m.parent && m.parent.remove(m); m.dispose(); }
  const K=SOLDIER_KIT[key]; m=new THREE.InstancedMesh(K.geo[kind], K.mat, cap); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled=false; m.castShadow=sh; m.count=0;
  for(let i=0;i<cap;i++) m.setColorAt(i, _tbWhite); m.instanceColor.setUsage(THREE.DynamicDrawUsage); scene.add(m); TROOP_BATCH.im[id]=m; return m; }
function tbShown(o){ while(o){ if(!o.visible) return false; if(o===scene) return true; o=o.parent; } return false; }
// call right before the frame is drawn
export function updateTroopBatch(now){
  for(const id in _tbBk) _tbBk[id].n=0;
  camera.updateMatrixWorld(); _tbFr.setFromProjectionMatrix(_tbPM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));   // men off-screen aren't drawn
  for(const r of TROOP_BATCH.roots){ const u=r.userData; if(!u.parts) continue;
    let rootShown=tbShown(r); if(rootShown){ r.updateWorldMatrix(true, true); _tbSp.center.setFromMatrixPosition(r.matrixWorld); _tbSp.radius=2.2*(r.scale.x||1)+3; if(!_tbFr.intersectsSphere(_tbSp)) rootShown=false; }
    const hit=(u.flashUntil||0)>now || u.torso.material.emissiveIntensity>0, sh=!MOBILE && u._cs!==false;
    for(const pt of u.parts){ const detached=!pt.o.parent || pt.o.parent===scene || (pt.kind==='gun' && u.droppedGun);   // a rifle dropped beside the dead lies on its own
      if(detached){ if(!tbShown(pt.o)) continue; pt.o.updateWorldMatrix(true, false); } else if(!rootShown || !tbShown(pt.o)) continue;
      const id=u.kitKey+'_'+pt.kind+'_'+(sh?1:0), B=_tbBk[id]||(_tbBk[id]={ n:0, m:[], c:[], key:u.kitKey, kind:pt.kind, sh });
      B.m[B.n]=pt.o.matrixWorld; B.c[B.n]=hit; B.n++; } }
  for(const key in SOLDIER_KIT) for(const kind of TROOP_BATCH.kinds) for(const sh of (MOBILE?[false]:[true,false])){ const id=key+'_'+kind+'_'+(sh?1:0); if(!_tbBk[id]) _tbBk[id]={ n:0, m:[], c:[], key, kind, sh }; }
  for(const id in _tbBk){ const B=_tbBk[id], m=tbIM(B.key, B.kind, B.sh, B.n), A=m.instanceMatrix.array, C=m.instanceColor.array;
    for(let i=0;i<B.n;i++){ A.set(B.m[i].elements, i*16); const c=B.c[i]?_tbHit:_tbWhite; C[i*3]=c.r; C[i*3+1]=c.g; C[i*3+2]=c.b; }
    if(m.count!==B.n || B.n){ m.count=B.n; m.instanceMatrix.needsUpdate=true; m.instanceColor.needsUpdate=true; } } }
// a man is hit: the batch flashes him and he flinches
export function soldierHit(g){ const u=g.userData; u.flashUntil=performance.now()/1000+0.12; u.flinch=1; }
export function soldierReloading(g){ return (g.userData.reload||0)>0; }
// walk / run / crouch-walk / crawl cycles driven by ground covered; rifle at the ready while moving, shouldered when firing; a mag change every
// 8–14 rounds (left hand to the pouch and back); flinch on a hit; the head scans when nobody is shooting
export function animateSoldier(g, dist, dt, firing){
  const u=g.userData; if(!u.legs) return; dt=Math.max(dt,1e-3);
  const spd=dist/dt; u.spd=(u.spd||0)+(spd-(u.spd||0))*Math.min(1,dt*8); const run=Math.min(1, Math.max(0, (u.spd-2.4)/2.6));
  u.walk += dist*(7.5-run*1.6); const amp=Math.min(0.75+run*0.2, spd*0.18);
  for(const l of u.legs){ const ph=u.walk + (l.sx>0?Math.PI:0); l.hip.rotation.x = Math.sin(ph)*amp; l.knee.rotation.x = Math.max(0, -Math.cos(ph))*amp*(1.1+run*0.5); }
  u.t=(u.t||0)+dt; u.up.position.y = 0.74 + Math.abs(Math.sin(u.walk))*(0.03+run*0.03)*Math.min(1,amp*2) + Math.sin(u.t*2.1)*0.006;
  if(firing && !(u.reload>0)){ u.kick=1; u.aimT=2.2; u.shots=(u.shots||0)+1; if(u.shots>=u.magN){ u.shots=0; u.reload=1.7; u.magN=8+((Math.random()*7)|0); } }
  u.kick=Math.max(0,u.kick-dt*9); u.aimT=Math.max(0,(u.aimT||0)-dt); u.gun.position.z = 0.16 - u.kick*0.06; u.gun.rotation.x = -u.kick*0.12;
  if(u.torso.material.emissiveIntensity>0 && !u._fl){ u.flinch=1; } u._fl=u.torso.material.emissiveIntensity>0; u.flinch=Math.max(0,(u.flinch||0)-dt*5);
  // rifle handling layered on top of the stance (poseSoldier adds the same offsets)
  const ready=u.aimT>0?0:1, rl=u.reload>0 ? Math.sin(Math.min(1,(1.7-u.reload)/1.7)*Math.PI) : 0; if(u.reload>0) u.reload=Math.max(0,u.reload-dt);
  u.armAdd = run*0.55*ready + 0.18*ready*(1-run) + rl*0.42 - u.kick*0.05; u.armRz = rl*0.55 + run*0.12*ready;
  u.upAdd = run*0.22 - u.flinch*0.35;
  if(u.lh){ u.lh.rotation.x = rl*1.25; u.lh.rotation.z = -rl*0.5; u.lh.position.y = -0.15 - rl*0.08; }
  if(u.head){ const scan = u.aimT>0||run>0.3 ? 0 : Math.sin(u.t*0.55+u.seed)*0.55*Math.max(0,Math.sin(u.t*0.21+u.seed*0.7)); u.head.rotation.y += (scan-u.head.rotation.y)*Math.min(1,dt*3); u.head.rotation.x = -u.flinch*0.3 + rl*0.35; }
  const P=u.pose; if(u.arms){ u.arms.rotation.x=(P?P.arm:0)+u.armAdd; u.arms.rotation.z=u.armRz; } u.up.rotation.x=(P?P.up:0)+u.upAdd;
}
// Z105 STANCES — call after animateSoldier(): 'stand' (walk cycle as is) · 'crouch' (kneel to fire / hide behind cover) ·
// 'prone' (flat on the ground, rifle forward — the hardest target). Blends smoothly so nobody snaps between poses.
const _ST={ stand:{ rx:0, y:0, z:0, up:0, arm:0, k:0 }, crouch:{ rx:0, y:0, z:0, up:0.15, arm:0, k:1 }, prone:{ rx:1.42, y:0.17, z:-0.55, up:-0.32, arm:-1.08, k:2 } };
// Z111b HP bar height follows the stance: a man lying flat to shoot had his bar hanging 2 m over him → looked like a corpse with an HP bar
export function stanceBarK(g){ const s=g.userData.stance; return s==='prone' ? 0.42 : s==='crouch' ? 0.74 : 1; }
// Z113 stances blend as WEIGHTS — legs included (they used to snap to the kneel / prone angles in one frame) — and go through the knee:
// stand → kneel → lie down, lie → kneel → stand up. A new stance must be asked for ~0.35 s before he commits (no flicker).
const _LEG={ crouch:[[-1.35,1.35],[0.25,1.7]], prone:[[0.05,0.12],[0.05,0.12]] };
export function poseSoldier(g, stance, dt){ const u=g.userData; if(!u.body) return; const P=u.pose||(u.pose={ rx:0, y:0, z:0, up:0, arm:0, kw:0, pw:0 });
  if(u.stance && stance!==u.stance){ u.stAsk=(u.stAsk||0)+dt; if(u.stAsk<0.35) stance=u.stance; else u.stAsk=0; } else u.stAsk=0;
  let eff=stance; if(stance==='prone' && P.pw<0.05 && P.kw<0.65) eff='crouch'; else if(stance==='stand' && P.pw>0.35) eff='crouch';   // via the knee
  const T=_ST[eff]||_ST.stand, f=1-Math.exp(-dt*6.5), fw=Math.min(1, dt*4.2);
  for(const k of ['rx','y','z','up','arm']) P[k]+=(T[k]-P[k])*f;
  P.kw += ((eff==='crouch'?1:0)-P.kw)*fw; P.pw += ((eff==='prone'?1:0)-P.pw)*fw; const sw=P.kw+P.pw; if(sw>1){ P.kw/=sw; P.pw/=sw; }
  u.body.rotation.x=P.rx; u.body.position.y=P.y; u.body.position.z=P.z; u.up.rotation.x=P.up+(u.upAdd||0)*(1-P.pw); if(u.arms){ u.arms.rotation.x=P.arm+(u.armAdd||0)*(1-P.pw*0.8); u.arms.rotation.z=(u.armRz||0); }
  u.stance=stance; const L=u.legs, w0=1-P.kw-P.pw;
  for(let i=0;i<L.length;i++){ const l=L[i], c=_LEG.crouch[i], q=_LEG.prone[i];
    l.hip.rotation.x = l.hip.rotation.x*w0 + c[0]*P.kw + q[0]*P.pw; l.knee.rotation.x = l.knee.rotation.x*w0 + c[1]*P.kw + q[1]*P.pw; l.hip.rotation.z = l.sx*0.14*P.pw;
    const mv=Math.min(1,(u.spd||0)/1.2), ph=(u.walk||0)+(l.sx>0?Math.PI:0);   // Z172 moving low: short crouched strides · a crawl when flat (knees drawn up in turn)
    if(mv>0.05 && P.kw>0.3){ l.hip.rotation.x += Math.sin(ph)*0.32*mv*P.kw; l.knee.rotation.x += Math.max(0,-Math.cos(ph))*0.3*mv*P.kw; }
    if(mv>0.05 && P.pw>0.4){ l.hip.rotation.z += l.sx*Math.max(0,Math.sin(ph))*0.55*mv*P.pw; l.knee.rotation.x += Math.max(0,Math.sin(ph))*0.9*mv*P.pw; } }
  if(P.pw>0.4 && (u.spd||0)>0.1 && u.arms){ const mv=Math.min(1,u.spd/1.2); u.arms.rotation.z += Math.sin(u.walk||0)*0.22*mv; u.body.rotation.z = Math.sin(u.walk||0)*0.07*mv; } else if(u.body) u.body.rotation.z*=0.8;
  u.up.position.y = u.up.position.y*(1-P.kw) + 0.5*P.kw; }
// Z113 a man brought back from the pool: rifle back in his hands, arms and legs reset
export function reviveSoldierMesh(m){ const u=m.userData; if(!u.gun) return;
  if(u.gunHome && u.gun.parent!==u.gunHome){ u.gun.parent && u.gun.parent.remove(u.gun); u.gunHome.add(u.gun); u.gun.position.copy(u.gunPos); u.gun.rotation.set(0,0,0); u.gun.scale.setScalar(1); }
  if(u.arms) u.arms.rotation.set(0,0,0); u.stance=null; u.stAsk=0; }
// Z113 the dead are unmistakable: on his back, arms flung back, the rifle dropped beside him (a live man lying down is face-down, rifle forward)
export function dropSoldierGun(m){ const u=m.userData; if(!u.gun || !u.gun.parent) return; u.gunHome=u.gunHome||u.gun.parent; u.gunPos=u.gunPos||u.gun.position.clone();
  const wp=new THREE.Vector3(); u.gun.getWorldPosition(wp); const s=m.scale.x||1; u.gun.parent.remove(u.gun); scene.add(u.gun); u.gun.scale.setScalar(s);
  const a=m.rotation.y+(Math.random()<0.5?1:-1)*(0.9+Math.random()*0.6); u.gun.position.set(wp.x+Math.sin(a)*0.7*s, heightAt(wp.x,wp.z)+0.06*s, wp.z+Math.cos(a)*0.7*s); u.gun.rotation.set(0, a+Math.PI/2, Math.PI/2); u.droppedGun=u.gun; }
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
