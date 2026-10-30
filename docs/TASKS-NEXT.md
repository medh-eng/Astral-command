# Next tasks — from the Commander, 30 Oct 2026

> **Status (Director, 30 Oct evening):** 1 and 2 are done. 3 has proposed rewrites waiting for the
> Commander in `docs/HANDOFF-2026-10-30-director.md`. 4 is handed to ChatGPT (batch 3.2, 3.3).

Written down so a fresh chat (or Claude) can pick up without re-reading anything.
State of the project: see `docs/WORKLOG.md`. Art status: `docs/prompts/ART.md`.

## 1. Settings and profile — consolidate the bottom of the screen

The battle screen currently carries blocks that belong behind an icon. Move them:

- **Settings icon** keeps: sound, music, motion, language, and the data actions
  (export backup, import backup, reset).
- **Remove from the bottom of the screen:** the settings block, the quick-settings row,
  the data/export/import block, and the record block.
- The bottom of the battle screen should hold only what a player needs *during* a battle.

## 2. Profile hub (behind the profile icon)

One screen that holds:

- **Name change**
- **Record** — wins, losses, streak, best run
- **Level of play** — Sainik / Dronacharya / Shakuni, shown as the player's standing
- **Avatar** — choose one of **ten** painted profile images
- **Customisation** — the chosen avatar can be adjusted (frame, tint, badge)
- **Own photo** — the player may upload a photo as their avatar

Note for whoever builds it: an uploaded photo means image handling in the browser
(resize to 256 px, store as a data URL in the local profile, never upload it anywhere).
It also needs a clear consent line — "this photo stays on your device".

## 3. Two Sanjaya lines to rewrite

- `unke taraf hawa chali` — flat; the wind is doing something vague.
- `hamari pankti aage badh rahi hai` — flat; it reports a fact without weight.

Both should say what changed on the field and why it matters, in the same voice as the
rest: short, concrete, a little awe. **Confirm the intent with the Commander before
re-recording** — it is not clear whether he wants them improved or removed.

## 4. Decisions waiting

- **Landscape for battle** — recommended (portrait caps the board at phone width; landscape
  gives roughly four times the area). Needs a "turn your phone" prompt and a portrait fallback.
- **First-run walkthrough** — three cards naming every button (intel eye, log book, rules
  scroll, Shakti diya). Agreed in principle, not built.
