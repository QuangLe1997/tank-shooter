// world/rally.js — Z104 KHU TẬP KẾT (rally point): soldiers carry the loot they find back here; it waits (never expires) for the tank
import * as THREE from 'three';
import { RALLY } from '../../config.js';
import { _canvasTex, dropPowerup, floatText, heightAt, makeCoverMesh, makeFlag, pickups, scene, svgBadgeTex, tip, unwave, zonesOf } from '../hub.js';

export const RALLY_PT={ x:0, z:0, g:null, ring:null, badge:null };
export function rallyFlagTex(){ return _canvasTex(160,100,(x,W,H)=>{ x.fillStyle='#3f6a26'; x.fillRect(0,0,W,H); x.fillStyle='#9be04a'; x.fillRect(0,H*0.42,W,H*0.16); x.fillRect(W*0.42,0,W*0.16,H); }); }
export function buildRally(){ clearRally(); const q=zonesOf('rally')[0]; if(!q) return;
  const x=q.x, z=q.z, R=RALLY.r, gy=heightAt(x,z), g=new THREE.Group(); scene.add(g);
  const ring=new THREE.Mesh(new THREE.RingGeometry(R-0.4, R, 56), new THREE.MeshBasicMaterial({ color:0x9be04a, transparent:true, opacity:0.45, side:THREE.DoubleSide, depthWrite:false }));
  ring.rotation.x=-Math.PI/2; ring.position.set(x, gy+0.08, z); g.add(ring);
  const pad=new THREE.Mesh(new THREE.CircleGeometry(R-0.4, 40), new THREE.MeshBasicMaterial({ color:0x9be04a, transparent:true, opacity:0.07, depthWrite:false }));
  pad.rotation.x=-Math.PI/2; pad.position.set(x, gy+0.07, z); g.add(pad);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.07,5.6,6), new THREE.MeshStandardMaterial({ color:0x2a2a24, roughness:0.8 })); pole.position.set(x+R*0.7, gy+2.8, z-R*0.7); g.add(pole);
  const fl=makeFlag(rallyFlagTex(),1.6,1.0,1); fl.position.set(x+R*0.7, gy+5.0, z-R*0.7); g.add(fl);
  for(const [ox,oz,ry] of [[-R*0.75,R*0.35,0.3],[-R*0.62,R*0.62,1.2],[R*0.2,R*0.85,2.1]]){ const c=makeCoverMesh('crates', false); c.scale.setScalar(0.42); c.position.set(x+ox, heightAt(x+ox,z+oz), z+oz); c.rotation.y=ry; g.add(c); }
  const badge=new THREE.Sprite(new THREE.SpriteMaterial({ map:svgBadgeTex('team','#9be04a'), transparent:true, depthWrite:false })); badge.scale.set(2.2,2.2,1); badge.position.set(x, gy+5.6, z); g.add(badge);
  Object.assign(RALLY_PT, { x, z, g, ring, badge }); }
export function clearRally(){ if(RALLY_PT.g){ unwave(RALLY_PT.g); scene.remove(RALLY_PT.g); } RALLY_PT.g=null; }
export function rallySpot(){ const a=Math.random()*6.283, r=Math.random()*RALLY.r*0.55; return [RALLY_PT.x+Math.cos(a)*r, RALLY_PT.z+Math.sin(a)*r]; }
export function inRally(x, z, pad){ return !!RALLY_PT.g && Math.hypot(x-RALLY_PT.x, z-RALLY_PT.z) < RALLY.r+(pad||0); }
// a soldier drops what he carried home: it lands inside the ring and stays until the tank rolls in
export function stashLoot(item){ if(!RALLY_PT.g || !item) return; const [x,z]=rallySpot(); const u=dropPowerup({x,z}, item.tier, item.def);
  if(u){ u.stash=true; u.vx*=0.15; u.vz*=0.15; u.vy*=0.5; }
  floatText('ĐÃ GOM VỀ KHU TẬP KẾT', '#9be04a', {x, y:heightAt(x,z)+3, z}, 15); tip('rally'); }
export function updateRally(dt, now){ if(!RALLY_PT.g) return; let n=0; for(const u of pickups) if(u.stash) n++;
  RALLY_PT.ring.material.opacity = n ? 0.5+0.25*Math.sin(now*4) : 0.32; RALLY_PT.badge.position.y = heightAt(RALLY_PT.x,RALLY_PT.z)+5.6+Math.sin(now*2)*0.15;
  RALLY_PT.badge.material.opacity = n ? 1 : 0.6; }
