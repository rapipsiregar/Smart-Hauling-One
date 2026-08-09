/**
 * Edge-device domain types (`docs/edge-system/API_CONTRACT.md` §2.1–§2.4 on the
 * backend branch). Kept out of `types.ts` so the edge system stays one readable
 * unit rather than more entries in an already-long shared barrel; `types.ts`
 * re-exports them, so importing from either module works.
 */

export type DeviceStatus = "online" | "offline" | "maintenance";

/**
 * One gate device's inference tunables plus its health, as returned by
 * `GET/PUT /api/cameras/{code}/edge-config`.
 *
 * `applied_config_version` is what the *device* last confirmed applying;
 * `config_version` is what the server holds. They differ between a save and the
 * device's next heartbeat — that gap is the "pending" state, not an error.
 */
export interface EdgeConfig {
  camera_code: string;
  yolo_fps: number;
  ocr_fps: number;
  detect_window_sec: number;
  ocr_min_conf: number;
  dedup_iou: number;
  config_version: number;
  device_status: DeviceStatus;
  agent_version: string | null;
  last_heartbeat_at: string | null;
  last_config_applied_at: string | null;
  applied_config_version: number;
  local_queue_depth: number;
}

/** Partial update — at least one field, or the server answers 400 (§2.2). */
export type EdgeConfigPatch = Partial<
  Pick<EdgeConfig, "yolo_fps" | "ocr_fps" | "detect_window_sec" | "ocr_min_conf" | "dedup_iou">
>;

/** An on-demand live-view session (§2.4). Ephemeral, held server-side only. */
export interface LiveSession {
  session_id: string;
  whep_url: string;
}

/**
 * The health/config summary the extended `GET /api/cameras` adds to every
 * camera row (§2.3). Optional throughout: the backend has not shipped these
 * columns yet, and a camera without them is one with no edge agent behind it.
 */
export interface CameraEdgeFields {
  device_status?: DeviceStatus;
  agent_version?: string | null;
  last_heartbeat_at?: string | null;
  local_queue_depth?: number;
  config_version?: number;
  applied_config_version?: number;
}
