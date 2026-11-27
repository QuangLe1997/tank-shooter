// render/air-aa.js — AIR 4 LESS SHIMMER: what sparkled while the camera moves. Specular anti-aliasing in every lit physical material (a shader hook of
//   render/clouds.js): where the shading normal turns faster than a pixel can hold (normal-mapped sand ripples, masonry, roof edges, a far rifle) the
//   highlight widens instead of blinking on and off (roughness² + the normal's variance over the pixel, Kaplanyan / Filament); the final pass's sharpening
//   eases off where the local contrast is already high and never overshoots its neighbours (render/air-post.js uAA); sub-pixel dust motes are drawn
//   one and a half pixels wide at the same light (fx/dust.js). airAA(false) puts the old look back (A/B in one battle).
import * as THREE from 'three';
import { AIR } from '../../config.js';
import { AIRPOST, MOBILE, SHADER_HOOKS } from '../hub.js';

export const AIRAA = { u:{ uSpecAA:{ value:0 } }, mote:{ value:0 } };
function inject(sh){ const F = sh.fragmentShader; if(!F.includes('#include <lights_physical_fragment>') || F.includes('uSpecAA')) return;
  Object.assign(sh.uniforms, AIRAA.u);
  sh.fragmentShader = F.replace('#include <common>', '#include <common>\nuniform vec2 uSpecAA;')
    .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
      if(uSpecAA.x > 0.0){ vec3 sdu = dFdx(normal), sdv = dFdy(normal); float sva = uSpecAA.x * (dot(sdu, sdu) + dot(sdv, sdv));
        material.roughness = sqrt(clamp(material.roughness * material.roughness + min(2.0 * sva, uSpecAA.y), 0.0, 1.0)); }`); }
SHADER_HOOKS.push(inject);
export function airAA(on){ const A = AIR.aa, k = on && A && A.on;
  AIRAA.u.uSpecAA.value = k && !MOBILE ? new THREE.Vector2(A.spec[0], A.spec[1]) : new THREE.Vector2(0, 0);
  AIRPOST.u.uAA.value.set(k ? A.cas[0] : 0, A.cas[1], A.cas[2], k && A.cas[3] ? 1 : 0); AIRAA.mote.value = k ? A.motePx : 0; }
airAA(true);
