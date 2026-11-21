// tools/scene-import.mjs — Z373 SCENE IMPORT (maintainer tool; the game never loads it): the Meshy community models for the battlefields (spec in
//   tools/scene-import.json) turned into game files — the hi-poly scan (up to 8M triangles, 4K–8K PNG maps) welded and simplified to a desktop budget
//   that keeps its look up close (meshoptimizer, UV seams locked so the texture is never smeared across them; a budget of 0 keeps every triangle),
//   its maps packed as glTF expects (colour · normal · roughness+metallic in G/B · emission when it glows) as JPEG at the spec's size, and a light copy
//   for phones (…/m/, 1K maps); a heavy one also gets its distance levels — mid (…/l/, 18 %, 1K maps) and far (…/f/, 3 %, 512 maps), built here so
//   nothing is simplified while the game runs. Out: assets/models/real/scene/<key>.glb and …/scene/{l,f,m}/<key>.glb.
//   Z424 a copy whose seams hold it far above its budget (more than 1.3×: a scan's atlas is thousands of small charts) is never forced across them — that
//   shatters its texture into confetti (Z420's looseNear did, on 60 models): its shape is simplified on its own and its maps baked anew from the scan
//   (tools/scene-bake.mjs) — never a heavy scan's near copy (scene/<key>.glb): it keeps the scan's own atlas, heavier if it must. A spec's hd { key, px } bakes that copy's sharp near maps too (assets/models/real/hd/<key>.0.map|nrm.webp, the atlas
//   tools/hd-maps.mjs cannot cut from the original once the copy has its own). Foliage (loose) keeps the sloppy cut: its leaves are alpha cards.
//   node tools/scene-import.mjs [key …] --deps <dir> [--dl ~/Downloads] [--work <dir>] [--force]
//   (<dir>: npm i --prefix <dir> meshoptimizer@0.25.0 three@0.169.0 three-mesh-bvh@0.9.18 xatlasjs@0.2.0 sharp)
//   Needs: ImageMagick (`magick`), `unzip`, Playwright (PLAYWRIGHT_DIR: a node_modules dir holding it) and its Chromium (CHROME: the binary). The FBX is
//   read by three's FBXLoader inside the browser (the same three the game runs), the simplifier is meshoptimizer's WASM build.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http'; import { execFileSync } from 'node:child_process'; import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'scene-import.json'), 'utf8'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; }, FORCE = args.includes('--force');
const DL = opt('--dl', path.join(os.homedir(), 'Downloads')), WORK = opt('--work', path.join(os.tmpdir(), 'scene-import')), OUT = path.join(ROOT, 'assets', 'models', 'real', 'scene');
const keys = args.filter(a => a !== '_' && SPEC[a]);
const todo = (keys.length ? keys : Object.keys(SPEC).filter(k => k !== '_')).filter(k => FORCE || !fs.existsSync(SPEC[k].out ? path.join(ROOT, 'assets', 'models', 'real', SPEC[k].out, SPEC[k].file + '.glb') : path.join(OUT, k + '.glb')));
const req = createRequire(path.join(process.env.PLAYWRIGHT_DIR || path.join(os.homedir(), '.npm/_npx/9833c18b2d85bc59/node_modules'), 'x.js')), { chromium } = req('playwright');
const CHROME = process.env.CHROME || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
for(const x of ['m', 'l', 'f']) fs.mkdirSync(path.join(OUT, x), { recursive:true });
const MO = process.env.MESHOPT_DIR || opt('--deps', null); if(!MO){ console.error('needs --deps <dir> holding node_modules/meshoptimizer (npm i --prefix <dir> meshoptimizer@0.25.0)'); process.exit(1); }
const { MeshoptEncoder:ENC } = await import(path.join(path.resolve(MO), 'node_modules', 'meshoptimizer', 'meshopt_encoder.module.js')); await ENC.ready;
const sh = (cmd, a) => execFileSync(cmd, a, { maxBuffer:1 << 26 }).toString().trim();
const { bakeCopy, saveMap } = await import('./scene-bake.mjs'), HD = path.join(ROOT, 'assets', 'models', 'real', 'hd');

