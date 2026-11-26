#!/usr/bin/env node
// tools/blade-pack.mjs — BLADE 1 THE BLADES PACKED (maintainer tool; the game never loads it): a downloaded Sketchfab blade (a GLB of many meshes and
//   materials, lying any way in its own scene, in any unit) → assets/models/real/blade/<id>.glb: ONE mesh, ONE material (colour · normal · roughness G +
//   metal B, JPEG), plain floats, at its real size IN THE BLADE'S OWN FRAME:
//     origin = the main hand's grip point on the shaft's centre line · +Z along the weapon toward the TIP · +Y = the side the cutting EDGE is on
//     (the back / spine is −Y) · +X = the blade's flat (right-handed: X = Y × Z). Metres.
//   The frame is measured, not guessed: the long axis by PCA, then refined as the line through the shaft's own cross-section centres (spec.shaft, a share
//   of the length from the butt — the blade sits off the centre line on a glaive); the end that is wider across is the tip; spec.edge flips +Y onto the
//   edge after a look at a picture. A heavy model (spec.tris) is simplified on its shape alone (positions welded: no seam to hold it up) and its maps are
//   BAKED ANEW from the source (tools/scene-bake.mjs — never collapsed across UV seams: that shatters the texture); several source materials are first
//   laid side by side on one sheet (a grid of their maps, each primitive's UVs moved into its cell) so the bake reads them as one. A light model keeps
//   its own triangles and UVs; its maps are only re-encoded.
//   node tools/blade-pack.mjs [id …] --src <dir holding <folder>/<file>.glb> --deps <dir> [--work <dir>] [--out <dir>]
//   (<deps>: npm i --prefix <dir> meshoptimizer@0.25.0 three@0.169.0 three-mesh-bvh@0.9.18 xatlasjs@0.2.0 sharp)
//   Prints one JSON line a blade: the numbers config.js BLADE.kinds wants (len, butt, tip, the blade's root, widths, centre of mass).
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// len: overall, metres · grip: the main hand, metres from the butt end · shaft: [from, to] share of the length (from the butt) that is plain shaft / hilt ·
// blade: the share of the length (from the butt) where the blade begins · edge: ±1 flips +Y onto the cutting edge · tris: 0 keeps every triangle
const SPEC = {
  guandao: { src:'glaive/glaive.glb', len:2.05, grip:1.05, shaft:[0.08, 0.5], blade:0.665, edge:-1, tris:9000, px:2048, save:[2048, 1536, 1024], q:[80, 82, 76],
    credit:'"Ancient Chinese Decorative Glaive" by robertursache — Sketchfab 74c31353a03244d29119d7c94935ff73 — CC BY 4.0' },
  dadao: { src:'dadao/dadao.glb', len:1.05, grip:0.275, shaft:[0.04, 0.3], blade:0.335, edge:-1, tris:0, save:[1024, 1024, 1024], q:[86, 88, 82],
    credit:'"Dadao" by trector — Sketchfab 511cfb4bb4ba464e9c6cb294b45f29ff — CC BY 4.0' },
};

