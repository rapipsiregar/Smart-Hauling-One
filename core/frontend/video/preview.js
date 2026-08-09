/* Frame preview.

   Grabs stills at chosen timestamps and, by default, tiles them into a single
   contact sheet. Checking composition this way takes seconds, where a full
   render takes many minutes.

   Usage: node video/preview.js [--at 2,16,26,...] [--sheet] [--cols 4]
*/

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const { start } = require('./server');

const SCENE = path.join(__dirname, 'scene');
const OUT = path.join(__dirname, 'out', 'preview');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/* One timestamp per act beat, chosen to land mid-hold rather than mid-transition. */
const DEFAULT_AT = [
  2.4, 5.0, 9.6, 12.0,
  16.8, 19.4,
  24.2, 27.4, 31.6, 34.2, 38.6, 41.2, 44.0, 46.4,
  50.4,
  55.2, 57.6, 62.4, 65.8, 70.8, 73.4, 76.6, 77.9,
  81.2, 86.0, 88.4,
];

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const at = arg('at', '')
    ? arg('at', '').split(',').map(Number)
    : DEFAULT_AT;

  const { server, port } = await start(SCENE);
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--disable-lcd-text',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--font-render-hinting=none',
    ],
  });

  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[page]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('[console]', m.text());
  });

  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__ready === true || window.__error', { timeout: 120000 });

  const err = await page.evaluate(() => window.__error);
  if (err) throw new Error('scene failed to boot:\n' + err);

  const files = [];
  for (const t of at) {
    await page.evaluate((tt) => window.__seek(tt), t);
    const name = `t${String(t).padStart(5, '0').replace('.', '_')}.png`;
    const file = path.join(OUT, name);
    await page.screenshot({ path: file });
    files.push(file);
    console.log('  ', t.toFixed(1) + 's', name);
  }

  await browser.close();
  server.close();

  if (process.argv.includes('--sheet')) {
    const cols = parseInt(arg('cols', '4'), 10);
    const sheet = path.join(__dirname, 'out', 'preview-sheet.png');
    // Scale each still down before tiling, so the sheet stays readable
    // without being enormous.
    const args = [
      '-y',
      ...files.flatMap((f) => ['-i', f]),
      '-filter_complex',
      `${files.map((_, i) => `[${i}:v]scale=440:-1[s${i}];`).join('')}` +
      `${files.map((_, i) => `[s${i}]`).join('')}xstack=inputs=${files.length}:` +
      `layout=${layout(files.length, cols)}[out]`,
      '-map', '[out]',
      sheet,
    ];
    await run('ffmpeg', args);
    console.log('sheet ->', sheet);
  }

  console.log('frames ->', OUT);
}

/* xstack layout string: w0_0|w0_h0|... expressed in the column/row grid. */
function layout(n, cols) {
  const cells = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = c === 0 ? '0' : Array.from({ length: c }, (_, k) => `w${k}`).join('+');
    const y = r === 0 ? '0' : Array.from({ length: r }, (_, k) => `h${k * cols}`).join('+');
    cells.push(`${x}_${y}`);
  }
  return cells.join('|');
}

function run(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let log = '';
    p.stderr.on('data', (d) => (log += d.toString()));
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(log.slice(-3000)))));
  });
}

main().catch((e) => {
  console.error('\n' + (e.stack || e.message));
  process.exit(1);
});
