/* Record a real-time Calm turn at 390×844, using the shipped UI and real audio
 * files. The fixture puts a Yantrik in reach for a repeatable opening clash.
 * CHROMIUM_PATH=/path/to/chrome node tools/record-calm-turn.mjs [outDir]
 * A silent screen recording plus an audio/phase timeline; no timing is scaled.
 */
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = process.argv[2] || path.join(root, 'docs/evidence/calm-pace');
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);
let browser;
const errors = [];
try {
  browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/local/bin/chromium', headless: 'shell',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:' + server.address().port + '/index.html');
  await page.waitForSelector('#boot', { hidden: true });
  await page.tap('#btn-new-match'); // trusted gesture unlocks the real audio engine
  const action = await page.evaluate(() => {
    AC.ui.patchSettings({ pace: 'calm', narratorLang: 'en', stories: false, narrator: true, voice: true, cinematics: true });
    const E = AC.engine;
    const st = E.newState({ mode: 'ai', board: 'wheel', difficulty: 'archon' });
    E.deployPreset(st, 1, 'citadel'); E.deployPreset(st, 2, 'citadel');
    E.beginBattle(st);
    const action = E.allLegalActions(st, 1).find((a) => a.type === 'move' && !st.board[a.to] && st.board[a.from].rank >= 5);
    if (!action) throw new Error('No suitable opening move');
    const victim = Object.keys(st.board).find((id) => st.board[id] && st.board[id].owner === 2 && st.board[id].key === '3');
    st.board[action.to] = st.board[victim]; st.board[victim] = null;
    AC.game.startPrepared(st, { save: false });
    window.calmEvidence = { viewport: { width: innerWidth, height: innerHeight }, pace: AC.app.settings.pace, events: [] };
    const t0 = performance.now();
    const note = (kind, data = {}) => window.calmEvidence.events.push({ ms: Math.round(performance.now() - t0), kind, ...data });
    let phase = null;
    Object.defineProperty(AC.game, 'paceStep', { configurable: true, get: () => phase, set: (s) => { phase = s; note('phase', { step: s }); } });
    const cue = AC.audio.cue;
    AC.audio.cue = function (name) { const c = cue(name); note('effect-start', { name, duration: c.duration }); c.finished.then(() => note('effect-end', { name })); return c; };
    const say = AC.sanjaya.say;
    AC.sanjaya.say = function (key, opts) { note('voice-start', { key }); const p = say(key, opts); p.then(() => note('voice-end', { key })); return p; };
    return action;
  });
  // Let assets and decoded effects finish loading before recording, without
  // cutting or accelerating any part of the turn itself.
  await new Promise((r) => setTimeout(r, 1800));
  await page.screenshot({ path: path.join(out, 'phone-before.png') });
  const recorder = await page.screencast({ path: path.join(out, 'calm-turn.webm'), fps: 25, ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg' });
  const began = Date.now();
  await new Promise((r) => setTimeout(r, 700));
  const tapCell = async (id) => {
    const handle = await page.$('#board .cell[data-id="' + id + '"]');
    const box = await handle.boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  };
  await tapCell(action.from); await tapCell(action.to); await tapCell(action.to);
  await page.waitForFunction(() => AC.game.paceStep === 'moment');
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(out, 'phone-clash.png') });
  await page.waitForFunction(() => !AC.game.busy && !AC.game.thinking && AC.game.state.owner === 1 && AC.game.state.stats.actions >= 2, { timeout: 45000 });
  const evidence = await page.evaluate(() => window.calmEvidence);
  evidence.recording = { kind: 'silent screen recording', realTime: true, durationMs: Math.max(20000, Date.now() - began), action };
  await page.screenshot({ path: path.join(out, 'phone-after.png') });
  await new Promise((r) => setTimeout(r, Math.max(0, 20000 - (Date.now() - began))));
  await recorder.stop();
  const encoded = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-y', '-i', path.join(out, 'calm-turn.webm'), '-vf', 'tpad=stop_mode=clone:stop_duration=1', '-t', '20', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', path.join(out, 'calm-turn.mp4')]);
  assert.equal(encoded.status, 0, encoded.stderr.toString());
  fs.unlinkSync(path.join(out, 'calm-turn.webm'));
  const gif = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-y', '-i', path.join(out, 'calm-turn.mp4'), '-vf', 'fps=5,scale=195:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse', '-loop', '0', path.join(out, 'calm-turn.gif')]);
  assert.equal(gif.status, 0, gif.stderr.toString());
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', path.join(out, 'calm-turn.mp4')]);
  assert.equal(probe.status, 0, probe.stderr.toString());
  assert.equal(+JSON.parse(probe.stdout).format.duration, 20, 'recording is exactly 20 seconds');
  assert.equal(errors.length, 0, errors.join('\n'));
  let effectEnd = 0, voiceEnd = 0;
  for (const e of evidence.events) {
    if (e.kind === 'effect-end') effectEnd = e.ms;
    if (e.kind === 'voice-start') assert.ok(e.ms >= effectEnd, 'voice before effect ended');
    if (e.kind === 'voice-end') voiceEnd = e.ms;
    if (e.kind === 'phase' && e.step === 'thinking') assert.ok(e.ms >= voiceEnd + 390, 'AI before voice + breath');
  }
  fs.writeFileSync(path.join(out, 'timeline.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
  console.log('Recorded one Calm turn; no runtime errors, no skipped steps.');
} finally {
  if (browser) await browser.close();
  server.close();
}
