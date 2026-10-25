/* Headless test harness: loads the classic scripts into Node's global scope,
 * then plays full self-play matches to prove the engine terminates, never
 * mutates illegal state, and that the AI only ever picks legal actions.
 *
 *   node tests/selfplay.mjs [games]
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
['js/units.js', 'js/engine.js', 'js/ai.js'].forEach((f) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
});

const { engine: E, ai, units: U } = globalThis.AC;
const games = Number(process.argv[2] || 40);

let failures = 0;
const results = { 1: 0, 2: 0, 0: 0 };
const lengths = [];
const reasons = {};
const t0 = Date.now();

function check(cond, msg) {
  if (!cond) {
    failures++;
    console.error('  ✗ ' + msg);
  }
}

for (let g = 0; g < games; g++) {
  const board = g % 2 === 0 ? 'small' : 'large';
  const tie = g % 3 === 0 ? 'mutual' : 'attacker';
  const d1 = ['recruit', 'veteran', 'archon'][g % 3];
  const d2 = ['archon', 'veteran', 'recruit'][(g + 1) % 3];
  const s = E.newState({ mode: 'ai', board, tie, difficulty: d2 });

  // every deployment preset must place exactly 12 units per side
  ['citadel', 'blitz', 'lattice', 'shuffle'].forEach((style) => {
    const t = E.newState({ board });
    E.deployPreset(t, 1, style);
    E.deployPreset(t, 2, style);
    check(E.armyComplete(t, 1), `preset ${style} p1 count (${board})`);
    check(E.armyComplete(t, 2), `preset ${style} p2 count (${board})`);
    let cores = 0;
    t.board.forEach((row) => row.forEach((u) => { if (u && u.key === 'F') cores++; }));
    check(cores === 2, `preset ${style} must keep both cores on the board`);
  });

  E.beginBattle(s);
  let plies = 0;
  let guard = 0;
  while (s.phase === 'battle' && guard++ < 800) {
    const before = E.clone(s);
    const diff = s.owner === 1 ? d1 : d2;
    const act = ai.chooseAction(s, s.owner, diff);
    if (!act) break;
    const res = E.applyAction(s, act);
    check(res.ok, `illegal action chosen: ${JSON.stringify(act)} (${res.error})`);
    if (!res.ok) { console.error(JSON.stringify(before.log.slice(-3))); break; }
    plies++;

    // invariants
    let counts = { 1: 0, 2: 0, F: 0 };
    s.board.forEach((row) => row.forEach((u) => {
      if (!u) return;
      counts[u.owner]++;
      if (u.key === 'F') counts.F++;
      check(u.owner === 1 || u.owner === 2, 'unit owner valid');
    }));
    check(counts.F <= 2, 'never more than two cores');
    check(s.board.every((row) => row.length === s.cols), 'row width stable');
  }
  check(s.phase === 'over', `game ${g} terminated (phase=${s.phase}, plies=${plies})`);
  results[s.winner === null ? 0 : s.winner]++;
  reasons[s.reason] = (reasons[s.reason] || 0) + 1;
  lengths.push(plies);
}

const ms = Date.now() - t0;
lengths.sort((a, b) => a - b);
console.log('\nSelf-play summary');
console.log('  games        :', games);
console.log('  p1 / p2 / draw:', results[1], '/', results[2], '/', results[0]);
console.log('  plies min/med/max:', lengths[0], lengths[Math.floor(lengths.length / 2)], lengths[lengths.length - 1]);
console.log('  ms total     :', ms, '(', Math.round(ms / games), 'ms per match )');
console.log('  failures     :', failures);
if (failures) process.exitCode = 1;
