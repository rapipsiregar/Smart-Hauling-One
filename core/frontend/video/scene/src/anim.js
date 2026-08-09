/* Timing helpers. Everything is a pure function of absolute time `t`, which is
   what makes the render deterministic: frame N is computed from N/FPS alone,
   never from elapsed wall-clock or a mutable animation state. */

import { linear } from './easing.js';

export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));

/* Normalised 0..1 progress of `t` across the window [a, b], eased. */
export function seg(t, a, b, ease = linear) {
  return ease(clamp(inv(a, b, t)));
}

/* Eased value ramp: from -> to across [a, b]. */
export function ramp(t, a, b, from, to, ease = linear) {
  return lerp(from, to, seg(t, a, b, ease));
}

/* Rises 0->1 over [a,b], holds, then falls 1->0 over [c,d]. */
export function pulse(t, a, b, c, d, ease = linear) {
  if (t < c) return seg(t, a, b, ease);
  return 1 - seg(t, c, d, ease);
}

/* True while t is inside [a, b). */
export const during = (t, a, b) => t >= a && t < b;

/* Per-item staggered window. Item `i` of `count` animates over a slice of
   [a, b]; `overlap` 0 = strictly sequential, 1 = all together. */
export function stagger(t, a, b, i, count, ease = linear, overlap = 0.65) {
  if (count <= 1) return seg(t, a, b, ease);
  const span = b - a;
  const step = span / (count - 1 + 1 / Math.max(overlap, 1e-3));
  const dur = step / Math.max(overlap, 1e-3);
  const s = a + step * i;
  return seg(t, s, s + dur, ease);
}

/* Damped spring settle, evaluated analytically so it stays deterministic. */
export function spring(t, a, from, to, freq = 3.2, damp = 0.62) {
  if (t <= a) return from;
  const x = t - a;
  const env = Math.exp(-damp * freq * 2 * Math.PI * x);
  const osc = Math.cos(freq * 2 * Math.PI * x * Math.sqrt(1 - damp * damp));
  return to - (to - from) * env * osc;
}

/* Deterministic hash noise in [-1, 1] — used for drift and dust so every run
   produces byte-identical motion. */
export function noise(seed, t, speed = 1) {
  const x = seed * 127.1 + t * speed * 43.7;
  const y = seed * 311.7 + t * speed * 27.3;
  const a = Math.sin(x) * 43758.5453;
  const b = Math.sin(y) * 22578.1459;
  return (a - Math.floor(a)) * 2 - 1 + ((b - Math.floor(b)) * 2 - 1) * 0.5;
}

/* Smooth looping drift, for cards that never sit perfectly still. */
export function drift(t, seed, amp = 1, speed = 0.12) {
  return (
    Math.sin(t * speed * 2 * Math.PI + seed * 1.7) * amp +
    Math.sin(t * speed * 3.7 * Math.PI + seed * 4.1) * amp * 0.35
  );
}

/* Blinking text cursor, 1.06s period, matching the reference's cadence. */
export const blink = (t) => (t % 1.06 < 0.62 ? 1 : 0);

/* Counts an integer up, eased — for KPI tiles rolling to their value. */
export function countTo(t, a, b, to, ease = linear, from = 0) {
  return Math.round(ramp(t, a, b, from, to, ease));
}
