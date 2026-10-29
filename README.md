# VYUHA · व्यूह

> **Abhimanyu got in. Can you get out?**

A hidden-rank strategy game of the Indian epics. Two armies of twelve fight on battlefields
shaped like war formations — the turning **Chakravyuha** wheel, the **Padmavyuha** lotus. The sky
swaps between the hour of **Surya** and the hour of **Chandra**; formations close like jaws; every
piece you take lights a lamp of **Shakti** for four divine weapons; and **Sanjaya** tells you what
happened, the way he told the blind king.

Free, offline, no account, no tracking. One static web app — open it and play.

**Play:** <https://medh-eng.github.io/vyuha/> ·
**Today's Daily Chakravyuha:** <https://medh-eng.github.io/vyuha/#daily> ·
**The two-minute lesson:** <https://medh-eng.github.io/vyuha/#learn>

---

## What's in Chapter III — *Shakti*

| | |
|---|---|
| **Yuddh karo** | One tap from the home screen into a battle. No login wall. |
| **Pehla Yuddh** | A two-minute guided first battle: move, look, volley, strike, clear a trap, take a fort. |
| **Daily Chakravyuha** | One seeded wheel for all of India each day, a modifier, a streak, and a WhatsApp share card with a round-by-round grid. |
| **The fort gate** | The first blow breaks the gate; the second takes the fort. |
| **Surya & Chandra** | Every fifth round the sky turns; the side in its hour strikes at +1. |
| **Makara & Padma** | A pincer adds +1 to a strike; a guarded piece defends at +1. |
| **Shakti & astras** | Five lamps; Vayavyastra, Sammohanastra, Agneyastra, Brahmastra — each once per battle. |
| **The stage** | Clash cinematics with Devanagari verdicts, odds on the board, tap-twice strikes. |
| **Sanjaya** | Narration in Hinglish, हिन्दी or English; recorded voice plays when present. |
| **Opponents** | Sainik, Dronacharya and Shakuni — and they never peek at your hidden ranks or fort. |
| **Fields** | Chakravyuha, Padmavyuha, Sarvatobhadra (6 × 8), Kurukshetra (8 × 10). |
| **Titles** | Shishya → Sainik → Rathi → Atirathi → Maharathi → Atimaharathi. |

Also kept from earlier chapters: pass-and-play with a privacy curtain, three save slots and an
autosave, the intel panel and advisor, a turn clock, colour-blind and high-contrast modes,
reduced motion, keyboard play, and an installable offline app.

The full rules, the art and sound direction, the team and the decisions behind all of it:
**[`docs/DIRECTOR.md`](docs/DIRECTOR.md)**. What's done and what's next:
**[`docs/ROADMAP.md`](docs/ROADMAP.md)**.

## How to play in one screen

1. **Deploy** — twelve pieces in your own ground. Tap two cells to swap them, or pick a formation.
2. **Move or strike** — tap a piece, then a glowing cell. Strike targets show your odds; tap once
   to see them, twice to strike.
3. **Read the field** — pieces that never move are the fort or a trap. The Divyadrishti looks,
   the Dhanurdhar shoots two cells away.
4. **Mind the hour** — the sky chip shows whose hour it is and when it turns.
5. **Spend Shakti** — with nothing selected, the astra buttons are ready when their lamps are lit.
6. **Break the gate, take the fort.**

## Run it

```bash
python3 -m http.server 8080          # any static server → http://localhost:8080
```

Or open `vyuha-standalone.html` directly — a single file with the whole game inside
(`node tools/build-standalone.mjs` rebuilds it).

## Project layout

```
index.html                  app shell (screens, HUD, board, coach)
css/app.css                 design system; Chapter III section at the end
js/units.js                 the balance file: pieces, astras, hours, fields, opponents, scenarios
js/geometry.js              fields as cell graphs: square arenas, the wheel, the lotus
js/engine.js                pure rules engine (no DOM): gates, hours, formations, Shakti, astras
js/ai.js                    the opponents: belief model, honest fort guess, astra use
js/sanjaya.js               the narrator: every line in English, Hinglish and Hindi
js/stage.js                 cinematic beats: clash, volley, sight, gate, astra, the sky
js/game.js                  battle screen: board, input, odds, astras, AI loop, results
js/modes.js                 Pehla Yuddh, Daily Chakravyuha, sharing
js/ui.js                    home, setup, codex, settings, saves, profiles
js/audio.js · js/fx.js · js/art.js · js/storage.js · js/main.js
assets/art/                 masters (as made) and opt/ (what the game loads)
assets/audio/               music and one-shots
assets/3d/                  starter 3D pieces: GLB for renders, STL for printing
docs/                       DIRECTOR.md, ROADMAP.md, prompts/, agents/, voice/, i18n/
incoming/                   drop zone for new art, audio, voice and text
tests/                      rules, self-play and DOM tests
tools/                      standalone build, voice script, strings export, 3D pieces
```

## Tests

```bash
npm install                 # only for the DOM test (jsdom)
node tests/rules.mjs        # 119 rule checks, including every Chapter III layer
node tests/selfplay.mjs 60  # AI-vs-AI battles on all four fields
node tests/ui.mjs           # boots index.html in jsdom: home, battle, astras, lesson, daily
```

## Making things for the game

| You want to make… | Read |
|---|---|
| images | [`docs/prompts/ART.md`](docs/prompts/ART.md) |
| 3D pieces and renders | [`docs/prompts/3D.md`](docs/prompts/3D.md) |
| music and sound effects | [`docs/prompts/AUDIO.md`](docs/prompts/AUDIO.md) |
| Sanjaya's voice | [`docs/prompts/VOICE.md`](docs/prompts/VOICE.md) |
| tasks for ChatGPT | [`docs/agents/CHATGPT.md`](docs/agents/CHATGPT.md) |
| tasks for Sarvam AI | [`docs/agents/SARVAM.md`](docs/agents/SARVAM.md) |

Drop the results in [`incoming/`](incoming/README.md).

## Respect

No deity is ever a playing piece; nothing holy is captured. Astras are invoked and shown as their
element. The full charter is in `docs/DIRECTOR.md` §6.

## Privacy

There is no backend. Profiles, saves, settings and Daily results live in this browser's
`localStorage`. Use **Export backup** on the home screen to move them to another device.

## Licence

MIT — see `LICENSE`.