// the source: the newest download whose name holds the spec's substring (an FBX pack or a GLB)
function source(k){ const L = fs.readdirSync(DL).filter(f => f.includes(SPEC[k].src) && /(_fbx\.zip|\.glb)$/i.test(f)).map(f => ({ f, t:fs.statSync(path.join(DL, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  if(!L.length) throw new Error('no download for ' + k + ' (' + SPEC[k].src + ')'); return path.join(DL, L[0].f); }

// the maps, by role: colour, normal, mr (roughness G + metallic B), emission — PNG files of an FBX pack, or the images inside a GLB
function maps(src, dir){ const M = {};
  if(/\.glb$/i.test(src)){ const b = fs.readFileSync(src), jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl)), bin = b.slice(20 + jl + 8), mat = j.materials[0] || {}, pb = mat.pbrMetallicRoughness || {};
    const img = (t, role) => { if(!t) return; const im = j.images[j.textures[t.index].source], v = j.bufferViews[im.bufferView], f = path.join(dir, role + (im.mimeType === 'image/jpeg' ? '.jpg' : '.png'));
      fs.writeFileSync(f, bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength)); M[role] = f; };
    img(pb.baseColorTexture, 'color'); img(mat.normalTexture, 'normal'); img(pb.metallicRoughnessTexture, 'mr'); img(mat.emissiveTexture, 'emis'); return M; }
  const pngs = sh('find', [dir, '-name', '*.png']).split('\n').filter(Boolean), suf = s => pngs.find(p => new RegExp('_(' + s + ')\\.png$').test(p));
  M.color = pngs.find(p => !/_(emission|emit|metallic|roughness|normal|metallic_roughness)\.png$/.test(p)); M.normal = suf('normal'); M.emis = suf('emission|emit');
  const r = suf('roughness'), m = suf('metallic'); if(r || m) M.parts = { r, m }; else if(suf('metallic_roughness')) M.mr = suf('metallic_roughness'); return M; }
// those maps at a size, as JPEG (never upscaled); returns { color, normal, mr, emis, metal } paths / flags
function texSet(M, size, dir, tag){ const o = {}, rs = size + 'x' + size + '>', mrs = Math.min(size, 2048) + 'x' + Math.min(size, 2048) + '>';   // (roughness / metallic never past 2K: they carry no fine detail)
  if(M.color){ o.color = path.join(dir, tag + '_color.jpg'); sh('magick', [M.color, '-resize', rs, '-quality', '90', o.color]); }
  if(M.normal){ o.normal = path.join(dir, tag + '_normal.jpg'); sh('magick', [M.normal, '-resize', rs, '-quality', '94', o.normal]); }
  if(M.parts){ const ref = M.parts.r || M.parts.m, dim = sh('magick', ['identify', '-format', '%wx%h', ref]), g = f => f ? ['(', f, '-colorspace', 'Gray', '-resize', dim + '!', ')'] : ['(', '-size', dim, 'xc:black', ')'];
    o.mr = path.join(dir, tag + '_mr.jpg'); sh('magick', ['(', '-size', dim, 'xc:white', ')', ...g(M.parts.r), ...g(M.parts.m), '-set', 'colorspace', 'sRGB', '-combine', '-resize', mrs, '-quality', '92', o.mr]);
    o.metal = !!M.parts.m && +sh('magick', [M.parts.m, '-colorspace', 'Gray', '-format', '%[fx:mean]', 'info:']) > 0.02; }
  else if(M.mr){ o.mr = path.join(dir, tag + '_mr.jpg'); sh('magick', [M.mr, '-resize', mrs, '-quality', '92', o.mr]); o.metal = +sh('magick', [M.mr, '-channel', 'B', '-separate', '-format', '%[fx:mean]', 'info:']) > 0.02; }
  if(M.emis && +sh('magick', [M.emis, '-colorspace', 'Gray', '-format', '%[fx:maxima]', 'info:']) > 0.08){ o.emis = path.join(dir, tag + '_emis.jpg'); sh('magick', [M.emis, '-resize', rs, '-quality', '90', o.emis]); }
  return o; }

// one GLB: a single mesh and its one material. The geometry is reordered for the vertex cache, quantized (KHR_mesh_quantization: positions int16 under
//   the node's scale, normals int8, UVs uint16 when they keep to 0…1) and meshopt-compressed (EXT_meshopt_compression; three's GLTFLoader decodes it
//   once the game hands it the MeshoptDecoder) — about a quarter of the float size, nothing visible lost.
function writeGLB(file, G, T, name, plain){ const E = ENC, idx = Uint32Array.from(G.idx), [remap, nv] = E.reorderMesh(idx, true, false);
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  for(let v = 0; v < remap.length; v++){ const r = remap[v]; if(r === 0xffffffff || r >= nv) continue; pos.set(G.pos.subarray(v * 3, v * 3 + 3), r * 3); nrm.set(G.nrm.subarray(v * 3, v * 3 + 3), r * 3); uv.set(G.uv.subarray(v * 2, v * 2 + 2), r * 2); }
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for(let i = 0; i < pos.length; i += 3) for(let a = 0; a < 3; a++){ const x = pos[i + a]; if(x < mn[a]) mn[a] = x; if(x > mx[a]) mx[a] = x; }
  const ctr = [0, 1, 2].map(a => (mn[a] + mx[a]) / 2), half = Math.max(...[0, 1, 2].map(a => (mx[a] - mn[a]) / 2)) || 1, qs = half / 32767;
  const P = new Int16Array(nv * 4), N = new Int8Array(nv * 4); let uvIn = true; for(let i = 0; i < uv.length; i++) if(uv[i] < 0 || uv[i] > 1){ uvIn = false; break; }
  const U = uvIn ? new Uint16Array(nv * 2) : uv;
  for(let v = 0; v < nv; v++){ for(let a = 0; a < 3; a++) P[v * 4 + a] = Math.round((pos[v * 3 + a] - ctr[a]) / qs);
    const x = nrm[v * 3], y = nrm[v * 3 + 1], z = nrm[v * 3 + 2], l = Math.hypot(x, y, z) || 1; N[v * 4] = Math.round(x / l * 127); N[v * 4 + 1] = Math.round(y / l * 127); N[v * 4 + 2] = Math.round(z / l * 127);
    if(uvIn){ U[v * 2] = Math.round(uv[v * 2] * 65535); U[v * 2 + 1] = Math.round(uv[v * 2 + 1] * 65535); } }
  const qmn = [0, 1, 2].map(a => Math.round((mn[a] - ctr[a]) / qs)), qmx = [0, 1, 2].map(a => Math.round((mx[a] - ctr[a]) / qs));
  if(plain) return writePlain(file, pos, nrm, uv, idx, nv, mn, mx, T, name);   // (a hand weapon: plain floats, for the loader and the hold fitter that read it raw)
  const parts = [], views = []; let off = 0, fb = 0;
  const put = buf => { const pad = (4 - off % 4) % 4; if(pad){ parts.push(Buffer.alloc(pad)); off += pad; } const o = off; parts.push(buf); off += buf.length; return o; };
  const cview = (raw, count, stride, mode, target) => { const enc = Buffer.from(E.encodeGltfBuffer(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength), count, stride, mode)), o = put(enc);
    views.push({ buffer:1, byteOffset:fb, byteLength:count * stride, ...(mode === 'ATTRIBUTES' ? { byteStride:stride } : {}), target, extensions:{ EXT_meshopt_compression:{ buffer:0, byteOffset:o, byteLength:enc.length, byteStride:stride, count, mode } } });
    fb += count * stride; fb += (4 - fb % 4) % 4; return views.length - 1; };
  const small = nv < 65536, I = small ? Uint16Array.from(idx) : idx;
  const acc = [{ bufferView:cview(P, nv, 8, 'ATTRIBUTES', 34962), componentType:5122, count:nv, type:'VEC3', min:qmn, max:qmx },
    { bufferView:cview(N, nv, 4, 'ATTRIBUTES', 34962), componentType:5120, normalized:true, count:nv, type:'VEC3' },
    uvIn ? { bufferView:cview(U, nv, 4, 'ATTRIBUTES', 34962), componentType:5123, normalized:true, count:nv, type:'VEC2' } : { bufferView:cview(U, nv, 8, 'ATTRIBUTES', 34962), componentType:5126, count:nv, type:'VEC2' },
    { bufferView:cview(I, I.length, small ? 2 : 4, 'TRIANGLES', 34963), componentType:small ? 5123 : 5125, count:I.length, type:'SCALAR' }];
  const images = [], textures = [], tex = f => { if(!f) return undefined; const b = fs.readFileSync(f), o = put(b); views.push({ buffer:0, byteOffset:o, byteLength:b.length }); images.push({ bufferView:views.length - 1, mimeType:'image/jpeg' }); textures.push({ sampler:0, source:images.length - 1 }); return { index:textures.length - 1 }; };
  const mat = { name, pbrMetallicRoughness:{ baseColorTexture:tex(T.color), metallicRoughnessTexture:tex(T.mr), metallicFactor:T.mr && T.metal ? 1 : 0, roughnessFactor:T.mr ? 1 : 0.85 }, normalTexture:tex(T.normal) };
  if(T.emis){ mat.emissiveTexture = tex(T.emis); mat.emissiveFactor = [1, 1, 1]; }
  const bin = Buffer.concat(parts), binP = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]), X = ['EXT_meshopt_compression', 'KHR_mesh_quantization'];
  const json = { asset:{ version:'2.0', generator:'tank-shooter tools/scene-import.mjs' }, extensionsUsed:X, extensionsRequired:X, scene:0, scenes:[{ nodes:[0] }], nodes:[{ name, mesh:0, translation:ctr, scale:[qs, qs, qs] }],
    meshes:[{ name, primitives:[{ attributes:{ POSITION:0, NORMAL:1, TEXCOORD_0:2 }, indices:3, material:0 }] }], materials:[mat], accessors:acc, bufferViews:views,
    buffers:[{ byteLength:binP.length }, { byteLength:fb, extensions:{ EXT_meshopt_compression:{ fallback:true } } }],
    samplers:[{ magFilter:9729, minFilter:9987, wrapS:10497, wrapT:10497 }], textures, images };
  const js = Buffer.from(JSON.stringify(json)), jsP = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]), head = Buffer.alloc(12), c0 = Buffer.alloc(8), c1 = Buffer.alloc(8);
  head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jsP.length + 8 + binP.length, 8);
  c0.writeUInt32LE(jsP.length, 0); c0.writeUInt32LE(0x4E4F534A, 4); c1.writeUInt32LE(binP.length, 0); c1.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(file, Buffer.concat([head, c0, jsP, c1, binP])); return { tris:idx.length / 3, verts:nv, mb:+(fs.statSync(file).size / 1e6).toFixed(1) }; }

