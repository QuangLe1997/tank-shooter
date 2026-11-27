// ui/battle-setup.js — Z107 BATTLE SETUP: PLAY opens it. CAMPAIGN = a ladder of levels in rising difficulty (win one to open the next; map/hour/weather set per level) · CUSTOM = pick map, hour, weather, space and enemy level · Z181 every battlefield is shown by a real in-game photo (assets/maps), the chosen one fills a hero card with its place, story, hour and weather
import { CAMPAIGN, SPACE, WEATHER } from '../../config.js';
import { nightDefLaunch, nightDefSetup, BIOMES, CAMPAIGN_BIOMES, PROFILE, S, TOD_LABEL, capVi, biomeBlurb, biomePlace, biomeVi, drawTerrainPreview, hide, launchGame, loadoutChips, renderGear, saveProfile, sfx, show, tapBtn, tapEl, todFor } from '../hub.js';

export const BS = { tab:'campaign', sel:1, bg:0, step:2 };
export const TOD_KEYS = ['day','noon','sunset','night'];
export const WX_KEYS = ['clear','rain','sand','snow','fog'];
const TOD_HINT = { day:'nắng sớm, bóng dài', noon:'nắng gắt, tầm xa', sunset:'ánh vàng, ngược sáng', night:'đèn pha, tầm ngắn' };
// a battlefield's photo (rendered from the game itself) — a missing file falls back to the old painted preview. XK-UI every card, the hero and the
//   blurred backdrop take THEIR battlefield's own file (b = the level's / the map's biome, never the one on screen)
export function mapShot(b){ return 'assets/maps/'+b.name.toLowerCase()+'.webp'; }
function photo(b, cls){ const im=new Image(); im.decoding='async'; im.loading='lazy'; im.alt=biomeVi(b.name); im.className=cls||''; im.src=mapShot(b);
  im.onerror=()=>{ const cv=document.createElement('canvas'); cv.width=320; cv.height=180; cv.className=im.className; drawTerrainPreview(cv, b, false); im.replaceWith(cv); }; return im; }
// what a campaign level is: where, when, in what weather, how hard
export function levelInfo(L){ const loop=Math.floor((L-1)/CAMPAIGN.perLoop), stage=(L-1)%CAMPAIGN.perLoop+1;
  return { L, loop, stage, biome:BIOMES[Math.min(stage-1, CAMPAIGN_BIOMES-1)], bi:Math.min(stage-1, CAMPAIGN_BIOMES-1), tod:todFor(stage+loop), wx:CAMPAIGN.weather[(L-1)%CAMPAIGN.weather.length], stars:Math.min(5, 1+Math.floor((L-1)/3)), boss:stage===CAMPAIGN.perLoop }; }
export function campaignMax(){ return Math.max(1, (PROFILE.campaign&&PROFILE.campaign.max)|0); }
// a stage was won → the next level opens (and RETRY now restarts from the level you reached)
export function campaignCleared(level){ if(!S.run || S.run.mode!=='campaign') return;
  if(!PROFILE.campaign) PROFILE.campaign={ max:1 }; if(level+1 > PROFILE.campaign.max){ PROFILE.campaign.max=level+1; saveProfile(); }
  S.runCfg={ mode:'campaign', level:level+1 }; }
