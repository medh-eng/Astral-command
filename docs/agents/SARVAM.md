# Sarvam AI — agent brief

Sarvam AI works for the VYUHA team on **Indian languages and voice**: Hindi and Marathi text,
natural Hinglish, Sanjaya's spoken voice, and a cultural read of everything players see.
Sarvam's chat assistant handles the writing tasks; its text-to-speech tool (Bulbul) handles the
voice. The Commander (Pon) runs the tasks and drops results in `incoming/`; the Director
(Claude) wires them in.

## ▶ Batch 3 — from the Director, 30 Oct 2026 (do these first)

Your voice landed: 88 lines, re-voiced with speaker **rahul** at pace **1.15** — much livelier.
Batch 1 of the Hindi review (14 lines) is now in the game, with one correction: *"गुरु द्रोण ने
दुश्मन को रोके हुए हैं"* mixes ने with रोके हुए हैं; it now reads **"गुरु द्रोण दुश्मन को रोके हुए
हैं"**. Please double-check verb agreement like this in the next batch.

| # | Task | Deliver |
|---|---|---|
| 3.1 | **Re-record four lines** whose Hindi changed: `start_abhimanyu_1`, `start_tutorial_1`, `lose_capture_1`, `trap_defused_1` (text in `docs/voice/sanjaya-lines.csv`). Same speaker and pace: `tools/voice-gen.py --ids start_abhimanyu_1,start_tutorial_1,lose_capture_1,trap_defused_1 --lang hi --speaker rahul --pace 1.15`. | `assets/audio/voice/hi/<id>.mp3` |
| 3.2 | **Hindi review, batch 2** — the remaining 30 lines (everything not in `incoming/text/sanjaya-review.csv`). Same columns. | `incoming/text/sanjaya-review-2.csv` |
| 3.3 | **Interface strings** — Task 2 below; the file now has **149** strings (the new Daily variants added). | `incoming/i18n/strings.hi.json`, `strings.mr.json` |
| 3.4 | **Two lines the Commander found flat** — after he approves the rewrite (see `docs/HANDOFF-2026-10-30-director.md`), record them in Hindi and English. | voice files |

---

## Context block (paste first in the chat)

> You are the language and culture reviewer for **VYUHA (व्यूह)**, a free mobile strategy game
> rooted in the Mahabharata's war formations, made in Nagpur for Indian players. A narrator,
> Sanjaya, speaks to the player as "Maharaj". The game never shows a deity as a playing piece.
> Your job is to make every Hindi and Marathi line sound natural to a modern Indian player —
> clear, warm, a little epic, never stiff Sanskritised officialese and never slangy. Keep the
> game's Sanskrit terms (Senapati, Maharathi, Divyadrishti, Shataghni, Durg, Chakravyuha,
> Padmavyuha, Makara, Padma, Agneyastra, Sammohanastra, Vayavyastra, Brahmastra, Shakti) and
> spell them consistently in Devanagari.

---

## Task 1 — Review Sanjaya's Hindi (do this before recording)

Open `docs/voice/sanjaya-lines.csv`. Paste:

> Here are 44 short lines a narrator says in a game. For each row, check the Hindi
> (`hindi_voice_text`) for naturalness, grammar, matras and nukta, and that it means the same as
> the English. Keep each line under 14 words and easy to say aloud in 2–4 seconds. Return a CSV
> with columns `id`, `hindi_voice_text` (corrected or unchanged), `note` (what you changed and
> why, or "ok"). Then do the same for `hinglish_screen_text`, returning `id`,
> `hinglish_screen_text`, `note` — natural Hinglish as a young Indian would text it, Latin script.
> [paste the CSV]

Save as `incoming/text/sanjaya-review.csv`. The Director updates `js/sanjaya.js` and regenerates
the script, so the voice is recorded from the corrected words.

## Task 2 — Translate the interface (Hindi and Marathi)

Open `docs/i18n/strings.en.json` (115 strings: pieces, astras, hours, formations, the lesson,
the daily modifiers, buttons). Paste:

> Translate this game interface JSON into Hindi. Keep every key exactly as it is; translate only
> the values. Keep game terms in Devanagari as listed in the context. Keep numbers, "+1" and
> "×2" as they are. Short and clear: these appear on phone buttons and cards. Return only the
> JSON.
> [paste the file]

Save as `incoming/i18n/strings.hi.json`. Then the same prompt with **Marathi** → save as
`incoming/i18n/strings.mr.json`.

The Director then adds a language switch (English / हिन्दी / मराठी) to the game — that wiring is
on the roadmap and starts as soon as the first translation lands.

## Task 3 — Sanjaya in Marathi

> Translate these 44 narrator lines into natural spoken Marathi for a Maharashtrian player. Keep
> "महाराज" as the form of address. Same rules as before: under 14 words, 2–4 seconds aloud.
> Return CSV `id`, `marathi_voice_text`.
> [paste the corrected Hindi CSV from Task 1]

Save as `incoming/text/sanjaya-marathi.csv`.

## Task 4 — Record Sanjaya's voice (Bulbul text-to-speech)

Follow [`docs/prompts/VOICE.md`](../prompts/VOICE.md): pick one calm, mature male voice, pace
about 0.9, Hindi (hi-IN), MP3; generate each line from the corrected Hindi text; save as
`incoming/voice/hi/<id>.mp3`. Start with the eight most-heard lines listed there. Write the
chosen speaker name in `incoming/voice/VOICE.md` so later batches match.

Then the English set (en-IN) into `incoming/voice/en/<id>.mp3`, and — once Task 3 is done —
Marathi (mr-IN) into `incoming/voice/mr/<id>.mp3`.

## Task 5 — Cultural read of the whole game

Paste the context block, then the contents of `docs/DIRECTOR.md` sections 1, 3 and 6, then:

> Read this game design as a thoughtful Indian player from any community. List anything that
> could feel disrespectful, inaccurate to the epic, or awkward in Hindi or Marathi — the
> exact phrase, why it might land badly, and a better alternative. Also list three things that
> would make it feel *more* authentically Indian without touching anything sacred.

Save as `incoming/text/cultural-review.md`. The Director brings every point to the Commander
before changing anything.

---

## Quality bar the Director will check

- Keys and ids untouched; files parse (JSON / CSV, UTF-8).
- Devanagari spelled consistently with the terms above.
- Voice: one speaker throughout, no clipped endings, each line under 4 seconds.
