// fx/footfall.js — LIGHT 1 GROUNDED: the soldier stands IN the world. A soft contact shade (the sky the body hides from the ground) under every joint
//   that touches the ground — the soles, a knee down, the hips and chest when he lies prone, the hands — and a broad faint one under the whole body;
//   a boot print pressed into soft ground (sand, snow, earth) at every footfall, fading after a while; a small kick of dust off dry ground. The men
//   round the camera (enemy infantry, our fireteam) get the body shade and stride prints too. Two instanced draws in all (shades, prints); the dust
//   goes through the fire / smoke layer (fx/fire-fx.js fxp 'dust'). Also: the uniform's roughness map is remapped (cloth, not plastic).
import * as THREE from 'three';
import { GROUNDED, LOOK } from '../../config.js';
import { BIOME, CV, FT, MOBILE, S, SUN_DIR, UGRID, GRASS_PUSH, WX, afxSurfaceAt, camera, fxp, heightAt, scene, sun, unitsNear, wetAt } from '../hub.js';

const G = GROUNDED;
// ---- one instanced quad kind, laid on the ground's slope: iP = (x, y, z, alpha), iD = (dir x, dir z, length, width), iN = the ground's normal ----
const VS = `attribute vec4 iP; attribute vec4 iD; attribute vec3 iN; varying vec2 vUv; varying float vA;
  void main(){ vec3 n = normalize(iN), d = vec3(iD.x, 0.0, iD.y); d = normalize(d - n * dot(d, n)); vec3 b = cross(n, d);
    vec3 p = iP.xyz - d * (position.z * iD.z) + b * (position.x * iD.w) + n * ${G.lift.toFixed(3)}; vUv = uv; vA = iP.w;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`;
function layer(N, fs, uniforms, order){ const base = new THREE.PlaneGeometry(1, 1); base.rotateX(-Math.PI / 2); const g = new THREE.InstancedBufferGeometry(); g.index = base.index;
  g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  const mk = n => new THREE.InstancedBufferAttribute(new Float32Array(N * n), n).setUsage(THREE.DynamicDrawUsage), iP = mk(4), iD = mk(4), iN = mk(3);
  g.setAttribute('iP', iP); g.setAttribute('iD', iD); g.setAttribute('iN', iN); g.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader:VS, fragmentShader:fs, transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-8 });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = order; mesh.castShadow = mesh.receiveShadow = false; mesh.name = 'footfall'; scene.add(mesh);
  return { N, g, iP, iD, iN, n:0, mesh }; }
// the contact shade: a soft elliptical falloff, black (it only takes away the sky's light)
const SHADE_FS = `uniform float uK; varying vec2 vUv; varying float vA; void main(){ vec2 q = vUv * 2.0 - 1.0; float r2 = dot(q, q); if(r2 >= 1.0) discard;
  float a = vA * uK * (exp(-r2 * 2.6) - 0.0743) / 0.9257; gl_FragColor = vec4(0.0, 0.0, 0.0, a); }`;
// a boot print: r = the pressed-down sole (darker), g = the ridge of sand pushed up round it (catches the light)
const PRINT_FS = `uniform sampler2D map; uniform vec3 uRim; uniform float uK; varying vec2 vUv; varying float vA; void main(){ vec4 t = texture2D(map, vUv);
  float d = t.r * ${G.print.dark.toFixed(3)}, r = t.g * ${G.print.rim.toFixed(3)}, a = (d + r) * vA * uK; if(a < 0.004) discard; gl_FragColor = vec4(uRim * (r / max(d + r, 1e-3)), a); }`;
