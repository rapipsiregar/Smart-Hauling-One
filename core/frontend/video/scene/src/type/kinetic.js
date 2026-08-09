/* Kinetic type-on lines.

   Reference behaviour, frame-checked against the source video: the line is
   revealed one character at a time behind a caret, and the whole line
   re-centres as it grows. That re-centring is why unrevealed characters are
   display:none rather than hidden - hidden characters would reserve their
   width and the line would sit off-centre while typing.

   Each character's reveal time is computed ANALYTICALLY by inverting the
   typing curve, not recorded the first time the character is drawn. Recording
   it seems simpler and is a trap: the stored timestamp makes the line's
   appearance depend on which times were rendered before it, so a fresh seek to
   t and an in-order arrival at t produce different pixels. That broke the
   scene's core contract and, in practice, rendered lines with their first
   letters missing, because the boot warm-up sweep left stamps in the future.

   Lines leave along the film's current, so the last thing moving before a cut
   is already travelling the way the next act will arrive from. */

import { seg, clamp, blink, lerp } from '../anim.js';
import { glass, expoOut, cubicOut, power4In } from '../easing.js';
import { TRAVEL, VECTOR } from '../seam.js';

/* How long one character takes to fade and rise into place. */
const CHAR_FADE = 0.26;

export class KineticLine {
  /* `spec` is { lead, accent } from timeline.LINES. */
  constructor(spec, opts = {}) {
    this.el = document.createElement('div');
    this.el.className = opts.className || 'kline';

    this.chars = [];
    this._append(spec.lead || '', false);
    this._append(spec.accent || '', true);

    this.caret = document.createElement('span');
    this.caret.className = 'caret';
    this.el.appendChild(this.caret);

    this.opts = {
      y: 0,          // resting vertical offset from centre, px
      rise: 34,      // per-line entry rise
      charRise: 16,  // per-character entry rise
      size: null,    // optional font-size override
      dir: 'left',   // exit vector; defaults to the film's current
      ...opts,
    };
    if (this.opts.size) this.el.style.fontSize = `${this.opts.size}px`;
    this.hide();
  }

  _append(text, isAccent) {
    for (const ch of text) {
      const s = document.createElement('span');
      s.className = isAccent ? 'kchar em' : 'kchar';
      s.textContent = ch;
      s.style.display = 'none';
      this.el.appendChild(s);
      this.chars.push({ el: s, on: false });
    }
  }

  mount(parent) {
    parent.appendChild(this.el);
    return this;
  }

  hide() {
    this.el.style.opacity = '0';
    this.caret.style.opacity = '0';
    for (const c of this.chars) {
      c.el.style.display = 'none';
      c.on = false;
    }
  }

  /* Absolute time at which character `i` is revealed.

     The reveal is `shown = cubicOut(progress) * n`, so character i appears
     once cubicOut(progress) reaches (i + 1) / n. Inverting cubicOut gives the
     progress, and therefore the time, directly. */
  _revealAt(i, appear, typeEnd) {
    const n = this.chars.length;
    if (n === 0) return appear;
    const frac = (i + 1) / n;
    const progress = 1 - Math.cbrt(1 - frac); // inverse of 1 - (1 - u)^3
    return appear + progress * (typeEnd - appear);
  }

  /* `cue` is [appear, typeEnd, holdEnd, exitEnd] absolute seconds. */
  update(t, cue) {
    const [appear, typeEnd, holdEnd, exitEnd] = cue;

    if (t < appear || t >= exitEnd) {
      this.el.style.opacity = '0';
      this.caret.style.opacity = '0';
      for (const c of this.chars) {
        if (c.on) {
          c.el.style.display = 'none';
          c.on = false;
        }
      }
      return;
    }

    // Reveal each character on its own schedule, with a short rise out of
    // blur. Purely a function of t.
    for (let i = 0; i < this.chars.length; i++) {
      const c = this.chars[i];
      const at = this._revealAt(i, appear, typeEnd);

      if (t < at) {
        if (c.on) {
          c.el.style.display = 'none';
          c.on = false;
        }
        continue;
      }
      if (!c.on) {
        c.el.style.display = 'inline-block';
        c.on = true;
      }

      const p = clamp((t - at) / CHAR_FADE);
      const e = expoOut(p);
      c.el.style.opacity = `${e}`;
      c.el.style.transform = `translateY(${(1 - e) * this.opts.charRise}px)`;
      c.el.style.filter = p < 1 ? `blur(${(1 - e) * 5}px)` : 'none';
    }

    // Line-level entry, hold and exit. The typewriter reveal IS the entry, so
    // the line only needs a small settle on the way in; the exit is what has
    // to carry the current.
    const entry = seg(t, appear, appear + 0.5, glass);
    // power4In accelerates out of the hold, so the line is at its fastest when
    // the cut lands rather than easing to a stop first.
    const exitP = seg(t, holdEnd, exitEnd, power4In);
    const opacity = entry * (1 - seg(t, holdEnd, exitEnd, cubicOut));

    const v = VECTOR[this.opts.dir] || VECTOR.left;
    const x = v.x * TRAVEL * exitP;
    const y =
      this.opts.y +
      (1 - entry) * this.opts.rise +
      v.y * TRAVEL * exitP;
    const scale = lerp(0.985, 1, entry);

    this.el.style.opacity = `${opacity}`;
    this.el.style.transform =
      `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;
    this.el.style.filter = exitP > 0 ? `blur(${exitP * 9}px)` : 'none';

    // Caret blinks while typing and through the hold, then leaves with the
    // line. Driven off elapsed time so it stays deterministic.
    const caretOn = t < holdEnd ? blink(t - appear) : 0;
    this.caret.style.opacity = `${caretOn * opacity}`;
  }
}

/* Convenience: build many lines at once from a spec map. */
export function buildLines(specs, parent, optsFor = () => ({})) {
  const out = {};
  for (const [key, spec] of Object.entries(specs)) {
    out[key] = new KineticLine(spec, optsFor(key)).mount(parent);
  }
  return out;
}
