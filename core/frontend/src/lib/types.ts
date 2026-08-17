export interface KPI {
  total_videos: number;
  identified: number;
  unique_trucks: number;
  total_reads: number;
  avg_confidence: number;
  unknown: number;
}

export interface Crossing {
  id: number;
  hull_id: string;
  video: string;
  confidence: number;
  reads: number;
  frames: number;
  lane: string;
  /** Decided per truck on the edge device from its own virtual center line
   *  (edge/backend/agent/pipeline.py); null when the truck never crossed it. */
  direction: "inbound" | "outbound" | null;
  camera_id?: number | null;
  camera_code?: string | null;
  camera_name?: string | null;
  rtsp_url?: string | null;
  snapshot: string | null;
  annotated_video: string | null;
  known: boolean;
}

export interface FleetEntry {
  hull_id: string;
  passages: number;
  reads: number;
  best_conf: number;
  snapshot: string | null;
  cameras_seen?: string[];
}

export interface DashboardData {
  crossings: Crossing[];
  fleet: FleetEntry[];
  kpis: KPI;
}

export interface SitePlanData {
  inside: Crossing[];
  outside: Crossing[];
  total_inside: number;
  total_outside: number;
  total_trucks: number;
  active_lanes: string[];
}

export interface Job {
  id: string;
  name: string;
  status: "queued" | "processing" | "done" | "error";
  message: string;
  progress?: JobProgress | null;
  result: JobResult | null;
  created_at: string;
}

export interface VoteCandidate {
  id: string;
  weight: number;
  reads: number;
  share: number;
  winner: boolean;
}

export interface JobProgress {
  frames_scanned: number;
  frames_total: number;
  reads: number;
  ocr_reads: number;
  voted_hull_id: string;
  vote_confidence: number;
  distribution: VoteCandidate[];
}

export interface JobResult {
  truck_id: string;
  found: boolean;
  certainty: number;
  reads: number;
  ocr_reads?: number;
  frames_scanned?: number;
  distribution?: VoteCandidate[];
  snapshot: string | null;
  crops?: string[];
  annotated_video: string | null;
  cached?: boolean;
}

// --- Reference (Integrated Smart Hauling System) real-data entities -------------------------------

// The edge system's own types live next door; re-exported so callers can import
// domain types from one place.
export type {
  DeviceStatus, EdgeConfig, EdgeConfigPatch, LiveSession, CameraEdgeFields,
  InboundAxis, DeviceProvisioning,
} from "./edge-types";

import { CameraEdgeFields } from "./edge-types";

/**
 * A registered gate camera. One gate has exactly one camera and one edge device
 * behind it, so `CameraEdgeFields` extends this row rather than modelling a
 * separate device entity (`docs/edge-system/SRS.md` §9).
 */
