// fx/smoketrail.js — Z236 SMOKE RIBBONS: a tank-gun round no longer leaves a string of separate puffs behind it but one unbroken line of
//   smoke along its real flight path, the way a shell's trail looks on film — thin and dense at the round, widening, thinning, rising and
//   drifting on the wind behind it, curling as it ages, its edges torn by noise, gone after a few seconds.
//   Each ribbon is a strip of points laid as the round flies (the last point rides on the round itself, so the line meets the shell with
//   no gap). The strip is turned to face the camera, widened, lifted, drifted and faded in the vertex shader from each point's birth time,
//   so after a point is laid the CPU never touches it again. One shared material; a pool of ribbons (a round that flies past the end of
//   its ribbon carries on in a fresh one). When the pool is used up the round falls back to the old puff trail.
import * as THREE from 'three';
import { SMOKE_TRAIL } from '../../config.js';
import { MOBILE, S, scene } from '../hub.js';

const ST=SMOKE_TRAIL, N=ST.points;
export const SMOKE_U = { uNow:{ value:0 }, uTint:{ value:new THREE.Color(1,1,1) }, uWind:{ value:new THREE.Vector2(ST.wind[0], ST.wind[1]) }, uRise:{ value:ST.rise }, uCurl:{ value:ST.curl } };
let _mat=null;
function smokeMat(){ if(_mat) return _mat;
  _mat=new THREE.ShaderMaterial({ uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]), transparent:true, depthWrite:false, side:THREE.DoubleSide, fog:true,
    vertexShader:`uniform float uNow, uRise, uCurl; uniform vec2 uWind;
      attribute float aSide, aBorn, aU; attribute vec3 aTan, aCol; attribute vec4 aK;
      varying vec2 vUv; varying float vA, vAge; varying vec3 vCol;
      #include <fog_pars_vertex>
      void main(){ float age=max(0.0, uNow-aBorn), k=age/aK.z;
        vec3 p=position + vec3(uWind.x, uRise, uWind.y)*age;
        p += vec3(sin(aU*0.31+age*0.8), 0.6*sin(aU*0.23+age*0.6), cos(aU*0.27+age*0.7))*uCurl*age;
        float w=aK.x + aK.y*sqrt(age);
        vec3 vd=normalize(cameraPosition-p), sd=cross(aTan, vd); float sl=length(sd); sd = sl>1e-4 ? sd/sl : vec3(0.0,1.0,0.0);
        p += sd*aSide*w;
        vUv=vec2(aU, aSide); vCol=aCol; vAge=k;
        vA = k>=1.0 ? 0.0 : aK.w*smoothstep(0.0,0.06,age)*pow(1.0-k,1.5)*clamp(sqrt(aK.x/w)*1.35, 0.35, 1.0)*smoothstep(0.0, 2.5, aU);   // thin at the muzzle, the line builds over its first metres
        vec4 mvPosition=viewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`uniform vec3 uTint; varying vec2 vUv; varying float vA, vAge; varying vec3 vCol;
      #include <fog_pars_fragment>
      float hs(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hs(i),hs(i+vec2(1,0)),f.x), mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x), f.y); }
      void main(){ float x=vUv.y;
        float n=vn(vec2(vUv.x*0.55-vAge*1.6, x*1.3+vAge*2.2))*0.62 + vn(vec2(vUv.x*1.7+vAge*3.1, x*3.2-vAge))*0.38;
        float edge=1.0-smoothstep(0.2+0.45*n, 1.0, abs(x));
        float a=vA*edge*(0.4+0.8*n); if(a<0.004) discard;
        gl_FragColor=vec4(vCol*uTint*(0.7+0.48*n), a);   // light and shade inside the smoke: it reads against bright sand as well as against grass
        #include <fog_fragment>
      }` });
  _mat.uniforms.uNow=SMOKE_U.uNow; _mat.uniforms.uTint=SMOKE_U.uTint; _mat.uniforms.uWind=SMOKE_U.uWind; _mat.uniforms.uRise=SMOKE_U.uRise; _mat.uniforms.uCurl=SMOKE_U.uCurl;
  return _mat; }

export const SMOKE_RIBBONS=[]; const RIB=SMOKE_RIBBONS;   // the pool
function mkRibbon(){ const geo=new THREE.BufferGeometry(), V=N*2, A=(n)=>new THREE.BufferAttribute(new Float32Array(V*n), n);
  const at={ position:A(3), aTan:A(3), aCol:A(3), aK:A(4), aSide:A(1), aBorn:A(1), aU:A(1) };
  for(const k in at){ at[k].setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, at[k]); }
  for(let i=0;i<N;i++){ at.aSide.array[i*2]=-1; at.aSide.array[i*2+1]=1; }
  const idx=[]; for(let i=0;i<N-1;i++){ const a=i*2; idx.push(a,a+1,a+2, a+1,a+3,a+2); } geo.setIndex(idx); geo.setDrawRange(0,0);
  const m=new THREE.Mesh(geo, smokeMat()); m.frustumCulled=false; m.renderOrder=3; m.visible=false; scene.add(m);
  const r={ m, at, n:0, until:-1, k:null, u:0, lx:0, ly:0, lz:0 }; RIB.push(r); return r; }
function grab(){ const now=SMOKE_U.uNow.value; for(const r of RIB) if(now>r.until) return r;
  return RIB.length<(MOBILE?ST.capMobile:ST.cap) ? mkRibbon() : null; }
// write point j of ribbon r (both of its edge vertices)
function put(r, j, x, y, z, born, u, tx, ty, tz){ const A=r.at, K=r.k, c=r.col;
  for(let s=0;s<2;s++){ const v=j*2+s; A.position.setXYZ(v,x,y,z); A.aTan.setXYZ(v,tx,ty,tz); A.aCol.setXYZ(v,c.r,c.g,c.b); A.aK.setXYZW(v,K.w0,K.grow,K.life,K.op); A.aBorn.setX(v,born); A.aU.setX(v,u); } }
function flush(r){ for(const k in r.at) if(k!=='aSide') r.at[k].needsUpdate=true; r.m.geometry.setDrawRange(0, r.n*6); }
const _c=new THREE.Color();
function start(kind, x, y, z, tx, ty, tz, u){ const r=grab(); if(!r) return null; const K=ST.kinds[kind]; r.k=K; r.col=(r.col||new THREE.Color()).setHex(K.col); r.kind=kind;
  const now=SMOKE_U.uNow.value; r.n=1; r.u=u||0; r.lx=x; r.ly=y; r.lz=z; put(r, 0, x,y,z, now, r.u, tx,ty,tz); put(r, 1, x,y,z, now, r.u, tx,ty,tz); r.until=now+K.life+0.1; r.m.visible=true; flush(r); return r; }

export const smokeKind=k=>!!ST.kinds[k];
// lay the ribbon behind round b (at its current point x,y,z); false = no ribbon free (use the puff trail)
export function smokeRibbon(b, kind, x, y, z){ let r=b._rb;
  if(r===undefined){ const s=Math.hypot(b.vx,b.vz)||1; r=b._rb=start(kind, x,y,z, b.vx/s, 0, b.vz/s, 0); }
  if(!r) return false;
  const now=SMOKE_U.uNow.value, step=MOBILE?ST.stepMobile:ST.step, dx=x-r.lx, dy=y-r.ly, dz=z-r.lz, L=Math.hypot(dx,dy,dz);
  const tx=L>1e-4?dx/L:0, ty=L>1e-4?dy/L:0, tz=L>1e-4?dz/L:1;
  if(L>=step){ r.u+=L; r.lx=x; r.ly=y; r.lz=z; put(r, r.n, x,y,z, now, r.u, tx,ty,tz); r.n++;
    if(r.n>=N-1){ r.until=now+r.k.life+0.1; flush(r); const nr=start(kind, x,y,z, tx,ty,tz, r.u); b._rb=nr; return !!nr; }   // this strip is full: carry on in a fresh one
    put(r, r.n, x,y,z, now, r.u, tx,ty,tz); }
  else put(r, r.n, x,y,z, now, r.u+L, tx,ty,tz);   // the head rides on the round
  r.until=now+r.k.life+0.1; flush(r); return true; }

// once a frame: the ribbons' clock, light by the time of day; finished ribbons are hidden
export function updateSmokeTrails(dt){ const U=SMOKE_U; U.uNow.value+=dt; const now=U.uNow.value;
  const tod=S.tod; U.uTint.value.copy(tod==='night' ? _c.setRGB(0.34,0.37,0.44) : tod==='sunset' ? _c.setRGB(1.0,0.84,0.7) : _c.setRGB(1,1,1));
  for(const r of RIB) if(r.m.visible && now>r.until){ r.m.visible=false; r.m.geometry.setDrawRange(0,0); } }
