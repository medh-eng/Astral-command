/* Builds a single-file, fully offline copy of the game.
 *   node tools/build-standalone.mjs
 * Output: aetherfront-standalone.html — one file you can email, drop on a USB
 * stick, or open by double-clicking with no server and no network.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

let html = read('index.html');

// 1. inline the stylesheet
const css = read('css/app.css');
html = html.replace(
  /<link rel="stylesheet" href="css\/app\.css" \/>/,
  '<style>\n' + css + '\n</style>'
);

// 2. inline every script in document order
const scriptRe = /<script src="(js\/[a-z]+\.js)"><\/script>/g;
html = html.replace(scriptRe, (_, src) => {
  const code = read(src);
  if (code.includes('</script')) throw new Error('script tag terminator inside ' + src);
  return '<script>\n/* ' + src + ' */\n' + code + '\n</script>';
});

// 3. inline the icon as a data URI so the tab still has art offline
const icon = read('assets/icon.svg').replace(/\n/g, '');
const iconUri = 'data:image/svg+xml;base64,' + Buffer.from(icon, 'utf8').toString('base64');
html = html.replace(/<link rel="icon" href="assets\/icon.svg" type="image\/svg\+xml" \/>/,
  '<link rel="icon" href="' + iconUri + '" type="image/svg+xml" />');
html = html.replace(/<link rel="apple-touch-icon" href="assets\/icon.svg" \/>/,
  '<link rel="apple-touch-icon" href="' + iconUri + '" />');
html = html.replace(/<link rel="manifest" href="manifest.webmanifest" \/>\n?/, '');

// 4. note in the head that this is the portable build
html = html.replace('<title>', '<!-- Aetherfront single-file build — no server or network required -->\n<title>');

const out = path.join(root, 'aetherfront-standalone.html');
fs.writeFileSync(out, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log('wrote aetherfront-standalone.html (' + kb + ' KB)');
