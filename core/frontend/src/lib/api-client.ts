import {
  Crossing, FleetEntry, KPI,
  CrossingEvent, CctvDetection, FleetUnit, FleetMasterUnit, PerformanceKpis, ShiftReport, RitaseReport,
  PitOccupancy,
  Camera, DashboardData, SitePlanData,
  EdgeConfig, EdgeConfigPatch, LiveSession, DeviceProvisioning,
  RitaseTrend, TrendGranularity,
} from "./types";

const API_BASE = "";

/**
 * A failed API call, carrying enough of the response to decide *why* it failed.
 *
 * The backend answers errors as `{"error": "…"}` with a non-2xx status, except
 * Pydantic validation failures which use FastAPI's own `{"detail": [...]}`.
 * A route that isn't mounted at all also comes back as FastAPI's default 404 —
 * so the presence of the `error` key is what separates "the contract said no"
 * from "this endpoint doesn't exist on this backend yet".
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, statusText: string, body: unknown) {
    super(`API error: ${status} ${statusText}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  /** The server's own message, when it sent one. */
  get serverMessage(): string | null {
    const body = this.body as { error?: unknown } | null;
    return body && typeof body.error === "string" ? body.error : null;
  }
}

/**
 * True when the backend simply hasn't mounted this route yet — a 404 with no
 * `error` key, i.e. FastAPI's default handler rather than a contract response.
 * The edge endpoints are specced but unimplemented, so this is the expected
 * answer today and the UI explains it rather than treating it as a fault.
 */
export function isEndpointMissing(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404 && err.serverMessage === null;
}

/** Build a `?camera_code=…` suffix, or "" when no camera filter is applied. */
function cameraQuery(cameraCode?: string): string {
  return cameraCode ? `?camera_code=${encodeURIComponent(cameraCode)}` : "";
}

/**
 * A window of MINING days (06:00–06:00), both ends inclusive.
 *
 * Dates, not timestamps: the caller picks working days and the server resolves
 * them to real moments, so there is one definition of where a day starts
 * (`app/services/mining_day.py`) rather than one per caller.
 */
export interface DateRange {
  startDate?: string;
  endDate?: string;
}

