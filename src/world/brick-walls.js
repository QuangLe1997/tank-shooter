// world/brick-walls.js — Z86 RUINED BRICK WALLS — tall, shell-torn, never whole; ram them down at speed
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DRIVE, LOOT } from '../../config.js';
import { AREA_K, ARENA, BIOME, BRICK_PAL, MOBILE, S, _canvasTex, _tb, blocks, burst, dropPowerup, floatText, heightAt, inZone, satOBB, scene, sfx, tip } from '../hub.js';

// ----------------------------- Z86 RUINED BRICK WALLS — tall, shell-torn, never whole; ram them down at speed -----------------------------
// Each 3 m section is real masonry: running-bond bricks (per-brick tone, chips, loose top courses), a ragged broken top, shell holes,
// rubble at the foot. Collision is an oriented box (thin wall, not a pillar). Shots bring it down in stages (top → middle → stub);
// a tank hitting it faster than DRIVE.wallBreak bursts straight through and the section topples away from the hull.
export const BRICK={ L:0.5, H:0.21, D:0.5, gap:0.028, seg:3 };
export let _brickMat=null;
export function brickMat(){ if(_brickMat) return _brickMat;
  const map=_canvasTex(128,64,(x,W,H)=>{ x.fillStyle='#d8d8d8'; x.fillRect(0,0,W,H);
    for(let i=0;i<1500;i++){ const v=(150+Math.random()*105)|0; x.fillStyle='rgba('+v+','+v+','+v+',0.55)'; x.fillRect(Math.random()*W,Math.random()*H,1+Math.random()*2,1+Math.random()*2); }   // fired-clay grit
    for(let i=0;i<14;i++){ x.fillStyle='rgba(70,56,44,0.28)'; x.beginPath(); x.arc(Math.random()*W,Math.random()*H,1+Math.random()*4,0,7); x.fill(); }                       // pits + chips
    x.strokeStyle='rgba(255,255,255,0.35)'; x.lineWidth=2; x.strokeRect(1,1,W-2,H-2); });                                                                               // weathered arris edge
  _brickMat=new THREE.MeshStandardMaterial({ vertexColors:true, map, roughness:0.94, metalness:0, envMapIntensity:0.35 }); return _brickMat; }
export function _brickGeo(w,h,d,x,y,z,ry,rz,col){ const g=new THREE.BoxGeometry(w,h,d); g.rotateZ(rz||0); g.rotateY(ry||0); g.translate(x,y,z);
  const c=new THREE.Color(col), n=g.attributes.position.count, a=new Float32Array(n*3); for(let i=0;i<n;i++){ const k=0.9+((i/4|0)%3)*0.05; a[i*3]=c.r*k; a[i*3+1]=c.g*k; a[i*3+2]=c.b*k; }
  g.setAttribute('color', new THREE.BufferAttribute(a,3)); return g; }