const stars=n=>'<span class="bs-stars">'+'★'.repeat(n)+'<i>'+'★'.repeat(5-n)+'</i></span>';
// the hero card: big photo (tinted for the hour, animated weather layer), name, real place, story, and the facts row
function setHero(b, o){ const shot=document.getElementById('bsShot'), img=document.getElementById('bsShotImg'); if(!shot || !img) return;
  const src=mapShot(b); if(img.dataset.src!==src){ img.dataset.src=src; img.classList.remove('in'); img.onload=()=>img.classList.add('in'); img.onerror=()=>img.classList.add('in'); img.src=src; }
  shot.dataset.tod=o.tod; shot.dataset.wx=o.wx;
  const set=(id,h)=>{ const e=document.getElementById(id); if(e) e.innerHTML=h; };
  set('bsKick', o.kick); set('bsName', biomeVi(b.name)); set('bsPlace', biomePlace(b.name)); set('bsBlurb', biomeBlurb(b.name));
  set('bsBadges', (o.boss?'<span class="bs-badge boss">Trận tướng</span>':'')+(o.loop?'<span class="bs-badge ng">Vòng '+(o.loop+1)+'</span>':''));
  const W=WEATHER[o.wx];
  set('bsFacts', '<div class="bs-fact"><span>Thời gian</span><b>'+capVi(TOD_LABEL[o.tod])+'</b><small>'+TOD_HINT[o.tod]+'</small></div>'+
    '<div class="bs-fact"><span>Thời tiết</span><b>'+capVi(W.vi)+'</b><small>'+(W.range<1?'tầm bắn −'+Math.round((1-W.range)*100)+'%':'tầm bắn đầy đủ')+'</small></div>'+
    '<div class="bs-fact"><span>Độ khó</span><b>'+stars(o.stars)+'</b><small>địch cấp '+o.lvl+'</small></div>');
  // the whole screen breathes the chosen battlefield: a blurred copy of the photo cross-fades behind everything
  const A=document.getElementById('bsBgA'), B=document.getElementById('bsBgB'); if(A && B){ const cur=BS.bg?B:A, nxt=BS.bg?A:B;
    if(cur.dataset.src!==src){ nxt.dataset.src=src; nxt.onload=()=>{ nxt.classList.add('on'); cur.classList.remove('on'); }; nxt.src=src; BS.bg^=1; } } }
export function buildCampaign(){
  const g=document.getElementById('bsLadder'); if(!g) return; g.innerHTML=''; const max=campaignMax(), N=Math.max(CAMPAIGN.levels, Math.min(max+2, 99));
  for(let L=1; L<=N; L++){ const I=levelInfo(L), lock=L>max, done=L<max, on=L===BS.sel;
    const c=document.createElement('div'); c.className='bs-lv'+(lock?' lock':'')+(done?' done':'')+(on?' on':'')+(I.boss?' boss':'');
    c.appendChild(photo(I.biome, 'bs-ph'));
    c.insertAdjacentHTML('beforeend', '<div class="bs-lvn"><small>Cấp</small>'+L+'</div>'+
      (done?'<div class="bs-st ok">✓ Đã thắng</div>':lock?'<div class="bs-st lk">Thắng cấp '+(L-1)+' để mở</div>':'<div class="bs-st go">Sẵn sàng</div>')+
      '<div class="bs-lvt"><div class="bs-lvm">'+capVi(biomeVi(I.biome.name))+(I.boss?' <b>· tướng</b>':'')+'</div><div class="bs-lvc">'+capVi(TOD_LABEL[I.tod])+' · '+WEATHER[I.wx].vi.toLocaleLowerCase('vi')+'</div>'+stars(I.stars)+'</div>'+
      (I.loop?'<div class="bs-ng">Vòng '+(I.loop+1)+'</div>':''));
    c.dataset.biome=I.biome.name.toLowerCase(); c.title=capVi(biomeVi(I.biome.name))+(lock?' — chưa mở':'');
    if(!lock) tapEl(c, ()=>{ BS.sel=L; buildCampaign(); refreshSummary(); sfx('click'); });
    g.appendChild(c); }
  const on=g.querySelector('.bs-lv.on'); if(on) requestAnimationFrame(()=>on.scrollIntoView({ block:'nearest', inline:'nearest' }));
  const I=levelInfo(BS.sel); setHero(I.biome, { kick:'Chiến dịch · cấp '+I.L, tod:I.tod, wx:I.wx, stars:I.stars, lvl:I.L, boss:I.boss, loop:I.loop });
}
function opts(id, items, cur, pick){ const el=document.getElementById(id); if(!el) return; el.innerHTML='';
  for(const it of items){ const b=document.createElement('div'); b.className='bs-op'+(it.k===cur?' on':'')+(it.lock?' lock':''); b.innerHTML=it.html; if(!it.lock) tapEl(b, ()=>{ pick(it.k); buildCustom(); refreshSummary(); sfx('click'); }); el.appendChild(b); } }
