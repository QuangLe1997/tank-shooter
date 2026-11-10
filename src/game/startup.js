// game/startup.js — Z103 COMPOSITION ROOT. Last system module in hub.js: everything is defined, so this is where the
// game is actually started (title-screen actors, saved prefs, first-launch dialogs, boot gate, first frame).
// Server/co-op work (ARCHITECTURE.md §6) swaps what runs here — not the systems themselves.
import { PROFILE, S, __set_muted, bootReady, buildCore, doResize, initIcons, loop, makePlayer, muted, openGuide, openNick, refreshBestLine, refreshStartUI, setMuted, setQuality, syncMenuState, updateSpellHUD } from '../hub.js';

// build the scene actors up front so the title screen shows a live battlefield
buildCore(1);
S.player = makePlayer();
initIcons();          // paint all static HUD/menu glyphs (custom SVG icon set)
updateSpellHUD();     // show the equipped spell's icon from the start
refreshBestLine();    // show the saved high score on the title screen
refreshStartUI();     // greeting + CONTINUE button from the saved profile
__set_muted(!PROFILE.sound); setMuted(muted); setQuality(PROFILE.quality);   // apply saved audio + quality prefs
if(!PROFILE.nickname) openNick();   // first launch → ask for a call sign
else if(!PROFILE.onboarded) openGuide();   // returning player who hasn't seen the field manual → show it once
syncMenuState();                                               // the title screen is an open menu → HUD stays out of the way
document.getElementById('boot')?.setAttribute('data-live','1');
doResize(true);                                                // size the buffer from the real canvas box before frame 1
requestAnimationFrame(()=>requestAnimationFrame(bootReady));   // two frames in → the battlefield is genuinely on screen

requestAnimationFrame(loop);
