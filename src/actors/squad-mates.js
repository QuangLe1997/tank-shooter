// actors/squad-mates.js — Z351 HIS OWN SQUAD (soldier mode only): he does not fight alone. He starts with two men of his own — a machine-gunner and a medic —
//   each with a name; they are friendly fireteam men (actors/fireteam.js runs them: cover, targets, following him) and they grow with him: health and
//   damage climb with his rank and with the CHỈ HUY perk. Ranks and the THÊM ĐỒNG ĐỘI perk bring more (a B40 man for tanks, another gun…, up to
//   TROOPER.squad.max). A man who goes down is carried back to the rear and rejoins at the next wave. The medic patches him up when he is hurt and close by,
//   and the wounded of the squad too. (The radio's GỌI TỔ BỘ BINH still brings a whole fireteam on top of them.)
import * as THREE from 'three';
import { TROOPER, TROOPS } from '../../config.js';
import { FT, MODE, CAREER, S, armAlly, clampFieldXZ, floatText, kitAttach, radio, ringPulse, sfx, spawnAlly, spawnPart, updateHUD } from '../hub.js';

const ROSTER = [];   // { role, name, a (his live fireteam entry, or null), back (true = bring him now), dead }
let _names = [], _wave = '', _medAt = 0, _thinkAt = 0, _medMat = null;
const C = () => TROOPER.squad;
const NOW = () => performance.now() / 1000;
export const ROLE_VI = { mg:'xạ thủ máy', medic:'y tá', at:'lính B40', rifle:'xạ thủ' };
const GROW = ['at', 'rifle', 'mg', 'medic', 'rifle', 'at'];
function nextName(){ if(!_names.length) _names = C().names.slice().sort(() => Math.random() - 0.5); return _names.pop(); }
export function squadReset(){ ROSTER.length = 0; _names = []; _wave = ''; _medAt = 0; _thinkAt = 0; for(const role of C().start) ROSTER.push({ role, name:nextName(), a:null, back:true, dead:false }); }
export function squadRoom(){ return C().max - ROSTER.length; }
export function squadList(){ return ROSTER; }
// a new man for the squad (a rank, a perk): he runs in from behind at once
export function squadGrow(role){ if(MODE.id !== 'soldier' || squadRoom() <= 0) return false;
  const r = { role:role || GROW[(ROSTER.length - C().start.length) % GROW.length], name:nextName(), a:null, back:false, dead:false }; ROSTER.push(r); join(r, true); return true; }
// health and damage by his rank and the CHỈ HUY perk (a fraction of the old health kept)
function stats(a){ const K = C(), lead = CAREER.lv.leader || 0, F = TROOPS.fireteam, was = a.maxHp ? a.hp / a.maxHp : 1;
  a.maxHp = Math.round(F.hp * (1 + CAREER.rank * K.hpK + lead * K.leadK)); a.hp = Math.max(1, Math.round(a.maxHp * was)); a.dmgK = 1 + CAREER.rank * K.dmgK + lead * K.leadK; }
export function squadRankUp(){ for(const r of ROSTER) if(r.a && FT.includes(r.a)){ stats(r.a); r.a.hp = r.a.maxHp; } }
// the medic's kit: a white satchel with a red cross on his back
function medKit(a){ const u = a.g.userData; if(!u || !u.up) return; _medMat = _medMat || [new THREE.MeshStandardMaterial({ color:0xe8e6de, roughness:0.8 }), new THREE.MeshStandardMaterial({ color:0xc8202a, roughness:0.6 })];
  const g = new THREE.Group(), bag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.1), _medMat[0]); g.add(bag);
  for(const [w, h] of [[0.14, 0.04], [0.04, 0.14]]){ const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), _medMat[1]); c.position.z = -0.056; g.add(c); }
  kitAttach(u, u.up, g, 'back', [0, -0.17, 0.06]); }
