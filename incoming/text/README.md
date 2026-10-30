# ChatGPT writing handoff — 29 October 2026

All files are drafts for Commander/Director review, following `docs/agents/CHATGPT.md`.

| Task | Deliverable | Status |
|---|---|---|
| 2 | `daily-modifiers.json` | 25 schema-checked variants; only the documented knobs. |
| 2 / Phase C | `daily-balance.json` | 60 paired seeds × 30 variants × 2 boards = 3,600 full Dronacharya self-play matches. Not human win-rate evidence. |
| 3 | `store-listing.md` | English + Hinglish, 20 editorial keywords, 5 captions; title ≤30, shorts ≤80, full descriptions 600–900 words and ≤4,000 characters. |
| 4 | `campaign.md` | Seven original 90–120-word intros, lessons, 12-word victory lines; source links and adaptation notes. |
| 5 | `heroes-vows.json` | Eight hero concepts and 12 vows; proposed rules, never activated by importing this file. |
| 6 | `playtest.md` | Ready-to-run observation script; no real-person sessions claimed. |

The 25 modifiers and five existing variants share the `key`, `deva`, `name`, `one`, `knobs` schema. Ranks are strings. `startShakti` uses named `raiders` and `defenders` fields. Omitted knobs keep the original Daily defaults: day first, Shakti 2/0, rotation 5, limit 24, gate closed, original 8/10 rosters.

Twenty new candidates fall within the Director's 30–55% screening range on **both** boards in this small seed sample. Hold `vasant`, `shishir`, `harvest`, `archers-watch` and `quiet-gate` for tuning; at least one geometry is outside the band. The existing `open` variant is also above target. Raw counts and ending reasons are in the JSON report. Selection from this sample is not independent validation; run fresh seeds and observe human players before promotion. The live catalogue remains the original five, preserving date selection and existing official results.

**30 Oct independent check:** `daily-balance-independent-2026-10-30.json` adds 120 fresh paired seeds per board/variant (7,200 games, `0x6f31a9`), preserving the original 60-seed report. Of the 25 new drafts, 17 meet the 30–55% band on both boards in both banks; each bank separately screens in 20. `harvest` and `quiet-gate` fail both; six other candidates flip classification between seed banks (`vasant`, `shishir`, `archers-watch`, `silver-watch`, `brass-reserve`, `double-scout`). The existing shipped `open` remains above target at 67.5% raider wins on wheel and 65.8% on lotus in the fresh bank. These remain AI screening results, not human win rates. See `docs/HANDOFF-2026-10-30.md` for follow-up and versioning caution.

Hero integration assumptions: one trait per army, attached to one Senapati or Maharathi before deployment; traits are visible, ranks stay hidden until normally revealed. No stacking heroes on a piece. All vows require a win, are chosen before battle and checked from events; turn-limit defence victories do not satisfy fort-capture vows. Rewards are cosmetic suggestions without combat benefits. New tracking for night defence, movement after rotation, eligible breaches, and secret vows needs engine tests before shipping. No quote is attributed to scripture.

Sarvam/native-speaker review of Devanagari and Hinglish and Commander approval remain due. Task 1's nine Priority 1 images are still pending; this writing/code batch does not mark the art pack complete.
