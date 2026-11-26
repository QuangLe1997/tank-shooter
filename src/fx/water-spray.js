// fx/water-spray.js — HSWIM 2 WATER THAT READS AS WATER (config HSWIM2): the splash of a boot, a stroke or a swimming horse's chest was a few puffs of the
//   smoke layer — soft white cotton balls up close. Now it is water, in three parts:
//   · SPRAY: thin drops, each drawn as a streak along its own flight (a camera-facing ribbon stretched by its speed; one instanced draw, its own shader, no
//     texture), flying under gravity and gone where they fall back into the river.
//   · THE CROWN: a thin, see-through, streaked sheet of water thrown up round the spot — an open, flared ring that rises and falls back in under half a second.
//   · WHITE WATER on the surface: a ragged patch of foam that spreads and thins away where it broke (the wakes leave the same patches instead of smoke
//     puffs), and the ripple rings drawn with a soft edge instead of a hard white line — both in one instanced draw lying on the water.
//   All of it is lit as the scene is (the sun and the sky: dull at dusk, dark at night), drawn without writing depth, held in fixed pools (nothing allocates a
//   frame) and ticked once a frame (game/loop.js updateWaterSpray). game/swim.js routes its splash / ring / wake here (the soldier's steps and strokes, the
//   horse's hooves and its chest: game/horse-swim.js); HSWIM2.on false: the old puffs.
import * as THREE from 'three';
import { HSWIM2, SWIM } from '../../config.js';
import { MOBILE, PERF, RIVER, ambient, hemi, scene, sun } from '../hub.js';

const C = HSWIM2, rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const U = { uCol:{ value:new THREE.Color() } };   // the water's white × the light on it (shared by the three layers)
export const WSPRAY = { drops:0, sheets:0, flats:0, spawned:0, ms:0, n:0 };   // (the probe: what is alive, what it costs)

// ---- the spray: per drop [x y z] [vx vy vz] [width, alpha]; CPU-flown (a few hundred at most), the shader lays the ribbon ----
const DV = `attribute vec3 iP; attribute vec3 iV; attribute vec2 iA; uniform float uStr; varying vec2 vUv; varying float vA;
void main(){ float sp = length(iV); vec3 ax = sp > 0.01 ? iV / sp : vec3(0.0, 1.0, 0.0), toC = normalize(cameraPosition - iP), sd = cross(ax, toC); float sl = length(sd);
  sd = sl > 1e-4 ? sd / sl : vec3(1.0, 0.0, 0.0); float len = iA.x * 1.5 + sp * uStr;
  vec3 p = iP + sd * position.x * iA.x + ax * (position.y - 0.4) * len;   // (the head at the drop, the streak trailing behind it)
  vUv = uv; vA = iA.y; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`;
const DF = `uniform vec3 uCol; varying vec2 vUv; varying float vA;
void main(){ vec2 q = vUv * 2.0 - 1.0; float x = abs(q.x), core = 1.0 - smoothstep(0.0, 0.55, x), a = (1.0 - x * x) * (1.0 - smoothstep(0.5, 1.0, abs(q.y))) * mix(0.45, 1.0, smoothstep(-1.0, 0.6, q.y));
  if(a * vA < 0.004) discard; gl_FragColor = vec4(uCol * (0.82 + 0.4 * core), a * vA * (0.5 + 0.5 * core)); }`;
// ---- the surface: per mark [x y z] [r, turn, alpha, kind 0 foam / 1 ring] — flat on the water ----
const FV = `attribute vec3 iP; attribute vec4 iS; varying vec2 vUv; varying vec2 vK; varying vec2 vSeed;
void main(){ float c = cos(iS.y), s = sin(iS.y); vec2 xz = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * iS.x;
  vUv = position.xy * 2.0; vK = iS.zw; vSeed = iP.xz; gl_Position = projectionMatrix * viewMatrix * vec4(iP.x + xz.x, iP.y, iP.z + xz.y, 1.0); }`;
