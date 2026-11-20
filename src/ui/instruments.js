// ui/instruments.js — Z228 the commander's instrument panel (desktop HUD, bottom-right): what a real tank commander reads at a glance —
//   a north-up azimuth dial with the hull and the turret drawn on it (hull tinted by its condition), the heading in degrees,
//   ground speed, the laser rangefinder's distance to whatever the gun is laid on, and the armour state.
//   Plus the radio set's typewriter (a message arrives character by character, like a teleprinter) and the frequency/callsign line.
import { BLIGHT } from '../../config.js';
import { MOBILE, S, boss, enemies, MODE } from '../hub.js';

const DEG=180/Math.PI, TAU=Math.PI*2;
export const INSTR={ el:null, cv:null, cx:null, hdg:null, spd:null, rng:null, arm:null, armBar:null, at:0, range:-1, rangeAt:0 };
export function headingDeg(f){ return ((Math.atan2(Math.sin(f), -Math.cos(f))*DEG)+360)%360; }   // north = −z on the map, clockwise
const pad=(n,w)=>String(Math.max(0,Math.round(n))).padStart(w,'0');

function build(){ const hud=document.getElementById('hud'); if(!hud) return false;
  const el=document.createElement('div'); el.id='instr'; el.className='hidden';
  el.innerHTML='<canvas class="in-dial" width="232" height="232"></canvas><div class="in-rd">'
    +'<div class="in-row"><span>HƯỚNG</span><b class="in-hdg">000°</b></div>'
    +'<div class="in-row"><span>TỐC ĐỘ</span><b class="in-spd">00</b><em>km/h</em></div>'
    +'<div class="in-row"><span>CỰ LY</span><b class="in-rng">----</b><em>m</em></div>'
    +'<div class="in-row in-a"><span>GIÁP</span><b class="in-arm">100</b><em>%</em></div><div class="in-bar"><i></i></div></div>';
  hud.appendChild(el); INSTR.el=el; INSTR.cv=el.querySelector('canvas'); INSTR.cx=INSTR.cv.getContext('2d');
  INSTR.hdg=el.querySelector('.in-hdg'); INSTR.spd=el.querySelector('.in-spd'); INSTR.rng=el.querySelector('.in-rng'); INSTR.arm=el.querySelector('.in-arm'); INSTR.armBar=el.querySelector('.in-bar i');
  return true; }

// the rangefinder: the nearest enemy within a narrow cone along the gun line (what a laser on the gun would hit first)
function laze(p){ const a=p.aimSmoothed??p.facing??0, ux=Math.sin(a), uz=Math.cos(a); let best=-1;
  const test=(x,z)=>{ const dx=x-p.pos.x, dz=z-p.pos.z, along=dx*ux+dz*uz; if(along<2 || along>400) return; const off=Math.abs(dx*uz-dz*ux); if(off>Math.max(2.2, along*0.06)) return; if(best<0 || along<best) best=along; };
  for(const e of enemies) if(!e.dead) test(e.pos.x, e.pos.z);
  if(boss && boss.alive) test(boss.pos.x, boss.pos.z);
  return best; }

function dial(p, k){ const c=INSTR.cx, W=INSTR.cv.width, R=W/2, cx=R, cy=R; c.clearRect(0,0,W,W);
  c.save(); c.translate(cx,cy);
  const g=c.createRadialGradient(0,0,R*0.2,0,0,R); g.addColorStop(0,'rgba(20,30,18,0.92)'); g.addColorStop(1,'rgba(6,10,6,0.96)'); c.fillStyle=g; c.beginPath(); c.arc(0,0,R-2,0,TAU); c.fill();
  c.strokeStyle='rgba(150,220,120,0.10)'; c.lineWidth=1; for(const r of [0.36,0.6]){ c.beginPath(); c.arc(0,0,R*r,0,TAU); c.stroke(); }   // range rings
  c.beginPath(); c.moveTo(-R+10,0); c.lineTo(R-10,0); c.moveTo(0,-R+10); c.lineTo(0,R-10); c.stroke();
  for(let d=0; d<360; d+=5){ const a=d/DEG, big=d%30===0, r0=R-(big?16:d%10===0?11:8), r1=R-5; c.strokeStyle=big?'rgba(190,240,150,0.85)':'rgba(150,210,120,0.45)'; c.lineWidth=big?2.4:1.2;
    c.beginPath(); c.moveTo(Math.sin(a)*r0, -Math.cos(a)*r0); c.lineTo(Math.sin(a)*r1, -Math.cos(a)*r1); c.stroke(); }
  c.font='700 19px "Share Tech Mono",monospace'; c.textAlign='center'; c.textBaseline='middle';
  for(const [d,t] of [[0,'B'],[90,'Đ'],[180,'N'],[270,'T']]){ const a=d/DEG, r=R-30; c.fillStyle=d===0?'#ffb84a':'rgba(200,240,170,0.9)'; c.fillText(t, Math.sin(a)*r, -Math.cos(a)*r); }
  if(MODE.id!=='tank'){ man(c, p, k, R); return; }   // Z307 a soldier on the dial: a man and his rifle, not a hull and a turret
  // hull (rotates with the tank's heading), tinted by its condition
  const col = k>0.6 ? '#8fd468' : k>0.3 ? '#ffc24e' : '#ff5a3a', hf=headingDeg(p.facing||0)/DEG, tf=headingDeg(p.aimSmoothed??p.facing??0)/DEG;
  c.save(); c.rotate(hf); c.fillStyle='rgba(0,0,0,0.35)'; c.fillRect(-22,-36,44,72);
  c.strokeStyle=col; c.lineWidth=2.4; c.strokeRect(-20,-34,40,68);                                   // hull outline
  c.fillStyle=col; c.globalAlpha=0.28; c.fillRect(-20,-34,40,68); c.globalAlpha=1;
  c.fillStyle=col; c.fillRect(-26,-36,6,72); c.fillRect(20,-36,6,72);                                 // tracks
  c.beginPath(); c.moveTo(-10,-34); c.lineTo(0,-44); c.lineTo(10,-34); c.closePath(); c.fill();       // bow mark
  c.restore();
  c.save(); c.rotate(tf); c.strokeStyle='#e8ffd8'; c.fillStyle='rgba(232,255,216,0.18)'; c.lineWidth=2.2;
  c.beginPath(); c.arc(0,0,13,0,TAU); c.fill(); c.stroke();                                          // turret
  c.lineWidth=4; c.beginPath(); c.moveTo(0,-13); c.lineTo(0,-R+22); c.stroke();                      // gun
  c.setLineDash([4,5]); c.lineWidth=1.2; c.strokeStyle='rgba(255,184,74,0.7)'; c.beginPath(); c.moveTo(0,-R+22); c.lineTo(0,-R+6); c.stroke(); c.setLineDash([]);
  c.restore();
  c.restore(); }

