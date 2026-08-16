/**
 * Client for this gate's own local API.
 *
 * Everything is served by the FastAPI on the same device, so there is no
 * camera_code anywhere: a device only ever knows about itself.
 */

export type MatchOutcome =
  | "exact"
  | "fuzzy"
  | "ambiguous"
  | "unregistered"
  | "unreadable";

export interface Settings {
  yolo_fps: number;
  ocr_fps: number;
  detect_window_sec: number;
  ocr_min_conf: number;
  dedup_iou: number;
}

/** Which recogniser the device is running -- see agent/ocr_backends.py. */
export type OcrBackend =
  | "ppocrv6-tiny"
  | "ppocrv6-small"
  | "ppocrv6-medium"
  | "paddleocr-vl";

/**
 * What the screen calls each engine.
 *
 * The engine ids are upstream model names and carry the letters the site's IT
 * asked to keep off the console. They are also meaningless to whoever is reading
 * the screen: "Ringan" and "Lengkap" say the thing that actually differs between
 * them — size and thoroughness — and the real id is still one `GET /api/status`
 * away for anyone debugging.
 */
export const READER_NAMES: Record<string, string> = {
  "ppocrv6-tiny": "Ringan",
  "ppocrv6-small": "Sedang",
  "ppocrv6-medium": "Besar",
  "paddleocr-vl": "Lengkap",
};

export const readerName = (backend: string): string =>
  READER_NAMES[backend] ?? "—";

export interface GateStatus {
  camera_code: string;
  ocr_backend: OcrBackend;
  /** 'inbound' | 'outbound', or null when the core has not told this gate yet. */
  direction: "inbound" | "outbound" | null;
  agent_running: boolean;
  /** The inference thread specifically -- it can die while the agent runs on. */
  detecting: boolean;
  camera_connected: boolean;
  /** Whether the core was reachable at the last master sync. */
  core_reachable: boolean;
  /** Crossings detected but not yet delivered to the core. */
  outbox_depth: number;
  crossings: { total: number; unsynced: number; identified: number };
  master: { units: number; version: number };
  settings: Settings;
  last_error: string | null;
}

export interface Crossing {
  id: number;
  idempotency_key: string;
  hull_id: string | null;
  raw_code: string | null;
  match_outcome: MatchOutcome | null;
  confidence: number | null;
  read_count: number | null;
  window_sec: number | null;
  /** The consensus vote as stored, serialised: StoredVote[]. */
  votes_json: string | null;
  detected_at: string;
  synced: number;
}

/** One cluster in the consensus vote -- the leaderboard the HUD draws. */
export interface VoteCandidate {
  id: string;
  weight: number;
  reads: number;
  /** Fraction of total weight, 0..1. */
  share: number;
  winner: boolean;
}

/** The vote as stored with a finished crossing (votes_json). */
export interface StoredVote {
  text: string;
  count: number;
  avg_ocr_conf: number;
}

/** One OCR attempt as it happened, for the live feed. */
export interface FeedEntry {
  frame: number;
  /** The normalised hull code, or null when the attempt read nothing usable. */
  text: string | null;
  raw: string | null;
  ocr_conf: number;
  det_conf: number;
}

export interface RunProgress {
  voted_hull_id: string;
  vote_confidence: number;
  frames_scanned: number;
  frames_total: number;
  /** This clip only — the vote below belongs to one truck. */
  reads: number;
  ocr_reads: number;
  /** Summed over every clip so far; only ever climbs. */
  total_reads: number;
  total_ocr_reads: number;
  distribution: VoteCandidate[];
  /** The last few attempts, oldest first. Shows the device working frame by frame. */
  feed: FeedEntry[];
}

export interface RunItem {
  name: string;
  status: "queued" | "processing" | "done" | "unread" | "error" | "cancelled";
  hullId: string | null;
  confidence: number | null;
  reads: number | null;
  snapshot: string | null;
  message: string;
}

export interface TestRun {
  id: string;
  cameraCode: string;
  status: "queued" | "running" | "done" | "error" | "cancelled";
  message: string;
  startedAt: string;
  finishedAt: string | null;
  total: number;
  completed: number;
  failed: number;
  currentIndex: number;
  current: { name: string } | null;
  progress: RunProgress | null;
  items: RunItem[];
}

export interface ClipSource {
  name: string;
  size_bytes: number;
  /** null when the filename makes no claim — reference footage never does. */
  direction: "inbound" | "outbound" | null;
  /**
   * Which folder it came from. `gate` is this device's own operational footage;
   * `contoh` is the reference set, kept in a separate folder so it can never be
   * mistaken for — or written over — the gate's own record.
   */
  source: "gate" | "contoh";
}

// --- Live inspection view -----------------------------------------------------
// Boxes and OCR samples as the device produces them. Boxes arrive without
// waiting for a reading, which is the whole point of the split: /api/live/state
// carries the detection immediately and each crop's text fills in later.

/** One detection box, in the coordinate space of the source frame. */
export interface LiveBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  conf: number;
}

/** One OCR sample: the crop the recogniser saw and what it made of it. */
export interface LiveCrop {
  crop_index: number;
  /** The normalised reading, or null when this attempt read nothing usable. */
  text: string | null;
  raw: string | null;
  ocr_conf: number;
  det_conf: number;
  frame: number;
}

