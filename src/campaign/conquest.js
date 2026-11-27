// campaign/conquest.js — CONQ 1 CHINH PHẠT 10 THÀNH (config CONQUEST; the road on the battle setup: ui/conquest-map.js). The campaign is ten forts of Hắc
//   Thiết taken in order; each fort's general guards a TREASURE the next fort needs. A fort is one battle, run as a mode of the run kit (campaign/mode-run.js,
//   run.conq = { i }): its config knobs (the fort's THREAT: more ambushes, snipers, MG nests, a horde, poison gas, thicker men, a faster titan, a thicker
//   gate, harder fire) turned for the battle and put back after; the capital's boss wears the fort's general (campaign/fort-boss.js conqBossDef).
//   THE WIN is one function, conqWon (the stage's general down: campaign/boss.js → modeStageWon) — a sector system replaces it, nothing else knows.
//   TREASURES (CONQUEST.treasures) — up to `carry` taken into a battle, picked on the briefing (the recommended one marked): passives read here
//   (thermal: marks · scale + mask: conqHurt, called by game/player-damage.js damagePlayer), skills on the skill wheel with clocks of their own (storm:
//   campaign/surprises.js's fire mission · ice: men held, a boss staggered · breach: a fort's gate blown · lava: the shield, rounds thrown back —
//   conqShieldHit from combat/lock-on.js), guns in his rack (GUNS entries made from CONQUEST: the ghost rifle's round passes thin cover, the molten
//   launcher fires a salvo that ignores heavy armour — combat/soldier-fire.js, combat/siege-rocket.js, combat/flame.js).
//   SECTOR 2 a fort's battle is a SECTOR RUN (CONQUEST.forts[i].run: its approach missions, then the general — campaign/sectors.js): begin declares it with
//   sectorBattle(run, conqWon), so the fort is taken when its LAST sector is won and nowhere else; each new sector's field gets the fort's poison clouds again (conqSectorLive).
//   PROFILE.conquest { cap, carry, sel } (conqStore); an old save's campaign reach becomes forts taken once (migrate). Probes read CQ.st.
import { CONQUEST, REAL, DIRECTOR, FORT, FORTBOSS, BALANCE, INFGUN } from '../../config.js';
import { BIOMES, FORTS, GUNS, PROFILE, RECON, S, SURP, TROOPER_SPELLS, ammoOnGive, celebrate, damageBlock, damageGate, damagePlayer, enemies, escapeHtml, fillTx, floatText, fortBossFreeze, heightAt, hide,
  knobApply, knobRefs, magCap, modeCard, modeDefine, modeKnob, modeLaunch, modeSay, modeStats, modeTime, openBattleSetup, quitToMenu, ringPulse, saveProfile, sfx, showBanner, spawnBullet,
  spawnPart, svgMarkup, tapEl, updateGunHUD, updateSpellHUD } from '../hub.js';
import { sectorBattle } from '../hub.js';   // SECTOR 2 (campaign/sectors.js)

const C = CONQUEST, Y = C.say, T = C.treasures, N = C.forts.length, NOW = () => performance.now() / 1000;
const ROOTS = { REAL, DIRECTOR, FORT, FORTBOSS, BALANCE };
// the battle as it stands (probes read st): i = the fort · on = a conquest battle is running · carry = the treasures in it
export const CQ = { on:false, i:-1, won:false, cardIn:0, carry:new Set(), gas:[], thAt:0, gasAt:0, fxAt:0, saveAt:-1e9, lavaUntil:0, lavaN:0,
  st:{ marked:0, taken:0, soaked:0, saved:0, masked:0, gasIn:0, thru:0, salvo:0, shells:0, frozen:0, breached:0, walls:0, returned:0 } };

