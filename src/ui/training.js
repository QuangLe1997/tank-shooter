// ui/training.js — Z182 FIRST-RUN ONBOARDING: a call-up card → a guided training battle in a TRIAL super-tank with two VIP-class guns (7 steps, each with the right keys for keyboard / controller / touch, a reward per step) → a showcase of what you just drove, with the way to own it
import { GUN_PRICE, GUN_BLURB } from '../../config.js';
import { FT, GUNS, MOBILE, PROFILE, S, TANK_MODELS, addCoins, core, floatText, gunPicHTML, hide, launchGame, openBattleSetup, openGarage, openShop, quitToMenu, refreshStartUI, riders, saveProfile, sfx, show, showBanner, tankPicHTML, tapBtn } from '../hub.js';

// the run is a TRIAL: currentTank() / loadoutGuns() read this while it is on — nothing is added to what you own
export const TRIAL = { on:false, tank:'t14', guns:['railgun','tesla'] };
export const TRAIN = { on:false, step:0, val:0, doneAt:0, t0:0, kills0:0, coins:0, lastPos:null, kitK:0, dash0:0, spell0:0, crew0:0, finished:false };
export const TRAIN_REWARD = { step:150, finish:450 };   // 7 × 150 + 450 = 1.500 xu → exactly the cheapest real tank (T-90M) in the garage
// [id, title, keys: keyboard / controller / touch, goal text, how much]
export const TRAIN_STEPS = [
  { id:'drive', t:'LÁI XE',                 kb:'<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> lái xe',  pad:'<kbd>CẦN TRÁI</kbd> lái xe',  touch:'Kéo <kbd>CẦN LÁI</kbd> bên trái', goal:'Chạy một vòng', need:45, unit:'m' },
  { id:'shoot', t:'NGẮM & KHAI HOẢ',        kb:'<kbd>CHUỘT</kbd> ngắm · giữ <kbd>CHUỘT TRÁI</kbd> bắn', pad:'<kbd>CẦN PHẢI</kbd> ngắm · <kbd>RT</kbd> bắn', touch:'Quay mũi xe vào địch · giữ <kbd>BẮN</kbd>', goal:'Hạ kẻ địch', need:3 },
  { id:'rail',  t:'PHÁO ĐIỆN TỪ · DÙNG THỬ', kb:'Bấm <kbd>2</kbd> đổi súng', pad:'<kbd>LB</kbd> / <kbd>RB</kbd> đổi súng', touch:'Chạm ô <kbd>SÚNG</kbd> để đổi', goal:'Hạ địch bằng đạn xuyên cả hàng', need:2, gun:'railgun' },
  { id:'dash',  t:'LƯỚT NÉ',                kb:'<kbd>CÁCH</kbd> lướt', pad:'<kbd>A</kbd> lướt', touch:'Chạm <kbd>LƯỚT</kbd>', goal:'Lướt — bất tử trong chớp mắt', need:1 },
  { id:'skill', t:'KỸ NĂNG',                kb:'<kbd>E</kbd> dùng kỹ năng', pad:'<kbd>LT</kbd> dùng kỹ năng', touch:'Chạm nút <kbd>KỸ NĂNG</kbd>', goal:'Tung kỹ năng một lần', need:1 },
  { id:'crew',  t:'LÍNH CỦA BẠN',           kb:'Bấm <kbd>G</kbd> thả lính', pad:'<kbd>B</kbd> thả lính', touch:'Chạm nút <kbd>LÍNH</kbd>', goal:'Cho tổ lính nhảy xuống tác chiến', need:1 },
  { id:'tesla', t:'SÚNG SÉT TESLA · DÙNG THỬ', kb:'Bấm <kbd>3</kbd> đổi súng', pad:'<kbd>LB</kbd> / <kbd>RB</kbd> đổi súng', touch:'Chạm ô <kbd>SÚNG</kbd> để đổi', goal:'Tia sét lan sang nhiều mục tiêu', need:3, gun:'tesla' },
];
const dev = ()=> document.body.classList.contains('pad') ? 'pad' : (MOBILE ? 'touch' : 'kb');
const el = id=>document.getElementById(id);
const nf = n=>Math.round(n).toLocaleString('vi-VN');
function priceHTML(p){ return p ? '<span>'+(p.d ? nf(p.d)+' <i>KIM CƯƠNG</i>' : nf(p.c)+' <i>XU</i>')+'</span>' : ''; }
// ---- the call-up card (first launch, after the call sign) ----
export function trialCardsHTML(){ const T=TANK_MODELS[TRIAL.tank];
  return '<div class="ti-tank">'+tankPicHTML(TRIAL.tank, 'ti-tankpic')+'<div class="ti-rib">DÙNG THỬ</div><div class="ti-tn"><b>'+T.name+'</b><small>'+T.role+'</small></div></div>'+
    '<div class="ti-guns">'+TRIAL.guns.map(id=>'<div class="ti-gun">'+gunPicHTML(id, 'ti-gunpic')+'<div><b>'+GUNS[id].name+'</b><small>'+(GUN_BLURB[id]||'')+'</small></div></div>').join('')+'</div>'; }
