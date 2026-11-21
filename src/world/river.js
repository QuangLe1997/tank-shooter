// world/river.js — Z405 RIVERS: a river and its side stream across the battlefields that have one (config RIVERS) — the bed carved into the heightfield, flowing water (ripples carried downstream along a baked flow field, foam on the banks, streaks in the current, white water over the fords, depth colour, the sky in it at a glance), the arctic's river frozen hard, and the crossings: bridge spots (a plank deck until the bridge model in RIVERS.bridge.model arrives) and stony fords
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RIVERS } from '../../config.js';
import { ARENA, HF, MODEL_FILES, MOBILE, RIVER, RIVER_FMAX, WET_U, WTIME, _heightToNormal, arena, depthTex, fieldDepth, loadGLTF, propTex, wadeAt } from '../hub.js';

const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
// where a polyline is at share u of its points: position, the downstream direction
function lineAt(L, u){ const k = Math.max(1, Math.min(L.length - 2, Math.round(u * (L.length - 1)))), a = L[k - 1], b = L[k + 1], dx = b.x - a.x, dz = b.z - a.z, n = Math.hypot(dx, dz) || 1;
  return { x:L[k].x, z:L[k].z, tx:dx / n, tz:dz / n }; }
// Z139 carved along each polyline (soft banks, a flat-bottomed channel D deep) · Z405 in the same pass the flow field: every wet cell runs down its nearest
//   line's direction, fastest mid-channel, and takes that line's frozen flag
function carveAll(h, lines, D){
  const W = HF.W, N = W * W, F = new Float32Array(N * 2), ICE = new Uint8Array(N); let anyIce = false;
  for(let j = 0; j < W; j++) for(let i = 0; i < W; i++){ const x = -ARENA + i * HF.step, z = -ARENA + j * HF.step, k = j * W + i; let bu = 9, bl = -1, bs = 0;
    for(let li = 0; li < lines.length; li++){ const P = lines[li].pts, w = lines[li].w; let d = 1e9, sk = 0;
      for(let s = 0; s < P.length - 1; s++){ const a = P[s], b = P[s + 1], vx = b.x - a.x, vz = b.z - a.z, L2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / L2)), dx = x - (a.x + vx * t), dz = z - (a.z + vz * t), q = dx * dx + dz * dz; if(q < d){ d = q; sk = s; } }
      const u = Math.sqrt(d) / w; if(u > 1.5) continue;
      const dep = u < 0.62 ? 1 : 1 - smooth(0.62, 1.5, u), bed = Math.min(h[k], 0) * 0.25 - D * dep; h[k] = Math.min(h[k], h[k] + (bed - h[k]) * smooth(1.5, 1.0, u));   // (through a hill or the highland it cuts a gorge, not a step)
      if(u < bu){ bu = u; bl = li; bs = sk; } }
    if(bl < 0 || bu > 1.25) continue;
    const L = lines[bl], a = L.pts[bs], b = L.pts[bs + 1], n = Math.hypot(b.x - a.x, b.z - a.z) || 1, sp = L.ice ? 0 : RIVERS.flow * L.k * Math.max(0.12, 1 - bu * bu);
    F[k * 2] = (b.x - a.x) / n * sp; F[k * 2 + 1] = (b.z - a.z) / n * sp; if(L.ice){ ICE[k] = 1; anyIce = true; } }
  RIVER.flow = F; RIVER.ice = anyIce ? ICE : null; }
// a ford: the bed raised to a stony run just under the surface across the channel, the current quickening over it (white water: mark 0–115)
function ford(h, L, u, M){ const p = lineAt(L.pts, u), len = RIVERS.fordLen, y = RIVER.y - RIVERS.fordDepth, R = len + L.w * 2, W = HF.W;
  const i0 = Math.max(0, Math.floor((p.x - R + ARENA) / HF.step)), i1 = Math.min(HF.N, Math.ceil((p.x + R + ARENA) / HF.step)), j0 = Math.max(0, Math.floor((p.z - R + ARENA) / HF.step)), j1 = Math.min(HF.N, Math.ceil((p.z + R + ARENA) / HF.step));
  for(let j = j0; j <= j1; j++) for(let i = i0; i <= i1; i++){ const k = j * W + i, dx = -ARENA + i * HF.step - p.x, dz = -ARENA + j * HF.step - p.z, al = dx * p.tx + dz * p.tz, ac = -dx * p.tz + dz * p.tx;
    const f = smooth(len, len * 0.4, Math.abs(al)) * smooth(L.w * 1.7, L.w * 1.1, Math.abs(ac)); if(f <= 0) continue;
    const stones = (Math.sin(dx * 2.3 + dz * 0.7) * Math.sin(dz * 2.9 - dx * 1.1)) * 0.07;   // the run is lumpy with stones
    if(h[k] < y + stones) h[k] = h[k] + (y + stones - h[k]) * f;
    if(RIVER.flow){ RIVER.flow[k * 2] *= 1 + 0.6 * f; RIVER.flow[k * 2 + 1] *= 1 + 0.6 * f; } M[k] = Math.max(M[k], Math.round(115 * f)); }
  RIVER.fords.push({ x:p.x, z:p.z, r:L.w * 1.2, line:L, ax:-p.tz, az:p.tx, e:L.w * 1.6 + RIVERS.route.margin }); }   // (Z415 ax / az: across the channel · e: from its centre to dry land each side)