// ---- the treasures' guns: an entry of GUNS each, made once from its base gun (never in the crates nor the arsenal: trooper false) ----
for(const id in T){ const q = T[id]; if(q.kind !== 'gun' || !GUNS[q.base] || GUNS[q.gun]) continue;
  GUNS[q.gun] = { ...GUNS[q.base], ...q.set, trooper:false, tq:id, thin:q.thin || 0 }; if(INFGUN.map[q.base]) INFGUN.map[q.gun] = INFGUN.map[q.base]; }

// ---- the save: PROFILE.conquest ----
export function conqMigrate(pr){ const c = pr && pr.campaign && typeof pr.campaign === 'object' ? pr.campaign.max | 0 : 0, sv = pr && pr.save ? ((pr.save.loop | 0) * 5 + (pr.save.stage | 0)) : 0;
  return Math.max(0, Math.min(C.migrate.cap, Math.max(c, sv) - 1)); }   // levels cleared = the level reached − 1 (a resumable checkpoint counts too)
export function conqStore(){ let q = PROFILE.conquest;
  if(!q || typeof q !== 'object'){ q = PROFILE.conquest = { cap:conqMigrate(PROFILE), carry:null, sel:-1, mig:1 }; saveProfile(true); }
  q.cap = Math.max(0, Math.min(N, q.cap | 0)); if(q.carry != null && !Array.isArray(q.carry)) q.carry = null; if(!Number.isInteger(q.sel)) q.sel = -1;
  if(q.carry) q.carry = q.carry.filter((id, k, a) => conqOwned(id, q) && a.indexOf(id) === k).slice(0, C.carry); return q; }
export function conqOwned(id, q){ const cap = (q || PROFILE.conquest || {}).cap | 0; for(let i = 0; i < cap; i++) if(C.forts[i].prize === id) return true; return false; }
export function conqOwnedList(){ const q = conqStore(), out = []; for(let i = 0; i < q.cap; i++) if(C.forts[i].prize) out.push(C.forts[i].prize); return out; }
// what fort i takes in: the saved pick, its recommended treasure added while there is room; the first time, the newest treasures
export function conqCarryFor(i){ const q = conqStore(), f = C.forts[i] || {}, own = conqOwnedList(); let c = q.carry ? q.carry.slice() : own.slice().reverse().slice(0, C.carry);
  if(f.rec && own.includes(f.rec) && !c.includes(f.rec)){ if(c.length >= C.carry) c.pop(); c.unshift(f.rec); } return c.slice(0, C.carry); }
export function conqState(i){ const q = conqStore(); return i < q.cap ? 'taken' : i === q.cap ? 'next' : 'lock'; }
export const conqFort = i => C.forts[i];
const has = id => CQ.on && CQ.carry.has(id);

// ---- a fort's battle from the map ----
export function conqLaunch(i, fromHome){ const f = C.forts[i]; if(!f || conqState(i) === 'lock') return false; const q = conqStore(); q.sel = i; saveProfile(true);
  modeLaunch({ biome:biomeIdx(f.biome), tod:f.tod, wx:f.wx, space:'wide', level:f.lvl, conq:{ i } }, fromHome); return true; }
function biomeIdx(n){ const k = BIOMES.findIndex(b => b.name === n); return k < 0 ? 0 : k; }

