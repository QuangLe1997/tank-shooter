// ui/padview.js — Z125 CONTROLLER DIAGRAM: a shaded (pseudo-3D) gamepad drawn in SVG with a label on every control showing what it does RIGHT NOW
//   (read from the binding table, so it follows rebinding). Used in the key sheet, in Settings → Tay cầm and in the layout wizard, where the control being asked for pulses.
//   While it is on screen the real pad drives it: pressed buttons light up, the sticks move.
import { ACTIONS } from '../../config.js';
import { PAD, WIZ, escapeHtml, padFor } from '../hub.js';

const esc=escapeHtml; let _n=0;
const FACE={ 0:['A','#5fbf3a'], 1:['B','#e05243'], 2:['X','#4a8fe0'], 3:['Y','#e9bd2f'] };
// every action bound to pad button b → short names ("Bắn (giữ = liên thanh) · chuột trái" → "Bắn"); a hold hint ("giữ: gọi về") rides along
function fnOf(b){ const t=[]; let h=''; for(const a of ACTIONS){ if(padFor(a[0])!==b) continue; const p=a[1].split(' · '); t.push(p[0].replace(/\s*\(.*?\)/g,'').trim()); if(p[1] && /^giữ/.test(p[1])) h=p[1]; } return { t:t.join(' / '), h }; }
function lab(left, y, tag, f, sub, lb){ const x=left?130:750, anc=left?'end':'start', k='<tspan class="pv-k">'+esc(tag)+'</tspan>', main=f.t ? esc(f.t) : '<tspan class="pv-n">—</tspan>';
  let s='<text class="pv-t" x="'+x+'" y="'+y+'" text-anchor="'+anc+'"'+(lb!=null?' data-lb="'+lb+'"':'')+'>'+(left ? main+' '+k : k+' '+main)+'</text>';
  const sb=[].concat(sub||[], f.h||[]).filter(Boolean); sb.forEach((t,i)=>{ s+='<text class="pv-s" x="'+x+'" y="'+(y+19+i*17)+'" text-anchor="'+anc+'">'+esc(t)+'</text>'; });
  return s; }
const ld=(d,cx,cy)=>'<path class="pv-ld" d="'+d+'"/><circle class="pv-dot" cx="'+cx+'" cy="'+cy+'" r="3"/>';
const face=(b,x,y)=>'<g class="pv-b" data-b="'+b+'"><circle cx="'+x+'" cy="'+y+'" r="16" fill="'+FACE[b][1]+'" stroke="#0b0d0a" stroke-width="2"/><circle cx="'+x+'" cy="'+y+'" r="16" fill="url(#SH)"/><text class="pv-f" x="'+x+'" y="'+(y+5.5)+'" text-anchor="middle">'+FACE[b][0]+'</text></g>';
const stick=(ax,b,x,y)=>'<g data-ax="'+ax+'"><circle cx="'+x+'" cy="'+y+'" r="37" fill="#0f120e" stroke="#3b4333" stroke-width="3"/><g class="pv-cap pv-b" data-b="'+b+'" data-cx="'+x+'" data-cy="'+y+'" transform="translate('+x+' '+y+')"><circle r="27" fill="url(#CAP)" stroke="#0b0d0a" stroke-width="2"/><circle r="18" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/><circle r="9" fill="#000" fill-opacity=".18"/></g></g>';
const arm=(b,x,y,w,h)=>'<rect class="pv-b" data-b="'+b+'" x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="4" fill="#2f362a" stroke="#5a654c" stroke-width="2"/>';

