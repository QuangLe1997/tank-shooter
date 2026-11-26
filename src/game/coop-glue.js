// game/coop-glue.js — COOP 4–7 THE GAME'S SIDE OF TWO-PLAYER CO-OP (the net layer is src/net/*; the screen ui/coop-lobby.js; the other soldier game/coop-remote.js;
// the enemy game/coop-puppets.js). With ?room=CODE in the address: the lobby instead of the home screen (COOP 4), both pages launch the same battle and compare what
// they built, the 3-2-1 waits for both; every frame each page sends its soldier and draws the other's (COOP 5); the host sends the enemy and the guest draws it and
// reports his hits (COOP 6); a player at no health is DOWN until the other stands him up, both down = the stage is lost (COOP 7). Without ?room= coopBoot() returns
// at its first line and CO.on stays false: every hook in the game is behind CO.on / coopActive() / a field only co-op sets, so single player runs as before.
import { CAV, COOP } from '../../config.js';
import { ARENA, BIOMES, CV, DIR, FORTS, MATE, MOBILE, NET_CUE, NET_EV, NET_HASH0, NET_PFLAG, NET_STANCE, PROFILE, PUPS, S, TREES, blocks, bloodSpurt, celebrate, climbing, coopBegin, coopBroadcast, coopClashFatal, coopDownEnter, coopDownStep, coopEnemyById, coopFocusPick, coopFrame, coopGuestBlast, coopGuestDeath, coopGuestNade, coopGuestPlay, coopHitOf, coopHitP, coopHostEntities, coopInfo, coopInputDue, coopLine, coopLobbyClash, coopLobbyHide, coopLobbyOpen, coopLobbyShow, coopOnEvent, coopOnField, coopOnPeer, coopOnSay, coopOnSettings, coopOnState, coopParseUrl, coopPlaying, coopPuppetsClear, coopReviveShow, coopSample, coopSay, coopScoreAB, coopScoreOf, coopSeedUrl, coopSendEvent, coopSendInput, coopSession, coopSetFieldHash, coopSetReady, coopSetSettings, coopSnapDue, coopStart, coopStop, coopWarn, damageEnemy, damagePlayer, gameOver, heightAt, hide, launchGame, makeCoopDown, mateClear, mateGunIndex, mateProxy, mateRideCode, mateUpdate, netFramePlayer, netHashStep, netRand, openUpgrade, quitToMenu, radio, showBanner, towers, updateHUD, victory } from '../hub.js';

// what the page knows of the room (dev probes read it): on = a room was joined · live = the battle is on and the other is with us · ai = on the host the enemy
// regards both players · puppet = on the guest the enemy is the host's · the stage each side stands at the gate of · counters
export const CO = { on:false, host:false, me:0, live:false, ai:false, puppet:false, error:'', down:makeCoopDown(), gate:0, mateGate:0, go:0, gateAt:0, fieldOk:null, field:0, tag:'', lost:false, lostSent:false, scoreAt:0, score:-1, wave:-1, phase:'',
  hurtOut:0, hurtIn:0, hitsIn:0, deaths:0, bytes:0, t0:0, sampleAt:-1, sample:null, battle:null, link:'', err:0, lastErr:'' };
const PH = ['build', 'peak', 'release', 'finale'], _me = { id:0, x:0, y:0, z:0, heading:0, aimYaw:0, aimPitch:0, vx:0, vz:0, stance:0, weapon:0, flags:0, hp:0, hpMax:0, mount:0 }, _mi = { present:false, down:false, dist:0 }, _hit = { dmg:0, heavy:false };
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
  CO.on = true; CO.host = co.isHost; CO.me = CO.host ? COOP.ids.host : COOP.ids.guest; CO.t0 = performance.now();
  coopOnState(onState); coopOnSettings(onSettings); coopOnPeer(() => { render(); if(CO.live) coopWarn(coopInfo().peer ? '' : 'Mất liên lạc với đồng đội — đang chờ nối lại…'); }); coopOnField(onField); coopOnEvent(onEvent); coopOnSay((t, key) => { try{ radio(t, key || undefined); }catch(e){} });
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
    try{ mateClear(); coopLine(''); if(CO.down.on) standUp(performance.now() / 1000, true); }catch(e){ fail(e); }
    if(inBattle && CO.host){ coopWarn('Đồng đội đã rời — bạn đánh tiếp một mình.'); CO.on = false; return; }   // (the battle was the host's: it goes on, single-handed)
    if(inBattle){ try{ coopPuppetsClear(); quitToMenu(); }catch(e){ fail(e); } }   // (the guest's enemy was the host's: nothing is left to fight)
    coopWarn(''); CO.live = false; try{ coopLobbyShow(model(), CB); }catch(e){ fail(e); } return; }
  render(); }
