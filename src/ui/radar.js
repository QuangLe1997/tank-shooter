// ui/radar.js — RADAR / MINIMAP
import { ALLY_TANKS, ARENA, DEPOTS, FT, HELOS, OBJ, POWS, RALLY_PT, RIDGES, S, boss, core, enemies, fieldOutline, lootBeacons, playerRange } from '../hub.js';
   // grace window so the deploy tap doesn't skip

// ----------------------------- RADAR / MINIMAP -----------------------------
export const radarCanvas=document.getElementById('radar'), radarCtx=radarCanvas.getContext('2d');
export function drawRadar(){
  const c=radarCtx, W=radarCanvas.width, H=radarCanvas.height, cx=W/2, cy=H/2;
  const scale=(W/2-7)/ARENA, toX=wx=>cx+wx*scale, toY=wz=>cy+wz*scale;
  c.clearRect(0,0,W,H);
  { const O=fieldOutline(); c.fillStyle='rgba(255,255,255,0.035)'; c.strokeStyle='rgba(255,255,255,0.32)'; c.lineWidth=1.2; c.beginPath();   // Z106 the real (irregular) fence line
    O.forEach(([x,z],i)=> i ? c.lineTo(toX(x),toY(z)) : c.moveTo(toX(x),toY(z))); c.closePath(); c.fill(); c.stroke(); }
  c.strokeStyle='rgba(200,190,170,0.55)'; c.lineWidth=2; for(const R of RIDGES){ c.beginPath(); R.pts.forEach(([x,z],i)=> i ? c.lineTo(toX(x),toY(z)) : c.moveTo(toX(x),toY(z))); c.stroke(); }   // rock ridges
  const p=S.player;
  if(p){ c.fillStyle='rgba(140,191,63,0.10)'; c.beginPath(); c.arc(toX(p.pos.x),toY(p.pos.z), playerRange()*scale, 0, Math.PI*2); c.fill(); }  // range coverage
  if(core){ const x=toX(core.pos.x), y=toY(core.pos.z), low=core.hp/core.maxHp<0.35;     // core (cyan diamond, red if low)
    c.fillStyle=low?'#ff5a3a':'#6fe0ff'; c.beginPath(); c.moveTo(x,y-5); c.lineTo(x+5,y); c.lineTo(x,y+5); c.lineTo(x-5,y); c.closePath(); c.fill(); }
  c.fillStyle='#ff6a4a'; for(const e of enemies){ if(e.def.inf){ c.fillStyle='#e0a070'; c.fillRect(toX(e.pos.x)-1, toY(e.pos.z)-1, 2, 2); c.fillStyle='#ff6a4a'; } else if(e.def.air){ const x=toX(e.pos.x), y=toY(e.pos.z); c.fillStyle='#ff4ad0'; c.beginPath(); c.moveTo(x,y-4); c.lineTo(x+3.5,y+3); c.lineTo(x-3.5,y+3); c.closePath(); c.fill(); c.fillStyle='#ff6a4a'; } else c.fillRect(toX(e.pos.x)-1.5, toY(e.pos.z)-1.5, 3, 3); }   // tanks · infantry · aircraft
  c.fillStyle='#ffd24a'; for(const lb of lootBeacons){ const ox=lb.kind==='block'?lb.owner.x:lb.owner.pos.x, oz=lb.kind==='block'?lb.owner.z:lb.owner.pos.z; c.fillRect(toX(ox)-2, toY(oz)-2, 4, 4); }   // hidden loot
  if(boss&&boss.alive){ c.fillStyle='#ffae3a'; c.beginPath(); c.arc(toX(boss.pos.x),toY(boss.pos.z),4.5,0,Math.PI*2); c.fill(); }
  if(OBJ && OBJ.alive){ const x=toX(OBJ.x), y=toY(OBJ.z), pl=0.6+0.4*Math.sin(performance.now()/180); c.strokeStyle='rgba(255,196,64,'+pl+')'; c.lineWidth=1.6; c.strokeRect(x-5,y-5,10,10); c.fillStyle='#ffc440'; c.fillRect(x-2,y-2,4,4); }   // objective
  // Z104 installations + our units: rally (green ring) · POW stockade (amber → green when open) · depots (square: held red, open amber, ours green)
  if(RALLY_PT.g){ c.strokeStyle='#9be04a'; c.lineWidth=1.6; c.beginPath(); c.arc(toX(RALLY_PT.x),toY(RALLY_PT.z),4,0,Math.PI*2); c.stroke(); }
  for(const w of POWS){ if(w.state==='free') continue; const x=toX(w.x), y=toY(w.z); c.strokeStyle=w.state==='open'?'#9be04a':'#ffcf5a'; c.lineWidth=1.6; c.beginPath(); c.moveTo(x,y-4.5); c.lineTo(x+4.5,y); c.lineTo(x,y+4.5); c.lineTo(x-4.5,y); c.closePath(); c.stroke(); }
  for(const d of DEPOTS){ const x=toX(d.x), y=toY(d.z); c.strokeStyle=d.state==='ours'?'#9be04a':(d.state==='open'?'#ffcf5a':'#ff6a4a'); c.lineWidth=1.6; c.strokeRect(x-4,y-4,8,8); if(d.kind==='motor'){ c.fillStyle=c.strokeStyle; c.fillRect(x-1.5,y-1.5,3,3); } }
  for(const h of HELOS){ c.strokeStyle='rgba(255,74,42,0.9)'; c.lineWidth=1.2; c.beginPath(); c.arc(toX(h.dx),toY(h.dz),5,0,Math.PI*2); c.stroke(); }
  c.fillStyle='#9be04a'; for(const a of FT) c.fillRect(toX(a.pos.x)-1, toY(a.pos.z)-1, 2.5, 2.5);
  for(const at of ALLY_TANKS){ const x=toX(at.pos.x), y=toY(at.pos.z); c.save(); c.translate(x,y); c.rotate(Math.atan2(Math.cos(at.facing),Math.sin(at.facing))); c.fillStyle='#9be04a'; c.beginPath(); c.moveTo(4.5,0); c.lineTo(-3,2.8); c.lineTo(-3,-2.8); c.closePath(); c.fill(); c.restore(); }
  if(p){ const x=toX(p.pos.x), y=toY(p.pos.z);                                            // player arrow (facing)
    c.save(); c.translate(x,y); c.rotate(Math.atan2(Math.cos(p.facing),Math.sin(p.facing)));
    c.fillStyle='#bfe66a'; c.beginPath(); c.moveTo(6,0); c.lineTo(-4,3.5); c.lineTo(-4,-3.5); c.closePath(); c.fill(); c.restore(); }
}
