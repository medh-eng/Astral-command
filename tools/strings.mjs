/* Exports every player-facing game text that lives in data (pieces, astras,
 * hours, formations, the lesson, the daily modifiers, the main buttons) into
 * one flat file for translators.
 *   node tools/strings.mjs
 * Output: docs/i18n/strings.en.json   { "key": "English text", … }
 * Translators return docs/i18n/strings.hi.json and strings.mr.json with the
 * same keys. Keys never change meaning; when a text changes, its key changes.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
// modes.js needs a few engine globals at load time; a light stub is enough
globalThis.AC = { ui: { esc: (s) => String(s) }, fx: {}, art: {} };
['js/units.js', 'js/geometry.js', 'js/engine.js', 'js/modes.js'].forEach((f) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
});
const { units: U, modes: M } = globalThis.AC;

const out = {};
const put = (k, v) => { if (v) out[k] = v; };

Object.values(U.UNIT_DEFS).forEach((u) => {
  put('unit.' + u.key + '.role', u.role);
  put('unit.' + u.key + '.one', u.one);
  put('unit.' + u.key + '.desc', u.desc);
  put('unit.' + u.key + '.tip', u.tip);
});
Object.values(U.ASTRA_DEFS).forEach((a) => {
  put('astra.' + a.key + '.one', a.one);
  put('astra.' + a.key + '.desc', a.desc);
});
Object.values(U.HOURS).forEach((h) => put('hour.' + h.key + '.one', h.one));
Object.values(U.FORMATIONS).forEach((f) => put('formation.' + f.key + '.one', f.one));
Object.values(U.BOARDS).forEach((b) => put('board.' + b.key + '.blurb', b.blurb));
Object.values(U.DIFFICULTIES).forEach((d) => put('opponent.' + d.key + '.blurb', d.blurb));
Object.values(U.SCENARIOS).forEach((s) => put('scenario.' + s.key + '.blurb', s.blurb));
M.LESSON.forEach((l) => { put('lesson.' + l.key + '.title', l.title); put('lesson.' + l.key + '.text', l.text); });
M.MODIFIERS.forEach((m) => { put('daily.' + m.key + '.name', m.name); put('daily.' + m.key + '.one', m.one); });

// the main interface labels
Object.assign(out, {
  'home.tagline': 'Abhimanyu got in. Can you get out?',
  'home.quick': 'Yuddh karo',
  'home.quick.sub': 'Quick battle',
  'home.daily': 'Daily Chakravyuha',
  'home.daily.sub': 'Same wheel for everyone today',
  'home.lesson': 'Pehla Yuddh',
  'home.lesson.sub': 'Learn the field in two minutes',
  'home.custom': 'Custom battle',
  'home.custom.sub': 'Board, opponent, scenario and rules',
  'home.continue': 'Continue',
  'home.saves': 'Saved games',
  'home.codex': 'Codex',
  'home.record': 'Your record',
  'battle.your_move': 'Your move',
  'battle.tap_hint': 'Tap a piece, then a glowing cell. Or invoke an astra.',
  'battle.tap_again': 'Tap the target again to strike.',
  'battle.thinking': 'is thinking',
  'battle.round': 'Round',
  'battle.lock': 'Lock formation',
  'battle.advisor': 'Advisor',
  'battle.move_strike': 'Move / Strike',
  'battle.volley': 'Volley',
  'battle.look': 'Drishti',
  'result.victory': 'Victory',
  'result.defeat': 'Defeat',
  'result.shared': 'The field is shared',
  'result.share': 'Share result',
  'result.rematch': 'Rematch',
  'share.cta': 'Abhimanyu got in. Can you get out?',
  'gate.broken': 'The gate is broken. One more blow takes the fort.',
  'sky.day': 'Dawn — the hour of Surya',
  'sky.night': 'Night — the hour of Chandra'
});

const file = path.join(root, 'docs/i18n/strings.en.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
console.log('wrote ' + path.relative(root, file) + ' — ' + Object.keys(out).length + ' strings');
