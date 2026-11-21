// render/blend-in.js — Z325 EVERYTHING BELONGS TO THE FIELD: forts, the real city, ruins, wonders, props and the 3D models were each coloured on
//   their own and stood on the battlefield like cut-outs. Once a stage is built (the intro's warm-up, behind the veil) every lit, opaque material
//   on the field gets a light grade in its own shader: it takes on a little of the field's hue (the floor's average colour — grass, sand, snow,
//   asphalt — over its own brightness), loses a touch of saturation, and its foot is dusted with the ground's colour (fading up from where it
//   stands). The ground, the grass carpet, glass / water, our own tank and anything already done are left alone. Same light, same air, one place.
import * as THREE from 'three';
import { BLEND } from '../../config.js';
import { ARENA, GRASS_FAR, GROUND_READY, HF, S, avgOf, grassReady, groundMat, paintContact } from '../hub.js';

// a = (hue share, desaturation, dust height m, dust share) · tint = the field's hue (its colour over its brightness) · dust = the ground's colour
export const BLEND_U = { a:{ value:new THREE.Vector4(BLEND.hue, BLEND.desat, BLEND.dustH, BLEND.dust) }, tint:{ value:new THREE.Color(1, 1, 1) }, dust:{ value:new THREE.Color(0.3, 0.28, 0.24) },
  tt:{ value:null }, th:{ value:new THREE.Vector3(0, 0, 0) }, ao:{ value:new THREE.Vector2(BLEND.aoH, BLEND.ao) } };   // Z400 tt / th = the terrain's heights (texture, [ARENA, 1/step, 1/W]; 0 = none) · ao = (height m, share)
const VS = `vec4 blP = vec4(transformed, 1.0), blO = vec4(0.0, 0.0, 0.0, 1.0);
#ifdef USE_INSTANCING
  blP = instanceMatrix * blP; blO = instanceMatrix * blO;
#endif
  vBlendH = (modelMatrix * blP).y - (modelMatrix * blO).y; vBlendW = (modelMatrix * blP).xyz;`;
const FS = `{ vec3 c = diffuseColor.rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, vec3(l), blendA.y);                                   // a touch less saturated: nothing shouts over the field
  c = mix(c, c * blendTint, blendA.x);                             // the field's hue, at its own brightness
  float hT = vBlendH; vec2 tuv = ((vBlendW.xz + blendTH.x) * blendTH.y + 0.5) * blendTH.z;      // Z400 height above the real ground under it (its own foot can be sunk, or on a slope)
  if(blendTH.z > 0.0 && tuv.x > 0.0 && tuv.y > 0.0 && tuv.x < 1.0 && tuv.y < 1.0) hT = min(hT, vBlendW.y - texture2D(blendTT, tuv).r);
  float foot = 1.0 - smoothstep(0.0, max(blendA.z, 1e-3), hT);  // dust up from where it stands
  c = mix(c, blendDust * (0.55 + 0.9 * l), foot * blendA.w);
  c *= 1.0 - (1.0 - smoothstep(0.0, max(blendAO.x, 1e-3), hT)) * blendAO.y;   // Z400 its foot in its own shade where it meets the ground
  diffuseColor.rgb = c; }`;
function patch(sh){ sh.uniforms.blendA = BLEND_U.a; sh.uniforms.blendTint = BLEND_U.tint; sh.uniforms.blendDust = BLEND_U.dust; sh.uniforms.blendTT = BLEND_U.tt; sh.uniforms.blendTH = BLEND_U.th; sh.uniforms.blendAO = BLEND_U.ao;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vBlendH; varying vec3 vBlendW;').replace('#include <project_vertex>', '#include <project_vertex>\n' + VS);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vBlendH; varying vec3 vBlendW; uniform vec4 blendA; uniform vec3 blendTint, blendDust, blendTH; uniform vec2 blendAO; uniform sampler2D blendTT;').replace('#include <color_fragment>', '#include <color_fragment>\n' + FS); }
// Z400 the terrain's heights as a texture (half floats, one texel a heightfield vertex — linear filtering is heightAt's own bilinear), rebuilt per stage
function terrainTex(){ const W = HF.W, n = W * W, d = new Uint16Array(n); for(let i = 0; i < n; i++) d[i] = THREE.DataUtils.toHalfFloat(HF.h[i]);
  let t = BLEND_U.tt.value; if(!t || t.image.width !== W){ if(t) t.dispose(); t = BLEND_U.tt.value = new THREE.DataTexture(d, W, W, THREE.RedFormat, THREE.HalfFloatType); t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; }
  else t.image.data = d; t.needsUpdate = true; BLEND_U.th.value.set(ARENA, 1 / HF.step, 1 / W); }
// one material: keep whatever it already did to its shader, add the grade after it, and give it its own program key (the old key + a tag)
export function blendIn(m){ if(!m || m.userData.blendIn || !(m.isMeshStandardMaterial) || m.transparent || m.transmission > 0 || m === groundMat) return false;
  const key0 = m.customProgramCacheKey.call(m); if(/grassPhoto|macroGround/.test(key0)) return false;
  const f0 = m.onBeforeCompile; m.onBeforeCompile = function(sh, r){ if(f0) f0.call(this, sh, r); patch(sh); };
  m.customProgramCacheKey = () => key0 + '|blendIn2'; m.userData.blendIn = true; m.needsUpdate = true; return true; }
// the field's colour now: the floor's photo averaged × its tint, mixed with the grass carpet's colour where it grows
export function fieldColour(){ const c = new THREE.Color(0.3, 0.28, 0.24); try{ const img = groundMat.map && groundMat.map.image, a = img ? avgOf(img) : null; if(a) c.copy(a).multiply(groundMat.color); }catch(e){}
  if(GRASS_FAR.k.value.x > 0) c.lerp(GRASS_FAR.col.value, GRASS_FAR.k.value.x * 0.85); return c; }
// grade every lit opaque material on the field (called when a stage is built, before its shaders compile)
export function blendScene(root){ try{ paintContact(); }catch(e){ console.warn('[contact]', e && e.message); }   // Z400 the floor shaded and trodden round all that stands on it
  if(!BLEND.on) return 0; try{ terrainTex(); }catch(e){} const f = fieldColour(), l = Math.max(0.02, f.r * 0.2126 + f.g * 0.7152 + f.b * 0.0722);
  BLEND_U.tint.value.setRGB(...[f.r, f.g, f.b].map(v => Math.min(BLEND.tintMax, Math.max(BLEND.tintMin, v / l))));
  BLEND_U.dust.value.copy(f);
  const skip = S.player && S.player.mesh; let n = 0; const seen = new Set();
  root.traverse(o => { if(!o.isMesh || o.isSkinnedMesh || seen.has(o.material)) return; let p = o; while(p){ if(p === skip) return; p = p.parent; }
    for(const m of Array.isArray(o.material) ? o.material : [o.material]){ if(seen.has(m)) continue; seen.add(m); if(blendIn(m)) n++; } });
  return n; }
// the next stage has no intro: grade it once its floor (and grass) are in, while the briefing is up
export async function blendWhenReady(scene){ try{ await Promise.race([Promise.all([GROUND_READY.p, grassReady()]), new Promise(r => setTimeout(r, 6000))]); }catch(e){} return blendScene(scene); }