// Z405 the battlefield's river (none where config RIVERS has no entry): main west ↔ east across the enemy half, the stream in from the enemy's edge on one flank
export function carveRivers(h, b){
  RIVER.on = false; RIVER.bridges.length = 0; RIVER.fords.length = 0; RIVER.lines.length = 0; RIVER.w.length = 0; RIVER.ice = null; RIVER.flow = null; RIVER.mark = null; RIVER.biome = b.name;
  if(RIVER.mesh) RIVER.mesh.visible = false; if(RIVER.deck) RIVER.deck.visible = false; WET_U.k.value.y = 0;
  const C = RIVERS.biomes[b.name]; if(!C || b.cave) return;
  const A = ARENA, ph = Math.random() * 6.28, z0 = A * RIVERS.main.z + (Math.random() - 0.5) * 10, amp = RIVERS.main.amp, dir = Math.random() < 0.5 ? 1 : -1, main = [], stream = [];
  for(let i = 0; i <= 56; i++){ const x = dir * (-A - 6 + (2 * A + 12) * i / 56); main.push({ x, z:z0 + Math.sin(x * 0.045 + ph) * amp + Math.sin(x * 0.11 + ph * 2) * amp * 0.3 }); }
  const sx = (Math.random() < 0.5 ? -1 : 1) * A * RIVERS.stream.x + (Math.random() - 0.5) * 8, zEnd = main.reduce((m, p) => Math.abs(p.x - sx) < Math.abs(m.x - sx) ? p : m).z;
  for(let j = 0; j <= 24; j++){ const z = -A - 6 + (zEnd + A + 6) * j / 24; stream.push({ x:sx + Math.sin(z * 0.07 + ph) * 6 * Math.min(1, (zEnd - z) / 12), z }); }   // runs downstream into the main river (it meets it head-on)
  const fz = C.frozen || [], lines = [{ pts:main, w:RIVERS.main.w, k:1, ice:!!fz[0] }, { pts:stream, w:RIVERS.stream.w, k:RIVERS.streamK, ice:!!fz[1] }];
  RIVER.y = RIVERS.y; carveAll(h, lines, RIVERS.D);
  const M = new Uint8Array(HF.W * HF.W); if(RIVER.ice) for(let k = 0; k < M.length; k++) if(RIVER.ice[k]) M[k] = 255;
  RIVER.on = true; RIVER.lines.push(main, stream); RIVER.w.push(lines[0].w, lines[1].w); RIVER.top = 0.05;
  const B = RIVERS.bridge, jit = () => (Math.random() - 0.5) * 2 * RIVERS.jitter;
  for(const [li, u0, kind] of (C.cross || RIVERS.cross)){ const L = lines[li]; if(!L || L.ice) continue; const u = u0 + jit();
    if(kind === 'ford'){ ford(h, L, u, M); continue; }
    const p = lineAt(L.pts, u), ang = Math.atan2(p.tz, p.tx) + Math.PI / 2;   // the deck runs across the channel, bank to bank
    RIVER.bridges.push({ x:p.x, z:p.z, ang, ca:Math.cos(ang), sa:Math.sin(ang), hw:B.hw, hl:L.w * 1.5 + B.over, y:B.deckY }); RIVER.top = Math.max(RIVER.top, B.deckY + 0.01); }
  RIVER.mark = M; riverMeshes(C);
}

