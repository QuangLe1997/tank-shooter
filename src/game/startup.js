// game/startup.js — Z103 COMPOSITION ROOT. Last system module in hub.js: everything is defined, so this is where the
// game is actually started (title-screen actors, saved prefs, first-launch dialogs, boot gate, first frame).
// Server/co-op work (ARCHITECTURE.md §6) swaps what runs here — not the systems themselves.
import { makeCavPlayer, PROFILE, S, __set_muted, bootReady, buildCore, doResize, initIcons, loop, muted, openNick, refreshBestLine, refreshStartUI, setMuted, setQuality, syncMenuState, updateSpellHUD, coopBoot } from '../hub.js';
import { tierBoot } from '../hub.js';   // SPLIT 3 (render/quality.js)

tierBoot();   // SPLIT 3 the last load never finished → one quality level down (render/quality.js), before anything is built
// build the scene actors up front so the title screen shows a live battlefield
buildCore(1);
{ const R = ['cav', 'xeom', 'bagac', 'bantai']; if(!R.includes(PROFILE.unit)) PROFILE.unit = R.includes(PROFILE.lastRide) ? PROFILE.lastRide : 'xeom';   // (no-tanks: an old profile's tank → his last ride, else the xe ôm)
  S.player = makeCavPlayer(PROFILE.unit === 'cav' ? null : PROFILE.unit); }
initIcons();          // paint all static HUD/menu glyphs (custom SVG icon set)
updateSpellHUD();     // show the equipped spell's icon from the start
refreshBestLine();    // show the saved high score on the title screen
refreshStartUI();     // greeting + CONTINUE button from the saved profile
__set_muted(!PROFILE.sound); setMuted(muted); setQuality(PROFILE.quality);   // apply saved audio + quality prefs
if(!PROFILE.nickname) openNick();   // first launch → ask for a call sign
syncMenuState();                                               // the title screen is an open menu → HUD stays out of the way
document.getElementById('boot')?.setAttribute('data-live','1');
doResize(true);                                                // size the buffer from the real canvas box before frame 1
requestAnimationFrame(()=>requestAnimationFrame(bootReady));   // two frames in → the battlefield is genuinely on screen

requestAnimationFrame(loop);
coopBoot();   // COOP 4 ?room=CODE in the address: the co-op lobby instead of the home screen (no room: returns at once, nothing else happens)
