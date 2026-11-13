// core/cloud.js — Z162 CLOUDSAVE SAVE: Firebase Auth (anonymous first, Google link later) + the profile mirrored to Firestore users/{uid}, offline-first
import { CLOUD_CFG } from '../../config.js';
import { PROFILE, PROFILE_KEY, refreshStartUI, refreshWallet, saveProfile } from '../hub.js';

// state shown in Settings → TÀI KHOẢN; the game never waits on any of this (localStorage stays the live copy)
export const CLOUDSAVE = { state:'off', uid:null, anon:true, email:'', lastSync:0, err:'', busy:false };
let FB=null, _pushT=null, _lastPush=0;
function subs(){ return globalThis.__cloudSubs || (globalThis.__cloudSubs=[]); }   // hoisted: other modules may subscribe before this one has run
export function onCloud(fn){ subs().push(fn); }
function emit(){ for(const f of subs()){ try{ f(CLOUDSAVE); }catch(e){} } }
function set(st, err){ CLOUDSAVE.state=st; if(err!=null) CLOUDSAVE.err=String(err); emit(); }

// the part of the profile that follows the player between devices (device settings stay local)
export function cloudProfile(){ const out={}; for(const k in PROFILE){ if(CLOUD_CFG.localOnly.includes(k) || PROFILE[k]===undefined || typeof PROFILE[k]==='function') continue; out[k]=PROFILE[k]; }
  return JSON.parse(JSON.stringify(out)); }
// how far a save has got — decides which side wins when both changed
export function progressOf(p){ if(!p) return -1; const c=p.campaign&&p.campaign.max|0, own=(p.ownedGuns||[]).length+(p.ownedTanks||[]).length;
  return c*1e7 + own*1e5 + Math.min(99999, ((p.coins|0)+(p.diamonds|0)*100)/10); }

export async function initCloud(){ if(FB || CLOUDSAVE.state==='connecting') return; if(typeof navigator!=='undefined' && navigator.onLine===false){ set('offline'); addEventListener('online', ()=>initCloud(), { once:true }); return; }
  set('connecting');
  try{ const U=CLOUD_CFG.sdk, [A, AU, FS]=await Promise.all([import(U+'firebase-app.js'), import(U+'firebase-auth.js'), import(U+'firebase-firestore.js')]);
    const app=A.initializeApp(CLOUD_CFG.app), auth=AU.getAuth(app), db=FS.getFirestore(app); FB={ A, AU, FS, app, auth, db };
    try{ await AU.setPersistence(auth, AU.indexedDBLocalPersistence); }catch(e){}
    AU.onAuthStateChanged(auth, async u=>{ if(!u){ try{ await AU.signInAnonymously(auth); }catch(e){ set('error', e.code||e.message); } return; }
      CLOUDSAVE.uid=u.uid; CLOUDSAVE.anon=u.isAnonymous; CLOUDSAVE.email=u.email||''; await pullMerge(); });
    addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') pushNow(); });
    addEventListener('online', ()=>{ if(CLOUDSAVE.state==='offline') pullMerge(); });
  }catch(e){ FB=null; set(navigator.onLine===false?'offline':'error', e.message||e); } }

// first contact on this device: decide whose save wins, keep the loser as a local backup
export async function pullMerge(){ if(!FB || !CLOUDSAVE.uid) return; const { FS, db }=FB; CLOUDSAVE.busy=true; set('syncing');
  try{ const ref=FS.doc(db,'users',CLOUDSAVE.uid), snap=await FS.getDoc(ref), remote=snap.exists()?snap.data():null;
    const localDirty=(PROFILE._rev|0)>(PROFILE._syncedRev|0) || PROFILE._cloudUid!==CLOUDSAVE.uid;
    if(!remote){ await push(true); }                                                                   // nothing in the cloud yet → this device's save goes up (migration)
    else if(!localDirty || (remote.rev|0)>(PROFILE._syncedRev|0) && progressOf(remote.profile)>=progressOf(PROFILE)){   // the cloud is newer / further → take it
      if(localDirty) backupLocal(); applyRemote(remote); }
    else await push(true);                                                                           // this device is ahead → upload
    CLOUDSAVE.lastSync=Date.now(); set('ready');
  }catch(e){ set(navigator.onLine===false?'offline':'error', e.code||e.message); }
  CLOUDSAVE.busy=false; emit(); }