// ---- the water: Z141 depth-tinted, foam on the banks · Z405 carried by the flow field (two phases of the ripple map half a cycle apart, each pulled downstream
//   and cross-faded so neither stretches), a big and a small ripple (phones: the big), foam on the banks broken by the ripples, streaks in the fast current,
//   white water over the fords, the sky taking over at a glancing look (fresnel), soft at the waterline; the frozen cells are ice: clear and dark where deep,
//   cracked, snow drifted over it ----
function waterNormal(){ const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
  for(let i = 0; i < 900; i++){ const r = 2 + Math.random() * 16, px = Math.random() * 256, py = Math.random() * 256, g = x.createRadialGradient(px, py, 0, px, py, r), v = Math.random() < 0.5 ? 255 : 0; g.addColorStop(0, 'rgba(' + v + ',' + v + ',' + v + ',0.22)'); g.addColorStop(1, 'rgba(' + v + ',' + v + ',' + v + ',0)');
    for(const ox of [-256, 0, 256]) for(const oy of [-256, 0, 256]){ x.save(); x.translate(ox, oy); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); x.restore(); } }
  const t = _heightToNormal(c, 3.2); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
const WATER_GLSL = `#include <color_fragment>
{ vec2 duv = ((vWP.xz + uA) * uHF.x + 0.5) * uHF.y; vec4 dt = texture2D(uDepth, duv); float hb = dt.r * 3.5 - 2.5, dep = max(0.0, uWY - hb);
  vec2 fl = (dt.gb * 2.0 - 1.0) * uFl.x; wFrz = step(0.5, dt.a); float rap = (1.0 - wFrz) * clamp(dt.a / 0.45, 0.0, 1.0), sp = length(fl);
  float t0 = uT / uFl.y + sin(vWP.x * 0.071 + 1.3) * sin(vWP.z * 0.083) * 0.5, p0 = fract(t0), p1 = fract(t0 + 0.5), bl = abs(1.0 - 2.0 * p0);
  vec2 dr = vec2(0.013, 0.009) * uT, o0 = fl * p0 * uFl.y, o1 = fl * p1 * uFl.y, u1 = vWP.xz / uRp.x;
  vec3 nA = mix(texture2D(normalMap, u1 - o0 / uRp.x + dr).xyz, texture2D(normalMap, u1 - o1 / uRp.x + dr + 0.5).xyz, bl) * 2.0 - 1.0, nB = vec3(0.0);
#ifndef W_CHEAP
  vec2 u2 = vWP.xz / uRp.y; nB = mix(texture2D(normalMap, u2 - o0 * 1.3 / uRp.y - dr * 1.7).xyz, texture2D(normalMap, u2 - o1 * 1.3 / uRp.y - dr * 1.7 + 0.37).xyz, bl) * 2.0 - 1.0;
#endif
  float chop = 0.5 + min(sp, 2.0) * 0.5 + rap * 0.9, fn = nA.x * 0.7 + nB.y * 0.6 + nA.y * 0.35;   // the ripples, choppier in the fast current · fn = noise carried with the water
  wN = normalize(vec3((nA.xy * 0.8 + nB.xy * 0.6) * chop, 1.0));
  float shore = (1.0 - smoothstep(0.0, uFo.x * (0.6 + 1.2 * clamp(fn + 0.5, 0.0, 1.0)), dep)) * smoothstep(-0.35, 0.3, fn);   // a thin broken line where it laps the bank
  float streak = smoothstep(0.3, 0.75, fn + 0.2 * sp) * smoothstep(0.5, 1.8, sp) * uFo.y, white = rap * smoothstep(-0.35, 0.05, fn + nB.x * 0.8 + 0.4 * mix(wV(vWP.xz * 0.9 - o0 * 0.9), wV(vWP.xz * 0.9 - o1 * 0.9 + 3.1), bl) - 0.2) * uFo.z;
  wFoam = clamp(shore * 0.7 + streak + white, 0.0, 1.0);
  vec3 V = normalize(cameraPosition - vWP); float fr = pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0), edge = smoothstep(0.0, 0.035, dep);
  vec3 col = mix(mix(uSh, uDp, smoothstep(0.04, 0.9, dep)), vec3(0.9, 0.93, 0.94), wFoam);
  float al = max(mix(mix(0.3, 0.93, smoothstep(0.02, 0.85, dep)), 1.0, fr * 0.8), wFoam * 0.95) * edge;
  if(wFrz > 0.5){ vec2 q = vWP.xz * uIc.w + vec2(wV(vWP.xz * 0.37), wV(vWP.xz * 0.37 + 5.3)) * 0.9, iq = floor(q), fq = fract(q); float f1 = 8.0, f2 = 8.0;   // the ice: a net of cracks (the two nearest seeds of a cell grid)
    for(int y = -1; y <= 1; y++) for(int x = -1; x <= 1; x++){ vec2 g = vec2(float(x), float(y)), o = vec2(wH(iq + g), wH(iq + g + 41.7)); float d = length(g + o - fq); if(d < f1){ f2 = f1; f1 = d; } else if(d < f2) f2 = d; }
    float crack = (1.0 - smoothstep(0.0, 0.03, f2 - f1)) * smoothstep(0.35, 0.6, wV(vWP.xz * 0.09 + 7.0));   // white hairline cracks, here and there
    float drift = smoothstep(0.52, 0.72, wV(vWP.xz * 0.11) * 0.65 + wV(vWP.xz * 0.47) * 0.35) * uIc.z, bank = 1.0 - smoothstep(0.15, 0.7, dep);   // snow drifted over it, heaped at the banks
    wSnow = clamp(max(drift, bank), 0.0, 1.0); vec3 ice = mix(uIce, uIceD, smoothstep(0.2, 1.3, dep)) * (0.85 + 0.3 * wV(vWP.xz * 0.3));
    col = mix(mix(ice, vec3(0.78, 0.86, 0.9), crack * 0.7), vec3(0.9, 0.93, 0.96), wSnow);
    vec3 ni = texture2D(normalMap, vWP.xz / uRp.x).xyz * 2.0 - 1.0; al = 0.97 * smoothstep(0.0, 0.02, dep); wN = normalize(vec3(ni.xy * mix(0.12, 0.5, wSnow), 1.0)); wFoam = 0.0; }
  diffuseColor.rgb = col; diffuseColor.a = al; }`;
