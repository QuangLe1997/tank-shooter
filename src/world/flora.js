// world/flora.js — Z141 LIVING SCENERY: proper trees (layered conifers, round-crowned broadleaf, curved coconut palms, bamboo clumps), bushes, wild flowers,
//   reeds along the water and haystacks in the village — instanced (one draw per species), tinted per instance, swaying in the wind (vertex shader).
//   Tanks plough through it all: trees topple, bushes / flowers / reeds flatten (decor.js crushables).
import * as THREE from 'three';
import { LIGHT, OPEN_LAND } from '../../config.js';
import { AREA_K, ARENA, BIOME, MOBILE, RIVER, TREES, WTIME, _R, _mergeColored, arena, blocks, clearTrees, crushables, dressTrees, heightAt, inField, inZone, loadRealTrees, wetAt } from '../hub.js';

let _mat=null;
// Z146 LEAF ATLAS → Z202 four regions: u 0–¼ BARK (vertical fissures, lichen — trunks and limbs) · ¼–½ broadleaf clusters · ½–¾ needle / frond sprays ·
//   ¾–1 GRASS: a clump of thin curved tapering blades (with seed heads) on transparent ground. Every card is tinted by its vertex + instance colour.
const AREG=4;
let _atlas=null; function leafAtlas(){ if(_atlas) return _atlas; const S=256, c=document.createElement('canvas'); c.width=S*AREG; c.height=S; const x=c.getContext('2d');
  let sd=91; const rnd=()=>((sd=(sd*16807)%2147483647)/2147483647);
  { x.fillStyle='#d8d2c8'; x.fillRect(0,0,S,S); for(let i=0;i<140;i++){ const xx=rnd()*S, w=1+rnd()*3, v=(110+rnd()*90)|0; x.strokeStyle=`rgba(${v-30},${v-36},${v-44},${0.35+rnd()*0.4})`; x.lineWidth=w; x.beginPath(); x.moveTo(xx,0);   // bark: long wandering fissures
      let yy=0, cx=xx; while(yy<S){ yy+=8+rnd()*16; cx+=(rnd()-0.5)*5; x.lineTo(cx,yy); } x.stroke(); }
    for(let i=0;i<40;i++){ x.fillStyle=`rgba(${150+rnd()*40},${160+rnd()*40},${110},${0.12+rnd()*0.15})`; x.beginPath(); x.ellipse(rnd()*S,rnd()*S,3+rnd()*9,2+rnd()*6,rnd()*3,0,7); x.fill(); } }   // lichen
  for(let i=0;i<520;i++){ const a=rnd()*6.283, r=Math.pow(rnd(),0.65)*S*0.46, cx=S+S/2+Math.cos(a)*r, cy=S/2+Math.sin(a)*r*0.92, l=8+rnd()*12, v=(185+rnd()*70)|0, dk=0.6*r/(S*0.46);   // broad leaves, darker inside the cluster
    x.save(); x.translate(cx,cy); x.rotate(rnd()*6.283); x.fillStyle=`rgb(${(v*(1-dk*0.35))|0},${(v*(1-dk*0.25))|0},${(v*(1-dk*0.4))|0})`; x.beginPath(); x.ellipse(0,0,l,l*0.42,0,0,7); x.fill();
    x.strokeStyle='rgba(0,0,0,0.25)'; x.lineWidth=0.8; x.beginPath(); x.moveTo(-l,0); x.lineTo(l,0); x.stroke(); x.restore(); }
  for(let b=0;b<9;b++){ const y0=S*0.08+b*S*0.1, ang=(rnd()-0.5)*0.3; x.save(); x.translate(2*S+S/2, y0); x.rotate(ang);                             // needle / frond sprays: a rachis with fine leaflets
    x.strokeStyle='rgb(150,150,130)'; x.lineWidth=2; x.beginPath(); x.moveTo(-S*0.45,0); x.lineTo(S*0.45,0); x.stroke();
    for(let t=-S*0.44;t<S*0.44;t+=3){ const len=(S*0.07)*(1-Math.abs(t)/(S*0.5))+4, v=(170+rnd()*85)|0; x.strokeStyle=`rgb(${v-20},${v},${v-30})`; x.lineWidth=1.4;
      for(const sg of [-1,1]){ x.beginPath(); x.moveTo(t,0); x.lineTo(t+len*0.5, sg*len); x.stroke(); } } x.restore(); }
  { const gx=3*S; for(let i=0;i<150;i++){ const bx=gx+S*0.08+rnd()*S*0.84, h=S*(0.35+rnd()*0.62), lean=(rnd()-0.5)*S*0.5, w=2+rnd()*3.5, v=(150+rnd()*105)|0;   // grass blades: thin, tapering, curving over
      const g=x.createLinearGradient(0,S,0,S-h); g.addColorStop(0,`rgb(${v*0.55|0},${v*0.6|0},${v*0.45|0})`); g.addColorStop(0.6,`rgb(${v},${v},${v*0.88|0})`); g.addColorStop(1,`rgb(${Math.min(255,v+25)},${Math.min(255,v+20)},${v*0.9|0})`);
      x.fillStyle=g; x.beginPath(); x.moveTo(bx-w,S); x.quadraticCurveTo(bx-w*0.5+lean*0.4, S-h*0.55, bx+lean, S-h); x.quadraticCurveTo(bx+w*0.5+lean*0.4, S-h*0.55, bx+w,S); x.closePath(); x.fill();
      if(rnd()<0.12){ x.fillStyle=`rgb(${v},${v*0.92|0},${v*0.75|0})`; x.beginPath(); x.ellipse(bx+lean, S-h, 2.4, 9, lean*0.004, 0, 7); x.fill(); } } }   // the odd seed head
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return (_atlas=t); }
// a leaf / grass card: a quad whose UVs land in its atlas region, normals bent outward from the crown centre so the canopy shades like one soft mass
const _LA=new THREE.Vector3();
function card(w, h, kind, cx, cy, cz, bend){ const g=new THREE.PlaneGeometry(w,h); g.userData.leaf={ kind, c:[cx,cy,cz], bend:bend??0.7 }; return g; }
function leafy(P){ const out=[]; for(const p of P){ const L=p.geo.userData.leaf; let g=p.geo.index?p.geo.toNonIndexed():p.geo.clone(); const uv=g.attributes.uv;
    if(!L){ for(let i=0;i<uv.count;i++) uv.setXY(i, (uv.getX(i)%1)*0.25*0.96+0.005, uv.getY(i)); }   // Z202 trunks + limbs wear bark
    else { for(let i=0;i<uv.count;i++) uv.setXY(i, (L.kind/AREG)+uv.getX(i)/AREG*0.98+0.002, uv.getY(i)); const ps=g.attributes.position, n=g.attributes.normal, v=new THREE.Vector3(), nn=new THREE.Vector3();
      for(let i=0;i<ps.count;i++){ v.set(ps.getX(i)-L.c[0], ps.getY(i)-L.c[1], ps.getZ(i)-L.c[2]).normalize(); nn.set(n.getX(i),n.getY(i),n.getZ(i)); if(nn.dot(v)<0) nn.negate(); nn.lerp(v, L.bend).normalize(); n.setXYZ(i, nn.x, nn.y, nn.z); } }
    out.push({ geo:g, col:L ? new THREE.Color(p.col).multiplyScalar(L.kind===3?1.25:1.55).getHex() : p.col }); }   // the leaf texture darkens → cards start brighter
  return _mergeColored(out); }
