// functions/index.js — Z162 Steel Siege economy on the server: econ/{uid} holds wallet + inventory (only these functions write it), every change lands in econ/{uid}/ledger.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { migrate, purchase, payout, scoreUpdate, cleanName } from './economy.js';

const cat = JSON.parse(readFileSync(new URL('./catalog.json', import.meta.url), 'utf8'));
setGlobalOptions({ region:'asia-southeast1', maxInstances:5, memory:'256MiB' });   // small and capped: a runaway client can't run up the bill
initializeApp(); const db = getFirestore();
const uidOf = req => { if(!req.auth || !req.auth.uid) throw new HttpsError('unauthenticated', 'Cần đăng nhập'); return req.auth.uid; };

// run fn(state) inside a transaction on econ/{uid}; fn returns { err } or { res, ledger }
async function change(uid, fn){ const ref=db.doc('econ/'+uid);
  return db.runTransaction(async t=>{ const snap=await t.get(ref); if(!snap.exists) throw new HttpsError('failed-precondition', 'no-econ');
    const s=snap.data(), out=fn(s, Date.now()); if(out.err) throw new HttpsError('failed-precondition', out.err);
    s.rev=(s.rev|0)+1; s.updatedAt=FieldValue.serverTimestamp(); t.set(ref, s);
    t.create(ref.collection('ledger').doc(), { ...out.ledger, coins:s.coins, diamonds:s.diamonds, rev:s.rev, at:FieldValue.serverTimestamp() });
    for(const w of out.writes||[]) t.set(db.doc(w.path), { ...w.data, at:FieldValue.serverTimestamp() }, { merge:true });   // Z163 leaderboard rows
    return { ...out.res, rev:s.rev }; }); }

// first contact: create the server wallet + inventory from this device's save (clamped); a second call is a no-op
export const econBootstrap = onCall(async req=>{ const uid=uidOf(req), ref=db.doc('econ/'+uid);
  return db.runTransaction(async t=>{ const snap=await t.get(ref); if(snap.exists) return { existed:true };
    const s=migrate(req.data && req.data.profile, cat, Date.now()); s.meta={ ...s.meta, createdAt:Date.now() }; s.rev=1; s.updatedAt=FieldValue.serverTimestamp(); t.set(ref, s);
    t.create(ref.collection('ledger').doc(), { kind:'migrate', coins:s.coins, diamonds:s.diamonds, guns:s.guns.length, tanks:s.tanks.length, rev:1, at:FieldValue.serverTimestamp() });
    return { existed:false }; }); });

// buy one thing: { type: gun|tank|up|kit|sig|crew|ammo, id, track? }
export const econBuy = onCall(async req=>{ const uid=uidOf(req), r=req.data||{};
  return change(uid, s=>{ const o=purchase(s, r, cat); if(!o.ok) return { err:o.err }; return { res:{ ok:true, cost:o.cost }, ledger:{ kind:'buy', type:String(r.type), id:String(r.id), track:r.track?String(r.track):null, cost:o.cost } }; }); });

// a run (stage) ended: { coins, diamonds, cleared, stage, loop, kills, secs, ammoUsed } → paid within the caps
export const econRun = onCall(async req=>{ const uid=uidOf(req), r=req.data||{};
  return change(uid, (s, now)=>{ const p=payout(s, r, now, cat), sc=scoreUpdate(s, r, now, cat, p.clears, p.lvl), writes=[];
    const row=(score, lvl)=>({ uid, name:cleanName(r.name, uid), score, level:lvl|0, tank:String(r.tank||'lqt').slice(0,12) });
    if(sc.changed) writes.push({ path:'lb/'+uid, data:row(sc.best, s.meta.bestLvl) });
    if(sc.weekChanged) writes.push({ path:'lbw/'+sc.week+'/e/'+uid, data:row(sc.weekBest, s.meta.weekLvl) });
    return { writes, res:{ ...p, score:sc }, ledger:{ kind:'run', stage:r.stage|0, loop:r.loop|0, cleared:!!r.cleared, kills:r.kills|0, secs:r.secs|0, asked:{ c:r.coins|0, d:r.diamonds|0 }, paid:{ c:p.coins, d:p.diamonds }, clamped:p.clamped } }; }); });
