// actors/loft.js — Z246 SCULPTED SURFACES: one smooth skin lofted through key cross-sections (a horse's barrel, neck, head and legs; a breastplate, a helmet, greaves) instead of capsules, spheres and boxes stuck together — Catmull-Rom between the keys, superelliptic sections with their own depth above / below and a medial ridge, vertex colours, bone weights for a skinned mesh, partial shells for armour plates, edge curves for gilt trims
import * as THREE from 'three';

// ---- a key cross-section, given in the frame of `obj` (its matrixWorld must be current; null = already in the target frame):
//   centre c, the way the loft runs n, the section's "up" u, half-width rx, depth above (rt) and below (rb) the centre;
//   o: { e: roundness (1 ellipse, <1 fuller / boxier), ridge: a crest along u (m), rw: its half-width (rad), w: bone weights [[i,w]…] or {i:w}, col: THREE.Color }
export function keySec(obj, c, n, u, rx, rt, rb, o){ o=o||{};
  const C=new THREE.Vector3(c[0], c[1], c[2]), Nn=new THREE.Vector3(n[0], n[1], n[2]), U=new THREE.Vector3(u[0], u[1], u[2]);
  if(obj){ const M=obj.matrixWorld; C.applyMatrix4(M); Nn.transformDirection(M); U.transformDirection(M); }
  let w=o.w||null; if(Array.isArray(w)){ const m={}; for(const [i, v] of w) m[i]=(m[i]||0)+v; w=m; }
  return { c:C, n:Nn.normalize(), u:U.normalize(), rx, rt, rb, e:o.e==null?1:o.e, ridge:o.ridge||0, rw:o.rw||0.55, w, col:o.col||null }; }
const cr=(a, b, c, d, t)=>{ const t2=t*t, t3=t2*t; return 0.5*(2*b + (c-a)*t + (2*a-5*b+4*c-d)*t2 + (3*b-a-3*c+d)*t3); };
const crV=(A, B, C, D, k, t, out)=>out.set(cr(A[k].x, B[k].x, C[k].x, D[k].x, t), cr(A[k].y, B[k].y, C[k].y, D[k].y, t), cr(A[k].z, B[k].z, C[k].z, D[k].z, t));
// the section at parameter t ∈ [0, keys−1] — smooth (Catmull-Rom) through the keys; weights and colour blend linearly
export function secAt(K, t){ const L=K.length-1; t=Math.max(0, Math.min(L, t)); const i=Math.min(L-1, Math.floor(t)), f=t-i;
  const A=K[Math.max(0, i-1)], B=K[i], C=K[i+1], D=K[Math.min(L, i+2)];
  const s={ c:crV(A, B, C, D, 'c', f, new THREE.Vector3()), n:crV(A, B, C, D, 'n', f, new THREE.Vector3()).normalize(), u:crV(A, B, C, D, 'u', f, new THREE.Vector3()), X:new THREE.Vector3(),
    rx:Math.max(0.002, cr(A.rx, B.rx, C.rx, D.rx, f)), rt:Math.max(0.002, cr(A.rt, B.rt, C.rt, D.rt, f)), rb:Math.max(0.002, cr(A.rb, B.rb, C.rb, D.rb, f)),
    e:B.e+(C.e-B.e)*f, ridge:Math.max(0, cr(A.ridge, B.ridge, C.ridge, D.ridge, f)), rw:B.rw+(C.rw-B.rw)*f, w:null, col:null };
  s.u.addScaledVector(s.n, -s.u.dot(s.n)).normalize(); s.X.crossVectors(s.u, s.n).normalize();
  if(B.w || C.w){ const w={}; for(const k in (B.w||{})) w[k]=(w[k]||0)+B.w[k]*(1-f); for(const k in (C.w||{})) w[k]=(w[k]||0)+C.w[k]*f; s.w=w; }
  if(B.col && C.col) s.col=B.col.clone().lerp(C.col, f); else s.col=B.col||C.col||null;
  return s; }
// a point on a section at angle a (0 = +X side, π/2 = up, π = −X, 3π/2 = down), pushed out by `off`
export function ringAt(s, a, off, out){ out=out||new THREE.Vector3(); const ca=Math.cos(a), sa=Math.sin(a), e=s.e;
  let x=(s.rx+off)*Math.sign(ca)*Math.pow(Math.abs(ca), e), y=((sa>=0?s.rt:s.rb)+off)*Math.sign(sa)*Math.pow(Math.abs(sa), e);
  if(s.ridge>0){ const d=Math.abs(Math.atan2(Math.sin(a-Math.PI/2), Math.cos(a-Math.PI/2)))/s.rw; if(d<1){ const b=s.ridge*(1-d)*(1-d); x+=b*ca; y+=b*sa; } }
  return out.copy(s.c).addScaledVector(s.X, x).addScaledVector(s.u, y); }
