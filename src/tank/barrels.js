// tank/barrels.js — per-gun barrel assemblies (real-world analogues): authored in TURRET space, hung off the gun pivot so they elevate + recoil
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GUN_PRICE } from '../../config.js';
import { S, TRUNNION_Z, bakeGroup, grimeMat, gunLevel, panelNrm, panelTex, realCol } from '../hub.js';

// ----- per-gun barrel assemblies (real-world analogues): authored in TURRET space, hung off the gun pivot so they elevate + recoil -----
// returns a Group with userData { muzzle, spin, recoilLen, elevates, mount } — `mount` = static hardware bolted to the turret (doesn't recoil)
export function makeGunBarrel(id){
  const g=new THREE.Group(), mount=new THREE.Group(), Y=0.04;
  const PN=panelNrm();
  const _mc={}, memo=(k,f)=>_mc[k]||(_mc[k]=f());   // shared per assembly → parts bake into a handful of draw calls
  const steel=(c)=>memo('s'+c,()=>new THREE.MeshStandardMaterial({color:c==null?0x46483f:c,roughness:0.36,metalness:0.86,normalMap:PN,normalScale:new THREE.Vector2(0.25,0.25),envMapIntensity:0.95}));
  const park =(c)=>memo('p'+c,()=>new THREE.MeshStandardMaterial({color:c==null?0x2b2c27:c,roughness:0.62,metalness:0.5}));          // parkerised / phosphate black
  const paint=(c)=>memo('c'+c,()=>grimeMat(new THREE.MeshStandardMaterial({color:realCol(c==null?0x75933a:c),roughness:0.8,metalness:0.4,map:panelTex(),normalMap:PN,normalScale:new THREE.Vector2(0.6,0.6)}),0.4));
  const glow =(c,i)=>memo('g'+c+'_'+i,()=>new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:i==null?0.9:i,roughness:0.4,metalness:0.3}));
  const GM=steel(), PK=park();
  const tube=(r1,r2,len,z,mat,x,y,par)=>{ const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,len,18),mat||GM); m.rotation.x=Math.PI/2; m.position.set(x||0,y==null?Y:y,z); (par||g).add(m); return m; };   // r1 = muzzle end, r2 = breech end
  const box =(w,h,d,x,y,z,mat,par)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat||GM); m.position.set(x,y,z); (par||g).add(m); return m; };
  const rbox=(w,h,d,x,y,z,mat,par)=>{ const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*0.18),mat||GM); m.position.set(x,y,z); (par||g).add(m); return m; };
  const brake=(r,z,x,y,par)=>{ tube(r,r,0.34,z,PK,x,y,par); for(const s of [-1,1]) box(0.05,r*1.1,0.22,(x||0)+s*r*0.98,y==null?Y:y,z,park(0x111110),par); };   // muzzle brake with side ports
  const lathe=(prof,mat,x,y,par,segs)=>{ const geo=new THREE.LatheGeometry(prof.map(([r,z])=>new THREE.Vector2(r,z)), segs||26); geo.rotateX(Math.PI/2); const m=new THREE.Mesh(geo,mat||GM); m.position.set(x||0,y==null?Y:y,0); (par||g).add(m); return m; };   // turned steel: profile [[radius, z], …] breech → muzzle
  const BORE=memo('bore',()=>new THREE.MeshStandardMaterial({color:0x090807,roughness:0.95,metalness:0.2,side:THREE.BackSide}));
  const bore=(r,z,depth,x,y)=>{ const b=new THREE.Mesh(new THREE.CylinderGeometry(r,r,depth,18,1,true),BORE); b.rotation.x=Math.PI/2; b.position.set(x||0,y==null?Y:y,z-depth/2+0.005); g.add(b);   // you can see down the rifling
    const face=new THREE.Mesh(new THREE.RingGeometry(r,r*1.45,20),memo('crown',()=>new THREE.MeshStandardMaterial({color:0x4a4a44,roughness:0.3,metalness:0.95}))); face.position.set(x||0,y==null?Y:y,z+0.004); g.add(face); };
  const boot=(r,z0,len)=>{ const pr=[]; for(let i=0;i<=10;i++){ const u=i/10; pr.push([r*(1.05+0.12*Math.sin(u*Math.PI*5))*(1-u*0.25), z0+u*len]); } lathe(pr, memo('canvas',()=>new THREE.MeshStandardMaterial({color:0x4a4632,roughness:0.97,metalness:0})), 0, Y, g, 18); };   // canvas mantlet dust boot (bellows)
  const GRADE=barrelGrade(id); let main=null;   // main = {z0,z1,r} of the primary tube → grade decorations ride on it
  let tip=3.5, spin=null, recoilLen=0.4, elevates=true;
  if(id==='smg'){             // TWIN 14.5 mm HMG — two barrels in perforated cooling jackets + shared receiver & ammo can
    rbox(0.62,0.34,0.62,0,Y,1.35,PK); rbox(0.3,0.3,0.36,0.44,Y-0.04,1.2,paint(0x55603a));                  // receiver + ammo can
    main={z0:2.55,z1:3.45,r:0.05,xs:[-0.16,0.16]};
    for(const x of [-0.16,0.16]){ tube(0.075,0.075,1.0,2.15,park(0x202020),x); for(let k=0;k<5;k++) tube(0.082,0.082,0.05,1.76+k*0.2,PK,x); tube(0.045,0.05,1.0,3.0,GM,x); tube(0.065,0.065,0.14,3.52,PK,x); }
    tip=3.6; recoilLen=0.16; }
  else if(id==='shotgun'){    // 152 mm short CANISTER gun — stubby fat smoothbore, banded heat jacket, flared bell muzzle
    boot(0.33,1.1,0.34); lathe([[0.31,1.25],[0.3,1.5],[0.285,2.2],[0.275,2.47]], paint()); for(const z of [1.45,1.85,2.25]) tube(0.31,0.31,0.08,z,PK); main={z0:1.4,z1:2.4,r:0.29};
    const bell=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.27,0.42,20,1,true),new THREE.MeshStandardMaterial({color:0x34352f,roughness:0.5,metalness:0.8,side:THREE.DoubleSide})); bell.rotation.x=Math.PI/2; bell.position.set(0,Y,2.65); g.add(bell);
    tube(0.21,0.21,0.5,2.55,new THREE.MeshStandardMaterial({color:0x0b0a09,roughness:0.95,side:THREE.BackSide}));   // dark bore you can see into
    tip=2.85; recoilLen=0.5; }
  else if(id==='flak'){       // TWIN 35 mm AA cannons (Gepard-style) on side cradles + search radar dish on the turret
    main={z0:1.9,z1:3.8,r:0.1,xs:[-0.5,0.5]};
    for(const x of [-0.5,0.5]){ rbox(0.32,0.4,0.9,x,Y,1.35,paint()); tube(0.085,0.1,2.2,2.8,GM,x); tube(0.13,0.13,0.5,2.0,PK,x); tube(0.12,0.12,0.3,3.95,PK,x); for(let k=0;k<3;k++) box(0.03,0.2,0.05,x,Y,3.86+k*0.08,park(0x0e0e0d)); }
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.05,0.5,8),PK); mast.position.set(0,0.55,-0.6); mount.add(mast);
    const dish=new THREE.Mesh(new THREE.SphereGeometry(0.42,18,8,0,Math.PI*2,0,0.9),new THREE.MeshStandardMaterial({color:0x6c6e66,roughness:0.5,metalness:0.6,side:THREE.DoubleSide})); dish.rotation.x=-Math.PI/2.4; dish.position.set(0,0.82,-0.62); dish.name='radar'; mount.add(dish);
    tip=4.1; recoilLen=0.22; }
  else if(id==='cannon'){     // 120 mm L/55 SMOOTHBORE — turned tube with a long taper, bore-evacuator bulge, thermal-sleeve clamps, muzzle reference sensor
    boot(0.24,1.12,0.42);
    lathe([[0.19,1.3],[0.19,1.62],[0.16,1.68],[0.145,1.75],[0.138,2.5],[0.134,2.95],[0.176,3.02],[0.184,3.18],[0.18,3.4],[0.13,3.5],[0.124,3.9],[0.117,4.4],[0.123,4.52],[0.123,4.62]], steel(0x4a4c43));
    for(const z of [2.1,2.65,3.75,4.2]) tube(0.142,0.142,0.06,z,PK);
    box(0.1,0.08,0.15,0,Y+0.15,4.45,PK); bore(0.085,4.62,0.5);
    main={z0:1.75,z1:4.5,r:0.138}; tip=4.66; recoilLen=0.6; }
  else if(id==='hesh'){       // 105 mm L7-pattern HESH gun — shorter, fat rifled tube, mid-barrel bore evacuator, chunky single-baffle brake
    boot(0.25,1.12,0.4);
    lathe([[0.225,1.3],[0.225,1.6],[0.18,1.66],[0.172,2.15],[0.225,2.25],[0.232,2.5],[0.228,2.8],[0.168,2.9],[0.158,3.6],[0.152,3.8]], steel(0x51533f));   // L7: evacuator mid-barrel
    for(const z of [1.9,3.3]) tube(0.18,0.18,0.06,z,PK);
    lathe([[0.2,3.78],[0.27,3.84],[0.27,4.16],[0.22,4.2]], PK); for(const sd of [-1,1]) box(0.07,0.3,0.26,sd*0.25,Y,4.0,park(0x121210)); bore(0.11,4.2,0.45);
    main={z0:1.7,z1:3.75,r:0.172}; tip=4.22; recoilLen=0.55; }
  else if(id==='minigun'){    // 30 mm 7-barrel ROTARY cannon (GAU-8 style) — barrel cluster with mid/front clamps on a spinning rotor
    rbox(0.66,0.52,0.7,0,Y,1.35,PK); tube(0.3,0.3,0.25,1.78,GM);
    spin=new THREE.Group(); spin.position.set(0,Y,2.6); g.add(spin);
    for(let k=0;k<7;k++){ const a=k/7*6.283, m=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.06,2.0,8),steel(0x4c4e46)); m.rotation.x=Math.PI/2; m.position.set(Math.cos(a)*0.19,Math.sin(a)*0.19,0.2); spin.add(m); }
    for(const z of [-0.45,0.3,1.05]){ const c=new THREE.Mesh(new THREE.CylinderGeometry(0.27,0.27,0.08,14),PK); c.rotation.x=Math.PI/2; c.position.z=z; spin.add(c); }
    tip=3.85; recoilLen=0.08; }
  else if(id==='missile'){    // ATGM twin launcher (Kornet-style) — two sealed launch tubes on a cradle + optical guidance unit
    rbox(0.42,0.42,0.6,0,Y,1.4,PK);
    for(const x of [-0.32,0.32]){ tube(0.16,0.16,1.6,2.15,paint(0x5e6838),x,Y+0.12); tube(0.17,0.17,0.08,2.92,PK,x,Y+0.12); const cap=new THREE.Mesh(new THREE.CircleGeometry(0.15,16),glow(0xff6a2a,0.5)); cap.position.set(x,Y+0.12,2.965); g.add(cap); }
    rbox(0.3,0.26,0.36,0,Y+0.36,1.5,park(0x1e1f1b)); box(0.2,0.12,0.02,0,Y+0.38,1.69,new THREE.MeshStandardMaterial({color:0x0a1418,roughness:0.08,metalness:1}));
    tip=3.0; recoilLen=0.1; }
  else if(id==='railgun'){    // RAILGUN — paired conductor rails in an insulating clamp stack, capacitor bank, glowing armature channel
    rbox(0.7,0.5,0.8,0,Y,1.4,park(0x24262c)); for(const x of [-0.42,0.42]) rbox(0.18,0.4,0.6,x,Y+0.05,1.35,glow(0x6a50c0,0.35));   // capacitor banks
    for(const x of [-0.15,0.15]) box(0.1,0.16,3.0,x,Y,3.0,steel(0x5a5e6a));
    for(let k=0;k<6;k++){ box(0.46,0.3,0.1,0,Y,1.9+k*0.48,park(0x1c1d22)); }                                                                   // insulator clamps
    for(const z of [2.4,3.4,4.2]){ const c=new THREE.Mesh(new THREE.TorusGeometry(0.26,0.04,8,20),glow(0xb090ff,1.2)); c.position.set(0,Y,z); g.add(c); }
    tube(0.035,0.035,3.0,3.0,glow(0xe0d0ff,1.6));
    tip=4.55; recoilLen=0.28; }
  else if(id==='cryo'){       // CRYO projector — vacuum-jacketed barrel with frost rings, twin LN2 dewars, expansion nozzle
    tube(0.15,0.17,1.9,2.2,steel(0x7c8c92)); for(const z of [1.6,2.1,2.6,3.0]){ const r=new THREE.Mesh(new THREE.TorusGeometry(0.19,0.045,8,18),glow(0xcff4ff,0.6)); r.position.set(0,Y,z); g.add(r); }
    const noz=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.15,0.5,16,1,true),new THREE.MeshStandardMaterial({color:0x5c6a70,roughness:0.3,metalness:0.9,side:THREE.DoubleSide})); noz.rotation.x=Math.PI/2; noz.position.set(0,Y,3.35); g.add(noz);
    const ice=new THREE.Mesh(new THREE.CircleGeometry(0.15,16),glow(0x9fe8ff,1.4)); ice.position.set(0,Y,3.22); g.add(ice);
    for(const x of [-0.55,0.55]){ tube(0.17,0.17,0.85,-0.2,new THREE.MeshStandardMaterial({color:0xdfe8ea,roughness:0.3,metalness:0.6}),x,0.3,mount); tube(0.18,0.18,0.06,0.15,PK,x,0.3,mount); }   // LN2 dewars on the turret
    tip=3.55; recoilLen=0.12; }
  else if(id==='tesla'){      // TESLA coil gun — toroid stack, ceramic insulators, discharge electrode sphere
    tube(0.12,0.14,1.2,1.8,park(0x232a33)); for(let k=0;k<4;k++){ const t=new THREE.Mesh(new THREE.TorusGeometry(0.28-k*0.03,0.07,10,22),steel(0x6a5440)); t.position.set(0,Y,1.6+k*0.32); g.add(t); }   // copper coil rings
    for(const z of [2.85,3.05]) tube(0.1,0.1,0.12,z,new THREE.MeshStandardMaterial({color:0xe8e2d4,roughness:0.4}));
    const orb=new THREE.Mesh(new THREE.SphereGeometry(0.26,18,14),glow(0x7fd0ff,1.3)); orb.position.set(0,Y,3.35); g.add(orb);
    const cage=new THREE.Mesh(new THREE.IcosahedronGeometry(0.34,1),new THREE.MeshBasicMaterial({color:0x9fe0ff,wireframe:true,transparent:true,opacity:0.5})); cage.position.copy(orb.position); g.add(cage);
    tip=3.55; recoilLen=0.06; }
  else if(id==='rocket'){     // SIEGE: round upward launch tube on a cradle — one rigid tilted assembly (fixed elevation; lobs onto the target)
      const T=0.52, Z=0.12, SEG=32; elevates=false; recoilLen=0.12;
      rbox(0.84,0.5,0.96,0,Y+0.06,0.2,park(0x2a2a22));
      for(const sx of [-0.44,0.44]) rbox(0.13,0.56,0.62,sx,Y+0.52,0.42,park(0x33312b));
      const tb=new THREE.Group(); tb.position.set(0,Y+0.56,0.42); tb.rotation.set(T,0,Z); g.add(tb);
      const wall=new THREE.MeshStandardMaterial({color:0x52504a,roughness:0.36,metalness:0.85,side:THREE.DoubleSide,envMapIntensity:0.9});
      const shell=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.53,2.5,SEG,1,true),wall); shell.position.y=1.0; tb.add(shell);
      const bore=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,1.5,SEG,1,true),new THREE.MeshStandardMaterial({color:0x16130f,roughness:0.92,metalness:0.25,side:THREE.DoubleSide})); bore.position.y=1.45; tb.add(bore);
      const capB=new THREE.Mesh(new THREE.CircleGeometry(0.5,SEG),park(0x18160f)); capB.rotation.x=-Math.PI/2; capB.position.y=-0.25; tb.add(capB);
      const lip=new THREE.Mesh(new THREE.TorusGeometry(0.5,0.08,16,SEG),steel(0x36342f)); lip.rotation.x=Math.PI/2; lip.position.y=2.22; tb.add(lip);
      for(const by of [0.2,1.05,1.9]){ const band=new THREE.Mesh(new THREE.TorusGeometry(0.525,0.058,12,SEG),park(0x24221d)); band.rotation.x=Math.PI/2; band.position.y=by; tb.add(band); }
      const wbody=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.78,24),steel(0x6a6358)); wbody.position.y=1.9; tb.add(wbody);
      const nose=new THREE.Mesh(new THREE.ConeGeometry(0.33,0.66,24),glow(0xff7a3a)); nose.position.y=2.58; tb.add(nose);
      const rmz=new THREE.Object3D(); rmz.position.y=2.5; tb.add(rmz); g.userData.muzzle=rmz; tip=1.7; }
  else if(id==='mortar'){     // ARC MORTAR: slim long tube at ~43° on a baseplate + bipod
      const T=0.82, Z=0.07, SEG=26; elevates=false; recoilLen=0.18;
      const plate=new THREE.Mesh(new THREE.CylinderGeometry(0.46,0.54,0.13,SEG),park(0x2a2a22)); plate.position.set(0,Y+0.02,0.14); g.add(plate);
      const tb=new THREE.Group(); tb.position.set(0,Y+0.32,0.2); tb.rotation.set(T,0,Z); g.add(tb);
      const wall=new THREE.MeshStandardMaterial({color:0x4e5444,metalness:0.84,roughness:0.36,side:THREE.DoubleSide,envMapIntensity:0.95});
      const shell=new THREE.Mesh(new THREE.CylinderGeometry(0.27,0.3,2.0,SEG,1,true),wall); shell.position.y=0.9; tb.add(shell);
      const bore=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,1.4,SEG,1,true),new THREE.MeshStandardMaterial({color:0x15120e,roughness:0.92,metalness:0.25,side:THREE.DoubleSide})); bore.position.y=1.15; tb.add(bore);
      const cap=new THREE.Mesh(new THREE.CircleGeometry(0.27,SEG),park(0x17150e)); cap.rotation.x=-Math.PI/2; cap.position.y=-0.1; tb.add(cap);
      const lip=new THREE.Mesh(new THREE.TorusGeometry(0.29,0.042,12,SEG),steel(0x3a382f)); lip.rotation.x=Math.PI/2; lip.position.y=1.82; tb.add(lip);
      for(const by of [0.3,1.1]){ const band=new THREE.Mesh(new THREE.TorusGeometry(0.31,0.03,10,SEG),park(0x24221d)); band.rotation.x=Math.PI/2; band.position.y=by; tb.add(band); }
      const brace=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,1.0,8),steel(0x444a3c)); brace.rotation.x=-0.5; brace.position.set(0.1,Y+0.42,-0.28); g.add(brace);
      const rmz=new THREE.Object3D(); rmz.position.y=1.9; tb.add(rmz); g.userData.muzzle=rmz; tip=1.3; }
  else if(id==='flamer'){     // FLAMETHROWER — armoured projector with igniter, twin fuel/propellant tanks + feed hoses on the turret
    tube(0.17,0.21,1.6,2.0,paint()); main={z0:1.3,z1:2.7,r:0.19}; for(const z of [1.5,2.0,2.5]) tube(0.22,0.22,0.06,z,PK);
    const noz=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.24,0.42,14),park(0x33271f)); noz.rotation.x=Math.PI/2; noz.position.set(0,Y,3.0); g.add(noz);
    const ign=new THREE.Mesh(new THREE.SphereGeometry(0.07,10,8),glow(0xff6a1c,2.0)); ign.position.set(0,Y-0.12,3.15); g.add(ign);
    for(const x of [-0.5,0.5]){ tube(0.2,0.2,0.95,-0.35,steel(0x9a3220),x,0.32,mount); tube(0.21,0.21,0.05,0.06,PK,x,0.32,mount); }
    const hose=new THREE.Mesh(new THREE.TorusGeometry(0.42,0.04,6,18,Math.PI),PK); hose.position.set(0,0.32,0.1); hose.rotation.set(Math.PI/2,0,0); mount.add(hose);
    tip=3.15; recoilLen=0.04; }
  else if(id==='arty'){       // HOWITZER: heavy angled tube with chunky breech + double-baffle brake (fixed elevation lob)
      const T=0.82, SEG=28; elevates=false; recoilLen=0.4;
      rbox(0.82,0.42,0.92,0,Y+0.04,0.16,park(0x2a2a22));
      const tb=new THREE.Group(); tb.position.set(0,Y+0.42,0.28); tb.rotation.set(T,0,0); g.add(tb);
      const wall=new THREE.MeshStandardMaterial({color:0x57544c,metalness:0.85,roughness:0.34,side:THREE.DoubleSide,envMapIntensity:0.95});
      const breech=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.46,0.5,SEG),park(0x33332b)); breech.position.y=-0.02; tb.add(breech);
      const shell=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.38,2.05,SEG,1,true),wall); shell.position.y=0.95; tb.add(shell);
      const bore=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.26,1.3,SEG,1,true),new THREE.MeshStandardMaterial({color:0x15120e,roughness:0.92,metalness:0.25,side:THREE.DoubleSide})); bore.position.y=1.25; tb.add(bore);
      for(const by of [1.8,2.02]){ const brk=new THREE.Mesh(new THREE.CylinderGeometry(0.44,0.4,0.16,SEG),park(0x2e2e26)); brk.position.y=by; tb.add(brk); }
      for(const by of [0.45,1.35]){ const band=new THREE.Mesh(new THREE.TorusGeometry(0.4,0.05,10,SEG),park(0x24221d)); band.rotation.x=Math.PI/2; band.position.y=by; tb.add(band); }
      const rmz=new THREE.Object3D(); rmz.position.y=2.0; tb.add(rmz); g.userData.muzzle=rmz; tip=2.0; }
  else if(id==='agl'){        // AGL-40: boxy feed tray + stubby finned barrel + side ammo drum
    rbox(0.56,0.38,0.7,0,Y,1.3,PK); rbox(0.42,0.12,0.5,0,Y+0.25,1.3,paint(0x55603a));
    tube(0.12,0.12,1.3,2.25,park(0x252621)); for(let k=0;k<6;k++) tube(0.15,0.15,0.05,1.75+k*0.18,PK); main={z0:1.7,z1:2.9,r:0.13};
    tube(0.14,0.13,0.22,2.95,GM); const drum=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.26,18),paint(0x55603a)); drum.rotation.z=Math.PI/2; drum.position.set(0.48,Y-0.05,1.25); g.add(drum);
    tip=3.1; recoilLen=0.18; }
  else if(id==='thermo'){     // THERMOBARIC: armoured 4-tube rocket pack on a cradle, orange warhead caps showing
    rbox(1.0,0.78,1.8,0,Y+0.18,1.9,paint()); rbox(1.06,0.1,1.86,0,Y+0.6,1.9,PK);
    for(const x of [-0.24,0.24]) for(const y of [-0.04,0.36]){ tube(0.17,0.17,0.06,2.82,PK,x,Y+y); const cap=new THREE.Mesh(new THREE.CircleGeometry(0.15,14),glow(0xff7a2a,0.6)); cap.position.set(x,Y+y,2.86); g.add(cap); }
    rbox(0.2,0.3,0.5,0.62,Y,1.2,PK); tip=2.95; recoilLen=0.3; }
  else {                      // RIFLE (default): 30 mm Bushmaster AUTOCANNON — receiver, slim barrel, double-baffle muzzle brake
    rbox(0.42,0.34,0.62,0,Y,1.35,PK); lathe([[0.11,1.6],[0.11,2.15],[0.085,2.22],[0.078,2.6],[0.072,3.6],[0.068,4.0]], GM); tube(0.11,0.11,0.5,1.88,paint());
    lathe([[0.07,3.98],[0.1,4.0],[0.1,4.12],[0.08,4.14],[0.1,4.16],[0.1,4.3],[0.075,4.32]], PK); for(const s2 of [-1,1]) for(const z of [4.06,4.23]) box(0.05,0.09,0.05,s2*0.1,Y,z,park(0x111110));   // double-baffle brake + ports
    bore(0.035,4.32,0.3); rbox(0.26,0.26,0.4,-0.36,Y-0.03,1.25,paint(0x55603a));   // link-feed ammo box
    main={z0:2.25,z1:3.95,r:0.078}; tip=4.36; recoilLen=0.22; }
  // ---- GRADE (gun power tier + mastery): the stronger the gun, the finer and meaner the barrel ----
  // 1: thermal sleeve bands · 2: blued steel + bronze collars · 3: engraved glowing band + gold muzzle crown · 4+: kill rings, heat-tinted muzzle, bigger bore
  if(GRADE>0){
    const xs=main&&main.xs?main.xs:[0];
    const blued=memo('blu'+GRADE,()=>new THREE.MeshStandardMaterial({color:GRADE>=4?0x34373e:0x4a4f55,roughness:GRADE>=4?0.22:0.3,metalness:0.95,envMapIntensity:1.35,normalMap:PN,normalScale:new THREE.Vector2(0.15,0.15)}));
    const bronze=memo('brz',()=>new THREE.MeshStandardMaterial({color:0xb88a3a,roughness:0.3,metalness:1,envMapIntensity:1.4}));
    const gold=memo('gld',()=>new THREE.MeshStandardMaterial({color:0xe2b85a,roughness:0.18,metalness:1,envMapIntensity:1.6,emissive:0x3a2608,emissiveIntensity:0.4}));
    const glowC=GRADE>=5?0x7fe7ff:0xffa83a;
    if(GRADE>=2){ const steels=new Set(Object.keys(_mc).filter(k=>k[0]==='s').map(k=>_mc[k])); g.traverse(o=>{ if(o.isMesh && steels.has(o.material)) o.material=blued; }); }                                        // blued / black-chrome finish
    if(main){ const L=main.z1-main.z0, r=main.r;
      for(const x of xs){
        const nB=Math.min(6, 1+GRADE); for(let k=0;k<nB;k++) tube(r*1.12,r*1.12,0.05,main.z0+L*(k+0.5)/nB,GRADE>=2?bronze:PK,x);   // sleeve clamps
        if(GRADE>=3){ const band=new THREE.Mesh(new THREE.TorusGeometry(r*1.08,r*0.12,8,22),glow(glowC,GRADE>=5?1.6:1.1)); band.position.set(x,Y,main.z0+L*0.18); g.add(band);
          const crown=new THREE.Mesh(new THREE.TorusGeometry(r*1.02,r*0.16,8,24),gold); crown.position.set(x,Y,main.z1+0.02); g.add(crown); }
        if(GRADE>=4){ for(let k=0;k<Math.min(5,GRADE-2);k++){ const kr=new THREE.Mesh(new THREE.CylinderGeometry(r*1.03,r*1.03,0.025,20),memo('kill',()=>new THREE.MeshStandardMaterial({color:0xe8e4d8,roughness:0.6}))); kr.rotation.x=Math.PI/2; kr.position.set(x,Y,main.z0+L*0.32+k*0.06); g.add(kr); }   // painted kill rings
          const heat=new THREE.Mesh(new THREE.CylinderGeometry(r*1.005,r*1.01,L*0.12,20,1,true),memo('heat',()=>new THREE.MeshStandardMaterial({color:0x2a2420,emissive:0xff6a2a,emissiveIntensity:0.32,roughness:0.3,metalness:0.9,transparent:true,opacity:0.45}))); heat.rotation.x=Math.PI/2; heat.position.set(x,Y,main.z1-L*0.07); g.add(heat); }   // heat-blued muzzle end
      } }

    const sc=1+GRADE*0.028; g.scale.set(sc, sc, 1+GRADE*0.022);                                                                      // bigger gun → beefier tube
  }
  if(!g.userData.muzzle){ const muzzle=new THREE.Object3D(); muzzle.position.set(0,Y,tip); g.add(muzzle); g.userData.muzzle=muzzle; }
  g.userData.grade=GRADE;
  bakeGroup(g); bakeGroup(mount);
  g.userData.spin=spin; g.userData.recoilLen=recoilLen; g.userData.elevates=elevates; g.userData.mount=mount.children.length?mount:null;
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; } }); mount.traverse(o=>{ if(o.isMesh){ o.castShadow=true; } });
  return g;
}
// visual grade 0–6: gun power tier (by price; VIP top) + mastery level — the barrel looks as strong as the gun is
export function gunTier(id){ const pr=GUN_PRICE[id]; if(!pr) return 0; if(pr.d) return 4; const c=pr.c||0; return c<=1700?1:c<=3000?2:3; }
export function barrelGrade(id){ let lv=1; try{ lv=gunLevel(id)||1; }catch(e){} return Math.max(0, Math.min(6, gunTier(id) + (lv-1))); }
export function disposeBarrel(grp){ if(!grp) return; grp.traverse(o=>{ if(o.isMesh){ o.geometry.dispose(); if(o.material&&o.material.dispose) o.material.dispose(); } }); }
export function setPlayerBarrel(id){
  const p=S.player; if(!p||!p.mesh) return; const ud=p.mesh.userData;
  if(ud.barrelG){ ud.barrelG.parent && ud.barrelG.parent.remove(ud.barrelG); disposeBarrel(ud.barrelG); }
  if(ud.gunMount){ ud.turret.remove(ud.gunMount); disposeBarrel(ud.gunMount); ud.gunMount=null; }
  const ng=makeGunBarrel(id); ng.position.set(0,-0.02,-TRUNNION_Z); ud.gunPivot.add(ng); ud.barrelG=ng; p.muzzle=ng.userData.muzzle;
  if(ng.userData.mount){ ud.turret.add(ng.userData.mount); ud.gunMount=ng.userData.mount; }
  ud.rig.recoilLen=ng.userData.recoilLen; ud.rig.elevates=ng.userData.elevates; ud.rig.recoil=0;
}
