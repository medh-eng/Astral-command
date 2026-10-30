# VYUHA — worklog

What has been done, by area, newest first. Maintained by Sarvam AI (agent). If it is not in
this file and not ticked in `docs/prompts/ART.md`, it did not happen.

---

## 30 Oct 2026 — art, voice, and the loading fix

### Fixed
- **The game stuck on its loading screen.** The service worker served JS and CSS cache-first,
  so after a deploy the browser ran fresh HTML against old scripts and boot threw. Now:
  network-first for `.js/.css/.json/.webmanifest` and directory requests, cache-first only for
  images and audio; cache bumped to `vyuha-v14`; a 6-second watchdog and a global error hook
  hide the loading mark so it can never hang again.
- **The board flashing empty mid-battle.** Every image that finished loading triggered a full
  re-render — on a phone that meant the board being rebuilt a dozen times while the player was
  tapping. Art loads are now coalesced to one render per frame and filtered to what the screen
  actually draws; `render()` is re-entrancy guarded and released in a `finally`.
- **Astra shelf colliding with the command row** on narrow screens — it takes its own row now.

### Added
- **88 voice lines** for Sanjaya — 44 Hindi, 44 English — Bulbul v3, speaker `ashutosh`, pace
  0.9, 64 kbps mono. 2.6 MB. Generator at `tools/voice-gen.py` (key read from the environment,
  never stored).
- **Sanjaya's portrait** — still (30 KB) replaces the vector mark on the narration strip; the
  30-frame loop is staged at `portraits/sanjaya-anim.webp`.
- **The four astras move** — each split into a 4–6 KB still (shelf, badges) and a 640 px loop
  (646 KB–1 MB) played only when that astra fires, behind the Devanagari name and verdict.
- **Gate breach** — painted doors wired into the breach beat, same treatment as the astras.
- **Five hero portraits** (Arjuna, Karna, Bhima, Ghatotkacha, Abhimanyu), 512², staged in
  `opt/heroes/` with a `hero:` path registered — waiting for the Phase C hero cards.
- **Campaign map** and **temple hall** staged in `opt/ui/`.
- **New app icon** — brass chakra on indigo, live via the manifest.
- **Day/night skies**, **Padma board surface**, **daily card** backdrop, **arena courtyard**.
- **Sound pack III** — shankh, gate breach, dawn, dusk, four astra stingers, divya-drishti,
  shakti diya.
- **"Codex" renamed to "Rules"** throughout.

### Housekeeping
- **Repo 144 MB → 63 MB.** The 31 art masters were 2048 px PNGs (133 MB); they are archived in
  `masters/` at 1024–1280 px (28 MB) and the oversized originals were removed from
  `assets/art`, which now holds only what the game loads.
- `docs/prompts/ART.md` and `AUDIO.md` carry a STATUS section: delivered items ticked with
  paths, outstanding items with prompt, size and owner.
- `incoming/text/sanjaya-review.csv` — first review batch of the Hindi voice lines.


---

## 30 Oct 2026 (later) — audio measured, trimmed, re-voiced; the board stops vanishing

### Audio audit — measured every file, not trusted
Nine effects were outside their target length. Measured, then cut with a 120 ms fade:

| file | was | now | target |
|---|---|---|---|
| shakti_diya | 11.34 s | **0.70 s** | 0.4–0.7 |
| gate_breach | 8.18 s | **1.40 s** | 1.0–1.4 |
| astra_agneya | 5.59 s | **1.60 s** | 0.8–1.6 |
| astra_brahma | 4.66 s | **2.00 s** | 1.0–2.0 |
| shankh | 4.60 s | **2.00 s** | 1.2–2.0 |
| dusk | 4.01 s | **2.00 s** | 1.0–2.0 |
| astra_sammohana | 3.12 s | **1.60 s** | 0.8–1.6 |
| divya_drishti | 1.97 s | **1.20 s** | 0.6–1.2 |
| piece_place | 1.34 s | **0.60 s** | 0.2–0.6 |

