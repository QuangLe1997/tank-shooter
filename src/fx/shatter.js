// fx/shatter.js — Z261 REAL BREAKAGE: a destroyed prop breaks into pieces of ITSELF — its own (real, textured) mesh cut into fragments (its
// triangles clustered round a few seeds, the seeds relaxed twice so the pieces come out in even, chunky sizes), each piece thrown out of the blast
// with its own spin, falling under gravity, striking the ground (a dust puff, a bounce that loses most of its speed, sliding to a stop on the
// slope), lying there a while, then sinking out of sight. Fuel drums throw burning pieces trailing fire; tyres bounce and roll; stone shatters into
// heavy chunks. The cuts are made once per mesh and reused; the pieces are drawn double-sided (a fragment is an open shell) and capped in number.
import * as THREE from 'three';
import { SHATTER } from '../../config.js';
import { MOBILE, heightAt, scene, spawnPart } from '../hub.js';

const CUTS = new Map(), MATS = new Map(), LIVE = [];
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _ax = new THREE.Vector3(), _dq = new THREE.Quaternion();

// Z312 stone breaks into SOLID lumps, not open shells: a rock, a concrete block, a sandbag or a rock-filled basket comes apart into faceted chunks
//   in its own texture (a few shapes, made once), sized by the piece they replace; metal (containers, drums, wrecks) still tears into sheets
const SOLID = new Set(['boulder', 'concrete', 'jersey', 'teeth', 'hesco', 'sandbag']), LUMPS = [];
export const solidKind = k => SOLID.has(k);
function lump(){ if(!LUMPS.length) for(let v = 0; v < 5; v++){ const g = new THREE.IcosahedronGeometry(1, 1), P = g.attributes.position, seen = new Map(), sx = 0.9 + Math.random() * 0.4, sy = 0.6 + Math.random() * 0.35;
    for(let i = 0; i < P.count; i++){ const k = P.getX(i).toFixed(3) + ',' + P.getY(i).toFixed(3) + ',' + P.getZ(i).toFixed(3); let f = seen.get(k); if(f == null){ f = 0.68 + Math.random() * 0.5; seen.set(k, f); }
      P.setXYZ(i, P.getX(i) * f * sx, P.getY(i) * f * sy, P.getZ(i) * f); }
    g.computeVertexNormals(); LUMPS.push(g); }
  return LUMPS[(Math.random() * LUMPS.length) | 0]; }
// a lump in the stone's own colour when the stone is painted per vertex (else it would come out black)
const TINT = new Map();
function stoneLump(src){ const C = src.attributes.color, g = lump(); if(!C) return g; let t = TINT.get(src.uuid);
  if(!t){ let r = 0, gg = 0, b = 0; const n = C.count, st = Math.max(1, (n / 400) | 0); let k = 0; for(let i = 0; i < n; i += st){ r += C.getX(i); gg += C.getY(i); b += C.getZ(i); k++; } t = [r / k, gg / k, b / k]; TINT.set(src.uuid, t); }
  const c = g.clone(), a = new Float32Array(c.attributes.position.count * 3);
  for(let i = 0; i < a.length; i += 3){ const v = 0.85 + Math.random() * 0.25; a[i] = t[0] * v; a[i + 1] = t[1] * v; a[i + 2] = t[2] * v; }
  c.setAttribute('color', new THREE.BufferAttribute(a, 3)); return c; }
