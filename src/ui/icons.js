// ui/icons.js — CUSTOM ICON SET (military line-art; no emoji)
import * as THREE from 'three';
   // current (set by applyBiome from stage or the player's pick)

// ===== CUSTOM ICON SET (military line-art; no emoji) =====
// One coherent stroke style across HUD, menus, drops and cards. currentColor lets CSS theme each.
export const ICON_VB='0 0 24 24';
export const GLYPH={
  heart:'<path d="M12 20S4 14.6 4 9.4A4.3 4.3 0 0 1 12 6.8 4.3 4.3 0 0 1 20 9.4C20 14.6 12 20 12 20Z"/>',
  bunker:'<path d="M3.5 20h17M6 20v-8.5l6-3.2 6 3.2V20"/><rect x="10" y="14.5" width="4" height="5.5"/><path d="M12 8V4M12 4l3.5 1.1L12 6.2"/>',
  tank:'<path d="M3 16.2h2.2L7 13h9l2.4 3.2H21"/><rect x="8.6" y="8.2" width="6" height="3.4" rx="1"/><path d="M14.6 9.3h5"/><circle cx="6.2" cy="17.6" r="1.4"/><circle cx="10" cy="17.6" r="1.4"/><circle cx="13.8" cy="17.6" r="1.4"/>',
  dash:'<path d="M4 7l5 5-5 5M11 7l5 5-5 5"/>',
  bolt:'<path d="M13 2 5 13h5l-1 9 9-12h-5l1-8Z"/>',
  shield:'<path d="M12 3 5 5.8v5.2c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V5.8L12 3Z"/>',
  burst:'<path d="M12 2l2 5 5-2-2 5 4 2-5 1 1 5-4-3-4 3 1-5-5-1 4-2-2-5 5 2 2-5Z"/>',
  infinity:'<circle cx="8" cy="12" r="3.6"/><circle cx="16" cy="12" r="3.6"/>',
  target:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  crosshair:'<circle cx="12" cy="12" r="6.4"/><path d="M12 1.6v4.4M12 18v4.4M1.6 12h4.4M18 12h4.4"/>',
  mag:'<rect x="8.4" y="3" width="7.2" height="4.6" rx="1"/><path d="M9 7.6h6V18a3 3 0 0 1-6 0V7.6Z"/><path d="M9 11h6M9 14h6"/>',
  wrench:'<path d="M20.5 4.2a4.8 4.8 0 0 1-6.2 6.2l-8 8a2 2 0 0 1-2.8-2.8l8-8A4.8 4.8 0 0 1 17.6 1.5l-2.8 2.8 1.9 1.9 2.8-2.8Z"/>',
  bomb:'<circle cx="11" cy="15" r="5.8"/><path d="M15 9.5l2.2-2.2M17.2 7.3H20M17.2 7.3V4.6"/>',
  snow:'<path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2L3.8 16.8"/><path d="M12 6l-2.4-1.6M12 6l2.4-1.6M12 18l-2.4 1.6M12 18l2.4 1.6"/>',
  sound:'<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4Z"/><path d="M15.5 8.6a4.6 4.6 0 0 1 0 6.8M18 6a8 8 0 0 1 0 12"/>',
  mute:'<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4Z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  music:'<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',   // Z111 background music on
  musicOff:'<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/><path d="M3.5 3.5l17 17"/>',
  pause:'<rect x="6.5" y="5" width="3.4" height="14" rx="1"/><rect x="14.1" y="5" width="3.4" height="14" rx="1"/>',
  hourglass:'<path d="M6 3.2h12M6 20.8h12M7.5 3.2c0 4.6 4.5 5.8 4.5 8.8s-4.5 4.2-4.5 8.8M16.5 3.2c0 4.6-4.5 5.8-4.5 8.8s4.5 4.2 4.5 8.8"/>',
  emp:'<circle cx="12" cy="12" r="2"/><path d="M12 5.5a6.5 6.5 0 0 1 6.5 6.5M12 5.5A6.5 6.5 0 0 0 5.5 12M12 18.5a6.5 6.5 0 0 1-6.5-6.5M12 18.5a6.5 6.5 0 0 0 6.5-6.5"/>',
  shell:'<path d="M12 2.4c1.9 1.7 2.5 3.4 2.5 5.1V10h-5V7.5c0-1.7.6-3.4 2.5-5.1Z"/><rect x="9.2" y="10" width="5.6" height="9.6" rx="1"/><path d="M9.2 13.4h5.6M9.2 16.4h5.6"/>',
  rifle:'<path d="M3 9.4h15.5l2.5 1.1v2.2h-4l-1 2h-3l-1-2H3z"/><path d="M6 12.7v3M18.5 10.5V8"/>',
  carbine:'<path d="M2 11.5l3-1.5h14l3 .8v1.4H14l-1.2 3.3h-2.3l.6-3.3H7L4.5 14H2z"/><path d="M19 10V8.6"/>',
  pkm:'<path d="M2 11l3-1.2h15l2 .7v1.3h-8l-1 1.4H9l-.6-1.4H5L3.5 13H2z"/><path d="M8 12.2l-1.6 3.6M10.5 12.2l1 3.4M19.5 9.8V8.4"/>',   // Z329 the soldier's arsenal: PKM on its bipod
  ak:'<path d="M2 11.2l2.6-1h13.6l3.3.7v1.3h-7.6l-1 1.3H8.6l-1 1.7H5.2l1-1.7H2z"/><path d="M11.2 12.5c.2 1.4.8 2.6 1.7 3.5M19.4 10.2V8.8"/>',   // Z355 AK-47: the curved magazine
  m4:'<path d="M1.6 11.4h4l1.4-1h10.5v1.6h-4.2l-.8 3.2h-2l.4-3.2H7.8l-1.7 2.4H3.9l1-2.4H1.6z"/><path d="M17.5 10.7h4.6M9.4 9.4h3.2"/>',   // Z355 M4: the suppressor and the optic on top
  mp5:'<path d="M3.2 11.3l2.2-.8h11.4l1.8.6v1.3h-5.2l-.6 3.3h-1.9l.4-3.3H8.8l-.7 1.5H6.2l.5-1.5H3.2z"/><path d="M18.6 11.2h2.4M5.4 10.5l-1.8-1.3"/>',   // Z355 MP5: short, stubby muzzle, collapsed stock
  rustAr:'<path d="M1.8 11.3l2.4-1h12.6l3.4.6v1.4h-7.4l-.8 3.4h-2.2l.4-3.4H8.4l-1.5 2.2H4.6l1.2-2.2H1.8z"/><rect x="9.2" y="8.2" width="4.6" height="1.8" rx=".8"/><path d="M20.2 10.6h1.8"/>',   // Z387 the rust-iron rifle: scope, curved mag
  dmr:'<path d="M1.6 11.6h16l4 .5v1h-8.6l-1 2.6h-2l.4-2.6H5.4l-2 1.8H1.6z"/><rect x="7.4" y="8" width="6.4" height="2.2" rx="1"/><path d="M15 12.6l-.4 2"/>',   // Z387 the marksman's rifle: the long scope, a box mag
  railH:'<path d="M1.6 11.4h18.6l2 .6v.8H13l-1 2.6h-2l.4-2.6H5.2l-2.2 1.7H1.6z"/><path d="M6 10.4c1-1.2 2-1.2 3 0s2 1.2 3 0 2-1.2 3 0"/><rect x="9" y="8" width="4" height="1.4" rx=".6"/>',   // Z387 the rail rifle: its coils
  saw:'<path d="M2 12.2l2.2-.9h8.6v1.8H9.4l-.8 2.6H6.4l.6-2.6H2z"/><circle cx="17" cy="11.4" r="3.6"/><circle cx="17" cy="11.4" r="1"/>',   // Z387 the saw launcher: its blade
  minigunH:'<path d="M3 9.5h12M3 11h12M3 12.5h12"/><rect x="15" y="8.6" width="4.5" height="4.8" rx="1"/><path d="M19.5 11h2.5M16.5 13.4v2.6"/>',   // hand-held rotary barrels
  shotgunH:'<path d="M2.5 10h16M2.5 12h16"/><path d="M18.5 10l3 .6v1.8l-3 .6M6 12v2.6h3V12"/>',   // pump shotgun, the fore-end slide
  sniper:'<path d="M1.5 11.5h17.5l3 .6v1H14l-1 2.6h-2l.4-2.6H5l-2 1.6H1.5z"/><rect x="8" y="8" width="6" height="2.2" rx="1"/><path d="M9.5 10.2v1.3M12.5 10.2v1.3"/>',   // 12.7 with its scope
  b41:'<path d="M3 11h13M3 13h13"/><path d="M16 9.4l5 2.6-5 2.6z"/><path d="M7 13v2.8M10 13v2.8"/>',   // the RPG tube and its rocket head
  m79:'<rect x="4" y="9.4" width="9" height="3.6" rx="1.4"/><path d="M13 10.2h7.5v2H13M7 13l-1.4 3.4h2.4l.8-3.4"/>',   // stubby break-open grenade launcher
  flamerH:'<path d="M3 11.5h11v1.6H3z"/><rect x="5" y="13.1" width="5" height="3.4" rx="1.2"/><path d="M14 11.5c2 0 2.5-2.5 4-2.5-.5 1.2.6 2 1.8 1.4-.4 1.6-1.2 2.7-3 2.7"/>',   // the hand flamer with its tank and a tongue of fire
  arc:'<path d="M3 11h11v2H3z"/><path d="M14 12l2.5-2.5 1.2 2 2.3-2.8M14 12l2.6 2.6 1.1-1.8 2.3 2.7"/>',   // the energy rifle's forked arc   // Z306 the soldier's rifle: stock, magazine, front sight
  smg:'<path d="M4 9.4h10.5v2.6h-2.5l-1 1.8H7.5l-1-1.8H4z"/><path d="M7.5 12v3.4M12.5 9.4V7.6"/>',
  shotgun:'<path d="M3 9.6h17.5M3 12.4h17.5"/><path d="M3 9.6v2.8M20.5 8.8v4.4"/><path d="M6 12.4v3"/>',
  flak:'<path d="M5 19l8-8"/><path d="M3 17.2l1.8 1.8 1.8-1.8"/><path d="M11 13l2.4 2.4"/><circle cx="17.5" cy="6.5" r="1.1"/><circle cx="20.5" cy="9.5" r="1.1"/><circle cx="14.6" cy="4.2" r="1.1"/>',
  minigun:'<circle cx="8" cy="12" r="4.6"/><circle cx="8" cy="12" r="1.2"/><circle cx="8" cy="8.2" r="0.8"/><circle cx="8" cy="15.8" r="0.8"/><circle cx="4.4" cy="12" r="0.8"/><path d="M12.6 10.4H21M12.6 12H21M12.6 13.6H20"/>',
  missile:'<path d="M12 2.2c2.2 2.3 3 4.9 3 7.6V15H9V9.8c0-2.7.8-5.3 3-7.6Z"/><path d="M9 13l-3 3.6 3-1M15 13l3 3.6-3-1M10.8 19h2.4l-1.2 2.6z"/>',
  rail:'<path d="M3 7.2h18M3 16.8h18"/><path d="M14 5.4l-4.5 6.6h4.5l-4.5 6.6"/>',
  drop:'<path d="M12 3.2s5.6 6.8 5.6 10.6a5.6 5.6 0 0 1-11.2 0C6.4 10 12 3.2 12 3.2Z"/>',
  up:'<path d="M5 13.5l7-7 7 7M5 19l7-7 7 7"/>',
  gun:'<path d="M4 8.6h13l3 1.6v2.6h-5l-1 2.4H9l-1-2.4H4z"/><path d="M7 13.4v3"/>',
  star:'<path d="M12 3l2.5 6.4L21 10l-5 4.4L17.5 21 12 17.4 6.5 21 8 14.4 3 10l6.5-.6L12 3Z"/>',
  coin:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.4"/><path d="M12 9.2v5.6"/>',
  diamond:'<path d="M12 3 4 9.6 12 21l8-11.4L12 3Z"/><path d="M4 9.6h16M9 3.6 7 9.6l5 11.4M15 3.6l2 6 -5 11.4"/>',
  spark:'<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6.5 6.5l3 3M14.5 14.5l3 3M17.5 6.5l-3 3M9.5 14.5l-3 3"/>',
  rotate:'<rect x="8" y="3" width="8" height="18" rx="2"/><circle cx="12" cy="18" r="0.7"/><path d="M18.6 8.6a8 8 0 0 0-7-4.6M18.6 8.6 19 5.9M18.6 8.6 15.9 8.9"/>',
  swap:'<path d="M4 8h12l-3-3M4 8l3 3M20 16H8l3 3M20 16l-3-3"/>',
  expand:'<path d="M4 10V4h6M20 10V4h-6M4 14v6h6M20 14v6h-6"/>',
  compress:'<path d="M10 4v6H4M14 4v6h6M10 20v-6H4M14 20v-6h6"/>',
  alert:'<path d="M12 3 1.8 20.5h20.4L12 3Z"/><path d="M12 9.5v4.8"/><path d="M12 17.4v.7"/>',
  pack:'<path d="M8.5 8V6.8a3.5 3.5 0 0 1 7 0V8"/><rect x="5.5" y="8" width="13" height="12.5" rx="2.4"/><path d="M5.5 13.5h13M10 13.5v2.6h4v-2.6"/>',   // SUPPLY 2 the load he carries (a pack)
  eyeOpen:'<path d="M2 12s3.7-6.5 10-6.5S22 12 22 12s-3.7 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.9"/>', eyeHalf:'<path d="M2 12s3.7-6.5 10-6.5S22 12 22 12s-3.7 6.5-10 6.5S2 12 2 12Z"/><path d="M4.2 10.4h15.6"/><path d="M9.3 12.4a2.8 2.8 0 0 0 5.4 0"/>', eyeShut:'<path d="M2.5 10.5s3.5 5 9.5 5 9.5-5 9.5-5"/><path d="M5.6 13.9 4.2 16.2M9.6 15.3 9 17.9M14.4 15.3l.6 2.6M18.4 13.9l1.4 2.3"/>',   // SUPPLY 3 the unseen eye: seen / suspected / unseen
  drone:'<circle cx="12" cy="12" r="2.6"/><circle cx="5.5" cy="6.5" r="2"/><circle cx="18.5" cy="6.5" r="2"/><path d="M7 8l3 2.4M17 8l-3 2.4M12 14.6V18M9.5 18.4h5"/>',
  fpv:'<circle cx="5.5" cy="6" r="2.2"/><circle cx="18.5" cy="6" r="2.2"/><path d="M7.2 7.6l2.6 2.2M16.8 7.6l-2.6 2.2"/><rect x="9.8" y="9.4" width="4.4" height="3.6" rx="1"/><path d="M12 13v5.2M9.6 18.2 12 22l2.4-3.8Z"/>',   // DRONE 2 a quadcopter with its charge
  jam:'<path d="M12 21V11.2"/><circle cx="12" cy="9.2" r="1.7"/><path d="M8 13.4a5.8 5.8 0 0 1 0-8.4M16 5a5.8 5.8 0 0 1 0 8.4M5 16.2a10 10 0 0 1 0-14M19 2.2a10 10 0 0 1 0 14"/>',   // DRONE 3 an aerial throwing rings
  smoke:'<circle cx="8" cy="14" r="4"/><circle cx="14.5" cy="11" r="5"/><circle cx="17" cy="16.5" r="3.4"/>',
  aps:'<path d="M12 3 5 5.8v5.2c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V5.8L12 3Z"/><path d="M8.5 12h7M12 8.5v7"/>',
  team:'<circle cx="8" cy="7" r="2.4"/><circle cx="16" cy="7" r="2.4"/><path d="M3.5 19v-3.4c0-2.2 2-3.8 4.5-3.8s4.5 1.6 4.5 3.8V19M11.5 19v-3.4c0-2.2 2-3.8 4.5-3.8s4.5 1.6 4.5 3.8V19"/>',
  mine:'<ellipse cx="12" cy="14" rx="8" ry="3.4"/><path d="M4 14v1.6c0 1.9 3.6 3.4 8 3.4s8-1.5 8-3.4V14"/><circle cx="12" cy="12.2" r="1.2"/>',
  agl:'<rect x="3" y="9" width="10" height="5" rx="1"/><path d="M13 10.2h7v2.6h-7"/><circle cx="7.5" cy="17" r="2.6"/><path d="M6 9V7h4v2"/>',
  thermo:'<rect x="3" y="8" width="13" height="8" rx="1.2"/><circle cx="7" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><path d="M16 10l5-2v8l-5-2"/>',
  cannon:'<rect x="2.5" y="10" width="7" height="5" rx="1.2"/><path d="M9.5 11.6h9v1.8h-9"/><rect x="18.4" y="10.7" width="3.1" height="3.6" rx=".6"/><path d="M3.5 17.6h5.5"/>',   // Z150 distinct glyph per gun
  hesh:'<path d="M8 4.5h8M9 4.5v2.2c0 .9.4 1.7 1 2.3h4c.6-.6 1-1.4 1-2.3V4.5"/><rect x="9.2" y="9" width="5.6" height="10.6" rx="1"/><path d="M9.2 12.6h5.6M9.2 16h5.6"/>',
  mortar:'<path d="M6.2 17.6 15.2 6.4M8.6 19.4l9-11.2M14.6 5.5l3.6 2.9"/><path d="M3.5 20.5h9.5M11.2 13.4l3 7"/>',
  howitzer:'<path d="M7.4 13.6 19 6.4l1.1 1.8L8.6 15.4"/><circle cx="8.2" cy="17.4" r="3"/><path d="M10.9 16.4l8.6 3.6M3 20.6h2.6"/>',
  flame:'<path d="M2.5 10.8h5.6v3.4H2.5zM8.1 11.6h2.4v1.8H8.1"/><path d="M10.5 12.5c2.6-.6 3.8-2.6 3.5-5 2.4 1.4 3.7 3.3 3.5 5.4 1.3-.5 2-1.5 2.1-2.8 1.3 1.6 1.7 3.6.9 5.5-1 2.3-3.7 3.6-6.3 3.1-1.8-.3-3.2-1.4-3.7-3"/>',
  orbital:'<circle cx="12" cy="17.5" r="3.2"/><path d="M12 2v12M8.5 17.5h-3M18.5 17.5h-3M12 21v1.5"/><path d="M9 4.5h6"/>',
  plasma:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  hydra:'<path d="M4 20 8 8M12 21V6M20 20 16 8"/><path d="M6.5 7.5 8 4.5l1.5 3M10.5 5.5 12 2.5l1.5 3M14.5 7.5 16 4.5l1.5 3"/>',
  blackhole:'<circle cx="12" cy="12" r="2.6"/><path d="M12 5.5c4.5 0 6.5 3 6.5 6.5M12 18.5c-4.5 0-6.5-3-6.5-6.5M5.5 9c1-3 4-4.5 7-4M18.5 15c-1 3-4 4.5-7 4"/>',
  photon:'<path d="M2.5 12h4M17.5 12h4"/><rect x="6.5" y="9" width="11" height="6" rx="1.2"/><path d="M9.5 9v6M12.5 9v6"/>',
  rocket:'<path d="M12 2.5c2.3 1.7 3.4 4.6 3.4 8l-1 5h-4.8l-1-5c0-3.4 1.1-6.3 3.4-8Z"/><path d="M9.6 13.5 6.6 16.5l2.2.2M14.4 13.5l3 3-2.2.2"/><path d="M10.6 18.5h2.8l-1.4 3Z"/><circle cx="12" cy="8.5" r="1"/>',
  // XK-UI menu glyphs: back, play, home, settings, help, the key sheet, start over
  back:'<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  play:'<path d="M8.5 5.5v13l9.5-6.5-9.5-6.5Z"/>',
  home:'<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5.5h4V20"/>',
  gear:'<path d="M19.1 10.6 21.5 10.8 21.5 13.2 19.1 13.4 18 16 19.6 17.9 17.9 19.6 16 18 13.4 19.1 13.2 21.5 10.8 21.5 10.6 19.1 8 18 6.1 19.6 4.4 17.9 6 16 4.9 13.4 2.5 13.2 2.5 10.8 4.9 10.6 6 8 4.4 6.1 6.1 4.4 8 6 10.6 4.9 10.8 2.5 13.2 2.5 13.4 4.9 16 6 17.9 4.4 19.6 6.1 18 8Z"/><circle cx="12" cy="12" r="3"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2-2.4 3.6"/><path d="M12 17.2v.3"/>',
  keys:'<rect x="2.5" y="6.5" width="19" height="11" rx="1.6"/><path d="M6 10h1M9.5 10h1M13 10h1M16.5 10h1.5M6 13.6h1M17 13.6h1M9.5 13.8h5"/>',
  undo:'<path d="M8.5 5 4.5 9l4 4"/><path d="M4.5 9h9a5.5 5.5 0 0 1 0 11H9"/>',
  // CONQ 1 the conquest's road (a fort, our flag, a lock) and its nine treasures (config CONQUEST.treasures[id].icon)
  fort:'<path d="M3.5 20h17M5 20V9h2.5v2H10V9h4v2h2.5V9H19v11"/><path d="M10 20v-4.5a2 2 0 0 1 4 0V20"/>',
  flag:'<path d="M6 21V3.5"/><path d="M6 4h11l-2.4 3.6L17 11H6"/>',
  lock:'<rect x="5.5" y="10.5" width="13" height="10" rx="1.4"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3M12 14.5v2.4"/>',
  tqThermal:'<circle cx="7.5" cy="13" r="3.6"/><circle cx="16.5" cy="13" r="3.6"/><path d="M11.1 12.4h1.8M3.9 12.4 2.5 9.5M20.1 12.4l1.4-2.9"/><path d="M6 13h3M15 13h3M7.5 11.5v3M16.5 11.5v3"/>',
  tqScale:'<path d="M12 3 5 5.8v5.2c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V5.8L12 3Z"/><path d="M8 9.5a2 2 0 0 0 4 0 2 2 0 0 0 4 0M8 13.5a2 2 0 0 0 4 0 2 2 0 0 0 4 0M10 17a2 2 0 0 0 4 0"/>',
  tqGhost:'<path d="M2.5 14.5h12l2-1.5h5M6 14.5l-1.5 3.5M14 13V10.5h-4"/><circle cx="12" cy="9" r="1.4"/><path d="M17 9.5c1-1.6 2.6-2.4 4.5-2.4M15.5 7c.8-2.2 2.6-3.5 5-3.5"/>',
  tqStorm:'<rect x="7" y="8" width="8" height="13" rx="1.2"/><path d="M9.5 8V3M9.5 12h3M9.5 15h3"/><path d="M17.5 4.5a5 5 0 0 1 0 6M19.8 2.5a8 8 0 0 1 0 10"/><path d="M12.5 16.5l-1.5 2.4h2l-1.5 2.4"/>',
  tqMask:'<path d="M4.5 8.5C6 5.5 9 4 12 4s6 1.5 7.5 4.5L18 14l-3 2.5H9L6 14 4.5 8.5Z"/><circle cx="9" cy="10" r="1.8"/><circle cx="15" cy="10" r="1.8"/><rect x="9.8" y="16.5" width="4.4" height="4" rx="1"/><path d="M11 18.5h2"/>',
  tqMolten:'<path d="M2.5 13.5h7l2-2h4.5v4h-4.5l-2-2"/><path d="M6 13.5v3.5"/><circle cx="19" cy="7" r="1.6"/><circle cx="21" cy="11" r="1.2"/><circle cx="18.5" cy="12.6" r="1"/><path d="M16 13.5c1.5-.4 2.2-1.6 2.4-3.4"/>',
  tqIce:'<path d="M12 2.5 19.5 7v10L12 21.5 4.5 17V7L12 2.5Z"/><path d="M12 7v10M8 9.5l8 5M16 9.5l-8 5"/>',
  tqBreach:'<rect x="4" y="9" width="11" height="9" rx="1"/><path d="M4 12.5h11M4 15.5h11M8 9v3.5M11 12.5v3"/><path d="M15 11l2.5-2.5M17.5 8.5l1-2.5M17.5 8.5l2.6-.6M19.5 13.5l2 .5M18.8 16.2l1.6 1.3"/>',
  tqLava:'<path d="M12 3 5 5.8v5.2c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V5.8L12 3Z"/><path d="M12 7.5c-1.8 2.2-2.8 3.8-2.8 5.3a2.8 2.8 0 0 0 5.6 0c0-1-.6-2-1.4-2.9-.2 1-.7 1.6-1.4 1.8.4-1.3.3-2.7 0-4.2Z"/>',
};
export function svgMarkup(name, sw){
  const g=GLYPH[name]||GLYPH.spark;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+ICON_VB+'" fill="none" stroke="currentColor" stroke-width="'+(sw||1.9)+'" stroke-linecap="round" stroke-linejoin="round">'+g+'</svg>';
}
export function iconEl(name){ const el=new DOMParser().parseFromString(svgMarkup(name),'image/svg+xml').documentElement; el.setAttribute('aria-hidden','true'); return el; }
export function setIcon(el,name){ if(el) el.replaceChildren(iconEl(name)); }
export function initIcons(){ document.querySelectorAll('[data-icon]').forEach(el=>setIcon(el, el.getAttribute('data-icon'))); }
// power-up world badge: recoloured icon on a dark disc (cached per name+colour)
export const _iconTexCache={};
// Z370 the plain glyph a pickup shows over itself: the icon in white with a soft dark shadow (no disc, no coloured ring — the ring on the ground carries the rarity)
const _glyphCache={};
export function svgGlyphTex(name){ if(_glyphCache[name]) return _glyphCache[name];
  const SZ=128, c=document.createElement('canvas'); c.width=c.height=SZ; const x=c.getContext('2d'), tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; _glyphCache[name]=tex;
  const img=new Image(); img.onload=()=>{ x.clearRect(0,0,SZ,SZ); x.shadowColor='rgba(0,0,0,0.75)'; x.shadowBlur=10; const isz=SZ*0.7; x.drawImage(img,(SZ-isz)/2,(SZ-isz)/2,isz,isz); x.shadowBlur=0; x.drawImage(img,(SZ-isz)/2,(SZ-isz)/2,isz,isz); tex.needsUpdate=true; };
  img.src='data:image/svg+xml;base64,'+btoa(svgMarkup(name,2.4).replace('stroke="currentColor"','stroke="#f4f1e6"')); return tex; }
export function svgBadgeTex(name,color){
  const key=name+'|'+color; if(_iconTexCache[key]) return _iconTexCache[key];
  const SZ=128, c=document.createElement('canvas'); c.width=c.height=SZ; const x=c.getContext('2d');
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; _iconTexCache[key]=tex;
  const img=new Image();
  img.onload=()=>{ x.clearRect(0,0,SZ,SZ);
    x.beginPath(); x.arc(SZ/2,SZ/2,SZ*0.45,0,Math.PI*2); x.fillStyle='rgba(8,12,6,0.85)'; x.fill();
    x.lineWidth=7; x.strokeStyle=color; x.stroke();
    const isz=SZ*0.58; x.drawImage(img,(SZ-isz)/2,(SZ-isz)/2,isz,isz); tex.needsUpdate=true; };
  img.src='data:image/svg+xml;base64,'+btoa(svgMarkup(name,2.3).replace('stroke="currentColor"','stroke="'+color+'"'));
  return tex;
}
