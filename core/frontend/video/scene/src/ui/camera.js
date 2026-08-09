/* Gate camera feed.

   The detection moment: a haul truck crosses the gate, the detector brackets
   it, and the OCR box locks onto the hull number. Everything is drawn with
   CSS shapes rather than imagery so it stays sharp at 1080p and so no stock
   footage is implied to be a real site. */

export function cameraFeed() {
  return (
    `<div class="cam">` +
      `<div class="camsky"></div>` +
      `<div class="camground"></div>` +
      `<div class="camhaze"></div>` +

      // Gate structure: two posts and a header beam.
      `<div class="post l"></div><div class="post r"></div>` +
      `<div class="beam"><span class="beamtxt mono">CK GATE A</span></div>` +

      // Haul truck, assembled from primitives.
      `<div class="truck" data-truck>` +
        `<div class="tbody"></div>` +
        `<div class="tcab"></div>` +
        `<div class="tplate mono" data-plate>830E</div>` +
        `<div class="twheel w1"></div><div class="twheel w2"></div>` +
        `<div class="twheel w3"></div>` +
        `<div class="tdust"></div>` +
      `</div>` +

      // Detector bracket around the whole vehicle.
      `<div class="box vbox" data-vbox>` +
        `<i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>` +
        `<span class="boxlbl mono">truck <b data-vconf>0.94</b></span>` +
      `</div>` +

      // Tight box on the hull number, which is what the OCR reads.
      `<div class="box obox" data-obox>` +
        `<i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>` +
        `<span class="boxlbl mono ol">hull_id</span>` +
      `</div>` +

      `<div class="scan" data-scan></div>` +

      // Overlay chrome, matching the app's camera labelling.
      `<div class="camtop mono"><span class="rec"><i></i>REC</span>` +
        `<span>CAM-GATE-A</span><span data-tc>07:14:22</span></div>` +
      `<div class="cambot mono"><span>pak-shomad-v1.pt</span>` +
        `<span data-frames>frame 000 / 259</span></div>` +
      `<div class="camlines"></div>` +
      `<div class="camvig"></div>` +
    `</div>`
  );
}

/* Floating OCR read chips that stream off the plate and feed the vote. */
export function readStream(n = 14) {
  let out = '';
  for (let i = 0; i < n; i++) out += `<span class="rchip mono" data-rchip="${i}"></span>`;
  return `<div class="rstream">${out}</div>`;
}

