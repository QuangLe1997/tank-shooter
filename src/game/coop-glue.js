// game/coop-glue.js — COOP 4–7 THE GAME'S SIDE OF TWO-PLAYER CO-OP (the net layer is src/net/*; the screen ui/coop-lobby.js; the other soldier game/coop-remote.js;
// the enemy game/coop-puppets.js). With ?room=CODE in the address: the lobby instead of the home screen (COOP 4), both pages launch the same battle and compare what
// they built, the 3-2-1 waits for both; every frame each page sends its soldier and draws the other's (COOP 5); the host sends the enemy and the guest draws it and
// reports his hits (COOP 6); a player at no health is DOWN until the other stands him up, both down = the stage is lost (COOP 7). Without ?room= coopBoot() returns
// at its first line and CO.on stays false: every hook in the game is behind CO.on / coopActive() / a field only co-op sets, so single player runs as before.
import { CAV, COOP, COOP2 } from '../../config.js';
import { ambushGuestCut, bladeSwing, coopBladeCode, bladeHeld, CT, carrySlung, coopDmgNote, coopDroneById, coopTeamEvent, coopTeamKeys, coopTeamProbe, coopTeamReset, coopTeamTick, coopWorldEvent, coopWorldProbe, coopWorldReset, coopWorldTick, droneHurt, DICE, fieldSteps, modeSeed, ARENA, BIOMES, CV, DIR, FORTS, GUNS, MATE, SIDEM, MOBILE, NET_CUE, NET_EV, NET_HASH0, NET_PFLAG, NET_STANCE, PROFILE, PUPS, S, TREES, blocks, bloodSpurt, celebrate, climbing, coopBegin, coopBroadcast, coopClashFatal, coopDownEnter, coopDownStep, coopEnemyById, coopEventAllowed, coopFocusPick, coopFrame, coopGuestBlast, coopGuestDeath, coopGuestNade, coopGuestPlay, coopHitOf, coopHitP, coopHostEntities, coopInfo, coopInputDue, coopJudgeHit, coopLedger, coopLine, coopLobbyClash, coopLobbyHide, coopLobbyOpen, coopLobbyShow, coopOnEvent, coopOnField, coopOnPeer, coopOnSay, coopOnSettings, coopOnState, coopParseUrl, coopPlaying, coopPuppetsClear, coopReviveShow, coopSample, coopSay, coopScoreAB, coopScoreOf, coopSeedUrl, coopSendEvent, coopSendInput, coopSession, coopSetFieldHash, coopSetReady, coopSetSettings, coopSnapDue, coopStart, coopStop, coopTrustWeapon, coopWarn, damageEnemy, damagePlayer, gameOver, heightAt, hide, launchGame, makeCoopDown, makeCoopTrust, mateClear, mateGunId, mateGunIndex, mateProxy, mateRange, mateRideCode, mateUpdate, netFramePlayer, netHashStep, netRand, openUpgrade, quitToMenu, radio, showBanner, towers, updateHUD, victory, clearEnemyMissiles, clearHeliDown, clearHelis, clearInfDead, clearLootBeacons, clearSquads, enemies, enemyPool, freeEnemyBar, applyBiome, buildBlocks, buildObjective, buildLava, buildUnderground, buildTrails, groundMaps, rockSet } from '../hub.js';
import { swimNet } from '../hub.js';   // SWIM 1 (game/swim.js)
import { fortBossCue } from '../hub.js';   // BOSS 1 (campaign/fort-boss.js)

// what the page knows of the room (dev probes read it): on = a room was joined · live = the battle is on and the other is with us · ai = on the host the enemy
// regards both players · puppet = on the guest the enemy is the host's · the stage each side stands at the gate of · counters
export const CO = { on:false, host:false, me:0, live:false, ai:false, puppet:false, error:'', down:makeCoopDown(), gd:makeCoopDown(), led:-1, ledMax:1, holdUntil:0, safeUntil:0, trust:makeCoopTrust(), drops:0, dropWhy:'', gate:0, mateGate:0, go:0, gateAt:0, fieldOk:null, field:0, parts:[0, 0, 0, 0, 0, 0, 0, 0, 0], tag:'', lost:false, lostSent:false, scoreAt:0, score:-1, wave:-1, phase:'',
  hurtOut:0, hurtIn:0, hitsIn:0, deaths:0, says:0, mark:'', bytes:0, snaps:0, mute:false, t0:0, sampleAt:-1, sample:null, battle:null, link:'', err:0, lastErr:'' };
const PH = ['build', 'peak', 'release', 'finale'], _me = { id:0, x:0, y:0, z:0, heading:0, aimYaw:0, aimPitch:0, vx:0, vz:0, stance:0, weapon:0, flags:0, hp:0, hpMax:0, mount:0 }, _mi = { present:false, down:false, dist:0 }, _hit = { dmg:0, heavy:false }, _q = { now:0, dmg:0, heavy:false, weapon:0, enemyAlive:false, dist:0, gunDmg:0, gunRange:0, gunHeavy:false, guestDown:false }, _j = { ok:false, dmg:0, heavy:false, why:'' };
function drop(why){ CO.drops++; CO.dropWhy = why; }   // a message this page may not act on: counted, never thrown
function fail(e){ CO.err++; CO.lastErr = String(e && e.message || e).slice(0, 200); if(CO.err <= 3) console.warn('coop:', e); }
const REASON = { 'no-room':'Không có phòng này: chủ phòng chưa vào, hoặc mã phòng sai.', 'room-full':'Phòng đã đủ hai người.', 'bad-request':'Địa chỉ phòng không hợp lệ.', 'version':'Hai máy chạy hai phiên bản game khác nhau — tải lại trang ở cả hai máy.',
  'same-role':'Phòng đã có người giữ vai này (hai trang cùng là chủ phòng / cùng là khách).', 'peer-lost':'Mất kết nối với người chơi kia.', 'host-restarted':'Chủ phòng đã tải lại trang — trận cũ không còn.', 'link-lost':'Mất kết nối tới máy chủ phòng.',
  'refused':'Máy chủ phòng từ chối kết nối.', 'left':'Người chơi kia đã rời phòng.', 'mix':'Điện thoại và máy tính chưa chơi chung được: hai máy dựng chiến trường khác cỡ. Hãy dùng hai máy cùng loại.' };

