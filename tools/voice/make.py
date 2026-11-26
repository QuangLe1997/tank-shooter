#!/usr/bin/env python3
# VOICE 2 make every line that is new or changed: node tools/voice/build.mjs --plan | python3 tools/voice/make.py [--dry] [--only key1,key2] [--crowd crowd.mp3]
#   one TSV line per file (key, voice, text, rate, fx). tools/voice/made.json remembers what each file was made from (voice | text | rate | fx); a line whose
#   recipe is unchanged is skipped, so a re-run only pays for what changed. --dry: count the characters that would be sent, send nothing.
#   Google Cloud TTS is billed to the project in gtts.py's x-goog-user-project header (steel-siege); the access token is never printed or stored.
#   fx: radio / radio_v → radiofx.py · megaphone → megaphone.py (needs --crowd: his men's war cry) · air / phone / dry / whisper / mate / far → closefx.py
import sys, os, json, hashlib, subprocess, tempfile
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.join(HERE,'..','..'); OUT=os.path.join(ROOT,'assets','voice'); MADE=os.path.join(HERE,'made.json')
args=sys.argv[1:]; dry='--dry' in args
only=set(args[args.index('--only')+1].split(',')) if '--only' in args else None
crowd=args[args.index('--crowd')+1] if '--crowd' in args else None
assert "'x-goog-user-project':'steel-siege'" in open(os.path.join(HERE,'gtts.py')).read(), 'gtts.py must bill steel-siege'
made=json.load(open(MADE)) if os.path.exists(MADE) else {}
todo=[]
for line in sys.stdin:
    key,voice,text,rate,fx=line.rstrip('\n').split('\t'); rec=hashlib.sha1('|'.join([voice,text,rate,fx]).encode()).hexdigest()[:12]
    if only is not None and key not in only: continue
    if only is None and made.get(key)==rec and os.path.exists(os.path.join(OUT,key+'.mp3')): continue
    todo.append((key,voice,text,float(rate),fx,rec))
chars=sum(len(t[2]) for t in todo)
print(f'{len(todo)} files to make, {chars} characters (≈ USD {chars*30/1e6:.3f} at Chirp3-HD rates)')
if dry or not todo: sys.exit(0)
if any(t[4]=='megaphone' for t in todo) and not crowd: sys.exit('megaphone lines need --crowd')
sys.path.insert(0,HERE); import gtts, radiofx, closefx   # (gtts signs in once here, through gcloud)
tmp=tempfile.mkdtemp(prefix='voice-')
for key,voice,text,rate,fx,rec in todo:
    raw=os.path.join(tmp,key+'.raw.mp3'); dst=os.path.join(OUT,key+'.mp3')
    gtts.tts(voice,text,raw,rate)
    if fx in ('radio','radio_v'): radiofx.radio(raw,dst,fx=='radio_v')
    elif fx=='megaphone': subprocess.run([sys.executable,os.path.join(HERE,'megaphone.py'),raw,crowd,dst],check=True)
    else: closefx.close(raw,dst,fx)
    made[key]=rec; json.dump(made,open(MADE,'w'),indent=0,sort_keys=True); print('ok',key)
