// campaign/general-duel.js — Z353 THE GENERAL ON FOOT (no-tanks: the stage's boss fight): the general waits in his citadel and takes the field with his
//   bodyguards when the soldier comes for him. The duel decides the stage (campaign/boss.js startBoss hands over the stage-won half and gets it back when he
//   falls). He is a man, but a big one: a gold star over his head, a red ring pulsing under him, his name on the boss bar. He keeps his distance and his cover
//   like any rifleman (actors/infantry.js), with a heavy rifle, and two moves of his own, both warned: a FAN of rounds across you (a red glint and a "!" first)
//   and a CLUTCH OF GRENADES round where you stand (a shout of "LỰU ĐẠN!" and the bombs in the air — Z403 no red rings). No single hit takes more than a slice of his health. At half
//   health he calls more guards; below a third he goes for broke — faster fire, faster feet. When he falls his guards break and run, he drops the best guns
//   on the field and a medal, and the stage is won.
//   NEMESIS 1–3 (campaign/nemesis.js): he remembers the player — his rank, scar and lesson change the numbers he fights by (C = nemTune), a general at large
//   joins him when he calls his guards, and when the killing blow is turned into an escape (e.nemFlee) the duel still ends won: fallen(true).
import * as THREE from 'three';
import { NEMESIS, TROOPER } from '../../config.js';
import { S, bigExplode, blastAllies, clampFieldXZ, damagePlayer, disposeArtZone, enemies, floatText, makeArtLock, radio, ringPulse, sfx, showBanner, spawnBullet, spawnEnemy, spawnPart, storyCue, svgBadgeTex, tickArtLock, nemDress, nemFell, nemGuard, nemJoin, nemMeet, nemPlateEl, nemReset, nemTick, nemTune } from '../hub.js';

const G = { on:false, seq:0, e:null, name:'', guards:[], called:false, rage:false, fanAt:0, fanT:0, nadeAt:0, ringAt:0, zones:[], finish:null, at:null, pending:0, barK:'' };
const C = () => nemTune(TROOPER.general);   // NEMESIS 2 a general who came back fights by his rank and his lesson
const NOW = () => performance.now() / 1000;
const _m = new THREE.Vector3();
export function duelOn(){ return G.on; }
export function duelMan(){ return G.on ? G.e : null; }   // NEMESIS 1 the general on the field (none while he is still coming out, none once he is down or running)
export function duelReset(){ for(const z of G.zones) disposeArtZone(z.zone); G.zones.length = 0; G.on = false; G.e = null; G.guards = []; G.finish = null; G.pending = 0; G.seq++; nemReset(); bar(false); }   // (seq: a stage-won call still pending belongs to the duel that is gone)
// startBoss: the general takes the field at pos. finish(now) = the stage-won half, played when he falls
export function generalStart(pos, def, finish){ if(!S.player) return false; duelReset();
  Object.assign(G, { on:true, finish, id:(def && def.id) || '', name:(def && def.name) || 'TƯỚNG ĐỊCH', at:{ x:pos.x, z:pos.z }, pending:NOW() + 1.4, called:false, rage:false, guards:[] });
  showBanner(G.name + ' RA TRẬN!', '#ff9a4a'); sfx('alarm');
  radio('SCH: ' + G.name + ' cùng cận vệ đã ra khỏi hầm chỉ huy! Hạ hắn đi, đừng để hắn thoát!'); storyCue('general', G.id); nemMeet(G.id, G.name); return true; }
export function duelId(){ return G.on ? G.id : ''; }   // (the music's general theme)
function spawnGeneral(){ const c = C(), p = S.player, ax = G.at.x, az = G.at.z, a = Math.atan2(p.pos.x - ax, p.pos.z - az) + (Math.random() - 0.5) * 1.4;
  const [x, z] = clampFieldXZ(ax + Math.sin(a) * 4.5, az + Math.cos(a) * 4.5, 4), e = spawnEnemy('rifle', x, z);
  e.general = true; e.loot = false; e.def = { ...e.def, dmg:c.dmg, fireCd:c.fireCd, range:c.range, keep:c.keep, speed:c.speed, score:3000 };
  e.maxHp = e.hp = Math.round(e.maxHp * c.hpK); e.hitCap = e.maxHp * c.hitCap; e.mesh.scale.multiplyScalar(c.scale); if(e.bar) e.bar.g.scale.setScalar(1.25);
  const star = new THREE.Sprite(new THREE.SpriteMaterial({ map:svgBadgeTex('star', '#ffd24a'), transparent:true, depthWrite:false }));
  star.name = 'eliteFX'; star.scale.set(0.5, 0.5, 1); star.position.y = 2.3; e.mesh.add(star);   // (killEnemy / the mesh pool strip 'eliteFX')
  G.e = e; nemDress(e); const t = NOW(); G.fanAt = t + 3; G.nadeAt = t + 5; G.fanT = 0; G.ringAt = 0;
  bigExplode({ x, z }, 0xffa050, 0.5); floatText(G.name, '#ff9a4a', { x, y:3.2, z }, 22); guards(c.guards); bar(true); }
