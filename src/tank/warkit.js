// tank/warkit.js — Z228 THE WAR KIT on our own tank (player + garage): what a tank that has been at the front for months carries —
//   · a mine plough in front of each track (tines, push arms, cross beam, drag chain between the shares)
//   · sandbags piled on the glacis corners
//   · a slat-armour cage across the engine rear with a spare road wheel and jerry cans hung on it
//   · active-protection radar panels + launchers on the turret flanks, laser-warning domes on the roof corners, a jammer mast
// Every piece is placed from the vehicle's own measured shape (bounding boxes + rays dropped onto the hull), so it fits every
// garage model. The seats the riders use (turret roof, fenders, rear deck) are left clear. The kit lives in its own groups,
// baked into a handful of draws, and is marked noRoof so the roof-MG mount ignores it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bakeGroup, propTex } from '../hub.js';

const _ray=new THREE.Raycaster(), _o=new THREE.Vector3(), _d=new THREE.Vector3(0,-1,0), _m=new THREE.Matrix4();
let _bag=null;
const bagMat=()=>_bag||(_bag=new THREE.MeshStandardMaterial({ color:0xa48f66, roughness:0.96, metalness:0, map:propTex('burlap') }));

// bounding box of a group's direct mesh children, in that group's own space (skipping the given sub-groups)
function localBox(par, skip){ const b=new THREE.Box3(), t=new THREE.Box3();
  for(const c of par.children){ if(skip.includes(c) || !c.isMesh || !c.geometry) continue; if(!c.geometry.boundingBox) c.geometry.computeBoundingBox(); c.updateMatrix();
    t.copy(c.geometry.boundingBox).applyMatrix4(c.matrix); const s=t.getSize(_o); if(s.x<0.3 && s.z<0.3) continue; b.union(t); }
  return b; }

