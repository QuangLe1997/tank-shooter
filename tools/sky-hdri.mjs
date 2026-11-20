// tools/sky-hdri.mjs — Z255 photographed skies (maintainer tool; the game never loads it). For every sky in config SKY_PHOTO it fetches Poly Haven's
// 4K pure-sky HDRI (CC0), finds where the sun / moon is (the brightest spot: its azimuth in the image and its elevation), exposes the image so the
// upper sky sits at a fixed mid-grey, writes it as JPEG (4K for desktop, 2K for phones) into assets/sky/<name>{,_2k}.jpg, and records
// { sunU, sunEl, hor (the horizon colour, for the fog), exposure } in assets/sky/skies.json
//   node tools/sky-hdri.mjs
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), OUT = path.join(ROOT, 'assets', 'sky');
const { SKY_PHOTO } = await import(path.join(ROOT, 'config.js'));
const UA = { 'User-Agent':'steel-siege-asset-tool' }, metaF = path.join(OUT, 'skies.json'), meta = fs.existsSync(metaF) ? JSON.parse(fs.readFileSync(metaF, 'utf8')) : {};
fs.mkdirSync(OUT, { recursive:true });
const names = [...new Set(Object.values(SKY_PHOTO.tod).concat(Object.values(SKY_PHOTO.mood || {})))];
for(const name of names){
  if(meta[name] && fs.existsSync(path.join(OUT, name + '.jpg'))) { console.log('have', name); continue; }
  const files = await (await fetch('https://api.polyhaven.com/files/' + name, { headers:UA })).json(), f = files.hdri && files.hdri['4k'] && files.hdri['4k'].hdr;
  if(!f){ console.log('SKIP (no 4k hdr)', name); continue; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sky-')), hdr = path.join(tmp, 'in.hdr'), raw = path.join(tmp, 'g.raw');
  fs.writeFileSync(hdr, Buffer.from(await (await fetch(f.url, { headers:UA })).arrayBuffer()));
  // luminance at 512×256 as float: the brightest texel is the sun / moon; the mean of the upper sky sets the exposure
  const W = 512, H = 256; execFileSync('magick', [hdr, '-filter', 'Box', '-resize', W + 'x' + H + '!', '-colorspace', 'Gray', '-define', 'quantum:format=floating-point', '-depth', '32', '-endian', 'LSB', 'GRAY:' + raw]);   // Box: no ringing round the sun
  const rb = fs.readFileSync(raw), L = new Float32Array(rb.buffer.slice(rb.byteOffset, rb.byteOffset + rb.length));; let mi = 0, sum = 0, n = 0;   // (a small file sits inside Node's shared pool)
  for(let i = 0; i < L.length; i++){ if(L[i] > L[mi]) mi = i; const y = Math.floor(i / W); if(y > H * 0.08 && y < H * 0.42){ sum += L[i]; n++; } }
  const sx = mi % W, sy = Math.floor(mi / W), mean = sum / n, k = SKY_PHOTO.midGrey / mean;
  const sunU = (sx + 0.5) / W, sunEl = (0.5 - (sy + 0.5) / H) * Math.PI;
  for(const [suffix, size] of [['', '4096x2048'], ['_2k', '2048x1024']])
    execFileSync('magick', [hdr, '-resize', size + '!', '-colorspace', 'RGB', '-evaluate', 'multiply', String(k), '-colorspace', 'sRGB', '-quality', '86', '-strip', path.join(OUT, name + suffix + '.jpg')]);
  const hor = execFileSync('magick', [path.join(OUT, name + '_2k.jpg'), '-crop', '2048x24+0+488', '-resize', '1x1!', '-format', '%[fx:r],%[fx:g],%[fx:b]', 'info:']).toString().split(',').map(Number);
  meta[name] = { sunU:+sunU.toFixed(4), sunEl:+sunEl.toFixed(4), hor:hor.map(v => +v.toFixed(3)), exposure:+k.toFixed(4) };
  fs.rmSync(tmp, { recursive:true });
  console.log('got', name, JSON.stringify(meta[name]), (fs.statSync(path.join(OUT, name + '.jpg')).size / 1048576).toFixed(2) + ' MB');
}
fs.writeFileSync(metaF, JSON.stringify(meta, null, 1) + '\n');
