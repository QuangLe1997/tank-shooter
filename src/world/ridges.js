// world/ridges.js — Z106 INNER RIDGES: rock spines across the field that split it into sectors with passes between them —
//   chokepoints for armour, cover lines for infantry. Solid (tanks, shells and men stop at them); one instanced mesh per stage.
import * as THREE from 'three';
import { FIELD, HARD } from '../../config.js';
import { ARENA, BIOME, MOBILE, _R, blocks, heightAt, inField, inZone, rockSet, scene } from '../hub.js';

export const RIDGES=[];   // [{ pts:[[x,z]…] }] for the radar / deploy map
let _ridgeMesh=null;
export function buildRidges(){ if(_ridgeMesh){ scene.remove(_ridgeMesh); _ridgeMesh=null; } RIDGES.length=0;
  const rs=rockSet(BIOME.name), cnt=MOBILE?FIELD.innerRidgesMobile:FIELD.innerRidges, n=Math.round(_R(cnt[0], cnt[1]+0.99)-0.49), rocks=[];
  const okAt=(x,z)=>inField(x,z,9) && Math.hypot(x,z)>26 && Math.hypot(x, z-ARENA*0.55)>22 && !inZone(x,z,6) && !blocks.some(b=>(b.x-x)**2+(b.z-z)**2 < (b.r+2.2)**2);
  for(let r=0, tries=0; r<n && tries<40; tries++){
    const L=_R(FIELD.ridgeLen[0], FIELD.ridgeLen[1]), x0=_R(-ARENA*0.75, ARENA*0.75), z0=_R(-ARENA*0.75, ARENA*0.6); if(!okAt(x0,z0)) continue;
    let a=Math.random()*Math.PI, x=x0, z=z0; const bend=_R(-0.02,0.02), gap=L>32 ? [L*_R(0.35,0.55), L*_R(0.35,0.55)+_R(7,10)] : null, pts=[];   // long ridges get a PASS through the middle
    for(let s=0; s<=L; s+=2.3){ a+=bend; x+=Math.cos(a)*2.3; z+=Math.sin(a)*2.3; if(gap && s>gap[0] && s<gap[1]) continue; if(!okAt(x,z)) continue;
      const rr=_R(FIELD.ridgeRock[0], FIELD.ridgeRock[1]); rocks.push([x,z,rr]); pts.push([x,z]);
      const hp=Math.round(HARD.boulder*HARD.ridgeK*(rr/1.6));   // Z121 ridge rocks can be shot apart too → blast your own pass through the spine
      blocks.push({ mesh:null, x, z, r:rr*0.92, hp, maxHp:hp, steel:false, hard:true, loot:false, kind:'boulder', climb:false, ridge:true, inst:rocks.length-1 }); }
    if(pts.length>3){ RIDGES.push({ pts }); r++; } }
  if(!rocks.length) return;
  const im=new THREE.InstancedMesh(rs.big[0], rs.mat, rocks.length*2), M=new THREE.Matrix4(), Q=new THREE.Quaternion(), V=new THREE.Vector3(), Sc=new THREE.Vector3(), E=new THREE.Euler(); let k=0;
  for(const [x,z,r] of rocks){ for(let s=0;s<2;s++){ const ox=s?_R(-0.8,0.8):0, oz=s?_R(-0.8,0.8):0, rr=s?r*0.6:r*1.05;          // a big rock + a smaller one leaning on it
      E.set(_R(-0.25,0.25),_R(0,6.28),_R(-0.25,0.25)); Q.setFromEuler(E); V.set(x+ox, heightAt(x+ox,z+oz)+rr*0.18, z+oz); Sc.set(rr, rr*_R(0.75,1.15), rr); M.compose(V,Q,Sc); im.setMatrixAt(k++, M); } }
  im.count=k; im.castShadow=!MOBILE; im.receiveShadow=true; scene.add(im); _ridgeMesh=im;
  for(const b of blocks) if(b.ridge && !b.mesh) b.mesh=im; }

// Z121 a ridge rock shot apart: its two instances (big rock + the small one leaning on it) collapse to nothing
const _z=new THREE.Matrix4().makeScale(0,0,0);
export function ridgeRockDown(b){ const im=_ridgeMesh; if(!im || b.inst==null) return; im.setMatrixAt(b.inst*2, _z); im.setMatrixAt(b.inst*2+1, _z); im.instanceMatrix.needsUpdate=true; }
