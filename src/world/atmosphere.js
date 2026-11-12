// world/atmosphere.js — Z97 VISIBLE SKY: a real gradient dome (zenith → horizon haze that melts into the fog), sun glow by day, moon + stars by night
import * as THREE from 'three';
import { ATMOS, CLOUD, S, SHADOW_EXT, SHADOW_MAP, SUN_DIR, TOD_ORDER, WX, ambient, cloudTex, gradePass, hemi, renderer, scene, setNightLights, skyEnvTexture, sun } from '../hub.js';

export function todFor(stage){ return TOD_ORDER[(Math.max(1,stage)-1)%TOD_ORDER.length]; }
export function todAtmos(A, tod){
  const o=Object.assign({}, A);
  if(tod==='noon'){ o.el=1.32; o.sunI=A.sunI*1.12; o.sun=0xfff8ee; o.con=A.con+0.04; o.exp=1.0; o.night=0; }
  else if(tod==='sunset'){ o.el=0.28; o.sunI=A.sunI*0.85; o.sun=0xffc28a; o.top=0x4a669c; o.hor=0xeab68a; o.fog=0xb4a08e; o.fogD=A.fogD*1.05; o.hemiG=0x5a4a3e;   // Z97 golden hour — warm light, blue sky, not a red wash
    o.lift=[0.008,0.004,0.012]; o.gain=[1.04,1.0,0.94]; o.sat=A.sat; o.con=1.05; o.exp=1.1; o.night=0; }
  else if(tod==='night'){ o.el=0.9; o.az=A.az+2.2; o.sunI=1.6; o.sun=0xc4d2ff; o.top=0x0e1a36; o.hor=0x2c3b5a; o.fog=0x29354d; o.fogD=0.0030; o.hemiG=0x2a2e3c;   // Z97 bright moonlit night: you can read the field
    o.lift=[0.02,0.027,0.045]; o.gain=[1.0,1.02,1.08]; o.sat=0.88; o.con=1.0; o.exp=1.45; o.night=1; }   // Z137 brighter (was exp 1.3, lift .012/.018/.032)
  else { o.exp=1.08; o.night=0; }
  return o;
}
// ---- Z97 VISIBLE SKY: a real gradient dome (zenith → horizon haze that melts into the fog), sun glow by day, moon + stars by night ----
export const SKY = new THREE.Mesh(new THREE.SphereGeometry(480, 48, 24), new THREE.ShaderMaterial({ side:THREE.BackSide, depthWrite:false, fog:false,
  uniforms:{ top:{value:new THREE.Color(0x5b84b8)}, hor:{value:new THREE.Color(0xc9b48c)}, sunCol:{value:new THREE.Color(0xffffff)}, sunDir:{value:new THREE.Vector3(0,1,0)}, night:{value:0},
    cTex:{value:null}, cOff:{value:new THREE.Vector2()}, cCov:{value:new THREE.Vector3(0.6,0.2,0)}, cLit:{value:new THREE.Color(0xffffff)}, cDark:{value:new THREE.Color(0x8a94a4)}, cFlash:{value:0} },   // Z145 clouds
  vertexShader:'varying vec3 vD; void main(){ vD=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }',
  fragmentShader:`uniform vec3 top,hor,sunCol,sunDir,cCov,cLit,cDark; uniform float night,cFlash; uniform sampler2D cTex; uniform vec2 cOff; varying vec3 vD;
    float h(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
    void main(){ vec3 d=normalize(vD); float y=max(d.y,0.0);
      vec3 haze=mix(hor, vec3(1.0), 0.18*(1.0-night)); vec3 mid=mix(haze, top, 0.45);
      vec3 c = y<0.05 ? mix(hor, haze, y/0.05) : (y<0.28 ? mix(haze, mid, (y-0.05)/0.23) : mix(mid, top, smoothstep(0.28,0.85,y)));   // dusty haze on the horizon → clear blue overhead
      c *= 1.0 + (1.0-night)*0.95*smoothstep(0.02,0.3,y);                                    // daylight sky is brighter than the ground it lights
      float s=max(dot(d,sunDir),0.0);
      c += sunCol*(pow(s,8.0)*0.18 + pow(s,64.0)*0.35)*(1.0-night*0.6);                    // forward-scatter glow round the sun / moon
      c += sunCol*smoothstep(0.9993,0.9997,s)*(night>0.5?1.6:3.0);                           // the disc itself
      if(night>0.5){ vec3 q=floor(d*420.0); float st=step(0.9975,h(q))*smoothstep(0.04,0.35,y); c += vec3(0.85,0.9,1.0)*st*(0.5+0.5*h(q+1.0)); }   // stars
      if(cCov.z>0.001 && d.y>0.0){ vec2 uv=d.xz/(d.y+0.1)*0.32+cOff;                                // Z145 a cloud deck: layered noise, dark heavy cores, sunlit silver edges
        float n=texture2D(cTex,uv).r*0.58+texture2D(cTex,uv*2.3+0.17).r*0.28+texture2D(cTex,uv*5.3+0.53).r*0.14;
        float dens=smoothstep(cCov.x, cCov.x+cCov.y, n)*smoothstep(0.0,0.16,d.y), thick=smoothstep(cCov.x, 1.0, n);
        float sn=max(dot(d,sunDir),0.0), sil=pow(sn,5.0)*(1.0-thick)*1.6, glow=pow(sn,2.0)*0.25;
        vec3 cc=mix(cLit, cDark, thick*0.9) + sunCol*(sil+glow)*(1.0-night*0.7) + vec3(0.8,0.85,1.0)*cFlash*(0.4+thick);
        c=mix(c, cc, dens*cCov.z);
        c=mix(c, c*0.82, (1.0-dens)*cCov.z*smoothstep(0.35,0.6,1.0-cCov.x)*0.5); }                    // overcast dims the gaps too
      gl_FragColor=vec4(c,1.0); }` }));
