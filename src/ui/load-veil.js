// ui/load-veil.js — NO-TANKS 8 THE DEPLOYMENT ORDER: the screen between XUẤT KÍCH and the battle (#loadVeil) is the order the soldier goes out on —
//   the battlefield's own ground under a map grid, its name, the real place and its coordinates, the hour and the sky, the operation's brief, and
//   the three steps the game really goes through (the field is built · the graphics are readied · ready), each ticked as it is done. The moving
//   parts are CSS transforms, so they keep running while the main thread is busy building the field.
import { GROUND_PHOTO, OPERATIONS } from '../../config.js';
import { BIOMES, BIOME_PLACE, PROFILE, S, TOD_LABEL, biomeVi, levelInfo, weatherDef } from '../hub.js';

// where each battlefield's real place is (degrees, minutes; B/N = north/south, Đ/T = east/west)
const COORD = { DESERT:'29°58′B 31°08′Đ', RUINS:'41°53′B 12°29′Đ', ARCTIC:'63°45′B 68°31′T', FOUNDRY:'49°15′B 6°51′Đ', CITADEL:'27°10′B 78°01′Đ',
  MEADOW:'51°53′B 4°38′Đ', CITY:'10°46′B 106°42′Đ', SAVANNA:'13°54′B 4°33′T', VOLCANO:'19°25′B 155°17′T', QUARRY:'44°05′B 10°06′Đ' };
// "GIZA · AI CẬP" → "Giza, Ai Cập"; "CHIẾN DỊCH BÃO CÁT" → "Chiến dịch Bão Cát"
const words = s => String(s || '').toLocaleLowerCase('vi').replace(/(^|[\s(.-])(\S)/g, (m, a, c) => a + c.toLocaleUpperCase('vi'));
export function placeLine(name){ const P = BIOME_PLACE[name]; return P ? P.at.split(' · ').map(words).join(', ') : ''; }
export function opTitle(op){ return op ? words(op.title).replace(/^Chiến Dịch /, 'Chiến dịch ') : ''; }
const lower = s => String(s || '').toLocaleLowerCase('vi');
const $ = id => document.getElementById(id);

// what the launch is about to build, from the same argument launchGame gets (a campaign level, a custom battle, CONTINUE)
function orderOf(arg){ let cfg = arg && typeof arg === 'object' && arg.mode ? arg : null, L;
  if(arg === true && PROFILE.save) L = (PROFILE.save.loop | 0) * 5 + (PROFILE.save.stage | 0 || 1);
  if(!cfg && !L) cfg = S.runCfg || { mode:'campaign', level:1 };
  if(cfg && cfg.mode === 'custom'){ const lv = Math.max(1, cfg.level | 0), I = levelInfo(lv); return { biome:BIOMES[cfg.biome] || I.biome, tod:cfg.tod || I.tod, wx:cfg.wx || 'clear', stage:I.stage, loop:I.loop }; }
  const I = levelInfo(L || Math.max(1, (cfg && cfg.level) | 0)); return { biome:I.biome, tod:I.tod, wx:I.wx, stage:I.stage, loop:I.loop }; }

export function veilOrder(arg){ let o; try{ o = orderOf(arg); }catch(e){ return; } if(!o || !o.biome) return;
  const name = o.biome.name, op = OPERATIONS[(o.stage - 1) % OPERATIONS.length], set = (GROUND_PHOTO.biomes[name] || [])[0];
  const g = $('lvGround'); if(g) g.style.backgroundImage = set ? 'url("assets/ground/' + set + '/diff.jpg")' : '';
  const put = (id, t) => { const e = $(id); if(e) e.textContent = t; };
  put('lvKind', 'Lệnh xuất kích' + (op ? ' — ' + opTitle(op) : ''));
  put('lvName', biomeVi(name)); put('lvPlace', placeLine(name)); put('lvCoord', COORD[name] || '');
  { const n = $('lvName'); if(n) n.style.setProperty('--len', Math.max(5, biomeVi(name).length)); }   // a long name sets itself smaller
  put('lvCond', 'Màn ' + o.stage + (o.loop ? ', vòng ' + (o.loop + 1) : '') + ' — ' + lower(TOD_LABEL[o.tod] || '') + ', ' + lower(weatherDef(o.wx).vi));
  put('lvBrief', op ? op.brief : '');
  veilStep(0); }
// k = the step under way (0 the field · 1 the graphics · 2 ready); the ones before it are ticked
export function veilStep(k){ const v = $('loadVeil'); if(!v) return; v.dataset.step = k;
  v.querySelectorAll('.lv-steps li').forEach((li, i) => { li.className = i < k ? 'done' : i === k ? 'now' : ''; }); }
