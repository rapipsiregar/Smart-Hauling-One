/* Act 3, beats 3 and 4: the vote resolving, then IN + OUT pairing.

   The hull ID flickers between candidates while the vote is open and locks on
   a single value at the end - that flicker-then-lock is what communicates
   "many frames, one answer" without any narration. */

import { Panel } from '../ui/panel.js';
import { KineticLine } from '../type/kinetic.js';
import { LINES, CUES, SEAMS } from '../timeline.js';
import { seg, ramp, lerp, clamp } from '../anim.js';
import { glass, expoOut, cubicOut, settle, quintOut, power4In } from '../easing.js';
import { TRAVEL } from '../seam.js';

const CUT_OUT = SEAMS.solutionToFlip.t;

const CANDIDATES = [
  { id: '830E', pct: 62 },
  { id: '1916', pct: 24 },
  { id: '51916', pct: 9 },
];

/* Values the readout flickers through before it settles. */
const FLICKER = ['1916', '830E', '51916', '830E', '1919', '830E', '31816', '830E'];

const LOCK_AT = 40.2;

function votePanel() {
  return (
    `<div class="hud" style="height:100%">` +
    `<div class="hudhead"><span class="hh">` +
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/></svg>` +
    `<b>OCR Inspection HUD</b></span>` +
    `<span class="hstat chip a" data-live><i></i>LIVE</span></div>` +
    `<div class="plate hplate" data-plate2>` +
    `<div class="label">VOTED HULL ID</div>` +
    `<div class="hullid mono" data-hull2>1916</div>` +
    `<div class="hconf mono" data-conf2>voting…</div></div>` +
    `<div class="label" style="margin-top:16px">KANDIDAT VOTING</div>` +
    `<div class="votes">` +
    CANDIDATES.map(
      (c, i) =>
        `<div class="vrow${i ? ' dim' : ''}"><b>${c.id}</b>` +
        `<span class="vtrack"><span class="vfill" data-v="${i}"></span></span>` +
        `<span data-vp="${i}">0%</span></div>`
    ).join('') +
    `</div>` +
    `<div class="hfoot mono" style="margin-top:auto"><span>MODEL: pak-shomad-v1.pt</span><span>CK Gate A</span></div>` +
    `</div>`
  );
}

export function createVoteBeat({ world, typeLayer }) {
  const vp = new Panel(votePanel(), { w: 560, h: 560, className: 'glass rim' })
    .mount(world);

  const hull = vp.query('[data-hull2]');
  const conf = vp.query('[data-conf2]');
  const live = vp.query('[data-live]');
  const fills = vp.queryAll('[data-v]');
  const pcts = vp.queryAll('[data-vp]');

  // Pairing badges.
  const pair = document.createElement('div');
  pair.className = 'pairwrap';
  pair.innerHTML =
    `<div class="dirbadge in"><b>IN</b><span>MASUK 07:14</span></div>` +
    `<div class="pairop">+</div>` +
    `<div class="dirbadge out"><b>OUT</b><span>KELUAR 07:52</span></div>`;
  pair.style.opacity = '0';
  typeLayer.appendChild(pair);

  const rit = document.createElement('div');
  rit.className = 'ritbadge';
  rit.innerHTML = `<b>1</b><span>RITASE</span>`;
  rit.style.opacity = '0';
  typeLayer.appendChild(rit);

  const voteLine = new KineticLine(LINES.vote, { size: 74, y: 372 }).mount(typeLayer);
  const pairLine = new KineticLine(LINES.pair, { size: 74, y: -300 }).mount(typeLayer);

  return {
    update(t) {
      // --- vote panel -----------------------------------------------------
      const vIn = seg(t, 36.0, 37.4, quintOut);
      const vOut = seg(t, 42.0, 43.2, cubicOut);
      const vis = vIn * (1 - vOut);

      vp.set({
        // Enters from the right travelling left, and leaves continuing left:
        // the panel never reverses direction mid-act.
        x: lerp(760, 452, vIn) - vOut * TRAVEL,
        y: -10,
        z: lerp(-380, 40, vIn) - vOut * 260,
        ry: lerp(-26, -9, vIn) + vOut * 10,
        rx: lerp(3.2, 1.4, seg(t, 36.0, 42.0)),
        scale: lerp(0.9, 1, vIn) * (1 + vOut * 0.06),
        opacity: vis,
        blur: (1 - vIn) * 12 + vOut * 10,
      });

      if (vis > 0.001) {
        const locked = t >= LOCK_AT;
        // Flicker at ~11Hz while open, then hold the winner.
        const idx = Math.floor((t - 37.0) * 11) % FLICKER.length;
        const shown = locked ? '830E' : FLICKER[Math.max(0, idx)];
        if (hull.textContent !== shown) hull.textContent = shown;

        const lockP = seg(t, LOCK_AT, LOCK_AT + 0.5, expoOut);
        hull.style.transform = `scale(${lerp(1, 1.12, Math.sin(lockP * Math.PI))})`;
        hull.style.opacity = locked ? '1' : `${0.72 + 0.28 * (idx % 2)}`;

        const c = ramp(t, 37.2, LOCK_AT, 12, 62, cubicOut);
        conf.textContent = locked
          ? '62.0% vote confidence'
          : `${c.toFixed(1)}% voting…`;

        live.className = locked ? 'hstat chip g' : 'hstat chip a';
        live.innerHTML = locked ? '<i></i>Consistent' : '<i></i>LIVE';

        // Bars race, the leader pulling clear near the end.
        CANDIDATES.forEach((cd, i) => {
          const p = seg(t, 37.2 + i * 0.16, LOCK_AT, cubicOut);
          const wobble = t < LOCK_AT ? Math.sin(t * 5 + i * 2) * (i === 0 ? 4 : 2.4) : 0;
          const val = clamp(cd.pct * p + wobble, 0, 100);
          fills[i].style.width = `${val}%`;
          pcts[i].textContent = `${Math.round(val)}%`;
        });
      }

      voteLine.update(t, CUES.vote);

      // --- IN + OUT = 1 ritase ---------------------------------------------
      const pIn = seg(t, 43.4, 44.4, quintOut);
      const merge = seg(t, 45.4, 46.4, glass);
      const pOut = seg(t, 47.4, 48.0, cubicOut);

      pair.style.opacity = `${pIn * (1 - merge)}`;
      // The two badges converge on the centre as they merge.
      pair.style.gap = `${lerp(34, -60, merge)}px`;
      pair.style.transform =
        `translate(-50%, -50%) translateY(${(1 - pIn) * 50 + 30}px) ` +
        `scale(${lerp(0.9, 1, pIn) * lerp(1, 0.82, merge)})`;
      pair.style.filter = merge > 0 ? `blur(${merge * 12}px)` : 'none';

      // The badge is the carrier across the theme flip. It accelerates LEFT on
      // power4In and survives ~0.3s PAST the cut, so it is still travelling
      // while the light act types its first characters. The theme snap lands
      // on the same frame as the cut, so a single object crosses the palette
      // change - which is what makes the flip read as a move, not a slide.
      const rIn = seg(t, 45.9, 46.7, settle);
      const ritGo = seg(t, 47.9, CUT_OUT + 0.3, power4In);
      const ritFade = seg(t, CUT_OUT - 0.04, CUT_OUT + 0.3, cubicOut);
      rit.style.opacity = `${rIn * (1 - ritFade)}`;
      rit.style.transform =
        `translate(-50%, -50%) translate(${-TRAVEL * ritGo}px, 30px) ` +
        `scale(${lerp(0.72, 1, rIn)})`;
      rit.style.filter = ritGo > 0 ? `blur(${ritGo * 9}px)` : 'none';

      pairLine.update(t, CUES.pair);

      if (t < 42) return null;
      // The pairing beat clears the frame and tightens the light.
      return {
        glow: lerp(0.3, 0.42, seg(t, 43, 46, glass)) * (1 - pOut * 0.4),
        spread: lerp(0.3, 0.2, seg(t, 43, 46, glass)),
        focusY: 0.5,
        dust: 0.5,
      };
    },
  };
}