function printTex(){ const W = 64, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const sole = (pad, fill) => { x.fillStyle = fill; x.beginPath(); x.ellipse(32, 94, 15 + pad, 22 + pad, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(33, 40, 19 + pad, 30 + pad, 0.05, 0, 7); x.fill(); x.beginPath(); x.ellipse(32, 68, 14 + pad, 18 + pad, 0, 0, 7); x.fill(); };
  const a = document.createElement('canvas'); a.width = W; a.height = H; const y = a.getContext('2d');   // rim: a soft ring round the sole
  x.filter = 'blur(3px)'; sole(5, '#fff'); x.filter = 'none'; x.globalCompositeOperation = 'destination-out'; sole(0, '#fff'); x.globalCompositeOperation = 'source-over';
  y.drawImage(c, 0, 0); x.clearRect(0, 0, W, H);
  x.filter = 'blur(1px)'; sole(0, 'rgba(255,255,255,0.75)'); x.filter = 'none';   // the sole pressed in, its lugs deeper
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(255,255,255,0.95)'; for(let r = 14; r < 120; r += 9){ x.fillRect(12, r, 40, 4); } x.globalCompositeOperation = 'source-over';
  const P = x.getImageData(0, 0, W, H), R = y.getImageData(0, 0, W, H), o = x.createImageData(W, H);
  for(let i = 0; i < P.data.length; i += 4){ o.data[i] = P.data[i + 3]; o.data[i + 1] = R.data[i + 3]; o.data[i + 2] = 0; o.data[i + 3] = 255; }
  x.putImageData(o, 0, 0); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; }

export const FOOT = { shade:null, print:null, prints:[], cur:0, rimC:new THREE.Color(), on:false, sk:null, skAt:-9, J:null, feet:[{ up:true, t:0 }, { up:true, t:0 }], n:{ prints:0, dust:0, shades:0 }, mats:new WeakSet() };
export function initFootfall(){ if(FOOT.on || typeof document === 'undefined' || !G.on) return; FOOT.on = true;
  FOOT.shade = layer(MOBILE ? G.capShadeM : G.capShade, SHADE_FS, { uK:{ value:1 } }, -1);
  FOOT.print = layer(MOBILE ? G.print.capM : G.print.cap, PRINT_FS, { map:{ value:printTex() }, uRim:{ value:FOOT.rimC }, uK:{ value:1 } }, -2); }
export function clearFootfall(){ FOOT.prints.length = 0; FOOT.cur = 0; if(FOOT.print) FOOT.print.g.instanceCount = 0; if(FOOT.shade) FOOT.shade.g.instanceCount = 0; FOOT.sk = null; }

// ---- the ground's normal under (x, z) ----
const _n = new THREE.Vector3();
function normalAt(x, z, y){ const e = 0.35; _n.set(y - heightAt(x + e, z), e, y - heightAt(x, z + e)).normalize(); return _n; }
function putQuad(L, x, y, z, a, dx, dz, len, wid, nx, ny, nz){ if(L.n >= L.N) return; const i = L.n++, P = L.iP.array, D = L.iD.array, N = L.iN.array;
  P[i * 4] = x; P[i * 4 + 1] = y; P[i * 4 + 2] = z; P[i * 4 + 3] = a; D[i * 4] = dx; D[i * 4 + 1] = dz; D[i * 4 + 2] = len; D[i * 4 + 3] = wid; N[i * 3] = nx; N[i * 3 + 1] = ny; N[i * 3 + 2] = nz; }
// a contact shade under a point h m over the ground: full at h0, gone at h1
function shade(x, z, h, h0, h1, a, dx, dz, len, wid, gy){ const k = h <= h0 ? 1 : h >= h1 ? 0 : 1 - (h - h0) / (h1 - h0); if(k <= 0.01) return; const y = gy ?? heightAt(x, z), n = normalAt(x, z, y);
  const s = 1 + Math.max(0, h) * G.spread; putQuad(FOOT.shade, x, y, z, a * k * k, dx, dz, len * s, wid * s, n.x, n.y, n.z); }

// ---- boot prints and the kick: the ground under a footfall decides (sand, earth, grass, snow; mud = wet ground by the water or in the rain) ----
function surfK(x, z){ let s = 'dirt'; try{ s = afxSurfaceAt(x, z); }catch(e){} if(s !== 'water' && s !== 'metal' && s !== 'wood'){ try{ if(wetAt(x, z, G.kick.mudR) || (WX && WX.id === 'rain' && s !== 'rock')) s = 'mud'; }catch(e){} } return s; }
const _r = (a, b) => a + Math.random() * (b - a);
// the kick off one foot: dust that hangs (dust), a spray thrown back off the toe (dirt), grit / clods / torn blades in the air (clod), seed fluff on grass;
//   all scaled by his pace (walk: a faint puff · run: a spray thrown backward · sprint: more); skid = a hard stop, thrown forward off a sliding heel
function kick(x, z, gy, dx, dz, v, s, own, skid){ const K = G.kick, U = K.surf[s]; if(!U) return; const B = v < K.walkV ? K.walk : v < K.sprintV ? K.run : K.sprint, P = skid ? K.skid : B, m = own ? 1 : K.npc;
  const sg = skid ? 1 : -1, th = Math.min(v, K.vCap) * (skid ? K.skid.throwK : K.throwK), tint = (s === 'sand' || s === 'dirt') && K.biome[BIOME && BIOME.name] ? K.biome[BIOME.name] : U.tint;
  const n = c => { const f = c * m; return Math.floor(f) + (Math.random() < f % 1 ? 1 : 0); };
  const L = LOOK.kick, on = L.on, dk = on ? Math.min(L.max, Math.max(1, 1 + (Math.hypot(camera.position.x - x, camera.position.y - gy, camera.position.z - z) - L.near) * L.distK)) : 1;   // LOOK 1 read from the lens
  const zk = on ? L.sizeK * dk : 1, lk = on ? L.lifeK : 1, ok = on ? L.opK : 1;
  for(let i = n(P.dust * U.dust); i-- > 0;){ const a = Math.random() * 6.283, sp = _r(0.1, 0.45) * Math.sqrt(zk);   // the haze: low, wide, it hangs and drifts
    fxp('dust', x + sg * dx * 0.12, gy + 0.05, z + sg * dz * 0.12, Math.cos(a) * sp + sg * dx * th * 0.5, _r(0.25, 0.6) * P.up, Math.sin(a) * sp + sg * dz * th * 0.5, P.size * U.size * zk * _r(0.75, 1.25), _r(0.8, 1.3) * P.life * lk, 0, tint, Math.min(1, P.op * U.op * ok) * (own ? 1 : 0.8), gy); }
  if(on){ const C = L.core, ci = skid ? 3 : P === K.walk ? 0 : P === K.run ? 1 : 2;   // LOOK 1 the core: one dense tuft at the foot, kicked a little back, slow to rise
    for(let i = n(C.n[ci] * Math.min(1, U.dust + U.spray)); i-- > 0;){ const a = Math.random() * 6.283, sp = _r(0.03, 1) * C.sp;
      fxp('dust', x + sg * dx * 0.06, gy + 0.04, z + sg * dz * 0.06, Math.cos(a) * sp + sg * dx * th * 0.25, _r(0.2, 0.45) * P.up * C.up, Math.sin(a) * sp + sg * dz * th * 0.25, P.size * U.size * zk * C.size * _r(0.85, 1.15), _r(0.9, 1.15) * P.life * lk * C.life, 0, tint, Math.min(1, P.op * U.op * C.op) * (own ? 1 : 0.8), gy); } }
  for(let i = n(P.spray * U.spray); i-- > 0;){ const a = _r(-0.6, 0.6), ca = Math.cos(a), sa = Math.sin(a), bx = (dx * ca - dz * sa) * sg, bz = (dz * ca + dx * sa) * sg;   // the spray off the toe
    fxp('dirt', x + bx * 0.08, gy + 0.04, z + bz * 0.08, bx * th * _r(0.7, 1.2), _r(1.0, 2.0) * P.up, bz * th * _r(0.7, 1.2), K.spraySize * U.size * Math.sqrt(zk) * _r(0.7, 1.3), _r(0.35, 0.6) * lk, 0, tint, Math.min(1, P.op * U.op * ok), gy); }
  for(let i = n(P.clod * U.clod); i-- > 0;){ const a = _r(-0.9, 0.9), ca = Math.cos(a), sa = Math.sin(a), bx = (dx * ca - dz * sa) * sg, bz = (dz * ca + dx * sa) * sg;   // grit, wet clods, torn blades
    fxp('clod', x, gy + 0.05, z, bx * th * _r(0.6, 1.3) + _r(-0.3, 0.3), _r(1.4, 3.0) * P.up, bz * th * _r(0.6, 1.3) + _r(-0.3, 0.3), U.clodS * _r(0.6, 1.4), _r(0.45, 0.8), 0, U.clodC ?? tint, 1, gy); }
  for(let i = n(P.dust * (U.fluff || 0)); i-- > 0;) fxp('dust', x + _r(-0.2, 0.2), gy + 0.15, z + _r(-0.2, 0.2), _r(-0.3, 0.3), _r(0.3, 0.7), _r(-0.3, 0.3), 0.12, _r(1.4, 2.2), 0, K.fluffC, 0.9, gy);   // seed fluff
  FOOT.n.dust++; }
function addPrint(x, z, gy, dx, dz, side, k, len){ const L = FOOT.prints, q = L.length < FOOT.print.N ? (L.push({}), L[L.length - 1]) : L[FOOT.cur = (FOOT.cur + 1) % L.length];
  const n = normalAt(x, z, gy); q.x = x; q.y = gy; q.z = z; q.dx = dx; q.dz = dz; q.w = side < 0 ? -1 : 1; q.k = k * (0.85 + Math.random() * 0.3); q.len = len || 1; q.t = 0; q.nx = n.x; q.ny = n.y; q.nz = n.z; FOOT.n.prints++; FOOT.newPrint = true; }
export function footfall(x, z, dx, dz, side, v, own, skid){ const s = surfK(x, z), pk = G.print.surf[s] || 0, gy = heightAt(x, z);
  if(pk > 0 && FOOT.print) addPrint(x, z, gy, dx, dz, side, pk, skid ? G.kick.skid.len : 1);
  if(v > (own ? G.kick.minV : G.npc.runV) && (own || Math.random() < G.kick.npcP)) kick(x, z, gy, dx, dz, v, s, own, skid); }

// ---- the soldier's own rig: the visible skinned body under CV.G, its joints by the Mixamo names ----
const JN = { lf:'LeftFoot', rf:'RightFoot', lt:'LeftToeBase', rt:'RightToeBase', lk:'LeftLeg', rk:'RightLeg', hp:'Hips', ch:'Spine2', hd:'Head', lh:'LeftHand', rh:'RightHand' };
function findRig(now){ if(FOOT.sk && FOOT.sk.parent && now - FOOT.skAt < 3) return FOOT.J; FOOT.skAt = now; FOOT.sk = null; FOOT.J = null; const root = CV && CV.G; if(!root) return null;
  root.traverse(o => { if(FOOT.sk || !o.isSkinnedMesh || !o.skeleton) return; for(let q = o; q; q = q.parent) if(!q.visible) return; FOOT.sk = o; });
  if(!FOOT.sk) return null; const B = FOOT.sk.skeleton.bones, J = {}; for(const k in JN){ const t = JN[k]; J[k] = B.find(b => b.name.replace(/^.*(mixamorig|:)/, '') === t) || null; }
  cloth(FOOT.sk); return (FOOT.J = J.lf && J.rf && J.hp ? J : null); }
// the uniform: its roughness map (0.26–0.51 on the Tripo soldier) remapped to lo…1 — woven cloth scatters, it does not shine; and a rim of light
//   on its edges when the sun (or the moon) stands behind him — the fuzz of the cloth lit from behind (strength per hour: GROUNDED.fill.rim)
export const CLOTH_U = { uClothLo:{ value:0 }, uRimDir:{ value:new THREE.Vector3(0, 1, 0) }, uRimCol:{ value:new THREE.Color(0, 0, 0) } };
function cloth(o){ const C = G.cloth; if(!C.on) return; for(const m of Array.isArray(o.material) ? o.material : [o.material]){ if(!m || FOOT.mats.has(m) || !m.isMeshStandardMaterial) continue; FOOT.mats.add(m);
  const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { if(prev) prev(sh, r); Object.assign(sh.uniforms, CLOTH_U);
    sh.fragmentShader = 'uniform float uClothLo; uniform vec3 uRimDir, uRimCol;\n' + sh.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = uClothLo + (1.0 - uClothLo) * roughnessFactor;`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { vec3 vv = normalize(vViewPosition); float edge = pow(1.0 - clamp(dot(normal, vv), 0.0, 1.0), ${C.rimPow.toFixed(2)}), back = clamp(-dot(vv, uRimDir) * 0.6 + 0.4, 0.0, 1.0);
        totalEmissiveRadiance += uRimCol * edge * back * clamp(dot(normal, uRimDir) * 0.5 + 0.6, 0.0, 1.0) * mix(vec3(1.0), diffuseColor.rgb * 2.0, 0.5); }`); };
  const key = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => ''; m.customProgramCacheKey = () => key() + '|cloth'; m.needsUpdate = true; } }
