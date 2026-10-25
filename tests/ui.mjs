/* DOM smoke test: boots the real index.html + scripts in jsdom and drives a
 * whole match through the UI layer (login → deploy → battle → save/load).
 *   node tests/ui.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/<script[\s\S]*?<\/script>/g, '');

const dom = new JSDOM(html, {
  url: 'http://localhost/index.html',
  pretendToBeVisual: true,
  runScripts: 'outside-only'
});
const w = dom.window;
const { document } = w;

// jsdom's service worker stub would try to fetch sw.js over the network
try {
  Object.defineProperty(w.navigator, 'serviceWorker', { value: undefined, configurable: true });
} catch (e) { /* ignore */ }

// jsdom has no canvas backend; give fx a harmless 2d stub
w.HTMLCanvasElement.prototype.getContext = function () {
  return {
    setTransform() {}, clearRect() {}, beginPath() {}, arc() {}, fill() {},
    fillText() {}, save() {}, restore() {},
    set fillStyle(v) {}, set shadowBlur(v) {}, set shadowColor(v) {},
    set globalAlpha(v) {}, set font(v) {}, set textAlign(v) {}
  };
};

process.on('uncaughtException', (e) => {
  // jsdom's teardown tries to spin up undici's wasm HTTP parser in this
  // sandbox and fails; it is unrelated to the game, so record and move on.
  if (/WebAssembly/.test(e.message)) return;
  console.log('UNCAUGHT', e.message);
  errors.push(e.message);
});
process.on('unhandledRejection', (e) => {
  if (e && /WebAssembly/.test(String(e.message || e))) return;
  console.log('UNHANDLED', e && e.message);
});

let errors = [];
w.addEventListener('error', (e) => errors.push(e.message));
const origError = console.error;
console.error = (...a) => { errors.push(a.join(' ')); };

const files = ['js/units.js', 'js/engine.js', 'js/ai.js', 'js/audio.js', 'js/storage.js',
  'js/art.js', 'js/fx.js', 'js/ui.js', 'js/game.js', 'js/main.js'];
files.forEach((f) => {
  try {
    w.eval(fs.readFileSync(path.join(root, f), 'utf8'));
  } catch (e) {
    errors.push(f + ': ' + e.message + '\n' + e.stack);
  }
});

