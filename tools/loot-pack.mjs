#!/usr/bin/env node
// tools/loot-pack.mjs — LOOT 1 THE LOOT PACKED (maintainer tool; the game never loads it): a downloaded model of a thing a soldier picks up (a Sketchfab GLB
//   fetched through Objaverse, or a Poly Haven glTF with its maps beside it) → assets/models/real/loot/<id>.glb: ONE material (colour · normal ·
//   roughness G + metal B, JPEG ≤ 1K), plain floats, standing on y = 0, centred on x / z, +Y up, at its REAL size in metres (spec.size: the extent of
//   one axis, or of the largest, in metres; a Poly Haven model is already metric and keeps its scale). spec.keep / spec.drop pick nodes by their path
//   of names; spec.parts names nodes that stay a mesh of their own (the crate's lid, so it can swing open): the file then holds one mesh per part, all
//   wearing the one material. Several source materials are laid side by side on one sheet first (a grid of their maps, each primitive's UVs moved into
//   its cell; a material with no maps becomes a flat cell of its colour). A heavy model (spec.tris) is simplified on its shape alone and its maps are
//   BAKED ANEW from the source (tools/scene-bake.mjs — never collapsed across UV seams); a light one keeps its own triangles and UVs.
//   node tools/loot-pack.mjs [id …] --src <dir holding <id>/…> --deps <dir> [--work <dir>] [--out <dir>]
//   (<deps>: npm i --prefix <dir> meshoptimizer@0.25.0 three@0.169.0 three-mesh-bvh@0.9.18 xatlasjs@0.2.0 sharp)
//   Prints one JSON line a model: triangles, bytes, its size [x, y, z] in metres and each part's box.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// src: the file under --src · color: 'emissive' takes the source's glow map for the colour (a stone whose own colour map is near black) · rot: degrees about x, y, z (applied in that order) to stand it up · size: [axis 'x'|'y'|'z'|'max', metres] (none: keep the
//   source's metres) · tris: 0 keeps every triangle, else the budget of a baked copy (px its bake page) · save: colour / normal / roughness-metal sizes ·
//   q: their JPEG quality · keep / drop: regexes on the node path · parts: { name: regex } meshes kept apart · credit: written into the file
const SB = (t, a, u, l) => `"${t}" by ${a} — Sketchfab ${u} (via Objaverse) — ${l}`, PH = t => `"${t}" — Poly Haven (polyhaven.com) — CC0`;
const SPEC = {
  crate:     { src:'ph_old_military_crate/old_military_crate.gltf', keep:/_a$/, parts:{ lid:/lid_a$/ }, save:[1024, 1024, 512], q:[84, 86, 80], credit:PH('Old Military Crate') },
  riflebox:  { src:'riflebox/riflebox.glb', size:['max', 1.18], save:[1024, 1024, 512], q:[84, 86, 80], credit:SB('Rifle Box (Low Poly)', 'Berk Gedik', 'aaa6d521741944359a6b5a6b67a0bee7', 'CC BY 4.0') },
  chute:     { src:'chute/chute.glb', size:['y', 3.4], tris:5000, px:1024, save:[512, 512, 256], q:[82, 84, 78], credit:SB('Army Parachute', 'amaraklov', 'af52e08feebc4d94a244692212ac25bb', 'CC BY 4.0') },
  ammo:      { src:'ph_ammo_box/ammo_box.gltf', save:[512, 512, 256], q:[86, 86, 80], credit:PH('Ammo Box') },
  medkit:    { src:'medkit/medkit.glb', size:['max', 0.24], save:[512, 512, 256], q:[86, 86, 80], credit:SB('Tactical FIRST AID KIT', 'Ruslan Koschey', '011c33c121284bc88bb765a85511dae1', 'CC BY 4.0') },
  grenade:   { src:'grenade/grenade.glb', size:['y', 0.117], save:[256, 256, 256], q:[88, 88, 84], credit:SB('Low-Poly F1 Hand Grenade', 'TastyTony', 'dc4f4797dea64bcb9e6bc609a8fbfbaf', 'CC BY 4.0') },
  nadecrate: { src:'nadecrate/nadecrate.glb', size:['max', 0.56], save:[512, 512, 256], q:[86, 86, 80], credit:SB('Military style grenade crate', 'Sousinho', '702157b863c24bc68591a5e989540c7d', 'CC BY 4.0') },
  smoke:     { src:'smoke/smoke.glb', keep:/PainterExport_SmokeGrenade_0$/, size:['y', 0.145], save:[512, 512, 256], q:[86, 86, 80], credit:SB('M18 Smoke Grenade', 'Vanillatography', '46343925ad0e47cf927e66da7953c372', 'CC BY 4.0') },
  vest:      { src:'vest/vest.glb', size:['y', 0.52], tris:5000, px:1024, save:[512, 512, 256], q:[84, 86, 80], credit:SB('Combat Vest', 'csheffield', 'ce92c014efd140deb6e918b3c59bf539', 'CC BY 4.0') },
  toolbox:   { src:'ph_metal_toolbox/metal_toolbox.gltf', tris:3000, px:1024, save:[512, 512, 256], q:[86, 86, 80], credit:PH('Metal Toolbox') },
  radio:     { src:'ph_vintage_radio_transceiver/vintage_radio_transceiver.gltf', drop:/morse|cable|microphone|antenna/, tris:4000, px:1024, save:[512, 512, 256], q:[86, 86, 80], credit:PH('Vintage Radio Transceiver') },
  binoculars:{ src:'ph_binoculars/binoculars.gltf', drop:/strap/, tris:2500, px:1024, save:[512, 512, 256], q:[86, 86, 80], credit:PH('Binoculars') },
  drone:     { src:'drone/drone.glb', size:['max', 0.36], save:[512, 512, 256], q:[86, 86, 80], credit:SB('Quadrocopter 2', 'yanix', '6885c5f1a68148e1b2b3a4f69b8b3d70', 'CC BY 4.0') },
  medal:     { src:'medal/medal.glb', rot:[0, 0, 90], size:['max', 0.042], tris:3000, px:1024, save:[512, 512, 256], q:[86, 86, 80], credit:SB('Medal of the Polish Legions 1914–1915–1916', 'Virtual Museums of Małopolska', '60d7351bce1e4204a5dff35873a86ac4', 'CC0') },
  round:     { src:'rounds/rounds.glb', keep:/_50bmg_low__50bmg_0$/, size:['max', 0.138], save:[256, 256, 256], q:[88, 88, 84], credit:SB('Assorted cartridges', 'kirikom9000', '5bbe41ff8c7942899a24a6c8b33590ba', 'CC BY 4.0') },
  rounds:    { src:'rounds/rounds.glb', keep:/_(762NATO|308Win|3006Spr|556NATO)_low__\w+_0$/, size:['y', 0.085], save:[512, 512, 256], q:[86, 86, 80], credit:SB('Assorted cartridges', 'kirikom9000', '5bbe41ff8c7942899a24a6c8b33590ba', 'CC BY 4.0') },
  altar:     { src:'altar/altar.glb', size:['max', 4.4], save:[1024, 1024, 512], q:[84, 86, 80], credit:SB('Stone Altar', 'TheoClarke', '3d4f2edb18e4424cabb41b60aa160cb5', 'CC BY 4.0') },
  crystal:   { src:'crystal/crystal.glb', color:'emissive', size:['y', 1.7], save:[512, 512, 256], q:[86, 86, 80], credit:SB('Magic Stone', 'Zambur', '0c03bd90e6d44cfb95d942376f27797b', 'CC BY 4.0') },
};

