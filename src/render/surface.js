// render/surface.js — Z145 REAL SURFACES: what makes a built wall read as stone instead of painted plastic.
//   detailTex()  — one tileable 512² data texture: R = fine stone / plaster relief, G = large weathering blotches, B = vertical rain streaks.
//   detailize(m) — patches any MeshStandardMaterial (vertex-coloured or textured, instanced or not) with a WORLD-SPACE triplanar layer:
//                  albedo breaks up (no two metres alike, so tiling disappears), roughness varies, the surface gets real micro-relief
//                  (derivative bump: lit grain that moves with the sun), rain streaks run down vertical faces and the foot of every wall
//                  is dirtier and darker (cheap baked contact occlusion — the base of a wall sits in its own shadow and splash dirt).
//   hiResMaps(c) — colour canvas → { map, normalMap, roughnessMap } at full anisotropy (wall courses get depth: mortar sinks, blocks stand proud).
//   TEX_K        — how much finer the procedural canvases are painted (4× on desktop, 2× on phones).
import * as THREE from 'three';
import { MOBILE, renderer } from '../hub.js';

export const TEX_K = MOBILE ? 2 : 4;
export function maxAniso(){ try{ return Math.min(16, renderer.capabilities.getMaxAnisotropy()); }catch(e){ return 8; } }

// ---- tileable value noise (period p cells across the tile) ----
function tileNoise(N, p, rnd){ const g=new Float32Array(p*p); for(let i=0;i<g.length;i++) g[i]=rnd(); const o=new Float32Array(N*N);
  for(let y=0;y<N;y++){ const fy=y/N*p, iy=Math.floor(fy), ty=fy-iy, sy=ty*ty*(3-2*ty), y0=iy%p, y1=(iy+1)%p;
    for(let x=0;x<N;x++){ const fx=x/N*p, ix=Math.floor(fx), tx=fx-ix, sx=tx*tx*(3-2*tx), x0=ix%p, x1=(ix+1)%p;
      const a=g[y0*p+x0], b=g[y0*p+x1], c=g[y1*p+x0], d=g[y1*p+x1]; o[y*N+x]=(a+(b-a)*sx)+((c+(d-c)*sx)-(a+(b-a)*sx))*sy; } }
  return o; }
function fbm(N, periods, rnd){ const o=new Float32Array(N*N); let wsum=0;
  for(const [p,w] of periods){ const n=tileNoise(N,p,rnd); for(let i=0;i<o.length;i++) o[i]+=n[i]*w; wsum+=w; }
  let lo=1e9, hi=-1e9; for(let i=0;i<o.length;i++){ o[i]/=wsum; lo=Math.min(lo,o[i]); hi=Math.max(hi,o[i]); }
  for(let i=0;i<o.length;i++) o[i]=(o[i]-lo)/(hi-lo||1); return o; }

// Z145 a tileable fbm noise as a mip-mapped data texture (R = value) — clouds in the sky and their shadows on the ground
export function fbmTex(N, periods, seed){ let s=seed||1; const rnd=()=>((s=(s*16807)%2147483647)/2147483647), f=fbm(N, periods, rnd), D=new Uint8Array(N*N*4);
  for(let i=0;i<N*N;i++){ D[i*4]=D[i*4+1]=D[i*4+2]=f[i]*255; D[i*4+3]=255; }
  const t=new THREE.DataTexture(D, N, N, THREE.RGBAFormat); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.magFilter=THREE.LinearFilter; t.minFilter=THREE.LinearMipmapLinearFilter; t.generateMipmaps=true; t.needsUpdate=true; return t; }
