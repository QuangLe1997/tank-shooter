// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { blobTex, grimeMat, panelNrm, panelRgh, panelTex, realCol, trackTex, wheelTex } from '../hub.js';

// ---- shared tank geometries (built once; every tank references them) ----
export const TANK_GEO = {};
export function _tankGeo(){
  if(TANK_GEO.ready) return TANK_GEO;
  const ext=(shape, depth, bevel)=>new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled:!!bevel, bevelThickness:bevel||0, bevelSize:bevel||0, bevelSegments:2, curveSegments:10 });
  const sideProfile=(pts, width, bevel)=>{ const s=new THREE.Shape(); pts.forEach((p,i)=>i?s.lineTo(p[0],p[1]):s.moveTo(p[0],p[1])); s.closePath();
    const gg=ext(s, width, bevel); gg.rotateY(-Math.PI/2); gg.translate(width/2,0,0); return gg; };   // profile drawn in (z,y), extruded across the hull width
  // LOWER HULL sits between the tracks: belly + steep lower glacis
  TANK_GEO.hullLo = sideProfile([[-2.0,0.42],[1.3,0.42],[2.0,0.98],[-2.0,0.98]], 1.74, 0.03);
  // UPPER HULL overhangs the tracks: long shallow upper glacis → flat engine deck → sloped rear plate
  TANK_GEO.hullUp = sideProfile([[-2.04,0.98],[2.06,0.98],[2.08,1.05],[0.82,1.42],[-1.72,1.45],[-2.04,1.3]], 2.96, 0.035);
  // TRACK BELT: one continuous loop wrapping the rear sprocket, the ground run, the raised front idler and the top run
  const T=0.09, belt=new THREE.Shape();
  belt.moveTo(-1.5,0.0); belt.lineTo(1.42,0.0); belt.lineTo(1.9,0.36); belt.absarc(1.78,0.62,0.3,-0.86,Math.PI/2,false); belt.lineTo(-1.82,0.92); belt.absarc(-1.82,0.6,0.32,Math.PI/2,Math.PI+0.92,false); belt.lineTo(-1.5,0.0);
  const hole=new THREE.Path();
  hole.moveTo(-1.47,T); hole.lineTo(1.38,T); hole.lineTo(1.8,0.41); hole.absarc(1.78,0.62,0.3-T,-0.86,Math.PI/2,false); hole.lineTo(-1.82,0.92-T); hole.absarc(-1.82,0.6,0.32-T,Math.PI/2,Math.PI+0.92,false); hole.lineTo(-1.47,T);
  belt.holes.push(hole);
  TANK_GEO.track = (()=>{ const gg=ext(belt,0.6,0); gg.rotateY(-Math.PI/2); gg.translate(0.3,0,0); return gg; })();
  // TURRET: angular wedge-front modern MBT turret (top-view polygon extruded upward, bevelled edges)
  const tp=[[-0.84,-1.02],[0.84,-1.02],[0.95,-0.78],[0.97,0.34],[0.66,1.12],[0.3,1.24],[-0.3,1.24],[-0.66,1.12],[-0.97,0.34],[-0.95,-0.78]];
  const ts=new THREE.Shape(); tp.forEach((p,i)=>i?ts.lineTo(p[0],p[1]):ts.moveTo(p[0],p[1])); ts.closePath();
  TANK_GEO.turret = (()=>{ const gg=ext(ts,0.56,0.05); gg.rotateX(Math.PI/2); gg.translate(0,0.28,0); return gg; })();
  TANK_GEO.turretCheeks = tp;                                                         // reused to seat the ERA bricks along the wedge
  // road wheel / idler: axis along X (pre-rotated → spin with rotation.x); groups: 0 tyre, 1+2 faces
  TANK_GEO.wheel = new THREE.CylinderGeometry(0.33,0.33,0.5,20); TANK_GEO.wheel.rotateZ(Math.PI/2);
  TANK_GEO.wheelS = new THREE.CylinderGeometry(0.33,0.33,0.46,14); TANK_GEO.wheelS.rotateZ(Math.PI/2);
  // drive sprocket: 12-tooth gear disc pair
  const gear=new THREE.Shape(), NT=12; for(let i=0;i<NT*2;i++){ const a=i/(NT*2)*Math.PI*2, r=(i%2)?0.24:0.31; const px=Math.cos(a)*r, py=Math.sin(a)*r; i?gear.lineTo(px,py):gear.moveTo(px,py); } gear.closePath();
  TANK_GEO.sprocket = (()=>{ const gg=ext(gear,0.5,0); gg.rotateY(Math.PI/2); gg.translate(-0.25,0,0); return gg; })();
  TANK_GEO.skirtSeg = new THREE.BoxGeometry(0.06,0.44,0.9);
  TANK_GEO.skirt = new THREE.BoxGeometry(0.06,0.44,3.7);
  for(const k of ['hullLo','hullUp','turret']){ const uv=TANK_GEO[k].attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i, uv.getX(i)*0.34, uv.getY(i)*0.34); uv.needsUpdate=true; }
  TANK_GEO.blob = new THREE.PlaneGeometry(4.0,5.4); TANK_GEO.blob.rotateX(-Math.PI/2);
  TANK_GEO.era = new THREE.BoxGeometry(0.34,0.09,0.3);
  TANK_GEO.ready=true; return TANK_GEO;
}
export let _BLOB_MAT=null;
export const blobMat=()=>(_BLOB_MAT||(_BLOB_MAT=new THREE.MeshBasicMaterial({ map:blobTex(), transparent:true, opacity:0.62, depthWrite:false, color:0x000000 })));
export const TRUNNION_Z = 1.12;   // gun trunnion (pitch pivot) on the turret front — barrels are authored in turret space and hang off this pivot
export function buildTank(opts={}){
  const { accent=0xe7b54a, detail=false } = opts;
  const hull=realCol(opts.hull??0x5e7a2e), turret=realCol(opts.turret??0x75933a), barrel=realCol(opts.barrel??0x9bb04a,0.35,0.7);
  const G=_tankGeo(), g=new THREE.Group(); g.rotation.order='YXZ';   // yaw, then pitch/roll on the slope
  const PT=panelTex(), PN=panelNrm(), PR=panelRgh();
  const _mc={}, memo=(k,f)=>_mc[k]||(_mc[k]=f());                                   // one material per colour/kind per tank → static parts merge into few draw calls
  const skin =(c,k)=>memo('s'+c+'_'+k, ()=>grimeMat(new THREE.MeshStandardMaterial({ color:c, roughness:0.8, metalness:0.4, map:PT, normalMap:PN, normalScale:new THREE.Vector2(0.75,0.75), roughnessMap:PR, envMapIntensity:0.6 }), k==null?1:k));   // painted armour plate
  const metal=(c)=>memo('m'+c, ()=>new THREE.MeshStandardMaterial({ color:c, roughness:0.36, metalness:0.85, normalMap:PN, normalScale:new THREE.Vector2(0.3,0.3), envMapIntensity:0.95 }));   // bare / oiled steel
  const dark =(c)=>memo('d'+c, ()=>new THREE.MeshStandardMaterial({ color:c, roughness:0.62, metalness:0.45 }));
  const mk=(par,geo,mat,x,y,z)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); par.add(m); return m; };
  const HULL=skin(hull,1), TUR=skin(turret,0.45), GUN=metal(barrel), STEEL=metal(0x3d3c35), BLACK=dark(0x141412);
  const rubber=grimeMat(new THREE.MeshStandardMaterial({ color:0x1b1a17, roughness:0.95, metalness:0.05 }), 1);
  const face  =grimeMat(new THREE.MeshStandardMaterial({ map:wheelTex(), roughness:0.75, metalness:0.4 }), 0.8);
  const rig={ wheels:[[],[]], wheelTex:[], tracks:[], lx:undefined, lz:0, lf:0, v:0, a:0, pitch:0, pv:0, roll:0, rv:0, recoil:0, recoilLen:0.42, vib:0, elev:0, elevT:0, t:Math.random()*10 };
  // ---------- running gear (unsprung: stays on the ground) ----------
  const NW = detail?6:5, wGeo = detail?G.wheel:G.wheelS;
  for(let si=0; si<2; si++){ const sx = si ? 1.18 : -1.18;
    const tex=trackTex().clone(); tex.needsUpdate=true; rig.tracks.push(tex);       // own texture per belt → each side scrolls independently (skid-steer turns)
    const beltMat=grimeMat(new THREE.MeshStandardMaterial({ color:0xb4b0a4, map:tex, roughness:0.85, metalness:0.5 }), 1);
    mk(g, G.track, [rubber, beltMat], sx, 0, 0);
    const wt=wheelTex().clone(); wt.needsUpdate=true; wt.center.set(0.5,0.5); rig.wheelTex.push(wt);   // spinning the face texture = spinning every wheel on this side (1 draw call)
    const fm=grimeMat(new THREE.MeshStandardMaterial({ map:wt, roughness:0.75, metalness:0.4 }), 0.8);
    const tyres=[], faces=[], W2=detail?0.25:0.23;
    const wheelAt=(z,y,r)=>{ const ty=new THREE.CylinderGeometry(r,r,W2*2,detail?20:14,1,true); ty.rotateZ(Math.PI/2); ty.translate(sx,y,z); tyres.push(ty);
      for(const sd of [-1,1]){ const f=new THREE.CircleGeometry(r,detail?20:14); f.rotateY(sd*Math.PI/2); f.translate(sx+sd*W2,y,z); faces.push(f); } };
    for(let i=0;i<NW;i++) wheelAt(-1.4 + i*(2.8/(NW-1)), 0.43, 0.33);
    wheelAt(1.78, 0.62, 0.21);                                                         // front idler
    mk(g, mergeGeometries(tyres), rubber, 0,0,0); mk(g, mergeGeometries(faces), fm, 0,0,0); tyres.forEach(t=>t.dispose()); faces.forEach(f=>f.dispose());
    mk(g, G.sprocket, STEEL, sx, 0.6, -1.82);
  }
  const blob=new THREE.Mesh(G.blob, blobMat()); blob.position.y=0.03; blob.renderOrder=-1; blob.userData.keep=true; g.add(blob);
  // ---------- sprung hull (pitches / rolls on the suspension) ----------
  const body=new THREE.Group(); body.position.y=0.95; g.add(body);
  const B=(geo,mat,x,y,z)=>mk(body,geo,mat,x,y-0.95,z);
  const hullM=B(G.hullLo, HULL, 0,0,0); B(G.hullUp, HULL, 0,0,0);
  for(const sx of [-1,1]){                                                           // side skirts hang off the upper-hull edge, covering the top half of the wheels
    if(detail){ for(let k=0;k<4;k++){ const sk=B(G.skirtSeg, HULL, sx*1.51, 0.77, -1.39+k*0.925); sk.rotation.z=sx*0.04; } }
    else { const sk=B(G.skirt, HULL, sx*1.51, 0.77, 0.03); sk.rotation.z=sx*0.04; }
  }
  const ACC=new THREE.MeshStandardMaterial({ color:accent, emissive:accent, emissiveIntensity:0.12, roughness:0.7, metalness:0.1 });   // painted faction ID marking (matte, not neon)
  const HLM=new THREE.MeshStandardMaterial({color:0xfff2d0,emissive:0xffeec0,emissiveIntensity:0.35,roughness:0.25});
  for(const hx of [-1.22,1.22]){ const hl=B(new THREE.CylinderGeometry(0.09,0.1,0.1,12), HLM, hx,1.14,1.98); hl.rotation.x=Math.PI/2-0.29; }   // headlights on the nose corners
  const exhaust=new THREE.Object3D(); exhaust.position.set(-0.9,1.32-0.95,-2.08); body.add(exhaust);   // engine exhaust outlet (smoke FX source)
  if(detail){
    for(const hx of [-1.22,1.22]){ const gd=B(new THREE.TorusGeometry(0.13,0.02,6,14), STEEL, hx,1.14,2.0); gd.rotation.x=-0.29; }                 // headlight brush guards
    for(const tx of [-0.62,0.62]){ const th=B(new THREE.TorusGeometry(0.11,0.035,6,12), STEEL, tx,0.66,1.92); th.rotation.y=Math.PI/2; }          // front tow hooks
    if(!opts.mighty) for(let i=-2;i<=2;i++){ const lk=B(new THREE.BoxGeometry(0.34,0.07,0.22), STEEL, i*0.36,1.225,1.62); lk.rotation.x=0.29; }                       // spare track shoes on the upper glacis
    for(const gx of [-0.46,0.46]){ B(new THREE.BoxGeometry(0.78,0.035,0.95), BLACK, gx,1.465,-1.1); for(let k=0;k<5;k++) B(new THREE.BoxGeometry(0.74,0.02,0.035), STEEL, gx,1.49,-1.48+k*0.19); }   // engine-deck intake grilles + slats
    B(new THREE.BoxGeometry(1.5,0.3,0.04), BLACK, 0,1.12,-2.07);                                                                                       // rear exhaust grille
    for(const jx of [-1.18,1.18]){ B(new RoundedBoxGeometry(0.34,0.44,0.16,1,0.03), dark(0x3d4a2c), jx,1.25,-2.12); }                                 // jerry cans on the rear plate
    B(new RoundedBoxGeometry(2.3,0.16,0.18,1,0.05), dark(0x4a3a22), 0,1.53,-1.62);                                                                     // unditching beam across the deck
    const cable=B(new THREE.TorusGeometry(0.07,0.035,6,24,Math.PI*1.3), BLACK, 1.32,1.47,-0.2); cable.rotation.set(Math.PI/2,0,0.3);                    // tow cable coil
    for(let i=0;i<6;i++){ for(const sx of [-1.545,1.545]) B(new THREE.SphereGeometry(0.035,6,4), STEEL, sx,0.93,-1.7+i*0.66); }                           // skirt mounting bolts
  }
  // ---------- turret (yaws to aim) ----------
  const turretG=new THREE.Group(); turretG.position.set(0, 1.45+0.3-0.95, -0.12); body.add(turretG);
  mk(turretG, new THREE.CylinderGeometry(0.86,0.9,0.12,24), BLACK, 0,-0.33,0);                                                     // turret ring
  const turM=mk(turretG, G.turret, TUR, 0,0,0);
  mk(turretG, new RoundedBoxGeometry(0.7,0.5,0.36,2,0.06), metal(realCol(turret,0.6,0.7)), 0,0.0,1.2);                         // gun mantlet
  for(const s of [-1,1]){ const st=mk(turretG, new THREE.BoxGeometry(0.02,0.11,0.95), ACC, s*1.025,0.08,-0.24); }              // faction stripe along both turret sides
  const cup=mk(turretG, new THREE.CylinderGeometry(0.25,0.28,0.2,16), metal(realCol(turret,0.6,0.75)), -0.42,0.38,-0.36);      // commander's cupola
  mk(turretG, new THREE.CylinderGeometry(0.22,0.22,0.05,16), TUR, -0.42,0.5,-0.36);                                             // cupola hatch
  const GLASS=new THREE.MeshStandardMaterial({ color:0x0a1216, roughness:0.08, metalness:1.0, envMapIntensity:1.6 });
  mk(turretG, new THREE.BoxGeometry(0.3,0.22,0.3), dark(0x262721), 0.5,0.38,0.62); mk(turretG, new THREE.BoxGeometry(0.24,0.14,0.02), GLASS, 0.5,0.4,0.78);   // gunner's primary sight + armoured glass
  // main gun: PIVOT at the trunnion (elevation + vibration) → barrelG slides along its own axis (recoil); barrel parts are in turret space
  const gunPivot=new THREE.Group(); gunPivot.position.set(0,0.02,TRUNNION_Z); turretG.add(gunPivot);
  const barrelG=new THREE.Group(); barrelG.position.set(0,-0.02,-TRUNNION_Z); gunPivot.add(barrelG);
  const tip = detail?4.05:3.7, tube=(r1,r2,len,z,mat)=>{ const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,len,16),mat); m.rotation.x=Math.PI/2; m.position.set(0,0.02,z); barrelG.add(m); return m; };
  tube(0.17,0.17,0.36,1.42,dark(0x2c2c26));                                    // recoil collar
  { const e0=tip-1.36, prof=[[0.128,1.3],[0.128,1.58],[0.122,1.64],[0.115,e0-0.05],[0.16,e0+0.03],[0.168,e0+0.2],[0.165,e0+0.38],[0.11,e0+0.46],[0.104,tip-0.12],[0.11,tip-0.06],[0.108,tip]];   // turned tube: taper + smooth evacuator bulge + muzzle lip
    const lg=new THREE.LatheGeometry(prof.map(([r,z])=>new THREE.Vector2(r,z)), detail?22:14); lg.rotateX(Math.PI/2); const lm=new THREE.Mesh(lg,GUN); lm.position.y=0.02; barrelG.add(lm);
    const bo=new THREE.Mesh(new THREE.CircleGeometry(0.075,12), dark(0x080706)); bo.position.set(0,0.02,tip+0.003); barrelG.add(bo); }   // dark bore at the muzzle
  if(detail){ for(const z of [1.95,2.55,3.4]) tube(0.135,0.135,0.07,z,dark(0x2a2a24)); const mrs=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.08,0.14),dark(0x22221d)); mrs.position.set(0,0.16,tip-0.1); barrelG.add(mrs); }   // thermal-sleeve clamps + muzzle reference sensor
  const muzzle=new THREE.Object3D(); muzzle.position.set(0,0.02,tip+0.05); barrelG.add(muzzle);
  if(detail){
    for(const sx of [-1,1]) for(let i=0;i<3;i++){ const sm=mk(turretG, new THREE.CylinderGeometry(0.06,0.06,0.3,8), STEEL, sx*0.86,0.2,0.5-i*0.15); sm.rotation.set(-0.9,0,sx*-0.5); }   // smoke-grenade dischargers
    mk(turretG, new RoundedBoxGeometry(1.56,0.34,0.5,1,0.04), dark(0x2a2a23), 0,-0.02,-1.27);                                                   // rear stowage bustle
    for(const bx of [-0.46,0.0,0.46]) mk(turretG, new RoundedBoxGeometry(0.4,0.22,0.38,1,0.06), dark(bx?0x3b3b2c:0x4a4632), bx,0.24,-1.27);    // kit bags / ammo boxes
    for(const ax of [-0.72,0.72]){ const an=mk(turretG, new THREE.CylinderGeometry(0.008,0.014,1.3,4), dark(0x2a2a26), ax,0.92,-0.95); an.rotation.z=ax<0?0.05:-0.05; }   // whip antennas
    mk(turretG, new THREE.CylinderGeometry(0.2,0.2,0.06,14), TUR, 0.34,0.33,-0.42);                                                                 // loader's hatch
    for(const px of [-0.58,-0.42,-0.26]) mk(turretG, new THREE.BoxGeometry(0.1,0.06,0.07), GLASS, px,0.44,-0.18);                                  // vision blocks around the cupola
    const coax=mk(turretG, new THREE.CylinderGeometry(0.035,0.035,0.6,8), BLACK, 0.3,0.05,1.5); coax.rotation.x=Math.PI/2;                         // coaxial MG
  } else {
    const an=mk(turretG, new THREE.CylinderGeometry(0.008,0.014,1.1,4), dark(0x2a2a26), -0.68,0.82,-0.85);
  }
  if(opts.mighty){   // PLAYER — hero unit: Kontakt-style ERA bricks, remote weapon station, panoramic sight, IFF panel, camo net
    const ERA=skin(realCol(hull,0.8,0.82),0.5);
    for(let r=0;r<2;r++) for(let c=-2;c<=2;c++){ const ez=1.84-r*0.37, e=B(G.era, ERA, c*0.4, 1.05+(2.08-ez)*0.294+0.05, ez); e.rotation.x=0.29; }                              // ERA on the upper glacis
    const tp=G.turretCheeks;                                                                                                                              // ERA along both wedge cheeks
    for(const [a,b] of [[3,4],[4,5],[7,6],[8,7]]){ const ax=tp[a][0],az=tp[a][1],bx=tp[b][0],bz=tp[b][1], n=2;
      for(let k=0;k<n;k++){ const u=(k+0.5)/n, px=ax+(bx-ax)*u, pz=az+(bz-az)*u, ang=Math.atan2(bx-ax,bz-az), ox=Math.cos(ang)*(ax>0?0.07:-0.07), oz=-Math.sin(ang)*(ax>0?0.07:-0.07);
        const len=Math.hypot(bx-ax,bz-az)/n; const e=mk(turretG, G.era, ERA, px+ox,0.06,pz+oz); e.scale.set(0.36,3.6,Math.max(0.4,len/0.3*0.92)); e.rotation.y=ang; } }
    for(const sx of [-1,1]) for(let k=0;k<4;k++){ const e=B(G.era, ERA, sx*1.57, 0.8, -1.39+k*0.925); e.scale.set(0.3,4.0,2.8); }                         // ERA tiles on the skirts
    const rws=new THREE.Group(); rws.position.set(0.36,0.42,0.12); turretG.add(rws);                                                                      // remote weapon station + .50 cal
    mk(rws, new THREE.CylinderGeometry(0.16,0.18,0.12,12), STEEL, 0,0,0); mk(rws, new RoundedBoxGeometry(0.28,0.2,0.34,1,0.03), dark(0x2c2d27), 0,0.15,0);
    const hmg=mk(rws, new THREE.CylinderGeometry(0.035,0.04,0.95,8), BLACK, 0.08,0.15,0.6); hmg.rotation.x=Math.PI/2; mk(rws, new THREE.BoxGeometry(0.12,0.1,0.1), GLASS, -0.08,0.18,0.18);
    mk(turretG, new THREE.CylinderGeometry(0.05,0.05,0.3,8), STEEL, -0.42,0.62,-0.36); mk(turretG, new RoundedBoxGeometry(0.26,0.2,0.24,1,0.04), dark(0x24251f), -0.42,0.85,-0.36); mk(turretG, new THREE.BoxGeometry(0.16,0.1,0.02), GLASS, -0.42,0.86,-0.23);   // commander's panoramic sight on its mast
    mk(turretG, new THREE.BoxGeometry(0.52,0.02,0.34), new THREE.MeshStandardMaterial({color:0xff8a2a,emissive:0xff7a1a,emissiveIntensity:0.22,roughness:0.8}), 0.2,0.33,-0.85);   // VS-17 style IFF recognition panel (friendly marker)
    const net=mk(turretG, new THREE.CylinderGeometry(0.16,0.16,1.4,10), dark(0x3e4a2a), 0,0.24,-1.56); net.rotation.z=Math.PI/2;                         // rolled camo net on the bustle
  }
  g.userData.turret=turretG; g.userData.muzzle=muzzle; g.userData.barrelG=barrelG; g.userData.gunPivot=gunPivot; g.userData.hull=hullM;
  g.userData.body=body; g.userData.rig=rig; g.userData.exhaust=exhaust; g.userData.blob=blob;
  bakeTank(g);
  g.traverse(o=>{ if(o.isMesh && o!==blob){ o.castShadow=true; o.receiveShadow=true; } });
  return g;
}
// ---- draw-call baking: merge every group's direct child meshes that share a material into ONE mesh (animated groups stay separate) ----
export const _ZERO_UV = new Map();
export function bakeGroup(par){
  const buckets=new Map();
  for(const c of par.children){ if(!c.isMesh || c.name || c.children.length || Array.isArray(c.material) || c.userData.keep) continue;
    const k=c.material.uuid; let L=buckets.get(k); if(!L) buckets.set(k, L=[]); L.push(c); }
  for(const list of buckets.values()){ if(list.length<2) continue;
    const geos=[]; for(const m of list){ m.updateMatrix(); const gg = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); gg.applyMatrix4(m.matrix);
      for(const a of Object.keys(gg.attributes)) if(a!=='position'&&a!=='normal'&&a!=='uv') gg.deleteAttribute(a);
      if(!gg.attributes.uv) gg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(gg.attributes.position.count*2),2));
      if(!gg.attributes.normal) gg.computeVertexNormals(); gg.clearGroups(); geos.push(gg); }
    const merged=mergeGeometries(geos,false); geos.forEach(gg=>gg.dispose()); if(!merged) continue;
    const mm=new THREE.Mesh(merged, list[0].material); mm.castShadow=list[0].castShadow; mm.receiveShadow=list[0].receiveShadow; par.add(mm);
    for(const m of list) par.remove(m); }
}
export function bakeTank(root){ const ud=root.userData; for(const grp of [root, ud.body, ud.turret, ud.gunPivot, ud.barrelG]) if(grp) bakeGroup(grp); }
