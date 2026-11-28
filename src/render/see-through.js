// render/see-through.js — CAM 3 SEE-THROUGH: what stands between the follow camera and the soldier — a fort's wall, tower or keep, its command
//   post, the yard's cover, a building, a tree, a rock face, a parked vehicle — is cut away in a screen-door dither where it covers him and the
//   ground he aims at, instead of the camera diving in under it or leaping up over it. Switched on per material (seeSweep / seeMat: the ground,
//   water, the men and the effects never fade); ONE shared uniform set, written once a frame by the camera (game/update.js). The shadow pass keeps
//   the whole piece (its depth material is not patched), so a wall cut away still throws its shade. A global shader hook of render/clouds.js.
//   CAM_ROOM.see (config.js): r = the cut's radius round the line from him to his aim point on screen (share of half the screen's height), soft = its
//   feathered rim (share of r), far = how far short of his depth a surface must be to fade (m) and ramp its feather (m), near = everything this
//   close to the lens fades whole (no wall pressed into the lens), k = the most of a surface cut away, sweep / minH / maxW: below
import * as THREE from 'three';
import { CAM_ROOM, VISLOOK } from '../../config.js';
import { SHADER_HOOKS, scene } from '../hub.js';

// uSeeA: him on screen (x × aspect, y), the point he aims at (x × aspect, y) · uSeeB: his depth in view (m), radius, near cut (m), strength · uSeeC: aspect, soft, far, ramp
export const SEE = { u:{ uSeeA:{ value:new THREE.Vector4() }, uSeeB:{ value:new THREE.Vector4() }, uSeeC:{ value:new THREE.Vector4(1, 0.45, 1, 2) },
  uSeeD:{ value:new THREE.Vector4(VISLOOK.see.leafGap, VISLOOK.see.band, VISLOOK.see.rim, VISLOOK.see.rimK) } }, at:-1, sweepAt:-1 };   // VIS 3 uSeeD: how much nearer than him a leaf goes whole (m), the dithered band, the dimmed rim, its dimming
// every stock mesh shader carries the cut (one more varying, one branch), switched per MATERIAL by its own uniform uSeeOn — so a material is let in or
//   out at any time without a new program (no shader recompiles mid-battle); the shadow pass's depth materials never switch it on
const VS = 'varying vec4 vSeeC;\nvarying float vSeeZ;\n', FS = 'varying vec4 vSeeC;\nvarying float vSeeZ;\nuniform float uSeeOn;\nuniform vec4 uSeeA;\nuniform vec4 uSeeB;\nuniform vec4 uSeeC;\nuniform vec4 uSeeD;\nfloat sSeeR = 0.0;\n';
const CUT = `
  if(uSeeOn > 0.5 && uSeeB.w > 0.002){ vec2 sN = vSeeC.xy / vSeeC.w; sN.x *= uSeeC.x; vec2 sA = uSeeA.xy, sAB = uSeeA.zw - uSeeA.xy;
    float sT = clamp(dot(sN - sA, sAB) / max(dot(sAB, sAB), 1e-5), 0.0, 1.0), sR = uSeeB.y * (1.0 - 0.25 * sT);
    float sM = (1.0 - smoothstep(sR * (1.0 - uSeeC.y), sR, length(sN - sA - sAB * sT))) * (1.0 - smoothstep(uSeeB.x - uSeeC.z - uSeeC.w, uSeeB.x - uSeeC.z, vSeeZ));
    float sNr = uSeeOn > 1.5 ? max(uSeeB.z, uSeeB.x - uSeeD.x - 1.5) : uSeeB.z; sM = max(sM, 1.0 - smoothstep(sNr, sNr + 1.5, vSeeZ)) * uSeeB.w;
    float sC = smoothstep(0.5 - uSeeD.y * 0.5, 0.5 + uSeeD.y * 0.5, sM);
    if(sC > 0.001 && sC > fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 0.98 + 0.01) discard;
    sSeeR = smoothstep(0.5 - uSeeD.z, 0.5, sM); }
`;
// VIS 3 the rim round the cut dims toward uSeeD.w (a soft dark edge, not a ring of dots)
const RIM = '\n  if(sSeeR > 0.0) gl_FragColor.rgb *= mix(1.0, uSeeD.w, sSeeR);\n';
const seeU = m => m._seeU || (m._seeU = { value:0 });
function inject(sh, m){ if(!m || !CAM_ROOM.see.on || sh.vertexShader.includes('vSeeC') || !sh.vertexShader.includes('#include <project_vertex>') || !sh.fragmentShader.includes('#include <clipping_planes_fragment>')) return;
  Object.assign(sh.uniforms, SEE.u); sh.uniforms.uSeeOn = seeU(m);
  sh.vertexShader = VS + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vSeeC = gl_Position; vSeeZ = -mvPosition.z;');
  sh.fragmentShader = FS + sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + CUT).replace('#include <fog_fragment>', RIM + '#include <fog_fragment>'); }
