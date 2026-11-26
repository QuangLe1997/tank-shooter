// fx/fire-fx.js — FIRE 1 THE FIRE / SMOKE PARTICLE LAYER: every flame, fireball, dust and smoke puff of the new effects (fx/blasts.js) in one instanced buffer.
//   · a particle is written ONCE, at its birth: where, how fast, when it is born (it may be scheduled seconds ahead — a column that keeps rising, a crater
//     that smokes for ten seconds, a patch of ground that burns), how long it lives. The vertex shader flies it from those numbers (drag, buoyancy or
//     gravity, the wind sheared by height, a slow curl), so a frame costs the CPU nothing per particle — only the upload of what was born since the last.
//   · colour over life comes from a ramp (config FIREFX.ramps: the temperature ramp — white-yellow heart, orange body, deep red, then soot), read further
//     along at a puff's thin rim than in its dense heart: a fireball has a hot core and dark sooty edges, and turns to smoke from the outside in.
//   · size over life: it swells early and holds; it fades by THINNING as it swells (opacity ∝ size^−thin), not by shrinking.
//   · the sprites are a sheet of noise-shaped puffs, wisps, flame tongues, a flash, a dot and a clod made here at start (no image files), each drawn at a
//     random turn and flip: no two puffs match. A puff carries its own bumps (a normal in the sheet), so the sun lights one side of it and leaves the
//     other in shade whichever way it is turned; at night it is dark but for the fires near it (FIREFX.lights of them, the brightest).
//   · ONE blend for flame and smoke (premultiplied: a flame adds its light, soot covers what is behind it, and one particle goes from the first to the
//     second), drawn in two layers — smoke and dust under, flame over — so smoke never glows. Two draw calls in all, none when nothing is alive.
//   · soft against the ground: a puff fades out over FIREFX.soft m above the ground it was born on instead of being cut by it (the scene's depth is in
//     the multisampled target being drawn to — it cannot be read there — so the fade is by height, not by depth).
//   · a hard budget (FIREFX.max live + scheduled): past FIREFX.thin of it the cheap kinds are dropped more and more often, the heart of an effect never.
//   · the old spawnPart smoke and fire (every caller in the game) are drawn here too (fxShim) — the same puffs, lit, on the same budget. ?oldfx: none of it.
import * as THREE from 'three';
import { FIREFX } from '../../config.js';
import { MOBILE, NIGHT, PERF, S, SUN_DIR, WX, ambient, gradePass, heightAt, hemi, scene, sun } from '../hub.js';

const F = FIREFX, MAX = MOBILE ? F.maxMobile : F.max, STR = 32, NL = F.lights;
export const FX = { on:F.on && !(typeof location !== 'undefined' && /oldfx/.test(location.search + location.hash)), live:0, peak:0, born:0, dropped:0, cur:0, d0:MAX, d1:-1, hi:-1 };
export const fireFxOn = () => FX.on;
export function fireFxSet(on){ FX.on = !!on && F.on; }                 // (a probe compares the two looks in one battle)
export const fireFxLive = () => FX.live;
export const fxTier = n => Math.max(1, Math.round(n * (MOBILE ? F.tierMobile : 1)));   // a phone's share of a count

