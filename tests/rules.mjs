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

// The classic tests run with the Chapter III layers off; the Chapter III
// section below switches them on explicitly.
const CLASSIC = { gates: false, hours: false, vyuha: false, astras: false };
function blank(config) {
  const s = E.newState(Object.assign({ board: 'small', rules: CLASSIC }, config || {}));
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
  ok(s.phase === 'over' && s.winner === 0, 'four quiet orders between equal armies end in a shared field');
  ok(/ceasefire/i.test(s.reason), 'the ceasefire reason is reported');
}

console.log('Abhimanyu — the breach');
{
  const s = E.newState({ board: 'wheel', scenario: 'abhimanyu' });
  ok(s.scenario === 'abhimanyu', 'the scenario is recorded on the state');
  ok(s.rosters[1].length === 8 && s.rosters[2].length === 10, 'eight raiders against ten defenders');
  ok(s.rosters[1].indexOf('F') === -1 && s.rosters[1].indexOf('B') === -1, 'the raiders carry no fort and no trap');
  ok(s.turnLimit === 28, 'the breach has a round limit');
  let n1 = 0;
  let n2 = 0;
  E.forEachUnit(s, (u) => { if (u.owner === 1) n1++; else n2++; });
  ok(n1 === 8 && n2 === 10, 'both sides deploy their own roster');
  ok(E.armyComplete(s, 1) && E.armyComplete(s, 2), 'both armies count as complete');

  const pool = E.unknownPool(s, 2);
  ok(!pool.F && !pool.B, 'the defender knows the raiders have no fort or trap');
  ok(Object.keys(pool).reduce((a, k) => a + pool[k], 0) === 8, 'the defender has eight unknowns to track');

  // running out of rounds hands the defence the match
  const s2 = E.newState({ board: 'wheel', scenario: 'abhimanyu' });
  s2.phase = 'battle';
  s2.turn = s2.turnLimit;
  s2.owner = 2;
  put(s2, 'r3s0', 2, '3');
  put(s2, 'r3s1', 2, '2');
  const move = E.allLegalActions(s2, 2)[0];
  if (move) E.applyAction(s2, move);
  ok(s2.phase === 'over' && s2.winner === 2, 'the defence wins when the rounds run out');
  ok(/rounds ran out/i.test(s2.reason), 'and says why');

  // taking the fort still wins it for the raiders
  const s3 = E.newState({ board: 'wheel', scenario: 'abhimanyu' });
  s3.board = {};
  s3.phase = 'battle';
  s3.owner = 1;
  s3.turn = 1;
  put(s3, 'r3s4', 1, '2');
  put(s3, 'r3s5', 2, 'F').breached = true;   // the gate is already down
  put(s3, 'r3s6', 2, '3');
  const res3 = act(s3, 'r3s4', 'r3s5');
  ok(res3.ok && s3.winner === 1, 'capturing the fort wins the breach');
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

/* ══ Chapter III — Shakti ══════════════════════════════════════════ */
const FULL = { gates: true, hours: true, vyuha: true, astras: true };
function fresh(config) {
  const s = blank(Object.assign({ rules: FULL }, config || {}));
  s.shakti = { 1: 0, 2: 0 };
  s.astrasUsed = { 1: {}, 2: {} };
  s.astraLog = [];
  return s;
}

console.log('The fort gate');
{
  const s = fresh();
  s.sky.startNight = false;
  put(s, '6,2', 1, '2');
  put(s, '6,3', 1, '3');
  const fort = put(s, '5,2', 2, 'F');
  put(s, '0,0', 2, '3');
  const res = act(s, '6,2', '5,2');
  ok(res.ok && s.phase === 'battle', 'the first blow does not end the match');
  ok(fort.breached && fort.revealed, 'it breaks the gate and reveals the fort');
  ok(s.board['6,2'] && s.board['6,2'].key === '2' && s.board['5,2'] === fort, 'the attacker stays where it was');
  ok(res.events.some((e) => e.kind === 'breach'), 'a breach event is raised');
  act(s, '0,0', '0,1');
  act(s, '6,2', '5,2');
  ok(s.phase === 'over' && s.winner === 1, 'the second blow takes the fort');

  const v = fresh();
  put(v, '7,2', 1, '6');
  const f2 = put(v, '5,2', 2, 'F');
  put(v, '0,0', 2, '3');
  act(v, '7,2', '5,2', 'barrage');
  ok(f2.breached && v.phase === 'battle', 'a volley breaks the gate too');
}

console.log('The hours of Surya and Chandra');
{
  const s = fresh();
  s.sky.startNight = true;
  s.turn = 1;
  ok(E.hourOf(s) === 'night' && E.hourOwner(s) === 2, 'a duel opens in the hour of Chandra');
  s.turn = 5;
  ok(E.hourOf(s) === 'day' && E.hourOwner(s) === 1, 'the sky turns on round 5');
  s.turn = 10;
  ok(E.hourOf(s) === 'night', 'and again on round 10');

  const d = fresh();
  d.sky.startNight = false;            // Surya's hour
  put(d, '6,2', 1, '5');
  put(d, '5,2', 2, '5');
  put(d, '0,0', 2, '3');
  const ctx = E.combatContext(d, '6,2', '5,2');
  ok(ctx.att === 1 && ctx.attParts[0].key === 'surya', 'in your hour you strike at +1');
  act(d, '6,2', '5,2');
  ok(d.board['5,2'] && d.board['5,2'].owner === 1 && !d.board['5,2'].shieldBroken, 'equal ranks: the hour decides it cleanly');

  const n = fresh();
  n.sky.startNight = true;             // not Surya's hour
  put(n, '6,2', 1, '5');
  put(n, '5,2', 2, '5');
  ok(E.combatContext(n, '6,2', '5,2').att === 0, 'out of your hour there is no bonus');
}

console.log('Formations — Makara and Padma');
{
  const s = fresh({ tie: 'mutual' });
  s.sky.startNight = true;             // no hour bonus for Suryavansh
  put(s, '6,2', 1, '5');
  put(s, '5,3', 1, '2');               // the second jaw, beside the target
  put(s, '5,2', 2, '6');
  put(s, '0,0', 2, '3');
  const ctx = E.combatContext(s, '6,2', '5,2');
  ok(ctx.att === 1 && ctx.attParts.some((p) => p.key === 'makara'), 'a pincer gives the attacker +1');
  act(s, '6,2', '5,2');
  ok(!s.board['5,2'] && !s.board['6,2'], 'a 5 in a pincer meets a 6 as an equal');

  const p = fresh();
  p.sky.startNight = true;
  put(p, '6,2', 1, '6');
  put(p, '5,2', 2, '5');
  put(p, '4,2', 2, '2');
  put(p, '5,1', 2, '3');               // two petals around the defender
  const ctx2 = E.combatContext(p, '6,2', '5,2');
  ok(ctx2.def === 1, 'a piece guarded by two friends defends at +1');

  const c = fresh();
  c.sky.startNight = false;
  put(c, '6,2', 1, '9');
  put(c, '5,3', 1, '2');
  put(c, '5,2', 2, '10');
  ok(E.combatContext(c, '6,2', '5,2').att === 2, 'hour and pincer stack');
  act(c, '6,2', '5,2');
  ok(c.board['5,2'] && c.board['5,2'].key === '9', 'a Maharathi in its hour, in a pincer, topples the Senapati');

  const a = fresh();
  a.sky.startNight = true;
  put(a, '6,2', 1, '1');
  put(a, '5,2', 2, '10');
  put(a, '4,2', 2, '2');
  put(a, '5,3', 2, '3');
  act(a, '6,2', '5,2');
  ok(a.board['5,2'] && a.board['5,2'].key === '1', 'the Chara’s first strike ignores the petals');
}

console.log('Shakti');
{
  const s = fresh();
  s.sky.startNight = true;
  put(s, '6,2', 1, '9');
  put(s, '5,2', 2, '3');
  put(s, '0,0', 2, '3');
  act(s, '6,2', '5,2');
  ok(s.shakti[1] === 1 && s.shakti[2] === 0, 'taking a piece grows your Shakti by one');
  s.shakti[1] = 5;
  put(s, '4,0', 2, '2');
  act(s, '0,0', '0,1');
  act(s, '5,2', '4,2');
  ok(s.shakti[1] === 5, 'Shakti never passes five');

  const t = fresh();
  t.turn = 4;
  t.owner = 2;
  put(t, '7,0', 1, '3');
  put(t, '0,0', 2, '3');
  act(t, '0,0', '0,1');
  ok(t.turn === 5 && t.shakti[1] === 1 && t.shakti[2] === 1, 'the turning sky gives both sides one Shakti');
}

console.log('Astras');
{
  const s = fresh();
  s.shakti[1] = 5;
  const a = put(s, '7,0', 1, 'F');
  const b = put(s, '6,5', 1, '3');
  put(s, '0,0', 2, '3');
  let res = E.applyAction(s, { type: 'astra', astra: 'vayavya', from: '7,0', to: '6,5' });
  ok(res.ok && s.board['6,5'] === a && s.board['7,0'] === b, 'Vayavyastra swaps two of your pieces — even the fort');
  ok(s.shakti[1] === 4 && s.astrasUsed[1].vayavya, 'it costs one Shakti and is spent');
  ok(!a.revealed && !b.revealed, 'both stay hidden');
  act(s, '0,0', '0,1');
  res = E.applyAction(s, { type: 'astra', astra: 'vayavya', from: '6,5', to: '7,0' });
  ok(!res.ok, 'each astra works once per match');

  const t = fresh();
  t.shakti[1] = 2;
  put(t, '6,2', 1, '3');
  const foe = put(t, '4,2', 2, '9');
  put(t, '0,0', 2, '2');
  ok(E.astraTargets(t, 1, 'sammohana').indexOf('4,2') !== -1, 'Sammohanastra reaches two cells out');
  ok(E.astraTargets(t, 1, 'sammohana').indexOf('0,0') === -1, 'but no further');
  E.applyAction(t, { type: 'astra', astra: 'sammohana', to: '4,2' });
  ok(foe.stun === 2 && E.computeValidTargets(t, '4,2', 'move').length === 0, 'the entranced piece cannot act');
  act(t, '0,0', '0,1');
  ok(t.owner === 1, 'its side still plays its other pieces');
  act(t, '6,2', '6,3');
  act(t, '0,1', '0,0');
  act(t, '6,3', '6,2');
  ok(foe.stun === 0 && E.computeValidTargets(t, '4,2', 'move').length > 0, 'the trance lasts two of its owner’s turns');

  const lone = fresh();
  lone.shakti[1] = 2;
  put(lone, '6,2', 1, '3');
  put(lone, '4,2', 2, '9');
  put(lone, '0,0', 2, 'F');
  E.applyAction(lone, { type: 'astra', astra: 'sammohana', to: '4,2' });
  ok(lone.phase === 'battle' && lone.owner === 1, 'a side with only entranced pieces loses its turn, not the match');

  const f = fresh();
  f.shakti[1] = 5;
  put(f, '6,2', 1, '3');
  put(f, '5,2', 2, '3');
  put(f, '5,3', 2, '7');
  const trap = put(f, '4,2', 2, 'B');
  const fort = put(f, '4,3', 2, 'F');
  E.applyAction(f, { type: 'astra', astra: 'agneya', to: '5,2' });
  ok(!f.board['5,2'], 'Agneyastra burns a rank 3');
  ok(f.shakti[1] === 3, 'the fire costs three (and the kill gave one back)');

  const f2 = fresh();
  f2.shakti[1] = 3;
  put(f2, '6,2', 1, '3');
  const seven = put(f2, '5,2', 2, '7');
  put(f2, '0,0', 2, '2');
  E.applyAction(f2, { type: 'astra', astra: 'agneya', to: '5,2' });
  ok(f2.board['5,2'] === seven && seven.revealed, 'a rank 7 walks through the fire, revealed');

  const f3 = fresh();
  f3.shakti[1] = 3;
  put(f3, '6,2', 1, '3');
  const t3 = put(f3, '5,2', 2, 'B');
  put(f3, '0,0', 2, '2');
  E.applyAction(f3, { type: 'astra', astra: 'agneya', to: '5,2' });
  ok(!f3.board['5,2'], 'fire burns a Shataghni');
  void t3; void trap; void fort;

  const f4 = fresh();
  f4.shakti[1] = 3;
  put(f4, '6,2', 1, '3');
  const fo = put(f4, '5,2', 2, 'F');
  put(f4, '0,0', 2, '2');
  E.applyAction(f4, { type: 'astra', astra: 'agneya', to: '5,2' });
  ok(fo.breached && f4.phase === 'battle', 'fire breaks a fort gate but does not take the fort');

  const br = fresh();
  br.shakti[1] = 5;
  put(br, '6,2', 1, '3');
  put(br, '5,2', 2, '10');
  const nb = put(br, '4,2', 2, '2');
  put(br, '5,1', 2, 'F');
  put(br, '0,0', 2, '2');
  ok(E.astraTargets(br, 1, 'brahma').indexOf('5,1') === -1, 'Brahmastra cannot touch the fort');
  E.applyAction(br, { type: 'astra', astra: 'brahma', to: '5,2' });
  ok(!br.board['5,2'], 'Brahmastra destroys even the Senapati');
  ok(nb.revealed && br.board['5,1'].revealed, 'and lays bare every piece around it');

  const nr = fresh();
  nr.shakti[1] = 1;
  put(nr, '6,2', 1, '3');
  put(nr, '6,3', 1, '2');
  put(nr, '0,0', 2, '2');
  ok(!E.applyAction(nr, { type: 'astra', astra: 'sammohana', to: '0,0' }).ok, 'an astra needs its Shakti');
}

console.log('Ceasefire');
{
  const s = fresh({ roundCap: 3 });
  s.turn = 3;
  s.owner = 2;
  put(s, '7,0', 1, '10');
  put(s, '0,0', 2, '3');
  act(s, '0,0', '0,1');
  ok(s.phase === 'over' && s.winner === 1, 'at sunset the stronger army holds the field');
  ok(/sunset/i.test(s.reason), 'and the reason says so');
}

console.log('Formations that cannot lose the fort on move one');
{
  let bad = 0;
  ['small', 'large', 'wheel', 'padma'].forEach((bk) => {
    for (let i = 0; i < 120; i++) {
      const s = E.newState({ board: bk });
      E.deployPreset(s, 2, 'shuffle');
      const depth = E.depthMap(s, 2);
      let max = 0;
      G.build(bk).zones[2].forEach((id) => { if (depth[id] > max) max = depth[id]; });
      const fortAt = E.findUnit(s, (u) => u.owner === 2 && u.key === 'F');
      if (depth[fortAt] !== max) bad++;
    }
  });
  ok(bad === 0, 'a shuffled fort always sits in the deepest line');
}

console.log('Padmavyuha');
{
  const g = G.build('padma');
  ok(g.cells.length === 37, 'the lotus has 37 cells');
  ok(g.zones[1].length === 15 && g.zones[2].length === 15, 'each side deploys on fifteen');
  const ringOk = [1, 2].every((ring) => {
    const order = g.rotationOrder[ring];
    return order.every((id, i) => g.neighbours[id].indexOf(order[(i + 1) % order.length]) !== -1);
  });
  ok(ringOk, 'each turning ring steps to a neighbour');
  const s = E.newState({ board: 'padma' });
  ok(E.armyComplete(s, 1) && E.armyComplete(s, 2), 'both armies deploy on the lotus');
}

console.log('The opponent does not peek');
{
  const AI = globalThis.AC.ai;
  const s = fresh();
  put(s, '0,2', 2, 'B');               // deepest unmoved piece is the trap
  put(s, '1,4', 2, 'F');               // the real fort is shallower
  put(s, '7,0', 1, '3');
  ok(AI.fortGuess(s, 1) === '0,2', 'it aims at the deepest unmoved piece, not the hidden fort');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
