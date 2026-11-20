// render/blend-in.js — Z325 EVERYTHING BELONGS TO THE FIELD: forts, the real city, ruins, wonders, props and the 3D models were each coloured on
//   their own and stood on the battlefield like cut-outs. Once a stage is built (the intro's warm-up, behind the veil) every lit, opaque material
//   on the field gets a light grade in its own shader: it takes on a little of the field's hue (the floor's average colour — grass, sand, snow,
//   asphalt — over its own brightness), loses a touch of saturation, and its foot is dusted with the ground's colour (fading up from where it
//   stands). The ground, the grass carpet, glass / water, our own tank and anything already done are left alone. Same light, same air, one place.
import * as THREE from 'three';
import { BLEND } from '../../config.js';
import { GRASS_FAR, GROUND_READY, S, avgOf, grassReady, groundMat } from '../hub.js';

// a = (hue share, desaturation, dust height m, dust share) · tint = the field's hue (its colour over its brightness) · dust = the ground's colour
export const BLEND_U = { a:{ value:new THREE.Vector4(BLEND.hue, BLEND.desat, BLEND.dustH, BLEND.dust) }, tint:{ value:new THREE.Color(1, 1, 1) }, dust:{ value:new THREE.Color(0.3, 0.28, 0.24) } };
const VS = `vec4 blP = vec4(transformed, 1.0), blO = vec4(0.0, 0.0, 0.0, 1.0);
#ifdef USE_INSTANCING
  blP = instanceMatrix * blP; blO = instanceMatrix * blO;
#endif
  vBlendH = (modelMatrix * blP).y - (modelMatrix * blO).y;`;
const FS = `{ vec3 c = diffuseColor.rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, vec3(l), blendA.y);                                   // a touch less saturated: nothing shouts over the field
  c = mix(c, c * blendTint, blendA.x);                             // the field's hue, at its own brightness
  float foot = 1.0 - smoothstep(0.0, max(blendA.z, 1e-3), vBlendH);  // dust up from where it stands
  c = mix(c, blendDust * (0.55 + 0.9 * l), foot * blendA.w);
  diffuseColor.rgb = c; }`;
function patch(sh){ sh.uniforms.blendA = BLEND_U.a; sh.uniforms.blendTint = BLEND_U.tint; sh.uniforms.blendDust = BLEND_U.dust;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vBlendH;').replace('#include <project_vertex>', '#include <project_vertex>\n' + VS);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vBlendH; uniform vec4 blendA; uniform vec3 blendTint, blendDust;').replace('#include <color_fragment>', '#include <color_fragment>\n' + FS); }
// one material: keep whatever it already did to its shader, add the grade after it, and give it its own program key (the old key + a tag)
export function blendIn(m){ if(!m || m.userData.blendIn || !(m.isMeshStandardMaterial) || m.transparent || m.transmission > 0 || m === groundMat) return false;
  const key0 = m.customProgramCacheKey.call(m); if(/grassPhoto|macroGround/.test(key0)) return false;
  const f0 = m.onBeforeCompile; m.onBeforeCompile = function(sh, r){ if(f0) f0.call(this, sh, r); patch(sh); };
  m.customProgramCacheKey = () => key0 + '|blendIn1'; m.userData.blendIn = true; m.needsUpdate = true; return true; }
// the field's colour now: the floor's photo averaged × its tint, mixed with the grass carpet's colour where it grows
export function fieldColour(){ const c = new THREE.Color(0.3, 0.28, 0.24); try{ const img = groundMat.map && groundMat.map.image, a = img ? avgOf(img) : null; if(a) c.copy(a).multiply(groundMat.color); }catch(e){}
  if(GRASS_FAR.k.value.x > 0) c.lerp(GRASS_FAR.col.value, GRASS_FAR.k.value.x * 0.85); return c; }
// grade every lit opaque material on the field (called when a stage is built, before its shaders compile)
export function blendScene(root){ if(!BLEND.on) return 0; const f = fieldColour(), l = Math.max(0.02, f.r * 0.2126 + f.g * 0.7152 + f.b * 0.0722);
  BLEND_U.tint.value.setRGB(...[f.r, f.g, f.b].map(v => Math.min(BLEND.tintMax, Math.max(BLEND.tintMin, v / l))));
  BLEND_U.dust.value.copy(f);
  const skip = S.player && S.player.mesh; let n = 0; const seen = new Set();
  root.traverse(o => { if(!o.isMesh || o.isSkinnedMesh || seen.has(o.material)) return; let p = o; while(p){ if(p === skip) return; p = p.parent; }
    for(const m of Array.isArray(o.material) ? o.material : [o.material]){ if(seen.has(m)) continue; seen.add(m); if(blendIn(m)) n++; } });
  return n; }
// the next stage has no intro: grade it once its floor (and grass) are in, while the briefing is up
export async function blendWhenReady(scene){ try{ await Promise.race([Promise.all([GROUND_READY.p, grassReady()]), new Promise(r => setTimeout(r, 6000))]); }catch(e){} return blendScene(scene); }
