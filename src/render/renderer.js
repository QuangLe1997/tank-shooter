// render/renderer.js — THREE SETUP
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ARENA, BIOME, MOBILE, MSAA, NATIVE, S, SHADOW_MAP, arena, beamMat } from '../hub.js';
   // Z83: a standing COMMAND BUNKER also buffs enemy damage

// ----------------------------- THREE SETUP -----------------------------
export const app = document.getElementById('app');
export const renderer = new THREE.WebGLRenderer({ antialias:!MOBILE, powerPreference:'high-performance' });
renderer.setPixelRatio(S.dpr);
renderer.setSize(innerWidth, innerHeight, false);   // false → leave canvas CSS to fill the viewport (avoids the "render smaller than screen" mobile bug)
// VIEW = the size the canvas is actually painted at. On mobile innerWidth/innerHeight disagree with the
// fixed inset:0 canvas while the URL bar / rotation settle → reading them stretched the frame. doResize() keeps this current.
export const VIEW = { w:innerWidth, h:innerHeight };
export const BLOOM_SCALE = MOBILE ? 0.5 : 1;   // half-res bloom on phones: same glow, ~4× cheaper per frame
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
if(!MOBILE){ renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }  // real shadows on desktop
app.appendChild(renderer.domElement);
// Z105 PERF: the per-frame scene matrix update skips HIDDEN subtrees — pools of spare enemy tanks, wrecks, bullets and debris
// (thousands of nodes late in a run) no longer recompose their matrices every frame. A hidden object catches up the moment it
// is shown again (its own updateMatrix() flags it); getWorldPosition() and friends still update on demand, so game code is unaffected.
{ const P=THREE.Object3D.prototype, _umw=P.updateMatrixWorld;
  P.updateMatrixWorld=function(force){ if(this.visible===false){ if(force) this.matrixWorldNeedsUpdate=true; return; } return _umw.call(this, force); }; }

export const scene = new THREE.Scene();
scene.background = new THREE.Color(BIOME.fog);
scene.fog = new THREE.FogExp2(BIOME.fog, 0.0075);
export const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;   // replaced per battlefield by a real sky (applyAtmosphere)
scene.environmentIntensity = 0.55;
export const camera = new THREE.PerspectiveCamera(54, innerWidth/innerHeight, 0.6, 600);   // Z107 near 0.1→0.6: 6× the depth precision — ground decals no longer z-fight (shimmer) on small bumps
camera.position.set(0, 46, 34);
camera.lookAt(0,0,0);
// ---- CINEMATIC GRADE (last pass, display-referred): split-tone + contrast/saturation + vignette + film grain + shake-driven chromatic aberration ----
export const GradeShader = {
  uniforms:{ tDiffuse:{value:null}, time:{value:0}, vig:{value:0.34}, grain:{value:MOBILE?0.012:0.018}, sharp:{value:MOBILE?0.22:0.42}, sat:{value:0.9}, contrast:{value:1.08},
    lift:{value:new THREE.Vector3(0,0.008,0.02)}, gain:{value:new THREE.Vector3(1.03,1.0,0.94)}, aberr:{value:0}, flash:{value:0} },
  vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:`uniform sampler2D tDiffuse; uniform float time,vig,grain,sharp,sat,contrast,aberr,flash; uniform vec3 lift,gain; varying vec2 vUv;
    void main(){
      vec2 d=vUv-0.5; vec3 c;
      if(aberr>0.0002){ vec2 o=d*aberr; c=vec3(texture2D(tDiffuse,vUv+o).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-o).b); }
      else c=texture2D(tDiffuse,vUv).rgb;
      if(sharp>0.0){ vec2 px=1.0/vec2(textureSize(tDiffuse,0));   // Z145 unsharp mask: edges and masonry read crisp, not smeared by MSAA/bloom
        vec3 nb=texture2D(tDiffuse,vUv+vec2(px.x,0.0)).rgb+texture2D(tDiffuse,vUv-vec2(px.x,0.0)).rgb+texture2D(tDiffuse,vUv+vec2(0.0,px.y)).rgb+texture2D(tDiffuse,vUv-vec2(0.0,px.y)).rgb;
        c=max(c+(c-nb*0.25)*sharp, vec3(0.0)); }
      float l=dot(c,vec3(0.2126,0.7152,0.0722));
      c=mix(vec3(l),c,sat);
      c=(c-0.5)*contrast+0.5;
      c=c*gain + lift*(1.0-l);
      c+=flash*vec3(1.0,0.86,0.62);
      float r=length(d*vec2(1.0,0.82)); c*=1.0-vig*smoothstep(0.32,0.82,r);
      float n=fract(sin(dot(vUv*vec2(1271.3,3117.1)+time*61.7,vec2(12.9898,78.233)))*43758.5453); c+=(n-0.5)*grain;
      gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);
    }` };
