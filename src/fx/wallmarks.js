// fx/wallmarks.js — Z204 A ROUND THAT HITS SOMETHING SOLID: every strike on a wall, rock, fortress, cover piece or structure — breakable or not —
//   detonates at the point of impact (a flash, a fireball for a shell, sparks / chips of the material, a puff of its dust, the ground lit for an
//   instant) and leaves its MARK on the surface: a bullet pock, or a shell's blackened, cracked crater with a soot fan. Marks build up where the
//   fighting is (one instanced draw call, oldest recycled) and vanish with the object when it is destroyed.
import * as THREE from 'three';
import { SHOTFX } from '../../config.js';
import { MOBILE, blastLight, blocks, burst, heightAt, scene, sfx, spawnPart } from '../hub.js';

const CAP=MOBILE?70:180, MK=[]; let _im=null, _next=0, _chk=0, _clk=0;
const _MU={ uNow:{ value:0 }, uHold:{ value:SHOTFX.marks.hold }, uFade:{ value:SHOTFX.marks.fade } };   // GUNFX 1 a mark stays uHold s, then fades out over uFade s (aBorn = when it was made)
function markTex(){ const c=document.createElement('canvas'); c.width=256; c.height=128; const x=c.getContext('2d');
  // left: a bullet pock (dark core, chipped rim) · right: a shell crater (charred core, radial cracks, soot fan)
  let g=x.createRadialGradient(64,64,0,64,64,60); g.addColorStop(0,'rgba(18,14,10,0.95)'); g.addColorStop(0.22,'rgba(30,24,18,0.9)'); g.addColorStop(0.4,'rgba(90,80,66,0.5)'); g.addColorStop(0.75,'rgba(60,50,40,0.18)'); g.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle=g; x.fillRect(0,0,128,128);
  for(let i=0;i<10;i++){ x.fillStyle='rgba(200,190,170,0.35)'; x.beginPath(); x.arc(64+(Math.random()-0.5)*40, 64+(Math.random()-0.5)*40, 1+Math.random()*3, 0, 7); x.fill(); }   // chips knocked off the face
  g=x.createRadialGradient(192,64,0,192,64,62); g.addColorStop(0,'rgba(8,6,4,1)'); g.addColorStop(0.3,'rgba(20,14,10,0.9)'); g.addColorStop(0.6,'rgba(30,24,18,0.5)'); g.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle=g; x.fillRect(128,0,128,128);
  x.strokeStyle='rgba(10,8,6,0.85)'; for(let i=0;i<9;i++){ let a=Math.random()*6.283, px=192, py=64; x.lineWidth=1+Math.random()*1.5; x.beginPath(); x.moveTo(px,py); for(let s=0;s<6;s++){ a+=(Math.random()-0.5)*0.6; const L=6+Math.random()*7; px+=Math.cos(a)*L; py+=Math.sin(a)*L; x.lineTo(px,py); } x.stroke(); }   // radial cracks
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
function im(){ if(_im) return _im; const geo=new THREE.PlaneGeometry(1,1), uv=geo.attributes.uv, off=new Float32Array(CAP);
  geo.setAttribute('aKind', new THREE.InstancedBufferAttribute(off,1).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('aBorn', new THREE.InstancedBufferAttribute(new Float32Array(CAP),1).setUsage(THREE.DynamicDrawUsage));
  const mat=new THREE.MeshStandardMaterial({ map:markTex(), transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4, roughness:1 });
  mat.onBeforeCompile=sh=>{ Object.assign(sh.uniforms, _MU); sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aKind; attribute float aBorn; uniform float uNow, uHold, uFade; varying float vMk;').replace('#include <uv_vertex>','#include <uv_vertex>\n  vMapUv = vec2(vMapUv.x*0.5 + aKind*0.5, vMapUv.y); vMk = clamp(1.0 - (uNow - aBorn - uHold) / uFade, 0.0, 1.0);');   // left or right half of the atlas · GUNFX 1 its age
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vMk;').replace('#include <map_fragment>','#include <map_fragment>\n  diffuseColor.a *= vMk;'); };
  _im=new THREE.InstancedMesh(geo, mat, CAP); _im.count=0; _im.frustumCulled=false; _im.renderOrder=3; scene.add(_im); return _im; }
const _M=new THREE.Matrix4(), _Q=new THREE.Quaternion(), _Qs=new THREE.Quaternion(), _V=new THREE.Vector3(), _S=new THREE.Vector3(), _N=new THREE.Vector3(), _Z=new THREE.Vector3(0,0,1), _H=new THREE.Matrix4().makeScale(0,0,0);
// a mark on the face that took the hit: at (x,y,z), facing back along the round's path (nx,nz)
export function wallMark(bl, x, y, z, nx, nz, size, shell){ const I=im(), k=_next; _next=(_next+1)%CAP; if(I.count<CAP) I.count=Math.max(I.count, k+1);
  _N.set(nx, 0, nz).normalize(); _Q.setFromUnitVectors(_Z, _N); _Q.premultiply(_Qs.setFromAxisAngle(_N, Math.random()*6.283));   // (GUNFX 1 no new Quaternion per strike)
  _M.compose(_V.set(x+nx*0.04, y, z+nz*0.04), _Q, _S.setScalar(size)); I.setMatrixAt(k, _M); I.geometry.attributes.aKind.setX(k, shell?1:0); I.geometry.attributes.aKind.needsUpdate=true; I.geometry.attributes.aBorn.setX(k, _clk); I.geometry.attributes.aBorn.needsUpdate=true; I.instanceMatrix.needsUpdate=true; MK[k]=bl; }
// the round goes off against the surface: flash · fireball (shells) · material chips + dust · ground lit · a mark left behind
export function surfaceHit(bl, b){ const sp=Math.hypot(b.vx,b.vz)||1, ux=b.vx/sp, uz=b.vz/sp, gy=heightAt(b.x,b.z), y=gy+Math.max(0.5, Math.min(4.5, b.by)), shell=!b.inf && (b.aoe>0 || b.dmg>=18), big=b.aoe>0 || b.dmg>=40;
  const hx=b.x-ux*0.3, hz=b.z-uz*0.3;
  spawnPart(hx, y, hz, -ux*2, 0.5, -uz*2, { tex:'flash', color:0xfff0c8, size:shell?(big?3.2:2.2):0.9, life:shell?0.07:0.04, grav:0, drag:6 });
  if(shell){ spawnPart(hx, y, hz, -ux*3, 1.2, -uz*3, { tex:'fire', color:0xfff0c0, color2:0xff4a10, size:big?2.4:1.5, life:0.22, grav:1.5, drag:3, grow:1.2 });
    burst({x:hx,z:hz}, 0xffd27a, big?10:6, big?10:7, { y, life:0.3, size:0.18, grav:-14, drag:1.2, up:2 });
    spawnPart(hx, y, hz, -ux*1.2, 1.0, -uz*1.2, { color:0x2a2420, size:big?2.6:1.7, life:1.4, smoke:true, grav:0.3, drag:1.4, grow:1.6, op:0.5 });
    blastLight(hx, hz, big?60:36, 0.28); if(big) sfx('explode', {x:hx,z:hz}, 0.55); }
  else if(Math.random()<0.5) spawnPart(hx, y, hz, -ux*4+(Math.random()-0.5)*4, 1+Math.random()*3, -uz*4+(Math.random()-0.5)*4, { color:0xffe6a0, size:0.1, life:0.18, grav:-14, drag:2 });
  wallMark(bl, hx, y, hz, -ux, -uz, shell ? (big?_r(1.6,2.2):_r(1.0,1.4)) : _r(0.25,0.4), shell); }
const _r=(a,b)=>a+Math.random()*(b-a);
// marks on something that has since been destroyed go with it
export function updateWallMarks(dt){ _clk+=dt; _MU.uNow.value=_clk; if(!_im || (_chk-=dt)>0) return; _chk=0.5; let ch=false;
  for(let k=0;k<_im.count;k++){ const bl=MK[k]; if(bl && !blocks.includes(bl)){ MK[k]=null; _im.setMatrixAt(k,_H); ch=true; } } if(ch) _im.instanceMatrix.needsUpdate=true; }
export function clearWallMarks(){ if(!_im) return; for(let k=0;k<_im.count;k++){ MK[k]=null; _im.setMatrixAt(k,_H); } _im.count=0; _next=0; _im.instanceMatrix.needsUpdate=true; }
