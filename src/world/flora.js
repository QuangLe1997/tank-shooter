// world/flora.js — Z141 LIVING SCENERY: proper trees (layered conifers, round-crowned broadleaf, curved coconut palms, bamboo clumps), bushes, wild flowers,
//   reeds along the water and haystacks in the village — instanced (one draw per species), tinted per instance, swaying in the wind (vertex shader).
//   Tanks plough through it all: trees topple, bushes / flowers / reeds flatten (decor.js crushables).
import * as THREE from 'three';
import { AREA_K, ARENA, BIOME, MOBILE, RIVER, WTIME, _R, _mergeColored, arena, blocks, crushables, heightAt, inField, inZone, wetAt } from '../hub.js';

let _mat=null;
// Z146 LEAF ATLAS (one texture for every species): u 0–⅓ solid white (trunks, stems — vertex colour only) · ⅓–⅔ broadleaf clusters ·
//   ⅔–1 needle / frond sprays. Leaf cards are tinted by their vertex colour, alpha-tested (and alpha-to-coverage on desktop: soft, unaliased edges).
let _atlas=null; function leafAtlas(){ if(_atlas) return _atlas; const S=256, c=document.createElement('canvas'); c.width=S*3; c.height=S; const x=c.getContext('2d');
  x.fillStyle='#fff'; x.fillRect(0,0,S,S);
  let sd=91; const rnd=()=>((sd=(sd*16807)%2147483647)/2147483647);
  for(let i=0;i<520;i++){ const a=rnd()*6.283, r=Math.pow(rnd(),0.65)*S*0.46, cx=S+S/2+Math.cos(a)*r, cy=S/2+Math.sin(a)*r*0.92, l=8+rnd()*12, v=(185+rnd()*70)|0, dk=0.6*r/(S*0.46);   // broad leaves, darker inside the cluster
    x.save(); x.translate(cx,cy); x.rotate(rnd()*6.283); x.fillStyle=`rgb(${(v*(1-dk*0.35))|0},${(v*(1-dk*0.25))|0},${(v*(1-dk*0.4))|0})`; x.beginPath(); x.ellipse(0,0,l,l*0.42,0,0,7); x.fill();
    x.strokeStyle='rgba(0,0,0,0.25)'; x.lineWidth=0.8; x.beginPath(); x.moveTo(-l,0); x.lineTo(l,0); x.stroke(); x.restore(); }
  for(let b=0;b<9;b++){ const y0=S*0.08+b*S*0.1, ang=(rnd()-0.5)*0.3; x.save(); x.translate(2*S+S/2, y0); x.rotate(ang);                             // needle / frond sprays: a rachis with fine leaflets
    x.strokeStyle='rgb(150,150,130)'; x.lineWidth=2; x.beginPath(); x.moveTo(-S*0.45,0); x.lineTo(S*0.45,0); x.stroke();
    for(let t=-S*0.44;t<S*0.44;t+=3){ const len=(S*0.07)*(1-Math.abs(t)/(S*0.5))+4, v=(170+rnd()*85)|0; x.strokeStyle=`rgb(${v-20},${v},${v-30})`; x.lineWidth=1.4;
      for(const sg of [-1,1]){ x.beginPath(); x.moveTo(t,0); x.lineTo(t+len*0.5, sg*len); x.stroke(); } } x.restore(); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return (_atlas=t); }
// (the bend centre sits BELOW a layer of sprays so their normals lean up-and-out to the sky, not down at the ground)
// a leaf card: a quad whose UVs land in the leaf (kind 1) or needle (kind 2) region, its normals bent outward from the crown centre so the
//   whole canopy shades like one soft mass instead of flat planes
const _LA=new THREE.Vector3();   // BufferGeometry.lookAt takes a Vector3
function card(w, h, kind, cx, cy, cz, bend){ const g=new THREE.PlaneGeometry(w,h); g.userData.leaf={ kind, c:[cx,cy,cz], bend:bend??0.7 }; return g; }
function leafy(P){ const out=[]; for(const p of P){ const L=p.geo.userData.leaf; let g=p.geo.index?p.geo.toNonIndexed():p.geo.clone(); const uv=g.attributes.uv;
    if(!L){ for(let i=0;i<uv.count;i++) uv.setXY(i, 0.16, 0.5); }
    else { for(let i=0;i<uv.count;i++) uv.setXY(i, (L.kind/3)+uv.getX(i)/3, uv.getY(i)); const ps=g.attributes.position, n=g.attributes.normal, v=new THREE.Vector3(), nn=new THREE.Vector3();
      for(let i=0;i<ps.count;i++){ v.set(ps.getX(i)-L.c[0], ps.getY(i)-L.c[1], ps.getZ(i)-L.c[2]).normalize(); nn.set(n.getX(i),n.getY(i),n.getZ(i)); if(nn.dot(v)<0) nn.negate(); nn.lerp(v, L.bend).normalize(); n.setXYZ(i, nn.x, nn.y, nn.z); } }
    out.push({ geo:g, col:L ? new THREE.Color(p.col).multiplyScalar(1.55).getHex() : p.col }); }   // the leaf texture darkens → cards start brighter
  return _mergeColored(out); }
export function floraMat(){ if(_mat) return _mat; _mat=new THREE.MeshStandardMaterial({ vertexColors:true, map:leafAtlas(), alphaTest:0.42, alphaToCoverage:!MOBILE, roughness:0.88, metalness:0.0, side:THREE.DoubleSide });
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
      float hy=max(0.0, transformed.y), sway=hy*hy*0.0042;
      transformed.x+=sin(uT*1.55+ip.x*0.31+ip.z*0.17)*sway + sin(uT*3.7+ip.z)*sway*0.25; transformed.z+=cos(uT*1.25+ip.z*0.29)*sway*0.7;`); };
  return _mat; }
const G={};
function geo(k, f){ return G[k]||(G[k]=f()); }
const _MC=_mergeColored, mergeL=(P)=>leafy(P);   // Z146 stems → white texel, cards → leaf texels
// ---------- species ----------
const conifer=(snow)=>geo('con'+(snow?1:0), ()=>{ const P=[], tr=new THREE.CylinderGeometry(0.12,0.3,8.6,7); tr.translate(0,4.3,0); P.push({geo:tr,col:0x4e3a28});   // Z146 a real spruce: trunk to the tip, whorls of drooping needle sprays
  for(let k=0;k<9;k++){ const y=1.7+k*0.78, r=2.5*(1-k/10)+0.3, n=k<6?8:6;
    const core=new THREE.ConeGeometry(r*0.55, 1.3, 7, 1, true); core.translate(0,y+0.2,0); P.push({geo:core,col:0x3a6232});                                // dark inner mass
    for(let q=0;q<n;q++){ const a=q/n*6.283+k*0.4, c=card(r*1.15, 0.9, 2, 0, y-1.6, 0, 0.45); c.rotateX(-Math.PI/2); c.translate(r*0.5,0,0); c.rotateZ(-0.38-k*0.02); c.rotateY(a); c.translate(0,y,0); P.push({geo:c,col:k%2?0x4a7a3e:0x3e6e34}); }   // Z147 lighter needles: spruce read as black holes on the bright pasture
    if(snow && k%2===0){ const sn=new THREE.ConeGeometry(r*0.7,0.5,8,1,true); sn.translate(0,y+0.55,0); P.push({geo:sn,col:0xf2f6fa}); } }
  const tip=new THREE.ConeGeometry(0.28,1.3,6); tip.translate(0,9.1,0); P.push({geo:tip,col:snow?0xf2f6fa:0x2e5a2a}); return mergeL(P); });
export const treeBroadleaf=()=>broadleaf(), treeConifer=()=>conifer(false), treePalm=()=>palm();
const broadleaf=()=>geo('bl', ()=>{ const P=[], tr=new THREE.CylinderGeometry(0.2,0.36,3.4,8); tr.translate(0,1.7,0); P.push({geo:tr,col:0x5a4430});   // Z146 a crown of leaf clusters on real limbs
  for(const [a,l] of [[0.6,1.9],[-0.8,1.7],[2.4,1.6],[3.9,1.5]]){ const b=new THREE.CylinderGeometry(0.06,0.14,l,5); b.translate(0,l/2,0); b.rotateZ(0.75); b.rotateY(a); b.translate(0,2.9,0); P.push({geo:b,col:0x5a4430}); }
  const C=[0,4.5,0], cols=[0x4a7a30,0x5c8c38,0x3e6a2a,0x6a9a40];
  for(let i=0;i<4;i++){ const s=new THREE.IcosahedronGeometry(_R(0.9,1.2),1); s.translate(_R(-0.7,0.7), 4.3+_R(-0.3,0.4), _R(-0.7,0.7)); P.push({geo:s,col:0x2c4a1e}); }   // shadowed heart of the crown
  for(let i=0;i<30;i++){ const u=Math.random()*6.283, v=Math.acos(_R(-0.55,1)), x=Math.sin(v)*Math.cos(u)*2.3, y=Math.cos(v)*1.65, z=Math.sin(v)*Math.sin(u)*2.3, w=_R(1.6,2.4);
    const c=card(w, w, 1, ...C, 0.75); c.lookAt(_LA.set(x, y, z)); c.rotateZ(_R(0,6.28)); c.translate(C[0]+x, C[1]+y, C[2]+z); P.push({geo:c,col:cols[i%4]}); }
  return mergeL(P); });
const palm=()=>geo('pm', ()=>{ const P=[]; let x=0, y=0, ang=0;
  for(let k=0;k<5;k++){ const L=1.45, c=new THREE.CylinderGeometry(0.15-k*0.01,0.2-k*0.01,L,7); c.translate(0,L/2,0); c.rotateZ(-ang); c.translate(x,y,0); P.push({geo:c,col:k%2?0x8a7456:0x7a664a}); x+=Math.sin(ang)*L; y+=Math.cos(ang)*L; ang+=0.07; }
  for(let k=0;k<12;k++){ const a=k/12*6.28, f=card(4.2, 1.5, 2, x, y-2.0, 0, 0.4); f.rotateX(-Math.PI/2); f.translate(2.0,0,0); f.rotateZ(-(0.35+(k%3)*0.22)); f.rotateY(a); f.translate(x,y-0.1,0); P.push({geo:f,col:k%2?0x4f8a34:0x66a040}); }   // Z146 feathery fronds
  for(let k=0;k<4;k++){ const n=new THREE.SphereGeometry(0.17,6,5); n.translate(x+Math.cos(k*1.6)*0.25, y-0.35, Math.sin(k*1.6)*0.25); P.push({geo:n,col:0x6a7a34}); } return mergeL(P); });
const bamboo=()=>geo('bb', ()=>{ const P=[]; for(let k=0;k<11;k++){ const a=Math.random()*6.28, r=Math.random()*0.9, h=_R(6.5,9.5), c=new THREE.CylinderGeometry(0.06,0.09,h,5); c.translate(0,h/2,0); c.rotateZ(_R(-0.12,0.12)); c.rotateX(_R(-0.12,0.12)); c.translate(Math.cos(a)*r,0,Math.sin(a)*r); P.push({geo:c,col:k%2?0x9aa04a:0x88923e});
    for(let q=0;q<4;q++){ const lf=new THREE.ConeGeometry(0.5,1.6,4); lf.scale(1,1,0.2); lf.rotateZ(1.2+_R(-0.3,0.3)); lf.rotateY(_R(0,6.28)); lf.translate(Math.cos(a)*r, h*(0.55+q*0.12), Math.sin(a)*r); P.push({geo:lf,col:q%2?0x5f8a30:0x76a03a}); } } return mergeL(P); });
const bush=(dry)=>geo('bu'+(dry?1:0), ()=>{ const P=[], cols=dry?[0x8a7a4a,0x7a6a3e,0x9a8a58]:[0x3e6a2a,0x4e7e32,0x5c8c38]; for(let i=0;i<3;i++){ const s=new THREE.IcosahedronGeometry(_R(0.35,0.5),0); s.translate(_R(-0.4,0.4), _R(0.3,0.5), _R(-0.4,0.4)); P.push({geo:s,col:dry?0x5a4a2a:0x24401a}); }   // Z146 dense dark heart + leafy cards
  for(let i=0;i<12;i++){ const u=Math.random()*6.283, v=Math.acos(_R(-0.2,1)), x=Math.sin(v)*Math.cos(u)*0.85, y=Math.cos(v)*0.6+0.55, z=Math.sin(v)*Math.sin(u)*0.85, w=_R(0.9,1.3), c=card(w,w,1,0,0.5,0,0.7); c.lookAt(_LA.set(x,y-0.5,z)); c.rotateZ(_R(0,6.28)); c.translate(x,y,z); P.push({geo:c,col:cols[i%3]}); } return mergeL(P); });
const flowers=()=>geo('fl', ()=>{ const P=[], cols=[0xf4f0e0,0xffd84a,0xc86ad0,0xff7a5a,0x8ac8ff]; for(let i=0;i<9;i++){ const x=_R(-0.5,0.5), z=_R(-0.5,0.5), h=_R(0.25,0.55), st=new THREE.CylinderGeometry(0.012,0.012,h,3); st.translate(x,h/2,z); P.push({geo:st,col:0x4e7a2e});
    const hd=new THREE.IcosahedronGeometry(_R(0.05,0.08),0); hd.translate(x,h,z); P.push({geo:hd,col:cols[(Math.random()*cols.length)|0]}); } return mergeL(P); });
const reeds=()=>geo('rd', ()=>{ const P=[]; for(let i=0;i<10;i++){ const h=_R(1.0,1.9), c=new THREE.ConeGeometry(0.035,h,3); c.translate(0,h/2,0); c.rotateZ(_R(-0.25,0.25)); c.rotateX(_R(-0.25,0.25)); c.translate(_R(-0.35,0.35),0,_R(-0.35,0.35)); P.push({geo:c,col:i%3?0x7a8a46:0xa89a5a});
    if(i%3===0){ const t=new THREE.CylinderGeometry(0.05,0.05,0.25,5); t.translate(0,h*0.85,0); P.push({geo:t,col:0x6a4a2a}); } } return mergeL(P); });   // cat-tail heads
const hay=()=>geo('hy', ()=>{ const P=[], d=new THREE.SphereGeometry(1.3,10,7,0,6.28,0,Math.PI*0.62); d.scale(1,1.5,1); P.push({geo:d,col:0xd8b464}); const pole=new THREE.CylinderGeometry(0.05,0.05,1.0,4); pole.translate(0,2.2,0); P.push({geo:pole,col:0x6a4a2a}); return mergeL(P); });

// Z143 savanna + arctic species
const baobab=()=>geo('bao', ()=>{ const P=[], tr=new THREE.CylinderGeometry(0.85,1.35,5.2,10); tr.translate(0,2.6,0); P.push({geo:tr,col:0x9a8a78});
  const crown=new THREE.CylinderGeometry(1.0,0.85,0.8,10); crown.translate(0,5.5,0); P.push({geo:crown,col:0x8e7e6c});
  for(let k=0;k<8;k++){ const a=k/8*6.28, l=_R(1.4,2.4), b=new THREE.CylinderGeometry(0.1,0.22,l,6); b.translate(0,l/2,0); b.rotateZ(_R(0.5,1.0)); b.rotateY(a); b.translate(0,5.7,0); P.push({geo:b,col:0x8a7a68});
    if(k%2===0){ const lf=new THREE.IcosahedronGeometry(_R(0.4,0.65),0); lf.scale(1,0.6,1); lf.translate(Math.cos(a)*l*0.75, 5.7+l*0.6, -Math.sin(a)*l*0.75); P.push({geo:lf,col:0x7a8a3a}); } }   // a few dry-season leaves
  return mergeL(P); });
const acacia=()=>geo('aca', ()=>{ const P=[], tr=new THREE.CylinderGeometry(0.12,0.2,3.6,6); tr.translate(0,1.8,0); tr.rotateZ(0.08); P.push({geo:tr,col:0x5a4a3a});
  for(let k=0;k<4;k++){ const a=k/4*6.28+0.4, b=new THREE.CylinderGeometry(0.05,0.1,2.0,5); b.translate(0,1.0,0); b.rotateZ(0.85); b.rotateY(a); b.translate(0.15,3.4,0); P.push({geo:b,col:0x5a4a3a}); }
  for(let i=0;i<4;i++){ const a=i/4*6.28, c=new THREE.IcosahedronGeometry(_R(0.9,1.2),1); c.scale(1,0.22,1); c.translate(Math.cos(a)*1.2, 4.35, Math.sin(a)*1.2); P.push({geo:c,col:0x5a5a2a}); }
  for(let i=0;i<22;i++){ const a=Math.random()*6.283, r=Math.sqrt(Math.random())*3.0, c=card(_R(1.5,2.2),_R(1.5,2.2),1,0,3.6,0,0.55); c.rotateX(-Math.PI/2+_R(-0.35,0.35)); c.rotateY(_R(0,6.28)); c.translate(Math.cos(a)*r, 4.45+_R(-0.2,0.25), Math.sin(a)*r); P.push({geo:c,col:i%2?0x8a8a3e:0x9a944a}); }   // Z146 flat umbrella crown of leaf cards (dry-season olive)
  return mergeL(P); });
const deadTree=()=>geo('dead', ()=>{ const P=[], tr=new THREE.CylinderGeometry(0.1,0.22,4.2,6); tr.translate(0,2.1,0); P.push({geo:tr,col:0x8a7e70});
  for(let k=0;k<6;k++){ const a=_R(0,6.28), l=_R(0.9,1.8), b=new THREE.CylinderGeometry(0.03,0.07,l,4); b.translate(0,l/2,0); b.rotateZ(_R(0.5,1.1)); b.rotateY(a); b.translate(0,_R(2.0,4.0),0); P.push({geo:b,col:0x7a7064}); } return mergeL(P); });
const tallGrass=()=>geo('tg', ()=>{ const P=[], cols=[0xf0d890,0xe0c070,0xc89a50,0xf6e4a8,0x9a7a40]; for(let i=0;i<18;i++){ const h=_R(0.9,1.8), c=new THREE.ConeGeometry(_R(0.06,0.1),h,3); c.translate(0,h/2,0); c.rotateZ(_R(-0.4,0.4)); c.rotateX(_R(-0.4,0.4)); c.translate(_R(-0.55,0.55),0,_R(-0.55,0.55)); P.push({geo:c,col:cols[i%5]}); } return mergeL(P); });
const reedPlume=()=>geo('lau', ()=>{ const P=[]; for(let i=0;i<9;i++){ const h=_R(1.6,2.5), c=new THREE.ConeGeometry(0.03,h,3); c.translate(0,h/2,0); c.rotateZ(_R(-0.2,0.2)); c.rotateX(_R(-0.2,0.2)); const x=_R(-0.4,0.4), z=_R(-0.4,0.4); c.translate(x,0,z); P.push({geo:c,col:0xb8a470});
    const pl=new THREE.ConeGeometry(0.11,0.7,5); pl.rotateX(Math.PI); pl.translate(x+_R(-0.08,0.08), h+0.1, z); P.push({geo:pl,col:i%2?0xf0e8d8:0xe4dac4}); } return mergeL(P); });   // cỏ lau: feathery white plumes
const termite=()=>geo('mound', ()=>{ const P=[], cols=[0xa8603a,0x9a5434,0xb86c42]; for(let i=0;i<4;i++){ const h=_R(1.6,3.2), c=new THREE.ConeGeometry(_R(0.35,0.7),h,7); c.translate(_R(-0.4,0.4),h/2,_R(-0.4,0.4)); P.push({geo:c,col:cols[i%3]}); }
  const base=new THREE.SphereGeometry(1.0,8,6,0,6.28,0,Math.PI/2); base.scale(1,0.5,1); P.push({geo:base,col:0x9a5434}); return mergeL(P); });
const iceSpire=()=>geo('ice', ()=>{ const P=[]; for(let i=0;i<4;i++){ const h=_R(1.2,3.6), c=new THREE.ConeGeometry(_R(0.4,0.9),h,5); c.rotateZ(_R(-0.3,0.3)); c.translate(_R(-0.6,0.6),h/2,_R(-0.6,0.6)); P.push({geo:c,col:i%2?0xd8f0ff:0xa8d4ec}); } return mergeL(P); });
const floe=()=>geo('floe', ()=>{ const g=new THREE.CylinderGeometry(1,1.1,0.35,7); g.translate(0,0,0); return _mergeColored([{geo:g,col:0xf2f8fc}]); });
// ---------- placement ----------
const M=new THREE.Matrix4(), Q=new THREE.Quaternion(), E=new THREE.Euler(), V=new THREE.Vector3(), SC=new THREE.Vector3(), C=new THREE.Color();
export const FLORA = { meshes:[] };
export function clearFlora(){ for(const m of FLORA.meshes){ m.parent && m.parent.remove(m); m.dispose && m.dispose(); } FLORA.meshes.length=0; for(let i=crushables.length-1;i>=0;i--) if(crushables[i].flora) crushables.splice(i,1); }
function okSpot(x,z,r){ return inField(x,z,r+1) && !inZone(x,z,r) && Math.hypot(x,z)>32 && Math.hypot(x,z-ARENA*0.55)>12 && !wetAt(x,z,r+0.5) && !blocks.some(b=>Math.hypot(b.x-x,b.z-z)<b.r+r+0.6); }
function plant(g, n, opt){ const list=[]; const tries=n*6;
  for(let t=0;t<tries && list.length<n;t++){ let x, z; if(opt.near){ const p=opt.near(); if(!p) continue; [x,z]=p; } else { x=_R(-ARENA+6,ARENA-6); z=_R(-ARENA+6,ARENA-6); }
    if(opt.high && heightAt(x,z)<opt.high && Math.random()<0.8) continue; if(!(opt.near?inField(x,z,1)&&!inZone(x,z,1):okSpot(x,z,opt.r||1))) continue;
    list.push({ x, z, s:_R(opt.s[0],opt.s[1])*(opt.real||1), ry:_R(0,6.28) }); }
  if(!list.length) return; const im=new THREE.InstancedMesh(g, floraMat(), list.length); im.castShadow=!MOBILE && opt.shadow!==false; im.receiveShadow=true;
  list.forEach((o,k)=>{ M.compose(V.set(o.x, heightAt(o.x,o.z)-0.05, o.z), Q.setFromEuler(E.set(0,o.ry,0)), SC.set(o.s,o.s*_R(0.9,1.12),o.s)); im.setMatrixAt(k,M);
    C.setHSL(0, 0, 1); C.offsetHSL(_R(-0.03,0.03), _R(-0.08,0.06), _R(-0.08,0.08)); im.setColorAt(k, C);
    crushables.push({ x:o.x, z:o.z, r:(opt.cr||0.5)*o.s/(opt.real||1), im, k, alive:true, kind:opt.kind||'grass', ry:o.ry, s:o.s, flora:true }); });
  im.instanceMatrix.needsUpdate=true; if(im.instanceColor) im.instanceColor.needsUpdate=true; im.computeBoundingSphere(); arena.add(im); FLORA.meshes.push(im); }
function bankSpot(){ if(!RIVER.on || !RIVER.lines.length) return null; const L=RIVER.lines[(Math.random()*RIVER.lines.length)|0], p=L[(Math.random()*L.length)|0], w=L===RIVER.lines[0]?5.5:3.2, a=Math.random()*6.28, r=w*_R(0.95,1.35);
  const x=p.x+Math.cos(a)*r, z=p.z+Math.sin(a)*r, h=heightAt(x,z); return (h>RIVER.y-0.05 && h<RIVER.y+0.6) ? [x,z] : null; }
function patchSpot(centres, R){ const c=centres[(Math.random()*centres.length)|0]; const a=Math.random()*6.28, r=Math.sqrt(Math.random())*R; return [c[0]+Math.cos(a)*r, c[1]+Math.sin(a)*r]; }
function centres(n){ const C=[]; for(let t=0;t<n*20 && C.length<n;t++){ const x=_R(-ARENA+20,ARENA-20), z=_R(-ARENA+20,ARENA-20); if(okSpot(x,z,6)) C.push([x,z]); } return C; }
function waterSpot(){ if(!RIVER.on || !RIVER.lines.length) return null; const L=RIVER.lines[0], p=L[(Math.random()*L.length)|0]; return [p.x+_R(-3,3), p.z+_R(-3,3)]; }
// Z145 trees thinned ~40%: the woods still read as woods but leave clear sight-lines for the fight
export function buildFlora(){ clearFlora(); const n=BIOME.name, k=(MOBILE?0.5:1)*AREA_K/2, N=(v)=>Math.round(v*k);
  if(n==='HILLS'){ plant(conifer(false), N(52), { s:[0.8,1.5], high:0.6, kind:'tree', cr:0.55, real:1.4 }); plant(broadleaf(), N(18), { s:[0.8,1.2], kind:'tree', cr:0.6, real:1.4 }); plant(bush(false), N(50), { s:[0.7,1.3], shadow:false }); plant(flowers(), N(120), { s:[0.8,1.4], shadow:false }); }
  else if(n==='VILLAGE'){ plant(palm(), N(17), { s:[0.85,1.25], kind:'tree', cr:0.4, real:1.4 }); plant(bamboo(), N(10), { s:[0.9,1.2], kind:'tree', cr:0.9, real:1.4 }); plant(broadleaf(), N(13), { s:[0.8,1.15], kind:'tree', cr:0.6, real:1.4 });
    plant(bush(false), N(60), { s:[0.7,1.2], shadow:false }); plant(flowers(), N(140), { s:[0.8,1.4], shadow:false }); plant(reeds(), N(200), { s:[0.8,1.3], near:bankSpot, shadow:false }); plant(hay(), N(8), { s:[0.9,1.2], cr:1.2 }); }
  else if(n==='MEADOW'){ plant(broadleaf(), N(26), { s:[0.8,1.3], kind:'tree', cr:0.6, real:1.4 }); plant(bush(false), N(70), { s:[0.7,1.3], shadow:false }); plant(flowers(), N(200), { s:[0.8,1.4], shadow:false }); }
  else if(n==='SAVANNA'){ const C=centres(14), L=centres(6);   // dry season: golden grass everywhere, reed beds, lone baobabs and acacias, dead trees, termite mounds
    plant(tallGrass(), N(1600), { s:[1.1,1.8], near:()=>Math.random()<0.6?patchSpot(C,26):[_R(-ARENA+6,ARENA-6),_R(-ARENA+6,ARENA-6)], shadow:false, cr:0.55 });
    plant(reedPlume(), N(420), { s:[0.8,1.3], near:()=>patchSpot(L,16), shadow:false, cr:0.5 });
    plant(baobab(), N(9), { s:[0.9,1.35], kind:'tree', cr:1.3, real:1.4 }); plant(acacia(), N(26), { s:[0.8,1.3], kind:'tree', cr:0.4, real:1.15 }); plant(deadTree(), N(18), { s:[0.8,1.2], kind:'tree', cr:0.3, real:1.15 });
    plant(bush(true), N(40), { s:[0.6,1.1], shadow:false }); plant(termite(), N(14), { s:[0.8,1.3], kind:'rock', cr:0.9 }); }
  else if(n==='ARCTIC'){ plant(iceSpire(), N(46), { s:[0.8,1.6], kind:'rock', cr:0.9 }); plant(floe(), N(40), { s:[0.8,2.4], near:waterSpot, shadow:false, cr:0.1 });
    for(const m of FLORA.meshes){ if(m.geometry===floe()){ const M2=new THREE.Matrix4(), P2=new THREE.Vector3(), Q2=new THREE.Quaternion(), S2=new THREE.Vector3(); for(let i=0;i<m.count;i++){ m.getMatrixAt(i,M2); M2.decompose(P2,Q2,S2); P2.y=RIVER.y+0.05; M2.compose(P2,Q2,S2); m.setMatrixAt(i,M2); } m.instanceMatrix.needsUpdate=true; } } }   // ice floes float on the leads
  else if(n==='TUNDRA'){ plant(conifer(true), N(40), { s:[0.8,1.4], kind:'tree', cr:0.55, real:1.4 }); }
  else if(n==='DESERT'){ plant(palm(), N(10), { s:[0.8,1.1], kind:'tree', cr:0.4, real:1.4 }); plant(bush(true), N(35), { s:[0.6,1.1], shadow:false }); }
  else if(n==='CITY'){ /* Z142 street trees are planted along the sidewalks by city.js */ }
  else { plant(bush(true), N(22), { s:[0.6,1.0], shadow:false }); } }