let _DT=null;
export function detailTex(){ if(_DT) return _DT; const N=512; let s=1337; const rnd=()=>((s=(s*16807)%2147483647)/2147483647);
  const fine=fbm(N, [[8,0.9],[16,1.0],[32,0.8],[64,0.55],[128,0.35],[256,0.2]], rnd);
  // pits and chips: little sharp hollows in the grain (stone pores, spalled plaster)
  for(let k=0;k<1400;k++){ const cx=(rnd()*N)|0, cy=(rnd()*N)|0, r=1+rnd()*3.5, dep=0.25+rnd()*0.4;
    for(let dy=-4;dy<=4;dy++) for(let dx=-4;dx<=4;dx++){ const d=Math.hypot(dx,dy); if(d>r) continue; const i=((cy+dy+N)%N)*N+((cx+dx+N)%N); fine[i]=Math.max(0, fine[i]-dep*(1-d/r)); } }
  // hairline cracks
  for(let k=0;k<26;k++){ let x=rnd()*N, y=rnd()*N, a=rnd()*6.28; const len=40+rnd()*140;
    for(let t=0;t<len;t++){ a+=(rnd()-0.5)*0.5; x+=Math.cos(a); y+=Math.sin(a); const i=(((y|0)%N+N)%N)*N+(((x|0)%N+N)%N); fine[i]*=0.35; } }
  const blot=fbm(N, [[3,1.0],[6,0.7],[12,0.45],[24,0.25]], rnd);
  const streakRaw=new Float32Array(N*N); { const a=tileNoise(N,48,rnd), b=tileNoise(N,96,rnd), v=tileNoise(N,3,rnd);   // streaks: noisy in x, long in y
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const i=y*N+x, xs=(a[x]*0.6+b[x]*0.4); streakRaw[i]=xs*(0.55+0.45*v[i]); } }
  const D=new Uint8Array(N*N*4); for(let i=0;i<N*N;i++){ D[i*4]=fine[i]*255; D[i*4+1]=blot[i]*255; D[i*4+2]=streakRaw[i]*255; D[i*4+3]=255; }
  const t=new THREE.DataTexture(D, N, N, THREE.RGBAFormat); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.magFilter=THREE.LinearFilter; t.minFilter=THREE.LinearMipmapLinearFilter;
  t.generateMipmaps=true; t.anisotropy=maxAniso(); t.needsUpdate=true; return (_DT=t); }

// o: scale (tiles per metre), bump (relief in metres), alb (albedo break-up 0..1), foot (height of the dirty base in m, 0 = none),
//    streak (rain-streak strength), dust (lighter dust on up-facing ledges), tiles (0..1: sloped faces become barrel-tile courses — roofs)
export function detailize(mat, o={}){ if(!mat || mat.userData.z145) return mat; mat.userData.z145=true;
  const f=(v)=>Number(v).toFixed(4), sc=f(o.scale??0.42), bump=f(MOBILE?(o.bump??0.035)*0.6:(o.bump??0.035)), alb=f(o.alb??0.32), foot=f(o.foot??1.4), streak=f(o.streak??0.22), dust=f(o.dust??0.12);
  const prev=mat.onBeforeCompile, prevKey=mat.customProgramCacheKey;
  mat.onBeforeCompile=(sh, r)=>{ if(prev) prev.call(mat, sh, r); sh.uniforms.dTex={ value:detailTex() };
    sh.vertexShader=sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDW; varying vec3 vDN; varying float vDY;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 dp=vec4(transformed,1.0); vec3 dn=objectNormal;
          #ifdef USE_INSTANCING
            dp=instanceMatrix*dp; dn=mat3(instanceMatrix)*dn;
          #endif
          vDY=dp.y; dp=modelMatrix*dp; vDW=dp.xyz; vDN=normalize(mat3(modelMatrix)*dn); }`);
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform sampler2D dTex; varying vec3 vDW; varying vec3 vDN; varying float vDY;
        float dSamp(vec3 p, vec3 n){ vec3 b=pow(abs(n),vec3(4.0)); b/=(b.x+b.y+b.z+1e-4);
          return texture2D(dTex,p.zy*${sc}).r*b.x + texture2D(dTex,p.xz*${sc}+0.37).r*b.y + texture2D(dTex,p.xy*${sc}+0.71).r*b.z; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 dNn=normalize(vDN); float dH=dSamp(vDW,dNn);
        float dM=texture2D(dTex,(vDW.xz+vDW.yy*0.35)*${sc}*0.09).g;
        float dS=texture2D(dTex,vec2((vDW.x+vDW.z)*${sc}*0.7, vDW.y*${sc}*0.045)).b;
        float dVert=1.0-smoothstep(0.35,0.8,abs(dNn.y));
        float dK=1.0+${alb}*((dH-0.5)*0.9+(dM-0.5)*0.8);
        dK*=1.0-${streak}*smoothstep(0.52,0.85,dS)*dVert;
        ${(o.foot??1.4)>0 ? `dK*=mix(0.58,1.0,smoothstep(0.0,${foot},vDY));` : ''}
        ${o.tiles ? `{ float slope=smoothstep(0.22,0.42,dNn.y)*(1.0-smoothstep(0.9,0.98,dNn.y));   // Z145 sloped faces are TILED: barrel tiles in courses
          vec3 tH=normalize(vec3(-dNn.z,0.0,dNn.x)+vec3(1e-5)); float u=dot(vDW,tH)/0.26, rowF=fract(vDW.y/0.3);
          float aa=1.0-smoothstep(0.25,0.7,max(fwidth(u),fwidth(vDW.y/0.3))); slope*=aa*${f(o.tiles)};
          float barrel=abs(fract(u)-0.5)*2.0, tileH=(1.0-barrel*barrel)*0.75+smoothstep(0.0,0.2,rowF)*0.25;
          dH=mix(dH, tileH*0.85+dH*0.15, slope);
          dK*=mix(1.0, (0.72+0.28*(1.0-barrel*barrel))*(0.8+0.2*smoothstep(0.0,0.25,rowF)), slope); }` : ''}
        diffuseColor.rgb*=clamp(dK,0.35,1.4);
        diffuseColor.rgb=mix(diffuseColor.rgb, vec3(0.62,0.58,0.5)*(0.8+0.4*dM), ${dust}*smoothstep(0.75,0.95,dNn.y)*dM);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor=clamp(roughnessFactor*(0.82+0.36*dH),0.04,1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec2 dHd=vec2(dFdx(dH),dFdy(dH))*${bump}; vec3 sX=dFdx(-vViewPosition), sY=dFdy(-vViewPosition), nn=normal;
          vec3 R1=cross(sY,nn), R2=cross(nn,sX); float det=dot(sX,R1)*faceDirection; vec3 gr=sign(det)*(dHd.x*R1+dHd.y*R2);
          normal=normalize(abs(det)*nn-gr); }`);
  };
  mat.customProgramCacheKey=()=>(prevKey?prevKey.call(mat):'')+'|z145'+sc+bump+alb+foot+streak+dust+(o.tiles||0);
  mat.needsUpdate=true; return mat; }

