// render/clouds.js — Z145 CLOUD LIGHT: big cloud shadows drift across the whole battlefield (forts, tanks, fields go dim and bright as they pass),
//   the single cue that makes a top-down scene feel like a real sky is overhead. Works by wrapping every lit material's shader once:
//   Material.prototype.onBeforeCompile becomes an accessor, so a material's own patch (detailize, grime, ground, flora…) still runs, then the
//   sun's direct light is scaled by the cloud cover above that point. CLOUD.u is ONE shared uniform set — moving it moves every shadow.
import * as THREE from 'three';
import { fbmTex } from '../hub.js';

export const CLOUD = { u:{ uCloud:{ value:new THREE.Vector4(0,0,0.6,0) }, uCloud2:{ value:new THREE.Vector4(1/420,0,0,0) }, uCamW:{ value:new THREE.Matrix4() }, uCloudTex:{ value:null } },
  wind:new THREE.Vector2(3.2, 1.4) };
let _tex=null; export function cloudTex(){ return _tex||(_tex=fbmTex(256, [[3,1.0],[6,0.8],[12,0.5],[24,0.28],[48,0.14]], 4242)); }

const DIR = 'getDirectionalLightInfo( directionalLight, directLight );';
// cloudShade(vp): vp = view-space position, passed in because Lambert declares vViewPosition only after lights_pars_begin
function inject(sh){ const F=sh.fragmentShader; if(!F.includes('#include <lights_fragment_begin>') || !F.includes('#include <lights_pars_begin>') || F.includes('cloudShade')) return;   // stock lit shaders only
  CLOUD.u.uCloudTex.value=cloudTex(); Object.assign(sh.uniforms, CLOUD.u);
  sh.fragmentShader=sh.fragmentShader.replace('#include <lights_pars_begin>', `#include <lights_pars_begin>
      uniform vec4 uCloud; uniform vec4 uCloud2; uniform mat4 uCamW; uniform sampler2D uCloudTex;
      float cloudShade(vec3 vp){ if(uCloud.w<0.001) return 1.0; vec3 wp=(uCamW*vec4(vp,1.0)).xyz; vec2 q=(wp.xz+uCloud.xy)*uCloud2.x;
        float n=texture2D(uCloudTex,q).r*0.68+texture2D(uCloudTex,q*2.7+0.31).r*0.32; return 1.0-uCloud.w*smoothstep(uCloud.z,uCloud.z+0.16,n); }`)
    .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace(DIR, DIR+'\n\t\tdirectLight.color *= cloudShade(geometryPosition);'));
}
{ const P=THREE.Material.prototype, base=P.onBeforeCompile;
  Object.defineProperty(P, 'onBeforeCompile', { configurable:true,
    get(){ const own=this._obc; return own ? function(sh, r){ own.call(this, sh, r); inject(sh); } : function(sh){ inject(sh); }; },
    set(fn){ this._obc = (fn===base) ? null : fn; } });
  P.customProgramCacheKey = function(){ return this._obc ? this._obc.toString() : ''; }; }

// per frame: drift with the wind, follow the camera (world position is rebuilt from view space in the shader)
export function updateClouds(dt, cam){ const u=CLOUD.u.uCloud.value; u.x+=CLOUD.wind.x*dt; u.y+=CLOUD.wind.y*dt; if(cam) CLOUD.u.uCamW.value.copy(cam.matrixWorld); }