// ================= COOP 4: THE LOBBY =================
function myBuild(){ return { mobile:MOBILE, arena:ARENA, quality:PROFILE.quality || 'high' }; }
function model(){ const I = coopInfo() || {}, co = coopSession(), b = I.battle && I.battle.biome ? I.battle : CO.battle, clash = !CO.host && I.battle ? coopLobbyClash(myBuild(), I.battle) : '';
  return { room:I.room || '', host:CO.host, me:co ? co.name : '', peer:I.peerName || '', peerIn:!!I.peer, ready:!!I.ready, peerReady:!!I.peerReady, canReady:I.state === 'lobby' || I.state === 'ready', canStart:CO.host && I.state === 'ready', battle:b, seed:I.seed || (globalThis.__seed >>> 0) || 0,
    rtt:I.rtt || 0, error:CO.error, link:CO.host ? CO.link : '', biomes:BIOMES.map(x => x.name),
    note:!I.peer ? (CO.host ? 'Chờ người thứ hai mở đường link bên dưới.' : 'Đang chờ chủ phòng…') : clash === 'quality' ? 'Lưu ý: hai máy đặt chất lượng hình khác nhau — nếu chiến trường lệch, game sẽ báo.' : I.state === 'ready' ? (CO.host ? 'Cả hai đã sẵn sàng — bấm Bắt đầu.' : 'Chờ chủ phòng bấm Bắt đầu…') : 'Chờ cả hai bấm Sẵn sàng.' }; }
const CB = { ready(){ const I = coopInfo(); if(I) coopSetReady(!I.ready); render(); }, start(){ coopBegin(); },
  leave(){ coopStop('left'); try{ location.href = location.pathname; }catch(e){} },
  pick(k, v){ if(!CO.host || !CO.battle) return; CO.battle[k] = k === 'level' ? Math.max(1, Math.min(COOP.lobby.levelMax, v | 0)) : String(v); coopSetSettings({ seed:globalThis.__seed >>> 0, battle:CO.battle }); render(); } };
function render(){ if(!CO.on || (CO.live && !CO.error)) return; try{ coopLobbyShow(model(), CB); }catch(e){ fail(e); } }
// called once by game/startup.js. No ?room= in the address → false, and nothing of co-op exists on the page.
export function coopBoot(){ if(typeof location === 'undefined' || typeof document === 'undefined') return false; const q = coopParseUrl(location.search); if(!q) return false;
  if(q.host && !(globalThis.__seed > 0)){ location.replace(coopSeedUrl(location.href, 1 + Math.floor(netRand() * 2147483000))); return true; }   // (the seed is read before any module runs: the host's page comes back with one)
  const co = coopStart({ name:q.name || PROFILE.nickname || (q.host ? 'CHỦ PHÒNG' : 'KHÁCH') }); if(!co) return false;
  CO.on = true; CO.host = co.isHost; CO.me = CO.host ? COOP.ids.host : COOP.ids.guest; CO.t0 = performance.now(); try{ coopTeamKeys(); }catch(e){ fail(e); }   // (COOP 9 the ping's and the magazine's keys exist from here on)
  coopOnState(onState); coopOnSettings(onSettings); coopOnPeer(() => { render(); if(CO.live) coopWarn(coopInfo().peer ? '' : 'Mất liên lạc với đồng đội — đang chờ nối lại…'); }); coopOnField(onField); coopOnEvent(onEvent); coopOnSay((t, key) => { if(CO.host){ drop('say'); return; } CO.says++; try{ radio(String(t), /^[\w-]{1,24}$/.test(key) ? key : undefined); }catch(e){} });   // (the radio is the host's: a guest's line is dropped)
  if(CO.host){ const bi = BIOMES[Math.max(0, Math.min(BIOMES.length - 1, PROFILE.terrain | 0))] || BIOMES[0];
    CO.battle = Object.assign({ biome:bi.name, level:1, tod:'noon', wx:'clear' }, myBuild()); coopSetSettings({ seed:globalThis.__seed >>> 0, battle:CO.battle });
    try{ fetch('/lan-room/info').then(r => r.json()).then(j => { if(j && j.ips && j.ips.length){ CO.link = 'Máy thứ hai mở: http://' + j.ips[0] + ':' + j.port + '/?room=' + coopInfo().room + '&seed=' + (globalThis.__seed >>> 0); render(); } }).catch(() => {}); }catch(e){} }
  render(); setInterval(() => { if(coopLobbyOpen()) render(); }, 1000); return true; }
// the host's choice arrives on the guest: another seed → this page comes back with it (once); a phone with a desktop → refused, in words
function onSettings(seed, battle){ if(CO.host){ render(); return; }
  CO.battle = battle;
  if(seed && seed === (globalThis.__seed >>> 0)){ try{ sessionStorage.removeItem('coop-seed'); }catch(e){} }
  if(seed && seed !== (globalThis.__seed >>> 0)){ let was = ''; try{ was = sessionStorage.getItem('coop-seed') || ''; }catch(e){}
    if(was === String(seed)){ CO.error = 'Không đặt được seed ' + seed + ' cho trang này — hãy mở đúng đường link chủ phòng đưa.'; render(); return; }
    try{ sessionStorage.setItem('coop-seed', String(seed)); }catch(e){} coopStop('left'); location.replace(coopSeedUrl(location.href, seed)); return; }
  const clash = coopLobbyClash(myBuild(), battle); if(coopClashFatal(clash)){ CO.error = REASON.mix; coopStop('mix'); }
  render(); }
