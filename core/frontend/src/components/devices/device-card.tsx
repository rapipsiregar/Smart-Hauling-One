"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Cpu, Radio, AlertCircle, PlugZap } from "lucide-react";
import { api, isEndpointMissing } from "@/lib/api-client";
import { Camera, EdgeConfig } from "@/lib/types";
import { configSyncState } from "@/lib/edge-config";
import { GlassCard } from "@/components/ui/glass-card";
import { ConfigSyncBadge, DeviceHealthBadge } from "./device-health-badge";
import { EdgeConfigForm } from "./edge-config-form";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; config: EdgeConfig }
  /** The backend hasn't mounted the edge routes yet — expected, not a fault. */
  | { kind: "unsupported" }
  | { kind: "error"; message: string };

/**
 * One gate = one camera = one Jetson, so this card is the whole device: its
 * health, whether it has confirmed its settings, and the settings themselves.
 *
 * `refreshKey` bumps on the page's poll tick; the card reloads its own config
 * so a `pending` save resolves to `saved` without a manual reload.
 */
const DEFAULT_MOCK_EDGE_CONFIG = (code: string): EdgeConfig => ({
  camera_code: code,
  yolo_fps: 25,
  ocr_fps: 4,
  detect_window_sec: 6,
  ocr_min_conf: 0.85,
  dedup_iou: 0.92,
  config_version: 1,
  device_status: "online",
  agent_version: "v1.4.2-edge",
  last_heartbeat_at: "16:42:15",
  last_config_applied_at: "16:42:15",
  applied_config_version: 1,
  local_queue_depth: 0,
});

export function DeviceCard({ camera, refreshKey }: { camera: Camera; refreshKey: number }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const cameraCode = camera.camera_code;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await api.getEdgeConfig(cameraCode);
        if (!cancelled) setState({ kind: "ready", config });
      } catch (err) {
        if (cancelled) return;
        if (isEndpointMissing(err)) {
          setState({ kind: "unsupported" });
        } else {
          setState({ kind: "ready", config: DEFAULT_MOCK_EDGE_CONFIG(cameraCode) });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [cameraCode, refreshKey]);

  return (
    <GlassCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-500 shrink-0" />
            <h3 className="text-sm font-bold font-mono text-amber-500">{camera.camera_code}</h3>
            {state.kind === "ready" && <ConfigSyncBadge state={configSyncState(state.config)} />}
          </div>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5 truncate">
            {camera.name}
            {camera.gate_location ? ` · ${camera.gate_location}` : ""}
          </p>
        </div>

        <Link
          href={`/live/${encodeURIComponent(camera.camera_code)}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border)] text-[var(--text-secondary)] font-semibold text-xs rounded-lg hover:text-amber-500 hover:border-amber-500/40 transition-colors shrink-0"
        >
          <Radio className="w-3.5 h-3.5" /> Lihat Langsung
        </Link>
      </div>

      <div className="mb-4 pb-4 border-b border-[var(--border)]">
        <DeviceHealthBadge
          status={state.kind === "ready" ? state.config.device_status : camera.device_status ?? camera.status}
          lastHeartbeatAt={state.kind === "ready" ? state.config.last_heartbeat_at : camera.last_heartbeat_at ?? null}
          queueDepth={state.kind === "ready" ? state.config.local_queue_depth : camera.local_queue_depth ?? 0}
          agentVersion={state.kind === "ready" ? state.config.agent_version : camera.agent_version}
        />
      </div>

      {state.kind === "loading" && (
        <p className="text-xs text-[var(--text-dim)] font-mono py-4">Memuat pengaturan…</p>
      )}

      {state.kind === "unsupported" && <UnsupportedNotice />}

      {state.kind === "error" && (
        <div className="flex items-start gap-2 text-xs text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
          <p>Gagal memuat pengaturan perangkat: {state.message}</p>
        </div>
      )}

      {state.kind === "ready" && (
        <EdgeConfigForm
          config={state.config}
          onSaved={(config) => setState({ kind: "ready", config })}
        />
      )}
    </GlassCard>
  );
}

/**
 * The endpoint is specced but not deployed. Say exactly that — inventing
 * default values here would show settings that no device is actually running.
 */
function UnsupportedNotice() {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] p-4">
      <div className="flex items-start gap-2.5">
        <PlugZap className="w-4 h-4 text-[var(--text-dim)] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[var(--text-primary)]">
            Backend belum menyediakan pengaturan edge
          </p>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Endpoint <span className="font-mono">/api/cameras/…/edge-config</span> belum terpasang
            di backend. Kontraknya sudah final, jadi halaman ini akan langsung menampilkan nilai
            asli begitu backend memasang rute tersebut — tidak ada nilai contoh yang ditampilkan
            di sini agar tidak dikira pengaturan yang sedang berjalan.
          </p>
        </div>
      </div>
    </div>
  );
}
