"use client";

import {
  AlertTriangle, Camera, Cloud, CloudOff, Cpu, Database, LogIn, LogOut, WifiOff,
} from "lucide-react";
import { GateStatus, readerName } from "@/lib/api";

/**
 * Device health, along the bottom.
 *
 * These were four cards across the top of the old screen. They matter -- a gate
 * that cannot reach the centre, or whose camera has dropped, is the first thing
 * to check -- but they are a background condition, not the thing being watched.
 * The reading is. So they moved to a strip that stays visible without competing
 * with the live view for the middle of the screen.
 *
 * Nothing was dropped in the move: camera, direction, upstream link, queue depth,
 * master replica, and the inference thread's last error are all still here.
 */
export function StatusBar({ status }: { status: GateStatus | null }) {
  if (!status) {
    return (
      <div className="glass-card px-3 py-2 text-[11px] font-mono text-[var(--text-secondary)]">
        menghubungi perangkat…
      </div>
    );
  }

  return (
    <div className="glass-card px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <Chip
        icon={status.camera_connected ? <Camera size={12} /> : <WifiOff size={12} />}
        label="Kamera"
        value={status.camera_connected ? "Terhubung" : "Tidak ada gambar"}
        tone={status.camera_connected ? "ok" : "bad"}
      />
      {/* Which way this lane faces decides whether a crossing is an arrival or a
          departure, and a camera code says nothing about it. Unknown is shown as
          unknown: guessing would mislabel every crossing this gate records. */}
      <Chip
        icon={
          status.direction === "inbound" ? <LogIn size={12} />
          : status.direction === "outbound" ? <LogOut size={12} />
          : <AlertTriangle size={12} />
        }
        label="Arah"
        value={
          status.direction === "inbound" ? "Masuk"
          : status.direction === "outbound" ? "Keluar"
          : "Belum diketahui"
        }
        tone={status.direction ? "ok" : "warn"}
      />
      <Chip
        icon={status.core_reachable ? <Cloud size={12} /> : <CloudOff size={12} />}
        label="Pusat"
        // Being cut off is expected on satellite and is not a failure: the gate
        // keeps detecting and queueing, which is the entire design.
        value={status.core_reachable ? "Terhubung" : "Terputus"}
        tone={status.core_reachable ? "ok" : "warn"}
      />
      <Chip
        icon={<Database size={12} />}
        label="Antre"
        value={String(status.outbox_depth)}
        tone={status.outbox_depth > 0 ? "warn" : "ok"}
      />
      <Chip
        icon={<Cpu size={12} />}
        label="Pembaca"
        value={readerName(status.ocr_backend)}
        tone="ok"
      />
      <span className="font-mono text-[10px] text-[var(--text-dim)]">
        master v{status.master.version} · {status.master.units} unit ·{" "}
        {status.crossings.total} lintasan
      </span>

      {/* The inference thread can die while every other thread carries on. That
          is the one failure a gate must never show as healthy. */}
      {status.last_error && (
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--danger)] ml-auto">
          <AlertTriangle size={12} /> {status.last_error}
        </span>
      )}
      {!status.last_error && !status.detecting && status.agent_running && (
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--warning)] ml-auto">
          <AlertTriangle size={12} /> Proses deteksi tidak berjalan
        </span>
      )}
    </div>
  );
}

function Chip({
  icon, label, value, tone,
}: {
  icon: React.ReactNode; label: string; value: string;
  tone: "ok" | "warn" | "bad";
}) {
  const color =
    tone === "ok" ? "var(--success)" : tone === "warn" ? "var(--warning)" : "var(--danger)";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px]">
      <span className="text-[var(--text-dim)]">{icon}</span>
      <span className="uppercase tracking-wide text-[10px] text-[var(--text-secondary)]">
        {label}
      </span>
      <span className="w-1.5 h-1.5 rounded-full pulse" style={{ background: color }} />
      <span className="font-mono font-semibold" style={{ color }}>{value}</span>
    </span>
  );
}
