/* Current Chapter III visual smoke test.
 * CHROMIUM_PATH=/path/to/chrome node tools/shots.mjs [outDir]
 * Screenshots are test evidence, not shipped assets.
 */
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const out = process.argv[2] || '/tmp/vyuha-shots';
fs.mkdirSync(out, { recursive: true });
const root = fileURLToPath(new URL('../', import.meta.url));
const browser = await puppeteer.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/local/bin/chromium',
  headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files', '--mute-audio', '--force-device-scale-factor=1']
});
const errors = [];
async function shot(page, name) {
  await new Promise(resolve => setTimeout(resolve, 300));
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
  console.log(name);
}
async function closeModals(page) {
  await page.evaluate(() => AC.app.modals.slice().forEach(m => m.close()));
}
async function checkBoard(page, label, pieces) {
  const counts = await page.evaluate(() => ({
    cells: document.querySelectorAll('#board .cell').length,
    pieces: Object.values(AC.game.state.board).filter(Boolean).length,
    tokens: document.querySelectorAll('#board .token').length,
    overflow: document.documentElement.scrollWidth > innerWidth + 1
  }));
  assert.equal(counts.cells, 37, label + ': complete board');
  assert.equal(counts.pieces, pieces, label + ': complete armies');
  assert.equal(counts.tokens, pieces, label + ': every piece is rendered');
  assert.ok(!counts.overflow, label + ': horizontal overflow');
}
try {
  for (const [label, width, height] of [['desk', 1440, 900], ['mob', 390, 844]]) {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(label + ': ' + error.message));
    await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: label === 'mob', hasTouch: label === 'mob' });
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'load' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#screen-home:not([hidden])');
    await page.waitForSelector('#boot', { hidden: true });
    await shot(page, label + '-home');
    if (label === 'mob') await page.tap('#btn-new-match');
    else await page.click('#btn-new-match');
    await page.waitForSelector('#screen-setup:not([hidden])');
    await shot(page, label + '-setup');
    await page.click('#btn-start-match');
    await closeModals(page);
    await shot(page, label + '-deployment');
    await page.click('#action-bar [data-deploy="lock"]');
    await page.waitForFunction(() => AC.game.state?.phase === 'battle');
    await checkBoard(page, label, 24);
    await shot(page, label + '-wheel');
    await page.evaluate(() => AC.ui.openCodex());
    await shot(page, label + '-rules');
    await closeModals(page);
    // Verify the actual Sunday builder and resumed Daily briefing on the lotus.
    await page.evaluate(() => {
      const info = AC.modes.dailyInfo(new Date('2026-11-01T12:00:00+05:30'));
      const state = AC.modes.buildDaily(info);
      AC.modes.resume(state);
      AC.game.startPrepared(state, { save: false, bannerTitle: 'Sunday Daily', bannerSub: info.mod.name });
    });
    await checkBoard(page, label + '-sunday', 18);
    assert.equal(await page.evaluate(() => AC.game.state.boardKey), 'padma');
    await shot(page, label + '-sunday-lotus');
    await page.close();
  }
  assert.deepEqual(errors, [], 'browser runtime errors');
  console.log('Desktop and phone screenshots passed; no runtime errors.');
} finally { await browser.close(); }
