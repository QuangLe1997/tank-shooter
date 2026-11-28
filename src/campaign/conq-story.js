// campaign/conq-story.js — SECTOR 6 THE CONQUEST'S STORY, FORT BY FORT (config.js CONQSTORY · text only). A fort's battle is a sector run (campaign/sectors.js):
//   conquest's begin hands it this fort's hooks (cqStoryHooks → sectorStory) — the OPENING lines over the field before the first sector (sectors.js shows them,
//   ui/sector-hud.js sectorStoryCard), the line on the radio as each sector goes live / is won, and the fort's BEATS during a sector the first time the fort is
//   fought. Radio lines go through campaign/story.js storyCue (its cast, its tags, its queue) on one pool re-filled per line. The CLOSING lines show over the field
//   once the fort falls (before the treasure screen); the last fort ends on THE ENDING (cqEnding): the epilogue paragraph by paragraph, the credits, then the
//   conquest map with its ten flags. The five-operation campaign story (STORY.stages) is untouched: this speaks only in a conquest battle.
import { CONQSTORY, STORY } from '../../config.js';
import { S, escapeHtml, medalHush, openBattleSetup, quitToMenu, sectorStoryCard, sfx, storyCue } from '../hub.js';

const C = CONQSTORY, keys = c => c ? [c.type + ':' + c.obj, c.type] : [];
const lineFor = (map, c) => { if(!map) return null; for(const k of keys(c)) if(map[k]) return map[k]; return null; };
// one radio line through the story's own net: must = said now (p 4) · else queued after q s (p 3) like STORY's beats
function say(line, must, q){ STORY.lines.cq_story = { p:must ? 4 : 3, q:q || 0, t:[line] }; return storyCue('cq_story', null, !!must); }
export const CQS = { i:-1, fresh:false, said:[], closeAt:0 };
// conquest's begin: fort i's hooks for the run (fresh: the fort not taken yet — its beats are heard only then)
export function cqStoryHooks(i, fresh){ const F = C.on && C.forts[i]; CQS.i = i; CQS.fresh = !!fresh; CQS.said.length = 0; if(!F) return null;
  return { open:F.open,
    go(c){ const l = lineFor(F.go, c); if(l){ say(l, true); CQS.said.push('go:' + c.type); }
      const B = CQS.fresh && lineFor(F.beats, c), T = STORY.beat; if(B) B.forEach((b, j) => { say(b, false, T.first + j * T.next); CQS.said.push('beat:' + c.type); }); },
    won(c){ const l = lineFor(F.won, c); if(l){ say(l, true); CQS.said.push('won:' + c.type); } } }; }
// the fort fell: its two closing lines over the field (s they take — the treasure screen waits for them)
export function cqStoryClose(i){ const F = C.on && C.forts[i]; if(!F || !F.close) return 0; const n = F.close.length, T = C.closeT / n;
  F.close.forEach((l, k) => setTimeout(() => sectorStoryCard({ line:l, i:k, n }), k * T * 1000)); setTimeout(() => sectorStoryCard(null), C.closeT * 1000); CQS.closeAt = performance.now();
  return C.closeT; }

// ---- THE ENDING (the last fort taken) ----
let _end = null;
export function cqEnding(){ if(typeof document === 'undefined') return false; const E = C.ending; if(!E) return false; if(_end) _end.remove();
  const d = _end = document.createElement('div'); d.id = 'cqEnding'; d.className = 'overlay';
  d.innerHTML = '<div class="ce-in"><p class="ce-kick">CHINH PHẠT 10 THÀNH</p><h2 class="ce-ttl">' + escapeHtml(E.title) + '</h2><div class="ce-paras">' + E.paras.map(p => '<p>' + escapeHtml(p) + '</p>').join('') + '</div>' +
    '<div class="ce-roll">' + E.credits.map((t, k) => '<p' + (k ? '' : ' class="top"') + '>' + escapeHtml(t) + '</p>').join('') + '</div><p class="ce-hint">' + escapeHtml(E.skip) + '</p>' +
    '<button class="xb xb-pri ce-go hidden" data-pad>' + escapeHtml(E.go) + '</button></div>';
  S.mode = 'gameover'; S.firing = false; try{ medalHush(); }catch(e){}   // HUDUX 5 the world stops behind the ending (it fought on 150 s: FPV, alarms, pickups)
  document.body.appendChild(d); const P = [...d.querySelectorAll('.ce-paras p')], roll = d.querySelector('.ce-roll'), go = d.querySelector('.ce-go'), hint = d.querySelector('.ce-hint'); let k = -1, t = 0;
  const next = () => { k++; if(k < P.length){ P.forEach((p, j) => p.classList.toggle('on', j === k)); P.forEach((p, j) => p.classList.toggle('past', j < k)); clearTimeout(t); t = setTimeout(next, E.paraT * 1000); return; }
    if(k === P.length){ d.classList.add('roll'); roll.classList.add('on'); clearTimeout(t); t = setTimeout(next, 6000); return; }
    hint.classList.add('hidden'); go.classList.remove('hidden'); try{ go.focus(); }catch(e){} };
  const key = e => { if(e.key === 'Enter' || e.key === ' '){ if(!go.classList.contains('hidden')) return; e.preventDefault(); next(); } };
  addEventListener('keydown', key, true); d.addEventListener('click', e => { if(e.target !== go) next(); });
  go.addEventListener('click', () => { clearTimeout(t); removeEventListener('keydown', key, true); d.remove(); _end = null; quitToMenu(); openBattleSetup('campaign'); });
  sfx('levelup'); next(); return true; }
export const cqEndingShown = () => !!(_end && _end.isConnected);
