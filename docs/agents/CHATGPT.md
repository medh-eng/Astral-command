# ChatGPT — agent brief

ChatGPT works for the VYUHA team on **images, writing and ideas**. The Commander (Pon) pastes a
task below into ChatGPT, saves what comes back with the exact file name, and puts it in the
repo's `incoming/` folder (or hands it to the Director in chat). The Director (Claude) checks
it, wires it into the game, and says plainly if something needs another pass.

**Before any task**, paste the context block once per conversation.

## ▶ Batch 3 — from the Director, 30 Oct 2026 (do these first)

Batch 1 and 2 are merged and good: Daily fixes, Drishti panel, balance screening, the writing
pack. Of your 25 Daily drafts, the 17 that held the 30–55% band in both seed banks are now
**live from 1 Nov** (`MODIFIERS_II` in `js/modes.js`); "The gate is open" is retired.

### 3.0 — FIRST: Calm pace (the Commander's request, 30 Oct 20:17)

**The problem, in the Commander's words:** the game is too fast. The player strikes, and before
they have seen what happened the AI has already moved and it is their turn again. Sanjaya's line
for the player's strike is cut off by his line for the AI's move. Sound effects and voice
overlap. *"Let the player play one move and enjoy what he has done."*

**Director's decision:** no End-turn button (it doubles every tap). Instead a **calm rhythm**
the player can always cut short by tapping. Add a setting **Battle pace: Calm (default) /
Quick**; Quick keeps today's behaviour exactly.

One turn in Calm, in this order — nothing starts until the previous step is done:

1. **The move is seen.** The piece *slides* to its cell (350–450 ms, ease-out) instead of
   jumping. For the AI's move, first glow the piece it will move for ~500 ms, then slide it.
2. **The sound lands.** The effect (clash, volley, breach, astra) plays as the stage card opens.
3. **The moment holds.** The stage card stays ~2.2 s (clash), ~2.6 s (fort, Brahmastra). The
   Makara jaw / Padma links draw over ~900 ms *during* the card and stay until it closes.
4. **Then Sanjaya speaks** — only after the effect has finished (start the voice when the
   effect's audio ends, or 600 ms after it starts if its length is unknown). **One line per
   side's turn**: if a turn produced several events, say the most important one (fort > breach >
   astra > capture > trap > sky). Lines **queue, never interrupt**; drop a waiting line if a
   newer one of higher importance arrives.
5. **A breath.** When the voice ends (its `ended` event, max 3.5 s), wait ~400 ms, then show
   "Shakuni is thinking" for 900–1400 ms, then the AI's turn runs steps 1–4.
6. **Your turn** banner, then input is live.

**Tap anywhere on the stage or board to skip ahead** one step (stops the voice, closes the
card) — a player in a hurry must never be held. Reduced motion: no slide, gaps kept. The calm
pauses must be timers or `ended` events — **no animation loops while waiting** (keep the phone
cool rule below).

**Where the code is:**
- `js/game.js` — `performAction()` (~line 1306: events → `sfx`, `FX`, `speak(narrate(...))`,
  `playBeats(beats, me, finish)`; `finish` calls `scheduleAi()`), `playBeats()` (~1393),
  `scheduleAi()` (~1408, `think` delay from `U.DIFFICULTIES`), `speak()` (~105), `narrate()` (~1241).
  Today the voice is fired at the same moment as the effect and the cinematic.
- `js/stage.js` — `show()`: line 42 caps every beat at 1500 ms (`ms = Math.min(ms, 1500)`);
  in Calm raise the cap to the times above.
- `js/sanjaya.js` — `say()` and `playVoice()` (~172–205): `playVoice` pauses whatever was
  playing (that is the cut-off). Turn this into a small queue that returns a Promise resolving
  on `ended`/error/timeout.
- `js/audio.js` — `play()`; expose a cue's duration if known (`sfxEls[name].duration`).
- `js/storage.js` default `pace: 'calm'`; `js/ui.js` `openSettings()` — a segment like the
  narrator-language one.

