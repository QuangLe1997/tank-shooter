// actors/troop-skin.js — Z344 THE INFANTRY SKINNED ON THE GPU: every man of a side is one InstancedMesh of the whole body (actors/real-troops.js
//   skinGeo — no rigid cuts), each vertex carried by its two strongest joints of the batched rig and blended between them where they meet. Each
//   man's nine joint matrices — the rig's plain Object3D joints, as the walk, stance, death and fling code moves them — go into a float texture
//   every frame (4 texels a matrix); the vertex shader reads its own instance's two and blends them, in the colour pass and the shadow pass alike.
//   The rifle stays its own rigid piece (it is dropped beside the dead). Same draw count as before or fewer: one body + one rifle a side.
import * as THREE from 'three';

const ROW = 1024, NJ = 9;   // texels per row of the joint texture · joints a man (TROOP_BATCH.kinds, the rifle's slot unused)
// the joint blend, read once per vertex: where the colour pass starts the normal (before the position), the shadow pass at the position
const HEAD = `uniform highp sampler2D jTex;
attribute vec2 jAB;
attribute float jWt;
mat4 jMat(float j){ int b = (gl_InstanceID * ${NJ} + int(j)) * 4, x = b % ${ROW}, y = b / ${ROW};
  return mat4(texelFetch(jTex, ivec2(x, y), 0), texelFetch(jTex, ivec2(x + 1, y), 0), texelFetch(jTex, ivec2(x + 2, y), 0), texelFetch(jTex, ivec2(x + 3, y), 0)); }`;
const BLEND = 'mat4 jM_ = jMat(jAB.x) * (1.0 - jWt) + jMat(jAB.y) * jWt;';
function patch(sh, tex, normals){ sh.uniforms.jTex = { value:tex };
  let v = sh.vertexShader.replace('#include <common>', '#include <common>\n' + HEAD);
  if(normals) v = v.replace('#include <beginnormal_vertex>', BLEND + '\nvec3 objectNormal = normalize(mat3(jM_) * normal);');
  sh.vertexShader = v.replace('#include <begin_vertex>', (normals ? '' : BLEND + '\n') + 'vec3 transformed = (jM_ * vec4(position, 1.0)).xyz;'); }

// one side's body for up to `cap` men: its own joint texture, its own copy of the side's material (so each mesh reads its own texture)
export function troopSkinMesh(geo, base, cap){ const H = Math.ceil(cap * NJ * 4 / ROW), tex = new THREE.DataTexture(new Float32Array(ROW * H * 4), ROW, H, THREE.RGBAFormat, THREE.FloatType);
  tex.needsUpdate = true;
  const mat = base.clone(); mat.onBeforeCompile = s => patch(s, tex, true); mat.customProgramCacheKey = () => 'troopSkin';
  const dm = new THREE.MeshDepthMaterial({ depthPacking:THREE.RGBADepthPacking }); dm.onBeforeCompile = s => patch(s, tex, false); dm.customProgramCacheKey = () => 'troopSkinDepth';
  const m = new THREE.InstancedMesh(geo, mat, cap); m.customDepthMaterial = dm; m.userData.jt = tex; m.userData.own = [mat, dm, tex]; return m; }
// man i's joints into the texture: each joint's world matrix, taken back to the rest pose its vertices were baked in (minus the joint's rest point)
export function troopSkinWrite(m, i, u, J, kinds){ const D = m.userData.jt.image.data;
  for(const pt of u.parts){ const k = kinds.indexOf(pt.kind); if(k < 0 || pt.kind === 'gun') continue; const e = pt.o.matrixWorld.elements, r = J[pt.kind], o = (i * NJ + k) * 16;
    for(let c = 0; c < 12; c++) D[o + c] = e[c];
    D[o + 12] = e[12] - e[0] * r[0] - e[4] * r[1] - e[8] * r[2]; D[o + 13] = e[13] - e[1] * r[0] - e[5] * r[1] - e[9] * r[2]; D[o + 14] = e[14] - e[2] * r[0] - e[6] * r[1] - e[10] * r[2]; D[o + 15] = 1; } }
export function troopSkinDone(m){ m.userData.jt.needsUpdate = true; }
export function troopSkinFree(m){ for(const x of m.userData.own || []) x.dispose(); }
