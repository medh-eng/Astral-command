# VYUHA — roadmap and status

The live status board. Ticked = on `main` and playable. Owner tags: **[C]** Commander (Pon),
**[D]** Director (Claude), **[G]** ChatGPT, **[S]** Sarvam AI.

Last updated: **29 Oct 2026**; Director baseline with ChatGPT takeover progress below.

---

## Phase A — Fix the foundations ✅

- [x] **[D]** Shuffle never puts the fort on the front line (was 1 in 3; caused ~15% of square games to end within 6 rounds)
- [x] **[D]** The opponent picks a different formation each battle (it always used the same one)
- [x] **[D]** Fort gate: two blows to take a fort — no more first-move wins
- [x] **[D]** First-move balance: duels open in Chandra's hour (see `DIRECTOR.md` §9)
- [x] **[D]** Abhimanyu tuned: 28 rounds, raiders by day with 2 Shakti (raiders win 33–40%)
- [x] **[D]** Padmavyuha: deployment, true clockwise ring order, rotation, a player-at-the-bottom layout
- [x] **[D]** The AI no longer reads the hidden enemy fort
- [x] **[D]** Draws replaced by a ceasefire decided by strength
- [x] **[D]** Every sci-fi string retired (Aetherfront, Astral AI, Nexus Core, Sapper, Mine…); "stratego" removed from the package keywords
- [x] **[D]** The player's half of the Chakravyuha is at the bottom of the screen
- [x] **[C]** Rename the GitHub repo from `Astral-command` to `vyuha` (Settings → General → Repository name; GitHub redirects the old links, but the Pages URL changes — update `PUBLIC_URL` in `js/modes.js` the same day)

## Phase B — The hook ✅ (art and audio still to come)

- [x] **[D]** No login wall; new home with one big **Yuddh karo** button
- [x] **[D]** Pehla Yuddh — the two-minute guided first battle
- [x] **[D]** Daily Chakravyuha — seeded by date (IST), one modifier a day, streaks, `#daily` deep link
- [x] **[D]** WhatsApp share card with a per-round emoji grid; share after any win
- [x] **[D]** Clash cinematics (Devanagari verdicts, bonus chips), odds on the board, tap-twice strikes
- [x] **[D]** Surya/Chandra hours with sky chip, field tint, dawn/dusk beats
- [x] **[D]** Makara and Padma formations with glowing links after a clash
- [x] **[D]** Shakti diyas and four astras with targeting, cinematics and sounds
- [x] **[D]** Sanjaya narrates (Hinglish / हिन्दी / English), plays recorded voice when it exists
- [x] **[D]** Opponents Sainik / Dronacharya / Shakuni; titles Shishya → Atimaharathi
- [ ] **[C][G]** Art pack III — astra emblems, Sanjaya portrait, day/night skies, daily card, store art (`docs/prompts/ART.md`, priority 1 items first)
- [ ] **[C]** Sound pack III — conch, gate breach, dawn, dusk, four astra stingers, trap, Divya-drishti, diya (`docs/prompts/AUDIO.md`)
- [ ] **[C][S]** Sanjaya's voice, 44 lines in Hindi and English (`docs/prompts/VOICE.md`, `docs/voice/sanjaya-lines.csv`)
- [ ] **[S]** Hindi and Marathi translation of the interface strings (`docs/agents/SARVAM.md`, task 2)
- [ ] **[C]** Five real people play Pehla Yuddh and one Daily on their own phones; notes go below

## Phase C — Depth and heroes

- [ ] **[D]** Hero cards: a Maharathi or Senapati may take a hero's trait — Arjuna (archer range 3), Karna (Kavach: survives the first defeat), Bhima (wins ties), Ghatotkacha (+1 at night), Abhimanyu (enters any formation, never retreats). Drafted before battle.
- [ ] **[D]** Pratigya — secret vows (e.g. *Bhishma's vow: win without your Senapati ever striking*) that earn stars and titles
- [ ] **[D]** Dvandva — equal strength becomes a 3-second bluff duel (Astra / Shastra / Kavach) instead of a setting
- [ ] **[D]** Campaign map: the seven vyuhas (Chakra, Padma, Krauncha, Makara, Suchi, Shyena, Sarvatobhadra), one lesson each
- [ ] **[D]** Facing (already built for the lotus) introduced in the Krauncha chapter
- [ ] **[D][G]** 30 hand-checked Daily modifiers and layouts (ChatGPT drafts, Director simulates). Takeover branch: 25 new drafts and 3,600 simulated matches across both boards, 20 candidates inside the target on both; awaiting independent seeds, review and promotion. See `incoming/text/README.md`.
- [ ] **[C][G]** Hero portraits (warriors, never deities) — `docs/prompts/ART.md` §6

## Phase D — Social

- [ ] **[D]** Challenge-a-friend link: a seeded battle anyone can open from WhatsApp and compare results
- [ ] **[D]** Replay clip: the best moment of a battle as a 10-second vertical video for Reels and Shorts (the engine already records every move)
- [ ] **[D]** Vyuha codes: share a formation as a short code others can try to break
- [ ] **[D]** Seasons named after the parvas; city leaderboards (needs a small server — decide in Phase E)
- [ ] **[D]** Online play (needs a server that keeps ranks hidden from both clients)

## Phase E — Launch

- [ ] **[D]** Android build with Capacitor (same path as Indistock); ship only the optimised art (≈2 MB), not the 129 MB of masters
- [ ] **[C]** Play Store listing: icon, feature graphic, 6 screenshots, 30-second trailer (`docs/prompts/ART.md` §8, `docs/prompts/AUDIO.md` §4)
- [ ] **[C]** Legal check: name and trademark search for "VYUHA", game rules review by an IP lawyer before going commercial (the rules were designed for distance from Stratego — gates, hours, formations, astras, turning fields — but that is not legal advice)
- [ ] **[C]** Launch timing: a festival week — Makar Sankranti (a sun festival — a Suryavansh event) is the next natural moment
- [ ] **[C]** Respect review: at least three players from different backgrounds (charter §6)
- [ ] **[D]** Monetisation, if any: cosmetic folk-art editions (Pattachitra, Madhubani, Gond, Warli, Kalamkari); never power, never real money

---

## What to measure once real players arrive

| Signal | Target | Why |
|---|---|---|
| Pehla Yuddh finished | > 80% of new players | The lesson is the funnel. |
| First real battle finished | > 60% | Is the first battle too long or too hard? |
| Daily played on day 2 | > 30% | The habit loop. |
| Daily shares per 100 players | > 15 | The viral loop. |
| Median battle length | 8–12 minutes | Fits a break. |

The game has no analytics today (no server, nothing uploaded). Adding any must be opt-in and
written up here first.

## Playtest notes

*(Add a dated line per session: who played, device, what confused them, what they loved.)*


## ChatGPT takeover — 29 October 2026

Code and writing prepared on a review branch, not marked shipped here: Sunday lotus Daily fix, fully seeded Daily AI including save/resume, bounded modifier support, current desktop/phone screenshot harness, five writing tasks, and root `AGENTS.md`. Details, verification and next priorities: [`HANDOFF-2026-10-29.md`](HANDOFF-2026-10-29.md). Priority 1 art, voice, translations and real-person playtests remain open.