SHADER_HOOKS.push(inject);
// let a material be cut away (or not) · VIS 3 on = 2: a leaf or a trunk — anything of it more than leafGap m nearer the lens than he stands goes, all over the screen
export function seeMat(m, on = true){ if(m) seeU(m).value = on === 2 ? 2 : on ? 1 : 0; return m; }   // (VIS 3 on = 2: a leaf / trunk)   // (a scanned tree's leaves may be blended: they are cut all the same)
// SWEEP (every CAM_ROOM.see.sweep s): every solid that stands up and throws a shadow may be cut — not the ground or what lies flat on it (roads, paving,
//   decals cast none — a tree's instanced mesh counts whether it casts or not, LOOK 1 and so do the woods past the fence, which cast none), not a field-wide mesh, not a skinned man, not the soldier's own kit
//   (skip: his root); looked at again when it changes material
const SEEN = new WeakMap(), _b = new THREE.Box3();   // mesh → the material it wore when last looked at (a tree's real model swaps it in later)
export function seeSweep(now, skip){ if(!CAM_ROOM.see.on || now - SEE.sweepAt < CAM_ROOM.see.sweep) return; SEE.sweepAt = now; const mine = new Set(); if(skip) for(const r of skip) if(r) r.traverse(o => mine.add(o));
  scene.traverse(o => { if(!o.isMesh || mine.has(o) || SEEN.get(o) === o.material) return; SEEN.set(o, o.material); if(o.isSkinnedMesh || !(o.castShadow || o.userData.tree || o.userData.forest) || !o.geometry) return; const g = o.geometry; if(!g.boundingBox) g.computeBoundingBox();
    _b.copy(g.boundingBox); const sy = o.isInstancedMesh ? 1 : Math.abs(o.getWorldScale(_v).y), hy = (_b.max.y - _b.min.y) * sy, hx = Math.max(_b.max.x - _b.min.x, _b.max.z - _b.min.z) * (o.isInstancedMesh ? 1 : Math.abs(_v.x));
    if(hy < CAM_ROOM.see.minH || (!o.isInstancedMesh && hx > CAM_ROOM.see.maxW)) return; const leaf = m => (o.userData.tree || o.userData.forest || m.alphaTest > 0 || m.transparent) ? 2 : 1;   // VIS 3 leaves and trunks: a canopy right before the lens goes whole
    if(Array.isArray(o.material)) o.material.forEach(m => seeMat(m, leaf(m))); else seeMat(o.material, leaf(o.material)); }); }
const _v = new THREE.Vector3();
// a frame drawn without the follow camera (the FPV drone, a cinematic): nothing is cut
if(typeof window !== 'undefined'){ const prev = scene.onBeforeRender; scene.onBeforeRender = function(...a){ if(performance.now() / 1000 - SEE.at > 0.12) SEE.u.uSeeB.value.w = 0; if(prev) return prev.apply(this, a); }; }
