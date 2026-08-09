/* Act 4 - the act break (48s to 52s).

   A hard cut from the dark pit to the light review theme. The reference uses
   the same move at its midpoint, and it works because it is abrupt: the flash
   and theme swap land on one frame, and only the type carries across. Both
   palettes here are the app's own tokens, so this is a real theme the product
   ships rather than a device invented for the video. */

import { KineticLine } from '../type/kinetic.js';
import { LINES, CUES, THEME_FLIP, SEAMS, SLOTS } from '../timeline.js';
import { seg, ramp, lerp, clamp } from '../anim.js';
import { glass, expoOut, cubicOut } from '../easing.js';
import { carry } from '../seam.js';

const CUT_OUT = SEAMS.flipToTour.t;

export function createAct4({ typeLayer }) {
  const check = new KineticLine(LINES.check, { size: 88 }).mount(typeLayer);

  // Four-point sparkle that pops on the flip, echoing the reference's glyph.
  const star = document.createElement('div');
  star.style.cssText =
    'position:absolute;left:50%;top:50%;width:120px;height:120px;' +
    'margin:-60px 0 0 -60px;opacity:0;pointer-events:none;';
  star.innerHTML =
    '<svg viewBox="0 0 100 100" width="120" height="120">' +
    '<path d="M50 4 C54 34 66 46 96 50 C66 54 54 66 50 96 ' +
    'C46 66 34 54 4 50 C34 46 46 34 50 4 Z" fill="currentColor"/></svg>';
  star.style.color = 'var(--accent)';
  typeLayer.appendChild(star);

  return {
    update(t) {
      check.update(t, CUES.check);

      const p = seg(t, THEME_FLIP - 0.1, THEME_FLIP + 0.8, expoOut);

      // The sparkle is this seam's carrier: it flies LEFT out of the headline
      // and docks at the corner the dashboard panel arrives in, so the eye is
      // already at the right place when act 5 ignites.
      const c = carry(
        t,
        CUT_OUT,
        { x: 250, y: -40, scale: 1 },
        { x: SLOTS.dash.x - 300, y: SLOTS.dash.y - 250, scale: 0.34 },
        0.6
      );
      const carrying = t > CUT_OUT - 0.6;

      const x = carrying ? c.x : lerp(120, 250, p);
      const y = carrying ? c.y : lerp(20, -40, p);
      const sc = (carrying ? c.scale : lerp(0.2, 1, p));
      const op = p * 0.9 * (carrying ? c.opacity : 1);

      star.style.opacity = `${clamp(op)}`;
      star.style.transform =
        `translate(${x}px, ${y}px) ` +
        `rotate(${lerp(-40, 26, p) + (carrying ? c.p * 90 : 0)}deg) scale(${sc})`;
      star.style.filter = `drop-shadow(0 0 26px rgba(var(--accent-rgb), .8))`;

      return {
        // The light act runs a much softer field; a dark-act glow value would
        // blow out against a near-white background.
        glow: t < THEME_FLIP ? ramp(t, 48, 49, 0.4, 0.5, glass) : 0.34,
        spread: 0.26,
        focusY: 0.5,
        dust: t < THEME_FLIP ? 0.5 : 0.26,
        dustDrift: 0.6,
        camZ: 18 - seg(t, 48, 52.3, glass) * 1.4,
      };
    },
  };
}
