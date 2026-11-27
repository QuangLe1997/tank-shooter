// functions/score.js — Z163 the leaderboard's rules on the server, pure (no Firebase): the player's record from a device's save, how far a run
//   has validly got, and how much of a claimed score it can be worth. Shared by index.js (Cloud Functions) and test.js. The caps come from
//   catalog.json (config.js SCORE_CAP, written by tools/catalog.mjs). (no-tanks: the wallet, the inventory, purchases and payouts are gone.)
const int=(v,lo,hi)=>Math.max(lo, Math.min(hi, Math.floor(Number(v)||0)));
export function freshState(){ return { meta:{} }; }
// first contact: how far the device's save has got comes across — only during the migration window, and never past migrateReach levels
export function migrate(p, cap, nowMs){ p=p&&typeof p==='object'?p:{}; const s=freshState();
  s.meta={ reach: nowMs!=null && nowMs>cap.migrateUntil ? 0 : int(((p.campaign&&p.campaign.max)|0)-1, 0, cap.migrateReach) };   // levels cleared, as far as the server is concerned
  return s; }
// a run reports where it stands: a clear counts only for the next level (or one already reached), at most once per minClearGap
export function progress(s, rep, nowMs, cap){ rep=rep||{}; const m=s.meta||(s.meta={});
  const reach=m.reach|0, lvl=int(rep.loop,0,50)*5+int(rep.stage,1,5);   // level being played (1-based)
  const clears=rep.cleared && lvl<=reach+1 && !(m.lastClearAt && nowMs-m.lastClearAt < cap.minClearGap*1000) ? 1 : 0;
  m.lastRunAt=nowMs; if(clears){ m.lastClearAt=nowMs; m.reach=Math.max(reach, lvl); }
  return { clears, lvl:Math.min(lvl, (m.reach|0)+1) }; }

// LEADERBOARD — the week a moment belongs to, in UTC+7 time (ISO week: Monday start), e.g. "2026-W46"
export function weekKey(ms){ const d=new Date(ms+7*3600e3); const day=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-day+3);
  const y=d.getUTCFullYear(), w1=new Date(Date.UTC(y,0,4)), wk=1+Math.round(((d-w1)/864e5-3+((w1.getUTCDay()+6)%7))/7); return y+'-W'+String(wk).padStart(2,'0'); }
// a run's score as the server believes it: each report may only add what its score bucket allows (plus a bonus on a validated clear)
export function scoreUpdate(s, rep, nowMs, cap, clears, lvl){ const C=cap, m=s.meta||(s.meta={}), runId=String(rep.runId||'').slice(0,40);
  if(!runId) return { changed:false };
  if(m.runId!==runId){ m.runId=runId; m.runScore=0; m.runSeen=0; m.runClears=0; m.runStart=nowMs; }
  if(nowMs-(m.runStart||nowMs) > C.runMaxH*3600e3) return { changed:false, closed:true };   // a run kept open for hours earns nothing more
  if(clears) m.runClears=(m.runClears|0)+1;
  const mins=Math.max(0, (nowMs-(m.scoreAt||m.createdAt||nowMs))/60000), lm=1+Math.floor((m.reach|0)/5)*C.loopMul;
  const bucket=Math.min(C.scoreBucket*lm, (m.scoreB??C.scoreBucket)+C.scorePerMin*lm*mins), bonus=clears ? C.scorePerClear*Math.max(1,lvl|0) : 0;
  const runCap=Math.round((C.runBase + C.runPerClear*(m.runClears|0))*lm);   // what the stages this run actually cleared can be worth
  const claimed=int(rep.score,0,1e9), delta=Math.max(0, claimed-(m.runSeen|0)), take=Math.max(0, Math.min(delta, bucket+bonus, runCap-(m.runScore|0)));
  m.runSeen=Math.max(m.runSeen|0, claimed); m.runScore=(m.runScore|0)+take; m.scoreB=Math.max(0, bucket+bonus-take); m.scoreAt=nowMs;
  const wk=weekKey(nowMs); if(m.week!==wk){ m.week=wk; m.weekBest=0; }
  let changed=false, weekChanged=false;
  if(m.runScore>(m.best|0)){ m.best=m.runScore; m.bestLvl=lvl|0; changed=true; }
  if(m.runScore>(m.weekBest|0)){ m.weekBest=m.runScore; m.weekLvl=lvl|0; weekChanged=true; }
  return { changed, weekChanged, week:wk, runScore:m.runScore, best:m.best|0, weekBest:m.weekBest|0, clamped:take<delta }; }
export function cleanName(n, uid){ const t=String(n||'').replace(/[<>&"'`\\]/g,'').replace(/\s+/g,' ').trim().slice(0,16); return t || ('CHỈ HUY '+String(uid||'').slice(0,4).toUpperCase()); }
