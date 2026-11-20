// ui/battle-setup.js — Z107 BATTLE SETUP: PLAY opens it. CAMPAIGN = a ladder of levels in rising difficulty (win one to open the next; map/hour/weather set per level) · CUSTOM = pick map, hour, weather, space and enemy level · Z181 every battlefield is shown by a real in-game photo (assets/maps), the chosen one fills a hero card with its place, story, hour and weather
import { CAMPAIGN, SPACE, WEATHER } from '../../config.js';
import { BIOMES, CAMPAIGN_BIOMES, PROFILE, S, TOD_LABEL, biomeBlurb, biomePlace, biomeVi, drawTerrainPreview, fmtP, hide, launchGame, levelCheck, saveProfile, sfx, show, tapBtn, tapEl, todFor, verdictHTML } from '../hub.js';

export const BS = { tab:'campaign', sel:1, bg:0 };
export const TOD_KEYS = ['day','noon','sunset','night'];
export const WX_KEYS = ['clear','rain','sand','snow','fog'];
const TOD_HINT = { day:'nắng sớm, bóng dài', noon:'nắng gắt, tầm xa', sunset:'ánh vàng, ngược sáng', night:'đèn pha, tầm ngắn' };
// a battlefield's photo (rendered from the game itself) — a missing file falls back to the old painted preview
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
  set('bsBadges', (o.boss?'<span class="bs-badge boss">TRẬN TƯỚNG</span>':'')+(o.loop?'<span class="bs-badge ng">VÒNG MỚI+'+o.loop+'</span>':''));
  const pc=levelCheck(o.lvl), W=WEATHER[o.wx];
  set('bsFacts', '<div class="bs-fact"><span>THỜI GIAN</span><b>'+TOD_LABEL[o.tod]+'</b><small>'+TOD_HINT[o.tod]+'</small></div>'+
    '<div class="bs-fact"><span>THỜI TIẾT</span><b>'+W.vi+'</b><small>'+(W.range<1?'tầm bắn −'+Math.round((1-W.range)*100)+'%':'tầm bắn đầy đủ')+'</small></div>'+
    '<div class="bs-fact"><span>ĐỘ KHÓ</span><b>'+stars(o.stars)+'</b><small>địch cấp '+o.lvl+'</small></div>'+
    '<div class="bs-fact pw" style="--pc:'+pc.col+'"><span>SỨC MẠNH</span><b>'+fmtP(pc.P)+'<i> / '+fmtP(pc.need)+'</i></b><small>'+pc.tx+'</small></div>');
  // the whole screen breathes the chosen battlefield: a blurred copy of the photo cross-fades behind everything
  const A=document.getElementById('bsBgA'), B=document.getElementById('bsBgB'); if(A && B){ const cur=BS.bg?B:A, nxt=BS.bg?A:B;
    if(cur.dataset.src!==src){ nxt.dataset.src=src; nxt.onload=()=>{ nxt.classList.add('on'); cur.classList.remove('on'); }; nxt.src=src; BS.bg^=1; } } }