export interface Camera extends CameraEdgeFields {
  id?: number;
  camera_code: string;
  name: string;
  gate_location: string | null;
  status: "online" | "offline" | "maintenance";
  rtsp_url: string | null;
  ip_host: string | null;
  username: string | null;
  resolution: string | null;
  fps: number | null;
  folder: string | null;
  install_date: string | null;
  last_seen: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CrossingEvent {
  id: number;
  hullId: string;
  confidence: number;
  video: string;
  lane: string;
  /**
   * The checkpoint this crossing belongs to ("CP 01").
   *
   * Not `lane`, which holds the wider area — two checkpoints can share one, so
   * grouping by it merges them.
   */
  checkpoint: string;
  direction: "inbound" | "outbound" | null;
  cameraId: number | null;
  cameraCode: string | null;
  cameraName: string | null;
  rtspUrl: string | null;
  reads: number;
  frames: number;
  known: boolean;
  isReconciled: boolean;
  reconciledBy: string | null;
  ocrReads: number;
  imageProofUrl: string | null;
  contextImageUrl: string | null;
  /** When the truck crossed. Null until a real time source supplies it. */
  crossedAt: string | null;
  processedAt: string;
  modelType?: string | null;
  unitType?: string | null;
  contractor?: string | null;
}

export interface CctvDetection {
  id: string;
  video: string;
  towerId: string;
  location: string;
  camera: string;
  cameraId: number | null;
  cameraCode: string | null;
  cameraName: string | null;
  rtspUrl: string | null;
  timestamp: string;
  ocrText: string;
  confidence: number;
  croppedText: string;
  framesProcessed: number;
  frameResults: string[];
  ocrReadCount: number;
  detectionConfidence: number;
  isConsistent: boolean;
  aiModel: string;
  /** The plate crop the vote was decided on. Null when none was stored. */
  imageProofUrl: string | null;
  /** The wider frame or marked-up clip the crop came from, when available. */
  contextImageUrl: string | null;
}

export interface FleetUnit {
  id: string;
  hullId: string;
  passages: number;
  reads: number;
  bestConf: number;
  snapshot: string | null;
  camerasSeen: string[];
  lastActive: string | null;
  modelType?: string | null;
  unitType?: string | null;
  contractor?: string | null;
}

/** One row of the operator's own fleet registry, as-is — for manual review. */
export interface FleetMasterUnit {
  hullId: string;
  hullCode: string;
  contractor: string | null;
  unitType: string | null;
  brand: string | null;
  modelType: string | null;
  year: number | null;
  status: string | null;
}

export interface GateBreakdown {
  gate: string;
  passages: number;
  identified: number;
}

export interface PerformanceKpis {
  totalPassages: number;
  identified: number;
  unknown: number;
  uniqueTrucks: number;
  totalReads: number;
  avgConfidence: number;
  perGate: GateBreakdown[];
}

export interface TruckRitase {
  hullId: string;
  /**
   * False when this hull was read confidently but is in no master row — a
   * contractor's visitor, or a unit commissioned since the last import. Its
   * ritase still count: the truck really made the trip. The flag is what stops
   * an unknown number quietly joining the fleet.
   */
  registered: boolean;
  ritase: number;
  inCount: number;
  outCount: number;
  unpaired: number;
  reads: number;
  bestConf: number;
  /** Only available once crossings carry real times. */
  avgCycleSeconds: number | null;
}

/** Trips through a gate, split by direction. */
export interface GateDirectionBreakdown {
  gate: string;
  inbound: number;
  outbound: number;
  undirected: number;
}

/** A crossing that could not be paired into a ritase — kept and flagged. */
export interface UnpairedCrossing {
  id: number;
  hullId: string;
  lane: string;
  direction: "inbound" | "outbound" | null;
  crossedAt: string | null;
  reason: "missing-in" | "missing-out" | "no-direction" | "unidentified-hull";
}

/**
 * `count` pairs by min(IN, OUT) and is used while crossing times are unknown;
 * `chronological` orders by real time and also yields cycle durations.
 */
export type PairingBasis = "count" | "chronological";

export interface ShiftReport {
  date: string;
  model: string;
  /** Headline figure: one ritase = one IN paired with one OUT. */
  totalRitase: number;
  /**
   * Of `totalRitase`, how much was hauled by units the master does not list.
   * Reported beside the total rather than folded into it: it is a registry gap
   * to go and close, and the exports are where somebody notices.
   */
  unregisteredRitase: number;
  unregisteredHulls: string[];
  totalCrossings: number;
  unpairedCount: number;
  pairingBasis: PairingBasis;
  hasCrossingTimes: boolean;
  identified: number;
  unknown: number;
  reconciled: number;
  uniqueTrucks: number;
  totalReads: number;
  avgConfidence: number;
  perGate: GateDirectionBreakdown[];
  /** The CP 01–CP 04 cut the sheet is reconciled by. Optional: a backend that
   *  predates it simply omits the section rather than breaking the page. */
  perCheckpoint?: CheckpointBreakdown[];
  perTruck: TruckRitase[];
  unpaired: UnpairedCrossing[];
  /** The hour the mining day rolls over (6), so the export can print the cut. */
  miningDayStartHour?: number;
  /** The window the server actually applied; null when unbounded. */
  startDate?: string | null;
  endDate?: string | null;
}

export interface RitaseReport {
  totalRitase: number;
  /** Of `totalRitase`, how many were hauled by trucks the master does not list. */
  unregisteredRitase: number;
  unregisteredHulls: string[];
  totalCrossings: number;
  pairingBasis: PairingBasis;
  hasCrossingTimes: boolean;
  unpairedCount: number;
  perHull: TruckRitase[];
  perGate: GateDirectionBreakdown[];
  /**
   * The CP 01–CP 04 breakdown the site plans and reports by.
   *
   * Not the same cut as `perGate`, which groups by area — two checkpoints can
   * share one area, so that grouping merges them. A ritase pair is credited to
   * the checkpoint of its inbound leg, which is what makes these rows sum to
   * `totalRitase`.
   */
  perCheckpoint: CheckpointBreakdown[];
  unpaired: UnpairedCrossing[];
}

/** One checkpoint's share of the haulage, and the traffic it saw. */
export interface CheckpointBreakdown {
  checkpoint: string;
  ritase: number;
  inbound: number;
  outbound: number;
  /** Crossings the gate could not orient. Real traffic, not yet a direction. */
  undirected: number;
  crossings: number;
  unidentified: number;
}

/** How finely the trend page slices time. */
export type TrendGranularity = "day" | "week" | "month" | "year";

/** One point on the trend: a mining day, week, month, or year. */
export interface TrendBucket {
  /** Sortable label, also the x-axis tick: "2026-08-16", "2026-W33", "2026-08", "2026". */
  bucket: string;
  ritase: number;
  crossings: number;
  /** Ritase split by checkpoint. Absent keys mean zero for that bucket. */
  perCheckpoint: Record<string, number>;
}

/**
 * Ritase over time, bucketed by mining day (06:00–06:00).
 *
 * Empty buckets are present with zeroes — a day the site hauled nothing is a
 * fact worth plotting, and omitting it would draw the line straight over a
 * stoppage.
 */
export interface RitaseTrend {
  granularity: TrendGranularity;
  startDate: string | null;
  endDate: string | null;
  /** The hour the mining day rolls over. 6 — carried so the UI can say so. */
  dayStartHour: number;
  totalRitase: number;
  totalCrossings: number;
  /** Crossings with no recorded time; they cannot be placed on the timeline. */
  undatedCrossings: number;
  checkpoints: string[];
  series: TrendBucket[];
}

/** One truck's whereabouts, decided by its most recent crossing. */
export interface PitTruck {
  hullId: string;
  registered: boolean;
  lastGate: string | null;
  lastCameraCode: string | null;
  lastDirection: "inbound" | "outbound" | null;
  lastCrossedAt: string | null;
  confidence: number | null;
}

/**
 * Who is inside the mining area right now.
 *
 * A truck is in exactly one place, decided by its most recent crossing: read at
 * an IN gate means inside, at an OUT gate means it has left. This is the same
 * rule the outbound matcher narrows its candidates with, so the screen and the
 * matcher can never disagree about who is in the pit.
 */
export interface PitOccupancy {
  insideCount: number;
  unregisteredInside: number;
  inside: PitTruck[];
  outsideCount: number;
  outside: PitTruck[];
}

// The video test bench types lived here. The bench moved to the gate
// devices, where the pipeline actually runs -- see the OCR Inspection HUD in
// edge/frontend. The core no longer starts or watches detection runs.

export interface TimeSeriesBucket {
  label: string;
  total: number;
}

