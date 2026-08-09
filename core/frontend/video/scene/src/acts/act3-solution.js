/* Act 3 - the solution (22s to 48s).

   Four beats on one continuous camera move: the gate feed arrives, the
   detector brackets the truck, OCR reads stream off the hull number, and the
   votes resolve into a single ritase. The feed panel never cuts - it is
   re-framed between beats, which is how the reference keeps 26 seconds
   feeling like one shot. */

import { Panel } from '../ui/panel.js';
import { cameraFeed, readStream } from '../ui/camera.js';
import { KineticLine } from '../type/kinetic.js';
import { LINES, CUES, FRAME_READS, SEAMS, SLOTS } from '../timeline.js';
import { seg, ramp, clamp, lerp, countTo } from '../anim.js';
import { glass, expoOut, cubicOut, settle, quintOut, power4In } from '../easing.js';
import { enter as enterSeam, TRAVEL } from '../seam.js';
import { createVoteBeat } from './beat-vote.js';

const CUT_IN = SEAMS.brandToSolution.t;

const CAM_W = 1240;
const CAM_H = 698;

/* Truck geometry, in the feed's own pixel space. The detector boxes are
   derived from these rather than hand-placed, so they stay locked to the
   vehicle as it drives and as it scales. */
const TRUCK_W = 420;
const TRUCK_H = 210;
const TRUCK_S = 1.5;                      // scale about the truck's contact point
const TRUCK_LEFT = CAM_W / 2 - TRUCK_W / 2;
const TRUCK_TOP = CAM_H - CAM_H * 0.1 - TRUCK_H;

/* Local rects inside the unscaled truck: the visible bodywork, and the plate. */
const R_BODY = { x0: 8, x1: 394, y0: 48, y1: TRUCK_H };
const R_PLATE = { x0: 178, x1: 284, y0: 89, y1: 136 };

/* Maps a truck-local rect to feed coordinates for the current x offset.
   The scale pivots on the truck's contact point (50% 100%), matching the
   transform-origin set on .truck in CSS. */
function rectFor(r, tx) {
  const ox = TRUCK_W / 2;
  const oy = TRUCK_H;
  const sx = (v) => ox + (v - ox) * TRUCK_S;
  const sy = (v) => oy + (v - oy) * TRUCK_S;
  const left = TRUCK_LEFT + tx + sx(r.x0);
  const right = TRUCK_LEFT + tx + sx(r.x1);
  const top = TRUCK_TOP + sy(r.y0);
  const bottom = TRUCK_TOP + sy(r.y1);
  return { left, top, w: right - left, h: bottom - top };
}

