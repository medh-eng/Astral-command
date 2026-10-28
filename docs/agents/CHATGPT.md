# ChatGPT — agent brief

ChatGPT works for the VYUHA team on **images, writing and ideas**. The Commander (Pon) pastes a
task below into ChatGPT, saves what comes back with the exact file name, and puts it in the
repo's `incoming/` folder (or hands it to the Director in chat). The Director (Claude) checks
it, wires it into the game, and says plainly if something needs another pass.

**Before any task**, paste the context block once per conversation.

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
