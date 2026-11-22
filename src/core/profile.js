// core/profile.js — PLAYER PROFILE (nickname · arsenal · loadout · campaign save)
import { BALANCE, SHOP_UP } from '../../config.js';
import { BIOMES, ECON, GUNS, S, SOLDIER, cloudDirty, econEarn, econGunFound, floatText, refreshStartUI, spawnDrone } from '../hub.js';

// ----------------------------- PLAYER PROFILE (nickname · arsenal · loadout · campaign save) -----------------------------
// One profile per browser, persisted in localStorage. Tracks the call-sign, every gun ever collected
// (the permanent arsenal), the ≤5-gun battle loadout, the high score, and a resumable campaign save.
export const PROFILE_KEY='steelsiege.profile';
export const BEST_KEY='steelsiege.best';        // legacy high-score key (migrated into the profile)
export const LOADOUT_MAX=5;                      // bring at most 5 weapons into a fight (quick-swap rotation)
export function defaultProfile(){ return { nickname:'', ownedGuns:['rifle'], loadout:['rifle'], best:{score:0,stage:1}, save:null, coins:0, diamonds:0, upgrades:{}, gunXp:{}, terrain:-1, onboarded:false, coached:false, difficulty:'soldier', sound:true, music:true, quality:'high' }; }
export function loadProfile(){
  let pr=null; try{ pr=JSON.parse(localStorage.getItem(PROFILE_KEY)); }catch(e){}
  if(!pr || typeof pr!=='object'){ pr=defaultProfile(); try{ const old=JSON.parse(localStorage.getItem(BEST_KEY)); if(old&&old.score) pr.best={score:old.score|0, stage:old.stage|0||1}; }catch(e){} }
  pr.nickname=(typeof pr.nickname==='string'?pr.nickname:'').slice(0,16);
  pr.ownedGuns=Array.isArray(pr.ownedGuns)?pr.ownedGuns.filter(k=>GUNS[k]):[];
  if(!pr.ownedGuns.includes('rifle')) pr.ownedGuns.unshift('rifle');
  pr.loadout=Array.isArray(pr.loadout)?pr.loadout.filter(k=>GUNS[k]&&pr.ownedGuns.includes(k)).slice(0,LOADOUT_MAX):[];
  if(!pr.loadout.length) pr.loadout=['rifle'];
  if(!pr.best||typeof pr.best!=='object') pr.best={score:0,stage:1};
  if(pr.save && (typeof pr.save!=='object' || !(pr.save.stage>1 || (pr.save.loop|0)>0))) pr.save=null;   // resume if past stage 1 OR in an NG+ loop
  if(pr.save) pr.save.loop=pr.save.loop|0;
  pr.coins=Math.max(0, pr.coins|0); pr.diamonds=Math.max(0, pr.diamonds|0);          // persistent wallet (coins · diamonds)
  if(!pr.upgrades || typeof pr.upgrades!=='object') pr.upgrades={};                  // { key: level } bought stat upgrades
  if(!pr.gunXp || typeof pr.gunXp!=='object') pr.gunXp={};                           // { gunId: dup-pickup count } → MASTERY level
  if(!pr.biomes253){ pr.biomes253=true;   // Z253 the battlefield list shrank from 15 to 10: a saved pick moves to the nearest one that is left
    const OLD=['DESERT','RUINS','TUNDRA','FOUNDRY','CITADEL','MEADOW','CITY','HILLS','VILLAGE','SAVANNA','ARCTIC','STEELMILL','VOLCANO','QUARRY','CAVERN'], TO={ TUNDRA:'ARCTIC', HILLS:'MEADOW', VILLAGE:'MEADOW', STEELMILL:'FOUNDRY', CAVERN:'QUARRY' };
    const move=i=>{ if(!Number.isInteger(i) || i<0 || i>=OLD.length) return i; const n=TO[OLD[i]]||OLD[i], j=BIOMES.findIndex(b=>b.name===n); return j<0?0:j; };
    pr.terrain=move(pr.terrain); if(pr.custom && typeof pr.custom==='object') pr.custom.biome=move(pr.custom.biome); }
  pr.terrain = (Number.isInteger(pr.terrain) && pr.terrain>=-1 && pr.terrain<BIOMES.length) ? pr.terrain : -1;   // chosen battlefield (-1 = AUTO campaign)
  { const fromSave = pr.save ? ((pr.save.loop|0)*5 + (pr.save.stage|0)) : 1, c = (pr.campaign && typeof pr.campaign==='object') ? pr.campaign : {};   // Z107 CAMPAIGN: highest level unlocked (old saves keep their reach)
    pr.campaign = { max: Math.max(1, c.max|0, fromSave, (pr.best&&pr.best.stage)|0 ? Math.min(5, pr.best.stage|0) : 1) }; }
  { const c = (pr.custom && typeof pr.custom==='object') ? pr.custom : {};                                   // Z107 last CUSTOM battle setup
    pr.custom = { biome: Number.isInteger(c.biome)&&c.biome>=0&&c.biome<BIOMES.length ? c.biome : (pr.terrain>=0?pr.terrain:0), tod: ['day','noon','sunset','night'].includes(c.tod)?c.tod:'day',
      wx: typeof c.wx==='string'?c.wx:'clear', space: ['small','mid','wide'].includes(c.space)?c.space:'wide', lvl: Math.max(1, c.lvl|0) }; }
  if(!pr.ctrl107){ pr.ctrl='screen'; pr.ctrl107=true; }   // Z107 one-time switch to screen-relative driving (W/A/S/D = up/left/down/right on screen); Settings can switch back
  if(!pr.introSeen || typeof pr.introSeen!=='object') pr.introSeen={};   // Z168 per-biome map (an old/odd value used to crash the intro)
  pr.onboarded = !!pr.onboarded; pr.coached = !!pr.coached;     // first-launch guide + first-match coach shown?
  pr.difficulty = (pr.difficulty && BALANCE.difficulty[pr.difficulty]) ? pr.difficulty : 'soldier';   // RECRUIT/SOLDIER/VETERAN
  pr.sound = pr.sound!==false; pr.music = pr.music!==false;     // audio prefs (default on)
  pr.quality = (pr.quality==='low'||pr.quality==='high') ? pr.quality : 'high';
  return pr;
}
export function saveProfile(quiet){ try{ localStorage.setItem(PROFILE_KEY, JSON.stringify(PROFILE)); }catch(e){} if(!quiet) cloudDirty(); }   // Z162 every save also queues a (rate-limited) cloud write
export let PROFILE=loadProfile();
export let BEST=PROFILE.best;                    // alias — existing high-score code keeps working
// ----- wallet (persists across runs; only a full RESET wipes it) -----
export function addCoins(n){ PROFILE.coins += n; econEarn(n,0); }   // Z162 owed by the server until the run is reported
export function addDiamonds(n){ PROFILE.diamonds += n; econEarn(0,n); if(n>0){ refreshWallet(); saveProfile(); } }
export function refreshWallet(){ document.querySelectorAll('.w-coins').forEach(e=>e.textContent=PROFILE.coins.toLocaleString());
  document.querySelectorAll('.w-dia').forEach(e=>e.textContent=PROFILE.diamonds.toLocaleString()); }