export function createAct3({ world, typeLayer, fx }) {
  const cam = new Panel(cameraFeed(), { w: CAM_W, h: CAM_H, className: 'rim' })
    .mount(world);

  const stream = document.createElement('div');
  stream.innerHTML = readStream(FRAME_READS.length);
  cam.el.appendChild(stream.firstChild);

  const q = (s) => cam.query(s);
  const truck = q('[data-truck]');
  const vbox = q('[data-vbox]');
  const obox = q('[data-obox]');
  const scan = q('[data-scan]');
  const tc = q('[data-tc]');
  const frames = q('[data-frames]');
  const vconf = q('[data-vconf]');
  const chips = cam.queryAll('[data-rchip]');

  const aim = new KineticLine(LINES.aim, { size: 74 }).mount(typeLayer);
  const reads = new KineticLine(LINES.reads, { size: 74 }).mount(typeLayer);

  const vote = createVoteBeat({ world, typeLayer, fx });

  return {
    update(t) {
      // --- feed panel framing -------------------------------------------
      // Entry continues act 2's carrier: the feed ignites at the slot and
      // scale the mark docked into, still travelling LEFT on the current, and
      // decelerates on power4Out to mirror the mark's power4In exit.
      const eIn = enterSeam(t, CUT_IN, SEAMS.brandToSolution.dir);
      const compose = settle(clamp(seg(t, CUT_IN, CUT_IN + 1.5)));

      // Z is a RESERVED vector, spent here and only here: the camera pushing
      // into the hull number is the whole point of the act.
      const push = seg(t, 29.0, 30.6, glass);
      // Beat 3 pulls back and shifts LEFT (the current) for the vote panel.
      const shift = seg(t, 35.4, 37.0, glass);
      const leave = seg(t, 42.2, 43.6, power4In);

      const camScale =
        lerp(SLOTS.feed.scale, 1, compose) * lerp(1, 1.34, push) * lerp(1, 0.76, shift);

      cam.set({
        x:
          SLOTS.feed.x + eIn.dx +
          lerp(0, -190, push) * (1 - shift) +
          lerp(0, -352, shift) -
          leave * TRAVEL,
        y: SLOTS.feed.y + lerp(0, 64, push) * (1 - shift),
        z: lerp(-260, 0, compose) - shift * 190 - leave * 300,
        ry: lerp(-18, -4, compose) + shift * 13,
        rx: lerp(7, 1.6, compose),
        rz: lerp(-2, 0, compose),
        scale: camScale,
        opacity: eIn.opacity * (1 - seg(t, 42.2, 43.6, cubicOut)),
        blur: eIn.blur + leave * 10,
      });

      // --- truck ---------------------------------------------------------
      // Decelerates into the gate rather than stopping dead.
      const roll = seg(t, 23.0, 26.6, quintOut);
      const exitRoll = seg(t, 40.4, 43.4, cubicOut);
      const tx = lerp(-1180, -30, roll) + exitRoll * 1240;
      // Small vertical jounce while the wheels are turning.
      const bounce = roll < 1 && roll > 0 ? Math.sin(t * 26) * 1.8 : 0;
      truck.style.transform =
        `translate(${tx}px, ${bounce}px) scale(${TRUCK_S})`;

      // --- detector boxes -------------------------------------------------
      // Both boxes are computed from the truck's live position, so they track
      // it instead of sitting at fixed coordinates.
      const body = rectFor(R_BODY, tx);
      const plate = rectFor(R_PLATE, tx);

      const vIn = seg(t, 26.5, 27.15, settle);
      vbox.style.opacity = `${vIn * (1 - seg(t, 40.2, 41.0))}`;
      // Boxes snap inward from a looser first guess as confidence rises.
      const vPad = lerp(26, 8, vIn);
      vbox.style.left = `${body.left - vPad}px`;
      vbox.style.top = `${body.top - vPad}px`;
      vbox.style.width = `${body.w + vPad * 2}px`;
      vbox.style.height = `${body.h + vPad * 2}px`;
      vconf.textContent = (0.71 + 0.23 * vIn).toFixed(2);

      const oIn = seg(t, 29.4, 30.0, settle);
      obox.style.opacity = `${oIn * (1 - seg(t, 39.6, 40.4))}`;
      const oPad = lerp(18, 5, oIn);
      obox.style.left = `${plate.left - oPad}px`;
      obox.style.top = `${plate.top - oPad}px`;
      obox.style.width = `${plate.w + oPad * 2}px`;
      obox.style.height = `${plate.h + oPad * 2}px`;

      // Scan bar sweeps the frame repeatedly while inference runs.
      const scanning = t > 29.4 && t < 39.4;
      scan.style.opacity = scanning ? '0.9' : '0';
      if (scanning) scan.style.top = `${((t - 29.4) % 1.5) / 1.5 * CAM_H}px`;

      // --- overlay counters -----------------------------------------------
      const fr = countTo(t, 29.4, 39.4, 259);
      frames.textContent = `frame ${String(fr).padStart(3, '0')} / 259`;
      const sec = 14 * 60 + 22 + Math.floor(clamp((t - 22) / 1.4, 0, 999));
      tc.textContent =
        `07:${String(Math.floor(sec / 60)).padStart(2, '0')}:` +
        `${String(sec % 60).padStart(2, '0')}`;

      // --- OCR read chips --------------------------------------------------
      chips.forEach((c, i) => {
        const s = 30.2 + i * 0.34;
        const p = seg(t, s, s + 1.5, cubicOut);
        if (p <= 0 || p >= 1) {
          c.style.opacity = '0';
          return;
        }
        if (c.textContent !== FRAME_READS[i]) c.textContent = FRAME_READS[i];
        // Chips peel off the plate itself, fanning up and to the right.
        const spread = (i % 4) - 1.5;
        c.style.left = `${plate.left + p * (160 + spread * 48)}px`;
        c.style.top = `${plate.top - p * (170 + Math.abs(spread) * 32)}px`;
        c.style.opacity = `${Math.sin(p * Math.PI) * 0.95}`;
        c.style.transform = `scale(${lerp(0.7, 1.06, p)})`;
      });

      // --- type -------------------------------------------------------------
      // Lines sit low while the feed owns the centre of frame. Set before
      // update, or the offset lands a frame late.
      aim.opts.y = 384;
      reads.opts.y = 384;
      aim.update(t, CUES.aim);
      reads.update(t, CUES.reads);

      const voteState = vote.update(t) || {};

      return {
        glow: lerp(0.19, 0.3, seg(t, 22, 27, glass)),
        spread: 0.3,
        focusX: 0.5 - shift * 0.06,
        focusY: 0.54,
        dust: 0.55,
        camZ: 18 - compose * 1.6 - push * 0.8,
        camX: shift * 0.5,
        ...voteState,
      };
    },
  };
}
