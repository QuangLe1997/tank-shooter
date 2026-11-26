// game/coop-team.js — COOP 9 WHAT TWO PLAYERS DO TOGETHER (numbers: config COOP2; rules: net/rules.js).
//   COOP 9 THE PING: one key (TAB; a round button on touch) marks what he aims at — an enemy near the aim point, else a pick-up / the crate, else the place:
//     a ring of light with a thin beam over it on BOTH pages for COOP2.ping.lifeS s, on the map too, at most COOP2.ping.max alive a player; the OTHER page hears
//     a short shout on the radio with the clock bearing from where HE looks ("Địch hướng 2 giờ!"). A ping on an enemy follows him while he lives.
//   COOP 9 THE DIRECTOR SEES TWO (the host's): more of them (campaign/director.js dirCount × COOP2.director.countK), the flank entry goes at the player who is
//     alone (dirEntry → coopDirAt), the enemy leans on the one hurting it most (game/coop-glue.js coopFocus reads CT.pick.press), and a revive in progress is heard.
//   COOP 9 A MAGAZINE THROWN: one key (the backquote; a button on touch) near the other player — a magazine of the class HE holds out of the thrower's own
//     reserve (game/logistics.js ammoSpend → the other page's ammoGain).
//   Nothing here runs without a live room: the two actions are pushed into the binding table by coopTeamKeys() (called once a room is joined), every tick and
//   hook returns at its first line otherwise.
import * as THREE from 'three';
import { ACTIONS, COOP, COOP2, LOGISTICS, TOUCH_HELP } from '../../config.js';
import { BIND, CO, CW, FT, GIFTS, GUNS, MATE, MOBILE, NET_EV, S, ammoGain, ammoKind, ammoSay, ammoSpend, camera, coopAmmoCls, coopAmmoIdx, coopBucketTake, coopClock, coopCountK, coopDirPick, coopJudgeGive, coopPingPush, coopPingText, coopRadioLocal, coopSendEvent, enemies, equippedGun, floatText, heightAt, holoArc, holoRing, mateProxy, pickups, scene, sfx, soldiers, suspectEnemy } from '../hub.js';

// pings: [the host's, the guest's], oldest first · dmg: what each dealt lately (decays) · pick: whom the director goes for (net/rules.js coopDirPick) · fly: magazines in the air
export const CT = { pings:[[], []], pingAt:0, giveAt:0, dmg:[0, 0], pick:{ ambush:-1, press:-1 }, pickAt:0, reviveAt:0, fly:[], btn:null, keys:false, last:null, lastSay:'',
  n:{ pingOut:0, pingIn:0, pingDrop:0, giveOut:0, giveIn:0, giveDrop:0, ambushG:0, ambushH:0, revive:0 }, err:0, lastErr:'' };
const P = COOP2.ping, _q = { dist:0, hostMen:0, guestMen:0, hostDmg:0, guestDmg:0, hostDown:false, guestDown:false }, _g = { now:0, dist:0, down:false, rounds:0 }, POOL = [[], [], []], FLY = [];
function fail(e){ CT.err++; CT.lastErr = String(e && e.message || e).slice(0, 200); if(CT.err <= 3) console.warn('coop: team', e); }
const listOf = who => CT.pings[who === COOP.ids.guest ? 1 : 0];

// once a room is joined (game/coop-glue.js coopBoot): the two actions get their rows in the key sheet (rebindable like any other) and in the touch help
export function coopTeamKeys(){ if(CT.keys) return; CT.keys = true; for(const row of COOP2.keys) if(!ACTIONS.some(a => a[0] === row[0])) ACTIONS.push(row); BIND.map = null;
  TOUCH_HELP.push(['◎ / ▮ (co-op, mép phải)', '◎ đánh dấu chỗ đang ngắm cho đồng đội · ▮ ném một băng đạn cho đồng đội đứng gần']); }

