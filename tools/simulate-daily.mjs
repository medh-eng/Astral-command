/* Reproducible candidate screening, not a claim about human win rates.
 * node tools/simulate-daily.mjs [games per modifier per board=60]
 * Optional --seed=0x51f15e selects an independent seed bank.
 * Optional --write saves incoming/text/daily-balance.json.
 * Optional --output=incoming/text/daily-balance-<label>.json saves a separate
 * report, preserving the first seed bank for independent confirmation.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
for (const file of ['units', 'geometry', 'engine', 'ai', 'modes']) {
  vm.runInThisContext(fs.readFileSync(new URL('js/' + file + '.js', root), 'utf8'));
}
const { engine: E, ai, modes: M } = globalThis.AC;
const games = Number(process.argv[2] || 60);
assert.ok(Number.isInteger(games) && games > 0);
const mods = M.MODIFIERS.concat(JSON.parse(fs.readFileSync(new URL('incoming/text/daily-modifiers.json', root))));
const seedArg = process.argv.find(a => a.startsWith('--seed='));
const seedBase = seedArg ? Number(seedArg.slice(7)) : 0x51f15e;
assert.ok(Number.isInteger(seedBase) && seedBase >= 0 && seedBase <= 0xffffffff);
const outputArg = process.argv.find(a => a.startsWith('--output='));
const output = outputArg ? outputArg.slice('--output='.length) : 'incoming/text/daily-balance.json';
assert.match(output, /^incoming\/text\/daily-balance(?:-[a-z0-9-]+)?\.json$/,
  'balance reports must stay inside incoming/text/ with a daily-balance filename');
const results = [];
const base = M.dailyInfo(new Date('2026-11-01T12:00:00+05:30'));
for (const mod of mods) {
  for (const boardKey of ['wheel', 'padma']) {
    let wins = 0, orders = 0;
    const reasons = {};
    for (let i = 0; i < games; i++) {
      // Shared seed bank across variants makes comparisons paired.
      const info = { ...base, mod, boardKey, seed: (seedBase + i * 0x9e3779b9) >>> 0 };
      const s = M.buildDaily(info), rng = M.dailyRng(s, info.seed);
      let guard = 0;
      while (s.phase === 'battle' && guard++ < 200) {
        const action = ai.chooseAction(s, s.owner, 'veteran', rng);
        assert.ok(action, mod.key + ' missing action');
        assert.ok(E.applyAction(s, action).ok, mod.key + ' illegal action');
      }
      assert.equal(s.phase, 'over', mod.key + ' did not terminate');
      if (s.winner === 1) wins++;
      orders += guard;
      reasons[s.reason] = (reasons[s.reason] || 0) + 1;
    }
    const rate = wins / games;
    const row = { key: mod.key, board: boardKey, games, raiderWins: wins,
      winPercent: Math.round(rate * 1000) / 10, inTarget: rate >= .30 && rate <= .55,
      meanOrders: Math.round(orders / games * 10) / 10, reasons };
    results.push(row);
    console.log(`${mod.key.padEnd(16)} ${boardKey.padEnd(5)} ${wins}/${games} (${row.winPercent}%) ${row.inTarget ? 'screen-in' : 'hold'}`);
  }
}
if (process.argv.includes('--write') || outputArg) {
  fs.writeFileSync(new URL(output, root), JSON.stringify({
    seedBase,
    method: 'Dronacharya vs Dronacharya; paired seed bank seedBase + i * 0x9e3779b9; both geometries; 30–55% screening band. Small samples, not human balance validation. Candidates remain drafts.',
    gamesPerVariantPerBoard: games, results
  }, null, 2) + '\n');
}
