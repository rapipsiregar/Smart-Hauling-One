/* Act 6 - payoff and outro (78s to 90s).

   Payoff line, then the line-art fan draws on behind the lockup, matching the
   reference's close. The lockup is the same mark and wording as the app
   sidebar, with no product claims added on the end card. */

import { KineticLine } from '../type/kinetic.js';
import { LINES, CUES } from '../timeline.js';
import { seg, lerp, clamp } from '../anim.js';
import { glass, expoOut, cubicOut, settle } from '../easing.js';

const MARK =
  '<svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="#1a1205" ' +
  'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/></svg>';

export function createAct6({ typeLayer }) {
  /* Enters rising, mirroring the success ring's upward exit: the ring
     accelerates up on power4In and this picks the motion up mid-flight rather
     than starting from rest. `dir: up` keeps the whole outro chapter on that
     one reserved elevation vector instead of reverting to the current. */
  const payoff = new KineticLine(LINES.payoff, {
    size: 78,
    rise: 170,
    dir: 'up',
  }).mount(typeLayer);

  const lockup = document.createElement('div');
  lockup.className = 'lockup';
  lockup.innerHTML =
    `<div class="mark">${MARK}</div>` +
    `<div><div class="wordmark">SmartGate</div>` +
    `<div class="sub">Mining Operations</div></div>`;
  lockup.style.opacity = '0';
  typeLayer.appendChild(lockup);

  return {
    update(t) {
      payoff.update(t, CUES.payoff);

      const [a, , hold, out] = CUES.outroMark;
      const inP = seg(t, a, a + 1.2, expoOut);
      const outP = seg(t, hold, out, cubicOut);
      const o = inP * (1 - outP);

      const sc = lerp(0.88, 1, settle(clamp(seg(t, a, a + 1.5))));
      lockup.style.opacity = `${o}`;
      // Rises into place on the same elevation vector the payoff line left on.
      lockup.style.transform =
        `translate(-50%, -50%) translateY(${-14 + (1 - inP) * 120}px) scale(${sc})`;
      lockup.style.filter = inP < 1 ? `blur(${(1 - inP) * 14}px)` : 'none';

      // The strokes sweep in behind the lockup and hold to the last frame.
      const draw = seg(t, 83.2, 88.0, cubicOut);
      const linesOpacity = seg(t, 83.0, 84.4, cubicOut) * (1 - seg(t, 89.2, 90.0));

      return {
        glow: lerp(0.34, 0.46, seg(t, 84, 87, glass)),
        spread: lerp(0.26, 0.2, seg(t, 84, 88, glass)),
        focusY: 0.5,
        dust: 0.2,
        dustDrift: 0.5,
        camZ: 18 - seg(t, 78, 90, glass) * 1.8,
        lines: draw,
        linesOpacity,
      };
    },
  };
}
