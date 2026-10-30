# VYUHA asset verification — 30 October 2026

> **Commander handoff.** File-presence and code-reference audit of `main`
> (asset snapshot at `8d98cba52b3c1dcbf356c6f575707076a8057eed`,
> then rebased after PR #2 was merged into `e8e96744dc781c091ef1ac3140ea6d688d12df85`;
> PR #2 changed no media files). This replaces the
> dated 29 October **status** paragraphs in `docs/prompts/ART.md` and
> `docs/prompts/AUDIO.md`; keep the original prompts for production.
> Presence is not a physical-device visual test, licensed-use clearance, or
> proof that a file is used by a completed feature.

## Delivered, optimised

| Set | Shipped location | Count | Integration status |
|---|---|---:|---|
| Astra stills | `assets/art/opt/astras/{vayavya,sammohana,agneya,brahma}.webp` | 4 | `js/art.js` marks / shelf |
| Astra invocation animations | same directory, `*-anim.webp` | 4 | `js/stage.js` reference; **first-invocation preload test still needed** |
| Source Astra stills + GIFs | repository root, `{vayavya,sammohana,agneya,brahma}.{jpg,gif}` | 8 | Source copies, not needed at runtime |
| Ten unit art WebPs | `assets/art/opt/units/` | 10 | Board |
| Two faction crests | `assets/art/opt/factions/` | 2 | Hidden pieces |
| Four board surfaces | `assets/art/opt/boards/` | 4 | Board, including Padma |
| Sanjaya still portrait | `assets/art/opt/portraits/sanjaya.webp` | 1 | `sanjayaMark()` |
| Sanjaya animation | `assets/art/opt/portraits/sanjaya-anim.webp` | 1 | **Present but not yet displayed by runtime** |
| Gate breach still | `assets/art/opt/ui/breach.jpg` | 1 | `js/stage.js` (first-use visual check) |
| Day/night skies | `assets/art/opt/ui/{day,night}.jpg` | 2 | **Wrong loader path on old main**; corrected in this review PR |
| Daily card | `assets/art/opt/ui/daily.jpg` | 1 | Daily backdrop |
| App icon | `assets/art/opt/app/icon-512.png` | 1 | Manifest / Apple touch |
| Five hero portraits | `assets/art/opt/heroes/` | 5 | **Art done, Phase C hero gameplay not shipped** |
| Campaign map picture | `assets/art/opt/ui/map.jpg` | 1 | Seven-medallion image exists; **Phase C map interface not shipped** |
| Other Chapter II UI art | `assets/art/opt/ui/`, `assets/art/opt/cards/`, `assets/art/banners/` | many | Existing visuals; review each screen |
| Hindi Sanjaya voice | `assets/audio/voice/hi/*.mp3` | **44/44** | Runtime path + CSV IDs match |
| English Sanjaya voice | `assets/audio/voice/en/*.mp3` | **44/44** | Runtime path + CSV IDs match |
| Base music | `assets/audio/music/` | 5 | Menu, tabla, battle, victory, defeat |
| Recorded SFX | `assets/audio/sfx/` | **14** | All specified P1 cues except `trap.mp3`; some need trimming |

The animated Sanjaya WebP is **1.75 MB** (360×640, 30 frames), above the
earlier suggested 800 KB. Optimise selectively for home/results and honour
reduced-motion settings; do not request another character portrait yet.

## Deliverables still absent from `main`

**Commander — high priority**

1. `assets/audio/sfx/trap.mp3`: Shataghni impact, 0.8–1.2 seconds.
2. Play Store feature graphic: 1024×500, original prompt
   `incoming/art/store/feature.jpg`. There is already a generic hero
   background, but no distinct feature-graphic file at the requested path.
3. Custom WhatsApp/Open Graph image: 1200×630, original prompt
   `incoming/art/store/og.jpg`; this review PR corrects social metadata
   to use a **valid existing hero JPG** until the custom image arrives.
4. Six screenshots showing the real gameplay UI; 30-second edited trailer.
5. Additional original music per `docs/prompts/AUDIO.md`:
   `battle_night.mp3`, `daily_theme.mp3`, `lesson.mp3`,
   `abhimanyu.mp3`, `victory_big.mp3`. Optional extra tension loop
   and `trailer.mp3` for the final five rounds and launch video.
6. Record sound origins/usage rights in `incoming/audio/SOURCES.md`;
   the file is currently absent.

**Later / non-blocking**

- `ui_tap.mp3`, `ui_select.mp3`, `ui_back.mp3`,
  `turn_yours.mp3`: interface polish (synthesised fallback remains).
- Marathi Sanjaya (44 cues) after Hindi-native-speaker review and
  language-selector integration.
- The Madhubani, Pattachitra, Gond, and Warli cosmetic boards.
- Phase C hero cards, vows, and campaign logic despite their art being ready.

If a feature card or OG image was already uploaded **under a different name
or branch**, provide the exact GitHub path. This audit only confirms the
default branch at the SHA above.

## Effect duration QA — action required, no clip replaced by this PR

MP3 durations were read with `ffprobe`, compared against `docs/prompts/AUDIO.md`.
They are not perceptual/audio-content tests; a long clip might contain a
usable short transient. Trim only after listening and examining the waveform.

| Cue | File duration | Prompt target | Verdict |
|---|---:|---:|---|
| Conch (`shankh`) | 4.60 s | 1.8–2.5 s | Shorten |
| Gate breach | **8.18 s** | 1.0–1.4 s | Shorten |
| Dawn | 1.46 s | 2–3 s | Review decay / too short |
| Dusk | 4.01 s | 2–3 s | Shorten |
| Vayavyastra | 1.51 s | 1.4–1.8 s | In range |
| Sammohanastra | 3.12 s | 1.4–1.8 s | Shorten |
| Agneyastra | 5.59 s | 1.4–1.8 s | Shorten |
| Brahmastra | 4.66 s | 2–2.6 s | Shorten |
| Shakti diya | **11.34 s** | 0.4–0.7 s | Shorten substantially |
| Divya-drishti | 1.97 s | 0.8–1.2 s | Shorten |
| Shataghni trap | — | 0.8–1.2 s | Missing |

Before shipping, check dialogue intelligibility, relative loudness, no harsh
transients, loops, and source/licence records. Do not automatically publish
the unreviewed cuts.

## Small technical fixes in this PR

1. `js/art.js`: sky URL now points to the delivered
   `assets/art/opt/ui/day.jpg` and `night.jpg` instead of an
   absent `assets/art/opt/sky/` folder.
2. `index.html`: social preview uses an absolute Pages URL to
   existing `assets/art/opt/ui/hero.jpg`, with dimensions.
3. `tests/assets.mjs`: regression checks shipped art slots,
   preview metadata and every Hindi/English CSV voice cue (88 files).
4. Rebuild `vyuha-standalone.html` and update service-worker cache
   before merging because the HTML and runtime loader changed.

## What needs a human eye

- Open a fresh/incognito session and invoke each Astra **once** on a slow
  connection: its animated WebP should be there on the first use.
- Trigger gate breach once (it uses a lazy image probe); check the image
  appears on the first breach, not just in a later match.
- Confirm each sky actually appears behind the board after the loader fix.
- Check hero, Sanjaya, map and icon artwork in mobile crop and small sizes.
- Run 3–5 first-time human playtests and native-language/cultural review.

The spreadsheet handed to the Commander holds each deliverable, owner,
verified repo path, status and next action, plus a 44-row voice sheet and
recorded-duration sheet. It is a separate review artifact, not game code.