export function floraMat(){ if(_mat) return _mat; _mat=new THREE.MeshStandardMaterial({ vertexColors:true, map:leafAtlas(), alphaTest:0.42, alphaToCoverage:!MOBILE, roughness:0.88, metalness:0.0, side:THREE.DoubleSide }); _mat.color.setRGB(...LIGHT.flora);   // Z242 natural, muted greens
  _mat.onBeforeCompile=(sh)=>{ sh.uniforms.uT=WTIME;
    sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = dot(vNormal,vNormal)>1e-12 ? normalize( vNormal ) : normal;')   /* Z146 foliage keeps its outward crown normal on BOTH faces (a flipped back face went black) */
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * 0.07;');   /* light through the leaves */
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uT;')
    .replace('#include <begin_vertex>',`#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip=instanceMatrix[3].xyz;
      #else
        vec3 ip=vec3(0.0);
      #endif
      float hy=max(0.0, transformed.y), sway=hy*hy*0.0042 + hy*0.035*step(hy,2.4)*step(0.05,hy);   /* Z202 short grass bends from the root too */
      float gust=0.65+0.35*sin(uT*0.37+ip.x*0.021-ip.z*0.017);   /* gusts roll across the field */
      transformed.x+=(sin(uT*1.55+ip.x*0.31+ip.z*0.17)*sway + sin(uT*3.7+ip.z)*sway*0.25)*gust; transformed.z+=cos(uT*1.25+ip.z*0.29)*sway*0.7*gust;`); };
  return _mat; }
// Z202 every species comes in several VARIANTS (built once each, seeded differently): instances are spread across them
const G={};
function geo(k, f){ return G[k]||(G[k]=f()); }
function vars(k, n, f){ const a=[]; for(let v=0;v<n;v++) a.push(geo(k+'#'+v, ()=>f(v))); return a; }
const mergeL=(P)=>leafy(P);
// a limb that bends and tapers: a tube along a curve, its radius shrinking from r0 to r1
function limb(pts, r0, r1, seg, rad){ const cv=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))), S=seg||8, R=rad||6, g=new THREE.TubeGeometry(cv, S, r0, R, false), ps=g.attributes.position, P=new THREE.Vector3(), V=new THREE.Vector3();
  for(let i=0;i<ps.count;i++){ const ring=Math.floor(i/(R+1)), t=ring/S; cv.getPointAt(Math.min(1,t), P); V.set(ps.getX(i),ps.getY(i),ps.getZ(i)).sub(P).multiplyScalar(1+(r1/r0-1)*t); ps.setXYZ(i, P.x+V.x, P.y+V.y, P.z+V.z); }
  g.computeVertexNormals(); return g; }
// a leafy sub-crown: n cards around a centre, flattened by fy
function crown(P, cx, cy, cz, R, n, cols, fy, kind){ for(let i=0;i<n;i++){ const u=Math.random()*6.283, v=Math.acos(_R(-0.5,1)), x=Math.sin(v)*Math.cos(u)*R, y=Math.cos(v)*R*(fy||0.7), z=Math.sin(v)*Math.sin(u)*R, w=_R(R*0.8,R*1.25);
    const c=card(w, w, kind||1, cx, cy-R*0.3, cz, 0.75); c.lookAt(_LA.set(x, y, z)); c.rotateZ(_R(0,6.28)); c.translate(cx+x, cy+y, cz+z); P.push({geo:c,col:cols[(Math.random()*cols.length)|0]}); }
  const h=new THREE.IcosahedronGeometry(R*0.5,1); h.scale(1,fy||0.7,1); h.translate(cx,cy,cz); P.push({geo:h,col:0x2a4420}); }   // shadowed heart