const AC = w.AC;
let pass = 0;
let fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}
const $ = (s) => document.querySelector(s);
const click = (el) => {
  if (!el) throw new Error('missing element to click');
  el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  await sleep(900); // boot timer
  ok(!!AC, 'AC namespace loaded');
  ok(!!$('#screen-auth') && !$('#screen-auth').hidden, 'auth screen shown on first run');
  ok($('#sigil-picker').children.length === 8, 'sigil picker populated');
  ok(document.querySelectorAll('#auth-profiles .profile-row').length === 0, 'no profiles yet');

  // create a commander
  $('#new-name').value = 'Test Vega';
  $('#new-pin').value = '1234';
  $('#form-new').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(120);
  ok(AC.app.profile && AC.app.profile.name === 'Test Vega', 'profile created and logged in');
  ok(!$('#screen-home').hidden, 'home screen after login');
  ok(AC.storage.listProfiles().length === 1, 'profile persisted');
  ok(AC.storage.listProfiles()[0].hasPin, 'PIN stored as a hash');

  // guest-free start: setup
  click($('#btn-new-match'));
  ok(!$('#screen-setup').hidden, 'setup screen opens');
  ok(document.querySelectorAll('#setup-form .opt').length >= 8, 'setup options rendered');

  // pick large board + mutual tie + no clock, then start
  click(document.querySelector('#setup-form [data-group="board"][data-val="large"]'));
  click(document.querySelector('#setup-form [data-group="tie"][data-val="mutual"]'));
  click(document.querySelector('#setup-form [data-group="difficulty"][data-val="veteran"]'));
  click($('#btn-start-match'));
  await sleep(60);

  const game = AC.game;
  ok(!!game.state, 'engine state created');
  ok(game.state.phase === 'deploy1', 'starts in deployment');
  ok(!$('#screen-game').hidden, 'game screen visible');
  ok(document.querySelectorAll('#board .tile').length === 80, 'board rendered 8x10 tiles');
  ok(document.querySelectorAll('#board .token').length === 24, '24 tokens on the board');
  ok(document.querySelectorAll('#action-bar [data-preset]').length === 4, 'four formation presets');
  ok(document.querySelectorAll('#intel-panel .intel-chip').length > 0, 'intel ledger has chips');

  // swap two deployment squares through the UI
  const before = JSON.stringify(game.state.board[9][0] && game.state.board[9][0].id);
  click(document.querySelector('.tile[data-r="9"][data-c="0"]'));
  click(document.querySelector('.tile[data-r="9"][data-c="1"]'));
  ok(JSON.stringify(game.state.board[9][1] && game.state.board[9][1].id) === before, 'tap-swap moved a piece');

  // apply a preset then lock
  click(document.querySelector('#action-bar [data-preset="blitz"]'));
  ok(AC.engine.armyComplete(game.state, 1), 'army complete after preset');
  click(document.querySelector('#action-bar [data-deploy="lock"]'));
  await sleep(60);
  ok(game.state.phase === 'battle', 'battle begins after locking');

  // play 30 plies by clicking the advisor's suggestion
  let plies = 0;
  for (let i = 0; i < 30 && game.state.phase === 'battle'; i++) {
    if (game.thinking) { await sleep(700); continue; }
    const advice = AC.ai.advise(game.state, game.state.owner, 1);
    if (!advice.length) break;
    const a = advice[0].action;
    game.sel = { r: a.from.r, c: a.from.c };
    game.mode = (a.type === 'scan' || a.type === 'barrage') ? 'special' : 'move';
    // drive it through the real click path where possible
    const target = document.querySelector('.tile[data-r="' + a.to.r + '"][data-c="' + a.to.c + '"]');
    if (!target) break;
    click(target);
    plies++;
    // dismiss any modal that appeared
    const btn = document.querySelector('.modal-backdrop .modal-actions [data-act]');
    if (btn) click(btn);
    await sleep(30);
    if (game.state.owner === 2 && game.state.phase === 'battle') {
      await sleep(900); // let the AI play its reply
      const btn2 = document.querySelector('.modal-backdrop .modal-actions [data-act]');
      if (btn2) click(btn2);
    }
    if (AC.app.modals.length) {
      AC.app.modals.slice().forEach((m) => m.close());
    }
  }
  ok(plies > 5, 'played ' + plies + ' UI-driven orders');
  ok(game.state.log.length > 0, 'battle log recorded');
  ok(!!game.saveTo('1'), 'manual save writes a slot');
  ok(AC.storage.listSaves().some((s) => s.slot === '1'), 'save listed in storage');

  // reload the save
  const saved = AC.storage.loadGame('1');
  game.load(saved, '1');
  ok(game.state.phase === 'battle' || game.state.phase === 'over', 'save reloads into the board');

  // modals: codex + settings
  AC.ui.openCodex();
  ok(!!document.querySelector('.modal-backdrop .codex-tabs'), 'codex opens with tabs');
  click(document.querySelector('[data-codex="rules"]'));
  ok(document.querySelectorAll('#codex-body .rule-item').length > 3, 'codex rules render');
  AC.app.modals.slice().forEach((m) => m.close());
  AC.ui.openSettings();
  ok(document.querySelectorAll('.modal-backdrop [data-toggle]').length > 5, 'settings toggles render');
  AC.app.modals.slice().forEach((m) => m.close());

  // privacy curtain path: switch to pass & play
  game.state = null;
  click($('#btn-new-match'));
  click(document.querySelector('#setup-form [data-group="mode"][data-val="pass"]'));
  click($('#btn-start-match'));
  await sleep(40);
  click(document.querySelector('#action-bar [data-deploy="lock"]'));
  await sleep(40);
  ok(!!document.querySelector('.curtain'), 'privacy curtain appears between deployments');
  click(document.querySelector('#curtain-go'));
  await sleep(20);
  ok(game.state.phase === 'deploy2' && game.state.viewer === 2, 'player 2 deploys behind the curtain');
  click(document.querySelector('#action-bar [data-deploy="lock"]'));
  await sleep(30);
  ok(!!document.querySelector('.curtain'), 'curtain before the first battle turn');
  click(document.querySelector('#curtain-go'));
  await sleep(20);
  ok(game.state.phase === 'battle' && game.state.viewer === 1, 'battle starts as player 1');

  // ── regression: tapping an enemy piece must RESOLVE AN ATTACK ──
  // (an earlier build returned early to "inspect" and made attacks impossible)
  AC.app.setup.mode = 'ai';
  game.state = null;
  game.start(AC.app.setup);
  game.state.phase = 'battle';
  AC.engine.beginBattle(game.state);
  game.render();

  const st = game.state;
  st.owner = 1;
  st.viewer = 1;

  // deterministic setup: move an enemy piece into a free square next to one of
  // our movable pieces, so the attack is legal whatever the random formation was
  let mine = null;
  let foe = null;
  for (let r = 0; r < st.rows && !foe; r++) {
    for (let c = 0; c < st.cols && !foe; c++) {
      const u = st.board[r][c];
      if (!u || u.owner !== 1 || !AC.engine.isMovable(u)) continue;
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const d of dirs) {
        const nr = r + d[0];
        const nc = c + d[1];
        if (!AC.engine.inBounds(st, nr, nc) || AC.engine.isRift(st, nr, nc)) continue;
        const occ = st.board[nr][nc];
        if (occ && occ.owner === 1) continue;
        mine = { r: r, c: c };
        foe = { r: nr, c: nc };
        break;
      }
    }
  }
  ok(!!mine && !!foe, 'test can place an attacker next to an enemy');
  // put a fresh enemy piece on the target square (keep the old one off-board)
  const oldFoe = st.board[foe.r][foe.c];
  if (oldFoe && oldFoe.owner === 1) {
    st.board[foe.r][foe.c] = null;
  }
  const enemyUnit = AC.engine.createArmy(2).filter((u) => u.key === '3')[0];
  st.board[foe.r][foe.c] = enemyUnit;
  game.render();

  const capBefore = st.captured[1].length;
  click(document.querySelector('.tile[data-r="' + mine.r + '"][data-c="' + mine.c + '"]'));
  ok(!!document.querySelector('.tile.selected'), 'own piece selects');
  click(document.querySelector('.tile[data-r="' + foe.r + '"][data-c="' + foe.c + '"]'));
  const confirmBtn = document.querySelector('.modal-actions [data-act="1"]');
  ok(!!confirmBtn, 'a blind attack asks for confirmation with odds');
  if (confirmBtn) click(confirmBtn);
  ok(!!document.querySelector('.combat-arena'), 'combat result modal shown after the strike');
  const foeTile = st.board[foe.r][foe.c];
  const attackerGone = !st.board[mine.r][mine.c];
  ok(st.captured[1].length > capBefore || (foeTile && foeTile.owner === 1) || attackerGone,
    'the attack actually resolved on the board');

  // switch the config so closing the modal does not hand the turn to the AI
  st.config.mode = 'pass';
  AC.app.modals.slice().forEach((m) => m.close());
  Array.prototype.forEach.call(document.querySelectorAll('.curtain'), (n) => n.remove());

  // a plain move still works afterwards
  st.owner = 1;
  st.viewer = 1;
  st.phase = 'battle';
  game.sel = null;
  game.mode = 'move';
  game.render();
  let mv = null;
  for (let r = 0; r < st.rows && !mv; r++) {
    for (let c = 0; c < st.cols && !mv; c++) {
      const u = st.board[r][c];
      if (!u || u.owner !== 1 || !AC.engine.isMovable(u)) continue;
      const t = AC.engine.computeValidTargets(st, r, c, 'move').filter((x) => x.type === 'move')[0];
      if (t) mv = { from: { r: r, c: c }, to: { r: t.r, c: t.c } };
    }
  }
  if (mv) {
    click(document.querySelector('.tile[data-r="' + mv.from.r + '"][data-c="' + mv.from.c + '"]'));
    click(document.querySelector('.tile[data-r="' + mv.to.r + '"][data-c="' + mv.to.c + '"]'));
    ok(!st.board[mv.from.r][mv.from.c], 'plain moves still work');
    AC.app.modals.slice().forEach((m) => m.close());
  }

  const realErrors = errors.filter((e) => !/Not implemented: (window\.|HTMLCanvas)/.test(e));
  ok(realErrors.length === 0, 'no runtime errors' + (realErrors.length ? ': ' + realErrors.slice(0, 3).join(' | ') : ''));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

run().catch((e) => {
  // console.error is captured into `errors` above, so surface the failure on
  // stdout explicitly — otherwise a thrown assertion looks like a silent stop.
  process.stdout.write('\nFAILED: ' + (e && e.stack ? e.stack : e) + '\n');
  process.exit(1);
});