// ---- the sprite sheet: R = density, G / B = the puff's own slope (a normal, for the light), A = fine grain ----
const hsh = (x, y, s) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vn(x, y, s){ const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), a = hsh(ix, iy, s), b = hsh(ix + 1, iy, s), c = hsh(ix, iy + 1, s), d = hsh(ix + 1, iy + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy; }
function fbm(x, y, s, o){ let v = 0, a = 0.5, f = 1, n = 0; for(let i = 0; i < o; i++){ v += a * vn(x * f, y * f, s + i * 17); n += a; a *= 0.5; f *= 2.03; } return v / n; }
const sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function cellShape(c, u, v){ const s = 100 + c * 31;   // → [density, height for the slope, grain]
  if(c < 9){ const wisp = c >= 7, wx = u + (fbm(u * 1.6 + 7, v * 1.6, s, 3) - 0.5) * 0.55, wy = v + (fbm(u * 1.6, v * 1.6 + 3, s + 5, 3) - 0.5) * 0.55, r = wisp ? Math.hypot(wx * 0.8, wy * 1.9) : Math.hypot(wx, wy);
    const lobe = fbm(u * 1.7 + 11, v * 1.7 + 5, s + 9, 2), bil = 0.7 * lobe + 0.3 * (1 - Math.abs(2 * fbm(u * 3.2 + 3, v * 3.2 + 8, s + 21, 2) - 1)), d = (1 - r) * (wisp ? 1.15 : 1.35) + (lobe - 0.5) * (wisp ? 1.3 : 1);   // big lobes; the creases where two of them meet are in its relief (the light), not cut into its density
    const den = sst(0, wisp ? 0.9 : 0.8, d) * sst(1, 0.84, Math.hypot(u, v)) * (wisp ? 0.85 : 1);   // (a soft rim: smoke, not cotton wool)
    return [den, (0.85 * Math.sqrt(Math.max(0, 1 - r * r)) + 0.6 * bil) * Math.sqrt(den), fbm(u * 6, v * 6, s + 33, 3)]; }
  if(c < 13){ const y = (v + 1) / 2, tongue = (x0, hgt, lean, sd) => { const yy = y / hgt; if(yy >= 1) return 0; const n = fbm(u * 2.5, yy * 3 + c * 7, sd, 4), xw = u - x0 + (n - 0.5) * 1.1 * Math.pow(yy, 0.8) + lean * yy * yy,
        w = Math.max(1e-4, 0.5 * Math.pow(1 - yy, 0.8) * (0.75 + 0.5 * fbm(yy * 3, c * 1.3, sd + 3, 2))), er = fbm(u * 4.5, yy * 4.5 - c * 3, sd + 7, 3) + (1 - yy) * 0.5;   // a tongue: wide at the root, bent by the turbulence rising through it, eaten into toward its tip
      return sst(w, w * 0.25, Math.abs(xw)) * sst(0, 0.07, yy) * sst(1, 0.55, yy) * sst(0.3 + 0.3 * yy, 0.6 + 0.2 * yy, er) * (1 - 0.4 * yy); };
    const b = Math.max(tongue(-0.12, 1, 0.35 - 0.25 * (c & 1) * 2, s), tongue(0.28, 0.62, -0.3, s + 50) * 0.9, tongue(-0.4, 0.45, 0.25, s + 90) * 0.8);   // three licks of different heights, leaning apart
    return [b * sst(1, 0.86, Math.abs(u)), 0, fbm(u * 6, v * 6, s + 33, 3)]; }
  const r = Math.hypot(u, v);
  if(c === 13){ const rw = r * (0.8 + 0.5 * fbm(u * 2 + 4, v * 2, s, 3)), a = Math.atan2(v, u); let f = Math.exp(-rw * rw * 5.5);   // a flash: a blown-out, uneven blot of light, a few faint streaks out of it
    for(let i = 0; i < 11; i++){ const ai = i / 11 * 6.2832 + hsh(i, 3, s) * 0.5, len = 0.45 + hsh(i, 5, s) * 0.5, wd = 0.04 + hsh(i, 7, s) * 0.05; let da = Math.abs(a - ai) % 6.2832; if(da > 3.1416) da = 6.2832 - da;
      f += Math.exp(-(da / wd) * (da / wd)) * Math.pow(Math.max(0, 1 - r / len), 1.5) * 0.35; } return [Math.min(1, f) * sst(1, 0.9, r), 0, 0.5]; }
  if(c === 14) return [Math.max(0, (Math.exp(-r * r * 5.5) - 0.0041) / 0.9959), 0, 0.5];   // a soft dot (sparks, embers, a glow)
  return [sst(0, 0.1, 0.5 + (fbm(u * 2 + 3, v * 2, s, 3) - 0.5) * 0.8 - r), 0, fbm(u * 5, v * 5, s + 3, 2)]; }   // a clod: a hard, uneven lump