// both pages: the battle agreed in the lobby, through the game's own launch (the veil, the build, the intro, the briefing)
function startBattle(){ const b = (coopInfo() || {}).battle || {}; CO.live = true; CO.error = ''; CO.puppet = !CO.host && !!COOP.puppets; CO.ai = CO.host && !!COOP.puppets; CO.gate = CO.mateGate = CO.go = 0; CO.lost = CO.lostSent = false; CO.down.on = false; CO.score = CO.wave = -1; CO.fieldOk = null;
  coopLobbyHide(); coopWarn(''); for(const id of ['start', 'nick', 'battleSetup', 'guide']){ const o = document.getElementById(id); if(o && !o.classList.contains('hidden')) hide(id); }
  launchGame({ mode:'custom', biome:Math.max(0, BIOMES.findIndex(x => x.name === b.biome)), tod:b.tod || 'noon', wx:b.wx || 'clear', space:'wide', level:Math.max(1, b.level | 0) }); }
// ---- the same land? a fingerprint of what this page built (game/flow.js startGame and loot/upgrades.js chooseUpgrade call it once the field stands) ----
export function coopFieldPrint(){ let h = NET_HASH0; const n = 16, R = ARENA * 0.9;
  for(let i = 0; i < n; i++) for(let j = 0; j < n; j++) h = netHashStep(h, Math.round(heightAt((i / (n - 1) * 2 - 1) * R, (j / (n - 1) * 2 - 1) * R) * 20));
  h = netHashStep(h, blocks.length); for(let i = 0; i < blocks.length; i++){ const b = blocks[i], k = String(b.kind || ''); h = netHashStep(h, Math.round(b.x * 10)); h = netHashStep(h, Math.round(b.z * 10)); for(let c = 0; c < k.length; c++) h = netHashStep(h, k.charCodeAt(c)); }
  h = netHashStep(h, towers.length); for(let i = 0; i < towers.length; i++){ h = netHashStep(h, Math.round(towers[i].x * 10)); h = netHashStep(h, Math.round(towers[i].z * 10)); }
  h = netHashStep(h, FORTS.length); for(let i = 0; i < FORTS.length; i++){ h = netHashStep(h, Math.round(FORTS[i].x * 10)); h = netHashStep(h, Math.round(FORTS[i].z * 10)); }
  return netHashStep(h, TREES.length); }
export function coopFieldBuilt(){ if(!CO.on) return; try{ CO.field = coopFieldPrint(); CO.tag = 'stage ' + S.stage; CO.gate = CO.go = 0; CO.gateAt = 0; CO.lost = CO.lostSent = false; coopPuppetsClear(); resetDown(); if(CO.live) coopSetFieldHash(CO.field, CO.tag);
    if(!CO.host && S.player){ const p = S.player; p.pos.x += COOP.mate.spawnGap; p.mesh.position.x = p.pos.x; if(CV.hPos) CV.hPos.x = p.pos.x; } }catch(e){ fail(e); } }   // (the guest beside the host, not inside him)
// a new field (the next stage, the battle again): whoever was down is on his feet
function resetDown(){ const D = CO.down, p = S.player; if(p && (D.on || p.downed)){ p.downed = false; p.invincibleUntil = 0; if(!(p.hp > 0)) p.hp = Math.max(1, Math.round(p.maxHp * COOP.down.hpK)); CV.want = 'stand'; } D.on = false; D.k = 0; D.lost = false; MATE.revive = 0; coopLine(''); }
function onField(same){ CO.fieldOk = same; coopWarn(same ? '' : '⚠ Hai máy dựng hai chiến trường KHÁC nhau — địch và vật cản có thể lệch chỗ. Nên rời phòng, kiểm tra cùng phiên bản / cùng loại máy rồi vào lại.'); }
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
  m.stance = mounted ? (p.bike ? T.PILLION : T.HORSE) : climbing() ? T.CLIMB : CV.stance === 'prone' ? T.PRONE : CV.stance === 'crouch' ? T.CROUCH : T.STAND; m.weapon = inst ? mateGunIndex(inst.id) : 0;
  m.flags = (S.firing && S.mode === 'playing' && inst && !inst.rU && now - (p.fireAt || 0) < 0.6 ? F.FIRING : 0) | (inst && inst.rU ? F.RELOADING : 0) | (mounted ? F.MOUNTED : 0) | (CO.down.on ? F.DOWNED : 0) | (CV.aimUp ? F.AIMING : 0)
    | (!mounted && Math.hypot(p.vel.x, p.vel.z) > CAV.foot.run + 0.4 ? F.SPRINT : 0) | (CV.jump ? F.AIRBORNE : 0) | (S.mode === 'dying' || CV.dead ? F.DEAD : 0);
  m.hp = Math.max(0, p.hp); m.hpMax = p.maxHp; m.mount = mateRideCode(p); return m; }