function onState(state, was, reason){
  if(state === 'playing'){ if(reason === 'resume' && CO.live) return; startBattle(); return; }
  if(state === 'ended'){ const inBattle = CO.live; CO.live = CO.ai = CO.puppet = false; if(!CO.error) CO.error = REASON[reason] || ('Phòng đã đóng (' + reason + ').');
    try{ mateClear(); coopTeamReset(); coopLine(''); if(CO.down.on) standUp(performance.now() / 1000, true); }catch(e){ fail(e); }
    if(inBattle && CO.host){ coopWarn('Đồng đội đã rời — bạn đánh tiếp một mình.'); CO.on = false; return; }   // (the battle was the host's: it goes on, single-handed)
    if(inBattle){ try{ coopPuppetsClear(); quitToMenu(); }catch(e){ fail(e); } }   // (the guest's enemy was the host's: nothing is left to fight)
    coopWarn(''); CO.live = false; try{ coopLobbyShow(model(), CB); }catch(e){ fail(e); } return; }
  render(); }
// both pages: the battle agreed in the lobby, through the game's own launch (the veil, the build, the intro, the briefing)
function startBattle(){ const b = (coopInfo() || {}).battle || {}; CO.live = true; CO.error = ''; CO.puppet = !CO.host && !!COOP.puppets; CO.ai = CO.host && !!COOP.puppets; CO.gate = CO.mateGate = CO.go = 0; CO.lost = CO.lostSent = false; CO.down.on = false; CO.score = CO.wave = -1; CO.fieldOk = null; CO.trust = makeCoopTrust(); CO.drops = 0; CO.bytes = CO.snaps = 0; coopTeamReset();
  coopLobbyHide(); coopWarn(''); for(const id of ['start', 'nick', 'battleSetup', 'guide']){ const o = document.getElementById(id); if(o && !o.classList.contains('hidden')) hide(id); }
  launchGame({ mode:'custom', biome:Math.max(0, BIOMES.findIndex(x => x.name === b.biome)), tod:b.tod || 'noon', wx:b.wx || 'clear', space:'wide', level:Math.max(1, b.level | 0) }); }
// ---- the same land? a fingerprint of what this page built (game/flow.js startGame and loot/upgrades.js chooseUpgrade call it once the field stands) ----
// (CO.parts keeps the running value after the heights / the cover / the towers / the forts / the trees: when two pages differ, which part did)
export function coopFieldPrint(){ let h = NET_HASH0; const n = 16, R = ARENA * 0.9, Q = CO.parts;
  for(let i = 0; i < n; i++) for(let j = 0; j < n; j++) h = netHashStep(h, Math.round(heightAt((i / (n - 1) * 2 - 1) * R, (j / (n - 1) * 2 - 1) * R) * 20)); Q[0] = h;
  h = netHashStep(h, blocks.length); for(let i = 0; i < blocks.length; i++){ const b = blocks[i], k = String(b.kind || ''); h = netHashStep(h, Math.round(b.x * 10)); h = netHashStep(h, Math.round(b.z * 10)); for(let c = 0; c < k.length; c++) h = netHashStep(h, k.charCodeAt(c)); } Q[1] = h; Q[5] = blocks.length;
  h = netHashStep(h, towers.length); for(let i = 0; i < towers.length; i++){ h = netHashStep(h, Math.round(towers[i].x * 10)); h = netHashStep(h, Math.round(towers[i].z * 10)); } Q[2] = h; Q[6] = towers.length;
  h = netHashStep(h, FORTS.length); for(let i = 0; i < FORTS.length; i++){ h = netHashStep(h, Math.round(FORTS[i].x * 10)); h = netHashStep(h, Math.round(FORTS[i].z * 10)); } Q[3] = h; Q[7] = FORTS.length;
  h = netHashStep(h, TREES.length); Q[4] = h; Q[8] = TREES.length; return h; }
// THE SAME DICE FOR EVERY STEP OF A BUILD (coopBuildField below, and world/biome.js applyBiome before its scatter; nothing without a live room): each builder starts from its own seed (stage, step), so one that draws a different number of times on the two pages — it looked at what the
// LAST battle left standing, and that differs between the page that fought it and the page that watched — cannot shift the builders after it
export function coopSeedStep(k){ if(!CO.live || !globalThis.__reseed) return; globalThis.__reseed(S.stage * 64 + k); }
// the co-op build of a battlefield (game/flow.js startGame, loot/upgrades.js chooseUpgrade call it in place of their own line — THE SAME BUILDERS IN THE SAME ORDER:
// test.js compares the two lists): next = the stage after a fight (its enemy cleared first)
export function coopBuildField(stage, next){ if(next) coopPreBuild(); warmLand(); coopSeedStep(0); applyBiome(stage); coopSeedStep(2); buildBlocks(); coopSeedStep(3); modeSeed(16); buildObjective(); coopSeedStep(4); modeSeed(17); buildLava(); coopSeedStep(5); modeSeed(18); buildUnderground(); coopSeedStep(6); modeSeed(19); buildTrails(); modeSeed(20); coopFieldBuilt(); }
// what a page makes once per land and keeps (its rock shapes, its ground maps) is made BEFORE the dice are set: a page that already had this land's — it was its
// menu's backdrop — must not draw fewer numbers in the build than one that had not
function warmLand(){ try{ const R = S.run || {}, b = BIOMES[Math.min(Math.max(0, R.biome | 0), BIOMES.length - 1)]; rockSet(b.name); groundMaps(b); }catch(e){ fail(e); } }
// before the next stage is built: nothing of the last fight's enemy is left on either page (the host's survivors, the guest's puppets) — a builder that counts
// the men on the field, or places a garrison, sees the same empty field on both
function coopPreBuild(){ if(!CO.live) return; try{ coopPuppetsClear(); for(const e of enemies){ e.mesh.visible = false; (enemyPool[e.type] = enemyPool[e.type] || []).push(e.mesh); freeEnemyBar(e.bar); e.bar = null; }
    enemies.length = 0; clearSquads(); clearHelis(); clearEnemyMissiles(); clearInfDead(); clearHeliDown(); clearLootBeacons(); }catch(e){ fail(e); } }