**Done when:**
- With Calm: a plain move → AI move begins ~1.5–2 s later; a clash → ~4–5 s later. Sanjaya's
  two lines never overlap, and his voice never starts while an effect is still sounding.
- With Quick: timings as on `main` today.
- New `tests/ui.mjs` checks: pace setting exists and defaults to Calm; in Calm the AI does not
  move before the player's beat and line have finished (use fake timers or a short test scale).
- `tests/*.mjs`, `tools/perf-idle.mjs` (< 3% busy), `tools/playtest-bot.mjs` ("no problems";
  give it Quick pace or longer waits) all pass. Rebuild the standalone, bump `sw.js` cache.
- Branch + PR with a 20-second screen recording or GIF of one Calm turn on a phone viewport.
  The Commander tests it on his phone before merge.

| # | Task | Deliver |
|---|---|---|
| 3.1 | **Four avatar portraits** — Drona, Bhishma, Draupadi, Dhrishtadyumna. Prompts in [`ART.md`](../prompts/ART.md) → *Four more portraits*. Same set look as the five heroes. | `incoming/art/heroes/*.png` |
| 3.2 | **First-run walkthrough (code, PR).** Three cards on the first battle only, each pointing at real buttons: the eye (intel), the book (log/rules), the diya lamps and astra shelf. Skippable, never shown again once closed (a setting key `walkthroughDone`). Uses the existing `modal`/coach styles. Add a `tests/ui.mjs` check. | branch + PR |
| 3.3 | **Landscape battle (design note first, no code).** One page: how the board, the strips and the action bar sit in landscape on a 6.5" phone, what the "turn your phone" hint says, and the portrait fallback. A sketch image is welcome. | `incoming/text/landscape.md` |
| 3.4 | **Daily retune.** `harvest`, `quiet-gate`, `brass-reserve` run raider-heavy; `double-scout`, `silver-watch`, `shishir`, `vasant`, `archers-watch` sit near 30%. Propose one knob change each, screen with a **third** fresh seed bank (`--output=incoming/text/daily-balance-bank3.json`). Nothing is promoted without two passing banks. | JSON report + short note |

**New hard rule for any code — keep the phone cool.** The game was heating phones because the
screen repainted 60 times a second while the player thought. That is fixed (idle CPU ~40% → ~0%).
So: no `animation: … infinite` on anything that stays on screen; no animated `box-shadow`,
`filter` or SVG stroke loops; a pulse may play 2–3 times and stop. Before a PR, run
`node tools/perf-idle.mjs` (every screen must stay under 3% busy) and
`node tools/playtest-bot.mjs` (must end with "no problems"), as well as the four test suites.

---

## Context block (paste first)

> You are helping build **VYUHA (व्यूह)**, a free mobile strategy game rooted in the Indian
> epics. Two armies of twelve hidden-rank pieces fight on battlefields shaped like war
> formations (the Chakravyuha wheel, the Padmavyuha lotus). The sky turns between the hour of
> Surya (day) and Chandra (night) every five rounds; formations (Makara pincer, Padma guard)
> give +1; and players spend Shakti on four astras — Vayavyastra (wind), Sammohanastra (trance),
> Agneyastra (fire), Brahmastra (light). Sanjaya narrates. The look is "temple-punk": carved
> brass and obsidian, saffron day, indigo night.
>
> Hard rules for everything you make: **no deity is ever shown as a piece, target or character**;
> astras are shown as their element only; warriors of the epic are human heroes drawn with
> dignity; no imitation of any living artist, comic, film or song; no text inside images unless
> asked. Indian audience first, written so a 16-year-old in Nagpur and a 60-year-old in Chennai
> both enjoy it.

---

## Task 1 — Art pack III (start here)

Open [`docs/prompts/ART.md`](../prompts/ART.md). Paste its **master style block**, then the
prompts one at a time, in the priority order listed there (astras → Sanjaya → Padmavyuha board →
daily card → skies → store art). Save each image with the exact file name from the table.

**Done when:** every Priority 1 file is in `incoming/art/` with the right name and size.

## Task 2 — 25 new Daily Chakravyuha modifiers

Paste:

