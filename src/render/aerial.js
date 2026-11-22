// render/aerial.js — Z427 AIR AND DISTANCE: the haze every fogged material draws through is rebuilt (the stock fog chunk replaced, once, in every
//   shader that uses it — render/clouds.js SHADER_HOOKS). It is thick near the ground and thins with height (the mean density along the view ray,
//   integrated through air that falls off exponentially above AERIAL.h0), so a camera high over the field looks down through clear air instead of a
//   grey veil, while a camera at play height sees the haze it always did; the haze's colour turns from the land's fog colour to the sky's horizon
//   colour with distance (the far reads cool and melts into the sky with no seam), warms toward the sun (light scattered to the eye), and what stands
//   near the far plane takes on the far land's tone first (so where the near world is cut off, world/backdrop.js's ground carries on in the same
//   colour). AER.u is one shared uniform set; updateAerial moves it with the camera, the sun and the sky every frame.
import * as THREE from 'three';
import { AERIAL, LANDFORM } from '../../config.js';
import { BIOME, SHADER_HOOKS, SKY, ambient, hemi, landform, ring, scene, sun } from '../hub.js';

export const AER = { u:{ uAerA:{ value:new THREE.Vector4(AERIAL.fall, AERIAL.h0, AERIAL.keep[0], AERIAL.blue) }, uAerB:{ value:new THREE.Vector4(AERIAL.warm, 420, 580, AERIAL.on ? 1 : 0) },
  uAerFar:{ value:new THREE.Color(0xc8ccd0) }, uAerSun:{ value:new THREE.Vector3(0, 1, 0) }, uAerSunC:{ value:new THREE.Color(0xffffff) }, uAerLand:{ value:new THREE.Color(0x8a8070) }, uAerE:{ value:new THREE.Color(1, 1, 1) } }, ring0:null, far0:null };
// the haze along one view ray, shared with the backdrop's shaders: w = camera → point (world axes); returns [colour, amount] through out params
export const AER_GLSL = `
uniform vec4 uAerA; uniform vec4 uAerB; uniform vec3 uAerFar; uniform vec3 uAerSun; uniform vec3 uAerSunC; uniform vec3 uAerLand;
float aerMean(vec3 w){ float y = max(cameraPosition.y - uAerA.y, 0.0), x = w.y * uAerA.x;   // the mean air density along the ray (1 = the ground's)
  return clamp(exp(-y * uAerA.x) * (abs(x) > 1e-3 ? (1.0 - exp(-x)) / x : 1.0 - 0.5 * x), 0.0, 3.0); }
vec3 aerColour(vec3 fogC, vec3 w, float d){ vec3 c = mix(fogC, uAerFar, uAerB.w * (1.0 - exp(-d * uAerA.w)));
  return c + uAerSunC * pow(max(dot(w / max(d, 1e-3), uAerSun), 0.0), 8.0) * uAerB.x * uAerB.w; }
`;
const FRAG = `#ifdef USE_FOG
	vec3 aerW = vAerV * mat3( viewMatrix );
	float aerD = length( aerW );
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * aerD * aerD * mix( 1.0, uAerA.z + ( 1.0 - uAerA.z ) * aerMean( aerW ), uAerB.w ) );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	vec3 aerL = mix( gl_FragColor.rgb, uAerLand, uAerB.w * smoothstep( uAerB.y, uAerB.z, aerD ) );
	gl_FragColor.rgb = mix( aerL, aerColour( fogColor, aerW, aerD ), fogFactor );
#endif`;
function inject(sh){ const V = sh.vertexShader, F = sh.fragmentShader;
  if(!V.includes('#include <fog_vertex>') || !V.includes('#include <fog_pars_vertex>') || !F.includes('#include <fog_fragment>') || !F.includes('#include <fog_pars_fragment>') || F.includes('aerMean')) return;
  Object.assign(sh.uniforms, AER.u);
  sh.vertexShader = V.replace('#include <fog_pars_vertex>', '#include <fog_pars_vertex>\n#ifdef USE_FOG\n\tvarying vec3 vAerV;\n#endif').replace('#include <fog_vertex>', '#include <fog_vertex>\n#ifdef USE_FOG\n\tvAerV = mvPosition.xyz;\n#endif');
  sh.fragmentShader = F.replace('#include <fog_pars_fragment>', '#include <fog_pars_fragment>\n#ifdef USE_FOG\n\tvarying vec3 vAerV;\n' + AER_GLSL + '#endif').replace('#include <fog_fragment>', FRAG); }
SHADER_HOOKS.push(inject);

// the sky's colour right at the horizon (world/atmosphere.js SKY: its haze band) — the far haze becomes exactly this, so land and sky meet without a line
const _hz = new THREE.Color(), _w = new THREE.Color(1, 1, 1), _e = new THREE.Color(), _e2 = new THREE.Color(), _e3 = new THREE.Color();
export function skyHorizon(out){ const u = SKY.material.uniforms, day = 1 - u.night.value; _hz.copy(u.top.value).lerp(_w, 0.55); return out.copy(u.hor.value).lerp(_hz, 0.38 * day); }
const _s = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function updateAerial(cam){ const A = AER.u.uAerA.value, B = AER.u.uAerB.value, on = AERIAL.on ? 1 : 0, h = cam.position.y;
  if(AER.far0 == null) AER.far0 = cam.far; const far = on ? Math.max(AER.far0, LANDFORM.on ? LANDFORM.far : 0, h * AERIAL.farK) : AER.far0;   // (Z428 the near mountains round a valley are never cut)   // a camera up high sees the whole land below it (its far plane reaches)
  if(Math.abs(far - cam.far) > cam.far * 0.04){ cam.far = far; cam.updateProjectionMatrix(); }
  A.z = AERIAL.keep[0] + (AERIAL.keep[1] - AERIAL.keep[0]) * _s(AERIAL.keepH[0], AERIAL.keepH[1], h); B.w = on;
  B.y = AERIAL.land[0] * cam.far; B.z = AERIAL.land[1] * cam.far;
  const u = SKY.material.uniforms; skyHorizon(AER.u.uAerFar.value).lerp(u.top.value, AERIAL.farTone[0]).multiplyScalar(AERIAL.farTone[1]);   // (a touch bluer and darker than the sky's band: far ridges stand out against it) AER.u.uAerSun.value.copy(u.sunDir.value).normalize(); AER.u.uAerSunC.value.copy(u.sunCol.value).multiplyScalar(1 - u.night.value);
  const sd = u.sunDir.value, E = _e.copy(sun.color).multiplyScalar(sun.intensity * Math.max(0.12, sd.y / Math.max(1e-3, sd.length()))).add(_e2.copy(hemi.color).multiplyScalar(hemi.intensity)).add(_e3.copy(ambient.color).multiplyScalar(ambient.intensity));
  AER.u.uAerE.value.copy(E).multiplyScalar(1 / Math.PI); const LF = landform(BIOME);   // (Z428 the light the far land and the backdrop's plain are seen in)
  AER.u.uAerLand.value.setHex(LF ? LF.col : BIOME.ground).multiply(E).multiplyScalar(AERIAL.landK / Math.PI).lerp(scene.fog ? scene.fog.color : AER.u.uAerFar.value, 0.25);   // the far land as lit: albedo × (sun + sky + ambient) / π
  if(ring && ring.material){ if(AER.ring0 == null) AER.ring0 = ring.material.opacity; ring.material.opacity = AER.ring0 * (1 - _s(AERIAL.ring[0], AERIAL.ring[1], h)); ring.visible = ring.material.opacity > 0.01; } }