// Z307 the soldier on the dial: a dot for the man (tinted by his health) and his rifle along the aim
function man(c, p, k, R){ const col = k>0.6 ? '#8fd468' : k>0.3 ? '#ffc24e' : '#ff5a3a', tf=headingDeg(p.aimSmoothed??p.facing??0)/DEG;
  c.save(); c.rotate(tf); c.fillStyle=col; c.strokeStyle='#e8ffd8'; c.lineWidth=2; c.beginPath(); c.arc(0,0,9,0,TAU); c.fill(); c.stroke();
  c.lineWidth=3; c.beginPath(); c.moveTo(0,-9); c.lineTo(0,-R+22); c.stroke(); c.setLineDash([4,5]); c.lineWidth=1.2; c.strokeStyle='rgba(255,184,74,0.7)'; c.beginPath(); c.moveTo(0,-R+22); c.lineTo(0,-R+6); c.stroke(); c.setLineDash([]);
  c.restore(); c.restore(); }
export function updateInstr(now){
  { const p=S.player, low=S.mode==='playing' && !!p && p.hp>0 && p.hp/(p.maxHp||1)<=BLIGHT.hpCrit; if(low!==INSTR.low){ INSTR.low=low; document.body.classList.toggle('hpcrit', low); } }   // Z318 our health low: the slow red edge glow (css/battle-light.css), on phones too
  if(MOBILE) return; if(!INSTR.el && !build()) return;
  const p=S.player, show=S.mode==='playing' && !!p;
  INSTR.el.classList.toggle('hidden', !show); if(!show || now<INSTR.at) return; INSTR.at=now+1/15;   // 15 Hz is plenty for a gauge
  const k=Math.max(0, Math.min(1, p.hp/(p.maxHp||1))), v=p.vel ? Math.hypot(p.vel.x, p.vel.z) : 0;
  if(now>INSTR.rangeAt){ INSTR.rangeAt=now+0.2; INSTR.range=laze(p); }
  INSTR.hdg.textContent=pad(headingDeg(p.aimSmoothed??p.facing??0),3)+'°';
  INSTR.spd.textContent=pad(v*3.6,2);
  INSTR.rng.textContent = INSTR.range<0 ? '----' : pad(INSTR.range,4);
  INSTR.rng.parentElement.classList.toggle('lz', INSTR.range>=0);
  INSTR.arm.textContent=Math.round(k*100); INSTR.armBar.style.width=(k*100)+'%'; { const L=INSTR.arm.previousElementSibling, t=MODE.id==='tank'?'GIÁP':'MÁU'; if(L && L.textContent!==t) L.textContent=t; }   // Z307 a man's health, not armour
  INSTR.el.classList.toggle('warn', k<=0.6 && k>0.3); INSTR.el.classList.toggle('crit', k<=0.3);
  dial(p, k); }

// ---- the radio set: frequency + callsign header, the message typed out like a teleprinter ----
const NETS=[['SCH','46.250'],['PHÁO BINH','41.775'],['TÌNH BÁO','49.100'],['TRINH SÁT','44.525'],['BỘ BINH','38.900']];
export function radioNet(msg){ const m=/^([A-ZÀ-Ỹ ]{2,12}):/u.exec(msg||''); const tag=m ? m[1].trim() : 'SCH'; const n=NETS.find(x=>x[0]===tag) || [tag, '46.250']; return { tag:n[0], mhz:n[1], body: m ? msg.slice(m[0].length).trim() : msg }; }
export function radioType(el, msg){ const R=radioNet(msg), tx=el.querySelector('.rd-txt'), tg=el.querySelector('.rd-tag'), fq=el.querySelector('.rd-fq');
  if(tg) tg.textContent=R.tag; if(fq) fq.textContent=R.mhz+' MHz';
  clearInterval(radioType._t); let i=0; const s=R.body; tx.textContent='';
  if(MOBILE){ tx.textContent=s; return; }
  radioType._t=setInterval(()=>{ i=Math.min(s.length, i+3); tx.textContent=s.slice(0,i); if(i>=s.length) clearInterval(radioType._t); }, 16); }
