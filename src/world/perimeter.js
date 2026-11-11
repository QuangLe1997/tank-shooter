// world/perimeter.js — perimeter: concrete jersey barriers (instanced) topped with concertina razor wire on steel pickets
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARENA, BIOME, MOBILE, _R, arena, fieldPath, heightAt, propTex, rockSet, scene } from '../hub.js';

// ---- perimeter: concrete jersey barriers (instanced) topped with concertina razor wire on steel pickets ----
export const perimeter = new THREE.Group(); arena.add(perimeter);
export function buildPerimeter(b, withHighland=true){
  for(let i=perimeter.children.length-1;i>=0;i--){ const c=perimeter.children[i]; perimeter.remove(c); if(c.geometry) c.geometry.dispose(); }
  const prof=new THREE.Shape(); prof.moveTo(-0.62,0); prof.lineTo(0.62,0); prof.lineTo(0.62,0.08); prof.lineTo(0.4,0.3); prof.lineTo(0.17,1.25); prof.lineTo(-0.17,1.25); prof.lineTo(-0.4,0.3); prof.lineTo(-0.62,0.08); prof.closePath();   // New-Jersey barrier profile
  const jg=new THREE.ExtrudeGeometry(prof,{depth:2.9,bevelEnabled:true,bevelThickness:0.03,bevelSize:0.03,bevelSegments:1}); jg.translate(0,0,-1.45); { const uv=jg.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*0.4,uv.getY(i)*0.4); }
  // Z106 the fence follows the irregular FIELD outline (world/field.js), 1 m inside it, sampled every 3 m
  const P=fieldPath(3.0, 1.0), n=P.length;
  const jm=new THREE.InstancedMesh(jg, new THREE.MeshStandardMaterial({ map:propTex('concrete'), color:b&&b.name==='FOUNDRY'?0x8a8278:0xc4c0b8, roughness:0.92 }), n);
  const M=new THREE.Matrix4(), Q=new THREE.Quaternion(), V=new THREE.Vector3(), Sc=new THREE.Vector3(1,1,1), E=new THREE.Euler();
  P.forEach((q,i)=>{ E.set(0, Math.atan2(q.tx,q.tz)+_R(-0.03,0.03), 0); Q.setFromEuler(E); V.set(q.x+_R(-0.06,0.06), heightAt(q.x,q.z), q.z+_R(-0.06,0.06)); M.compose(V,Q,Sc); jm.setMatrixAt(i,M); });   // barrier length runs ALONG the line
  jm.castShadow=true; jm.receiveShadow=true; perimeter.add(jm);
  // Z87 SECURITY FENCE — Y-pickets 3.4 m tall with outward-leaning outriggers, taut barbed strands that sag between posts,
  // a double-helix razor concertina along the barrier top and another riding the outriggers (Z106: along the outline)
  const wireMat=new THREE.MeshStandardMaterial({ color:0x8a8a82, roughness:0.38, metalness:0.92, envMapIntensity:1.1 });
  const rustMat=new THREE.MeshStandardMaterial({ color:0x5a4a3a, roughness:0.62, metalness:0.7 });
  const OFF=1.25, PH=3.4, ARM=0.8, strands=MOBILE?[0.6,1.5,2.4,3.2]:[0.55,0.95,1.4,1.85,2.3,2.75,3.2], sag=0.06;
  const at=(q,out,y)=>new THREE.Vector3(q.x+q.nx*out, heightAt(q.x,q.z)+y, q.z+q.nz*out);   // out = metres outward from the barrier line
  { const a=new THREE.BoxGeometry(0.09,PH,0.02).translate(0,PH/2,0.035), b2=new THREE.BoxGeometry(0.02,PH,0.09).translate(0.035,PH/2,0), arm=new THREE.BoxGeometry(0.07,ARM,0.02).translate(0,ARM/2,0).rotateX(0.75).translate(0,PH,0.01), foot=new THREE.CylinderGeometry(0.07,0.09,0.14,6).translate(0,0.07,0);
    const pgeo=mergeGeometries([a,b2,arm,foot].map(g=>g.index?g.toNonIndexed():g)); [a,b2,arm,foot].forEach(g=>g.dispose());
    const im=new THREE.InstancedMesh(pgeo, rustMat, n);
    P.forEach((q,i)=>{ E.set(_R(-0.03,0.03), Math.atan2(q.nx,q.nz), _R(-0.025,0.025)); Q.setFromEuler(E); M.compose(at(q,OFF,0),Q,Sc); im.setMatrixAt(i,M); });   // outriggers lean outward
    im.castShadow=true; perimeter.add(im); }
  const loop=(out,y,dy)=>{ const pts=[]; for(let i=0;i<n;i++){ const q=P[i]; for(let s=0;s<4;s++){ const f=s/4, q2=P[(i+1)%n], x=q.x+(q2.x-q.x)*f, z=q.z+(q2.z-q.z)*f;
      pts.push(new THREE.Vector3(x+q.nx*out, heightAt(x,z)+y+(dy?dy(f,i):0), z+q.nz*out)); } } return pts; };
  { const tubes=[], barbs=[], bstep=MOBILE?2:1;                                           // taut barbed strands (sag between posts) + twisted 2-point barbs
    strands.forEach((y,si)=>{ const pts=loop(OFF+0.05, y, (f,i)=>-sag*4*f*(1-f)*(0.7+0.3*Math.sin(i*0.37+si)));
      tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), pts.length, 0.024, 3, true));
      for(let k=0;k<pts.length;k+=bstep) barbs.push([pts[k], k*7.3+si]); });
    const top=loop(OFF+0.05+Math.sin(0.75)*ARM, PH+Math.cos(0.75)*ARM-0.04); tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(top, true), top.length, 0.014, 3, true));
    const wg=mergeGeometries(tubes); tubes.forEach(t=>t.dispose()); perimeter.add(new THREE.Mesh(wg, wireMat));
    const bg=new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute([-0.13,0,0, 0.13,0,0, 0,0.02,0,  0,-0.13,0, 0,0.13,0, 0.02,0,0, 0,0,-0.13, 0,0,0.13, 0,0.02,0],3)); bg.computeVertexNormals();   // crossed spikes
    const bm=new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ color:0x9a9a92, roughness:0.4, metalness:0.9, side:THREE.DoubleSide }), barbs.length);
    barbs.forEach(([v,r],i)=>{ E.set(r, r*1.7, r*0.6); Q.setFromEuler(E); M.compose(v,Q,Sc); bm.setMatrixAt(i,M); }); perimeter.add(bm); }
  const coil=(R, y0, out, perSeg, wob)=>{ const geos=[];                                  // razor CONCERTINA: two opposite helices → the diamond crossings of real coiled razor wire
    for(const hand of [1,-1]){ const pts=[], N=n*perSeg;
      for(let k=0;k<=N;k++){ const u=k/N, i=Math.floor(u*n)%n, f=u*n-Math.floor(u*n), q=P[i], q2=P[(i+1)%n], x=q.x+(q2.x-q.x)*f, z=q.z+(q2.z-q.z)*f;
        const a=hand*k*Math.PI*2/perSeg*0.5, rr=R*(1+Math.sin(u*n*0.5)*0.08), o=out+Math.cos(a)*rr+Math.sin(k*0.41)*wob;
        pts.push(new THREE.Vector3(x+q.nx*o, heightAt(x,z)+y0+R+Math.sin(a)*rr, z+q.nz*o)); }
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, 0.019, 3, false)); }
    const g=mergeGeometries(geos); geos.forEach(t=>t.dispose()); return new THREE.Mesh(g, wireMat); };
  perimeter.add(coil(0.46, 1.25, 0, MOBILE?3:5, 0.03));                                  // on the jersey barriers
  if(!MOBILE) perimeter.add(coil(0.38, PH+0.18, OFF+0.5, 5, 0.025));                     // riding the outrigger arms (desktop)
  if(withHighland) buildHighland(b);                                                      // Z106 rocks over the highland beyond the fence (not at module load: rockSet lives in a later module)
}
// Z106 the ground beyond the fence: weathered rock outcrops along the ridge so the boundary reads as terrain, not a wall.
// Z108 split into arcs (one InstancedMesh each): a single ring-wide mesh has a bounding sphere covering the whole map, so it was
// never frustum-culled and every rock round the arena was drawn every frame (~95k triangles on a phone); now only the arcs on screen draw.
export const HIGHLAND_ARCS = 12;
export const highland = new THREE.Group(); arena.add(highland);
export function buildHighland(b){ for(let i=highland.children.length-1;i>=0;i--){ const c=highland.children[i]; highland.remove(c); if(c.isInstancedMesh) c.dispose(); }
  const rs=rockSet(b?b.name:'DESERT'), P=fieldPath(MOBILE?7:4.5, -5), geo=rs.big[0], per=Math.ceil(P.length/HIGHLAND_ARCS);
  const M=new THREE.Matrix4(), Q=new THREE.Quaternion(), V=new THREE.Vector3(), Sc=new THREE.Vector3(), E=new THREE.Euler();
  for(let a=0;a*per<P.length;a++){ const arc=P.slice(a*per, (a+1)*per), im=new THREE.InstancedMesh(geo, rs.mat, arc.length*2); let k=0;
    for(const q of arc) for(let s=0;s<2;s++){ const out=_R(0,7)+s*4, x=q.x+q.nx*out, z=q.z+q.nz*out; if(Math.abs(x)>ARENA-2||Math.abs(z)>ARENA-2) continue;
      const r=_R(1.4,3.4)*(s?0.8:1); E.set(_R(-0.3,0.3),_R(0,6.28),_R(-0.3,0.3)); Q.setFromEuler(E); V.set(x, heightAt(x,z)+r*0.1, z); Sc.set(r,r*_R(0.6,1.1),r); M.compose(V,Q,Sc); im.setMatrixAt(k++,M); }
    if(!k){ im.dispose(); continue; }
    im.count=k; im.computeBoundingSphere(); im.castShadow=!MOBILE; im.receiveShadow=true; highland.add(im); } }
// ---- crushable ground clutter (small rocks/debris) — tanks grind them under their tracks ----
export const crushables=[];
buildPerimeter(BIOME, false);
// a faint glowing boundary ring to read the play space
export const ring = new THREE.Mesh(new THREE.RingGeometry(ARENA*1.38, ARENA*1.42, 96),
  new THREE.MeshBasicMaterial({ color:BIOME.accent, transparent:true, opacity:0.12, side:THREE.DoubleSide }));
ring.rotation.x=-Math.PI/2; ring.position.y=0.05; arena.add(ring);
// faint combat-range ring that follows the player (only fires within this radius)
export const rangeRing = new THREE.Mesh(new THREE.RingGeometry(0.984, 1.0, 80),
  new THREE.MeshBasicMaterial({ color:0xaef0a0, transparent:true, opacity:0.1, side:THREE.DoubleSide, depthWrite:false, depthTest:false }));   // drawn over mounds
rangeRing.rotation.x=-Math.PI/2; rangeRing.position.y=0.06; rangeRing.visible=false; scene.add(rangeRing);
