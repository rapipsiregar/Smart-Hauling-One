/* Bootstrap.

   Exposes window.__seek(t) and window.__ready. The renderer drives those two
   and nothing else, so the scene has no notion of frame rate or wall time. */

import { GL } from './gl/renderer.js';
import { Director } from './director.js';
import { ACTS, WIDTH, HEIGHT, DURATION, FPS } from './timeline.js';
import { PAPER_CSS } from './ui/paper.js';
import { SCREEN_CSS } from './ui/screens.js';

import { createAct1 } from './acts/act1-problem.js';
import { createAct2 } from './acts/act2-brand.js';
import { createAct3 } from './acts/act3-solution.js';
import { createAct4 } from './acts/act4-flip.js';
import { createAct5 } from './acts/act5-tour.js';
import { createAct6 } from './acts/act6-outro.js';

function injectCSS(css) {
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
}

/* Grain is generated once as a data URI rather than shipped as an asset, so
   the scene folder stays free of binary files. */
function makeGrain() {
  const c = document.createElement('canvas');
  c.width = c.height = 180;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(180, 180);
  let s = 987654321;
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const v = s % 256;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  document.documentElement.style.setProperty(
    '--grain-src',
    `url(${c.toDataURL('image/png')})`
  );
}

async function boot() {
  injectCSS(PAPER_CSS);
  injectCSS(SCREEN_CSS);
  makeGrain();

  const stage = document.getElementById('stage');
  const world = document.getElementById('world');
  const typeLayer = document.getElementById('type');
  const fx = document.getElementById('fx');

  const gl = new GL(document.getElementById('gl'), WIDTH, HEIGHT);

  const ctx = { world, typeLayer, fx, stage };

  const acts = [
    { name: 'problem', ...ACTS.problem, act: createAct1(ctx) },
    { name: 'brand', ...ACTS.brand, act: createAct2(ctx) },
    { name: 'solution', ...ACTS.solution, act: createAct3(ctx) },
    { name: 'flip', ...ACTS.flip, act: createAct4(ctx) },
    { name: 'tour', ...ACTS.tour, act: createAct5(ctx) },
    { name: 'outro', ...ACTS.outro, act: createAct6(ctx) },
  ];

  const director = new Director({
    gl,
    stage,
    flash: document.getElementById('flash'),
    fade: document.getElementById('fade'),
    acts,
  });

  // Fonts must be resolved before the first capture or early frames render in
  // a fallback face and the video visibly reflows on frame ~2.
  await document.fonts.ready;
  // Warm every act once so first-touch layout and shader compilation are paid
  // before capture rather than stalling the first frames. A coarse sweep is
  // enough to touch every act; a fine one just burns boot time.
  for (let i = 0; i <= DURATION; i += 2) director.update(i);
  director.update(0);

  window.__seek = (t) => {
    director.update(t);
    return true;
  };
  window.__meta = { duration: DURATION, fps: FPS, w: WIDTH, h: HEIGHT };
  window.__ready = true;
}

boot().catch((err) => {
  window.__error = String((err && err.stack) || err);
  console.error(err);
});
