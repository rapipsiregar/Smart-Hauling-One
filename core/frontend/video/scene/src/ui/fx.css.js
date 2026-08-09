/* Effect primitives: the IN + OUT pairing badge, the success ring, and the
   cursor. Kept separate from the screen styles because these belong to the
   video's narration rather than to the product UI. */

import { CAMERA_CSS } from './camera.js';

export const FX_CSS = CAMERA_CSS + `
/* --- IN + OUT = 1 ritase --- */
.pairwrap { position: absolute; left: 50%; top: 50%; display: flex; align-items: center; gap: 34px; }
.dirbadge {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 26px 42px; border-radius: 18px;
  background: var(--bg-card); border: 1px solid var(--border-strong);
  backdrop-filter: blur(var(--glass-blur)) saturate(140%);
  box-shadow: 0 20px 60px -20px rgba(0,0,0,.8), inset 0 1px 0 0 var(--glass-highlight);
}
.dirbadge b { font-family: var(--font-mono); font-size: 46px; font-weight: 700; letter-spacing: .08em; line-height: 1; }
.dirbadge.in b { color: var(--ok); }
.dirbadge.out b { color: var(--accent); }
.dirbadge span { font-family: var(--font-mono); font-size: 11px; letter-spacing: .18em; color: var(--text-dim); }
.pairop { font-size: 42px; font-weight: 300; color: var(--text-dim); }
.ritbadge {
  position: absolute; left: 50%; top: 50%; display: flex; flex-direction: column;
  align-items: center; gap: 8px; padding: 30px 58px; border-radius: 20px;
  background: rgba(var(--accent-rgb), .1); border: 2px solid var(--accent);
  backdrop-filter: blur(var(--glass-blur));
  box-shadow: 0 0 70px -10px rgba(var(--accent-rgb), .6), inset 0 1px 0 0 var(--glass-highlight);
}
.ritbadge b { font-family: var(--font-mono); font-size: 74px; font-weight: 700; line-height: 1; color: var(--accent); }
.ritbadge span { font-family: var(--font-mono); font-size: 13px; letter-spacing: .26em; color: var(--text-secondary); }

/* --- success ring --- */
/* Centred by the act's translate(-50%, -50%); no negative margin here. */
.ringwrap { position: absolute; left: 50%; top: 50%; width: 260px; height: 260px; }
.ringwrap svg { width: 260px; height: 260px; overflow: visible; }
.ringtrack { fill: none; stroke: var(--border-strong); stroke-width: 6; }
/* Only the arc is rotated so it starts sweeping from 12 o'clock. Rotating the
   whole svg would take the tick with it and draw the checkmark on its side. */
.ringarc {
  fill: none; stroke: var(--ok); stroke-width: 6; stroke-linecap: round;
  filter: drop-shadow(0 0 14px rgba(var(--ok-rgb), .8));
  transform: rotate(-90deg);
  transform-origin: 130px 130px;
}
.ringtick { fill: none; stroke: var(--ok); stroke-width: 9; stroke-linecap: round; stroke-linejoin: round; }
.ringlbl {
  position: absolute; left: 50%; top: 300px; transform: translateX(-50%);
  font-size: 28px; font-weight: 500; white-space: nowrap; color: var(--text-primary);
}

/* --- pointer --- */
.cursor {
  position: absolute; width: 26px; height: 26px; pointer-events: none;
  filter: drop-shadow(0 3px 7px rgba(0,0,0,.6)); z-index: 40;
}
.cursor svg { width: 26px; height: 26px; }
/* Click ripple, driven by inline width/height/opacity from the act. */
.ripple {
  position: absolute; border-radius: 50%; border: 2px solid var(--accent);
  pointer-events: none; transform: translate(-50%, -50%);
}

/* --- outro lockup extras --- */
.domain {
  position: absolute; left: 50%; top: 50%; display: inline-flex; align-items: center;
  height: 46px; padding: 0 26px; border-radius: 999px;
  background: var(--bg-card); border: 1px solid var(--border-strong);
  backdrop-filter: blur(14px); font-family: var(--font-mono);
  font-size: 16px; letter-spacing: .18em; color: var(--text-secondary); white-space: nowrap;
}
`;