// into the field: beside him (a new run, a cleared field) or running in from behind (back from the rear, a new man)
function join(r, fromRear){ const p = S.player; if(!p) return; const f = p.facing || 0, side = (ROSTER.indexOf(r) % 2 ? 1 : -1) * (1.6 + Math.random());
  const d = fromRear ? 12 : 2.5, [x, z] = clampFieldXZ(p.pos.x - Math.sin(f) * d + Math.cos(f) * side, p.pos.z - Math.cos(f) * d - Math.sin(f) * side, 4);
  const a = spawnAlly(x, z, f, r.role === 'at' ? 'rifle' : r.role); if(r.role === 'at') armAlly(a); if(r.role === 'medic') medKit(a);
  a.mate = r; a.name = r.name; a.maxHp = 0; stats(a); a.hp = a.maxHp; r.a = a; r.back = false; r.dead = false;
  floatText(r.name.toUpperCase() + ' · ' + ROLE_VI[r.role].toUpperCase(), '#cfe8a0', { x, y:2.3, z }, 13);
  if(fromRear) ringPulse({ x, z }, 0x9bd14a, 2); }
// once a frame in battle (4×/s is enough): who is down, who comes back, the medic
export function updateSquadMates(){ if(MODE.id !== 'soldier' || !S.player || S.awaitingUpgrade) return; const t = NOW(); if(t < _thinkAt) return; _thinkAt = t + 0.25;
  const wk = S.stage + ':' + S.wave, newWave = _wave !== '' && wk !== _wave; _wave = wk; const back = [];
  for(const r of ROSTER){
    if(r.a && !FT.includes(r.a)){ r.dead = !!r.a.dead; r.a = null; r.back = !r.dead;   // down → the rear until the next wave · taken off a cleared field → straight back
      if(r.dead){ floatText(r.name.toUpperCase() + ' BỊ THƯƠNG', '#ff9a7a', S.player.pos, 15); if(Math.random() < 0.5) radio(ROLE_VI[r.role][0].toUpperCase() + ROLE_VI[r.role].slice(1) + ' ' + r.name + ' trúng đạn — đã đưa về tuyến sau, đợt tới sẽ quay lại!'); } }
    if(!r.a && (r.back || (r.dead && newWave))) back.push(r); }
  const rev = back.filter(r => r.dead).length; for(const r of back) join(r, r.dead);
  if(rev) radio('SCH: Tổ của anh đã được bổ sung ' + rev + ' người — đủ quân số.');
  medic(t); }
function medic(t){ const p = S.player, M = C().medic, r = ROSTER.find(q => q.role === 'medic' && q.a && FT.includes(q.a)); if(!r || t < _medAt) return;
  const a = r.a, k = p.medK || 1, d = Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z);
  if(p.hp > 0 && p.hp < p.maxHp * M.below && d < M.r){ const h = Math.round((M.hp + CAREER.rank * M.perRank) * k); p.hp = Math.min(p.maxHp, p.hp + h); updateHUD();
    ringPulse(p.pos, 0x5fd06a, 2); floatText('Y TÁ ' + r.name.toUpperCase() + ': BĂNG BÓ +' + h, '#7fe07a', p.pos, 16); sfx('powerup');
    for(let i = 0; i < 7; i++) spawnPart(p.pos.x, 1.1 + Math.random() * 0.6, p.pos.z, (Math.random() - 0.5) * 2, 1.5 + Math.random(), (Math.random() - 0.5) * 2, { color:0x7fe07a, size:0.22, life:0.7, grav:-1, drag:2 });
    _medAt = t + M.cd / k; return; }
  for(const q of ROSTER){ const b = q.a; if(!b || b === a || !FT.includes(b) || b.hp >= b.maxHp * M.mateBelow || Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) > M.r) continue;
    b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.45); floatText('+ ' + q.name, '#7fe07a', { x:b.pos.x, y:2.2, z:b.pos.z }, 13); _medAt = t + M.cd * 0.6 / k; return; } }
