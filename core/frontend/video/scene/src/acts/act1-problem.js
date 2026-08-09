/* Act 1 - the problem (0s to 14s).

   Paper ritase logs drift through a dark pit while the hook types on. Sheets
   sit at real depths and blur by distance from a focus plane, which produces
   layered depth of field rather than a uniform background blur.

   Motion route: camera with intent. The whole field travels steadily LEFT on
   the film's current and pushes in, so the frame is always going somewhere.
   There is deliberately no sine drift here - idle wobble reads as the video
   waiting, and it was a large part of why this act felt like a static slide.

   Seam out: the hero sheet is the carrier. It shrinks and docks into the slot
   the SmartGate mark ignites in, so the eye tracks one object across the cut.
   The remaining sheets take the ordinary cut-the-curve exit. */

import { Panel } from '../ui/panel.js';
import { tallySheet, tallyClip } from '../ui/paper.js';
import { KineticLine } from '../type/kinetic.js';
import { LINES, CUES, SEAMS, SLOTS } from '../timeline.js';
import { seg, ramp, clamp, lerp } from '../anim.js';
import { glass, cubicOut, expoOut, linear } from '../easing.js';
import { exit, carry } from '../seam.js';

/* z is depth in px; the focus plane sits at FOCUS_Z, everything else softens
   with distance from it, near and far alike. */
const FOCUS_Z = -140;
const DOF = 0.021;

/* The hero sheet is the seam carrier, so it rests nearest the mark's slot. */
const HERO = 0;

const SHEETS = [
  { x: -520, y: -150, z: -260, ry: 22, rx: 5, rz: -4, s: 0.95, seed: 1, clip: false },
  { x: 712, y: -250, z: 130, ry: -27, rx: 7, rz: 3, s: 1.05, seed: 2, clip: true },
  { x: -540, y: 372, z: 210, ry: 19, rx: -9, rz: 5, s: 1.1, seed: 3, clip: false },
  { x: 588, y: 402, z: -130, ry: -17, rx: -6, rz: -3, s: 0.92, seed: 4, clip: false },
  { x: 70, y: -430, z: -470, ry: 6, rx: 11, rz: 2, s: 0.86, seed: 5, clip: true },
  { x: -910, y: 96, z: -540, ry: 30, rx: 2, rz: 6, s: 0.8, seed: 6, clip: false },
  { x: 980, y: 70, z: -420, ry: -30, rx: 3, rz: -5, s: 0.82, seed: 7, clip: false },
];

const CUT = SEAMS.problemToBrand.t;

export function createAct1({ world, typeLayer }) {
  const panels = SHEETS.map((cfg) => {
    const html = cfg.clip ? tallyClip(cfg.seed) : tallySheet(cfg.seed);
    return {
      cfg,
      panel: new Panel(html, { w: 520, h: 680 }).mount(world),
    };
  });

  const hook = new KineticLine(LINES.hook).mount(typeLayer);
  const sub = new KineticLine(LINES.hookSub, { size: 72 }).mount(typeLayer);

  return {
    update(t) {
      // Camera path: monotonic, never oscillating. Steady leftward travel sets
      // up the current the seam will hand off on.
      const pan = ramp(t, 0, CUT, 0, -150, linear);
      const push = ramp(t, 0, CUT, -40, 200, cubicOut);

      panels.forEach(({ cfg, panel }, i) => {
        const isHero = i === HERO;

        // Sheets arrive already travelling rather than rising into rest.
        const inP = seg(t, 0.1 + i * 0.14, 1.8 + i * 0.14, expoOut);

        // Parallax: distant sheets pan less than near ones.
        const par = 1 + cfg.z / -900;
        let x = cfg.x + pan * par;
        let y = cfg.y;
        let z = cfg.z + push;
        let scale = cfg.s * (0.95 + inP * 0.05);
        let opacity = inP;
        let blur = 0;

        if (isHero) {
          // Carrier: docks into the mark's slot, arriving exactly on the cut.
          const c = carry(
            t,
            CUT,
            { x, y, scale },
            { x: SLOTS.mark.x, y: SLOTS.mark.y, scale: SLOTS.mark.scale },
            0.55
          );
          x = c.x;
          y = c.y;
          scale = c.scale;
          z = lerp(z, 60, c.p);
          opacity *= c.opacity;
          blur += c.p * 3;
        } else {
          const e = exit(t, CUT, SEAMS.problemToBrand.dir);
          x += e.dx;
          y += e.dy;
          opacity *= e.opacity;
          blur += e.blur;
        }

        const dof = clamp(Math.abs(z - FOCUS_Z) * DOF, 0, 15);

        panel.set({
          x,
          y,
          z,
          rx: cfg.rx,
          ry: cfg.ry,
          rz: cfg.rz,
          scale,
          opacity,
          blur: dof + blur + (1 - inP) * 10,
          // Sheets sit dim so the type always wins the eye.
          brightness: 0.62 - Math.max(0, z - FOCUS_Z) * 0.0004,
        });
      });

      hook.update(t, CUES.hook);
      sub.update(t, CUES.hookSub);

      return {
        glow: ramp(t, 0, CUT, 0.13, 0.2, glass),
        spread: 0.36,
        focusX: 0.5,
        focusY: 0.62,
        dust: 0.42,
        // The WebGL camera rides the same leftward path as the DOM layer, so
        // both fields move as one.
        camZ: 18 - push * 0.004,
        camX: pan * 0.004,
      };
    },
  };
}
