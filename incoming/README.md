# incoming/ — the drop zone

Put new files here and the Director (Claude) takes it from there: keeps your master, makes the
optimised copy for the game, wires it in, tests it on desktop and phone, and moves it into
`assets/`.

**How to upload on GitHub:** open this folder on github.com → **Add file** → **Upload files** →
drag the files in → write one line saying what they are → **Commit changes**. You can also just
attach them in the chat with Claude.

Use exactly the file names from the prompt packs — that is how the game finds them.

```
incoming/
  art/        astras/  portraits/  boards/  cards/  sky/  app/  store/  heroes/  editions/
              → names and sizes in docs/prompts/ART.md
  3d/         <piece>.glb / <piece>.stl     → docs/prompts/3D.md
  renders/    store and trailer renders     → docs/prompts/3D.md
  audio/      sfx/  music/  ui/             → docs/prompts/AUDIO.md
  voice/      hi/  en/  mr/                 → docs/prompts/VOICE.md
  text/       JSON, CSV and Markdown from ChatGPT and Sarvam AI
  i18n/       strings.hi.json, strings.mr.json
```

Easiest way to keep the sub-folders: on your computer make the same folders (for example
`art/astras/`), put the files inside, and drag the **whole folder** onto GitHub's upload page —
GitHub keeps the structure. Or just upload loose files here with the right names; the Director
sorts them.

The game does not use anything in this folder until the Director moves it into `assets/`, so
drafts are fine. The repository is public, though — never put anything private here.