function riverMeshes(C){
  if(!RIVER.mesh){ const nrm = waterNormal();
    const mat = new THREE.MeshStandardMaterial({ color:0xffffff, normalMap:nrm, normalScale:new THREE.Vector2(1, 1), transparent:true, roughness:0.05, metalness:0.02, envMapIntensity:RIVERS.env, depthWrite:false });
    mat.userData.u = { uDepth:{ value:null }, uWY:{ value:RIVER.y }, uA:{ value:ARENA }, uHF:{ value:new THREE.Vector2(1 / HF.step, 1 / HF.W) }, uT:WTIME, uSh:{ value:new THREE.Color() }, uDp:{ value:new THREE.Color() },
      uFl:{ value:new THREE.Vector4(RIVER_FMAX, RIVERS.cycle, 0, 0) }, uRp:{ value:new THREE.Vector2(...RIVERS.ripple) }, uFo:{ value:new THREE.Vector4(...RIVERS.foam, 0) },
      uIce:{ value:new THREE.Color().setRGB(...RIVERS.ice.col) }, uIceD:{ value:new THREE.Color().setRGB(...RIVERS.ice.deep) }, uIc:{ value:new THREE.Vector4(0, 0, RIVERS.ice.snow, RIVERS.ice.crack) } };
    mat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, mat.userData.u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + (MOBILE ? '#define W_CHEAP\n' : '') + 'varying vec3 vWP; uniform sampler2D uDepth; uniform float uWY, uA, uT; uniform vec2 uHF, uRp; uniform vec3 uSh, uDp, uIce, uIceD; uniform vec4 uFl, uFo, uIc;\nvec3 wN = vec3(0.0, 0.0, 1.0); float wFoam = 0.0, wFrz = 0.0, wSnow = 0.0;\nfloat wH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat wV(vec2 p){ vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f); return mix(mix(wH(i), wH(i + vec2(1.0, 0.0)), u.x), mix(wH(i + vec2(0.0, 1.0)), wH(i + vec2(1.0, 1.0)), u.x), u.y); }')
        .replace('#include <color_fragment>', WATER_GLSL)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = wFrz > 0.5 ? mix(0.1, 0.8, wSnow) : mix(roughnessFactor, 0.75, wFoam);')
        .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.split('texture2D( normalMap, vNormalMapUv )').join('vec4(wN * vec3(0.5, -0.5, 0.5) + 0.5, 1.0)')); };   // (the plane's v runs to −z)
    mat.customProgramCacheKey = () => 'riverZ405';
    RIVER.mesh = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2.4, ARENA * 2.4, 1, 1), mat);
    RIVER.mesh.rotation.x = -Math.PI / 2; RIVER.mesh.receiveShadow = true; RIVER.mesh.renderOrder = 2; arena.add(RIVER.mesh); }
  { const U = RIVER.mesh.material.userData.u; if(U.uDepth.value) U.uDepth.value.dispose(); U.uDepth.value = depthTex(); U.uWY.value = RIVER.y;
    U.uSh.value.setRGB(...(C.sh || RIVERS.sh)); U.uDp.value.setRGB(...(C.dp || RIVERS.dp)); }
  WET_U.k.value.set(RIVER.y, C.wet ?? 1, RIVERS.wet[1], RIVERS.wet[0]);   // the banks just above the waterline darken and shine (world/ground.js)
  RIVER.mesh.position.y = RIVER.y; RIVER.mesh.visible = true;
  bridgeDecks();
}
// ---- THE BRIDGE SPOTS: a temporary military plank bridge on timber trestles (the walkable deck is RIVER.bridges in heightAt, whatever stands there) ----
function bridgeDecks(){
  if(RIVER.deck){ arena.remove(RIVER.deck); RIVER.deck.traverse(o => { if(o.geometry) o.geometry.dispose(); }); RIVER.deck = null; }
  if(!RIVER.bridges.length) return;
  const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ map:propTex('wood'), color:0x9a7a54, roughness:0.9 }), dark = new THREE.MeshStandardMaterial({ color:0x4e3c28, roughness:0.95 }), P = [], T = [];
  for(const b of RIVER.bridges){ const ry = -b.ang, c = Math.cos(ry), s = Math.sin(ry), put = (geo, x, y, z, arr) => { geo.rotateY(ry); geo.translate(b.x + x * c + z * s, b.y + y, b.z - x * s + z * c); arr.push(geo); };
    for(let k = -b.hl; k < b.hl - 0.01; k += 0.34){ const pl = new THREE.BoxGeometry(0.3, 0.12, b.hw * 2 * (0.96 + Math.random() * 0.04)); pl.rotateY((Math.random() - 0.5) * 0.02); put(pl, k + 0.17, -0.06 + Math.random() * 0.02, (Math.random() - 0.5) * 0.08, P); }   // planks across the span
    for(const sz of [-1, 1]){ put(new THREE.BoxGeometry(b.hl * 2, 0.1, 0.14), 0, 0.85, sz * (b.hw - 0.1), T); put(new THREE.BoxGeometry(b.hl * 2, 0.26, 0.22), 0, -0.25, sz * (b.hw - 0.6), T);   // hand rails · stringers
      for(let k = -1; k <= 1; k += 0.5){ put(new THREE.BoxGeometry(0.14, 0.9, 0.14), k * (b.hl - 0.3), 0.42, sz * (b.hw - 0.1), T); }
      for(const k of [-0.42, 0, 0.42]){ const L = b.y - (RIVER.y - RIVERS.D) + 0.2; put(new THREE.CylinderGeometry(0.16, 0.18, L, 7), k * b.hl, -L / 2 - 0.1, sz * (b.hw - 0.6), T); } }   // trestle piles down to the bed
    for(const k of [-0.42, 0, 0.42]) put(new THREE.BoxGeometry(0.26, 0.26, b.hw * 2), k * b.hl, -0.3, 0, T); }   // cross beams on the piles
  for(const [arr, m] of [[P, wood], [T, dark]]){ const geo = mergeGeometries(arr); arr.forEach(q => q.dispose()); const me = new THREE.Mesh(geo, m); me.castShadow = me.receiveShadow = true; me.userData.planks = true; g.add(me); }
  RIVER.deck = g; arena.add(g); bridgeModel(g); }
