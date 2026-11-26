// core/score-report.js — Z163 THE LEADERBOARD'S RUN REPORT: at the end of each stage (and when a run ends) the score so far goes to the econRun Cloud
//   Function, which holds it to what the run can be worth (functions/score.js) and writes the boards (no-tanks: the wallet, the inventory and the
//   purchases that rode on it are gone; the functions keep their names so a deployed board keeps working). Once per account econBootstrap makes the
//   server's record of the player (how far he has got) from this device's save.
import { CLOUDSAVE, PROFILE, S, cloudFB, cloudProfile, onCloud, saveProfile } from '../hub.js';

const REGION='asia-southeast1';
export const REPORT = { call:null, mod:null, starting:false, inflight:false, t0:Date.now() };
export function reportOn(){ return !!(REPORT.call && CLOUDSAVE.uid && PROFILE._econUid===CLOUDSAVE.uid); }

onCloud(C=>{ if(C.state==='ready' && C.uid && !REPORT.call && !REPORT.starting) startReports(); });
export async function startReports(){ const F=cloudFB(); if(!F || !CLOUDSAVE.uid) return; REPORT.starting=true;
  try{ if(!REPORT.mod) REPORT.mod=await import(F.sdkBase+'firebase-functions.js'); const fns=REPORT.mod.getFunctions(F.app, REGION), call=name=>REPORT.mod.httpsCallable(fns, name);
    if(PROFILE._econUid!==CLOUDSAVE.uid){ await call('econBootstrap')({ profile:cloudProfile() }); PROFILE._econUid=CLOUDSAVE.uid; saveProfile(true); }
    REPORT.call=call; }
  catch(e){ console.warn('score report', e); } REPORT.starting=false; }
// a stage won / a run over: the score so far, where it stands and whether the stage was cleared — the server takes what the run can be worth
export async function reportRun(o){ if(!reportOn() || REPORT.inflight || S.run && S.run.offBoard) return;   // (MODE 3 a night defence / a daily challenge keeps its own local board: campaign/mode-run.js)
  const rep={ cleared:!!(o&&o.cleared), stage:S.stage|0, loop:S.loop|0, score:S.score|0, runId:S.runId||'', name:PROFILE.nickname||'', secs:Math.round((Date.now()-REPORT.t0)/1000) };
  REPORT.inflight=true;
  try{ const r=await REPORT.call('econRun')(rep); REPORT.t0=Date.now(); const sc=r && r.data && r.data.score; if(sc && sc.clamped) console.warn('score clamped', sc); }
  catch(e){ console.warn('run report', e.message); }   // a lost report only costs the board this stage's score
  REPORT.inflight=false; }
