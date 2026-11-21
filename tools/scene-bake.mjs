// tools/scene-bake.mjs — Z424 MAPS BAKED ANEW FOR A LIGHT COPY (maintainer tool, used by tools/scene-import.mjs; the game never loads it). A Meshy scan's atlas is
//   cut into thousands of small charts, and a simplifier that keeps every chart's edge whole (its seams locked, so no triangle ever spans two charts) stops
//   far above a light copy's budget — 15–50k triangles where a far copy wants 2k and a sandbag wall 3k. Collapsing across the seams instead (Z420's
//   looseNear / Permissive / sloppy) lands on budget but leaves triangles whose corners sit on different charts: the texture shatters into confetti.
//   So a light copy that cannot keep its seams is made the way a game artist makes one: the shape simplified on its own (positions only), new charts
//   for it (xatlas — fed in spatial chunks of ≤ 20k triangles, its JS build indexing 16-bit, all packed onto one square page; the normals then from each
//   chart's own faces, so a fold between charts stays sharp), and its maps baked from the scan — for every texel of the new atlas, the scan's surface nearest to it (facing the same way, so a thin
//   wall never takes its other side's paint) and its colour, roughness / metal and normal there. The normal is turned from the scan's frame into the
//   copy's own, the frame three.js builds from the UVs when a mesh has no tangents (getTangentFrame, with GLTFLoader's flipped normalScale.y), so the
//   scan's relief — and the shape the copy lost — still lights the copy. Charts are padded and the empty texels filled, so no mip ever reaches black.
//   deps (the --deps dir): three@0.169.0, three-mesh-bvh@0.9.18, xatlasjs@0.2.0, sharp
import path from 'node:path'; import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url';

let K = null;
async function kit(deps){ if(K) return K; const req = createRequire(path.resolve(deps, 'package.json')), dir = m => path.join(path.resolve(deps), 'node_modules', m);
  const THREE = await import(pathToFileURL(path.join(dir('three'), 'build', 'three.module.js')).href), BVH = await import(pathToFileURL(path.join(dir('three-mesh-bvh'), 'src', 'index.js')).href);
  const xd = path.join(dir('xatlasjs'), 'dist', 'node'), { Api } = await import(pathToFileURL(path.join(xd, 'api.mjs')).href), X = Api(req(path.join(xd, 'xatlas.js')));
  const xa = await new Promise(ok => { const x = new X(() => ok(x), null, null); });
  return (K = { THREE, BVH, sharp:req('sharp'), xa }); }

// a mesh's vertex normals from its own faces (area-weighted): on the charted copy a vertex belongs to one chart, so a fold between charts stays sharp
function faceNormals(G){ const P = G.pos, I = G.idx, N = G.nrm.fill(0);
  for(let t = 0; t < I.length; t += 3){ const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3, ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx; for(const v of [a, b, c]){ N[v] += x; N[v + 1] += y; N[v + 2] += z; } }
  for(let v = 0; v < N.length; v += 3){ const l = Math.hypot(N[v], N[v + 1], N[v + 2]) || 1; N[v] /= l; N[v + 1] /= l; N[v + 2] /= l; } }

const CHART = { maxIterations:2 };   // xatlas's chart options (XA_OPT {c, p} in the environment overrides them, for trials)

// a triangle's UV gradient frame (∇u, ∇v on its plane), scaled as three's getTangentFrame scales it
function frame(p, uv, a, b, c, out){ const e1x = p[b * 3] - p[a * 3], e1y = p[b * 3 + 1] - p[a * 3 + 1], e1z = p[b * 3 + 2] - p[a * 3 + 2], e2x = p[c * 3] - p[a * 3], e2y = p[c * 3 + 1] - p[a * 3 + 1], e2z = p[c * 3 + 2] - p[a * 3 + 2];
  const g11 = e1x * e1x + e1y * e1y + e1z * e1z, g12 = e1x * e2x + e1y * e2y + e1z * e2z, g22 = e2x * e2x + e2y * e2y + e2z * e2z, det = g11 * g22 - g12 * g12;
  if(!(Math.abs(det) > 1e-20)){ out.fill(0); return out; } const grad = (d1, d2, o) => { const s = (g22 * d1 - g12 * d2) / det, t = (g11 * d2 - g12 * d1) / det; out[o] = s * e1x + t * e2x; out[o + 1] = s * e1y + t * e2y; out[o + 2] = s * e1z + t * e2z; };
  grad(uv[b * 2] - uv[a * 2], uv[c * 2] - uv[a * 2], 0); grad(uv[b * 2 + 1] - uv[a * 2 + 1], uv[c * 2 + 1] - uv[a * 2 + 1], 3);
  const m = Math.max(out[0] * out[0] + out[1] * out[1] + out[2] * out[2], out[3] * out[3] + out[4] * out[4] + out[5] * out[5]), k = m > 0 ? 1 / Math.sqrt(m) : 0; for(let i = 0; i < 6; i++) out[i] *= k; return out; }

