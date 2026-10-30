# VYUHA — art prompt pack (Chapter III)

Ready to paste into **ChatGPT (image generation)** or **Gemini**. Make the image, save it with
the exact file name, and put it in the repo's `incoming/art/` folder (or attach it in chat).
The Director keys the background, trims, resizes, makes the optimised copy, wires it in and
checks it on a phone. Anything missing keeps its vector stand-in, so art can arrive one piece
at a time.

The Chapter II pack (ten pieces, two crests, three boards, scene art, banners, scenario cards)
is in [`docs/art-brief.md`](../art-brief.md) and is already in the game.

## Three rules that matter more than any prompt

1. **Pure flat black background (`#000000`)** for anything that sits on the board or a button.
   Generators are bad at "transparent" and very good at "flat black".
2. **No text, letters or numbers inside the image.** The game prints names and ranks itself, in
   the right font, on every device.
3. **No deity, no face of a god, no temple idol.** Astras are shown as their element — wind,
   trance, fire, light. Warriors (Phase C) are human heroes of the epic, drawn with dignity.

Do not imitate any living artist, comic (e.g. Amar Chitra Katha), film or TV look. Traditional
folk styles (Pattachitra, Madhubani, Gond, Warli, Kalamkari, Kangra miniature) are welcome — they
belong to everyone.

## Master style block

Paste this before every prompt in this pack (or send it once and then say *"same style"*):

> Indian temple-punk game art: carved brass and dark obsidian stone, fine engraved line work,
> subtle gold inlay, deep indigo shadows, warm lamp light. Heraldic, symmetrical, high contrast,
> crisp silhouette that still reads at 32 pixels. No text, no letters, no numbers, no watermark,
> no border, no frame.

---

## Priority 1 — makes Chapter III look finished

### 1. The four astra emblems

`incoming/art/astras/<file>.png` · **1024 × 1024** · flat black background · one emblem centred,
filling about 80% of the square. Shown on the astra buttons (≈24 px) and huge on the invocation
screen (≈90 px), so the silhouette must be bold.

| File | Prompt (after the style block) |
|---|---|
| `vayavya.png` | Emblem of the wind weapon: three swirling ribbons of wind spiralling out of a small brass disc, engraved air currents, pale sky-blue and silver highlights on brass, motion lines, no figure. |
| `sammohana.png` | Emblem of the trance weapon: a hypnotic spiral of engraved violet light coiling inward around a tiny closed lotus, concentric rings like ripples, violet and moonstone on dark brass, no figure, no eye. |
| `agneya.png` | Emblem of the fire weapon: a tall stylised flame of engraved brass with a bright saffron-orange core, three smaller tongues of fire curling out, embers rising, no figure. |
| `brahma.png` | Emblem of the ultimate weapon: a radiant eight-pointed burst of white-gold light around a small bindu (dot) at the centre, thin rays reaching to the edges, a faint ring of lotus petals, blinding but elegant, no figure, no face. |

**Check before sending:** all four side by side look like one set; each reads as its element at
thumbnail size; nothing looks like a person or a god.

### 2. Sanjaya's portrait

`incoming/art/portraits/sanjaya.png` · **1024 × 1024** · flat black background.
Shown in a small circle beside every line he speaks, and on the home screen.

> Portrait of Sanjaya, the court narrator of the Mahabharata who was granted divine sight: a
> calm, kind man in his fifties with a short grey beard, a simple saffron-and-cream shawl, a
> thin gold tilak, eyes half-closed as if seeing something far away, a soft glow of light around
> his eyes, chest-up, facing slightly left, painted in the temple-punk style with brass
> highlights, dark background. Dignified, warm, storyteller. Not a deity, no halo, no crown.

**Check:** the face reads when cropped to a 34 px circle; no crown or halo.

### 3. The Padmavyuha board surface

`incoming/art/boards/padma.jpg` · **2048 × 2048** · no transparency needed.
Sits under the hexagonal cells at 34% opacity, so it must be **dark and low-contrast**.

> Top-down carved dark granite floor with a faint six-petalled lotus mandala, hexagonal
> engraved grid lines radiating from a small centre, thin brass inlay, very low contrast, even
> lighting, no bright highlights, no text, no pieces.

### 4. The Daily Chakravyuha card

`incoming/art/cards/daily.jpg` · **1536 × 864** (16:9). Shown behind the daily briefing.
The **bottom third must stay dark** — text sits there.

> Cinematic game card: a vast stone chakravyuha wheel seen from a low angle at dawn, its rings
> half-turned, saffron sunrise light cutting through the spokes, a single small brass chariot
> piece at the outer edge facing in, dust and embers, deep indigo shadow across the bottom
> third. Heroic, hopeful, a puzzle waiting. No people, no text.

### 5. Day and night skies behind the field

`incoming/art/sky/day.jpg` and `incoming/art/sky/night.jpg` · **1920 × 1080**.
They sit behind the board and are darkened by the game, so keep them **soft and dark at the
edges, with no detail in the centre** (the board covers it).

