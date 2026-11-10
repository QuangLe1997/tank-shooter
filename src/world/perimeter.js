// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARENA, BIOME, MOBILE, _R, arena, propTex, scene } from '../hub.js';

// ---- perimeter: concrete jersey barriers (instanced) topped with concertina razor wire on steel pickets ----
export const perimeter = new THREE.Group(); arena.add(perimeter);
export function buildPerimeter(b){
  for(let i=perimeter.children.length-1;i>=0;i--){ const c=perimeter.children[i]; perimeter.remove(c); if(c.geometry) c.geometry.dispose(); }
  const prof=new THREE.Shape(); prof.moveTo(-0.62,0); prof.lineTo(0.62,0); prof.lineTo(0.62,0.08); prof.lineTo(0.4,0.3); prof.lineTo(0.17,1.25); prof.lineTo(-0.17,1.25); prof.lineTo(-0.4,0.3); prof.lineTo(-0.62,0.08); prof.closePath();   // New-Jersey barrier profile
  const jg=new THREE.ExtrudeGeometry(prof,{depth:2.9,bevelEnabled:true,bevelThickness:0.03,bevelSize:0.03,bevelSegments:1}); jg.translate(0,0,-1.45); { const uv=jg.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*0.4,uv.getY(i)*0.4); }
  const segs=[]; const L=ARENA, step=3.0;
  for(let s=-L+1.5; s<=L-1.5; s+=step){ segs.push([s,-L,Math.PI/2],[s,L,Math.PI/2],[-L,s,0],[L,s,0]); }   // barrier length runs ALONG its wall → a continuous line
  const jm=new THREE.InstancedMesh(jg, new THREE.MeshStandardMaterial({ map:propTex('concrete'), color:b&&b.name==='FOUNDRY'?0x8a8278:0xc4c0b8, roughness:0.92 }), segs.length);
  const M=new THREE.Matrix4(), Q=new THREE.Quaternion(), V=new THREE.Vector3(), Sc=new THREE.Vector3(1,1,1), E=new THREE.Euler();
  segs.forEach((sg,i)=>{ E.set(0,sg[2]+_R(-0.03,0.03),0); Q.setFromEuler(E); V.set(sg[0]+_R(-0.06,0.06),0,sg[1]+_R(-0.06,0.06)); M.compose(V,Q,Sc); jm.setMatrixAt(i,M); });
  jm.castShadow=true; jm.receiveShadow=true; perimeter.add(jm);
  // Z87 SECURITY FENCE — a real perimeter: Y-pickets 3.4 m tall with outward-leaning outriggers, 7 taut barbed strands that sag between posts
  // (2-point barbs every half metre), a double-helix razor concertina along the barrier top and another riding the outriggers.
  const wireMat=new THREE.MeshStandardMaterial({ color:0x8a8a82, roughness:0.38, metalness:0.92, envMapIntensity:1.1 });
  const rustMat=new THREE.MeshStandardMaterial({ color:0x5a4a3a, roughness:0.62, metalness:0.7 });
  const OFF=1.25, PH=3.4, ARM=0.8, step2=3.0, strands=MOBILE?[0.6,1.5,2.4,3.2]:[0.55,0.95,1.4,1.85,2.3,2.75,3.2], sag=0.06;
  const side=(ax,fixed,sg)=>(along,out,y)=> ax==='x' ? new THREE.Vector3(along, y, fixed+sg*out) : new THREE.Vector3(fixed+sg*out, y, along);
  const SIDES=[['x',-L,-1],['x',L,1],['z',-L,-1],['z',L,1]];
  { const pg=new THREE.BufferGeometry(), posts=[];                                       // angle-iron picket + bent outrigger arm (one merged shape, instanced)
    const a=new THREE.BoxGeometry(0.09,PH,0.02).translate(0,PH/2,0.035), b2=new THREE.BoxGeometry(0.02,PH,0.09).translate(0.035,PH/2,0), arm=new THREE.BoxGeometry(0.07,ARM,0.02).translate(0,ARM/2,0).rotateX(0.75).translate(0,PH,0.01), foot=new THREE.CylinderGeometry(0.16,0.2,0.18,8).translate(0,0.09,0);
    const pgeo=mergeGeometries([a,b2,arm,foot].map(g=>g.index?g.toNonIndexed():g)); [a,b2,arm,foot].forEach(g=>g.dispose());
    const n=Math.ceil(L*2/step2)+1, im=new THREE.InstancedMesh(pgeo, rustMat, n*4); let k=0;
    for(const [ax,fixed,sg] of SIDES){ const at=side(ax,fixed,sg); for(let i=0;i<n;i++){ const al=-L+i*step2; const v=at(al,OFF,0); E.set(_R(-0.03,0.03), ax==='x'?(sg>0?0:Math.PI):(sg>0?Math.PI/2:-Math.PI/2), _R(-0.025,0.025)); Q.setFromEuler(E); M.compose(v,Q,Sc); im.setMatrixAt(k++,M); } }
    im.count=k; im.castShadow=true; perimeter.add(im); }
  { const tubes=[], barbs=[], bstep=MOBILE?0.9:0.5;                                       // taut barbed strands with catenary sag + twisted 2-point barbs
    for(const [ax,fixed,sg] of SIDES){ const at=side(ax,fixed,sg);
      strands.forEach((y,si)=>{ const pts=[], spans=Math.round(L*2/step2);
        for(let i=0;i<=spans*4;i++){ const u=i/4, al=-L+u*step2, f=u-Math.floor(u), dy=-sag*4*f*(1-f)*(0.7+0.3*Math.sin(i*0.37+si)); pts.push(at(al, OFF+0.05, y+dy)); }
        tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), spans*4, 0.024, 3, false));
        for(let d=0.25; d<L*2; d+=bstep){ const al=-L+d, f=(d/step2)%1; barbs.push([at(al, OFF+0.05, y-sag*4*f*(1-f)), ax, d*7.3+si]); } });
      const top=[]; for(let i=0;i<=Math.round(L*2/step2)*4;i++){ const al=-L+i*step2/4; top.push(at(al, OFF+0.05+Math.sin(0.75)*ARM, PH+Math.cos(0.75)*ARM-0.04)); }
      tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(top), top.length, 0.014, 3, false)); }
    const wg=mergeGeometries(tubes); tubes.forEach(t=>t.dispose()); perimeter.add(new THREE.Mesh(wg, wireMat));
    const bg=new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute([-0.13,0,0, 0.13,0,0, 0,0.02,0,  0,-0.13,0, 0,0.13,0, 0.02,0,0, 0,0,-0.13, 0,0,0.13, 0,0.02,0],3)); bg.computeVertexNormals();   // crossed spikes
    const bm=new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ color:0x9a9a92, roughness:0.4, metalness:0.9, side:THREE.DoubleSide }), barbs.length);
    barbs.forEach(([v,ax,r],i)=>{ E.set(r, r*1.7, r*0.6); Q.setFromEuler(E); M.compose(v,Q,Sc); bm.setMatrixAt(i,M); }); perimeter.add(bm); }
  const coil=(R, y0, out, turns, wob)=>{ const geos=[];                                  // razor CONCERTINA: two opposite helices → the diamond crossings of real coiled razor wire
    for(const [ax,fixed,sg] of SIDES){ const at=side(ax,fixed,sg);
      for(const hand of [1,-1]){ const pts=[], N=turns*(MOBILE?5:7);
        for(let k=0;k<=N;k++){ const u=k/N, a=hand*u*turns*Math.PI*2, al=-L+u*L*2, rr=R*(1+Math.sin(u*turns*0.5)*0.08);
          pts.push(at(al + Math.sin(a*0.5)*0.05, out + Math.cos(a)*rr + Math.sin(u*41)*wob, y0 + R + Math.sin(a)*rr)); }
        geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, 0.019, 3, false)); } }
    const g=mergeGeometries(geos); geos.forEach(t=>t.dispose()); return new THREE.Mesh(g, wireMat); };
  const cT=Math.round(L*2/(MOBILE?0.9:0.6));
  perimeter.add(coil(0.46, 1.25, 0, cT, 0.03));                                          // on the jersey barriers
  if(!MOBILE) perimeter.add(coil(0.38, PH+0.18, OFF+0.5, cT, 0.025));                    // riding the outrigger arms (desktop)
}
// ---- crushable ground clutter (small rocks/debris) — tanks grind them under their tracks ----
export const crushables=[];
buildPerimeter(BIOME);
// a faint glowing boundary ring to read the play space
export const ring = new THREE.Mesh(new THREE.RingGeometry(ARENA*1.38, ARENA*1.42, 96),
  new THREE.MeshBasicMaterial({ color:BIOME.accent, transparent:true, opacity:0.12, side:THREE.DoubleSide }));
ring.rotation.x=-Math.PI/2; ring.position.y=0.05; arena.add(ring);
// faint combat-range ring that follows the player (only fires within this radius)
export const rangeRing = new THREE.Mesh(new THREE.RingGeometry(0.984, 1.0, 80),
  new THREE.MeshBasicMaterial({ color:0xaef0a0, transparent:true, opacity:0.1, side:THREE.DoubleSide, depthWrite:false, depthTest:false }));   // drawn over mounds
rangeRing.rotation.x=-Math.PI/2; rangeRing.position.y=0.06; rangeRing.visible=false; scene.add(rangeRing);