const BARK=[0x5a4430,0x4e3a2a,0x6a5040], BARKG=[0x8a7e70,0x7a7064,0x968a7a];
// ---------- species ----------
const conifer=(snow)=>vars('con'+(snow?1:0), MOBILE?3:6, (vv)=>{ const P=[], H=_R(7.5,10), lean=_R(-0.15,0.15);   // Z146 spruce → Z202 three different trees (height, whorls, droop)
  P.push({geo:limb([[0,0,0],[lean*0.3,H*0.5,0],[lean,H,0]], 0.3, 0.1, 6, 7), col:BARK[vv%3]});
  const W=Math.round(_R(8,11)); for(let k=0;k<W;k++){ const t=k/W, y=1.4+t*(H-1.6), r=_R(2.2,2.8)*(1-t*0.9)+0.25, n=k<W*0.6?8:6, droop=_R(0.3,0.5);
    const core=new THREE.ConeGeometry(r*0.55, 1.2, 7, 1, true); core.translate(lean*t,y+0.2,0); P.push({geo:core,col:0x34582c});
    for(let q=0;q<n;q++){ const a=q/n*6.283+k*0.53+_R(-0.2,0.2), c=card(r*_R(1.0,1.3), 0.9, 2, 0, y-1.6, 0, 0.45); c.rotateX(-Math.PI/2); c.translate(r*0.5,0,0); c.rotateZ(-droop-t*0.1); c.rotateY(a); c.translate(lean*t,y,0); P.push({geo:c,col:[0x4a7a3e,0x3e6e34,0x527e40][(k+q)%3]}); }
    if(snow && k%2===0){ const sn=new THREE.ConeGeometry(r*0.7,0.5,8,1,true); sn.translate(lean*t,y+0.55,0); P.push({geo:sn,col:0xf2f6fa}); } }
  const tip=new THREE.ConeGeometry(0.28,1.3,6); tip.translate(lean,H+0.5,0); P.push({geo:tip,col:snow?0xf2f6fa:0x2e5a2a}); return mergeL(P); });
export const treeBroadleaf=()=>broadleaf()[0], treeConifer=()=>conifer(false)[0], treePalm=()=>palm()[0];
// Z260 RECURSIVE LIMBS: a limb bends a little as it grows, forks into 2–3 children turned off its own axis (biased upward, never back down), each
//   shorter and thinner, and ends in a leaf clump — every variant its own random tree, nothing mirrored, nothing on a grid
const _ax=new THREE.Vector3();
function branch(P, p0, dir, len, r0, depth, cols, bark, cr){ const d=dir.clone().add(new THREE.Vector3(_R(-0.22,0.22), _R(0.02,0.16), _R(-0.22,0.22))).normalize();
  const end=p0.clone().addScaledVector(d, len), mid=p0.clone().addScaledVector(d, len*0.5).add(new THREE.Vector3(_R(-0.12,0.12)*len, _R(-0.04,0.08)*len, _R(-0.12,0.12)*len));
  P.push({ geo:limb([p0.toArray(), mid.toArray(), end.toArray()], r0, r0*0.6, depth>0?6:4, depth>0?7:5), col:bark });
  if(depth<=0){ crown(P, end.x, end.y+cr[0]*0.35, end.z, _R(cr[0], cr[1]), cr[2], cols, _R(0.55,0.8)); return; }
  const n=2+(Math.random()<0.45?1:0);
  for(let k=0;k<n;k++){ _ax.set(_R(-1,1), 0, _R(-1,1)).normalize(); const cd=d.clone().applyAxisAngle(_ax, _R(0.35,0.85)); cd.y=Math.max(cd.y, 0.12); cd.normalize();
    branch(P, end.clone().addScaledVector(d, -len*_R(0,0.18)), cd, len*_R(0.55,0.78), r0*0.62, depth-1, cols, bark, cr); }
  if(depth===1 && Math.random()<0.5) crown(P, end.x, end.y+0.3, end.z, _R(cr[0], cr[1])*0.85, cr[2]-2, cols, 0.7); }   // a fuller middle
const LEAF=[[0x4a7a30,0x5c8c38,0x3e6a2a,0x6a9a40],[0x557a2c,0x6a8e36,0x46682a,0x7a9a44],[0x3e7034,0x4e8040,0x34602c,0x5a8a46],[0x5a7a34,0x6e8c3c,0x4c6a2e,0x7e9a48]];
const broadleaf=()=>vars('bl2', MOBILE?4:8, (vv)=>{ const P=[], h=_R(2.2,4.0), lean=new THREE.Vector3(_R(-0.25,0.25),1,_R(-0.25,0.25)).normalize(), bark=BARK[vv%3];   // Z260 eight random trees, recursive limbs
  const top=new THREE.Vector3(0,0,0).addScaledVector(lean, h);
  P.push({geo:limb([[0,0,0],[lean.x*h*0.45+_R(-0.1,0.1),h*0.5,lean.z*h*0.45+_R(-0.1,0.1)],top.toArray()], _R(0.3,0.42), 0.22, 6, 8), col:bark});
  const L=2+((Math.random()*3)|0), cols=LEAF[vv%LEAF.length];
  for(let k=0;k<L;k++){ const a=k/L*6.283+_R(-0.5,0.5), d=new THREE.Vector3(Math.cos(a)*_R(0.5,1.0), _R(0.7,1.3), Math.sin(a)*_R(0.5,1.0)).normalize();
    branch(P, top.clone(), d, _R(1.6,2.6), 0.2, Math.random()<0.6?2:1, cols, BARK[(vv+k)%3], [1.0,1.5,8]); }
  crown(P, top.x, top.y+_R(2.0,2.8), top.z, _R(1.3,1.8), 10, cols, 0.7);
  return mergeL(P); });