// Z387 the same mesh and material as plain floats (no quantization, no compression): the hand weapons load through actors/models.js and are measured
//   raw by actors/gun-fit.js
function writePlain(file, pos, nrm, uv, idx, nv, mn, mx, T, name){ const parts = [], views = []; let off = 0;
  const view = (buf, target) => { const pad = (4 - off % 4) % 4; if(pad){ parts.push(Buffer.alloc(pad)); off += pad; } views.push({ buffer:0, byteOffset:off, byteLength:buf.length, ...(target ? { target } : {}) }); parts.push(buf); off += buf.length; return views.length - 1; };
  const B = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength), small = nv < 65536, I = small ? Uint16Array.from(idx) : idx;
  const acc = [{ bufferView:view(B(pos), 34962), componentType:5126, count:nv, type:'VEC3', min:mn, max:mx }, { bufferView:view(B(nrm), 34962), componentType:5126, count:nv, type:'VEC3' },
    { bufferView:view(B(uv), 34962), componentType:5126, count:nv, type:'VEC2' }, { bufferView:view(B(I), 34963), componentType:small ? 5123 : 5125, count:I.length, type:'SCALAR' }];
  const images = [], textures = [], tex = f => { if(!f) return undefined; images.push({ bufferView:view(fs.readFileSync(f)), mimeType:'image/jpeg' }); textures.push({ sampler:0, source:images.length - 1 }); return { index:textures.length - 1 }; };
  const mat = { name, pbrMetallicRoughness:{ baseColorTexture:tex(T.color), metallicRoughnessTexture:tex(T.mr), metallicFactor:T.mr && T.metal ? 1 : 0, roughnessFactor:T.mr ? 1 : 0.85 }, normalTexture:tex(T.normal) };
  if(T.emis){ mat.emissiveTexture = tex(T.emis); mat.emissiveFactor = [1, 1, 1]; }
  const bin = Buffer.concat(parts), binP = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]);
  const json = { asset:{ version:'2.0', generator:'tank-shooter tools/scene-import.mjs' }, scene:0, scenes:[{ nodes:[0] }], nodes:[{ name, mesh:0 }], meshes:[{ name, primitives:[{ attributes:{ POSITION:0, NORMAL:1, TEXCOORD_0:2 }, indices:3, material:0 }] }],
    materials:[mat], accessors:acc, bufferViews:views, buffers:[{ byteLength:binP.length }], samplers:[{ magFilter:9729, minFilter:9987, wrapS:10497, wrapT:10497 }], textures, images };
  const js = Buffer.from(JSON.stringify(json)), jsP = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]), head = Buffer.alloc(12), c0 = Buffer.alloc(8), c1 = Buffer.alloc(8);
  head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jsP.length + 8 + binP.length, 8); c0.writeUInt32LE(jsP.length, 0); c0.writeUInt32LE(0x4E4F534A, 4); c1.writeUInt32LE(binP.length, 0); c1.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(file, Buffer.concat([head, c0, jsP, c1, binP])); return { tris:idx.length / 3, verts:nv, mb:+(fs.statSync(file).size / 1e6).toFixed(1) }; }
