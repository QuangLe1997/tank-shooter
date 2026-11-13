// ui/ranking.js — Z163 BẢNG XẾP HẠNG: this week's and all-time best runs (lb/{uid}, lbw/{week}/e/{uid} — written only by the server), your own row and rank
import { CLOUDSAVE, TANK_MODELS, cloudFB, escapeHtml, hide, initCloud, sfx, show, tapBtn, tapEl } from '../hub.js';

export const RANK = { tab:'week', from:'start', cache:{} };
// same week key as the server (Vietnam time, ISO week)
export function rankWeek(ms){ const d=new Date((ms||Date.now())+7*3600e3); const day=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-day+3);
  const y=d.getUTCFullYear(), w1=new Date(Date.UTC(y,0,4)), wk=1+Math.round(((d-w1)/864e5-3+((w1.getUTCDay()+6)%7))/7); return y+'-W'+String(wk).padStart(2,'0'); }
const lvlTxt=l=>l>0 ? 'MÀN '+l : '';
function row(i, r, me){ const M=TANK_MODELS[r.tank], d=document.createElement('div'); d.className='rk-row'+(i<3?' top'+(i+1):'')+(me?' me':'');
  d.innerHTML='<div class="rk-n">'+(i+1)+'</div><div class="rk-nm">'+escapeHtml(r.name||'?')+'<small>'+escapeHtml(M?M.name:'')+'</small></div><div class="rk-lv">'+lvlTxt(r.level|0)+'</div><div class="rk-sc">'+(r.score|0).toLocaleString('vi-VN')+'</div>'; return d; }
function msg(t){ const b=document.getElementById('rankBody'); if(b) b.innerHTML='<div class="rk-msg">'+escapeHtml(t)+'</div>'; }
export async function renderRanking(){ document.querySelectorAll('#ranking .rank-tab').forEach(t=>t.classList.toggle('on', t.dataset.rt===RANK.tab));
  const wk=rankWeek(), wl=document.getElementById('rankWeek'); if(wl) wl.textContent = RANK.tab==='week' ? 'TUẦN '+wk.split('-W')[1]+' · '+wk.split('-')[0] : 'TẤT CẢ CÁC MÙA';
  const F=cloudFB(); if(!F || !CLOUDSAVE.uid){ msg(navigator.onLine===false ? 'Cần kết nối mạng để xem bảng xếp hạng.' : 'Đang kết nối máy chủ…'); if(!F) initCloud(); return; }
  msg('Đang tải…'); const { FS, db }=F, tab=RANK.tab;
  try{ const col = tab==='week' ? FS.collection(db,'lbw',wk,'e') : FS.collection(db,'lb');
    const top=await FS.getDocs(FS.query(col, FS.orderBy('score','desc'), FS.limit(50))); if(RANK.tab!==tab) return;
    const rows=top.docs.map(d=>d.data()), body=document.getElementById('rankBody'); body.replaceChildren();
    if(!rows.length) { msg(tab==='week' ? 'Tuần này chưa có ai ghi điểm — qua một màn để mở hàng!' : 'Chưa có ai ghi điểm.'); return; }
    rows.forEach((r,i)=>body.appendChild(row(i, r, r.uid===CLOUDSAVE.uid)));
    if(!rows.some(r=>r.uid===CLOUDSAVE.uid)){   // you, below the top 50: your best and your rank (a server-side count)
      const mine=await FS.getDoc(tab==='week' ? FS.doc(db,'lbw',wk,'e',CLOUDSAVE.uid) : FS.doc(db,'lb',CLOUDSAVE.uid));
      if(mine.exists()){ const r=mine.data(), above=await FS.getCountFromServer(FS.query(col, FS.where('score','>',r.score|0))); const me=row(above.data().count, r, true); me.classList.add('rk-me'); body.appendChild(me); }
      else { const n=document.createElement('div'); n.className='rk-msg'; n.textContent='Bạn chưa có điểm '+(tab==='week'?'tuần này':'')+' — điểm được ghi khi qua màn, thua hoặc rời trận.'; body.appendChild(n); } }
  }catch(e){ msg('Không tải được bảng xếp hạng ('+(e.code||e.message)+').'); } }
export function openRanking(){ RANK.from='start'; hide('start'); show('ranking'); sfx('click'); renderRanking(); }
export function closeRanking(){ hide('ranking'); show('start'); sfx('click'); }
tapBtn('rankBtn', openRanking); tapBtn('rankDone', closeRanking);
document.querySelectorAll('#ranking .rank-tab').forEach(t=>tapEl(t, ()=>{ RANK.tab=t.dataset.rt; sfx('click'); renderRanking(); }));