// ================= COOP 9: THE PING =================
function mesh(kind){ let g = POOL[kind].pop(); if(g){ g.visible = true; return g; } g = new THREE.Group(); g.name = 'coopPing';
  const ring = holoRing(P.ringR[kind], kind === 1 ? { kind:'danger' } : kind === 2 ? { kind:'loot', col:P.hex[2], depthTest:false, order:18 } : { kind:'friend', depthTest:false, order:18 }); ring.position.y = 0.12; g.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, P.beamH, 6, 1, true), new THREE.MeshBasicMaterial({ color:P.hex[kind], transparent:true, opacity:0.5, depthWrite:false, blending:THREE.AdditiveBlending, fog:false })); beam.position.y = P.beamH / 2 + 0.2; g.add(beam);
  const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color:P.hex[kind], transparent:true, opacity:0.9, depthTest:false, fog:false })); tip.position.y = P.beamH + 0.5; tip.renderOrder = 19; g.add(tip);
  g.userData.ring = ring; g.userData.beam = beam; g.userData.tip = tip; scene.add(g); return g; }
function free(pg){ if(pg && pg.g){ pg.g.visible = false; POOL[pg.kind].push(pg.g); pg.g = null; } }
function add(who, kind, x, y, z, id, now){ const pg = { who, kind, x, y, z, id, t0:now, g:null }; try{ pg.g = mesh(kind); pg.g.position.set(x, y, z); }catch(e){ fail(e); } free(coopPingPush(listOf(who), pg, P.max)); CT.last = pg; return pg; }
// THE KEY (input/bindings.js runAction 'coopPing', the touch button): what does he aim at?
export function coopPing(){ const pl = S.player; if(!CO.live || S.mode !== 'playing' || !pl) return false; const now = performance.now() / 1000; if(now < CT.pingAt) return false; CT.pingAt = now + P.cdS;
  let ax = S.aimPoint.x, az = S.aimPoint.z; if(!S.pointerActive || !(Math.hypot(ax - pl.pos.x, az - pl.pos.z) > 1.5)){ const a = pl.aimSmoothed ?? pl.facing ?? 0; ax = pl.pos.x + Math.sin(a) * 22; az = pl.pos.z + Math.cos(a) * 22; }   // (no pointer — a pad, a phone: a point ahead along his aim)
  let kind = 0, id = 0, x = ax, z = az, best = P.snapR * P.snapR;
  for(let i = 0; i < enemies.length; i++){ const e = enemies[i], d = (e.pos.x - ax) ** 2 + (e.pos.z - az) ** 2; if(d < best){ best = d; kind = 1; id = e.nid | 0; x = e.pos.x; z = e.pos.z; } }
  if(!kind){ best = P.lootR * P.lootR; for(let i = 0; i < pickups.length; i++){ const u = pickups[i], d = (u.x - ax) ** 2 + (u.z - az) ** 2; if(d < best){ best = d; kind = 2; id = u.lid | 0; x = u.x; z = u.z; } }
    for(let i = 0; i < GIFTS.length; i++){ const u = GIFTS[i], d = (u.x - ax) ** 2 + (u.z - az) ** 2; if(d < best){ best = d; kind = 2; id = 0; x = u.x; z = u.z; } } }
  const y = heightAt(x, z); add(CO.me, kind, x, y, z, id, now); CT.n.pingOut++; coopSendEvent(NET_EV.PING, CO.me, kind, x, y, z, id);
  floatText(P.mine[kind], P.css[kind], pl.pos, 15); sfx('beep', pl.pos, 0.5); return true; }
// the other player's ping arrives: the ring, and the shout with the bearing from where THIS player looks
function pingIn(a, kind, x, y, z, id, now){ const pl = S.player; if(CO.host && !coopBucketTake(CW.wt.ping, now)){ CT.n.pingDrop++; return; } CT.n.pingIn++; add(a, kind, x, heightAt(x, z), z, id, now); if(!pl) return;
  const cx = pl.pos.x - camera.position.x, cz = pl.pos.z - camera.position.z, yaw = Math.hypot(cx, cz) > 0.5 ? Math.atan2(cx, cz) : pl.aimSmoothed ?? pl.facing ?? 0, dx = x - pl.pos.x, dz = z - pl.pos.z;
  CT.lastSay = (MATE.name || 'ĐỒNG ĐỘI') + ': ' + coopPingText(kind, coopClock(dx, dz, yaw), Math.hypot(dx, dz)); coopRadioLocal(CT.lastSay); }