// ---------- a GLB flattened: every primitive in the scene's frame ----------
const mul = (a, b) => { const o = new Array(16).fill(0); for(let c = 0; c < 4; c++) for(let r = 0; r < 4; r++){ let s = 0; for(let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
const trs = n => { if(n.matrix) return n.matrix; const t = n.translation || [0, 0, 0], [x, y, z, w] = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1];
  return [(1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0, 2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0, 2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0, t[0], t[1], t[2], 1]; };
function readGlb(file){ const b = fs.readFileSync(file), jl = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + jl).toString()), bin = b.subarray(20 + jl + 8), dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const SZ = { 5120:1, 5121:1, 5122:2, 5123:2, 5125:4, 5126:4 }, RD = { 5120:'getInt8', 5121:'getUint8', 5122:'getInt16', 5123:'getUint16', 5125:'getUint32', 5126:'getFloat32' }, NC = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4 }, NORM = { 5120:127, 5121:255, 5122:32767, 5123:65535 };
  const acc = (i, ints) => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], sz = SZ[a.componentType], nc = NC[a.type], st = v.byteStride || sz * nc, o0 = (v.byteOffset || 0) + (a.byteOffset || 0), out = new (ints ? Uint32Array : Float32Array)(a.count * nc), k = a.normalized ? NORM[a.componentType] : 0;
    for(let e = 0; e < a.count; e++) for(let c = 0; c < nc; c++){ const x = dv[RD[a.componentType]](o0 + e * st + c * sz, true); out[e * nc + c] = k ? x / k : x; } return out; };
  const prims = [], walk = (ni, M) => { const n = j.nodes[ni], W = mul(M, trs(n));
    if(n.mesh != null) for(const p of j.meshes[n.mesh].primitives){ if(p.mode != null && p.mode !== 4) continue; const P = acc(p.attributes.POSITION), N = p.attributes.NORMAL != null ? acc(p.attributes.NORMAL) : null, U = p.attributes.TEXCOORD_0 != null ? acc(p.attributes.TEXCOORD_0) : new Float32Array(P.length / 3 * 2);
      const idx = p.indices != null ? acc(p.indices, true) : Uint32Array.from({ length:P.length / 3 }, (_, i) => i), pos = new Float32Array(P.length), nrm = new Float32Array(P.length);
      for(let i = 0; i < P.length; i += 3){ const x = P[i], y = P[i + 1], z = P[i + 2]; pos[i] = W[0] * x + W[4] * y + W[8] * z + W[12]; pos[i + 1] = W[1] * x + W[5] * y + W[9] * z + W[13]; pos[i + 2] = W[2] * x + W[6] * y + W[10] * z + W[14];
        if(N){ const a = N[i], b2 = N[i + 1], c = N[i + 2], nx = W[0] * a + W[4] * b2 + W[8] * c, ny = W[1] * a + W[5] * b2 + W[9] * c, nz = W[2] * a + W[6] * b2 + W[10] * c, l = Math.hypot(nx, ny, nz) || 1; nrm[i] = nx / l; nrm[i + 1] = ny / l; nrm[i + 2] = nz / l; } }
      prims.push({ pos, nrm, uv:U, idx, mat:p.material ?? 0, hasN:!!N }); }
    for(const c of n.children || []) walk(c, W); };
  for(const r of j.scenes[j.scene || 0].nodes) walk(r, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const image = ti => { if(ti == null) return null; const im = j.images[j.textures[ti].source], v = j.bufferViews[im.bufferView]; return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };
  return { j, prims, image }; }

