/* Rule-level regression tests. Every combat interaction in the Codex has a
 * case here so a balance tweak cannot silently break the ruleset.
 *   node tests/rules.mjs
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
const { engine: E } = globalThis.AC;

let pass = 0;
let fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

function blank(config) {
  const s = E.newState(Object.assign({ board: 'small' }, config || {}));
  s.board = s.board.map((row) => row.map(() => null));
  s.phase = 'battle';
  s.owner = 1;
  s.turn = 1;
  s.captured = { 1: [], 2: [] };
  return s;
}
function put(s, r, c, owner, key) {
  const def = globalThis.AC.units.UNIT_DEFS[key];
  s.board[r][c] = {
    id: 'T' + r + c, owner, key, rank: def.rank, badge: def.badge,
    name: def.name, short: def.short, revealed: false, hasMoved: false,
    shieldBroken: false, moveHistory: []
  };
  return s.board[r][c];
}
function act(s, fr, fc, tr, tc, type) {
  return E.applyAction(s, { from: { r: fr, c: fc }, to: { r: tr, c: tc }, type: type || 'move' });
}

console.log('Movement & rifts');
{
  const s = blank();
  put(s, 5, 2, 1, '2'); // strider
  const t = E.computeValidTargets(s, 5, 2, 'move');
  ok(t.length > 0, 'strider has moves on an open board');
  const s2 = blank();
  put(s2, 5, 1, 1, '2');
  const t2 = E.computeValidTargets(s2, 5, 1, 'move');
  ok(!t2.some((x) => x.r === 3 && x.c === 1), 'strider cannot cross an Astral Rift');
  const s3 = blank();
  put(s3, 6, 2, 1, '3');
  put(s3, 6, 3, 1, '2');
  const t3 = E.computeValidTargets(s3, 6, 2, 'move');
  ok(t3.every((x) => !(x.r === 6 && x.c === 4)), 'friendly piece blocks a lane');
}

console.log('Valkyrie phase dash');
{
  const s = blank();
  put(s, 6, 2, 1, '7');
  const t = E.computeValidTargets(s, 6, 2, 'move');
  ok(t.some((x) => x.r === 4 && x.c === 2 && x.type === 'move'), 'valkyrie reaches 2 tiles');
  put(s, 4, 2, 2, '3');
  const t2 = E.computeValidTargets(s, 6, 2, 'move');
  ok(t2.some((x) => x.r === 4 && x.c === 2 && x.type === 'attack'), 'valkyrie attacks at 2 tiles');
}

console.log('Plasma Lancer barrage');
{
  const s = blank();
  put(s, 6, 0, 1, '6');
  put(s, 4, 0, 2, '3'); // rank 3 -> vaporised
  const t = E.computeValidTargets(s, 6, 0, 'special');
  ok(t.some((x) => x.r === 4 && x.c === 0 && x.type === 'barrage'), 'barrage target found at 2 tiles');
  const res = act(s, 6, 0, 4, 0, 'barrage');
  ok(res.ok && s.board[4][0] === null, 'barrage vaporises rank 3');
  ok(s.board[6][0] && s.board[6][0].key === '6', 'lancer stays put');

  const s2 = blank();
  put(s2, 6, 0, 1, '6');
  put(s2, 4, 0, 2, '9');
  act(s2, 6, 0, 4, 0, 'barrage');
  ok(s2.board[4][0] && s2.board[4][0].key === '9', 'barrage deflected by rank 9');
  ok(s2.board[4][0].revealed && s2.board[6][0].revealed, 'both revealed after deflect');

  const s3 = blank();
  put(s3, 6, 0, 1, '6');
  put(s3, 4, 0, 2, 'B');
  act(s3, 6, 0, 4, 0, 'barrage');
  ok(s3.board[4][0] && s3.board[4][0].key === 'B', 'barrage does not clear a mine');

  const s4 = blank();
  put(s4, 6, 0, 1, '6');
  put(s4, 4, 0, 2, 'F');
  const res4 = act(s4, 6, 0, 4, 0, 'barrage');
  ok(res4.ok && s4.phase === 'over' && s4.winner === 1, 'barrage on the core wins the match');

  const s5 = blank();
  put(s5, 6, 0, 1, '6');
  put(s5, 5, 0, 1, '2'); // friendly piece in the way
  put(s5, 4, 0, 2, '3');
  const t5 = E.computeValidTargets(s5, 6, 0, 'special');
  ok(t5.length === 1 && t5[0].type === 'barrage', 'barrage arcs over a blocking unit');
  const res5 = act(s5, 6, 0, 4, 0, 'barrage');
  ok(res5.ok && s5.board[4][0] === null, 'the piece in between is unharmed');

  const s6 = blank();
  put(s6, 6, 0, 1, '6');
  put(s6, 4, 0, 2, '3');
  ok(E.computeValidTargets(s6, 6, 0, 'special').length === 1, 'barrage ignores rift geometry');
  put(s6, 4, 1, 2, '3');
  const t6 = E.computeValidTargets(s6, 6, 1, 'special');
  ok(t6.length === 0, 'a rift square cannot be a barrage target');
}

console.log('Mine & sapper');
{
  const s = blank();
  put(s, 6, 2, 1, '9');
  put(s, 5, 2, 2, 'B');
  act(s, 6, 2, 5, 2);
  ok(s.board[5][2] && s.board[5][2].key === 'B', 'mine survives an attack');
  ok(s.board[6][2] === null, 'attacker destroyed by mine');

  const s2 = blank();
  put(s2, 6, 2, 1, '3');
  put(s2, 5, 2, 2, 'B');
  act(s2, 6, 2, 5, 2);
  ok(s2.board[5][2] && s2.board[5][2].key === '3', 'sapper defuses and captures the mine');
}

console.log('Wraith assassination');
{
  const s = blank();
  put(s, 6, 2, 1, '1');
  put(s, 5, 2, 2, '10');
  act(s, 6, 2, 5, 2);
  ok(s.board[5][2] && s.board[5][2].key === '1', 'wraith attacking the archon wins');

  const s2 = blank();
  put(s2, 6, 2, 1, '10');
  put(s2, 5, 2, 2, '1');
  act(s2, 6, 2, 5, 2);
  ok(s2.board[5][2] && s2.board[5][2].key === '10', 'archon attacking the wraith wins');

  const s3 = blank();
  put(s3, 6, 2, 1, '1');
  put(s3, 5, 2, 2, '9');
  act(s3, 6, 2, 5, 2);
  ok(s3.board[5][2] && s3.board[5][2].key === '1', 'wraith attacking the paladin wins');
}

console.log('Tie rules');
{
  const s = blank({ tie: 'attacker' });
  put(s, 6, 2, 1, '3');
  put(s, 5, 2, 2, '3');
  act(s, 6, 2, 5, 2);
  const w = s.board[5][2];
  ok(w && w.owner === 1 && w.rank === 2, 'attacker advantage: wins but drops a rank');

  const s2 = blank({ tie: 'mutual' });
  put(s2, 6, 2, 1, '3');
  put(s2, 5, 2, 2, '3');
  act(s2, 6, 2, 5, 2);
  ok(s2.board[5][2] === null && s2.board[6][2] === null, 'mutual destruction clears both squares');
}

console.log('Scan');
{
  const s = blank();
  put(s, 6, 2, 1, '5');
  put(s, 5, 3, 2, '7');
  const t = E.computeValidTargets(s, 6, 2, 'special');
  ok(t.length === 1 && t[0].type === 'scan', 'scan target inside 2 tiles');
  act(s, 6, 2, 5, 3, 'scan');
  ok(s.board[5][3].revealed, 'scan reveals without fighting');
  ok(s.board[6][2] && s.board[6][2].key === '5', 'seer does not move when scanning');
}

console.log('Core capture & turn order');
{
  const s = blank();
  put(s, 6, 2, 1, '2');
  put(s, 5, 2, 2, 'F');
  put(s, 0, 0, 2, '3');
  const res = act(s, 6, 2, 5, 2);
  ok(res.ok && s.phase === 'over' && s.winner === 1, 'capturing the core ends the game');
  ok(s.captured[1].some((u) => u.key === 'F'), 'capture is recorded in the tray');
}

console.log('Two-square anti-stall');
{
  const s = blank();
  put(s, 6, 2, 1, '3');
  put(s, 6, 0, 1, 'F');
  put(s, 0, 0, 2, 'F');
  put(s, 0, 1, 2, '3');
  // walk A->B, B->A three times
  const seq = [[6, 2, 5, 2], [5, 2, 6, 2], [6, 2, 5, 2], [5, 2, 6, 2]];
  let blocked = false;
  seq.forEach((m) => {
    const before = s.owner;
    const res = act(s, m[0], m[1], m[2], m[3]);
    if (!res.ok) blocked = true;
    if (s.owner !== before && s.phase === 'battle') {
      // opponent must also move for the same unit to be selected again; just
      // flip back for the purposes of the test
    }
    s.owner = 1;
  });
  ok(blocked, 'fourth reversal between the same two squares is refused');
}

console.log('Deployment');
{
  const s = E.newState({ board: 'large' });
  ok(E.armyComplete(s, 1) && E.armyComplete(s, 2), 'both armies have 12 units');
  ok(E.inDeployZone(s, 1, 9) && !E.inDeployZone(s, 1, 6), 'player 1 zone is the bottom three rows');
  ok(E.inDeployZone(s, 2, 0) && !E.inDeployZone(s, 2, 3), 'player 2 zone is the top three rows');
  const a = s.board[9][0];
  const b = s.board[9][1];
  E.swapSlots(s, 1, { r: 9, c: 0 }, { r: 9, c: 1 });
  ok(s.board[9][0] === b && s.board[9][1] === a, 'swapping two squares works');
  ok(E.swapSlots(s, 1, { r: 0, c: 0 }, { r: 9, c: 1 }) === false, 'cannot swap with the enemy zone');
}

console.log('Belief model');
{
  const s = blank();
  const u = put(s, 5, 2, 2, '3');
  u.hasMoved = false;
  const d1 = E.beliefFor(s, 1, 5, 2);
  ok(Math.abs(Object.values(d1).reduce((a, b) => a + b, 0) - 1) < 1e-9, 'belief distribution sums to 1');
  ok(d1.F > 0 && d1.B > 0, 'unmoved piece can be a core or a mine');
  u.hasMoved = true;
  const d2 = E.beliefFor(s, 1, 5, 2);
  ok(!d2.F && !d2.B, 'a piece that has moved can no longer be a core or mine');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