// ---- arming: the carried treasures into his hands and his skill wheel (the briefing's picks call it again) ----
const SPELL = {};
function spellOf(id){ return SPELL[id] || (SPELL[id] = { id:'tq_' + id, name:id.toUpperCase(), get vi(){ return T[id].name.toLocaleUpperCase('vi'); }, svg:T[id].icon, own:true, tq:id, get cd(){ return T[id].cd; }, cast(now){ return CAST[id](now); } }); }
export function conqArm(p){ if(!CQ.on) return; const want = [...CQ.carry];
  for(let k = TROOPER_SPELLS.length - 1; k >= 0; k--) if(TROOPER_SPELLS[k].tq && !(T[TROOPER_SPELLS[k].tq].kind === 'skill' && want.includes(TROOPER_SPELLS[k].tq))) TROOPER_SPELLS.splice(k, 1);
  for(const id of want) if(T[id].kind === 'skill' && !TROOPER_SPELLS.includes(spellOf(id))) TROOPER_SPELLS.push(spellOf(id));
  if(S.spell >= TROOPER_SPELLS.length) S.spell = 0; updateSpellHUD();
  if(!p || !p.guns) return; const cur = p.guns[p.gunIdx];
  for(let k = p.guns.length - 1; k >= 0; k--){ const g = GUNS[p.guns[k].id]; if(g && g.tq && !want.includes(g.tq)) p.guns.splice(k, 1); }
  for(const id of want){ const q = T[id]; if(q.kind !== 'gun' || p.guns.some(g => g.id === q.gun)) continue; p.guns.push({ id:q.gun, ammo:magCap(GUNS[q.gun]), rU:0, rD:0 }); try{ ammoOnGive(q.gun, true); }catch(e){} }
  const at = p.guns.indexOf(cur); p.gunIdx = at >= 0 ? at : 0; updateGunHUD(); }
function disarm(){ for(let k = TROOPER_SPELLS.length - 1; k >= 0; k--) if(TROOPER_SPELLS[k].tq) TROOPER_SPELLS.splice(k, 1); if(S.spell >= TROOPER_SPELLS.length) S.spell = 0;
  const p = S.player; if(p && p.guns){ for(let k = p.guns.length - 1; k >= 0; k--){ const g = GUNS[p.guns[k].id]; if(g && g.tq) p.guns.splice(k, 1); } if(p.gunIdx >= p.guns.length) p.gunIdx = 0; } }
export function conqToggle(id){ const q = conqStore(); if(!conqOwned(id, q)) return false; const c = CQ.on ? [...CQ.carry] : conqCarryFor(Math.max(0, CQ.i));
  const k = c.indexOf(id); if(k >= 0) c.splice(k, 1); else { if(c.length >= C.carry) c.shift(); c.push(id); }
  q.carry = c; saveProfile(true); if(CQ.on){ CQ.carry = new Set(c); conqArm(S.player); } return true; }

// ---- the passives ----
// game/player-damage.js damagePlayer, after his own armour: the mask takes the heat (lava, fire, gas), the scale armour a share of the rest and, once a while, the killing blow
export function conqHurt(p, dmg, now, kind){ if(!CQ.on || !(dmg > 0)) return dmg;
  if(kind === 'fire' && has('mask')){ CQ.st.masked += dmg * (1 - T.mask.fireK); dmg *= T.mask.fireK; if(!(dmg > 0)) return 0; }
  if(has('scale')){ const d = dmg * T.scale.k; CQ.st.soaked += dmg - d; dmg = d;
    if(p.hp - dmg <= 0 && now >= CQ.saveAt){ CQ.saveAt = now + T.scale.saveCd; CQ.st.saved++; dmg = Math.max(0, p.hp - T.scale.saveHp); floatText(Y.saved, '#ffd24a', p.pos, 18); ringPulse(p.pos, 0xffc24a, 2.6); sfx('clang', p.pos); } }
  CQ.st.taken += dmg; return dmg; }
function thermal(now){ const q = T.thermal, p = S.player; if(!p) return; const r2 = q.R * q.R, s2 = q.snipeR * q.snipeR;
  for(let j = 0; j < enemies.length; j++){ const e = enemies[j]; if(!e.def.inf || !(e.hp > 0) || e.rise) continue; const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d2 = dx * dx + dz * dz;
    if(d2 > r2 && !(e.role === 'marksman' && d2 < s2)) continue; if(!(e.markUntil > now)) CQ.st.marked++; e.markUntil = now + q.mark; if(e.markUntil > RECON.markedUntil) RECON.markedUntil = e.markUntil; } }
