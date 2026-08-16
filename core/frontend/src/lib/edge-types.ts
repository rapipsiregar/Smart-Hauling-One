/**
 * Edge-device domain types (`docs/edge-system/API_CONTRACT.md` §2.1–§2.4 on the
 * backend branch). Kept out of `types.ts` so the edge system stays one readable
 * unit rather than more entries in an already-long shared barrel; `types.ts`
 * re-exports them, so importing from either module works.
 */

export type DeviceStatus = "online" | "offline" | "maintenance";

/**
 * Which way an *arriving* truck travels across this camera's frame.
 *
 * `"ltr"` left-to-right, `"rtl"` right-to-left. Mounting geometry, so it is set
 * per device: two gates rarely face the same way. Get it wrong and the gate
 * records every crossing as its exact opposite — departed trucks stay "inside"
 * the pit and ritase pairing silently corrupts — which is why it is on the
 * dashboard rather than buried in the device's own `.env`.
 */
export type InboundAxis = "ltr" | "rtl";

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
  inbound_axis: InboundAxis;
  config_version: number;
  device_status: DeviceStatus;
  agent_version: string | null;
  last_heartbeat_at: string | null;
  last_config_applied_at: string | null;
  applied_config_version: number;
  local_queue_depth: number;

  // --- connectivity ---------------------------------------------------------
  /** Video source the device pulls from. Editable via `PUT /api/cameras/{code}`. */
  rtsp_url: string | null;
  /** The device's address on the site network. */
  ip_host: string | null;
  /**
   * The core's address *as the device must dial it*. Read-only: a device needs
   * this value before it can reach the core at all, so it is copied into the
   * Jetson's `.env` at provisioning and can never be pushed down.
   */
  core_url: string;
  /**
   * Whether a key has ever been issued — never the key itself. Only the hash is
   * stored, so there is nothing to reveal; the card can offer "issue" or
   * "rotate", never "show".
   */
  api_key_set: boolean;
}

/** Partial update — at least one field, or the server answers 400 (§2.2). */
export type EdgeConfigPatch = Partial<
  Pick<
    EdgeConfig,
    "yolo_fps" | "ocr_fps" | "detect_window_sec" | "ocr_min_conf" | "dedup_iou" | "inbound_axis"
  >
>;

/**
 * The one-shot result of `POST /api/cameras/{code}/provision`.
 *
 * `api_key` is plaintext and exists only in this response — no endpoint can
 * return it again. Show it, let the operator copy it, and never persist it.
 */
export interface DeviceProvisioning {
  camera_code: string;
  api_key: string;
  core_url: string;
}

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