function makeAtlas(){ const G = F.atlas.grid, N = MOBILE ? F.atlas.cellMobile : F.atlas.cell, W = G * N, px = new Uint8Array(W * W * 4), H = new Float32Array(N * N), D = new Float32Array(N * N), A = new Float32Array(N * N);
  for(let c = 0; c < G * G; c++){ const cx = (c % G) * N, cy = ((c / G) | 0) * N;
    for(let j = 0; j < N; j++) for(let i = 0; i < N; i++){ const q = cellShape(c, (i + 0.5) / N * 2 - 1, (j + 0.5) / N * 2 - 1), k = j * N + i; D[k] = q[0]; H[k] = q[1]; A[k] = q[2]; }
    for(let j = 0; j < N; j++) for(let i = 0; i < N; i++){ const k = j * N + i, o = ((cy + j) * W + cx + i) * 4; let nx = 0, ny = 0;
      if(c < 9){ const sc = N * 0.17; nx = -(H[j * N + Math.min(N - 1, i + 1)] - H[j * N + Math.max(0, i - 1)]) * sc; ny = -(H[Math.min(N - 1, j + 1) * N + i] - H[Math.max(0, j - 1) * N + i]) * sc; const L = Math.hypot(nx, ny, 1); nx /= L; ny /= L; }
      px[o] = Math.round(D[k] * 255); px[o + 1] = Math.round((nx * 0.5 + 0.5) * 255); px[o + 2] = Math.round((ny * 0.5 + 0.5) * 255); px[o + 3] = Math.round(Math.max(0, Math.min(1, A[k])) * 255); } }
  const t = new THREE.DataTexture(px, W, W, THREE.RGBAFormat, THREE.UnsignedByteType); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t; }
// ---- the ramps: two rows each (colour + opacity · glow share), 64 wide, half-float so a dark soot does not band ----
const RAMP = {}, RW = 64; { let i = 0; for(const k in F.ramps) RAMP[k] = i++; }
function makeRamps(){ const names = Object.keys(F.ramps), rows = names.length * 2, d = new Uint16Array(RW * rows * 4), hf = THREE.DataUtils.toHalfFloat, c0 = new THREE.Color(), c1 = new THREE.Color();
  names.forEach((nm, r) => { const st = F.ramps[nm];
    for(let x = 0; x < RW; x++){ const t = x / (RW - 1); let j = 0; while(j < st.length - 2 && t > st[j + 1][0]) j++; const a = st[j], b = st[j + 1], f = Math.max(0, Math.min(1, (t - a[0]) / Math.max(1e-6, b[0] - a[0])));
      c0.setHex(a[1]); c1.setHex(b[1]); c0.lerp(c1, f); const o = (r * 2 * RW + x) * 4, o2 = ((r * 2 + 1) * RW + x) * 4;
      d[o] = hf(c0.r); d[o + 1] = hf(c0.g); d[o + 2] = hf(c0.b); d[o + 3] = hf(a[2] + (b[2] - a[2]) * f); d[o2] = hf(a[3] + (b[3] - a[3]) * f); d[o2 + 1] = d[o2 + 2] = 0; d[o2 + 3] = hf(1); } });
  const t = new THREE.DataTexture(d, RW, rows, THREE.RGBAFormat, THREE.HalfFloatType); t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true; return { t, rows }; }
// ---- the kinds, resolved once ----
export const FXK = {};
for(const k in F.kinds){ const q = F.kinds[k]; FXK[k] = { row:RAMP[q.ramp], c0:q.cells[0], cn:q.cells[1], layer:q.layer || 0, drag:q.drag || 0, dragY:q.dragY || 0, grav:q.grav || 0, s0:q.s[0], s1:q.s[1], grow:q.grow || 1, thin:q.thin || 0, cool:q.cool || 0, sit:q.sit || 0,
  turb:q.turb || 0, wind:q.wind || 0, hot:q.hot || 1, op:q.op ?? 1, stretch:q.stretch || 0, spin:q.spin || 0, up:q.up || 0, prio:q.prio ?? 1 }; }

// ---- the buffer and its two meshes ----
const BUF = new Float32Array(MAX * STR), DIE = new Float32Array(MAX), _rm = makeRamps();
const U = { uNow:{ value:0 }, uSoft:{ value:F.soft }, uFogD:{ value:0 }, uFogC:{ value:new THREE.Color() }, uWind:{ value:new THREE.Vector2() }, uSunDir:{ value:SUN_DIR }, uSunC:{ value:new THREE.Color() }, uAmbC:{ value:new THREE.Color() },
  uWrap:{ value:F.light.wrap }, uHot:{ value:F.hot.day }, uAtlas:{ value:makeAtlas() }, uRamp:{ value:_rm.t }, uRampN:{ value:_rm.rows }, uFL:{ value:[] }, uFC:{ value:[] } };
