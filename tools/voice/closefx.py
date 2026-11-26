#!/usr/bin/env python3
# VOICE 2 voices that are NOT on the radio: the TTS silence trimmed, then a treatment by who / where the speaker is, levelled like the radio lines (−17 LUFS):
#   air      the driver beside you outdoors: a little low cut, gentle compression, a short slap off the street, a faint wind bed
#   phone    the driver answering your call on his phone: phone band, a little crunch
#   dry      the soldier himself: close, dry, a touch of breath compression
#   whisper  the soldier whispering over a man he has just put down: close and quieter (−22 LUFS)
#   mate     a squad mate a few metres off on the squad net: a touch of radio band, no squelch
#   far      an enemy rifleman shouting across the field: thinner, a longer slap-back, a little quieter (−18 LUFS)
#   usage: closefx.py in.mp3 out.mp3 <mode>
import subprocess, sys
def dur(f): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f]).decode().strip())
F='aformat=sample_rates=44100:channel_layouts=mono'
FX={
  'air':    ('highpass=f=110,acompressor=threshold=-22dB:ratio=3:attack=5:release=90:makeup=3,aecho=0.85:0.3:38|85:0.14|0.07', 0.004, -17),
  'phone':  ('highpass=f=320,highpass=f=320,lowpass=f=3300,lowpass=f=3300,equalizer=f=1600:t=q:w=1:g=5,asoftclip=type=atan:threshold=0.75,acompressor=threshold=-24dB:ratio=6:attack=3:release=70:makeup=5,aresample=8000,aresample=44100', 0.0025, -18),
  'dry':    ('highpass=f=90,acompressor=threshold=-22dB:ratio=3.5:attack=4:release=80:makeup=3,aecho=0.9:0.2:12:0.08', 0, -17),
  'whisper':('highpass=f=140,acompressor=threshold=-26dB:ratio=3:attack=4:release=80:makeup=4,aecho=0.9:0.2:12:0.06', 0, -22),
  'mate':   ('highpass=f=240,lowpass=f=4600,equalizer=f=1800:t=q:w=1.2:g=3,asoftclip=type=atan:threshold=0.85,acompressor=threshold=-24dB:ratio=5:attack=3:release=70:makeup=4', 0.003, -17),
  'far':    ('highpass=f=200,lowpass=f=3600,acompressor=threshold=-22dB:ratio=4:attack=4:release=90:makeup=3,aecho=0.8:0.45:95|190:0.28|0.14', 0.003, -18),
}
def close(src, dst, mode):
    chain, bed, lufs = FX[mode]
    tmp=dst+'.trim.wav'
    subprocess.run(['ffmpeg','-loglevel','error','-y','-i',src,'-af','silenceremove=start_periods=1:start_threshold=-42dB,areverse,silenceremove=start_periods=1:start_threshold=-46dB,areverse,aresample=44100','-ac','1',tmp],check=True)
    d=dur(tmp)+0.35   # room for the slap-back tail
    fc=f"[0:a]{F},apad=pad_dur=0.35,{chain},{F}[v];"
    if bed>0: fc+=f"[1:a]{F},highpass=f=180,lowpass=f=2400,volume={bed/0.06:.3f}[n];[v][n]amix=inputs=2:duration=first:normalize=0,"
    else: fc+="[v]"
    fc+=f"afade=t=out:st={max(0,d-0.12):.3f}:d=0.12,loudnorm=I={lufs}:TP=-1.5,{F}[out]"
    cmd=['ffmpeg','-loglevel','error','-y','-i',tmp,'-f','lavfi','-t',f'{d:.3f}','-i','anoisesrc=color=pink:amplitude=0.06:sample_rate=44100','-filter_complex',fc,'-map','[out]','-ac','1','-b:a','80k',dst]
    subprocess.run(cmd,check=True); subprocess.run(['rm','-f',tmp])
if __name__=='__main__': close(sys.argv[1], sys.argv[2], sys.argv[3])