// colour canvas → map + normal + roughness. inv: mortar is LIGHTER than the blocks (village brick) so the height is flipped.
export function hiResMaps(c, o={}){ const W=c.width, H=c.height, src=c.getContext('2d').getImageData(0,0,W,H).data, n=W*H, h=new Float32Array(n);
  for(let i=0;i<n;i++){ const l=(src[i*4]*0.299+src[i*4+1]*0.587+src[i*4+2]*0.114)/255; h[i]=o.inv?1-l:l; }
  { const t=new Float32Array(n); for(let y=0;y<H;y++) for(let x=0;x<W;x++){ let s=0; for(let k=-1;k<=1;k++) s+=h[y*W+(x+k+W)%W]; t[y*W+x]=s/3; }   // soften: pixel noise must not become sparkly normals
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){ let s=0; for(let k=-1;k<=1;k++) s+=t[((y+k+H)%H)*W+x]; h[y*W+x]=s/3; } }
  const strength=o.nrm??2.6, N=document.createElement('canvas'), Rg=document.createElement('canvas'); N.width=Rg.width=W; N.height=Rg.height=H;
  const nx=N.getContext('2d'), rx=Rg.getContext('2d'), nd=nx.createImageData(W,H), rd=rx.createImageData(W,H);
  const at=(x,y)=>h[((y+H)%H)*W+((x+W)%W)], r0=o.rough??0.9;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const i=y*W+x, dx=(at(x-1,y)-at(x+1,y))*strength, dy=(at(x,y-1)-at(x,y+1))*strength, inv=1/Math.hypot(dx,dy,1);
    nd.data[i*4]=(dx*inv*0.5+0.5)*255; nd.data[i*4+1]=(dy*inv*0.5+0.5)*255; nd.data[i*4+2]=(inv*0.5+0.5)*255; nd.data[i*4+3]=255;
    const rv=Math.min(1, Math.max(0.05, r0*(1.12-0.3*h[i])))*255; rd.data[i*4]=rd.data[i*4+1]=rd.data[i*4+2]=rv; rd.data[i*4+3]=255; }   // sunken mortar is rough, proud faces a touch smoother
  nx.putImageData(nd,0,0); rx.putImageData(rd,0,0);
  const A=maxAniso(), mk=(cv, srgb)=>{ const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=A; if(srgb) t.colorSpace=THREE.SRGBColorSpace; return t; };
  return { map:mk(c,true), normalMap:mk(N,false), roughnessMap:mk(Rg,false) }; }