export const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type:THREE.HalfFloatType, samples:MSAA }));   // Z109 MSAA on the buffer the scene is drawn into
composer.setSize(innerWidth, innerHeight);
export const renderPass = new RenderPass(scene, camera);   // ref kept so the 3D shop can swap in a showroom scene
composer.addPass(renderPass);
// Z145 AMBIENT OCCLUSION (desktop): contact shadow where wall meets ground, in every merlon gap, under eaves, between houses — the single biggest
//   step from "lit toy" to "built place". Half-res (¾ in the Mac app), opaque meshes only; the frame governor drops it first when frames run long.
export const AO = { want:!MOBILE, on:!MOBILE, scale:NATIVE?0.75:0.5 };
export const aoPass = new GTAOPass(scene, camera, 2, 2);
aoPass.updateGtaoMaterial({ radius:2.4, distanceExponent:1.6, thickness:2.5, scale:1.2, samples:NATIVE?16:12, distanceFallOff:1.0, screenSpaceRadius:false });
aoPass.updatePdMaterial({ lumaPhi:10, depthPhi:2, normalPhi:3, radius:6, radiusExponent:1, rings:2, samples:12 });
aoPass.blendIntensity = 0.9;
{ const ss=aoPass.setSize.bind(aoPass); aoPass.setSize=(w,h)=>ss(Math.max(2,Math.round(w*AO.scale)), Math.max(2,Math.round(h*AO.scale)));
  aoPass.overrideVisibility=function(){ const C=this._visibilityCache, walk=(o)=>{ if(!o.visible) return; const m=o.material;   // skip hidden subtrees (pools), hide sprites / smoke / glass
      if(o.isPoints||o.isLine||o.isSprite||(m && !Array.isArray(m) && (m.transparent||m.depthWrite===false))){ C.set(o,true); o.visible=false; return; } for(const c of o.children) walk(c); };
    walk(this.scene); };
  aoPass.restoreVisibility=function(){ for(const o of this._visibilityCache.keys()) o.visible=true; this._visibilityCache.clear(); }; }
aoPass.enabled = AO.on; composer.addPass(aoPass);
// Z147 NaN GUARD: a single NaN / inf pixel from any shader used to be smeared by the bloom mip chain into a big black block on screen.
//   Clean it here (one cheap full-screen pass) so a bad pixel stays one pixel.
export const nanPass = new ShaderPass({ uniforms:{ tDiffuse:{ value:null } }, vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c=texture2D(tDiffuse,vUv); if(any(isnan(c)) || any(isinf(c))) c=vec4(0.0,0.0,0.0,1.0); gl_FragColor=vec4(min(c.rgb, vec3(64.0)), c.a); }' });
composer.addPass(nanPass);
export const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth*BLOOM_SCALE, innerHeight*BLOOM_SCALE), 0.45, 0.42, 0.88);   // tighter radius: no blocky halos from the low mips
composer.addPass(bloom);
composer.addPass(new OutputPass());
export const gradePass = new ShaderPass(GradeShader); composer.addPass(gradePass);
// lights (refs captured so applyAtmosphere can re-tint them): hard key sun + sky/ground bounce; little flat ambient = real contrast
export const ambient = new THREE.AmbientLight(0x4a4636, 0.14); scene.add(ambient);
export const sun = new THREE.DirectionalLight(0xfff0d0, 2.8);
sun.position.set(26, 48, 18); scene.add(sun); scene.add(sun.target);
export const SHADOW_R = 44; export const SHADOW_EXT = { r:44 };   // Z145 the frustum widens on the far zoom levels so shadows reach the screen edge
export function fitShadow(z){ if(MOBILE) return; const r=SHADOW_R*Math.max(1,(z||1)/2.1); if(Math.abs(r-SHADOW_EXT.r)<0.5) return; SHADOW_EXT.r=r; const sc=sun.shadow.camera; sc.left=-r; sc.right=r; sc.top=r; sc.bottom=-r; sc.far=180+r; sc.updateProjectionMatrix(); }
                                                    // tight shadow frustum that FOLLOWS the action → crisp contact shadows
if(!MOBILE){ sun.castShadow=true; sun.shadow.mapSize.set(SHADOW_MAP,SHADOW_MAP);   // Z107 4096 in the Mac app
  const sc=sun.shadow.camera; sc.left=-SHADOW_R; sc.right=SHADOW_R; sc.top=SHADOW_R; sc.bottom=-SHADOW_R; sc.near=5; sc.far=180;
  sun.shadow.bias=-0.0003; sun.shadow.normalBias=0.25; sun.shadow.radius=2; }