// a level turned about Y (deg) in place — a gun's barrel laid along Z
function turnY(G, deg){ if(!deg) return G; const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); for(const A of [G.pos, G.nrm]) for(let i = 0; i < A.length; i += 3){ const x = A[i], z = A[i + 2]; A[i] = x * c + z * s; A[i + 2] = -x * s + z * c; } return G; }

// the page: load (FBX / GLB) → one welded indexed geometry → simplified per budget (seams locked) → compacted → posted back level by level
const PAGE = `<!doctype html><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three'; import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const MS = import('https://cdn.jsdelivr.net/npm/meshoptimizer@0.25.0/meshopt_simplifier.module.js').then(m => m.MeshoptSimplifier.ready.then(() => m.MeshoptSimplifier));
// exact weld: a corner is the same vertex when all eight floats match (open-addressing table over their bits)
function weld(pos, nrm, uv, index){ const n = index ? index.length : pos.length / 3, P = new Uint32Array(pos.buffer, pos.byteOffset, pos.length), N = new Uint32Array(nrm.buffer, nrm.byteOffset, nrm.length), U = new Uint32Array(uv.buffer, uv.byteOffset, uv.length);
  let cap = 1; while(cap < n * 2) cap *= 2; const tab = new Int32Array(cap).fill(-1), map = new Int32Array(n), first = new Int32Array(n); let u = 0;
  const w = (c, k) => k < 3 ? P[c * 3 + k] : k < 6 ? N[c * 3 + k - 3] : U[c * 2 + k - 6];
  for(let i = 0; i < n; i++){ const c = index ? index[i] : i; let h = 2166136261; for(let k = 0; k < 8; k++) h = Math.imul(h ^ w(c, k), 16777619); let s = (h >>> 0) & (cap - 1);
    for(;;){ const e = tab[s]; if(e < 0){ tab[s] = u; first[u] = c; map[i] = u++; break; } const d = first[e]; let same = true; for(let k = 0; k < 8 && same; k++) same = w(c, k) === w(d, k); if(same){ map[i] = e; break; } s = (s + 1) & (cap - 1); } }
  const p = new Float32Array(u * 3), q = new Float32Array(u * 3), t = new Float32Array(u * 2);
  for(let v = 0; v < u; v++){ const c = first[v]; p.set(pos.subarray(c * 3, c * 3 + 3), v * 3); q.set(nrm.subarray(c * 3, c * 3 + 3), v * 3); t.set(uv.subarray(c * 2, c * 2 + 2), v * 2); }
  return { pos:p, nrm:q, uv:t, idx:Uint32Array.from(map) }; }
// Z424 a weld by position alone: the shape without its charts, for a copy whose maps are baked anew
function weldPos(pos, idx){ const n = pos.length / 3, P = new Uint32Array(pos.buffer, pos.byteOffset, pos.length); let cap = 1; while(cap < n * 2) cap *= 2; const tab = new Int32Array(cap).fill(-1), first = new Int32Array(n), map = new Int32Array(n); let u = 0;
  for(let v = 0; v < n; v++){ let h = 2166136261; for(let k = 0; k < 3; k++) h = Math.imul(h ^ P[v * 3 + k], 16777619); let s = (h >>> 0) & (cap - 1);
    for(;;){ const e = tab[s]; if(e < 0){ tab[s] = u; first[u] = v; map[v] = u++; break; } const d = first[e]; if(P[d * 3] === P[v * 3] && P[d * 3 + 1] === P[v * 3 + 1] && P[d * 3 + 2] === P[v * 3 + 2]){ map[v] = e; break; } s = (s + 1) & (cap - 1); } }
  const p = new Float32Array(u * 3); for(let w = 0; w < u; w++) p.set(pos.subarray(first[w] * 3, first[w] * 3 + 3), w * 3);
  const I = new Uint32Array(idx.length); for(let i = 0; i < idx.length; i++) I[i] = map[idx[i]]; return { pos:p, nrm:new Float32Array(u * 3), uv:new Float32Array(u * 2), idx:I }; }
function compact(G, idx){ const remap = new Int32Array(G.pos.length / 3).fill(-1); let n = 0; const out = new Uint32Array(idx.length);
  for(let i = 0; i < idx.length; i++){ let r = remap[idx[i]]; if(r < 0) r = remap[idx[i]] = n++; out[i] = r; }
  const p = new Float32Array(n * 3), q = new Float32Array(n * 3), t = new Float32Array(n * 2);
  for(let v = 0; v < remap.length; v++){ const r = remap[v]; if(r < 0) continue; p.set(G.pos.subarray(v * 3, v * 3 + 3), r * 3); q.set(G.nrm.subarray(v * 3, v * 3 + 3), r * 3); t.set(G.uv.subarray(v * 2, v * 2 + 2), r * 2); }
  return { pos:p, nrm:q, uv:t, idx:out }; }
window._conv = async (url, fbx, levels, tex) => {
  const root = fbx ? await new FBXLoader().loadAsync(url) : (await new GLTFLoader().loadAsync(url)).scene; root.updateMatrixWorld(true);
  const parts = []; root.traverse(o => { if(!o.isMesh) return; let g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); if(!g.attributes.normal) g.computeVertexNormals();
    if(!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); parts.push(g); });
  let tot = 0; for(const g of parts) tot += g.index ? g.index.count : g.attributes.position.count;
  const pos = new Float32Array(tot * 3), nrm = new Float32Array(tot * 3), uv = new Float32Array(tot * 2); let o = 0;   // all parts as one corner list
  for(const g of parts){ const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, I = g.index, n = I ? I.count : P.count;
    for(let i = 0; i < n; i++, o++){ const v = I ? I.getX(i) : i; pos[o * 3] = P.getX(v); pos[o * 3 + 1] = P.getY(v); pos[o * 3 + 2] = P.getZ(v); nrm[o * 3] = N.getX(v); nrm[o * 3 + 1] = N.getY(v); nrm[o * 3 + 2] = N.getZ(v);
      uv[o * 2] = U.getX(v); uv[o * 2 + 1] = fbx ? 1 - U.getY(v) : U.getY(v); } g.dispose(); }   // (FBX UVs start bottom-left, glTF's top-left)
  const G = weld(pos, nrm, uv, null), S = await MS, res = [];
  let near = 0, PW = null;
  for(const L of levels){ let idx = G.idx, t = L.tris, bake = false;
    if(L.share){ if(near < L.skip) continue; t = Math.max(L.min, Math.round(near * L.share)); }   // (the mid / far copies follow the near one; a light model has none)
    if(t && t * 3 < idx.length){ const n = Math.floor(t) * 3, sloppy = (I, P) => { const sl = S.simplifySloppy.length >= 6 ? S.simplifySloppy(I, P, 3, null, n, 1) : S.simplifySloppy(I, P, 3, n, 1); return Array.isArray(sl) ? sl[0] : sl; };   // (Z420 meshoptimizer 0.25 takes a vertex lock before the target)
      [idx] = S.simplify(G.idx, G.pos, 3, n, L.err, L.loose ? ['Permissive'] : []);   // the seams locked: no triangle ever spans two charts
      if(L.loose && idx.length > t * 4.5) idx = sloppy(G.idx, G.pos);   // (foliage: a cloud of leaf islands no seam-locked collapse can thin — far off, a smeared leaf is still green)
      else if(!L.loose && L.bake && tex && idx.length > n * 1.3){ PW = PW || weldPos(G.pos, G.idx); [idx] = S.simplify(PW.idx, PW.pos, 3, n, 1, []); if(idx.length > n * 1.3) idx = sloppy(PW.idx, PW.pos); bake = true; } }   // Z424 its maps baked anew
    if(L.name === 'd') near = Math.min(idx.length / 3, L.base || Infinity);   // (Z392 the mid / far copies follow lodBase when the near scan is heavier)
    const C = compact(bake ? PW : G, idx), body = new Blob([C.pos, C.nrm, C.uv, C.idx]);
    await fetch('/put?lvl=' + L.name + '&nv=' + (C.pos.length / 3) + '&ni=' + C.idx.length + (bake ? '&bake=1' : ''), { method:'POST', body }); res.push({ lvl:L.name, tris:C.idx.length / 3, bake }); }
  if(res.some(x => x.bake)) await fetch('/put?lvl=hi&nv=' + (G.pos.length / 3) + '&ni=' + G.idx.length, { method:'POST', body:new Blob([G.pos, G.nrm, G.uv, G.idx]) });   // the scan, for the bake
  return { srcTris:G.idx.length / 3, welded:G.pos.length / 3, res }; };
window._ready = true;
</script>`;