// ---------- the blade's own frame ----------
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], unit = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
// the largest eigenvector of a symmetric 3×3 (power iteration), after removing the ones in `not`
function eig(Cm, not = []){ let v = [0.31, 0.57, 0.76]; for(let it = 0; it < 200; it++){ for(const n of not){ const d = dot(v, n); v = v.map((x, i) => x - n[i] * d); } v = unit([Cm[0] * v[0] + Cm[1] * v[1] + Cm[2] * v[2], Cm[1] * v[0] + Cm[3] * v[1] + Cm[4] * v[2], Cm[2] * v[0] + Cm[4] * v[1] + Cm[5] * v[2]]); } for(const n of not){ const d = dot(v, n); v = v.map((x, i) => x - n[i] * d); } return unit(v); }
function frameOf(prims, S){ let n = 0; const c = [0, 0, 0]; for(const p of prims) for(let i = 0; i < p.pos.length; i += 3){ c[0] += p.pos[i]; c[1] += p.pos[i + 1]; c[2] += p.pos[i + 2]; n++; } c.forEach((v, i) => { c[i] = v / n; });
  const Cm = [0, 0, 0, 0, 0, 0]; for(const p of prims) for(let i = 0; i < p.pos.length; i += 3){ const x = p.pos[i] - c[0], y = p.pos[i + 1] - c[1], z = p.pos[i + 2] - c[2]; Cm[0] += x * x; Cm[1] += x * y; Cm[2] += x * z; Cm[3] += y * y; Cm[4] += y * z; Cm[5] += z * z; }
  let Z = eig(Cm), Y = eig(Cm, [Z]), o = c.slice();
  const ext = (ax, org) => { let lo = Infinity, hi = -Infinity; for(const p of prims) for(let i = 0; i < p.pos.length; i += 3){ const d = (p.pos[i] - org[0]) * ax[0] + (p.pos[i + 1] - org[1]) * ax[1] + (p.pos[i + 2] - org[2]) * ax[2]; if(d < lo) lo = d; if(d > hi) hi = d; } return [lo, hi]; };
  // the wider end is the tip: +Z goes there
  const wide = (z0, z1) => { let lo = Infinity, hi = -Infinity; for(const p of prims) for(let i = 0; i < p.pos.length; i += 3){ const r = [p.pos[i] - o[0], p.pos[i + 1] - o[1], p.pos[i + 2] - o[2]], d = dot(r, Z); if(d < z0 || d > z1) continue; const w = dot(r, Y); if(w < lo) lo = w; if(w > hi) hi = w; } return hi - lo; };
  { const [a, b] = ext(Z, o), L = b - a; if(wide(a, a + 0.3 * L) > wide(b - 0.3 * L, b)) Z = Z.map(v => -v); }
  // the centre line: through the shaft's own cross-section centres (twice: the first pass's slices lie a little askew)
  for(let pass = 0; pass < 2; pass++){ const [a, b] = ext(Z, o), L = b - a, X = cross(Y, Z), NB = 24, B = Array.from({ length:NB }, () => [Infinity, -Infinity, Infinity, -Infinity, 0]);
    for(const p of prims) for(let i = 0; i < p.pos.length; i += 3){ const r = [p.pos[i] - o[0], p.pos[i + 1] - o[1], p.pos[i + 2] - o[2]], s = (dot(r, Z) - a) / L; if(s < S.shaft[0] || s >= S.shaft[1]) continue; const k = Math.min(NB - 1, Math.floor((s - S.shaft[0]) / (S.shaft[1] - S.shaft[0]) * NB)), e = B[k], x = dot(r, X), y = dot(r, Y); e[0] = Math.min(e[0], x); e[1] = Math.max(e[1], x); e[2] = Math.min(e[2], y); e[3] = Math.max(e[3], y); e[4]++; }
    const pts = []; B.forEach((e, k) => { if(e[4] > 2) pts.push([a + (S.shaft[0] + (k + 0.5) / NB * (S.shaft[1] - S.shaft[0])) * L, (e[0] + e[1]) / 2, (e[2] + e[3]) / 2]); }); if(pts.length < 2) break;
    const mz = pts.reduce((s, q) => s + q[0], 0) / pts.length, mx = pts.reduce((s, q) => s + q[1], 0) / pts.length, my = pts.reduce((s, q) => s + q[2], 0) / pts.length; let szz = 0, szx = 0, szy = 0; for(const q of pts){ szz += (q[0] - mz) ** 2; szx += (q[0] - mz) * (q[1] - mx); szy += (q[0] - mz) * (q[2] - my); }
    const kx = szx / szz, ky = szy / szz, nz = unit([Z[0] + X[0] * kx + Y[0] * ky, Z[1] + X[1] * kx + Y[1] * ky, Z[2] + X[2] * kx + Y[2] * ky]); o = [o[0] + Z[0] * mz + X[0] * mx + Y[0] * my, o[1] + Z[1] * mz + X[1] * mx + Y[1] * my, o[2] + Z[2] * mz + X[2] * mx + Y[2] * my];
    Z = nz; Y = unit(Y.map((v, i) => v - Z[i] * dot(Y, Z))); }
  if(S.edge < 0) Y = Y.map(v => -v);
  // +Y by the shape when the spec does not say: (kept explicit — spec.edge is set after a look at the picture)
  const X = cross(Y, Z), [a, b] = ext(Z, o), k = S.len / (b - a), org = [o[0] + Z[0] * (a + S.grip / k), o[1] + Z[1] * (a + S.grip / k), o[2] + Z[2] * (a + S.grip / k)];
  return { X, Y, Z, org, k }; }
