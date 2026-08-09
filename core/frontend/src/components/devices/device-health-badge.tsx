"use client";

import React from "react";
import { Wifi, WifiOff, Wrench, Inbox, CheckCircle2, Clock3 } from "lucide-react";
import { DeviceStatus } from "@/lib/types";
import {
  ConfigSyncState, TONE_CLASS, deviceHealthTone, lastSeenLabel,
} from "@/lib/edge-config";

const STATUS_ICON: Record<DeviceStatus, React.ReactNode> = {
  online: <Wifi className="w-3.5 h-3.5" />,
  offline: <WifiOff className="w-3.5 h-3.5" />,
  maintenance: <Wrench className="w-3.5 h-3.5" />,
};

const STATUS_LABEL: Record<DeviceStatus, string> = {
  online: "online",
  offline: "offline",
  maintenance: "perawatan",
};

/**
 * One gate device's health at a glance (`docs/design_system.md` §7.9): status,
 * when it last checked in, and how many crossings are still queued on it.
 *
 * A pending backlog on an online device is coloured as a warning even though
 * the device itself is fine — a growing queue is its own failure mode and must
 * not look identical to a healthy `queue: 0`.
 */
export function DeviceHealthBadge({
  status,
  lastHeartbeatAt,
  queueDepth,
  agentVersion,
}: {
  status: DeviceStatus;
  lastHeartbeatAt: string | null;
  queueDepth: number;
  agentVersion?: string | null;
}) {
  const tone = deviceHealthTone(status, queueDepth);
  const queueTone = queueDepth > 0 ? "text-amber-400" : "text-[var(--text-dim)]";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${TONE_CLASS[tone]}`}>
        {STATUS_ICON[status]} {STATUS_LABEL[status]}
      </span>

      <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-dim)]">
        <Clock3 className="w-3 h-3" /> {lastSeenLabel(lastHeartbeatAt)}
      </span>

      <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono ${queueTone}`}>
        <Inbox className="w-3 h-3" /> antrean {queueDepth}
      </span>

      {agentVersion && (
        <span className="text-[11px] font-mono text-[var(--text-dim)]">agent {agentVersion}</span>
      )}
    </div>
  );
}

/**
 * Whether the device has confirmed the settings the server holds. `pending` is
 * expected for up to one heartbeat interval after a save; if it stays pending,
 * the device is not collecting its config — a real condition, not a UI glitch.
 */
export function ConfigSyncBadge({ state }: { state: ConfigSyncState }) {
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-semibold text-emerald-400">
        <CheckCircle2 className="w-3 h-3" /> Pengaturan tersimpan
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/25 text-[11px] font-semibold text-amber-400">
      <Clock3 className="w-3 h-3" /> Menunggu perangkat
    </span>
  );
}
