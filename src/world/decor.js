// world/decor.js — TERRAIN DECOR (ambient scatter: rocks · grass · ice · slag · rubble)
import * as THREE from 'three';
import { AREA_K, ARENA, BIOME, HULL_HL, HULL_HW, MOBILE, ROCK_TINT, S, _R, _mergeColored, _xf, arena, boss, burst, crushables, decalDirt, enemies, haptic, heightAt, inField, rockSet, sfx, spawnPart } from '../hub.js';

// ----------------------------- TERRAIN DECOR (ambient scatter: rocks · grass · ice · slag · rubble) -----------------------------
// Purely decorative props (no collision) scattered around the arena to make each battlefield feel real & varied.
// Rebuilt whenever the biome changes; kept clear of the Core + the player's spawn so they never block play.
// ----------------------------- TERRAIN DECOR: instanced ground clutter (1 draw call per rock shape) that tanks CRUSH under their tracks -----------------------------
export const decorGroup = new THREE.Group(); arena.add(decorGroup);
export const _IM=new THREE.Matrix4(), _IQ=new THREE.Quaternion(), _IV=new THREE.Vector3(), _IS=new THREE.Vector3(), _IE=new THREE.Euler();
export const _tuftCache={};
export function tuftGeo(bn){                                                       // merged grass / dry-shrub / dead-grass tuft (vertex coloured)
  if(_tuftCache[bn]) return _tuftCache[bn];
  const cols = bn==='MEADOW' ? [0x7caa44,0x5f8a32,0x9fc25a] : bn==='TUNDRA' ? [0x8a7a5a,0x6a5e48,0xb0a080] : [0x9a8458,0x7a6a44,0xb8a070];
  const P=[]; const n=bn==='MEADOW'?9:7;
  for(let i=0;i<n;i++){ const h=_R(0.5,1.1), c=new THREE.ConeGeometry(_R(0.05,0.09),h,3,1); c.translate(0,h/2,0);
    _xf(c,_R(-0.35,0.35),0,_R(-0.35,0.35),_R(-0.45,0.45),_R(0,6),_R(-0.45,0.45)); P.push({geo:c,col:cols[(Math.random()*cols.length)|0]}); }
  const g=_mergeColored(P); _tuftCache[bn]=g; return g;
}
export let _tuftMat=null;
export function clearDecor(){ for(let i=decorGroup.children.length-1;i>=0;i--){ const c=decorGroup.children[i]; decorGroup.remove(c); if(c.isInstancedMesh) c.dispose(); } crushables.length=0; }
export function _decorSpot(minCore, tries){ for(let t=0;t<(tries||12);t++){ const x=(Math.random()*2-1)*(ARENA-3), z=(Math.random()*2-1)*(ARENA-3);
    if(Math.hypot(x,z)>minCore && Math.hypot(x, z-ARENA*0.55)>8 && inField(x,z,1.5)) return [x,z]; } return null; }
