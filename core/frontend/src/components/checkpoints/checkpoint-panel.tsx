"use client";

import React, { useEffect, useState } from "react";
import {
  MapPin, ArrowDownLeft, ArrowUpRight, AlertTriangle, X, ImageOff,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { CheckpointBreakdown, CrossingEvent, RitaseReport } from "@/lib/types";
import { checkpointColors, mediaUrl } from "@/lib/trend";
import { GlassCard } from "@/components/ui/glass-card";

/**
 * Haulage broken down by checkpoint, each card opening its own crossing log.
 *
 * This replaces the per-gate panel. `perGate` grouped by AREA, and two
 * checkpoints can share one — so CP 02 and CP 03 were being shown merged, which
 * is precisely what the site asked us to stop doing.
 *
 * Clicking a card opens the units that passed it, with the still frame the gate
 * captured. That is the cross-check loop: a figure that looks wrong on the
 * dashboard resolves to a photograph of the truck without anyone opening a
 * video file.
 */
export function CheckpointPanel({
  ritase,
  dark,
  range,
}: {
  ritase: RitaseReport;
  dark: boolean;
  range?: { startDate?: string; endDate?: string };
}) {
  const [open, setOpen] = useState<string | null>(null);
  const names = ritase.perCheckpoint.map((c) => c.checkpoint);
  const colors = checkpointColors(names, dark);

  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-2 mb-1">
        <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Ritase per Pos Cek</h3>
      </div>
      <p className="text-[11px] text-[var(--text-secondary)] mb-4">
        Klik satu pos cek untuk melihat daftar unit yang melintas beserta foto buktinya.
      </p>

      {ritase.perCheckpoint.length === 0 ? (
        <p className="text-xs text-[var(--text-dim)] font-mono py-6 text-center">
          Belum ada lintasan tercatat.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ritase.perCheckpoint.map((cp) => (
            <CheckpointCard
              key={cp.checkpoint}
              cp={cp}
              color={colors[cp.checkpoint]}
              active={open === cp.checkpoint}
              onClick={() => setOpen(open === cp.checkpoint ? null : cp.checkpoint)}
            />
          ))}
        </div>
      )}

      {open && (
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <CheckpointLog checkpoint={open} range={range} onClose={() => setOpen(null)} />
        </div>
      )}
    </GlassCard>
  );
}