function pingTick(now){ for(let w = 0; w < 2; w++){ const L = CT.pings[w]; for(let i = L.length - 1; i >= 0; i--){ const pg = L[i], age = now - pg.t0; if(age > P.lifeS){ free(pg); L.splice(i, 1); continue; }
      if(pg.kind === 1 && pg.id){ let e = null; for(let k = 0; k < enemies.length; k++) if(enemies[k].nid === pg.id){ e = enemies[k]; break; } if(e){ pg.x = e.pos.x; pg.z = e.pos.z; pg.y = heightAt(pg.x, pg.z); } else if(age > 0.6) pg.id = 0; }   // (he fell, or left: the ring stays where he was)
      const g = pg.g; if(!g) continue; const u = g.userData, k = 1 - age / P.lifeS, pulse = 1 + 0.12 * Math.sin(now * 7 + i); g.position.set(pg.x, pg.y, pg.z); u.ring.scale.setScalar(pulse); holoArc(u.ring, k); u.beam.material.opacity = 0.2 + 0.4 * k; u.tip.rotation.y = now * 3; u.tip.material.opacity = 0.4 + 0.5 * k; } } }
// the map (ui/radar.js drawRadar): a ring and a cross in the ping's colour, fading with its time
export function coopTeamRadar(c, toX, toY){ const now = performance.now() / 1000; for(let w = 0; w < 2; w++){ const L = CT.pings[w]; for(let i = 0; i < L.length; i++){ const pg = L[i], x = toX(pg.x), y = toY(pg.z), k = Math.max(0, 1 - (now - pg.t0) / P.lifeS);
      c.globalAlpha = 0.35 + 0.65 * k; c.strokeStyle = P.css[pg.kind]; c.lineWidth = 1.8; c.beginPath(); c.arc(x, y, 5 + 2 * Math.sin(now * 6), 0, 6.283); c.stroke(); c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x + 3, y); c.moveTo(x, y - 3); c.lineTo(x, y + 3); c.stroke(); c.globalAlpha = 1; } } }

// ================= COOP 9: A MAGAZINE THROWN =================
function fly(fromMate){ let f = FLY.pop(); if(!f){ const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.05), new THREE.MeshStandardMaterial({ color:0x2a2c24, roughness:0.5, metalness:0.6 })); scene.add(m); f = { m, t:0, fromMate:false }; } f.m.visible = true; f.t = 0; f.fromMate = fromMate; CT.fly.push(f); }
function flyTick(dt){ const pl = S.player, T = COOP2.give.flyS; for(let i = CT.fly.length - 1; i >= 0; i--){ const f = CT.fly[i]; f.t += dt; const k = Math.min(1, f.t / T), ax = f.fromMate ? MATE.x : pl.pos.x, az = f.fromMate ? MATE.z : pl.pos.z, bx = f.fromMate ? pl.pos.x : MATE.x, bz = f.fromMate ? pl.pos.z : MATE.z;
    const x = ax + (bx - ax) * k, z = az + (bz - az) * k; f.m.position.set(x, heightAt(x, z) + 1.3 + Math.sin(k * Math.PI) * 1.2, z); f.m.rotation.x += dt * 14; f.m.rotation.z += dt * 9; if(k >= 1 || !MATE.on){ f.m.visible = false; CT.fly.splice(i, 1); FLY.push(f); } } }