for(let i = 0; i < NL; i++){ U.uFL.value.push(new THREE.Vector4(0, 0, 0, 1)); U.uFC.value.push(new THREE.Vector3()); }
export const FX_U = U;
const VS = `uniform float uNow, uLayer, uSoft, uFogD; uniform vec2 uWind; uniform vec3 uSunDir; uniform vec4 uFL[${NL}]; uniform vec3 uFC[${NL}];
attribute vec4 aP, aV, aT, aS, aK, aC, aX, aY;
varying vec2 vUv; varying vec4 vA; varying vec3 vTint, vFire, vL, vM;
void main(){ float age = uNow - aT.x;
  if(age < 0.0 || age >= aT.y || abs(aX.x - uLayer) > 0.5){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float k = age / aT.y, e = exp(-aT.z * age), f = aT.z > 0.001 ? (1.0 - e) / aT.z : age, vy;
  vec3 p = aP.xyz; p.xz += aV.xz * f;
  if(aT.w > 0.001){ float ey = exp(-aT.w * age), fy = (1.0 - ey) / aT.w; p.y += aV.y * fy + aC.w / aT.w * (age - fy); vy = aV.y * ey + aC.w / aT.w * (1.0 - ey); }
  else { p.y += aV.y * age + 0.5 * aC.w * age * age; vy = aV.y + aC.w * age; }
  p.xz += uWind * (aX.w * age * (0.35 + 0.65 * clamp((p.y - aP.w) / 8.0, 0.0, 1.0)));                                   // the wind, stronger higher up: a column leans and shears
  float sd = aV.w * 61.0; p += vec3(sin(sd + age * 1.3), 0.5 * sin(sd * 1.7 + age * 0.9), cos(sd * 1.3 + age * 1.1)) * (aX.z * sqrt(age));   // a slow curl
  float sz = mix(aS.x, aS.y, 1.0 - pow(1.0 - k, aY.x));
  p.y = max(p.y, aP.w + sz * aY.w + 0.02);
  vec3 cr = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), cu = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float fl = fract(aV.w * 7.31) < 0.5 ? -1.0 : 1.0, c = 1.0, s = 0.0; vec2 q;
  if(aX.y > 0.0){ vec2 d = (viewMatrix * vec4(aV.x * e, vy, aV.z * e, 0.0)).xy; float L = length(d); d = L > 0.001 ? d / L : vec2(1.0, 0.0);                // a spark, a jet of fuel: drawn out along its flight
    q = d * (position.x * sz * (1.0 + aX.y * L)) + vec2(-d.y, d.x) * (position.y * sz); c = d.x; s = d.y; }
  else { float r = aS.z + aS.w * age; c = cos(r); s = sin(r); q = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * sz; }
  vec3 wp = p + cr * q.x + cu * q.y;
  vUv = (vec2(mod(aK.y, 4.0), floor(aK.y / 4.0)) + 0.02 + vec2(fl < 0.0 ? 1.0 - uv.x : uv.x, uv.y) * 0.96) * 0.25;
  vec3 sv = (viewMatrix * vec4(uSunDir, 0.0)).xyz; vL = vec3((c * sv.x + s * sv.y) * fl, c * sv.y - s * sv.x, sv.z);                                       // the sun, in the turned sprite's own frame
  vec3 fire = vec3(0.0); for(int i = 0; i < ${NL}; i++){ vec3 d = uFL[i].xyz - p; float a = max(0.0, 1.0 - dot(d, d) / (uFL[i].w * uFL[i].w)); fire += uFC[i] * a * a; } vFire = fire;
  vec4 mv = viewMatrix * vec4(wp, 1.0); float dd = uFogD * length(mv.xyz);
  vM = vec3(sz > 0.45 ? (wp.y - aP.w) / max(min(uSoft, sz * 0.35), 0.01) : 1.0, 1.0 - exp(-dd * dd), aK.x);
  vA = vec4(k, aK.z * pow(aS.x / max(sz, 1e-4), aY.y), aK.w, aY.z); vTint = aC.rgb;
  gl_Position = projectionMatrix * mv; }`;
