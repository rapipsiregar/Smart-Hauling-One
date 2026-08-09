/* Headless render.

   Frames are captured one at a time from a virtual clock and piped straight
   into ffmpeg's stdin. Two reasons this is the right shape:

   1. Determinism. The page never advances on its own; each frame is produced
      by seeking to exactly N/FPS. A frame that takes 400ms to rasterise still
      lands at its exact timestamp, so the output is perfectly smooth even
      though the render is far slower than real time. Screen-recording the
      page would drop and duplicate frames instead.
   2. Disk. 5400 lossless 1080p frames is roughly 15GB on disk; piping keeps
      the whole render at zero intermediate storage.

   Usage: node video/render.js [--out file.mp4] [--from 0] [--to 90] [--fast]
*/

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const { start } = require('./server');

const SCENE = path.join(__dirname, 'scene');
const OUT_DIR = path.join(__dirname, 'out');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

const FAST = flag('fast');
const OUT = path.resolve(arg('out', path.join(OUT_DIR, 'smartgate-ritase.mp4')));

function ffmpeg(fps, width, height) {
  const args = [
    '-y',
    '-f', 'image2pipe',
    '-c:v', FAST ? 'mjpeg' : 'png',
    '-r', String(fps),
    '-i', 'pipe:0',
    '-an',
    '-c:v', 'libx264',
    '-preset', FAST ? 'veryfast' : 'slow',
    // crf 16 keeps the glass gradients clean; the grain layer in the scene
    // gives the encoder dither to work with so large soft fields do not band.
    '-crf', FAST ? '20' : '16',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'high',
    '-level', '4.2',
    // Even GOP so the file scrubs predictably in an editor.
    '-g', String(fps * 2),
    '-movflags', '+faststart',
    '-s', `${width}x${height}`,
    OUT,
  ];
  const p = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let log = '';
  p.stderr.on('data', (d) => {
    log += d.toString();
    if (log.length > 40000) log = log.slice(-20000);
  });
  p.on('exit', (code) => {
    if (code !== 0) {
      console.error('\nffmpeg failed:\n' + log.slice(-4000));
    }
  });
  return p;
}

/* Writes to a stream, respecting backpressure. Without this the Node heap
   grows until the process dies partway through a long render.

   Both listeners are removed on settle. Leaving the 'error' handler attached
   after a successful drain leaks one listener per stalled frame, which trips
   the MaxListeners warning within seconds and holds the buffers alive. */
function write(stream, buf) {
  return new Promise((resolve, reject) => {
    if (stream.write(buf)) return resolve();
    const onDrain = () => {
      stream.off('error', onError);
      resolve();
    };
    const onError = (e) => {
      stream.off('drain', onDrain);
      reject(e);
    };
    stream.once('drain', onDrain);
    stream.once('error', onError);
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const { server, port } = await start(SCENE);

  /* Hardware rasterisation, by a wide margin.
     Measured per-frame screenshot cost at 1920x1080 on this machine:

       act              swiftshader     d3d11
       1 (blurred DOF)      6866ms      210ms
       3 (feed + HUD)       1301ms      178ms
       5 (tour panels)      1398ms      128ms

     The CSS blur() used for depth of field is what kills software
     rasterisation - it is 33x faster on the GPU. Determinism is unaffected
     for our purposes: the scene is a pure function of time, so a re-render on
     the same machine is identical, and cross-machine byte-equality was never
     a requirement. Pass --swiftshader if a GPU is unavailable. */
  const gpuArgs = flag('swiftshader')
    ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    : [
        '--use-gl=angle',
        '--use-angle=d3d11',
        '--ignore-gpu-blocklist',
        '--enable-gpu-rasterization',
        '--enable-zero-copy',
      ];

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--disable-lcd-text',
      '--disable-frame-rate-limit',
      '--disable-gpu-vsync',
      '--font-render-hinting=none',
      ...gpuArgs,
    ],
  });

  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[page]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('[console]', m.text());
  });
  // A renderer crash surfaces downstream as an opaque "detached Frame" error,
  // so name it here instead.
  page.on('error', (e) => console.error('[renderer crashed]', e.message));

  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}/index.html`, {
    waitUntil: 'networkidle0',
  });

  await page.waitForFunction('window.__ready === true || window.__error', {
    timeout: 120000,
  });
  const err = await page.evaluate(() => window.__error);
  if (err) throw new Error('scene failed to boot:\n' + err);

  const meta = await page.evaluate(() => window.__meta);
  const fps = meta.fps;
  const from = parseFloat(arg('from', '0'));
  const to = parseFloat(arg('to', String(meta.duration)));
  const first = Math.round(from * fps);
  const last = Math.round(to * fps);
  const total = last - first;

  console.log(
    `rendering ${total} frames  ${meta.w}x${meta.h} @${fps}fps  ` +
    `(${from}s to ${to}s)${FAST ? '  [fast]' : ''}`
  );

  const enc = ffmpeg(fps, meta.w, meta.h);
  const done = new Promise((res, rej) => {
    enc.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
  });

  const t0 = Date.now();
  const shotOpts = FAST
    ? { type: 'jpeg', quality: 96, optimizeForSpeed: true }
    : { type: 'png', optimizeForSpeed: true };

  for (let i = first; i < last; i++) {
    const t = i / fps;
    await page.evaluate((tt) => window.__seek(tt), t);
    const buf = await page.screenshot(shotOpts);
    await write(enc.stdin, buf);

    if ((i - first) % 60 === 0 || i === last - 1) {
      const n = i - first + 1;
      const el = (Date.now() - t0) / 1000;
      const rate = n / el;
      const eta = (total - n) / Math.max(rate, 0.01);
      process.stdout.write(
        `\r  ${n}/${total}  ${(n / total * 100).toFixed(1)}%  ` +
        `${rate.toFixed(1)} fps  eta ${Math.round(eta)}s     `
      );
    }
  }

  enc.stdin.end();
  await done;
  await browser.close();
  server.close();

  const mb = (fs.statSync(OUT).size / 1e6).toFixed(1);
  console.log(`\ndone  ${OUT}  ${mb} MB  ${Math.round((Date.now() - t0) / 1000)}s`);
}

main().catch((e) => {
  console.error('\n' + (e.stack || e.message));
  process.exit(1);
});