// LIGHT 1 for a probe: everything on / off (the shadow's old 0.25 m offset, no shades / prints, the old shiny cloth); the sky fill is world/atmosphere.js
export function groundedSet(on){ G.on = !!on; try{ sun.shadow.normalBias = on ? G.shadow.normalBias : 0.25; sun.shadow.bias = on ? G.shadow.bias : -0.0003; }catch(e){}
  if(FOOT.shade){ FOOT.shade.mesh.visible = FOOT.print.mesh.visible = !!on; } }

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _hd = new THREE.Vector3(), _near = [];
const wp = (bone, v) => bone.getWorldPosition(v);
function ownShades(now, dt){ const J = findRig(now), p = S.player; if(!J || !p || CV.mounted) return; const C = G.joint;
  // the soles: between the ankle and the ball of the foot, along the foot; the height = the lower of the two joints over their planted height
  for(let s = 0; s < 2; s++){ const fb = s ? J.rf : J.lf, tb = s ? J.rt : J.lt; wp(fb, _a); if(tb) wp(tb, _b); else _b.copy(_a); const gy = heightAt(_a.x, _a.z);
    const h = Math.min(_a.y - C.ankle, _b.y - C.toe) - gy; let dx = _b.x - _a.x, dz = _b.z - _a.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const cx = _a.x + (_b.x - _a.x) * 0.45, cz = _a.z + (_b.z - _a.z) * 0.45; shade(cx, cz, h, C.foot[3], C.foot[4], C.foot[2], dx, dz, C.foot[0], C.foot[1]);
    // a footfall: the foot was up past `up`, now it is down below `down`
    const F = FOOT.feet[s]; F.t += dt; if(h > G.plant.up) F.up = true; else if(F.up && h < G.plant.down && F.t > G.plant.gap){ F.up = false; F.t = 0;
      const v = p.vel ? Math.hypot(p.vel.x, p.vel.z) : 0; if(v > G.plant.minV) footfall(cx, cz, dx, dz, s ? 1 : -1, v, true); } }
  { const v = p.vel ? Math.hypot(p.vel.x, p.vel.z) : 0, S2 = G.kick.skid; FOOT.vPeak = Math.max(v, (FOOT.vPeak || 0) - dt * S2.decay);   // a hard stop: he was running, now he is not
    if(FOOT.vPeak > S2.fromV && v < S2.toV && CV.stance !== 'prone'){ FOOT.vPeak = v; for(let s = 0; s < 2; s++){ const fb = s ? J.rf : J.lf, tb = s ? J.rt : J.lt; wp(fb, _a); if(tb) wp(tb, _b); else _b.copy(_a);
      let dx = _b.x - _a.x, dz = _b.z - _a.z; const l = Math.hypot(dx, dz) || 1; footfall(_a.x, _a.z, dx / l, dz / l, s ? 1 : -1, S2.fromV, true, true); } } }
  { wp(J.hp, _a); const gy = heightAt(_a.x, _a.z); GRASS_PUSH.value.set(_a.x, _a.z, G.kick.grass.r * (CV.stance === 'prone' ? 1.8 : 1), _a.y - gy < 1.4 ? G.kick.grass.k : 0); }   // the grass round him parts and lies down
  for(const [k, P] of [['lk', C.knee], ['rk', C.knee], ['hp', C.hips], ['ch', C.chest], ['lh', C.hand], ['rh', C.hand]]){ const b = J[k]; if(!b) continue; wp(b, _a); const gy = heightAt(_a.x, _a.z);
    shade(_a.x, _a.z, _a.y - P[5] - gy, P[3], P[4], P[2], 1, 0, P[0], P[1], gy); }
  // the body's broad shade: from the head to between the feet, the sky it hides (long when he lies prone, round when he stands)
  wp(J.hd || J.ch || J.hp, _hd); wp(J.lf, _a); wp(J.rf, _b); _c.addVectors(_a, _b).multiplyScalar(0.5); wp(J.hp, _a); const B = G.body, gy = heightAt(_a.x, _a.z);
  let dx = _hd.x - _c.x, dz = _hd.z - _c.z; const l = Math.hypot(dx, dz); if(l > 1e-3){ dx /= l; dz /= l; } else { dx = 1; dz = 0; }
  shade((_hd.x + _c.x) / 2, (_hd.z + _c.z) / 2, _a.y - gy - B.hip, 0, B.fade, B.a, dx, dz, Math.max(B.w, l + B.pad), B.w, null); }