// cut a geometry into n pieces: [{ geo (centred), c (its centre in the source's frame), r (radius) }]
export function cutGeometry(geo, n){ const key = geo.uuid + ':' + n; if(CUTS.has(key)) return CUTS.get(key);
  const g = geo.index ? geo.toNonIndexed() : geo, P = g.attributes.position, T = P.count / 3, cen = new Float32Array(T * 3);
  for(let t = 0; t < T; t++) for(let a = 0; a < 3; a++) cen[t * 3 + a] = (P.getComponent(t * 3, a) + P.getComponent(t * 3 + 1, a) + P.getComponent(t * 3 + 2, a)) / 3;
  n = Math.max(1, Math.min(n, T)); const seeds = []; for(let k = 0; k < n; k++){ const t = (Math.random() * T) | 0; seeds.push([cen[t * 3], cen[t * 3 + 1], cen[t * 3 + 2]]); }
  const own = new Int32Array(T);
  for(let it = 0; it < 3; it++){ const sum = seeds.map(() => [0, 0, 0, 0]);
    for(let t = 0; t < T; t++){ let best = 0, bd = 1e9; for(let k = 0; k < n; k++){ const dx = cen[t * 3] - seeds[k][0], dy = cen[t * 3 + 1] - seeds[k][1], dz = cen[t * 3 + 2] - seeds[k][2], d = dx * dx + dy * dy + dz * dz; if(d < bd){ bd = d; best = k; } }
      own[t] = best; const s = sum[best]; s[0] += cen[t * 3]; s[1] += cen[t * 3 + 1]; s[2] += cen[t * 3 + 2]; s[3]++; }
    if(it < 2) sum.forEach((s, k) => { if(s[3]) seeds[k] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; }); }   // relax: even, chunky pieces
  const names = Object.keys(g.attributes).filter(a => a === 'position' || a === 'normal' || a === 'uv' || a === 'color'), out = [];
  for(let k = 0; k < n; k++){ const tris = []; for(let t = 0; t < T; t++) if(own[t] === k) tris.push(t); if(!tris.length) continue;
    const fg = new THREE.BufferGeometry();
    for(const a of names){ const A = g.attributes[a], sz = A.itemSize, arr = new Float32Array(tris.length * 3 * sz); let o = 0;
      for(const t of tris) for(let j = 0; j < 3; j++) for(let q = 0; q < sz; q++) arr[o++] = A.getComponent(t * 3 + j, q);
      fg.setAttribute(a, new THREE.BufferAttribute(arr, sz)); }
    fg.computeBoundingBox(); const c = fg.boundingBox.getCenter(new THREE.Vector3()); fg.translate(-c.x, -c.y, -c.z); fg.computeBoundingSphere();
    out.push({ geo:fg, c, r:fg.boundingSphere.radius }); }
  CUTS.set(key, out); return out; }
const sideMat = m => { if(MATS.has(m)) return MATS.get(m); const c = m.clone(); c.side = THREE.DoubleSide; c.transparent = false; c.opacity = 1; if(c.emissive) c.emissive.setHex(0); c.emissiveIntensity = 1; MATS.set(m, c); return c; };   // (the prop may be mid hit-flash: the pieces don't keep the glow)

// break `obj` (a Mesh in the scene, or just removed from it — its matrixWorld still holds) into pieces; o = { n, power, up, spin, fire, bounce,
// from:{x,y,z} (the blast; default: below its middle) }
export function shatter(obj, o){ if(!obj || /noshatter/.test(location.search + location.hash)) return 0;
  if(!obj.isMesh){ let n = 0; const list = []; obj.updateMatrixWorld(true); obj.traverse(c => { if(c.isMesh && c.visible) list.push(c); });   // a group: each part breaks
    for(const c of list) n += shatter(c, { ...o, n:Math.max(3, Math.round((o && o.n || SHATTER.n) / Math.max(1, list.length * 0.6))) }); return n; }
  if(!obj.geometry || Array.isArray(obj.material) || obj.isInstancedMesh) return 0;
  o = o || {}; const F = SHATTER, cap = MOBILE ? F.maxMobile : F.max; obj.updateMatrixWorld(true); obj.matrixWorld.decompose(_p, _q, _s);
  // Z317 a stone breaks into pieces that add up to it: its own size in the world (bounding box → the volume of an ellipsoid that fills it), as many
  //   pieces as a stone that size breaks into, and the lumps share fill × its volume in proportion to the parts of it they replace
  let V = 0, Rv = 0; if(o.solid){ const g = obj.geometry; if(!g.boundingBox) g.computeBoundingBox(); g.boundingBox.getSize(_ax).multiply(_s); V = Math.PI / 6 * _ax.x * _ax.y * _ax.z; Rv = Math.cbrt(V * 3 / (4 * Math.PI)); }
  const want = o.solid ? Math.max(F.stone.minN, Math.min(o.n || F.n, Math.round(Rv * 2 * F.stone.perM))) : (o.n || F.n);
  const pieces = cutGeometry(obj.geometry, Math.round(want * (MOBILE ? 0.6 : 1))), mat = sideMat(obj.material), from = o.from || { x:_p.x, y:_p.y + 0.2, z:_p.z };
  const wSum = o.solid ? pieces.reduce((a, q) => a + q.r ** 3, 0) || 1 : 1;
  for(const pc of pieces){
    while(LIVE.length >= cap){ const old = LIVE.shift(); drop(old.m); }
    const sg = o.solid ? stoneLump(obj.geometry) : null, m = new THREE.Mesh(sg || pc.geo, mat); if(sg && !LUMPS.includes(sg)) m.userData.ownGeo = true; m.castShadow = !MOBILE; m.receiveShadow = true;
    _v.copy(pc.c).applyMatrix4(obj.matrixWorld); m.position.copy(_v); m.quaternion.copy(_q); m.scale.copy(_s);
    const lr = o.solid ? Math.cbrt(F.stone.fill * V * (pc.r ** 3 / wSum) * 3 / (4 * Math.PI)) : 0; if(o.solid) m.scale.setScalar(lr / 0.93); scene.add(m);   // (Z317 a lump of its share of the stone's volume — the lump shape's own radius is ~0.93)
    const dx = _v.x - from.x, dy = _v.y - from.y, dz = _v.z - from.z, L = Math.hypot(dx, dy, dz) || 1, sp = (o.power || F.power) * (0.55 + Math.random() * 0.9);
    const v = new THREE.Vector3(dx / L * sp, Math.max(0.2, dy / L) * sp * 0.6 + (o.up || F.up) * (0.5 + Math.random()), dz / L * sp);
    const w = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar((o.spin || F.spin) * 2);
    LIVE.push({ m, v, w, r:o.solid ? lr : pc.r * Math.max(_s.x, _s.y, _s.z), t:0, rest:0, life:(o.solid ? F.stone.life : F.life) * (0.8 + Math.random() * 0.4), fire:o.fire ? 0.6 + Math.random() * 1.4 : 0, bounce:o.bounce || F.bounce, hits:0 }); }
  return pieces.length; }