const FS = `uniform sampler2D uAtlas, uRamp; uniform float uRampN, uWrap, uHot; uniform vec3 uSunC, uAmbC, uFogC;
varying vec2 vUv; varying vec4 vA; varying vec3 vTint, vFire, vL, vM;
void main(){ vec4 t = texture2D(uAtlas, vUv); float den = t.r, u = clamp(vA.x + ((1.0 - den) + (t.a - 0.5) * 0.8) * vA.w, 0.0, 0.995), row = vM.z * 2.0;   // further along the ramp at the thin rim and in the grain's cool streaks: a hot heart, sooty edges, a mottled ball
  vec4 rc = texture2D(uRamp, vec2(u, (row + 0.5) / uRampN)); float em = texture2D(uRamp, vec2(u, (row + 1.5) / uRampN)).r;
  float a = min(1.0, den * rc.a * vA.y) * clamp(vM.x, 0.0, 1.0); if(a < 0.004) discard;
  vec2 n2 = t.gb * 2.0 - 1.0; float L = clamp(dot(vec3(n2, sqrt(max(0.0, 1.0 - dot(n2, n2)))), normalize(vL)) * 0.5 + 0.5, 0.0, 1.0);
  vec3 body = vTint * rc.rgb * (uSunC * (uWrap + (1.0 - uWrap) * L) + uAmbC + vFire * (0.6 + 0.4 * den)) * ((0.8 + 0.4 * t.a) * (1.0 - em) * (1.0 - em));   // what covers is soot: the less it still glows, the more of its own colour it shows
  vec3 glow = vTint * rc.rgb * (vA.z * uHot * (0.55 + 0.9 * den));
  float cov = a * (1.0 - em);
  gl_FragColor = vec4(mix(body, uFogC, vM.y) * cov + glow * (a * em * (1.0 - vM.y)), cov); }`;
const _ib = new THREE.InstancedInterleavedBuffer(BUF, STR, 1).setUsage(THREE.DynamicDrawUsage), _geo = new THREE.InstancedBufferGeometry();
{ const base = new THREE.PlaneGeometry(1, 1); _geo.index = base.index; _geo.setAttribute('position', base.attributes.position); _geo.setAttribute('uv', base.attributes.uv);
  ['aP', 'aV', 'aT', 'aS', 'aK', 'aC', 'aX', 'aY'].forEach((n, i) => _geo.setAttribute(n, new THREE.InterleavedBufferAttribute(_ib, 4, i * 4))); _geo.instanceCount = 0; }
const mkMesh = (layer, order) => { const m = new THREE.Mesh(_geo, new THREE.ShaderMaterial({ uniforms:Object.assign({ uLayer:{ value:layer } }, U), vertexShader:VS, fragmentShader:FS, transparent:true, depthWrite:false,
  blending:THREE.CustomBlending, blendEquation:THREE.AddEquation, blendSrc:THREE.OneFactor, blendDst:THREE.OneMinusSrcAlphaFactor, blendSrcAlpha:THREE.OneFactor, blendDstAlpha:THREE.OneMinusSrcAlphaFactor }));
  m.frustumCulled = false; m.renderOrder = order; m.visible = false; scene.add(m); return m; };
export const FX_MESH = [mkMesh(0, 5.5), mkMesh(1, 7.5)];   // smoke and dust over the old smoke layer, flame over the old fire layer

