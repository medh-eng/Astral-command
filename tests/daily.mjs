/* Daily invariants and regressions: no DOM or packages needed. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
for (const file of ['units', 'geometry', 'engine', 'ai', 'modes']) {
  vm.runInThisContext(fs.readFileSync(new URL('js/' + file + '.js', root), 'utf8'));
}
const { engine: E, ai, modes: M } = globalThis.AC;
const candidates = JSON.parse(fs.readFileSync(new URL('incoming/text/daily-modifiers.json', root)));
assert.equal(candidates.length, 25);
assert.equal(new Set(candidates.map(m => m.key)).size, 25);
const sunday = M.dailyInfo(new Date('2026-11-01T12:00:00+05:30'));
assert.equal(sunday.boardKey, 'padma');
assert.equal(M.buildDaily(sunday).boardKey, 'padma', 'Sunday must actually deploy on the lotus');
assert.equal(M.dailyInfo(new Date('2026-10-31T18:29:59Z')).day.key, '2026-10-31');
assert.equal(M.dailyInfo(new Date('2026-10-31T18:30:00Z')).day.key, '2026-11-01');
for (const mod of M.MODIFIERS.concat(candidates)) {
  M.validateModifier(mod);
  for (const boardKey of ['wheel', 'padma']) {
    const info = { ...sunday, mod, boardKey };
    const a = M.buildDaily(info), b = M.buildDaily(info);
    assert.equal(a.boardKey, boardKey);
    assert.deepEqual(a.board, b.board, 'same seed deploys the same army');
    assert.equal(Object.values(a.board).filter(u => u && u.owner === 1).length, 8);
    assert.equal(Object.values(a.board).filter(u => u && u.owner === 2).length, 10);
    assert.equal(Object.values(a.board).filter(u => u && u.key === 'F').length, 1);
    const fort = Object.values(a.board).find(u => u && u.key === 'F');
    assert.equal(!!fort.breached, !!mod.knobs.gateOpen);
    assert.equal(a.turnLimit, mod.knobs.turnLimit || 24);
    assert.equal(a.rotation.every, mod.knobs.rotateEvery || 5);
    assert.equal(a.shakti[1], mod.knobs.startShakti?.raiders ?? 2);
    assert.equal(a.shakti[2], mod.knobs.startShakti?.defenders ?? 0);
    assert.equal(a.sky.startNight, mod.knobs.startNight || false);
  }
}
for (const knobs of [{ turnLimit: 31 }, { rotateEvery: 2 }, { gateOpen: 'yes' },
  { startShakti: { raiders: -1, defenders: 0 } }, { surprise: true },
  { raiders: ['F'] }, { defenders: Array(10).fill('F') }]) {
  assert.throws(() => M.validateModifier({ key: 'bad', deva: 'दोष', name: 'Bad', one: 'Bad.', knobs }));
}
// Supplying an RNG must cover scoring, noise, and Archon's simulated replies.
for (const difficulty of ['recruit', 'veteran', 'archon']) {
  const a = M.buildDaily(sunday), b = E.clone(a);
  const ra = M.dailyRng(a, sunday.seed), rb = M.dailyRng(b, sunday.seed);
  const original = Math.random;
  Math.random = () => { throw new Error('Unseeded randomness during a Daily action'); };
  try {
    for (let i = 0; i < 6; i++) {
      const aa = ai.chooseAction(a, a.owner, difficulty, ra);
      const ab = ai.chooseAction(b, b.owner, difficulty, rb);
      assert.deepEqual(aa, ab);
      assert.ok(E.applyAction(a, aa).ok);
      assert.ok(E.applyAction(b, ab).ok);
    }
  } finally { Math.random = original; }
  const restored = E.deserialize(E.serialize(a)), rr = M.dailyRng(restored, sunday.seed);
  assert.deepEqual(ai.chooseAction(a, a.owner, difficulty, ra),
    ai.chooseAction(restored, restored.owner, difficulty, rr), 'restoring continues the saved RNG');
}
// Catalogue II starts on 1 Nov 2026 (IST): earlier puzzles never change, and
// the retired "gate is open" never appears after it.
assert.equal(M.dailyInfo(new Date('2026-10-30T12:00:00+05:30')).mod.key, 'open', 'past puzzles keep their modifier');
assert.equal(M.dailyInfo(new Date('2026-10-31T12:00:00+05:30')).mod.key, 'twin', 'past puzzles keep their modifier');
for (let d = 0; d < 120; d++) {
  const info = M.dailyInfo(new Date(Date.UTC(2026, 10, 1, 6) + d * 86400000));
  assert.notEqual(info.mod.key, 'open', 'the retired modifier stays retired');
  assert.ok(M.MODIFIERS_II.includes(info.mod), 'catalogue II from 1 Nov');
}
assert.equal(M.MODIFIERS_II.length, 21);
console.log('Daily regressions passed: 30 modifiers, both boards, IST rollover, seeded AI and saved RNG.');
