// ui/garage.js — Z155 GARA XE TĂNG: the tank collection. Every model as a studio photo with its real name, origin, mass, engine and what it
//   changes in battle (armour, top speed, acceleration, turning, size); buy with coins / diamonds, tap an owned one to take it into battle.
import { PROFILE, S, SHOW, TANK_MODELS, TANK_ORDER, canAfford, econBuy, escapeHtml, hide, refreshStartUI, saveProfile, sfx, shopScene, show, tankPicHTML, tapBtn, tapEl } from '../hub.js';

export function ownedTanks(){ if(!PROFILE.ownedTanks) PROFILE.ownedTanks=['lqt']; if(!PROFILE.ownedTanks.includes('lqt')) PROFILE.ownedTanks.unshift('lqt'); return PROFILE.ownedTanks; }
export function currentTank(){ const id=PROFILE.tankModel; return TANK_MODELS[id] && ownedTanks().includes(id) ? id : 'lqt'; }
const pct=v=>Math.round((v-1)*100), sign=v=>(v>=1?'+':'')+pct(v)+'%';
function bar(label, v, lo, hi, inv){ const k=Math.max(0.05, Math.min(1, (v-lo)/(hi-lo))), good=inv ? v<=1 : v>=1;
  return '<div class="gr-bar"><span>'+label+'</span><i><u style="width:'+(k*100).toFixed(0)+'%" class="'+(good?'up':'dn')+'"></u></i><b class="'+(Math.abs(v-1)<0.005?'':(good?'up':'dn'))+'">'+(Math.abs(v-1)<0.005?'CHUẨN':sign(v))+'</b></div>'; }
export function renderGarage(){ const grid=document.getElementById('garGrid'); if(!grid) return; grid.replaceChildren(); const own=ownedTanks(), cur=currentTank();
  for(const id of TANK_ORDER){ const M=TANK_MODELS[id], o=own.includes(id), on=id===cur, st=M.stats, pr=M.price;
    const c=document.createElement('div'); c.className='gcard'+(o?' own':'')+(on?' on':'')+(M.real?'':' fict');
    const price = on ? '<div class="gc-act on">✓ ĐANG DÙNG</div>' : o ? '<div class="gc-act">CHỌN XE NÀY</div>'
      : '<div class="gc-act buy'+(canAfford(pr)?'':' poor')+'">'+(pr.d?'◆ '+pr.d:'⦿ '+pr.c.toLocaleString('vi-VN'))+'</div>';
    c.innerHTML='<div class="gc-pic">'+tankPicHTML(id,'gp-gar')+'<span class="gc-org">'+escapeHtml(M.origin)+'</span>'+(M.real?'':'<span class="gc-fx">THIẾT KẾ RIÊNG</span>')+'</div>'+
      '<div class="gc-nm">'+escapeHtml(M.name)+'</div><div class="gc-role">'+escapeHtml(M.role)+'</div>'+
      '<div class="gc-spec">'+escapeHtml(M.mass)+' · '+escapeHtml(M.engine)+'</div>'+
      '<div class="gc-bars">'+bar('GIÁP', st.hp, 0.7, 1.65)+bar('TỐC ĐỘ', st.spd, 0.75, 1.32)+bar('BỨT TỐC', st.acc, 0.75, 1.32)+bar('XOAY XE', st.turn, 0.78, 1.28)+bar('KÍCH THƯỚC', st.size, 0.8, 1.32, true)+'</div>'+
      '<div class="gc-desc">'+escapeHtml(M.desc)+'</div>'+price;
    tapEl(c, ()=>pickTank(id)); grid.appendChild(c); }
  const w=document.getElementById('garWallet'); if(w) w.innerHTML='⦿ <b>'+(PROFILE.coins||0).toLocaleString('vi-VN')+'</b> · ◆ <b>'+(PROFILE.diamonds||0)+'</b>'; }
export function pickTank(id){ const M=TANK_MODELS[id], own=ownedTanks();
  if(!own.includes(id)){ if(!canAfford(M.price)){ garShake(id); return; }   // Z162 bought through the server when linked
    econBuy('tank', id, null, M.price, ()=>{ if(!own.includes(id)) own.push(id); }).then(ok=>{ if(ok){ sfx('levelup'); selectTank(id); } else garShake(id); }); return; }
  sfx('click'); selectTank(id); }
function garShake(id){ sfx('alarm'); const c=document.querySelectorAll('#garGrid .gcard')[TANK_ORDER.indexOf(id)]; if(c){ c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); } }
export function selectTank(id){
  PROFILE.tankModel=id; saveProfile();
  if(SHOW.tank){ shopScene.remove(SHOW.tank); SHOW.tank=null; SHOW.built=''; } if(SHOW.thumbTank){ shopScene.remove(SHOW.thumbTank); SHOW.thumbTank=null; }   // the showroom rolls the new tank out next time
  renderGarage(); refreshStartUI(); }
export let _garFrom='start';
export function openGarage(){ _garFrom = S.mode==='paused' ? 'pause' : 'start'; hide(_garFrom); renderGarage(); show('garage'); sfx('click'); }
export function closeGarage(){ hide('garage'); show(_garFrom==='pause' ? 'pause' : 'start'); sfx('click'); }
tapBtn('garageBtn', openGarage); tapBtn('garDone', closeGarage);