/** One truck's pass: a Detection Window, its samples, and its running vote. */
export interface LiveTrack {
  track_id: number;
  status: "scanning" | "done";
  started_at: number;
  crops: LiveCrop[];
  votes: VoteCandidate[];
  voted: string | null;
  confidence: number | null;
  hull_id: string | null;
  outcome: MatchOutcome | null;
  pending_ocr: number;
}

export interface LiveState {
  version: number;
  /**
   * Identifies this run of the device's live bus. Must be carried in every crop
   * URL: track ids restart from the same number when the process does, so
   * without it a cached crop from the previous session is shown beside the
   * current reading — the wrong truck's photograph next to the right number.
   */
  session: string;
  frame_seq: number;
  frame_age_sec: number | null;
  /** "camera" for the live lane, or the clip filename during a test run. */
  source: string | null;
  boxes: LiveBox[];
  active_track: number | null;
  /** Newest first. */
  tracks: LiveTrack[];
  counters: {
    frames: number;
    detections: number;
    ocr_attempts: number;
    ocr_reads: number;
  };
}

export const RUN_ACTIVE: TestRun["status"][] = ["queued", "running"];

export interface MatchProbe {
  input: string;
  extracted_code: string | null;
  outcome: MatchOutcome;
  hull_id: string | null;
  hull_code: string | null;
  distance: number;
  ambiguous_candidates: string[];
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** One commissioning check: did it pass, what was seen, and what to do. */
export interface PreflightCheck {
  name: string;
  ok: boolean;
  detail: string;
  /** Empty when the check passed. The specific next action when it did not. */
  fix: string;
}

/**
 * Whether this device is configured correctly, and if not, precisely what is
 * wrong. Distinct from `status`, which answers "is it working" — this answers
 * "what is stopping it", the question actually asked during commissioning.
 */
export interface Preflight {
  ready: boolean;
  cameraCode: string | null;
  coreUrl: string | null;
  checks: PreflightCheck[];
}

export const api = {
  status: () => req<GateStatus>("/api/status"),
  preflight: () => req<Preflight>("/api/preflight"),
  crossings: (limit = 50) => req<Crossing[]>(`/api/crossings?limit=${limit}`),
  settings: () => req<Settings>("/api/settings"),
  saveSettings: (patch: Partial<Settings>) =>
    req<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(patch) }),
  probe: (text: string) =>
    req<MatchProbe>("/api/match-probe", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  // --- OCR Inspection HUD ---
  clips: () => req<ClipSource[]>("/api/video-sources"),
  activeRun: () => req<TestRun | null>("/api/test-runs/active"),
  startRun: (clips?: string[]) =>
    req<TestRun>("/api/test-runs", {
      method: "POST",
      body: JSON.stringify({ clips: clips ?? null }),
    }),
  cancelRun: (id: string) =>
    req<{ status: string }>(`/api/test-runs/${id}/cancel`, { method: "POST" }),

  // --- Live inspection view ---
  liveState: () => req<LiveState>("/api/live/state"),
  resetLive: () => req<{ status: string }>("/api/live/reset", { method: "POST" }),
  resetCrossings: () =>
    req<{ status: string; removed: number }>("/api/crossings-reset", { method: "POST" }),
};

/**
 * The annotated MJPEG feed.
 *
 * Given to an <img>, not a <video>: multipart/x-mixed-replace is what browsers
 * render natively in an image element, and it needs no player, no codec
 * negotiation, and no relay. `nonce` forces a fresh connection when the panel
 * needs to reconnect -- a dead MJPEG socket otherwise leaves the last frame on
 * screen forever, which looks exactly like a lane with nothing happening.
 *
 * `detail` adds the track id and detection score above each box. The green box
 * itself is always drawn; only the caption is conditional.
 */
export const liveStreamUrl = (nonce: number, detail = false) =>
  `/api/live/stream?n=${nonce}&detail=${detail ? 1 : 0}`;

/**
 * One OCR sample image.
 *
 * Immutable *within a session*, which is why `session` is not optional: it is
 * what makes the cache key safe to hold for an hour. See `LiveState.session`.
 */
export const liveCropUrl = (session: string, trackId: number, cropIndex: number) =>
  `/api/live/crops/${trackId}/${cropIndex}?s=${session}`;

/** The crop the gate voted on. Cache-busted so a new crossing never shows a stale image. */
export const snapshotUrl = (crossingId: number) =>
  `/api/crossings/${crossingId}/snapshot`;

/**
 * The resting view of the lane. `tick` forces a refetch: the endpoint returns a
 * genuinely live frame when a camera is connected, and a browser would otherwise
 * happily show the first one forever.
 */
export const idleFrameUrl = (tick: number) => `/api/idle-frame?t=${tick}`;

/** Server-side ranges, mirrored so the form can guide before submitting. */
export const RANGES: Record<keyof Settings, [number, number]> = {
  yolo_fps: [1, 30],
  ocr_fps: [1, 15],
  detect_window_sec: [1, 30],
  ocr_min_conf: [0, 1],
  dedup_iou: [0, 1],
};