export function openTrainInvite(){ const n=el('tiNick'); if(n) n.textContent=(PROFILE.nickname||'CHỈ HUY').toUpperCase();
  const s=el('tiShow'); if(s) s.innerHTML=trialCardsHTML();
  const st=el('tiSteps'); if(st) st.innerHTML=TRAIN_STEPS.map((q,i)=>'<li><i>'+(i+1)+'</i>'+q.t.replace(' · DÙNG THỬ','')+'</li>').join('');
  const g=el('tiGift'); if(g) g.innerHTML='Hoàn thành nhận <b>+'+nf(TRAIN_REWARD.step*TRAIN_STEPS.length+TRAIN_REWARD.finish)+' xu</b> — đủ mua chiếc xe tăng đầu tiên của bạn';
  hide('start'); hide('nick'); hide('guide'); show('trainInvite'); sfx('powerup'); }
export function skipTraining(){ hide('trainInvite'); if(!PROFILE.onboarded){ PROFILE.onboarded=true; saveProfile(); } show('start'); refreshStartUI(); sfx('click'); }
export function startTraining(){ hide('trainInvite'); hide('guide'); TRIAL.on=true;
  Object.assign(TRAIN, { on:true, step:0, val:0, doneAt:0, t0:0, coins:0, lastPos:null, finished:false });
  PROFILE.coached=true;   // the training IS the coach — no extra toasts on top
  launchGame({ mode:'campaign', level:1 }); }
// ---- the step card on the HUD ----
function renderCard(flash){ const c=el('trainCard'); if(!c) return; const q=TRAIN_STEPS[TRAIN.step]; if(!q){ c.classList.remove('on'); return; }
  const k=Math.min(1, TRAIN.val/q.need), d=dev();
  c.innerHTML='<div class="tc-head"><span class="tc-n">BƯỚC '+(TRAIN.step+1)+'/'+TRAIN_STEPS.length+'</span><span class="tc-dots">'+TRAIN_STEPS.map((_,i)=>'<i class="'+(i<TRAIN.step?'ok':i===TRAIN.step?'cur':'')+'"></i>').join('')+'</span><span class="tc-skip" id="tcSkip">BỎ QUA HUẤN LUYỆN</span></div>'+
    '<div class="tc-t">'+q.t+'</div><div class="tc-keys">'+q[d]+'</div>'+
    '<div class="tc-goal"><span>'+q.goal+'</span><b>'+(q.unit ? Math.min(q.need, Math.round(TRAIN.val))+' / '+q.need+' '+q.unit : Math.min(q.need, TRAIN.val)+' / '+q.need)+'</b></div><div class="tc-bar"><u style="width:'+(k*100).toFixed(1)+'%"></u></div>';
  c.classList.add('on'); c.classList.toggle('done', !!flash);
  const sk=el('tcSkip'); if(sk) sk.onclick=()=>endTraining(true); }