// THE KEY (runAction 'coopGive', the touch button): a magazine of the class the other holds, out of this player's own reserve
export function coopGive(){ const pl = S.player, Gv = COOP2.give; if(!CO.live || S.mode !== 'playing' || !pl || CO.down.on) return false; const now = performance.now() / 1000; if(now < CT.giveAt) return false; CT.giveAt = now + 0.6;
  if(!MATE.on || MATE.down || MATE.dist > Gv.r){ floatText('ĐỒNG ĐỘI Ở XA — LẠI GẦN ' + Gv.r + ' M MỚI NÉM ĐƯỢC', '#ffcf5a', pl.pos, 14); return false; }
  const g = GUNS[MATE.gun] || equippedGun(), c = ammoKind(g), ci = coopAmmoIdx(c), cls = LOGISTICS.say.cls[c] || 'ĐẠN'; if(ci < 0) return false;
  const n = ammoSpend(c, Math.min(Gv.maxRounds, Math.max(1, Math.round((g.mag || 30) * Gv.mags)))); if(!(n > 0)){ floatText('KHÔNG CÒN ' + cls + ' ĐỂ CHIA', '#ff7a5a', pl.pos, 14); return false; }
  CT.giveAt = now + Gv.cdS; CT.n.giveOut += n; coopSendEvent(NET_EV.GIVE, CO.me, n, pl.pos.x, 0, pl.pos.z, ci); fly(false); floatText('NÉM ' + n + ' ' + cls + ' CHO ' + (MATE.name || 'ĐỒNG ĐỘI'), '#9be04a', pl.pos, 15); sfx('magIn', pl.pos, 0.6); return true; }
function giveIn(rounds, ci, now){ const pl = S.player; if(!pl) return; _g.now = now; _g.dist = MATE.on ? MATE.dist : 1e9; _g.down = MATE.down; _g.rounds = rounds; const why = coopJudgeGive(CW.wt, _g); if(why){ CT.n.giveDrop++; return; }
  const c = coopAmmoCls(ci), n = ammoGain(c, rounds); CT.n.giveIn += n; fly(true); floatText(n ? (MATE.name || 'ĐỒNG ĐỘI') + ' NÉM: ' + ammoSay(n, c) : LOGISTICS.say.full, n ? '#9be04a' : '#9aa3ad', pl.pos, 16); sfx('magIn', pl.pos, 0.6); }

// ================= COOP 9: THE DIRECTOR SEES TWO (the host) =================
export function coopDirCountK(){ return coopCountK(CO.ai && MATE.on); }
// what a player dealt (actors/gun-feel.js hitConfirm: the host's own confirmed hit — dmg 0 = a round of the gun in his hands; coop-glue.js: a guest's report taken)
export function coopDmgNote(who, dmg){ CT.dmg[who ? 1 : 0] += dmg > 0 ? dmg : (equippedGun().dmg || 10); }
// campaign/director.js dirEntry: whom the flank comes for — the guest's stand-in when he is the one alone
export function coopDirAt(p){ if(CT.pick.ambush !== 1){ if(CT.pick.ambush === 0) CT.n.ambushH++; return p; } const m = mateProxy(); if(!m) return p; CT.n.ambushG++; return m; }
function men(x, z, r2){ let n = 0; for(let i = 0; i < FT.length; i++){ const a = FT[i]; if((a.pos.x - x) ** 2 + (a.pos.z - z) ** 2 < r2) n++; } for(let i = 0; i < soldiers.length; i++){ const a = soldiers[i]; if((a.pos.x - x) ** 2 + (a.pos.z - z) ** 2 < r2) n++; } return n; }
function dirTick(now){ const D = COOP2.director, pl = S.player; if(now < CT.pickAt) return; const sdt = Math.min(2, now - (CT.pickAt - 0.5)); CT.pickAt = now + 0.5; const k = Math.exp(-Math.max(0, sdt) / D.dmgTau); CT.dmg[0] *= k; CT.dmg[1] *= k;
  if(!MATE.on){ CT.pick.ambush = CT.pick.press = -1; return; } const r2 = D.menR * D.menR;
  _q.dist = MATE.dist; _q.hostMen = men(pl.pos.x, pl.pos.z, r2); _q.guestMen = men(MATE.x, MATE.z, r2); _q.hostDmg = CT.dmg[0]; _q.guestDmg = CT.dmg[1]; _q.hostDown = CO.down.on; _q.guestDown = CO.gd.on; coopDirPick(_q, CT.pick);
  // a revive in progress is heard: the idle men within reach go and look at the spot (ai/awareness.js suspectEnemy — a man already in the fight is not turned)
  const rev = CO.gd.on && CO.gd.k > 0 ? 1 : CO.down.on && CO.down.k > 0 ? 2 : 0; if(rev && now >= CT.reviveAt){ CT.reviveAt = now + D.reviveEvery; const x = rev === 1 ? MATE.x : pl.pos.x, z = rev === 1 ? MATE.z : pl.pos.z; let m = 0;
    for(let i = 0; i < enemies.length && m < D.reviveN; i++){ const e = enemies[i]; if(!e.def.inf || e.guard || e.alert >= 2 || (e.pos.x - x) ** 2 + (e.pos.z - z) ** 2 > D.reviveR * D.reviveR) continue; suspectEnemy(e, now, x, z); m++; } CT.n.revive += m; } }

