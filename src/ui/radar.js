// ui/radar.js — RADAR / MINIMAP
import { ALLY_TANKS, ARENA, DEPOTS, FORTS, FT, HELOS, OBJ, POWS, RALLY_PT, RELIC, RIDGES, S, SMOKES, SQUADS, boss, core, enemies, fieldOutline, fortSealed, lootBeacons, playerRange } from '../hub.js';
   // grace window so the deploy tap doesn't skip

// ----------------------------- RADAR / MINIMAP -----------------------------
const SQ_COL={ advance:'#ff9a5a', escort:'#ff9a5a', fm:'#ffcf5a', assault:'#ff3a2a', fallback:'#b8e08a' };
export const radarCanvas=document.getElementById('radar'), radarCtx=radarCanvas.getContext('2d');
export function drawRadar(){
  const c=radarCtx, W=radarCanvas.width, H=radarCanvas.height, cx=W/2, cy=H/2;
  const scale=(W/2-7)/ARENA, toX=wx=>cx+wx*scale, toY=wz=>cy+wz*scale;
  c.clearRect(0,0,W,H);
  { c.strokeStyle='rgba(150,220,120,0.11)'; c.lineWidth=1; c.beginPath(); for(let i=1;i<8;i++){ const g=Math.round(W*i/8)+0.5; c.moveTo(g,0); c.lineTo(g,H); c.moveTo(0,g); c.lineTo(W,g); } c.stroke();   // Z228 map grid (8×8 squares)
    c.fillStyle='rgba(170,230,140,0.45)'; c.font='600 '+Math.round(W*0.05)+'px "Share Tech Mono",monospace'; c.textAlign='left'; c.textBaseline='bottom'; for(let i=0;i<8;i++){ c.fillText('ABCDEFGH'[i], W*i/8+2, H-1); c.fillText(String(i+1), 2, W*i/8+W*0.065); }   // grid letters along the bottom, numbers down the side
    c.fillStyle='#ffb84a'; c.beginPath(); c.moveTo(cx,3); c.lineTo(cx+5,12); c.lineTo(cx-5,12); c.closePath(); c.fill(); }   // north mark
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
  for(const f of FORTS){ if(!f.g) continue; const x=toX(f.x), y=toY(f.z), r=Math.max(5, f.R*scale);   // Z107 fortresses: red keep (amber = alerted, blue = sealed citadel, green = ours)
    c.strokeStyle = f.captured?'#9be04a':(fortSealed(f)?'#7fa8ff':(f.active?'#ffb35a':'#ff5a3a')); c.lineWidth=f.tier===3?2.6:2; c.strokeRect(x-r,y-r,r*2,r*2);
    c.fillStyle=c.strokeStyle; c.globalAlpha=f.captured?0.4:0.18; c.fillRect(x-r,y-r,r*2,r*2); c.globalAlpha=1; if(f.ox!=null && !f.breached){ c.fillRect(toX(f.ox)-1.5, toY(f.oz)-1.5, 3, 3); }
    if(f.captured){ c.strokeStyle='#eaffd0'; c.lineWidth=2.2; c.beginPath(); c.moveTo(x-r*0.45,y); c.lineTo(x-r*0.1,y+r*0.4); c.lineTo(x+r*0.5,y-r*0.4); c.stroke(); }   // Z140 ✓ = ours
    else { c.fillStyle=f.leaderless?'#ffcf5a':'#ff5a3a'; c.fillRect(x-0.6,y-r*0.7,1.2,r*1.2); c.beginPath(); c.moveTo(x+0.6,y-r*0.7); c.lineTo(x+r*0.6,y-r*0.5); c.lineTo(x+0.6,y-r*0.3); c.closePath(); c.fill(); } }   // enemy flag still flying (amber = commander dead)
  for(const w of POWS){ if(w.state==='free') continue; const x=toX(w.x), y=toY(w.z); c.strokeStyle=w.state==='open'?'#9be04a':'#ffcf5a'; c.lineWidth=1.6; c.beginPath(); c.moveTo(x,y-4.5); c.lineTo(x+4.5,y); c.lineTo(x,y+4.5); c.lineTo(x-4.5,y); c.closePath(); c.stroke(); }
  for(const d of DEPOTS){ const x=toX(d.x), y=toY(d.z); c.strokeStyle=d.state==='ours'?'#9be04a':(d.state==='open'?'#ffcf5a':'#ff6a4a'); c.lineWidth=1.6; c.strokeRect(x-4,y-4,8,8); if(d.kind==='motor'){ c.fillStyle=c.strokeStyle; c.fillRect(x-1.5,y-1.5,3,3); } }
  for(const h of HELOS){ c.strokeStyle='rgba(255,74,42,0.9)'; c.lineWidth=1.2; c.beginPath(); c.arc(toX(h.dx),toY(h.dz),5,0,Math.PI*2); c.stroke(); }
  if(RELIC.live){ const x=toX(RELIC.x), y=toY(RELIC.z), pl=0.55+0.45*Math.sin(performance.now()/160); c.fillStyle='rgba(255,210,90,'+pl+')'; c.beginPath(); c.moveTo(x,y-6); c.lineTo(x+4.5,y); c.lineTo(x,y+6); c.lineTo(x-4.5,y); c.closePath(); c.fill(); c.strokeStyle='#fff3c8'; c.lineWidth=1; c.stroke(); }   // Z154 the relic: a pulsing gold gem
  for(const sm of SMOKES){ c.fillStyle='rgba(220,220,210,0.28)'; c.beginPath(); c.arc(toX(sm.x),toY(sm.z), Math.max(3, sm.R*scale), 0, Math.PI*2); c.fill(); }   // Z220 smoke screens
  for(const sq of SQUADS){ if(!sq.m.length || !sq.T) continue; let x=0, z=0; for(const e of sq.m){ x+=e.pos.x; z+=e.pos.z; } x/=sq.m.length; z/=sq.m.length;   // Z220 enemy squads: where each one is heading, coloured by its plan
    let a=Math.atan2(sq.T.pos.x-x, sq.T.pos.z-z); if(sq.state==='fallback') a+=Math.PI; else if(sq.state==='fm') a+=(sq.flank||0)*(sq.flankA||0)*0.6;
    const col=SQ_COL[sq.state]||'#ff9a5a', X=toX(x), Y=toY(z), ux=Math.sin(a), uz=Math.cos(a);
    c.strokeStyle=col; c.fillStyle=col; c.lineWidth=1.4; c.globalAlpha=0.9; c.beginPath(); c.moveTo(X,Y); c.lineTo(X+ux*9,Y+uz*9); c.stroke();
    c.beginPath(); c.moveTo(X+ux*12,Y+uz*12); c.lineTo(X+ux*7-uz*3,Y+uz*7+ux*3); c.lineTo(X+ux*7+uz*3,Y+uz*7-ux*3); c.closePath(); c.fill(); c.globalAlpha=1; }
  c.fillStyle='#9be04a'; for(const a of FT) c.fillRect(toX(a.pos.x)-1, toY(a.pos.z)-1, 2.5, 2.5);
  for(const at of ALLY_TANKS){ const x=toX(at.pos.x), y=toY(at.pos.z); c.save(); c.translate(x,y); c.rotate(Math.atan2(Math.cos(at.facing),Math.sin(at.facing))); c.fillStyle='#9be04a'; c.beginPath(); c.moveTo(4.5,0); c.lineTo(-3,2.8); c.lineTo(-3,-2.8); c.closePath(); c.fill(); c.restore(); }
  if(p){ const x=toX(p.pos.x), y=toY(p.pos.z);                                            // player arrow (facing)
    c.save(); c.translate(x,y); c.rotate(Math.atan2(Math.cos(p.facing),Math.sin(p.facing)));
    c.fillStyle='#bfe66a'; c.beginPath(); c.moveTo(6,0); c.lineTo(-4,3.5); c.lineTo(-4,-3.5); c.closePath(); c.fill(); c.restore(); }
}