export const hemi = new THREE.HemisphereLight(BIOME.sky, 0x14110a, 0.62); scene.add(hemi);
export const muzzleLight = new THREE.PointLight(0xffd27a, 0, 18, 2); scene.add(muzzleLight);
export const SUN_DIR = new THREE.Vector3(0.45,0.75,0.35).normalize();
export const NIGHT = { on:false, towers:[], spots:[], cones:[], lamps:[], head:null, headT:null, k:0 };
export function _coneTex(){ const c=document.createElement('canvas'); c.width=16; c.height=128; const x=c.getContext('2d'); const g=x.createLinearGradient(0,0,0,128); g.addColorStop(0,'rgba(255,255,255,0.0)'); g.addColorStop(0.15,'rgba(255,255,255,0.55)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,16,128); return new THREE.CanvasTexture(c); }
export function buildFloodlights(){
  const L=ARENA-5, posts=[[-L,-L],[L,-L],[-L,L],[L,L]], nLights=MOBILE?2:4, coneT=_coneTex();
  const steel=new THREE.MeshStandardMaterial({ color:0x55574f, roughness:0.5, metalness:0.8 });
  posts.forEach(([x,z],i)=>{ const g=new THREE.Group(); g.position.set(x,0,z); g.rotation.y=Math.atan2(-x,-z);
    const mastGeo=[]; for(const [lx,lz] of [[-0.35,-0.35],[0.35,-0.35],[-0.35,0.35],[0.35,0.35]]){ const leg=new THREE.CylinderGeometry(0.06,0.09,13,6); leg.translate(lx,6.5,lz); mastGeo.push(leg); }
    for(let k=0;k<9;k++){ const br=new THREE.BoxGeometry(0.8,0.05,0.05); br.rotateZ(k%2?0.6:-0.6); br.translate(0,1+k*1.35,0.35); mastGeo.push(br); const br2=br.clone(); br2.translate(0,0,-0.7); mastGeo.push(br2); }   // lattice cross-bracing
    const mast=new THREE.Mesh(mergeGeometries(mastGeo.map(q=>q.index?q.toNonIndexed():q)), steel); mast.castShadow=true; g.add(mast);
    const head=new THREE.Mesh(new THREE.BoxGeometry(2.4,1.0,0.35), steel); head.position.set(0,13.4,0.3); head.rotation.x=-0.5; g.add(head);
    const lensM=new THREE.MeshStandardMaterial({ color:0x222222, emissive:0xfff2d8, emissiveIntensity:0, roughness:0.2 }); NIGHT.lamps.push(lensM);
    for(let k=0;k<4;k++){ const lens=new THREE.Mesh(new THREE.CircleGeometry(0.24,14), lensM); lens.position.set(-0.85+k*0.57,0,0.18); head.add(lens); }
    const cone=new THREE.Mesh(new THREE.CylinderGeometry(0.6,9,34,24,1,true), beamMat(0xfff0d0, 0.75, 0));   // Z146 volumetric shaft (soft rim, dust, fades into the ground)
    cone.position.set(0,-17,0); const cg=new THREE.Group(); cg.position.copy(head.position); cg.rotation.x=0.95; cg.add(cone); g.add(cg); NIGHT.cones.push(cone.material);   // visible beam in the haze
    if(i<nLights){ const sp=new THREE.SpotLight(0xfff0d8, 0, 110, 0.62, 0.7, 0); /* decay 0: even pool inside the range, no blow-out near the mast */ sp.position.set(x*0.98,13.4,z*0.98); sp.target.position.set(x*0.25,0,z*0.25); scene.add(sp); scene.add(sp.target); NIGHT.spots.push(sp); }
    arena.add(g); NIGHT.towers.push(g); });
}
export function setNightLights(on){ NIGHT.on=on; for(const sp of NIGHT.spots) sp.visible=on; if(NIGHT.head) NIGHT.head.visible=on; }   // lights only exist at night → no per-pixel cost by day (one recompile at the stage switch)
export function updateNightLights(dt, now){
  NIGHT.k += ((NIGHT.on?1:0)-NIGHT.k)*Math.min(1,dt*2);
  const k=NIGHT.k, fl=0.96+0.04*Math.sin(now*37)*Math.sin(now*11.3);           // slight mains flicker
  for(const sp of NIGHT.spots) sp.intensity = k*(MOBILE?4.2:3.6)*fl;
  for(const m of NIGHT.lamps) m.emissiveIntensity = k*3.2*fl;
  /* Z146 mast shafts are driven by BEAM_U.uK (fx/searchlight.js) */
  const p=S.player; if(NIGHT.head && p){ NIGHT.head.intensity = k*4.6; }
}
export const _envCache = {};
export function skyEnvTexture(name, A){
  name = name+'|'+(S.tod||'day');
  if(_envCache[name]) return _envCache[name];
  const sc=new THREE.Scene();
  const mat=new THREE.ShaderMaterial({ side:THREE.BackSide, depthWrite:false,
    uniforms:{ top:{value:new THREE.Color(A.top)}, hor:{value:new THREE.Color(A.hor)}, bot:{value:new THREE.Color(A.hemiG)}, sunCol:{value:new THREE.Color(A.sun)}, sunDir:{value:SUN_DIR.clone()} },
    vertexShader:'varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:'uniform vec3 top,hor,bot,sunCol,sunDir; varying vec3 vD; void main(){ float y=vD.y; vec3 c = y>0.0 ? mix(hor, top, pow(y,0.55)) : mix(hor, bot*0.6, pow(-y,0.35)); float s=max(dot(normalize(vD),sunDir),0.0); c += sunCol*(pow(s,900.0)*40.0 + pow(s,10.0)*0.3); gl_FragColor=vec4(c,1.0); }' });
  sc.add(new THREE.Mesh(new THREE.SphereGeometry(50,40,20), mat));
  const t=pmrem.fromScene(sc, 0, 0.1, 120).texture; mat.dispose(); _envCache[name]=t; return t;
}