// Z260 ANCIENT TREE: a giant (12–16 m across) — a short, massive trunk on buttress roots running out over the ground, splitting low into great limbs
//   that reach out almost level before they climb, a wide dark dome of leaf clumps; planted few, never crushed (a tank stops at its trunk)
export const ANCIENT_R=1.1;   // trunk radius (× the instance scale) that blocks tanks and shells
const ancient=()=>vars('anc', MOBILE?2:4, (vv)=>{ const P=[], h=_R(3.2,4.6), bark=[0x4a3c30,0x3e3228,0x564636][vv%3], cols=[[0x2e5a24,0x3a6a2a,0x264e1e,0x46742e],[0x355e26,0x41702c,0x2c5220,0x4c7a32]][vv%2];
  P.push({geo:limb([[0,0,0],[_R(-0.2,0.2),h*0.5,_R(-0.2,0.2)],[_R(-0.3,0.3),h,_R(-0.3,0.3)]], ANCIENT_R, 0.75, 6, 12), col:bark});
  const nr=5+((Math.random()*3)|0); for(let k=0;k<nr;k++){ const a=k/nr*6.283+_R(-0.3,0.3), r=_R(1.8,3.0);   // buttress roots
    P.push({geo:limb([[Math.cos(a)*0.5,1.3,Math.sin(a)*0.5],[Math.cos(a)*r*0.5,0.45,Math.sin(a)*r*0.5],[Math.cos(a)*r,-0.15,Math.sin(a)*r]], 0.42, 0.08, 5, 6), col:bark}); }
  const top=new THREE.Vector3(0,h,0), L=4+((Math.random()*3)|0);
  for(let k=0;k<L;k++){ const a=k/L*6.283+_R(-0.35,0.35), d=new THREE.Vector3(Math.cos(a), _R(0.25,0.6), Math.sin(a)).normalize();
    branch(P, top.clone().add(new THREE.Vector3(0,_R(-0.6,0.4),0)), d, _R(3.6,5.2), 0.5, 2, cols, bark, [1.8,2.6,11]); }
  crown(P, 0, h+_R(4.5,6), 0, _R(2.4,3.2), 14, cols, 0.6);
  return mergeL(P); });
const palm=()=>vars('pm', MOBILE?3:5, (vv)=>{ const P=[]; let x=0, y=0, ang=0; const bendK=_R(0.04,0.11), segs=Math.round(_R(5,7));   // Z202 curved trunks of different heights, fronds drooping differently
  for(let k=0;k<segs;k++){ const L=1.35, c=new THREE.CylinderGeometry(0.15-k*0.008,0.2-k*0.008,L,7); c.translate(0,L/2,0); c.rotateZ(-ang); c.translate(x,y,0); P.push({geo:c,col:k%2?0x8a7456:0x7a664a});
    const ring=new THREE.TorusGeometry(0.19-k*0.008,0.035,4,10); ring.rotateX(Math.PI/2); ring.rotateZ(-ang); ring.translate(x,y,0); P.push({geo:ring,col:0x6a5a40}); x+=Math.sin(ang)*L; y+=Math.cos(ang)*L; ang+=bendK; }
  const nF=Math.round(_R(10,14)); for(let k=0;k<nF;k++){ const a=k/nF*6.28+_R(-0.15,0.15), len=_R(3.6,4.6), f=card(len, 1.5, 2, x, y-2.0, 0, 0.4); f.rotateX(-Math.PI/2); f.translate(len*0.48,0,0); f.rotateZ(-(0.3+(k%3)*0.2+_R(0,0.25))); f.rotateY(a); f.translate(x,y-0.1,0); P.push({geo:f,col:[0x3e6a30,0x4e7a38,0x5e7a36,0x707a3c][(k+vv)%4]}); }
  for(let k=0;k<4;k++){ const n=new THREE.SphereGeometry(0.17,6,5); n.translate(x+Math.cos(k*1.6)*0.25, y-0.35, Math.sin(k*1.6)*0.25); P.push({geo:n,col:0x6a7a34}); } return mergeL(P); });
const bamboo=()=>vars('bb', 2, ()=>{ const P=[]; for(let k=0;k<11;k++){ const a=Math.random()*6.28, r=Math.random()*0.9, h=_R(6.5,9.5), c=new THREE.CylinderGeometry(0.06,0.09,h,5); c.translate(0,h/2,0); c.rotateZ(_R(-0.12,0.12)); c.rotateX(_R(-0.12,0.12)); c.translate(Math.cos(a)*r,0,Math.sin(a)*r); P.push({geo:c,col:k%2?0x9aa04a:0x88923e});
    for(let q=0;q<4;q++){ const lf=card(1.6,0.5,2,Math.cos(a)*r,h*(0.55+q*0.12)-0.5,Math.sin(a)*r,0.4); lf.rotateZ(1.2+_R(-0.3,0.3)); lf.rotateY(_R(0,6.28)); lf.translate(Math.cos(a)*r, h*(0.55+q*0.12), Math.sin(a)*r); P.push({geo:lf,col:q%2?0x5f8a30:0x76a03a}); } } return mergeL(P); });
const bush=(dry)=>vars('bu'+(dry?1:0), 3, ()=>{ const P=[], cols=dry?[0x8a7a4a,0x7a6a3e,0x9a8a58,0x6a6034]:[0x3e6a2a,0x4e7e32,0x5c8c38,0x46742e];   // Z202 irregular, lumpy bushes (2–3 sub-crowns) instead of one ball
  const n=2+((Math.random()*2)|0); for(let k=0;k<n;k++){ const a=Math.random()*6.28, r=_R(0,0.5); crown(P, Math.cos(a)*r, _R(0.45,0.75), Math.sin(a)*r, _R(0.55,0.85), 7, cols, _R(0.55,0.8)); }
  for(let i=0;i<3;i++) P.push({geo:limb([[0,0,0],[_R(-0.2,0.2),0.3,_R(-0.2,0.2)],[_R(-0.5,0.5),0.6,_R(-0.5,0.5)]], 0.04, 0.02, 3, 4), col:dry?0x6a5a40:0x4a3a28});
  return mergeL(P); });
const flowers=()=>vars('fl', 2, ()=>{ const P=[], cols=[0xf4f0e0,0xffd84a,0xc86ad0,0xff7a5a,0x8ac8ff]; for(let i=0;i<9;i++){ const x=_R(-0.5,0.5), z=_R(-0.5,0.5), h=_R(0.25,0.55), st=new THREE.CylinderGeometry(0.012,0.012,h,3); st.translate(x,h/2,z); P.push({geo:st,col:0x4e7a2e});
    const hd=new THREE.IcosahedronGeometry(_R(0.05,0.08),0); hd.translate(x,h,z); P.push({geo:hd,col:cols[(Math.random()*cols.length)|0]}); }
  grassCards(P, 0.5, 0.45, [0x6a9a3a,0x5a8a30]); return mergeL(P); });
