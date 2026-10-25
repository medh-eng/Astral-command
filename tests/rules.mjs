/* Rule-level regression tests (cell-graph engine).
 *   node tests/rules.mjs
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
['js/units.js', 'js/geometry.js', 'js/engine.js', 'js/ai.js'].forEach((f) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
});
const { engine: E, geometry: G, units: U } = globalThis.AC;

let pass = 0;
let fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

function blank(config) {
  const s = E.newState(Object.assign({ board: 'small' }, config || {}));
  s.board = {};
  s.phase = 'battle';
  s.owner = 1;
  s.turn = 1;
  s.captured = { 1: [], 2: [] };
  s.stats = { actions: 0, attacks: 0, wins: 0, losses: 0, probes: 0, firstBlood: 0, lastCapturePly: 0 };
  return s;
}
function put(s, id, owner, key) {
  const def = U.UNIT_DEFS[key];
  s.board[id] = {
    id: 'T' + id, owner, key, rank: def.rank, badge: def.badge,
    name: def.name, short: def.short, revealed: false, hasMoved: false,
    shieldBroken: false, moveHistory: []
  };
  return s.board[id];
}
function act(s, from, to, type) {
  return E.applyAction(s, { from, to, type: type || 'move' });
}
const targets = (s, id, mode) => E.computeValidTargets(s, id, mode || 'move');
const has = (list, id) => list.some((t) => t.id === id);

console.log('Square arena — movement & rifts');
{
  const s = blank();
  put(s, '5,2', 1, '2');
  ok(targets(s, '5,2').length > 0, 'the chariot has moves on an open board');

  const s2 = blank();
  put(s2, '5,1', 1, '2');
  ok(!has(targets(s2, '5,1'), '3,1'), 'the chariot cannot cross an Astral Rift');

  const s3 = blank();
  put(s3, '6,2', 1, '3');
  put(s3, '6,3', 1, '2');
  ok(!has(targets(s3, '6,2'), '6,4'), 'a friendly piece blocks the lane');
}

console.log('Cavalry dash');
{
  const s = blank();
  put(s, '6,2', 1, '7');
  ok(has(targets(s, '6,2'), '4,2'), 'the cavalry reaches two cells');
  put(s, '4,2', 2, '3');
  const t = targets(s, '6,2');
  ok(t.some((x) => x.id === '4,2' && x.type === 'attack'), 'and strikes at two cells');
}

console.log('Archer volley');
{
  const s = blank();
  put(s, '6,0', 1, '6');
  put(s, '4,0', 2, '3');
  ok(has(targets(s, '6,0', 'special'), '4,0'), 'volley target found two cells away');
  act(s, '6,0', '4,0', 'barrage');
  ok(!s.board['4,0'], 'volley cuts down rank 3');
  ok(s.board['6,0'] && s.board['6,0'].key === '6', 'the archer stays put');

  const s2 = blank();
  put(s2, '6,0', 1, '6');
  put(s2, '4,0', 2, '9');
  act(s2, '6,0', '4,0', 'barrage');
  ok(s2.board['4,0'] && s2.board['4,0'].key === '9', 'volley is turned by rank 9');
  ok(s2.board['4,0'].revealed && s2.board['6,0'].revealed, 'both pieces revealed after a turn');

  const s3 = blank();
  put(s3, '6,0', 1, '6');
  put(s3, '4,0', 2, 'B');
  act(s3, '6,0', '4,0', 'barrage');
  ok(s3.board['4,0'] && s3.board['4,0'].key === 'B', 'a volley does not clear a trap');

  const s4 = blank();
  put(s4, '6,0', 1, '6');
  put(s4, '4,0', 2, 'F');
  const res = act(s4, '6,0', '4,0', 'barrage');
  ok(res.ok && s4.phase === 'over' && s4.winner === 1, 'a volley on the fort wins the match');

  const s5 = blank();
  put(s5, '6,0', 1, '6');
  put(s5, '5,0', 1, '2');
  put(s5, '4,0', 2, '3');
  ok(has(targets(s5, '6,0', 'special'), '4,0'), 'the volley arcs over a blocking piece');
  act(s5, '6,0', '4,0', 'barrage');
  ok(s5.board['5,0'] && !s5.board['4,0'], 'the piece in between is unharmed');
}

console.log('Trap & engineer');
{
  const s = blank();
  put(s, '6,2', 1, '9');
  put(s, '5,2', 2, 'B');
  act(s, '6,2', '5,2');
  ok(s.board['5,2'] && s.board['5,2'].key === 'B', 'the trap survives an attack');
  ok(!s.board['6,2'], 'the attacker is destroyed');

  const s2 = blank();
  put(s2, '6,2', 1, '3');
  put(s2, '5,2', 2, 'B');
  act(s2, '6,2', '5,2');
  ok(s2.board['5,2'] && s2.board['5,2'].key === '3', 'the engineer defuses and captures it');
}

console.log('Spy');
{
  const s = blank();
  put(s, '6,2', 1, '1');
  put(s, '5,2', 2, '10');
  act(s, '6,2', '5,2');
  ok(s.board['5,2'] && s.board['5,2'].key === '1', 'the spy kills the Senapati when attacking');

  const s2 = blank();
  put(s2, '6,2', 1, '10');
  put(s2, '5,2', 2, '1');
  act(s2, '6,2', '5,2');
  ok(s2.board['5,2'] && s2.board['5,2'].key === '10', 'the Senapati beats the spy when attacked');

  const s3 = blank();
  put(s3, '6,2', 1, '1');
  put(s3, '5,2', 2, '9');
  act(s3, '6,2', '5,2');
  ok(s3.board['5,2'] && s3.board['5,2'].key === '1', 'the spy kills the Maharathi too');
}

console.log('Tie rules');
{
  const s = blank({ tie: 'attacker' });
  put(s, '6,2', 1, '3');
  put(s, '5,2', 2, '3');
  act(s, '6,2', '5,2');
  const w = s.board['5,2'];
  ok(w && w.owner === 1 && w.rank === 2, 'attacker advantage: wins but drops a rank');

  const s2 = blank({ tie: 'mutual' });
  put(s2, '6,2', 1, '3');
  put(s2, '5,2', 2, '3');
  act(s2, '6,2', '5,2');
  ok(!s2.board['5,2'] && !s2.board['6,2'], 'mutual destruction clears both cells');
}

console.log('Scan');
{
  const s = blank();
  put(s, '6,2', 1, '5');
  put(s, '5,3', 2, '7');
  const t = targets(s, '6,2', 'special');
  ok(t.length === 1 && t[0].type === 'scan', 'scan target inside two cells');
  act(s, '6,2', '5,3', 'scan');
  ok(s.board['5,3'].revealed, 'the scan reveals without fighting');
  ok(s.board['6,2'] && s.board['6,2'].key === '5', 'the seer does not move when scanning');
}

console.log('Fort capture');
{
  const s = blank();
  put(s, '6,2', 1, '2');
  put(s, '5,2', 2, 'F');
  put(s, '0,0', 2, '3');
  const res = act(s, '6,2', '5,2');
  ok(res.ok && s.phase === 'over' && s.winner === 1, 'capturing the fort ends the game');
  ok(s.captured[1].some((u) => u.key === 'F'), 'the capture is recorded in the tray');
}

console.log('Two-square anti-stall');
{
  const s = blank();
  put(s, '6,2', 1, '3');
  put(s, '6,0', 1, 'F');
  put(s, '0,0', 2, 'F');
  put(s, '0,1', 2, '3');
  let blocked = false;
  [[6, 2, 5, 2], [5, 2, 6, 2], [6, 2, 5, 2], [5, 2, 6, 2]].forEach((m) => {
    const res = act(s, m[0] + ',' + m[1], m[2] + ',' + m[3]);
    if (!res.ok) blocked = true;
    s.owner = 1;
  });
  ok(blocked, 'the fourth reversal between two cells is refused');
}

console.log('Deployment');
{
  const s = E.newState({ board: 'large' });
  ok(E.armyComplete(s, 1) && E.armyComplete(s, 2), 'both armies have twelve pieces');
  ok(E.inDeployZone(s, 1, '9,0') && !E.inDeployZone(s, 1, '6,0'), 'Surya deploys in the bottom rows');
  ok(E.inDeployZone(s, 2, '0,0') && !E.inDeployZone(s, 2, '3,0'), 'Chandra deploys in the top rows');
  const a = s.board['9,0'];
  const b = s.board['9,1'];
  E.swapSlots(s, 1, '9,0', '9,1');
  ok(s.board['9,0'] === b && s.board['9,1'] === a, 'swapping two cells works');
  ok(E.swapSlots(s, 1, '0,0', '9,1') === false, 'cannot swap into the enemy zone');

  const w = E.newState({ board: 'wheel' });
  ok(E.armyComplete(w, 1) && E.armyComplete(w, 2), 'the wheel deploys twelve pieces a side');
  const g = G.build('wheel');
  ok(g.zones[1].length === 18 && g.zones[2].length === 18, 'each half of the wheel offers eighteen cells');
  ok(E.inDeployZone(w, 1, 'r3s0') && !E.inDeployZone(w, 1, 'r3s6'), 'zones split the wheel into two halves');
}

console.log('Chakravyuha geometry');
{
  const g = G.build('wheel');
  ok(g.cells.length === 37, 'the wheel has 37 cells (hub + 3 rings x 12)');
  ok(g.neighbours.h.length === 12, 'the hub touches all twelve spokes');
  ok(g.neighbours['r2s3'].length === 4, 'a ring cell has four neighbours');
  ok(g.rays['r2s3'].length === 4, 'a ring cell has four rays');
  ok(g.rays.h.length === 12, 'the hub fires twelve rays');
  const outRay = g.rays['r2s3'][2];
  ok(outRay[0] === 'r3s3' && outRay.length === 1, 'the outward ray climbs the spoke');
  ok(g.rays['r2s3'][0].length === 1, 'a ring arc is a single cell');
}

console.log('The chakra turns');
{
  const s = E.newState({ board: 'wheel' });
  s.board = {};
  s.phase = 'battle';
  s.turn = 5;
  put(s, 'r1s0', 1, '2');
  put(s, 'r2s11', 2, '3');
  put(s, 'r3s1', 1, '9');   // outer ring must not move
  put(s, 'h', 2, 'B');
  E.rotate(s, []);
  ok(s.board['r1s1'] && s.board['r1s1'].key === '2', 'ring 1 carries a piece one spoke clockwise');
  ok(!s.board['r1s0'], 'the old cell is empty');
  ok(s.board['r2s0'] && s.board['r2s0'].key === '3', 'ring 2 turns as well');
  ok(s.board['r3s1'] && s.board['r3s1'].key === '9', 'the outer ring stays put');
  ok(s.board['h'] && s.board['h'].key === 'B', 'the hub stays put');
  ok(s.board['r1s1'].revealed, 'riding the wheel exposes the piece');

  // rotation fires at the start of round 5
  const s2 = E.newState({ board: 'wheel' });
  s2.board = {};
  s2.phase = 'battle';
  s2.turn = 4;
  s2.owner = 2;
  put(s2, 'r1s2', 1, '2');
  put(s2, 'r3s0', 1, 'F');
  put(s2, 'r3s6', 2, 'F');
  put(s2, 'r3s2', 2, '3');
  put(s2, 'r3s3', 2, '2');
  // a legal move by player 2 ends round 4
  const before = JSON.stringify(Object.keys(s2.board).sort());
  const move = E.allLegalActions(s2, 2)[0];
  if (move) E.applyAction(s2, move);
  ok(s2.turn === 5, 'the round advances to 5');
  ok(s2.board['r1s3'] && s2.board['r1s3'].key === '2', 'the wheel turned at the start of round 5');
  void before;
}

console.log('Hub exposure');
{
  const s = E.newState({ board: 'wheel' });
  s.board = {};
  s.phase = 'battle';
  s.owner = 1;
  s.turn = 1;
  put(s, 'r1s0', 1, '2');
  put(s, 'r3s6', 2, 'F');
  put(s, 'r3s0', 1, 'F');
  const res = act(s, 'r1s0', 'h');
  ok(res.ok && s.board.h && s.board.h.key === '2', 'a piece can step onto the hub');
  ok(s.board.h.revealed, 'standing on the hub reveals it');
}

console.log('Volley on the wheel');
{
  const s = E.newState({ board: 'wheel' });
  s.board = {};
  s.phase = 'battle';
  s.owner = 1;
  s.turn = 1;
  put(s, 'r3s0', 1, '6');
  put(s, 'r1s0', 2, '3');
  put(s, 'r3s6', 2, 'F');
  put(s, 'r3s11', 1, 'F');
  ok(has(targets(s, 'r3s0', 'special'), 'r1s0'), 'the archer can volley down a spoke');
  act(s, 'r3s0', 'r1s0', 'barrage');
  ok(!s.board['r1s0'], 'and the volley lands');
}

console.log('No-capture draw');
{
  const s = blank({ drawAfter: 4 });
  put(s, '6,2', 1, '3');
  put(s, '0,2', 2, '3');
  [[6, 2, 5, 2], [0, 2, 1, 2], [5, 2, 4, 2], [1, 2, 2, 2]].forEach((m) => {
    if (s.phase === 'battle') act(s, m[0] + ',' + m[1], m[2] + ',' + m[3]);
  });
  ok(s.phase === 'over' && s.winner === 0, 'four quiet orders end the match as a draw');
  ok(/draw/i.test(s.reason), 'the draw reason is reported');
}

console.log('Belief model');
{
  const s = blank();
  const u = put(s, '5,2', 2, '3');
  u.hasMoved = false;
  const d1 = E.beliefFor(s, 1, '5,2');
  ok(Math.abs(Object.values(d1).reduce((a, b) => a + b, 0) - 1) < 1e-9, 'belief distribution sums to 1');
  ok(d1.F > 0 && d1.B > 0, 'an unmoved piece can be a fort or a trap');
  u.hasMoved = true;
  const d2 = E.beliefFor(s, 1, '5,2');
  ok(!d2.F && !d2.B, 'a piece that has moved can no longer be either');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