export function buildCustom(){ const C=PROFILE.custom, max=campaignMax();
  { const el=document.getElementById('bsMap'); if(el){ el.innerHTML=''; BIOMES.forEach((b,i)=>{ const d=document.createElement('div'); d.className='bs-map'+(i===C.biome?' on':'');
      d.appendChild(photo(b, 'bs-ph')); d.insertAdjacentHTML('beforeend','<span><b>'+capVi(biomeVi(b.name))+'</b><small>'+biomePlace(b.name)+'</small></span>'); d.dataset.biome=b.name.toLowerCase();
      tapEl(d, ()=>{ C.biome=i; buildCustom(); refreshSummary(); sfx('click'); }); el.appendChild(d); }); } }
  const night=BS.tab==='night';   // MODE 1 THỦ ĐÊM: a custom battle whose hour is the night (campaign/night-defence.js)
  opts('bsTod', TOD_KEYS.map(k=>({ k, html:capVi(TOD_LABEL[k])+'<small>'+TOD_HINT[k]+'</small>', lock:night && k!=='night' })), night?'night':C.tod, k=>{ if(!night) C.tod=k; });
  opts('bsWx', WX_KEYS.map(k=>({ k, html:capVi(WEATHER[k].vi)+'<small>'+(WEATHER[k].range<1?'tầm −'+Math.round((1-WEATHER[k].range)*100)+'%':'tầm đầy đủ')+'</small>' })), C.wx, k=>C.wx=k);
  opts('bsSpace', Object.keys(SPACE).map(k=>({ k, html:capVi(SPACE[k].vi)+'<small>'+SPACE[k].tx+'</small>' })), C.space, k=>C.space=k);
  if(C.lvl>max) C.lvl=max;
  opts('bsLvl', Array.from({ length:Math.min(max, 30) }, (_,i)=>i+1).map(L=>({ k:L, html:'Cấp '+L+'<small>'+'★'.repeat(levelInfo(L).stars)+'</small>' })), C.lvl, k=>C.lvl=k);
  setHero(BIOMES[C.biome], { kick:night ? nightDefSetup(C).kick : 'Trận tự chọn · bản đồ '+SPACE[C.space].vi.toLocaleLowerCase('vi'), tod:night?'night':C.tod, wx:C.wx, stars:levelInfo(C.lvl).stars, lvl:C.lvl, boss:false, loop:0 });
}
export function refreshSummary(){ const el=document.getElementById('bsSum'); if(!el) return;
  const pw='';
  const lo=t=>String(t||'').toLocaleLowerCase('vi');
  if(BS.tab==='night'){ el.innerHTML=nightDefSetup(PROFILE.custom).sum; return; }
  if(BS.tab==='campaign'){ const I=levelInfo(BS.sel); el.innerHTML='<b>Cấp '+I.L+'</b> '+capVi(biomeVi(I.biome.name))+' · '+lo(TOD_LABEL[I.tod])+' · '+lo(WEATHER[I.wx].vi)+pw; }
  else { const C=PROFILE.custom; el.innerHTML='<b>Tự chọn</b> '+capVi(biomeVi(BIOMES[C.biome].name))+' · '+lo(TOD_LABEL[C.tod])+' · '+lo(WEATHER[C.wx].vi)+' · bản đồ '+lo(SPACE[C.space].vi)+pw; } }
export function setSetupTab(t){ BS.tab=t; document.querySelectorAll('#battleSetup .bs-mode').forEach(m=>{ m.classList.toggle('on', m.dataset.m===t); m.setAttribute('aria-selected', m.dataset.m===t?'true':'false'); });
  document.getElementById('bsCampaign').classList.toggle('hidden', t!=='campaign'); document.getElementById('bsCustom').classList.toggle('hidden', t==='campaign');
  if(t==='campaign') buildCampaign(); else buildCustom(); refreshSummary(); }
