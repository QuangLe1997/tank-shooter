// render/mat-norm.js — MAT 1 ONE LIGHT FOR EVERY MODEL: the field is furnished from Poly Haven scans, Sketchfab scans, Meshy and Tripo generations and
//   hand-made pieces, and each source paints its albedo, saturation and roughness its own way — a Meshy rock twice as bright as the Poly Haven one
//   beside it, a plastic-shiny tent, a crate as saturated as a toy, a "metal" boulder that goes black against the sky. Each model file is MEASURED
//   once when it loads: its material drawn into a 16×16 tile in its own UV space (so only the atlas it really wears counts, each texel by the area it
//   covers, the map's mips doing the averaging, alpha-cut texels left out), giving its mean albedo luminance (linear), mean saturation, roughness and
//   metalness. The model's kind (config MATLOOK.norm.rules: a key pattern → stone, foliage, building, vehicle, fabric, prop; characters and guns are
//   left as made) has a band for each; whatever lies outside its band is pulled in (share k), within the gain limits. The correction is four numbers on
//   the material (userData.mn, copied with it when a field clones it) that render/blend-in.js applies in the material's own shader, before its field
//   grade: brightness × gain, saturation × sat, roughness × rough, metalness × metal. MATLOOK.norm.except: per-model overrides (skip, or its own band).
//   During a fight a newly loaded model is measured only once its maps are on the GPU anyway (PERF 4: no upload hitch); MATSW.norm / ?nomatnorm: off.
import * as THREE from 'three';
import { MATLOOK } from '../../config.js';
import { S, renderer } from '../hub.js';

const N = MATLOOK.norm, TS = 16, AT = 8, RW = TS * AT;   // a tile per material, an 8×8 atlas of tiles per read-back
const URL_OFF = typeof location !== 'undefined' && /nomatnorm/.test((location.search || '') + (location.hash || ''));
// the runtime switches of the MAT items (a probe compares before / after in one battle without a recompile)
export const MATSW = { norm:N.on && !URL_OFF, pfx:true, tile:true };
export const MN_U = { k:{ value:MATSW.norm ? 1 : 0 } };          // 0 = every material as made, 1 = normalised
export const MATN = { measured:0, reads:0, ms:0, stats:[] };
export function matSwitch(){ MN_U.k.value = MATSW.norm ? 1 : 0; for(const f of SWH) try{ f(MATSW); }catch(e){} }
const SWH = []; export const onMatSwitch = f => { SWH.push(f); };

// ---- the kind of a model, and its band ----
export function matKind(key){ if(!key) return 'skip'; const k = String(key).toLowerCase(); for(const [re, cat] of N.rules) if(k.search(re) >= 0) return cat; return N.fallback; }   // (a pattern string is a regular expression, lower case)
function bandOf(key, cat){ const E = N.except[key] || N.except[key.replace(/^sc:/, '')]; return E ? (E.skip ? null : Object.assign({}, N.cats[cat] || {}, E)) : (N.cats[cat] || null); }
const pull = (v, lo, hi) => v < lo ? lo / Math.max(v, 1e-4) : v > hi ? hi / Math.max(v, 1e-4) : 1;
// the four numbers from a measurement: brightness gain, saturation × , roughness × , metalness ×
export function matCorr(key, cat, m){ const B = bandOf(key, cat); if(!B || !m) return null; const k = B.k ?? N.k, lim = (v, a, b) => Math.min(b, Math.max(a, v));
  const gb = 1 + (pull(m.lum, B.lum[0], B.lum[1]) - 1) * k, ref = B.ref ?? Math.sqrt(B.lum[0] * B.lum[1]);   // into the band, then the kind's spread squeezed toward its middle (sq: 0 none, 1 all alike)
  const g = lim(gb * Math.pow(ref / Math.max(m.lum * gb, 1e-4), B.sq ?? N.sq), N.gain[0], N.gain[1]);
  const s = lim(1 + (pull(m.sat, B.sat[0], B.sat[1]) - 1) * k, N.satK[0], N.satK[1]);
  const r = lim(1 + (pull(m.rough, B.rough[0], B.rough[1]) - 1) * k, N.roughK[0], N.roughK[1]);
  const mt = m.metal > B.metal ? lim(B.metal / Math.max(m.metal, 1e-4), 0, 1) : 1;
  return [+g.toFixed(3), +s.toFixed(3), +r.toFixed(3), +mt.toFixed(3)]; }

