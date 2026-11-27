// fx/dust.js — Z278 DUST IN THE SUNLIGHT: a few thousand motes drift in a box of air that follows the camera's view (world-anchored, wrapped, so
// they never swim with the camera). Each asks the sun's shadow map whether it hangs in sunlight: only the lit ones glint, brightest when you
// look toward the sun (forward scattering) — the specks you see in a beam of light. Additive, soft-edged, off at night and on phones.
import * as THREE from 'three';
import { AIR, DUST } from '../../config.js';
import { BIOME, MOBILE, NIGHT, heightAt, scene, sun } from '../hub.js';

let PTS = null;
const _f = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
export function initDust(){ if(PTS || MOBILE || typeof window === 'undefined' || !DUST.on) return; const N = DUST.n, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for(let i = 0; i < N; i++){ pos[i * 3] = Math.random() * DUST.box[0]; pos[i * 3 + 1] = Math.random() * DUST.box[1]; pos[i * 3 + 2] = Math.random() * DUST.box[2]; seed[i] = Math.random(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const U = { uTime:{ value:0 }, uCenter:{ value:new THREE.Vector3() }, uBox:{ value:new THREE.Vector3(...DUST.box) }, uShadowM:{ value:new THREE.Matrix4() }, tShadow:{ value:null },
    uSunDir:{ value:new THREE.Vector3() }, uCam:{ value:new THREE.Vector3() }, uGain:{ value:0 }, uSize:{ value:DUST.size }, uCol:{ value:new THREE.Color(DUST.col) } };
  const m = new THREE.ShaderMaterial({ uniforms:U, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    vertexShader:`#include <packing>
      uniform float uTime, uGain, uSize; uniform vec3 uCenter, uBox, uSunDir, uCam; uniform mat4 uShadowM; uniform sampler2D tShadow; attribute float aSeed; varying float vA;
      void main(){ vec3 drift = vec3(sin(uTime * 0.11 + aSeed * 40.0), sin(uTime * 0.07 + aSeed * 17.0) * 0.6 + 0.15, cos(uTime * 0.09 + aSeed * 29.0)) * uTime * 0.12;
        vec3 p = mod(position + drift - uCenter + uBox * 0.5, uBox) - uBox * 0.5 + uCenter;   // wrapped round the view, anchored in the world
        vec4 s = uShadowM * vec4(p, 1.0); s.xyz /= s.w; float lit = 1.0;
        if(s.x > 0.0 && s.x < 1.0 && s.y > 0.0 && s.y < 1.0 && s.z < 1.0) lit = step(s.z - 0.002, unpackRGBAToDepth(texture2D(tShadow, s.xy)));
        float mu = dot(normalize(p - uCam), uSunDir), ph = 0.25 + 2.2 * pow(max(mu, 0.0), 6.0);
        float tw = 0.6 + 0.4 * sin(uTime * (1.5 + aSeed * 2.0) + aSeed * 60.0);
        vA = lit * ph * tw * uGain; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (0.6 + aSeed) * 300.0 / max(-mv.z, 1.0); }`,
    fragmentShader:`uniform vec3 uCol; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)) * vA; if(a < 0.003) discard; gl_FragColor = vec4(uCol * a, a); }` });
  PTS = new THREE.Points(g, m); PTS.frustumCulled = false; PTS.renderOrder = 5;
  PTS.onBeforeRender = (r, sc, cam) => { const map = sun.shadow && sun.shadow.map; const M = AIR.motes && AIR.motes[BIOME.name]; U.uGain.value = map && sun.castShadow ? DUST.gain * (M ? M.gain : 1) * (1 - NIGHT.k) : 0; if(!U.uGain.value) return;
    U.uCol.value.setHex(M ? M.col : DUST.col);   // AIR 3 each battlefield's own dust: ice crystals glint white-blue over the Arctic
    cam.getWorldDirection(_f); _c.copy(cam.position).addScaledVector(_f, DUST.ahead); _c.y = heightAt(_c.x, _c.z) + DUST.box[1] * 0.5;
    U.uCenter.value.copy(_c); U.uCam.value.copy(cam.position); U.tShadow.value = map.texture; U.uShadowM.value.copy(sun.shadow.matrix);
    U.uSunDir.value.copy(_d.subVectors(sun.position, sun.target.position).normalize()); U.uTime.value = performance.now() / 1000 % 10000; };
  scene.add(PTS); }
