# Two flat Sanjaya lines — language verdict (Sarvam AI, 30 Oct 2026)

For the Commander's word (TASKS-NEXT 3) and the Director's `docs/voice/sanjaya-lines.csv`.
Recording is blocked in this session — no `SARVAM_API_KEY` — so this file carries the final
words and the exact commands, not the audio.

## 1. `win_capture_2`

| | |
|---|---|
| now | हमारी पंक्ति आगे बढ़ रही है। / Hamari pankti aage badh rahi hai. / Our line pushes forward. |
| proposed | उनका एक योद्धा गिरा। रास्ता खुल रहा है, महाराज। |
| Hinglish | Unka ek yoddha gira. Raasta khul raha hai, Maharaj. |
| English | One of theirs is down. The way is opening, Maharaj. |
| Marathi | त्यांचा एक योद्धा पडला. वाट मोकळी होते आहे, महाराज. |

**Verdict: approve the Director's line as written.** It fixes the real fault — the old line
reports the player's own formation, which says nothing the player does not already know. The new
one names what changed (a piece fell) and what it buys (the way opens), which is the
"short, concrete, a little awe" register. It is 8 words and reads in about 2.4 s at pace 1.15,
so it fits the clash beat.

One change I would make: keep it as two sentences, not three commas. `गिरा। रास्ता` lands
better than `गिरा, रास्ता` because the fall is the beat.

## 2. `astra_vayavya_enemy_1`

| | |
|---|---|
| now | उनकी तरफ़ हवा चली। उनके दो मोहरे जगह बदल चुके हैं। / Unki taraf hawa chali… |
| proposed | वायव्यास्त्र! दो मोहरे जगह बदल गए। जो पहचाना था, दोबारा परखिए। |
| Hinglish | Vayavyastra! Do mohre jagah badal gaye. Jo pehchana tha, dobara parakhiye. |
| English | They called the wind. Two pieces traded places — what you knew of them may be wrong now. |
| Marathi | वायव्यास्त्र! दोन मोहरे जागा बदलून गेले. जे ओळखले होते, ते पुन्हा तपासा. |

**Verdict: approve, with one trim.** The Director's draft opened with "उन्होंने वायव्यास्त्र
चलाया —", which is a report; opening with the weapon's name is the jolt the line needs, and it
brings the line from ~4.3 s to ~3.4 s at pace 1.15. The rest is kept exactly: "जो पहचाना था,
दोबारा परखिए" is the part that gives the wind weight — it tells the player their belief about
those two pieces is now suspect. `परखिए` is a shade literary on purpose; a narrator may use it.

Note for the Director: the English in the brief ("They called the wind…") is longer than the
Hindi. The recorded English should match the trimmed Hindi in length, so I suggest the English
above rather than the two-sentence version in the handoff.

## 3. Before re-recording batch 3.1 — one wording fix

Of the four lines waiting on a re-record, three are ready as they stand in
`docs/voice/sanjaya-lines.csv` (`start_tutorial_1`, `lose_capture_1`, `trap_defused_1`).
`start_abhimanyu_1` still has a construction I would not record twice:

| now | अभिमन्यु अंदर जाना जानता था। अब देखते हैं आप तोड़ के दिखाते हैं या नहीं। |
|---|---|
| record this | अभिमन्यु अंदर घुसना जानता था। अब देखते हैं, आप तोड़ पाते हैं या नहीं। |
| why | "अंदर जाना जानता था" stacks two verbs where one will do; "तोड़ के दिखाते हैं" is Hinglish word order with a stray के, and "दिखाते हैं" (show) is not the same act as breaking through. "तोड़ पाते हैं" says it. |

Optional, `lose_capture_1`: "वो दिखने से ज़्यादा ताक़तवर थे।" — one piece was taken, so the
singular is cleaner: "वह दिखने से ज़्यादा ताक़तवर था।" Only worth changing if the line is being
re-recorded anyway; it is not wrong as it stands.

## 4. Commands, once a key is present

```bash
# 3.1 — the four lines whose Hindi changed (after the start_abhimanyu_1 fix above)
SARVAM_API_KEY=... python3 tools/voice-gen.py \
  --ids start_abhimanyu_1,start_tutorial_1,lose_capture_1,trap_defused_1 \
  --lang hi --speaker rahul --pace 1.15

# 3.4 — the two rewritten lines, both languages, once the Commander says "approve"
SARVAM_API_KEY=... python3 tools/voice-gen.py \
  --ids win_capture_2,astra_vayavya_enemy_1 \
  --lang both --speaker rahul --pace 1.15
```

The Director updates `docs/voice/sanjaya-lines.csv` first; the generator reads that file.
