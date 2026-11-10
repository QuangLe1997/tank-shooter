// ui/battle-setup.js — Z107 BATTLE SETUP: PLAY opens it. CAMPAIGN = a ladder of levels in rising difficulty (win one to open the next; map/hour/weather set per level) · CUSTOM = pick map, hour, weather, space and enemy level (among levels you have opened).
import { CAMPAIGN, SPACE, WEATHER } from '../../config.js';
import { BIOMES, CAMPAIGN_BIOMES, PROFILE, S, TOD_LABEL, biomeVi, drawTerrainPreview, fmtP, hide, levelCheck, saveProfile, sfx, show, startGame, tapBtn, tapEl, todFor, verdictHTML } from '../hub.js';

export const BS = { tab:'campaign', sel:1 };
export const TOD_KEYS = ['day','noon','sunset','night'];
export const WX_KEYS = ['clear','rain','sand','snow','fog'];
const TOD_ICON = { day:'🌅', noon:'☀️', sunset:'🌇', night:'🌙' }, WX_ICON = { clear:'☀️', rain:'🌧️', sand:'🌪️', snow:'❄️', fog:'🌫️' };
// what a campaign level is: where, when, in what weather, how hard
export function levelInfo(L){ const loop=Math.floor((L-1)/CAMPAIGN.perLoop), stage=(L-1)%CAMPAIGN.perLoop+1;
  return { L, loop, stage, biome:BIOMES[Math.min(stage-1, CAMPAIGN_BIOMES-1)], bi:Math.min(stage-1, CAMPAIGN_BIOMES-1), tod:todFor(stage+loop), wx:CAMPAIGN.weather[(L-1)%CAMPAIGN.weather.length], stars:Math.min(5, 1+Math.floor((L-1)/3)), boss:stage===CAMPAIGN.perLoop }; }
export function campaignMax(){ return Math.max(1, (PROFILE.campaign&&PROFILE.campaign.max)|0); }
// a stage was won → the next level opens (and RETRY now restarts from the level you reached)
export function campaignCleared(level){ if(!S.run || S.run.mode!=='campaign') return;
  if(!PROFILE.campaign) PROFILE.campaign={ max:1 }; if(level+1 > PROFILE.campaign.max){ PROFILE.campaign.max=level+1; saveProfile(); }
  S.runCfg={ mode:'campaign', level:level+1 }; }
const stars=n=>'<span class="bs-stars">'+'★'.repeat(n)+'<i>'+'★'.repeat(5-n)+'</i></span>';
export function buildCampaign(){
  const g=document.getElementById('bsLadder'); if(!g) return; g.innerHTML=''; const max=campaignMax(), N=Math.max(CAMPAIGN.levels, Math.min(max+2, 99));
  for(let L=1; L<=N; L++){ const I=levelInfo(L), lock=L>max, done=L<max, on=L===BS.sel;
    const c=document.createElement('div'); c.className='bs-lv'+(lock?' lock':'')+(done?' done':'')+(on?' on':'')+(I.boss?' boss':'');
    const cv=document.createElement('canvas'); cv.width=160; cv.height=84; drawTerrainPreview(cv, I.biome, false);
    c.appendChild(cv);
    c.insertAdjacentHTML('beforeend', '<div class="bs-lvn">CẤP '+L+'</div>'+(done?'<div class="bs-st ok">✓ ĐÃ THẮNG</div>':lock?'<div class="bs-st lk">🔒 THẮNG CẤP '+(L-1)+'</div>':'<div class="bs-st go">▶ SẴN SÀNG</div>')+
      (()=>{ const pc=levelCheck(L); return '<div class="bs-pw" style="--pc:'+pc.col+'">CẦN '+fmtP(pc.need)+' · '+pc.tx+'</div>'; })()+'<div class="bs-lvm">'+biomeVi(I.biome.name)+(I.boss?' · <b>TƯỚNG</b>':'')+'</div><div class="bs-lvc">'+TOD_ICON[I.tod]+' '+TOD_LABEL[I.tod]+' · '+WX_ICON[I.wx]+' '+WEATHER[I.wx].vi+'</div>'+stars(I.stars)+(I.loop?'<div class="bs-ng">VÒNG '+(I.loop+1)+'</div>':''));
    if(!lock) tapEl(c, ()=>{ BS.sel=L; buildCampaign(); refreshSummary(); sfx('click'); });
    g.appendChild(c); }
  const on=g.querySelector('.bs-lv.on'); if(on) requestAnimationFrame(()=>on.scrollIntoView({ block:'nearest', inline:'center' }));
}
function opts(id, items, cur, pick){ const el=document.getElementById(id); if(!el) return; el.innerHTML='';
  for(const it of items){ const b=document.createElement('div'); b.className='bs-op'+(it.k===cur?' on':'')+(it.lock?' lock':''); b.innerHTML=it.html; if(!it.lock) tapEl(b, ()=>{ pick(it.k); buildCustom(); refreshSummary(); sfx('click'); }); el.appendChild(b); } }
