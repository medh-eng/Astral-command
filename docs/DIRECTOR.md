# VYUHA · व्यूह — Director's bible

> **Abhimanyu got in. Can you get out?**
> *Chakravyuha todke dikhao.*

This is the single document that says what VYUHA is, how it plays, how it should look and
sound, who does what, and how work moves from an idea to the live game. When anything else in
the repo disagrees with this file, this file wins — and then gets fixed.

| | |
|---|---|
| **Commander** (final say) | Pon |
| **Director** (design, build, quality, integration) | Claude |
| **Agents** | ChatGPT — art, lore, puzzles · Sarvam AI — Hindi/Marathi, voice, cultural review |
| **Live game** | <https://medh-eng.github.io/vyuha/> · Daily: `…/#daily` · Lesson: `…/#learn` |
| **Chapter** | III — *Shakti* (this document) |
| **Status board** | [`docs/ROADMAP.md`](ROADMAP.md) |

---

## 1. The game in one breath

Two armies of twelve face each other on a battlefield shaped like a war formation from the
epics. Every rank is hidden until pieces fight. You read what the enemy does, wait for your
hour, close a pincer, spend the Shakti you have earned on a divine weapon — and break the gate
of their fort before they break yours.

**What makes it ours (and not anyone else's game):**

1. **The field is a formation.** The Chakravyuha wheel and the Padmavyuha lotus turn every
   fifth round and expose whatever they carry.
2. **The sky decides fights.** Surya's hour and Chandra's hour swap every five rounds; the side
   in its hour strikes at +1.
3. **Shapes matter.** Makara (a pincer) adds +1 to a strike; Padma (a guarded piece) adds +1 to a
   defence. The game's name is finally a mechanic.
4. **Astras.** Every piece you take lights a lamp. Five lamps, four divine weapons, each once per
   battle.
5. **Sanjaya tells the story.** The narrator who gave the blind king the war, now narrating yours.
6. **The Daily Chakravyuha.** One seeded wheel for all of India each day, and a share card for
   the family WhatsApp group.

## 2. Pillars

Every feature has to serve at least one of these, and must not break any of them.

| Pillar | Means | Never |
|---|---|---|
| **Hidden, but readable** | Every guess is a calculation: odds on the board, beliefs in the intel panel, an AI that plays by the same information. | Coin-flip moments, an AI that peeks. |
| **The epic, respectfully** | Formations, dynasties, warriors, weapons, Sanjaya — the language and look of the epics. | A deity as a playing piece. Nothing holy is ever captured. |
| **Eight minutes to play, eight seconds to share** | A battle fits a chai break; the result fits a WhatsApp message. | Login walls, long setup, results nobody wants to post. |
| **Big moments** | Clashes, a broken gate, an astra, the turning sky — each is a beat with sound and light. | Text pop-ups that block the board. |
| **One thumb, any phone** | Works on a ₹8,000 Android, offline, in a browser with no install. | Heavy downloads, tiny targets, hover-only information. |

## 3. Rules — Chapter III

The engine is `js/engine.js`; numbers live in `js/units.js`. Each Chapter III layer can be
switched off per battle (`rules: { gates, hours, vyuha, astras }`) — the setup screen offers
**VYUHA** (all on) or **Classic** (all off).

### The army (12 a side)

| Rank | Piece | देवनागरी | Count | Special |
|---|---|---|---|---|
| 10 | Senapati | सेनापति | 1 | Strongest. Falls to a Chara that strikes first. |
| 9 | Maharathi | महारथी | 1 | Second strongest. |
| 7 | Ashvarohi | अश्वारोही | 1 | Dashes up to 2 cells and strikes at the end. |
| 6 | Dhanurdhar | धनुर्धर | 1 | *Shara-varsha*: volley at exactly 2 cells; kills rank ≤ 5. |
| 5 | Divyadrishti | दिव्यदृष्टि | 1 | *Divya-drishti*: reveals an enemy within 2 cells. |
| 3 | Yantrik | यंत्रिक | 2 | Only piece that dismantles a trap. |
| 2 | Rath | रथ | 2 | Slides any distance; strikes at the end of the run. |
| S | Chara | चर | 1 | Kills Senapati or Maharathi when it strikes first. |
| B | Shataghni | शतघ्नी | 1 | Immovable trap. Kills any attacker except a Yantrik. |
| F | Durg | दुर्ग | 1 | The fort. Immovable. Has a gate. |

### Fields

| Field | Shape | Cells | Rings turn | Sunset |
|---|---|---|---|---|
| **Chakravyuha** चक्रव्यूह | wheel: hub + 3 rings × 12 | 37 | yes, every 5 rounds | round 40 |
| **Padmavyuha** पद्मव्यूह | lotus: hexagon of hexagons | 37 | yes, every 5 rounds | round 40 |
| Sarvatobhadra सर्वतोभद्र | square 6 × 8 with rifts | 48 | no | round 40 |
| Kurukshetra कुरुक्षेत्र | square 8 × 10 with rifts | 80 | no | round 50 |

The wheel and the lotus are the flagship fields. The squares are the classic and the long war.

### A turn

On your turn you do exactly one thing: move, strike, look (Divyadrishti), loose a volley
(Dhanurdhar), or invoke an astra.

### Strength in a clash

`attacker = rank + hour + makara` against `defender = rank + padma`, each side capped at +2.
Higher strength wins. Equal strength: either the attacker wins and its shield cracks
(−1 rank), or both fall — chosen in setup. The Chara's first strike on a Senapati or Maharathi
ignores every bonus. Traps and forts ignore bonuses.

- **Hour (प्रहर)** — rounds 1–4 are Chandra's hour (night), 5–9 Surya's (day), then every five
  rounds it swaps. Suryavansh strikes at +1 by day, Chandravansh by night. A duel opens in the
  last hour of night because it balances the first move (see §9).
- **Makara (मकर)** — strike an enemy that another of your fighting pieces already touches: +1.
- **Padma (पद्म)** — a piece touched by two or more of its own fighting pieces defends at +1.

### The fort gate

The first successful blow on a Durg — melee, volley, or fire — breaks its gate and reveals it;
the attacker stays where it was. The second blow takes the fort and ends the battle. A broken
gate gives its owner +2 Shakti (a besieged house finds its strength).

### Shakti and the four astras

Shakti (0–5, shown as five diyas): +1 for every piece you take, +1 to both sides each time the
sky turns. Each astra is once per battle, uses your whole turn, and reaches anything within two
cells of any of your pieces.

| Astra | Cost | Effect |
|---|---|---|
| **Vayavyastra** वायव्यास्त्र (wind) | 1 | Swap any two of your own pieces — even the fort. Both stay hidden. |
| **Sammohanastra** सम्मोहनास्त्र (trance) | 2 | An enemy piece cannot act on its owner's next two turns. It still defends. |
| **Agneyastra** आग्नेयास्त्र (fire) | 3 | Reveals a piece; rank ≤ 4 and traps burn; a fort's gate burns open. |
| **Brahmastra** ब्रह्मास्त्र (light) | 5 | Destroys any one enemy fighting piece and reveals everything around it. |

A side whose every movable piece is entranced loses the turn, not the battle.

### How a battle ends

- Take the enemy fort (second blow), or
- the enemy has no legal action left, or
- **ceasefire**: no piece falls for 100 orders, or the sun sets on the field's last round — the
  stronger army holds the field (sum of fighting ranks, +5 for a fort whose gate stands).
- Scenarios (Abhimanyu, the Daily) run on a round limit; the defence wins when it runs out.

### Modes

| Mode | What it is |
|---|---|
| **Yuddh karo** (quick battle) | One tap: the last setup, or Chakravyuha vs Dronacharya. |
| **Custom battle** | Field, opponent, scenario, rules, tie rule, turn clock. |
| **Abhimanyu** | 8 raiders (no fort, no trap) vs 10 defenders on the wheel, 28 rounds, raiders by day with 2 Shakti. |
| **Daily Chakravyuha** | Seeded by the date in IST; 8 raiders vs 10; 24 rounds; one modifier a day; one official attempt; streaks; share card. Sundays are Padmavyuha day. |
| **Pehla Yuddh** | The two-minute lesson: six steps (move, look, volley, strike, trap, fort) against an army held still by Guru Drona. |
| **Pass & play** | Two players, one device, a curtain (पर्दा) between turns. |

### Opponents

| Name | Key | Temperament |
|---|---|---|
| **Sainik** सैनिक | `recruit` | Brave, greedy, forgets your threats. |
| **Dronacharya** द्रोणाचार्य | `veteran` | The teacher. Reads your formation, punishes loose pieces. |
| **Shakuni** शकुनि | `archon` | Looks one reply ahead and waits for your mistake. |

The AI never reads hidden ranks or the hidden fort: it guesses the fort from public information
(the deepest enemy piece that has never moved), exactly as a player does.

### Titles

Earned by wins and never lost: Shishya (0) → Sainik (1) → Rathi (5) → Atirathi (15) →
Maharathi (35) → Atimaharathi (75) — the warrior grades of the epic.

## 4. Look — art direction

**Temple-punk.** Carved brass and obsidian, lit like a lamp-lit mandapa. Saffron and gold for
Suryavansh and the day; indigo, silver and moonstone for Chandravansh and the night. Boards are
yantra linework: concentric rings, petals, kolam dots.

- **Type:** Rozha One for titles (Latin + Devanagari), Inter for reading, Tiro Devanagari Hindi
  for Devanagari body text.
- **Colour tokens:** gold `#e0a94a` / `#f2cf8b`, saffron `#f08a24`, indigo `#8b8ff0`,
  fire `#ff7a2f`, wind `#bfe3ff`, trance `#b9a8ff`, light `#fff1c2`.
- **Pieces** read at 32 px on a phone: one silhouette, one emblem, no text inside the art (the
  game prints the rank).
- **Every visual slot has a vector fallback**, so missing art never breaks the game. New art
  appears automatically when a file lands at the right path (see `docs/prompts/ART.md`).
- **Folk-art editions** (later, cosmetic only): Pattachitra, Madhubani, Gond, Warli and
  Kalamkari boards and piece sets — instantly Indian, and a natural thing to unlock.

## 5. Sound — direction

- **Instruments:** tabla and pakhawaj for tension, sitar or sarangi drones for the menu,
  shehnai or bansuri for victory, conch (shankh) to open and close a battle, temple bells for
  dawn, crickets and a low drone for night.
- **Tension:** the battle score speeds up (tempo, not pitch) when a gate is broken and in the
  last rounds — the code does this already with any track.
- **Quiet by default:** the game is played on buses and in waiting rooms; nothing should startle.
  Music around −17 LUFS, one-shots around −14 LUFS, no clipping.
- **Every cue has a synthesised fallback** in `js/audio.js`; a recorded file replaces it the
  moment it is dropped in (see `docs/prompts/AUDIO.md`).
- **Sanjaya's voice:** a calm, warm male narrator in his 40s–50s; storyteller, not announcer.
  Script and file names in `docs/voice/sanjaya-lines.csv`; how to make it in `docs/prompts/VOICE.md`.

## 6. Respect charter

1. No deity is ever a playing piece, a target, or a capture. Astras are invoked and shown as
   elements — wind, trance, fire, light — never as a god.
2. Epic **warriors** (Arjuna, Karna, Bhima, Abhimanyu…) may appear as heroes in future chapters,
   treated with dignity; no mockery of any figure, community or region.
3. Sanskrit and Hindi terms are spelled consistently (this file is the reference) and reviewed
   by a native speaker (Sarvam AI first pass, a human second).
4. Before a public launch, at least three people from different backgrounds play it and say what
   felt wrong. Their notes go in `docs/ROADMAP.md`.
5. No real-money mechanics, ever. Cosmetics only; never sell power.

## 7. Team and workflow

### Who does what

| Role | Owns | Hands over |
|---|---|---|
| **Pon — Commander** | Final say on direction, names, art and sound picks; makes images, 3D, music and voice with the prompt packs; playtests; decides launch. | Asset files (see below); approvals and vetoes in chat. |
| **Claude — Director** | Design, rules, code, balance simulations, integration of every asset, tests, screenshots, docs, the roadmap. | Commits on `main` with a clear message; a short report in chat. |
| **ChatGPT — agent** | Image generation from `docs/prompts/ART.md`; daily-puzzle variants, lore, codex text, playtest notes. | Files and text per `docs/agents/CHATGPT.md`. |
| **Sarvam AI — agent** | Hindi and Marathi translation, Hinglish polish, Sanjaya's voice (Bulbul), cultural review. | Files per `docs/agents/SARVAM.md`. |

### How an asset gets into the game

1. Make it with the prompt in the matching pack (`docs/prompts/…`).
2. Name it exactly as the pack says.
3. Put it in the repo's **`incoming/`** folder on GitHub (Add file → Upload files), in the
   sub-folder the pack names — or attach it in the chat with the Director.
4. The Director keeps the master, makes the optimised copy (WebP/JPEG/MP3 at the right size),
   wires it in, runs the tests, checks it on desktop and phone, and commits.
5. If an asset is weak (does not read at phone size, wrong palette, clipped sound), the Director
   says so plainly and suggests a better prompt — the Commander decides.

### How code changes ship

- `main` is the live game (GitHub Pages). Every push runs on real phones within minutes.
- Before every push: `node tests/rules.mjs && node tests/selfplay.mjs 40 && node tests/ui.mjs`,
  plus a browser screenshot pass on desktop and phone width.
- Balance changes come with a simulation run (`tools/` scripts or the self-play harness) and the
  numbers go in §9.
- One session works on the repo at a time. If two must run, the second works on a branch.

## 8. Decisions log

| Date | Decision | Why |
|---|---|---|
| 28 Oct 2026 | The game is **VYUHA**, Indian epics, no deities as pieces. | Commander's direction; respect charter. |
| 29 Oct 2026 | Chapter III adds gates, hours, formations, Shakti and astras. | Makes the name a mechanic; creates shareable moments; fixes instant fort losses. |
| 29 Oct 2026 | Duels open in Chandra's hour. | AI self-play showed a first-mover edge on the wheel and lotus; night-first evens it. |
| 29 Oct 2026 | Shuffle always keeps the fort in the deepest line. | 1 in 3 shuffles put the fort on the front row; ~15% of square games ended within 6 rounds. |
| 29 Oct 2026 | The AI guesses the enemy fort instead of reading it. | Fairness; "the AI never cheats" is a promise we can print. |
| 29 Oct 2026 | Ceasefire by strength instead of a draw. | Long square-field games stalled into draws; a result is more satisfying. |
| 29 Oct 2026 | Facing rule (Padmavyuha) stays built but off by default. | Hardest rule to learn; hooks first, depth later. |
| 29 Oct 2026 | No login wall; first-time players are "Yoddha". | Every extra screen before the first battle loses players. |
| 29 Oct 2026 | Daily seeded by the IST date; Sunday is Padmavyuha day. | One wheel for all of India; a reason to come back. |

## 9. Balance — the numbers

AI-vs-AI self-play, same opponent on both sides, all Chapter III rules on, duels opening at
night (the shipped settings). Run on 29 Oct 2026.

| Field | Opponent | Suryavansh wins | Chandravansh wins | Shared | Median rounds |
|---|---|---|---|---|---|
| Chakravyuha | Dronacharya | 47% | 53% | 0% | 20 |
| Chakravyuha | Shakuni | 41% | 59% | 1% | 25 |
| Padmavyuha | Dronacharya | 49% | 51% | 0% | 21 |
| Padmavyuha | Shakuni | 53% | 47% | 1% | 30 |

- Battles that end within six rounds: **~1%** (was 13–16% on the squares, 22–32% on the lotus).
- Astras invoked per battle: ~6 of the 8 available (both sides together).
- **Abhimanyu** (28 rounds, raiders by day with 2 Shakti): raiders win 33–40% depending on the
  opponent — hard, as the story demands, but very possible.
- The square fields run long under the honest AI (median 40–50 rounds, many sunsets). They are
  the classic modes; the wheel and the lotus are the default.

Re-run before any rule change and update this table.
