#!/usr/bin/env python3
# Z167 a fortress commander shouting through a megaphone (horn band, overdrive, wall slap-back), then his men roar the charge under/after him
#   usage: megaphone.py voice.mp3 crowd.mp3 out.mp3
import subprocess, sys
def dur(f): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f]).decode().strip())
v, crowd, out = sys.argv[1:4]
tmp=out+'.v.wav'
subprocess.run(['ffmpeg','-loglevel','error','-y','-i',v,'-af','silenceremove=start_periods=1:start_threshold=-42dB,areverse,silenceremove=start_periods=1:start_threshold=-46dB,areverse,aresample=44100','-ac','1',tmp],check=True)
d=dur(tmp); F='aformat=sample_rates=44100:channel_layouts=mono'
fc=(f"[0:a]{F},highpass=f=650,highpass=f=650,lowpass=f=3800,lowpass=f=3800,equalizer=f=2200:t=q:w=1:g=8,asoftclip=type=tanh:threshold=0.6,"
    f"acompressor=threshold=-24dB:ratio=8:attack=3:release=80:makeup=6,aecho=0.8:0.55:70|150:0.32|0.18,volume=1.0[v];"
    f"[1:a]{F},highpass=f=120,afade=t=in:d=0.35,volume=0.55,adelay={int(max(0,d-0.35)*1000)}[c];"
    f"[v][c]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-17:TP=-1.2,{F}[out]")
subprocess.run(['ffmpeg','-loglevel','error','-y','-i',tmp,'-i',crowd,'-filter_complex',fc,'-map','[out]','-ac','1','-b:a','80k',out],check=True)
subprocess.run(['rm','-f',tmp])