export function buildCustom(){ const C=PROFILE.custom, max=campaignMax();
  { const el=document.getElementById('bsMap'); if(el){ el.innerHTML=''; BIOMES.forEach((b,i)=>{ const d=document.createElement('div'); d.className='bs-map'+(i===C.biome?' on':'');
      const cv=document.createElement('canvas'); cv.width=132; cv.height=70; drawTerrainPreview(cv, b, false); d.appendChild(cv); d.insertAdjacentHTML('beforeend','<span>'+biomeVi(b.name)+'</span>');
      tapEl(d, ()=>{ C.biome=i; buildCustom(); refreshSummary(); sfx('click'); }); el.appendChild(d); }); } }
  opts('bsTod', TOD_KEYS.map(k=>({ k, html:TOD_ICON[k]+' '+TOD_LABEL[k] })), C.tod, k=>C.tod=k);
  opts('bsWx', WX_KEYS.map(k=>({ k, html:WX_ICON[k]+' '+WEATHER[k].vi+(WEATHER[k].range<1?'<small>tầm −'+Math.round((1-WEATHER[k].range)*100)+'%</small>':'') })), C.wx, k=>C.wx=k);
  opts('bsSpace', Object.keys(SPACE).map(k=>({ k, html:SPACE[k].vi+'<small>'+SPACE[k].tx+'</small>' })), C.space, k=>C.space=k);
  if(C.lvl>max) C.lvl=max;
  opts('bsLvl', Array.from({ length:Math.min(max, 30) }, (_,i)=>i+1).map(L=>({ k:L, html:'CẤP '+L+'<small>'+'★'.repeat(levelInfo(L).stars)+'</small>' })), C.lvl, k=>C.lvl=k);
}
export function refreshSummary(){ const el=document.getElementById('bsSum'); if(!el) return;
  const pcL = BS.tab==='campaign' ? BS.sel : PROFILE.custom.lvl, pc=levelCheck(pcL), pw=' <span class="bs-you">⚔ BẠN <b>'+fmtP(pc.P)+'</b> · CẦN <b>'+fmtP(pc.need)+'</b> '+verdictHTML(pc)+'</span>';   // Z107 power rating vs this level
  if(BS.tab==='campaign'){ const I=levelInfo(BS.sel); el.innerHTML='<b>CẤP '+I.L+'</b> · '+biomeVi(I.biome.name)+' · '+TOD_LABEL[I.tod]+' · '+WEATHER[I.wx].vi+' '+stars(I.stars)+pw; }
  else { const C=PROFILE.custom; el.innerHTML='<b>TỰ CHỌN</b> · '+biomeVi(BIOMES[C.biome].name)+' · '+TOD_LABEL[C.tod]+' · '+WEATHER[C.wx].vi+' · '+SPACE[C.space].vi+' · địch cấp '+C.lvl+pw; } }
export function setSetupTab(t){ BS.tab=t; document.querySelectorAll('#battleSetup .bs-mode').forEach(m=>m.classList.toggle('on', m.dataset.m===t));
  document.getElementById('bsCampaign').classList.toggle('hidden', t!=='campaign'); document.getElementById('bsCustom').classList.toggle('hidden', t!=='custom');
  if(t==='campaign') buildCampaign(); else buildCustom(); refreshSummary(); }
export function openBattleSetup(tab){ BS.sel=Math.min(campaignMax(), Math.max(1, BS.sel===1 ? campaignMax() : BS.sel)); hide('start'); show('battleSetup'); setSetupTab(tab||'campaign'); sfx('click'); }
export function closeBattleSetup(){ hide('battleSetup'); show('start'); sfx('click'); }
export function goBattle(){ hide('battleSetup');
  if(BS.tab==='campaign') startGame({ mode:'campaign', level:BS.sel });
  else { const C=PROFILE.custom; saveProfile(); startGame({ mode:'custom', level:C.lvl, biome:C.biome, tod:C.tod, wx:C.wx, space:C.space }); } }
tapBtn('bsBack', closeBattleSetup); tapBtn('bsGo', goBattle);
document.querySelectorAll('#battleSetup .bs-mode').forEach(m=>tapEl(m, ()=>{ setSetupTab(m.dataset.m); sfx('click'); }));