const FF = `uniform vec3 uCol; uniform float uEdge; varying vec2 vUv; varying vec2 vK; varying vec2 vSeed;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
void main(){ float r = length(vUv), a;
  if(vK.y > 0.5){ a = smoothstep(1.0 - uEdge * 2.5, 1.0 - uEdge, r) * (1.0 - smoothstep(1.0 - uEdge, 1.0, r)); }   // a ripple: a soft band at its rim
  else { vec2 p = vUv * 3.2 + vSeed * 0.37; float f = n2(p) * 0.6 + n2(p * 2.7 + 7.1) * 0.4;   // foam: lacy blotches, densest in a ring, thin in the middle
    a = smoothstep(0.48, 0.78, f) * (1.0 - smoothstep(0.62, 1.0, r)) * (0.35 + 0.65 * smoothstep(0.1, 0.7, r)); }
  a *= vK.x; if(a < 0.004) discard; gl_FragColor = vec4(uCol, a); }`;
// ---- the crown: an open flared ring, streaked, its rim ragged — one mesh each (a handful at most), its own uniforms ----
const SV = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SF = `uniform vec3 uCol; uniform float uT, uOp, uSeed; varying vec2 vUv;
float h(float x){ return fract(sin(x * 12.9898 + uSeed * 78.233) * 43758.5453); }
void main(){ float cx = vUv.x * 38.0, col = floor(cx), fx = abs(fract(cx) - 0.5), on = step(0.38, h(col)), wd = 0.1 + 0.22 * h(col + 17.0);   // (about two streaks in three, each its own width…)
  float cut = 0.25 + 0.75 * h(col + 91.0) * (1.0 - uT * 0.45), line = on * (1.0 - smoothstep(wd * 0.5, wd, fx)) * (1.0 - smoothstep(cut - 0.3, cut, vUv.y));   // (…and its own height: a ragged rim)
  float film = 0.16 * (1.0 - smoothstep(0.0, 0.5, vUv.y)), a = max(line * (0.55 + 0.45 * h(col + 5.0)), film) * smoothstep(0.0, 0.07, vUv.y) * uOp;   // (between them a thin film at the foot)
  if(a < 0.004) discard; gl_FragColor = vec4(uCol * (0.9 + 0.25 * line), a); }`;

let D = null, F = null, SH = null;   // (built on the first splash)
function layer(geo, attrs, max, vs, fs, order, extra){ const g = new THREE.InstancedBufferGeometry(); g.index = geo.index; g.setAttribute('position', geo.attributes.position); g.setAttribute('uv', geo.attributes.uv);
  const A = {}; for(const [k, n] of attrs){ A[k] = new THREE.InstancedBufferAttribute(new Float32Array(max * n), n).setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, A[k]); } g.instanceCount = 0;
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms:Object.assign({}, U, extra || {}), vertexShader:vs, fragmentShader:fs, transparent:true, depthWrite:false, side:THREE.DoubleSide }));
  m.frustumCulled = false; m.renderOrder = order; scene.add(m); return { g, m, A, max }; }
function build(){ const k = MOBILE ? 0.5 : 1;
  D = layer(new THREE.PlaneGeometry(1, 1), [['iP', 3], ['iV', 3], ['iA', 2]], Math.round(C.drops.max * k), DV, DF, 6, { uStr:{ value:C.drops.stretch } });
  D.L = new Float32Array(D.max * 2); D.n = 0;   // life left, life
  F = layer(new THREE.PlaneGeometry(1, 1), [['iP', 3], ['iS', 4]], Math.round(C.foam.max * k), FV, FF, 4, { uEdge:{ value:C.ring.edge } });
  F.T = new Float32Array(F.max * 6); F.n = 0;   // t 0–1, 1/life, r0, r1, op, kind
  const cg = new THREE.CylinderGeometry(1, 0.34, 1, 24, 1, true);   // (flared: thrown up and out) cg.translate(0, 0.5, 0);
  SH = []; for(let i = 0; i < Math.max(2, Math.round(C.sheet.max * k)); i++){ const u = { uCol:U.uCol, uT:{ value:0 }, uOp:{ value:0 }, uSeed:{ value:Math.random() * 100 } };
    const m = new THREE.Mesh(cg, new THREE.ShaderMaterial({ uniforms:u, vertexShader:SV, fragmentShader:SF, transparent:true, depthWrite:false, side:THREE.DoubleSide }));
    m.visible = false; m.frustumCulled = false; m.renderOrder = 5; scene.add(m); SH.push({ m, u, t:1, r0:0, r1:0, h:0 }); } }

