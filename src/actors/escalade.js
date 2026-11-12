// actors/escalade.js — Z145 ESCALADE: while the gate still holds, every third man of an assault carries a scaling ladder on his shoulder,
//   runs it to a stretch of wall away from the gate, leans it up, climbs, swings over the parapet and drops into the ward to go for the commander.
//   The ladder stays against the wall until that section falls or the fort is taken.
import * as THREE from 'three';
import { FORT } from '../../config.js';
import { FT, S, blocks, floatText, heightAt, radio, scene } from '../hub.js';

export const LADDERS = [];
const ESC = { every:3, climbT:2.4, overT:0.7, standOff:2.5, gateClear:9 };
let _wood=null; const wood=()=>_wood||(_wood=new THREE.MeshStandardMaterial({ color:0x7a5a36, roughness:0.85 }));
function ladderMesh(len){ const g=new THREE.Group(), m=wood();
  for(const x of [-0.28,0.28]){ const r=new THREE.Mesh(new THREE.BoxGeometry(0.07,len,0.07), m); r.position.set(x,len/2,0); r.castShadow=true; g.add(r); }
  for(let y=0.35;y<len-0.1;y+=0.42){ const s=new THREE.Mesh(new THREE.BoxGeometry(0.56,0.045,0.05), m); s.position.set(0,y,0); g.add(s); }
  return g; }
// is this man a ladder carrier for the current (unbreached) assault?
export function isClimber(a){ return (a.slot||0)%ESC.every===0 && !a.at && a.role!=='mortar'; }
function pieceOut(f, pc){ let nx=-pc.uz, nz=pc.ux; if(nx*pc.cx+nz*pc.cz<0){ nx=-nx; nz=-nz; } return [nx,nz]; }
// pick the nearest standing wall section clear of the gate; return the foot of the ladder (outside) as his goal
export function ladderGoal(a, f){ if(!f.pieces) return null;
  if(a.ladPc && (!blocks.includes(a.ladPc.block) || a.ladF!==f)) a.ladPc=null;
  if(!a.ladPc){ let best=null, bd=1e9; for(const pc of f.pieces){ if(!blocks.includes(pc.block)) continue; const wx=f.x+pc.cx, wz=f.z+pc.cz;
      if(Math.hypot(wx-f.gx, wz-f.gz)<ESC.gateClear) continue; if(LADDERS.some(L=>L.pc===pc)) continue;
      const d=Math.hypot(wx-a.pos.x, wz-a.pos.z); if(d<bd){ bd=d; best=pc; } }
    if(!best) return null; a.ladPc=best; a.ladF=f;
    if(!a.ladM){ a.ladM=ladderMesh(3.2); a.ladM.rotation.z=Math.PI/2; a.ladM.position.set(1.6,1.45,0.05); a.g.add(a.ladM); } }   // carried flat on the shoulder
  const pc=a.ladPc, [nx,nz]=pieceOut(f,pc); return [f.x+pc.cx+nx*ESC.standOff, f.z+pc.cz+nz*ESC.standOff]; }
export function dropLadder(a){ if(a.ladM){ a.g.remove(a.ladM); a.ladM=null; } a.ladPc=null; }
// at the foot of the wall → lean the ladder and start up
export function tryClimb(a){ const f=a.ladF, pc=a.ladPc; if(!f || !pc || a.climb) return false; const C=S.cmd;
  if(!C || C.kind!=='assault' || C.f!==f || f.breached || f.captured){ dropLadder(a); return false; }
  const [nx,nz]=pieceOut(f,pc), fx=f.x+pc.cx+nx*ESC.standOff, fz=f.z+pc.cz+nz*ESC.standOff; if(Math.hypot(a.pos.x-fx, a.pos.z-fz)>1.3) return false;
  if(a.ladM){ a.g.remove(a.ladM); a.ladM=null; }
  const H=FORT.wallH+0.9, gy=f.gy??heightAt(fx,fz), L=ladderMesh(H/Math.cos(0.36)+0.5), lx=f.x+pc.cx+nx*(FORT.wallT/2+0.75), lz=f.z+pc.cz+nz*(FORT.wallT/2+0.75);
  L.position.set(lx, gy, lz); L.rotation.order='YXZ'; L.rotation.y=Math.atan2(nx,nz); L.rotation.x=-0.36; scene.add(L); LADDERS.push({ m:L, pc, f });
  a.climb={ t:0, x0:a.pos.x, z0:a.pos.z, lx, lz, nx, nz, gy, H, ix:f.x+pc.cx-nx*ESC.standOff, iz:f.z+pc.cz-nz*ESC.standOff, f };
  a.facing=Math.atan2(-nx,-nz); if(!f._escMsg){ f._escMsg=true; radio('Lính ta bắc thang leo tường '+f.name+'!'); } return true; }
// per frame while on the ladder: up the rungs, over the parapet, down into the ward
export function updateClimb(a, dt){ const c=a.climb; c.t+=dt; const T=ESC.climbT, O=ESC.overT;
  if(c.t<T){ const u=c.t/T; a.pos.x=c.x0+(c.lx-c.x0)*Math.min(1,u*3)*0.6; a.pos.z=c.z0+(c.lz-c.z0)*Math.min(1,u*3)*0.6;
    a.g.position.set(a.pos.x - c.nx*u*0.5, c.gy+u*c.H, a.pos.z - c.nz*u*0.5); a.g.rotation.y=a.facing; const ud=a.g.userData; if(ud.arms) ud.arms.rotation.x=-1.3+Math.sin(c.t*9)*0.35; return; }   // hand over hand
  const v=Math.min(1,(c.t-T)/O); a.pos.x=c.lx+(c.ix-c.lx)*v; a.pos.z=c.lz+(c.iz-c.lz)*v;
  const gy=heightAt(a.pos.x,a.pos.z); a.g.position.set(a.pos.x, gy+(c.gy+c.H-gy)*(1-v*v)+Math.sin(v*Math.PI)*0.6, a.pos.z);
  if(v>=1){ if(a.g.userData.arms) a.g.userData.arms.rotation.x=0; a.climb=null; a.inside=c.f; a.ladPc=null; a.thinkAt=0; floatText('VÀO THÀNH!', '#9be04a', a.pos, 10); } }
export function updateLadders(){ for(let i=LADDERS.length-1;i>=0;i--){ const L=LADDERS[i]; if(L.f.captured || !blocks.includes(L.pc.block)){ scene.remove(L.m); LADDERS.splice(i,1); } } }
export function clearLadders(){ for(const L of LADDERS) scene.remove(L.m); LADDERS.length=0; for(const a of FT){ dropLadder(a); a.climb=null; a.inside=null; } }