// ================= THE FRAME, THE EVENTS, THE BUTTONS, THE PROBE =================
// game/coop-glue.js coopTick, every frame of a live battle on both pages
export function coopTeamTick(dt, now){ try{ pingTick(now); if(CT.fly.length) flyTick(dt); if(CO.ai && S.mode === 'playing' && S.player) dirTick(now); if(MOBILE) buttons(); }catch(e){ fail(e); } }
// an event that passed the gate (coop-glue.js onEvent): true = it was a ping or a magazine
export function coopTeamEvent(type, a, b, x, y, z, p, now){ try{ if(type === NET_EV.PING){ pingIn(a, b, x, y, z, p, now); return true; } if(type === NET_EV.GIVE){ giveIn(b, p, now); return true; } }catch(e){ fail(e); return true; } return false; }
// a new battle, a new field, the room closed: no ping and no magazine outlives it
export function coopTeamReset(){ for(let w = 0; w < 2; w++){ const L = CT.pings[w]; for(const pg of L) free(pg); L.length = 0; } for(const f of CT.fly){ f.m.visible = false; FLY.push(f); } CT.fly.length = 0; CT.dmg[0] = CT.dmg[1] = 0; CT.pick.ambush = CT.pick.press = -1; CT.pickAt = CT.reviveAt = 0; if(CT.btn) CT.btn.style.display = 'none'; }
// touch: two round buttons on the right edge (built once, shown only while a co-op fight is on)
function buttons(){ if(typeof document === 'undefined') return; let el = CT.btn;
  if(!el){ el = CT.btn = document.createElement('div'); el.id = 'coopBtns'; el.style.cssText = 'position:fixed;right:10px;top:34%;z-index:40;display:none;flex-direction:column;gap:10px;touch-action:none';
    const mk = (txt, col, fn) => { const b = document.createElement('div'); b.textContent = txt; b.style.cssText = 'width:46px;height:46px;border-radius:50%;border:2px solid ' + col + ';color:' + col + ';background:rgba(10,14,10,.55);font:700 22px/42px sans-serif;text-align:center;user-select:none;-webkit-user-select:none';
      const go = ev => { ev.preventDefault(); ev.stopPropagation(); fn(); }; b.addEventListener('touchstart', go, { passive:false }); b.addEventListener('mousedown', go); el.appendChild(b); };
    mk('◎', P.css[0], coopPing); mk('▮', '#9be04a', coopGive); document.body.appendChild(el); }
  const show = CO.live && S.mode === 'playing' ? 'flex' : 'none'; if(el.style.display !== show) el.style.display = show; }
export function coopTeamProbe(){ const pg = w => CT.pings[w].map(q => ({ kind:q.kind, x:+q.x.toFixed(2), y:+q.y.toFixed(2), z:+q.z.toFixed(2), id:q.id, shown:!!(q.g && q.g.visible) }));
  return { pings:[pg(0), pg(1)], lastSay:CT.lastSay, dmg:[Math.round(CT.dmg[0]), Math.round(CT.dmg[1])], pick:Object.assign({}, CT.pick), countK:coopDirCountK(), n:Object.assign({}, CT.n), keys:CT.keys, err:CT.err, lastErr:CT.lastErr }; }