// a man near the camera: his body shade (along his way) and a print every stride on soft ground
function man(m, dt, cx, cz){ if(!m || m.dead || !m.pos) return; const x = m.pos.x, z = m.pos.z, d2 = (x - cx) * (x - cx) + (z - cz) * (z - cz), N = G.npc; if(d2 > N.r * N.r){ m._gf = undefined; return; }
  if(m._gf === undefined){ m._gf = 0; m._gx = x; m._gz = z; m._gs = Math.random() < 0.5 ? 1 : -1; m._gdx = 1; m._gdz = 0; return; }
  let dx = x - m._gx, dz = z - m._gz; const l = Math.hypot(dx, dz); m._gx = x; m._gz = z; if(l > 1e-3 && l < 3){ m._gdx = dx / l; m._gdz = dz / l; m._gf += l; } const v = dt > 0 ? l / dt : 0;
  const fd = 1 - Math.sqrt(d2) / N.r, gy = heightAt(x, z); shade(x, z, 0, 0.05, N.fade, N.a * Math.min(1, fd * 3), m._gdx, m._gdz, N.len, N.w, gy);
  const st = v > N.runV ? N.strideRun : N.stride; if(m._gf >= st && l < 3){ m._gf = 0; m._gs = -m._gs; if(d2 < N.printR * N.printR){ const sx = x - m._gdz * m._gs * N.side, sz = z + m._gdx * m._gs * N.side; footfall(sx, sz, m._gdx, m._gdz, m._gs, v, false); } } }

