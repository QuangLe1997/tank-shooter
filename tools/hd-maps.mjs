// tools/hd-maps.mjs — Z395 NEAR DETAIL (maintainer tool): the sharp maps a model wears up close, cut from its original download.
//   Every model the game ships was packed small (tools/city-props.mjs pack, tools/glb-pack.mjs --tex: 1K maps, half the triangles). Its original —
//   the Tripo / Meshy file in assets/models/tripo|meshy (git-ignored, 4K / 2K maps) or a community download in ~/Downloads — has the same UV atlas,
//   so its maps fit the shipped mesh as they are. This writes them at --tex px as WebP: assets/models/real/hd/<key>.<material>.<slot>.webp
//   (slot: map = base colour, nrm = normal; mr = metal-roughness only with --mr), checking first that the original's base colour IS the shipped one
//   (32×32 thumbnails compared; a different atlas is refused). src/render/near-detail.js swaps them in while the camera is near.
//   node tools/hd-maps.mjs [key ...] --deps <dir> [--orig <dir>]   (--orig: where the originals live, default assets/models — a worktree has none; dir: npm i --prefix <dir> @gltf-transform/core@4 @gltf-transform/extensions@4 meshoptimizer sharp)
//   table: tools/hd-maps.json — key: { file: the shipped GLB under assets/models/real, src: the original (a folder under assets/models, searched for a
//   .glb, or a path; ~ = home), tex: px (default 2048), geo: also its whole shape → hd/<key>.glb (the original welded, simplified only to geo
//   triangles when geo > 0, meshopt-compressed; its own maps cut to 256 px — the sharp ones are the WebP files) for what the game draws whole up close }
//   Z397 maps: only those slots (['map']: a big piece whose sharp colour carries the detail, its normal kept at the shipped size — half the GPU memory)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { createRequire } from 'node:module';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; }, deps = opt('--deps', null);
if(!deps){ console.error('--deps <dir> needed (see the header)'); process.exit(1); }
const req = createRequire(path.resolve(deps, 'package.json')), { NodeIO } = req('@gltf-transform/core'), { ALL_EXTENSIONS, EXTMeshoptCompression } = req('@gltf-transform/extensions'), F = req('@gltf-transform/functions'), { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } = req('meshoptimizer'), sharp = req('sharp');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), OUT = path.join(ROOT, 'assets', 'models', 'real', 'hd');
const TABLE = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'hd-maps.json'), 'utf8')), mr = args.includes('--mr');
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]); const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder':MeshoptDecoder, 'meshopt.encoder':MeshoptEncoder });
const tris = doc => doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((t, p) => t + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
const findGLB = p => { p = p.replace(/^~/, os.homedir()); if(!path.isAbsolute(p)) p = path.join(opt('--orig', path.join(ROOT, 'assets', 'models')), p); if(fs.statSync(p).isFile()) return p;
  const all = fs.readdirSync(p, { recursive:true }).filter(f => /\.glb$/i.test(f)).map(f => path.join(p, f));
  return all.find(f => /refine\.model_urls/.test(f)) || all.find(f => /(^|\/)model\.glb$/.test(f)) || all[0]; };
const thumb = async buf => sharp(buf).resize(32, 32, { fit:'fill' }).removeAlpha().raw().toBuffer();
const diff = (a, b) => { let s = 0; for(let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length / 255; };
const slots = m => ({ map:m.getBaseColorTexture(), nrm:m.getNormalTexture(), ...(mr ? { mr:m.getMetallicRoughnessTexture() } : {}) });
fs.mkdirSync(OUT, { recursive:true });
const keys = args.filter((a, i) => !a.startsWith('--') && !(i && args[i - 1].startsWith('--'))), report = [];
for(const k of keys.length ? keys : Object.keys(TABLE).filter(k => !k.startsWith('_'))){ const S = TABLE[k]; if(!S){ console.log(k, 'not in the table'); continue; }
  const t0 = Date.now(), lite = await io.read(path.join(ROOT, 'assets', 'models', 'real', S.file + '.glb')), src = findGLB(S.src), orig = await io.read(src);
  const LM = lite.getRoot().listMaterials(), OM = orig.getRoot().listMaterials(), tex = S.tex || 2048, line = { key:k, src:path.relative(os.homedir(), src), out:[] };
  for(let mi = 0; mi < LM.length; mi++){ const ls = slots(LM[mi]); if(!ls.map) continue;
    // the original's material wearing this atlas (by index, else the best-matching base colour)
    const lt = await thumb(Buffer.from(ls.map.getImage())); let best = null;
    for(const om of OM){ const ot = om.getBaseColorTexture(); if(!ot) continue; const d = diff(lt, await thumb(Buffer.from(ot.getImage()))); if(!best || d < best.d) best = { om, d }; }
    if(!best || best.d > (S.maxDiff || 0.06)){ line.out.push({ mi, refused:best ? +best.d.toFixed(3) : 'no maps' }); continue; }
    const os2 = slots(best.om);
    for(const [s, t] of Object.entries(os2)){ if(!t || !ls[s] || (S.maps && !S.maps.includes(s))) continue; const img = sharp(Buffer.from(t.getImage())), meta = await img.metadata(), px = Math.min(tex, meta.width);
      const shipped = (await sharp(Buffer.from(ls[s].getImage())).metadata()).width; if(px <= shipped) continue;   // (already that sharp)
      const f = path.join(OUT, `${k}.${mi}.${s}.webp`); await img.resize(px, px, { kernel:'lanczos3' }).webp({ quality:s === 'map' ? 86 : 90, smartSubsample:true, effort:5 }).toFile(f);
      line.out.push({ mi, s, px, from:meta.width, shipped, kb:Math.round(fs.statSync(f).size / 1024), d:+best.d.toFixed(3) }); } }
  if(S.geo != null){ const doc = await io.read(src), n0 = tris(doc); await doc.transform(F.prune(), F.dedup(), F.weld());   // the whole shape, for up close
    if(S.geo > 0 && tris(doc) > S.geo) await doc.transform(F.simplify({ simplifier:MeshoptSimplifier, ratio:S.geo / tris(doc), error:0.01 }));
    await doc.transform(F.textureCompress({ encoder:sharp, targetFormat:'jpeg', resize:[256, 256], quality:80 }), F.prune());
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method:EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    await doc.transform(F.reorder({ encoder:MeshoptEncoder }), F.quantize()); const f = path.join(OUT, k + '.glb'); fs.writeFileSync(f, await io.writeBinary(doc));
    line.geo = { from:n0, tris:Math.round(tris(doc)), shipped:Math.round(tris(lite)), kb:Math.round(fs.statSync(f).size / 1024) }; }
  line.sec = +((Date.now() - t0) / 1000).toFixed(1); report.push(line); console.log(JSON.stringify(line)); }
// the index the game reads (render/near-detail.js): key → the maps it has, '<material>.<slot>' — rebuilt from what is on disk
const IX = {}; for(const f of fs.readdirSync(OUT).filter(f => /\.(webp|glb)$/.test(f)).sort()){ const m = f.match(/^(.+)\.(\d+)\.(\w+)\.webp$/), g = f.match(/^(.+)\.glb$/);
  if(m) (IX[m[1]] = IX[m[1]] || []).push(m[2] + '.' + m[3]); else if(g) (IX[g[1]] = IX[g[1]] || []).push('geo'); }   // ('geo': hd/<key>.glb, the whole shape)
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(IX, null, 0).replace(/\],/g, '],\n') + '\n');
