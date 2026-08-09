/* Easing curves.
   `glass` is the exact cubic-bezier the SmartGate app already uses for its
   card transitions (globals.css), so motion in the video matches the product. */

export const linear = (t) => t;

export const cubicOut = (t) => 1 - Math.pow(1 - t, 3);
export const cubicIn = (t) => t * t * t;
export const cubicInOut = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const quartOut = (t) => 1 - Math.pow(1 - t, 4);
export const quartIn = (t) => t * t * t * t;
export const quintOut = (t) => 1 - Math.pow(1 - t, 5);

/* The two halves of one power4.inOut. Used as a mirrored pair either side of a
   seam: an exit on power4In and an entry on power4Out over the same distance
   and duration have matching velocity at the cut, which is what stops the eye
   noticing the boundary. Never use an .inOut ease on one side of a cut. */
export const power4In = quartIn;
export const power4Out = quartOut;

export const expoOut = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const expoIn = (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));
export const expoInOut = (t) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2
    : (2 - Math.pow(2, -20 * t + 10)) / 2;
};

export const backOut = (t, s = 1.70158) =>
  1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);

export const sineInOut = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

/* Solves a CSS cubic-bezier(x1,y1,x2,y2) by Newton iteration on x. */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t) => (3 * ax * t + 2 * bx) * t + cx;

  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-6) return sampleY(t);
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    // Bisection fallback for the flat regions Newton struggles with.
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 20; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-6) break;
      if (dx > 0) hi = t;
      else lo = t;
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}

/* The app's own card easing: cubic-bezier(0.16, 1, 0.3, 1). */
export const glass = bezier(0.16, 1, 0.3, 1);

/* Soft overshoot for cards settling into place. */
export const settle = bezier(0.22, 1.12, 0.36, 1);
