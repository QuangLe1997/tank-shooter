// tools/asset-diet.mjs — DIET 2 KTX2 MAPS AND MESHOPT GEOMETRY IN EVERY MODEL FILE (maintainer tool; the game never loads it). A battle held 2.8–3.7 GB of
//   textures on the GPU: every model's JPEG maps (three at 2048² for most) unpacked to RGBA8 with mips, 21 MB each. Here each map is re-encoded as KTX2
//   (Basis Universal) inside its GLB, which three's KTX2Loader (render/asset-diet.js) transcodes to whatever the GPU reads compressed — ASTC / BC7 /
//   ETC2 — so it stays 4–8× smaller in GPU memory:
//     colour, metal-roughness, occlusion, emission → ETC1S (quality --q, default 200: about the JPEG's own size on disk, ~40 dB against it);
//     normal maps → ETC1S in basisu's normal-map mode (~41 dB on these smooth baked normals), or UASTC + zstd (lossless-looking, but 3–10× the JPEG's
//     bytes) for the HERO files the camera sees from half a metre (the guns in his hands, at most --nrm px); a small map whose ETC1S came out over
//     1.4× its JPEG is encoded again at quality 128 (the download budgets of the light models);
//   and each texture keeps a small fallback (its picture at --fb px, JPEG, PNG when it has alpha) as its plain glTF source — KHR_texture_basisu is not
//   required, so a page whose transcoder failed reads that instead, and the code that reads a map's pixels (a tree's leaf mask, a soldier's shirt
//   colour) reads it from there. Geometry that is not yet compressed gets EXT_meshopt_compression, lossless (attributes stay as they are: whatever
//   bakes, cuts or welds meshes sees exactly what it saw) — except PLAIN files (rigged bodies, scene-import's plain copies, the blades: tools and
//   test.js read their raw vertices). Maps of KEEP files stay JPEG (their pixels are rewritten in the page: the traffic livery); a map over the WASM
//   encoder's 12 Mpx (4096²) stays as it is.
//   node tools/asset-diet.mjs [file|dir …] --deps <dir> [--jobs 8] [--q 200] [--nrm 1024] [--fb 256] [--dry] [--force]
//     (default: every .glb under assets/models except the raw downloads (meshy, tripo) and the near-detail shapes (hd: 256 px maps); a file whose maps
//     are already KTX2 is skipped unless --force)
//   (<dir>: npm i --prefix <dir> @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer@0.25.0 sharp ktx2-encoder@0.6.0)
import fs from 'node:fs'; import path from 'node:path'; import { fork } from 'node:child_process'; import { createRequire } from 'node:module'; import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const VAL = new Set(['--deps', '--jobs', '--q', '--nrm', '--fb', '--one']), pos = []; for(let i = 0; i < args.length; i++){ if(VAL.has(args[i])){ i++; continue; } if(!args[i].startsWith('--')) pos.push(args[i]); }
const deps = opt('--deps', null); if(!deps){ console.error('--deps <dir> needed (see the header)'); process.exit(1); }
const Q = +opt('--q', 200), NRM = +opt('--nrm', 1024), FB = +opt('--fb', 256), MIN = 256, MAXPX = 12582912;
const HERO = /\/(carbine[\w-]*|gun\/[\w/-]+|rifle\/[\w/-]+)\.glb$/;   // UASTC normal maps: the guns in the soldier's hands, half a metre from the lens (UASTC is 3–10× a JPEG's bytes: only here)
const KEEP = /\/rider_driver\.glb$/;   // its colour map is recoloured in the page (world/traffic.js livery)
const SKIP = /\/models\/(meshy|tripo)\/|\/real\/hd\//;
// geometry left plain (no meshopt): a rigged body (tools/skin-repair.mjs and the skin checks read its raw vertices) and scene-import's plain copies
//   (test.js reads their raw UVs to prove no triangle spans two charts) — their maps still go KTX2
const PLAIN_RX = /\/real\/blade\//;   // (+ tools/blade-pack.mjs's blades: test.js reads their raw edge)
const PLAIN = new Set(Object.values(JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'scene-import.json'), 'utf8'))).filter(v => v && v.out).map(v => path.join(ROOT, 'assets', 'models', 'real', v.out, v.file + '.glb')));
const MB = b => (b / 1048576).toFixed(1);