export function coopFieldBuilt(){ if(!CO.on) return; try{ CO.field = coopFieldPrint(); CO.tag = 'stage ' + S.stage; CO.gate = CO.go = 0; CO.gateAt = 0; CO.lost = CO.lostSent = false; coopPuppetsClear(); coopWorldReset(); coopTeamReset(); resetDown(); if(CO.live) coopSetFieldHash(CO.field, CO.tag);   // (COOP 9 the blocks and towers get their ids here: the list both pages just fingerprinted)
    if(!CO.host && S.player){ const p = S.player; p.pos.x += COOP.mate.spawnGap; p.mesh.position.x = p.pos.x; if(CV.hPos) CV.hPos.x = p.pos.x; } }catch(e){ fail(e); } }   // (the guest beside the host, not inside him)
// a new field (the next stage, the battle again): whoever was down is on his feet
function resetDown(){ const D = CO.down, p = S.player; CO.gd.on = false; CO.gd.k = 0; CO.gd.lost = false; CO.led = -1; CO.holdUntil = CO.safeUntil = 0; if(p && (D.on || p.downed)){ p.downed = false; p.invincibleUntil = 0; if(!(p.hp > 0)) p.hp = Math.max(1, Math.round(p.maxHp * COOP.down.hpK)); CV.want = 'stand'; } D.on = false; D.k = 0; D.lost = false; MATE.revive = 0; coopLine(''); }
function onField(same){ CO.fieldOk = same; if(!same && DICE.trace) console.warn('coop field steps (' + (CO.host ? 'host' : 'guest') + ', ' + CO.tag + '): ' + fieldSteps().map(s => s.k + ':' + s.draws + ':' + s.hash).join(' '));   // SYNC 1 with ?fieldtrace on both pages: the two lines side by side name the builder step they part at (core/dice.js)
  coopWarn(same ? '' : '⚠ Hai máy dựng hai chiến trường KHÁC nhau — địch và vật cản có thể lệch chỗ. Nên rời phòng, kiểm tra cùng phiên bản / cùng loại máy rồi vào lại.'); }
// ---- the 3-2-1 waits for both (ui/briefing.js updateCountdown asks every frame once its own count is done): true = go live now ----
export function coopGate(){ if(!CO.live) return true; const now = performance.now() / 1000, I = coopInfo();
  if(CO.gate !== S.stage){ CO.gate = S.stage; CO.gateAt = now; coopSendEvent(NET_EV.CUE, CO.me, S.stage, 0, 0, 0, NET_CUE.GATE); }
  if(CO.go === S.stage) return true; if(!I || !I.peer || now - CO.gateAt > COOP.lobby.gateWaitS){ CO.go = S.stage; return true; }   // (alone, or the other never came: the fight starts)
  if(CO.host && CO.mateGate === S.stage){ CO.go = S.stage; coopSendEvent(NET_EV.CUE, CO.me, S.stage, 0, 0, 0, NET_CUE.GO); return true; }
  return false; }

// ================= COOP 5: EACH PAGE SENDS ITS SOLDIER =================
function myState(now){ const p = S.player, F = NET_PFLAG, T = NET_STANCE, m = _me, inst = p.guns && p.guns[p.gunIdx], mounted = CV.mounted && !CV.trans && !CV.dead; m.id = CO.me;
  m.x = p.pos.x; m.z = p.pos.z; m.y = p.mesh.position.y; m.heading = mounted ? CV.facing : p.facing; m.aimYaw = p.aimSmoothed; m.vx = p.vel.x; m.vz = p.vel.z;
  { const ax = S.aimPoint.x, az = S.aimPoint.z, d = Math.hypot(ax - p.pos.x, az - p.pos.z); m.aimPitch = S.pointerActive && d > 2 ? Math.max(-0.6, Math.min(0.6, Math.atan2(heightAt(ax, az) + 1.1 - (m.y + 1.4), d))) : 0; }   // (towards chest height at the spot he aims at)
  m.stance = mounted ? (p.bike ? T.PILLION : T.HORSE) : climbing() ? T.CLIMB : CV.stance === 'prone' ? T.PRONE : CV.stance === 'crouch' ? T.CROUCH : T.STAND; if(m.stance === T.STAND && carrySlung()) m.stance |= T.SLUNG;   /* CARRY 1 his rifle on his back (actors/gun-carry.js) */ if(!(m.stance & 15) && bladeHeld()) m.stance |= T.BLADE;   /* BLADE 3 his blade in his hands (actors/blade.js) */ m.weapon = inst ? mateGunIndex(inst.id) : 0;
  if(!mounted) m.stance |= swimNet();   // SWIM 1 two more bits: swimming, under the water (game/swim.js)
  m.flags = (S.firing && S.mode === 'playing' && inst && !inst.rU && now - (p.fireAt || 0) < 0.6 || S.mode === 'playing' && bladeSwing() ? F.FIRING : 0) | (inst && inst.rU ? F.RELOADING : 0) | (mounted ? F.MOUNTED : 0) | (CO.down.on ? F.DOWNED : 0) | (CV.aimUp ? F.AIMING : 0)
    | (!mounted && Math.hypot(p.vel.x, p.vel.z) > CAV.foot.run + 0.4 ? F.SPRINT : 0) | (CV.jump ? F.AIRBORNE : 0) | (S.mode === 'dying' || CV.dead ? F.DEAD : 0);
  m.hp = Math.max(0, p.hp); m.hpMax = p.maxHp; m.mount = mateRideCode(p); return m; }