function CheckpointCard({
  cp,
  color,
  active,
  onClick,
}: {
  cp: CheckpointBreakdown;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`text-left rounded-xl border p-3 transition-colors cursor-pointer ${
        active
          ? "border-amber-500 bg-amber-500/10"
          : "border-[var(--border)] hover:border-amber-500/40"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="w-2.5 h-2.5 rounded-sm shrink-0"
          style={{ backgroundColor: color }}
        />
        <p className="text-sm font-semibold truncate text-[var(--text-primary)]" title={cp.checkpoint}>
          {cp.checkpoint}
        </p>
      </div>

      <p className="mt-2 text-2xl font-bold font-mono text-amber-500 leading-none">
        {cp.ritase}
        <span className="ml-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">ritase</span>
      </p>

      <div className="mt-2 space-y-1 text-xs font-mono">
        <div className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400">
          <ArrowDownLeft className="w-3.5 h-3.5" /> masuk
          <span className="ml-auto tabular-nums">{cp.inbound}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sky-500 dark:text-sky-400">
          <ArrowUpRight className="w-3.5 h-3.5" /> keluar
          <span className="ml-auto tabular-nums">{cp.outbound}</span>
        </div>
        {cp.undirected > 0 && (
          // The gate saw the truck but could not tell which way it moved. Real
          // traffic that cannot be paired, so it is shown rather than folded in.
          <div className="flex items-center gap-1.5 text-[var(--text-dim)]">
            <AlertTriangle className="w-3.5 h-3.5" /> tanpa arah
            <span className="ml-auto tabular-nums">{cp.undirected}</span>
          </div>
        )}
      </div>
    </button>
  );
}

/**
 * The units that passed one checkpoint, newest first, with photo evidence.
 *
 * Fetched by checkpoint name and filtered client-side rather than by camera
 * code: the log has to include crossings whose camera attribution is missing
 * but whose checkpoint is known, and a camera-code query would drop exactly
 * those — the rows most likely to need checking.
 */
function CheckpointLog({
  checkpoint,
  range,
  onClose,
}: {
  checkpoint: string;
  range?: { startDate?: string; endDate?: string };
  onClose: () => void;
}) {
  const [rows, setRows] = useState<CrossingEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    api.getCrossingEvents(undefined, range)
      .then((all) => {
        if (cancelled) return;
        const mine = all
          .filter((c) => c.checkpoint === checkpoint)
          .sort((a, b) => (b.crossedAt ?? "").localeCompare(a.crossedAt ?? ""));
        setRows(mine);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) { setRows([]); setError("Log lintasan tidak dapat dimuat."); }
      });
    return () => { cancelled = true; };
  }, [checkpoint, range?.startDate, range?.endDate]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-bold text-[var(--text-primary)]">
          Log Unit — {checkpoint}
          {rows && (
            <span className="ml-2 font-mono font-normal text-[var(--text-dim)]">
              {rows.length} lintasan
            </span>
          )}
        </h4>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" /> Tutup
        </button>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}
      {rows === null && (
        <p className="text-xs text-[var(--text-dim)] font-mono py-4">Memuat log…</p>
      )}
      {rows?.length === 0 && !error && (
        <p className="text-xs text-[var(--text-dim)] font-mono py-4">
          Tidak ada lintasan di pos ini pada rentang waktu terpilih.
        </p>
      )}

      {rows && rows.length > 0 && (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <LogRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function LogRow({ row }: { row: CrossingEvent }) {
  const direction =
    row.direction === "inbound" ? "Masuk"
    : row.direction === "outbound" ? "Keluar"
    : "Tanpa arah";
  const tone =
    row.direction === "inbound" ? "text-emerald-500 dark:text-emerald-400"
    : row.direction === "outbound" ? "text-sky-500 dark:text-sky-400"
    : "text-[var(--text-dim)]";

  return (
    <div className="flex gap-3 rounded-lg border border-[var(--border)] p-2.5">
      <Evidence url={row.imageProofUrl} hull={row.hullId} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold font-mono text-[var(--text-primary)] truncate">
          {row.known ? row.hullId : "TIDAK TERBACA"}
        </p>
        <p className={`text-[11px] font-semibold ${tone}`}>{direction}</p>
        <p className="text-[11px] text-[var(--text-dim)] font-mono">
          {formatMoment(row.crossedAt)}
        </p>
        <p className="text-[11px] text-[var(--text-dim)]">
          Keyakinan {row.confidence}% · {row.reads} pembacaan
        </p>
      </div>
    </div>
  );
}

/**
 * The still the gate captured, as the meeting specified — a photo, not a video.
 *
 * A crossing can genuinely have no still (the empty-window case reads nothing
 * and has no crop to send), so the absence is drawn rather than left as a
 * broken image.
 */
function Evidence({ url: stored, hull }: { url: string | null; hull: string }) {
  const url = mediaUrl(stored);
  if (!url) {
    return (
      <div className="w-16 h-16 shrink-0 rounded-md border border-dashed border-[var(--border)] flex items-center justify-center">
        <ImageOff className="w-4 h-4 text-[var(--text-dim)]" />
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0"
      title="Buka foto ukuran penuh"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Foto bukti lintasan ${hull}`}
        className="w-16 h-16 object-cover rounded-md border border-[var(--border)]"
      />
    </a>
  );
}

function formatMoment(iso: string | null): string {
  if (!iso) return "waktu tidak tercatat";
  const parsed = new Date(iso.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(parsed.getDate())}/${pad(parsed.getMonth() + 1)} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}