function guards(n){ const e = G.e, c = C(); for(let i = 0; i < n; i++){ const a = Math.random() * 6.283, r = (2.5 + Math.random() * 3.5) * (c.spreadK || 1);
    const [x, z] = clampFieldXZ(e.pos.x + Math.cos(a) * r, e.pos.z + Math.sin(a) * r, 4), g = spawnEnemy(i % 3 === 2 ? 'rpg' : 'rifle', x, z);
    g.genGuard = true; g.maxHp = g.hp = Math.round(g.maxHp * c.guardHpK); g.def = { ...g.def, dmg:g.def.dmg * 1.4 }; g.loot = Math.random() < 0.3; nemGuard(g); G.guards.push(g); } }
function bar(on){ const bb = document.getElementById('bossbar'); if(!bb) return; bb.style.display = on ? 'block' : 'none'; G.barK = '';
  if(on){ const nm = document.getElementById('boss-name'); if(nm) nemPlateEl(nm, G.id, G.name); } }   // NEMESIS 3 his stars, his kill marks, his scar (no history: "<name> · BỘ CHIẾN" as before)
function hud(e){ const hp = document.getElementById('boss-hp'); if(hp) hp.style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
  const live = G.guards.filter(g => enemies.includes(g)).length, k = (G.rage ? 'r' : '') + live, st = document.getElementById('boss-st');
  if(st && G.barK !== k){ G.barK = k; st.textContent = ''; const b = document.createElement('b'); b.className = G.rage ? 'vu' : 'sh'; b.textContent = G.rage ? 'LIỀU MẠNG!' : 'CẬN VỆ · ' + live; st.appendChild(b); } }
// once a frame in battle
export function updateGeneralDuel(dt){ nemTick(); if(!G.on) return; const t = NOW(), p = S.player; if(!p) return;
  if(G.pending){ if(t < G.pending) return; G.pending = 0; spawnGeneral(); return; }
  tickZones(dt, t); const e = G.e; if(!e) return;
  if(e.nemFlee || !enemies.includes(e)){ fallen(!!e.nemFlee); return; }   // NEMESIS 1 (nemFlee: the blow that would have killed him became his escape)
  hud(e); const c = C(), f = e.hp / e.maxHp, d = Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
  if(t > G.ringAt){ ringPulse(e.pos, G.rage ? 0xff2a1a : 0xff6a3a, 2.4); G.ringAt = t + (G.rage ? 0.7 : 1.3); }
  if(!G.called && f < c.callAt){ G.called = true; guards(c.callN); showBanner('TƯỚNG GỌI CẬN VỆ!', '#ff9a4a'); radio(G.name + ': Cận vệ đâu! Giết thằng lính đó cho ta!'); sfx('alarm'); storyCue('general_half', G.id); nemJoin(e); }
  if(!G.rage && f < c.rageAt){ G.rage = true; e.def = { ...e.def, fireCd:e.def.fireCd * c.rageFire, speed:e.def.speed * c.rageRun }; showBanner('TƯỚNG LIỀU MẠNG!', '#ff4a3a'); storyCue('general_rage', G.id) || radio(G.name + ': Ta chưa thua đâu!'); }
  if(G.fanT > 0){ G.fanT -= dt; glint(e); if(G.fanT <= 0) fan(e); }
  else if(t > G.fanAt && d < c.range){ G.fanT = c.fan.tel; G.fanAt = t + c.fan.cd * (G.rage ? 0.7 : 1); sfx('beep', e.pos); floatText('!', '#ff4a3a', { x:e.pos.x, y:3, z:e.pos.z }, 26); }
  if(t > G.nadeAt && d < 26 && G.fanT <= 0){ G.nadeAt = t + c.nade.cd * (G.rage ? 0.75 : 1); nades(e); } }