function sampleNow(nowMs){ if(CO.sampleAt !== nowMs){ CO.sampleAt = nowMs; CO.sample = coopSample(nowMs); } return CO.sample; }
// game/loop.js, every frame, whatever the mode: this page's soldier out, the other's in and drawn, the host's snapshot of the enemy, down / revive, the mirrors
export function coopTick(dt, now, nowMs){ if(!CO.live || !coopPlaying() || !S.player) return;
  try{
    const inField = S.mode === 'playing' || S.mode === 'countdown' || S.mode === 'dying' || S.mode === 'paused';
    if(CO.host){ if(coopSnapDue(nowMs)){ const f = coopFrame(); netFramePlayer(f, myState(now)); if(CO.ai && inField) coopHostEntities(f, now); const nb = coopBroadcast(f); if(nb){ CO.bytes += nb; CO.snaps++; } mirrors(now); } }
    else if(coopInputDue(nowMs)) CO.bytes += coopSendInput(myState(now));
    const o = sampleNow(nowMs), st = o && o.np > 0 && o.pl[0].id ? o.pl[0] : null, I = coopInfo();
    mateUpdate(dt, now, inField || S.mode === 'intro' ? st : null, I ? I.peerName : '');
    if(CO.host) guestLedger(dt, now, st, !!(I && I.peer)); downTick(dt, now, !!(I && I.peer));
    if(CO.ai && inField) coopWorldTick(dt, now); coopTeamTick(dt, now);   // COOP 9 what changed in the shared world goes out · COOP 9 pings, the director's pick, a magazine in the air
  }catch(e){ fail(e); } }
// game/loop.js: on the guest (COOP.puppets) the fight's frame is the puppet one — true = it ran, the single-player updates are skipped
export function coopGuestFrame(dt, now, nowMs){ if(!CO.puppet || !CO.live) return false; try{ coopGuestPlay(dt, now, sampleNow(nowMs)); }catch(e){ fail(e); } return true; }

// ================= COOP 6: ONE BATTLE =================
// the host's numbers the guest's HUD shows: the score, the wave, the director's phase (music, radio)
function mirrors(now){ if(now < CO.scoreAt) return; CO.scoreAt = now + 0.5;
  if(S.score !== CO.score){ CO.score = S.score; const ab = coopScoreAB(S.score); coopSendEvent(NET_EV.CUE, ab[0], ab[1], 0, 0, 0, NET_CUE.SCORE); }
  if(S.wave !== CO.wave){ CO.wave = S.wave; coopSendEvent(NET_EV.CUE, S.wave | 0, 0, 0, 0, 0, NET_CUE.WAVE); }
  if(DIR.phase !== CO.phase){ CO.phase = DIR.phase; coopSendEvent(NET_EV.CUE, Math.max(0, PH.indexOf(DIR.phase)), 0, 0, 0, 0, NET_CUE.PHASE); }
  { const M = SIDEM.cur, on = M && M.state === 'go' ? 1 : 0, k = on ? Math.round(M.x) + ',' + Math.round(M.z) : ''; if(k !== CO.mark){ CO.mark = k; coopSendEvent(NET_EV.MARK, on, 0, on ? M.x : 0, 0, on ? M.z : 0, 0); } } }   // the side mission's place, for the guest's map
