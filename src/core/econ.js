// core/econ.js — Z162 SERVER ECONOMY on the client: econ/{uid} (written only by Cloud Functions) drives the wallet + inventory; purchases call econBuy,
//   what a run earns is reported to econRun at the end of each stage. Until a device has been linked once, the old local economy keeps working.
import { CLOUDSAVE, CREW_RECRUITS, PROFILE, S, cloudFB, cloudProfile, floatText, onCloud, payCost, refreshStartUI, refreshWallet, saveProfile, sfx } from '../hub.js';

const REGION='asia-southeast1';
export const ECON = { live:false, srv:null, unsub:null, fns:null, starting:false, inflight:false };
// server mode = this device has been bootstrapped for the signed-in player; then every spend must go through the server
export function econOn(){ return !!(CLOUDSAVE.uid && PROFILE._econUid===CLOUDSAVE.uid); }
export function econPend(){ const p=PROFILE._pend||(PROFILE._pend={ c:0, d:0, ammo:{}, guns:[], kills:0, t0:Date.now() }); p.ammo=p.ammo||{}; p.guns=p.guns||[]; return p; }
// earnings during play: added to the display at once, owed by the server until the run is reported
export function econEarn(c, d){ if(!econOn()) return; const p=econPend(); p.c+=c|0; p.d+=d|0; }
export function econGunFound(id){ if(!econOn()) return; const p=econPend(); if(!p.guns.includes(id)) p.guns.push(id); }

onCloud(C=>{ if(C.state==='ready' && C.uid && !ECON.live && !ECON.starting) startEcon(); });
export async function startEcon(){ const F=cloudFB(); if(!F || !CLOUDSAVE.uid) return; ECON.starting=true;
  try{ if(!ECON.mod) ECON.mod=await import(F.sdkBase+'firebase-functions.js'); const fns=ECON.mod.getFunctions(F.app, REGION);
    ECON.call=name=>ECON.mod.httpsCallable(fns, name);
    if(!econOn()){ await ECON.call('econBootstrap')({ profile:cloudProfile() }); PROFILE._econUid=CLOUDSAVE.uid; PROFILE._pend={ c:0, d:0, ammo:{}, guns:[], kills:0, t0:Date.now() }; saveProfile(true); }
    const { FS, db }=F; if(ECON.unsub) ECON.unsub();
    ECON.unsub=FS.onSnapshot(FS.doc(db,'econ',CLOUDSAVE.uid), snap=>{ if(!snap.exists()) return; ECON.srv=snap.data(); ECON.live=true; applyEcon(); }, ()=>{ ECON.live=false; });
    const p=econPend(); if(p.c||p.d||p.guns.length||Object.keys(p.ammo).length) setTimeout(()=>econReportRun({ cleared:false, recovered:true }), 1500);   // a run that ended while offline / a crash
  }catch(e){ console.warn('econ', e); } ECON.starting=false; }
// server state → the profile the game reads (wallet = server + still-unreported earnings)
export function applyEcon(){ const s=ECON.srv; if(!s) return; const p=econPend();
  PROFILE.coins=(s.coins|0)+(p.c|0); PROFILE.diamonds=(s.diamonds|0)+(p.d|0);
  PROFILE.ownedGuns=[...new Set([...(s.guns||['rifle']), ...p.guns])]; PROFILE.loadout=(PROFILE.loadout||[]).filter(g=>PROFILE.ownedGuns.includes(g)); if(!PROFILE.loadout.length) PROFILE.loadout=['rifle'];
  PROFILE.ownedTanks=[...(s.tanks||['lqt'])]; if(!PROFILE.ownedTanks.includes(PROFILE.tankModel)) PROFILE.tankModel='lqt';
  PROFILE.upgrades={ ...(s.upgrades||{}) };
  PROFILE.kit=PROFILE.kit||{}; for(const [id,k] of Object.entries(s.kit||{})) PROFILE.kit[id]={ ...(PROFILE.kit[id]||{}), ...k };
  const c=PROFILE.crew=PROFILE.crew||{ roster:[], seats:{} }; c.roster=c.roster||[];
  for(const id of s.crew||[]) if(!c.roster.some(m=>m.id===id)){ const R=CREW_RECRUITS.find(r=>r.id===id); c.roster.push({ id, lvl:R?R.lvl:1, xp:0 }); }
  c.roster=c.roster.filter(m=>(s.crew||[]).includes(m.id));
  PROFILE.ammo={}; for(const [k,n] of Object.entries(s.ammo||{})) PROFILE.ammo[k]=Math.max(0,(n|0)-((p.ammo[k])|0));
  saveProfile(true); try{ refreshWallet(); refreshStartUI(); }catch(e){} dispatchEvent(new Event('econ')); }
// spend: server mode → econBuy (needs a connection), else the old local payment; resolves true/false
export async function econBuy(type, id, track, cost, localGrant){
  if(!econOn()){ if(!payCost(cost)) return false; localGrant(); saveProfile(); return true; }
  if(!ECON.live || !ECON.call){ floatText('CẦN KẾT NỐI MẠNG ĐỂ MUA', '#ff9a6a', S.player?S.player.pos:{x:0,y:2,z:0}, 18); sfx('alarm'); return false; }
  { const p=econPend(); if(p.c>0||p.d>0) await econReportRun({ cleared:false }); }   // earnings still owed by the server count towards this purchase
  const rev0=ECON.srv?ECON.srv.rev|0:0;
  try{ const r=await ECON.call('econBuy')({ type, id, track:track||null }); const got=r&&r.data&&r.data.rev|0;
    if((ECON.srv&&ECON.srv.rev|0)>=got && got>rev0) applyEcon();   // the snapshot already has it
    else { ECON.buying=true; try{ PROFILE.coins-=cost&&cost.c||0; PROFILE.diamonds-=cost&&cost.d||0; localGrant(); }finally{ ECON.buying=false; } saveProfile(true); }   // show it now; the snapshot brings the exact server state
    return true; }   // shown at once; the snapshot then brings the exact server state
  catch(e){ console.warn('buy', e.message); sfx('alarm'); return false; } }
// end of a stage / run: report what was earned; the server pays it (clamped) and the snapshot updates the wallet
export async function econReportRun(o){ if(!econOn() || !ECON.call || ECON.inflight) return; const p=econPend();
  const rep={ coins:p.c|0, diamonds:p.d|0, ammoUsed:{ ...p.ammo }, guns:[...p.guns], cleared:!!(o&&o.cleared), stage:S.stage|0, loop:S.loop|0, kills:p.kills|0, secs:Math.round((Date.now()-(p.t0||Date.now()))/1000) };
  ECON.inflight=true;
  try{ const r=await ECON.call('econRun')(rep); p.c-=rep.coins; p.d-=rep.diamonds; for(const k in rep.ammoUsed) p.ammo[k]=Math.max(0,(p.ammo[k]|0)-rep.ammoUsed[k]); p.guns=p.guns.filter(g=>!rep.guns.includes(g)); p.kills=0; p.t0=Date.now();
    saveProfile(true); applyEcon(); if(r && r.clamped) console.warn('payout clamped', r); }
  catch(e){ console.warn('run report', e.message); }   // stays pending; retried on the next report / start-up
  ECON.inflight=false; }