// ---------- a GLB or a glTF (its buffers and maps in files beside it) flattened: every primitive in the scene's frame, with its node path ----------
const mul = (a, b) => { const o = new Array(16).fill(0); for(let c = 0; c < 4; c++) for(let r = 0; r < 4; r++){ let s = 0; for(let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
const trs = n => { if(n.matrix) return n.matrix; const t = n.translation || [0, 0, 0], [x, y, z, w] = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1];
  return [(1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0, 2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0, 2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0, t[0], t[1], t[2], 1]; };
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function readModel(file){ let j, bufs; const dir = path.dirname(file);
  if(file.endsWith('.glb')){ const b = fs.readFileSync(file), jl = b.readUInt32LE(12); j = JSON.parse(b.subarray(20, 20 + jl).toString()); bufs = [b.subarray(20 + jl + 8)]; }
  else { j = JSON.parse(fs.readFileSync(file, 'utf8')); bufs = j.buffers.map(B => fs.readFileSync(path.join(dir, decodeURIComponent(B.uri)))); }
  const SZ = { 5120:1, 5121:1, 5122:2, 5123:2, 5125:4, 5126:4 }, RD = { 5120:'getInt8', 5121:'getUint8', 5122:'getInt16', 5123:'getUint16', 5125:'getUint32', 5126:'getFloat32' }, NC = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4 }, NORM = { 5120:127, 5121:255, 5122:32767, 5123:65535 };
  const acc = (i, ints) => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], bin = bufs[v.buffer || 0], dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength), sz = SZ[a.componentType], nc = NC[a.type], st = v.byteStride || sz * nc, o0 = (v.byteOffset || 0) + (a.byteOffset || 0), out = new (ints ? Uint32Array : Float32Array)(a.count * nc), k = a.normalized ? NORM[a.componentType] : 0;
    for(let e = 0; e < a.count; e++) for(let c = 0; c < nc; c++){ const x = dv[RD[a.componentType]](o0 + e * st + c * sz, true); out[e * nc + c] = k ? x / k : x; } return out; };
  const prims = [], walk = (ni, M, P) => { const n = j.nodes[ni], W = mul(M, trs(n)), name = P + '/' + (n.name || ni), Wm = n.skin != null ? I4 : W;   // (a skinned mesh in its bind pose sits in the scene's frame)
    if(n.mesh != null) for(const p of j.meshes[n.mesh].primitives){ if(p.mode != null && p.mode !== 4) continue; const Pp = acc(p.attributes.POSITION), N = p.attributes.NORMAL != null ? acc(p.attributes.NORMAL) : null, U = p.attributes.TEXCOORD_0 != null ? acc(p.attributes.TEXCOORD_0) : new Float32Array(Pp.length / 3 * 2);
      const idx = p.indices != null ? acc(p.indices, true) : Uint32Array.from({ length:Pp.length / 3 }, (_, i) => i), pos = new Float32Array(Pp.length), nrm = new Float32Array(Pp.length), X = Wm;
      for(let i = 0; i < Pp.length; i += 3){ const x = Pp[i], y = Pp[i + 1], z = Pp[i + 2]; pos[i] = X[0] * x + X[4] * y + X[8] * z + X[12]; pos[i + 1] = X[1] * x + X[5] * y + X[9] * z + X[13]; pos[i + 2] = X[2] * x + X[6] * y + X[10] * z + X[14];
        if(N){ const a = N[i], b2 = N[i + 1], c = N[i + 2], nx = X[0] * a + X[4] * b2 + X[8] * c, ny = X[1] * a + X[5] * b2 + X[9] * c, nz = X[2] * a + X[6] * b2 + X[10] * c, l = Math.hypot(nx, ny, nz) || 1; nrm[i] = nx / l; nrm[i + 1] = ny / l; nrm[i + 2] = nz / l; } }
      const det = X[0] * (X[5] * X[10] - X[9] * X[6]) - X[4] * (X[1] * X[10] - X[9] * X[2]) + X[8] * (X[1] * X[6] - X[5] * X[2]); if(det < 0) for(let t = 0; t < idx.length; t += 3){ const q = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = q; }   // (a mirrored node keeps its faces outward)
      prims.push({ name, pos, nrm, uv:U, idx, mat:p.material ?? 0, hasN:!!N }); }
    for(const c of n.children || []) walk(c, W, name); };
  for(const r of j.scenes[j.scene || 0].nodes) walk(r, I4, '');
  const image = ti => { if(ti == null) return null; const im = j.images[j.textures[ti].source]; if(im.uri) return fs.readFileSync(path.join(dir, decodeURIComponent(im.uri)));
    const v = j.bufferViews[im.bufferView], bin = bufs[v.buffer || 0]; return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };
  return { j, prims, image }; }

