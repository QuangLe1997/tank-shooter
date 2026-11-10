// ui/briefing.js — STAGE BRIEFING: choose 1 of 3 contracts before the stage's waves begin
import { CONTRACTS, DMG_TYPE, OBJECTIVES } from '../../config.js';
import { BIOME, BOSS_DEFS, GUNS, S, SPELLS, WAVE, barrelGrade, biomeVi, coachFirstRun, escapeHtml, floatText, gunLevel, hide, iconEl, magCap, opFor, openDeploy, playStageTransition, setIcon, setPlayerBarrel, sfx, show, tapEl } from '../hub.js';

// ----- STAGE BRIEFING: choose 1 of 3 contracts before the stage's waves begin -----
export let _brCtx = null;   // what chooseContract should do on confirm: {first?} (stage1) or {stage,biomeName,accentHex} (stage 2+)
export function openBriefing(opts){
  _brCtx = opts || {};
  S.mode='briefing';
  const bdef = BOSS_DEFS[(S.stage-1) % BOSS_DEFS.length];
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
    card.append(ic,tag,nm,ds); tapEl(card, ()=>chooseContract(c)); wrap.appendChild(card);
  }
  show('briefing'); sfx('powerup');
}
export function chooseContract(c){
  S.contract=c; applyContractHUD(); hide('briefing');
  const ctx=_brCtx||{}; _brCtx=null;
  openDeploy(()=>beginStage(c, ctx));                                       // Z105 post the troops first, then the stage opens
}
export function beginStage(c, ctx){
  S.mode='playing'; coachFirstRun();   // first-ever match → show coach toasts (once)
  WAVE.active=false; S.wave=0;
  const now=performance.now()/1000;
  playStageTransition(ctx.stage||S.stage, ctx.biomeName||BIOME.name, ctx.accentHex||('#'+BIOME.accent.toString(16).padStart(6,'0'))); WAVE.betweenUntil=now+2.8;   // Z84: every operation opens with its mission card
  if(S.player) floatText(c.name, '#ffe8b6', S.player.pos, 20);
  sfx('click');
}
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
      const ic=document.createElement('span'); ic.className='wc-ic'; ic.appendChild(iconEl(g.svg));
      const nm=document.createElement('span'); nm.className='wc-nm'; nm.textContent=g.name+(gunLevel(inst.id)>1?' ·L'+gunLevel(inst.id):'');   // MASTERY level tag
      if(g.type){ const tg=document.createElement('span'); tg.className='wc-ty'; tg.textContent=g.type; tg.title=(DMG_TYPE[g.type]||{}).label||''; nm.appendChild(tg); }   // damage class tag (KIN/AP/HE/…)
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
      el.className='gunicon'+(idx===p.gunIdx?' on':''); el.appendChild(iconEl(d.svg));
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
