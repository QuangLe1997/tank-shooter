// actors/face-mask.js — Z305 A MASK THAT FITS THE FACE: no new model needed. When a rigged character loads, its face is read from its own skin (in the rest
// pose): the lower face — over the nose bridge, under the eyes, cheek to cheek, under the chin — is read row by row, and each row takes the face's UPPER
// CONVEX HULL (cloth pulled taut: straight over the hollows beside the nose and under the lip, round the cheeks), then the same down each column. The edges
// are shaped like a real mask (an inverted V over the nose, flat under the eyes, tucked under the jaw), three soft pleats run across it, and the sheet stands
// a few millimetres off the skin, its sides on the cheeks. Each point then takes the bone weights of the skin under it and it is bound to the same skeleton
// (a skinned mesh of its own), so it moves exactly as the face does — jaw, neck and head — and never lets the chin or lips poke through. One elastic loop
// per side runs back along the cheek, over the top of the real ear, down behind it, under the lobe and back to the mask.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const _p = new THREE.Vector3(), _bi = new THREE.Matrix4(), _c = new THREE.Color();
// the colour of what he wears: his own texture read under the skin bound to the given bones (chest, shoulders, upper arms: the shirt) — the commonest colour
// there (not the dark straps or the belt), as sRGB 0..1; null when there is no texture to read
export function outfitColor(meshes, bones){ const out = []; if(typeof document === 'undefined') return null;
  for(const m of meshes){ const mat = m.material, map = mat && mat.map, img = map && (map.isCompressedTexture ? map.userData.px : map.image), sk = m.skeleton, g = m.geometry, UV = g.attributes.uv, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
    if(!img || !sk || !UV || !SI || !SW) continue; const ids = new Set(bones.map(b => sk.bones.indexOf(b)).filter(i => i >= 0)); if(!ids.size) continue;
    const N = 512, cv = document.createElement('canvas'); cv.width = cv.height = N; const cx = cv.getContext('2d', { willReadFrequently:true }); try { cx.drawImage(img, 0, 0, N, N); } catch(e){ continue; }
    const px = cx.getImageData(0, 0, N, N).data, tint = mat.color ? _c.copy(mat.color).convertLinearToSRGB() : _c.setRGB(1, 1, 1), I = g.index, nt = I ? I.count / 3 : UV.count / 3;
    const on = i => { let w = 0; for(let c = 0; c < 4; c++) if(ids.has(SI.getComponent(i, c))) w += SW.getComponent(i, c); return w >= 0.6; };
    for(let t = 0; t < nt; t++){ const a = I ? I.getX(t * 3) : t * 3, b = I ? I.getX(t * 3 + 1) : t * 3 + 1, c = I ? I.getX(t * 3 + 2) : t * 3 + 2; if(!on(a) || !on(b) || !on(c)) continue;   // (the middle of each triangle: vertices sit on the texture's island edges, where its dark padding bleeds in)
      const u0 = (UV.getX(a) + UV.getX(b) + UV.getX(c)) / 3, v0 = (UV.getY(a) + UV.getY(b) + UV.getY(c)) / 3, u = u0 - Math.floor(u0), v = v0 - Math.floor(v0), y = map.flipY ? 1 - v : v;
      const k = (Math.min(N - 1, Math.floor(y * N)) * N + Math.min(N - 1, Math.floor(u * N))) * 4; out.push([px[k] / 255 * tint.r, px[k + 1] / 255 * tint.g, px[k + 2] / 255 * tint.b]); } }
  if(out.length < 8) return null; const bin = p => (Math.min(7, p[0] * 8 | 0) << 6) | (Math.min(7, p[1] * 8 | 0) << 3) | Math.min(7, p[2] * 8 | 0), n = new Map();
  for(const p of out){ const k = bin(p); n.set(k, (n.get(k) || 0) + 1); } const top = [...n].sort((a, b) => b[1] - a[1])[0][0], c0 = [(top >> 6) + 0.5, ((top >> 3) & 7) + 0.5, (top & 7) + 0.5].map(x => x / 8);
  const near = out.filter(p => Math.hypot(p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]) < 0.16), k = 1 / near.length;   // (the commonest colour bin, then the samples round it averaged)
  return { r:near.reduce((s, p) => s + p[0], 0) * k, g:near.reduce((s, p) => s + p[1], 0) * k, b:near.reduce((s, p) => s + p[2], 0) * k }; }
