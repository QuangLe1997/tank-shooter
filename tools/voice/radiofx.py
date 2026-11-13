#!/usr/bin/env python3
# walkie-talkie: key-up squelch → narrowband, driven, compressed voice over a hiss bed → roger beep → key-down squelch tail
import subprocess, sys, json
def dur(f): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f]).decode().strip())
def radio(src, dst, villain=False):
    # trim the TTS silence first so the squelch sits right on the words
    tmp=dst+'.trim.wav'
    subprocess.run(['ffmpeg','-loglevel','error','-y','-i',src,'-af','silenceremove=start_periods=1:start_threshold=-42dB,areverse,silenceremove=start_periods=1:start_threshold=-46dB,areverse,aresample=44100','-ac','1',tmp],check=True)
    d=dur(tmp)+0.06
    F='aformat=sample_rates=44100:channel_layouts=mono'
    hp,lp,mix=(330,3300,0.18) if villain else (430,2900,0.28)   # the enemy set is a little fuller (intercepted transmission), ours is a tinny field radio
    fc=(f"[0:a]{F},highpass=f={hp},highpass=f={hp},lowpass=f={lp},lowpass=f={lp},equalizer=f=1750:t=q:w=1.1:g=6,"
        f"asoftclip=type=atan:threshold=0.7,acrusher=bits=9:mode=log:mix={mix},acompressor=threshold=-26dB:ratio=9:attack=2:release=60:makeup=6,"
        f"aresample=11025,aresample=44100,{F},apad=pad_dur=0.06[v];"
        f"[1:a]{F},highpass=f=1000,lowpass=f=4500,volume=0.55,tremolo=f=9:d=0.35[st];"
        "[v][st]amix=inputs=2:duration=first:normalize=0[vs];"
        f"[2:a]{F},bandpass=f=2300:w=1800,afade=t=in:d=0.005,afade=t=out:st=0.06:d=0.03,volume=0.9[sq1];"
        f"[3:a]{F},volume=0.22,afade=t=out:st=0.06:d=0.01[beep];"
        f"[4:a]{F},bandpass=f=2100:w=2200,afade=t=out:st=0.04:d=0.16,volume=0.75[sq2];"
        "[sq1][vs][beep][sq2]concat=n=4:v=0:a=1,loudnorm=I=-17:TP=-1.2,"+F+"[out]")
    cmd=['ffmpeg','-loglevel','error','-y','-i',tmp,
         '-f','lavfi','-t',f'{d:.3f}','-i','anoisesrc=color=pink:amplitude=0.06:sample_rate=44100',
         '-f','lavfi','-t','0.09','-i','anoisesrc=color=white:amplitude=0.6:sample_rate=44100',
         '-f','lavfi','-t','0.07','-i','sine=frequency=1150:sample_rate=44100',
         '-f','lavfi','-t','0.2','-i','anoisesrc=color=white:amplitude=0.55:sample_rate=44100',
         '-filter_complex',fc,'-map','[out]','-ac','1','-b:a','80k',dst]
    subprocess.run(cmd,check=True); subprocess.run(['rm','-f',tmp])
if __name__=='__main__': radio(sys.argv[1], sys.argv[2], len(sys.argv)>3 and sys.argv[3]=='v')