export function buildCampaign(){
  const g=document.getElementById('bsLadder'); if(!g) return; g.innerHTML=''; const max=campaignMax(), N=Math.max(CAMPAIGN.levels, Math.min(max+2, 99));
  for(let L=1; L<=N; L++){ const I=levelInfo(L), lock=L>max, done=L<max, on=L===BS.sel;
    const c=document.createElement('div'); c.className='bs-lv'+(lock?' lock':'')+(done?' done':'')+(on?' on':'')+(I.boss?' boss':'');
    c.appendChild(photo(I.biome, 'bs-ph'));
    c.insertAdjacentHTML('beforeend', '<div class="bs-lvn"><small>CẤP</small>'+L+'</div>'+
      (done?'<div class="bs-st ok">✓ ĐÃ THẮNG</div>':lock?'<div class="bs-st lk">KHOÁ · THẮNG CẤP '+(L-1)+'</div>':'<div class="bs-st go">SẴN SÀNG</div>')+
      '<div class="bs-lvt"><div class="bs-lvm">'+biomeVi(I.biome.name)+(I.boss?' <b>· TƯỚNG</b>':'')+'</div><div class="bs-lvc">'+TOD_LABEL[I.tod]+' · '+WEATHER[I.wx].vi+'</div>'+stars(I.stars)+'</div>'+
      (I.loop?'<div class="bs-ng">VÒNG '+(I.loop+1)+'</div>':''));
    if(!lock) tapEl(c, ()=>{ BS.sel=L; buildCampaign(); refreshSummary(); sfx('click'); });
    g.appendChild(c); }
  const on=g.querySelector('.bs-lv.on'); if(on) requestAnimationFrame(()=>on.scrollIntoView({ block:'nearest', inline:'nearest' }));
  const I=levelInfo(BS.sel); setHero(I.biome, { kick:'CHIẾN DỊCH · CẤP '+I.L, tod:I.tod, wx:I.wx, stars:I.stars, lvl:I.L, boss:I.boss, loop:I.loop });
}
function opts(id, items, cur, pick){ const el=document.getElementById(id); if(!el) return; el.innerHTML='';
  for(const it of items){ const b=document.createElement('div'); b.className='bs-op'+(it.k===cur?' on':'')+(it.lock?' lock':''); b.innerHTML=it.html; if(!it.lock) tapEl(b, ()=>{ pick(it.k); buildCustom(); refreshSummary(); sfx('click'); }); el.appendChild(b); } }
export function buildCustom(){ const C=PROFILE.custom, max=campaignMax();
  { const el=document.getElementById('bsMap'); if(el){ el.innerHTML=''; BIOMES.forEach((b,i)=>{ const d=document.createElement('div'); d.className='bs-map'+(i===C.biome?' on':'');
      d.appendChild(photo(b, 'bs-ph')); d.insertAdjacentHTML('beforeend','<span><b>'+biomeVi(b.name)+'</b><small>'+biomePlace(b.name)+'</small></span>');
      tapEl(d, ()=>{ C.biome=i; buildCustom(); refreshSummary(); sfx('click'); }); el.appendChild(d); }); } }
  opts('bsTod', TOD_KEYS.map(k=>({ k, html:TOD_LABEL[k]+'<small>'+TOD_HINT[k]+'</small>' })), C.tod, k=>C.tod=k);
  opts('bsWx', WX_KEYS.map(k=>({ k, html:WEATHER[k].vi+'<small>'+(WEATHER[k].range<1?'tầm −'+Math.round((1-WEATHER[k].range)*100)+'%':'tầm đầy đủ')+'</small>' })), C.wx, k=>C.wx=k);
  opts('bsSpace', Object.keys(SPACE).map(k=>({ k, html:SPACE[k].vi+'<small>'+SPACE[k].tx+'</small>' })), C.space, k=>C.space=k);
  if(C.lvl>max) C.lvl=max;
  opts('bsLvl', Array.from({ length:Math.min(max, 30) }, (_,i)=>i+1).map(L=>({ k:L, html:'CẤP '+L+'<small>'+'★'.repeat(levelInfo(L).stars)+'</small>' })), C.lvl, k=>C.lvl=k);
  setHero(BIOMES[C.biome], { kick:'TRẬN TỰ CHỌN · '+SPACE[C.space].vi, tod:C.tod, wx:C.wx, stars:levelInfo(C.lvl).stars, lvl:C.lvl, boss:false, loop:0 });
}
export function refreshSummary(){ const el=document.getElementById('bsSum'); if(!el) return;
  const pcL = BS.tab==='campaign' ? BS.sel : PROFILE.custom.lvl, pc=levelCheck(pcL), pw=' <span class="bs-you">BẠN <b>'+fmtP(pc.P)+'</b> · CẦN <b>'+fmtP(pc.need)+'</b> '+verdictHTML(pc)+'</span>';   // Z107 power rating vs this level
  if(BS.tab==='campaign'){ const I=levelInfo(BS.sel); el.innerHTML='<b>CẤP '+I.L+'</b> · '+biomeVi(I.biome.name)+' · '+TOD_LABEL[I.tod]+' · '+WEATHER[I.wx].vi+pw; }
  else { const C=PROFILE.custom; el.innerHTML='<b>TỰ CHỌN</b> · '+biomeVi(BIOMES[C.biome].name)+' · '+TOD_LABEL[C.tod]+' · '+WEATHER[C.wx].vi+' · '+SPACE[C.space].vi+pw; } }
