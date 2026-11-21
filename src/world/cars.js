// world/cars.js — Z206 STREET VEHICLES: which body each parked car takes (sedan · hatchback · SUV · pickup · minivan · taxi · small box truck),
//   its paint, a share of burnt-out wrecks; drawn only as their real models (world/real-city.js carModel) — Z401 the hand-built bodies and scooter
//   (Z206, unseen since Z333) are gone. Each car is crushable and burnable; tanks flatten them (decor.js crushAt kind 'car').
import * as THREE from 'three';
import { REALCITY } from '../../config.js';
import { LAND, MOBILE, arena, carModel, crushables, heightAt } from '../hub.js';

// the bodies: w = how often one is parked, cr = its crush radius m; the taxi and the box truck keep their livery
const MODELS=[
  { name:'sedan', w:5, cr:1.6 },
  { name:'hatch', w:4, cr:1.45 },
  { name:'suv', w:3, cr:1.75 },
  { name:'pickup', w:3, cr:1.85 },
  { name:'van', w:3, cr:1.9 },
  { name:'taxi', w:2, cr:1.6, taxi:true },
  { name:'truck', w:2, cr:2.1, truck:true },
];

export const CAR_PAINT=[0xc8c8c8,0xf0f0ee,0x1e1e20,0x7a1416,0x1a3470,0x5e6266,0xd8c8a0,0x2e4a34,0x9a9ea2,0xb84a1a,0x3a6a8a,0xe8e4d8];
const WRECK=[0x2a2420,0x3e2a1e,0x5a3a26,0x1e1c1a];
// pick a body for each parked car; a share are burnt-out wrecks (charred, lower, skewed, glassless)
export function pickCar(o, wrecks){ const B=MODELS, tot=B.reduce((a,m)=>a+m.w,0); let r=Math.random()*tot, i=0; for(;i<B.length-1;i++){ r-=B[i].w; if(r<0) break; }
  o.m=i; const m=B[i]; o.wreck=Math.random()<(wrecks??0.08);
  o.col= o.wreck ? WRECK[(Math.random()*WRECK.length)|0] : m.taxi ? [0xf0f0ea,0x2a8a4a,0xf2c018][(Math.random()*3)|0] : m.truck ? [0x2a4a8a,0xe8e4d8,0x8a1a1a][(Math.random()*3)|0] : CAR_PAINT[(Math.random()*CAR_PAINT.length)|0];
  if(o.wreck){ o.ry+= (Math.random()-0.5)*0.9; o.tilt=(Math.random()-0.5)*0.12; o.sink=0.1; } return o; }
const _M=new THREE.Matrix4(), _Q=new THREE.Quaternion(), _E=new THREE.Euler(), _V=new THREE.Vector3(), _S=new THREE.Vector3(1,1,1), _C=new THREE.Color(), _W=new THREE.Color(0x6a6060);
// Z264 a body drawn as its Meshy model: one instanced mesh (the model brings its own glass, trim, tyres), its paint tinted toward the car's colour
//   (taxis and the bus keep their livery), a wreck charred; crushable and burnable like the rest
const _RG={};
function drawReal(R, list, cr, kind, livery){ if(!list.length) return; const k=R.key, L=(REALCITY.cars[k]||{}).L||4.6;
  if(!_RG[k]){ const g=R.geo.clone(), sc=L/Math.max(R.size.x, R.size.z); g.scale(sc,sc,sc); g.computeBoundingSphere(); _RG[k]=g; }
  const im=new THREE.InstancedMesh(_RG[k], R.mat, list.length), shadow=!MOBILE, wc=new THREE.Color(0x3a3430);
  list.forEach((o,i)=>{ _M.compose(_V.set(o.x, heightAt(o.x,o.z)+REALCITY.lift.road-(o.sink||0), o.z), _Q.setFromEuler(_E.set(o.tilt||0, o.ry, (o.tilt||0)*0.6)), _S.set(1,1,1)); im.setMatrixAt(i,_M);
    im.setColorAt(i, o.wreck ? wc : livery ? _C.setHex(0xffffff) : _C.setHex(0xffffff).lerp(_W.setHex(o.col), REALCITY.carTint)); _W.setHex(0x6a6060);
    crushables.push({ x:o.x, z:o.z, r:cr, im, ims:[], k:i, alive:true, kind, ry:o.ry, s:1, land:true }); });
  im.instanceMatrix.needsUpdate=true; im.instanceColor.needsUpdate=true; im.castShadow=shadow; im.receiveShadow=true; im.computeBoundingSphere(); arena.add(im); LAND.meshes.push(im);
  const sz=_RG[k].boundingSphere ? new THREE.Box3().setFromBufferAttribute(_RG[k].attributes.position).getSize(new THREE.Vector3()) : null; if(sz) contactShadow(sz.x*1.12, sz.z*1.06, list.length, im.instanceMatrix); }
// Z271 CONTACT SHADOWS: a soft dark patch under each vehicle (an instanced quad on the vehicle's own instance matrices, so it follows it
//   moving, crushed or burnt) — it seats the vehicle on the road where the shadow map is too coarse to; w × l in the instance's own units
let _csTex=null;
function csTex(){ if(_csTex) return _csTex; const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'), g=x.createRadialGradient(32,32,4,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.55,'rgba(255,255,255,0.75)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,64,64); return (_csTex=new THREE.CanvasTexture(c)); }
let _csMat=null;
export function contactShadow(w, l, n, matrix, y){ if(typeof document==='undefined') return null; const g=new THREE.PlaneGeometry(w, l); g.rotateX(-Math.PI/2); g.translate(0, y??0.012, 0);
  const m=_csMat||(_csMat=new THREE.MeshBasicMaterial({ color:0x000000, alphaMap:csTex(), transparent:true, opacity:REALCITY.contact.op, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 }));
  const im=new THREE.InstancedMesh(g, m, n); im.instanceMatrix=matrix; im.frustumCulled=false; im.renderOrder=1; arena.add(im); LAND.meshes.push(im); return im; }
// cars: objects from pickCar — Z333 only as their real models (a kind with none is left out: no hand-built stand-in car or scooter is drawn any more)
export function drawStreetVehicles(cars){
  MODELS.forEach((m,i)=>{ const list=cars.filter(o=>o.m===i), R=carModel(m.name); if(R) drawReal(R, list, m.cr, 'car', m.taxi||m.truck); }); }
// a crushed car / scooter: pancaked, skewed; both draws follow
const _CM=new THREE.Matrix4();
export function crushVehicle(c){ const sq=c.kind==='car'?0.42:0.2; _CM.compose(_V.set(c.x, heightAt(c.x,c.z)-0.05, c.z), _Q.setFromEuler(_E.set((Math.random()-0.5)*0.15, c.ry+(Math.random()-0.5)*0.4, (Math.random()-0.5)*0.15)), _S.set(1.08, sq, 1.04));
  c.im.setMatrixAt(c.k,_CM); c.im.instanceMatrix.needsUpdate=true; for(const im of c.ims||[]){ im.setMatrixAt(c.k,_CM); im.instanceMatrix.needsUpdate=true; } }