// combat/lock-on.js: a round the shield stopped — thrown back the way it came, burning
export function conqShieldHit(b, now){ if(!CQ.on || !(now < CQ.lavaUntil) || CQ.lavaN >= T.lava.retMax) return; const p = S.player; CQ.lavaN++; CQ.st.returned++;
  spawnBullet(p.pos.x, p.pos.z, Math.atan2(-b.vx, -b.vz), { owner:'p', dmg:T.lava.ret, speed:70, color:0xff6a1a, r:0.3, life:1.4, type:'FIRE', fx:'blast', knock:1.2 }); }

// ---- the skills (their own clocks; false = nothing spent) ----
function aimAt(){ const p = S.player, a = S.aimPoint; if(a && (a.x || a.z)) return { x:a.x, z:a.z }; const f = p.aimSmoothed ?? p.facing ?? 0; return { x:p.pos.x + Math.sin(f) * 24, z:p.pos.z + Math.cos(f) * 24 }; }
const CAST = {
  storm(now){ const q = T.storm, a = aimAt();
    for(let k = 0; k < q.n; k++){ const ang = Math.random() * 6.283, r = Math.sqrt(Math.random()) * q.spread; SURP.shells.push({ x:a.x + Math.cos(ang) * r, z:a.z + Math.sin(ang) * r, t:q.t0 + k * q.gap, warn:0, R:q.R, dmg:q.dmg, ours:true, pulse:0, wh:false }); }
    CQ.st.shells += q.n; showBanner(Y.storm, '#9be04a'); floatText(T.storm.name.toLocaleUpperCase('vi'), '#9be04a', S.player.pos, 15); return true; },
  ice(now){ const q = T.ice, a = aimAt(), r2 = q.R * q.R; let n = 0;
    for(const e of enemies){ if(e.def.air || !(e.hp > 0)) continue; const dx = e.pos.x - a.x, dz = e.pos.z - a.z; if(dx * dx + dz * dz > r2) continue;
      if(e.fortBoss){ fortBossFreeze(e, now, q.bossHold); n++; continue; } e.stunUntil = Math.max(e.stunUntil || 0, now + q.hold); e.frozenUntil = now + q.hold; n++; }
    CQ.st.frozen += n; const y = heightAt(a.x, a.z); ringPulse({ x:a.x, z:a.z }, 0x9fe8ff, q.R);
    for(let k = 0; k < 18; k++){ const ang = Math.random() * 6.283, r = Math.random() * q.R; spawnPart(a.x + Math.cos(ang) * r, y + 0.4, a.z + Math.sin(ang) * r, 0, 1.2 + Math.random(), 0, { color:0xd8f4ff, size:1.2 + Math.random(), life:1.6, smoke:true, grav:-0.1, drag:1.5, grow:1.4, op:0.55 }); }
    sfx('ricochet', { x:a.x, z:a.z }); floatText(fillTx(Y.frozen, { n }), '#9fe8ff', { x:a.x, y:y + 2.5, z:a.z }, 16); return true; },
  breach(now){ const q = T.breach, p = S.player; let best = null, bd = q.reach;
    for(const f of FORTS){ if(f.breached || f.captured || !f.gate) continue; const d = Math.hypot(f.gx - p.pos.x, f.gz - p.pos.z); if(d < bd){ bd = d; best = f; } }
    let wall = null; if(!best){ for(const f of FORTS){ if(f.captured || !f.pieces) continue; for(const pc of f.pieces){ if(pc.down || !pc.block) continue; const d = Math.hypot(pc.block.x - p.pos.x, pc.block.z - p.pos.z); if(d < bd){ bd = d; wall = pc; } } } }
    if(!best && !wall){ floatText(Y.noAim, '#ff9a8a', p.pos, 14); return false; }
    const x = best ? best.gx : wall.block.x, z = best ? best.gz : wall.block.z; floatText(Y.placed, '#ffcf5a', p.pos, 16); sfx('beep', p.pos);
    if(best){ damageGate(best.gate, best.gate.hp + 1); CQ.st.breached++; }
    for(const f of FORTS){ if(!f.pieces) continue; for(const pc of f.pieces){ if(pc.down || !pc.block) continue; if(Math.hypot(pc.block.x - x, pc.block.z - z) < q.wallR){ damageBlock(pc.block, 1e6); CQ.st.walls++; } } }
    return true; },
  lava(now){ const q = T.lava, p = S.player; p.invincibleUntil = Math.max(p.invincibleUntil || 0, now + q.dur); p.shieldUntil = Math.max(p.shieldUntil || 0, now + q.dur); CQ.lavaUntil = now + q.dur; CQ.lavaN = 0;
    ringPulse(p.pos, 0xff6a1a, 2.4); sfx('whoosh', p.pos); floatText(T.lava.name.toLocaleUpperCase('vi'), '#ff8a3a', p.pos, 16); return true; } };

