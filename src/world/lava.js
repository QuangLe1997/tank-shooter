// world/lava.js — Z187 LAVA in the volcanic caldera: glowing pools that light the ground, spit embers, and burn any tank that drives in (yours or theirs)
import * as THREE from 'three';
import { ARENA, BIOME, FORTS, MOBILE, S, blocks, damageEnemy, damagePlayer, enemies, floatText, heightAt, inField, inZone, scene, spawnPart } from '../hub.js';

export const LAVA = { pools:[], g:null, mat:null, crust:null, at:0, warnAt:0, dps:{ player:14, enemy:22 } };
export function clearLava(){ if(LAVA.g){ scene.remove(LAVA.g); LAVA.g.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); LAVA.g=null; } LAVA.pools.length=0; }
// an irregular blob (a circle whose rim wobbles) laid flat on the ground
function blobGeo(r, wob){ const n=36, g=new THREE.CircleGeometry(r, n), p=g.attributes.position, k=[Math.random()*6, Math.random()*6, Math.random()*6];
  for(let i=1;i<p.count;i++){ const x=p.getX(i), y=p.getY(i), a=Math.atan2(y,x), f=1+wob*(Math.sin(a*3+k[0])*0.5+Math.sin(a*5+k[1])*0.3+Math.sin(a*7+k[2])*0.2); p.setXY(i, x*f, y*f); }
  g.rotateX(-Math.PI/2); return g; }
export function buildLava(){ clearLava(); if(BIOME.name!=='VOLCANO') return;
  if(!LAVA.mat){ LAVA.mat=new THREE.MeshStandardMaterial({ color:0xff4a10, emissive:0xff5a14, emissiveIntensity:2.2, roughness:0.5, metalness:0 });
    LAVA.crust=new THREE.MeshStandardMaterial({ color:0x120c0a, emissive:0x501404, emissiveIntensity:0.6, roughness:0.95 }); }
  const g=new THREE.Group(); LAVA.g=g; scene.add(g); const want=MOBILE?5:8, spawnZ=ARENA*0.55;
  for(let t=0; t<200 && LAVA.pools.length<want; t++){ const x=(Math.random()*2-1)*(ARENA-14), z=(Math.random()*2-1)*(ARENA-14), r=4+Math.random()*5;
    if(!inField(x, z, r+4) || Math.hypot(x, z-spawnZ) < r+26 || Math.hypot(x, z) < r+16 || inZone(x, z, r+3)) continue;   // never on the spawn, the Core or a camp
    if(FORTS.some(f=>Math.hypot(f.x-x, f.z-z) < f.R+r+6) || blocks.some(b=>Math.hypot(b.x-x, b.z-z) < (b.r||1)+r+1) || LAVA.pools.some(q=>Math.hypot(q.x-x, q.z-z) < q.r+r+6)) continue;
    const y=heightAt(x, z)+0.08, crust=new THREE.Mesh(blobGeo(r+1.6, 0.18), LAVA.crust), lava=new THREE.Mesh(blobGeo(r, 0.22), LAVA.mat);
    crust.position.set(x, y-0.02, z); lava.position.set(x, y+0.04, z); crust.receiveShadow=true; g.add(crust, lava); LAVA.pools.push({ x, z, r, y }); }
  if(!MOBILE && LAVA.pools.length){ for(const q of LAVA.pools.slice(0,2)){ const L=new THREE.PointLight(0xff6a20, 40, q.r*5, 2); L.position.set(q.x, q.y+3, q.z); g.add(L); } } }   // two pools light their surroundings
export function inLava(x, z, pad){ for(const q of LAVA.pools) if((x-q.x)**2+(z-q.z)**2 < (q.r+(pad||0))**2) return q; return null; }
export function updateLava(dt, now){ if(!LAVA.pools.length) return;
  if(LAVA.mat) LAVA.mat.emissiveIntensity = 2.0 + Math.sin(now*2.3)*0.35 + Math.sin(now*7.1)*0.15;   // the surface breathes
  if(now>LAVA.at){ LAVA.at=now+(MOBILE?0.22:0.09); const q=LAVA.pools[(Math.random()*LAVA.pools.length)|0], a=Math.random()*6.283, d=Math.random()*q.r*0.8;   // embers and bubbles
    spawnPart(q.x+Math.cos(a)*d, q.y+0.3, q.z+Math.sin(a)*d, (Math.random()-0.5)*1.5, 2+Math.random()*3, (Math.random()-0.5)*1.5, { color:Math.random()<0.5?0xff7a1a:0xffc24a, size:0.35+Math.random()*0.4, life:0.9, grav:3, drag:0.6 });
    if(Math.random()<0.25) spawnPart(q.x+Math.cos(a)*d, q.y+0.5, q.z+Math.sin(a)*d, 0.3, 1.2, 0, { color:0x3a2a24, size:2.5, life:2.2, smoke:true, grav:-0.4, drag:0.6, grow:1.8, op:0.35 }); }
  const p=S.player; if(p && inLava(p.pos.x, p.pos.z, -0.5)){ damagePlayer(LAVA.dps.player*dt, now); if(Math.random()<0.4) spawnPart(p.pos.x, 0.8, p.pos.z, (Math.random()-0.5)*3, 2.5, (Math.random()-0.5)*3, { color:0xff6a1a, size:0.8, life:0.4, grav:1, drag:1 });
    if(now>LAVA.warnAt){ LAVA.warnAt=now+3; floatText('DUNG NHAM! RA KHỎI ĐÂY', '#ff7a2a', p.pos, 16); } }
  for(const e of enemies){ if(e.def.air || e.def.inf) continue; if(inLava(e.pos.x, e.pos.z, -0.5)) damageEnemy(e, LAVA.dps.enemy*dt); } }