// an event from the other page. The gate first (net/rules.js coopEventAllowed): the HOST acts only on a hit report against an enemy and on "I am at the gate";
// the GUEST acts on the host's word for everything else. What does not pass is dropped and counted — it never throws into the loop.
function onEvent(type, a, b, x, y, z, p){ try{ const now = performance.now() / 1000;
    if(!coopEventAllowed(CO.host, type, a, b, p)){ drop('event ' + type + '/' + p); return; }
    if(CO.host){
      if(type === NET_EV.CUE){ CO.mateGate = b; return; }   // (GATE: the only cue a guest may send)
      if(type >= NET_EV.BLOCK){ if(!coopWorldEvent(true, type, a, b, x, y, z, p, now)) coopTeamEvent(type, a, b, x, y, z, p, now); return; }   // COOP 9 a report on a block / a guard, a request for loot, a ping, a magazine: each judged in its module
      // a hit report: judged against what the host itself knows — the enemy, the weapon his state named, that weapon's own numbers, where he said he was
      const dr = coopEnemyById(b) ? null : coopDroneById(b), e = dr ? null : coopEnemyById(b), h = coopHitOf(p, _hit), w = Math.round(y * 100), g = GUNS[mateGunId(w)] || null;   // (COOP 9 the id may be a drone's)
      _q.now = now; _q.dmg = h.dmg; _q.heavy = h.heavy; _q.weapon = w; _q.enemyAlive = dr ? !dr.dead : !!(e && e.hp > 0); _q.dist = dr ? Math.hypot(dr.x - MATE.x, dr.z - MATE.z) : e ? Math.hypot(e.pos.x - MATE.x, e.pos.z - MATE.z) : 0; _q.gunDmg = g ? g.dmg || 0 : 0; _q.gunRange = mateRange();
      _q.gunHeavy = !!(g && (g.aoe > 0 || g.special || (g.dmg || 0) >= 30)); _q.guestDown = CO.gd.on || !MATE.on || S.mode !== 'playing';
      const bc = e ? coopBladeCode(w) : -1; if(bc >= 0){ const jb = ambushGuestCut(CO.trust, e, bc, x, z, now, _q.guestDown); if(!jb.ok){ drop('hit ' + jb.why); return; } CO.hitsIn++; coopDmgNote(1, jb.dmg);   // AMBUSH 1–2 a cut: x / z = where he claims he stood, p = the way it throws the man; every fact and the damage are the HOST's (game/ambush.js → net/rules.js coopJudgeBlade)
        const ab = p / 65536 * Math.PI * 2; e._hx = Math.sin(ab); e._hz = Math.cos(ab); e._big = false; e._blast = null; e._hitK = 1; e._fx = null; if(e.def.inf) bloodSpurt(e.pos.x, e.pos.z, e._hx, e._hz, 1.1); e.hitT = Math.max(e.hitT || 0, 0.16); damageEnemy(e, jb.dmg); return; }
      const j = coopJudgeHit(CO.trust, _q, _j); if(!j.ok){ drop('hit ' + j.why); return; } CO.hitsIn++; coopDmgNote(1, j.dmg); if(dr){ droneHurt(dr, Math.min(2, j.dmg)); return; }
      const L = Math.hypot(x, z) || 1; e._hx = x / L; e._hz = z / L; e._big = j.heavy; e._blast = null; e._hitK = Math.min(8, j.dmg / 40); e._fx = null;
      if(e.def.inf) bloodSpurt(e.pos.x, e.pos.z, e._hx, e._hz, j.heavy ? 1.4 : 0.7); e.hitT = Math.max(e.hitT || 0, 0.16); damageEnemy(e, j.dmg); return; }   // (the death, if it is one, goes back as the host's event)
    // ---- the guest: the host's word ----
    if(type >= NET_EV.BLOCK || type === NET_EV.SHOT){ if(!coopWorldEvent(false, type, a, b, x, y, z, p, now)) coopTeamEvent(type, a, b, x, y, z, p, now); return; }   // COOP 9
    if(type === NET_EV.CUE){
      if(fortBossCue(p, a, b, x, z)) return;   // BOSS 1 the host's fort boss: out, his plates, his moves, the fort taken
      if(p === NET_CUE.GATE) CO.mateGate = b; else if(p === NET_CUE.GO) CO.go = b;
      else if(p === NET_CUE.SCORE){ S.score = coopScoreOf(a, b); updateHUD(); } else if(p === NET_CUE.WAVE){ S.wave = a; updateHUD(); }
      else if(p === NET_CUE.PHASE){ if(PH[a]) DIR.phase = PH[a]; }
      else if(p === NET_CUE.WON) guestStageWon(a, !!b); else if(p === NET_CUE.LOST) lose(a === 1 ? 'both' : 'core');
      else if(p === NET_CUE.DOWN){ if(!CO.down.on && S.player) goDown(now, false); } else if(p === NET_CUE.UP){ if(CO.down.on) standUp(now, false); }
      return; }
    if(type === NET_EV.HIT){ CO.hurtIn++; const h = coopHitOf(p, _hit), pl = S.player; if(S.mode !== 'playing' || CO.down.on || !pl || !(h.dmg > 0)) return;
      const ar = pl.armor, dk = pl.defK, iv = pl.invincibleUntil; pl.armor = 0; pl.defK = 1; pl.invincibleUntil = 0;   // the number is the host's, already final: nothing of this page's is taken off it
      try{ damagePlayer(h.dmg, now, x, z); }finally{ pl.armor = ar; pl.defK = dk; if(!CO.down.on) pl.invincibleUntil = iv; } return; }
    if(type === NET_EV.MARK){ MATE.mark = a ? { x, z } : null; return; }
    if(!CO.puppet) return;
    if(type === NET_EV.DEATH){ CO.deaths++; coopGuestDeath(a, b, x, y, z); } else if(type === NET_EV.EXPLOSION) coopGuestBlast(a, b, x, y, z, p); else if(type === NET_EV.GRENADE) coopGuestNade(a, b, x, y, z, p);
  }catch(e){ fail(e); } }
// the host's AI: which player this enemy soldier regards. true = for the length of his update "the player" is the guest's soldier (coopFocusEnd puts it back)
let _real = null;
export function coopFocus(e, now){ const gp = mateProxy(), hp = S.player; if(!gp || !hp || hp.mate) return false;
  if(now >= (e._cfAt || 0)){ e._cfAt = now + COOP.focus.every * (0.7 + 0.6 * ((e.nid || 0) % 7) / 7); const pr = CT.pick.press, pk = COOP2.director.pressK;   // (COOP 9 the one hurting them most counts as nearer)
    e._cf = coopFocusPick(e._cf | 0, Math.hypot(e.pos.x - hp.pos.x, e.pos.z - hp.pos.z) * (pr === 0 ? pk : 1), Math.hypot(e.pos.x - gp.pos.x, e.pos.z - gp.pos.z) * (pr === 1 ? pk : 1), CO.down.on, CO.gd.on); }
  if(e._cf !== 1) return false; _real = hp; S.player = gp; return true; }
export function coopFocusEnd(){ if(_real){ S.player = _real; _real = null; } }
// damage to the guest's soldier is DECIDED ON THE HOST and sent as a final number: the host takes his stance's protection off it (its own table), keeps its own
// ledger of his health (CO.led) and says when he is down — the guest's page only shows it
export function coopHurtMate(dmg, dx, dz){ const now = performance.now() / 1000; if(!CO.ai || !(dmg > 0) || !MATE.on || CO.gd.on || now < CO.safeUntil) return;
  const fin = Math.min(COOP.puppet.hitMax, dmg * (MATE.mounted ? CAV.defK.mounted : CAV.defK[MATE.stance] || CAV.defK.stand)), L = Math.hypot(dx || 0, dz || 0) || 1; CO.hurtOut++; if(MATE.p) MATE.p.hitT = 0.26;
  if(CO.led >= 0){ CO.led = Math.max(0, CO.led - fin); CO.holdUntil = now + COOP.trust.syncS; }
  coopSendEvent(NET_EV.HIT, 0, COOP.ids.guest, (dx || 0) / L, 0, (dz || 0) / L, coopHitP(fin, false)); }