function toFrame(prims, F){ for(const p of prims){ for(let i = 0; i < p.pos.length; i += 3){ const r = [p.pos[i] - F.org[0], p.pos[i + 1] - F.org[1], p.pos[i + 2] - F.org[2]]; p.pos[i] = dot(r, F.X) * F.k; p.pos[i + 1] = dot(r, F.Y) * F.k; p.pos[i + 2] = dot(r, F.Z) * F.k;
      const n = [p.nrm[i], p.nrm[i + 1], p.nrm[i + 2]]; p.nrm[i] = dot(n, F.X); p.nrm[i + 1] = dot(n, F.Y); p.nrm[i + 2] = dot(n, F.Z); } } }

// ---------- welds (as tools/scene-import.mjs) ----------
function weld(pos, nrm, uv, index){ const n = index.length, P = new Uint32Array(pos.buffer, pos.byteOffset, pos.length), N = new Uint32Array(nrm.buffer, nrm.byteOffset, nrm.length), U = new Uint32Array(uv.buffer, uv.byteOffset, uv.length);
  let cap = 1; while(cap < n * 2) cap *= 2; const tab = new Int32Array(cap).fill(-1), map = new Int32Array(n), first = new Int32Array(n); let u = 0; const w = (c, k) => k < 3 ? P[c * 3 + k] : k < 6 ? N[c * 3 + k - 3] : U[c * 2 + k - 6];
  for(let i = 0; i < n; i++){ const c = index[i]; let h = 2166136261; for(let k = 0; k < 8; k++) h = Math.imul(h ^ w(c, k), 16777619); let s = (h >>> 0) & (cap - 1);
    for(;;){ const e = tab[s]; if(e < 0){ tab[s] = u; first[u] = c; map[i] = u++; break; } const d = first[e]; let same = true; for(let k = 0; k < 8 && same; k++) same = w(c, k) === w(d, k); if(same){ map[i] = e; break; } s = (s + 1) & (cap - 1); } }
  const p = new Float32Array(u * 3), q = new Float32Array(u * 3), t = new Float32Array(u * 2); for(let v = 0; v < u; v++){ const c = first[v]; p.set(pos.subarray(c * 3, c * 3 + 3), v * 3); q.set(nrm.subarray(c * 3, c * 3 + 3), v * 3); t.set(uv.subarray(c * 2, c * 2 + 2), v * 2); }
  return { pos:p, nrm:q, uv:t, idx:Uint32Array.from(map) }; }
function weldPos(pos, idx, snap){ const n = pos.length / 3, Q = new Int32Array(n * 3); for(let i = 0; i < n * 3; i++) Q[i] = Math.round(pos[i] / snap); let cap = 1; while(cap < n * 2) cap *= 2; const tab = new Int32Array(cap).fill(-1), first = new Int32Array(n), map = new Int32Array(n); let u = 0;
  for(let v = 0; v < n; v++){ let h = 2166136261; for(let k = 0; k < 3; k++) h = Math.imul(h ^ Q[v * 3 + k], 16777619); let s = (h >>> 0) & (cap - 1);
    for(;;){ const e = tab[s]; if(e < 0){ tab[s] = u; first[u] = v; map[v] = u++; break; } const d = first[e]; if(Q[d * 3] === Q[v * 3] && Q[d * 3 + 1] === Q[v * 3 + 1] && Q[d * 3 + 2] === Q[v * 3 + 2]){ map[v] = e; break; } s = (s + 1) & (cap - 1); } }
  const p = new Float32Array(u * 3); for(let w = 0; w < u; w++) p.set(pos.subarray(first[w] * 3, first[w] * 3 + 3), w * 3); const I = []; for(let i = 0; i < idx.length; i += 3){ const a = map[idx[i]], b = map[idx[i + 1]], c = map[idx[i + 2]]; if(a !== b && b !== c && a !== c) I.push(a, b, c); }
  return { pos:p, idx:Uint32Array.from(I) }; }
function faceNormals(pos, idx){ const N = new Float32Array(pos.length); for(let t = 0; t < idx.length; t += 3){ const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3, ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2], x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx; for(const v of [a, b, c]){ N[v] += x; N[v + 1] += y; N[v + 2] += z; } }
  for(let v = 0; v < N.length; v += 3){ const l = Math.hypot(N[v], N[v + 1], N[v + 2]) || 1; N[v] /= l; N[v + 1] /= l; N[v + 2] /= l; } return N; }