// a map as raw RGB at a size (bilinear lookups by glTF UV: v runs down the image)
async function raster(sharp, file, px){ if(!file) return null; const { data, info } = await sharp(file).resize(px, px, { fit:'fill', kernel:'lanczos3' }).removeAlpha().raw().toBuffer({ resolveWithObject:true }); return { d:data, w:info.width, h:info.height }; }
function sample(I, u, v, o){ const x = u * I.w - 0.5, y = v * I.h - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, W = I.w, H = I.h, d = I.d;
  const px = (X, Y) => ((((Y % H) + H) % H) * W + (((X % W) + W) % W)) * 3;
  const a = px(x0, y0), b = px(x0 + 1, y0), c = px(x0, y0 + 1), e = px(x0 + 1, y0 + 1);
  for(let k = 0; k < 3; k++) o[k] = (d[a + k] * (1 - fx) + d[b + k] * fx) * (1 - fy) + (d[c + k] * (1 - fx) + d[e + k] * fx) * fy; return o; }

// hi: the welded scan { pos, nrm, uv, idx }; lo: the simplified shape { pos, idx }; maps: { color, normal, mr } files at full size; px: the atlas size
// → { G:{ pos, nrm, uv, idx }, img:{ color, normal, mr } raw RGB at px, px }
export async function bakeCopy(deps, hi, lo, maps, px){ const { THREE, BVH, xa } = await kit(deps), sharp = K.sharp, t0 = Date.now();
  // new charts: xatlas's JS build indexes 16-bit, so the copy goes in as spatial chunks of ≤ 20k triangles, all packed into one atlas
  const C = lo, nT = C.idx.length / 3, key = new Float64Array(nT), ord = new Uint32Array(nT).map((_, i) => i), bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for(let v = 0; v < C.pos.length / 3; v++) for(let a = 0; a < 3; a++){ bb[a] = Math.min(bb[a], C.pos[v * 3 + a]); bb[a + 3] = Math.max(bb[a + 3], C.pos[v * 3 + a]); }
  const cell = Math.max(bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]) / 64 || 1;
  for(let t = 0; t < nT; t++){ let c = [0, 0, 0]; for(let k = 0; k < 3; k++) for(let a = 0; a < 3; a++) c[a] += C.pos[C.idx[t * 3 + k] * 3 + a] / 3; const g = c.map((x, a) => Math.min(63, Math.floor((x - bb[a]) / cell)));
    let m = 0; for(let b = 5; b >= 0; b--) m = m * 8 + ((g[0] >> b) & 1) * 4 + ((g[1] >> b) & 1) * 2 + ((g[2] >> b) & 1); key[t] = m; }   // (Morton order: a chunk is one piece of the shape)
  ord.sort((a, b) => key[a] - key[b]); const parts = [];
  for(let s0 = 0; s0 < nT; s0 += 20000){ const map = new Map(), P = [], I = [];
    for(let j = s0; j < Math.min(nT, s0 + 20000); j++) for(let k = 0; k < 3; k++){ const v = C.idx[ord[j] * 3 + k]; let r = map.get(v); if(r === undefined){ r = P.length / 3; map.set(v, r); P.push(C.pos[v * 3], C.pos[v * 3 + 1], C.pos[v * 3 + 2]); } I.push(r); }
    parts.push({ pos:Float32Array.from(P), idx:Uint16Array.from(I) }); }   // (the shape whole: xatlas cuts its charts at the folds itself)
  // packed onto one square page of px: texels per unit from the surface (60 % of the page), 10 % less each time the charts spill onto a second page
  let area = 0; for(let t = 0; t < nT; t++){ const a = C.idx[t * 3] * 3, b = C.idx[t * 3 + 1] * 3, c = C.idx[t * 3 + 2] * 3, ux = C.pos[b] - C.pos[a], uy = C.pos[b + 1] - C.pos[a + 1], uz = C.pos[b + 2] - C.pos[a + 2], vx = C.pos[c] - C.pos[a], vy = C.pos[c + 1] - C.pos[a + 1], vz = C.pos[c + 2] - C.pos[a + 2]; area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2; }
  const XO = JSON.parse(process.env.XA_OPT || '{}'), pad = Math.max(2, Math.round(px / 640)); let tpu = Math.sqrt(0.6 * px * px / Math.max(area, 1e-9)), A = null;
  for(let tries = 0; tries < 16; tries++){ xa.createAtlas(); for(const [i, Q] of parts.entries()) xa.addMesh(Q.idx, Q.pos, null, null, 'c' + i, false, false, 1);
    A = xa.generateAtlas({ ...CHART, ...(XO.c || {}) }, { resolution:px, texelsPerUnit:tpu, padding:pad, bilinear:true, rotateCharts:true, ...(XO.p || {}) }, true);
    if(A.atlasCount <= 1) break; xa.destroyAtlas(); tpu *= 0.9; }
  let nv = 0, ni = 0; for(const R of A.meshes){ if(R.vertexCount >= 65536){ xa.destroyAtlas(); throw new Error('bake: a chunk split past 16-bit indices (' + R.vertexCount + ')'); } nv += R.vertexCount; ni += R.index.length; }
  const G = { pos:new Float32Array(nv * 3), nrm:new Float32Array(nv * 3), uv:new Float32Array(nv * 2), idx:new Uint32Array(ni) }; let vo = 0, io = 0;
  A.meshes.forEach((R, i) => { const Q = parts[i]; for(let v = 0; v < R.vertexCount; v++){ const o = R.oldIndexes[v]; G.pos.set(Q.pos.subarray(o * 3, o * 3 + 3), (vo + v) * 3);
      G.uv[(vo + v) * 2] = R.vertex.coords1[v * 2]; G.uv[(vo + v) * 2 + 1] = R.vertex.coords1[v * 2 + 1]; }   // (the atlas stretched over the whole square: a little anisotropy, none of it wasted)
    for(let k = 0; k < R.index.length; k++) G.idx[io + k] = R.index[k] + vo; vo += R.vertexCount; io += R.index.length; });
  xa.destroyAtlas(); faceNormals(G);
  // the scan, searchable
  if(!hi.bvh){ const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(hi.pos, 3)); g.setIndex(new THREE.BufferAttribute(hi.idx, 1)); hi.geo = g; hi.bvh = new BVH.MeshBVH(g, { targetLeafSize:8 }); }   // (once per scan: every baked level of it shares the tree)
  const hg = hi.geo, bvh = hi.bvh, HI = hg.index.array, HP = hi.pos, HN = hi.nrm, HU = hi.uv;
  const srcPx = Math.min(4096, px * 2), M = { c:await raster(sharp, maps.color, srcPx), n:await raster(sharp, maps.normal, srcPx), r:await raster(sharp, maps.mr, Math.min(srcPx, 2048)) };
  const img = { color:new Uint8ClampedArray(px * px * 3), normal:new Uint8ClampedArray(px * px * 3), mr:M.r ? new Uint8ClampedArray(px * px * 3) : null }, done = new Uint8Array(px * px);
  const hb = new THREE.Box3().setFromBufferAttribute(hg.attributes.position), maxD = hb.getSize(new THREE.Vector3()).length() * 0.06;
  const p = new THREE.Vector3(), n = new THREE.Vector3(), cp = new THREE.Vector3(), best = new THREE.Vector3(), tn = new THREE.Vector3(), bc = new THREE.Vector3(), tri = new THREE.Triangle(), fr = new Float32Array(6), lf = new Float32Array(6), s3 = [0, 0, 0];
  let bestD = 0, bestT = -1, facing = true;
  const look = { boundsTraverseOrder:box => box.distanceToPoint(p), intersectsBounds:(box, leaf, score) => score < bestD ? BVH.INTERSECTED : BVH.NOT_INTERSECTED,
    intersectsTriangle:(t, ti) => { if(facing){ t.getNormal(tn); if(tn.dot(n) < 0) return false; } t.closestPointToPoint(p, cp); const d = cp.distanceTo(p); if(d < bestD){ bestD = d; bestT = ti; best.copy(cp); } return false; } };
  const nearest = () => { facing = true; bestD = maxD; bestT = -1; bvh.shapecast(look); if(bestT < 0){ facing = false; bestD = Infinity; bvh.shapecast(look); } return bestT; };
  const LP = G.pos, LN = G.nrm, LU = G.uv, LI = G.idx;
  for(let t = 0; t < LI.length / 3; t++){ const a = LI[t * 3], b = LI[t * 3 + 1], c = LI[t * 3 + 2]; frame(LP, LU, a, b, c, lf);
    const x0 = LU[a * 2] * px, y0 = LU[a * 2 + 1] * px, x1 = LU[b * 2] * px, y1 = LU[b * 2 + 1] * px, x2 = LU[c * 2] * px, y2 = LU[c * 2 + 1] * px, area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if(Math.abs(area) < 1e-9) continue;
    const X0 = Math.max(0, Math.floor(Math.min(x0, x1, x2) - 1)), X1 = Math.min(px - 1, Math.ceil(Math.max(x0, x1, x2) + 1)), Y0 = Math.max(0, Math.floor(Math.min(y0, y1, y2) - 1)), Y1 = Math.min(px - 1, Math.ceil(Math.max(y0, y1, y2) + 1));
    for(let y = Y0; y <= Y1; y++) for(let x = X0; x <= X1; x++){ const cx = x + 0.5, cy = y + 0.5;
      let w0 = ((x1 - cx) * (y2 - cy) - (x2 - cx) * (y1 - cy)) / area, w1 = ((x2 - cx) * (y0 - cy) - (x0 - cx) * (y2 - cy)) / area, w2 = 1 - w0 - w1;
      const e = -0.6 / Math.sqrt(Math.abs(area)); if(w0 < e || w1 < e || w2 < e) continue;   // (texels just past the edge too: the charts' rims are filled by their own triangle)
      const q = y * px + x; if(done[q] === 2) continue; const inside = w0 >= 0 && w1 >= 0 && w2 >= 0; if(done[q] === 1 && !inside) continue;
      w0 = Math.max(0, w0); w1 = Math.max(0, w1); w2 = Math.max(0, w2); const ws = w0 + w1 + w2; w0 /= ws; w1 /= ws; w2 /= ws;
      p.set(LP[a * 3] * w0 + LP[b * 3] * w1 + LP[c * 3] * w2, LP[a * 3 + 1] * w0 + LP[b * 3 + 1] * w1 + LP[c * 3 + 1] * w2, LP[a * 3 + 2] * w0 + LP[b * 3 + 2] * w1 + LP[c * 3 + 2] * w2);
      n.set(LN[a * 3] * w0 + LN[b * 3] * w1 + LN[c * 3] * w2, LN[a * 3 + 1] * w0 + LN[b * 3 + 1] * w1 + LN[c * 3 + 1] * w2, LN[a * 3 + 2] * w0 + LN[b * 3 + 2] * w1 + LN[c * 3 + 2] * w2).normalize();
      const ht = nearest(); if(ht < 0) continue; const ha = HI[ht * 3], hb = HI[ht * 3 + 1], hc = HI[ht * 3 + 2];
      tri.a.fromArray(HP, ha * 3); tri.b.fromArray(HP, hb * 3); tri.c.fromArray(HP, hc * 3); tri.getBarycoord(best, bc); if(!isFinite(bc.x)) bc.set(1 / 3, 1 / 3, 1 / 3);
      const u = HU[ha * 2] * bc.x + HU[hb * 2] * bc.y + HU[hc * 2] * bc.z, v = HU[ha * 2 + 1] * bc.x + HU[hb * 2 + 1] * bc.y + HU[hc * 2 + 1] * bc.z, o = q * 3;
      if(M.c){ sample(M.c, u, v, s3); img.color[o] = s3[0]; img.color[o + 1] = s3[1]; img.color[o + 2] = s3[2]; }
      if(M.r){ sample(M.r, u, v, s3); img.mr[o] = s3[0]; img.mr[o + 1] = s3[1]; img.mr[o + 2] = s3[2]; }
      // the scan's normal here (its vertex normal, bent by its normal map in its own UV frame) …
      let nx = HN[ha * 3] * bc.x + HN[hb * 3] * bc.y + HN[hc * 3] * bc.z, ny = HN[ha * 3 + 1] * bc.x + HN[hb * 3 + 1] * bc.y + HN[hc * 3 + 1] * bc.z, nz = HN[ha * 3 + 2] * bc.x + HN[hb * 3 + 2] * bc.y + HN[hc * 3 + 2] * bc.z;
      { const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; }
      if(M.n){ sample(M.n, u, v, s3); const mx = s3[0] / 127.5 - 1, my = -(s3[1] / 127.5 - 1), mz = s3[2] / 127.5 - 1; frame(HP, HU, ha, hb, hc, fr);
        const X = fr[0] * mx + fr[3] * my + nx * mz, Y = fr[1] * mx + fr[4] * my + ny * mz, Z = fr[2] * mx + fr[5] * my + nz * mz, l = Math.hypot(X, Y, Z) || 1; nx = X / l; ny = Y / l; nz = Z / l; }
      // … written in the copy's frame: solve [T  −B  N]·m = n
      const m00 = lf[0], m10 = lf[1], m20 = lf[2], m01 = -lf[3], m11 = -lf[4], m21 = -lf[5], m02 = n.x, m12 = n.y, m22 = n.z;
      const det = m00 * (m11 * m22 - m12 * m21) - m01 * (m10 * m22 - m12 * m20) + m02 * (m10 * m21 - m11 * m20);
      let ax = 0, ay = 0, az = 1; if(Math.abs(det) > 1e-8){ ax = (nx * (m11 * m22 - m12 * m21) - m01 * (ny * m22 - m12 * nz) + m02 * (ny * m21 - m11 * nz)) / det;
        ay = (m00 * (ny * m22 - m12 * nz) - nx * (m10 * m22 - m12 * m20) + m02 * (m10 * nz - ny * m20)) / det; az = (m00 * (m11 * nz - ny * m21) - m01 * (m10 * nz - ny * m20) + nx * (m10 * m21 - m11 * m20)) / det; }
      if(az < 0.05) az = 0.05; { const l = Math.hypot(ax, ay, az); ax /= l; ay /= l; az /= l; }
      img.normal[o] = (ax * 0.5 + 0.5) * 255; img.normal[o + 1] = (ay * 0.5 + 0.5) * 255; img.normal[o + 2] = (az * 0.5 + 0.5) * 255; done[q] = inside ? 2 : 1; } }
  // the empty texels: grown out from the charts' rims, then the mean (no mip of a chart ever pulls in black)
  const covered = done.reduce((s, v) => s + (v ? 1 : 0), 0); for(const k of Object.keys(img)) if(img[k]) grow(img[k], done.slice(), px);
  return { G, img, px, atlas:[A.width, A.height, A.atlasCount], cover:+(covered / px / px).toFixed(2), s:Math.round((Date.now() - t0) / 1000) }; }

