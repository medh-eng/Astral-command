# Sanjaya's voice — batch 1 (generated)

- **Tool:** Sarvam AI Bulbul, model `bulbul:v3` (v2 is deprecated)
- **Speaker:** `ashutosh` — one calm male voice used for both Hindi and English, so Sanjaya is
  the same person in either language
- **Language codes:** `hi-IN` (Hindi set) · `en-IN` (English set)
- **Pace:** 0.9 · **Sample rate:** 44100 · mono · MP3 64 kbps
- **Generated:** 29 Oct 2026 · 44 Hindi + 44 English lines, 0 failures, 2.6 MB total

Files live where the game looks for them:

```
assets/audio/voice/hi/<id>.mp3    used with Hinglish or Hindi text
assets/audio/voice/en/<id>.mp3    used with English text
```

## Changing the voice

Other male speakers on `bulbul:v3`: `aditya`, `rahul`, `rohan`, `amit`, `dev`.
Re-generate the whole set with one command (the speaker is a single argument):

```
SARVAM_API_KEY=... python3 tools/voice-gen.py --speaker rahul --lang both
```

Never mix speakers between batches — one voice for the whole game.

## Still to do

- Task 1 in `docs/agents/SARVAM.md`: have the Hindi lines reviewed by a native speaker before
  this is treated as final; any corrected line is a one-file re-record
  (`tools/voice-gen.py --ids <id>`).
- Task 3: Marathi set, after the Hindi review.