// ---- one file (run in a worker process) ----
async function kit(){ const req = createRequire(path.resolve(deps, 'package.json')), { NodeIO, VertexLayout } = req('@gltf-transform/core'), X = req('@gltf-transform/extensions'), F = req('@gltf-transform/functions'), M = req('meshoptimizer'), sharp = req('sharp');
  const { encodeToKTX2 } = await import(pathToFileURL(path.join(path.resolve(deps), 'node_modules', 'ktx2-encoder', 'dist', 'node', 'index.js')).href);
  await M.MeshoptDecoder.ready; await M.MeshoptEncoder.ready;
  const io = new NodeIO().setVertexLayout(VertexLayout.SEPARATE).registerExtensions(X.ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder':M.MeshoptDecoder, 'meshopt.encoder':M.MeshoptEncoder });
  return { io, X, F, sharp, encodeToKTX2 }; }
let K = null;
async function diet(file){ K = K || await kit(); const { io, X, F, sharp, encodeToKTX2 } = K, buf = fs.readFileSync(file), doc = await io.readBinary(new Uint8Array(buf)), root = doc.getRoot();
  const hero = HERO.test(file), keep = KEEP.test(file), fb = [], log = [];
  const texs = root.listTextures(); if(texs.some(t => t.getMimeType() === 'image/ktx2') && !args.includes('--force')) return { file, skip:'already KTX2' };
  for(const [i, t] of texs.entries()){ const img = t.getImage(), mime = t.getMimeType(); if(!img || !/jpeg|png|webp/.test(mime)) continue;
    const meta = await sharp(img).metadata(), W = meta.width, H = meta.height; if(Math.max(W, H) <= MIN) continue;
    if(W * H > MAXPX){ log.push('kept ' + W + 'x' + H + ' (over the encoder\'s 12 Mpx)'); continue; }   // (a 4096² map: the WASM encoder refuses it; it stays as it is)
    const slots = F.listTextureSlots(t), nrm = slots.some(s => /normal/i.test(s)), col = slots.some(s => /baseColor|emissive|diffuse|specularColor|sheenColor/i.test(s));
    if(keep && col) continue;
    const raw = await sharp(img).ensureAlpha().raw().toBuffer({ resolveWithObject:true }); let alpha = false; for(let p = 3; p < raw.data.length; p += 4) if(raw.data[p] < 250){ alpha = true; break; }
    const cap = nrm && hero && Math.max(W, H) > NRM ? NRM / Math.max(W, H) : 1;
    const dec = async () => { if(cap === 1) return { data:new Uint8Array(raw.data), width:W, height:H }; const r = await sharp(img).resize(Math.round(W * cap), Math.round(H * cap)).ensureAlpha().raw().toBuffer({ resolveWithObject:true }); return { data:new Uint8Array(r.data), width:r.info.width, height:r.info.height }; };
    const o = nrm ? (hero ? { isUASTC:true, needSupercompression:true, uastcLDRQualityLevel:1 } : { isUASTC:false, qualityLevel:Q, compressionLevel:2, isNormalMap:true }) : { isUASTC:false, qualityLevel:Q, compressionLevel:2 };
    const enc = o2 => encodeToKTX2(img, { ...o2, isPerceptual:col, isSetKTX2SRGBTransferFunc:col, generateMipmap:true, imageDecoder:dec });
    const say = console.log; console.log = () => {}; let k2; try{ k2 = await enc(o); if(!o.isUASTC && Q > 128 && k2.length > img.length * 1.4) k2 = await enc({ ...o, qualityLevel:128 }); } finally { console.log = say; }
    const small = sharp(img).resize(FB, FB, { fit:'inside', withoutEnlargement:true }), fbuf = alpha ? await small.png().toBuffer() : await small.jpeg({ quality:72 }).toBuffer();
    t.setImage(new Uint8Array(k2)).setMimeType('image/ktx2'); t.setExtras({ ...(t.getExtras() || {}), dietFb:fb.length }); fb.push({ data:fbuf, mime:alpha ? 'image/png' : 'image/jpeg' });
    log.push((nrm ? (hero ? 'N-uastc' : 'N-etc1s') : col ? 'C' : 'D') + ' ' + W + 'x' + H + (cap < 1 ? '→' + Math.round(W * cap) : '') + ' ' + (img.length / 1024 | 0) + '→' + (k2.length / 1024 | 0) + 'K'); }
  if(fb.length) doc.createExtension(X.KHRTextureBasisu).setRequired(false);
  if(!root.listTextures().some(t => t.getMimeType() === 'image/webp')) for(const e of root.listExtensionsUsed()) if(e.extensionName === 'EXT_texture_webp') e.dispose();
  const mo = root.listExtensionsUsed().some(e => e.extensionName === 'EXT_meshopt_compression'), plain = PLAIN.has(path.resolve(file)) || PLAIN_RX.test(file) || root.listSkins().length > 0;
  if(!mo && !plain && root.listMeshes().length) doc.createExtension(X.EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method:X.EXTMeshoptCompression.EncoderMethod.QUANTIZE });   // (no quantize() first: lossless)
  if(!fb.length && (mo || plain)) return { file, skip:'nothing to do' + (log.length ? ': ' + log.join(', ') : '') };
  let out = Buffer.from(await io.writeBinary(doc)); if(fb.length) out = addFallbacks(out, fb);
  if(!args.includes('--dry')) fs.writeFileSync(file, out);
  return { file, before:buf.length, after:out.length, maps:log, meshopt:!mo && !plain }; }

