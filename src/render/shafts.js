// render/shafts.js — Z276 SUNLIGHT IN THE AIR: light shafts on every battlefield. A full-screen pass right after the scene is drawn (linear HDR,
// before tone mapping and bloom): for each pixel it walks the view ray from the camera to the surface it sees, asks the sun's shadow map at each
// step whether that bit of air is in sunlight, and adds the sun's light scattered toward the eye (Henyey–Greenstein, forward-peaked: strongest
// looking toward the sun) — so the air between trees, ruins, buildings and smoke shows bright beams where the sun gets through and darker
// lanes in their shadows, the way the forest demos do it. Beyond the shadow map's reach the air counts as sunlit (an even haze). Off at night,
// on phones, and per battlefield (SHAFTS.biome).
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Z276 the sun's direction in view space, for materials that glow when lit from behind (leaves, grass): set by the pass every frame
export const SUN_VIEW = { value:new THREE.Vector3() };
const Shader = {
  uniforms:{ tDiffuse:{ value:null }, tDepth:{ value:null }, tShadow:{ value:null }, uInvProj:{ value:new THREE.Matrix4() }, uCamWorld:{ value:new THREE.Matrix4() }, uShadowM:{ value:new THREE.Matrix4() },
    uCamPos:{ value:new THREE.Vector3() }, uSunDir:{ value:new THREE.Vector3() }, uSunCol:{ value:new THREE.Color() }, uGain:{ value:0 }, uDens:{ value:0.012 }, uMaxD:{ value:140 }, uG:{ value:0.6 }, uTime:{ value:0 }, uEven:{ value:0.25 } },
  vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:`#include <packing>
    uniform sampler2D tDiffuse, tDepth, tShadow; uniform mat4 uInvProj, uCamWorld, uShadowM; uniform vec3 uCamPos, uSunDir, uSunCol; uniform float uGain, uDens, uMaxD, uG, uTime, uEven; varying vec2 vUv;
    float lit(vec3 w){ vec4 s = uShadowM * vec4(w, 1.0); s.xyz /= s.w;
      if(s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0 || s.z > 1.0) return 1.0;
      return step(s.z - 0.0015, unpackRGBAToDepth(texture2D(tShadow, s.xy))); }
    void main(){ vec4 col = texture2D(tDiffuse, vUv); if(uGain <= 0.0){ gl_FragColor = col; return; }
      float z = texture2D(tDepth, vUv).x; vec4 vp = uInvProj * vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0); vp /= vp.w; vec3 wp = (uCamWorld * vp).xyz;
      vec3 rd = wp - uCamPos; float L = length(rd); rd /= max(L, 1e-4); float Lm = min(L, uMaxD);
      float j = fract(sin(dot(gl_FragCoord.xy + uTime * 37.0, vec2(12.9898, 78.233))) * 43758.5453), acc = 0.0;   // jittered steps: no banding
      for(int i = 0; i < STEPS; i++){ float t = (float(i) + j) / float(STEPS) * Lm; acc += lit(uCamPos + rd * t); }
      acc /= float(STEPS);
      float mu = dot(rd, uSunDir), g2 = uG * uG, hg = (1.0 - g2) / pow(1.0 + g2 - 2.0 * uG * mu, 1.5) * 0.0796;   // Henyey–Greenstein phase (÷4π)
      float amt = 1.0 - exp(-Lm * uDens);
      gl_FragColor = vec4(col.rgb + uSunCol * amt * (uEven * 0.08 + hg) * acc * uGain, col.a); }` };

// the pass: it reads the scene's depth (both composer buffers get a depth texture) and the sun's shadow map, and sets its own matrices each frame
export function makeShaftPass(composer, o){ const C = o.cfg, steps = C.steps | 0;
  const sh = { ...Shader, uniforms:THREE.UniformsUtils.clone(Shader.uniforms), fragmentShader:'#define STEPS ' + steps + '\n' + Shader.fragmentShader };
  for(const rt of [composer.renderTarget1, composer.renderTarget2]) if(!rt.depthTexture){ rt.depthTexture = new THREE.DepthTexture(rt.width, rt.height); rt.depthTexture.type = THREE.UnsignedIntType; rt.dispose(); }
  const pass = new ShaderPass(sh), U = pass.uniforms, _d = new THREE.Vector3();
  const base = pass.render.bind(pass);
  pass.render = (r, w, rd, dt, mask) => { const sun = o.sun, cam = o.camera(), map = sun.shadow && sun.shadow.map, k = (C.biome[o.biome()] ?? 1) * (1 - o.night());
    U.uGain.value = map && sun.castShadow && k > 0.01 ? C.gain * k : 0;
    if(U.uGain.value > 0){ U.tDepth.value = rd.depthTexture; U.tShadow.value = map.texture; U.uShadowM.value.copy(sun.shadow.matrix);
      U.uInvProj.value.copy(cam.projectionMatrixInverse); U.uCamWorld.value.copy(cam.matrixWorld); U.uCamPos.value.setFromMatrixPosition(cam.matrixWorld);
      U.uSunDir.value.copy(_d.subVectors(sun.position, sun.target.position).normalize()); U.uSunCol.value.copy(sun.color).multiplyScalar(sun.intensity);
      U.uDens.value = C.dens; U.uMaxD.value = C.maxD; U.uG.value = C.g; U.uEven.value = C.even; U.uTime.value = (U.uTime.value + 1) % 1000; }
    SUN_VIEW.value.subVectors(sun.position, sun.target.position).normalize().transformDirection(cam.matrixWorldInverse).multiplyScalar(1 - o.night());
    base(r, w, rd, dt, mask); };
  return pass; }
