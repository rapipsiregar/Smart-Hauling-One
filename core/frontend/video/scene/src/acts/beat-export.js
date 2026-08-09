/* Act 5, final beat: the shift report and the export.

   Ends on the reference's success device - a ring completing into a tick.
   Here it means the shift report is written, which is the actual deliverable
   a supervisor needs at the end of a shift. */

import { Panel } from '../ui/panel.js';
import { reportScreen } from '../ui/screens.js';
import { KineticLine } from '../type/kinetic.js';
import { LINES, CUES, SEAMS, BEATS } from '../timeline.js';
import { seg, lerp, clamp, countTo, stagger } from '../anim.js';
import { glass, expoOut, cubicOut, quintOut, settle, power4In } from '../easing.js';
import { enter as enterSeam, exit as exitSeam, TRAVEL } from '../seam.js';

const CUT_IN = BEATS.report;
const CUT_OUT = BEATS.reportOut;
/* The outro seam spends UP - the one reserved elevation vector in the film.
   The doctrine assigns upward to "a conclusion or reveal rising above what
   came before", which is exactly what the finished shift report is. */
const CUT_OUTRO = SEAMS.tourToOutro.t;

const W = 1600;
const H = 980;
const R = 118;
const CIRC = 2 * Math.PI * R;

const CURSOR =
  '<svg viewBox="0 0 24 24" fill="#fff" stroke="#0f172a" stroke-width="1.2">' +
  '<path d="M5 3l14 7.5-6.2 1.6L9.6 19z"/></svg>';

