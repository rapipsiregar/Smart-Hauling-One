/* Act 2 - brand (14s to 22s).

   The calmest beat: the frame clears, the mark resolves, and a capsule grows
   from the centre carrying the positioning line. The capsule animates its own
   width rather than scaling, so its border radius and border weight stay
   correct throughout.

   Seam in:  the mark ignites in the slot act 1's hero sheet docked into, at
             the same scale the sheet shrank to, so the eye reads one object
             continuing rather than two objects swapping.
   Seam out: the mark becomes the carrier itself, travelling LEFT and docking
             into the gate feed's slot as act 3 arrives.

   Motion route: staged reveals. The mark lands, then the capsule pays off the
   positioning line. Nothing floats in place waiting. */

import { KineticLine } from '../type/kinetic.js';
import { LINES, CUES, SEAMS, SLOTS } from '../timeline.js';
import { seg, ramp, clamp, lerp } from '../anim.js';
import { glass, expoOut, cubicOut, settle, power4Out } from '../easing.js';
import { carry, TRAVEL } from '../seam.js';

const MARK =
  '<svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="#1a1205" ' +
  'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/></svg>';

const CUT_IN = SEAMS.problemToBrand.t;
const CUT_OUT = SEAMS.brandToSolution.t;

export function createAct2({ typeLayer }) {
  const lockup = document.createElement('div');
  lockup.className = 'lockup';
  lockup.innerHTML =
    `<div class="mark">${MARK}</div>` +
    `<div><div class="wordmark">SmartGate</div>` +
    `<div class="sub">Mining Operations</div></div>`;
  lockup.style.opacity = '0';
  typeLayer.appendChild(lockup);

  const pill = document.createElement('div');
  pill.className = 'pill';
  pill.style.opacity = '0';
  typeLayer.appendChild(pill);

  const tagline = new KineticLine(LINES.tagline, {
    size: 26,
    rise: 0,
    charRise: 8,
  });
  tagline.el.className = 'kline pilltext';
  Object.assign(tagline.el.style, {
    position: 'static',
    width: 'auto',
    margin: '0',
    fontSize: '26px',
    fontWeight: '450',
    letterSpacing: '0',
    whiteSpace: 'nowrap',
  });
  pill.appendChild(tagline.el);
  tagline.caret.style.height = '0.9em';

  return {
    update(t) {
      // --- entry: continue the carrier -----------------------------------
      // Starts at the slot and scale the tally sheet docked into, and keeps
      // moving LEFT on the same current before decelerating into place.
      // Ignites BEFORE the cut, so it is already visible and moving when the
      // tally sheet hands over rather than both sides sitting at zero opacity
      // on the same frame.
      const inP = seg(t, CUT_IN - 0.2, CUT_IN + 0.42, power4Out);
      const settleP = settle(clamp(seg(t, CUT_IN - 0.2, CUT_IN + 1.2)));
      const inOpacity = seg(t, CUT_IN - 0.2, CUT_IN + 0.1, cubicOut);

      let x = lerp(SLOTS.mark.x + TRAVEL * 0.55, 0, inP);
      let y = lerp(SLOTS.mark.y, -70, inP);
      let scale = lerp(SLOTS.mark.scale, 1, settleP);
      let opacity = inOpacity;
      let blur = (1 - inP) * 13;

      // --- exit: become the carrier ----------------------------------------
      const c = carry(
        t,
        CUT_OUT,
        { x, y, scale },
        { x: SLOTS.feed.x - TRAVEL * 0.4, y: SLOTS.feed.y, scale: SLOTS.feed.scale },
        0.52
      );
      if (t > CUT_OUT - 0.52) {
        x = c.x;
        y = c.y;
        scale = c.scale;
        opacity *= c.opacity;
        blur += c.p * 5;
      }

      lockup.style.opacity = `${clamp(opacity)}`;
      lockup.style.transform =
        `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;
      lockup.style.filter = blur > 0.05 ? `blur(${blur}px)` : 'none';

      // --- capsule ----------------------------------------------------------
      const [pa, , phold, pout] = CUES.tagline;
      const grow = seg(t, pa, pa + 0.62, glass);
      // The capsule leaves on the current with the mark rather than fading in
      // place, so both halves of the lockup exit as one object.
      const pExit = seg(t, phold, pout, power4Out);
      const pOpacity = seg(t, pa, pa + 0.3, cubicOut) * (1 - seg(t, phold, pout, cubicOut));

      pill.style.opacity = `${pOpacity}`;
      pill.style.width = `${lerp(64, 452, grow)}px`;
      pill.style.padding = '0 34px';
      pill.style.transform =
        `translate(-50%, -50%) translate(${-TRAVEL * pExit}px, ${72 - 30 * pExit}px)`;
      pill.style.filter = pExit > 0 ? `blur(${pExit * 8}px)` : 'none';

      tagline.update(t, CUES.tagline);
      // The line lives inside the capsule, so it must not re-apply the
      // centring transform the standalone lines use.
      tagline.el.style.transform = 'none';

      return {
        // Glow tightens behind the mark as it lands, then releases into the cut.
        glow: ramp(t, CUT_IN, 16.2, 0.2, 0.44, glass) * (1 - c.p * 0.5),
        spread: lerp(0.34, 0.19, seg(t, CUT_IN, 16.2, glass)),
        focusY: 0.5,
        dust: 0.6,
        dustDrift: 0.7,
        camZ: 18 - inP * 1.2,
        camX: lerp(0, -0.5, seg(t, CUT_IN, CUT_OUT, glass)),
      };
    },
  };
}