// Z202 GRASS: 3–4 crossed alpha cards of real blades (atlas region 3), leaning a little, darker at the root — a clump, not a fistful of cones
function grassCards(P, w, h, cols, n){ const N=n||3; for(let k=0;k<N;k++){ const a=k/N*Math.PI+_R(-0.3,0.3), c=card(w*_R(0.85,1.2), h*_R(0.8,1.15), 3, 0, -h*1.5, 0, 0.35); c.translate(0, h*0.5, 0); c.rotateX(_R(-0.12,0.12)); c.rotateY(a); c.translate(_R(-0.12,0.12),0,_R(-0.12,0.12)); P.push({geo:c,col:cols[(k+(Math.random()*cols.length|0))%cols.length]}); } }
export const grass=(tone)=>vars('gr'+tone, 4, (vv)=>{ const P=[], T={ green:[0x7caa44,0x6a9a3a,0x8fb850,0x5e8a32], dry:[0xd8bc78,0xc8a860,0xe0c88c,0xb09050], straw:[0xf0d890,0xe0c070,0xd0a858,0xf6e4a8], tundra:[0x9a8a62,0x8a7a58,0xb0a078,0x7a6c4e] }[tone]||[0x9a8458,0x7a6a44,0xb8a070];
  const h=[0.55,0.8,1.1,1.5][vv], w=h*_R(1.1,1.5); grassCards(P, w, h, T, vv>1?4:3); return mergeL(P); });
const reeds=()=>vars('rd', 2, ()=>{ const P=[]; grassCards(P, 0.9, 1.6, [0x7a8a46,0x8a9a50,0xa89a5a], 3); for(let i=0;i<3;i++){ const h=_R(1.3,1.9), x=_R(-0.3,0.3), z=_R(-0.3,0.3), st=new THREE.CylinderGeometry(0.012,0.012,h,3); st.translate(x,h/2,z); P.push({geo:st,col:0x7a7a40}); const t=new THREE.CylinderGeometry(0.05,0.05,0.25,5); t.translate(x,h,z); P.push({geo:t,col:0x6a4a2a}); } return mergeL(P); });   // cat-tail heads
const hay=()=>vars('hy', 1, ()=>{ const P=[], d=new THREE.SphereGeometry(1.3,10,7,0,6.28,0,Math.PI*0.62); d.scale(1,1.5,1); P.push({geo:d,col:0xd8b464}); const pole=new THREE.CylinderGeometry(0.05,0.05,1.0,4); pole.translate(0,2.2,0); P.push({geo:pole,col:0x6a4a2a}); return mergeL(P); });

// Z143 savanna + arctic species → Z202 rebuilt
// the BAOBAB: a swollen bottle trunk (lathe profile, knobbly), a few thick limbs twisting up and out, splitting once, sparse dry-season leaf clumps
const baobab=()=>vars('bao', 3, (vv)=>{ const P=[], H=_R(4.4,6.2), Rb=_R(1.15,1.6), pts=[];
  for(let k=0;k<=10;k++){ const t=k/10, r=Rb*(1-0.55*Math.pow(t,1.3))*(1+0.18*Math.sin(t*Math.PI*1.2))*(t<0.08?1.12:1); pts.push(new THREE.Vector2(Math.max(0.3,r), t*H)); }
  const tr=new THREE.LatheGeometry(pts, 14), ps=tr.attributes.position; for(let i=0;i<ps.count;i++){ const x=ps.getX(i), y=ps.getY(i), z=ps.getZ(i), a=Math.atan2(z,x), k=1+0.07*Math.sin(a*5+y*1.3+vv)+0.05*Math.sin(a*11-y*2.1);   // knobbly, ridged bark
    ps.setXYZ(i, x*k, y, z*k); } tr.computeVertexNormals(); P.push({geo:tr,col:BARKG[vv%3]});
  const nL=4+((Math.random()*3)|0); for(let k=0;k<nL;k++){ const a=k/nL*6.283+_R(-0.3,0.3), out=_R(1.5,2.6), up=_R(1.2,2.3), r0=Rb*0.45*(1-0.55), x0=Math.cos(a)*r0, z0=Math.sin(a)*r0, ex=Math.cos(a)*out, ez=Math.sin(a)*out;
    P.push({geo:limb([[x0,H-0.3,z0],[x0+Math.cos(a)*out*0.4,H+up*0.4,z0+Math.sin(a)*out*0.4],[ex,H+up,ez]], 0.28, 0.1, 6, 6), col:BARKG[(vv+k)%3]});
    for(const s of [-1,1]){ const b=a+s*_R(0.3,0.7), bl=_R(0.8,1.4); P.push({geo:limb([[ex,H+up,ez],[ex+Math.cos(b)*bl,H+up+_R(0.5,1.1),ez+Math.sin(b)*bl]], 0.09, 0.03, 3, 4), col:BARKG[k%3]});
      if(Math.random()<0.6) crown(P, ex+Math.cos(b)*bl, H+up+1.0, ez+Math.sin(b)*bl, _R(0.5,0.8), 5, [0x7a8a3a,0x8a943e,0x6a7a34], 0.6); } }
  return mergeL(P); });