// ---- a splash of size s (≈ 0.3 a toe in the shallows … 1 a swimmer's stroke … 2 a hoof at a gallop): spray, a crown, foam ----
export function waterSplash(x, z, s, up){ if(!C.on) return; if(!D) build(); const y = RIVER.y + 0.03, q = Math.sqrt(s), P = PERF.parts < 1 ? PERF.parts : 1; WSPRAY.spawned++;
  const nd = Math.max(3, Math.round(C.drops.n * s * P)), dc = C.drops, ua = up == null ? 1 : Math.min(up, 1.5);   // (a gallop's hoof throws it no higher than ~1.5 m)
  for(let i = 0; i < nd && D.n < D.max; i++){ const j = D.n++, a = Math.random() * 6.283, h = rnd(0.25, 1.1) * q, v = rnd(dc.v[0], dc.v[1]) * ua * (0.55 + 0.45 * q);
    const r0 = rnd(0.02, 0.12) * q, P3 = D.A.iP.array, V3 = D.A.iV.array; P3[j * 3] = x + Math.cos(a) * r0; P3[j * 3 + 1] = y + rnd(0, 0.05); P3[j * 3 + 2] = z + Math.sin(a) * r0; V3[j * 3] = Math.cos(a) * h; V3[j * 3 + 1] = v; V3[j * 3 + 2] = Math.sin(a) * h;
    D.A.iA.array[j * 2] = rnd(dc.w[0], dc.w[1]) * (0.8 + 0.3 * q); D.A.iA.array[j * 2 + 1] = 0; const l = rnd(dc.life[0], dc.life[1]); D.L[j * 2] = l; D.L[j * 2 + 1] = l; }
  if(s >= C.sheet.min){ let sh = SH.find(o => o.t >= 1); if(sh){ const S2 = C.sheet; sh.t = 0; sh.r0 = S2.r[0] * q; sh.r1 = S2.r[1] * q; sh.h = clamp(rnd(S2.h[0], S2.h[1]) * q * Math.sqrt(ua), 0.1, S2.h[1] * 1.3); sh.u.uSeed.value = Math.random() * 100;
    sh.m.position.set(x, RIVER.y - 0.02, z); sh.m.rotation.y = Math.random() * 6.283; sh.m.visible = true; } }
  mark(x, z, C.foam.r[0] * q, C.foam.r[1] * q, rnd(C.foam.life[0], C.foam.life[1]), C.foam.op * clamp(0.6 + 0.4 * s, 0.6, 1.2), 0); }
// ---- white water left on the surface (a wake's patch, bubbles breaking): r m from r0 to r1 over life s ----
export function waterFoam(x, z, r0, r1, life, op){ if(!C.on) return; if(!D) build(); mark(x, z, r0, r1, life, op, 0); }
// ---- a ripple ring (game/swim.js ring): spreads over SWIM.fx.ringR in SWIM.fx.ringT s, its edge soft ----
export function waterRing(x, z){ if(!C.on) return; if(!D) build(); const R0 = SWIM.fx; mark(x, z, R0.ringR[0], R0.ringR[1], R0.ringT, R0.ringOp * C.ring.op, 1); }
function mark(x, z, r0, r1, life, op, kind){ if(F.n >= F.max) return; const j = F.n++, P3 = F.A.iP.array, S4 = F.A.iS.array; P3[j * 3] = x; P3[j * 3 + 1] = RIVER.y + 0.02 + (j % 8) * 0.0005; P3[j * 3 + 2] = z; S4[j * 4] = r0; S4[j * 4 + 1] = Math.random() * 6.283; S4[j * 4 + 2] = 0; S4[j * 4 + 3] = kind;
  F.T[j * 6] = 0; F.T[j * 6 + 1] = 1 / Math.max(0.05, life); F.T[j * 6 + 2] = r0; F.T[j * 6 + 3] = r1; F.T[j * 6 + 4] = op; F.T[j * 6 + 5] = kind; }