// the index the game reads (render/near-detail.js), rebuilt from what is on disk — as tools/hd-maps.mjs writes it
function hdIndex(){ const IX = {}; for(const f of fs.readdirSync(HD).filter(f => /\.(webp|glb)$/.test(f)).sort()){ const m = f.match(/^(.+)\.(\d+)\.(\w+)\.webp$/), g = f.match(/^(.+)\.glb$/);
    if(m) (IX[m[1]] = IX[m[1]] || []).push(m[2] + '.' + m[3]); else if(g) (IX[g[1]] = IX[g[1]] || []).push('geo'); }
  fs.writeFileSync(path.join(HD, 'index.json'), JSON.stringify(IX, null, 0).replace(/\],/g, '],\n') + '\n'); }
const got = {}; let cur = null;
const server = http.createServer((q, r) => { const u = new URL(q.url, 'http://x');
  if(u.pathname === '/page.html'){ r.writeHead(200, { 'content-type':'text/html' }); return r.end(PAGE); }
  if(u.pathname === '/put'){ const ch = []; q.on('data', d => ch.push(d)); q.on('end', () => { const b = Buffer.concat(ch), nv = +u.searchParams.get('nv'), ni = +u.searchParams.get('ni'), f = (o, n, T) => new T(b.buffer.slice(b.byteOffset + o, b.byteOffset + o + n * T.BYTES_PER_ELEMENT));
    got[u.searchParams.get('lvl')] = { pos:f(0, nv * 3, Float32Array), nrm:f(nv * 12, nv * 3, Float32Array), uv:f(nv * 24, nv * 2, Float32Array), idx:f(nv * 32, ni, Uint32Array), bake:u.searchParams.get('bake') === '1' }; r.end('ok'); }); return; }
  if(u.pathname.startsWith('/w/') && cur){ const f = path.join(cur, decodeURIComponent(u.pathname.slice(3))); if(f.startsWith(cur) && fs.existsSync(f)){ r.writeHead(200, { 'access-control-allow-origin':'*' }); return fs.createReadStream(f).pipe(r); } }
  r.writeHead(404); r.end(); });