SKY.renderOrder=-10; SKY.frustumCulled=false; scene.add(SKY);
export const _WHITE=new THREE.Color(0xffffff);
// Z145 SKY MOODS — every battle gets its own sky, like a film's weather: clear and hard-lit, bright fair-weather cumulus, a dramatic broken deck
//   with shafts of sun between dark cores, or a brooding storm (low sky, cool flat light, cloud shadows racing, lightning in the distance)
export const MOODS = {
  clear:   { cov:[0.74,0.16,0.75], lit:0xffffff, dark:0xc8d0dc, shadow:0.0,  sunK:1.0,  expK:1.0,  con:0.0,  sat:0.03, wind:2.5 },
  fair:    { cov:[0.56,0.2,0.95],  lit:0xfffaf2, dark:0xa4aebe, shadow:0.34, sunK:1.06, expK:1.02, con:0.03, sat:0.06, wind:3.5 },
  dramatic:{ cov:[0.44,0.22,1.0],  lit:0xffe6c4, dark:0x434b5a, shadow:0.52, sunK:1.18, expK:0.97, con:0.09, sat:-0.03, wind:5, topK:0.78 },
  storm:   { cov:[0.22,0.32,1.0],  lit:0x9aa2ae, dark:0x2a303a, shadow:0.3,  sunK:0.62, expK:0.98, con:0.07, sat:-0.16, wind:8, topK:0.45, fog:0x7c8696, fogK:1.18, hemiK:1.2, bolt:[7,18] } };
const MOOD_W = { DESERT:{clear:4,fair:3,dramatic:2,storm:1}, SAVANNA:{clear:3,fair:3,dramatic:3,storm:1}, ARCTIC:{clear:2,fair:2,dramatic:3,storm:3}, TUNDRA:{clear:1,fair:2,dramatic:3,storm:3},
  FOUNDRY:{clear:1,fair:1,dramatic:3,storm:4}, RUINS:{clear:1,fair:2,dramatic:4,storm:3}, _:{clear:2,fair:4,dramatic:3,storm:2} };