> Write 25 new "modifiers of the day" for the Daily Chakravyuha. Each changes the day's puzzle
> using **only** these knobs: `startNight` (true/false), `startShakti` (raiders 0–5,
> defenders 0–5), `rotateEvery` (3–6 rounds), `turnLimit` (18–30 rounds), `gateOpen` (the
> defenders' fort gate starts broken: true/false), `defenders` (a list of 10 pieces chosen from
> 10, 9, 7, 6, 5, 3, 2, 1, B, F — must include exactly one F and at least one B),
> `raiders` (a list of 8 pieces from 9, 7, 6, 5, 3, 2, 1 — no F, no B).
> Give each a short evocative name drawn from the epics or Indian seasons and festivals (no
> deities as characters), a Devanagari word, and one plain sentence a player understands.
> Return **only** JSON: an array of objects with keys `key`, `deva`, `name`, `one`, `knobs`.

Save as `incoming/text/daily-modifiers.json`. The Director simulates each one and keeps those
the raiders win 30–55% of the time.

## Task 3 — Store listing and launch words

Paste:

> Write the Google Play listing for VYUHA: (a) a title of at most 30 characters, (b) a short
> description of at most 80 characters, (c) a full description of 600–900 words with short
> paragraphs and a bulleted feature list, (d) 20 search keywords. Then write the same short and
> full description in natural Hinglish. Then write five Instagram Reels / YouTube Shorts
> captions (under 120 characters each) built around the hook "Abhimanyu got in. Can you get
> out?" and the Daily Chakravyuha. No exaggerated claims, no "best game ever".

Save as `incoming/text/store-listing.md`.

## Task 4 — The seven vyuhas (campaign lore, Phase C)

Paste:

> Write the campaign chapters for VYUHA: seven battle formations from the epic — Chakravyuha
> (wheel), Padmavyuha (lotus), Kraunchavyuha (crane), Makaravyuha (crocodile), Suchivyuha
> (needle), Shyenavyuha (hawk), Sarvatobhadra (auspicious on all sides). For each give: the
> name in Devanagari, a 90–120 word chapter intro told by Sanjaya to "Maharaj" (calm,
> storyteller, not purple), the one lesson the chapter teaches in a single sentence, and a
> 12-word line for the chapter's victory screen. Stay faithful to the epic where a formation is
> described there and say "a later tradition" where it is not. No deity fights or is captured.
> Return Markdown with one `##` heading per vyuha.

Save as `incoming/text/campaign.md`.

## Task 5 — Hero cards and vows (Phase C)

Paste:

> Design hero cards for VYUHA. A player's Senapati or Maharathi may take one hero's trait for a
> battle. Heroes are human warriors of the Mahabharata only: Arjuna, Karna, Bhima, Abhimanyu,
> Ghatotkacha, Drona, Bhishma, Draupadi's brother Dhrishtadyumna. For each: one rule in under 20
> words that fits a hidden-rank game (e.g. "Arjuna: his volley reaches three cells"), a
> one-line flavour quote written fresh (not a scripture quote), and a balance note. Then write
> 12 "Pratigya" secret vows a player can take before battle (e.g. "Bhishma's vow: win without
> your Senapati ever striking"), each with a reward suggestion.
> Return JSON with keys `heroes` (array of {name, deva, rule, quote, balance}) and `vows`
> (array of {name, deva, condition, reward}).

Save as `incoming/text/heroes-vows.json`.

## Task 6 — A playtest you can run with someone (any time)

Paste:

> I am going to watch a friend play a mobile strategy game for the first time. Give me a
> one-page playtest script: what to say before they start (and what not to say), 8 things to
> watch for silently, 6 questions to ask after (non-leading), and a simple table to write
> notes in. Keep it friendly; the friend is not a gamer.

Use it, then paste your notes into `docs/ROADMAP.md` under *Playtest notes* (or send them to
the Director).

---

## Quality bar the Director will check

- File names and sizes exactly as asked; JSON that parses.
- Images: no letters or numbers; reads at phone size; the same style across a set.
- Writing: short sentences, no invented scripture quotes presented as real, the respect rules
  above, Devanagari spelled correctly (Sarvam AI double-checks).
