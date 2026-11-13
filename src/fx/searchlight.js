// fx/searchlight.js — Z146 SEARCHLIGHTS that read as real light in night air, not a glowing plastic cone:
//   · a volumetric beam shader — soft edges (bright core, the rim melts away), hot at the lamp and thinning with distance, drifting dust in the shaft,
//     and it fades out where it meets the ground instead of slicing through it
//   · a pool of light on the ground where the beam lands, stretched by the grazing angle, sweeping with the lamp
//   · glare on the lamp glass that flares when the beam swings toward the camera
//   · ONE real SpotLight that rides the searchlight nearest the tank, so the beam actually lights you up as it passes
import * as THREE from 'three';
import { MOBILE, NIGHT, S, camera, detailTex, fortBeamBlocked, heightAt, scene } from '../hub.js';

export const BEAM_U = { uT:{ value:0 }, uK:{ value:0 } };
// s = 0 at the lamp → 1 at the far end (CylinderGeometry with the narrow end on top: uv.y = 1 at the lamp)
export function beamMat(col, str, floor){ const m=new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, fog:false,
    uniforms:{ uT:BEAM_U.uT, uK:BEAM_U.uK, uOp:{ value:str }, uCol:{ value:new THREE.Color(col) }, uFloor:{ value:floor??-1e4 }, uDust:{ value:detailTex() } },
    vertexShader:`varying vec3 vN; varying vec3 vV; varying float vS; varying vec3 vW;
      void main(){ vS=1.0-uv.y; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vec4 mv=viewMatrix*w; vV=-mv.xyz; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`uniform float uT,uK,uOp,uFloor; uniform vec3 uCol; uniform sampler2D uDust; varying vec3 vN; varying vec3 vV; varying float vS; varying vec3 vW;
      void main(){ float edge=abs(dot(normalize(vN),normalize(vV)));
        float a=pow(edge,2.2);
        a*=pow(1.0-vS,1.7)*(0.35+2.4*exp(-vS*9.0));
        float d=texture2D(uDust, vW.xz*0.06+vec2(uT*0.021,uT*0.013)+vW.y*0.03).g*0.6+texture2D(uDust, vW.xz*0.19-vec2(uT*0.04,uT*0.017)).r*0.4;
        a*=0.45+0.9*d;
        a*=smoothstep(uFloor-0.1, uFloor+1.6, vW.y);
        gl_FragColor=vec4(uCol*a*uOp*uK, 1.0); }` });
  return m; }

let _poolTex=null, _glareTex=null;
function radial(stops, n=128){ const c=document.createElement('canvas'); c.width=c.height=n; const x=c.getContext('2d'), g=x.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);
  for(const [o,col] of stops) g.addColorStop(o,col); x.fillStyle=g; x.fillRect(0,0,n,n); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
const poolTex=()=>_poolTex||(_poolTex=radial([[0,'rgba(255,248,226,1)'],[0.35,'rgba(255,240,205,0.75)'],[0.7,'rgba(255,230,190,0.22)'],[1,'rgba(255,230,190,0)']]));
const glareTex=()=>_glareTex||(_glareTex=radial([[0,'rgba(255,255,255,1)'],[0.12,'rgba(255,246,220,0.9)'],[0.35,'rgba(255,220,160,0.25)'],[1,'rgba(255,200,140,0)']]));
let _lens=null; export function lensMat(){ if(_lens) return _lens; _lens=new THREE.MeshStandardMaterial({ color:0x222222, emissive:0xfff2d8, emissiveIntensity:0, roughness:0.2 }); NIGHT.lamps.push(_lens); return _lens; }

// dress a searchlight head: beam (inside the aimed group `bg`, along its +z), lens, glare. Returns the state updateSearchlight needs.
export function makeSearchlight(sl, bg, len, r0, r1, floor){ const beam=new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 24, 1, true), beamMat(0xfff0d0, 1.0, floor));
  beam.rotation.x=-Math.PI/2; beam.position.z=len/2; beam.renderOrder=5; bg.add(beam);
  const lens=new THREE.Mesh(new THREE.CircleGeometry(r0*0.95, 16), lensMat()); lens.position.z=0.21; bg.add(lens);
  const gl=new THREE.Sprite(new THREE.SpriteMaterial({ map:glareTex(), color:0xfff2d8, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, fog:false })); gl.position.z=0.3; gl.scale.setScalar(3.2); bg.add(gl);
  const pool=new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({ map:poolTex(), color:0xfff0d0, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-6, polygonOffsetUnits:-6 }));
  pool.rotation.order='YXZ'; pool.renderOrder=4; pool.visible=false; scene.add(pool);
  return { beam, lens, gl, pool, bg, len, r0, r1, hit:new THREE.Vector3(), lamp:new THREE.Vector3(), on:false }; }
export function dropSearchlight(L){ if(L && L.pool){ scene.remove(L.pool); L.pool.geometry.dispose(); L.pool.material.dispose(); } }

const _d=new THREE.Vector3(), _c=new THREE.Vector3();
// per frame: find where the beam lands, lay the pool there, flare the glass toward the camera
export function updateSearchlight(L, k){ L.on=false; L.pool.visible=k>0.02; if(k<=0.02){ L.gl.material.opacity=0; return; }
  L.bg.getWorldPosition(L.lamp); L.bg.getWorldDirection(_d);
  _c.copy(camera.position).sub(L.lamp).normalize(); L.gl.material.opacity=k*(0.18+0.82*Math.pow(Math.max(0,_d.dot(_c)),3));
  if(_d.y > -0.04){ L.pool.visible=false; return; }
  let t=(L.lamp.y-heightAt(L.lamp.x,L.lamp.z))/(-_d.y); for(let i=0;i<3;i++){ const gx=L.lamp.x+_d.x*t, gz=L.lamp.z+_d.z*t; t=(L.lamp.y-heightAt(gx,gz))/(-_d.y); }   // refine against the terrain
  if(t>L.len*1.15){ L.pool.visible=false; return; }
  L.hit.set(L.lamp.x+_d.x*t, 0, L.lamp.z+_d.z*t); L.hit.y=heightAt(L.hit.x,L.hit.z);
  if(fortBeamBlocked(L.lamp.x, L.lamp.y, L.lamp.z, L.hit.x, L.hit.y, L.hit.z)){ L.pool.visible=false; return; }   // Z170 a wall in the way: no pool of light behind it
  const r=L.r0+(L.r1-L.r0)*Math.min(1,t/L.len), stretch=Math.min(3.2, 1/Math.max(0.3,-_d.y));
  L.pool.position.set(L.hit.x, L.hit.y+0.08, L.hit.z); L.pool.rotation.set(-Math.PI/2, Math.atan2(_d.x,_d.z), 0); L.pool.scale.set(r*2.3, r*2.3*stretch, 1);   // plane y → stretched along the beam
  L.pool.material.opacity=k*0.85*(1-0.55*t/L.len); L.on=true; }

// the one real light: rides the searchlight nearest the player
let SPOT=null, SPOT_F=0;
export function searchSpot(){ if(SPOT || MOBILE) return SPOT; SPOT=new THREE.SpotLight(0xfff0d0, 0, 42, 0.17, 0.55, 0); SPOT.visible=false; SPOT.castShadow=true; SPOT.shadow.mapSize.set(512,512); SPOT.shadow.bias=-0.0008; SPOT.shadow.normalBias=0.04; SPOT.shadow.camera.near=1; SPOT.shadow.camera.far=48; SPOT.shadow.autoUpdate=false; scene.add(SPOT); scene.add(SPOT.target); return SPOT; }   // Z170 the searchlight's pool stops at a wall
export function updateSearchSpot(list, k){ const sp=searchSpot(); if(!sp) return; const p=S.player; let best=null, bd=75*75;
  if(p && k>0.02) for(const L of list){ if(!L || !L.on) continue; const q=(L.hit.x-p.pos.x)**2+(L.hit.z-p.pos.z)**2; if(q<bd){ bd=q; best=L; } }
  sp.visible=NIGHT.on; if(!best){ sp.intensity=0; return; }   // visibility follows night only: flipping it per frame would recompile every lit shader
  sp.position.copy(best.lamp); sp.target.position.copy(best.hit); sp.target.updateMatrixWorld(); sp.intensity=k*7; if(sp.castShadow) sp.shadow.needsUpdate=(SPOT_F=(SPOT_F+1)%3)===0; }   // Z170 its shadow redrawn every third frame
export function updateBeams(dt){ BEAM_U.uT.value+=dt; BEAM_U.uK.value=NIGHT.k; }