| File | Prompt |
|---|---|
| `day.jpg` | Wide atmospheric sky at sunrise over a dark plain: warm saffron and gold glow low on the horizon, faint sun rays from the top centre, soft haze, the centre of the image empty and dark, painterly, no buildings, no people, no text. |
| `night.jpg` | Wide atmospheric night sky over a dark plain: deep indigo, a thin crescent moon high on the right, scattered faint stars, a soft silver glow on the horizon, the centre of the image empty and dark, painterly, no buildings, no people, no text. |

---

## Priority 2 — the store and the share

### 6. App icon (refresh)

`incoming/art/app/icon-1024.png` · **1024 × 1024**.

> App icon, rounded square: a brass chakra wheel with twelve spokes seen face-on, a glowing
> saffron bindu at the centre, a thin ring of lotus petals around it, deep indigo background
> with a subtle radial glow, flat and bold, readable at 48 px, no text.

### 7. Play Store feature graphic

`incoming/art/store/feature.jpg` · **1024 × 500**. The left 40% stays dark for the title the
Director adds in the game's own font.

> Wide cinematic banner: on the right, a colossal stone chakravyuha wheel turning in the sky,
> brass inlay glowing; below it two armies of small brass and silver pieces facing each other;
> saffron dawn light from the right, indigo night from the left meeting in the middle; the left
> 40% of the frame dark and empty. No text, no faces.

### 8. Share preview image

`incoming/art/store/og.jpg` · **1200 × 630**. Shown when someone pastes the game's link in
WhatsApp. Same look as the feature graphic, centred composition, the middle-left area dark for
the title.

---

## Priority 3 — Phase C heroes (warriors, never deities)

`incoming/art/heroes/<file>.png` · **1024 × 1024** · flat black background · chest-up portraits,
same lighting and framing for all five so they read as a set. Each is a human warrior of the
epic, painted with dignity in the temple-punk style.

| File | Prompt subject |
|---|---|
| `arjuna.png` | A young archer-prince, focused eyes, a great bow (Gandiva) held across the shoulder, a quiver of arrows, light armour with brass details. |
| `karna.png` | A proud warrior with radiant golden armour and earrings (kavach and kundal) glowing softly, a calm, sorrowful face. |
| `bhima.png` | A massive, cheerful strongman with a heavy mace on his shoulder, broad chest, simple armour, a grin. |
| `ghatotkacha.png` | A towering half-rakshasa warrior at night, wild hair, kind eyes, dark armour edged with silver, moonlight behind him. |
| `abhimanyu.png` | A brave teenage warrior in a chariot-rider's armour, a broken chariot wheel held as a shield, determined, dust and sunrise behind. |

### Four more portraits — the profile avatars (30 Oct)

The profile hub offers ten avatars. Six are painted (the five heroes above and Sanjaya); these
four still show a carved sigil until their art lands. **Same framing, lighting and black
background as the five heroes**, so all ten read as one set in a circle 46–76 px wide: keep the
face in the upper-middle third and fill the frame chest-up.

`incoming/art/heroes/<file>.png` · **1024 × 1024** · flat black background.

| File | Prompt subject |
|---|---|
| `drona.png` | An elderly teacher-warrior, white beard and topknot, a calm stern face, a bow resting on one shoulder, plain brass-edged armour over a scholar's shawl. |
| `bhishma.png` | A towering grandsire-warrior, long white hair and beard, a silver breastplate, a quiet unbending gaze; dignity and age, not anger. |
| `draupadi.png` | A queen of the Pandavas: strong, composed, dark eyes, long open hair, a deep red and gold sari with a brass-work border, jewellery restrained; regal, never ornamental. |
| `dhrishtadyumna.png` | A young commander born of fire: lean, alert, short beard, a sword held upright before the chest, armour edged with ember-orange light. |

The Director keys the black, crops to a square, and saves `assets/art/opt/heroes/<file>.webp`
at 512 px. The hub then shows the painting instead of the sigil, with no code change.

---

## Priority 4 — folk-art editions (cosmetic, later)

One test board per style first, so we can see which one players love.

`incoming/art/editions/<style>-board.jpg` · **2048 × 2048** · dark enough for pieces to read.

| File | Prompt |
|---|---|
| `madhubani-board.jpg` | Top-down circular wheel board in Madhubani painting style: double black outlines, fish, peacocks and lotus motifs filling twelve sectors, natural pigments on handmade paper, deep red, indigo and turmeric yellow, muted so pieces stay readable. |
| `pattachitra-board.jpg` | Top-down circular wheel board in Odisha Pattachitra style: ornate border of floral bands, twelve sectors with chariot and horse motifs, cloth texture, red, ochre, black and white, muted for readability. |
| `gond-board.jpg` | Top-down circular wheel board in Gond art style: dots and dashes filling trees, birds and deer across twelve sectors, deep night background, bright but muted colours. |
| `warli-board.jpg` | Top-down circular wheel board in Warli style: white stick-figure motifs (dancers, harvest, animals) on red-brown earth, twelve sectors, a sun at the centre. |

