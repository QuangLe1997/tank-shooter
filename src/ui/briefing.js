// ui/briefing.js — STAGE BRIEFING: choose 1 of 3 contracts before the stage's waves begin
import { CONTRACTS, DMG_TYPE, OBJECTIVES } from '../../config.js';
import { BIOME, GUNS, PROFILE, S, SPELLS, TOD_LABEL, WAVE, barrelGrade, biomeVi, bossForStage, camera, coachFirstRun, conditionsText, escapeHtml, floatText, gunLevel, gunPicEl, hide, iconEl, magCap, opFor, openDeploy, playStageTransition, renderer, resetEnvEvents, saveProfile, sayVoice, scene, setFocus, setIcon, setPlayerBarrel, sfx, show, spawnRelic, stageTankKit, tapEl, voiceStage } from '../hub.js';

// ----- STAGE BRIEFING: choose 1 of 3 contracts before the stage's waves begin -----
export let _brCtx = null;   // what chooseContract should do on confirm: {first?} (stage1) or {stage,biomeName,accentHex} (stage 2+)
export function openBriefing(opts){
  _brCtx = opts || {};
  S.mode='briefing';
  prewarmStage();   // Z168 compile this stage's shaders in the background while the player reads the briefing (no hitch at the countdown / first frame)
  const bdef = bossForStage(S.stage);   // Z161 may be one of the new generals
  const sub=document.getElementById('br-sub'); if(sub) sub.textContent = 'MÀN '+S.stage+' · '+biomeVi(BIOME.name)+'  —  TƯỚNG: '+(bdef?bdef.name:'???');
  { const op=opFor(S.stage), od=OBJECTIVES[op.obj]; const t=document.getElementById('br-op'); if(t) t.textContent=op.title;
    const bf=document.getElementById('br-brief'); if(bf) bf.textContent=(op.story?op.story+' ':'')+op.brief;
    const ob=document.getElementById('br-obj'); if(ob) ob.innerHTML='<b>MỤC TIÊU</b> Phá '+escapeHtml(od.vi||od.name)+' <span>· khi nó còn đứng: '+escapeHtml((od.effectVi||od.effect).toLowerCase())+' · thưởng xu + ◆</span>'; }
  // offer 3: always the STEADY safe baseline + 2 random risk/reward contracts (shuffled)
  const rest=CONTRACTS.filter(c=>c.id!=='steady').slice(), pick=[CONTRACTS.find(c=>c.id==='steady')];
  for(let i=0;i<2 && rest.length;i++) pick.push(rest.splice((Math.random()*rest.length)|0,1)[0]);
  for(let i=pick.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0, t=pick[i]; pick[i]=pick[j]; pick[j]=t; }
  const wrap=document.getElementById('brcards'); wrap.replaceChildren();
  for(const c of pick){
    const card=document.createElement('div'); card.className='brcard';
    const ic=document.createElement('div'); ic.className='ic'; ic.appendChild(iconEl(c.icon));
    const tag=document.createElement('div'); tag.className='br-tag'; tag.textContent=c.tag;
    const nm=document.createElement('div'); nm.className='nm'; nm.textContent=c.name;
    const ds=document.createElement('div'); ds.className='ds'; ds.textContent=c.desc;
    card.append(ic,tag,nm,ds); card._c=c; tapEl(card, ()=>pickContract(c)); wrap.appendChild(card);
  }
  pickContract(pick.find(c=>c.id===PROFILE.lastContract) || pick.find(c=>c.id==='steady'), true);   // Z152 one is always chosen — XUẤT KÍCH works straight away
  show('briefing'); sfx('powerup');
  requestAnimationFrame(()=>{ const go=document.getElementById('brGo'); if(go && typeof setFocus==='function' && document.body.classList.contains('pad')) setFocus(go, true); });
}
export let _brPick=null;
export function pickContract(c, quiet){ _brPick=c; document.querySelectorAll('#brcards .brcard').forEach(el=>el.classList.toggle('on', el._c===c)); if(!quiet) sfx('click'); }
// Z152 XUẤT KÍCH: the chosen contract, the troops posted by last time's plan (or the auto plan) — no extra screen
export function launchStage(withDeploy){ const c=_brPick||CONTRACTS.find(x=>x.id==='steady'); PROFILE.lastContract=c.id; saveProfile(); chooseContract(c, !withDeploy); }
export function chooseContract(c, quick){
  S.contract=c; applyContractHUD(); hide('briefing');
  const ctx=_brCtx||{}; _brCtx=null;
  openDeploy(()=>beginStage(c, ctx), quick);                                       // Z105 post the troops first, then the stage opens
}
// Z136 COUNTDOWN: after XUẤT KÍCH the world stays frozen for 3 · 2 · 1 (camera already on the battlefield, nobody moves or shoots), then the fight goes live
let _go=null, _cdN=0;
export function beginStage(c, ctx){
  S.mode='countdown'; S.cd=3.05; _go={ c, ctx }; _cdN=0; S.firing=false; prewarmStage(); voiceStage();   // Z168 the troops / riders / roof gun just deployed: compile them during the 3-2-1
  { const sub=document.getElementById('cdSub'), op=opFor(S.stage); if(sub){ const ct=conditionsText(); sub.innerHTML='<div>'+escapeHtml('MÀN '+S.stage+' · '+biomeVi(BIOME.name)+(S.tod?' · '+TOD_LABEL[S.tod]:'')+(op&&op.title?'  —  '+op.title:''))+'</div>'+(ct?'<div class="cdc">'+escapeHtml('ĐIỀU KIỆN: '+ct)+'</div>':''); sub.classList.add('on'); } }   // Z138 the mission line rides under the numbers
  WAVE.active=false; S.wave=0;
  if(S.player) floatText(c.name, '#ffe8b6', S.player.pos, 20);
  sfx('click');
}
function goLive(){ const g=_go||{ c:S.contract||{}, ctx:{} }, c=g.c, ctx=g.ctx||{}; _go=null;
  S.mode='playing'; stageTankKit(S.player); S.kitKills=0; spawnRelic(); coachFirstRun(); resetEnvEvents(performance.now()/1000); setTimeout(()=>{ if(S.mode==='playing') sayVoice('open'); }, 700);   // Z154 the stage's relic rises somewhere on the field · first-ever match → show coach toasts (once) · Z140 the land's surprises start counting
  const now=performance.now()/1000;
  playStageTransition(ctx.stage||S.stage, ctx.biomeName||BIOME.name, ctx.accentHex||('#'+BIOME.accent.toString(16).padStart(6,'0')), true); WAVE.betweenUntil=now+1.6;   // Z138 the first wave comes 1.6 s after GO (the countdown already waited)
  { const sub=document.getElementById('cdSub'); if(sub) sub.classList.remove('on'); }
  const el=document.getElementById('countdown'); if(el){ el.textContent='CHIẾN ĐẤU!'; el.className='go show'; setTimeout(()=>{ if(el.textContent==='CHIẾN ĐẤU!') el.className=''; }, 900); }
  sfx('levelup'); }
