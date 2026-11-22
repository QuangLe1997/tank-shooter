// world/decals.js — GROUND SCARS: tread marks (fade over time) + scorch/craters/impact dirt (permanent per stage) painted into a canvas draped on the field
import * as THREE from 'three';
import { CONTACT, TRAILS } from '../../config.js';
import { ARENA, BIOME, DECAL_U, MOBILE, PAVED, SCENE, TRAIL, blocks, bloodSplat, inField, solidShape, trailNormal } from '../hub.js';

// ---- GROUND SCARS: tread marks (fade over time) + scorch/craters/impact dirt (permanent per stage) painted into a canvas draped on the field ----
export const DECAL = { W: MOBILE?512:1024, DW: MOBILE?256:512, dirtyS:false, dirtyD:false, tS:0, tD:0, fadeT:0 };
DECAL.ppu = DECAL.W/(ARENA*2); DECAL.dppu = DECAL.DW/(ARENA*2);
DECAL.stat = document.createElement('canvas'); DECAL.stat.width=DECAL.stat.height=DECAL.W;     // scorch / craters (sharp, rarely re-uploaded)
DECAL.dyn  = document.createElement('canvas'); DECAL.dyn.width=DECAL.dyn.height=DECAL.DW;      // tread prints / dirt (soft, fades, cheap to upload)
DECAL.sx = DECAL.stat.getContext('2d'); DECAL.dx = DECAL.dyn.getContext('2d');
const decalTex=(cv)=>{ const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.generateMipmaps=true; return t; };   // Z328 read by the ground's shader (world/ground.js DECAL_U), no draped planes
DECAL.texS = DECAL_U.decalS.value = decalTex(DECAL.stat); DECAL.texD = DECAL_U.decalD.value = decalTex(DECAL.dyn);
// Z400 CONTACT: where things stand on the floor (config CONTACT) — r = shade tight round each footprint, g = the skirt of trodden earth further out
DECAL.CW = CONTACT.res[MOBILE ? 1 : 0]; DECAL.cppu = DECAL.CW / (ARENA * 2); DECAL.cont = document.createElement('canvas'); DECAL.cont.width = DECAL.cont.height = DECAL.CW;
{ const t = DECAL.texC = DECAL_U.decalC.value = new THREE.CanvasTexture(DECAL.cont); t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; }
// painted once a stage is built (render/blend-in.js blendScene): every footprint as one path per layer, blurred by the canvas's own shadow (drawn a canvas
//   width off to the left, so only its blurred shadow lands — the one soft-edge tool every browser has), the layers added channel by channel
export function paintContact(){ const C = CONTACT, x = DECAL.cont.getContext('2d'), W = DECAL.CW, P = DECAL.cppu, px = v => (v + ARENA) * P;
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.shadowColor = 'transparent'; x.clearRect(0, 0, W, W);
  const col = C.col[BIOME && BIOME.name] || C.col._; DECAL_U.contCol.value.setRGB(col[0], col[1], col[2]); DECAL_U.contK.value.set(C.on ? C.shade : 0, C.on ? C.skirt : 0);
  if(!C.on || BIOME.cave){ DECAL.texC.needsUpdate = true; return 0; }
  const fp = [], seen = new Set(); for(const b of blocks){ if(!b || !(b.x === b.x) || b.air) continue; let s = null; try{ s = solidShape(b); }catch(e){}   // (its true footprint: a wall's battered foot, a whole building)
    if(s && s.obb){ if(seen.has(s)) continue; seen.add(s); fp.push({ x:s.x, z:s.z, f:s.obb.f, hl:s.obb.hl, hw:s.obb.hw }); } else if(b.r > 0.3) fp.push({ x:b.x, z:b.z, r:b.r * C.rK }); }
  for(const p of SCENE.pieces || []) if(!p.far && p.r > 0.3) fp.push({ x:p.x, z:p.z, r:p.r * C.sceneK });
  let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const shape = (path, f, grow, blot) => { if(f.r != null){ const R = (f.r + grow) * P; path.moveTo(px(f.x) + R, px(f.z)); path.arc(px(f.x), px(f.z), R, 0, 6.2832); }
      else { const c = Math.cos(f.f), s = Math.sin(f.f), hl = f.hl + grow, hw = f.hw + grow, q = [[hl, hw], [-hl, hw], [-hl, -hw], [hl, -hw]].map(([a, b]) => [px(f.x + a * s + b * c), px(f.z + a * c - b * s)]);   // (solid-shape.js: along (sin f, cos f) ± hl, across ± hw)
        path.moveTo(q[0][0], q[0][1]); for(let i = 1; i < 4; i++) path.lineTo(q[i][0], q[i][1]); path.closePath(); }
      if(blot){ const R0 = f.r != null ? f.r : f.hl + f.hw, n = Math.max(3, Math.round(R0 * 1.6)), s = f.r != null ? 0 : Math.sin(f.f), c = f.r != null ? 1 : Math.cos(f.f);   // ragged blotches round its edge
        for(let i = 0; i < n; i++){ const a = rnd() * 6.2832, g = grow * (0.3 + rnd() * 0.8), u = Math.cos(a) * ((f.r != null ? f.r : f.hl) + g), v = Math.sin(a) * ((f.r != null ? f.r : f.hw) + g),
          bx = px(f.x + u * s + v * c), bz = px(f.z + u * c - v * s), br = (C.blot[0] + rnd() * (C.blot[1] - C.blot[0])) * P; path.moveTo(bx + br, bz); path.arc(bx, bz, br, 0, 6.2832); } } };
  const sh = new Path2D(), sk = new Path2D(); for(const f of fp){ shape(sh, f, C.pad, false); shape(sk, f, C.skirtW, true); }
  x.globalCompositeOperation = 'lighter'; x.fillStyle = '#000';
  for(const [path, colr, blur] of [[sh, 'rgb(255,0,0)', C.shadeB], [sk, 'rgb(0,255,0)', C.skirtB]]){ x.save(); x.translate(-W, 0); x.shadowColor = colr; x.shadowBlur = blur * P * 2; x.shadowOffsetX = W; x.fill(path); x.restore(); }
  const TP = TRAIL.paths || [];   // Z432 the trails (world/trails.js) into the blue channel: the worn body (the brightest wins where two meet), the two wheel ruts added on it
  const str = (pts, off, w, col, blur, op) => { const p = new Path2D(); pts.forEach((q, i) => { const [nx, nz] = trailNormal(pts, i), X = px(q[0] + nx * off), Z = px(q[1] + nz * off); if(i) p.lineTo(X, Z); else p.moveTo(X, Z); });
    x.save(); x.globalCompositeOperation = op; x.translate(-W, 0); x.shadowColor = col; x.shadowBlur = blur * P * 2; x.shadowOffsetX = W; x.lineWidth = w * P; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#000'; x.stroke(p); x.restore(); };
  for(const L of TP) str(L.pts, 0, L.w, 'rgb(0,0,' + TRAILS.body + ')', TRAILS.blur, 'lighten');
  for(const L of TP) for(const sd of [-1, 1]) str(L.pts, sd * L.w * TRAILS.rut, TRAILS.rutW, 'rgb(0,0,' + TRAILS.rutV + ')', TRAILS.rutB, 'lighter');
  if(PAVED.length){ x.globalCompositeOperation = 'lighten'; x.fillStyle = 'rgb(0,0,255)'; for(const q of PAVED){ x.beginPath(); x.arc(px(q.x), px(q.z), q.r * P, 0, 6.2832); x.fill(); } }   // Z453 the paved yards: no grass through the flagstones
  x.globalCompositeOperation = 'source-over'; DECAL.texC.needsUpdate = true; return fp.length; }
export const _dpx=(x)=>(x+ARENA)*DECAL.ppu, _dpz=(z)=>(z+ARENA)*DECAL.ppu, _ddx=(x)=>(x+ARENA)*DECAL.dppu, _ddz=(z)=>(z+ARENA)*DECAL.dppu;
export let _treadCol='rgba(42,30,18,', _treadA=0.16;
export function decalReset(b){
  DECAL.sx.clearRect(0,0,DECAL.W,DECAL.W); DECAL.dx.clearRect(0,0,DECAL.DW,DECAL.DW); DECAL.dirtyS=DECAL.dirtyD=true;
  const nm=b&&b.name; _treadCol = (nm==='TUNDRA'||nm==='ARCTIC') ? 'rgba(70,84,100,' : nm==='SAVANNA' ? 'rgba(90,60,30,' : (nm==='MEADOW'||nm==='HILLS'||nm==='VILLAGE') ? 'rgba(48,40,24,' : nm==='CITY' ? 'rgba(20,20,24,' : nm==='FOUNDRY' ? 'rgba(10,8,6,' : 'rgba(42,30,18,';
  _treadA = (nm==='TUNDRA'||nm==='ARCTIC') ? 0.26 : nm==='SAVANNA' ? 0.22 : (nm==='MEADOW'||nm==='HILLS'||nm==='VILLAGE') ? 0.24 : 0.16;
  for(let i=0;i<(MOBILE?8:14);i++){ let x=0,z=0,ok=false; for(let t=0;t<12&&!ok;t++){ x=(Math.random()*2-1)*(ARENA-6); z=(Math.random()*2-1)*(ARENA-6); ok=Math.hypot(x,z)>14 && Math.hypot(x,z-ARENA*0.55)>8 && inField(x,z,4); }   // old shell craters from earlier fighting
    if(ok) decalCrater(x,z,1.4+Math.random()*2.6, 0.6); }
}
export function decalScorch(x, z, r, k){                                               // blast scorch: charred core → soot halo
  const c=DECAL.sx, px=_dpx(x), pz=_dpz(z), R=r*DECAL.ppu; k=k==null?1:k;
  const g=c.createRadialGradient(px,pz,0,px,pz,R); g.addColorStop(0,'rgba(12,9,6,'+(0.82*k).toFixed(2)+')'); g.addColorStop(0.45,'rgba(22,16,10,'+(0.55*k).toFixed(2)+')'); g.addColorStop(1,'rgba(30,22,14,0)');
  c.fillStyle=g; c.beginPath(); c.arc(px,pz,R,0,7); c.fill();
  for(let i=0;i<Math.round(6+r*2);i++){ const a=Math.random()*6.283, rr=R*(0.6+Math.random()*0.7); c.strokeStyle='rgba(14,10,6,'+(0.25*k).toFixed(2)+')'; c.lineWidth=Math.max(1,R*0.06); c.beginPath(); c.moveTo(px+Math.cos(a)*R*0.3,pz+Math.sin(a)*R*0.3); c.lineTo(px+Math.cos(a)*rr,pz+Math.sin(a)*rr); c.stroke(); }   // radial blast streaks
  DECAL.dirtyS=true;
}
export function decalAsh(x, z, r, k){                                                  // Z418 a light grey burn: ash and scorched dust where a broken thing stood (not a fuel fire's black)
  const c=DECAL.sx, px=_dpx(x), pz=_dpz(z), R=r*DECAL.ppu; k=k==null?1:k;
  const g=c.createRadialGradient(px,pz,0,px,pz,R); g.addColorStop(0,'rgba(96,92,86,'+(0.5*k).toFixed(2)+')'); g.addColorStop(0.55,'rgba(132,128,120,'+(0.34*k).toFixed(2)+')'); g.addColorStop(1,'rgba(150,146,138,0)');
  c.fillStyle=g; c.beginPath(); c.arc(px,pz,R,0,7); c.fill();
  for(let i=0;i<Math.round(10+r*3);i++){ const a=Math.random()*6.283, rr=R*Math.sqrt(Math.random())*0.9, s=Math.max(1,R*(0.05+Math.random()*0.1)), lt=Math.random()<0.5;   // mottled: darker char, paler ash
    c.fillStyle=lt ? 'rgba(186,182,172,'+(0.22*k).toFixed(2)+')' : 'rgba(58,54,50,'+(0.26*k).toFixed(2)+')'; c.beginPath(); c.arc(px+Math.cos(a)*rr,pz+Math.sin(a)*rr,s,0,7); c.fill(); }
  DECAL.dirtyS=true;
}
export function decalCrater(x, z, r, k){                                               // shell crater: dark pit + lighter thrown-out ejecta rim
  const c=DECAL.sx, px=_dpx(x), pz=_dpz(z), R=r*DECAL.ppu; k=k==null?1:k;
  const rim=c.createRadialGradient(px,pz,R*0.55,px,pz,R*1.35); rim.addColorStop(0,'rgba(255,240,210,'+(0.16*k).toFixed(2)+')'); rim.addColorStop(1,'rgba(255,240,210,0)');
  c.fillStyle=rim; c.beginPath(); c.arc(px,pz,R*1.35,0,7); c.fill();
  const pit=c.createRadialGradient(px-R*0.15,pz-R*0.15,0,px,pz,R*0.8); pit.addColorStop(0,'rgba(16,12,8,'+(0.7*k).toFixed(2)+')'); pit.addColorStop(1,'rgba(30,22,14,0)');
  c.fillStyle=pit; c.beginPath(); c.arc(px,pz,R*0.8,0,7); c.fill();
  for(let i=0;i<10;i++){ const a=Math.random()*6.283, rr=R*(0.9+Math.random()*0.6); c.fillStyle='rgba(30,22,14,'+(0.3*k).toFixed(2)+')'; c.beginPath(); c.arc(px+Math.cos(a)*rr,pz+Math.sin(a)*rr,Math.max(1,R*0.08),0,7); c.fill(); }   // clods
  c.strokeStyle='rgba(28,20,12,'+(0.22*k).toFixed(2)+')'; c.lineCap='round';
  for(let i=0;i<9;i++){ const a=Math.random()*6.283, r0=R*(0.85+Math.random()*0.15), r1=R*(1.4+Math.random()*0.9); c.lineWidth=Math.max(1,R*(0.05+Math.random()*0.07));   // radial ejecta streaks
    c.beginPath(); c.moveTo(px+Math.cos(a)*r0,pz+Math.sin(a)*r0); c.lineTo(px+Math.cos(a+(Math.random()-0.5)*0.12)*r1,pz+Math.sin(a+(Math.random()-0.5)*0.12)*r1); c.stroke(); }
  const ring=c.createRadialGradient(px,pz,R*0.62,px,pz,R*0.95); ring.addColorStop(0,'rgba(20,14,8,0)'); ring.addColorStop(0.6,'rgba(20,14,8,'+(0.28*k).toFixed(2)+')'); ring.addColorStop(1,'rgba(20,14,8,0)');   // scorched crater wall
  c.fillStyle=ring; c.beginPath(); c.arc(px,pz,R*0.95,0,7); c.fill();
  DECAL.dirtyS=true;
}
export function decalBlood(x, z, r){ bloodSplat(x, z, r); }   // Z121 blood = soft instanced splats (fx/gore.js); the 2 px/m decal canvas drew it as dark blocky squares
export function decalDirt(x, z, r){                                                    // bullet strike / near miss: small dark puff (fades with treads)
  const c=DECAL.dx, px=_ddx(x), pz=_ddz(z), R=Math.max(1.2,r*DECAL.dppu);
  c.fillStyle=_treadCol+'0.32)'; c.beginPath(); c.arc(px,pz,R,0,7); c.fill(); DECAL.dirtyD=true;
}
export function updateDecals(dt){
  DECAL.fadeT+=dt; if(DECAL.fadeT>2){ DECAL.fadeT=0; const c=DECAL.dx; c.globalCompositeOperation='destination-out'; c.fillStyle='rgba(0,0,0,0.045)'; c.fillRect(0,0,DECAL.DW,DECAL.DW); c.globalCompositeOperation='source-over'; DECAL.dirtyD=true; }   // old tracks weather away
  DECAL.tD+=dt; DECAL.tS+=dt;
  if(DECAL.dirtyD && DECAL.tD > (MOBILE?0.33:0.2)){ DECAL.tD=0; DECAL.dirtyD=false; DECAL.texD.needsUpdate=true; }
  else if(DECAL.dirtyS && DECAL.tS > 0.35){ DECAL.tS=0; DECAL.dirtyS=false; DECAL.texS.needsUpdate=true; }   // never both uploads in one frame
}
