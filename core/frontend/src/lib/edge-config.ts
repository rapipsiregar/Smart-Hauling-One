import { DeviceStatus, EdgeConfig, EdgeConfigPatch } from "./types";

/**
 * The edge tunables, straight from the backend spec's canonical table
 * (`docs/edge-system/PRD.md` §9) with the API ranges from API_CONTRACT §2.2.
 *
 * `min`/`max` are the API's hard limits — the server rejects anything outside
 * them regardless of what the form allows. `typical` is the business owner's
 * preferred operating range, shown as helper text only: narrowing the input to
 * it would make legitimate tuning impossible during commissioning.
 */
export interface TunableField {
  key: keyof EdgeConfigPatch;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  /** Decimal places — 0 for the integer fps/window fields. */
  precision: number;
  typical: string;
}

export const TUNABLES: TunableField[] = [
  {
    key: "yolo_fps",
    label: "YOLO FPS",
    hint: "Laju deteksi truk per detik",
    min: 1, max: 30, step: 1, precision: 0,
    typical: "18–25",
  },
  {
    key: "ocr_fps",
    label: "FPS Pembacaan",
    hint: "Laju pembacaan nomor lambung per detik",
    min: 1, max: 15, step: 1, precision: 0,
    typical: "±4",
  },
  {
    key: "detect_window_sec",
    label: "Jendela Deteksi",
    hint: "Durasi maksimum satu lintasan dikumpulkan sebelum divoting",
    min: 1, max: 30, step: 1, precision: 0,
    typical: "5–7 detik",
  },
  {
    key: "ocr_min_conf",
    label: "Ambang Keyakinan Pembacaan",
    hint: "Pembacaan di bawah nilai ini dibuang sebelum voting",
    min: 0, max: 1, step: 0.01, precision: 2,
    typical: "0.30",
  },
  {
    key: "dedup_iou",
    label: "Dedup IoU",
    hint: "Ambang tumpang tindih kotak untuk menganggap dua deteksi sama",
    min: 0, max: 1, step: 0.01, precision: 2,
    typical: "0.92",
  },
];

/**
 * Whether the device has confirmed applying the settings the server holds.
 *
 * A save bumps `config_version` immediately, but the device only reports back
 * `applied_config_version` on its next 30s heartbeat — so `pending` is the
 * normal state for up to half a minute, and a *stuck* pending means the device
 * is not picking up config (check its status, not the save).
 */
export type ConfigSyncState = "saved" | "pending";

export function configSyncState(cfg: Pick<EdgeConfig, "config_version" | "applied_config_version">): ConfigSyncState {
  return cfg.applied_config_version === cfg.config_version ? "saved" : "pending";
}

/**
 * How a device's health should read (`docs/design_system.md` §7.9).
 *
 * A backlog on a *connected* device is deliberately its own tone: a device that
 * is online but queueing has a different problem from one that is offline, and
 * showing both as plain green would hide it.
 */
export type HealthTone = "ok" | "warn" | "down";

export function deviceHealthTone(status: DeviceStatus, queueDepth: number): HealthTone {
  if (status === "offline") return "down";
  if (status === "maintenance") return "warn";
  return queueDepth > 0 ? "warn" : "ok";
}

export const TONE_CLASS: Record<HealthTone, string> = {
  ok: "text-emerald-400",
  warn: "text-amber-400",
  down: "text-rose-400",
};

/** Compact "12s ago" / "3m ago" for a heartbeat timestamp; "—" when never seen. */
export function lastSeenLabel(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "belum pernah";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const secs = Math.max(0, Math.round((now - then) / 1000));
  if (secs < 60) return `${secs} detik lalu`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.round(hours / 24)} hari lalu`;
}

/** Round to a field's precision — keeps 0.1 + 0.2 out of the request body. */
export function quantize(value: number, field: TunableField): number {
  const factor = 10 ** field.precision;
  return Math.round(value * factor) / factor;
}

/**
 * Only the fields that actually changed, as the API expects a partial update.
 * An empty result means there is nothing to save (the server answers 400 to an
 * empty body), which is what disables the save button.
 */
export function buildPatch(draft: EdgeConfigPatch, saved: EdgeConfig): EdgeConfigPatch {
  const patch: EdgeConfigPatch = {};
  for (const field of TUNABLES) {
    const next = draft[field.key];
    if (next === undefined) continue;
    if (quantize(next, field) !== quantize(saved[field.key], field)) {
      patch[field.key] = quantize(next, field);
    }
  }
  return patch;
}

/** Client-side mirror of the API range check — the server stays authoritative. */
export function rangeError(value: number, field: TunableField): string | null {
  if (!Number.isFinite(value)) return `${field.label} harus berupa angka`;
  if (value < field.min || value > field.max) {
    return `${field.label} harus antara ${field.min} dan ${field.max}`;
  }
  return null;
}

/** The saved values as a form draft. */
export function draftFrom(cfg: EdgeConfig): EdgeConfigPatch {
  return {
    yolo_fps: cfg.yolo_fps,
    ocr_fps: cfg.ocr_fps,
    detect_window_sec: cfg.detect_window_sec,
    ocr_min_conf: cfg.ocr_min_conf,
    dedup_iou: cfg.dedup_iou,
  };
}