// ---- the measuring pass: a material drawn in UV space (or, when its UVs tile past 0..1, its map averaged whole) ----
let _rt = null, _sc = null, _cam = null, _buf = null; const _cc = new THREE.Color(), _pc = new THREE.Color();
const VS = `varying vec2 vUv;
#ifdef MN_VC
attribute vec3 color; varying vec3 vC;
#endif
uniform mat3 uMapM; uniform float uFull;
void main(){ vec2 u = uFull > 0.5 ? position.xy * 0.5 + 0.5 : uv; vUv = (uMapM * vec3(u, 1.0)).xy;
#ifdef MN_VC
  vC = color;
#endif
  gl_Position = vec4((uFull > 0.5 ? position.xy : u * 2.0 - 1.0), 0.0, 1.0); }`;
const FS = `uniform sampler2D tMap, tRM; uniform vec3 uCol; uniform vec4 uF; uniform float uCut; varying vec2 vUv;
#ifdef MN_VC
varying vec3 vC;
#endif
void main(){ vec3 a = uCol; float al = 1.0; if(uF.x > 0.5){ vec4 t = texture2D(tMap, vUv); a *= t.rgb; al = t.a; }
#ifdef MN_VC
  a *= vC;
#endif
  if(uCut > 0.0 && al < uCut) discard;
  float r = uF.z, m = uF.w; if(uF.y > 0.5){ vec4 q = texture2D(tRM, vUv); r *= q.g; m *= q.b; }
  float mx = max(a.r, max(a.g, a.b)), mn = min(a.r, min(a.g, a.b)), l = dot(a, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor = vec4(sqrt(clamp(l, 0.0, 1.0)), mx > 1e-4 ? (mx - mn) / mx : 0.0, clamp(r, 0.0, 1.0), (1.0 + 254.0 * clamp(m, 0.0, 1.0)) / 255.0); }`;
const _mats = {}; const measMat = vc => _mats[vc] || (_mats[vc] = new THREE.ShaderMaterial({ defines:vc ? { MN_VC:'' } : {}, vertexShader:VS, fragmentShader:FS, side:THREE.DoubleSide, depthTest:false, depthWrite:false, blending:THREE.NoBlending,
  uniforms:{ tMap:{ value:null }, tRM:{ value:null }, uCol:{ value:new THREE.Color() }, uF:{ value:new THREE.Vector4() }, uCut:{ value:0 }, uMapM:{ value:new THREE.Matrix3() }, uFull:{ value:0 } } }));
const _quad = new THREE.PlaneGeometry(2, 2);
function setup(){ if(_rt) return; _rt = new THREE.WebGLRenderTarget(RW, RW, { type:THREE.UnsignedByteType, depthBuffer:false, generateMipmaps:false }); _rt.texture.minFilter = _rt.texture.magFilter = THREE.NearestFilter;
  _sc = new THREE.Scene(); _cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); _buf = new Uint8Array(RW * RW * 4); }
// do a geometry's UVs stay inside one tile of the map? (else its UV space is not its area: the map is averaged whole)
const _uvOk = new WeakMap();
function uvInside(g){ if(_uvOk.has(g)) return _uvOk.get(g); const U = g.attributes.uv; let ok = !!U;
  if(ok){ const n = U.count, st = Math.max(1, Math.floor(n / 4000)); for(let i = 0; i < n; i += st){ const u = U.getX(i), v = U.getY(i); if(u < -0.02 || u > 1.02 || v < -0.02 || v > 1.02){ ok = false; break; } } }
  _uvOk.set(g, ok); return ok; }
