// functions/index.js — Z163 the leaderboard on the server: econ/{uid} holds the player's record (how far he has validly got, his run's score bucket —
//   only these functions write it, every run lands in econ/{uid}/ledger), lb/{uid} and lbw/{week}/e/{uid} hold the boards. (no-tanks: the wallet,
//   inventory and purchases are gone — econBuy with them; the remaining functions keep their names so the deployed clients keep reporting.)
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { migrate, progress, scoreUpdate, cleanName } from './score.js';

const { cap } = JSON.parse(readFileSync(new URL('./catalog.json', import.meta.url), 'utf8'));
setGlobalOptions({ region:'asia-southeast1', maxInstances:5, memory:'256MiB' });   // small and capped: a runaway client can't run up the bill
initializeApp(); const db = getFirestore();
const uidOf = req => { if(!req.auth || !req.auth.uid) throw new HttpsError('unauthenticated', 'Cần đăng nhập'); return req.auth.uid; };

// run fn(state) inside a transaction on econ/{uid}; fn returns { err } or { res, ledger, writes }
async function change(uid, fn){ const ref=db.doc('econ/'+uid);
  return db.runTransaction(async t=>{ const snap=await t.get(ref); if(!snap.exists) throw new HttpsError('failed-precondition', 'no-econ');
    const s=snap.data(), out=fn(s, Date.now()); if(out.err) throw new HttpsError('failed-precondition', out.err);
    s.rev=(s.rev|0)+1; s.updatedAt=FieldValue.serverTimestamp(); t.set(ref, s);
    t.create(ref.collection('ledger').doc(), { ...out.ledger, rev:s.rev, at:FieldValue.serverTimestamp() });
    for(const w of out.writes||[]) t.set(db.doc(w.path), { ...w.data, at:FieldValue.serverTimestamp() }, { merge:true });   // the leaderboard rows
    return { ...out.res, rev:s.rev }; }); }

// first contact: the player's record from this device's save (how far it has got, clamped); a second call is a no-op
export const econBootstrap = onCall(async req=>{ const uid=uidOf(req), ref=db.doc('econ/'+uid);
  return db.runTransaction(async t=>{ const snap=await t.get(ref); if(snap.exists) return { existed:true };
    const s=migrate(req.data && req.data.profile, cap, Date.now()); s.meta={ ...s.meta, createdAt:Date.now() }; s.rev=1; s.updatedAt=FieldValue.serverTimestamp(); t.set(ref, s);
    t.create(ref.collection('ledger').doc(), { kind:'migrate', reach:s.meta.reach|0, rev:1, at:FieldValue.serverTimestamp() });
    return { existed:false }; }); });

// a stage won / a run over: { cleared, stage, loop, score, runId, name, secs } → the score the run can be worth goes on the boards
export const econRun = onCall(async req=>{ const uid=uidOf(req), r=req.data||{};
  return change(uid, (s, now)=>{ const p=progress(s, r, now, cap), sc=scoreUpdate(s, r, now, cap, p.clears, p.lvl), writes=[];
    const row=(score, lvl)=>({ uid, name:cleanName(r.name, uid), score, level:lvl|0 });
    if(sc.changed) writes.push({ path:'lb/'+uid, data:row(sc.best, s.meta.bestLvl) });
    if(sc.weekChanged) writes.push({ path:'lbw/'+sc.week+'/e/'+uid, data:row(sc.weekBest, s.meta.weekLvl) });
    return { writes, res:{ ...p, score:sc }, ledger:{ kind:'run', stage:r.stage|0, loop:r.loop|0, cleared:!!r.cleared, secs:r.secs|0, score:sc.runScore|0, clamped:!!sc.clamped } }; }); });
