// ui/hud-prefs.js — Z324 WHAT THE BATTLE HUD SHOWS (CÀI ĐẶT): the dialogue on screen (the radio box, the driver's and the soldier's lines over the ride —
//   off by default, the voices still play), the info cards (objective, forts, squad, power rating, contract) and the banners, each on or off. The choice
//   lives on the profile and shows as classes on <body>; css/hud-slim.css hides what is off.
import { PROFILE, saveProfile } from '../hub.js';

const DEF = { talk:false, cards:true, banners:true };
export const hudOn = k => (PROFILE.hud && PROFILE.hud[k] != null) ? !!PROFILE.hud[k] : DEF[k];
export function setHud(k, on){ PROFILE.hud = { ...(PROFILE.hud || {}), [k]:!!on }; saveProfile(); applyHud(); }
export function applyHud(){ if(typeof document === 'undefined' || !document.body) return; const b = document.body.classList;
  b.toggle('hud-no-talk', !hudOn('talk')); b.toggle('hud-no-cards', !hudOn('cards')); b.toggle('hud-no-banners', !hudOn('banners')); }
if(typeof window !== 'undefined') setTimeout(applyHud, 0);