// an enemy round on the host against the guest's soldier (combat/lock-on.js updateBullets, after the host's own): the stretch it flew this frame against his
// circle and his height. true = it struck him (the round is spent)
export function coopBulletMate(b, wy){ const M = MATE; if(!M.on || CO.gd.on) return false; const ax = b._hx, az = b._hz, dx = b.x - ax, dz = b.z - az, L2 = dx * dx + dz * dz; let t = L2 > 1e-6 ? ((M.x - ax) * dx + (M.z - az) * dz) / L2 : 1; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - M.x, qz = az + dz * t - M.z, r = (M.mounted ? COOP.mate.rideR : COOP.mate.hitR) + (b.r || 0.2); if(qx * qx + qz * qz > r * r) return false;
  if(wy < M.y - 0.4 || wy > M.y + (M.mounted ? 2.8 : M.stance === 'prone' ? 0.8 : M.stance === 'crouch' ? 1.5 : 2.05)) return false; coopHurtMate(b.dmg, b.vx, b.vz); return true; }
// a blast on the host against him (the enemy's grenade, a rocket): full at the centre, k of it at the edge
export function coopBlastMate(x, z, R, dmg, edge){ const M = MATE; if(!CO.ai || !M.on) return; const dx = M.x - x, dz = M.z - z, d = Math.hypot(dx, dz); if(d < R) coopHurtMate(dmg * (1 - (1 - (edge == null ? 0.4 : edge)) * d / R), dx || 0.01, dz); }
// the stage is won on the host (campaign/boss.js bossStageWon) → the guest follows: the same reward screen, the next field built from the same seed
export function coopStageWon(final){ if(CO.host && CO.live) coopSendEvent(NET_EV.CUE, S.stage, final ? 1 : 0, 0, 0, 0, NET_CUE.WON); }
function guestStageWon(stage, final){ showBanner('THẮNG MÀN!', '#8cbf3f'); S.awaitingUpgrade = true; S.wave = 0; S.stage = stage; updateHUD(); try{ celebrate('victory', 0, 0); }catch(e){}
  coopPuppetsClear(); setTimeout(() => { if(S.mode !== 'playing' || !CO.live) return; if(final) victory(); else openUpgrade(); }, 5400); }
// the battle is lost on the host (game/player-damage.js gameOver) → the guest's ends too
export function coopGameOver(){ if(CO.host && CO.live && !CO.lostSent){ CO.lostSent = true; coopSendEvent(NET_EV.CUE, CO.down.lost ? 1 : 0, 0, 0, 0, 0, NET_CUE.LOST); } }
function lose(why){ if(S.mode === 'gameover' || CO.lost) return; coopLine(''); CO.lost = true; if(CO.host) CO.down.lost = why === 'both'; gameOver(why === 'both' ? 'CẢ HAI ĐÃ NGÃ' : 'MẤT LÕI CĂN CỨ');
  if(why === 'both'){ const w = document.getElementById('go-why'); if(w) w.innerHTML = '<b>Cả hai đã ngã.</b> Không còn ai đứng để cứu người kia. Lần sau, khi đồng đội ngã hãy tới đứng cạnh 4 giây để dựng anh ấy dậy.'; } }
// a line of the host's radio for the guest (campaign/operations.js radio)
export function coopRadio(msg, vkey){ if(CO.ai && CO.live && !CO.mute) coopSay(msg, vkey); }
// COOP 9 a line for THIS page's radio only (the ping's shout: its bearing is this player's own)
export function coopRadioLocal(msg){ CO.mute = true; try{ radio(msg); }catch(e){ fail(e); }finally{ CO.mute = false; } }

// ================= COOP 7: GOING DOWN TOGETHER (the host's word) =================
// The HOST decides both: its own soldier is down when his health is gone; the guest's when the host's LEDGER of his health is (CO.led — what the host itself took
// off, and never above what he reports). The host counts both revivals (CO.down / CO.gd — net/rules.js coopDownStep) and says DOWN / UP / LOST to the guest,
// whose page shows it and decides nothing: a guest's message cannot put the host down, stand anyone up, or end the stage.
function goDown(now, quiet){ const p = S.player; CO.down.on = true; CO.down.k = 0; p.hp = 0; p.downed = true; p.invincibleUntil = Infinity; S.firing = false; if(CV.mounted && !CV.trans) CV.trans = { k:'off', t:0, crash:true }; CV.want = 'prone';
  S.shake = Math.min(3, (S.shake || 0) + 1); updateHUD(); if(!quiet) showBanner('BẠN ĐÃ NGÃ — BÒ VỀ PHÍA ĐỒNG ĐỘI', COOP.mate.downCss); }
function standUp(now, quiet){ const p = S.player, D = CO.down; D.on = false; D.k = 0; D.lost = false; if(!p) return; p.downed = false; p.hp = Math.max(1, Math.round(p.maxHp * COOP.down.hpK)); p.invincibleUntil = now + COOP.down.safeS; p.respawnBlinkUntil = now + 1.2; CV.want = 'stand'; coopLine(''); updateHUD();
  if(!quiet) showBanner('ĐỒNG ĐỘI ĐÃ DỰNG BẠN DẬY', '#8cbf3f'); }
// game/player-damage.js playerDie asks first: true = he is DOWN (or the stage is lost with both down) and the single-player death does not happen
export function coopDie(now){ if(!CO.live) return false; const I = coopInfo(), peerIn = !!(I && I.peer);
  if(!CO.host){ goDown(now, false); return true; }   // the guest: down on his own page at once (he reports no health); what follows is the host's word
  _mi.present = peerIn && MATE.on; _mi.down = CO.gd.on; _mi.dist = MATE.dist; const r = coopDownEnter(CO.down, _mi); if(r === 'alone') return false;   // (nobody to stand him up: the single-player death)
  goDown(now, r === 'lost'); if(r === 'lost') lose('both'); return true; }