// the fallback pictures appended to the binary chunk, each texture's plain source pointing at its own (the KTX2 one stays in KHR_texture_basisu)
function addFallbacks(glb, fb){ const jl = glb.readUInt32LE(12), j = JSON.parse(glb.slice(20, 20 + jl).toString()), binH = 20 + jl, bl = glb.readUInt32LE(binH), bin = glb.slice(binH + 8, binH + 8 + bl);
  const parts = [bin]; let off = bin.length; const pad = n => (4 - n % 4) % 4, idx = [];
  for(const f of fb){ const p = pad(off); if(p){ parts.push(Buffer.alloc(p)); off += p; } j.bufferViews.push({ buffer:0, byteOffset:off, byteLength:f.data.length }); parts.push(f.data); off += f.data.length;
    j.images.push({ bufferView:j.bufferViews.length - 1, mimeType:f.mime }); idx.push(j.images.length - 1); }
  const p = pad(off); if(p){ parts.push(Buffer.alloc(p)); off += p; } j.buffers[0].byteLength = off;
  for(const t of j.textures || []){ const e = t.extensions && t.extensions.KHR_texture_basisu; if(!e) continue; const im = j.images[e.source], x = im.extras && im.extras.dietFb; if(x == null) continue; t.source = idx[x]; }
  for(const im of j.images) if(im.extras){ delete im.extras.dietFb; if(!Object.keys(im.extras).length) delete im.extras; }
  let js = Buffer.from(JSON.stringify(j)); js = Buffer.concat([js, Buffer.alloc(pad(js.length), 0x20)]); const B = Buffer.concat(parts);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + B.length, 8);
  jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4E4F534A, 4); bh.writeUInt32LE(B.length, 0); bh.writeUInt32LE(0x004E4942, 4); return Buffer.concat([head, jh, js, bh, B]); }

// ---- the worker: files in, results out ----
if(process.env.DIET_WORKER){ process.on('message', async f => { let r; try{ r = await diet(f); }catch(e){ r = { file:f, error:String(e && e.message || e).slice(0, 300) }; } process.send(r); }); process.send({ ready:true }); }
else {
  const walk = (d, o = []) => { for(const f of fs.readdirSync(d)){ const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p, o) : o.push(p); } return o; };
  const files = (pos.length ? pos : [path.join(ROOT, 'assets', 'models')]).flatMap(p => fs.statSync(p).isDirectory() ? walk(path.resolve(p)) : [path.resolve(p)]).filter(f => f.endsWith('.glb') && !SKIP.test(f)).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
  const jobs = Math.max(1, +opt('--jobs', 6)), todo = [...files], res = []; let live = 0; const t0 = Date.now();
  console.log(files.length, 'files,', jobs, 'jobs');
  await new Promise(done => { for(let w = 0; w < Math.min(jobs, files.length); w++){ const c = fork(fileURLToPath(import.meta.url), args, { env:{ ...process.env, DIET_WORKER:'1' } }); live++;
    c.on('message', m => { if(!m.ready){ res.push(m); const rel = path.relative(ROOT, m.file); console.log(m.error ? 'ERR ' + rel + ': ' + m.error : m.skip ? 'skip ' + rel + ' (' + m.skip + ')' : MB(m.before) + ' → ' + MB(m.after) + ' MB  ' + rel + (m.meshopt ? '  +meshopt' : '') + '  ' + m.maps.join(', ')); }
      if(todo.length) c.send(todo.shift()); else { c.kill(); if(!--live) done(); } }); } });
  const ok = res.filter(r => r.after), b0 = ok.reduce((s, r) => s + r.before, 0), b1 = ok.reduce((s, r) => s + r.after, 0);
  console.log(`done in ${((Date.now() - t0) / 60000).toFixed(1)} min: ${ok.length} files ${MB(b0)} → ${MB(b1)} MB, ${res.filter(r => r.skip).length} skipped, ${res.filter(r => r.error).length} errors`);
  if(res.some(r => r.error)) process.exitCode = 1; }