// ---- the FOUNDRY's poison: clouds on the way in (threat.gas) ----
function gasPlace(g){ CQ.gas.length = 0; const p = S.player, cap = FORTS.find(f => f.tier === 3) || FORTS[0], tx = cap ? cap.x : 0, tz = cap ? cap.z : -p.pos.z;
  for(let k = 0; k < g.n; k++){ const u = g.from[0] + (g.from[1] - g.from[0]) * (g.n > 1 ? k / (g.n - 1) : 0.5), side = (k % 2 ? 1 : -1) * (4 + Math.random() * 8), dx = tx - p.pos.x, dz = tz - p.pos.z, L = Math.hypot(dx, dz) || 1;
    CQ.gas.push({ x:p.pos.x + dx * u + (-dz / L) * side, z:p.pos.z + dz * u + (dx / L) * side, R:g.R }); } }
function gasTick(now, g){ const p = S.player; let inside = false;
  for(const c of CQ.gas){ const y = heightAt(c.x, c.z); for(let k = 0; k < 2; k++){ const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * c.R; spawnPart(c.x + Math.cos(a) * r, y + 0.6 + Math.random(), c.z + Math.sin(a) * r, (Math.random() - 0.5) * 0.5, 0.25, (Math.random() - 0.5) * 0.5, { color:0xb8c25a, size:3.2 + Math.random() * 2, life:2.6, smoke:true, grav:-0.03, drag:0.8, grow:1.5, op:0.32 }); }
    if(p && Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < c.R) inside = true; }
  if(inside && now >= (p.invincibleUntil || 0)){ const d = g.dps * g.tick; CQ.st.gasIn += d; damagePlayer(d, now, 0, 0, 'fire'); if(now > (CQ.gasSay || 0)){ CQ.gasSay = now + 6; modeSay(Y.gas); } } }

// SECTOR 2 a new sector's field (campaign/sectors.js sectorLive): the fort's poison clouds laid on it afresh
export function conqSectorLive(){ if(!CQ.on || CQ.won) return; const th = C.forts[CQ.i].threat; if(th && th.gas) gasPlace(th.gas); }
// ---- the battle's end ----
// THE WIN CONDITION of a conquest battle: called once the fort is taken (today: the stage's general down in his citadel — campaign/boss.js bossStageWon →
//   mode-run.js modeStageWon). A battle of sectors calls this when its last sector is won; nothing else decides a fort is taken.
export function conqWon(now){ if(!CQ.on || CQ.won) return; CQ.won = true; const q = conqStore(), i = CQ.i, f = C.forts[i];
  CQ.fresh = i >= q.cap; if(CQ.fresh) q.cap = i + 1; q.sel = Math.min(i + 1, N - 1);
  if(PROFILE.campaign && typeof PROFILE.campaign === 'object') PROFILE.campaign.max = Math.max(PROFILE.campaign.max | 0, f.lvl + 1); saveProfile();   // (Tự chọn's enemy levels open as the forts fall, as the old ladder's did)
  showBanner(fillTx(Y.wonKick, { fort:f.name }).toLocaleUpperCase('vi'), '#ffd24a', true); celebrate('victory', 0, 0); sfx('levelup'); CQ.cardIn = C.next; }
