/* Handwritten tally sheets for the problem act.

   These are the thing the product replaces: a paper ritase log, ruled and
   hand-tallied, with strikeouts where a count was disputed. Rendered as aged
   paper so they read warm against the dark pit background, and drawn with
   deterministic jitter so the strokes look hand-made but render identically
   every pass. */

const HULLS = ['830E', '299', '5600', '133', 'F375', '93', '460', 'F8724'];

/* Deterministic jitter: same seed always yields the same wobble. */
function jitter(seed, i, spread) {
  const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return ((v - Math.floor(v)) * 2 - 1) * spread;
}

function tallyGroup(count, seed, struck) {
  let marks = '';
  for (let i = 0; i < count; i++) {
    // Every fifth stroke lies across the previous four, as a real tally does.
    const fifth = (i + 1) % 5 === 0;
    const rot = fifth ? -62 + jitter(seed, i, 6) : jitter(seed, i, 7);
    const left = fifth
      ? (Math.floor(i / 5) * 5 - 4.4) * 9
      : (i + Math.floor(i / 5) * 1.2) * 9;
    const top = jitter(seed, i + 40, 3);
    marks +=
      `<i style="left:${left.toFixed(1)}px;top:${top.toFixed(1)}px;` +
      `transform:rotate(${rot.toFixed(1)}deg);` +
      `${fifth ? 'width:46px;' : ''}"></i>`;
  }
  return `<span class="tally${struck ? ' struck' : ''}">${marks}</span>`;
}

export function tallySheet(seed = 1) {
  const rows = HULLS.map((hull, i) => {
    const n = 3 + ((seed * 7 + i * 5) % 9);
    // A couple of rows per sheet are struck through: the disputed trips.
    const struck = (seed + i) % 7 === 3;
    return (
      `<div class="prow">` +
      `<span class="phull" style="transform:rotate(${jitter(seed, i, 1.2).toFixed(2)}deg)">${hull}</span>` +
      tallyGroup(n, seed * 10 + i, struck) +
      `<span class="pnum">${struck ? '' : n}</span>` +
      `</div>`
    );
  }).join('');

  return (
    `<div class="paper">` +
    `<div class="prule"></div>` +
    `<div class="pmargin"></div>` +
    `<div class="phead">CATATAN RITASE</div>` +
    `<div class="pmeta">CK GATE A &nbsp;·&nbsp; SHIFT SIANG &nbsp;·&nbsp; 07:00 - 19:00</div>` +
    `<div class="pbody">${rows}</div>` +
    `<div class="pfoot">TTD PENGAWAS</div>` +
    `<div class="pstain" style="left:${(38 + seed * 9) % 300}px"></div>` +
    `</div>`
  );
}

/* A clipboard-style variant, for depth variety in the drifting stack. */
export function tallyClip(seed = 2) {
  return `<div class="clip"><div class="clipbar"></div>${tallySheet(seed)}</div>`;
}

export const PAPER_CSS = `
.paper {
  position: relative; width: 100%; height: 100%;
  background:
    linear-gradient(180deg, #f7f2e6 0%, #ece3d0 60%, #e2d7c0 100%);
  border-radius: 4px;
  box-shadow: 0 40px 90px -30px rgba(0,0,0,.85), 0 2px 0 rgba(255,255,255,.4) inset;
  padding: 34px 30px 0 56px;
  overflow: hidden;
  color: #2b3a52;
  font-family: var(--font-mono);
}
/* Ruled lines and the red margin, drawn rather than imaged. */
.prule {
  position: absolute; inset: 0;
  background-image: repeating-linear-gradient(
    180deg, transparent 0 43px, rgba(70,110,160,.28) 43px 44px);
  background-position: 0 96px;
}
.pmargin { position: absolute; left: 44px; top: 0; bottom: 0; width: 1.5px; background: rgba(200,70,70,.42); }
.phead {
  position: relative; font-size: 21px; font-weight: 700; letter-spacing: .22em;
  color: #1f2d44; margin-bottom: 6px;
}
.pmeta { position: relative; font-size: 11px; letter-spacing: .1em; color: #6a7386; margin-bottom: 22px; }
.pbody { position: relative; }
.prow { display: flex; align-items: center; height: 44px; gap: 14px; }
.phull { display:inline-block; width: 68px; font-size: 17px; font-weight: 700; color: #16233a; }
.pnum { margin-left: auto; font-size: 15px; color: #46536b; }
/* Tally strokes: absolutely placed so each can carry its own rotation. */
.tally { position: relative; display: inline-block; width: 150px; height: 30px; }
.tally i {
  position: absolute; width: 2.6px; height: 27px; top: 0;
  background: #1e3050; border-radius: 2px; transform-origin: 50% 50%;
}
.tally.struck::after {
  content: ''; position: absolute; left: -6px; right: -34px; top: 13px; height: 2px;
  background: #b23b3b; transform: rotate(-2.4deg);
}
.pfoot {
  position: absolute; right: 30px; bottom: 22px; font-size: 10px;
  letter-spacing: .2em; color: #8a90a0;
}
/* Coffee ring, the small human detail that sells it. */
.pstain {
  position: absolute; bottom: 60px; width: 92px; height: 92px; border-radius: 50%;
  border: 7px solid rgba(150,105,50,.14);
  box-shadow: inset 0 0 26px rgba(150,105,50,.1);
}
.clip { position: relative; width: 100%; height: 100%; padding-top: 26px; background: #3a3f4b; border-radius: 8px; }
.clipbar {
  position: absolute; left: 50%; top: 6px; width: 132px; height: 26px; margin-left: -66px;
  background: linear-gradient(180deg,#9aa2b1,#5d6575); border-radius: 5px; z-index: 2;
}
`;
