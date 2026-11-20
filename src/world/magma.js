// world/magma.js — Z258 REAL MAGMA + A REAL VOLCANO. One shader for molten rock: a skin of dark basalt crust broken into plates (a moving Voronoi
// field, domain-warped so the plates are irregular) drifting slowly over the melt, glowing cracks between the plates, hotter patches where the crust
// thins, a temperature ramp black → deep red → orange → yellow-white feeding the emissive (so the bloom picks it up), the crust rough and the melt
// glossy, a cooler, thicker skin toward a pool's rim. The lava pools of the caldera and the crater lake use it as is; the volcano uses it in "cone"
// mode: basalt rock with ash banding and rust near the summit, three lava flows meandering down the flanks from the rim (widening as they go, each
// stopping at its own height), the crater wall lit from below. The volcano itself is a lathed stratovolcano (concave profile — gentle foot, steep
// summit), cut by radial gullies, its crater dropping to the lake; the crater throws glowing lava bombs and breathes ash.
import * as THREE from 'three';
import { MAGMA_FX } from '../../config.js';
import { MOBILE, spawnPart } from '../hub.js';

export const MAGMA = { time:{ value:0 }, vents:[], at:0 };
const NOISE = `
float mH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mN(vec2 p){ vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f); return mix(mix(mH(i), mH(i + vec2(1.0, 0.0)), u.x), mix(mH(i + vec2(0.0, 1.0)), mH(i + vec2(1.0, 1.0)), u.x), u.y); }
float mF(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 5; i++){ s += a * mN(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
vec2 mV(vec2 p, float t){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for(int y = -1; y <= 1; y++) for(int x = -1; x <= 1; x++){ vec2 g = vec2(float(x), float(y)), o = vec2(mH(i + g), mH(i + g + 3.7)); o = 0.5 + 0.42 * sin(t * 0.18 + 6.2831 * o);
    vec2 r = g + o - f; float d = dot(r, r); if(d < d1){ d2 = d1; d1 = d; } else if(d < d2) d2 = d; }
  return vec2(sqrt(d1), sqrt(d2)); }
// temperature 0..1 of the melt at p (world metres / scale)
float mT(vec2 p, float t, float hot){ p += vec2(t * 0.045, t * 0.018); p += vec2(mF(p * 0.7 + t * 0.03), mF(p * 0.7 - t * 0.03 + 4.1)) * 1.25;
  vec2 v = mV(p, t); float crack = 1.0 - smoothstep(0.0, 0.11, v.y - v.x), heat = mF(p * 1.7 + t * 0.09);
  return clamp(crack * 1.05 + (heat - 0.47) * 1.1 + hot, 0.0, 1.0); }
vec3 mRamp(float T){ vec3 c = mix(vec3(0.42, 0.02, 0.0), vec3(1.0, 0.32, 0.02), smoothstep(0.25, 0.62, T)); return mix(c, vec3(1.0, 0.82, 0.42), smoothstep(0.78, 1.0, T)); }`;

