// input/padmap.js — Z123 LEARN A PAD'S LAYOUT. Over USB on a Mac (and for many DInput pads) the browser hands back a GENERIC HID pad with
//   mapping '' — its buttons and axes come in an arbitrary order, so the "standard" positions the game reads would be wrong or dead.
//   The wizard asks for each control in turn, records which raw button / axis moved, and keeps the table per pad id (PROFILE.padmap).
//   input/gamepad.js then reads such a pad through virtualPad(), so everything else in the game still sees a standard layout.
import { PAD, PROFILE, hide, padDiagram, saveProfile, sfx, show, tapBtn } from '../hub.js';

// target = 'lx'|'ly'|'rx'|'ry' (stick axes, positive = right / down) or the standard button index the game uses (see BT in gamepad.js)
const STEPS=[ ['lx','CẦN TRÁI — gạt sang PHẢI'], ['ly','CẦN TRÁI — gạt xuống DƯỚI'], ['rx','CẦN PHẢI — gạt sang PHẢI'], ['ry','CẦN PHẢI — gạt xuống DƯỚI'],
  [7,'Bóp cò PHẢI (RT) — nút bắn'], [6,'Bóp cò TRÁI (LT)'], [0,'Nút A (nút dưới)'], [1,'Nút B (nút phải)'], [2,'Nút X (nút trái)'], [3,'Nút Y (nút trên)'],
  [4,'Nút vai trái (LB)'], [5,'Nút vai phải (RB)'], [9,'Nút ☰ Menu (Start)'], [8,'Nút ⧉ View (Select)'], [10,'Nhấn cần TRÁI xuống (L3)'], [11,'Nhấn cần PHẢI xuống (R3)'],
  [12,'D-pad ↑'], [13,'D-pad ↓'], [14,'D-pad ←'], [15,'D-pad →'] ];
const SKIP_AFTER=10;                                                       // seconds without input → that control is skipped
export const WIZ={ tgt:null, on:false, i:0, map:null, base:null, rel:false, at:0 };

const bv=(gp,i)=>{ const b=gp.buttons[i]; return b ? (typeof b==='object' ? b.value : b) : 0; };
const snap=gp=>({ a:Array.from(gp.axes), b:Array.from(gp.buttons, (_,i)=>bv(gp,i)) });
// one learned source → 0..1 (buttons, triggers, hat-switch directions) or -1..1 (stick axes)
export function readSrc(gp, s){ if(!s) return 0;
  if(s.t==='b') return bv(gp, s.i);
  const v=gp.axes[s.i]; if(v===undefined) return 0;
  if(s.t==='h') return Math.abs(v-s.p)<0.14 ? 1 : 0;
  return Math.max(-1, Math.min(1, (v-s.r)*s.s/(s.span||1))); }
export function padMapFor(gp){ if(!gp || gp.mapping==='standard') return null; const m=PROFILE.padmap; return (m && m[gp.id]) || null; }
// the pad as a standard-layout object: axes [lx,ly,rx,ry] + 17 buttons {value, pressed}
export function virtualPad(gp, M){ const A=M.ax||{}, B=M.bt||{}, ax=['lx','ly','rx','ry'].map(k=>readSrc(gp, A[k])), bt=[];
  for(let i=0;i<17;i++){ const v=Math.max(0, readSrc(gp, B[i])); bt[i]={ value:v, pressed:v>0.5 }; }
  return { axes:ax, buttons:bt }; }

function quiet(gp, base){ for(let i=0;i<gp.buttons.length;i++) if(bv(gp,i) > Math.max(0.3, (base.b[i]||0)+0.3)) return false;
  for(let i=0;i<gp.axes.length;i++) if(Math.abs(gp.axes[i]-(base.a[i]||0))>0.25) return false; return true; }
function detect(gp, base, tgt){ const stick=typeof tgt==='string';
  if(!stick) for(let i=0;i<gp.buttons.length;i++) if(bv(gp,i)>0.6 && (base.b[i]||0)<0.3) return { t:'b', i };
  let bi=-1, bd=0; for(let i=0;i<gp.axes.length;i++){ const d=gp.axes[i]-(base.a[i]||0); if(Math.abs(d)>Math.abs(bd)){ bd=d; bi=i; } }
  if(bi<0 || Math.abs(bd)<(stick ? 0.55 : tgt>=12 ? 0.4 : 0.6)) return null; const r=base.a[bi], p=gp.axes[bi];   // hat levels sit close together (← is only 0.57 from rest)
  if(stick) return { t:'a', i:bi, r, s:Math.sign(bd), span:1 };
  if(tgt>=12) return { t:'h', i:bi, p };                                   // a hat-switch D-pad reports each direction as a distinct axis level
  return { t:'a', i:bi, r, s:Math.sign(bd), span:r<=-0.9 ? 2 : 1 }; }      // a trigger axis resting at -1 runs -1…1
