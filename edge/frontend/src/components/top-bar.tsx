"use client";

import { Cpu, Play, RefreshCw, Search, Settings as SettingsIcon, Square } from "lucide-react";
import { ClipSource, TestRun } from "@/lib/api";

/**
 * Controls and identity, along the top.
 *
 * Everything a person operates rather than reads: which clip to run, start and
 * stop, the box overlay toggle, the filter over the crossing list, and the way
 * into settings. Grouped here so the three panels below are all display and can
 * be scanned without hunting for a button among them.
 */
export function TopBar({
  cameraCode, direction, totalCrossings, clips, selectedClip, onSelectClip,
  run, running, busy, onStart, onStop, detailOn, onToggleDetail,
  filter, onFilter, onOpenSettings, onRefresh,
}: {
  cameraCode: string;
  direction: "inbound" | "outbound" | null;
  totalCrossings: number;
  clips: ClipSource[];
  selectedClip: string;
  onSelectClip: (name: string) => void;
  run: TestRun | null;
  running: boolean;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
  detailOn: boolean;
  onToggleDetail: () => void;
  filter: string;
  onFilter: (value: string) => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
}) {
  return (
    <header className="glass-card px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex items-center gap-2 shrink-0">
        <Cpu size={15} className="text-[var(--accent)]" />
        <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-[var(--accent)] hidden sm:inline">
          ISHS
        </span>
        <span className="font-mono text-sm font-semibold">{cameraCode}</span>
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
          {direction === "inbound" ? "MASUK"
            : direction === "outbound" ? "KELUAR"
            : "ARAH?"}
        </span>
      </div>

      <span className="font-mono text-[11px] text-[var(--text-secondary)] hidden md:inline">
        Total lintasan: <span className="text-[var(--text-primary)]">{totalCrossings}</span>
      </span>

      <div className="flex items-center gap-2 ml-auto flex-wrap">
        <select
          value={selectedClip}
          onChange={(e) => onSelectClip(e.target.value)}
          disabled={running || busy}
          className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-[11px] font-mono max-w-[190px] disabled:opacity-60"
        >
          <option value="ALL">Semua klip ({clips.length})</option>
          {clips.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>

        {running ? (
          <button
            onClick={onStop}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--danger)] text-[var(--danger)] text-[11px] font-semibold disabled:opacity-60"
          >
            <Square size={12} /> Hentikan
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={busy || clips.length === 0}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--accent)] text-[var(--accent)] text-[11px] font-semibold disabled:opacity-60"
          >
            <Play size={12} /> Jalankan Uji
          </button>
        )}

        {/* The one switch between the operator view and the diagnostic one.
            Off is the resting state: the lane, a green box where the system is
            looking, and the number it read. On adds the working figures — track
            ids, detection scores, per-sample readings, match outcomes — which
            answer a support question but invite one from everybody else. */}
        <button
          onClick={onToggleDetail}
          title={detailOn
            ? "Sembunyikan angka teknis"
            : "Tampilkan angka teknis (skor deteksi, sampel, hasil pencocokan)"}
          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono font-semibold ${
            detailOn
              ? "border-[var(--success)] text-[var(--success)]"
              : "border-[var(--border)] text-[var(--text-secondary)]"
          }`}
        >
          Detail: {detailOn ? "ON" : "OFF"}
        </button>

        <div className="relative">
          <Search
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)]"
          />
          <input
            value={filter}
            onChange={(e) => onFilter(e.target.value)}
            placeholder="Cari nomor lambung…"
            className="w-40 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg pl-6 pr-2 py-1.5 text-[11px] font-mono"
          />
        </div>

        <button
          onClick={onRefresh}
          title="Muat ulang"
          className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <RefreshCw size={13} />
        </button>
        <button
          onClick={onOpenSettings}
          title="Pengaturan"
          className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <SettingsIcon size={13} />
        </button>
      </div>

      {run && (
        <p className="w-full font-mono text-[10px] text-[var(--text-dim)] truncate">
          {run.message}
          {run.total > 1 && ` · klip ${run.completed}/${run.total}`}
        </p>
      )}
    </header>
  );
}
