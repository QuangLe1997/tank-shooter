// tools/ground-photos.mjs — Z250 photo-scanned ground materials (maintainer tool; the game never loads it). For every set named in
// config GROUND_PHOTO it fetches Poly Haven's 1K glTF texture set (CC0): base colour, OpenGL normal, ARM (AO / roughness / metal), recompresses
// them with ImageMagick into assets/ground/<set>/{diff,nor,arm}.jpg and records each set's real-world size in assets/ground/sizes.json
//   node tools/ground-photos.mjs            (skips sets already on disk)
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), OUT = path.join(ROOT, 'assets', 'ground');
const { GROUND_PHOTO } = await import(path.join(ROOT, 'config.js'));
const sets = [...new Set(Object.values(GROUND_PHOTO.biomes).flat().concat(GROUND_PHOTO.extra || []))];   // Z259 + the stone sets for pyramids and cliffs
const sizesF = path.join(OUT, 'sizes.json'), sizes = fs.existsSync(sizesF) ? JSON.parse(fs.readFileSync(sizesF, 'utf8')) : {};
const UA = { 'User-Agent': 'steel-siege-asset-tool' };
for(const name of sets){
  const dir = path.join(OUT, name); if(fs.existsSync(path.join(dir, 'arm.jpg')) && sizes[name]) { console.log('have', name); continue; }
  const info = await (await fetch('https://api.polyhaven.com/info/' + name, { headers:UA })).json(), files = await (await fetch('https://api.polyhaven.com/files/' + name, { headers:UA })).json();
  const pick = k => files[k] && files[k]['1k'] && (files[k]['1k'].jpg || files[k]['1k'].png);
  const src = { diff:pick('Diffuse'), nor:pick('nor_gl'), arm:pick('arm') };
  if(!src.diff || !src.nor || !src.arm){ console.log('SKIP (missing maps)', name, Object.keys(files).join(',')); continue; }
  fs.mkdirSync(dir, { recursive:true }); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-'));
  for(const [k, f] of Object.entries(src)){ const raw = path.join(tmp, k); fs.writeFileSync(raw, Buffer.from(await (await fetch(f.url, { headers:UA })).arrayBuffer()));
    execFileSync('magick', [raw, '-resize', '1024x1024>', '-quality', k === 'diff' ? '82' : '88', '-strip', path.join(dir, k + '.jpg')]); }
  fs.rmSync(tmp, { recursive:true });
  const dm = info.dimensions || [2000, 2000]; sizes[name] = +(Math.max(dm[0], dm[1]) / 1000).toFixed(2);   // metres the tile covers
  console.log('got', name, sizes[name] + ' m', (fs.readdirSync(dir).reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0) / 1048576).toFixed(2) + ' MB');
}
fs.writeFileSync(sizesF, JSON.stringify(sizes, null, 1) + '\n');