export function updateCountdown(dt){ S.cd-=dt; const n=Math.max(0, Math.ceil(S.cd)), el=document.getElementById('countdown');
  if(n!==_cdN && n>0){ _cdN=n; if(el){ el.textContent=String(n); el.className=''; void el.offsetWidth; el.className='show'; } sfx('beep'); }
  if(S.cd<=0) goLive(); }
export function applyContractHUD(){
  const chip=document.getElementById('contractChip'); if(!chip) return;
  const c=S.contract;
  if(!c || c.id==='none'){ chip.classList.add('hidden'); return; }
  setIcon(chip.querySelector('.ic'), c.icon);
  const nm=document.getElementById('cc-name'); if(nm) nm.textContent=c.name;
  chip.classList.remove('hidden');
}
export function updateGunHUD(){
  const p=S.player; if(!p||!p.guns.length) return;
  const inst=p.guns[p.gunIdx], g=GUNS[inst.id];
  { const bk=inst.id+':'+barrelGrade(inst.id); if(p._barrelId!==bk){ setPlayerBarrel(inst.id); p._barrelId=bk; } }   // swap the tank's barrel to match the equipped gun
  // Z107: the HUD was rebuilt from scratch on every shot (new nodes for the chip + the whole gun strip) — now the nodes are
  // rebuilt only when the gun/level changes, and a shot only rewrites the ammo text.
  const chip=document.getElementById('weaponchip');
  if(chip){
    const reloading = inst.rU>performance.now()/1000, ammo = p.infiniteAmmo ? '∞' : (inst.ammo+'/'+magCap(g)), key=inst.id+':'+gunLevel(inst.id);
    if(chip._key!==key){ chip._key=key;
      const ic=gunPicEl(inst.id, 'wc-ic');   // Z150 the gun's own photo, same as the arsenal
      const nm=document.createElement('span'); nm.className='wc-nm'; nm.textContent=g.name+(gunLevel(inst.id)>1?' ★'+gunLevel(inst.id):'');   // MASTERY level tag
      if(g.type){ const tg=document.createElement('span'); tg.className='wc-ty'; tg.textContent=(DMG_TYPE[g.type]||{}).vi||g.type; tg.title='Loại đạn: '+((DMG_TYPE[g.type]||{}).vi||''); nm.appendChild(tg); }   // damage class tag (KIN/AP/HE/…)
      const am=document.createElement('span'); am.className='wc-am'; chip._am=am; chip._amT=null; chip._rl=null;
      chip.replaceChildren(ic,nm,am); }
    const t = reloading ? 'NẠP ĐẠN…' : ammo; if(chip._amT!==t){ chip._amT=t; chip._am.textContent=t; }
    if(chip._rl!==reloading){ chip._rl=reloading; chip.classList.toggle('reloading', reloading); }
  }
  const list=document.getElementById('gunlist');
  const lkey=p.guns.map(gi=>gi.id).join(',')+'|'+p.gunIdx;
  const same = list && list._key===lkey && p.guns.every((gi,i)=>list.children[i] && list.children[i]._gi===gi);   // same gun objects too (a new run makes new ones)
  if(list && !same){ list._key=lkey; list.replaceChildren();
    list.style.display = p.guns.length>1 ? 'flex' : 'none';   // only show the strip once you own >1 gun (declutter + shows persistence)
    p.guns.forEach((gi,idx)=>{ const d=GUNS[gi.id]; const el=document.createElement('div');
      el.className='gunicon'+(idx===p.gunIdx?' on':''); el.appendChild(gunPicEl(gi.id, 'gp-strip')); el.title=d.name;
      const cool=document.createElement('div'); cool.className='gcool'; el.appendChild(cool);
      const chk=document.createElement('span'); chk.className='gchk'; el.appendChild(chk);
      el._gi=gi; el._cool=cool;                                // refs for the per-frame reload status
      list.appendChild(el); }); }
  updateGunStatus(performance.now()/1000);
  { const mw=document.querySelector('#mWeapon .ic'); if(mw && mw._svg!==g.svg){ mw._svg=g.svg; setIcon(mw, g.svg); } }   // mobile weapon button shows the equipped gun
}
// per-frame: paint each inventory gun's status — ✓ when reloaded/ready, dark conic sweep while reloading
export function updateGunStatus(now){
  const list=document.getElementById('gunlist'); if(!list || !S.player) return;
  for(const el of list.children){ const gi=el._gi; if(!gi) continue;
    const rl = gi.rU>now && gi.rD>0;                                       // Z107: write only on change (was ~27–160 class mutations a frame)
    if(el._rl!==rl){ el._rl=rl; el.classList.toggle('reloading', rl); el.classList.toggle('ready', !rl); }
    const bg = rl ? 'conic-gradient(transparent '+(Math.round((1-(gi.rU-now)/gi.rD)*36)*10)+'deg, rgba(4,6,3,.8) 0)' : 'none';
    if(el._cool && el._bg!==bg){ el._bg=bg; el._cool.style.background=bg; }
  }
}
export const updateWeaponHUD = updateGunHUD;   // back-compat alias for older call sites
export function updateSpellHUD(){
  const sp=SPELLS[S.spell];
  setIcon(document.querySelector('#ab-spell .ic'), sp.svg);
  setIcon(document.querySelector('#mSpell .ic'), sp.svg);
  const mt=document.querySelector('#mSpell .mbtag'); if(mt) mt.textContent=sp.vi||sp.name;           // Z84: always show WHICH skill is armed
  const an=document.getElementById('ab-spell-nm'); if(an) an.textContent='Q ‹ '+(sp.vi||sp.name)+' ›';
}

{ const g=document.getElementById('brGo'), d=document.getElementById('brDeploy'); if(g) tapEl(g, ()=>launchStage(false)); if(d) tapEl(d, ()=>launchStage(true)); }   // Z152
// Z168 the intro hides far objects while it flies; when they come back, their shaders would compile on the countdown's first frames. Do it now, in parallel, off the frame.
let _warm=null, _again=false;
export function prewarmStage(){ if(_warm){ _again=true; return; }   // one pass at a time; a call during a pass queues one more (new troops / riders / the roof gun appeared)
  _warm=new Promise(r=>setTimeout(r, 30)).then(()=>renderer.compileAsync ? renderer.compileAsync(scene, camera) : renderer.compile(scene, camera)).catch(()=>{}).then(()=>{ _warm=null; if(_again){ _again=false; prewarmStage(); } }); }
