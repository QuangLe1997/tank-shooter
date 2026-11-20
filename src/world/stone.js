// world/stone.js — Z259 PHOTO STONE for built and natural rock: a material that starts in a plain stone colour and takes a photographed CC0 set
// (Poly Haven, fetched by tools/ground-photos.mjs into assets/ground/<set>/) when it loads — colour, normal, AO / roughness — and geometry helpers
// that lay world-aligned UVs (one texture tile = the set's real size in metres) so blocks keep their true scale on every face. Used by the Giza
// pyramids (limestone courses with ragged, robbed-out edges and a smooth casing cap) and by the highland cliffs / rocks.
import * as THREE from 'three';
import { STONE } from '../../config.js';
import { photoDiff, photoSet } from '../hub.js';

const _mats = {};
// one shared material per set (+ variant): vertex colours multiply the photo (per-course / per-rock tone)
export function stoneMat(set, variant){ const key = set + (variant || ''); if(_mats[key]) return _mats[key];
  const S = STONE.sets[set] || {}, m = new THREE.MeshStandardMaterial({ color:S.fallback || 0xb8a888, vertexColors:true, roughness:0.92, metalness:0, envMapIntensity:STONE.env });
  _mats[key] = m;
  if(typeof window !== 'undefined' && !/procstone/.test(location.search + location.hash)) photoSet(set).then(({ diff, nor, arm }) => {
    m.map = diff; m.normalMap = nor; m.normalScale.set(S.nrm || 1, S.nrm || 1); m.roughnessMap = arm; m.aoMap = arm; m.aoMapIntensity = STONE.ao; m.color.setRGB(...(S.tint || [1, 1, 1])); m.needsUpdate = true;
  }).catch(() => {});
  return m; }

// world-aligned UVs on any geometry: each vertex takes the two coordinates across its face's dominant normal axis, ÷ the tile size
export function worldUV(g, tile){ const P = g.attributes.position, N = g.attributes.normal, uv = new Float32Array(P.count * 2);
  for(let i = 0; i < P.count; i++){ const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)), nz = Math.abs(N.getZ(i)), x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const [u, v] = ny >= nx && ny >= nz ? [x, z] : nx >= nz ? [z, y] : [x, y]; uv[i * 2] = u / tile; uv[i * 2 + 1] = v / tile; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g; }
// a box at (x, y, z), turned ry, with world UVs and one tone
export function stoneBox(w, h, d, x, y, z, tile, tone, ry){ const g = new THREE.BoxGeometry(w, h, d); if(ry) g.rotateY(ry); g.translate(x, y, z); worldUV(g, tile);
  const c = new THREE.Color(tone), col = new Float32Array(g.attributes.position.count * 3); for(let i = 0; i < col.length; i += 3){ col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; }

// a Giza pyramid of s m half-height-ish (as the old one): course on course of limestone, each a core and four edge strips cut short or run long at
// random (the robbed, weathered corners), a few courses missing whole stretches; `cap` = the last casing stones (smooth, paler) on the top fifth
export function pyramidGeos(x, z, s, cap, rnd){ const P = STONE.pyramid, n = Math.round(s / P.course), st = s / n, w0 = s * 1.9, tile = P.tile, out = [];
  const tone = k => { const t = P.tones[(k * 7 + (k >> 2)) % P.tones.length]; return new THREE.Color(t).multiplyScalar(0.92 + rnd() * 0.12).getHex(); };
  for(let k = 0; k < n; k++){ const w = w0 * (1 - k / n); if(w < 1.4) break; const y = k * st + st / 2;
    if(cap && k > n * P.capFrom){ out.push(stoneBox(w + st * 0.3, st, w + st * 0.3, x, y, z, tile * 2.5, P.casing)); continue; }
    const e = Math.min(w * 0.12, P.edge), core = w - 2 * e, t = tone(k); out.push(stoneBox(core, st * 1.02, core, x, y, z, tile, t));
    for(let sd = 0; sd < 4; sd++){ const a = sd * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
      const L0 = sd % 2 ? core : w, cut0 = rnd() < P.ragged ? rnd() * w * 0.18 : 0, cut1 = rnd() < P.ragged ? rnd() * w * 0.18 : 0, len = L0 - cut0 - cut1, off = (cut0 - cut1) / 2;   // a strip shortened at either corner (the side strips stop at the corners: no two tops overlap)
      if(len < 1 || rnd() < P.gap) continue;   // a stretch robbed out
      const d = rnd() < 0.3 ? e * (0.55 + rnd() * 0.3) : e, mid = core / 2 + d / 2;   // some stretches set back (weathered face)
      out.push(stoneBox(len, st * 1.02, d, x + sa * mid + ca * off, y, z + ca * mid - sa * off, tile, t, a)); } }
  for(let k = 0; k < P.tumbled; k++){ const a = rnd() * 6.28, r = s * (0.9 + rnd() * 0.5);   // tumbled casing / core blocks round the foot
    out.push(stoneBox(1.4 + rnd() * 2, 0.8 + rnd(), 1.2 + rnd() * 1.5, x + Math.cos(a) * r, 0.4, z + Math.sin(a) * r, tile, tone(k), rnd() * 3)); }
  return out; }

// triplanar photo rock for rounded meshes (the boulders, the highland): the photo projected along the three object axes and blended by the normal,
// so there is no UV seam to smear; vertex colours keep each battlefield's rock tint; colour + AO / roughness from the set (no normal map)
export function stoneTriMat(set, key){ const k = 'tri:' + set + ':' + (key || ''); if(_mats[k]) return _mats[k];
  const S = STONE.sets[set] || {}, m = new THREE.MeshStandardMaterial({ color:0xffffff, vertexColors:true, roughness:0.93, metalness:0, envMapIntensity:STONE.env }), U = { triS:{ value:STONE.rockTile }, triMap:{ value:null }, triArm:{ value:null }, triOn:{ value:0 } };
  _mats[k] = m;
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTriP; varying vec3 vTriN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vTriP = position; vTriN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D triMap, triArm; uniform float triS, triOn; varying vec3 vTriP; varying vec3 vTriN;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      vec3 tw = pow(abs(normalize(vTriN)), vec3(4.0)); tw /= (tw.x + tw.y + tw.z); vec2 ux = vTriP.zy * triS, uy = vTriP.xz * triS, uz = vTriP.xy * triS;
      if(triOn > 0.5){ vec3 tc = texture2D(triMap, ux).rgb * tw.x + texture2D(triMap, uy).rgb * tw.y + texture2D(triMap, uz).rgb * tw.z; diffuseColor.rgb *= tc; }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      vec3 tarm = triOn > 0.5 ? texture2D(triArm, ux).rgb * tw.x + texture2D(triArm, uy).rgb * tw.y + texture2D(triArm, uz).rgb * tw.z : vec3(1.0, 0.93, 0.0); roughnessFactor *= tarm.g;`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
      reflectedLight.indirectDiffuse *= mix(1.0, tarm.r, ${STONE.ao.toFixed(2)});`); };
  m.customProgramCacheKey = () => 'stoneTri';
  if(typeof window !== 'undefined' && !/procstone/.test(location.search + location.hash)) photoSet(set).then(({ diff, arm }) => { U.triMap.value = diff; U.triArm.value = arm; U.triOn.value = 1; m.roughness = 1; m.color.setRGB(...(S.rockTint || S.tint || [1, 1, 1])); }).catch(() => {});
  return m; }

