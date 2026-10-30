# Director's handoff — 30 October 2026 (evening)

**Authority:** Pon is Commander and final authority. Claude is Director. ChatGPT and Sarvam AI
take their next batches from `docs/agents/CHATGPT.md` and `docs/agents/SARVAM.md` (▶ Batch 3).

## What the Commander asked for

"A smooth playable game, without heat and without glitch", a review of what everyone shipped
since Chapter III, and new work handed out.

## The heat — found, measured, fixed

The phone was warm because the page never stopped drawing. Measured on a 390 × 844 phone
viewport at 4× CPU slow-down, over 4 seconds of the player doing nothing:

| Screen | Busy before | Busy after | Repaints before → after |
|---|---|---|---|
| Home | 36–40% | 0.1% | 480 → 0 |
| Battle, start | 20–26% | 0.7% | 3 → 5 (the turn banner) |
| Battle, mid-game (lamps lit, astras ready, gate cracked) | 42% | 0.1% | 529 → 0 |

The causes, all CSS: the boot splash kept spinning after it was hidden; a full-screen
background rotated and twinkled forever under frosted-glass panels; the home chakra spun as
SVG (a full repaint per frame); the board frame twinkled; every lit diya flickered; ready astra
buttons, the last-move ring, a cracked gate and a "tension" glow all pulsed forever with
`box-shadow` or SVG strokes. Now each glow is held still or plays two or three times and stops.

Also:
- **Battery saver** (Settings): no frosted glass, no painted astra films (0.7–1 MB each to
  decode). On by default for phones reporting ≤ 4 GB memory or ≤ 4 cores.
- **Background pause:** the music and the audio engine sleep when the phone locks or the app
  goes to the background, and wake on return.
- Board redraw costs ~23 ms at 4× slow-down; the AI decides in under 10 ms (Shakuni, desktop).

**Rule for everyone from now on:** nothing loops forever on a screen the player sits on.
`node tools/perf-idle.mjs` must show every screen under 3% busy.

## Glitches fixed

- **Astra and clash cinematics fell behind the board.** The art batch added
  `.stage { position: relative }`, which overrode the stage's `position: fixed`; the Agneyastra
  card rendered faint, behind the wheel. Fixed and checked on a phone viewport.
- **"No legal action left — the field is conceded"** read like a bug. It is the rule (only the
  fort and traps remain), and it ends about a third of AI games. It now says: *"… has no piece
  left that can move — only the fort and its traps stand. The field is conceded."*
- Sanjaya's portrait overflowed its circle in the new avatar picker (a tall image in a grid
  cell) — fixed with absolute positioning.

`tools/playtest-bot.mjs` plays real battles by tapping, on 390 × 844 and 360 × 640, with
cinematics on, and checks for runtime errors, stuck turns, missing pieces, a shrinking board
and sideways overflow. Run: 8 battles on wheel, lotus and square, then the lesson, the Daily and
Settings — **no problems**.

## Commander's TASKS-NEXT — done

1. **Settings consolidated.** The home screen no longer carries *Your record*, *Quick settings*
   or *Data*. Backups (export, import) and *Reset record* live at the bottom of Settings. (The
   battle screen on a phone already held only battle controls.)
2. **Profile hub** — tap your avatar, your name or the person icon:
   name change; record (wins, losses, win rate, streak, best run, pieces and forts taken, Daily
   streak); level of play against Sainik, Dronacharya and Shakuni (counted from now on);
   ten avatars — Arjuna, Karna, Bhima, Abhimanyu, Ghatotkacha, Sanjaya painted, Drona, Bhishma,
   Draupadi, Dhrishtadyumna as sigils until ChatGPT's portraits land; frame, tint and badge;
   your own photo, cropped to 256 px on the phone and stored only there ("Your photo stays on
   this device. It is never uploaded or shared."). *Switch player* moved here.
3. **The two flat Sanjaya lines — waiting for the Commander.** Proposed:

| id | now | proposed (Hinglish / हिन्दी / English) |
|---|---|---|
| `win_capture_2` | Hamari pankti aage badh rahi hai. | *Unka ek yoddha gira. Raasta khul raha hai, Maharaj.* / उनका एक योद्धा गिरा। रास्ता खुल रहा है, महाराज। / *One of theirs is down. The way is opening, Maharaj.* |
| `astra_vayavya_enemy_1` | Unki taraf hawa chali. Unke do mohre jagah badal chuke hain. | *Unhone Vayavyastra chalaya — do mohre jagah badal gaye. Jo pehchana tha, dobara parakhiye.* / उन्होंने वायव्यास्त्र चलाया — दो मोहरे जगह बदल गए। जो पहचाना था, दोबारा परखिए। / *They called the wind. Two of their pieces traded places — what you knew of them may be wrong now.* |

   Say "approve", "change" or "remove"; then Sarvam re-records (batch 3.4).
4. **Decisions still waiting:** landscape battle (ChatGPT writes the design note first, 3.3);
   first-run walkthrough (ChatGPT builds it as a PR, 3.2).

## Agent work reviewed

- **ChatGPT, PR #1 and #2 (merged):** Daily RNG and Sunday lotus fixes, the Drishti panel no
  longer shows strike odds, the screenshot harness, two balance banks (10,800 games), and the
  writing pack (store listing, campaign, heroes and vows, playtest script). Careful work,
  honest about what it did not test. **Promoted:** the 17 drafts that passed both banks, plus
  the four original variants that passed — **Daily catalogue II from 1 Nov 2026 (IST)**, 21
  variants; *The gate is open* retired (raiders won 57–72%). Dates before 1 Nov keep the first
  catalogue, so puzzles #1–#4, results and streaks are unchanged (tested).
- **Sarvam / voice:** 88 lines re-voiced with `rahul` at pace 1.15 — median 3.0 s, much better.
  Review batch 1 (14 lines) applied to the game: three fixes as given, one corrected (ने with
  रोके हुए हैं). Those four lines need re-recording (Sarvam 3.1).
- **Art:** skies, Sanjaya, Padma board, Daily card, astra stills and films, five heroes, gate
  breach, campaign map, temple hall, app icon — all wired. The originals that were loose in
  the repo root and `incoming/` are now under `masters/` (astras, sky, portraits, boards, cards,
  audio/sfx). Nothing was deleted.

## Checks run

| Check | Result |
|---|---|
| `node tests/rules.mjs` | 119 passed |
| `node tests/daily.mjs` | passed, incl. catalogue II versioning |
| `node tests/selfplay.mjs 40` | 0 failures |
| `node tests/ui.mjs` | 79 passed (7 new: calm home, hub, avatars, settings data, battery saver) |
| `node tools/perf-idle.mjs` | every screen ≤ 0.7% busy |
| `node tools/playtest-bot.mjs` | 8 battles on two phone sizes, no problems |

Not done here: a test on a **real** phone (the Commander's next check), native-speaker review of
the new Daily names (Sarvam 3.3 covers them in the strings file).
