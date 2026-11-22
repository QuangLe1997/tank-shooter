// core/profile.js — PLAYER PROFILE (nickname · campaign save · settings)
import { BALANCE } from '../../config.js';
import { BIOMES, S, cloudDirty, refreshStartUI } from '../hub.js';

// ----------------------------- PLAYER PROFILE (nickname · campaign save · settings) -----------------------------
// One profile per browser, persisted in localStorage. Tracks the call-sign, the high score, the campaign reach and a resumable save.
// (no-tanks: the wallet — coins, diamonds — the arsenal, the loadout and the shop's upgrades are gone; an old save drops them on load)
export const PROFILE_KEY='steelsiege.profile';
export const BEST_KEY='steelsiege.best';        // legacy high-score key (migrated into the profile)
export function defaultProfile(){ return { nickname:'', best:{score:0,stage:1}, save:null, terrain:-1, onboarded:false, coached:false, difficulty:'soldier', sound:true, music:true, quality:'high' }; }
// (no-tanks) the old wallet, arsenal and shop state a save may still carry — from this device or from the cloud (core/cloud.js applyRemote)
export function dropOldShop(pr){ for(const k of ['ownedGuns','loadout','coins','diamonds','upgrades','gunXp','ownedTanks','tankModel','kit','crew','ammo','ownedMgs','mgUp','_pend']) delete pr[k]; return pr; }
export function loadProfile(){
  let pr=null; try{ pr=JSON.parse(localStorage.getItem(PROFILE_KEY)); }catch(e){}
  if(!pr || typeof pr!=='object'){ pr=defaultProfile(); try{ const old=JSON.parse(localStorage.getItem(BEST_KEY)); if(old&&old.score) pr.best={score:old.score|0, stage:old.stage|0||1}; }catch(e){} }
  pr.nickname=(typeof pr.nickname==='string'?pr.nickname:'').slice(0,16);
  dropOldShop(pr);
  if(!pr.best||typeof pr.best!=='object') pr.best={score:0,stage:1};
  if(pr.save && (typeof pr.save!=='object' || !(pr.save.stage>1 || (pr.save.loop|0)>0))) pr.save=null;   // resume if past stage 1 OR in an NG+ loop
  if(pr.save) pr.save.loop=pr.save.loop|0;
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
export function saveProgress(){ if(S.run && S.run.mode==='custom') return; const s=PROFILE.save, cl=S.loop||0;       // checkpoint = furthest (loop, stage) reached; never regresses (custom battles never touch it)
  const better = !s || cl>(s.loop|0) || (cl===(s.loop|0) && S.stage>(s.stage||1));
  if(better && (S.stage>1 || cl>0)){ PROFILE.save={ loop:cl, stage:S.stage, score:S.score }; saveProfile(); refreshStartUI(); } }
export function clearProgress(){ PROFILE.save=null; saveProfile(); refreshStartUI(); }
export function recordRun(){ const beat = S.score > (BEST.score||0); if(beat){ BEST.score=S.score; BEST.stage=S.stage; saveProfile(); } refreshBestLine(); return beat; }
export function refreshBestLine(){ const el=document.getElementById('bestline'); if(el) el.textContent = (BEST.score>0) ? ('★ KỶ LỤC  '+BEST.score.toLocaleString()+'  ·  MÀN '+BEST.stage) : ''; }
export function __set_BEST(v){ BEST=v; return v; }   // Z98 cross-module write → setter (imported bindings are read-only)
