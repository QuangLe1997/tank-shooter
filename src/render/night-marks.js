// render/night-marks.js — Z137 NIGHT VISIBILITY: at night every tank wears lamps so it can be read in the dark — enemy hulls: white headlamps + red tail lamps +
//   a red roof beacon; allied hulls: lime roof beacon. Pooled additive sprites (shared materials, no real lights → no per-pixel cost), moved onto the nearest tanks each frame.
import * as THREE from 'three';
import { ALLY_TANKS, GLOW, NIGHT, S, enemies, scene, solidTank } from '../hub.js';

const mk=(c,op)=>new THREE.SpriteMaterial({ map:GLOW, color:c, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, fog:false });
const M={ head:mk(0xfff0c0), tail:mk(0xff2a1a), foe:mk(0xff3a22), ally:mk(0x9be04a) }, OP={ head:0.9, tail:0.75, foe:0.95, ally:0.95 };
const POOL=[]; const NMAX=48;
for(let i=0;i<NMAX;i++){ const s=new THREE.Sprite(M.head); s.visible=false; s.renderOrder=7; scene.add(s); POOL.push(s); }
let _n=0;
function lamp(kind, x, y, z, size){ if(_n>=NMAX) return; const s=POOL[_n++]; s.material=M[kind]; s.position.set(x,y,z); s.scale.setScalar(size); s.visible=true; }
export function updateNightMarks(dt, now){
  const k=NIGHT.k; for(const key in M) M[key].opacity = k*OP[key]*(0.92+0.08*Math.sin(now*5));
  _n=0; if(k<0.04 || S.mode==='start'){ for(const s of POOL) s.visible=false; return; }
  const p=S.player, R2=95*95;
  const hull=(e, kind, sc)=>{ const f=e.facing, sx=Math.sin(f), sz=Math.cos(f), rx=Math.cos(f), rz=-Math.sin(f), s=sc||1, x=e.pos.x, z=e.pos.z;
    if(kind==='foe'){ lamp('head', x+sx*2.1*s+rx*0.6*s, 0.9*s, z+sz*2.1*s+rz*0.6*s, 1.0); lamp('head', x+sx*2.1*s-rx*0.6*s, 0.9*s, z+sz*2.1*s-rz*0.6*s, 1.0);
      lamp('tail', x-sx*2.1*s+rx*0.7*s, 0.9*s, z-sz*2.1*s+rz*0.7*s, 0.65); lamp('tail', x-sx*2.1*s-rx*0.7*s, 0.9*s, z-sz*2.1*s-rz*0.7*s, 0.65); }
    lamp(kind==='foe'?'foe':'ally', x, 3.1*s, z, kind==='foe'?1.5:1.3); };
  for(const e of enemies){ if(!solidTank(e) || e.abandoned || !e.mesh || !e.mesh.visible) continue; if(p && (e.pos.x-p.pos.x)**2+(e.pos.z-p.pos.z)**2>R2) continue; hull(e,'foe', (e.mesh.scale.x||1)*0.85); }
  for(const t of ALLY_TANKS){ if(t.dead) continue; hull(t,'ally',(t.mesh.scale.x||1)*0.85); }
  for(let i=_n;i<NMAX;i++) POOL[i].visible=false;
}