export const WALL_BANDS=[1.1, 2.25, 9];                                                   // top of each collapse band (m)
// one section, length along local +z, centred on the origin, foot at y=0
export function buildWallSection(pal, opt){
  const len=BRICK.seg, rows=Math.round((opt.h||3.3)/BRICK.H), L=BRICK.L, H=BRICK.H, D=BRICK.D, gap=BRICK.gap;
  const ph=Math.random()*6, fr=0.6+Math.random()*1.4, lvl=opt.lvl==null?0.75:opt.lvl;
  const topAt=z=>{ const u=(z+len/2)/len; return Math.max(3, Math.round(rows*Math.min(1, lvl + 0.22*Math.sin(u*fr*3.1+ph) + 0.12*Math.sin(u*9.7+ph*2) - (opt.slope||0)*u))); };   // ragged broken top
  const hole = opt.hole ? { z:(Math.random()-0.5)*1.4, y:0.9+Math.random()*1.3, r:0.38+Math.random()*0.32 } : null;                                            // shell hole punched through
  const bands=[[],[],[]], soot=opt.soot||0; let minTop=rows;
  const tone=()=>{ const c=new THREE.Color(pal[(Math.random()*pal.length)|0]); c.offsetHSL(0,(Math.random()-0.5)*0.05,(Math.random()-0.5)*0.07); return c; };
  for(let r=0;r<rows;r++){ const y=r*H+H/2, off=(r%2)*L/2;
    for(let k=-1;k<=Math.ceil(len/L);k++){ let z0=-len/2+off+k*L, z1=z0+L; z0=Math.max(z0,-len/2); z1=Math.min(z1,len/2); if(z1-z0<0.08) continue;
      const zc=(z0+z1)/2, top=topAt(zc); minTop=Math.min(minTop,top); if(r>=top) continue;
      if(hole && Math.hypot(zc-hole.z, y-hole.y) < hole.r+(Math.random()-0.5)*0.12) continue;
      const loose = r>=top-2, missing = loose && Math.random()<0.18; if(missing) continue;
      const chip = Math.random()<0.12 ? 0.82 : 1, c=tone(); if(soot && y>rows*H*0.45) c.lerp(new THREE.Color(0x1c1814), Math.min(0.75, soot*(y/(rows*H))*Math.random()));   // smoke-blackened upper courses
      const g=_brickGeo(D*(0.94+Math.random()*0.06)*chip, H-gap, (z1-z0)-gap, (Math.random()-0.5)*(loose?0.06:0.02), y+(Math.random()-0.5)*0.01, zc, (Math.random()-0.5)*(loose?0.12:0.025), (Math.random()-0.5)*(loose?0.1:0.02), c);
      bands[y<WALL_BANDS[0]?0:y<WALL_BANDS[1]?1:2].push(g); } }
  const coreTop=minTop*H-0.06, mortar=0x6e665a;                                                                                    // mortar core — no daylight through the joints
  for(let bi=0;bi<3;bi++){ const y0=bi?WALL_BANDS[bi-1]:0, y1=Math.min(WALL_BANDS[bi], coreTop); if(y1-y0<0.1) continue;
    if(hole && hole.y-hole.r<y1 && hole.y+hole.r>y0){ for(const [za,zb] of [[-len/2+0.03, hole.z-hole.r-0.05],[hole.z+hole.r+0.05, len/2-0.03]]) if(zb-za>0.1) bands[bi].push(_brickGeo(D-0.12, y1-y0, zb-za, 0,(y0+y1)/2,(za+zb)/2,0,0,mortar)); }
    else bands[bi].push(_brickGeo(D-0.12, y1-y0, len-0.06, 0,(y0+y1)/2,0,0,0,mortar)); }
  for(let i=0;i<5+(Math.random()*6|0);i++){ const sd=Math.random()<0.5?-1:1;                                                          // fallen bricks at the foot
    bands[0].push(_brickGeo(D*0.9, H-gap, L*(0.5+Math.random()*0.5), sd*(D*0.7+Math.random()*0.9), H*0.4, (Math.random()-0.5)*len, Math.random()*3, (Math.random()-0.5)*0.6, tone())); }
  const grp=new THREE.Group(), meshes=[];
  for(const b of bands){ if(!b.length){ meshes.push(null); continue; } const m=new THREE.Mesh(mergeGeometries(b,false), brickMat()); b.forEach(g=>g.dispose()); m.castShadow=true; m.receiveShadow=true; grp.add(m); meshes.push(m); }
  return { grp, bands:meshes, top:minTop*H };
}
export const WALL_FALL=[];                                                                // toppling sections / collapsing bands (animated, then rubble)
export const BUMPS=[];                                                                    // low obstacles the hull rides over (rocks, rubble) → tilts the tank
export function bumpAt(x,z){ let h=0; for(const b of BUMPS){ const dx=x-b.x, dz=z-b.z, q=(dx*dx+dz*dz)/(b.r*b.r); if(q<1){ const v=b.h*(1-q)*(1-q*0.4); if(v>h) h=v; } } return h; }
export function buildBrickWalls(){
  const pal=BRICK_PAL[BIOME.name]||BRICK_PAL.RUINS, runs=Math.round(((MOBILE?3:4)+Math.min(3, Math.floor(S.stage*0.6)))*Math.min(AREA_K,1.8)), soot=BIOME.name==='FOUNDRY'||BIOME.name==='RUINS'?0.9:0.45;
  for(let n=0, tries=0; n<runs && tries<80; tries++){
    const cx=(Math.random()*2-1)*(ARENA-14), cz=(Math.random()*2-1)*(ARENA-14), ang=(Math.random()*8|0)*Math.PI/4, segs=3+(Math.random()*4|0);
    if(inZone(cx, cz, 12)) continue;                                                        // Z104 keep installations clear
    const fx=Math.sin(ang), fz=Math.cos(ang), pts=[]; for(let k=0;k<segs;k++){ const o=(k-(segs-1)/2)*BRICK.seg; pts.push([cx+fx*o, cz+fz*o]); }
    if(pts.some(([x,z])=>Math.abs(x)>ARENA-6||Math.abs(z)>ARENA-6||Math.hypot(x,z)<17||Math.hypot(x,z-ARENA*0.55)<13||blocks.some(b=>Math.hypot(b.x-x,b.z-z)<b.r+3.2))) continue;
    n++; const gapAt = segs>=4 ? 1+(Math.random()*(segs-2)|0) : -1;                 // a breach somewhere along longer runs → a way through
    pts.forEach(([x,z],k)=>{ const gy=heightAt(x,z);
      if(k===gapAt){ spawnRubble(x, z, ang, pal, 0.8); return; }
      const lvl = k===gapAt-1||k===gapAt+1 ? 0.42+Math.random()*0.25 : 0.74+Math.random()*0.3;   // walls slump toward the breach
      const ws=buildWallSection(pal, { h:3.9+Math.random()*0.9, lvl, hole:Math.random()<0.35, soot, slope:k===gapAt-1?0.4:(k===gapAt+1?-0.4:0) });
      ws.grp.position.set(x, gy-0.08, z); ws.grp.rotation.y=ang; scene.add(ws.grp);
      const hp=Math.round(140+ws.top*30);
      blocks.push({ mesh:ws.grp, x, z, r:1.55, hp, maxHp:hp, steel:false, loot:false, kind:'brick', obb:{ f:ang, hw:BRICK.D/2+0.06, hl:BRICK.seg/2 }, wall:{ bands:ws.bands, stage:0, pal } });
    });
  }
}
export function spawnRubble(x, z, ang, pal, k){                                            // heap of broken masonry: hull rides over it (BUMPS), shots pass
  const gs=[], gy=heightAt(x,z), c=()=>{ const q=new THREE.Color(pal[(Math.random()*pal.length)|0]); q.offsetHSL(0,0,(Math.random()-0.5)*0.12); return q; };
  const n=Math.round(26*k); for(let i=0;i<n;i++){ const a=Math.random()*6.283, r=Math.pow(Math.random(),0.7)*1.7, h=(1-r/1.8)*0.55*k;
    gs.push(_brickGeo(BRICK.D*(0.5+Math.random()*0.5), BRICK.H*(0.7+Math.random()*0.3), BRICK.L*(0.4+Math.random()*0.6), Math.cos(a)*r, h*Math.random()+0.08, Math.sin(a)*r*1.4, Math.random()*6, (Math.random()-0.5)*1.2, c())); }
  const m=new THREE.Mesh(mergeGeometries(gs,false), brickMat()); gs.forEach(g=>g.dispose()); m.position.set(x,gy-0.04,z); m.rotation.y=ang; m.castShadow=true; m.receiveShadow=true; scene.add(m);
  RUBBLE.push(m); BUMPS.push({ x, z, r:1.9, h:0.5*k, rubble:m });
}
export const RUBBLE=[];
export function clearWalls(){ for(const m of RUBBLE) { scene.remove(m); m.geometry.dispose(); } RUBBLE.length=0; BUMPS.length=0; for(const f of WALL_FALL) scene.remove(f.obj); WALL_FALL.length=0; }
// is a point (with padding) inside this block? walls = thin oriented box, everything else = circle
export function inBlock(bl, x, z, pad){ const dx=x-bl.x, dz=z-bl.z;
  if(bl.obb){ const s=Math.sin(bl.obb.f), c=Math.cos(bl.obb.f), al=dx*s+dz*c, ac=dx*c-dz*s; return Math.abs(al)<bl.obb.hl+pad && Math.abs(ac)<bl.obb.hw+pad; }
  return dx*dx+dz*dz < (bl.r+pad)*(bl.r+pad); }