function grow(I, done, px){ for(let pass = 0; pass < 24; pass++){ let any = false; const next = done.slice();
    for(let y = 0; y < px; y++) for(let x = 0; x < px; x++){ const q = y * px + x; if(done[q]) continue; let r = 0, g = 0, b = 0, c = 0;
      for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){ const X = x + dx, Y = y + dy; if(X < 0 || Y < 0 || X >= px || Y >= px) continue; const k = Y * px + X; if(!done[k]) continue; r += I[k * 3]; g += I[k * 3 + 1]; b += I[k * 3 + 2]; c++; }
      if(c){ I[q * 3] = r / c; I[q * 3 + 1] = g / c; I[q * 3 + 2] = b / c; next[q] = 1; any = true; } }
    done.set(next); if(!any) break; }
  let r = 0, g = 0, b = 0, c = 0; for(let q = 0; q < px * px; q++) if(done[q]){ r += I[q * 3]; g += I[q * 3 + 1]; b += I[q * 3 + 2]; c++; }
  if(c) for(let q = 0; q < px * px; q++) if(!done[q]){ I[q * 3] = r / c; I[q * 3 + 1] = g / c; I[q * 3 + 2] = b / c; } }

// a baked map to a file (JPEG for the GLB, WebP for the sharp near copy), resized when asked
export async function saveMap(img, px, file, size, q, webp){ const s = K.sharp(Buffer.from(img.buffer, img.byteOffset, img.byteLength), { raw:{ width:px, height:px, channels:3 } }), r = size && size !== px ? s.resize(size, size, { kernel:'lanczos3' }) : s;
  await (webp ? r.webp({ quality:q, smartSubsample:true, effort:5 }) : r.jpeg({ quality:q, mozjpeg:true })).toFile(file); return file; }
