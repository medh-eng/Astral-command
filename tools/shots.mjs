/* Visual check: drives the real app in Chromium and screenshots each screen.
 *   node tools/shots.mjs [outDir]
 */
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const out = process.argv[2] || '/scratch/work/shots';
fs.mkdirSync(out, { recursive: true });
const root = path.resolve(new URL('..', import.meta.url).pathname);
const url = 'file://' + path.join(root, 'index.html');

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/chromium',
  headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files', '--mute-audio', '--force-device-scale-factor=1']
});

const errors = [];
async function shot(page, name) {
  await new Promise((r) => setTimeout(r, 450));
  await page.screenshot({ path: path.join(out, name + '.png') });
  console.log('  ·', name);
}

async function run(label, viewport, isMobile) {
  console.log(label);
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(label + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(label + ' console: ' + m.text()); });
  await page.setViewport(Object.assign({ deviceScaleFactor: 1 }, viewport));
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 1300));
  await shot(page, label + '-1-auth');

  // create a commander
  await page.type('#new-name', 'Cmdr Vega');
  await page.type('#new-pin', '1234');
  await page.click('#form-new button[type="submit"]');
  await new Promise((r) => setTimeout(r, 700));
  await shot(page, label + '-2-home');

  await page.click('#btn-new-match');
  await new Promise((r) => setTimeout(r, 350));
  await shot(page, label + '-3-setup');

  await page.click('#btn-start-match');
  await new Promise((r) => setTimeout(r, 500));
  await shot(page, label + '-4-deploy');

  await page.click('#action-bar [data-deploy="lock"]');
  await new Promise((r) => setTimeout(r, 900));
  await shot(page, label + '-5-battle');

  // select a unit to show the ability bar and target highlights
  const picked = await page.evaluate(() => {
    const st = AC.game.state;
    for (let r = 0; r < st.rows; r++) {
      for (let c = 0; c < st.cols; c++) {
        const u = st.board[r][c];
        if (u && u.owner === 1 && AC.engine.isMovable(u)) {
          AC.game.sel = { r: r, c: c };
          AC.game.render ? AC.game.render() : null;
          return r + ',' + c;
        }
      }
    }
    return null;
  });
  // force a re-render through the public path
  await page.evaluate(() => {
    const t = document.querySelector('#board .tile[data-r="6"][data-c="2"]') || document.querySelector('#board .tile');
    if (t) t.click();
  });
  await shot(page, label + '-6-selected');

  // codex
  await page.evaluate(() => AC.ui.openCodex());
  await shot(page, label + '-7-codex');
  await page.evaluate(() => AC.app.modals.slice().forEach((m) => m.close()));

  // settings
  await page.evaluate(() => AC.ui.openSettings());
  await shot(page, label + '-8-settings');
  await page.evaluate(() => AC.app.modals.slice().forEach((m) => m.close()));

  // combat modal + saves
  await page.evaluate(() => {
    const st = AC.game.state;
    AC.game.saveTo('1');
    AC.ui.openSaves('game');
  });
  await shot(page, label + '-9-saves');
  await page.evaluate(() => AC.app.modals.slice().forEach((m) => m.close()));

  // pass & play curtain
  await page.evaluate(() => {
    AC.game.state = null;
    AC.app.setup.mode = 'pass';
    AC.game.start(AC.app.setup);
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.click('#action-bar [data-deploy="lock"]');
  await new Promise((r) => setTimeout(r, 600));
  await shot(page, label + '-10-curtain');

  // play a few exchanges and capture combat + result modals
  await page.evaluate(() => {
    AC.game.state = null;
    AC.app.setup.mode = 'ai';
    AC.app.setup.board = 'small';
    AC.game.start(AC.app.setup);
    AC.game.state.phase = 'battle';
    AC.engine.beginBattle(AC.game.state);
    AC.game.render();
  });
  await new Promise((r) => setTimeout(r, 300));
  for (let i = 0; i < 8; i++) {
    const moved = await page.evaluate(() => {
      const st = AC.game.state;
      if (!st || st.phase !== 'battle' || AC.game.thinking) return false;
      const advice = AC.ai.advise(st, st.owner, 1);
      if (!advice.length) return false;
      const a = advice[0].action;
      AC.game.sel = { r: a.from.r, c: a.from.c };
      AC.game.mode = (a.type === 'scan' || a.type === 'barrage') ? 'special' : 'move';
      const t = document.querySelector('.tile[data-r="' + a.to.r + '"][data-c="' + a.to.c + '"]');
      if (t) t.click();
      return true;
    });
    await new Promise((r) => setTimeout(r, 350));
    const modal = await page.$('.modal-backdrop');
    if (modal && i === 3) await shot(page, label + '-11-combat');
    await page.evaluate(() => AC.app.modals.slice().forEach((m) => m.close()));
    await new Promise((r) => setTimeout(r, 700));
    await page.evaluate(() => AC.app.modals.slice().forEach((m) => m.close()));
    void moved;
  }
  await page.evaluate(() => {
    AC.app.modals.slice().forEach((m) => m.close());
    const st = AC.game.state;
    if (st && st.phase === 'battle') {
      st.stats.actions = 41;
      st.captured[1] = st.captured[1].concat([{ key: 'F', badge: 'F', name: 'Nexus Core', owner: 2 }]);
      AC.engine.endGame(st, 1, 'Nexus Core captured on turn 9.', []);
      AC.game.state.winner = 1;
      AC.game.state.phase = 'battle';
      AC.game.resign();
    }
  });
  await shot(page, label + '-12-end');

  await page.close();
}

await run('desk', { width: 1440, height: 900 });
await run('mob', { width: 390, height: 844 }, true);

await browser.close();
console.log(errors.length ? '\nERRORS:\n' + errors.slice(0, 20).join('\n') : '\nno console errors');
