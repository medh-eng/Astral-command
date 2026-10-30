/* Idle-cost probe: how much work the page does while the player is only looking.
 * A phone heats up when the browser keeps painting even though nothing changed.
 *   node tools/perf-idle.mjs            (serves the repo on a local port)
 * Reports, per screen, the main-thread busy time and the paint count over 4 s of
 * idle on a 390×844 phone viewport with 4× CPU throttling.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(require('node:child_process').execSync('npm root -g').toString().trim() + '/playwright')); }
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const base = 'http://127.0.0.1:' + server.address().port + '/';

const browser = await chromium.launch({ args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const cdp = await ctx.newCDPSession(page);
await cdp.send('Performance.enable');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

async function measure(label, ms = 4000) {
  await page.waitForTimeout(800);
  const chunks = [];
  cdp.on('Tracing.dataCollected', (d) => chunks.push(...d.value));
  const before = await cdp.send('Performance.getMetrics');
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline.frame', transferMode: 'ReportEvents' });
  await page.waitForTimeout(ms);
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.end');
  await done;
  cdp.removeAllListeners('Tracing.dataCollected');
  const after = await cdp.send('Performance.getMetrics');
  const m = (s, k) => (s.metrics.find((x) => x.name === k) || {}).value || 0;
  const busy = (m(after, 'TaskDuration') - m(before, 'TaskDuration')) * 1000;
  const paints = chunks.filter((e) => e.name === 'Paint').length;
  const frames = chunks.filter((e) => e.name === 'DrawFrame' || e.name === 'BeginMainThreadFrame').length;
  const by = {};
  chunks.filter((e) => e.ph === 'X' && e.dur).forEach((e) => { by[e.name] = (by[e.name] || 0) + e.dur / 1000; });
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ':' + v.toFixed(0));
  const row = { screen: label, busyPct: +(busy / ms * 100).toFixed(1), paints, frames };
  if (process.env.DETAIL) {
    row.top = top;
    row.anims = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').map((a) => {
      const t = a.effect && a.effect.target; const n = t ? (t.id ? '#' + t.id : (typeof t.className === 'string' ? t.className : (t.className && t.className.baseVal) || t.tagName)) : '?';
      return (a.animationName || 'anim') + '@' + String(n).slice(0, 40) + (a.effect && a.effect.pseudoElement ? a.effect.pseudoElement : '');
    }));
  }
  console.log(JSON.stringify(row));
  return row;
}

await page.goto(base + 'index.html');
await page.evaluate(() => { localStorage.clear(); });
await page.reload();
await page.waitForSelector('#screen-home:not([hidden])');
await page.waitForSelector('#boot', { state: 'hidden' });
const rows = [];
rows.push(await measure('home'));
await page.evaluate(() => AC.app.modals && AC.app.modals.slice().forEach((m) => m.close()));
await page.click('#btn-new-match');
await page.waitForSelector('#screen-setup:not([hidden])');
await page.click('#btn-start-match');
await page.evaluate(() => AC.app.modals.slice().forEach((m) => m.close()));
await page.click('#action-bar [data-deploy="lock"]');
await page.waitForFunction(() => AC.game.state && AC.game.state.phase === 'battle');
await page.evaluate(() => AC.app.modals.slice().forEach((m) => m.close()));
await page.waitForFunction(() => !AC.game.aiBusy && AC.game.state.turn === 1, null, { timeout: 30000 }).catch(() => {});
rows.push(await measure('battle-idle'));
// select a piece to arm odds/pulses
await page.evaluate(() => {
  const s = AC.game.state; const id = Object.keys(s.board).find((c) => s.board[c] && s.board[c].owner === 1 && s.board[c].rank !== 'F' && s.board[c].rank !== 'B');
  const el = document.querySelector('#board [data-cell="' + id + '"]'); if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
rows.push(await measure('battle-selected'));
// mid-battle look: lamps lit, an astra ready, a last move, a cracked gate, late-game tension
await page.evaluate(() => {
  const st = AC.game.state; st.shakti = { 1: 5, 2: 3 };
  const mine = Object.keys(st.board).filter((c) => st.board[c] && st.board[c].owner === 1);
  st.lastMove = { from: mine[0], to: mine[0], type: 'move' };
  const fort = Object.keys(st.board).find((c) => st.board[c] && st.board[c].rank === 'F' && st.board[c].owner === 1);
  if (fort) st.board[fort].breached = true;
  st.round = Math.max(st.round, 24);
  AC.game.render();
  const shell = document.getElementById('board-shell'); if (shell) shell.classList.add('tension');
});
await page.waitForTimeout(4500);
rows.push(await measure('battle-mid'));
const renderMs = await page.evaluate(() => { const t = performance.now(); for (let i = 0; i < 10; i++) { AC.game.render(); document.body.offsetHeight; } return (performance.now() - t) / 10; });
console.log(JSON.stringify({ renderMsPerCall_4xThrottle: +renderMs.toFixed(1) }));
if (errors.length) console.log('errors:', errors);
await browser.close(); server.close();
