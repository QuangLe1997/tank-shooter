// render/lod.js — Z107 RENDER BUDGET: trims draw calls where the eye can't tell — soldier shadows only near the tank, tower / wall riflemen hidden out of range, HP bars only once hurt.
import { LOD } from '../../config.js';
import * as THREE from 'three';
import { FT, HZN, MOBILE, S, VIEW, camera, enemies, scene, towers } from '../hub.js';

let _at=0;
function castNear(g, near){ const u=g.userData; if(u._cs===near) return; u._cs=near; g.traverse(o=>{ if(o.isMesh) o.castShadow=near; }); }
export function updateLOD(now){ if(now<_at) return; _at=now+LOD.every; const p=S.player; if(!p) return; const px=p.pos.x, pz=p.pos.z, R2=LOD.shadowR*LOD.shadowR, G2=LOD.guardR*LOD.guardR;
  if(!MOBILE){
    for(const a of FT){ const dx=a.pos.x-px, dz=a.pos.z-pz; castNear(a.g, dx*dx+dz*dz<R2); }
    for(const e of enemies){ if(!e.def.inf) continue; const dx=e.pos.x-px, dz=e.pos.z-pz; castNear(e.mesh, dx*dx+dz*dz<R2); }
  }
  fogCull(); detailCull(now);
  for(const t of towers){ if(t.falling) continue; const dx=t.x-px, dz=t.z-pz, far=dx*dx+dz*dz > G2+(t.fort?t.fort.R*t.fort.R*2:0);
    for(const gd of t.guards){ if(!gd.alive) continue; if(gd.g.visible===far) gd.g.visible=!far; if(!gd._cs){ gd._cs=1; castNear(gd.g, false); } } }
}
// HP bars only when it matters (hurt, elite, commander) — two draws saved per healthy unit
export function barWanted(e){ return e.hp < e.maxHp-0.5 || e.elite || e.commander; }
// Z190 FOG CULL — the low cinematic camera looks across the whole arena, so ~3,700 draws a frame went on things already lost in the fog.
//   Anything whose nearest edge is past the distance where the fog is ~92% opaque is moved to a layer the camera does not draw (layers, not
//   .visible, so pooled / hidden objects keep their own state). Big pieces (ground, horizon, walls spanning the map) are never culled.
const _cv=new THREE.Vector3(), _cb=new THREE.Box3(), _cs=new THREE.Sphere(), CULL_LAYER=7;
function setLayer(o, l){ o.traverse(c=>c.layers.set(l)); }
export function fogDist(){ const f=scene.fog; if(!f) return Infinity; return f.isFogExp2 ? 1.6/Math.max(1e-4, f.density) : f.far*0.95; }
export function fogCull(){ const D=fogDist(), cx=camera.position.x, cz=camera.position.z;
  for(const o of scene.children){ if(o.isLight || o===HZN.g || o===S.player?.mesh) continue; const u=o.userData; if(u.cb) continue;   // (Z338 cover is culled by its batch)
    if(u._cr===undefined){ let dyn=false; o.traverse(c=>{ if(c.isPoints || c.isInstancedMesh || c.isLine || c.frustumCulled===false) dyn=true; }); if(dyn){ u._cr=-1; continue; }   // particle layers / instanced fields span the map
      _cb.setFromObject(o); if(_cb.isEmpty()){ u._cr=-1; continue; } _cb.getBoundingSphere(_cs); o.getWorldPosition(_cv); u._cr = _cs.radius>40 ? -1 : _cs.radius+_cs.center.distanceTo(_cv); }   // rigid extent round its origin
    if(u._cr<0) continue; o.getWorldPosition(_cv); const far = Math.hypot(_cv.x-cx, _cv.z-cz)-u._cr > D;
    if(far){ setLayer(o, CULL_LAYER); u._fc=1; } else if(u._fc){ setLayer(o, 0); u._fc=0; } } }
// Z240 DETAIL CULL — every small piece (< LOD.detailR m: crates, sandbags, fittings, lamps, rubble, men) is skipped once it would cover
//   less than LOD.detailPx pixels after the fog has eaten its contrast: projected size × (1 − fog). The test is per mesh (not per top-level
//   group like fogCull), so a fort far away keeps its walls and loses only its bolts. Layers, not .visible, so pools keep their own state.
//   Measured in a full battle (2.2 MP): ~1,000 pieces skipped, but most were off-screen already — draw calls −5…8 %; a bigger threshold
//   would pop visibly, so it stays conservative.
const DC={ list:[], at:0 };
function detailScan(){ DC.list.length=0; const pm=S.player?.mesh, R=LOD.detailR;
  for(const top of scene.children){ if(top.isLight || top===HZN.g || top===pm) continue;
    top.traverse(o=>{ if(!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry || o.frustumCulled===false || o.userData.keep) return;
      const m=o.layers.mask; if(m!==1 && m!==1<<CULL_LAYER) return;   // something parked on its own layer on purpose
      const g=o.geometry; if(!g.boundingSphere) g.computeBoundingSphere(); const e=o.matrixWorld.elements;
      const sc=Math.sqrt(Math.max(e[0]*e[0]+e[1]*e[1]+e[2]*e[2], e[4]*e[4]+e[5]*e[5]+e[6]*e[6], e[8]*e[8]+e[9]*e[9]+e[10]*e[10]));
      const r=g.boundingSphere.radius*(sc||1); if(r>R || r<=0) return; DC.list.push({ o, r, top }); }); } }
export function detailCull(now){ if(now>=DC.at){ DC.at=now+LOD.rescan; detailScan(); }
  const f=scene.fog, dens=f&&f.isFogExp2 ? f.density : 0, k=VIEW.h/(2*Math.tan(camera.fov*Math.PI/360)), cx=camera.position.x, cy=camera.position.y, cz=camera.position.z, P=LOD.detailPx, H=P*LOD.detailHys;
  let n=0;
  for(const q of DC.list){ const o=q.o; if(q.top.userData._fc) continue;   // the whole group is already fog-culled
    const e=o.matrixWorld.elements, dx=e[12]-cx, dy=e[13]-cy, dz=e[14]-cz, d=Math.sqrt(dx*dx+dy*dy+dz*dz)||1, fd=dens*d;
    const px=2*q.r*k/d*Math.exp(-fd*fd);   // on-screen diameter × what the fog leaves of it
    const m=o.layers.mask; if(m!==1 && m!==1<<CULL_LAYER) continue; const off=m!==1;
    if(!off && px<P){ o.layers.set(CULL_LAYER); n++; } else if(off && px>H){ o.layers.set(0); } else if(off) n++; }
  DC.culled=n; }
export function detailCulled(){ return DC.culled|0; }