export function buildTerrainDecor(b){
  clearDecor();
  const set=rockSet(b.name), N=Math.round((MOBILE?60:120)*AREA_K), per=set.small.map(()=>[]);
  for(let i=0;i<N;i++){ const sp=_decorSpot(12); if(!sp) continue; const r = Math.random()<0.75 ? _R(0.18,0.42) : _R(0.42,0.7);   // pebbles + fist-to-knee sized stones
    per[(Math.random()*per.length)|0].push({x:sp[0], z:sp[1], r, ry:_R(0,6.28), tilt:_R(-0.25,0.25)}); }
  per.forEach((list,gi)=>{ if(!list.length) return; const im=new THREE.InstancedMesh(set.small[gi], set.mat, list.length); im.castShadow=true; im.receiveShadow=true;
    list.forEach((o,k)=>{ _IE.set(o.tilt,o.ry,o.tilt*0.5); _IM.compose(_IV.set(o.x,heightAt(o.x,o.z)+o.r*0.18,o.z), _IQ.setFromEuler(_IE), _IS.set(o.r,o.r,o.r)); im.setMatrixAt(k,_IM);
      crushables.push({ x:o.x, z:o.z, r:o.r, im, k, alive:true, kind:'rock', ry:o.ry }); });
    decorGroup.add(im); });
  if(b.name==='MEADOW'||b.name==='DESERT'||b.name==='TUNDRA'||b.name==='CITADEL'){                // grass tufts / dry shrubs (flatten under tracks)
    const M=Math.round((b.name==='MEADOW'?(MOBILE?90:200):(MOBILE?30:60))*Math.min(AREA_K, MOBILE?1.5:2)), list=[]; for(let i=0;i<M;i++){ const sp=_decorSpot(9); if(sp) list.push({x:sp[0],z:sp[1],s:_R(0.7,1.4),ry:_R(0,6.28)}); }
    if(!_tuftMat) _tuftMat=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.95, side:THREE.DoubleSide });
    const im=new THREE.InstancedMesh(tuftGeo(b.name), _tuftMat, Math.max(1,list.length)); im.castShadow=!MOBILE; im.receiveShadow=true;
    list.forEach((o,k)=>{ _IM.compose(_IV.set(o.x,heightAt(o.x,o.z),o.z), _IQ.setFromEuler(_IE.set(0,o.ry,0)), _IS.set(o.s,o.s,o.s)); im.setMatrixAt(k,_IM); crushables.push({ x:o.x, z:o.z, r:0.45*o.s, im, k, alive:true, kind:'grass', ry:o.ry, s:o.s }); });
    im.count=list.length; decorGroup.add(im); }
}
// tracks grind clutter: stones burst into chips + dust (gone), grass/shrubs get flattened into the dirt
export function crushAt(c){
  c.alive=false;
  if(c.kind==='grass'){ _IM.compose(_IV.set(c.x,heightAt(c.x,c.z),c.z), _IQ.setFromEuler(_IE.set(0,c.ry,0)), _IS.set(c.s*1.2,c.s*0.12,c.s*1.2)); c.im.setMatrixAt(c.k,_IM); c.im.instanceMatrix.needsUpdate=true; return; }
  _IM.makeScale(0,0,0); c.im.setMatrixAt(c.k,_IM); c.im.instanceMatrix.needsUpdate=true;
  const t=ROCK_TINT[BIOME.name]||ROCK_TINT.DESERT, n=Math.round(3+c.r*9);
  for(let i=0;i<n;i++){ const a=Math.random()*6.283, sp=_R(2,5)*(0.6+c.r);
    spawnPart(c.x, 0.25, c.z, Math.cos(a)*sp, _R(2,5), Math.sin(a)*sp, { color: Math.random()<0.5?t[1]:t[0], size:_R(0.12,0.26)*(0.6+c.r), life:_R(0.35,0.6), grav:-22, drag:1.2 }); }   // rock chips
  burst({x:c.x,z:c.z}, BIOME.ground, 2, 1.4, { y:0.3, life:0.8, size:0.9+c.r, smoke:true, grav:-0.3, drag:2, up:0.8, op:0.4 });   // grit dust
  decalDirt(c.x, c.z, 0.35+c.r*0.6);
  if(c.r>0.35){ const p=S.player; if(p && (p.pos.x-c.x)**2+(p.pos.z-c.z)**2 < 25){ sfx('crunch'); haptic(8); } }
}
export function updateCrush(){
  if(!crushables.length) return;
  const tanks=[]; const p=S.player; if(p&&p.mesh) tanks.push(p); for(const e of enemies) tanks.push(e); if(boss&&boss.alive) tanks.push(boss);
  for(const t of tanks){ const s=t.mesh?t.mesh.scale.x:1, hw=HULL_HW*s, hl=HULL_HL*s, R2=(hl+0.8)*(hl+0.8), fs=Math.sin(t.facing||0), fc=Math.cos(t.facing||0);
    for(const c of crushables){ if(!c.alive) continue; const dx=c.x-t.pos.x, dz=c.z-t.pos.z; if(dx*dx+dz*dz > R2) continue;
      const lx=dx*fc-dz*fs, lz=dx*fs+dz*fc; if(Math.abs(lx) < hw+c.r*0.3 && Math.abs(lz) < hl+c.r*0.3) crushAt(c); } }   // anything under the hull footprint
}