await new Promise(ok => server.listen(0, '127.0.0.1', ok)); const PORT = server.address().port;
const browser = await chromium.launch({ headless:true, executablePath:CHROME, args:['--use-angle=metal', '--js-flags=--max-old-space-size=16000'] });
const report = [];
for(const k of todo){ const S = SPEC[k], t0 = Date.now(); let src;
  try { src = source(k); cur = path.join(WORK, k); fs.rmSync(cur, { recursive:true, force:true }); fs.mkdirSync(path.join(cur, 'tex'), { recursive:true });
    let model, fbx = false;
    if(/\.glb$/i.test(src)){ model = 'model.glb'; fs.copyFileSync(src, path.join(cur, model)); }
    else { sh('unzip', ['-q', '-o', '-j', src, '-d', cur]); fbx = true; model = fs.readdirSync(cur).find(f => /\.fbx$/i.test(f));
      for(const f of fs.readdirSync(cur)) if(/\.png$/i.test(f)) fs.renameSync(path.join(cur, f), path.join(cur, 'tex', f)); }   // (out of the FBX's reach: the loader would decode every 4K map)
    const M = maps(/\.glb$/i.test(src) ? path.join(cur, model) : src, path.join(cur, 'tex')), TD = texSet(M, S.tex, path.join(cur, 'tex'), 'd'), TM = texSet(M, 1024, path.join(cur, 'tex'), 'm');
    for(const x in got) delete got[x];
    const page = await browser.newPage(); page.setDefaultTimeout(900000); await page.goto(`http://127.0.0.1:${PORT}/page.html`); await page.waitForFunction(() => window._ready);
    const r = await page.evaluate(([u, f, L, tx]) => window._conv(u, f, L, tx), ['/w/' + encodeURIComponent(model), fbx, [{ name:'d', tris:S.tris, err:S.err ?? 0.05, base:S.lodBase, bake:!!S.out }, { name:'l', share:0.18, min:4000, skip:40000, err:0.1, loose:S.loose, bake:true }, { name:'f', share:0.03, min:1500, skip:40000, err:0.3, loose:S.loose, bake:true }, { name:'m', tris:S.m, err:0.25, loose:S.loose, bake:true }], !!M.color]); await page.close();
    // Z424 a level as written: its own mesh and maps, or — when baked — the simplified shape on new charts and the maps baked onto them
    let TB = null; const baked = [], dir = path.join(cur, 'tex');
    const level = async (x, T, px, hd) => { const L = got[x]; if(!L || !L.bake) return { G:L, T };
      TB = TB || texSet(M, 4096, dir, 'b'); const B = await bakeCopy(MO, got.hi, L, TB, Math.max(px, hd ? hd.px : 0)), o = { metal:TB.metal };
      o.color = await saveMap(B.img.color, B.px, path.join(dir, x + 'b_color.jpg'), px, 88); o.normal = await saveMap(B.img.normal, B.px, path.join(dir, x + 'b_normal.jpg'), Math.min(px, 1024), 90);   // (a baked normal past 1K is the scan's noise, not its shape: the near maps keep 2K)
      if(B.img.mr) o.mr = await saveMap(B.img.mr, B.px, path.join(dir, x + 'b_mr.jpg'), Math.min(px, 2048), 85);
      if(hd){ fs.mkdirSync(HD, { recursive:true }); await saveMap(B.img.color, B.px, path.join(HD, hd.key + '.0.map.webp'), hd.px, 86, true); await saveMap(B.img.normal, B.px, path.join(HD, hd.key + '.0.nrm.webp'), hd.px, 90, true); hdIndex(); }
      baked.push({ x, tris:B.G.idx.length / 3, px, atlas:B.atlas, cover:B.cover, s:B.s, ...(hd ? { hd:hd.px } : {}) }); return { G:B.G, T:o }; };
    if(S.out){ const D = await level('d', TD, S.tex, S.hd), d = writeGLB(path.join(ROOT, 'assets', 'models', 'real', S.out, S.file + '.glb'), turnY(D.G, S.rot), D.T, S.file, true);   // Z387 a hand weapon: one plain file where the arsenal lives
      const line = { key:k, src:path.basename(src), srcTris:r.srcTris, out:S.out + '/' + S.file, d, ...(baked.length ? { baked } : {}) }; report.push(line); console.log(JSON.stringify(line)); fs.rmSync(cur, { recursive:true, force:true }); continue; }
    const D = await level('d', TD, S.tex), Mm = await level('m', TM, 1024), d = writeGLB(path.join(OUT, k + '.glb'), D.G, D.T, k), m = writeGLB(path.join(OUT, 'm', k + '.glb'), Mm.G, Mm.T, k), lv = {};
    for(const x of ['l', 'f']){ const f = path.join(OUT, x, k + '.glb'); if(got[x]){ const V = await level(x, x === 'l' ? TM : texSet(M, 512, dir, 'f'), x === 'l' ? 1024 : 512); lv[x] = writeGLB(f, V.G, V.T, k); } else fs.rmSync(f, { force:true }); }
    const line = { key:k, src:path.basename(src), srcTris:r.srcTris, desktop:d, mid:lv.l, far:lv.f, phone:m, maps:Object.keys(TD).filter(x => TD[x] && x !== 'metal'), ...(baked.length ? { baked } : {}), s:Math.round((Date.now() - t0) / 1000) };
    report.push(line); console.log(JSON.stringify(line));
  } catch(e){ console.log(JSON.stringify({ key:k, err:String(e && e.stack || e).slice(0, 400) })); }
  if(cur) fs.rmSync(cur, { recursive:true, force:true }); }
await browser.close(); server.close();