const texReady = t => !t || !t.isTexture || !!renderer.properties.get(t).__webglTexture;
const fight = () => S.mode === 'playing' || S.mode === 'dying';
// measure a batch of [{ m, g, key }] in one read-back (asynchronous where WebGL 2 can: no stall) → a promise of each { lum, sat, rough, metal, cover }
function measureBatch(B){ setup(); const t0 = performance.now(), R = renderer, prevRT = R.getRenderTarget(), ac = R.autoClear, cc = R.getClearColor(_pc), ca = R.getClearAlpha(), xr = R.xr.enabled;
  R.xr.enabled = false; R.autoClear = false; _rt.scissorTest = false; _rt.viewport.set(0, 0, RW, RW); R.setRenderTarget(_rt); R.setClearColor(0x000000, 0); R.clear(true, false, false);
  const mesh = new THREE.Mesh(); mesh.frustumCulled = false; _sc.add(mesh);
  B.forEach((it, i) => { const m = it.m, g = it.g, vc = !!(m.vertexColors && g.attributes.color), M = measMat(vc), U = M.uniforms, full = !uvInside(g);
    U.tMap.value = m.map || null; U.tRM.value = m.roughnessMap || m.metalnessMap || null; U.uCol.value.copy(m.color || _cc.setRGB(1, 1, 1));
    U.uF.value.set(m.map ? 1 : 0, U.tRM.value ? 1 : 0, m.roughness ?? 1, m.metalness ?? 0); U.uCut.value = m.alphaTest > 0 ? m.alphaTest : (m.map && m.alphaMap ? 0.5 : 0);
    const mt = m.map; if(mt){ if(mt.matrixAutoUpdate) mt.updateMatrix(); U.uMapM.value.copy(mt.matrix); } else U.uMapM.value.identity(); U.uFull.value = full ? 1 : 0;
    mesh.geometry = full ? _quad : g; mesh.material = M; const x = (i % AT) * TS, y = ((i / AT) | 0) * TS;
    _rt.viewport.set(x, y, TS, TS); _rt.scissor.set(x, y, TS, TS); _rt.scissorTest = true; R.setRenderTarget(_rt); R.render(_sc, _cam); });
  _sc.remove(mesh); _rt.scissorTest = false; MATN.reads++;
  let P; if(R.readRenderTargetPixelsAsync && R.capabilities.isWebGL2){ P = R.readRenderTargetPixelsAsync(_rt, 0, 0, RW, RW, _buf); const gl = R.getContext(); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null); }   // (its read is queued before it awaits: the pack buffer is let go at once, so a plain read elsewhere is not caught by it)
  else { R.readRenderTargetPixels(_rt, 0, 0, RW, RW, _buf); P = Promise.resolve(_buf); }
  R.setRenderTarget(prevRT); R.autoClear = ac; R.setClearColor(cc, ca); R.xr.enabled = xr; MATN.ms += performance.now() - t0;
  return P.then(buf => B.map((it, i) => { const x0 = (i % AT) * TS, y0 = ((i / AT) | 0) * TS; let n = 0, l = 0, s = 0, r = 0, mt = 0;
    for(let y = y0; y < y0 + TS; y++) for(let x = x0; x < x0 + TS; x++){ const o = (y * RW + x) * 4; if(!buf[o + 3]) continue; const q = buf[o] / 255; n++; l += q * q; s += buf[o + 1] / 255; r += buf[o + 2] / 255; mt += (buf[o + 3] - 1) / 254; }
    return n ? { lum:l / n, sat:s / n, rough:r / n, metal:mt / n, cover:n / (TS * TS) } : null; })); }

// ---- the queue: tag a loaded model's materials, measure them (now, or in a fight once their maps are on the GPU anyway), store the correction ----
const Q = [], CACHE = new Map(); let _qOn = false;
function apply(it, meas){ const m = it.m, key = it.key, cat = it.cat; const c = matCorr(key, cat, meas);
  if(c){ m.userData.mn = c; setU(m); }
  MATN.measured++; if(MATN.stats.length < N.keepStats) MATN.stats.push({ key, cat, mat:m.name || '', lum:+meas.lum.toFixed(3), sat:+meas.sat.toFixed(2), rough:+meas.rough.toFixed(2), metal:+meas.metal.toFixed(2), c }); }
let _reading = false;
const useCache = (it, C) => { if(C.c){ it.m.userData.mn = C.c; setU(it.m); } };
// once a frame while anything waits: a batch of up to 64 — in a fight only those whose maps are on the GPU already, else up to `up` a frame that send theirs
function flush(){ if(!Q.length){ _qOn = false; return; } if(_reading){ requestAnimationFrame(flush); return; } const busy = fight(), B = []; let up = 0;
  for(let i = 0; i < Q.length && B.length < AT * AT; ){ const it = Q[i], m = it.m, C = CACHE.get(it.ck); if(C){ Q.splice(i, 1); useCache(it, C); continue; }
    if(!(texReady(m.map) && texReady(m.roughnessMap))){ if(busy || up >= N.upFrame){ i++; continue; } up++; } Q.splice(i, 1); B.push(it); }
  if(B.length){ _reading = true; let P; try{ P = measureBatch(B); }catch(e){ console.warn('[matnorm]', e && e.message); P = Promise.resolve(B.map(() => null)); }
    P.then(res => { B.forEach((it, i) => { const C = CACHE.get(it.ck); if(C){ useCache(it, C); return; } if(res[i]){ apply(it, res[i]); CACHE.set(it.ck, { c:it.m.userData.mn || null }); } }); })
      .catch(e => console.warn('[matnorm]', e && e.message)).finally(() => { _reading = false; }); }
  if(Q.length || _reading){ _qOn = true; requestAnimationFrame(flush); } else _qOn = false; }