// ---------- one GLB: a single mesh, one material, plain floats ----------
function writeGlb(file, G, T, name){ const parts = [], views = []; let off = 0; const nv = G.pos.length / 3;
  const view = (buf, target) => { const pad = (4 - off % 4) % 4; if(pad){ parts.push(Buffer.alloc(pad)); off += pad; } views.push({ buffer:0, byteOffset:off, byteLength:buf.length, ...(target ? { target } : {}) }); parts.push(buf); off += buf.length; return views.length - 1; };
  const B = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength), small = nv < 65536, I = small ? Uint16Array.from(G.idx) : G.idx, mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for(let i = 0; i < G.pos.length; i++){ mn[i % 3] = Math.min(mn[i % 3], G.pos[i]); mx[i % 3] = Math.max(mx[i % 3], G.pos[i]); }
  const acc = [{ bufferView:view(B(G.pos), 34962), componentType:5126, count:nv, type:'VEC3', min:mn, max:mx }, { bufferView:view(B(G.nrm), 34962), componentType:5126, count:nv, type:'VEC3' }, { bufferView:view(B(G.uv), 34962), componentType:5126, count:nv, type:'VEC2' }, { bufferView:view(B(I), 34963), componentType:small ? 5123 : 5125, count:I.length, type:'SCALAR' }];
  const images = [], textures = [], tex = f => { if(!f) return undefined; images.push({ bufferView:view(fs.readFileSync(f)), mimeType:'image/jpeg' }); textures.push({ sampler:0, source:images.length - 1 }); return { index:textures.length - 1 }; };
  const mat = { name, pbrMetallicRoughness:{ baseColorTexture:tex(T.color), metallicRoughnessTexture:tex(T.mr), metallicFactor:T.mr ? 1 : 0.6, roughnessFactor:T.mr ? 1 : 0.5 }, normalTexture:tex(T.normal) };
  const bin = Buffer.concat(parts), binP = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]);
  const json = { asset:{ version:'2.0', generator:'tank-shooter tools/blade-pack.mjs', copyright:T.credit }, scene:0, scenes:[{ nodes:[0] }], nodes:[{ name, mesh:0 }], meshes:[{ name, primitives:[{ attributes:{ POSITION:0, NORMAL:1, TEXCOORD_0:2 }, indices:3, material:0 }] }],
    materials:[mat], accessors:acc, bufferViews:views, buffers:[{ byteLength:binP.length }], samplers:[{ magFilter:9729, minFilter:9987, wrapS:10497, wrapT:10497 }], textures, images };
  const js = Buffer.from(JSON.stringify(json)), jsP = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]), head = Buffer.alloc(12), c0 = Buffer.alloc(8), c1 = Buffer.alloc(8);
  head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jsP.length + 8 + binP.length, 8); c0.writeUInt32LE(jsP.length, 0); c0.writeUInt32LE(0x4E4F534A, 4); c1.writeUInt32LE(binP.length, 0); c1.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(file, Buffer.concat([head, c0, jsP, c1, binP])); return { tris:G.idx.length / 3, verts:nv, bytes:fs.statSync(file).size }; }

// ---------- the numbers config wants: the ends, the blade's root, how wide it is, where its weight sits (surface area, the blade's steel counted double) ----------
function measure(G, S){ let z0 = Infinity, z1 = -Infinity, yE = -Infinity, yB = Infinity, zE = 0, m = 0, cz = 0, cy = 0; const P = G.pos, I = G.idx, zb = -S.grip + S.blade * S.len;
  for(let i = 0; i < P.length; i += 3){ const y = P[i + 1], z = P[i + 2]; if(z < z0) z0 = z; if(z > z1) z1 = z; if(z > zb){ if(y > yE){ yE = y; zE = z; } if(y < yB) yB = y; } }
  for(let t = 0; t < I.length; t += 3){ const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3, ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2], z = (P[a + 2] + P[b + 2] + P[c + 2]) / 3, ar = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2 * (z > zb ? 2 : 1); m += ar; cz += ar * z; cy += ar * (P[a + 1] + P[b + 1] + P[c + 1]) / 3; }
  const r = v => +v.toFixed(3); return { len:r(z1 - z0), butt:r(z0), tip:r(z1), root:r(zb), edge:r(yE), edgeAt:r(zE), back:r(yB), com:[r(cy / m), r(cz / m)] }; }