const acacia=()=>vars('aca', 3, (vv)=>{ const P=[], h=_R(3.0,4.2), lean=_R(-0.4,0.4);   // Z202 a leaning trunk forking into limbs that hold 2–3 flat umbrella pads
  P.push({geo:limb([[0,0,0],[lean*0.5,h*0.55,0],[lean,h,0]], 0.2, 0.11, 5, 6), col:BARK[vv%3]});
  const nP=2+(vv%2); for(let k=0;k<nP;k++){ const a=k/nP*6.283+_R(-0.5,0.5), out=_R(1.0,2.0), ex=lean+Math.cos(a)*out, ez=Math.sin(a)*out, ey=h+_R(0.5,1.2);
    P.push({geo:limb([[lean,h-0.2,0],[lean+Math.cos(a)*out*0.5,h+0.3,Math.sin(a)*out*0.5],[ex,ey,ez]], 0.09, 0.05, 4, 5), col:BARK[(vv+k)%3]});
    const R=_R(1.8,2.6); for(let i=0;i<14;i++){ const aa=Math.random()*6.283, r=Math.sqrt(Math.random())*R, c=card(_R(1.4,2.0),_R(1.4,2.0),1,ex,ey-0.8,ez,0.55); c.rotateX(-Math.PI/2+_R(-0.35,0.35)); c.rotateY(_R(0,6.28)); c.translate(ex+Math.cos(aa)*r, ey+0.3+_R(-0.15,0.2), ez+Math.sin(aa)*r); P.push({geo:c,col:[0x8a8a3e,0x9a944a,0x7a8036][i%3]}); }
    const pad=new THREE.IcosahedronGeometry(R*0.6,1); pad.scale(1,0.18,1); pad.translate(ex,ey+0.2,ez); P.push({geo:pad,col:0x4a4a24}); }
  return mergeL(P); });
const deadTree=()=>vars('dead', 3, (vv)=>{ const P=[], h=_R(3.4,5.0), lean=_R(-0.5,0.5);   // Z202 a gnarled snag: a twisting trunk, forking dead limbs, broken stubs
  P.push({geo:limb([[0,0,0],[lean*0.4,h*0.5,_R(-0.3,0.3)],[lean,h,0]], 0.22, 0.07, 6, 6), col:BARKG[vv%3]});
  for(let k=0;k<5;k++){ const a=_R(0,6.28), y0=_R(h*0.4,h*0.9), l=_R(0.9,1.8), ex=lean*y0/h+Math.cos(a)*l, ez=Math.sin(a)*l; P.push({geo:limb([[lean*y0/h,y0,0],[lean*y0/h+Math.cos(a)*l*0.5,y0+l*0.5,Math.sin(a)*l*0.5],[ex,y0+l*_R(0.6,1.0),ez]], 0.07, 0.02, 4, 4), col:BARKG[k%3]}); }
  return mergeL(P); });
const reedPlume=()=>vars('lau', 2, ()=>{ const P=[]; grassCards(P, 1.0, 1.9, [0xb8a470,0xa89460,0xc8b480], 3); for(let i=0;i<6;i++){ const h=_R(1.7,2.5), x=_R(-0.35,0.35), z=_R(-0.35,0.35), st=new THREE.CylinderGeometry(0.015,0.02,h,3); st.translate(x,h/2,z); st.rotateZ(_R(-0.1,0.1)); P.push({geo:st,col:0xb8a470});
    const pl=card(0.3,0.8,3,x,h-0.5,z,0.3); pl.translate(x,h+0.2,z); P.push({geo:pl,col:i%2?0xf0e8d8:0xe4dac4}); } return mergeL(P); });   // cỏ lau: feathery white plumes
const termite=()=>vars('mound', 2, ()=>{ const P=[], cols=[0xa8603a,0x9a5434,0xb86c42]; for(let i=0;i<4;i++){ const h=_R(1.6,3.2), c=new THREE.ConeGeometry(_R(0.35,0.7),h,7); c.translate(_R(-0.4,0.4),h/2,_R(-0.4,0.4)); P.push({geo:c,col:cols[i%3]}); }
  const base=new THREE.SphereGeometry(1.0,8,6,0,6.28,0,Math.PI/2); base.scale(1,0.5,1); P.push({geo:base,col:0x9a5434}); return mergeL(P); });
const floe=()=>[geo('floe', ()=>{ const g=new THREE.CylinderGeometry(1,1.1,0.35,7); return _mergeColored([{geo:g,col:0xf2f8fc}]); })];
// ---------- placement ----------
const M=new THREE.Matrix4(), Q=new THREE.Quaternion(), E=new THREE.Euler(), V3=new THREE.Vector3(), SC=new THREE.Vector3(), C=new THREE.Color();
export const FLORA = { meshes:[] };
export function clearFlora(){ clearTrees(); for(let i=blocks.length-1;i>=0;i--) if(blocks[i].kind==='trunk') blocks.splice(i,1);   // Z260 the giants' trunks go with them
  for(const m of FLORA.meshes){ m.parent && m.parent.remove(m); m.dispose && m.dispose(); } FLORA.meshes.length=0; for(let i=crushables.length-1;i>=0;i--) if(crushables[i].flora) crushables.splice(i,1); }
