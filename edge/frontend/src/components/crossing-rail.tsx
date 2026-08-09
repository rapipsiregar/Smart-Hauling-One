"use client";

import { useState } from "react";
import { CloudOff, Trash2, Truck, Wifi } from "lucide-react";
import { Crossing, StoredVote, snapshotUrl } from "@/lib/api";
import { VoteBar } from "@/components/vote-bar";

/**
 * This gate's own crossings, newest first, each with the crop it voted on.
 *
 * A thumbnail per row rather than a table of numbers: the question a technician
 * is actually asking of this list is "did it read that truck right", and the
 * only way to answer it is to see the plate next to the number. The rest of the
 * evidence -- the vote, the raw reading, how long the window ran -- opens on
 * click, one row at a time, because a wall of expanded rows buries the list.
 *
 * Everything here is served by this device and survives the link to the centre
 * going down, which is the whole reason a gate runs its own stack.
 */
export function CrossingRail({
  crossings, filter, onReset, detailOn,
}: {
  crossings: Crossing[];
  filter: string;
  onReset: () => void;
  detailOn: boolean;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const term = filter.trim().toUpperCase();
  const shown = term
    ? crossings.filter(
        (c) =>
          (c.hull_id ?? "").toUpperCase().includes(term) ||
          (c.raw_code ?? "").toUpperCase().includes(term),
      )
    : crossings;

  return (
    <div className="glass-card flex flex-col min-h-0 h-full">
      <div className="flex items-center gap-2 p-3 border-b border-[var(--border)] shrink-0">
        <Truck size={14} className="text-[var(--accent)]" />
        <span className="text-xs font-semibold">Lintasan Terbaru</span>
        <span className="text-[10px] font-mono text-[var(--text-secondary)]">
          ({shown.length}
          {term && ` / ${crossings.length}`})
        </span>
        <button
          onClick={onReset}
          title="Hapus riwayat lintasan di perangkat ini"
          className="ml-auto text-[var(--text-dim)] hover:text-[var(--danger)] transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
        {shown.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] p-2">
            {term
              ? `Tidak ada lintasan cocok "${term}".`
              : "Belum ada lintasan terdeteksi di gate ini."}
          </p>
        ) : (
          shown.map((c) => (
            <CrossingRow
              key={c.id}
              crossing={c}
              detailOn={detailOn}
              open={detailOn && expanded === c.id}
              onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CrossingRow({
  crossing: c, open, onToggle, detailOn,
}: { crossing: Crossing; open: boolean; onToggle: () => void; detailOn: boolean }) {
  const [noImage, setNoImage] = useState(false);
  const identified = c.hull_id && c.hull_id !== "UNKNOWN";
  const votes = parseVotes(c.votes_json);
  const total = votes.reduce((sum, v) => sum + v.count, 0) || 1;
  const maxShare = Math.max(...votes.map((v) => v.count / total), 0.0001);

  return (
    <div
      className={`rounded-lg border transition-colors ${
        open ? "border-[var(--accent)]/50" : "border-[var(--border)]"
      }`}
    >
      <button
        onClick={onToggle}
        disabled={!detailOn}
        className="w-full flex items-center gap-2 p-1.5 text-left rounded-lg enabled:hover:bg-[var(--border)]/30 disabled:cursor-default"
      >
        {noImage ? (
          <div className="h-9 w-14 rounded bg-black/40 shrink-0 grid place-items-center text-[8px] text-[var(--text-dim)]">
            tanpa
            <br />
            gambar
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={snapshotUrl(c.id)}
            alt=""
            className="h-9 w-14 rounded object-cover bg-black shrink-0"
            onError={() => setNoImage(true)}
          />
        )}
        <div className="min-w-0 flex-1">
          <div
            className={`font-mono text-sm font-semibold truncate ${
              identified ? "" : "text-[var(--text-secondary)]"
            }`}
          >
            {identified ? c.hull_id : c.raw_code ?? "tak terbaca"}
          </div>
          {/* The working figures — how sure, and how it was matched. They answer
              a support question and prompt one from everybody else, so they wait
              behind the Detail switch. The crop and the number stand alone. */}
          {detailOn && (
            <div className="font-mono text-[10px] text-[var(--text-secondary)] truncate">
              {c.confidence != null ? `${Math.round(c.confidence * 100)}%` : "—"} ·{" "}
              {c.match_outcome ?? "—"}
            </div>
          )}
        </div>
        {/* Delivery state, not detection state. A gate that is reading fine but
            cannot reach the centre is a different problem from one that is not
            reading, and the two must never look the same on this list. */}
        {c.synced ? (
          <Wifi size={12} className="text-[var(--success)] shrink-0" />
        ) : (
          <CloudOff size={12} className="text-[var(--warning)] shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-2 pb-2 pt-1 space-y-2 border-t border-[var(--border)]">
          {votes.length === 0 ? (
            <p className="text-[10px] text-[var(--text-secondary)]">
              Tidak ada pembacaan pada jendela ini — truk terlihat tapi nomornya
              tidak terbaca sama sekali.
            </p>
          ) : (
            votes.map((v) => (
              <VoteBar
                key={v.text}
                id={v.text}
                share={v.count / total}
                reads={v.count}
                winner={v.text === c.raw_code || votes.length === 1}
                maxShare={maxShare}
              />
            ))
          )}
          <dl className="grid grid-cols-2 gap-x-2 text-[10px] font-mono text-[var(--text-secondary)]">
            <dt>Nomor terbaca</dt>
            <dd className="text-right">{c.raw_code ?? "—"}</dd>
            <dt>Jumlah pembacaan</dt>
            <dd className="text-right">{c.read_count ?? "—"}</dd>
            <dt>Panjang jendela</dt>
            <dd className="text-right">
              {c.window_sec != null ? `${c.window_sec.toFixed(1)}s` : "—"}
            </dd>
            <dt>Waktu</dt>
            <dd className="text-right truncate">{c.detected_at}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

/** votes_json is TEXT written by the device; never let a bad row kill the page. */
function parseVotes(raw: string | null): StoredVote[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredVote[]) : [];
  } catch {
    return [];
  }
}