function rangeQuery(range?: DateRange): string {
  if (!range) return "";
  const parts: string[] = [];
  if (range.startDate) parts.push(`start_date=${encodeURIComponent(range.startDate)}`);
  if (range.endDate) parts.push(`end_date=${encodeURIComponent(range.endDate)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

/**
 * Merge query fragments that each think they start the query string.
 * The helpers above all emit a leading "?", so only the first may keep it.
 */
function joinQuery(...fragments: string[]): string {
  const parts = fragments.filter(Boolean).map((f) => f.replace(/^\?/, ""));
  return parts.length ? `?${parts.join("&")}` : "";
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    // Read the body for the error message, but never let a non-JSON error page
    // (a proxy 502, an HTML 404) mask the status code that actually matters.
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* not JSON — status alone carries the meaning */
    }
    throw new ApiError(res.status, res.statusText, body);
  }
  return res.json();
}

export const api = {
  // --- Fleet registry mutations (real SQLite registry) ---
  getFleet: (): Promise<{ fleet: FleetEntry[]; kpis: KPI }> => fetchJSON<{ fleet: FleetEntry[]; kpis: KPI }>("/api/fleet"),


  // --- Dashboard reads (canonical dataset / KPIs / site plan) ---
  getDashboardData: (): Promise<DashboardData> => fetchJSON<DashboardData>("/api/dataset"),
  getKpis: (): Promise<KPI> => fetchJSON<KPI>("/api/kpis"),
  getSitePlan: (): Promise<SitePlanData> => fetchJSON<SitePlanData>("/api/map"),

  // --- Crossing detail (reconciliation) ---
  getCrossing: (id: number): Promise<Crossing> => fetchJSON<Crossing>(`/api/crossings/${id}`),

  updateCrossing: (id: number, hull_id: string, confidence?: number): Promise<{ status: string }> =>
    fetchJSON<{ status: string }>(`/api/crossings/${id}`, {
      method: "PUT",
      body: JSON.stringify({ hull_id, confidence }),
    }),

  // --- Reference (Integrated Smart Hauling System) real-data endpoints ---
  // Pass a camera code to filter server-side; omit it for the full set.
  /**
   * The crossing log. `range` narrows it to mining days (06:00–06:00), both
   * ends inclusive — a single date returns that one full working day.
   *
   * Each row carries `imageProofUrl`, the still the gate captured, so a
   * cross-check against BIB's sheet never needs the video file opened.
   */
  getCrossingEvents: (cameraCode?: string, range?: DateRange): Promise<CrossingEvent[]> =>
    fetchJSON<CrossingEvent[]>(
      `/api/crossings${joinQuery(cameraQuery(cameraCode), rangeQuery(range))}`,
    ),
  getCctvDetections: (cameraCode?: string): Promise<CctvDetection[]> =>
    fetchJSON<CctvDetection[]>(`/api/cctv-detections${cameraQuery(cameraCode)}`),
  getFleetRegistry: (cameraCode?: string): Promise<FleetUnit[]> =>
    fetchJSON<FleetUnit[]>(`/api/fleet-registry${cameraQuery(cameraCode)}`),

  /** The raw operator fleet registry (all master fields), for manual review. */
  getFleetMaster: (): Promise<FleetMasterUnit[]> =>
    fetchJSON<FleetMasterUnit[]>("/api/fleet-master"),
  getPerformanceKpis: (): Promise<PerformanceKpis> => fetchJSON("/api/performance-kpis"),

  /** The daily sheet, cut to the mining day (06:00–06:00), not to midnight. */
  getShiftReport: (range?: DateRange): Promise<ShiftReport> =>
    fetchJSON<ShiftReport>(`/api/shift-report${joinQuery(rangeQuery(range))}`),

  /** Ritase = IN paired with OUT, plus the crossings that stayed unpaired. */
  getRitase: (cameraCode?: string, range?: DateRange): Promise<RitaseReport> =>
    fetchJSON<RitaseReport>(
      `/api/ritase${joinQuery(cameraQuery(cameraCode), rangeQuery(range))}`,
    ),

  /** Ritase over time for the trend page, bucketed by mining day. */
  getRitaseTrend: (
    granularity: TrendGranularity,
    range?: DateRange,
    cameraCode?: string,
  ): Promise<RitaseTrend> =>
    fetchJSON<RitaseTrend>(
      `/api/ritase-trend${joinQuery(
        `?granularity=${encodeURIComponent(granularity)}`,
        cameraQuery(cameraCode),
        rangeQuery(range),
      )}`,
    ),

  /** Which trucks are inside the mining area right now, and on what evidence. */
  getPitOccupancy: (): Promise<PitOccupancy> =>
    fetchJSON<PitOccupancy>("/api/pit-occupancy"),

  // --- Camera registry (real per-gate camera management) ---
  getCameras: (): Promise<Camera[]> => fetchJSON<Camera[]>("/api/cameras"),

  getCamera: (camera_code: string): Promise<Camera> =>
    fetchJSON<Camera>(`/api/cameras/${encodeURIComponent(camera_code)}`),

  createCamera: (camera: Partial<Camera>): Promise<Camera> =>
    fetchJSON<Camera>("/api/cameras", {
      method: "POST",
      body: JSON.stringify(camera),
    }),

  updateCamera: (camera_code: string, patch: Partial<Camera>): Promise<Camera> =>
    fetchJSON<Camera>(`/api/cameras/${encodeURIComponent(camera_code)}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  deleteCamera: (camera_code: string): Promise<{ status: string }> =>
    fetchJSON<{ status: string }>(`/api/cameras/${encodeURIComponent(camera_code)}`, {
      method: "DELETE",
    }),

  syncCameraAttribution: (): Promise<{ status: string; tagged: number }> =>
    fetchJSON<{ status: string; tagged: number }>("/api/cameras-sync-attribution", {
      method: "POST",
    }),

  // --- Edge devices: per-gate inference settings (API_CONTRACT §2.1–§2.2) ---
  // One Jetson per gate, one camera per Jetson, so the camera row *is* the
  // device row — these are sub-resources of the camera, not a separate entity.

  getEdgeConfig: (camera_code: string): Promise<EdgeConfig> =>
    fetchJSON<EdgeConfig>(`/api/cameras/${encodeURIComponent(camera_code)}/edge-config`),

  /** Partial update; the server increments `config_version` by exactly 1. */
  updateEdgeConfig: (camera_code: string, patch: EdgeConfigPatch): Promise<EdgeConfig> =>
    fetchJSON<EdgeConfig>(`/api/cameras/${encodeURIComponent(camera_code)}/edge-config`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  /**
   * Issue a fresh API key for a device. Returns the plaintext EXACTLY once —
   * the core stores only its hash, so no later call can retrieve it.
   *
   * This also rotates: the previous key stops working the moment it returns,
   * and the device buffers crossings in its outbox until its `.env` is updated.
   * Confirm with the operator before calling.
   */
  provisionDevice: (camera_code: string): Promise<DeviceProvisioning> =>
    fetchJSON<DeviceProvisioning>(
      `/api/cameras/${encodeURIComponent(camera_code)}/provision`,
      { method: "POST" },
    ),

  // --- Live raw CCTV view (API_CONTRACT §2.4) ---
  // Raw feed only. Detection results never travel this path.

  /**
   * Opens (or rejoins) this gate's live session. Calling it twice for one gate
   * returns the same session rather than erroring — an expected race, not a
   * conflict. A session against an offline device still succeeds; video just
   * never arrives, which the player reports as "device unreachable".
   */
  startLiveSession: (camera_code: string): Promise<LiveSession> =>
    fetchJSON<LiveSession>(`/api/cameras/${encodeURIComponent(camera_code)}/live/start`, {
      method: "POST",
    }),

  /** Keep-alive, ~every 10s; the server ends the session after ~20s of silence. */
  liveSessionHeartbeat: (camera_code: string, session_id: string): Promise<{ status: string }> =>
    fetchJSON<{ status: string }>(`/api/cameras/${encodeURIComponent(camera_code)}/live/heartbeat`, {
      method: "POST",
      body: JSON.stringify({ session_id }),
    }),

  /** Idempotent — stopping an already-ended session is not an error. */
  stopLiveSession: (camera_code: string, session_id: string): Promise<{ status: string }> =>
    fetchJSON<{ status: string }>(`/api/cameras/${encodeURIComponent(camera_code)}/live/stop`, {
      method: "POST",
      body: JSON.stringify({ session_id }),
    }),

  // --- Development reset ---
  // Removes what detection produced. The truck master, the camera registry and
  // the device API keys are never touched -- see the service for why each would
  // be painful to lose.
  getCrossingsResetPreview: (): Promise<{ crossings: number; detections: number; runs: number }> =>
    fetchJSON<{ crossings: number; detections: number; runs: number }>("/api/crossings-reset-preview"),

  resetCrossings: (): Promise<{
    status: string;
    removed: { crossings: number; detections: number; runs: number; snapshots: number };
    kept: { trucks: number; cameras: number };
    /** One entry per gate device the reset also reached, failures included. */
    gates: { url: string; ok?: boolean; removed?: { crossings: number; snapshots: number }; error?: string }[];
  }> => fetchJSON("/api/crossings-reset", { method: "POST" }),

  // The video test bench used to live here. It runs on the gate devices now --
  // see edge/backend/app/services/test_runs.py and the OCR Inspection HUD in the
  // gate UI. A bench on this side could only drive a second copy of the
  // pipeline, and two copies drifting apart is what makes the same truck resolve
  // differently at the gate and at the centre.
};