export function updateShatter(dt){ if(!LIVE.length) return; dt = Math.min(dt, 0.05); const F = SHATTER;
  for(let i = LIVE.length - 1; i >= 0; i--){ const s = LIVE[i], m = s.m; s.t += dt;
    if(s.t > s.life){ m.position.y -= dt * Math.max(F.sink, s.r * 2.2 / F.sinkT); if(s.t > s.life + F.sinkT){ drop(m); LIVE.splice(i, 1); } continue; }   // sinks out of sight (Z317 all the way under, however big)
    if(s.rest > 0.6) continue;
    s.v.y -= F.g * dt; m.position.addScaledVector(s.v, dt);
    const wl = s.w.length(); if(wl > 0.01){ _ax.copy(s.w).divideScalar(wl); _dq.setFromAxisAngle(_ax, wl * dt); m.quaternion.premultiply(_dq); }
    if(s.fire > 0){ s.fire -= dt; if(Math.random() < 0.6) spawnPart(m.position.x, m.position.y, m.position.z, 0, 0.6, 0, { tex:'fire', color:0xffd080, color2:0xff3a08, size:0.5 + Math.random() * 0.4, life:0.35, grav:-2, drag:2, grow:0.6 }); }
    const gy = heightAt(m.position.x, m.position.z), low = gy + s.r * 0.45;
    if(m.position.y < low){ m.position.y = low;
      if(s.v.y < -F.bounceMin){ s.hits++; if(s.hits < 3) spawnPart(m.position.x, gy + 0.2, m.position.z, s.v.x * 0.1, 1.2, s.v.z * 0.1, { color:0x8a7a62, size:0.8 + s.r, life:0.9, smoke:true, grav:-0.3, drag:2, grow:1.6, op:0.35 });
        s.v.y = -s.v.y * s.bounce; s.v.x *= 0.62; s.v.z *= 0.62; s.w.multiplyScalar(0.6); }
      else { s.v.y = 0; s.v.x *= Math.max(0, 1 - dt * 6); s.v.z *= Math.max(0, 1 - dt * 6); s.w.multiplyScalar(Math.max(0, 1 - dt * 5)); if(s.v.lengthSq() < 0.05) s.rest += dt; } } } }
export function clearShatter(){ for(const s of LIVE) drop(s.m); LIVE.length = 0; }
function drop(m){ scene.remove(m); if(m.userData.ownGeo) m.geometry.dispose(); }   // (Z312 a tinted stone lump owns its geometry)
export const SHATTER_LIVE = LIVE;