function taken(src){ const M=WIZ.map, L=[...Object.values(M.ax), ...Object.values(M.bt)];
  return L.some(e=>e.t===src.t && e.i===src.i && (src.t==='b' || (src.t==='h' ? Math.abs(e.p-src.p)<0.14 : e.s===src.s))); }

const $=id=>document.getElementById(id), nm=s=>(s||'').replace(/\(.*?\)/g,'').trim();
function paint(gp){ const st=STEPS[WIZ.i], t=$('padWizStep'); if(!t) return; WIZ.tgt = st ? st[0] : null;
  t.textContent = st ? (WIZ.rel ? 'Thả ra…' : st[1]) : 'Xong!'; const n=$('padWizN'); if(n) n.textContent = Math.min(WIZ.i+1, STEPS.length)+' / '+STEPS.length;
  const bar=$('padWizBar'); if(bar) bar.style.width = (100*WIZ.i/STEPS.length)+'%';
  const id=$('padWizId'); if(id) id.textContent = gp ? nm(gp.id).slice(0,40)+' · '+gp.buttons.length+' nút · '+gp.axes.length+' trục'+(gp.mapping?' · '+gp.mapping:' · bố cục lạ') : 'Chưa thấy tay cầm — bấm một nút bất kỳ trên tay cầm (cần có focus cửa sổ game)'; }
function live(gp, base){ const el=$('padWizLive'); if(!el) return; if(!gp){ el.textContent=''; return; } const L=[];
  for(let i=0;i<gp.buttons.length;i++) if(bv(gp,i)>0.5) L.push('nút '+i);
  for(let i=0;i<gp.axes.length;i++){ const d=gp.axes[i]-((base&&base.a[i])||0); if(Math.abs(d)>0.4) L.push('trục '+i+' '+(gp.axes[i]>=0?'+':'')+gp.axes[i].toFixed(2)); }
  el.textContent = L.length ? 'Đang nhận: '+L.join(' · ') : 'Chưa nhận nút nào'; }

export function openPadWizard(gp){ WIZ.on=true; WIZ.i=0; WIZ.map={ ax:{}, bt:{} }; WIZ.base=null; WIZ.rel=false; WIZ.at=performance.now()/1000;
  { const v=$('padWizView'); if(v) v.innerHTML=padDiagram(true); }
  show('padWiz'); paint(gp||null); sfx('click'); }
function finish(save){ const M=WIZ.map; WIZ.on=false; WIZ.tgt=null; hide('padWiz');
  const n=Object.keys(M.ax).length+Object.keys(M.bt).length; const gp=PAD.gp; if(save && gp && n>=3){ (PROFILE.padmap||(PROFILE.padmap={}))[gp.id]=M; saveProfile(); }
  PAD.prev=[]; refresh(); }
function refresh(){ dispatchEvent(new CustomEvent('padmapchange')); }
export function resetPadMap(gp){ const m=PROFILE.padmap, g=gp||PAD.gp; if(m && g && m[g.id]){ delete m[g.id]; saveProfile(); } refresh(); }
function skip(now){ WIZ.i++; WIZ.rel=false; WIZ.base=null; WIZ.at=now; }
// called from pollGamepad every frame while the wizard is open (gp may be null: no pad seen yet)
export function wizPoll(gp, now){ if(!WIZ.on) return; paint(gp); if(!gp){ live(null); return; }
  if(!WIZ.base) { WIZ.base=snap(gp); WIZ.at=now; }
  if(WIZ.i>=STEPS.length){ finish(true); return; }
  if(WIZ.rel){ live(gp, WIZ.base); if(quiet(gp, WIZ.base)){ WIZ.rel=false; WIZ.base=snap(gp); WIZ.at=now; } return; }
  live(gp, WIZ.base);
  const st=STEPS[WIZ.i], src=detect(gp, WIZ.base, st[0]);
  if(src && !taken(src)){ if(typeof st[0]==='string') WIZ.map.ax[st[0]]=src; else WIZ.map.bt[st[0]]=src; sfx('click'); WIZ.i++; WIZ.rel=true; return; }
  if(now-WIZ.at>SKIP_AFTER) skip(now); }

tapBtn('padWizSkip', ()=>{ if(WIZ.on){ skip(performance.now()/1000); sfx('click'); } });
tapBtn('padWizDone', ()=>{ if(WIZ.on) finish(true); });
tapBtn('padWizReset', ()=>{ if(WIZ.on){ finish(false); resetPadMap(PAD.gp); sfx('click'); } });
tapBtn('padWizClose', ()=>{ if(WIZ.on){ finish(false); sfx('click'); } });
