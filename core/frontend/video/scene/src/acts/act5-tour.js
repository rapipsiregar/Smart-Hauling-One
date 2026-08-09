/* Act 5 - product tour (52s to 78s).

   Two screens here, the export beat lives in beat-export.js. Panels are built
   at the app's real 1600x980 and scaled down, so every label stays sharp and
   the proportions match what a user actually sees. */

import { Panel } from '../ui/panel.js';
import { dashboardScreen, ledgerScreen } from '../ui/screens.js';
import { KineticLine } from '../type/kinetic.js';
import { LINES, CUES, SEAMS, BEATS } from '../timeline.js';
import { seg, lerp, clamp, countTo, stagger } from '../anim.js';
import { glass, expoOut, cubicOut, quintOut, settle } from '../easing.js';
import { enter as enterSeam, exit as exitSeam } from '../seam.js';
import { createExportBeat } from './beat-export.js';

const W = 1600;
const H = 980;

/* Act boundary in, plus the two internal screen changes. All three run LEFT.
   The ledger previously entered from the left while the dashboard exited left,
   which is a direction reversal between consecutive boundaries - the doctrine
   calls this a ping-pong and it reads as an error rather than as motion. */
const CUT_IN = SEAMS.flipToTour.t;
const CUT_LEDGER = BEATS.ledger;
const CUT_REPORT = BEATS.report;

/* Rows that start unresolved and flip to auto-matched during the beat. */
const RESOLVE_ORDER = [0, 4, 5, 6, 7, 9, 11];
const CHECK_PATH =
  'M9 12l2 2 4-4M12 3l7.8 3.5v5c0 4.6-3.2 8.9-7.8 10-4.6-1.1-7.8-5.4-7.8-10v-5z';

export function createAct5(ctx) {
  const { world, typeLayer } = ctx;

  const dash = new Panel(dashboardScreen(), { w: W, h: H, className: 'rim' })
    .mount(world);
  const ledg = new Panel(ledgerScreen(), { w: W, h: H, className: 'rim' })
    .mount(world);

  const kpis = dash.queryAll('[data-kpi] [data-count]');
  const rows = dash.queryAll('[data-row]');
  const lrows = ledg.queryAll('[data-lrow]');
  const recs = ledg.queryAll('[data-rec]');
  const lcount = ledg.query('[data-lcount]');

  const live = new KineticLine(LINES.live, { size: 70, y: -404 }).mount(typeLayer);
  const trace = new KineticLine(LINES.trace, { size: 70, y: -404 }).mount(typeLayer);

  const exp = createExportBeat(ctx);

  return {
    update(t) {
      // --- dashboard -------------------------------------------------------
      // Sustained motion here is "camera with intent": a mapped push that runs
      // the whole time the screen is up, plus the staged reveals below. No
      // idle float.
      const dEnt = enterSeam(t, CUT_IN, 'left');
      const dExt = exitSeam(t, CUT_LEDGER, 'left');
      const dComp = settle(clamp(seg(t, CUT_IN, CUT_IN + 1.5)));
      const dPush = seg(t, 55.4, 58.8, glass);
      const dVis = dEnt.opacity * dExt.opacity;

      dash.set({
        x: 40 + dEnt.dx + dExt.dx - dPush * 96,
        y: 92 + dPush * 22,
        z: lerp(-230, -120, dComp) + dPush * 200,
        ry: lerp(-15, -8, dComp) + dPush * 3,
        rx: lerp(7, 3, dComp),
        scale: lerp(0.74, 0.82, dComp) * lerp(1, 1.09, dPush),
        opacity: dVis,
        blur: dEnt.blur + dExt.blur,
      });

      if (dVis > 0.01) {
        // KPI tiles roll to their values instead of appearing populated.
        const targets = [36, 30, 5];
        kpis.forEach((el, i) => {
          // Starts as the panel is still arriving, so the screen never sits
          // on screen showing zeros.
          const v = countTo(t, 52.7 + i * 0.2, 54.4 + i * 0.2, targets[i], expoOut);
          if (el.textContent !== String(v)) el.textContent = String(v);
        });
        rows.forEach((r, i) => {
          const p = stagger(t, 53.6, 57.0, i, rows.length, expoOut, 0.5);
          r.style.opacity = `${p}`;
          r.style.transform = `translateX(${(1 - p) * 34}px)`;
        });
      }

      // --- ledger -----------------------------------------------------------
      // Enters from the RIGHT travelling left, same as the dashboard exit, so
      // the two boundaries share one vector instead of reversing.
      const lEnt = enterSeam(t, CUT_LEDGER, 'left');
      const lExt = exitSeam(t, CUT_REPORT, 'left');
      const lComp = settle(clamp(seg(t, CUT_LEDGER, CUT_LEDGER + 1.5)));
      const lPush = seg(t, 62.6, 66.8, glass);
      const lVis = lEnt.opacity * lExt.opacity;

      ledg.set({
        x: -30 + lEnt.dx + lExt.dx - lPush * 84,
        y: 96 - lPush * 26,
        z: lerp(-240, -140, lComp) + lPush * 230,
        ry: lerp(-15, -8, lComp),
        rx: lerp(8, 3, lComp),
        scale: lerp(0.74, 0.82, lComp) * lerp(1, 1.1, lPush),
        opacity: lVis,
        blur: lEnt.blur + lExt.blur,
      });

      if (lVis > 0.01) {
        lrows.forEach((r, i) => {
          const p = stagger(t, 59.5, 62.6, i, lrows.length, expoOut, 0.5);
          r.style.opacity = `${p}`;
          r.style.transform = `translateX(${(1 - p) * -28}px)`;
        });

        // Unresolved rows reconcile one by one; this is the screen's payoff.
        let resolved = 5;
        RESOLVE_ORDER.forEach((idx, k) => {
          const at = 64.0 + k * 0.42;
          const on = t >= at;
          const el = recs[idx];
          if (!el) return;
          if (on && el.dataset.on !== '1') {
            el.dataset.on = '1';
            el.className = 'lrec ok';
            el.innerHTML =
              `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" ` +
              `stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ` +
              `stroke-linejoin="round"><path d="${CHECK_PATH}"/></svg>` +
              `<em>Auto-matched</em>`;
          } else if (!on && el.dataset.on === '1') {
            el.dataset.on = '0';
            el.className = 'lrec lock';
            el.innerHTML =
              `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" ` +
              `stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ` +
              `stroke-linejoin="round"><path d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4"/></svg>` +
              `<em>Locked — needs review</em>`;
          }
          if (on) resolved++;
          // Brief highlight sweep on the row that just flipped.
          const hot = t >= at && t < at + 0.5;
          lrows[idx].classList.toggle('hot', hot);
        });

        lcount.innerHTML =
          `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" ` +
          `stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ` +
          `stroke-linejoin="round"><path d="${CHECK_PATH}"/></svg> ` +
          `${Math.min(resolved * 3, 36)}/36 reconciled`;
      }

      live.update(t, CUES.live);
      trace.update(t, CUES.trace);

      const expState = exp.update(t) || {};

      return {
        glow: 0.32,
        spread: 0.3,
        focusY: 0.52,
        dust: 0.24,
        dustDrift: 0.55,
        camZ: 18,
        camX: lerp(-0.4, 0.4, seg(t, 52, 78, glass)),
        ...expState,
      };
    },
  };
}