// the player's bridge model (RIVERS.bridge.model): one copy on every bridge spot, its long side across the river, its road surface on the walkable deck
function bridgeModel(g){ const B = RIVERS.bridge; if(!B.model) return; MODEL_FILES.river_bridge = B.model;
  setTimeout(() => loadGLTF('river_bridge').then(gl => { if(!gl || RIVER.deck !== g) return;
    const box = new THREE.Box3().setFromObject(gl.scene), sz = box.getSize(new THREE.Vector3()), cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, along = sz.x >= sz.z ? 0 : Math.PI / 2;
    for(const b of RIVER.bridges){ const k = (B.len || b.hl * 2) / Math.max(sz.x, sz.z), m = gl.scene.clone(true), pv = new THREE.Group();
      m.scale.setScalar(k); m.position.set(-cx * k, -(box.min.y + B.deckAt * sz.y) * k, -cz * k); pv.add(m); pv.position.set(b.x, b.y, b.z); pv.rotation.y = -b.ang + along + B.yaw; g.add(pv); }
    if(!B.keepDeck) for(const o of g.children) if(o.userData.planks) o.visible = false; }), 0); }
// wave the water (called every frame): time for the ripples, the flood's water level for the water and the wet banks
export function updateWater(dt){ WTIME.value += dt; if(RIVER.on && RIVER.mesh && RIVER.mesh.visible){ RIVER.mesh.material.userData.u.uWY.value = RIVER.y; WET_U.k.value.x = RIVER.y; } }
// ---- Z415 THE ENEMY AT THE RIVER: a unit making for (tx, tz) whose straight way runs through the deep channel goes round by the best crossing — a bridge
//   or a ford (on to its near end, over, off the far end); one already wading carries on across. Returns the unit direction to steer by, or null (go straight).
//   The way is looked at again every RIVERS.route.every s (and when the goal moves), never every frame. ----
function deepOnWay(x0, z0, x1, z1){ const K = RIVERS.wade.deep, L = Math.hypot(x1 - x0, z1 - z0), n = Math.min(160, Math.ceil(L / RIVERS.route.step));
  for(let k = 1; k < n; k++){ const t = k / n; if(wadeAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t) <= K) return true; } return false; }
