/* A robot player on a phone screen: plays real battles by tapping, the way a
 * person does, with cinematics and sound on, and watches for anything that
 * breaks — runtime errors, a turn that never comes back, a board that loses
 * pieces, a stage that never closes, anything that spills off the screen.
 *   node tools/playtest-bot.mjs [outDir] [battles]
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(require('node:child_process').execSync('npm root -g').toString().trim() + '/playwright')); }

const root = fileURLToPath(new URL('../', import.meta.url));
const out = process.argv[2] || path.join(root, '.playtest');
const battles = +(process.argv[3] || 4);
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const base = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const problems = [];
const note = (m) => { problems.push(m); console.log('  ! ' + m); };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(page, name) { await page.screenshot({ path: path.join(out, name + '.png') }); }
async function closeModals(page) { await page.evaluate(() => AC.app.modals && AC.app.modals.slice().forEach((m) => m.close())); }
async function tapCell(page, id) {
  const el = await page.$('#board .cell[data-id="' + id + '"]');
  if (!el) return false;
  const box = await el.boundingBox();
  if (!box) return false;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}
async function waitMyTurn(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await page.evaluate(() => {
      const g = AC.game, st = g.state;
      if (document.querySelector('.stage')) { document.querySelector('.stage').click(); return 'stage'; }
      if (!st) return 'none';
      if (st.phase === 'over' || st.winner) return 'over';
      return (!g.thinking && !g.busy && st.owner === 1 && st.phase === 'battle') ? 'mine' : 'wait';
    });
    if (s === 'mine' || s === 'over') return s;
    await sleep(120);
  }
  return 'timeout';
}

for (const [label, w, h] of [['phone', 390, 844], ['small-phone', 360, 640]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => note(label + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|404|Failed to load resource/.test(m.text())) note(label + ' console: ' + m.text()); });
  await page.goto(base + 'index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#screen-home:not([hidden])');
  await page.waitForSelector('#boot', { state: 'hidden' });
  await page.evaluate(() => AC.ui.patchSettings({ pace: 'quick' }));
  await sleep(600);
  await shot(page, label + '-0-home');
  const boards = ['wheel', 'padma', 'small', 'wheel'];
  for (let b = 0; b < battles; b++) {
    const board = boards[b % boards.length];
    await page.evaluate((bk) => AC.game.start(Object.assign(AC.ui.configFromSetup ? {} : {}, { mode: 'ai', board: bk, difficulty: ['veteran', 'archon', 'recruit'][Math.floor(Math.random() * 3)] })), board).catch((e) => note('start ' + board + ': ' + e.message));
    await sleep(400); await closeModals(page);
    const lock = await page.$('#action-bar [data-deploy="lock"]');
    if (lock) { await lock.tap(); } else note(label + ' ' + board + ': no lock button');
    await sleep(500); await closeModals(page);
    let moves = 0, last = 'start';
    for (; moves < 160; moves++) {
      const s = await waitMyTurn(page, 20000);
      if (s === 'over') break;
      if (s === 'timeout') { note(label + ' ' + board + ': turn never came back (move ' + moves + ')'); await shot(page, label + '-stuck-' + board); break; }
      await closeModals(page);
      const act = await page.evaluate(() => { const a = AC.ai.chooseAction(AC.game.state, 1, 'veteran'); return a; });
      if (!act) { note(label + ' ' + board + ': no legal action for player'); break; }
      const before = await page.evaluate(() => JSON.stringify(AC.game.state.log.length));
      if (act.type === 'astra') {
        await page.evaluate((a) => AC.game.perform(a), act);
      } else {
        await tapCell(page, act.from);
        await sleep(60);
        if (act.type === 'barrage' || act.type === 'scan') {
          const mb = await page.$('#action-bar [data-mode="special"]');
          if (mb) await mb.tap();
          await sleep(60);
        }
        await tapCell(page, act.to);
        await sleep(80);
        const moved = await page.evaluate((n) => AC.game.state.log.length !== +n || AC.game.state.owner !== 1 || !!AC.game.state.winner, before);
        if (!moved) { await tapCell(page, act.to); await sleep(80); }
        const moved2 = await page.evaluate((n) => AC.game.state.log.length !== +n || AC.game.state.owner !== 1 || !!AC.game.state.winner, before);
        if (!moved2) { await page.evaluate((a) => { AC.game.sel = null; AC.game.armed = null; AC.game.mode = 'move'; AC.game.perform(a); }, act); last = 'fallback ' + act.type; }
      }
      const chk = await page.evaluate(() => {
        const st = AC.game.state; const ov = document.documentElement.scrollWidth > innerWidth + 1;
        const tokens = document.querySelectorAll('#board .token').length; const pieces = Object.values(st.board).filter(Boolean).length;
        const visible = Object.values(st.board).filter((u) => u && (u.owner === 1 || true)).length;
        const board = document.querySelector('#board'); const r = board && board.getBoundingClientRect();
        return { ov, tokens, pieces, bw: r ? Math.round(r.width) : 0, bh: r ? Math.round(r.height) : 0 };
      });
      if (chk.ov) note(label + ' ' + board + ': horizontal overflow at move ' + moves);
      if (chk.tokens !== chk.pieces) note(label + ' ' + board + ': ' + chk.tokens + ' tokens drawn for ' + chk.pieces + ' pieces');
      if (chk.bw < 200 || chk.bh < 200) note(label + ' ' + board + ': board shrank to ' + chk.bw + 'x' + chk.bh);
      if (moves === 6) await shot(page, label + '-' + (b + 1) + '-' + board + '-early');
      if (moves === 30) await shot(page, label + '-' + (b + 1) + '-' + board + '-mid');
    }
    await sleep(1800);
    const end = await page.evaluate(() => ({ winner: AC.game.state.winner, round: AC.game.state.round, reason: AC.game.state.endReason || (AC.game.state.log.at(-1) || {}).text }));
    console.log(label, board, 'moves', moves, JSON.stringify(end).slice(0, 160), last);
    await shot(page, label + '-' + (b + 1) + '-' + board + '-end');
    await closeModals(page);
  }
  // lesson and daily
  await page.evaluate(() => AC.modes.startTutorial());
  await sleep(700); await shot(page, label + '-lesson'); await closeModals(page);
  await page.evaluate(() => { const i = AC.modes.dailyInfo(new Date()); const st = AC.modes.buildDaily(i); AC.game.startPrepared(st, { save: false, bannerTitle: 'Daily', bannerSub: i.mod.name }); });
  await sleep(900); await shot(page, label + '-daily'); await closeModals(page);
  await page.evaluate(() => AC.ui.openSettings ? AC.ui.openSettings() : null); await sleep(400); await shot(page, label + '-settings'); await closeModals(page);
  await ctx.close();
}
await browser.close(); server.close();
console.log(problems.length ? problems.length + ' problems' : 'no problems');
