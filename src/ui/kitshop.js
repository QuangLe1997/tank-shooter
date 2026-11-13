// ui/kitshop.js — Z161 XƯỞNG CẢI TIẾN + KÍP XE screen: upgrade each owned tank's four tracks and its signature module; seat, hire and follow the crew
import { CREW_RECRUITS, CREW_SEATS, CREW_TRAITS, CREW_XP, KIT_MAX, KIT_SIG, KIT_SIG_NEED, KIT_TRACKS, PROFILE, TANK_MODELS, TANK_ORDER, buyKit, buySig, canAfford, crewMember, crewNeed, crewState, currentTank, escapeHtml, hide, hireCrew, kitCost, kitSigReady, kitState, ownedTanks, renderGarage, seatCrew, sfx, show, tankPicHTML, tapBtn, tapEl } from '../hub.js';

export const KITUI = { tab:'ws', tank:null, from:'garage' };
const money = c => !c ? '' : c.d ? '◆ '+c.d : '⦿ '+(c.c||0).toLocaleString('vi-VN');
const pctTxt = v => (v>0?'+':'')+Math.round(v*100)+'%';
function fxLine(fx){ const L=[], m={ hp:'máu', spd:'tốc độ', acc:'bứt tốc', turn:'xoay xe', dmg:'sát thương', reload:'nạp đạn', range:'tầm bắn', mag:'băng đạn', crit:'chí mạng', fire:'tốc độ bắn', boss:'lên tướng', armor:'giảm sát thương', dashCd:'hồi lướt', ramDeal:'húc', xp:'kinh nghiệm kíp' };
  for(const k in fx){ const v=fx[k]; if(!v) continue; if(k==='hpFlat') L.push('+'+Math.round(v)+' máu'); else if(m[k]) L.push(pctTxt(v)+' '+m[k]); } return L.join(' · '); }
function wallet(){ const w=document.getElementById('kitWallet'); if(w) w.innerHTML='⦿ <b>'+(PROFILE.coins||0).toLocaleString('vi-VN')+'</b> · ◆ <b>'+(PROFILE.diamonds||0)+'</b>'; }
function el(tag, cls, html){ const e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function shake(e){ if(!e) return; e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); }

export function renderKit(){ const body=document.getElementById('kitBody'); if(!body) return; body.replaceChildren(); wallet();
  document.querySelectorAll('#kitshop .kit-tab').forEach(t=>t.classList.toggle('on', t.dataset.kt===KITUI.tab));
  if(KITUI.tab==='ws') renderWorkshop(body); else renderCrew(body); }

// ---------------- workshop tab ----------------
function renderWorkshop(body){ const own=ownedTanks(); if(!KITUI.tank || !own.includes(KITUI.tank)) KITUI.tank=currentTank(); const id=KITUI.tank, M=TANK_MODELS[id], k=kitState(id);
  const chips=el('div','kit-chips'); for(const t of TANK_ORDER) if(own.includes(t)){ const c=el('div','kit-chip'+(t===id?' on':''), escapeHtml(TANK_MODELS[t].name.split(' ')[0])+(kitState(t).sig?' ★':'')); c.dataset.pad='1'; tapEl(c, ()=>{ KITUI.tank=t; sfx('click'); renderKit(); }); chips.appendChild(c); }
  body.appendChild(chips);
  const wrap=el('div','kit-ws'), left=el('div','kit-hero');
  left.innerHTML='<div class="gc-pic kit-pic">'+tankPicHTML(id,'gp-gar')+'</div><div class="gc-nm">'+escapeHtml(M.name)+'</div><div class="gc-role">'+escapeHtml(M.role)+'</div>';
  const tot={}; for(const t of KIT_TRACKS) for(const kk in t.fx) tot[kk]=(tot[kk]||0)+t.fx[kk]*k[t.key];
  left.appendChild(el('div','kit-sum', fxLine(tot) ? 'ĐÃ CẢI TIẾN: '+escapeHtml(fxLine(tot)) : 'Chưa cải tiến — mỗi hạng mục có 3 cấp.'));
  const right=el('div','kit-tracks');
  for(const t of KIT_TRACKS){ const L=k[t.key], cost=kitCost(id, t.key), row=el('div','kit-row');
    row.innerHTML='<div class="kr-nm">'+t.vi+'<small>'+t.per+' / cấp</small></div><div class="kr-pips">'+Array.from({length:KIT_MAX},(_,i)=>'<i class="'+(i<L?'on':'')+'"></i>').join('')+'</div>';
    const b=el('div','btn btn-mini kr-buy'+(cost?(canAfford(cost)?'':' poor'):' max'), cost ? '<span>NÂNG '+money(cost)+'</span>' : '<span>TỐI ĐA</span>');
    if(cost) tapEl(b, ()=>{ if(buyKit(id, t.key)) renderKit(); else shake(row); });
    row.appendChild(b); right.appendChild(row); }
  const S0=KIT_SIG[id];
  if(S0){ const ready=kitSigReady(id), sig=el('div','kit-sig'+(k.sig?' own':ready?' ready':' lock'));
    sig.innerHTML='<div class="ks-tag">MODULE ĐẶC TRƯNG</div><div class="ks-nm">'+escapeHtml(S0.vi)+'</div><div class="ks-ds">'+escapeHtml(S0.desc)+'</div>';
    const b=el('div','btn btn-mini ks-buy'+(k.sig?' max':(ready&&canAfford({d:S0.d})?'':' poor')), k.sig ? '<span>✓ ĐÃ LẮP</span>' : ready ? '<span>LẮP ◆ '+S0.d+'</span>' : '<span>CẦN MỌI HẠNG MỤC CẤP '+KIT_SIG_NEED+'</span>');
    if(!k.sig) tapEl(b, ()=>{ if(buySig(id)) renderKit(); else shake(sig); });
    sig.appendChild(b); right.appendChild(sig); }
  wrap.append(left, right); body.appendChild(wrap); }