// tank hull vs a wall's oriented box (SAT) — same response as the round obstacles: push out, kill the speed into it, keep a slide
export function tankVsWall(t, bl){
  const h=satOBB(_tb(t), { x:bl.x, z:bl.z, f:bl.obb.f, hw:bl.obb.hw, hl:bl.obb.hl }); if(!h) return 0;
  t.pos.x-=h.nx*h.d; t.pos.z-=h.nz*h.d; if(!t.vel) return 0; const vn=t.vel.x*h.nx+t.vel.z*h.nz;
  if(vn>0){ t.vel.x-=h.nx*vn*1.1; t.vel.z-=h.nz*vn*1.1; const tx=-h.nz, tz=h.nx, vt=t.vel.x*tx+t.vel.z*tz; t.vel.x-=tx*vt*0.12; t.vel.z-=tz*vt*0.12; }
  return vn; }
// a band (or the whole section) breaks loose and falls; dir = which side it tips toward (+1/-1 across the wall)
export function wallFall(bl, mesh, side, whole){
  if(!mesh) return; const g=bl.mesh; g.updateMatrixWorld(true);
  const piv=new THREE.Group(), s=Math.sin(bl.obb.f), c=Math.cos(bl.obb.f), y0=whole?0:(mesh===bl.wall.bands[2]?WALL_BANDS[1]:WALL_BANDS[0]);
  piv.position.set(bl.x + c*side*BRICK.D*0.5, g.position.y + y0, bl.z - s*side*BRICK.D*0.5); piv.rotation.y=bl.obb.f; scene.add(piv);
  const inner=whole?g:mesh; if(!whole) g.remove(mesh); else scene.remove(g);
  inner.position.set(-side*BRICK.D*0.5, -y0, 0); inner.rotation.set(0,0,0); piv.add(inner);
  WALL_FALL.push({ obj:piv, side, ang:0, av:whole?1.2:0.6, t:0, whole, x:bl.x, z:bl.z, pal:bl.wall.pal, ang0:bl.obb.f, landed:false, vy:0, gy:g.position.y });
}
export function updateWalls(dt){
  for(let i=WALL_FALL.length-1;i>=0;i--){ const f=WALL_FALL[i]; f.t+=dt;
    if(!f.landed){ f.av += dt*(f.whole?7.5:9); f.ang=Math.min(Math.PI/2*0.94, f.ang+f.av*dt); f.obj.rotation.z = -f.side*f.ang;   // tips over its foot, gathering speed
      if(!f.whole && f.ang>0.5){ f.vy += 22*dt; f.obj.position.y = Math.max(f.gy+0.15, f.obj.position.y - f.vy*dt); }            // a broken-off course drops as it turns
      if(f.ang>=Math.PI/2*0.94 && (f.whole || f.obj.position.y<=f.gy+0.16)){ f.landed=true; f.t=0; const lx=f.x+Math.cos(f.ang0)*f.side*1.6, lz=f.z-Math.sin(f.ang0)*f.side*1.6;
        burst({x:lx,z:lz}, 0xb8a890, f.whole?9:5, f.whole?6:4, {y:heightAt(lx,lz)+0.6, life:1.5, size:f.whole?3.0:2.0, smoke:true, grav:-0.35, drag:1.6, up:1.4, op:0.6});   // the crash: masonry dust rolls out
        burst({x:lx,z:lz}, f.pal[0], 14, 7, {y:heightAt(lx,lz)+0.8, life:0.6, size:0.32, grav:-18, drag:1.2, up:3});
        sfx('explode'); S.shake=Math.min(2.6, S.shake + (f.whole?1.4:0.6)*Math.max(0.2, 1-Math.hypot(lx-S.player.pos.x, lz-S.player.pos.z)/30));
        if(f.whole) spawnRubble(lx*0.5+f.x*0.5, lz*0.5+f.z*0.5, f.ang0, f.pal, 1.0); } }
    else { f.obj.position.y -= dt*0.5; if(f.t>1.0){ scene.remove(f.obj); f.obj.traverse(o=>{ if(o.isMesh) o.geometry.dispose(); }); WALL_FALL.splice(i,1); } } }   // settle into the ground
}
export function wallDamage(b, dmg, side){                                                  // staged: top courses go, then the middle, then it's down
  if(b.dead) return; b.hp-=dmg; const f=Math.max(0,b.hp)/b.maxHp, W=b.wall, sd=side||(Math.random()<0.5?-1:1);
  b.mesh.position.x = b.x + (Math.random()-0.5)*0.06;
  burst({x:b.x+(Math.random()-0.5)*2,z:b.z+(Math.random()-0.5)*2}, W.pal[1], 4, 4, {y:heightAt(b.x,b.z)+0.8+Math.random()*1.6, life:0.45, size:0.26, grav:-16, drag:1.4, up:2});   // brick chips fly
  if(Math.random()<0.4) burst({x:b.x,z:b.z}, 0xb8ab94, 1, 1.5, {y:heightAt(b.x,b.z)+1.4, life:1.1, size:1.6, smoke:true, grav:-0.3, drag:1.8, up:0.8, op:0.4});
  if(W.stage<1 && f<0.66 && W.bands[2]){ W.stage=1; wallFall(b, W.bands[2], sd, false); W.bands[2]=null; }
  if(W.stage<2 && f<0.33 && W.bands[1]){ W.stage=2; wallFall(b, W.bands[1], sd, false); W.bands[1]=null; }
  if(b.hp<=0) collapseWall(b, sd);
}
export function collapseWall(b, side){                                                     // the whole section goes over
  if(b.dead) return; b.dead=true; const i=blocks.indexOf(b); if(i>=0) blocks.splice(i,1);
  wallFall(b, b.mesh, side||1, true);
  if(b.loot) dropPowerup({x:b.x,z:b.z});
}
// player rams a wall: fast enough → bursts through, it topples away; too slow → a dull thump and a nudge to back up for a run
export let _hintT=0;
export function driveHint(txt){ const n=performance.now()/1000; if(n-_hintT<3.5) return; _hintT=n; floatText(txt, '#ffd27a', {x:S.player.pos.x,y:3.4,z:S.player.pos.z}, 16); }
export function ramWall(t, bl, closing){
  const s=Math.sin(bl.obb.f), c=Math.cos(bl.obb.f), side = ((t.pos.x-bl.x)*c-(t.pos.z-bl.z)*s) > 0 ? -1 : 1;   // topple AWAY from the tank
  if(closing >= DRIVE.wallBreak*(t===S.player&&t.ramOn?LOOT.ram.wall:1)){ wallDamage(bl, 1e6, side); return true; }
  if(closing > 4){ wallDamage(bl, closing*2.2, side); if(t===S.player){ driveHint('LÙI LẠI · LẤY ĐÀ ĐỂ HÚC'); tip('wall'); } }
  return false;
}
