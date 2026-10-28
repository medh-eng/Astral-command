# Aetherfront — art brief & prompt pack

Everything below is ready to paste into ChatGPT or Gemini. Generate the images, save them
with the exact filenames, and drop them in `assets/art/…`. The game probes those paths at
boot and swaps them in — **no code changes needed**. Anything missing keeps its engraved
vector mark, so you can add art one piece at a time.

Two rules that matter more than any prompt:

1. **Pure black background (`#000000`), no shadow.** I key it to transparency and trim it.
   Generators are bad at "transparent", very good at "flat black".
2. **No text, letters or numbers in the image.** The rank plate is drawn by the game in its
   own font, in the right place, on every device.

---

## 0. Master style block

Paste this in front of every prompt (or send it once and then say *"same style as before"*).
Consistency across the ten pieces matters more than any single image being perfect.

> Board-game piece emblem, Indian temple-punk style: carved brass and dark obsidian stone,
> fine engraved line work, subtle gold inlay, deep indigo shadows. Flat frontal view,
> symmetrical, heraldic, high contrast, crisp silhouette that still reads at 32 px.
> No text, no letters, no numbers, no border, no frame, no drop shadow, no background
> scenery, no perspective. Subject centred, filling about 85% of the square.
> Background: pure flat black (#000000). Square 1:1.

---

## 1. Unit pieces — the ten that matter most

`assets/art/units/<file>.png` · **512 × 512** · square · black background

These sit on the board tokens. Keep them **faction-neutral brass and stone**: the game
already draws the saffron or indigo ring around each piece, so one set serves both armies
(ten images instead of twenty).

| Rank | Piece | File | Prompt subject |
|---|---|---|---|
| 10 | Senapati | `senapati.png` | A royal war-commander's crown above a radiant sun disc, resting on a stylised lotus base, twelve straight sun rays — engraved brass with gold inlay |
| 9 | Maharathi | `maharathi.png` | A great chariot wheel seen face-on with a vertical spear through its hub and a curved shield behind it, thick brass spokes, battle-worn edges |
| 7 | Ashvarohi | `ashvarohi.png` | A heraldic horse's head in profile wearing a small brass chamfron, two swept pennants behind, engraved speed lines suggesting a charge |
| 6 | Dhanurdhar | `dhanurdhar.png` | A drawn recurve bow with a nocked arrow, three arrows fanned behind it, a small quiver at the base |
| 5 | Divyadrishti | `divyadrishti.png` | An open almond-shaped eye with a lotus-petal iris, enclosed in a thin orbiting ring with three tiny stars |
| 3 | Yantrik | `yantrik.png` | A geared machine wheel with a spanner and a pair of brass dividers crossed behind it, rivets around the rim |
| 2 | Rath | `rath.png` | A light chariot wheel face-on with six spokes, two short horizontal speed lines either side, a small yoke pin at the top |
| 1 | Chara | `chara.png` | A curved katar punch-dagger pointing down, one coin balanced on its guard, a narrow half-closed eye above it |
| B | Shataghni | `shataghni.png` | A spiked iron mace-ball with eight short pyramidal spikes around a dark iron core, mounted on a low tripod |
| F | Durg | `durg.png` | A fortress gate: a crenellated wall segment with an arched double door, two small torch flames either side, a lotus carved above the arch |

**Tip for consistency:** generate all ten in one conversation, starting each with
"Same style, palette and framing as the previous emblem, now: …". If a set drifts, keep the
three you like and regenerate the rest with one of them attached as a style reference.

---

## 2. Faction crests

`assets/art/factions/<file>.png` · **512 × 512** · black background

| Faction | File | Prompt subject |
|---|---|---|
| Suryavansh | `suryavansh.png` | A sun crest: a round sun face with twelve flame-shaped rays and a small crown at the top, set on a dark shield silhouette, brass and gold |
| Chandravansh | `chandravansh.png` | A crescent moon crest holding a small lotus, three stars beside it, set on a dark shield silhouette, silver and pale indigo |

---

## 3. Board surfaces

`assets/art/boards/<file>.jpg` · **2048 × 2048** · no transparency, no black key needed

These sit *under* the cells at 42% opacity, so they must be **dark and low-contrast** —
if the texture has bright highlights the pieces stop reading.

| Board | File | Prompt |
|---|---|---|
| Chakravyuha (wheel) | `wheel.jpg` | Top-down carved stone mandala with twelve-fold radial symmetry, concentric rings, faint kolam dot grid, aged dark granite with thin brass inlay lines, very low contrast, even lighting, no text, no pieces |
| Small Arena | `small.jpg` | Top-down aged dark stone floor, faint engraved square grid, a thin brass border line, subtle cracks, very low contrast |
| Large Expanse | `large.jpg` | Top-down dark slate floor with a faint engraved grid and scattered fine brass filings, very low contrast, even lighting |

---

## 4. Scene art (the big win for "looks like a real game")

`assets/art/ui/…` · **1536 × 768** (2:1) · full colour, no transparency

| Slot | File | Prompt |
|---|---|---|
| Combat backdrop | `combat.jpg` | Wide cinematic: two carved brass armies silhouetted facing each other across a dark stone chakra board, embers and dust in the air, dramatic rim light from the left, deep indigo shadows, no text, no faces |
| Victory | `victory.jpg` | A brass sun-crest banner rising over a shattered obsidian wheel, gold embers drifting, warm triumphant light, no text |
| Defeat | `defeat.jpg` | An obsidian wheel closing inward, scattered brass pieces on dark stone, cold indigo fog, dim moonlight, no text |
| Access hero (optional) | `hero.jpg` | A colossal stone chakravyuha wheel floating above a temple courtyard at dusk, torches below, indigo sky, brass inlay glowing, cinematic, no text, 16:9 |

`combat.jpg` appears behind the combat-result dialog, `victory.jpg` / `defeat.jpg` behind the
end-of-match dialog, and `hero.jpg` replaces the artwork on the sign-in screen.

---

## 5. App icon

`assets/art/app/icon-1024.png` · **1024 × 1024**

> App icon on a rounded square, deep indigo background, a brass chakra crystal with twelve
> spokes and a small gold centre, flat vector, subtle inner glow, no text.

---

## Checklist

```
assets/art/units/senapati.png      512²  black bg
assets/art/units/maharathi.png     512²  black bg
assets/art/units/ashvarohi.png     512²  black bg
assets/art/units/dhanurdhar.png    512²  black bg
assets/art/units/divyadrishti.png  512²  black bg
assets/art/units/yantrik.png       512²  black bg
assets/art/units/rath.png          512²  black bg
assets/art/units/chara.png         512²  black bg
assets/art/units/shataghni.png     512²  black bg
assets/art/units/durg.png          512²  black bg
assets/art/factions/suryavansh.png   512²  black bg
assets/art/factions/chandravansh.png 512²  black bg
assets/art/boards/wheel.jpg        2048²  dark, low contrast
assets/art/boards/small.jpg        2048²  dark, low contrast
assets/art/boards/large.jpg        2048²  dark, low contrast
assets/art/ui/combat.jpg           1536×768
assets/art/ui/victory.jpg          1536×768
assets/art/ui/defeat.jpg           1536×768
assets/art/ui/hero.jpg             1920×1080
assets/art/app/icon-1024.png       1024²
```

## The processing pass (already applied to this set)

Your masters stay in `assets/art/units|factions|boards|ui|app` exactly as uploaded.
The game loads an optimised copy from `assets/art/opt/…`, produced like this:

- generator watermark in the bottom-right corner cleared
- near-black background flood-filled to transparency (only the *connected* background,
  so dark panels inside a piece stay solid)
- trimmed to the subject, re-padded to a square, resized (units 320 px, crests 192 px)
- units and crests → WebP (24–50 KB each), boards 1024 px JPEG, scenes 1280 px JPEG

Whole set: **1.7 MB** instead of 90 MB, and boards and scenes load lazily — the first
paint only pulls the ten pieces and two crests (~450 KB).

## What I do once you upload

- key the black background to alpha, trim to the subject, re-pad to a square, resize to spec
- check the ten pieces at 32 px and re-export any that lose their silhouette
- wire them in, screenshot the board on desktop and phone, and adjust opacity/contrast of the
  board textures so the pieces still read
- keep the vector marks as the fallback, so the game never looks broken if an image is missing

Send them in any order — even three at a time is useful. The Senapati, the Durg (fort), the
Shataghni (trap) and the two faction crests change the look the most, so start there if you
want an early preview.

---

## 6. Faction banners

`assets/art/banners/…` · **generate 16:9, opaque** — cropped to 600×140 for the player strips

Most models will not produce a 4.3:1 banner, so generate 16:9 and keep every ornament inside
the central horizontal band. The right half must stay dark and quiet: the strip prints the
faction name, the alive count and the capture tray over it at 11 px.

**Master style:** Indian temple-punk game UI art: carved brass and dark obsidian stone, fine
engraved line work, subtle gold inlay, deep indigo shadows, heraldic, high contrast.
No text, no letters, no numbers, no faces, no watermark.

| Faction | File | Prompt |
|---|---|---|
| Suryavansh | `suryavansh.png` | Ultra-wide horizontal banner for a game player-nameplate, full-bleed, opaque. One large heraldic emblem at the LEFT edge, about 22% of the frame — a radiant sun disc with twelve flame-shaped rays and a small crown, brass and gold, warm saffron highlights. From it a long horizontal ornamental rule runs right: thin brass line work with small repeating lotus motifs, fading into near-black at the right edge. Middle and right stay dark and low-contrast so white text can sit on top. All ornament inside the central 60% of the height. Even lighting, flat, no perspective. |
| Chandravansh | `chandravansh.png` | Same composition and ornament rhythm, mirrored palette: a crescent moon cradling a small lotus with three stars, silver and pale indigo, cool highlights; thin silver line work with repeating star and lotus motifs fading to near-black. |

---

## 7. Scenario cards

`assets/art/cards/…` · **1536 × 864** (16:9), shown at 800×450 in the setup screen

The bottom third must stay dark: the mode name and its Devanagari subtitle are laid over it
(द्वंद्व / अभिमन्यु), so nothing in the art should compete there.

| Mode | File | Prompt |
|---|---|---|
| Duel | `duel.jpg` | Game-mode card artwork, cinematic, Indian temple-punk: two armies of small heraldic pieces face each other across a dark stone chakra board seen from a low three-quarter angle — brass on the left, silver-indigo on the right, both in neat rows, the spokes faintly glowing gold between them. Embers and dust, rim light from the left, deep shadow across the bottom third. No text, no faces. |
| Abhimanyu | `abhimanyu.jpg` | A single brass piece advancing into a narrowing corridor of dark indigo pieces arranged as a closing wheel; the twelve spokes glow faint gold and press inward. Cold light from above, one warm light on the lone piece, dust and embers, a strong sense of being surrounded. Deep shadow across the bottom third. Symbolic and heraldic — no people, no faces. |
| Sarvatobhadra (optional) | `sarvatobhadra.jpg` | An eight-by-eight grid of carved stone tiles seen from directly above, brass pieces massed along the top and bottom edges, a faint glowing square border, low warm light, dust in the air. No text. |

```
assets/art/banners/suryavansh.png      16:9, opaque
assets/art/banners/chandravansh.png    16:9, opaque
assets/art/cards/duel.jpg              1536×864
assets/art/cards/abhimanyu.jpg         1536×864
assets/art/cards/sarvatobhadra.jpg     optional
```