// ---------------- crew tab ----------------
function renderCrew(body){ const c=crewState();
  const seats=el('div','kit-seats');
  for(const s of CREW_SEATS){ const m=crewMember(c.seats[s.key], c), mates=c.roster.map(r=>crewMember(r.id, c)).filter(x=>x && x.seat===s.key), card=el('div','kit-seat');
    const need=crewNeed(m.lvl), full=m.lvl>=CREW_XP.max, T=m.trait&&CREW_TRAITS[m.trait];
    card.innerHTML='<div class="kse-seat">'+s.vi+'</div><div class="kse-nm">'+escapeHtml(m.name)+'</div>'+
      '<div class="kse-lv"><b>CẤP '+m.lvl+'</b><i><u style="width:'+(full?100:Math.round(m.xp/need*100))+'%"></u></i><span>'+(full?'TỐI ĐA':m.xp+' / '+need+' KN')+'</span></div>'+
      '<div class="kse-per">'+s.per+'</div>'+
      (T?'<div class="kse-trait">◆ '+T.vi+' — '+T.desc+'</div>':'')+
      '<div class="kse-sk'+(m.lvl>=5?' on':'')+'">CẤP 5 · '+s.l5.vi+' — '+s.l5.desc+'</div><div class="kse-sk'+(m.lvl>=10?' on':'')+'">CẤP 10 · '+s.l10.vi+' — '+s.l10.desc+'</div>';
    if(mates.length>1){ const b=el('div','btn btn-mini kse-swap','<span>ĐỔI NGƯỜI ('+mates.length+')</span>');
      tapEl(b, ()=>{ const i=mates.findIndex(x=>x.id===m.id), nx=mates[(i+1)%mates.length]; seatCrew(s.key, nx.id); renderKit(); }); card.appendChild(b); }
    seats.appendChild(card); }
  body.appendChild(seats);
  body.appendChild(el('div','kit-h','TUYỂN QUÂN — người mới vào ngồi ngay ghế của mình; người cũ vẫn ở doanh trại để đổi lại'));
  const rec=el('div','kit-recs'); let any=false;
  for(const R of CREW_RECRUITS){ if(!R.price || c.roster.some(m=>m.id===R.id)) continue; any=true; const seat=CREW_SEATS.find(s=>s.key===R.seat), T=R.trait&&CREW_TRAITS[R.trait], card=el('div','kit-rec');
    card.innerHTML='<div class="kse-seat">'+seat.vi+' · CẤP '+R.lvl+'</div><div class="kse-nm">'+escapeHtml(R.name)+'</div>'+(T?'<div class="kse-trait">◆ '+T.vi+' — '+T.desc+'</div>':'');
    const b=el('div','btn btn-mini kr-buy'+(canAfford(R.price)?'':' poor'),'<span>TUYỂN '+money(R.price)+'</span>'); tapEl(b, ()=>{ if(hireCrew(R.id)) renderKit(); else shake(card); }); card.appendChild(b); rec.appendChild(card); }
  if(!any) rec.appendChild(el('div','kit-sum','Đã tuyển đủ mọi người.'));
  body.appendChild(rec); }

export function openKitShop(tab, tank){ KITUI.tab=tab||KITUI.tab||'ws'; if(tank) KITUI.tank=tank; hide('garage'); renderKit(); show('kitshop'); sfx('click'); }
export function closeKitShop(){ hide('kitshop'); renderGarage(); show('garage'); sfx('click'); }
tapBtn('kitDone', closeKitShop); tapBtn('garKit', ()=>openKitShop('ws')); tapBtn('garCrew', ()=>openKitShop('crew'));
document.querySelectorAll('#kitshop .kit-tab').forEach(t=>tapEl(t, ()=>{ KITUI.tab=t.dataset.kt; sfx('click'); renderKit(); }));
