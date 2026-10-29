# VYUHA — music and sound pack (Chapter III)

Every cue below already plays in the game as a **synthesised stand-in** (`js/audio.js`). Drop a
recorded file at the listed path and it takes over automatically — no code change. Put files in
`incoming/audio/` (or attach them in chat); the Director trims, normalises, converts and wires.

Already in the game from Chapter II: `menu`, `tabla` (setup and deployment), `battle`,
`victory`, `defeat` music, and `clash`, `volley`, `chakra_turn`, `piece_place` one-shots.

## Sound rules

- **Quiet by default.** People play on buses and in waiting rooms. Music around −17 LUFS,
  one-shots around −14 LUFS, true peak below −1 dBTP. Nothing harsh above 6 kHz.
- **Short.** One-shots under 1.5 s unless noted; cut silence at both ends.
- **Format.** Send WAV or high-quality MP3; the Director makes 44.1 kHz MP3s (mono for one-shots,
  stereo for music).
- **Indian, not generic.** Tabla, pakhawaj, dhol, mridangam, shankh, temple bells, ghungroo,
  sitar, sarangi, bansuri, shehnai, tanpura drone. No EDM risers, no orchestral trailer clichés.
- **Original.** Never ask a tool to imitate a named film score, composer or song.

---

## 1. One-shots (priority 1)

Use a sound-effect generator (ElevenLabs Sound Effects, Stable Audio, or similar), a sample
library with a clear licence (CC0 on Freesound is ideal — keep the link), or record them.

| File | Length | Where it plays | Prompt |
|---|---|---|---|
| `shankh.mp3` | 1.8–2.5 s | Battle starts, a fort falls, victory | A single long blow on a conch shell (shankh), breathy start, a strong steady tone that swells and fades, temple courtyard reverb, solo, no music. |
| `gate_breach.mp3` | 1.0–1.4 s | A fort's gate breaks | A heavy wooden fortress gate splintering under a ram: wood crack, a deep thud, iron bolts rattling, short stone reverb. |
| `dawn.mp3` | 2–3 s | The sky turns to day | A small brass temple bell struck once with a long shimmer, a soft rising tanpura note underneath, a few distant birds at dawn. |
| `dusk.mp3` | 2–3 s | The sky turns to night | A deep bell struck once, a low tanpura drone falling softly, crickets fading in. Calm, mysterious. |
| `astra_vayavya.mp3` | 1.4–1.8 s | Vayavyastra (wind) | A sudden magical gust of wind whooshing past and swirling away, airy chimes inside it. |
| `astra_sammohana.mp3` | 1.4–1.8 s | Sammohanastra (trance) | A hypnotic shimmering tone that bends downward, soft glass harmonics, a faint ghungroo shake, dreamy and uncanny. |
| `astra_agneya.mp3` | 1.4–1.8 s | Agneyastra (fire) | A roaring burst of flame igniting, crackling fire, a deep whoomp, embers hissing. |
| `astra_brahma.mp3` | 2–2.6 s | Brahmastra (light) | A colossal divine detonation: a deep sub-bass boom, a bright choir-like chord of light swelling, a shockwave rushing outward, then ringing silence. Awe, not horror. |
| `shakti_diya.mp3` | 0.4–0.7 s | A lamp of Shakti lights | A tiny bright bell tinkle with the soft flick of a lamp flame catching. |
| `trap.mp3` | 0.8–1.2 s | A piece strikes the Shataghni | An iron spiked trap snapping shut: metal clang, a heavy spring, a short crunch. |
| `divya_drishti.mp3` | 0.8–1.2 s | Divyadrishti reveals a piece | A soft rising shimmer like an eye of light opening, gentle bell harmonics, magical but quiet. |

## 2. Music (priority 2)

Make these with an AI music tool (Suno, Udio, or similar) or a musician. Instrumental only, no
vocals unless noted. Loopable where marked: ask for "seamless loop, no fade-in, no fade-out" and
the Director will cut the loop point.

| File | Length | Prompt |
|---|---|---|
| `battle_night.mp3` *(loop)* | 1:30–2:30 | Instrumental Indian war music at night, 92 bpm: low pakhawaj and tabla groove, a dark sarangi melody, tanpura drone, sparse temple bells, tense and patient, building slowly, no vocals, no drop. |
| `daily_theme.mp3` *(loop)* | 1:00–2:00 | Instrumental puzzle music with an Indian heart, 100 bpm: plucked sitar arpeggios, light tabla, soft bansuri melody, curious and hopeful, a morning feeling, no vocals. |
| `lesson.mp3` *(loop)* | 1:00–1:30 | Gentle instrumental for a teacher's lesson, 84 bpm: tanpura drone, slow santoor, soft hand percussion, warm and encouraging, no vocals. |
| `abhimanyu.mp3` *(loop)* | 2:00–3:00 | Instrumental tragic-heroic theme, 96 bpm: a lone shehnai over pounding dhol and pakhawaj, the rhythm tightening like a closing ring, courage against the odds, no vocals. |
| `victory_big.mp3` | 0:06–0:10 | A short triumphant Indian fanfare: shankh, dhol roll, a bright shehnai phrase resolving upward, ends cleanly. |

The Director wires each track when it arrives (night battle music switches with the hour; the
daily, the lesson and Abhimanyu get their own themes).

## 3. Interface (priority 3)