// ---------- stood up, centred, at its real size ----------
function place(prims, S){ const [ax, ay, az] = (S.rot || [0, 0, 0]).map(d => d * Math.PI / 180), R = (x, y, z) => { let a = y * Math.cos(ax) - z * Math.sin(ax), b = y * Math.sin(ax) + z * Math.cos(ax); y = a; z = b;
    a = x * Math.cos(ay) + z * Math.sin(ay); b = -x * Math.sin(ay) + z * Math.cos(ay); x = a; z = b; a = x * Math.cos(az) - y * Math.sin(az); b = x * Math.sin(az) + y * Math.cos(az); return [a, b, z]; };
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for(const p of prims) for(let i = 0; i < p.pos.length; i += 3){ const q = R(p.pos[i], p.pos[i + 1], p.pos[i + 2]), n = R(p.nrm[i], p.nrm[i + 1], p.nrm[i + 2]); for(let a = 0; a < 3; a++){ p.pos[i + a] = q[a]; p.nrm[i + a] = n[a]; mn[a] = Math.min(mn[a], q[a]); mx[a] = Math.max(mx[a], q[a]); } }
  const ext = [0, 1, 2].map(a => mx[a] - mn[a]), k = S.size ? S.size[1] / (S.size[0] === 'max' ? Math.max(...ext) : ext['xyz'.indexOf(S.size[0])]) : 1, c = [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2];
  for(const p of prims) for(let i = 0; i < p.pos.length; i += 3) for(let a = 0; a < 3; a++) p.pos[i + a] = (p.pos[i + a] - c[a]) * k; }