let _flushAt = 0;
export function updateFootfall(dt, now){ if(!FOOT.on) initFootfall(); if(!FOOT.on || !(dt >= 0)) return; const L = FOOT.shade; L.n = 0; const p = S.player;
  { const R = G.fill.rim, k = G.on ? (R[S.tod] ?? R.day) : 0; CLOTH_U.uClothLo.value = G.on ? G.cloth.lo : 0; CLOTH_U.uRimDir.value.copy(SUN_DIR).transformDirection(camera.matrixWorldInverse);
    CLOTH_U.uRimCol.value.copy(sun.color).multiplyScalar(sun.intensity * k); }
  if(!G.on){ L.g.instanceCount = 0; GRASS_PUSH.value.w = 0; return; }
  const night = S.tod === 'night' ? G.nightK : 1; L.mesh.material.uniforms.uK.value = night; FOOT.print.mesh.material.uniforms.uK.value = night;
  GRASS_PUSH.value.w = 0; if(p && p.pos && (S.mode === 'playing' || S.mode === 'paused')){ ownShades(now, dt);
    const cx = p.pos.x, cz = p.pos.z; if(UGRID && UGRID.inf){ const U = unitsNear(UGRID.inf, cx, cz, G.npc.r, _near); for(let i = 0; i < U.length && L.n < L.N - 2; i++) man(U[i], dt, cx, cz); }
    for(let i = 0; i < FT.length && L.n < L.N - 2; i++) man(FT[i], dt, cx, cz); }
  L.g.instanceCount = L.n; L.iP.needsUpdate = L.iD.needsUpdate = L.iN.needsUpdate = true; FOOT.n.shades = L.n;
  // the prints age; rebuilt a few times a second (their alpha changes slowly)
  const P = FOOT.prints, T = G.print.life, F = G.print.fade; for(let i = 0; i < P.length; i++) P[i].t += dt;
  if(now - _flushAt < 0.12 && !FOOT.newPrint) return; _flushAt = now; FOOT.newPrint = false; const Q = FOOT.print; Q.n = 0; FOOT.rimC.setHex(G.print.rimCol[BIOME && BIOME.name] ?? G.print.rimCol._);
  for(let i = 0; i < P.length; i++){ const q = P[i]; if(q.t >= T) continue; const a = q.k * (q.t > T - F ? (T - q.t) / F : 1) * Math.min(1, 0.4 + q.t * 4);
    putQuad(Q, q.x, q.y, q.z, a, q.dx, q.dz, G.print.size[0] * (q.len || 1), G.print.size[1] * q.w, q.nx, q.ny, q.nz); }
  Q.g.instanceCount = Q.n; Q.iP.needsUpdate = Q.iD.needsUpdate = Q.iN.needsUpdate = true; }
