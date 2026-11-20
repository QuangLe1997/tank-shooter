// tools/glb-pack.mjs — Z248 GLB repacker (maintainer tool): rebuilds a .glb keeping only what is still referenced, so the game ships lean files.
//   node tools/glb-pack.mjs in.glb out.glb [--clips-only] [--clip-name NAME] [--tex SIZE] [--q QUALITY]
//   --clips-only   drop meshes / skins / materials / images: an animation-only file whose clips bind by bone name to a character loaded elsewhere
//   --clip-name    rename the (first) animation clip (Meshy names every Text-to-Motion clip "retarget_clip")
//   --tex / --q    re-encode embedded images as JPEG at most SIZE px, QUALITY (needs ImageMagick `magick`)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { execFileSync } from 'node:child_process';

const [inp, out, ...flags] = process.argv.slice(2);
const opt = (k, d) => { const i = flags.indexOf(k); return i < 0 ? d : flags[i + 1]; };
const clipsOnly = flags.includes('--clips-only'), clipName = opt('--clip-name', null), tex = +opt('--tex', 0), q = +opt('--q', 82);
const b = fs.readFileSync(inp), jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl).toString()), bin = b.slice(20 + jl + 8);
const view = i => { const v = j.bufferViews[i]; return bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };

if(clipsOnly){
  for(const k of ['meshes', 'skins', 'materials', 'textures', 'images', 'samplers', 'cameras']) delete j[k];
  for(const n of j.nodes) { delete n.mesh; delete n.skin; } }
if(clipName && j.animations && j.animations[0]) j.animations[0].name = clipName;
// --root-rx DEG --root-bone NAME: re-express that bone's translation / rotation keys under a parent turned by Rx(DEG) — Meshy's library-animation
//   files carry a Z-up armature (root Rx +90°, hips −90°) while its Text-to-Motion files are Y-up, so a motion clip bound onto the library file
//   pitches the body 90°; Rx(−90°) on the hips keys brings it into the library frame
const rootRx = opt('--root-rx', null), rootBone = opt('--root-bone', 'mixamorig:Hips');
if(rootRx != null){ const th = +rootRx * Math.PI / 180, c = Math.cos(th), s = Math.sin(th), qh = [Math.sin(th / 2), 0, 0, Math.cos(th / 2)];
  const node = j.nodes.findIndex(n => n.name === rootBone); let n = 0;
  for(const a of j.animations || []) for(const ch of a.channels){ if(ch.target.node !== node) continue; const acc = j.accessors[a.samplers[ch.sampler].output], v = j.bufferViews[acc.bufferView], o = (v.byteOffset || 0) + (acc.byteOffset || 0);
    if(acc.componentType !== 5126) throw new Error('expected float keys');
    for(let i = 0; i < acc.count; i++){
      if(ch.target.path === 'translation'){ const k = o + i * 12, y = bin.readFloatLE(k + 4), z = bin.readFloatLE(k + 8); bin.writeFloatLE(y * c - z * s, k + 4); bin.writeFloatLE(y * s + z * c, k + 8); }
      else if(ch.target.path === 'rotation'){ const k = o + i * 16, [x, y, z, w] = [0, 4, 8, 12].map(d => bin.readFloatLE(k + d)), [ax, , , aw] = qh;   // q' = qh * q (qh about X only)
        bin.writeFloatLE(aw * x + ax * w, k); bin.writeFloatLE(aw * y - ax * z, k + 4); bin.writeFloatLE(aw * z + ax * y, k + 8); bin.writeFloatLE(aw * w - ax * x, k + 12); } }
    n++; }
  if(!n) throw new Error('no keys on ' + rootBone); }

// which accessors / views are still referenced
const usedAcc = new Set(), usedView = new Set();
for(const m of j.meshes || []) for(const p of m.primitives){ for(const a of Object.values(p.attributes)) usedAcc.add(a); if(p.indices != null) usedAcc.add(p.indices); for(const t of p.targets || []) for(const a of Object.values(t)) usedAcc.add(a); }
for(const s of j.skins || []) if(s.inverseBindMatrices != null) usedAcc.add(s.inverseBindMatrices);
for(const a of j.animations || []) for(const s of a.samplers){ usedAcc.add(s.input); usedAcc.add(s.output); }
for(const i of usedAcc) usedView.add(j.accessors[i].bufferView);
for(const im of j.images || []) if(im.bufferView != null) usedView.add(im.bufferView);

// re-encode images
const newData = new Map();
if(tex) for(const im of j.images || []){ if(im.bufferView == null) continue;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'glbpack-')), src = path.join(tmp, 'in'), dst = path.join(tmp, 'out.jpg');
  fs.writeFileSync(src, view(im.bufferView)); execFileSync('magick', [src, '-resize', `${tex}x${tex}>`, '-quality', String(q), '-strip', dst]);
  newData.set(im.bufferView, fs.readFileSync(dst)); im.mimeType = 'image/jpeg'; fs.rmSync(tmp, { recursive: true }); }

// rebuild: views in order, 4-byte aligned; accessors remapped
const vMap = new Map(), views = [], parts = []; let off = 0;
[...usedView].sort((a, c) => a - c).forEach(i => { const data = newData.get(i) || view(i), v = { ...j.bufferViews[i], buffer: 0, byteOffset: off, byteLength: data.length };
  vMap.set(i, views.length); views.push(v); parts.push(data); const pad = (4 - data.length % 4) % 4; if(pad) parts.push(Buffer.alloc(pad)); off += data.length + pad; });
const aMap = new Map(), accs = [];
[...usedAcc].sort((a, c) => a - c).forEach(i => { aMap.set(i, accs.length); accs.push({ ...j.accessors[i], bufferView: vMap.get(j.accessors[i].bufferView) }); });
for(const m of j.meshes || []) for(const p of m.primitives){ for(const k in p.attributes) p.attributes[k] = aMap.get(p.attributes[k]); if(p.indices != null) p.indices = aMap.get(p.indices); for(const t of p.targets || []) for(const k in t) t[k] = aMap.get(t[k]); }
for(const s of j.skins || []) if(s.inverseBindMatrices != null) s.inverseBindMatrices = aMap.get(s.inverseBindMatrices);
for(const a of j.animations || []) for(const s of a.samplers){ s.input = aMap.get(s.input); s.output = aMap.get(s.output); }
for(const im of j.images || []) if(im.bufferView != null) im.bufferView = vMap.get(im.bufferView);
j.accessors = accs; j.bufferViews = views; j.buffers = [{ byteLength: off }];

let js = Buffer.from(JSON.stringify(j)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
const B = Buffer.concat(parts), head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + B.length, 8);
jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4E4F534A, 4); bh.writeUInt32LE(B.length, 0); bh.writeUInt32LE(0x004E4942, 4);
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, Buffer.concat([head, jh, js, bh, B]));
console.log(`${path.basename(inp)} → ${out}: ${(b.length / 1048576).toFixed(1)} MB → ${((12 + 8 + js.length + 8 + B.length) / 1048576).toFixed(1)} MB`, (j.animations || []).map(a => a.name).join(','));