// a worn cloth mask, painted: the outfit's colour faded by sun and road dust, mottled and woven, grubby where it rubs the jaw and cheeks, a breath stain over
// the mouth, the pleats creased, a stitched hem and a few specks (u across, v up the sheet)
function clothTexture(base, W){ const cw = 256, ch = 128, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const cx = cv.getContext('2d'), im = cx.createImageData(cw, ch), d = im.data;
  const rnd = (() => { let s = 7919; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })(), M = 9, MV = 5, grid = Array.from({ length:(M + 1) * (MV + 1) }, rnd);
  const mottle = (s, t) => { const x = s * M, y = t * MV, i = Math.min(M - 1, Math.floor(x)), j = Math.min(MV - 1, Math.floor(y)), fx = x - i, fy = y - j, q = (a, b) => grid[b * (M + 1) + a];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return (q(i, j) * (1 - sx) + q(i + 1, j) * sx) * (1 - sy) + (q(i, j + 1) * (1 - sx) + q(i + 1, j + 1) * sx) * sy; };
  const L = base.r * 0.3 + base.g * 0.59 + base.b * 0.11, dust = [0.62, 0.57, 0.48], grime = [0.33, 0.29, 0.22];
  const fab = ['r', 'g', 'b'].map((c, i) => { const v = base[c] + (L - base[c]) * W.fade; return v + (dust[i] - v) * W.dust; });   // (washed-out colour, then the road's dust in it)
  const specks = Array.from({ length:W.specks }, () => [rnd(), 0.12 + rnd() * 0.76, 0.006 + rnd() * 0.01]);
  const creases = Array.from({ length:W.creases }, () => { const x = 0.1 + rnd() * 0.8, y = 0.15 + rnd() * 0.7, a = (rnd() - 0.5) * 1.2, l = 0.06 + rnd() * 0.12; return [x, y, Math.cos(a) * l, Math.sin(a) * l * 2]; });   // (worn-in wrinkles: short, mostly across)
  const creaseK = (s, t) => { let k = 1; for(const [x, y, dx, dy] of creases){ const q = Math.max(0, Math.min(1, ((s - x) * dx + (t - y) * dy) / (dx * dx + dy * dy))), ex = s - x - dx * q, ey = (t - y - dy * q) / 2, dd = Math.hypot(ex, ey);
    if(dd < 0.007){ const fade = Math.sin(q * Math.PI); k *= 1 - 0.13 * fade * (1 - dd / 0.007); } } return k; };
  for(let y = 0; y < ch; y++) for(let x = 0; x < cw; x++){ const s = (x + 0.5) / cw, t = 1 - (y + 0.5) / ch, e = Math.min(s, 1 - s, t, 1 - t);
    let k = (1 - W.sun) + W.sun * 2 * t;   // (sun-bleached along the top, shaded under the chin)
    k *= 1 + (mottle(s, t) - 0.5) * 0.16 + (rnd() - 0.5) * 0.05 + (((x >> 1) + (y >> 1)) & 1 ? 0.02 : -0.02);   // (blotchy, then the weave)
    for(const tc of [1 / 3, 2 / 3]){ const dt = t - tc; if(Math.abs(dt) < 0.012) k *= 0.82; else if(dt > 0 && dt < 0.05) k *= 1.05; }   // (each pleat's crease, and the fold catching light above it)
    k *= creaseK(s, t);
    if(e < 0.03){ k *= 0.88; const along = (s < 0.03 || s > 0.97) ? t : s; if(e > 0.012 && e < 0.022 && (along * 46) % 1 < 0.55) k *= 0.8; }   // (the hem and its stitches)
    let gm = (Math.max(0, 1 - e / 0.17) ** 1.5 * W.grime + Math.max(0, 1 - t / 0.25) * W.grime * 0.7) * (0.75 + mottle(1 - s, 1 - t) * 0.5);   // (grubby where it rubs: the edges, the chin most — unevenly)
    const bx = (s - 0.5) / 0.17, by = (t - 0.45) / 0.15, br = bx * bx + by * by; if(br < 1) gm += (1 - br) * W.breath;   // (breath over the mouth)
    for(const [sx, sy, sr] of specks){ const dd = Math.hypot((s - sx) * 2, t - sy); if(dd < sr) gm += 0.5 * (1 - dd / sr); }
    gm = Math.min(0.85, gm); const o = (y * cw + x) * 4;
    for(let c = 0; c < 3; c++) d[o + c] = Math.max(0, Math.min(255, ((fab[c] * k) * (1 - gm) + grime[c] * gm * k) * 255)); d[o + 3] = 255; }
  cx.putImageData(im, 0, 0); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex; }