// ---- birth ----
const _c = new THREE.Color();
function put(K, x, y, z, vx, vy, vz, s0, s1, life, delay, tint, op, gy, drag, dragY, grav){ const now = U.uNow.value;
  if(K.prio < 2){ const T = F.thin, ld = FX.live / MAX; let pk = ld <= T[0] ? 1 : ld >= T[1] ? 0 : 1 - (ld - T[0]) / (T[1] - T[0]); if(K.prio === 1) pk = 0.4 + 0.6 * pk; else pk *= Math.min(1, PERF.parts);   // the cheap kinds go first, more of them the fuller the budget (and when the frame governor says so)
    if(pk < 1 && Math.random() > pk){ FX.dropped++; return -1; } }
  let i = -1; for(let n = 0; n < 64; n++){ const j = FX.cur; FX.cur = j + 1 < MAX ? j + 1 : 0; if(DIE[j] <= now){ i = j; break; } } if(i < 0){ FX.dropped++; return -1; }
  const born = now + (delay || 0), B = BUF, o = i * STR; DIE[i] = born + life; FX.live++; FX.born++; if(i > FX.hi) FX.hi = i; if(i < FX.d0) FX.d0 = i; if(i > FX.d1) FX.d1 = i;
  B[o] = x; B[o + 1] = y; B[o + 2] = z; B[o + 3] = gy; B[o + 4] = vx; B[o + 5] = vy; B[o + 6] = vz; B[o + 7] = Math.random();
  B[o + 8] = born; B[o + 9] = life; B[o + 10] = drag; B[o + 11] = dragY; B[o + 12] = s0; B[o + 13] = s1; B[o + 14] = K.up ? (Math.random() - 0.5) * 0.5 : Math.random() * 6.2832; B[o + 15] = K.spin ? (Math.random() - 0.5) * 2 * K.spin : 0;
  B[o + 16] = K.row; B[o + 17] = K.c0 + ((Math.random() * K.cn) | 0); B[o + 18] = op; B[o + 19] = K.hot;
  if(tint == null){ B[o + 20] = B[o + 21] = B[o + 22] = 1; } else { _c.setHex(tint); B[o + 20] = _c.r; B[o + 21] = _c.g; B[o + 22] = _c.b; } B[o + 23] = grav;
  B[o + 24] = K.layer; B[o + 25] = K.stretch; B[o + 26] = K.turb; B[o + 27] = K.wind; B[o + 28] = K.grow; B[o + 29] = K.thin; B[o + 30] = K.cool; B[o + 31] = K.sit; return i; }
// one particle of a kind (FIREFX.kinds): at (x, y, z) with velocity v, `size` m (× the kind's start / end), living `life` s from `delay` s on; tint = a colour
//   over its ramp (dust takes the ground's), opK × its opacity, gy = the ground under it (given by an effect that already knows it)
export function fxp(kind, x, y, z, vx, vy, vz, size, life, delay, tint, opK, gy){ const K = FXK[kind]; if(!K || !FX.on || !(x === x && y === y && z === z)) return -1;
  return put(K, x, y, z, vx, vy, vz, size * K.s0, size * K.s1, life, delay, tint, K.op * (opK ?? 1), gy ?? heightAt(x, z), K.drag, K.dragY, K.grav); }
// the old particle system's smoke puff / fire puff (fx/particles.js spawnPart), drawn by this layer: true = taken
const fireLike = h => { const r = (h >> 16) & 255, g = (h >> 8) & 255, b = h & 255; return r > 150 && r >= g && g >= b * 0.9; };
export function fxShim(x, y, z, vx, vy, vz, o){ if(!FX.on) return false; const sz = o.size || 1, gr = o.grow || 0, life = o.life || 0.6;
  if(o.smoke){ if(!F.shim.smoke) return false; put(FXK.shimSmoke, x, y, z, vx, vy, vz, sz * 0.6, sz * 1.4 + gr, life, 0, o.color ?? 0xffd27a, 0.5 * (o.op ?? 1) * F.shim.op, heightAt(x, z), o.drag ?? 2.5, 0, o.grav ?? -9); return true; }
  if(o.tex === 'fire' && F.shim.fire && fireLike(o.color ?? 0xffd27a)){ put(FXK.shimFire, x, y, z, vx, vy, vz, sz, sz * 0.55 + gr, life, 0, null, o.op ?? 1, heightAt(x, z), o.drag ?? 2.5, 0, o.grav ?? -9); return true; }
  return false; }

// ---- the fires' light on smoke (and on nothing else: the ground's glow is fx/cinematic.js blastLight / fireLight) ----
const LT = []; for(let i = 0; i < 12; i++) LT.push({ t:0, t0:1, x:0, y:0, z:0, r:0, g:0, b:0, p:0, rad:1, fl:0, key:null, ph:i * 1.7 });
// a light at (x, y, z): colour, power, reach m, for life s; fl = how fast it flickers (0: a flash that dies away); key = one light kept alive by its owner
export function fxLight(x, y, z, hex, power, rad, life, fl, key){ if(!FX.on) return; let L = null; if(key) for(const q of LT) if(q.key === key && q.t > 0){ L = q; break; }
  if(!L){ let w = 1e9; for(const q of LT){ const v = q.t > 0 ? q.p * q.t / q.t0 : -1; if(v < w){ w = v; L = q; } } }
  _c.setHex(hex); L.x = x; L.y = y; L.z = z; L.r = _c.r; L.g = _c.g; L.b = _c.b; L.p = power; L.rad = rad; L.t = L.t0 = life; L.fl = fl || 0; L.key = key || null; }
