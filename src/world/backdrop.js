// world/backdrop.js — Z427 THE FAR RANGES: the land and the mountains kilometres away, at their true distance and height. They are drawn at the
//   sky's depth (pushed to the back of the depth range in the vertex shader: never cut by the far plane, always behind the battlefield, painted far
//   to near after the sky), so the world no longer ends 600 m out: a hazy plain runs to the horizon, and up to three ranges rise from it, each
//   farther one taller, paler and cooler (BACKDROP.biomes). Z430: at their true depth now (the far plane reaches LANDFORM.far). A range is a curtain: its foot near, its crest set back (a slope the eye reads as a
//   mountainside, lit by the sun across it), its skyline from the land's kind of relief — ridged peaks with snow, round hills, mesas with cliffs,
//   dunes, volcanic cones, karst towers, a city or a works' stacks — grouped into a few masses round the circle rather than a fence of equal bumps,
//   the biggest standing where the attack looks. Their haze is the air's (render/aerial.js): thick at the foot, thinner up the slope.
import * as THREE from 'three';
import { BACKDROP } from '../../config.js';
import { AER, AER_GLSL, MOBILE, PLAIN_DROP, SKY, landform, scene } from '../hub.js';

export const BDP = { g:null, name:null, u:{ uBdFog:{ value:new THREE.Color() }, uBdFogD:{ value:0 }, uBdTop:{ value:new THREE.Color() }, uBdNight:{ value:0 } } };
const hsh = (i, s) => { const h = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return h - Math.floor(h); };
// seamless noise round the circle: value noise on the unit circle × f
function cn(a, f, s){ const x = Math.cos(a) * f, y = Math.sin(a) * f, n2 = (i, j) => hsh(i * 57 + j * 113, s), ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (n2(ix, iy) * (1 - u) + n2(ix + 1, iy) * u) * (1 - v) + (n2(ix, iy + 1) * (1 - u) + n2(ix + 1, iy + 1) * u) * v; }
const fbm = (a, f, s, o) => { let t = 0, A = 0.5, k = 1, W = 0; for(let i = 0; i < o; i++){ t += A * cn(a, f * k, s + i * 7); W += A; A *= 0.5; k *= 2.07; } return t / W; };
const ridge = (a, f, s, o) => { let t = 0, A = 0.5, k = 1, W = 0, w = 1; for(let i = 0; i < o; i++){ let n = 1 - Math.abs(cn(a, f * k, s + i * 5) * 2 - 1); n *= n * w; w = Math.min(1, n * 2); t += A * n; W += A; A *= 0.5; k *= 2.11; } return t / W; };
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const angd = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
// the skyline of one kind of land, 0..1 at bearing a (r = the layer's radius, for the kinds made of buildings)
function profile(kind, a, s, r){
  if(kind === 'peak') return Math.pow(ridge(a, 9, s, 6), 1.25);
  if(kind === 'hill') return Math.pow(fbm(a, 6, s, 5), 1.4) * 1.25;
  if(kind === 'mesa'){ const b = fbm(a, 5, s, 5); return 0.25 * b + 0.75 * sm(0.48, 0.56, b) * (0.85 + 0.15 * fbm(a, 30, s + 3, 3)); }
  if(kind === 'dune'){ const p = a * 14 + fbm(a, 4, s, 3) * 9, w = p - Math.floor(p); return (0.35 + 0.65 * fbm(a, 3, s + 1, 4)) * Math.pow(w < 0.7 ? w / 0.7 : (1 - w) / 0.3, 1.6); }
  if(kind === 'volcano'){ let h = 0.18 * fbm(a, 8, s, 4); for(let i = 0; i < 4; i++){ const c = hsh(i, s) * Math.PI * 2, w = 0.07 + 0.05 * hsh(i + 9, s), d = angd(a, c) / w;
      if(d < 1){ const cone = Math.pow(1 - d, 1.15) * (0.6 + 0.4 * hsh(i + 3, s)); h = Math.max(h, d < 0.08 ? cone - 0.06 : cone); } } return h; }
  if(kind === 'karst'){ let h = 0.15 * fbm(a, 10, s, 3); for(let i = 0; i < 26; i++){ const c = hsh(i, s) * Math.PI * 2, w = 0.012 + 0.02 * hsh(i + 40, s), d = angd(a, c) / w; if(d < 2.5) h = Math.max(h, Math.exp(-d * d * 0.8) * (0.4 + 0.6 * hsh(i + 7, s))); } return h; }
  if(kind === 'city' || kind === 'stacks'){ const span = (kind === 'city' ? 34 : 60) / r, i = Math.floor(a / span), b = hsh(i, s), tall = kind === 'city' ? Math.pow(b, 2.2) : 0.12 + 0.2 * b;
    let h = (0.12 + 0.88 * tall) * (0.55 + 0.45 * fbm(a, 3, s, 2)); if(kind === 'stacks' && hsh(i + 77, s) > 0.86){ const f = (a / span) - i; if(f > 0.4 && f < 0.52) h = 0.75 + 0.25 * hsh(i + 5, s); } return h; }
  return fbm(a, 6, s, 4); }
