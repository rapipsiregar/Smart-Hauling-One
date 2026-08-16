import { DeviceStatus, EdgeConfig, InboundAxis } from "./types";

/**
 * The detection tunables (frame rates, OCR threshold, dedup tolerance) are no
 * longer on this page. They are commissioning-time values that the site does
 * not revisit, and putting five sliders in front of the one setting operators
 * *do* change made the important control hard to find.
 *
 * They still exist server-side with their documented defaults, and the API
 * still accepts them — nothing was removed from the contract, only from the
 * screen. Restoring the form would be additive.
 */

/**
 * What each axis means, phrased the way an operator looks at the gate: they
 * know which way trucks drive past the camera, not which way an "axis" points.
 *
 * Both options are stated in full rather than as a checkbox, because "inbound
 * is right-to-left" and "inbound is left-to-right" are equally plausible before
 * you look at the footage — a checkbox would make one of them the silent
 * default and hide the very ambiguity this setting exists to resolve.
 */
export interface AxisOption {
  value: InboundAxis;
  label: string;
  hint: string;
}

export const AXIS_OPTIONS: AxisOption[] = [
  {
    value: "rtl",
    label: "Kanan ke kiri = Masuk",
    hint: "Truk yang bergerak dari kanan ke kiri layar dihitung MASUK area tambang, dan yang dari kiri ke kanan dihitung KELUAR.",
  },
  {
    value: "ltr",
    label: "Kiri ke kanan = Masuk",
    hint: "Truk yang bergerak dari kiri ke kanan layar dihitung MASUK area tambang, dan yang dari kanan ke kiri dihitung KELUAR.",
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
  ok: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  down: "text-rose-500 dark:text-rose-400",
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