// ---- every frame (game/loop.js): fly the drops, spread the marks, raise and drop the crowns, light it all; the live ones packed at the front ----
export function updateWaterSpray(dt){ if(!D) return; const t0 = performance.now(); dt = Math.min(dt, 0.05);
  const L = C.light; U.uCol.value.setHex(C.col);   // the light on the water: the sun's share and the sky's, as the scene has them now
  { const k = sun.intensity * L.sun, kh = hemi.intensity * L.sky, ka = ambient.intensity * L.sky, c = U.uCol.value;
    c.setRGB(clamp(c.r * (sun.color.r * k + hemi.color.r * kh + ambient.color.r * ka), L.min, L.max), clamp(c.g * (sun.color.g * k + hemi.color.g * kh + ambient.color.g * ka), L.min, L.max), clamp(c.b * (sun.color.b * k + hemi.color.b * kh + ambient.color.b * ka), L.min, L.max)); }
  const P = D.A.iP.array, V = D.A.iV.array, A = D.A.iA.array, g = C.drops.grav, wy = RIVER.y; let n = 0;
  for(let i = 0; i < D.n; i++){ let l = D.L[i * 2] - dt; const ml = D.L[i * 2 + 1];
    V[i * 3 + 1] += g * dt; P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
    if(P[i * 3 + 1] < wy && V[i * 3 + 1] < 0) l = 0;   // back into the river
    if(l <= 0) continue; const e = ml - l;
    if(n !== i){ P[n * 3] = P[i * 3]; P[n * 3 + 1] = P[i * 3 + 1]; P[n * 3 + 2] = P[i * 3 + 2]; V[n * 3] = V[i * 3]; V[n * 3 + 1] = V[i * 3 + 1]; V[n * 3 + 2] = V[i * 3 + 2]; A[n * 2] = A[i * 2]; D.L[n * 2 + 1] = ml; }
    D.L[n * 2] = l; A[n * 2 + 1] = C.drops.op * Math.min(1, e / 0.04) * Math.min(1, l / 0.15); n++; }
  D.n = n; flush(D, n, ['iP', 'iV', 'iA']);
  const T = F.T, FP = F.A.iP.array, FS = F.A.iS.array; let m = 0;
  for(let i = 0; i < F.n; i++){ const t = T[i * 6] + dt * T[i * 6 + 1]; if(t >= 1) continue;
    if(m !== i){ for(let k = 0; k < 6; k++) T[m * 6 + k] = T[i * 6 + k]; FP[m * 3] = FP[i * 3]; FP[m * 3 + 1] = FP[i * 3 + 1]; FP[m * 3 + 2] = FP[i * 3 + 2]; FS[m * 4 + 1] = FS[i * 4 + 1]; FS[m * 4 + 3] = FS[i * 4 + 3]; }
    T[m * 6] = t; const e = 1 - (1 - t) * (1 - t), ring = T[m * 6 + 5] > 0.5;
    FS[m * 4] = T[m * 6 + 2] + (T[m * 6 + 3] - T[m * 6 + 2]) * e; FS[m * 4 + 2] = T[m * 6 + 4] * (ring ? (1 - t) * (1 - t) : Math.min(1, t * 12) * (1 - t) * (1 - t * 0.4)); m++; }
  F.n = m; flush(F, m, ['iP', 'iS']);
  let ns = 0; for(const sh of SH){ if(sh.t >= 1) continue; sh.t = Math.min(1, sh.t + dt / C.sheet.life); const t = sh.t, e = 1 - Math.pow(1 - t, 2.2), r = sh.r0 + (sh.r1 - sh.r0) * e;
    const hh = sh.h * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.1)), 0.65) + 0.02; sh.m.scale.set(r, hh, r); sh.u.uT.value = t; sh.u.uOp.value = C.sheet.op * Math.min(1, t * 10) * Math.pow(1 - t, 1.3);
    if(t >= 1) sh.m.visible = false; else ns++; }
  WSPRAY.drops = n; WSPRAY.flats = m; WSPRAY.sheets = ns; WSPRAY.ms += performance.now() - t0; WSPRAY.n++; }
function flush(Ly, n, keys){ Ly.g.instanceCount = n; if(!n) return; for(const k of keys){ const a = Ly.A[k]; a.needsUpdate = true; a.clearUpdateRanges(); a.addUpdateRange(0, n * a.itemSize); } }
// dev / test: what is alive now, the cost a frame
export function waterSprayProbe(){ return { drops:WSPRAY.drops, sheets:WSPRAY.sheets, flats:WSPRAY.flats, spawned:WSPRAY.spawned, msAvg:WSPRAY.n ? +(WSPRAY.ms / WSPRAY.n).toFixed(4) : 0, col:D ? U.uCol.value.toArray().map(v => +v.toFixed(2)) : null }; }
