# Sarvam AI — work log and handoff, 31 October 2026

**For:** Claude (Director)
**From:** Sarvam AI (agent)
**Batch:** 3.2 and 3.3 complete; 3.1 and 3.4 not done — reasons below.

Read this alongside `docs/agents/SARVAM.md` (▶ Batch 3) and
`docs/HANDOFF-2026-10-30-director.md`. The Commander remains final authority; nothing here is a
shipped feature. All three files are drafts sitting in `incoming/`, waiting for you to wire them in.

---

## Delivered

### 3.2 — Hindi review, batch 2 → `incoming/text/sanjaya-review-2.csv`

The 30 lines that were not in `incoming/text/sanjaya-review.csv`, reviewed for naturalness,
grammar, matras and nukta, verb agreement and meaning against the English. Columns are the same
as batch 1: `id`, `hindi_voice_text`, `note`.

**7 fixes, 22 unchanged, 1 held.** Longest line is 12 words, so every line still fits the
2–4 second read.

| id | was | now | why |
|---|---|---|---|
| `volley_turned_1` | टकरा के टूट गए | टकराकर टूट गए | the clipped Braj form reads as verse, awkward in one breath |
| `scan_1` | दिव्य-दृष्टि · छुपता | दिव्यदृष्टि · छिपता | hyphen dropped to match the glossary; standard spelling |
| `rotate_1` | घेरों पर सब कुछ दिख गया | घेरों का सब कुछ खुल गया | "exposed" is खुलना, not merely becoming visible |
| `shield_break_1` | जीत गया, पर ढाल टूट गई | वह जीत गया, पर ढाल चटक गई | "cracked" is चटकना; वह makes the subject clear heard once |
| `entranced_pass_1` | हर चलने वाला योद्धा | जो भी योद्धा चल सकता था, वह | the old line read as "every walking warrior" |
| `last_rounds_1` | चक्र बंद हो रहा है | चक्र सिकुड़ रहा है | बंद sounded like the wheel being switched off |
| `draw_1` | मैदान बराबर | मैदान बराबरी का रहा | how a drawn field is actually said |

**Held:** `astra_vayavya_enemy_1` is untouched. The Commander called it flat and the rewrite in
your 30 Oct handoff is still waiting on his approve/change/remove. Editing it now would mean
recording a line he may yet delete.

Two lines worth your eye when you wire this in, though neither needed a change:

- `astra_sammohana_enemy_1` says *"दो चाल तक रुक गया"*. It is right only because the game uses
  **चाल** for a move. If you ever rename the round or the move, this line breaks with it.
- `dawn_1` and `dusk_1` use **पहर** for the hour. It is the better word and I kept it, but the
  interface strings say **पहर** too, so the two now agree. Worth keeping that agreement.

On your correction to batch 1: you were right, and the same ने + रोके हुए हैं construction does
not appear anywhere in this batch. Every compound verb here agrees with its subject.

### 3.3 — Interface strings, Hindi and Marathi → `incoming/i18n/strings.hi.json`, `strings.mr.json`

All **149** keys translated, including the new Daily variants. Both files:

- carry **every key from `strings.en.json`, in the same order**, with no additions — checked
  programmatically, not by eye;
- keep numbers, `+1`, `×2` and the `6 × 8` / `8 × 10` board sizes exactly as they are;
- hold the game terms in Devanagari, spelled one way throughout: सेनापति, महारथी, दिव्यदृष्टि,
  शतघ्नी, दुर्ग, चक्रव्यूह, पद्मव्यूह, मकर, पद्म, अग्नेयास्त्र, सम्मोहनास्त्र, वायव्यास्त्र,
  ब्रह्मास्त्र, शक्ति — and in Marathi सेनापती, महारथी, दिव्यदृष्टी, शतघ्नी, दुर्ग, शक्ती;
- contain no leftover Latin text (validated with a regex, not a skim);
- are UTF-8, two-space indented, and re-parsed after writing to prove they load.

**Glossary I used, so you can check me against it.** The pieces are चर / रथ / यंत्रिक / द्रष्टा /
धनुर्धर / अश्वरोही / महारथी / सेनापति, the trap is शतघ्नी and the fort is दुर्ग — the same words
Sanjaya already says. A **move** is चाल and a **round** is दाँव, so `battle.round` is दाँव. The
board is a **खाना** (Hindi) / **घर** (Marathi). The opponents are सैनिक / द्रोणाचार्य / शकुनि.

Two judgement calls you may want to overrule:

1. `home.codex` still says **"Codex"** in the English source, though the worklog says it was
   renamed to *Rules*. I translated the meaning, so Hindi and Marathi both say **नियम**
   ("rules"). If you change the English to "Rules", the translations already match.
2. `unit.5.role` is **द्रष्टा** (the seer) while the piece itself is **दिव्यदृष्टि**. Role and
   piece name differ in English too, so I mirrored that rather than flattening them.

---

## Not done, and why

### 3.1 — Re-record four lines: **not possible from here**

`start_abhimanyu_1`, `start_tutorial_1`, `lose_capture_1`, `trap_defused_1` need Bulbul
text-to-speech. I have no TTS tool and no API key in this session, and I will not ask for or
handle a credential. The corrected Hindi for all four is already in `incoming/text/sanjaya-review.csv`
(batch 1), so the command in your brief can be run as-is by whoever holds the key:

```bash
python3 tools/voice-gen.py \
  --ids start_abhimanyu_1,start_tutorial_1,lose_capture_1,trap_defused_1 \
  --lang hi --speaker rahul --pace 1.15
```

Same for the Marathi and English sets in tasks 3 and 4. **No audio file in this batch is new or
replaced** — nothing was synthesised, so nothing can be mistaken for a Commander-approved voice.

### 3.4 — The two flat lines: **waiting on the Commander, not on me**

`win_capture_2` and `astra_vayavya_enemy_1` still need his approve / change / remove. Your
proposed rewrites are good and I would record them as written; I have left both lines alone
rather than pre-empting him.

---

## What you need to do

1. Apply the seven fixes from `sanjaya-review-2.csv` to `js/sanjaya.js`, then regenerate the
   voice script (`tools/` — the CSV that feeds `voice-gen.py`).
2. Add the language switch and load `strings.hi.json` / `strings.mr.json`. **Nothing reads these
   files yet** — they are drafts in `incoming/`, and the roadmap item stays unticked until the
   switch is wired and playable.
3. Decide on `home.codex` ("Codex" vs "Rules") before the strings ship, so the three languages
   do not disagree.
4. Run 3.1 and 3.4 once the Commander has the key and has ruled on the two rewrites.

## Checks I ran

| Check | Result |
|---|---|
| `strings.hi.json` keys vs `strings.en.json` | 149/149 present, same order, no extras |
| `strings.mr.json` keys vs `strings.en.json` | 149/149 present, same order, no extras |
| Leftover Latin text in either file | none |
| JSON re-parse after write | both load, UTF-8 |
| `sanjaya-review-2.csv` rows | 30, matching the 30 ids not in batch 1 |
| Line length | max 12 words, all under the 14-word bar |
| CSV re-parse | 30 rows, 3 columns, quoting matches batch 1 |

**Not checked, and I am not claiming it:** no native Marathi speaker has read `strings.mr.json`.
I am a model, not a Maharashtrian reader, and the Marathi is mine, not a reviewer's. It is worth
one pass from a person before it ships — the same standard the Commander set for the Hindi voice.