export function padDiagram(bare){ const u='pv'+(++_n), F=b=>fnOf(b);
  const defs='<defs><linearGradient id="BODY" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4d5543"/><stop offset=".55" stop-color="#2c3226"/><stop offset="1" stop-color="#171a14"/></linearGradient>'+
    '<linearGradient id="RIM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a9578"/><stop offset="1" stop-color="#1c2018"/></linearGradient>'+
    '<linearGradient id="TG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#596150"/><stop offset="1" stop-color="#21261c"/></linearGradient>'+
    '<radialGradient id="CAP" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#7b8470"/><stop offset="1" stop-color="#20251c"/></radialGradient>'+
    '<radialGradient id="SH" cx=".35" cy=".28" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>'+
    '<filter id="DROP" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#000" flood-opacity=".55"/></filter></defs>';
  const BODY='M300 105 C340 92 540 92 580 105 C640 112 690 200 700 300 C705 350 680 385 645 380 C615 376 600 345 560 330 C520 322 360 322 320 330 C280 345 265 376 235 380 C200 385 175 350 180 300 C190 200 240 112 300 105Z';
  let g='<g class="pv-shoulder">'+
    '<rect class="pv-b" data-b="6" x="268" y="38" width="84" height="34" rx="13" fill="url(#TG)" stroke="#0b0d0a" stroke-width="2"/><rect class="pv-b" data-b="7" x="528" y="38" width="84" height="34" rx="13" fill="url(#TG)" stroke="#0b0d0a" stroke-width="2"/>'+
    '<rect class="pv-b" data-b="4" x="250" y="74" width="130" height="26" rx="12" fill="url(#TG)" stroke="#0b0d0a" stroke-width="2"/><rect class="pv-b" data-b="5" x="500" y="74" width="130" height="26" rx="12" fill="url(#TG)" stroke="#0b0d0a" stroke-width="2"/></g>'+
    '<path d="'+BODY+'" fill="url(#BODY)" stroke="url(#RIM)" stroke-width="3" filter="url(#DROP)"/>'+
    '<path d="M300 105 C340 92 540 92 580 105 C540 124 340 124 300 105Z" fill="#fff" fill-opacity=".09"/>'+
    '<circle cx="440" cy="150" r="15" fill="#0f120e" stroke="#4a5340" stroke-width="2"/><circle cx="440" cy="150" r="8" fill="#9be04a" fill-opacity=".5"/>'+
    '<g class="pv-b" data-b="8"><circle cx="398" cy="196" r="9" fill="#232920" stroke="#566049" stroke-width="2"/><rect x="393" y="192" width="7" height="6" fill="none" stroke="#cfd8c0" stroke-width="1.4"/><rect x="396" y="195" width="7" height="6" fill="#232920" stroke="#cfd8c0" stroke-width="1.4"/></g>'+
    '<g class="pv-b" data-b="9"><circle cx="482" cy="196" r="9" fill="#232920" stroke="#566049" stroke-width="2"/><path d="M476.5 192.5h11M476.5 196h11M476.5 199.5h11" stroke="#cfd8c0" stroke-width="1.6"/></g>'+
    stick('l',10,300,192)+
    '<circle cx="355" cy="278" r="38" fill="#0f120e" stroke="#3b4333" stroke-width="3"/>'+arm(12,344,250,22,30)+arm(13,344,278,22,30)+arm(14,327,267,30,22)+arm(15,355,267,30,22)+'<circle cx="355" cy="278" r="7" fill="#1a1e16"/>'+
    '<circle cx="580" cy="192" r="52" fill="#0f120e" stroke="#3b4333" stroke-width="3"/>'+face(3,580,158)+face(1,614,192)+face(2,546,192)+face(0,580,226)+
    stick('r',11,525,278);
  const dp=[[12,'↑'],[13,'↓'],[14,'←'],[15,'→']].map(([b,a],i)=>lab(true, 266+i*23, a, F(b), '', b)).join('');
  g+=ld('M268 56 H140',268,56)+lab(true,60,'LT',F(6),'',6)+
     ld('M250 87 H140',250,87)+lab(true,91,'LB',F(4),'',4)+
     ld('M263 192 H140',263,192)+lab(true,184,'CẦN TRÁI',{ t:'Lái xe' },['nghiêng nửa = nửa ga', F(10).t ? 'nhấn L3: '+F(10).t : ''],10)+
     ld('M317 278 H150 V292 H140',317,278)+dp+'<text class="pv-s" x="130" y="364" text-anchor="end">giữ ⧉ + D-pad: zoom / xoay camera</text>'+
     ld('M612 56 H740',612,56)+lab(false,60,'RT',F(7),'',7)+
     ld('M630 87 H740',630,87)+lab(false,91,'RB',F(5),'',5)+
     ld('M546 176 V118 H740',546,176)+lab(false,122,'X',F(2),'',2)+
     ld('M596 158 H740',596,158)+lab(false,162,'Y',F(3),'',3)+
     ld('M630 192 H740',630,192)+lab(false,190,'B',F(1),'',1)+
     ld('M596 226 H740',596,226)+lab(false,234,'A',F(0),'',0)+
     ld('M562 278 H740',562,278)+lab(false,274,'CẦN PHẢI',{ t:'Xoay nòng' },['thả ra: tự ngắm địch gần nhất', F(11).t ? 'nhấn R3: '+F(11).t : ''],11)+
     ld('M398 205 V404',398,205)+lab(true,420,'⧉ View',F(8),'',8)+
     ld('M482 205 V404',482,205)+lab(false,420,'☰ Menu',F(9),'',9);
  const svg='<svg class="pad-svg'+(bare?' bare':'')+'" viewBox="'+(bare?'340 20 560 380':'0 0 1240 448')+'" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ tay cầm">'+defs+'<g transform="translate(180 0)">'+g+'</g></svg>';
  return svg.replace(/#(BODY|RIM|TG|CAP|SH|DROP)\b/g, '#'+u+'$1').replace(/id="(BODY|RIM|TG|CAP|SH|DROP)"/g, 'id="'+u+'$1"'); }

// live view: pressed buttons light up, sticks move, the wizard's current target pulses (one shared timer; only touches diagrams that are on screen)
function tick(){ const L=document.querySelectorAll('.pad-svg'); if(!L.length) return; const cur=PAD.prev||[], live=PAD.active && !WIZ.on, tg=WIZ.on ? WIZ.tgt : null;
  for(const s of L){ if(!s.getClientRects().length) continue;
    s.querySelectorAll('[data-b]').forEach(e=>{ const b=+e.dataset.b, on=live && !!cur[b]; e.classList.toggle('on', on); e.classList.toggle('tgt', tg===b); });
    s.querySelectorAll('[data-lb]').forEach(e=>e.classList.toggle('on', live && !!cur[+e.dataset.lb]));
    s.querySelectorAll('[data-ax]').forEach(g=>{ const l=g.dataset.ax==='l', ax=l?PAD.lx:PAD.rx, ay=l?PAD.ly:PAD.ry, c=g.querySelector('.pv-cap'); if(!c) return;
      c.setAttribute('transform','translate('+((+c.dataset.cx)+(live?(ax||0)*9:0))+' '+((+c.dataset.cy)+(live?(ay||0)*9:0))+')');
      const want = tg==='lx'||tg==='ly' ? 'l' : tg==='rx'||tg==='ry' ? 'r' : ''; c.classList.toggle('tgt', want===g.dataset.ax || tg===+c.dataset.b); }); } }
setInterval(tick, 60);