function beginStep(){ const p=S.player; TRAIN.val=0; TRAIN.doneAt=0; TRAIN.kitK=S.kitKills|0; TRAIN.dash0=p?p.dashUntil||0:0; TRAIN.spell0=p?p.spellCdUntil||0:0; TRAIN.crew0=FT.length; TRAIN.rid0=riders.length; renderCard(false); }
export function trainTick(dt, now){ if(!TRAIN.on || TRAIN.finished) return; const p=S.player; if(!p) return;
  if(!TRAIN.t0){ TRAIN.t0=now; TRAIN.kills0=S.kitKills|0; beginStep(); }
  if(p.hp < p.maxHp*0.35) p.hp=p.maxHp*0.35; if(core.hp < core.maxHp*0.4) core.hp=core.maxHp*0.4;   // a recruit can't lose the training
  if(S.awaitingUpgrade){ if(!TRAIN.finished) finishTraining(); return; }   // the stage was won before the last step → the training ends here
  const q=TRAIN_STEPS[TRAIN.step]; if(!q) return;
  if(TRAIN.doneAt){ if(now-TRAIN.doneAt>1.15){ TRAIN.step++; if(TRAIN.step>=TRAIN_STEPS.length) finishTraining(); else beginStep(); } return; }
  const cur=(p.guns&&p.guns[p.gunIdx]||{}).id, kills=(S.kitKills|0)-TRAIN.kitK; TRAIN.kitK=S.kitKills|0; let v=TRAIN.val;
  if(q.id==='drive'){ if(TRAIN.lastPos){ v+=Math.hypot(p.pos.x-TRAIN.lastPos.x, p.pos.z-TRAIN.lastPos.z); } TRAIN.lastPos={ x:p.pos.x, z:p.pos.z }; }
  else if(q.id==='shoot') v+=kills;
  else if(q.gun){ if(cur===q.gun) v+=kills; }
  else if(q.id==='dash'){ if((p.dashUntil||0)>TRAIN.dash0+0.01) v=1; }
  else if(q.id==='skill'){ if((p.spellCdUntil||0)>TRAIN.spell0+0.01) v=1; }
  else if(q.id==='crew'){ if(FT.length>TRAIN.crew0 || riders.length<TRAIN.rid0) v=1; }
  if(v!==TRAIN.val){ TRAIN.val=v; renderCard(false); }
  if(TRAIN.val>=q.need){ TRAIN.doneAt=now; addCoins(TRAIN_REWARD.step); TRAIN.coins+=TRAIN_REWARD.step; renderCard(true); sfx('powerup');
    floatText('+'+TRAIN_REWARD.step+' XU', '#ffd24a', p.pos, 18); } }
function finishTraining(){ TRAIN.finished=true; addCoins(TRAIN_REWARD.finish); TRAIN.coins+=TRAIN_REWARD.finish; const c=el('trainCard'); if(c) c.classList.remove('on');
  showBanner('HUẤN LUYỆN HOÀN TẤT!  +'+nf(TRAIN.coins)+' xu', '#9be04a'); sfx('levelup'); setTimeout(()=>endTraining(false), 2600); }
// ---- the end: back to the menu with your own tank, and a showcase of what you just tried ----
export function endTraining(skipped){ if(!TRAIN.on) return; const kills=(S.kitKills|0)-(TRAIN.kills0|0), secs=TRAIN.t0 ? (performance.now()/1000-TRAIN.t0) : 0;
  TRAIN.on=false; TRIAL.on=false; const c=el('trainCard'); if(c) c.classList.remove('on');
  PROFILE.onboarded=true; PROFILE.trained=true; saveProfile(); S.runCfg={ mode:'campaign', level:1 };
  quitToMenu();   // (rolls the player's own tank back out for the title screen)
  if(skipped && !TRAIN.coins) return;
  const set=(id,h)=>{ const e=el(id); if(e) e.innerHTML=h; };
  set('tsStats', '<div><b>'+Math.max(1, Math.round(secs/60))+'</b><span>PHÚT</span></div><div><b>'+Math.max(0,kills)+'</b><span>HẠ ĐỊCH</span></div><div><b>+'+nf(TRAIN.coins)+'</b><span>XU THƯỞNG</span></div>');
  const T=TANK_MODELS[TRIAL.tank];
  set('tsGear', '<div class="ts-item">'+tankPicHTML(TRIAL.tank, 'ts-pic')+'<div class="ts-tx"><small>XE TĂNG</small><b>'+T.name+'</b><span>'+T.role+'</span></div><div class="ts-buy" data-pad="1" data-go="garage">'+priceHTML(T.price)+'<em>SỞ HỮU</em></div></div>'+
    TRIAL.guns.map(id=>'<div class="ts-item">'+gunPicHTML(id, 'ts-pic gun')+'<div class="ts-tx"><small>VŨ KHÍ</small><b>'+GUNS[id].name+'</b><span>'+(GUN_BLURB[id]||'')+'</span></div><div class="ts-buy" data-pad="1" data-go="shop">'+priceHTML(GUN_PRICE[id])+'<em>SỞ HỮU</em></div></div>').join(''));
  document.querySelectorAll('#tsGear .ts-buy').forEach(b=>b.onclick=()=>{ hide('trialShow'); if(b.dataset.go==='garage') openGarage(); else openShop(); });
  hide('start'); show('trialShow'); sfx('powerup'); }
tapBtn('tiGo', startTraining); tapBtn('tiSkip', skipTraining); tapBtn('guideTrain', startTraining);
tapBtn('tsCampaign', ()=>{ hide('trialShow'); openBattleSetup('campaign'); });
tapBtn('tsHome', ()=>{ hide('trialShow'); show('start'); refreshStartUI(); sfx('click'); });
