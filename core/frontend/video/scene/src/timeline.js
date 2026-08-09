/* Master timeline. Single source of truth for act boundaries and copy.
   Beat grid is 120 BPM (0.5s per beat) so transitions land on a musical grid
   if a track is added later. */

export const FPS = 60;
export const DURATION = 90;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const BEAT = 0.5;

export const ACTS = {
  problem: { start: 0, end: 14 },
  brand: { start: 14, end: 22 },
  solution: { start: 22, end: 48 },
  flip: { start: 48, end: 52 },
  tour: { start: 52, end: 78 },
  outro: { start: 78, end: 90 },
};

/* Theme is dark for the first half, then snaps light at the act break, the
   same structural move the reference makes. Both palettes are the app's real
   tokens, not invented ones. */
export const THEME_FLIP = 48.3;

/* Seams. Every boundary is a velocity-matched cut on the film's current, with
   a named carrier handed across it. See src/seam.js for the mechanics.

   The current is LEFT. Two vectors are reserved and spent deliberately:
     Z  - the camera pushing into the hull number during the detection beat
     UP - elevation, spent once on the conclusion at the outro

   Never run consecutive seams in opposing directions; a ping-pong reads as an
   error rather than as motion. */
export const SEAMS = {
  problemToBrand: { t: 14.0, dir: 'left', carrier: 'hero tally sheet docks into the mark' },
  brandToSolution: { t: 22.0, dir: 'left', carrier: 'the mark docks into the gate feed' },
  solutionToFlip: { t: 48.3, dir: 'left', carrier: 'the 1 RITASE badge survives the flip' },
  flipToTour: { t: 52.3, dir: 'left', carrier: 'the sparkle docks at the dashboard corner' },
  tourToOutro: { t: 78.3, dir: 'up', carrier: 'the success ring rises into the payoff' },
};

/* Screen changes inside act 5. These are seams too - they get the same
   cut-the-curve treatment as act boundaries, and they all run on the current.
   Shared here because act5-tour and beat-export must agree on them. */
export const BEATS = {
  ledger: 59.7,
  report: 67.9,
  reportOut: 76.1,
};

/* Slots a carrier travels into, in stage-centre-relative px. Each is where the
   next act's first element ignites, so the hand-off matches position as well
   as velocity. */
export const SLOTS = {
  mark: { x: -170, y: -70, scale: 0.19 },
  feed: { x: 0, y: -18, scale: 0.34 },
  check: { x: -120, y: 0, scale: 0.5 },
  dash: { x: 40, y: 92, scale: 0.3 },
  payoff: { x: 0, y: -30, scale: 0.6 },
};

/* Kinetic type. `lead` renders in the primary colour, `accent` in amber.
   No "AI" anywhere, and plain punctuation only. */
export const LINES = {
  hook: { lead: 'Still counting ritase ', accent: 'by hand?' },
  hookSub: { lead: 'Tally sheets. Disputed trips. ', accent: 'No proof.' },
  tagline: { lead: 'Automated ritase counting' },
  aim: { lead: 'Point a camera at the ', accent: 'gate.' },
  reads: { lead: 'It reads every ', accent: 'nomor lambung.' },
  vote: { lead: 'Every frame ', accent: 'votes.' },
  pair: { lead: 'IN plus OUT makes ', accent: 'one ritase.' },
  check: { lead: 'Time for a quick ', accent: 'check' },
  live: { lead: 'See every crossing ', accent: 'live.' },
  trace: { lead: 'Trace any read back to its ', accent: 'frames.' },
  close: { lead: 'Close the shift. ', accent: 'Export the proof.' },
  payoff: { lead: 'Every trip counted. ', accent: 'Every trip proven.' },
};

/* Type-on windows: [appearStart, typeEnd, holdEnd, exitEnd].

   Two timing rules, both from the seam doctrine:
     - A line's exit ends ON its seam (within ~0.02s), never before it. A lone
       element that finishes fading early leaves a gap where nothing is moving,
       which is exactly what made the acts read as separate slides.
     - The first line of an act appears AT the seam, not after it, so it is
       already mid-flight when the cut lands. */
export const CUES = {
  hook: [1.2, 3.6, 6.4, 7.6],
  hookSub: [7.7, 10.2, 12.9, 14.02],
  brandMark: [14.06, 16.0, 20.9, 22.02],
  tagline: [16.9, 18.5, 20.9, 22.02],
  aim: [21.88, 24.0, 27.0, 28.1],
  reads: [28.9, 30.9, 34.4, 35.5],
  vote: [36.2, 37.8, 41.0, 42.1],
  pair: [42.8, 44.6, 47.4, 48.32],
  check: [48.14, 50.2, 51.7, 52.32],
  live: [52.16, 54.2, 57.6, 58.7],
  trace: [61.4, 63.4, 66.2, 67.3],
  close: [69.8, 71.8, 75.2, 76.4],
  payoff: [78.14, 80.4, 83.4, 84.6],
  outroMark: [84.7, 86.5, 89.4, 90.0],
};

/* Hull IDs and read counts lifted from the real detection run shown in the
   app screenshots, so on-screen numbers are the product's actual output. */
export const DETECTIONS = [
  { hull: '830E', gate: 'CK Gate A', reads: 98, frames: 259, conf: 30 },
  { hull: '299', gate: 'CK Gate A', reads: 22, frames: 69, conf: 100 },
  { hull: '5600', gate: 'CK Gate A', reads: 51, frames: 69, conf: 98 },
  { hull: '133', gate: 'CK Gate A', reads: 21, frames: 86, conf: 95 },
  { hull: 'F375', gate: 'CK Gate A', reads: 181, frames: 973, conf: 67 },
  { hull: '93', gate: 'CK Gate A', reads: 211, frames: 126, conf: 82 },
  { hull: '460', gate: 'CK Gate A', reads: 61, frames: 146, conf: 90 },
];

/* Frame-level OCR reads that converge on 830E, as in the Inspection HUD. */
export const FRAME_READS = [
  '1910', 'B1B', '1989', '51916', '51916', '1916',
  '1919', '1919', '31816', '1916', '1918', '1916',
];

export const GATES = [
  { name: 'CK Gate A', masuk: 9, keluar: 0, porsi: 25 },
  { name: 'CK Gate B', masuk: 0, keluar: 9, porsi: 25 },
  { name: 'CK Gate C', masuk: 9, keluar: 0, porsi: 25 },
  { name: 'CK Gate D', masuk: 0, keluar: 9, porsi: 25 },
];

export const act = (name) => ACTS[name];
export const inAct = (t, name) => t >= ACTS[name].start && t < ACTS[name].end;
