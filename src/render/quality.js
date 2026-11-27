// render/quality.js — SPLIT 3 (A9) THREE QUALITY LEVELS + A FALL-BACK AFTER A CRASHED LOAD. Thấp / Vừa / Cao are the same battlefield — the same
//   buildings, men, cover and collisions (co-op stays in step) — with fewer things drawn: render scale, the occlusion pass, the sun's shadow map size,
//   the light shafts and how early small pieces fade out (LOD.detailPx) come from PERF_SPLIT.tiers. Before a boot or a battle loads, a note is put in
//   localStorage; it is taken away once the menu stands, or the fight has run PERF_SPLIT.crash.okS s. A note still there at the next start means that
//   load hung or crashed: the game starts one level lower (never below Thấp), says so once, and Settings shows it.
import { LOD, PERF_SPLIT } from '../../config.js';
import { AO, MOBILE, PROFILE, S, SHADOW_MAP, dprCap, saveProfile, shaftPass, sun } from '../hub.js';

export const QUAL = { tier:'high', fell:null, seen:false, at:0, base:null };
export const TIER_ORDER = ['low', 'medium', 'high'];
export function tierOf(q){ return PERF_SPLIT.tiers[q] || PERF_SPLIT.tiers.high; }
// the render scale this level may reach (the frame governor in game/loop.js steps between its floor and this)
export function tierDprTop(q){ const T = tierOf(q || PROFILE.quality); return Math.min(dprCap(), MOBILE ? T.dprPhone : T.dpr); }
// everything a level turns, applied at once (setQuality in audio/engine-music.js calls this; S.dpr is set there)
export function applyTier(q){ const T = tierOf(q); QUAL.tier = PERF_SPLIT.tiers[q] ? q : 'high';
  if(!QUAL.base) QUAL.base = { detailPx:LOD.detailPx };
  LOD.detailPx = QUAL.base.detailPx * T.detailK;
  if(!MOBILE){ AO.want = T.ao; AO.on = AO.want && PROFILE.perfAO !== false;
    if(shaftPass) shaftPass.enabled = T.shafts;
    const n = T.shadow || SHADOW_MAP; if(sun.shadow && sun.shadow.mapSize.x !== n){ sun.shadow.mapSize.set(n, n); if(sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; } } } }
// ---- the crash note
const KEY = () => PERF_SPLIT.crash.key;
function note(ph){ try{ localStorage.setItem(KEY(), JSON.stringify({ q:PROFILE.quality, ph, t:Date.now() })); }catch(e){} QUAL.seen = false; QUAL.at = 0; }
function unnote(){ try{ localStorage.removeItem(KEY()); }catch(e){} }
function noted(){ try{ const v = localStorage.getItem(KEY()); return v ? JSON.parse(v) : null; }catch(e){ return null; } }
// a battle starts loading (game/flow.js launchGame)
export function loadMark(){ if(PERF_SPLIT.crash.on) note('fight'); }
// at start (game/startup.js, before the menu's battlefield is built): the last load never finished → one level down; then this boot's own note
export function tierBoot(){ const C = PERF_SPLIT.crash; if(!C.on) return; const n = noted();
  if(n){ const i = TIER_ORDER.indexOf(PROFILE.quality); if(i > 0){ const to = TIER_ORDER[i - 1]; QUAL.fell = { from:PROFILE.quality, to, ph:n.ph }; PROFILE.quality = to; saveProfile(true); tierSay(); } }
  note('boot');
  setInterval(() => { const n = noted(); if(!n) return; const m = S.mode;
    if(n.ph === 'boot'){ if(performance.getEntriesByName('boot:warm').length || m !== 'start') unnote(); return; }   // the menu stands
    if(m !== 'start') QUAL.seen = true;
    if(m === 'playing'){ QUAL.at = QUAL.at || performance.now(); if(performance.now() - QUAL.at > C.okS * 1000) unnote(); }   // the fight has run a while
    else if(m === 'gameover' || m === 'victory' || (m === 'start' && QUAL.seen)) unnote(); }, 500); }
const NAME = { low:'Thấp', medium:'Vừa', high:'Cao' };
export function tierName(q){ return NAME[q] || NAME.high; }
function tierSay(){ const f = QUAL.fell; if(!f || typeof document === 'undefined') return; const el = document.createElement('div');
  el.textContent = 'Lần trước tải trận không xong — đồ hoạ đã hạ từ ' + tierName(f.from) + ' xuống ' + tierName(f.to) + '. Đổi lại trong Cài đặt › Hình ảnh.';
  el.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:9999;padding:9px 16px;border-radius:8px;background:rgba(20,22,16,.92);color:#ffe8b6;font:600 14px/1.35 system-ui,sans-serif;max-width:88vw;text-align:center;pointer-events:none;transition:opacity .6s';
  const put = () => { (document.body || document.documentElement).appendChild(el); setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 800); }, PERF_SPLIT.crash.sayS * 1000); };
  if(document.body) put(); else addEventListener('DOMContentLoaded', put); }