function muzzle(e){ const m = e.mesh.userData.muzzle; if(m) m.getWorldPosition(_m); else _m.set(e.pos.x, 1.4, e.pos.z); return _m; }
function glint(e){ if(Math.random() < 0.6){ const m = muzzle(e); spawnPart(m.x, m.y, m.z, 0, 0, 0, { tex:'flash', color:0xff3a2a, size:0.6 + Math.random() * 0.4, life:0.06, grav:0, drag:0 }); } }
// the fan: a spray of rounds across where you stand
function fan(e){ const F = C().fan, p = S.player, m = muzzle(e), a0 = Math.atan2(p.pos.x - m.x, p.pos.z - m.z), dmg = F.dmg * (1 + 0.15 * ((S.stage || 1) - 1));
  for(let i = 0; i < F.n; i++){ const a = a0 + (i / (F.n - 1) - 0.5) * F.arc + (Math.random() - 0.5) * 0.04;
    spawnBullet(m.x, m.z, a, { owner:'e', inf:true, dmg, speed:52, color:0xffb050, r:0.26, trailK:2, life:1.6, maxDist:C().range + 4, noArc:true, y:m.y, dropTo:1.3 }); }
  spawnPart(m.x, m.y, m.z, Math.sin(a0) * 6, 0.4, Math.cos(a0) * 6, { tex:'flash', color:0xfff0c0, size:0.9, life:0.08, grav:0, drag:8 }); sfx('rifleShot', e.pos); sfx('rifleShot', e.pos, 0.7); }
// the grenades: lobbed round where you stand, each a red ring that tightens until it bursts
function nades(e){ const N = C().nade, p = S.player, m = muzzle(e), dmg = N.dmg * (1 + 0.15 * ((S.stage || 1) - 1));
  floatText('LỰU ĐẠN!', '#ff9a4a', { x:e.pos.x, y:2.8, z:e.pos.z }, 16); sfx('whoosh', e.pos);
  for(let i = 0; i < N.n; i++){ const a = Math.random() * 6.283, r = i === 0 ? 0.5 : 1.6 + Math.random() * N.scatter, T = N.lock + i * 0.2;
    const [x, z] = clampFieldXZ(p.pos.x + Math.cos(a) * r, p.pos.z + Math.sin(a) * r, 2);
    spawnPart(m.x, m.y, m.z, (x - m.x) / T, 0.5 * 14 * T, (z - m.z) / T, { color:0x3a4020, size:0.2, life:T, grav:-14, drag:0 });
    G.zones.push({ x, z, R:N.R, t:T, T, dmg, zone:makeArtLock(x, z, N.R, N.R * 0.4) }); } }
function tickZones(dt, t){ for(let i = G.zones.length - 1; i >= 0; i--){ const s = G.zones[i]; s.t -= dt; tickArtLock(s.zone, 1 - Math.max(0, s.t) / s.T, null, t, dt);
  if(s.t > 0) continue; disposeArtZone(s.zone); G.zones.splice(i, 1);
  bigExplode({ x:s.x, z:s.z }, 0xffb060, 0.55); sfx('boom', { x:s.x, z:s.z }, 0.7); blastAllies(s.x, s.z, s.R, s.dmg);
  const p = S.player; if(!p) continue; const dx = p.pos.x - s.x, dz = p.pos.z - s.z, d = Math.hypot(dx, dz); if(d < s.R) damagePlayer(s.dmg * (1 - 0.6 * d / s.R), t, dx || 0.01, dz, 'blast'); } }
// he is down: his guards break and run (no longer in reach, no longer firing), slow motion, then the stage is won.
//   NEMESIS 1 fled: he got away instead — his guards go with him, the duel holds the field (no wave, the finale's phase) for NEMESIS.escape.winDelay s while he
//   runs, and the stage is won all the same
function fallen(fled){ G.e = null; bar(false); S.timeScale = fled ? 0.6 : 0.35; sfx(fled ? 'alarm' : 'levelup');
  if(fled) showBanner(G.name + ' TẨU THOÁT!', '#ff9a4a');
  else { showBanner('ĐÃ HẠ ' + G.name + '!', '#ffd24a'); nemFell() || storyCue('general_down', G.id) || radio('SCH: ' + G.name + ' đã gục! Bọn cận vệ tan rã — trận này là của anh!'); }
  for(const g of G.guards) if(enemies.includes(g)){ g.def = { ...g.def, range:0, keep:90, speed:g.def.speed * 1.3 }; g.genGuard = false; floatText(fled ? 'CHE CHO TƯỚNG!' : 'BỎ CHẠY!', '#e0e0d0', { x:g.pos.x, y:2.4, z:g.pos.z }, 13); }
  for(const z of G.zones) disposeArtZone(z.zone); G.zones.length = 0;
  const fin = G.finish, k = G.seq; G.finish = null; G.on = !!fled;
  setTimeout(() => { if(G.seq !== k) return; G.on = false; if(fin && S.mode !== 'gameover') fin(NOW()); }, fled ? NEMESIS.escape.winDelay * 1000 : 1400); }
