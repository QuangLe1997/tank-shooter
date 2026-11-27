// actors/foe-skin.js — FOE 1 THE ENEMY'S SKELETON ON THE GPU: two instanced meshes of the trooper's own body (actors/foe-bake.js geo: four joints a vertex
//   of his 22 bones), one material copy each, the colour pass and the shadow pass patched alike (as actors/troop-skin.js does for the nine-joint rig).
//   · NEAR (foeNearMesh): each man's 22 skinning matrices — posed on the CPU by actors/foe-anim.js's graph — 3 texels a matrix in a float texture written
//     every frame; the vertex shader blends its four.
//   · CROWD (foeCrowdMesh): the baked texture of every clip's every frame (foeVatData) is read straight by the GPU — each man is ONE texel of his own
//     (frame A, frame B, the crossfade between them, casts a shadow or not); nothing per bone is done for him on the CPU.
//   A man flagged out of the shadow (the texel's w, or the near rows' last) is moved out of the shadow camera's box in the depth pass only.
import * as THREE from 'three';

const ROW = 1024, NB = 22, IROW = 256;
const FETCH = `vec4 fT_(int i){ return texelFetch(fTex, ivec2(i % ${ROW}, i / ${ROW}), 0); }
mat4 fR_(int i){ vec4 a = fT_(i), c = fT_(i + 1), d = fT_(i + 2); return mat4(a.x, c.x, d.x, 0.0, a.y, c.y, d.y, 0.0, a.z, c.z, d.z, 0.0, a.w, c.w, d.w, 1.0); }`;
const HEAD_NEAR = `uniform highp sampler2D fTex;
attribute vec4 fJ;
attribute vec4 fW;
${FETCH}
mat4 fM_(int b){ return fR_((gl_InstanceID * ${NB} + b) * 3); }
float fSh_(){ return 1.0; }`;
const HEAD_CROWD = `uniform highp sampler2D fTex;
uniform highp sampler2D fIn;
attribute vec4 fJ;
attribute vec4 fW;
vec4 fI_;
${FETCH}
mat4 fM_(int b){ return fR_((int(fI_.x) * ${NB} + b) * 3) * (1.0 - fI_.z) + fR_((int(fI_.y) * ${NB} + b) * 3) * fI_.z; }
float fSh_(){ return fI_.w; }`;
const BLEND = (crowd) => (crowd ? `fI_ = texelFetch(fIn, ivec2(gl_InstanceID % ${IROW}, gl_InstanceID / ${IROW}), 0);\n` : '') +
  'mat4 fS_ = fM_(int(fJ.x)) * fW.x + fM_(int(fJ.y)) * fW.y + fM_(int(fJ.z)) * fW.z + fM_(int(fJ.w)) * fW.w;';
function patch(sh, U, crowd, normals){ Object.assign(sh.uniforms, U);
  let v = sh.vertexShader.replace('#include <common>', '#include <common>\n' + (crowd ? HEAD_CROWD : HEAD_NEAR));
  if(normals) v = v.replace('#include <beginnormal_vertex>', BLEND(crowd) + '\nvec3 objectNormal = normalize(mat3(fS_) * normal);');
  sh.vertexShader = v.replace('#include <begin_vertex>', (normals ? '' : BLEND(crowd) + '\n') + 'vec3 transformed = (fS_ * vec4(position, 1.0)).xyz;' + (normals ? '' : '\nif(fSh_() < 0.5) transformed = vec3(0.0, 1e7, 0.0);')); }
function make(geo, base, cap, U, crowd){ const key = crowd ? 'foeCrowd' : 'foeNear';
  const mat = base.clone(); mat.onBeforeCompile = s => patch(s, U, crowd, true); mat.customProgramCacheKey = () => key;
  const dm = new THREE.MeshDepthMaterial({ depthPacking:THREE.RGBADepthPacking }); dm.onBeforeCompile = s => patch(s, U, crowd, false); dm.customProgramCacheKey = () => key + 'Depth';
  const m = new THREE.InstancedMesh(geo, mat, cap); m.customDepthMaterial = dm; m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const W = new THREE.Color(1, 1, 1); for(let i = 0; i < cap; i++) m.setColorAt(i, W); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
  m.userData.own = [mat, dm]; return m; }
const ftex = (w, h) => { const t = new THREE.DataTexture(new Float32Array(w * h * 4), w, h, THREE.RGBAFormat, THREE.FloatType); t.needsUpdate = true; return t; };
// up to `cap` men posed on the CPU: userData.ft (the rows: man i's bone b at texel (i·22 + b)·3)
export function foeNearMesh(geo, base, cap){ const tex = ftex(ROW, Math.ceil(cap * NB * 3 / ROW)), m = make(geo, base, cap, { fTex:{ value:tex } }, false); m.userData.ft = tex; m.userData.own.push(tex); return m; }
// up to `cap` men drawn from the baked texture `vat` (shared, not owned): userData.fi (a texel a man: frame A, frame B, B's share, shadow 0/1)
export function foeCrowdMesh(geo, base, cap, vat){ const tex = ftex(IROW, Math.ceil(cap / IROW)), m = make(geo, base, cap, { fTex:{ value:vat }, fIn:{ value:tex } }, true); m.userData.fi = tex; m.userData.own.push(tex); return m; }
export function foeVatTex(V){ const t = new THREE.DataTexture(V.data, V.w, V.h, THREE.RGBAFormat, THREE.FloatType); t.needsUpdate = true; return t; }
export function foeMeshFree(m){ if(!m) return; m.parent && m.parent.remove(m); for(const x of m.userData.own || []) x.dispose(); m.dispose(); }