---

## Hand-off checklist

```
incoming/art/astras/vayavya.png       1024²  black bg   P1
incoming/art/astras/sammohana.png     1024²  black bg   P1
incoming/art/astras/agneya.png        1024²  black bg   P1
incoming/art/astras/brahma.png        1024²  black bg   P1
incoming/art/portraits/sanjaya.png    1024²  black bg   P1
incoming/art/boards/padma.jpg         2048²  dark       P1
incoming/art/cards/daily.jpg          1536×864          P1
incoming/art/sky/day.jpg              1920×1080 dark    P1
incoming/art/sky/night.jpg            1920×1080 dark    P1
incoming/art/app/icon-1024.png        1024²             P2
incoming/art/store/feature.jpg        1024×500          P2
incoming/art/store/og.jpg             1200×630          P2
incoming/art/heroes/*.png             1024²  black bg   P3
incoming/art/editions/*-board.jpg     2048²             P4
```

## Tips that save credits

- Generate all four astras in **one conversation**, starting each with *"Same style, palette and
  framing as the previous emblem, now: …"*. Keep the one you like best and attach it as a
  reference for the others.
- If a picture comes back with text in it, ask: *"Same image, remove every letter and number."*
- Square, centred, black background, no frame — say it every time; generators forget.

---

# STATUS — what is done, what is still needed

> Updated 29 Oct 2026 by Sarvam AI (agent). **This section is the checklist — if it is not
> ticked here, it is not in the game.**

## Delivered ✅

| Asset | Where it lives | Notes |
|---|---|---|
| 10 unit pieces | `assets/art/opt/units/*.webp` | keyed, 320 px, 24–50 KB each |
| 2 faction crests | `assets/art/opt/factions/*.webp` | used as piece-backs on hidden enemy pieces |
| 2 faction banners | `assets/art/banners/*.jpg` | 600×140 nameplates on the player strips |
| 3 board surfaces | `assets/art/opt/boards/{wheel,small,large}.jpg` | applied per cell as a stone pattern |
| **Padmavyuha board** | `assets/art/opt/boards/padma.jpg` | new — hex field surface |
| **Day / night skies** | `assets/art/opt/ui/day.jpg`, `night.jpg` | new — sky for Surya/Chandra hours |
| **Sanjaya portrait** | `assets/art/opt/ui/sanjaya.jpg` | new — 420 px, for the narration bar |
| **Daily card** | `assets/art/opt/ui/daily.jpg` | new — share card backdrop |
| **Arena courtyard** | `assets/art/opt/ui/arena.jpg` | new — maze courtyard, held for the board backdrop |
| **Astra stills + animations** | `assets/art/opt/astras/*.webp` | 4 stills (4–6 KB) + 4 loops (646 KB–1 MB) |
| Combat / victory / defeat / hero | `assets/art/opt/ui/*.jpg` | dialog backdrops, access screen |
| App icon | `assets/art/opt/app/icon-512.png` | manifest + apple-touch |
| Masters | `masters/` | compressed to 1024–1280 px, 133 MB → 28 MB |

## Pending ⏳

| # | What | Who | Prompt / note |
|---|---|---|---|
| ~~1~~ | ~~Astra emblems ×4~~ **DONE** | — | `assets/art/opt/astras/<key>.webp` — still first frame, 4–6 KB, used on the shelf and badges |
| ~~2~~ | ~~Astra full-screen art ×4~~ **DONE** | — | `assets/art/opt/astras/<key>-anim.webp` — 30-frame loop, 640 px, played on the astra beat |
| 3 | **Sanjaya loop** — still wanted | Commander | The supplied gif (3.3 MB) is archived in `masters/`. A 1–1.5 s loop under 800 KB lets him move on the opening and the result screen; during play he stays as the still portrait. |
| 4 | **Gate breach still** | Commander | 1080×1920, the fort gate cracking — the other big moment. |
| ~~5~~ | ~~Hero portraits ×5~~ **DONE** | — | `assets/art/opt/heroes/*.webp`; they are also profile avatars now |
| 5b | **Avatar portraits ×4** — Drona, Bhishma, Draupadi, Dhrishtadyumna | ChatGPT | See *Four more portraits* above. Until they land, the hub shows sigils. |
| 6 | Campaign map of the seven vyuhas | Commander | 3:2 parchment, seven brass medallions. |
| 7 | Store art (icon, feature graphic, 6 screenshots, 30 s trailer) | Commander | Phase E. |

## Sound and voice — delivered ✅

- 88 voice lines (44 Hindi, 44 English) in `assets/audio/voice/` — Bulbul v3, speaker `ashutosh`.
- Music: menu, tabla, battle, victory, defeat — `assets/audio/music/`.
- Effects: clash, volley, chakra turn, piece place, shankh, gate breach, dawn, dusk,
  four astra stingers, divya-drishti, shakti diya — `assets/audio/sfx/`.

## Sound and voice — pending ⏳

- Marathi voice set (after the Hindi review).
- Tension loop for the last five rounds of a scenario.