// ---- the surface: o = { t0, t1 (sub-range of the keys), seg (rows per key span), ring (columns), a0/a1 (an open shell; omit for a closed tube),
//   off (pushed out, for plates over the skin), caps (close the ends of a tube), skin (write skinIndex / skinWeight), color (write vertex colours),
//   tint(s, a, t, colour, point) (paint a vertex), bump(s, a, t) → extra radius (muscle, a groove), flip (face inwards) }
export function loftGeo(K, o){ o=o||{}; const t0=o.t0==null?0:o.t0, t1=o.t1==null?K.length-1:o.t1, seg=o.seg||4, R=o.ring||24, full=o.a0==null, a0=full?0:o.a0, a1=full?Math.PI*2:o.a1, off=o.off||0;
  const rows=Math.max(1, Math.round(Math.abs(t1-t0)*seg)), cols=full?R:R+1, pos=[], col=[], si=[], sw=[], idx=[], p=new THREE.Vector3(), c=new THREE.Color(1, 1, 1);
  const secs=[]; for(let r=0;r<=rows;r++) secs.push(secAt(K, t0+(t1-t0)*r/rows));
  const vert=(s, t, a, q)=>{ pos.push(q.x, q.y, q.z);
    if(o.color){ c.copy(s.col||o.col||c.set(1, 1, 1)); if(o.tint) o.tint(s, a, t, c, q); col.push(c.r, c.g, c.b); }
    if(o.skin){ const e=Object.entries(s.w||{ 0:1 }).sort((x, y)=>y[1]-x[1]).slice(0, 4); let tot=0; for(const [, v] of e) tot+=v;
      for(let k=0;k<4;k++){ si.push(e[k] ? +e[k][0] : 0); sw.push(e[k] ? e[k][1]/(tot||1) : 0); } } };
  for(let r=0;r<=rows;r++){ const s=secs[r], t=t0+(t1-t0)*r/rows; for(let j=0;j<cols;j++){ const a=a0+(a1-a0)*j/R; vert(s, t, a, ringAt(s, a, off+(o.bump ? o.bump(s, a, t) : 0), p)); } }
  for(let r=0;r<rows;r++) for(let j=0;j<R;j++){ const j2=full?(j+1)%R:j+1, A=r*cols+j, B=r*cols+j2, C=(r+1)*cols+j, D=(r+1)*cols+j2;
    if(o.flip) idx.push(A, C, B, B, C, D); else idx.push(A, B, C, B, D, C); }
  if(full && o.caps){ for(const end of [0, 1]){ const r=end?rows:0, s=secs[r], base=pos.length/3; vert(s, end?t1:t0, Math.PI/2, s.c);
      for(let j=0;j<R;j++){ const A=r*cols+j, B=r*cols+(j+1)%R; if(end) idx.push(base, A, B); else idx.push(base, B, A); } } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if(o.color) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if(o.skin){ g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); }
  g.setIndex(idx); g.computeVertexNormals(); return g; }
// keys along a free path (a tail, a plume feather, a comb): pts in order, `up` the side the section's u leans to, prof(t∈0..1) → [rx, rt, rb]
//   (up = null: carry the section frame along the path without twisting — for round limbs)
export function pathKeys(pts, up, prof, o){ const K=[], n=new THREE.Vector3(), u=new THREE.Vector3();
  for(let i=0;i<pts.length;i++){ const a=pts[Math.max(0, i-1)], b=pts[Math.min(pts.length-1, i+1)]; n.subVectors(b, a).normalize();
    if(up) u.copy(typeof up==='function' ? up(i, pts[i]) : up);
    else if(!i){ const ax=Math.abs(n.x), ay=Math.abs(n.y), az=Math.abs(n.z); u.set(ax<=ay && ax<=az ? 1 : 0, ay<ax && ay<=az ? 1 : 0, az<ax && az<ay ? 1 : 0); }
    u.addScaledVector(n, -u.dot(n)).normalize(); const [rx, rt, rb]=prof(i/(pts.length-1));
    K.push(keySec(null, [pts[i].x, pts[i].y, pts[i].z], [n.x, n.y, n.z], [u.x, u.y, u.z], rx, rt, rb, typeof o==='function' ? o(i/(pts.length-1)) : o)); }
  return K; }
// edge curves for trims: along the loft at a fixed angle, or round one section between two angles
export function lineAlong(K, ta, tb, a, off, n){ const out=[]; n=n||16; for(let i=0;i<=n;i++) out.push(ringAt(secAt(K, ta+(tb-ta)*i/n), a, off)); return out; }
export function lineAround(K, t, a0, a1, off, n){ const s=secAt(K, t), out=[]; n=n||16; for(let i=0;i<=n;i++) out.push(ringAt(s, a0+(a1-a0)*i/n, off)); return out; }
export function trimGeo(pts, r, closed){ const curve=new THREE.CatmullRomCurve3(pts, !!closed); return new THREE.TubeGeometry(curve, Math.max(8, pts.length*3), r, 6, !!closed); }
// geometry built in the bind frame → into obj's own frame (for a rigid plate parented to a bone)
export function toLocal(geo, obj){ return geo.applyMatrix4(new THREE.Matrix4().copy(obj.matrixWorld).invert()); }
// a skinned mesh on a skeleton (the bones' matrixWorld must hold the rest pose); `parent` is the frame the geometry was built in
export function skinMesh(geo, mat, skel, parent){ const m=new THREE.SkinnedMesh(geo, mat); parent.add(m); m.updateMatrixWorld(true); m.bind(skel); m.frustumCulled=false; m.castShadow=true; m.receiveShadow=true; return m; }
// a cheap smooth 3-D value field in [-1, 1] (camouflage blotches, a coat's dapple, hair streaks)
export function blot(q, f){ f=f||1; const x=q.x*f, y=q.y*f, z=q.z*f;
  return (Math.sin(x*1.7+Math.sin(y*2.3+z*0.7)*1.9)+Math.sin(y*1.9+Math.sin(z*1.3+x*0.9)*2.1)+Math.sin(z*2.1+Math.sin(x*1.1+y*1.5)*1.7))/3; }
