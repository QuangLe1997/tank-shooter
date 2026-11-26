# Voices (Z166 · VOICE 1–2)

Every spoken line of the game is one file in `assets/voice/` (`key.mp3`; numbered files `key_1…key_n` are alternative takes). The soldier-only game (VOICE 1) has no tanks: no line speaks of hulls, armour, barrels, repair kits or "xe một". Besides the commander's radio, the xe ôm driver, the soldier himself, his squad and the enemy speak (VOICE 2).

## The list of lines

- `lines.json` — every line: `[speaker, key, text, rate]`. The commander's, the generals', the fortress chiefs' and the extra banter lines are written here by hand.
- The driver's and the soldier's dialogue is the text `config.js` `RIDE_TALK` already shows on screen. Its entries in `lines.json` (`d_<event>_<n>` / `s_<event>_<n>`, n = index + 1) are rewritten from config on every run of `build.mjs`. Edit the dialogue in config, never in `lines.json`.
- `node tools/voice/build.mjs` rewrites `lines.json` and `src/data/voice-lines.js` (the game's `key → [speaker, text]` table: subtitles, and which takes exist), then prints the line and character count.

## Who reads what

| speaker | who | Google voice (Chirp3-HD) | treatment |
|---|---|---|---|
| `c` | the commander, SCH | `vi-VN-Chirp3-HD-Charon` | `radiofx.py` (walkie-talkie) |
| `v` | an enemy general | `vi-VN-Chirp3-HD-Algenib` | `radiofx.py … v` (intercepted, fuller) |
| `f` | a fortress chief | `vi-VN-Chirp3-HD-Rasalgethi` | `megaphone.py` + his men's war cry |
| `d` | the xe ôm driver | `vi-VN-Chirp3-HD-Fenrir` | `closefx.py air` (close, outdoor air) |
| `dp` | the driver on his phone (answering your call) | `vi-VN-Chirp3-HD-Fenrir` | `closefx.py phone` |
| `s` | the soldier (you) | `vi-VN-Chirp3-HD-Enceladus` | `closefx.py dry` |
| `sw` | the soldier whispering (a silent blade kill) | `vi-VN-Chirp3-HD-Enceladus` | `closefx.py whisper` (−22 LUFS) |
| `m1` / `m2` | two squad mates | `vi-VN-Chirp3-HD-Orus` / `-Umbriel` | `closefx.py mate` (a touch of radio band) |
| `e` | an enemy rifleman | `vi-VN-Chirp3-HD-Alnilam` | `closefx.py far` (thin, slap-back, −18 LUFS) |

Every file is levelled to −17 LUFS integrated, true peak ≤ −1.5 dBTP (radio, megaphone and close alike), except the whisper and the distant enemy. Bracketed tags such as `[urgent]` are stripped before reading.

## Making the files

`gtts.py` reads a line with Google Cloud Text-to-Speech. It signs in with `gcloud auth print-access-token` (no key file; the token is never printed or stored) and bills the project in its `x-goog-user-project` header, `steel-siege`. Chirp3-HD costs about USD 30 per million characters; the whole set (~6,400 characters) is about USD 0.20.

```bash
node tools/voice/build.mjs                                         # the list, and how many characters
node tools/voice/build.mjs --plan | python3 tools/voice/make.py --dry   # what would be sent, and the cost
node tools/voice/build.mjs --plan | python3 tools/voice/make.py --crowd crowd.wav
```

`make.py` makes only the lines that are new or changed: `made.json` remembers the recipe (voice | text | rate | treatment) of each file. `--only key1,key2` remakes just those. The megaphone lines need `--crowd`: a clip of the garrison's war cry (VOICE 1 cut it from the tail of the old `f_rally_2`, after the chief's words; the original was made with ElevenLabs). `x_cheer` (the army's victory cheer) and `x_scream` have no words and are not in the list.

One line by hand, the old way:

```bash
printf 'vi-VN-Chirp3-HD-Charon\tPháo kích! Chạy ngang ra!\t/tmp/arty.mp3\t1.05\n' | python3 tools/voice/gtts.py
python3 tools/voice/radiofx.py /tmp/arty.mp3 assets/voice/arty.mp3        # add v for a general
python3 tools/voice/closefx.py /tmp/x.mp3 assets/voice/x.mp3 air          # air | phone | dry | whisper | mate | far
```

## When a line plays

- The radio (`src/audio/voice.js`): `VOICE_RULES` (which radio text plays which line), `VOICE_TAKES`, `VOICE_LIMIT` (per battle, gap, urgent). The danger calls cut in; the generals' lines come from the story's cues.
- The banter (`src/audio/banter.js`, tuning in `config.js` `VOICE_CHAT`): the driver's dialogue arrives through `RIDE_VOICE.play`; the rest comes from the story's cues (`storyCue → banterCue`), the player's grenade, and a look at the game every 0.25 s (reload, hits, a dry magazine, the quiet counters, the ride). One speaker at a time by priority (radio > driver ≥ soldier > squad > enemy), a gap per group, a budget of chatter lines a minute, takes cycled, music ducked, a subtitle for every line. Cài đặt → Âm thanh → **Thoại vui (bác tài, đồng đội)** turns the banter off; the danger calls stay.