function card(won){ const st = modeStats(), q = conqStore(), i = CQ.i, f = C.forts[i], P = f.prize && T[f.prize], nf = C.forts[i + 1];
  let why;
  if(won && P){ why = '<span class="cq-prize"><span class="cq-pi">' + svgMarkup(P.icon, 1.6) + '</span><span class="cq-pt"><small>' + escapeHtml(CQ.fresh ? Y.prizeTag : Y.taken) + '</small><b>' + escapeHtml(P.name) + '</b><span>' + escapeHtml(P.fx) + '</span></span></span>'
      + '<span class="cq-next">' + escapeHtml(CQ.fresh ? fillTx(Y.nextLine, { fort:nf ? nf.name : '', t:P.why }) : fillTx(Y.replay, { t:P.name })) + '</span>'; }
  else if(won) why = escapeHtml(Y.end); else why = escapeHtml(fillTx(Y.lostWhy, { fort:f.name, boss:f.boss }));
  const me = typeof document !== 'undefined' && document.getElementById('modeEnd'); if(me) me.classList.toggle('cq-won', !!(won && P));
  modeCard({ kick:fillTx(Y.fort, { n:i + 1 }) + ' · ' + fillTx(won ? Y.wonKick : Y.lostKick, { fort:f.name }), lost:!won, big:won ? Y.wonBig : Y.lost, why,
    stats:[[Y.stats[0], String(st.kills)], [Y.stats[1], Math.round(st.acc * 100) + '%'], [Y.stats[2], modeTime(st.secs)], [Y.stats[3], q.cap + '/' + N]],
    best:'', hint:won ? '' : (f.threat ? f.threat.vi + ' — ' + (f.rec ? T[f.rec].name : '') : ''), go:won ? Y.toMap : Y.retry,
    onGo:won ? () => { quitToMenu(); openBattleSetup('campaign'); } : () => conqLaunch(i) }); }

// ---- the mode (campaign/mode-run.js calls these) ----
modeDefine('conq', {
  begin(run){ const i = Math.max(0, Math.min(N - 1, (run.conq && run.conq.i) | 0)), f = C.forts[i];
    Object.assign(CQ, { on:true, i, won:false, cardIn:0, thAt:0, gasAt:0, fxAt:0, saveAt:-1e9, lavaUntil:0, lavaN:0, fresh:false, gasSay:0 }); CQ.gas.length = 0; for(const k in CQ.st) CQ.st[k] = 0;
    CQ.carry = new Set(conqCarryFor(i)); if(f.run) sectorBattle(f.run.split(' '), n => conqWon(n));   // SECTOR 2 the fort as a chain of sectors: its win comes from the last one
    const th = f.threat; if(th) for(const [path, op, x] of th.knobs){ const [root, ...rest] = String(path).replace('$d', PROFILE.difficulty || 'soldier').split('.'); if(!ROOTS[root]) continue;
      for(const [o, k] of knobRefs(ROOTS[root], rest.join('.'))) modeKnob(o, k, knobApply(o[k], op, x)); } },
  ready(p){ conqArm(p); const th = C.forts[CQ.i].threat; if(th && th.gas) gasPlace(th.gas); },
  live(){ const f = C.forts[CQ.i]; modeSay(fillTx(Y.open, { fort:f.name, boss:f.boss }), 1.2); },
  frame(dt, now){ if(CQ.won){ if(CQ.cardIn > 0 && (CQ.cardIn -= dt) <= 0) card(true); return; }
    if(has('thermal') && (CQ.thAt -= dt) <= 0){ CQ.thAt = T.thermal.tick; thermal(now); }
    const th = C.forts[CQ.i].threat; if(th && th.gas && (CQ.gasAt -= dt) <= 0){ CQ.gasAt = th.gas.tick; gasTick(now, th.gas); }
    if(now < CQ.lavaUntil && (CQ.fxAt -= dt) <= 0){ CQ.fxAt = 0.08; const p = S.player, a = Math.random() * 6.283; spawnPart(p.pos.x + Math.cos(a) * 1.3, heightAt(p.pos.x, p.pos.z) + 0.4 + Math.random() * 1.6, p.pos.z + Math.sin(a) * 1.3, 0, 1.4, 0, { tex:'fire', color:0xffd080, color2:0xff4a10, size:0.7, life:0.45, grav:0.6, drag:2, grow:0.6 }); } },
  over(){ if(!CQ.won) card(false); },
  stageWon(now){ conqWon(now); },
  pauseTx(){ const f = C.forts[CQ.i]; return fillTx(Y.fort, { n:CQ.i + 1 }) + ' · ' + f.name; },
  brief(){ const f = C.forts[CQ.i]; return { op:fillTx(Y.briefOp, { act:C.acts[f.act], fort:f.name }), brief:f.blurb + ' ' + f.go.tx + '.', obj:fillTx(Y.obj, { boss:f.boss, fort:f.name }),
    sub:'<b>' + escapeHtml(fillTx(Y.fort, { n:CQ.i + 1 }) + ' · ' + f.name) + '</b><span>Tướng giữ thành: ' + escapeHtml(f.boss) + '</span>', loot:conqLootNode() }; },
  end(){ disarm(); updateSpellHUD(); CQ.on = false; CQ.gas.length = 0; CQ.lavaUntil = 0; const me = typeof document !== 'undefined' && document.getElementById('modeEnd'); if(me) me.classList.remove('cq-won'); } });

