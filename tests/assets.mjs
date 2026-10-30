/* VYUHA — asset path and voice-coverage regressions.
 * Read-only: checks the existing media files, not their subjective quality.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'js/art.js'), 'utf8');
const loaded = [];
class FakeImage {
  set src(value) {
    loaded.push(value);
    if (existsSync(join(root, value))) this.onload?.();
    else this.onerror?.();
  }
}
const context = {
  Image: FakeImage,
  console,
  document: {
    documentElement: { style: { setProperty() {} } },
    body: { classList: { add() {} } },
  },
};
vm.runInNewContext(source, context, { filename: 'js/art.js' });
const art = context.AC.art;

for (const [slot, expected] of [
  ['sky:day', 'assets/art/opt/ui/day.jpg'],
  ['sky:night', 'assets/art/opt/ui/night.jpg'],
  ['ui:breach', 'assets/art/opt/ui/breach.jpg'],
  ['portrait:sanjaya-anim', 'assets/art/opt/portraits/sanjaya-anim.webp'],
  ['hero:arjuna', 'assets/art/opt/heroes/arjuna.webp'],
  ['astra:agneya-anim', 'assets/art/opt/astras/agneya-anim.webp'],
]) {
  const resolved = art.artFor(slot);
  assert.equal(loaded.at(-1), expected, `${slot} must request the shipped asset path`);
  assert.equal(resolved, expected, `${slot} must resolve to an existing asset`);
}

const html = readFileSync(join(root, 'index.html'), 'utf8');
const og = html.match(/<meta property="og:image" content="([^"]+)"/);
assert.ok(og, 'share preview must declare an og:image');
assert.ok(og[1].startsWith('https://'), 'social crawlers need an absolute image URL');
const imagePath = new URL(og[1]).pathname.replace(/^\/vyuha\//, '');
assert.ok(existsSync(join(root, imagePath)), 'share preview must point to shipped image');

const csv = readFileSync(join(root, 'docs/voice/sanjaya-lines.csv'), 'utf8');
const voiceIds = csv.split(/\r?\n/).slice(1).map(line => /^"([^"]+)"/.exec(line)?.[1]).filter(Boolean);
assert.equal(voiceIds.length, 44, 'voice script declares 44 cues');
for (const language of ['hi', 'en']) {
  for (const id of voiceIds) {
    assert.ok(existsSync(join(root, 'assets/audio/voice', language, id + '.mp3')), `missing ${language} narration: ${id}`);
  }
}

console.log(`Asset paths: 6 resolved; OG preview: valid; narration: ${voiceIds.length * 2} files found.`);