// the host, every frame: the ledger of the guest's health follows his report (down at once, up no faster than he could heal), and when it is gone he is DOWN
function guestLedger(dt, now, st, peerIn){ const D = CO.gd, T = COOP.trust; if(!st || !MATE.on) return; coopTrustWeapon(CO.trust, st.weapon);
  const max = Math.max(1, Math.min(T.hpMax, st.hpMax || 1)); CO.ledMax = max; if(MATE.p) MATE.p.invincibleUntil = D.on ? Infinity : 0;   // (what the guest's own flags say of him changes nothing for the enemy)
  if(D.on){ MATE.revive = D.k; if(S.mode !== 'playing') return; _mi.present = peerIn; _mi.down = CO.down.on; _mi.dist = MATE.dist; const r = coopDownStep(D, dt, _mi);
    if(r === 'up'){ CO.led = Math.max(1, Math.round(max * COOP.down.hpK)); CO.holdUntil = now + T.syncS; CO.safeUntil = now + COOP.down.safeS; MATE.revive = 0; coopSendEvent(NET_EV.CUE, 0, 0, 0, 0, 0, NET_CUE.UP); }
    else if(r === 'lost') lose('both'); else if(r === 'alone'){ D.on = true; }   // (the line dropped: he stays down until it is back, or the room closes)
    return; }
  CO.led = coopLedger(CO.led, st.hp, max, dt, now < CO.holdUntil);
  if(CO.led <= 0 && S.mode === 'playing'){ _mi.present = true; _mi.down = CO.down.on; _mi.dist = MATE.dist; const r = coopDownEnter(D, _mi); coopSendEvent(NET_EV.CUE, 0, 0, 0, 0, 0, NET_CUE.DOWN); if(r === 'lost') lose('both'); } }
function downTick(dt, now, peerIn){ const D = CO.down, p = S.player;
  if(D.on){ S.firing = false; if(!CV.mounted && !CV.trans) CV.want = 'prone'; p.invincibleUntil = Infinity; if(p.hp !== 0) p.hp = 0;
    if(CO.host){ _mi.present = peerIn && MATE.on; _mi.down = CO.gd.on; _mi.dist = MATE.dist; const r = S.mode === 'playing' ? coopDownStep(D, dt, _mi) : '';
      if(r === 'up' || r === 'alone') standUp(now, r === 'alone'); else if(r === 'lost') lose('both'); }
    else D.k = coopReviveShow(D.k, S.mode === 'playing' ? dt : 0, MATE.dist, MATE.on && !MATE.down);   // (the guest only shows the count: the host says UP)
    if(D.on) coopLine(D.k > 0 ? 'ĐỒNG ĐỘI ĐANG CỨU BẠN' : 'BẠN ĐÃ NGÃ — chờ đồng đội tới cứu (bò được, không bắn được)', COOP.mate.downCss, D.k); }
  else { const md = CO.host ? CO.gd.on : MATE.on && MATE.down; if(!CO.host) MATE.revive = coopReviveShow(MATE.revive, dt, MATE.dist, md);
    if(md && S.mode === 'playing') coopLine(MATE.revive > 0 ? 'ĐANG CỨU ĐỒNG ĐỘI — đứng yên bên cạnh' : 'ĐỒNG ĐỘI NGÃ — tới đứng cạnh ' + COOP.down.reviveS + ' giây để cứu', COOP.mate.css, MATE.revive > 0 ? MATE.revive : -1); else coopLine(''); } }
// what a probe reads (tools: the two-page runner)
export function coopProbe(){ const I = coopInfo(), co = coopSession(); return { role:CO.host ? 'host' : 'guest', state:I ? I.state : 'none', reason:I ? I.reason : '', peer:!!(I && I.peer), rtt:I ? +(I.rtt || 0).toFixed(1) : 0, mode:S.mode, stage:S.stage, biome:CO.battle && CO.battle.biome, seed:globalThis.__seed >>> 0,
  field:CO.field, parts:CO.parts.join('.'), tag:CO.tag, fieldOk:CO.fieldOk, peerField:co ? co.peerFieldHash : 0, gate:CO.gate, go:CO.go, live:CO.live, ai:CO.ai, puppet:CO.puppet, down:CO.down.on, lost:CO.lost, hurtOut:CO.hurtOut, hurtIn:CO.hurtIn, hitsIn:CO.hitsIn, deaths:CO.deaths, says:CO.says, mark:CO.host ? CO.mark : MATE.mark ? 'on' : '', drops:CO.drops, dropWhy:CO.dropWhy, led:Math.round(CO.led), gDown:CO.gd.on, trust:{ ok:CO.trust.ok, dropped:CO.trust.dropped, clamped:CO.trust.clamped, why:CO.trust.why }, err:CO.err, lastErr:CO.lastErr,
  mate:{ on:MATE.on, name:MATE.name, x:+MATE.x.toFixed(2), z:+MATE.z.toFixed(2), hp:MATE.hp, mounted:MATE.mounted, stance:MATE.stance, gun:MATE.gun, down:MATE.down, onScreen:MATE.onScreen, hidden:MATE.hidden, dist:+MATE.dist.toFixed(1), shots:MATE.shots, frames:MATE.frames, real:!!(MATE.RC && MATE.RC.real), err:MATE.err, lastErr:MATE.lastErr },
  pups:Object.assign({}, PUPS), world:coopWorldProbe(), team:coopTeamProbe(), snaps:CO.snaps, perSnap:CO.snaps ? Math.round(CO.bytes / CO.snaps) : 0, stats:co ? Object.assign({}, co.stats) : null, secs:+((performance.now() - CO.t0) / 1000).toFixed(1) }; }