function sampleNow(nowMs){ if(CO.sampleAt !== nowMs){ CO.sampleAt = nowMs; CO.sample = coopSample(nowMs); } return CO.sample; }
// game/loop.js, every frame, whatever the mode: this page's soldier out, the other's in and drawn, the host's snapshot of the enemy, down / revive, the mirrors
export function coopTick(dt, now, nowMs){ if(!CO.live || !coopPlaying() || !S.player) return;
  try{
    const inField = S.mode === 'playing' || S.mode === 'countdown' || S.mode === 'dying' || S.mode === 'paused';
    if(CO.host){ if(coopSnapDue(nowMs)){ const f = coopFrame(); netFramePlayer(f, myState(now)); if(CO.ai && inField) coopHostEntities(f, now); CO.bytes += coopBroadcast(f); mirrors(now); } }
    else if(coopInputDue(nowMs)) CO.bytes += coopSendInput(myState(now));
    const o = sampleNow(nowMs), st = o && o.np > 0 && o.pl[0].id ? o.pl[0] : null, I = coopInfo();
    mateUpdate(dt, now, inField || S.mode === 'intro' ? st : null, I ? I.peerName : '');
    downTick(dt, now, !!(I && I.peer));
  }catch(e){ fail(e); } }
// game/loop.js: on the guest (COOP.puppets) the fight's frame is the puppet one — true = it ran, the single-player updates are skipped
export function coopGuestFrame(dt, now, nowMs){ if(!CO.puppet || !CO.live) return false; try{ coopGuestPlay(dt, now, sampleNow(nowMs)); }catch(e){ fail(e); } return true; }

// ================= COOP 6: ONE BATTLE =================
// the host's numbers the guest's HUD shows: the score, the wave, the director's phase (music, radio)
function mirrors(now){ if(now < CO.scoreAt) return; CO.scoreAt = now + 0.5;
  if(S.score !== CO.score){ CO.score = S.score; const ab = coopScoreAB(S.score); coopSendEvent(NET_EV.CUE, ab[0], ab[1], 0, 0, 0, NET_CUE.SCORE); }
  if(S.wave !== CO.wave){ CO.wave = S.wave; coopSendEvent(NET_EV.CUE, S.wave | 0, 0, 0, 0, 0, NET_CUE.WAVE); }
  if(DIR.phase !== CO.phase){ CO.phase = DIR.phase; coopSendEvent(NET_EV.CUE, Math.max(0, PH.indexOf(DIR.phase)), 0, 0, 0, 0, NET_CUE.PHASE); } }