function okSpot(x,z,r){ return inField(x,z,r+1) && !inZone(x,z,r) && Math.hypot(x,z)>32 && Math.hypot(x,z-ARENA*0.55)>12 && !wetAt(x,z,r+0.5) && !blocks.some(b=>Math.hypot(b.x-x,b.z-z)<b.r+r+0.6); }
function plant(gs, n, opt){ const V=Array.isArray(gs)?gs:[gs], lists=V.map(()=>[]); const tries=n*6; let got=0;   // Z202 instances spread across the species' variants
  const grassy=opt.kind==='grass' || opt.kind==null, lean=opt.lean ?? (grassy?0.16:0.05);
  for(let t=0;t<tries && got<n;t++){ let x, z; if(opt.near){ const p=opt.near(); if(!p) continue; [x,z]=p; } else { x=_R(-ARENA+6,ARENA-6); z=_R(-ARENA+6,ARENA-6); }
    if(opt.high && heightAt(x,z)<opt.high && Math.random()<0.8) continue; if(!(opt.near?inField(x,z,1)&&!inZone(x,z,1):okSpot(x,z,opt.r||1))) continue;
    lists[(Math.random()*V.length)|0].push({ x, z, s:_R(opt.s[0],opt.s[1])*(opt.real||1), ry:_R(0,6.28), lx:_R(-lean,lean), lz:_R(-lean,lean), sy:_R(0.82,1.2), sw:_R(0.85,1.15) }); got++; }
  V.forEach((g,vi)=>{ const list=lists[vi]; if(!list.length) return; const im=new THREE.InstancedMesh(g, floraMat(), list.length); if(opt.tk) im.userData.tree={ tk:opt.tk, vi, sMid:(opt.s[0]+opt.s[1])/2*(opt.real||1) }; /* Z262 a real species takes its place */ im.castShadow=!MOBILE && opt.shadow!==false; im.receiveShadow=true;
    list.forEach((o,k)=>{ M.compose(V3.set(o.x, heightAt(o.x,o.z)-0.05, o.z), Q.setFromEuler(E.set(o.lx,o.ry,o.lz)), SC.set(o.s*o.sw,o.s*o.sy,o.s*o.sw)); im.setMatrixAt(k,M);
      const patch=Math.sin(o.x*0.045+1.3)*Math.cos(o.z*0.038-0.7)+Math.sin((o.x+o.z)*0.021);   // big soft patches: drier here, lusher there
      C.setHSL(0, 0, 1); C.offsetHSL(_R(-0.04,0.04)+patch*0.025, _R(-0.14,0.1)+patch*0.06, _R(-0.13,0.1)+patch*0.05); im.setColorAt(k, C);
      if(opt.fixed) blocks.push({ mesh:new THREE.Object3D(), x:o.x, z:o.z, r:opt.fixed*o.s*o.sw, hp:Infinity, maxHp:Infinity, steel:true, loot:false, kind:'trunk' });   // Z260 a giant: its trunk stops tanks and shells, nothing fells it
      else { const cr={ x:o.x, z:o.z, r:(opt.cr||0.5)*o.s/(opt.real||1), im, k, alive:true, kind:opt.kind||'grass', ry:o.ry, s:o.s, flora:true, leafy:opt.leafy!==false }; crushables.push(cr); if(cr.kind==='tree') TREES.push(cr); } });   // Z262 standing trees can be felled
    im.instanceMatrix.needsUpdate=true; if(im.instanceColor) im.instanceColor.needsUpdate=true; im.computeBoundingSphere(); arena.add(im); FLORA.meshes.push(im); dressTrees(im); }); }
function bankSpot(){ if(!RIVER.on || !RIVER.lines.length) return null; const li=(Math.random()*RIVER.lines.length)|0, L=RIVER.lines[li], p=L[(Math.random()*L.length)|0], w=RIVER.w[li]||3.2, a=Math.random()*6.28, r=w*_R(0.95,1.35);
  const x=p.x+Math.cos(a)*r, z=p.z+Math.sin(a)*r, h=heightAt(x,z); return (h>RIVER.y-0.05 && h<RIVER.y+0.6) ? [x,z] : null; }