// ---------- welds (as tools/blade-pack.mjs) ----------
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
function faceNormals(pos, idx){ const N = new Float32Array(pos.length); for(let t = 0; t < idx.length; t += 3){ const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3, ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2], x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    for(const v of [a, b, c]){ N[v] += x; N[v + 1] += y; N[v + 2] += z; } }
  for(let v = 0; v < N.length; v += 3){ const l = Math.hypot(N[v], N[v + 1], N[v + 2]) || 1; N[v] /= l; N[v + 1] /= l; N[v + 2] /= l; } return N; }
function merge(prims){ let nv = 0, ni = 0; for(const p of prims){ nv += p.pos.length / 3; ni += p.idx.length; } const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni); let vo = 0, io = 0;
  for(const p of prims){ pos.set(p.pos, vo * 3); nrm.set(p.nrm, vo * 3); uv.set(p.uv, vo * 2); for(let i = 0; i < p.idx.length; i++) idx[io + i] = p.idx[i] + vo; vo += p.pos.length / 3; io += p.idx.length; }
  return weld(pos, nrm, uv, idx); }

// ---------- one GLB: a mesh per part, one material, plain floats ----------
function writeGlb(file, parts, T, name){ const views = [], chunks = []; let off = 0, acc = [];
  const view = (buf, target) => { const pad = (4 - off % 4) % 4; if(pad){ chunks.push(Buffer.alloc(pad)); off += pad; } views.push({ buffer:0, byteOffset:off, byteLength:buf.length, ...(target ? { target } : {}) }); chunks.push(buf); off += buf.length; return views.length - 1; };
  const B = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength), meshes = [], nodes = []; let tris = 0, verts = 0;
  for(const [pn, G] of parts){ const nv = G.pos.length / 3, I = nv < 65536 ? Uint16Array.from(G.idx) : G.idx, mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for(let i = 0; i < G.pos.length; i++){ mn[i % 3] = Math.min(mn[i % 3], G.pos[i]); mx[i % 3] = Math.max(mx[i % 3], G.pos[i]); }
    const a0 = acc.length; acc.push({ bufferView:view(B(G.pos), 34962), componentType:5126, count:nv, type:'VEC3', min:mn, max:mx }, { bufferView:view(B(G.nrm), 34962), componentType:5126, count:nv, type:'VEC3' }, { bufferView:view(B(G.uv), 34962), componentType:5126, count:nv, type:'VEC2' }, { bufferView:view(B(I), 34963), componentType:nv < 65536 ? 5123 : 5125, count:I.length, type:'SCALAR' });
    meshes.push({ name:name + '_' + pn, primitives:[{ attributes:{ POSITION:a0, NORMAL:a0 + 1, TEXCOORD_0:a0 + 2 }, indices:a0 + 3, material:0 }] }); nodes.push({ name:pn, mesh:meshes.length - 1 }); tris += G.idx.length / 3; verts += nv; }
  const images = [], textures = [], tex = f => { if(!f) return undefined; images.push({ bufferView:view(fs.readFileSync(f)), mimeType:'image/jpeg' }); textures.push({ sampler:0, source:images.length - 1 }); return { index:textures.length - 1 }; };
  const mat = { name, pbrMetallicRoughness:{ baseColorTexture:tex(T.color), metallicRoughnessTexture:tex(T.mr), metallicFactor:T.mr ? 1 : 0, roughnessFactor:T.mr ? 1 : 0.7 }, normalTexture:tex(T.normal) };
  const bin = Buffer.concat(chunks), binP = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]);
  const json = { asset:{ version:'2.0', generator:'tank-shooter tools/loot-pack.mjs', copyright:T.credit }, scene:0, scenes:[{ nodes:nodes.map((_, i) => i) }], nodes, meshes,
    materials:[mat], accessors:acc, bufferViews:views, buffers:[{ byteLength:binP.length }], samplers:[{ magFilter:9729, minFilter:9987, wrapS:10497, wrapT:10497 }], textures, images };
  const js = Buffer.from(JSON.stringify(json)), jsP = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]), head = Buffer.alloc(12), c0 = Buffer.alloc(8), c1 = Buffer.alloc(8);
  head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jsP.length + 8 + binP.length, 8); c0.writeUInt32LE(jsP.length, 0); c0.writeUInt32LE(0x4E4F534A, 4); c1.writeUInt32LE(binP.length, 0); c1.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(file, Buffer.concat([head, c0, jsP, c1, binP])); return { tris, verts, bytes:fs.statSync(file).size }; }
