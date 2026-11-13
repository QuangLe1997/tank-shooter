// fx/celebrate.js — Z140 VICTORY CELEBRATION: a fort taken or a battle won — fireworks over the field, every soldier of ours leaps and cheers
//   (arms up), our flags whip in the wind, a fanfare. 'fort' = a short local party over the captured fort; 'victory' = the whole army, 6 s.
import { FT, S, playClip, radio, riders, sfx, showBanner, soldiers, spawnPart } from '../hub.js';

export const CEL = { until:0, t0:0, kind:'', x:0, z:0, fwAt:0, chAt:0 };
const COLS=[0xffd24a, 0xda251d, 0x9be04a, 0x7fd0ff, 0xffffff, 0xff8a3a];
export function celebrate(kind, x, z){ const now=performance.now()/1000; Object.assign(CEL, { kind, x:x||0, z:z||0, t0:now, until:now+(kind==='victory'?6.5:3.6), fwAt:0, chAt:0 });
  sfx('levelup'); setTimeout(()=>sfx('powerup'), 350);
  if(kind==='victory'){ playClip('x_cheer', 0.85); showBanner('CHIẾN THẮNG!  TOÀN QUÂN REO HÒ', '#ffd24a'); radio('SCH: Chiến thắng! Cờ đã cắm — toàn quân ăn mừng!'); } }   // Z167 the whole army cheers
function firework(x, y, z){ const c=COLS[(Math.random()*COLS.length)|0], c2=COLS[(Math.random()*COLS.length)|0], n=22+((Math.random()*14)|0);
  for(let i=0;i<n;i++){ const a=Math.random()*6.283, b=Math.acos(2*Math.random()-1), sp=9+Math.random()*6;
    spawnPart(x, y, z, Math.sin(b)*Math.cos(a)*sp, Math.cos(b)*sp, Math.sin(b)*Math.sin(a)*sp, { tex:'flash', color:i%3?c:c2, size:0.55+Math.random()*0.35, life:0.9+Math.random()*0.5, grav:-7, drag:1.6 }); }
  spawnPart(x, y, z, 0, 0, 0, { tex:'flash', color:0xffffff, size:5, life:0.14, grav:0, drag:0 }); }
// soldiers: a hop + arms thrown up; called AFTER their own update so the hop rides on top of their pose
function cheer(g, t, ph){ if(!g || !g.visible) return; const h=Math.abs(Math.sin(t*8+ph))*0.55; g.position.y+=h; const u=g.userData;
  if(u && u.arms) u.arms.rotation.x=-2.2-Math.sin(t*8+ph)*0.4; }   // rifles thrown up in the air
export function updateCelebration(dt, now){ if(now>CEL.until) return; const t=now-CEL.t0, big=CEL.kind==='victory';
  if(now>CEL.fwAt){ CEL.fwAt=now+(big?0.28:0.55); const p=S.player, cx=big&&p?p.pos.x:CEL.x, cz=big&&p?p.pos.z:CEL.z, R=big?30:16;
    firework(cx+(Math.random()-0.5)*R*2, 14+Math.random()*10, cz+(Math.random()-0.5)*R*2);
    spawnPart(cx+(Math.random()-0.5)*R, 1, cz+(Math.random()-0.5)*R, (Math.random()-0.5)*2, 22, (Math.random()-0.5)*2, { tex:'flash', color:0xffe0a0, size:0.5, life:0.6, grav:-14, drag:0.4 }); }   // a rocket going up
  if(now>CEL.chAt){ CEL.chAt=now+0.9; sfx('wave', null, 0.4); }
  const L=[]; for(const a of FT) L.push(a.g); for(const s of soldiers) L.push(s.g); if(big) for(const r of riders) L.push(r.g);
  L.forEach((g,i)=>{ if(big || !g || Math.hypot(g.position.x-CEL.x, g.position.z-CEL.z)<60) cheer(g, t, i*0.9); }); }