function patchSpot(centres, R){ const c=centres[(Math.random()*centres.length)|0]; const a=Math.random()*6.28, r=Math.sqrt(Math.random())*R; return [c[0]+Math.cos(a)*r, c[1]+Math.sin(a)*r]; }
function centres(n){ const C=[]; for(let t=0;t<n*20 && C.length<n;t++){ const x=_R(-ARENA+20,ARENA-20), z=_R(-ARENA+20,ARENA-20); if(okSpot(x,z,6)) C.push([x,z]); } return C; }
function waterSpot(){ if(!RIVER.on || !RIVER.lines.length) return null; const L=RIVER.lines[RIVER.ice && RIVER.lines.length>1 ? 1 : 0], p=L[(Math.random()*L.length)|0]; return [p.x+_R(-3,3), p.z+_R(-3,3)]; }   // Z405 the floes ride the open lead (the arctic's main river is frozen)
// Z145 trees thinned ~40%: the woods still read as woods but leave clear sight-lines for the fight
export function buildFlora(){ clearFlora(); loadRealTrees(); const n=BIOME.name, k=(MOBILE?0.5:1)*AREA_K/2, N=(v)=>Math.round(v*k);
  if(n==='HILLS'){ plant(conifer(false), N(52), { tk:'conifer', s:[0.8,1.5], high:0.6, kind:'tree', cr:0.55, real:1.4 }); plant(broadleaf(), N(18), { tk:'broadleaf', s:[0.8,1.2], kind:'tree', cr:0.6, real:1.4 }); plant(bush(false), N(50), { s:[0.7,1.3], shadow:false }); plant(flowers(), N(120), { s:[0.8,1.4], shadow:false });
    { const L=centres(5); plant(reedPlume(), N(260), { s:[0.8,1.25], near:()=>patchSpot(L,14), shadow:false, cr:0.5 }); } }   // Z287 cỏ lau on the hillsides, in drifts
  else if(n==='VILLAGE'){ const T=OPEN_LAND.VILLAGE.trees; plant(palm(), N(17*T), { tk:'palm', s:[0.85,1.25], kind:'tree', cr:0.4, real:1.4 }); plant(bamboo(), N(10*T), { s:[0.9,1.2], kind:'tree', cr:0.9, real:1.4 }); plant(broadleaf(), N(13*T), { tk:'broadleaf', s:[0.8,1.15], kind:'tree', cr:0.6, real:1.4 });
    plant(bush(false), N(60), { s:[0.7,1.2], shadow:false }); plant(flowers(), N(140), { s:[0.8,1.4], shadow:false }); plant(reeds(), N(200), { s:[0.8,1.3], near:bankSpot, shadow:false }); plant(hay(), N(8), { s:[0.9,1.2], cr:1.2 }); }
  else if(n==='MEADOW'){ plant(ancient(), N(5), { tk:'ancient', s:[0.85,1.15], kind:'tree', fixed:ANCIENT_R, r:7 }); plant(broadleaf(), N(26), { tk:'broadleaf', s:[0.8,1.3], kind:'tree', cr:0.6, real:1.4 }); plant(bush(false), N(24), { s:[0.7,1.3], shadow:false }); plant(flowers(), N(60), { s:[0.8,1.4], shadow:false });
    { const L=centres(4); plant(reedPlume(), N(200), { s:[0.8,1.2], near:()=>Math.random()<0.5 && RIVER.on ? (bankSpot()||patchSpot(L,12)) : patchSpot(L,12), shadow:false, cr:0.5 }); } }   // Z287 cỏ lau by the water and in the low corners   // Z263 fewer: the photographed grass carpets the meadow
  else if(n==='SAVANNA'){ const C=centres(14), L=centres(6);   // dry season: golden grass everywhere, reed beds, lone baobabs and acacias, dead trees, termite mounds
    plant(grass('straw').concat(grass('dry')), N(1500), { s:[1.15,1.85], near:()=>Math.random()<0.6?patchSpot(C,26):[_R(-ARENA+6,ARENA-6),_R(-ARENA+6,ARENA-6)], shadow:false, cr:0.55 });
    plant(reedPlume(), N(420), { s:[0.8,1.3], near:()=>patchSpot(L,16), shadow:false, cr:0.5 });
    plant(baobab(), N(9), { tk:'baobab', s:[0.9,1.35], kind:'tree', cr:1.3, real:1.4 }); plant(acacia(), N(26), { tk:'acacia', s:[0.8,1.3], kind:'tree', cr:0.4, real:1.15 }); plant(deadTree(), N(18), { tk:'dead', s:[0.8,1.2], kind:'tree', cr:0.3, real:1.15 });
    plant(bush(true), N(40), { s:[0.6,1.1], shadow:false }); plant(termite(), N(14), { s:[0.8,1.3], kind:'rock', cr:0.9 }); }
  else if(n==='ARCTIC'){ plant(conifer(true), N(34), { tk:'coniferSnow', s:[0.8,1.4], kind:'tree', cr:0.55, real:1.4 }); plant(floe(), N(40), { s:[0.8,2.4], near:waterSpot, shadow:false, cr:0.1 });   // Z260 + the tundra's snowy spruce (merged into the Arctic)   // Z393 its cone 'ice spires' gone: snow-capped crags from the summit scan stand on the ice instead (world/scenery.js)
    for(const m of FLORA.meshes){ if(m.geometry===floe()[0]){ const M2=new THREE.Matrix4(), P2=new THREE.Vector3(), Q2=new THREE.Quaternion(), S2=new THREE.Vector3(); for(let i=0;i<m.count;i++){ m.getMatrixAt(i,M2); M2.decompose(P2,Q2,S2); P2.y=RIVER.y+0.05; M2.compose(P2,Q2,S2); m.setMatrixAt(i,M2); } m.instanceMatrix.needsUpdate=true; } } }   // ice floes float on the leads
  else if(n==='STEELMILL'){ plant(deadTree(), N(16), { tk:'dead', s:[0.8,1.2], kind:'tree', cr:0.3, real:1.15 }); plant(broadleaf(), N(10), { tk:'broadleaf', s:[0.7,1.1], kind:'tree', cr:0.6, real:1.3 }); plant(bush(false), N(60), { s:[0.6,1.2], shadow:false }); }   // Z187 nature taking the mill back
  else if(n==='VOLCANO'){ plant(deadTree(), N(22), { tk:'dead', s:[0.7,1.1], kind:'tree', cr:0.3, real:1.15 }); plant(bush(true), N(14), { s:[0.5,0.9], shadow:false }); }   // Z187 scorched snags
  else if(n==='QUARRY'){ plant(ancient(), N(1), { tk:'ancient', s:[0.8,1.0], kind:'tree', fixed:ANCIENT_R, r:7 }); plant(broadleaf(), N(8), { tk:'broadleaf', s:[0.7,1.0], kind:'tree', cr:0.6, real:1.3 }); plant(bush(true), N(30), { s:[0.6,1.1], shadow:false }); }   // Z187 scrub and a few olive-like trees on the benches
  else if(n==='TUNDRA'){ plant(conifer(true), N(40), { tk:'coniferSnow', s:[0.8,1.4], kind:'tree', cr:0.55, real:1.4 }); }
  else if(n==='DESERT'){ plant(palm(), N(10), { tk:'palm', s:[0.8,1.1], kind:'tree', cr:0.4, real:1.4 }); plant(bush(true), N(35), { s:[0.6,1.1], shadow:false }); }
  else if(n==='CITY'){ /* Z142 street trees are planted along the sidewalks by city.js */ }
  else if(n==='CITADEL'){ plant(ancient(), N(3), { tk:'ancient', s:[0.85,1.1], kind:'tree', fixed:ANCIENT_R, r:7 }); plant(broadleaf(), N(12), { tk:'broadleaf', s:[0.75,1.15], kind:'tree', cr:0.6, real:1.3 }); plant(bush(true), N(26), { s:[0.6,1.1], shadow:false }); }   // Z260 old trees in the citadel's orchards
  else if(n==='RUINS'){ plant(ancient(), N(1), { tk:'ancient', s:[0.8,1.0], kind:'tree', fixed:ANCIENT_R, r:7 }); plant(deadTree(), N(10), { tk:'dead', s:[0.8,1.2], kind:'tree', cr:0.3, real:1.15 }); plant(broadleaf(), N(6), { tk:'broadleaf', s:[0.7,1.1], kind:'tree', cr:0.6, real:1.3 }); plant(bush(true), N(22), { s:[0.6,1.0], shadow:false }); }   // Z260 nature taking the ruins back
  else { plant(bush(true), N(22), { s:[0.6,1.0], shadow:false }); } }