// ---- the briefing's treasure picks (ui/briefing.js via mode-run.js modeBrief: #br-loot) ----
export function conqLootNode(){ const el = document.createElement('div'), f = C.forts[CQ.i], own = conqOwnedList(), th = f.threat, recOn = f.rec && CQ.carry.has(f.rec);
  el.className = 'cq-loot';
  let h = '<div class="br-pick"><b>' + escapeHtml(Y.carry) + ' · ' + CQ.carry.size + '/' + C.carry + '</b><span>' + escapeHtml(fillTx(Y.carryTx, { n:C.carry })) + '</span></div>';
  if(th) h += '<div class="cq-threat' + (recOn ? ' ok' : '') + '"><b>' + escapeHtml(th.vi) + '</b><span>' + escapeHtml(th.tx) + '</span><i class="cq-meter"><i style="width:' + (recOn ? 45 : 92) + '%"></i></i><em>'
    + escapeHtml(f.rec ? fillTx(recOn ? Y.threatOff : Y.threatOn, { t:T[f.rec].name }) : '') + '</em></div>';
  el.innerHTML = h; const row = document.createElement('div'); row.className = 'cq-tqs'; el.appendChild(row);
  if(!own.length){ const p = document.createElement('p'); p.className = 'cq-none'; p.textContent = Y.none; row.appendChild(p); }
  for(const id of own){ const q = T[id], c = document.createElement('div'); c.className = 'brcard cq-tq' + (CQ.carry.has(id) ? ' on' : '') + (id === f.rec ? ' rec' : ''); c.setAttribute('role', 'button'); c.dataset.tq = id;
    c.innerHTML = '<div class="ic">' + svgMarkup(q.icon, 1.6) + '</div>' + (id === f.rec ? '<div class="br-tag cq-rec">' + escapeHtml(Y.recTag) + '</div>' : '') + '<div class="nm">' + escapeHtml(q.name) + '</div><div class="ds">' + escapeHtml(q.fx) + '</div>';
    tapEl(c, () => { conqToggle(id); sfx('click'); el.replaceWith(conqLootNode()); }); row.appendChild(c); }
  return el; }
// campaign/fort-boss.js fortBossDef, the capital's: in a conquest battle he is the fort's general (his name on the bar, his look; the last fort's keeps the capital's)
export function conqBossDef(d){ if(!CQ.on) return d; const f = C.forts[CQ.i]; if(!f) return d; d.name = f.boss; if(f.look && FORTBOSS.looks[f.look]) d.lookId = f.look; d.conq = true; return d; }
