/* Seams — cut-the-curve boundaries.

   Every act boundary is a velocity-matched cut, not a crossfade. The outgoing
   content accelerates along the film's current, the cut lands while both sides
   are still moving, and the incoming content continues the SAME direction and
   decelerates into place.

   Three rules this encodes, and why each matters:

   - Mirrored eases. Exit rides power4In, entry rides power4Out, over the same
     distance and duration. They are the two halves of one power4InOut, so
     velocity matches exactly at the cut. An .inOut ease on either side alone
     puts a velocity of zero at the boundary, which is what reads as a slide
     change.
   - Partial travel. Content moves ~12% of frame (230px at 1920) and fades,
     rather than flying fully off-stage. Long travel leaves a gap in which
     nothing is moving.
   - Overlap. The entry starts BEFORE the cut and the exit finishes just after
     it, so there is never a frame where the screen is empty. That empty frame
     is the "dead beat" - the thing that makes acts read as separate slides.

   The previous cut of this video violated all three. */

import { seg, clamp } from './anim.js';
import { power4In, power4Out, cubicOut } from './easing.js';

/* ~12% of a 1920 frame. */
export const TRAVEL = 230;

/* The film's current. Ordinary seams all run LEFT; UP and Z are reserved and
   spending one is a statement (see timeline.SEAMS). */
export const VECTOR = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

/* The overlap window is the whole point, and it has to be generous.

   An earlier pass had the outgoing side die exactly on the cut and the
   incoming side ignite exactly on the cut, which sounds symmetrical but means
   both are at zero opacity on the same frame - the screen empties for a beat
   and the seam reads as a slide change. The outgoing side must survive well
   past the cut while still moving, and the incoming side must ignite before
   it, so there is always something in flight. */
const EXIT_DUR = 0.40;
const EXIT_HANG = 0.30;  // how far past the cut the outgoing side survives
const ENTRY_DUR = 0.52;
const ENTRY_LEAD = 0.20; // how far before the cut the entry ignites

/* Outgoing side of a seam at `cut`.
   Returns { dx, dy, opacity, blur, gone } in the direction of travel. */
export function exit(t, cut, dir = 'left', opts = {}) {
  const v = VECTOR[dir] || VECTOR.left;
  const dur = opts.dur ?? EXIT_DUR;
  const hang = opts.hang ?? EXIT_HANG;
  const travel = opts.travel ?? TRAVEL;

  // Motion accelerates through the cut and keeps going past it, so the
  // outgoing side is at its fastest exactly when the incoming side takes over.
  const p = seg(t, cut - dur, cut + hang, power4In);
  // Fades across the cut rather than before it, holding presence through the
  // overlap window.
  const o = 1 - seg(t, cut - 0.1, cut + hang, cubicOut);

  return {
    dx: v.x * travel * p,
    dy: v.y * travel * p,
    opacity: clamp(o),
    blur: p * (opts.blur ?? 9),
    gone: t >= cut + hang,
  };
}

/* Incoming side of a seam at `cut`. Starts one TRAVEL back along the current
   and decelerates to rest, igniting mid-path. */
export function enter(t, cut, dir = 'left', opts = {}) {
  const v = VECTOR[dir] || VECTOR.left;
  const dur = opts.dur ?? ENTRY_DUR;
  const lead = opts.lead ?? ENTRY_LEAD;
  const travel = opts.travel ?? TRAVEL;

  const s = cut - lead;
  const p = seg(t, s, s + dur, power4Out);
  // Ignites around mid-path rather than at the start, so the element is
  // already moving before it becomes visible.
  const o = seg(t, s + dur * 0.15, s + dur * 0.85, cubicOut);

  return {
    // Enters from the direction it will continue travelling towards, i.e. the
    // opposite side of the frame from the exit.
    dx: -v.x * travel * (1 - p),
    dy: -v.y * travel * (1 - p),
    opacity: clamp(o),
    blur: (1 - p) * (opts.blur ?? 9),
    started: t >= s,
    p,
  };
}

/* Combines both sides for content that lives between two seams. `inCut` may be
   null for the first act, `outCut` null for the last. */
export function span(t, inCut, outCut, dir = 'left', opts = {}) {
  const a = inCut == null
    ? { dx: 0, dy: 0, opacity: 1, blur: 0, p: 1 }
    : enter(t, inCut, dir, opts);
  const b = outCut == null
    ? { dx: 0, dy: 0, opacity: 1, blur: 0 }
    : exit(t, outCut, dir, opts);

  return {
    dx: a.dx + b.dx,
    dy: a.dy + b.dy,
    opacity: a.opacity * b.opacity,
    blur: a.blur + b.blur,
    p: a.p,
  };
}

/* Carrier hand-off.

   `from` and `to` are {x, y, scale} in stage space. Returns the carrier's
   position at time t as it travels from its resting place into the slot the
   next act's element will occupy, arriving exactly at the cut with the
   velocity the current implies. The incoming element ignites at that same
   point, so the eye tracks one object across the boundary instead of watching
   one thing vanish and another appear. */
export function carry(t, cut, from, to, dur = 0.5) {
  const p = seg(t, cut - dur, cut, power4In);
  return {
    x: from.x + (to.x - from.x) * p,
    y: from.y + (to.y - from.y) * p,
    scale: (from.scale ?? 1) + ((to.scale ?? 1) - (from.scale ?? 1)) * p,
    // The carrier survives past the cut, overlapping its successor's first
    // moments. Killing it on the cut frame leaves the screen empty while the
    // incoming line is still only a caret.
    opacity: 1 - seg(t, cut - 0.04, cut + EXIT_HANG, cubicOut),
    p,
  };
}