| File | Length | Prompt |
|---|---|---|
| `ui_tap.mp3` | 0.08 s | A tiny soft wooden tap, like a game piece touching a carved board. |
| `ui_select.mp3` | 0.15 s | A small brass ting, bright and short. |
| `ui_back.mp3` | 0.12 s | A soft low wooden knock. |
| `turn_yours.mp3` | 0.5 s | A short two-note tabla phrase, "your turn", friendly. |

## 4. Trailer music (Phase E)

`trailer.mp3` — 0:30, a single build: tanpura and a heartbeat pakhawaj (0–8 s), sitar motif
enters (8–16 s), dhol and shankh hit at 16 s as the chakra turns, full ensemble to a sharp stop
at 28 s, one bell to the end. Instrumental, no vocals.

## Hand-off checklist

```
incoming/audio/sfx/shankh.mp3              P1
incoming/audio/sfx/gate_breach.mp3         P1
incoming/audio/sfx/dawn.mp3                P1
incoming/audio/sfx/dusk.mp3                P1
incoming/audio/sfx/astra_vayavya.mp3       P1
incoming/audio/sfx/astra_sammohana.mp3     P1
incoming/audio/sfx/astra_agneya.mp3        P1
incoming/audio/sfx/astra_brahma.mp3        P1
incoming/audio/sfx/shakti_diya.mp3         P1
incoming/audio/sfx/trap.mp3                P1
incoming/audio/sfx/divya_drishti.mp3       P1
incoming/audio/music/battle_night.mp3      P2
incoming/audio/music/daily_theme.mp3       P2
incoming/audio/music/lesson.mp3            P2
incoming/audio/music/abhimanyu.mp3         P2
incoming/audio/music/victory_big.mp3       P2
incoming/audio/ui/*.mp3                    P3
incoming/audio/trailer.mp3                 Phase E
```

Keep a note of where each file came from (tool, prompt, or sample link and licence) in
`incoming/audio/SOURCES.md` — the store listing and any legal review will ask.

---

# STATUS — what is done, what is still needed

> Updated 29 Oct 2026 by Sarvam AI (agent). **This section is the checklist — if it is not
> ticked here, it is not in the game.**

## Delivered ✅

| Asset | Where it lives | Notes |
|---|---|---|
| 10 unit pieces | `assets/art/opt/units/*.webp` | keyed, 320 px, 24–50 KB each |
| 2 faction crests | `assets/art/opt/factions/*.webp` | used as piece-backs on hidden enemy pieces |
| 2 faction banners | `assets/art/banners/*.jpg` | 600×140 nameplates on the player strips |
| 3 board surfaces | `assets/art/opt/boards/{wheel,small,large}.jpg` | applied per cell as a stone pattern |
| **Padmavyuha board** | `assets/art/opt/boards/padma.jpg` | new — hex field surface |
| **Day / night skies** | `assets/art/opt/ui/day.jpg`, `night.jpg` | new — sky for Surya/Chandra hours |
| **Sanjaya portrait** | `assets/art/opt/ui/sanjaya.jpg` | new — 420 px, for the narration bar |
| **Daily card** | `assets/art/opt/ui/daily.jpg` | new — share card backdrop |
| Combat / victory / defeat / hero | `assets/art/opt/ui/*.jpg` | dialog backdrops, access screen |
| App icon | `assets/art/opt/app/icon-512.png` | manifest + apple-touch |
| Masters | `masters/` | compressed to 1024–1280 px, 133 MB → 28 MB |

## Pending ⏳

| # | What | Who | Prompt / note |
|---|---|---|---|
| 1 | **Astra emblems ×4** (Agneya, Brahma, Sammohana, Vayavya) | Commander | 512², black bg, brass-and-obsidian, one glyph each: flame-arrow, arrow-of-arrows, spiral-of-confusion, wind-wheel. Needed for the astra shelf and the full-screen moment. |
| 2 | **Astra full-screen art ×4** (still or loop) | Commander | 1080×1920 portrait, the weapon filling the frame, no text — this is the moment that covers the board. |
| 3 | **Sanjaya loop** (the gif supplied is 3.3 MB, 30 frames) | Commander | A shorter loop (1–1.5 s, ≤1.5 MB) would let it sit on the narration bar and the opening. Current file is kept in `masters/` for the full-screen use. |
| 4 | **Gate breach still** | Commander | 1080×1920, the fort gate cracking — the other big moment. |
| 5 | Hero portraits ×5 (Arjuna, Karna, Bhima, Ghatotkacha, Abhimanyu) | ChatGPT | Phase C; warriors, never deities, 512² black bg. |
| 6 | Campaign map of the seven vyuhas | Commander | 3:2 parchment, seven brass medallions. |
| 7 | Store art (icon, feature graphic, 6 screenshots, 30 s trailer) | Commander | Phase E. |

## Sound and voice — delivered ✅

- 88 voice lines (44 Hindi, 44 English) in `assets/audio/voice/` — Bulbul v3, speaker `ashutosh`.
- Music: menu, tabla, battle, victory, defeat — `assets/audio/music/`.
- Effects: clash, volley, chakra turn, piece place, shankh, gate breach, dawn, dusk,
  four astra stingers, divya-drishti, shakti diya — `assets/audio/sfx/`.

## Sound and voice — pending ⏳

- Marathi voice set (after the Hindi review).
- Tension loop for the last five rounds of a scenario.