// upper convex hull of points [u, f, u, f, …] (sorted here): the line a cloth pulled across them would take
function upperHull(pts){ const n = pts.length / 2, o = [...Array(n).keys()].sort((a, b) => pts[a * 2] - pts[b * 2]), P = [];
  for(const k of o){ const p = [pts[k * 2], pts[k * 2 + 1]]; while(P.length >= 2){ const a = P[P.length - 2], b = P[P.length - 1]; if((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0) P.pop(); else break; } P.push(p); }
  return P; }
const hullAt = (P, x) => { if(P.length < 2 || x < P[0][0] || x > P[P.length - 1][0]) return -Infinity; let q = 0; while(q < P.length - 2 && P[q + 1][0] < x) q++;
  const [x0, y0] = P[q], [x1, y1] = P[q + 1]; return x1 > x0 ? y0 + (y1 - y0) * (x - x0) / (x1 - x0) : Math.max(y0, y1); };
// head: the Head bone · top: HeadTop_End (sets the scale: h = their distance) · meshes: the skinned meshes · fwd / up: the face's forward / up (world, rest pose)
// cloth: the colour to make it in (sRGB 0..1, e.g. outfitColor's), else S.color
export function fitFaceMask(head, top, meshes, fwd, up, S, cloth){ if(!head || !top || !meshes.length) return null;
  head.updateWorldMatrix(true, true); const H0 = head.getWorldPosition(new THREE.Vector3()), h = top.getWorldPosition(new THREE.Vector3()).distanceTo(H0); if(h < 1e-6) return null;
  const F = fwd.clone().normalize(), U = up.clone().normalize(), Rt = new THREE.Vector3().crossVectors(F, U).normalize();
  const NU = S.cols, NV = S.rows, u0 = -S.halfW * h, u1 = S.halfW * h, v0 = (S.bottom - S.rise) * h, v1 = S.top * h, cw = (u1 - u0) / NU, ch = (v1 - v0) / NV;
  const near = [], hf = [], rows = Array.from({ length:NV }, () => []);   // (near: skin round the face [mesh, index, x, y, z] — the bone weights come from it; hf: the same in head terms [u, v, f])
  // 1. the face's skin, row band by row band (skinned positions, so it is the face as posed)
  for(const m of meshes){ m.updateWorldMatrix(true, false); m.updateMatrixWorld(true); if(m.skeleton) m.skeleton.update(); const P = m.geometry.attributes.position;   // (updateMatrixWorld: a skinned mesh refreshes its bind inverse only there — fresh from the loader it is stale)
    for(let i = 0; i < P.count; i++){ m.getVertexPosition(i, _p); _p.applyMatrix4(m.matrixWorld); const dx = _p.x - H0.x, dy = _p.y - H0.y, dz = _p.z - H0.z;
      const u = dx * Rt.x + dy * Rt.y + dz * Rt.z, v = dx * U.x + dy * U.y + dz * U.z, f = dx * F.x + dy * F.y + dz * F.z;
      if(Math.abs(u) < 0.75 * h && v > -0.45 * h && v < 0.7 * h && f > -0.35 * h){ near.push(m, i, _p.x, _p.y, _p.z); hf.push(u, v, f); }
      if(f < -0.15 * h || Math.abs(u) > S.halfW * h + 0.12 * h) continue; const jr = (v - v0) / ch - 0.5;
      for(let j = Math.max(0, Math.ceil(jr - 0.75)); j <= Math.min(NV - 1, Math.floor(jr + 0.75)); j++) rows[j].push(u, f); } }
  // 2. cloth stretched taut: across each row the sheet follows the skin's upper convex hull (read at the cell centres, not the cells' front-most points)
  const G = new Float32Array(NU * NV);
  for(let j = 0; j < NV; j++){ const P = upperHull(rows[j]); for(let i = 0; i < NU; i++) G[j * NU + i] = hullAt(P, u0 + (i + 0.5) * cw); }
  for(let pass = 0; pass < NU + NV; pass++){ let holes = 0; const g = G.slice();   // (a row with no skin under a cell borrows from its neighbours)
    for(let j = 0; j < NV; j++) for(let i = 0; i < NU; i++){ const k = j * NU + i; if(isFinite(G[k])) continue; let s = 0, n = 0;
      for(const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const a = i + di, b = j + dj; if(a < 0 || b < 0 || a >= NU || b >= NV) continue; const q = G[b * NU + a]; if(isFinite(q)){ s += q; n++; } }
      if(n) g[k] = s / n; else holes++; }
    G.set(g); if(!holes) break; }
  if(!G.every(isFinite)) return null;
  // 3. and down each column (over the lip-to-chin hollow); then smoothed a little, never below that hull and never lifted far off it
  for(let i = 0; i < NU; i++){ const col = []; for(let j = 0; j < NV; j++) col.push(j, G[j * NU + i]); const P = upperHull(col); for(let j = 0; j < NV; j++) G[j * NU + i] = Math.max(G[j * NU + i], hullAt(P, j)); }
  const G0 = G.slice(), lift = 0.01 * h;
  for(let it = 0; it < 2; it++){ const g = G.slice(); for(let j = 0; j < NV; j++) for(let i = 0; i < NU; i++){ let s = 0, n = 0;
      for(let b = Math.max(0, j - 1); b <= Math.min(NV - 1, j + 1); b++) for(let a = Math.max(0, i - 1); a <= Math.min(NU - 1, i + 1); a++){ s += G[b * NU + a]; n++; }
      const k = j * NU + i; g[k] = Math.min(Math.max(s / n, G0[k]), G0[k] + lift); } G.set(g); }
  // the sheet's depth at (u, v): bilinear, and carried on straight past the outer cell centres (the cheek curves away: the line stays outside the skin)
  const at = (u, v) => { const x = (u - u0) / cw - 0.5, y = Math.max(0, Math.min(NV - 1, (v - v0) / ch - 0.5)), i = Math.max(0, Math.min(NU - 2, Math.floor(x))), j = Math.min(NV - 2, Math.floor(y)), fx = x - i, fy = y - j;
    const a = G[j * NU + i], b = G[j * NU + i + 1], c = G[(j + 1) * NU + i], d = G[(j + 1) * NU + i + 1]; return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy; };
  const toW = (u, v, f) => new THREE.Vector3().copy(H0).addScaledVector(Rt, u).addScaledVector(U, v).addScaledVector(F, f);
  // 4. the sheet: its outline shaped (an inverted V over the nose, flat under the eyes, tucked under the jaw), pleated, stood off the skin
  const W = S.halfW * h, sheetAt = (s, t) => { const q = s * s, a = Math.min(1, Math.abs(s) / S.noseW), vb = (S.bottom + S.rise * q) * h, vt = (S.top - S.dip * (1 - (1 - a) * (1 - a))) * h;
    const u = s * W * (1 - 0.06 * t), v = vb + (vt - vb) * t; return [u, v, at(u, v) + S.off * h + Math.sin(t * Math.PI * 3) * S.pleat * h * (1 - q)]; };
  const CU = S.cols * 2, CV = S.rows * 2, pos = [], idx = [], uv = [];
  for(let j = 0; j <= CV; j++) for(let i = 0; i <= CU; i++){ const t = j / CV, p = toW(...sheetAt(i / CU * 2 - 1, t)); pos.push(p.x, p.y, p.z); uv.push(i / CU, t); }
  for(let j = 0; j < CV; j++) for(let i = 0; i < CU; i++){ const a = j * (CU + 1) + i, b = a + 1, c = a + CU + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const sheet = new THREE.BufferGeometry(); sheet.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sheet.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); sheet.setIndex(idx);
  sheet.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(1), 3));
  // 5. the ear loops: one elastic per side, from the mask's top corner back along the cheek, over the top of the ear (under the helmet rim), down behind
  //   it, under the lobe and back to the bottom corner — each point riding just off the skin it passes (the ear is where the model has it: S.ear)
  const E = S.ear, cap = S.helmet * h, clear = S.clear * h;
  const side = (sd, v, f, r) => { let m = -Infinity; for(let q = 0; q < hf.length; q += 3){ const pu = hf[q] * sd; if(pu > m && pu > 0.15 * h && hf[q + 1] < cap && Math.abs(hf[q + 1] - v) < r && Math.abs(hf[q + 2] - f) < r) m = pu; } return m; };
  const onSkin = (sd, u, v, f, out = Math.abs(u), r = 0.025 * h) => { const m = side(sd, v, f, r); return [sd * Math.max(Math.abs(u), isFinite(m) ? m + clear : out), v, f]; };   // (out: where it goes if no skin is found within r)
  const parts = [sheet], mid = (E.front + E.back) / 2;
  for(const sd of [-1, 1]){ const A = sheetAt(sd, 0.85), B = sheetAt(sd, 0.15);
    // where the elastic touches: in front of the ear's top root, over the top, tucked in behind it (a tight look, so it isn't the rim), under the lobe
    const ear = [[E.top - 0.015, E.front + 0.012, 0.025], [E.top + 0.004, mid, 0.02], [(E.top + E.lobe) / 2, E.back - 0.005, 0.012], [E.lobe - 0.006, mid + 0.01, 0.012]]
      .map(([v, f, r]) => onSkin(sd, 0, v * h, f * h, 0.37 * h, r * h));
    const half = (a, b) => onSkin(sd, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);   // (pulled straight between them, but never through the cheek)
    const path = [A, half(A, ear[0]), ...ear, half(ear[3], B), B].map(p => toW(...p));
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path, false, 'centripetal'), 56, S.loop * h, 5, false), nt = tube.attributes.position.count;   // (the elastic: the cloth's own colour from a clean patch of it, a shade darker — a thin cord in its own shadow)
    tube.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(nt * 2).map((_, i) => (i & 1 ? 0.62 : 0.3)), 2)); tube.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(nt * 3).fill(0.82), 3));
    parts.push(tube); }
  const geo = mergeGeometries(parts.map(g => (g.deleteAttribute('normal'), g.index ? g.toNonIndexed() : g)), false); if(!geo) return null;
  // 6. skinned like the face: every point takes the bone weights of the nearest skin point, and is put in that mesh's own (bind) space
  const P = geo.attributes.position, n = P.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); let host = meshes[0];
  for(let k = 0; k < n; k++){ const x = P.getX(k), y = P.getY(k), z = P.getZ(k); let best = 1e9, bi = 0;
    for(let q = 0; q < near.length; q += 5){ const dx = near[q + 2] - x, dy = near[q + 3] - y, dz = near[q + 4] - z, d2 = dx * dx + dy * dy + dz * dz; if(d2 < best){ best = d2; bi = q; } }
    const m = near[bi], vi = near[bi + 1]; host = m; const SI = m.geometry.attributes.skinIndex, SW = m.geometry.attributes.skinWeight;
    for(let c = 0; c < 4; c++){ si[k * 4 + c] = SI.getComponent(vi, c); sw[k * 4 + c] = SW.getComponent(vi, c); }
    _p.set(x, y, z); host.worldToLocal(_p).applyMatrix4(_bi.copy(host.bindMatrix).invert()); P.setXYZ(k, _p.x, _p.y, _p.z); }   // (local → the geometry's bind space)
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  const smooth = mergeVertices(geo, 1e-6); smooth.computeVertexNormals();   // (welded again, so the cloth shades smooth, not in facets)
  const base = cloth || (_c.set(S.color).convertLinearToSRGB(), { r:_c.r, g:_c.g, b:_c.b }), tex = typeof document !== 'undefined' ? clothTexture(base, S.wear) : null;
  const mat = new THREE.MeshStandardMaterial({ map:tex, color:tex ? 0xffffff : S.color, vertexColors:true, roughness:0.97, metalness:0, side:THREE.DoubleSide }), mask = new THREE.SkinnedMesh(smooth, mat);
  mask.name = 'faceMask'; mask.castShadow = true; mask.receiveShadow = true; mask.frustumCulled = false;
  host.parent.add(mask); mask.position.copy(host.position); mask.quaternion.copy(host.quaternion); mask.scale.copy(host.scale); mask.updateMatrixWorld(true);
  mask.bind(host.skeleton, host.bindMatrix); return mask; }