function crossings(){ const C = [];
  for(const b of RIVER.bridges) C.push({ x:b.x, z:b.z, ax:b.ca, az:b.sa, e:b.hl + RIVERS.route.margin, w:b.hw - 0.8 });
  for(const f of RIVER.fords) if(!f.line.ice) C.push({ x:f.x, z:f.z, ax:f.ax, az:f.az, e:f.e, w:f.r });
  return C; }
function wayOver(x, z, tx, tz){ let best = null, bc = 1e9;
  for(const c of crossings()){ const g = (tx - c.x) * c.ax + (tz - c.z) * c.az >= 0 ? 1 : -1, ax = c.ax * g, az = c.az * g, s = (x - c.x) * ax + (z - c.z) * az;   // its axis turned towards the goal's bank
    const nx = c.x - ax * c.e, nz = c.z - az * c.e, fx = c.x + ax * c.e, fz = c.z + az * c.e; if(fieldDepth(nx, nz) < 2 || fieldDepth(fx, fz) < 2) continue;   // (its ends must be inside the fence)
    const cost = (s > -c.e ? Math.hypot(fx - x, fz - z) : Math.hypot(nx - x, nz - z) + 2 * c.e) + Math.hypot(tx - fx, tz - fz) + (s > c.e - 1 ? 400 : 0);   // (one that does not lie between them: last resort)
    if(cost < bc){ bc = cost; best = { c, ax, az, pts:[{ x:nx, z:nz }, { x:fx, z:fz }] }; } }
  return best; }
export function riverWay(u, tx, tz, now){
  if(!RIVER.on || !(RIVER.bridges.length || RIVER.fords.length)) return null;
  const R = u.rw || (u.rw = { t:0, w:null, i:0, tx:0, tz:0 }), x = u.pos.x, z = u.pos.z, Q = RIVERS.route;
  if(now >= R.t || (tx - R.tx) ** 2 + (tz - R.tz) ** 2 > 64){ R.t = now + Q.every * (0.8 + Math.random() * 0.4); R.tx = tx; R.tz = tz;
    R.w = wadeAt(x, z) > RIVERS.wade.deep && deepOnWay(x, z, tx, tz) ? wayOver(x, z, tx, tz) : null; R.i = 0;
    if(R.w){ const c = R.w.c, s = (x - c.x) * R.w.ax + (z - c.z) * R.w.az, lat = Math.abs((x - c.x) * -R.w.az + (z - c.z) * R.w.ax); if(s > -c.e + Q.reach && lat < c.w + 1.5) R.i = 1; } }   // already on the crossing: on to its far end
  const W = R.w; if(!W) return null;
  while(R.i < 2 && Math.hypot(W.pts[R.i].x - x, W.pts[R.i].z - z) < Q.reach) R.i++;
  if(R.i >= 2){ R.w = null; return null; }
  const p = W.pts[R.i], dx = p.x - x, dz = p.z - z, L = Math.hypot(dx, dz) || 1; return { x:dx / L, z:dz / L }; }