export function createExportBeat({ world, typeLayer, fx }) {
  const rep = new Panel(reportScreen(), { w: W, h: H, className: 'rim' })
    .mount(world);

  const bars = rep.queryAll('.bfill');
  const rks = rep.queryAll('[data-rk] b');
  const pdfBtn = rep.query('[data-btn="pdf"]');
  const xlsBtn = rep.query('[data-btn="excel"]');

  const close = new KineticLine(LINES.close, { size: 70, y: -404 }).mount(typeLayer);

  // Cursor and click ripple live in the fx layer so they sit above the panel.
  const cursor = document.createElement('div');
  cursor.className = 'cursor';
  cursor.innerHTML = CURSOR;
  cursor.style.opacity = '0';
  fx.appendChild(cursor);

  const ripple = document.createElement('div');
  ripple.className = 'ripple';
  ripple.style.opacity = '0';
  fx.appendChild(ripple);

  // Success ring.
  const ring = document.createElement('div');
  ring.className = 'ringwrap';
  ring.innerHTML =
    `<svg viewBox="0 0 260 260">` +
    `<circle class="ringtrack" cx="130" cy="130" r="${R}"/>` +
    `<circle class="ringarc" cx="130" cy="130" r="${R}" ` +
    `stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"/>` +
    `<path class="ringtick" d="M88 132 l28 28 l56 -60" ` +
    `stroke-dasharray="120" stroke-dashoffset="120"/>` +
    `</svg><div class="ringlbl">Laporan shift siap</div>`;
  ring.style.opacity = '0';
  typeLayer.appendChild(ring);

  const arc = ring.querySelector('.ringarc');
  const tick = ring.querySelector('.ringtick');
  const lbl = ring.querySelector('.ringlbl');

  return {
    update(t) {
      if (t < 67.6) {
        rep.set({ opacity: 0 });
        cursor.style.opacity = '0';
        ripple.style.opacity = '0';
        ring.style.opacity = '0';
        return null;
      }

      // --- report panel ----------------------------------------------------
      const rEnt = enterSeam(t, CUT_IN, 'left');
      const rExt = exitSeam(t, CUT_OUT, 'left');
      const rComp = settle(clamp(seg(t, CUT_IN, CUT_IN + 1.6)));
      const rPush = seg(t, 71.2, 74.8, glass);
      const rVis = rEnt.opacity * rExt.opacity;

      rep.set({
        x: 20 + rEnt.dx + rExt.dx - rPush * 44,
        y: 96 - rPush * 36,
        z: lerp(-250, -140, rComp) + rPush * 210,
        ry: lerp(-14, -6, rComp) + rPush * 3,
        rx: lerp(8, 2.6, rComp),
        scale: lerp(0.74, 0.82, rComp) * lerp(1, 1.09, rPush),
        opacity: rVis,
        blur: rEnt.blur + rExt.blur,
      });

      if (rVis > 0.01) {
        // Per-gate bars grow to their measured widths.
        bars.forEach((b, i) => {
          const p = stagger(t, 68.3, 71.6, i, bars.length, expoOut, 0.55);
          b.style.width = `${(parseFloat(b.dataset.w) || 0) * p}%`;
        });
        const vals = ['2', '36', '32', '71.2%'];
        rks.forEach((el, i) => {
          const p = seg(t, 68.4 + i * 0.18, 70.2 + i * 0.18, expoOut);
          const target = vals[i];
          const txt =
            i === 3
              ? `${(71.2 * p).toFixed(1)}%`
              : String(Math.round(parseFloat(target) * p));
          if (el.textContent !== txt) el.textContent = txt;
        });
      }

      // --- cursor and click -------------------------------------------------
      // Moves from the Excel button across to PDF, then presses.
      const move = seg(t, 73.0, 74.5, glass);
      const showCur = seg(t, 72.8, 73.2) * (1 - seg(t, 75.2, 75.6));
      cursor.style.opacity = `${showCur}`;
      const cx = lerp(1108, 1226, move);
      const cy = lerp(596, 596, move);
      cursor.style.left = `${cx}px`;
      cursor.style.top = `${cy}px`;

      const press = seg(t, 74.6, 74.78) * (1 - seg(t, 74.78, 74.95));
      cursor.style.transform = `scale(${1 - press * 0.18})`;
      pdfBtn.style.filter = press > 0.2 ? 'brightness(1.25)' : 'none';
      xlsBtn.style.filter = 'none';

      const rp = seg(t, 74.7, 75.5, cubicOut);
      if (rp > 0 && rp < 1) {
        const size = lerp(10, 130, rp);
        ripple.style.left = `${cx + 8}px`;
        ripple.style.top = `${cy + 8}px`;
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.opacity = `${(1 - rp) * 0.75}`;
      } else {
        ripple.style.opacity = '0';
      }

      // --- success ring ------------------------------------------------------
      const ringIn = seg(t, 75.9, 76.3, cubicOut);
      const sweep = seg(t, 76.0, 77.4, expoOut);
      const tickP = seg(t, 77.3, 77.85, cubicOut);
      // Carrier for the outro seam: the completed ring accelerates UPWARD on
      // power4In and dies exactly on the cut, while act 6's payoff line enters
      // from below on the matching power4Out. One object, rising.
      const ringGo = seg(t, 77.9, CUT_OUTRO + 0.3, power4In);
      const ringOut = seg(t, CUT_OUTRO - 0.04, CUT_OUTRO + 0.3, cubicOut);
      const ringVis = ringIn * (1 - ringOut);

      ring.style.opacity = `${ringVis}`;
      ring.style.transform =
        `translate(-50%, -50%) translateY(${-30 - TRAVEL * ringGo}px) ` +
        `scale(${lerp(0.86, 1, settle(clamp(seg(t, 75.9, 76.8))))})`;
      arc.setAttribute('stroke-dashoffset', `${CIRC * (1 - sweep)}`);
      tick.setAttribute('stroke-dashoffset', `${120 * (1 - tickP)}`);
      lbl.style.opacity = `${seg(t, 77.5, 77.95, cubicOut) * (1 - ringOut)}`;

      close.update(t, CUES.close);

      if (t < 75.4) return null;
      return {
        glow: lerp(0.32, 0.2, seg(t, 75.4, 77.4, glass)),
        spread: 0.24,
        focusY: 0.5,
        dust: 0.18,
      };
    },
  };
}
