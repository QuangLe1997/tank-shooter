// fx/particles.js — PARTICLES (juice)
import * as THREE from 'three';
import { MOBILE, PL_FIRE, PL_FLASH, heightAt, scene, trails } from '../hub.js';

// ----------------------------- PARTICLES (juice) -----------------------------
export function glowTex(){
  const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d');
  const g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(.3,'rgba(255,255,255,.6)'); g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g; x.fillRect(0,0,64,64); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
export const GLOW = glowTex();
export function smokeTex(){   // soft, billowy cloud puff (overlapping soft blobs) — reads as real smoke, not a hard dot
  const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d');
  for(let i=0;i<6;i++){ const cx=18+Math.random()*28, cy=18+Math.random()*28, r=12+Math.random()*16;
    const g=x.createRadialGradient(cx,cy,0,cx,cy,r); g.addColorStop(0,'rgba(255,255,255,0.42)'); g.addColorStop(0.6,'rgba(255,255,255,0.16)'); g.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=g; x.beginPath(); x.arc(cx,cy,r,0,7); x.fill(); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
export const SMOKE = smokeTex();
// ---- GPU-INSTANCED particles: every glow/fire/spark in ONE draw call + every smoke/dust puff in ONE more (was one Sprite draw call EACH) ----
export const PART_MAX = MOBILE ? 900 : 1800;
export const PERF = { parts:1, fc:0, slowT:0, fastT:0 };   // Z92 runtime load governor (particles thin out, HUD/cloth update less often when frames run long)
export function makePartLayer(map, additive, order){
  const base=new THREE.PlaneGeometry(1,1), g=new THREE.InstancedBufferGeometry();
  g.index=base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  const iPos=new THREE.InstancedBufferAttribute(new Float32Array(PART_MAX*3),3).setUsage(THREE.DynamicDrawUsage);
  const iCol=new THREE.InstancedBufferAttribute(new Float32Array(PART_MAX*4),4).setUsage(THREE.DynamicDrawUsage);   // rgb + alpha
  const iSR =new THREE.InstancedBufferAttribute(new Float32Array(PART_MAX*2),2).setUsage(THREE.DynamicDrawUsage);   // size + spin
  g.setAttribute('iPos',iPos); g.setAttribute('iCol',iCol); g.setAttribute('iSR',iSR); g.instanceCount=0;
  const mat=new THREE.ShaderMaterial({ uniforms:{ map:{value:map} }, transparent:true, depthWrite:false, blending: additive?THREE.AdditiveBlending:THREE.NormalBlending,
    vertexShader:'attribute vec3 iPos; attribute vec4 iCol; attribute vec2 iSR; varying vec2 vUv; varying vec4 vCol;\n'+
      'void main(){ vec3 r=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]), u=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);\n'+
      '  float c=cos(iSR.y), s=sin(iSR.y); vec2 p=vec2(c*position.x-s*position.y, s*position.x+c*position.y)*iSR.x;\n'+
      '  vUv=uv; vCol=iCol; gl_Position=projectionMatrix*viewMatrix*vec4(iPos + r*p.x + u*p.y, 1.0); }',
    fragmentShader:'uniform sampler2D map; varying vec2 vUv; varying vec4 vCol; void main(){ vec4 t=texture2D(map,vUv); gl_FragColor=vec4(vCol.rgb*t.rgb, t.a*vCol.a); }' });
  const mesh=new THREE.Mesh(g, mat); mesh.frustumCulled=false; mesh.renderOrder=order; scene.add(mesh);
  return { g, mesh, iPos, iCol, iSR, n:0 };
}
export const PL_SMOKE = makePartLayer(SMOKE, false, 5), PL_GLOW = makePartLayer(GLOW, true, 6);
export const parts=[];
export const PPOOL=[];                                                                       // Z92 recycled particle records → no per-spark allocations (mobile GC hitches)
export function spawnPart(x,y,z,vx,vy,vz,o={}){
  if(parts.length >= PART_MAX*1.7*PERF.parts) return;                                  // hard budget (oldest keep living; new spawns drop) — shrinks when the device struggles
  if(PERF.parts<1 && (o.smoke||o.tex==='flash') && Math.random()>PERF.parts) return;  // under load: thin out the cheap-to-lose layers first
  const P=PPOOL.pop()||{ col:new THREE.Color(), _c0:new THREE.Color(), _c1:new THREE.Color() };
  P.x=x; P.y=y; P.z=z; P.vx=vx; P.vy=vy; P.vz=vz; P.life=P.max=o.life||0.6; P.size=o.size||1; P.grow=o.grow||0;
  P.grav=o.grav??-9; P.drag=o.drag??2.5; P.smoke=!!o.smoke; P.tex=o.tex||null; P.op=o.op??1; P.rot=(o.smoke||o.tex)?Math.random()*6.283:0; P.spin=o.smoke?(Math.random()-0.5)*0.8:0;
  P.col.setHex(o.color ?? 0xffd27a);
  if(o.color2!=null){ P.c0=P._c0.copy(P.col); P.c1=P._c1.setHex(o.color2); } else { P.c0=null; P.c1=null; }   // optional colour-over-life (e.g. fire cooling white→red)
  parts.push(P);
}
export function burst(pos, color, count, spread, o={}){
  for(let i=0;i<count;i++){
    const a=Math.random()*Math.PI*2, el=Math.random()*Math.PI*0.5, sp=spread*(0.4+Math.random()*0.6);
    spawnPart(pos.x,(o.y??1.2),pos.z, Math.cos(a)*Math.cos(el)*sp, Math.sin(el)*sp+ (o.up||0), Math.sin(a)*Math.cos(el)*sp,
      {color, size:o.size||1, life:o.life||0.6, grav:o.grav, drag:o.drag, smoke:o.smoke, op:o.op});
  }
}
export function updateParticles(dt){
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i]; p.life-=dt;
    if(p.life<=0){ parts[i]=parts[parts.length-1]; parts.pop(); PPOOL.push(p); continue; }   // swap-remove (no O(n) splice) + recycle
    p.vx*=Math.max(0,1-p.drag*dt); p.vz*=Math.max(0,1-p.drag*dt); p.vy+=p.grav*dt;
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; p.rot+=p.spin*dt;
    { const gy=heightAt(p.x,p.z)+0.1; if(p.y<gy){ p.y=gy; p.vy*=-0.3; p.vx*=0.6; p.vz*=0.6; } }
  }
}
// write live particles + tracer trails into the two instanced layers (called once per frame, after all spawning/updates)
export function flushParticles(){
  const L=[PL_SMOKE, PL_GLOW, PL_FIRE, PL_FLASH]; for(const l of L) l.n=0;
  for(const p of parts){ const ly=p.smoke?L[0]:(p.tex==='fire'?L[2]:(p.tex==='flash'?L[3]:L[1])); if(ly.n>=PART_MAX) continue; const i=ly.n++;
    const k=p.life/p.max, sz=p.size*(p.smoke ? (1.4-k*0.8) : (p.tex==='fire' ? (0.55+k*0.45) : k)) + (p.grow*(1-k));
    const col = p.c1 ? _pc.copy(p.c1).lerp(p.c0, k) : p.col;
    const py = (p.smoke||p.tex==='fire') ? Math.max(p.y, heightAt(p.x,p.z)+sz*0.42) : p.y;   // big billboards sit ON the ground instead of being sliced into half-discs
    ly.iPos.array[i*3]=p.x; ly.iPos.array[i*3+1]=py; ly.iPos.array[i*3+2]=p.z;
    ly.iCol.array[i*4]=col.r; ly.iCol.array[i*4+1]=col.g; ly.iCol.array[i*4+2]=col.b; ly.iCol.array[i*4+3]=(p.smoke? 0.5 : 1) * p.op * (p.smoke? Math.min(1,k*1.6)*Math.min(1,(1-k)*6+0.15) : Math.min(1,k*1.8));   // smoke fades IN then out
    ly.iSR.array[i*2]=sz; ly.iSR.array[i*2+1]=p.rot; }
  const G=L[1]; for(const t of trails){ if(G.n>=PART_MAX) break; const i=G.n++;
    G.iPos.array[i*3]=t.x; G.iPos.array[i*3+1]=t.y; G.iPos.array[i*3+2]=t.z;
    G.iCol.array[i*4]=t.c.r; G.iCol.array[i*4+1]=t.c.g; G.iCol.array[i*4+2]=t.c.b; G.iCol.array[i*4+3]=(t.life/t.max)*0.5;   // dots overlap along the streak → keep each faint so the sum doesn't blow out the bloom
    G.iSR.array[i*2]=t.size; G.iSR.array[i*2+1]=0; }
  for(const ly of L){ ly.g.instanceCount=ly.n; if(ly.n){ ly.iPos.needsUpdate=true; ly.iCol.needsUpdate=true; ly.iSR.needsUpdate=true;
    ly.iPos.clearUpdateRanges(); ly.iPos.addUpdateRange(0, ly.n*3); ly.iCol.clearUpdateRanges(); ly.iCol.addUpdateRange(0, ly.n*4); ly.iSR.clearUpdateRanges(); ly.iSR.addUpdateRange(0, ly.n*2); } }
}
export const _pc=new THREE.Color();