export const SKYMOOD = { id:'fair', m:MOODS.fair, boltT:9 };
export function pickMood(name, tod){ if(S.skyMood && MOODS[S.skyMood]) return S.skyMood; if(tod==='night') return Math.random()<0.5?'fair':'dramatic'; if(tod==='sunset') return Math.random()<0.6?'dramatic':'fair';
  const W=MOOD_W[name]||MOOD_W._; let t=0; for(const k in W) t+=W[k]; let r=Math.random()*t; for(const k in W){ r-=W[k]; if(r<=0) return k; } return 'fair'; }
function applyMood(A, id){ const M=MOODS[id]||MOODS.fair; SKYMOOD.id=id; SKYMOOD.m=M; SKYMOOD.boltT=M.bolt?M.bolt[0]:0;
  const u=SKY.material.uniforms; u.cTex.value=cloudTex(); u.cCov.value.set(...M.cov); u.cLit.value.setHex(M.lit); u.cDark.value.setHex(M.dark);
  if(A.night){ u.cLit.value.setHex(0x3a4660); u.cDark.value.setHex(0x141a28); u.cCov.value.z*=0.75; }
  else if(A.el<0.5){ u.cLit.value.lerp(new THREE.Color(0xffb07a), 0.45); u.cDark.value.lerp(new THREE.Color(0x5a3e48), 0.3); }   // golden hour: clouds catch the low sun
  if(M.topK) u.top.value.multiplyScalar(M.topK);
  CLOUD.u.uCloud.value.z=M.cov[0]-0.04; CLOUD.u.uCloud.value.w=A.night?M.shadow*0.4:M.shadow; const a=Math.random()*6.283; CLOUD.wind.set(Math.cos(a)*M.wind, Math.sin(a)*M.wind);
  sun.intensity*=M.sunK; renderer.toneMappingExposure*=M.expK; const g=gradePass.uniforms; g.contrast.value+=M.con; g.sat.value=Math.max(0.5, g.sat.value+M.sat);
  if(M.fog){ const fc=new THREE.Color(M.fog); scene.fog.color.lerp(fc, 0.45); scene.background.copy(scene.fog.color); u.hor.value.copy(scene.fog.color); scene.fog.density*=M.fogK||1; }
  if(M.hemiK) hemi.intensity*=M.hemiK; }
export function updateSkyMood(dt){ const u=SKY.material.uniforms, c=CLOUD.u.uCloud.value; u.cOff.value.set(c.x/1300, c.y/1300);
  u.cFlash.value=Math.max(0, u.cFlash.value-dt*4);
  const M=SKYMOOD.m; if(M.bolt && S.mode==='playing'){ SKYMOOD.boltT-=dt; if(SKYMOOD.boltT<=0){ SKYMOOD.boltT=M.bolt[0]+Math.random()*(M.bolt[1]-M.bolt[0]); u.cFlash.value=1; try{ WX.flash=Math.max(WX.flash, 0.35); }catch(e){} } } }
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
  hemi.intensity = A.night ? 0.85 : 0.72; scene.environmentIntensity = A.night ? 0.5 : 0.6;
  if(A.night){ hemi.color.setHex(0x44567e); ambient.color.setHex(0x7a8ab4); ambient.intensity=0.36; }   // moonlight fill — shadows stay blue-grey, never black
  u.vig.value = A.night ? 0.22 : 0.28;                                                                 // softer vignette (less eye strain)
  setSky(A);                                                                                           // Z97 visible sky dome matches the light
  applyMood(A, pickMood(b.name, S.tod||'day'));                                                       // Z145 the sky's mood for this battle
  setNightLights(!!A.night);
  try{ WX.base=null; }catch(e){}   // Z144 weather re-reads this fresh atmosphere as its base (at boot the weather module is not loaded yet)
}
// keep the key light (and its tight shadow frustum) centred on the action; snap to shadow texels to stop shimmer
export function updateSunFollow(){
  const p=S.player, cx = p ? p.pos.x : 0, cz = p ? p.pos.z : 0, tx=(SHADOW_EXT.r*2)/SHADOW_MAP;
  const sx=Math.round(cx/tx)*tx, sz=Math.round(cz/tx)*tx;
  sun.target.position.set(sx,0,sz); sun.position.set(sx+SUN_DIR.x*90, SUN_DIR.y*90, sz+SUN_DIR.z*90); sun.target.updateMatrixWorld();
}