All 14 effects now sit inside their range. (ChatGPT's report said eight; I measured nine.)

### Sanjaya re-voiced
The first take was lethargic — 44 lines with a median of 3.63 s and 13 over four seconds.
Re-recorded with speaker **rahul** at **pace 1.15** (was `ashutosh` at 0.9): median **3.00 s**,
max 5.09 s, 88 lines, 0 failures. Swapping again is one command:
`tools/voice-gen.py --lang both --speaker <name> --pace <n>`.

### The board no longer disappears when you strike
The stage that carries a clash, an astra or a breach was a near-opaque full-screen scrim
(0.45–0.78 alpha) with a card up to 520 px — on a phone that hid the wheel entirely. Now the
scrim is 0.10–0.42 with a 1.5 px blur, the card is 440 px, and every beat is capped at
**1.5 s** instead of 2–2.6 s. You can still see the field behind the verdict.

---

## 29 Oct 2026 — the Padmavyuha hex field (phase 1)

- `js/geometry.js`: `padmaBoard()` — 37 cells on an axial hex lattice (eye + rings of 6/12/18),
  six rays per cell, six petals, 15-cell deployment zones, forts on the outer ring, rotation
  order for rings 1–2.
- `js/engine.js`: rotation generalised to any geometry with a `rotationOrder`; homes always come
  from geometry; the facing rule written (a rear strike ignores rank) but left off until its ray
  plumbing is finished.
- `js/units.js`: `padma` registered as a board and added to the duel scenario's list.
- Self-play on the hex terminates cleanly, median ~51 orders.

**Known gaps, deliberately left:** deployment presets still use the square slot logic, so the
hex places 9–11 of 12 pieces; facing is inert (`config.facing = false`); no hex-specific AI
tuning.

---

## 28 Oct 2026 — name, voice, understanding, and the board as hero

- **Renamed to VYUHA (व्यूह)** with Devanagari under the Latin wordmark, subtitle "the seven
  formations"; title, manifest, description and in-app copy updated.
- **"Learn in one screen"** — six cards, each with its Devanagari term and one plain sentence
  (Deploy, Move, Strike, Powers, The turn / The clock, Win), adaptive to the board in play.
- **Every class in the Rules sheet opens with a one-line summary** before the detail.
- **The board became the hero** — intel and log became drawers at every width, the board sits in
  a brass frame with corner bosses, the turn indicator is a chamfered nameplate, a tip plate
  rotates advice every 14 s, and a legend opens each match with three lines of story.

## Earlier — the foundation

- Rebuilt the prototype as a modular app: DOM-free rules engine, cell-graph geometry, three AI
  tiers with a belief model, Web Audio score and effects, local profiles with hashed PINs,
  save slots, PWA/offline, SVG art, accessibility modes.
- The Chakravyuha wheel: 37 cells, rotation every fifth round, hub exposure, arcs one cell and
  spokes as lanes.
- Fixed: attacks were impossible to execute by tapping (a regression of mine); the wheel's rim
  was a motorway (8 sectors → 12); the large arena drew too often.

---

## Pending — my queue

| # | Task | State |
|---|---|---|
| 1 | Sanjaya's 44 Hindi lines — full review | **batch 1 done** (14 highest-frequency lines in `incoming/text/sanjaya-review.csv`); 30 remain |
| 2 | 115 interface strings → Hindi and Marathi | not started — blocks the language switch |
| 3 | Sanjaya's lines → Marathi | waiting on 1 |
| 4 | Bulbul voice re-record after review | one command: `tools/voice-gen.py --ids <id>` |
| 5 | Cultural read of the whole design | not started |

## Pending — not mine

- Hex deployment (full 12 pieces), facing wiring, hex AI tuning.
- Hero cards, campaign map screen, Dvandva, Pratigya (Phase C — the art is staged and waiting).
- Store screenshots and the 30 s trailer (record from the game).