// ---------- main ----------
const argv = process.argv.slice(2), opt = {}, ids = []; for(let i = 0; i < argv.length; i++){ const a = argv[i]; if(a.startsWith('--')) opt[a.slice(2)] = argv[++i]; else ids.push(a); }
if(!opt.src || !opt.deps){ console.error('usage: node tools/blade-pack.mjs [id …] --src <dir> --deps <dir> [--work <dir>] [--out <dir>]'); process.exit(2); }
const req = createRequire(path.resolve(opt.deps, 'package.json')), sharp = req('sharp'), OUT = path.resolve(opt.out || path.join(ROOT, 'assets', 'models', 'real', 'blade')), WORK = path.resolve(opt.work || path.join(OUT, '.work')); fs.mkdirSync(OUT, { recursive:true }); fs.mkdirSync(WORK, { recursive:true });
for(const id of ids.length ? ids : Object.keys(SPEC)){ const S = SPEC[id]; if(!S){ console.error('no spec for', id); process.exitCode = 1; continue; }
  const { j, prims, image } = readGlb(path.join(path.resolve(opt.src), S.src)), F = frameOf(prims, S); toFrame(prims, F);
  for(const p of prims) if(!p.hasN) p.nrm = faceNormals(p.pos, p.idx);
  // the source's materials on one sheet: a grid of cells, one per distinct set of maps; each primitive's UVs moved into its cell
  const sets = [], cellOf = {}; for(const [mi, m] of (j.materials || [{}]).entries()){ const pm = m.pbrMetallicRoughness || {}, key = [pm.baseColorTexture?.index, pm.metallicRoughnessTexture?.index, m.normalTexture?.index].join('/'); let k = sets.findIndex(s => s.key === key);
    if(k < 0){ k = sets.length; sets.push({ key, color:image(pm.baseColorTexture?.index), mr:image(pm.metallicRoughnessTexture?.index), normal:image(m.normalTexture?.index), bc:pm.baseColorFactor || [1, 1, 1, 1], mf:pm.metallicFactor ?? 1, rf:pm.roughnessFactor ?? 1 }); } cellOf[mi] = k; }
  const n = Math.ceil(Math.sqrt(sets.length)), cell = n > 1 ? Math.floor(4096 / n) : 0, T = { credit:S.credit }, file = (k, e) => path.join(WORK, id + '-' + k + '.' + e);
  const flat = (rgb, px) => sharp({ create:{ width:px, height:px, channels:3, background:{ r:rgb[0], g:rgb[1], b:rgb[2] } } }).png().toBuffer();
  if(n > 1){ const sheet = async (k, fill) => { const comp = []; for(const [i, s] of sets.entries()) comp.push({ input:await (s[k] ? sharp(s[k]).resize(cell, cell, { fit:'fill' }).removeAlpha().png().toBuffer() : flat(fill(s), cell)), left:(i % n) * cell, top:Math.floor(i / n) * cell });
        await sharp({ create:{ width:n * cell, height:n * cell, channels:3, background:{ r:128, g:128, b:128 } } }).composite(comp).png().toFile(file('src-' + k, 'png')); return file('src-' + k, 'png'); };
    T.srcColor = await sheet('color', s => s.bc.slice(0, 3).map(v => Math.round(255 * Math.pow(v, 1 / 2.2)))); T.srcNormal = await sheet('normal', () => [128, 128, 255]); T.srcMr = await sheet('mr', s => [255, Math.round(255 * s.rf), Math.round(255 * s.mf)]);
    const e = 0.75 / cell; for(const p of prims){ const c = cellOf[p.mat], cx = c % n, cy = Math.floor(c / n); for(let i = 0; i < p.uv.length; i += 2){ p.uv[i] = (cx + Math.min(1 - e, Math.max(e, p.uv[i] - Math.floor(p.uv[i])))) / n; p.uv[i + 1] = (cy + Math.min(1 - e, Math.max(e, p.uv[i + 1] - Math.floor(p.uv[i + 1])))) / n; } } }
  else { const s = sets[0]; for(const k of ['color', 'normal', 'mr']) if(s[k]){ fs.writeFileSync(file('src-' + k, 'png'), await sharp(s[k]).removeAlpha().png().toBuffer()); T['src' + k[0].toUpperCase() + k.slice(1)] = file('src-' + k, 'png'); } }
  // one welded mesh
  let nv = 0, ni = 0; for(const p of prims){ nv += p.pos.length / 3; ni += p.idx.length; } const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni); let vo = 0, io = 0;
  for(const p of prims){ pos.set(p.pos, vo * 3); nrm.set(p.nrm, vo * 3); uv.set(p.uv, vo * 2); for(let i = 0; i < p.idx.length; i++) idx[io + i] = p.idx[i] + vo; vo += p.pos.length / 3; io += p.idx.length; }
  const hi = weld(pos, nrm, uv, idx); let G = hi, baked = null;
  const jpg = async (src, k, size, q) => { if(!src) return null; await sharp(src).resize(size, size, { fit:'fill', kernel:'lanczos3' }).jpeg({ quality:q, mozjpeg:true }).toFile(file(k, 'jpg')); return file(k, 'jpg'); };
  if(S.tris && hi.idx.length / 3 > S.tris){ const { MeshoptSimplifier:MS } = await import(pathToFileURL(path.join(path.resolve(opt.deps), 'node_modules', 'meshoptimizer', 'meshopt_simplifier.module.js')).href); await MS.ready;
    const PW = weldPos(hi.pos, hi.idx, 2e-5), want = S.tris * 3; let [lo, err] = MS.simplify(PW.idx, PW.pos, 3, want, 0.02, []);
    if(lo.length > want * 1.15){ const sl = MS.simplifySloppy.length >= 6 ? MS.simplifySloppy(PW.idx, PW.pos, 3, null, want, 1) : MS.simplifySloppy(PW.idx, PW.pos, 3, want, 1); const l2 = Array.isArray(sl) ? sl[0] : sl; console.error('  (' + id + ': the locked cut stopped at ' + lo.length / 3 + ' triangles — sloppy cut ' + l2.length / 3 + ')'); if(l2.length >= want * 0.5) lo = l2; }
    const used = new Int32Array(PW.pos.length / 3).fill(-1), lp = [], li = new Uint32Array(lo.length); for(let i = 0; i < lo.length; i++){ let r = used[lo[i]]; if(r < 0){ r = used[lo[i]] = lp.length / 3; lp.push(PW.pos[lo[i] * 3], PW.pos[lo[i] * 3 + 1], PW.pos[lo[i] * 3 + 2]); } li[i] = r; }
    const { bakeCopy, saveMap } = await import('./scene-bake.mjs'); baked = await bakeCopy(opt.deps, hi, { pos:Float32Array.from(lp), idx:li }, { color:T.srcColor, normal:T.srcNormal, mr:T.srcMr }, S.px); G = baked.G;
    T.color = await saveMap(baked.img.color, S.px, file('color', 'jpg'), S.save[0], S.q[0]); T.normal = await saveMap(baked.img.normal, S.px, file('normal', 'jpg'), S.save[1], S.q[1]); if(baked.img.mr) T.mr = await saveMap(baked.img.mr, S.px, file('mr', 'jpg'), S.save[2], S.q[2]);
    console.error('  (' + id + ': ' + hi.idx.length / 3 + ' → ' + G.idx.length / 3 + ' triangles, error ' + (+err).toFixed(4) + ', atlas cover ' + baked.cover + ', ' + baked.s + ' s)'); }
  else { T.color = await jpg(T.srcColor, 'color', S.save[0], S.q[0]); T.normal = await jpg(T.srcNormal, 'normal', S.save[1], S.q[1]); T.mr = await jpg(T.srcMr, 'mr', S.save[2], S.q[2]); }
  const R = writeGlb(path.join(OUT, id + '.glb'), G, T, 'blade_' + id); console.log(JSON.stringify({ id, ...R, sourceTris:hi.idx.length / 3, materials:(j.materials || []).length, ...measure(G, S) })); }