const box = G => { const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for(let i = 0; i < G.pos.length; i++){ mn[i % 3] = Math.min(mn[i % 3], G.pos[i]); mx[i % 3] = Math.max(mx[i % 3], G.pos[i]); } const r = v => +v.toFixed(3); return { min:mn.map(r), max:mx.map(r) }; };

// ---------- main ----------
const argv = process.argv.slice(2), opt = {}, ids = []; for(let i = 0; i < argv.length; i++){ const a = argv[i]; if(a.startsWith('--')) opt[a.slice(2)] = argv[++i]; else ids.push(a); }
if(!opt.src || !opt.deps){ console.error('usage: node tools/loot-pack.mjs [id …] --src <dir> --deps <dir> [--work <dir>] [--out <dir>]'); process.exit(2); }
const req = createRequire(path.resolve(opt.deps, 'package.json')), sharp = req('sharp'), OUT = path.resolve(opt.out || path.join(ROOT, 'assets', 'models', 'real', 'loot')), WORK = path.resolve(opt.work || path.join(OUT, '.work')); fs.mkdirSync(OUT, { recursive:true }); fs.mkdirSync(WORK, { recursive:true });
for(const id of ids.length ? ids : Object.keys(SPEC)){ const S = SPEC[id]; if(!S){ console.error('no spec for', id); process.exitCode = 1; continue; }
  const M = readModel(path.join(path.resolve(opt.src), S.src)), j = M.j, prims = M.prims.filter(p => (!S.keep || S.keep.test(p.name.split('/').filter(Boolean).slice(-2).join('/')) || S.keep.test(p.name)) && !(S.drop && S.drop.test(p.name)));
  if(!prims.length){ console.error(id + ': no node left after keep / drop'); process.exitCode = 1; continue; }
  place(prims, S); for(const p of prims) if(!p.hasN) p.nrm = faceNormals(p.pos, p.idx);
  // the source's materials on one sheet (as tools/blade-pack.mjs): a grid of cells, one per distinct set of maps / colour; each primitive's UVs moved into its cell
  const used = [...new Set(prims.map(p => p.mat))], sets = [], cellOf = {};
  for(const mi of used){ const m = (j.materials || [])[mi] || {}, pm = m.pbrMetallicRoughness || {}, key = [pm.baseColorTexture?.index, pm.metallicRoughnessTexture?.index, m.normalTexture?.index, pm.baseColorTexture ? '' : (pm.baseColorFactor || []).join()].join('/'); let k = sets.findIndex(s => s.key === key);
    if(k < 0){ k = sets.length; sets.push({ key, color:M.image(S.color === 'emissive' ? m.emissiveTexture?.index : pm.baseColorTexture?.index), mr:M.image(pm.metallicRoughnessTexture?.index), normal:M.image(m.normalTexture?.index), bc:pm.baseColorFactor || [1, 1, 1, 1], mf:pm.metallicFactor ?? 1, rf:pm.roughnessFactor ?? 1 }); } cellOf[mi] = k; }
  const n = Math.ceil(Math.sqrt(sets.length)), cell = n > 1 ? Math.floor(2048 / n) : 0, T = { credit:S.credit }, file = (k, e) => path.join(WORK, id + '-' + k + '.' + e);
  const flat = (rgb, px) => sharp({ create:{ width:px, height:px, channels:3, background:{ r:rgb[0], g:rgb[1], b:rgb[2] } } }).png().toBuffer(), srgb = s => s.bc.slice(0, 3).map(v => Math.round(255 * Math.pow(v, 1 / 2.2)));
  if(n > 1 || !sets[0].color){ const N = Math.max(1, n), C = n > 1 ? cell : 256, sheet = async (k, fill) => { const comp = []; for(const [i, s] of sets.entries()) comp.push({ input:await (s[k] ? sharp(s[k]).resize(C, C, { fit:'fill' }).removeAlpha().png().toBuffer() : flat(fill(s), C)), left:(i % N) * C, top:Math.floor(i / N) * C });
        await sharp({ create:{ width:N * C, height:N * C, channels:3, background:{ r:128, g:128, b:128 } } }).composite(comp).png().toFile(file('src-' + k, 'png')); return file('src-' + k, 'png'); };
    T.srcColor = await sheet('color', srgb); T.srcNormal = await sheet('normal', () => [128, 128, 255]); T.srcMr = await sheet('mr', s => [255, Math.round(255 * s.rf), Math.round(255 * s.mf)]);
    if(n > 1 || !sets[0].color){ const e = 0.75 / C; for(const p of prims){ const c = cellOf[p.mat], cx = c % N, cy = Math.floor(c / N); for(let i = 0; i < p.uv.length; i += 2){ p.uv[i] = (cx + Math.min(1 - e, Math.max(e, p.uv[i] - Math.floor(p.uv[i])))) / N; p.uv[i + 1] = (cy + Math.min(1 - e, Math.max(e, p.uv[i + 1] - Math.floor(p.uv[i + 1])))) / N; } } } }
  else { const s = sets[0]; for(const k of ['color', 'normal', 'mr']) if(s[k]){ fs.writeFileSync(file('src-' + k, 'png'), await sharp(s[k]).removeAlpha().png().toBuffer()); T['src' + k[0].toUpperCase() + k.slice(1)] = file('src-' + k, 'png'); } }
  // the parts: each its own welded mesh (spec.parts by node path; the rest is the body)
  const groups = new Map([['body', []]]); for(const p of prims){ let pn = 'body'; for(const [k, re] of Object.entries(S.parts || {})) if(re.test(p.name)) pn = k; if(!groups.has(pn)) groups.set(pn, []); groups.get(pn).push(p); }
  let parts = [...groups].filter(([, L]) => L.length).map(([k, L]) => [k, merge(L)]); const srcTris = parts.reduce((s, [, G]) => s + G.idx.length / 3, 0);
  const jpg = async (src, k, size, q) => { if(!src) return null; await sharp(src).resize(size, size, { fit:'fill', kernel:'lanczos3' }).jpeg({ quality:q, mozjpeg:true }).toFile(file(k, 'jpg')); return file(k, 'jpg'); };
  if(S.tris && srcTris > S.tris){ if(parts.length > 1){ console.error(id + ': a baked copy keeps no parts'); process.exitCode = 1; continue; } const hi = parts[0][1];
    const { MeshoptSimplifier:MS } = await import(pathToFileURL(path.join(path.resolve(opt.deps), 'node_modules', 'meshoptimizer', 'meshopt_simplifier.module.js')).href); await MS.ready;
    const PW = weldPos(hi.pos, hi.idx, 2e-5 * Math.max(...box(hi).max.map(Math.abs), 0.05)), want = S.tris * 3; let [lo, err] = MS.simplify(PW.idx, PW.pos, 3, want, 0.02, []);
    if(lo.length > want * 1.15){ const sl = MS.simplifySloppy.length >= 6 ? MS.simplifySloppy(PW.idx, PW.pos, 3, null, want, 1) : MS.simplifySloppy(PW.idx, PW.pos, 3, want, 1); const l2 = Array.isArray(sl) ? sl[0] : sl; console.error('  (' + id + ': the locked cut stopped at ' + lo.length / 3 + ' triangles, sloppy → ' + l2.length / 3 + ')'); lo = l2; }
    const usedV = new Int32Array(PW.pos.length / 3).fill(-1), lp = [], li = new Uint32Array(lo.length); for(let i = 0; i < lo.length; i++){ let r = usedV[lo[i]]; if(r < 0){ r = usedV[lo[i]] = lp.length / 3; lp.push(PW.pos[lo[i] * 3], PW.pos[lo[i] * 3 + 1], PW.pos[lo[i] * 3 + 2]); } li[i] = r; }
    const { bakeCopy, saveMap } = await import('./scene-bake.mjs'), baked = await bakeCopy(opt.deps, hi, { pos:Float32Array.from(lp), idx:li }, { color:T.srcColor, normal:T.srcNormal, mr:T.srcMr }, S.px); parts = [['body', baked.G]];
    T.color = await saveMap(baked.img.color, S.px, file('color', 'jpg'), S.save[0], S.q[0]); T.normal = await saveMap(baked.img.normal, S.px, file('normal', 'jpg'), S.save[1], S.q[1]); if(baked.img.mr) T.mr = await saveMap(baked.img.mr, S.px, file('mr', 'jpg'), S.save[2], S.q[2]);
    console.error('  (' + id + ': ' + srcTris + ' → ' + baked.G.idx.length / 3 + ' triangles, error ' + (+err).toFixed(4) + ', atlas cover ' + baked.cover + ', ' + baked.s + ' s)'); }
  else { T.color = await jpg(T.srcColor, 'color', S.save[0], S.q[0]); T.normal = await jpg(T.srcNormal, 'normal', S.save[1], S.q[1]); T.mr = await jpg(T.srcMr, 'mr', S.save[2], S.q[2]); }
  const R = writeGlb(path.join(OUT, id + '.glb'), parts, T, 'loot_' + id), all = box({ pos:Float32Array.from(parts.flatMap(([, G]) => [...G.pos])) });
  console.log(JSON.stringify({ id, ...R, sourceTris:srcTris, materials:sets.length, size:all.max.map((v, i) => +(v - all.min[i]).toFixed(3)), parts:Object.fromEntries(parts.map(([k, G]) => [k, box(G)])) })); }
