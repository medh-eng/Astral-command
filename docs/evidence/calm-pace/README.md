# Calm pace — review evidence

[20-second MP4](calm-turn.mp4) · [GIF](calm-turn.gif) · [phase/audio timeline](timeline.json) · [handoff and checks](../../HANDOFF-2026-10-30-calm-pace.md)

390 × 844 Chromium phone viewport, real time, no skip taps, Calm selected, real effects and recorded Sanjaya enabled. The screen capture is **silent**; completion events are recorded in the timeline. A prepared opening clash is followed by the real Shakuni AI reply and the handover back to the player. No physical phone or human playtest is claimed.

Reproduce with `CHROMIUM_PATH=/path/to/chrome node tools/record-calm-turn.mjs`. Requires `ffmpeg` and `ffprobe` on PATH. The harness asserts a 20-second MP4 and verifies that narration follows the effect and thinking follows narration plus the breath.

The ordered sequence with full recorded clips exceeds the brief's approximate 4–5 second clash target; see the handoff for measured timing and the review decision needed.