export function setSetupTab(t){ BS.tab=t; document.querySelectorAll('#battleSetup .bs-mode').forEach(m=>m.classList.toggle('on', m.dataset.m===t));
  document.getElementById('bsCampaign').classList.toggle('hidden', t!=='campaign'); document.getElementById('bsCustom').classList.toggle('hidden', t!=='custom');
  if(t==='campaign') buildCampaign(); else buildCustom(); refreshSummary(); }
export function openBattleSetup(tab){ BS.sel=Math.min(campaignMax(), Math.max(1, BS.sel===1 ? campaignMax() : BS.sel)); hide('start'); show('battleSetup'); buildUnitPick(); setSetupTab(tab||'campaign'); sfx('click'); }
export function closeBattleSetup(){ hide('battleSetup'); show('start'); sfx('click'); }
export function goBattle(){ hide('battleSetup');
  if(BS.tab==='campaign') launchGame({ mode:'campaign', level:BS.sel });   // Z119 behind the deploying veil
  else { const C=PROFILE.custom; saveProfile(); launchGame({ mode:'custom', level:C.lvl, biome:C.biome, tod:C.tod, wx:C.wx, space:C.space }); } }
tapBtn('bsBack', closeBattleSetup); tapBtn('bsGo', goBattle);
document.querySelectorAll('#battleSetup .bs-mode').forEach(m=>tapEl(m, ()=>{ setSetupTab(m.dataset.m); sfx('click'); }));

// Z245 UNIT: fight as the tank, or as the general on his war horse (KỴ SĨ THÉP; Z246 a modern heavy operator) — remembered between battles
export function buildUnitPick(){ const el=document.getElementById('bsUnit'); if(!el) return; el.innerHTML='';
  for(const [k,t,sub] of [['tank','XE TĂNG','thiết giáp'],['cav','KỴ SĨ THÉP','tướng giáp · chiến mã'],['xeom','XE ÔM','bác tài chở · lính bắn'],['bagac','BA GÁC','đứng thùng sau · bắn quanh'],['bantai','BÁN TẢI','đứng thùng xe · khung chống lật']]){ const c=document.createElement('div'); c.className='bs-uchip'+((PROFILE.unit||'tank')===k?' on':''); c.innerHTML=t+'<small>'+sub+'</small>';   // Z293 + the ba gác and the pickup technical
    tapEl(c, ()=>{ PROFILE.unit=k; saveProfile(); buildUnitPick(); sfx('click'); }); el.appendChild(c); }
  // Z294 which soldier fights off the tank: the new special-forces trooper (his own detailed model wearing the rifle moves) or the steel operator
  for(const [k,t,sub] of [['s2','LÍNH ĐẶC NHIỆM','giáp đủ đồ · kính đêm'],['op','LÍNH THÉP','operator cũ']]){ const c=document.createElement('div'); c.className='bs-uchip'+((PROFILE.trooper||'s2')===k?' on':''); c.innerHTML=t+'<small>'+sub+'</small>';
    tapEl(c, ()=>{ PROFILE.trooper=k; saveProfile(); buildUnitPick(); sfx('click'); }); el.appendChild(c); } }
