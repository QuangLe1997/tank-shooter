// actors/core.js — CORE (base to defend)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLOW, NIGHT, _R, _canvasTex, _mergeColored, _xf, bigExplode, coverMat, gameOver, makeFlag, propTex, scene, sfx, shieldHexTex, spawnPart, unwave, updateHUD, vnTex } from '../hub.js';

// ----------------------------- CORE (base to defend) -----------------------------
export let core=null;
// per-stage monument themes — biome-matched, escalating
export const CORE_THEMES = [
  { crystal:0x7fe6ff, glow:0x2fa8d8, ring:0x4fd1ff, beam:0x9fefff, deep:0x0a3a5a },   // S1 reactor cyan
  { crystal:0xe8eef4, glow:0x8090a2, ring:0xcfd8e2, beam:0xf2f7fc, deep:0x2a3442 },   // S2 steel monolith
  { crystal:0xa8e8ff, glow:0x3aa6d6, ring:0x7fd4ff, beam:0xd6f2ff, deep:0x123a5a },   // S3 frost shard
  { crystal:0xff9a52, glow:0xc8481c, ring:0xff7e3a, beam:0xffc795, deep:0x4a1206 },   // S4 molten forge
  { crystal:0xffd884, glow:0xca9522, ring:0xffc64e, beam:0xfff1c6, deep:0x4a3006 },   // S5 golden citadel
];
// living crystal: faceted (screen-space normals) + Fresnel rim + energy bands flowing through it; turns red & flickers as the Core is hurt
export const CrystalShader = {
  vertexShader:'varying vec3 vW; varying vec3 vL; void main(){ vL=position; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
  fragmentShader:`uniform float time, flash, dmg; uniform vec3 colA, colB, colC; varying vec3 vW; varying vec3 vL;
    void main(){
      vec3 n=normalize(cross(dFdx(vW), dFdy(vW))); vec3 v=normalize(cameraPosition-vW);
      float fr=pow(1.0-abs(dot(n,v)), 2.0);
      float band=sin(vL.y*7.0 - time*2.6 + sin(vL.x*4.0+time*1.3)*1.4)*0.5+0.5;
      float spark=pow(max(0.0, sin(vL.x*13.0+time*5.0)*sin(vL.z*11.0-time*4.0)*sin(vL.y*9.0+time*3.0)), 6.0);
      float facet=0.75+0.25*abs(dot(n, normalize(vec3(0.4,0.8,0.3))));
      vec3 c=mix(colA, colB, band*0.7)*facet + colC*fr*1.6 + vec3(1.0)*spark*1.5;
      float hurt=smoothstep(0.35,1.0,dmg); float fl = dmg>0.65 ? (0.6+0.4*step(0.5, fract(sin(floor(time*14.0))*43758.5))) : 1.0;
      c=mix(c, vec3(1.6,0.25,0.12)*(0.7+band*0.6), hurt*0.75)*fl;
      c*=1.15+0.25*sin(time*2.2);
      c=mix(c, vec3(3.0), flash);
      gl_FragColor=vec4(c,1.0);
    }` };
