# VYUHA — instructions for every work session

Read this file before starting work, then read:

1. `docs/DIRECTOR.md` — Claude's design, rules, respect charter and integration instructions.
2. `docs/ROADMAP.md` — current owners and pending work.
3. Your brief: `docs/agents/CHATGPT.md` or `docs/agents/SARVAM.md`.
4. `docs/HANDOFF-2026-10-29.md` — the temporary takeover batch and next steps, until superseded.

The user is Commander and final authority. Claude is Director. ChatGPT and Sarvam AI are agents. Follow the Director's assignments within the Commander's instructions. The Commander authorised ChatGPT to take over part of development for two days starting 29 October 2026; this does not transfer final authority.

Keep code changes on a branch with a pull request for review. Avoid overwriting another session's work. Read the current branch head before writing. `main` serves the live game at <https://medh-eng.github.io/vyuha/>.

Before handing over code, run `node tests/rules.mjs`, `node tests/selfplay.mjs 40`, `node tests/daily.mjs`, `node tests/ui.mjs`, and the desktop/phone screenshot harness `node tools/shots.mjs`. Set `CHROMIUM_PATH` if Chromium is elsewhere. Rebuild `vyuha-standalone.html` with `node tools/build-standalone.mjs` when runtime files change. Report any check you could not complete.

Place draft art and writing at the exact paths in the brief under `incoming/`. Draft content is not a shipped feature. Do not claim a real-person playtest, native-language review, or device test unless it happened. No deity is a piece, target or capture; no pay-for-power or real-money mechanics.

After each task, report the changed behaviour or delivered files, checks performed, pull request/commit link, and remaining work. Update the handoff with enough detail for the next session to continue.
