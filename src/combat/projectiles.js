// combat/projectiles.js — PROJECTILES
import * as THREE from 'three';
import { GLOW, MOBILE, PART_MAX, scene } from '../hub.js';

// ----------------------------- PROJECTILES -----------------------------
export const bullets=[]; export const bulletPool=[];
export const bulletGeo = new THREE.SphereGeometry(0.24, 10, 8);
for(let i=0;i<300;i++){
  const g = new THREE.Group();
  const core = new THREE.Mesh(bulletGeo, new THREE.MeshBasicMaterial({color:0xfff4d0}));   // hot, full-bright core
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW, color:0xffe08a, transparent:true, opacity:0.85, blending:THREE.AdditiveBlending, depthWrite:false}));
  halo.scale.setScalar(1.7);   // glowing aura around every round (kept modest so rapid guns don't bloom-wash)
  g.add(core, halo); g.userData={core, halo};
  g.visible=false; scene.add(g); bulletPool.push(g);
}
export const BVIS = MOBILE ? 1.6 : 1.15;     // bullets render bigger on small screens
export const _hot=(hex)=>{ const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255, m=v=>Math.min(255,Math.round(v+(255-v)*0.55)); return (m(r)<<16)|(m(g)<<8)|m(b); };  // blend toward white for the bright core
// glowing additive tracer trails so every shot's path is bright & easy to read
export const trails=[];   // glowing additive tracer dots — drawn by the instanced glow layer (flushParticles)
export function addTrail(x,y,z,color,size,life){ if(trails.length>=PART_MAX*0.5) return; const L=life||0.2; trails.push({x,y,z,c:new THREE.Color(color),size,life:L,max:L}); }
export function updateTrails(dt){ for(let i=trails.length-1;i>=0;i--){ const t=trails[i]; t.life-=dt; if(t.life<=0){ trails[i]=trails[trails.length-1]; trails.pop(); } } }