function onEvent(type, a, b, x, y, z, p){ try{ const now = performance.now() / 1000;
    if(type === NET_EV.CUE){
      if(p === NET_CUE.GATE) CO.mateGate = b; else if(p === NET_CUE.GO){ if(!CO.host) CO.go = b; }
      else if(p === NET_CUE.SCORE){ if(!CO.host){ S.score = coopScoreOf(a, b); updateHUD(); } } else if(p === NET_CUE.WAVE){ if(!CO.host){ S.wave = a; updateHUD(); } }
      else if(p === NET_CUE.PHASE){ if(!CO.host && PH[a]) DIR.phase = PH[a]; }
      else if(p === NET_CUE.WON){ if(!CO.host) guestStageWon(a, !!b); } else if(p === NET_CUE.LOST){ if(!CO.host) lose(a === 1 ? 'both' : 'core'); }
      return; }
    if(type === NET_EV.HIT){
      if(b === CO.me){ CO.hurtIn++; const h = coopHitOf(p, _hit); if(S.mode === 'playing' && !CO.down.on) damagePlayer(h.dmg, now, x, z); }   // the host says an enemy round struck this page's soldier
      else if(CO.host){ const e = coopEnemyById(b); if(!e) return; const h = coopHitOf(p, _hit); CO.hitsIn++; e._hx = x; e._hz = z; e._big = h.heavy; e._blast = null; e._hitK = h.dmg / 40; e._fx = null;
        if(e.def.inf) bloodSpurt(e.pos.x, e.pos.z, x, z, h.heavy ? 1.4 : 0.7); e.hitT = Math.max(e.hitT || 0, 0.16); damageEnemy(e, h.heavy && e.def.inf ? Math.max(h.dmg, e.hp + 1) : h.dmg); }   // the guest's round: the host takes the health off (and the death goes back)
      return; }
    if(CO.host || !CO.puppet) return;
    if(type === NET_EV.DEATH){ CO.deaths++; coopGuestDeath(a, b, x, y, z); } else if(type === NET_EV.EXPLOSION) coopGuestBlast(a, b, x, y, z, p); else if(type === NET_EV.GRENADE) coopGuestNade(a, b, x, y, z, p);
  }catch(e){ fail(e); } }
// the host's AI: which player this enemy soldier regards. true = for the length of his update "the player" is the guest's soldier (coopFocusEnd puts it back)
let _real = null;
export function coopFocus(e, now){ const gp = mateProxy(), hp = S.player; if(!gp || !hp || hp.mate) return false;
  if(now >= (e._cfAt || 0)){ e._cfAt = now + COOP.focus.every * (0.7 + 0.6 * ((e.nid || 0) % 7) / 7); e._cf = coopFocusPick(e._cf | 0, Math.hypot(e.pos.x - hp.pos.x, e.pos.z - hp.pos.z), Math.hypot(e.pos.x - gp.pos.x, e.pos.z - gp.pos.z), CO.down.on, MATE.down || MATE.dead); }
  if(e._cf !== 1) return false; _real = hp; S.player = gp; return true; }
export function coopFocusEnd(){ if(_real){ S.player = _real; _real = null; } }
// damage to the guest's soldier is decided on the host and sent: the guest takes it off his own health (his armour, his stance, his roll are his page's)
export function coopHurtMate(dmg, dx, dz){ if(!CO.ai || !(dmg > 0) || MATE.down || MATE.dead) return; CO.hurtOut++; const L = Math.hypot(dx || 0, dz || 0) || 1; if(MATE.p) MATE.p.hitT = 0.26;
  coopSendEvent(NET_EV.HIT, 0, COOP.ids.guest, (dx || 0) / L, 0, (dz || 0) / L, coopHitP(dmg, false)); }
