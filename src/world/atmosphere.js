// world/atmosphere.js — Z97 VISIBLE SKY: a real gradient dome (zenith → horizon haze that melts into the fog), sun glow by day, moon + stars by night
import * as THREE from 'three';
import { LIGHT } from '../../config.js';
import { ATMOS, CLOUD, MOBILE, S, SHADOW_EXT, SHADOW_MAP, SUN_DIR, TOD_ORDER, WX, ambient, cloudTex, gradePass, hemi, renderer, scene, setNightLights, skyEnvTexture, sun } from '../hub.js';

export function todFor(stage){ return TOD_ORDER[(Math.max(1,stage)-1)%TOD_ORDER.length]; }
export function todAtmos(A, tod){
  const o=Object.assign({}, A), ek=(A.exp||1.08)/1.08;   // Z190 each battlefield's own exposure carries into every hour
  if(A.cave){ o.night=1; return o; }   // Z225 underground there is no hour: always dark, lit by torches and the shafts
  if(tod==='noon'){ o.el=1.32; o.sunI=A.sunI*1.12; o.sun=0xfff8ee; o.con=A.con+0.04; o.exp=1.0*ek; o.night=0; }
  else if(tod==='sunset'){ o.el=0.22; o.az=Math.PI-0.55;   // Z235 the low sun stands over the enemy lines, in view, and rakes the field
    o.sunI=A.sunI*0.85; o.sun=0xffc28a; o.top=0x4a669c; o.hor=0xeab68a; o.fog=0xb4a08e; o.fogD=A.fogD*1.05; o.hemiG=0x5a4a3e;   // Z97 golden hour — warm light, blue sky, not a red wash
    o.lift=[0.008,0.004,0.012]; o.gain=[1.04,1.0,0.94]; o.sat=A.sat; o.con=Math.max(1.1, A.con); o.exp=1.1*ek; o.night=0;
    o.sh=[-0.03,-0.004,0.045]; o.hi=[0.06,0.022,-0.04]; o.vib=(A.vib||0.25)+0.05; }   // Z190 golden hour: amber light, blue-violet shadows
  else if(tod==='night'){ o.el=0.5; o.az=Math.PI+0.4;   // Z235 the moon rides above the far hills, where the camera looks
    o.sunI=1.6; o.sun=0xc4d2ff; o.top=0x0e1a36; o.hor=0x2c3b5a; o.fog=0x29354d; o.fogD=0.0030; o.hemiG=0x2a2e3c;   // Z97 bright moonlit night: you can read the field
    o.lift=[0.02,0.027,0.045]; o.gain=[1.0,1.02,1.08]; o.sat=0.88; o.con=1.06; o.exp=1.45; o.night=1; o.sh=[-0.01,0.004,0.04]; o.hi=[0.015,0.01,-0.005]; o.vib=0.15; }   // Z190 moonlight: blue shadows, lamps stay warm   // Z137 brighter (was exp 1.3, lift .012/.018/.032)
  else { o.exp=1.08; o.night=0; }
  return o;
}
// ---- Z97 VISIBLE SKY: a real gradient dome (zenith → horizon haze that melts into the fog), sun glow by day, moon + stars by night ----
export const SKY = new THREE.Mesh(new THREE.SphereGeometry(480, 64, 32), new THREE.ShaderMaterial({ side:THREE.BackSide, depthWrite:false, fog:false, defines:{ FINE_STARS: MOBILE?0:1 },   // Z235 phones skip the faintest star layer
  uniforms:{ top:{value:new THREE.Color(0x5b84b8)}, hor:{value:new THREE.Color(0xc9b48c)}, sunCol:{value:new THREE.Color(0xffffff)}, sunDir:{value:new THREE.Vector3(0,1,0)}, night:{value:0},
    cTex:{value:null}, cOff:{value:new THREE.Vector2()}, cCov:{value:new THREE.Vector3(0.6,0.2,0)}, cLit:{value:new THREE.Color(0xffffff)}, cDark:{value:new THREE.Color(0x8a94a4)}, cFlash:{value:0},   // Z145 clouds
    time:{value:0}, moonPh:{value:1.2}, mwN:{value:new THREE.Vector3(0.38,0.62,0.68).normalize()}, mwC:{value:new THREE.Vector3(0.72,0.34,-0.6).normalize()} },   // Z235 twinkle clock · moon phase · Milky Way plane + its bright core
  vertexShader:'varying vec3 vD; void main(){ vD=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }',
  // Z235 A REAL SKY: the blue deepens fast above the horizon (optical depth), a bright pale-blue horizon band instead of a white wall; the sun is a
  //   limb-darkened disc in a three-part glow with a warm horizon flush on its side when low; at night: point stars of every brightness and
  //   colour that twinkle, the Milky Way (a glowing band with a warm core, dark dust rifts and a dense star field), and a cratered moon in its
  //   phase with earthshine on the dark side and a soft halo
  fragmentShader:`uniform vec3 top,hor,sunCol,sunDir,cCov,cLit,cDark,mwN,mwC; uniform float night,cFlash,time,moonPh; uniform sampler2D cTex; uniform vec2 cOff; varying vec3 vD;
    float h(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
    vec3 starL(vec3 d, float N, float th, float tw){ vec3 p=d*N, q=floor(p); float r=h(q); if(r<th) return vec3(0.0);
      vec3 o=vec3(h(q+1.3),h(q+2.7),h(q+4.1))*0.7+0.15; float dist=length(p-q-o), b=pow((r-th)/(1.0-th),2.2);
      float t=h(q+7.7), twk=1.0-tw+tw*(0.55+0.45*sin(time*(2.0+t*5.0)+t*40.0));
      vec3 col=t<0.25?vec3(0.7,0.8,1.0):t<0.75?vec3(1.0,0.97,0.92):vec3(1.0,0.82,0.62);
      return col*b*twk*smoothstep(0.16+b*0.12,0.0,dist)*2.4; }
    void main(){ vec3 d=normalize(vD); float y=d.y, yy=max(y,0.0), day=1.0-night;
      float k=1.0-exp(-yy*(night>0.5?3.5:6.0));                                                // optical depth: blue builds fast above the horizon
      vec3 haze=mix(hor, mix(top,vec3(1.0),0.55), 0.38*day);                                       // the horizon band is bright and faintly blue, not a grey wall
      vec3 c=mix(haze, top, k);
      c*=1.0+day*0.55*k;                                                                           // daylight sky is brighter than the ground it lights
      if(y<0.0) c=mix(haze, hor*0.92, smoothstep(0.0,-0.12,y));
      float s=max(dot(d,sunDir),0.0);
      vec2 hz=normalize(d.xz+1e-4), sz=normalize(sunDir.xz+1e-4); float side=max(dot(hz,sz),0.0);
      c+=sunCol*pow(side,3.0)*exp(-yy*7.0)*(1.0-smoothstep(0.15,0.7,sunDir.y))*0.55*day;            // warm flush along the horizon on the sun's side when it is low
      if(night<0.5){ c+=sunCol*(pow(s,6.0)*0.10 + pow(s,48.0)*0.28 + pow(s,700.0)*1.2);             // forward scatter: wide glow, aureole, corona
        float disc=smoothstep(0.99955,0.99972,s); float mu=sqrt(max(0.0,1.0-pow((1.0-s)/0.00045,2.0)));
        c+=sunCol*disc*(3.2+2.8*mu); }
      else {
        // ---- the Milky Way ----
        float md=dot(d,mwN), along=dot(d,mwC), band=exp(-md*md*22.0), core=exp(-md*md*60.0)*pow(max(along,0.0)*0.5+0.5,4.0);
        vec2 mu=vec2(atan(d.z,d.x)*0.9, md*3.0); float n=texture2D(cTex, mu*0.7+0.3).r*0.6+texture2D(cTex, mu*2.1+0.7).r*0.4;
        float rift=1.0-0.75*exp(-pow((md-0.025*sin(along*9.0))/0.03,2.0))*smoothstep(-0.2,0.6,along);   // dark dust lanes down the middle
        vec3 mw=(vec3(0.55,0.62,0.85)*band*0.16 + vec3(1.0,0.86,0.66)*core*0.42)*(0.45+0.9*n)*rift*smoothstep(0.0,0.25,yy);
        c+=mw;
        float dense=band*0.06;
        vec3 st=starL(d,260.0,0.9965-dense*0.3,0.5)+starL(d,620.0,0.992-dense,0.25)*0.55;
        #if FINE_STARS
        st+=starL(d,1300.0,0.985-dense*1.5,0.0)*0.22*(0.3+band);
        #endif
        c+=st*smoothstep(0.02,0.22,yy);
        // ---- the moon (the night light comes from it) ----
        vec3 T=normalize(cross(sunDir,vec3(0.0,1.0,0.0))+1e-4), B=cross(T,sunDir); float R=0.034;
        vec2 uv=vec2(dot(d,T),dot(d,B))/R; float r2=dot(uv,uv);
        c+=vec3(0.75,0.82,1.0)*(pow(s,900.0)*0.35+pow(s,60.0)*0.06+pow(s,8.0)*0.03);              // halo in the thin cloud / haze
        if(r2<1.0 && s>0.0){ vec3 nn=vec3(uv,sqrt(1.0-r2)); vec3 L=normalize(vec3(cos(moonPh),0.15,sin(moonPh)));
          float alb=0.62+0.38*smoothstep(0.35,0.75,texture2D(cTex,uv*0.22+0.41).r) - 0.12*smoothstep(0.55,0.8,texture2D(cTex,uv*0.6+0.13).r);   // maria + crater speckle
          float lit=smoothstep(-0.05,0.12,dot(nn,L)), limb=0.75+0.25*nn.z;
          vec3 mc=vec3(1.0,0.97,0.9)*alb*limb*(lit*2.6+0.06);                                       // sunlit face + earthshine
          c=mix(c, mc, smoothstep(1.0,0.96,r2)); } }
      if(cCov.z>0.001 && d.y>0.0){ vec2 uv=d.xz/(d.y+0.1)*0.32+cOff;                                // Z145 a cloud deck: layered noise, dark heavy cores, sunlit silver edges
        float n=texture2D(cTex,uv).r*0.58+texture2D(cTex,uv*2.3+0.17).r*0.28+texture2D(cTex,uv*5.3+0.53).r*0.14;
        float dens=smoothstep(cCov.x, cCov.x+cCov.y, n)*smoothstep(0.0,0.16,d.y), thick=smoothstep(cCov.x, 1.0, n);
        float sn=max(dot(d,sunDir),0.0), sil=pow(sn,5.0)*(1.0-thick)*1.6, glow=pow(sn,2.0)*0.25;
        vec3 cc=mix(cLit, cDark, thick*0.9) + sunCol*(sil+glow)*(1.0-night*0.7) + vec3(0.8,0.85,1.0)*cFlash*(0.4+thick);
        cc=mix(cc, haze, (1.0-smoothstep(0.0,0.3,d.y))*0.55);                                       // Z235 far clouds fade into the horizon haze
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
  FOUNDRY:{clear:1,fair:1,dramatic:3,storm:4}, RUINS:{clear:1,fair:2,dramatic:4,storm:3}, STEELMILL:{clear:1,fair:2,dramatic:4,storm:2}, VOLCANO:{clear:0,fair:1,dramatic:5,storm:3}, QUARRY:{clear:4,fair:4,dramatic:1,storm:1}, _:{clear:2,fair:4,dramatic:3,storm:2} };
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
export function updateSkyMood(dt){ const u=SKY.material.uniforms, c=CLOUD.u.uCloud.value; u.cOff.value.set(c.x/1300, c.y/1300); u.time.value+=dt;
  u.cFlash.value=Math.max(0, u.cFlash.value-dt*4);
  const M=SKYMOOD.m; if(M.bolt && S.mode==='playing'){ SKYMOOD.boltT-=dt; if(SKYMOOD.boltT<=0){ SKYMOOD.boltT=M.bolt[0]+Math.random()*(M.bolt[1]-M.bolt[0]); u.cFlash.value=1; try{ WX.flash=Math.max(WX.flash, 0.35); }catch(e){} } } }
export function setSky(A){ const u=SKY.material.uniforms; u.top.value.setHex(A.top); u.hor.value.copy(A._fogC||new THREE.Color(A.fog)); u.sunCol.value.setHex(A.sun); u.sunDir.value.copy(SUN_DIR); u.night.value=A.night?1:0; u.moonPh.value=0.5+Math.random()*2.2; }   // Z235 the moon's phase changes from battle to battle
export function applyAtmosphere(b){
  const A=todAtmos(ATMOS[b.name]||ATMOS.DESERT, S.tod||'day');
  SUN_DIR.set(Math.cos(A.el)*Math.sin(A.az), Math.sin(A.el), Math.cos(A.el)*Math.cos(A.az)).normalize();
  scene.environment = skyEnvTexture(b.name, A); scene.environmentIntensity = 0.6;
  const fogC=new THREE.Color(A.fog); if(!A.night) fogC.lerp(_WHITE, 0.08).lerp(new THREE.Color(A.top), 0.14);   // Z235 aerial perspective: distance turns faintly blue                          // Z97 daylight haze is bright (aerial perspective), never a dark smog band
  scene.background.copy(fogC); scene.fog.color.copy(fogC); scene.fog.density = A.fogD; A._fogC=fogC;
  sun.color.setHex(A.sun); sun.intensity = A.sunI;
  hemi.color.setHex(A.top); hemi.groundColor.setHex(A.hemiG); hemi.intensity = 0.7;
  ambient.color.setHex(A.hor); ambient.intensity = 0.12;
  const u=gradePass.uniforms; u.lift.value.set(...A.lift); u.gain.value.set(...A.gain); u.sat.value=A.sat; u.contrast.value=A.con;
  u.shTint.value.set(...(A.sh||[-0.015,0,0.025])); u.hiTint.value.set(...(A.hi||[0.025,0.01,-0.02])); u.vib.value=A.vib??0.25;   // Z190 film look per battlefield
  renderer.toneMappingExposure = A.exp||1.08;
  hemi.intensity = A.night ? 0.85 : 0.72; scene.environmentIntensity = A.night ? 0.5 : 0.6;
  if(A.night){ hemi.color.setHex(0x44567e); ambient.color.setHex(0x7a8ab4); ambient.intensity=0.36; }   // moonlight fill — shadows stay blue-grey, never black
  u.vig.value = A.night ? 0.22 : 0.28;                                                                 // softer vignette (less eye strain)
  setSky(A);                                                                                           // Z97 visible sky dome matches the light
  SKY.visible=!A.cave;
  if(A.cave){ SKYMOOD.id='clear'; SKYMOOD.m=MOODS.clear; SKYMOOD.boltT=0; CLOUD.u.uCloud.value.w=0;   // Z225 the cavern: no sky, no clouds — black rock, warm torch fill, a cool glow off the shafts
    hemi.color.setHex(0x4a5878); hemi.groundColor.setHex(0x3a2614); hemi.intensity=0.95; ambient.color.setHex(0x8a6a4a); ambient.intensity=0.62; scene.environmentIntensity=0.3; u.vig.value=0.3; renderer.toneMappingExposure=1.4; }
  else applyMood(A, pickMood(b.name, S.tod||'day'));                                                  // Z145 the sky's mood for this battle
  { const L=LIGHT, g=gradePass.uniforms; renderer.toneMappingExposure*=L.expK; g.sat.value*=L.satK; g.contrast.value*=L.conK; g.vib.value=L.vib;   // Z242 realistic light (config LIGHT)
    if(!A.cave){ scene.fog.density*=L.fogK;
      if(A.night) hemi.intensity*=L.nightHemiK;
      else { sun.intensity*=L.sunK; hemi.intensity*=L.hemiK; ambient.intensity=L.ambient; scene.environmentIntensity*=L.envK; } } }
  setNightLights(!!A.night);
  try{ WX.base=null; }catch(e){}   // Z144 weather re-reads this fresh atmosphere as its base (at boot the weather module is not loaded yet)
}
// keep the key light (and its tight shadow frustum) centred on the action; snap to shadow texels to stop shimmer
export function updateSunFollow(){
  const p=S.player, cx = p ? p.pos.x : 0, cz = p ? p.pos.z : 0, tx=(SHADOW_EXT.r*2)/SHADOW_MAP;
  const sx=Math.round(cx/tx)*tx, sz=Math.round(cz/tx)*tx;
  sun.target.position.set(sx,0,sz); sun.position.set(sx+SUN_DIR.x*90, SUN_DIR.y*90, sz+SUN_DIR.z*90); sun.target.updateMatrixWorld();
}