export function warKit(g, M){
  const ud=g.userData, body=ud.body, T=ud.turret, gp=ud.gunPivot; if(!body || !T) return;
  const turHolder = T.parent===body ? T : T.parent;                                       // generic hulls hang the turret off a mount group
  const hb=localBox(body, [turHolder]), tb=localBox(T, [gp]); if(hb.isEmpty() || tb.isEmpty()) return;
  g.updateMatrixWorld(true);
  const hullMeshes=body.children.filter(c=>c.isMesh && c!==turHolder);
  // drop a ray onto the hull at body-local (x,z) → body-local surface point + normal (or null)
  const surf=(x,z)=>{ _o.set(x, hb.max.y+3, z); body.localToWorld(_o); _ray.set(_o, _d); const h=_ray.intersectObjects(hullMeshes, false)[0]; if(!h) return null;
    const p=body.worldToLocal(h.point.clone()), n=h.face ? h.face.normal.clone().transformDirection(_m.extractRotation(h.object.matrixWorld)) : new THREE.Vector3(0,1,0);
    _m.copy(body.matrixWorld).invert(); n.transformDirection(_m); return { p, n }; };
  const gy=-body.position.y/(body.scale.y||1);                                            // the ground, in hull space
  const KB=new THREE.Group(), KT=new THREE.Group(); KB.name='warkitB'; KT.name='warkitT'; KT.userData.noRoof=true; KB.userData.noRoof=true; body.add(KB); T.add(KT);
  const put=(par,geo,mat,x,y,z,rx,ry,rz)=>{ const o=new THREE.Mesh(geo,mat); o.position.set(x,y,z); o.rotation.set(rx||0,ry||0,rz||0); par.add(o); return o; };
  const { HULL, STEEL, BLACK, dark, metal } = M, IRON=dark(0x2b2c26), WORN=metal(0x5a5a52), RUST=dark(0x4a3a28);
  const maxX=hb.max.x, zF=hb.max.z, zR=hb.min.z, trX=Math.max(0.6, maxX-0.4);

  // ---- mine plough: one share in front of each track ----
  const shareW=0.74, zP=zF+0.34, yB=gy+0.2;
  for(const sd of [-1,1]){ const x=sd*trX;
    put(KB, new THREE.BoxGeometry(shareW,0.44,0.07), HULL, x, yB+0.24, zP, -0.42);                          // the mouldboard, leaning back
    put(KB, new THREE.BoxGeometry(shareW+0.06,0.06,0.12), WORN, x, yB+0.5, zP-0.1);                          // top rail
    for(let k=0;k<6;k++){ const tx=x-shareW/2+0.07+k*(shareW-0.14)/5; const t=put(KB, new THREE.ConeGeometry(0.045,0.24,4), WORN, tx, yB-0.01, zP+0.12, Math.PI*0.62); t.rotation.y=Math.PI/4; }   // tines raking forward-down
    for(const ax of [-0.24,0.24]){ const a0=new THREE.Vector3(x+ax, yB+0.42, zP-0.12), a1=new THREE.Vector3(x+ax*0.8, gy+0.82, zF-0.15), L=a0.distanceTo(a1);
      const arm=put(KB, new THREE.BoxGeometry(0.09,0.11,L), IRON, (a0.x+a1.x)/2, (a0.y+a1.y)/2, (a0.z+a1.z)/2); arm.rotation.x=Math.atan2(-(a1.y-a0.y), a1.z-a0.z); }   // push arms back to the nose
    put(KB, new THREE.CylinderGeometry(0.07,0.07,0.16,10), IRON, x, gy+0.82, zF-0.1, 0,0,Math.PI/2); }    // hinge block on the nose
  put(KB, new THREE.BoxGeometry(trX*2+0.2,0.1,0.12), IRON, 0, gy+0.78, zF+0.05);                             // cross beam
  { const n=11; for(let i=0;i<n;i++){ const u=i/(n-1), x=-trX+0.3+u*(trX*2-0.6), sag=Math.sin(u*Math.PI)*0.16; const l=put(KB, new THREE.TorusGeometry(0.045,0.014,4,8), IRON, x, yB+0.06-sag, zP+0.06); l.rotation.y=(i%2)*Math.PI/2; } }   // drag chain between the shares (detonates tilt-rod mines)

  // ---- sandbags on the glacis corners ----
  { const BG=new RoundedBoxGeometry(0.46,0.17,0.28,2,0.07), bm=bagMat();
    for(const sd of [-1,1]) for(let r=0;r<2;r++) for(let c=0;c<2;c++){ const x=sd*(maxX-0.5-c*0.44), z=zF-0.32-r*0.32, s=surf(x,z); if(!s || s.p.y<gy+0.5) continue;
      const b=put(KB, BG, bm, x, s.p.y+0.07, z, Math.atan2(s.n.z, s.n.y), (c+r)%2?0.12:-0.1, 0); b.scale.setScalar(0.92+((c*3+r)%3)*0.06);
      if(r===0 && c===0){ const s2=surf(x-sd*0.2, z-0.12); if(s2) put(KB, BG, bm, x-sd*0.2, Math.max(s.p.y,s2.p.y)+0.22, z-0.12, Math.atan2(s.n.z, s.n.y), 0.3, 0); } } }   // one more on top of each pile

  // ---- slat-armour cage across the rear plate, spare wheel + jerry cans on it ----
  { const zc=zR-0.2, x0=-(maxX-0.12), x1=maxX-0.12, deck=surf(0, zR+0.35), y1=(deck ? deck.p.y : hb.max.y)+0.12, y0=Math.max(gy+0.62, y1-0.95), h=y1-y0, mid=(y0+y1)/2;
    for(let x=x0; x<=x1+1e-3; x+=0.11) put(KB, new THREE.BoxGeometry(0.028,h,0.012), HULL, x, mid, zc);      // the slats
    for(const y of [y0+0.02, mid, y1-0.02]) put(KB, new THREE.BoxGeometry(x1-x0+0.06,0.045,0.05), IRON, 0, y, zc);   // frame rails
    for(const x of [x0, 0, x1]) put(KB, new THREE.BoxGeometry(0.05,0.05,0.24), IRON, x, mid, zc+0.11);       // stand-off brackets to the hull
    put(KB, new THREE.CylinderGeometry(0.3,0.3,0.2,18), dark(0x1e1d1a), 0, mid+0.02, zc-0.13, Math.PI/2);   // spare road wheel
    put(KB, new THREE.CylinderGeometry(0.2,0.2,0.21,14), WORN, 0, mid+0.02, zc-0.135, Math.PI/2);
    for(const sd of [-1,1]){ put(KB, new RoundedBoxGeometry(0.3,0.42,0.15,1,0.025), dark(0x3f4a2c), sd*(x1-0.45), mid-0.04, zc-0.1);     // jerry cans
      put(KB, new THREE.BoxGeometry(0.06,0.05,0.05), RUST, sd*(x1-0.45)+sd*0.08, mid+0.2, zc-0.1); } }

  // ---- turret: APS radar panels + launchers, laser-warning domes, jammer mast ----
  { const tx=tb.max.x, tz0=tb.min.z, tz1=tb.max.z, ty0=tb.min.y, ty1=tb.max.y, ym=ty0+(ty1-ty0)*0.55;
    for(const sd of [-1,1]){ const z=tz0+(tz1-tz0)*0.38;
      put(KT, new THREE.BoxGeometry(0.07,0.28,0.44), IRON, sd*(tx+0.045), ym, z, 0, sd*0.12, 0);                // flat-panel radar
      put(KT, new THREE.BoxGeometry(0.012,0.22,0.36), M.GLASS||BLACK, sd*(tx+0.082), ym, z, 0, sd*0.12, 0);    // its face
      const ln=put(KT, new THREE.CylinderGeometry(0.1,0.12,0.16,12), IRON, sd*(tx-0.12), ty1+0.06, z-0.55); ln.rotation.z=sd*0.25;   // hard-kill launcher on the roof edge
      put(KT, new THREE.BoxGeometry(0.12,0.1,0.22), STEEL, sd*(tx-0.12), ty1+0.17, z-0.55, 0, 0, sd*0.25); }
    for(const [x,z] of [[tx-0.12,tz1-0.25],[-(tx-0.12),tz1-0.25],[tx-0.1,tz0+0.15],[-(tx-0.1),tz0+0.15]]){ put(KT, new THREE.SphereGeometry(0.055,10,6,0,Math.PI*2,0,Math.PI/2), dark(0xd8d6c8), x, ty1, z); }   // laser-warning receivers
    const mx=-(tx-0.16), mz=tz0+0.2; put(KT, new THREE.CylinderGeometry(0.025,0.035,1.1,6), IRON, mx, ty1+0.55, mz);                         // jammer mast (rear corner, clear of the roof seats)
    for(let k=0;k<3;k++) put(KT, new THREE.CylinderGeometry(0.11-k*0.025,0.11-k*0.025,0.03,10), BLACK, mx, ty1+0.75+k*0.16, mz);       // stacked omni antenna discs
    put(KT, new THREE.CylinderGeometry(0.006,0.01,1.5,4), BLACK, mx, ty1+1.6, mz); }                                                      // whip on top
  bakeGroup(KB); bakeGroup(KT);
  KB.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } }); KT.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  ud.warKit=true; }
