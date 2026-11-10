// AUTO-SPLIT from index.html (Z98). Edit freely — this is now the source of truth for this system.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ARENA, BIOME, MOBILE, S, arena } from '../hub.js';
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
export const scene = new THREE.Scene();
scene.background = new THREE.Color(BIOME.fog);
scene.fog = new THREE.FogExp2(BIOME.fog, 0.0075);
export const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;   // replaced per battlefield by a real sky (applyAtmosphere)
scene.environmentIntensity = 0.55;
export const camera = new THREE.PerspectiveCamera(54, innerWidth/innerHeight, 0.1, 600);
camera.position.set(0, 46, 34);
camera.lookAt(0,0,0);
// ---- CINEMATIC GRADE (last pass, display-referred): split-tone + contrast/saturation + vignette + film grain + shake-driven chromatic aberration ----
export const GradeShader = {
  uniforms:{ tDiffuse:{value:null}, time:{value:0}, vig:{value:0.34}, grain:{value:0.035}, sat:{value:0.9}, contrast:{value:1.08},
    lift:{value:new THREE.Vector3(0,0.008,0.02)}, gain:{value:new THREE.Vector3(1.03,1.0,0.94)}, aberr:{value:0}, flash:{value:0} },
  vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:`uniform sampler2D tDiffuse; uniform float time,vig,grain,sat,contrast,aberr,flash; uniform vec3 lift,gain; varying vec2 vUv;
    void main(){
      vec2 d=vUv-0.5; vec3 c;
      if(aberr>0.0002){ vec2 o=d*aberr; c=vec3(texture2D(tDiffuse,vUv+o).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-o).b); }
      else c=texture2D(tDiffuse,vUv).rgb;
      float l=dot(c,vec3(0.2126,0.7152,0.0722));
      c=mix(vec3(l),c,sat);
      c=(c-0.5)*contrast+0.5;
      c=c*gain + lift*(1.0-l);
      c+=flash*vec3(1.0,0.86,0.62);
      float r=length(d*vec2(1.0,0.82)); c*=1.0-vig*smoothstep(0.32,0.82,r);
      float n=fract(sin(dot(vUv*vec2(1271.3,3117.1)+time*61.7,vec2(12.9898,78.233)))*43758.5453); c+=(n-0.5)*grain;
      gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);
    }` };
export const composer = new EffectComposer(renderer);
export const renderPass = new RenderPass(scene, camera);   // ref kept so the 3D shop can swap in a showroom scene
composer.addPass(renderPass);
export const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth*BLOOM_SCALE, innerHeight*BLOOM_SCALE), 0.45, 0.42, 0.88);   // tighter radius: no blocky halos from the low mips
composer.addPass(bloom);
composer.addPass(new OutputPass());
export const gradePass = new ShaderPass(GradeShader); composer.addPass(gradePass);
// lights (refs captured so applyAtmosphere can re-tint them): hard key sun + sky/ground bounce; little flat ambient = real contrast
export const ambient = new THREE.AmbientLight(0x4a4636, 0.14); scene.add(ambient);
export const sun = new THREE.DirectionalLight(0xfff0d0, 2.8);
sun.position.set(26, 48, 18); scene.add(sun); scene.add(sun.target);
export const SHADOW_R = 44;                                                     // tight shadow frustum that FOLLOWS the action → crisp contact shadows
if(!MOBILE){ sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
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
    const cone=new THREE.Mesh(new THREE.CylinderGeometry(0.6,9,34,20,1,true), new THREE.MeshBasicMaterial({ map:coneT, color:0xfff0d0, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide }));
    cone.position.set(0,-17,0); const cg=new THREE.Group(); cg.position.copy(head.position); cg.rotation.x=0.95; cg.add(cone); g.add(cg); NIGHT.cones.push(cone.material);   // visible beam in the haze
    if(i<nLights){ const sp=new THREE.SpotLight(0xfff0d8, 0, 110, 0.62, 0.7, 0); /* decay 0: even pool inside the range, no blow-out near the mast */ sp.position.set(x*0.98,13.4,z*0.98); sp.target.position.set(x*0.25,0,z*0.25); scene.add(sp); scene.add(sp.target); NIGHT.spots.push(sp); }
    arena.add(g); NIGHT.towers.push(g); });
}
export function setNightLights(on){ NIGHT.on=on; for(const sp of NIGHT.spots) sp.visible=on; if(NIGHT.head) NIGHT.head.visible=on; }   // lights only exist at night → no per-pixel cost by day (one recompile at the stage switch)
export function updateNightLights(dt, now){
  NIGHT.k += ((NIGHT.on?1:0)-NIGHT.k)*Math.min(1,dt*2);
  const k=NIGHT.k, fl=0.96+0.04*Math.sin(now*37)*Math.sin(now*11.3);           // slight mains flicker
  for(const sp of NIGHT.spots) sp.intensity = k*(MOBILE?3.4:2.8)*fl;
  for(const m of NIGHT.lamps) m.emissiveIntensity = k*3.2*fl;
  for(const m of NIGHT.cones) m.opacity = k*0.07;
  const p=S.player; if(NIGHT.head && p){ NIGHT.head.intensity = k*3.2; }
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