// the masses: a few groups round the circle (the lead one where the attack looks), so the ranges have a rhythm instead of an even fence
function masses(a, n, s, lead){ if(!n) return 1; let e = 0;
  for(let i = 0; i < n; i++){ const c = i === 0 && lead != null ? lead : hsh(i * 3 + 1, s) * Math.PI * 2, w = 0.25 + 0.4 * hsh(i * 3 + 2, s), k = i === 0 && lead != null ? 1 : 0.55 + 0.4 * hsh(i * 3, s), d = angd(a, c) / w; e = Math.max(e, k * Math.exp(-d * d)); }
  return 0.22 + 0.78 * e; }
const VS = `varying vec3 vW; varying vec3 vN; varying vec2 vH; attribute vec2 aH;
void main(){ vW = position; vN = normal; vH = aH; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`;   // (Z430 at their true depth: the camera's far plane reaches 16 km, so ranges, islands and far sites hide one another rightly)
const FS = `uniform vec3 uCol; uniform vec3 uHi; uniform vec4 uL; uniform vec3 uBdFog; uniform float uBdFogD; uniform vec3 uBdTop; uniform float uBdNight;
varying vec3 vW; varying vec3 vN; varying vec2 vH;
${AER_GLSL}
float nh(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.55), b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.55),
  c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.55), d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.55); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
void main(){ vec3 w = vW - cameraPosition; float d = length(w); vec3 n = normalize(vN); if(dot(n, w) > 0.0) n = -n;
  float az = atan(vW.z, vW.x), g = nh(vec2(az * uL.x * 0.25, vW.y / max(uL.y, 1.0) * 6.0)) * 0.6 + nh(vec2(az * uL.x, vW.y / max(uL.y, 1.0) * 24.0)) * 0.4;   // gullies and strata
  vec3 c = uCol * (0.78 + 0.4 * g);
  float sn = uL.z > 0.0 ? smoothstep(uL.z - 0.06, uL.z + 0.04, vH.x + (g - 0.5) * 0.12) * smoothstep(-0.2, 0.4, n.y) : 0.0; c = mix(c, uHi, sn);   // snow on the high, gentle slopes
  vec3 L = mix(vec3(0.42), uBdTop, 0.35) + uAerSunC * max(dot(n, uAerSun), 0.0) * 0.85; c *= L * (1.0 - 0.55 * uBdNight);
  float foot = pow(1.0 - clamp(vH.y, 0.0, 1.0), 3.0) * 0.6, haze = clamp(uL.w + (1.0 - uL.w) * foot, 0.0, 1.0);   // thick at the foot, thinner up the slope (vH: x = height share of the range, y = up the slope)
  gl_FragColor = vec4(mix(c, aerColour(uBdFog, w, d), haze), 1.0);
}`;
const GS = `uniform vec3 uBdFog; uniform float uBdFogD; uniform float uBdNight; uniform float uPK; uniform vec3 uPC; uniform float uFloe; uniform vec3 uAerE; varying vec3 vW; varying vec3 vN; varying vec2 vH;
${AER_GLSL}
float nh(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.55), b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.55),
  c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.55), d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.55); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
// Z428 what the land shows to the horizon (LANDFORM plain): 0 land · 1 sea (ice floes) · 2 dunes · 3 savanna · 4 fields · 5 forest · 6 lava · 7 city · 8 ruins · 9 works
vec3 plainCol(vec2 p, out vec3 em){ em = vec3(0.0); float n1 = nh(p / 900.0), n2 = nh(p / 140.0), n3 = nh(p / 22.0); vec3 c = uPC;
  if(uPK < 0.5) c *= 0.82 + 0.36 * (n1 * 0.6 + n2 * 0.4);
  else if(uPK < 1.5){ c *= 0.85 + 0.25 * n2; if(uFloe > 0.5){ float f = nh(p / 55.0) * 0.7 + nh(p / 13.0) * 0.3; c = mix(c, vec3(0.8, 0.88, 0.94), smoothstep(0.64, 0.68, f)); } }
  else if(uPK < 2.5){ float s = sin((p.x * 0.8 + p.y * 0.6) / 40.0 + nh(p / 300.0) * 9.0); c *= 0.72 + 0.32 * s + 0.12 * n3; }
  else if(uPK < 3.5){ c *= 0.8 + 0.3 * n1 + 0.15 * n2; c *= 1.0 - 0.45 * smoothstep(0.8, 0.86, nh(p / 16.0)); }
  else if(uPK < 4.5){ vec2 q = p / 75.0, cl = floor(q), f = fract(q); float h = fract(sin(dot(cl, vec2(12.9898, 78.233))) * 43758.5453), e = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
    c *= mix(vec3(0.82, 0.96, 0.78), vec3(1.08, 1.02, 0.84), h) * (0.88 + 0.16 * n3) * mix(0.7, 1.0, smoothstep(0.0, 0.05, e)); }
  else if(uPK < 5.5) c *= (0.6 + 0.55 * nh(p / 7.0)) * (0.7 + 0.3 * n2);
  else if(uPK < 6.5){ float k = abs(nh(p / 45.0) - 0.5); c *= 0.7 + 0.4 * n3; em = vec3(1.6, 0.45, 0.08) * (smoothstep(0.035, 0.0, k) * (0.6 + 0.4 * n2) + smoothstep(0.82, 0.9, nh(p / 160.0)) * 0.8); }
  else { float bs = uPK < 8.5 ? 62.0 : 110.0, st = uPK < 8.5 ? 0.16 : 0.08; vec2 q = p / bs, cl = floor(q), f = fract(q); float street = step(min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)), st * 0.5);
    float h = fract(sin(dot(floor(p / 15.0), vec2(12.9898, 78.233))) * 43758.5453); c *= mix(0.65 + 0.6 * h, 0.45, street);
    if(uPK > 7.5 && uPK < 8.5) c *= 1.0 - 0.5 * smoothstep(0.6, 0.75, nh(p / 50.0));
    if(uPK > 8.5){ float t = fract(sin(dot(cl, vec2(4.1, 7.7))) * 43758.5453); c *= mix(1.0, 1.35, step(t, 0.35) * step(length(f - 0.5), 0.25)); }
    em = vec3(1.0, 0.7, 0.35) * step(0.985, h) * (1.0 - street) * uBdNight * 1.5; }
  return c; }
void main(){ vec3 w = vW - cameraPosition; float d = length(w); vec3 em;
  vec3 c = plainCol(vW.xz, em) * uAerE + em;
  if(uPK > 0.5 && uPK < 1.5){ vec3 r = reflect(w / max(d, 1.0), vec3(0.0, 1.0, 0.0)); c += uAerSunC * pow(max(dot(r, uAerSun), 0.0), 90.0) * 2.5; }   // the sun's glitter on the water
  float f = 1.0 - exp(-uBdFogD * uBdFogD * d * d * mix(1.0, uAerA.z + (1.0 - uAerA.z) * aerMean(w), uAerB.w));   // the same air the battlefield is seen through
  gl_FragColor = vec4(mix(c, aerColour(uBdFog, w, d), f), 1.0);
}`;
function mat(fs, extra){ return new THREE.ShaderMaterial({ vertexShader:VS, fragmentShader:fs, uniforms:{ ...AER.u, ...BDP.u, ...extra }, depthWrite:true, depthTest:true, fog:false, side:THREE.DoubleSide }); }
const noHit = () => {};
// one range: a ring of columns, each from its foot (near, below the plain) up its slope to its crest (set back)
function curtain(L, i, look, seed){ const [r, h0, h1, kind, n, haze] = L, seg = Math.round((kind === 'city' || kind === 'stacks' ? 2400 : 900) * (MOBILE ? 0.5 : 1)), rows = 6, P = [], N = [], H = [], idx = [];
  const lead = i < 2 ? BACKDROP.lead : null, top = new Float32Array(seg);
  for(let k = 0; k < seg; k++){ const a = k / seg * Math.PI * 2; top[k] = h0 + (h1 - h0) * masses(a, n, seed + i, lead) * profile(kind, a, seed + i * 13, r); }
  for(let k = 0; k <= seg; k++){ const a = k / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), T = top[k % seg], back = Math.min(T * 1.7, r * 0.18);
    for(let j = 0; j <= rows; j++){ const t = j / rows, rr = r - back * 0.25 + back * t, y = -h1 * 0.12 + (T + h1 * 0.12) * Math.pow(t, kind === 'city' || kind === 'stacks' ? 0.25 : 0.85);
      P.push(c * rr, y, s * rr); H.push(t * T / h1, t); } }
  for(let k = 0; k < seg; k++) for(let j = 0; j < rows; j++){ const a = k * (rows + 1) + j, b = a + rows + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aH', new THREE.Float32BufferAttribute(H, 2)); g.setIndex(idx); g.computeVertexNormals();
  const snow = kind === 'peak' || kind === 'volcano' ? BACKDROP.snow * (look.snow ?? 1) : 0;
  const m = new THREE.Mesh(g, mat(FS, { uCol:{ value:new THREE.Color(look.base).lerp(new THREE.Color(look.hi), 0.15 * i) }, uHi:{ value:new THREE.Color(look.hi) }, uL:{ value:new THREE.Vector4(seg / 40, h1, snow, haze) } }));
  m.renderOrder = -9.3 + i * 0.1; m.frustumCulled = false; m.raycast = noHit; m.userData.backdrop = kind; return m; }