// an enemy round on the host against the guest's soldier (combat/lock-on.js updateBullets, after the host's own): the stretch it flew this frame against his
// circle and his height. true = it struck him (the round is spent)
export function coopBulletMate(b, wy){ const M = MATE; if(!M.on || M.down || M.dead) return false; const ax = b._hx, az = b._hz, dx = b.x - ax, dz = b.z - az, L2 = dx * dx + dz * dz; let t = L2 > 1e-6 ? ((M.x - ax) * dx + (M.z - az) * dz) / L2 : 1; t = t < 0 ? 0 : t > 1 ? 1 : t;
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
function lose(why){ if(S.mode === 'gameover') return; coopLine(''); CO.lost = true; gameOver(why === 'both' ? 'CẢ HAI ĐÃ NGÃ' : 'MẤT LÕI CĂN CỨ');
  if(why === 'both'){ const w = document.getElementById('go-why'); if(w) w.innerHTML = '<b>Cả hai đã ngã.</b> Không còn ai đứng để cứu người kia. Lần sau, khi đồng đội ngã hãy tới đứng cạnh 4 giây để dựng anh ấy dậy.'; } }
// a line of the host's radio for the guest (campaign/operations.js radio)
export function coopRadio(msg, vkey){ if(CO.ai && CO.live) coopSay(msg, vkey); }

// ================= COOP 7: GOING DOWN TOGETHER =================
function mate(peerIn){ _mi.present = peerIn && MATE.on; _mi.down = MATE.down || MATE.dead; _mi.dist = MATE.dist; return _mi; }
// game/player-damage.js playerDie asks first: true = he is DOWN (or the stage is lost with both down) and the single-player death does not happen
export function coopDie(now){ if(!CO.live) return false; const I = coopInfo(), r = coopDownEnter(CO.down, mate(!!(I && I.peer))); if(r === 'alone') return false;
  const p = S.player; p.hp = 0; p.downed = true; p.invincibleUntil = Infinity; S.firing = false; if(CV.mounted && !CV.trans) CV.trans = { k:'off', t:0, crash:true }; CV.want = 'prone'; S.shake = Math.min(3, (S.shake || 0) + 1); updateHUD();
  if(r === 'lost'){ if(CO.host){ lose('both'); } return true; }   // (the guest's page learns it from the host — or sees it itself in downTick)
  showBanner('BẠN ĐÃ NGÃ — BÒ VỀ PHÍA ĐỒNG ĐỘI', COOP.mate.downCss); return true; }
function standUp(now, quiet){ const p = S.player, D = CO.down; D.on = false; D.k = 0; D.lost = false; if(!p) return; p.downed = false; p.hp = Math.max(1, Math.round(p.maxHp * COOP.down.hpK)); p.invincibleUntil = now + COOP.down.safeS; p.respawnBlinkUntil = now + 1.2; CV.want = 'stand'; coopLine(''); updateHUD();
  if(!quiet) showBanner('ĐỒNG ĐỘI ĐÃ DỰNG BẠN DẬY', '#8cbf3f'); }
function downTick(dt, now, peerIn){ const D = CO.down, p = S.player, m = mate(peerIn);
  if(D.on){ S.firing = false; if(!CV.mounted && !CV.trans) CV.want = 'prone'; p.invincibleUntil = Infinity; if(p.hp !== 0){ p.hp = 0; }
    const r = S.mode === 'playing' ? coopDownStep(D, dt, m) : '';
    if(r === 'up' || r === 'alone') standUp(now, r === 'alone'); else if(r === 'lost'){ if(!CO.lost) lose('both'); if(CO.host) coopGameOver(); }
    else coopLine(D.k > 0 ? 'ĐỒNG ĐỘI ĐANG CỨU BẠN' : 'BẠN ĐÃ NGÃ — chờ đồng đội tới cứu (bò được, không bắn được)', COOP.mate.downCss, D.k); }
  else { MATE.revive = coopReviveShow(MATE.revive, dt, MATE.dist, MATE.on && MATE.down);
    if(MATE.on && MATE.down && S.mode === 'playing') coopLine(MATE.revive > 0 ? 'ĐANG CỨU ĐỒNG ĐỘI — đứng yên bên cạnh' : 'ĐỒNG ĐỘI NGÃ — tới đứng cạnh ' + COOP.down.reviveS + ' giây để cứu', COOP.mate.css, MATE.revive > 0 ? MATE.revive : -1); else coopLine(''); } }
// what a probe reads (tools: the two-page runner)
export function coopProbe(){ const I = coopInfo(), co = coopSession(); return { role:CO.host ? 'host' : 'guest', state:I ? I.state : 'none', reason:I ? I.reason : '', peer:!!(I && I.peer), rtt:I ? +(I.rtt || 0).toFixed(1) : 0, mode:S.mode, stage:S.stage, biome:CO.battle && CO.battle.biome, seed:globalThis.__seed >>> 0,
  field:CO.field, tag:CO.tag, fieldOk:CO.fieldOk, peerField:co ? co.peerFieldHash : 0, gate:CO.gate, go:CO.go, live:CO.live, ai:CO.ai, puppet:CO.puppet, down:CO.down.on, lost:CO.lost, hurtOut:CO.hurtOut, hurtIn:CO.hurtIn, hitsIn:CO.hitsIn, deaths:CO.deaths, err:CO.err, lastErr:CO.lastErr,
  mate:{ on:MATE.on, name:MATE.name, x:+MATE.x.toFixed(2), z:+MATE.z.toFixed(2), hp:MATE.hp, mounted:MATE.mounted, stance:MATE.stance, gun:MATE.gun, down:MATE.down, onScreen:MATE.onScreen, hidden:MATE.hidden, dist:+MATE.dist.toFixed(1), shots:MATE.shots, frames:MATE.frames, real:!!(MATE.RC && MATE.RC.real), err:MATE.err, lastErr:MATE.lastErr },
  pups:Object.assign({}, PUPS), stats:co ? Object.assign({}, co.stats) : null, secs:+((performance.now() - CO.t0) / 1000).toFixed(1) }; }