// Z354 THE STEPS (no-tanks: BINH CHỦNG is gone — steps 2 and 3, shown as ① ②): TRANG BỊ (the trooper, his ride and its driver) → CHIẾN TRƯỜNG (campaign
//   ladder or a custom battle). PLAY opens at TRANG BỊ, the battlefield buttons straight at CHIẾN TRƯỜNG; the rail on top and the loadout chips in the footer jump between
//   steps; TIẾP moves on; XUẤT KÍCH goes in from any step with what is chosen (the last choices are remembered).
const STEP_NEXT = ['', '', 'Tiếp: chiến trường', ''];
export function setStep(n){ BS.step = Math.max(2, Math.min(3, n)); const ov = document.getElementById('battleSetup'); if(!ov) return; ov.dataset.step = BS.step;
  document.querySelectorAll('#bsRail .bs-rs').forEach(r => { const k = +r.dataset.s; r.classList.toggle('on', k === BS.step); r.classList.toggle('done', k < BS.step); });
  if(BS.step === 2) regear();
  else setSetupTab(BS.tab);
  paintFoot(); }
function regear(){ renderGear(document.getElementById('bsS2'), regear); paintFoot(); }
function paintFoot(){ loadoutChips(document.getElementById('bsUnit'), setStep); const nx = document.getElementById('bsNext'); if(nx){ nx.textContent = STEP_NEXT[BS.step]; nx.style.display = BS.step < 3 ? '' : 'none'; }
  const pv = document.getElementById('bsPrev'); if(pv) pv.style.display = BS.step > 2 ? '' : 'none';   // XK-UI a step back (Esc too: it carries the higher data-back)
  refreshSummary(); }
export function openBattleSetup(tab){ BS.sel=Math.min(campaignMax(), Math.max(1, BS.sel===1 ? campaignMax() : BS.sel)); hide('start'); show('battleSetup'); if(tab) BS.tab=tab; setStep(tab ? 3 : 2); sfx('click'); }
export function closeBattleSetup(){ hide('battleSetup'); show('start'); sfx('click'); }
export function goBattle(){ hide('battleSetup');
  if(BS.tab==='campaign') launchGame({ mode:'campaign', level:BS.sel });   // Z119 behind the deploying veil
  else if(BS.tab==='night'){ saveProfile(); nightDefLaunch(PROFILE.custom); }
  else { const C=PROFILE.custom; saveProfile(); launchGame({ mode:'custom', level:C.lvl, biome:C.biome, tod:C.tod, wx:C.wx, space:C.space }); } }
tapBtn('bsBack', closeBattleSetup); tapBtn('bsGo', goBattle); tapBtn('bsNext', () => { sfx('click'); setStep(BS.step + 1); }); tapBtn('bsPrev', () => { sfx('click'); setStep(BS.step - 1); });
document.querySelectorAll('#battleSetup .bs-mode').forEach(m=>tapEl(m, ()=>{ setSetupTab(m.dataset.m); sfx('click'); }));
document.querySelectorAll('#bsRail .bs-rs').forEach(r=>tapEl(r, ()=>{ sfx('click'); if(+r.dataset.s === 4) goBattle(); else setStep(+r.dataset.s); }));   // UIX stop 3 of the rail (XUẤT KÍCH) goes in, like the footer button
// back from the arsenal (closeLoadout returns here): show the guns as they are now
export function setupBack(){ if(BS.step === 2) regear(); else paintFoot(); }
// Enter: the next step, or into battle from the last
if(typeof window !== 'undefined') window.addEventListener('keydown', ev => { const ov = document.getElementById('battleSetup'); if(ev.key !== 'Enter' || !ov || ov.classList.contains('hidden')) return; ev.preventDefault(); if(BS.step < 3) setStep(BS.step + 1); else goBattle(); });