// ----------------------------- SHOP CATALOG + UPGRADES -----------------------------
// Leveled stat upgrades: early levels cost coins (cheap, affordable in a run or two), top
// levels cost diamonds (VIP — a multi-session grind). costs[L] = price to go from level L→L+1.
// SHOP_UP / GUN_PRICE / VIP_GUNS now imported from config.js (single source of truth for economy data)
export const SHOP_UP_BY={}; SHOP_UP.forEach(u=>SHOP_UP_BY[u.key]=u);
export function canAfford(cost){ return !!cost && (!cost.c || PROFILE.coins>=cost.c) && (!cost.d || PROFILE.diamonds>=cost.d); }
export function payCost(cost){ if(!canAfford(cost)) return false; if(cost.c) PROFILE.coins-=cost.c; if(cost.d) PROFILE.diamonds-=cost.d; return true; }
export function guardTarget(){ return SOLDIER.base + (PROFILE.upgrades.guards||0); }
// ---- SUPPORT-UNIT upgrades (shop): drone + guards scale by purchased level ----
export const SUP = BALANCE.support;
export function droneDmgMul(){ return 1 + (PROFILE.upgrades.dronePow||0)*SUP.dronePowPerLvl; }       // STRIKE DRONE: +power/lvl
export function droneReloadMul(){ return Math.max(SUP.mulFloor, 1 - (PROFILE.upgrades.droneRof||0)*SUP.droneRofPerLvl); }  // ROTORS: faster reload+fire
export function droneBonusHp(){ return (PROFILE.upgrades.droneArm||0)*SUP.droneArmPerLvl; }          // PLATING: +HP
export function droneOwned(){ return (PROFILE.upgrades.dronePow||0) >= 1; }                          // bought STRIKE DRONE L1 → escort
export function guardFireMul(){ return Math.max(SUP.mulFloor, 1 - (PROFILE.upgrades.guardRof||0)*SUP.guardRofPerLvl); }   // GUARD DRILL: faster fire
export function guardBonusHp(){ return (PROFILE.upgrades.guardArm||0)*SUP.guardArmPerLvl; }          // GUARD ARMOR: +HP
export function deployOwnedDrone(){ if(droneOwned() && !S.drone) spawnDrone(true); }                 // auto-launch the owned escort each stage
export const GEM_DEF = { id:'gem', svg:'diamond', color:0x7fe7ff, vi:'KIM CƯƠNG', ds:'+1 ◆', cat:'gem', tier:2, apply(){ addDiamonds(1); if(S.player) floatText('+1 KIM CƯƠNG','#7fe7ff',S.player.pos,22); } };  // rare treasure
export function ownGun(id){ if(!GUNS[id]) return false; let fresh=false;
  if(!PROFILE.ownedGuns.includes(id)){ PROFILE.ownedGuns.push(id); fresh=true; }
  if(!PROFILE.loadout.includes(id) && PROFILE.loadout.length<LOADOUT_MAX) PROFILE.loadout.push(id);   // auto-equip while there's room
  if(fresh && !ECON.buying) econGunFound(id);   // Z162 a battlefield find is reported with the run
  saveProfile(); return fresh; }
export function saveProgress(){ if(S.run && S.run.mode==='custom') return; const s=PROFILE.save, cl=S.loop||0;       // checkpoint = furthest (loop, stage) reached; never regresses (custom battles never touch it)
  const better = !s || cl>(s.loop|0) || (cl===(s.loop|0) && S.stage>(s.stage||1));
  if(better && (S.stage>1 || cl>0)){ PROFILE.save={ loop:cl, stage:S.stage, score:S.score }; saveProfile(); refreshStartUI(); } }
export function clearProgress(){ PROFILE.save=null; saveProfile(); refreshStartUI(); }
export function recordRun(){ const beat = S.score > (BEST.score||0); if(beat){ BEST.score=S.score; BEST.stage=S.stage; saveProfile(); } refreshBestLine(); return beat; }
export function refreshBestLine(){ const el=document.getElementById('bestline'); if(el) el.textContent = (BEST.score>0) ? ('★ KỶ LỤC  '+BEST.score.toLocaleString()+'  ·  MÀN '+BEST.stage) : ''; }
export function __set_BEST(v){ BEST=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