export const CAMERA_CSS = `
.cam {
  position: relative; width: 100%; height: 100%; overflow: hidden;
  border-radius: 14px; background: #0a0d13;
}
.camsky {
  position: absolute; inset: 0 0 42% 0;
  background: linear-gradient(180deg, #10151f 0%, #1d232f 55%, #37301f 100%);
}
.camground {
  position: absolute; inset: 58% 0 0 0;
  background: linear-gradient(180deg, #3a3022 0%, #241d14 60%, #14100b 100%);
}
/* Haze band at the horizon: reads as pit dust and softens the seam. */
.camhaze {
  position: absolute; left: 0; right: 0; top: 44%; height: 24%;
  background: radial-gradient(60% 100% at 50% 0%, rgba(245,158,11,.2), transparent 70%);
  filter: blur(14px);
}
.post {
  position: absolute; bottom: 8%; width: 20px; height: 56%;
  background: linear-gradient(90deg, #2a3242, #47526b 40%, #202634);
  border-radius: 3px;
}
.post.l { left: 7%; }
.post.r { right: 7%; }
.beam {
  position: absolute; left: 7%; right: 7%; top: 34%; height: 34px;
  background: linear-gradient(180deg, #47526b, #232a38);
  border-radius: 4px; display: flex; align-items: center; justify-content: center;
}
.beamtxt { font-size: 13px; letter-spacing: .3em; color: #aab4c8; }

/* --- truck --- */
/* Scaled about its contact point so the truck grows upward from the ground;
   act 3 derives the detector box positions from this same origin. */
.truck {
  position: absolute; left: 50%; bottom: 10%; width: 420px; height: 210px;
  margin-left: -210px; transform-origin: 50% 100%;
}
.tbody {
  position: absolute; left: 74px; bottom: 46px; width: 320px; height: 116px;
  background: linear-gradient(180deg, #f0a92a, #c97f10 60%, #8f590a);
  /* Angled dump body, the profile that reads as a mining haul truck. */
  clip-path: polygon(6% 0, 100% 0, 92% 100%, 0 100%);
  border-radius: 4px;
}
.tcab {
  position: absolute; left: 8px; bottom: 46px; width: 96px; height: 84px;
  background: linear-gradient(180deg, #f5b53c, #b8740e);
  border-radius: 8px 4px 3px 3px;
}
.tcab::after {
  content: ''; position: absolute; left: 14px; top: 12px; width: 62px; height: 34px;
  background: linear-gradient(150deg, #7fa8c9, #2b3d52); border-radius: 4px;
}
.tplate {
  position: absolute; left: 178px; bottom: 74px; z-index: 3;
  font-size: 34px; font-weight: 700; color: #1a1205; letter-spacing: .04em;
  background: rgba(255,255,255,.9); padding: 3px 12px; border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0,0,0,.4);
}
.twheel {
  position: absolute; bottom: 0; width: 92px; height: 92px; border-radius: 50%;
  background: radial-gradient(circle at 38% 34%, #4a5261, #14181f 62%, #0a0c10);
  border: 5px solid #1b1f27;
}
.twheel.w1 { left: 26px; }
.twheel.w2 { left: 214px; }
.twheel.w3 { left: 296px; }
.tdust {
  position: absolute; left: -80px; bottom: -6px; width: 240px; height: 70px;
  background: radial-gradient(ellipse at 60% 60%, rgba(190,150,90,.34), transparent 70%);
  filter: blur(10px);
}

/* --- detector overlays --- */
.box { position: absolute; opacity: 0; }
.box .c { position: absolute; width: 22px; height: 22px; border: 3px solid var(--accent); }
.box .c.tl { left: -2px; top: -2px; border-right: 0; border-bottom: 0; }
.box .c.tr { right: -2px; top: -2px; border-left: 0; border-bottom: 0; }
.box .c.bl { left: -2px; bottom: -2px; border-right: 0; border-top: 0; }
.box .c.br { right: -2px; bottom: -2px; border-left: 0; border-top: 0; }
.boxlbl {
  position: absolute; left: -3px; top: -27px; height: 21px; padding: 0 9px;
  display: inline-flex; align-items: center; font-size: 11px; font-weight: 600;
  background: var(--accent); color: #1a1205; border-radius: 4px 4px 0 0;
}
.boxlbl.ol { background: #22d3ee; color: #04222a; }
.obox .c { border-color: #22d3ee; width: 14px; height: 14px; border-width: 2.5px; }

/* Sweeping scan bar during inference. */
.scan {
  position: absolute; left: 0; right: 0; height: 3px; opacity: 0;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  box-shadow: 0 0 24px 5px rgba(var(--accent-rgb), .5);
}

.camtop, .cambot {
  position: absolute; left: 18px; right: 18px; display: flex; gap: 22px;
  font-size: 12px; color: rgba(255,255,255,.78); letter-spacing: .08em;
}
.camtop { top: 15px; }
.cambot { bottom: 15px; justify-content: space-between; color: rgba(255,255,255,.5); font-size: 11px; }
.rec { display: inline-flex; align-items: center; gap: 7px; color: #ff5a5a; }
.rec i { width: 8px; height: 8px; border-radius: 50%; background: #ff5a5a; box-shadow: 0 0 10px #ff5a5a; }
.camtop span:last-child { margin-left: auto; }
/* Interlace + vignette: sells it as a camera feed rather than a render. */
.camlines {
  position: absolute; inset: 0; opacity: .16; pointer-events: none;
  background: repeating-linear-gradient(180deg, transparent 0 2px, rgba(0,0,0,.7) 2px 3px);
}
.camvig {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse 70% 66% at 50% 50%, transparent 40%, rgba(0,0,0,.66) 100%);
}

/* --- read stream --- */
.rstream { position: absolute; inset: 0; pointer-events: none; }
.rchip {
  position: absolute; opacity: 0; padding: 4px 10px; border-radius: 6px;
  font-size: 15px; font-weight: 600; color: var(--accent);
  background: rgba(var(--accent-rgb), .12); border: 1px solid rgba(var(--accent-rgb), .4);
  backdrop-filter: blur(6px); white-space: nowrap;
}
`;