export function buildCore(stage=1){
  if(core && core.mesh){ unwave(core.mesh); scene.remove(core.mesh); }   // Z104 stop animating the old core's flags
  const th = CORE_THEMES[Math.min(Math.max(stage,1)-1, CORE_THEMES.length-1)];
  const g=new THREE.Group();
  const stone=new THREE.MeshStandardMaterial({ map:propTex('concrete'), color:0x9c968a, roughness:0.88, metalness:0.02 });
  const brass=new THREE.MeshStandardMaterial({ color:0xb08a3e, roughness:0.32, metalness:0.95, envMapIntensity:1.2 });
  const iron =new THREE.MeshStandardMaterial({ color:0x2a2e30, roughness:0.42, metalness:0.9, map:propTex('drum'), envMapIntensity:1.0 });
  const add=(geo,mat,x,y,z,cast)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); if(cast!==false){ m.castShadow=true; m.receiveShadow=true; } g.add(m); return m; };
  // octagonal stone plinth in three tiers, brass-capped edges
  add(new THREE.CylinderGeometry(3.6,3.9,0.7,8), stone, 0,0.35,0); add(new THREE.CylinderGeometry(3.66,3.66,0.08,8), brass, 0,0.72,0);
  add(new THREE.CylinderGeometry(2.8,3.1,0.6,8), stone, 0,1.06,0); add(new THREE.CylinderGeometry(2.86,2.86,0.07,8), brass, 0,1.38,0);
  add(new THREE.CylinderGeometry(1.9,2.2,0.5,8), stone, 0,1.66,0);
  // dark steel column with brass ribs
  add(new THREE.CylinderGeometry(0.75,1.05,2.6,8), iron, 0,3.2,0);
  for(let i=0;i<8;i++){ const a=i/8*Math.PI*2+Math.PI/8; const rib=add(new THREE.BoxGeometry(0.1,2.5,0.12), brass, Math.cos(a)*0.9,3.15,Math.sin(a)*0.9); rib.rotation.y=-a; rib.rotation.z=0.06*Math.cos(a); rib.rotation.x=-0.06*Math.sin(a); }
  add(new THREE.CylinderGeometry(1.25,0.8,0.36,8), brass, 0,4.62,0);
  // four brass claws cradling the crystal
  for(let i=0;i<4;i++){ const a=i/4*Math.PI*2+Math.PI/4; const claw=new THREE.Mesh(new THREE.TorusGeometry(1.25,0.09,8,18,Math.PI*0.62), brass);
    claw.position.set(Math.cos(a)*0.32,5.0,Math.sin(a)*0.32); claw.rotation.set(0,-a+Math.PI/2,Math.PI*0.62); claw.castShadow=true; g.add(claw); }
  // the crystal (custom shader) + soft inner glow
  const cu={ time:{value:0}, flash:{value:0}, dmg:{value:0}, colA:{value:new THREE.Color(th.deep)}, colB:{value:new THREE.Color(th.crystal).multiplyScalar(1.4)}, colC:{value:new THREE.Color(th.beam).multiplyScalar(1.3)} };
  const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(1.25,0), new THREE.ShaderMaterial({ uniforms:cu, vertexShader:CrystalShader.vertexShader, fragmentShader:CrystalShader.fragmentShader }));
  crystal.scale.set(0.9,1.55,0.9); crystal.position.y=6.25; g.add(crystal);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:th.beam,transparent:true,opacity:0.45,blending:THREE.AdditiveBlending,depthWrite:false})); glow.scale.setScalar(6.0); glow.position.y=6.25; g.add(glow);
  // brass gimbal rings with glowing nodes
  const rings=[], nodeM=new THREE.MeshStandardMaterial({ color:0x111111, emissive:th.ring, emissiveIntensity:2.2 });
  for(let i=0;i<2+Math.min(1,Math.max(0,stage-2));i++){ const rg=new THREE.Group(); rg.position.y=6.25; g.add(rg);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(2.05+i*0.38,0.05,6,56), brass); rg.add(ring);
    for(let k=0;k<4;k++){ const a=k/4*Math.PI*2; const nd=new THREE.Mesh(new THREE.SphereGeometry(0.09,8,6), nodeM); nd.position.set(Math.cos(a)*(2.05+i*0.38), Math.sin(a)*(2.05+i*0.38), 0); rg.add(nd); }
    rings.push({ mesh:rg, ax:new THREE.Vector3(Math.cos(i*1.7),0.6+i*0.3,Math.sin(i*1.7)).normalize(), spd:(0.45+i*0.25)*(i%2?-1:1) }); }
  // light pillar (scrolling energy) + faint protective dome
  const bt=_canvasTex(32,256,(x,W,H)=>{ for(let y=0;y<H;y++){ const a=0.35+0.65*Math.pow(Math.sin(y/H*Math.PI*6+Math.sin(y*0.13)*2)*0.5+0.5,2); x.fillStyle='rgba(255,255,255,'+(a*(1-y/H)).toFixed(3)+')'; x.fillRect(0,y,W,1); } }, true);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.9,22,16,1,true), new THREE.MeshBasicMaterial({ map:bt, color:th.beam, transparent:true, opacity:0.2, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide })); beam.position.y=6.25+11; g.add(beam);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(5.6,28,18,0,Math.PI*2,0,Math.PI*0.55), new THREE.MeshBasicMaterial({ map:shieldHexTex(), color:th.ring, transparent:true, opacity:0.06, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide })); dome.position.y=0.2; g.add(dome);
  // ground halo
  const halo=new THREE.Mesh(new THREE.CircleGeometry(8,40), new THREE.MeshBasicMaterial({ map:GLOW, color:th.glow, transparent:true, opacity:0.35, blending:THREE.AdditiveBlending, depthWrite:false })); halo.rotation.x=-Math.PI/2; halo.position.y=0.05; g.add(halo);
  // sandbag ring guarding the plinth
  { const P=[], tones=[0xc9b48a,0xb8a276,0xa8936a,0xd4c29a]; for(let L=0;L<2;L++){ const n=26; for(let k=0;k<n;k++){ const a=(k+(L?0.5:0))/n*Math.PI*2, bag=new RoundedBoxGeometry(1.0,0.34,0.5,2,0.14);
      _xf(bag, Math.cos(a)*4.45, 0.18+L*0.32, Math.sin(a)*4.45, _R(-0.05,0.05), -a+Math.PI/2+_R(-0.06,0.06), 0, 1,_R(0.9,1.08),1); P.push({geo:bag,col:tones[(Math.random()*tones.length)|0]}); } }
    const ring=new THREE.Mesh(_mergeColored(P), coverMat('sandbag')); ring.castShadow=true; ring.receiveShadow=true; g.add(ring); }
  // two flagpoles with flags that wave in the wind
  const flags=[];
  for(const sx of [-1,1]){ const px=sx*3.3, pz=-1.4;
    add(new THREE.CylinderGeometry(0.05,0.07,9,8), brass, px,4.5,pz); add(new THREE.SphereGeometry(0.12,10,8), brass, px,9.05,pz);
    const fm=makeFlag(vnTex(), 2.6, 1.7, sx); fm.position.set(px,8.1,pz); g.add(fm); flags.push(fm); }   // Vietnamese flags over the command post
  const light=new THREE.PointLight(th.glow,1.6,40); light.position.y=6.25; g.add(light);
  scene.add(g);
  core = { mesh:g, crystal, cu, glow, beam, dome, halo, rings, sparks:[], shards:[], flags, light, theme:th, moteT:0,
    pos:new THREE.Vector3(0,0,0), hp:240, maxHp:240, r:4.2, flash:0 };
}
export function rebuildCore(stage){ const keepMax = core ? core.maxHp : 240; buildCore(stage); core.maxHp=keepMax; core.hp=keepMax; updateHUD(); }
export function damageCore(dmg){
  if(!core) return; core.hp-=dmg; core.flash=0.16; core.cu.flash.value=0.85;
  sfx('corehit');
  updateHUD();
  if(core.hp<=0){ core.hp=0; bigExplode(core.pos, core.theme.crystal, 3); gameOver('LÕI ĐÃ BỊ PHÁ HUỶ'); }
}
export function updateCore(dt, now){
  if(!core) return; const c=core;
  c.cu.time.value = now%1000; c.cu.dmg.value = 1 - Math.max(0,c.hp)/c.maxHp;
  c.crystal.rotation.y += dt*0.5; c.crystal.position.y = 6.25 + Math.sin(now*1.3)*0.18;
  const pulse = 0.82 + Math.sin(now*2.2)*0.22;
  c.glow.material.opacity = 0.42*pulse; c.glow.position.y = c.crystal.position.y;
  c.beam.material.opacity = 0.16 + Math.sin(now*1.6)*0.05; c.beam.material.map.offset.y = -(now*0.35)%1;
  c.dome.material.opacity = 0.05 + Math.sin(now*1.1)*0.025; c.dome.material.map.offset.x += dt*0.02;
  c.halo.material.opacity = 0.28 + 0.1*pulse;
  c.light.intensity = (NIGHT.k>0.5 ? 3.2 : 1.6)*pulse;                                       // the Core lights up its surroundings at night
  for(const r of c.rings) r.mesh.rotateOnAxis(r.ax, dt*r.spd);
  c.moteT -= dt; if(c.moteT<=0){ c.moteT=0.12; const a=Math.random()*6.283, r=1+Math.random()*2.6;   // glints drifting up through the beam
    spawnPart(Math.cos(a)*r, 2+Math.random()*3, Math.sin(a)*r, Math.cos(a)*0.2, 1.6+Math.random()*1.4, Math.sin(a)*0.2, { color:c.theme.beam, size:0.22+Math.random()*0.2, life:1.4, grav:0.2, drag:0.4 }); }
  if(c.flash>0){ c.flash-=dt; c.cu.flash.value=Math.max(0, c.flash/0.16)*0.85; }
}
