# VYUHA — Sanjaya's voice

In the epic, Sanjaya was granted divine sight so he could tell the blind king Dhritarashtra
everything that happened at Kurukshetra. In VYUHA he tells the player — *"Maharaj…"* — what just
happened on the field. He already speaks as text in the game; this pack is how he gets a voice.

## The script

**`docs/voice/sanjaya-lines.csv`** — 44 lines, generated from the game itself
(`node tools/voice-script.mjs`), so it is always complete. Columns:

| Column | What it is |
|---|---|
| `id` | The line's name. The file must be saved with exactly this name. |
| `event` | When he says it (a capture, dawn, an astra…). |
| `hindi_voice_text` | **Speak this** for the Hindi voice (Devanagari — text-to-speech sounds far better from native script than from Hinglish in Latin letters). |
| `english_voice_text` | **Speak this** for the English voice. |
| `hinglish_screen_text` | Shown on screen only; not recorded. |
| `save_hindi_as` / `save_english_as` | Where the file goes. |

One Hindi recording serves both the Hinglish and the Hindi text settings.

## Voice direction

- **Who:** a calm, warm man in his 40s–50s. A storyteller at a fireside, not a stadium announcer.
- **Pace:** unhurried (about 0.9× normal). Lines are 2–4 seconds; never rush to fit.
- **Colour:** a little awe for astras and the fort, quiet sorrow for losses, a smile for "Vijay".
  Never shout. Never comic.
- **"Maharaj"** is respectful and affectionate — the way an old courtier speaks to his king.
- **Pronunciation:** Senapati, Maharathi, Divyadrishti, Shataghni, Chakravyuha, Padma, Makara,
  Agneyastra (आग्नेयास्त्र), Sammohanastra, Vayavyastra, Brahmastra — as in Hindi, no English
  stress.

## Making it with Sarvam AI (Bulbul)

1. Open Sarvam's text-to-speech in your account (the playground/dashboard).
2. Model: the newest Bulbul available (v4 Flash at the time of writing; v3 also works).
   Language: **Hindi (hi-IN)** for the Hindi set, **English (en-IN)** for the English set.
3. **Pick the voice once, then never change it.** Audition 4–5 mature male voices on the same
   test line — `महाराज, चक्र घूम गया! अंदर के घेरों पर सब कुछ दिख गया।` — and pick the warmest,
   calmest one. Write its exact speaker name at the top of `incoming/voice/VOICE.md` so the next
   batch matches.
4. Pace about **0.9**. Sample rate **44100** or **48000**. Output **MP3** (or WAV).
5. Paste one line at a time from `hindi_voice_text`, generate, listen, download.
6. Save as `incoming/voice/hi/<id>.mp3` (for example `incoming/voice/hi/rotate_1.mp3`). The English
   set goes in `incoming/voice/en/<id>.mp3`.

Do the 8 most-heard lines first so the game feels voiced early:
`start_duel_1`, `win_capture_1`, `lose_capture_1`, `rotate_1`, `dawn_1`, `dusk_enemy_1`,
`breach_enemy_1`, `victory_1`.

## Checking a take

- The id and the words match (it is easy to save `dawn_1` with the `dusk_1` text).
- No clicks, no cut-off last syllable, under 4 seconds.
- Sanskrit names said the Hindi way.
- Same voice, same loudness as the rest of the set.

The Director normalises loudness, trims silence, converts, places the files in
`assets/audio/voice/hi/` and `assets/audio/voice/en/`, and the game starts speaking on its own
(the music ducks while he talks).

## Later: Marathi

Once the Hindi set is in, Sarvam can translate the 44 lines to Marathi (see
`docs/agents/SARVAM.md`, task 3); the Director adds a Marathi option to the narrator setting.
