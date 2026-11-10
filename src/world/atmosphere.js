// world/atmosphere.js — Z97 VISIBLE SKY: a real gradient dome (zenith → horizon haze that melts into the fog), sun glow by day, moon + stars by night
import * as THREE from 'three';
import { ATMOS, S, SHADOW_MAP, SHADOW_R, SUN_DIR, TOD_ORDER, ambient, gradePass, hemi, renderer, scene, setNightLights, skyEnvTexture, sun } from '../hub.js';

export function todFor(stage){ return TOD_ORDER[(Math.max(1,stage)-1)%TOD_ORDER.length]; }
export function todAtmos(A, tod){
  const o=Object.assign({}, A);
  if(tod==='noon'){ o.el=1.32; o.sunI=A.sunI*1.12; o.sun=0xfff8ee; o.con=A.con+0.04; o.exp=1.0; o.night=0; }
  else if(tod==='sunset'){ o.el=0.28; o.sunI=A.sunI*0.85; o.sun=0xffc28a; o.top=0x4a669c; o.hor=0xeab68a; o.fog=0xb4a08e; o.fogD=A.fogD*1.05; o.hemiG=0x5a4a3e;   // Z97 golden hour — warm light, blue sky, not a red wash
    o.lift=[0.008,0.004,0.012]; o.gain=[1.04,1.0,0.94]; o.sat=A.sat; o.con=1.05; o.exp=1.1; o.night=0; }
  else if(tod==='night'){ o.el=0.9; o.az=A.az+2.2; o.sunI=1.05; o.sun=0xc4d2ff; o.top=0x0e1a36; o.hor=0x2c3b5a; o.fog=0x29354d; o.fogD=0.0042; o.hemiG=0x1e2028;   // Z97 bright moonlit night: you can read the field
    o.lift=[0.012,0.018,0.032]; o.gain=[0.97,1.0,1.06]; o.sat=0.78; o.con=1.0; o.exp=1.3; o.night=1; }
  else { o.exp=1.08; o.night=0; }
  return o;
}
// ---- Z97 VISIBLE SKY: a real gradient dome (zenith → horizon haze that melts into the fog), sun glow by day, moon + stars by night ----
export const SKY = new THREE.Mesh(new THREE.SphereGeometry(480, 48, 24), new THREE.ShaderMaterial({ side:THREE.BackSide, depthWrite:false, fog:false,
  uniforms:{ top:{value:new THREE.Color(0x5b84b8)}, hor:{value:new THREE.Color(0xc9b48c)}, sunCol:{value:new THREE.Color(0xffffff)}, sunDir:{value:new THREE.Vector3(0,1,0)}, night:{value:0} },
  vertexShader:'varying vec3 vD; void main(){ vD=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }',
  fragmentShader:`uniform vec3 top,hor,sunCol,sunDir; uniform float night; varying vec3 vD;
    float h(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
    void main(){ vec3 d=normalize(vD); float y=max(d.y,0.0);
      vec3 haze=mix(hor, vec3(1.0), 0.18*(1.0-night)); vec3 mid=mix(haze, top, 0.45);
      vec3 c = y<0.05 ? mix(hor, haze, y/0.05) : (y<0.28 ? mix(haze, mid, (y-0.05)/0.23) : mix(mid, top, smoothstep(0.28,0.85,y)));   // dusty haze on the horizon → clear blue overhead
      c *= 1.0 + (1.0-night)*0.95*smoothstep(0.02,0.3,y);                                    // daylight sky is brighter than the ground it lights
      float s=max(dot(d,sunDir),0.0);
      c += sunCol*(pow(s,8.0)*0.18 + pow(s,64.0)*0.35)*(1.0-night*0.6);                    // forward-scatter glow round the sun / moon
      c += sunCol*smoothstep(0.9993,0.9997,s)*(night>0.5?1.6:3.0);                           // the disc itself
      if(night>0.5){ vec3 q=floor(d*420.0); float st=step(0.9975,h(q))*smoothstep(0.04,0.35,y); c += vec3(0.85,0.9,1.0)*st*(0.5+0.5*h(q+1.0)); }   // stars
      gl_FragColor=vec4(c,1.0); }` }));
SKY.renderOrder=-10; SKY.frustumCulled=false; scene.add(SKY);
export const _WHITE=new THREE.Color(0xffffff);
export function setSky(A){ const u=SKY.material.uniforms; u.top.value.setHex(A.top); u.hor.value.copy(A._fogC||new THREE.Color(A.fog)); u.sunCol.value.setHex(A.sun); u.sunDir.value.copy(SUN_DIR); u.night.value=A.night?1:0; }
export function applyAtmosphere(b){
  const A=todAtmos(ATMOS[b.name]||ATMOS.DESERT, S.tod||'day');
  SUN_DIR.set(Math.cos(A.el)*Math.sin(A.az), Math.sin(A.el), Math.cos(A.el)*Math.cos(A.az)).normalize();
  scene.environment = skyEnvTexture(b.name, A); scene.environmentIntensity = 0.6;
  const fogC=new THREE.Color(A.fog); if(!A.night) fogC.lerp(_WHITE, 0.14);                          // Z97 daylight haze is bright (aerial perspective), never a dark smog band
  scene.background.copy(fogC); scene.fog.color.copy(fogC); scene.fog.density = A.fogD; A._fogC=fogC;
  sun.color.setHex(A.sun); sun.intensity = A.sunI;
  hemi.color.setHex(A.top); hemi.groundColor.setHex(A.hemiG); hemi.intensity = 0.7;
  ambient.color.setHex(A.hor); ambient.intensity = 0.12;
  const u=gradePass.uniforms; u.lift.value.set(...A.lift); u.gain.value.set(...A.gain); u.sat.value=A.sat; u.contrast.value=A.con;
  renderer.toneMappingExposure = A.exp||1.08;
  hemi.intensity = A.night ? 0.62 : 0.72; scene.environmentIntensity = A.night ? 0.32 : 0.6;
  if(A.night){ hemi.color.setHex(0x44567e); ambient.color.setHex(0x6a7aa4); ambient.intensity=0.24; }   // moonlight fill — shadows stay blue-grey, never black
  u.vig.value = A.night ? 0.22 : 0.28;                                                                 // softer vignette (less eye strain)
  setSky(A);                                                                                           // Z97 visible sky dome matches the light
  setNightLights(!!A.night);
}
// keep the key light (and its tight shadow frustum) centred on the action; snap to shadow texels to stop shimmer
export function updateSunFollow(){
  const p=S.player, cx = p ? p.pos.x : 0, cz = p ? p.pos.z : 0, tx=(SHADOW_R*2)/SHADOW_MAP;
  const sx=Math.round(cx/tx)*tx, sz=Math.round(cz/tx)*tx;
  sun.target.position.set(sx,0,sz); sun.position.set(sx+SUN_DIR.x*90, SUN_DIR.y*90, sz+SUN_DIR.z*90); sun.target.updateMatrixWorld();
}