// the hazy plain they stand on, from just past the near world to the horizon
const PK = { sea:1, dunes:2, savanna:3, fields:4, forest:5, lava:6, city:7, ruins:8, industry:9 };
function plain(L){ const g = new THREE.RingGeometry(L && (L.form === 'plateau' || L.form === 'flat') ? 150 : 380, BACKDROP.ground, 128, 28); g.rotateX(-Math.PI / 2); g.translate(0, -1.5, 0); g.setAttribute('aH', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  const m = new THREE.Mesh(g, mat(GS, { uPK:{ value:L ? PK[L.plain] ?? 0 : 0 }, uPC:{ value:new THREE.Color(L ? L.col : 0x808080) }, uFloe:{ value:L && L.floes ? 1 : 0 } })); m.renderOrder = -9.5; m.frustumCulled = false; m.raycast = noHit; m.userData.backdrop = 'plain'; return m; }
// (freed a while later: the stage's shader warm-up may still be compiling these materials — disposing them under it throws inside three)
export function clearBackdrop(){ if(!BDP.g) return; const g = BDP.g; scene.remove(g); BDP.g = null; BDP.name = null; setTimeout(() => g.traverse(o => { if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); }), 20000); }
// look = { base, hi } colours of the land's ranges (world/horizon.js LOOK); called when the battlefield's horizon is built
export function buildBackdrop(b, look){ if(BDP.g && BDP.name === b.name && !b.cave) return true;   // (the horizon is built again for the same land: the ranges stay)
  clearBackdrop(); if(!BACKDROP.on || b.cave || typeof window === 'undefined') return false; let L = BACKDROP.biomes[b.name] ?? BACKDROP.biomes._; if(typeof L === 'string') L = BACKDROP.biomes[L];
  const LF = landform(b), g = new THREE.Group(); g.name = 'backdrop'; BDP.g = g; BDP.name = b.name; scene.add(g); g.add(plain(LF)); if(LF && LF.form === 'plateau') g.position.y = LF.plain === 'sea' ? -LF.h + 1.5 : -LF.h - PLAIN_DROP; const seed = (b.name.charCodeAt(0) * 7 + b.name.length * 13) % 97;   // (Z428 below a plateau the land and the sea lie at the cliffs' foot)
  (MOBILE ? [L[Math.min(BACKDROP.phone, L.length - 1)]] : L).forEach((l, i) => g.add(curtain(l, MOBILE ? 1 : i, look, seed))); updateBackdrop(); return true; }
export function updateBackdrop(){ if(!BDP.g) return; const u = BDP.u; BDP.g.visible = SKY.visible;   // (underground, with the sky, it goes) if(scene.fog){ u.uBdFog.value.copy(scene.fog.color); u.uBdFogD.value = scene.fog.density || 0; }
  u.uBdTop.value.copy(SKY.material.uniforms.top.value); u.uBdNight.value = SKY.material.uniforms.night.value; }
