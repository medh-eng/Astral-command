/* Writes Sanjaya's full voice script from js/sanjaya.js, so the recording list
 * can never drift from the game.
 *   node tools/voice-script.mjs
 * Output: docs/voice/sanjaya-lines.csv
 *   id, event, hindi (speak this), english (speak this for the English voice),
 *   hinglish (on-screen only), and the two file names to save as.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
vm.runInThisContext(fs.readFileSync(path.join(root, 'js/sanjaya.js'), 'utf8'), { filename: 'sanjaya.js' });
const lines = globalThis.AC.sanjaya.allLines();

const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
const rows = [['id', 'event', 'hindi_voice_text', 'english_voice_text', 'hinglish_screen_text', 'save_hindi_as', 'save_english_as']];
lines.forEach((l) => {
  rows.push([l.id, l.key, l.hi, l.en, l.hinglish,
    'assets/audio/voice/hi/' + l.id + '.mp3',
    'assets/audio/voice/en/' + l.id + '.mp3']);
});
const out = path.join(root, 'docs/voice/sanjaya-lines.csv');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, '﻿' + rows.map((r) => r.map(q).join(',')).join('\n') + '\n');
console.log('wrote ' + path.relative(root, out) + ' — ' + lines.length + ' lines');