// the far hills (world/horizon.js): photographed detail laid over their painted, hazed colours — an aerial photo of the battlefield's kind of ground
// on the gentle slopes, the rock face projected sideways on the steep ones, as brightness only (the ring keeps its hue and its haze), `amt` fading
// with distance
export function hillDetail(m, biome, amt){ const H = STONE.hills, U = { hdA:{ value:null }, hdR:{ value:null }, hdOn:{ value:0 }, hdAmt:{ value:amt }, hdTA:{ value:1 / H.tileA }, hdTR:{ value:1 / H.tileR } };
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHW; varying vec3 vHN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vHW = (modelMatrix * vec4(position, 1.0)).xyz; vHN = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D hdA, hdR; uniform float hdOn, hdAmt, hdTA, hdTR; varying vec3 vHW; varying vec3 vHN;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      if(hdOn > 0.5){ vec3 n = normalize(vHN), tw = pow(abs(n), vec3(4.0)); tw /= (tw.x + tw.y + tw.z); const vec3 L3 = vec3(0.3333);
        float lr = dot(texture2D(hdR, vHW.zy * hdTR).rgb * tw.x + texture2D(hdR, vHW.xz * hdTR).rgb * tw.y + texture2D(hdR, vHW.xy * hdTR).rgb * tw.z, L3);
        float la = dot(texture2D(hdA, vHW.xz * hdTA).rgb, L3) * 0.6 + dot(texture2D(hdA, vHW.xz * hdTA * 0.23).rgb, L3) * 0.4;   // two scales: no visible repeat
        float steep = smoothstep(0.8, 0.5, n.y), l = clamp(1.0 + (mix(la / ${H.meanA.toFixed(2)}, lr / ${H.meanR.toFixed(2)}, steep) - 1.0) * ${H.gain.toFixed(2)}, 0.3, 2.0);   // contrast pushed: far away the mips flatten it
        diffuseColor.rgb *= mix(1.0, l, hdAmt); }`); };
  m.customProgramCacheKey = () => 'hillDetail'; m.userData.hd = U;
  if(typeof window !== 'undefined' && !/procstone/.test(location.search + location.hash)) Promise.all([photoDiff(H.sets[biome] || H.sets._), photoDiff('rock_face')]).then(([a, r]) => { U.hdA.value = a; U.hdR.value = r; U.hdOn.value = 1; }).catch(() => {});
  return m; }

// Z264 a photographed street surface laid over a painted one in world space (one tile = the set's real size): asphalt keeps the painted lane
//   markings (the bright paint shows through), a pavement takes the photo whole; chained after any shader the material already has
export function photoSurface(m, set, tile, keepMarks, tint){ const U = { psMap:{ value:null }, psOn:{ value:0 }, psT:{ value:1 / tile }, psTint:{ value:new THREE.Color().setRGB(...(tint || [1, 1, 1])) } };
  const prev = m.onBeforeCompile, pk = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => { if(prev) prev.call(m, sh, r); Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPSW;').replace('#include <project_vertex>', '#include <project_vertex>\n vPSW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D psMap; uniform float psOn, psT; uniform vec3 psTint; varying vec3 vPSW;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      #ifdef USE_MAP
      if(psOn > 0.5){ vec3 ph = texture2D(psMap, vPSW.xz * psT).rgb * psTint; float mark = ${keepMarks ? 'smoothstep(0.42, 0.6, dot(sampledDiffuseColor.rgb, vec3(0.333)))' : '0.0'};
        diffuseColor.rgb = mix(ph, diffuseColor.rgb, mark); }
      #endif`); };
  m.customProgramCacheKey = () => (pk ? pk.call(m) : '') + '|ps' + (keepMarks ? 1 : 0);
  if(typeof window !== 'undefined' && !/procstreet/.test(location.search + location.hash)) photoDiff(set).then(t => { U.psMap.value = t; U.psOn.value = 1; }).catch(() => {});
  return m; }