function backupLocal(){ try{ localStorage.setItem(PROFILE_KEY+'.bak', JSON.stringify(PROFILE)); }catch(e){} }
function applyRemote(remote){ const keep={}; for(const k of CLOUD_CFG.localOnly) if(PROFILE[k]!==undefined) keep[k]=PROFILE[k];
  for(const k of Object.keys(PROFILE)) if(!CLOUD_CFG.localOnly.includes(k)) delete PROFILE[k];
  Object.assign(PROFILE, remote.profile||{}, keep); PROFILE._rev=PROFILE._syncedRev=remote.rev|0; PROFILE._cloudUid=CLOUDSAVE.uid;
  saveProfile(true); try{ refreshWallet(); refreshStartUI(); }catch(e){} }
async function push(force){ if(!FB || !CLOUDSAVE.uid) return; const { FS, db }=FB; const rev=Math.max(PROFILE._rev|0, (PROFILE._syncedRev|0)+1);
  await FS.setDoc(FS.doc(db,'users',CLOUDSAVE.uid), { v:1, rev, profile:cloudProfile(), device:navigator.platform||'', updatedAt:FS.serverTimestamp() });
  PROFILE._rev=PROFILE._syncedRev=rev; PROFILE._cloudUid=CLOUDSAVE.uid; _lastPush=performance.now()/1000; saveProfile(true); CLOUDSAVE.lastSync=Date.now(); }
// every local save marks the profile dirty; a write goes out at most once per pushEvery seconds (and when the window hides)
export function cloudDirty(){ PROFILE._rev=(PROFILE._rev|0)+1; if(!FB || !CLOUDSAVE.uid || CLOUDSAVE.state!=='ready' || _pushT) return;
  const wait=Math.max(1, CLOUD_CFG.pushEvery-(performance.now()/1000-_lastPush)); _pushT=setTimeout(()=>{ _pushT=null; pushNow(); }, wait*1000); }
export async function pushNow(){ if(!FB || !CLOUDSAVE.uid || CLOUDSAVE.busy || (PROFILE._rev|0)<=(PROFILE._syncedRev|0)) return; CLOUDSAVE.busy=true;
  try{ await push(); set('ready'); }catch(e){ set(navigator.onLine===false?'offline':'error', e.code||e.message); } CLOUDSAVE.busy=false; emit(); }
export async function syncNow(){ if(!FB){ await initCloud(); return; } await pullMerge(); }

// keep the progress when changing device: link this anonymous player to a Google account (web only — the Mac app opens popups in the browser)
export async function linkGoogle(){ if(!FB) return false; const { AU, auth }=FB, prov=new AU.GoogleAuthProvider();
  try{ const r=await AU.linkWithPopup(auth.currentUser, prov); CLOUDSAVE.anon=false; CLOUDSAVE.email=r.user.email||''; set('ready'); await pushNow(); return true; }
  catch(e){ if(e.code==='auth/credential-already-in-use'){ const cred=AU.GoogleAuthProvider.credentialFromError(e); if(cred){ backupLocal(); await AU.signInWithCredential(auth, cred); return true; } }   // that Google account already has a save → switch to it (onAuthStateChanged pulls it)
    set('error', e.code||e.message); return false; } }
export async function signOutCloud(){ if(!FB) return; backupLocal(); await FB.AU.signOut(FB.auth); }   // a new anonymous player starts; the local save stays
