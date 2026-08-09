/* Director.

   Owns the frame contract: given absolute time t, put the DOM and the WebGL
   layer into exactly the state that time implies. Nothing here reads a real
   clock, and nothing accumulates - seeking to t twice must produce identical
   pixels, which is what lets the renderer take as long as it needs per frame. */

import { THEME_FLIP, DURATION } from './timeline.js';
import { seg, clamp, ramp } from './anim.js';
import { cubicOut, expoOut, glass } from './easing.js';

const FADE_IN = 0.7;
const FADE_OUT_START = DURATION - 1.0;

export class Director {
  /* `acts` is [{ name, start, end, act }] where act has update(t) -> glState. */
  constructor({ gl, stage, flash, fade, acts }) {
    this.gl = gl;
    this.stage = stage;
    this.flash = flash;
    this.fade = fade;
    this.acts = acts;
    this.isLight = false;
  }

  /* Acts get a lead-in and lead-out margin so entries and exits that spill
     past their nominal boundary still contribute to the background state. */
  _owns(t, a) {
    return t >= a.start - 1.2 && t < a.end + 1.2;
  }

  update(t) {
    const state = {
      t,
      theme: 0,
      glow: 0.16,
      spread: 0.34,
      focusX: 0.5,
      focusY: 0.56,
      dust: 0.45,
      dustDrift: 1,
      camX: 0,
      camY: 0,
      camZ: 18,
      lines: 0,
      linesOpacity: 0,
    };

    // Theme: a hard snap, matching the reference's act break. Everything
    // downstream reads --theme tokens, so one class swap repaints the world.
    const light = t >= THEME_FLIP;
    if (light !== this.isLight) {
      this.stage.classList.toggle('light', light);
      this.isLight = light;
    }
    state.theme = light ? 1 : 0;

    // Every act is updated on every frame, not just the ones in window. Acts
    // own DOM that persists, and their entry/exit curves already resolve to
    // opacity 0 outside their range - skipping them leaves the previous act's
    // panels frozen on screen. Panel.set() early-outs on invisible content, so
    // updating all six costs almost nothing.
    //
    // Only in-window acts contribute background state, though; otherwise the
    // last act would permanently win the glow and camera.
    for (const a of this.acts) {
      const out = a.act.update(t);
      if (out && this._owns(t, a)) Object.assign(state, out);
    }

    this.gl.update(state);
    this.gl.render();

    // Flash punctuates the theme snap.
    const f =
      t < THEME_FLIP
        ? 0
        : (1 - seg(t, THEME_FLIP, THEME_FLIP + 0.42, cubicOut)) * 0.85;
    this.flash.style.opacity = `${clamp(f, 0, 1)}`;

    // Top and tail.
    const fin = 1 - seg(t, 0, FADE_IN, cubicOut);
    const fout = seg(t, FADE_OUT_START, DURATION, cubicOut);
    this.fade.style.opacity = `${clamp(Math.max(fin, fout), 0, 1)}`;
  }
}