// a loaded glTF scene (models.js loadGLTF / world/scenery.js sceneLevel): every lit material of its static meshes, keyed by the model
export function matNormModel(root, key){ if(!N.on || URL_OFF || !root || typeof window === 'undefined') return 0; const cat = matKind(key); if(cat === 'skip') return 0; let n = 0, j = 0;
  root.traverse(o => { if(!o.isMesh || o.isSkinnedMesh || !o.geometry) return;
    for(const m of [].concat(o.material)){ if(!m || !m.isMeshStandardMaterial || m.userData.mk) continue; m.userData.mk = key; m.userData.mcat = cat; n++;
      Q.push({ m, g:o.geometry, key, cat, ck:key + '#' + (j++) }); } });
  if(n && !_qOn){ _qOn = true; requestAnimationFrame(flush); } return n; }   // (next frame: the models that came in together share a read)
// the shader side (render/blend-in.js): one uniform a material, its correction (identity until measured)
const UNI = new WeakMap(), STAGE = {};   // STAGE: this battlefield's extra gain per kind (config MATLOOK.norm.biome: desert rocks are its sand's colour)
function setU(m){ const u = UNI.get(m), c = m.userData.mn; if(!u) return; if(c) u.value.fromArray(c); else u.value.set(1, 1, 1, 1); const g = STAGE[m.userData.mcat]; if(g && c) u.value.x = Math.min(N.gain[1], c[0] * g); }
export function matNormUniform(m){ let u = UNI.get(m); if(!u){ u = { value:new THREE.Vector4(1, 1, 1, 1) }; UNI.set(m, u); setU(m); } return u; }
// a new battlefield (render/blend-in.js blendScene, before it grades the field): its kinds' gains, every material on it brought up to date
export function matNormStage(biome){ for(const k in STAGE) delete STAGE[k]; Object.assign(STAGE, (N.biome || {})[biome] || {}); }
export const matNormRefresh = m => setU(m);
export const MN_GLSL_MAP = `{ vec3 c = diffuseColor.rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); vec4 q = mix(vec4(1.0), blendN, mnK);   // MAT 1 the model's own albedo pulled into its kind's band
  diffuseColor.rgb = min(mix(vec3(l), c, q.y) * q.x, vec3(1.0)); }`;
export const MN_GLSL_ROUGH = `roughnessFactor = clamp(roughnessFactor * mix(1.0, blendN.z, mnK), 0.0, 1.0);`;
export const MN_GLSL_METAL = `metalnessFactor = clamp(metalnessFactor * mix(1.0, blendN.w, mnK), 0.0, 1.0);`;
// the spread of what was measured (a probe: before → after, the field's models one light)
export function matNormReport(){ const L = MATN.stats.filter(s => s.c), sd = a => { const m = a.reduce((x, y) => x + y, 0) / Math.max(1, a.length); return { mean:+m.toFixed(3), sd:+Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / Math.max(1, a.length)).toFixed(3) }; };
  const by = {}; for(const s of L){ (by[s.cat] = by[s.cat] || []).push(s); }
  const cats = {}; for(const c in by){ const A = by[c]; cats[c] = { n:A.length, lum:sd(A.map(s => s.lum)), lumAfter:sd(A.map(s => Math.min(1, s.lum * s.c[0]))), sat:sd(A.map(s => s.sat)), satAfter:sd(A.map(s => s.sat * s.c[1])),
    rough:sd(A.map(s => s.rough)), roughAfter:sd(A.map(s => Math.min(1, s.rough * s.c[2]))), metal:sd(A.map(s => s.metal)), metalAfter:sd(A.map(s => s.metal * s.c[3])) }; }
  return { measured:MATN.measured, reads:MATN.reads, ms:+MATN.ms.toFixed(1), cats }; }
