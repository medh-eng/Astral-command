/* DOM smoke test: boots the real index.html + scripts in jsdom and drives a
 * whole match through the UI layer (login → deploy → battle → save/load),
 * including the Chakravyuha wheel.
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
  if (/WebAssembly/.test(e.message)) return; // jsdom teardown quirk in this sandbox
  console.log('UNCAUGHT', e.message);
  errors.push(e.message);
});
process.on('unhandledRejection', (e) => {
  if (e && /WebAssembly/.test(String(e.message || e))) return;
  console.log('UNHANDLED', e && e.message);
});

let errors = [];
console.error = (...a) => { errors.push(a.join(' ')); };

// read the script list straight from index.html so the test never drifts
const files = Array.from(fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .matchAll(/<script src="(js\/[a-z]+\.js)"><\/script>/g)).map((m) => m[1]);
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
const $$ = (s) => Array.from(document.querySelectorAll(s));
const click = (el) => {
  if (!el) throw new Error('missing element to click');
  el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
};
const clickCell = (id) => click(document.querySelector('.cell[data-id="' + id + '"]'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  await sleep(900);
  ok(!!AC, 'AC namespace loaded');
  await sleep(200);
  ok(!$('#screen-home').hidden, 'no login wall: a first-time player lands on home');
  ok(AC.app.profile && AC.app.profile.name === 'Yoddha', 'and is a yoddha straight away');
  ok(!!$('#btn-quick') && /Yuddh karo/.test($('#btn-quick').textContent), 'the quick battle button is the hero');
  ok(/#\d+/.test($('#daily-title').textContent), 'the daily card shows today\u2019s number');
  ok($('#btn-tutorial').classList.contains('card-pulse'), 'the first battle lesson calls for attention');

  // a second player can still be created on the access screen
  AC.ui.show('auth');
  ok($('#sigil-picker').children.length === 8, 'sigil picker populated');
  click($('#btn-new-profile'));
  $('#new-name').value = 'Test Vega';
  $('#new-pin').value = '1234';
  $('#form-new').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(160);
  ok(AC.app.profile && AC.app.profile.name === 'Test Vega', 'profile created and logged in');
  ok(!$('#screen-home').hidden, 'home screen after login');
  ok(AC.storage.listProfiles().some((p) => p.name === 'Test Vega' && p.hasPin), 'PIN stored as a hash');

  // setup: square board first
  click($('#btn-new-match'));
  ok(!$('#screen-setup').hidden, 'setup screen opens');
  ok($$('#setup-form .opt').length >= 9, 'setup options rendered');
  click(document.querySelector('#setup-form [data-group="board"][data-val="large"]'));
  click(document.querySelector('#setup-form [data-group="tie"][data-val="mutual"]'));
  click($('#btn-start-match'));
  await sleep(60);

  const game = AC.game;
  ok(!!game.state, 'engine state created');
  ok(game.state.phase === 'deploy1', 'starts in deployment');
  ok($$('#board .cell').length === 80, 'board rendered 80 SVG cells');
  ok($$('#board .token').length === 24, '24 tokens on the board');
  ok($$('#action-bar [data-preset]').length === 4, 'four formation presets');
  ok($$('#intel-panel .intel-chip').length > 0, 'intel ledger has chips');

  // swap two deployment cells through the UI
  const st = game.state;
  const zone = AC.geometry.build(st.boardKey).zones[1];
  const before = st.board[zone[0]] && st.board[zone[0]].id;
  clickCell(zone[0]);
  clickCell(zone[1]);
  ok((st.board[zone[1]] && st.board[zone[1]].id) === before, 'tap-swap moved a piece');

  click(document.querySelector('#action-bar [data-preset="blitz"]'));
  ok(AC.engine.armyComplete(st, 1), 'army complete after a preset');
  click(document.querySelector('#action-bar [data-deploy="lock"]'));
  await sleep(60);
  ok(st.phase === 'battle', 'battle begins after locking');

  ok(!!game.saveTo('1'), 'manual save writes a slot');
  ok(AC.storage.listSaves().some((s) => s.slot === '1'), 'save listed in storage');

  const saved = AC.storage.loadGame('1');
  game.load(saved, '1');
  ok(game.state.phase === 'battle' || game.state.phase === 'over', 'save reloads into the board');
  ok($$('#board .cell').length === 80, 'reloaded board still renders its cells');

  // play a few UI-driven orders
  let plies = 0;
  for (let i = 0; i < 12 && st.phase === 'battle'; i++) {
    if (game.thinking) { await sleep(800); continue; }
    const advice = AC.ai.advise(st, st.owner, 1);
    if (!advice.length) break;
    const a = advice[0].action;
    game.sel = a.from;
    game.mode = (a.type === 'scan' || a.type === 'barrage') ? 'special' : 'move';
    clickCell(a.to);
    plies++;
    AC.app.modals.slice().forEach((m) => m.close());
    await sleep(30);
    if (st.owner === 2 && st.phase === 'battle') {
      await sleep(900);
      AC.app.modals.slice().forEach((m) => m.close());
    }
  }
  ok(plies > 3, 'played ' + plies + ' UI-driven orders');
  ok(st.log.length > 0, 'battle log recorded');
  // modals
  AC.ui.openCodex();
  ok(!!$('.modal-backdrop .codex-tabs'), 'codex opens with tabs');
  AC.app.modals.slice().forEach((m) => m.close());
  AC.ui.openSettings();
  ok($$('.modal-backdrop [data-toggle]').length > 5, 'settings toggles render');
  AC.app.modals.slice().forEach((m) => m.close());

  // ── the Chakravyuha wheel ──
  game.state = null;
  AC.app.setup.board = 'wheel';
  AC.app.setup.mode = 'ai';
  game.start(AC.app.setup);
  await sleep(60);
  ok(game.state.boardKey === 'wheel', 'wheel match starts');
  ok($$('#board .cell').length === 37, 'the wheel renders 37 cells');
  ok($$('#board .token').length === 24, 'both armies deployed on the wheel');
  ok(AC.engine.armyComplete(game.state, 1) && AC.engine.armyComplete(game.state, 2), 'twelve pieces a side');
  ok(!!$('#board .cell.hub'), 'the hub is drawn');
  ok($$('#intel-panel .intel-chip').length > 0, 'intel ledger works on the wheel');

  click(document.querySelector('#action-bar [data-deploy="lock"]'));
  await sleep(80);
  ok(game.state.phase === 'battle', 'wheel battle begins');
  ok(/chakra turns in/i.test($('#hud-sub').textContent), 'HUD shows the rotation countdown');

  // a full round must turn the inner rings at round 5
  const st2 = game.state;
  const ringPiece = Object.keys(st2.board).filter((id) => id.indexOf('r1s') === 0)[0];
  ok(!!ringPiece, 'a piece starts on ring 1');

  // ── attack regression: tapping an enemy must resolve an attack ──
  game.state = null;
  AC.app.setup.board = 'small';
  game.start(AC.app.setup);
  // no AI turns during this section: keeps the assertions deterministic
  game.state.config.mode = 'pass';
  game.state.phase = 'battle';
  AC.engine.beginBattle(game.state);
  game.render();

  const st3 = game.state;
  st3.owner = 1;
  st3.viewer = 1;
  const geo = AC.geometry.build(st3.boardKey);
  let from = null;
  let to = null;
  Object.keys(st3.board).forEach((id) => {
    if (from) return;
    const u = st3.board[id];
    if (!u || u.owner !== 1 || !AC.engine.isMovable(u)) return;
    const n = geo.neighbours[id].filter((x) => !st3.board[x] && !AC.engine.isRift(st3, x))[0];
    if (n) { from = id; to = n; }
  });
  ok(!!from && !!to, 'test can place an attacker next to an enemy');
  // drop a fresh enemy piece on the target cell
  st3.board[to] = AC.engine.createArmy(2).filter((u) => u.key === '3')[0];
  game.render();

  // clear anything left open by earlier sections so the click cannot land on a
  // stale dialog button
  AC.app.modals.slice().forEach((m) => m.close());
  document.querySelectorAll('.modal-backdrop').forEach((n) => n.remove());
  game.render();

  const capBefore = st3.captured[1].length;
  clickCell(from);
  ok(!!document.querySelector('.cell.selected'), 'own piece selects');
  ok(!!document.querySelector('#board .odds-tag'), 'strike targets show odds on the board');
  clickCell(to);
  ok(!!document.querySelector('.cell.armed') && st3.board[from], 'the first tap arms the strike, nothing happens yet');
  clickCell(to);
  ok(!!document.querySelector('.stage'), 'the clash plays on the stage');
  document.querySelectorAll('.stage').forEach((n) => n.click());
  await sleep(10);
  const foeTile = st3.board[to];
  const attackerGone = !st3.board[from];
  ok(st3.captured[1].length > capBefore || (foeTile && foeTile.owner === 1) || attackerGone,
    'the attack actually resolved on the board');

  st3.config.mode = 'pass';
  AC.app.modals.slice().forEach((m) => m.close());
  Array.prototype.forEach.call(document.querySelectorAll('.curtain'), (n) => n.remove());

  // a plain move still works afterwards
  st3.owner = 1;
  st3.viewer = 1;
  st3.phase = 'battle';
  game.sel = null;
  game.mode = 'move';
  game.render();
  let mv = null;
  Object.keys(st3.board).forEach((id) => {
    if (mv) return;
    const u = st3.board[id];
    if (!u || u.owner !== 1 || !AC.engine.isMovable(u)) return;
    const t = AC.engine.computeValidTargets(st3, id, 'move').filter((x) => x.type === 'move')[0];
    if (t) mv = { from: id, to: t.id };
  });
  if (mv) {
    clickCell(mv.from);
    clickCell(mv.to);
    ok(!st3.board[mv.from], 'plain moves still work');
    AC.app.modals.slice().forEach((m) => m.close());
  }

  // ── the Abhimanyu scenario ──
  game.state = null;
  AC.app.setup.scenario = 'abhimanyu';
  click($('#btn-new-match'));
  ok(!!document.querySelector('#setup-form [data-group="scenario"]'), 'setup offers a scenario choice');
  click(document.querySelector('#setup-form [data-group="scenario"][data-val="abhimanyu"]'));
  ok(AC.app.setup.board === 'wheel', 'choosing the breach forces the wheel');
  ok(!document.querySelector('#setup-form [data-group="board"][data-val="small"]'), 'and hides the boards it cannot use');
  click($('#btn-start-match'));
  await sleep(60);
  ok(game.state.scenario === 'abhimanyu' && game.state.turnLimit === 28, 'breach state starts with a round limit');
  ok($$('#board .cell').length === 37, 'the wheel renders for the breach');
  ok($$('#board .token').length === 18, 'eight raiders and ten defenders on the board');
  click(document.querySelector('#action-bar [data-deploy="lock"]'));
  await sleep(80);
  ok(game.state.phase === 'battle', 'the breach begins');
  ok(/round/i.test($('#hud-turn').textContent), 'HUD shows the round clock');
  AC.app.setup.scenario = 'duel';

  // ── pass & play privacy curtain ──
  game.state = null;
  AC.app.setup.mode = 'pass';
  AC.app.setup.board = 'small';
  game.start(AC.app.setup);
  await sleep(40);
  click(document.querySelector('#action-bar [data-deploy="lock"]'));
  await sleep(40);
  ok(!!document.querySelector('.curtain'), 'privacy curtain between deployments');
  click(document.querySelector('#curtain-go'));
  await sleep(20);
  ok(game.state.phase === 'deploy2' && game.state.viewer === 2, 'player 2 deploys behind the curtain');
  click(document.querySelector('#action-bar [data-deploy="lock"]'));
  await sleep(30);
  ok(!!document.querySelector('.curtain'), 'curtain before the first battle turn');
  click(document.querySelector('#curtain-go'));
  await sleep(20);
  ok(game.state.phase === 'battle' && game.state.viewer === 1, 'battle starts as player 1');

  // ── Chapter III UI: astras ──
  game.state = null;
  AC.app.setup = { mode: 'pass', board: 'wheel', tie: 'attacker', difficulty: 'veteran', timer: 0, scenario: 'duel', ruleset: 'vyuha' };
  game.start(AC.app.setup);
  game.state.phase = 'battle';
  AC.engine.beginBattle(game.state);
  game.state.viewer = 1;
  Array.prototype.forEach.call(document.querySelectorAll('.curtain'), (n) => n.remove());
  AC.app.modals.slice().forEach((m) => m.close());
  game.state.shakti[1] = 5;
  game.render();
  ok($$('#action-bar .astra-btn.ready').length === 4, 'four astras ready with five lamps lit');
  ok($$('#strip-bottom .diya.lit').length === 5, 'the lamps are lit on the player strip');
  click(document.querySelector('#action-bar [data-astra="sammohana"]'));
  ok(game.mode === 'astra' && $$('#board .cell.target-astra').length > 0, 'an astra lights its targets');
  const tgt = document.querySelector('#board .cell.target-astra').getAttribute('data-id');
  clickCell(tgt);
  clickCell(tgt);
  ok(game.state.astrasUsed[1].sammohana && game.state.board[tgt].stun === 2, 'tapping twice invokes it');
  document.querySelectorAll('.stage').forEach((n) => n.click());
  Array.prototype.forEach.call(document.querySelectorAll('.curtain'), (n) => n.remove());
  ok(!!$('#hud-sky') && !$('#hud-sky').hidden, 'the HUD shows the hour');

  // ── Pehla Yuddh ──
  AC.modes.startTutorial();
  await sleep(30);
  ok(game.state.scenario === 'shiksha' && !$('#coach').hidden, 'the first battle starts with its coach');
  clickCell('5,0');
  clickCell('3,0');
  await sleep(20);
  document.querySelectorAll('.stage').forEach((n) => n.click());
  ok(/2 \/ 6/.test($('#coach').textContent), 'moving the chariot completes step one');
  ok(game.state.owner === 1, 'the entranced enemy passes its turn');

  // A scan must never be described as a strike merely because the player
  // focuses on an enemy beyond the Divyadrishti's two-cell reach.
  clickCell('5,2');
  click($('#action-bar [data-mode="special"]'));
  clickCell('3,3');
  const scanIntel = $('#intel-panel').textContent;
  ok(/Divya-drishti/.test(scanIntel) && /Reveal without combat/.test(scanIntel) &&
    !/Strike odds|You win|You lose/i.test(scanIntel), 'scan mode shows reconnaissance guidance, not combat odds');
  clickCell('3,2');
  await sleep(20);
  document.querySelectorAll('.stage').forEach((n) => n.click());
  ok(/3 \/ 6/.test($('#coach').textContent), 'a legal scan still reveals the enemy and advances the lesson');

  // ── Daily Chakravyuha ──
  AC.modes.startDaily();
  await sleep(30);
  ok(game.state.scenario === 'daily' && game.state.phase === 'battle', 'the daily wheel opens straight into battle');
  ok($$('#board .token').length >= 18, 'raiders and defenders are on the wheel');
  const a1 = AC.modes.buildDaily(AC.modes.dailyInfo());
  const a2 = AC.modes.buildDaily(AC.modes.dailyInfo());
  const sig = (s) => Object.keys(s.board).filter((k) => s.board[k]).sort().map((k) => k + s.board[k].key).join('|');
  ok(sig(a1) === sig(a2), 'everyone gets the same wheel today');
  const text = AC.modes.dailyShareText({ n: 3, label: '30 Oct', win: true, rounds: 14, limit: 24, taken: 6, lost: 3, astras: 2, grid: '🟨⬛🟥' });
  ok(/Daily Chakravyuha #3/.test(text) && /Can you get out/.test(text), 'the share card reads well');
  AC.app.modals.slice().forEach((m) => m.close());

  // jsdom has no media stack and no canvas backend; those notices are not
  // game errors (audio is verified in the browser instead)
  const realErrors = errors.filter((e) => !/Not implemented: (window\.|HTMLCanvas|HTMLMediaElement)/.test(e));
  ok(realErrors.length === 0, 'no runtime errors' + (realErrors.length ? ': ' + realErrors.slice(0, 3).join(' | ') : ''));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

run().catch((e) => {
  process.stdout.write('\nFAILED: ' + (e && e.stack ? e.stack : e) + '\n');
  process.exit(1);
});