const _top = [];
function lightsFrame(dt, now){ _top.length = 0; for(const q of LT){ if(q.t <= 0) continue; q.t -= dt; if(q.t <= 0) continue; const k = q.t / q.t0;
    q.i = q.p * (q.fl ? Math.min(1, k * 4) * (0.72 + 0.2 * Math.sin(now * q.fl + q.ph) + 0.08 * Math.sin(now * q.fl * 2.7 + q.ph * 3)) : k * k); _top.push(q); }
  _top.sort((a, b) => b.i - a.i);
  for(let i = 0; i < NL; i++){ const q = _top[i], P = U.uFL.value[i], C = U.uFC.value[i]; if(q){ P.set(q.x, q.y, q.z, q.rad); C.set(q.r, q.g, q.b).multiplyScalar(q.i * F.light.fire); } else { P.set(0, -1e4, 0, 1); C.set(0, 0, 0); } } }

// ---- a blast felt: the exposure kick at once (light is instant), the shake by distance — and, far off, when the blast wave gets there ----
const SHK = [];
export function blastFeel(x, z, power){ const p = S.player; if(!p || !(power > 0)) return; const C = F.feel, d = Math.hypot(p.pos.x - x, p.pos.z - z), att = 1 / (1 + (d / C.near) * (d / C.near)), fu = gradePass.uniforms.flash;
  if(fu) fu.value = Math.min(C.flashMax, fu.value + C.flash * att * Math.min(1.5, power));
  const sh = power * att; if(sh < 0.02) return; if(d <= C.instant || SHK.length >= 24) S.shake = Math.min(C.shakeMax, (S.shake || 0) + sh); else SHK.push({ at:U.uNow.value + d / C.sound, sh }); }

// once a frame (game/loop.js, with the old particles): the clock, what was born since the last frame up to the GPU, the light the puffs take
const _lc = new THREE.Color();
export function updateFireFX(dt){ const now = (U.uNow.value += dt); let live = 0, hi = -1; for(let i = 0, n = FX.hi + 1; i < n; i++) if(DIE[i] > now){ live++; hi = i; }
  FX.live = live; FX.hi = hi; if(live > FX.peak) FX.peak = live; _geo.instanceCount = hi + 1; FX_MESH[0].visible = FX_MESH[1].visible = live > 0;
  if(FX.d1 >= FX.d0){ _ib.clearUpdateRanges(); _ib.addUpdateRange(FX.d0 * STR, (FX.d1 - FX.d0 + 1) * STR); _ib.needsUpdate = true; FX.d0 = MAX; FX.d1 = -1; }
  for(let i = SHK.length - 1; i >= 0; i--) if(SHK[i].at <= now){ S.shake = Math.min(F.feel.shakeMax, (S.shake || 0) + SHK[i].sh); SHK[i] = SHK[SHK.length - 1]; SHK.pop(); }
  lightsFrame(dt, now); if(!live) return;
  const L = F.light, night = NIGHT.on || S.tod === 'night', nk = night ? L.night : 1; U.uSunC.value.copy(sun.color).multiplyScalar(sun.intensity * L.sun * nk);
  U.uAmbC.value.copy(hemi.color).multiplyScalar(hemi.intensity * L.amb * nk).add(_lc.copy(ambient.color).multiplyScalar(ambient.intensity * L.amb * nk));
  U.uHot.value = night ? F.hot.night : F.hot.day; if(scene.fog){ U.uFogC.value.copy(scene.fog.color); U.uFogD.value = scene.fog.density || 0; }
  const w = WX.wind, wl = Math.hypot(w.x, w.y) || 1, wk = Math.min(F.wind.max, wl * F.wind.k) / wl; U.uWind.value.set(w.x * wk, w.y * wk); }
// a stage ends / restarts: nothing scheduled outlives it
export function clearFireFX(){ DIE.fill(0); FX.live = 0; FX.hi = -1; _geo.instanceCount = 0; FX_MESH[0].visible = FX_MESH[1].visible = false; SHK.length = 0; for(const q of LT) q.t = 0; }