// mode 0: a pool / the crater lake (whole surface molten, cooler at the rim: uv centre → edge); mode 1: the volcano's cone
export function magmaMat(o){ o = o || {}; const F = MAGMA_FX;
  const m = new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.9, metalness:0, emissive:0x000000 });
  const U = { mTime:MAGMA.time, mMode:{ value:o.cone ? 1 : 0 }, mHot:{ value:o.hot || 0 }, mGlow:{ value:o.glow || F.glow }, mScale:{ value:o.scale || F.scale },
    mC:{ value:new THREE.Vector3() }, mHgt:{ value:o.h || 30 }, mRc:{ value:o.rc || 10 }, mRim:{ value:o.rim == null ? 1 : o.rim } };
  m.userData.U = U;
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMW; varying vec2 vMUv;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n vMW = (modelMatrix * vec4(transformed, 1.0)).xyz; vMUv = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float mTime, mMode, mHot, mGlow, mScale, mHgt, mRc, mRim; uniform vec3 mC; varying vec3 vMW; varying vec2 vMUv;${NOISE}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { vec2 p = vMW.xz * mScale; float lava = 1.0, T, hot = mHot; vec3 rock = vec3(0.04, 0.034, 0.03) * (0.65 + 0.7 * mN(p * 7.0));
        if(mMode > 0.5){ vec3 L = vMW - mC; float a = atan(L.z, L.x), hN = clamp(L.y / mHgt, 0.0, 1.2), rr = length(L.xz);
          // basalt: dark, mottled, ash bands, oxidised rust toward the summit, the crater wall lit from below
          float ash = smoothstep(0.58, 0.8, mF(vec2(a * 34.0, hN * 2.5) + vMW.xz * 0.01));   // ash and scree in streaks down the slope
          rock = vec3(0.032, 0.028, 0.026) * (0.65 + 0.7 * mF(vMW.xz * 0.15)); rock = mix(rock, vec3(0.13, 0.12, 0.115), ash * 0.6); rock = mix(rock, vec3(0.11, 0.04, 0.02), smoothstep(0.7, 1.0, hN) * 0.6 * mF(vMW.xz * 0.3));
          lava = 0.0; for(int k = 0; k < 3; k++){ float fk = float(k), c = fk * 2.094 + 0.7 + 0.22 * sin(hN * 7.0 + fk * 1.9) + 0.07 * sin(hN * 23.0 + fk), d = abs(mod(a - c + 3.14159, 6.28318) - 3.14159) * rr;
            float w = 2.0 + 5.0 * (1.0 - hN), end = 0.1 + 0.14 * fk; lava = max(lava, smoothstep(w, w * 0.35, d) * smoothstep(end, end + 0.08, hN) * step(hN, 0.985)); }
          p = vec2(a * 8.0, hN * 12.0 - mTime * 0.35); hot = mHot + 0.12;
          float crater = smoothstep(mRc * 1.02, mRc * 0.7, rr) * smoothstep(0.86, 0.98, hN); totalEmissiveRadiance += vec3(1.0, 0.32, 0.06) * crater * 0.9; }
        { vec2 q = vMW.xz * 0.55; float e = 0.12, n0 = mF(q), nx = mF(q + vec2(e, 0.0)), nz = mF(q + vec2(0.0, e));   // rough rock: a bump from the noise's slope
          normal = normalize(normal + (viewMatrix * vec4(-(nx - n0) / e, 0.0, -(nz - n0) / e, 0.0)).xyz * 0.45); }
        T = mT(p, mTime, hot);
        if(mMode < 0.5) T *= 1.0 - mRim * smoothstep(0.62, 1.0, length(vMUv - 0.5) * 2.0) * 0.85;   // the rim's skin is cooler, thicker
        float melt = lava * smoothstep(0.3, 0.62, T);
        diffuseColor.rgb = mix(rock, mRamp(T) * 0.25, melt);
        totalEmissiveRadiance += mRamp(T) * smoothstep(0.3, 0.8, T) * lava * mGlow;   // the plates stay dark; the cracks and thin skin glow
        roughnessFactor = mix(roughnessFactor, 0.42, melt); }`); };
  m.customProgramCacheKey = () => 'magma' + (o.cone ? 'C' : 'P'); return m; }

// the volcano: lathed stratovolcano with a crater lake, radial gullies; returns a group (local origin = centre of the foot) + the vent points
export function buildVolcano(){ const F = MAGMA_FX.cone, R = F.R, H = F.H, rc = F.rc, lake = H - F.lake, pts = [];
  pts.push(new THREE.Vector2(R + 10, -10));
  for(let i = 0; i <= 40; i++){ const t = i / 40; pts.push(new THREE.Vector2(R - (R - rc) * t, H * Math.pow(t, 1.65))); }   // concave: gentle foot, steep summit
  pts.push(new THREE.Vector2(rc * 0.96, H + 0.6), new THREE.Vector2(rc * 0.88, H - 0.8), new THREE.Vector2(rc * 0.8, H - F.lake * 0.55), new THREE.Vector2(rc * 0.72, lake + 0.2), new THREE.Vector2(rc * 0.7, lake - 0.6));
  const g = new THREE.LatheGeometry(pts, MOBILE ? 72 : 128), P = g.attributes.position;
  for(let i = 0; i < P.count; i++){ const x = P.getX(i), y = P.getY(i), z = P.getZ(i), r = Math.hypot(x, z); if(r < 0.01) continue; const a = Math.atan2(z, x), hN = Math.max(0, y / H);
    const gul = 0.5 * Math.sin(a * 14 + 2 * Math.sin(y * 0.15)) + 0.3 * Math.sin(a * 31 + y * 0.3) + 0.2 * Math.sin(a * 57 - y * 0.21);   // radial gullies, wandering
    const lump = 0.07 * Math.sin(a * 3 + 1.3) + 0.04 * Math.sin(a * 5 + 0.4);   // the cone is not a perfect circle
    const k = (r > rc * 1.01 ? 1 : 0.25) * (1 - 0.6 * hN), nr = r * (1 + (F.gully * gul + lump) * k); P.setX(i, x / r * nr); P.setZ(i, z / r * nr); P.setY(i, y + (r > rc ? F.gully * 3 * gul * (1 - hN) : 0)); }
  g.computeVertexNormals(); { const N = g.attributes.normal, np = pts.length, seg = P.count / np - 1;   // the lathe's seam: both copies of the first column take the averaged normal
    for(let j = 0; j < np; j++){ const a = j, b = seg * np + j, x = N.getX(a) + N.getX(b), y = N.getY(a) + N.getY(b), z = N.getZ(a) + N.getZ(b), l = Math.hypot(x, y, z) || 1; N.setXYZ(a, x / l, y / l, z / l); N.setXYZ(b, x / l, y / l, z / l); } }
  const mat = magmaMat({ cone:true, h:H, rc, hot:0.1 }), cone = new THREE.Mesh(g, mat); cone.receiveShadow = true; cone.castShadow = true;
  const lakeMat = magmaMat({ hot:0.18, glow:MAGMA_FX.glow * 1.2, rim:0.6 }), lk = new THREE.Mesh(new THREE.CircleGeometry(rc * 0.74, 48).rotateX(-Math.PI / 2), lakeMat); lk.position.y = lake;
  const grp = new THREE.Group(); grp.add(cone, lk); grp.userData.coneMat = mat; grp.userData.vents = [[0, lake + 1, 0], [rc * 0.3, lake + 1, -rc * 0.2]]; return grp; }
// after the group is placed: the cone's shader learns where its foot is
export function placeVolcano(grp){ grp.updateMatrixWorld(true); const c = new THREE.Vector3().setFromMatrixPosition(grp.matrixWorld); grp.userData.coneMat.userData.U.mC.value.copy(c);
  MAGMA.vents = grp.userData.vents.map(v => new THREE.Vector3(...v).applyMatrix4(grp.matrixWorld)); }
export function clearVolcano(){ MAGMA.vents = []; }

// every frame: the melt moves; the crater throws lava bombs
export function updateMagma(dt, now){ MAGMA.time.value += dt;
  if(!MAGMA.vents.length || now < MAGMA.at) return; const F = MAGMA_FX; MAGMA.at = now + (MOBILE ? F.bombEvery * 2 : F.bombEvery) * (0.5 + Math.random());
  const v = MAGMA.vents[(Math.random() * MAGMA.vents.length) | 0], n = 2 + ((Math.random() * (MOBILE ? 3 : 6)) | 0);
  for(let i = 0; i < n; i++){ const a = Math.random() * 6.283, s = 3 + Math.random() * 7;
    spawnPart(v.x, v.y, v.z, Math.cos(a) * s, 12 + Math.random() * 14, Math.sin(a) * s, { color:Math.random() < 0.6 ? 0xff7a1a : 0xffc24a, size:1.2 + Math.random() * 1.6, life:2.6, grav:9.8, drag:0.05 }); }
  spawnPart(v.x, v.y + 2, v.z, 0.5, 4, 0, { color:0x2e2a28, size:8 + Math.random() * 6, life:5, smoke:true, grav:-0.6, drag:0.4, grow:2.2, op:0.5 }); }
