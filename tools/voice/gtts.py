#!/usr/bin/env python3
import json, subprocess, sys, base64, urllib.request
TOK=subprocess.check_output(['gcloud','auth','print-access-token']).decode().strip()
def tts(voice, text, out, rate=1.0, pitch=0):
    cfg={ 'audioEncoding':'MP3', 'sampleRateHertz':44100 }
    if 'Chirp3' not in voice: cfg.update({ 'speakingRate':rate, 'pitch':pitch })
    elif rate!=1.0: cfg['speakingRate']=rate
    body={ 'input':{ 'text':text }, 'voice':{ 'languageCode':'vi-VN', 'name':voice }, 'audioConfig':cfg }
    req=urllib.request.Request('https://texttospeech.googleapis.com/v1/text:synthesize', data=json.dumps(body).encode(), headers={ 'Authorization':'Bearer '+TOK, 'x-goog-user-project':'steel-siege', 'Content-Type':'application/json' })
    d=json.load(urllib.request.urlopen(req)); open(out,'wb').write(base64.b64decode(d['audioContent']))
if __name__=='__main__':
    for line in sys.stdin:
        v,t,o,r=line.rstrip('\n').split('\t'); tts(v,t,o,float(r)); print('ok',o)
