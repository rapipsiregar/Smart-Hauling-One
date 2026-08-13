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
  direction: "inbound" | "outbound";
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
  direction: "inbound" | "outbound" | "both";
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
  direction: "inbound" | "outbound";
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
  perTruck: TruckRitase[];
  unpaired: UnpairedCrossing[];
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
  unpaired: UnpairedCrossing[];
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

export interface DashboardStatsResponse {
  period: "daily" | "weekly" | "monthly" | "custom";
  periodLabel: string;
  startDate: string;
  endDate: string;
  totalPassages: number;
  totalRitase: number;
  identifiedCount: number;
  unidentifiedCount: number;
  uniqueTrucks: number;
  avgConfidence: number;
  pairingBasis: PairingBasis;
  unpairedCount: number;
  timeSeries: TimeSeriesBucket[];
  perGate: GateDirectionBreakdown[];
  perTruck: TruckRitase[];
  unpaired: UnpairedCrossing[];
}

