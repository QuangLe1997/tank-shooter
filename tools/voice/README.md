# Radio voices (Z166)

The 47 radio lines in `assets/voice/` are made in two steps.

1. **Read the line.** Google Cloud Text-to-Speech (project `steel-siege`) reads each line in `lines.json`:
   - speaker `c` (the commander, SCH) uses `vi-VN-Chirp3-HD-Charon` at rate 1.05;
   - speaker `v` (the enemy generals) uses `vi-VN-Chirp3-HD-Algenib` at rate 0.92.

   Bracketed tags such as `[urgent]` are ElevenLabs cues; the script strips them before reading. `gtts.py` signs in with `gcloud auth print-access-token`, so it needs no key file.
2. **Make it sound like a radio.** `radiofx.py` turns the clean read into a walkie-talkie transmission:
   - a squelch burst when the key goes up;
   - a narrow voice band, a little drive and bit-crush, then heavy compression;
   - a hiss bed under the voice;
   - a roger beep, then the squelch tail when the key is released.

   The enemy set is slightly fuller, like an intercepted transmission.

Re-make one line (example):

```bash
printf 'vi-VN-Chirp3-HD-Charon\tPháo kích! Chạy ngang ra!\t/tmp/arty.mp3\t1.05\n' | python3 tools/voice/gtts.py
```

```bash
python3 tools/voice/radiofx.py /tmp/arty.mp3 assets/voice/arty.mp3
```

For an enemy general's line, add `v` as a third argument to `radiofx.py`. Which radio message plays which file is decided in `src/audio/voice.js` (`VOICE_RULES`, plus the boss intro and taunt keys).
