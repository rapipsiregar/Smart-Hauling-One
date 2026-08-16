"use client";

/**
 * One candidate in the consensus vote.
 *
 * Shown wherever a reading is explained, because a hull id on its own cannot
 * distinguish a confident read from a near-tie the matcher had to resolve --
 * and those two need very different responses from whoever is looking.
 *
 * Bars are scaled to the leading candidate rather than to 100%, so a vote split
 * 40/38 reads as the close call it is instead of as two short stubs.
 */
export function VoteBar({
  id, share, reads, winner, maxShare,
}: {
  id: string; share: number; reads?: number; winner: boolean; maxShare: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`font-mono text-[11px] w-20 truncate ${
          winner ? "text-[var(--accent)] font-bold" : "text-[var(--text-secondary)]"
        }`}
        title={id}
      >
        {id}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            winner ? "bg-[var(--accent)]" : "bg-[var(--text-secondary)]"
          }`}
          style={{ width: `${(share / maxShare) * 100}%` }}
        />
      </div>
      <span className="font-mono text-[10px] text-[var(--text-secondary)] w-14 text-right">
        {(share * 100).toFixed(0)}%{reads != null ? ` ·${reads}` : ""}
      </span>
    </div>
  );
}

/** Percentage bar used for run progress. */
export function ProgressBar({
  label, value, max, detail,
}: { label: string; value: number; max: number; detail?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between font-mono text-[10px] text-[var(--text-secondary)]">
        <span>{label}</span>
        <span>{value}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
        <div
          className="h-full bg-[var(--accent)] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {detail && <p className="font-mono text-[10px] text-[var(--text-dim)]">{detail}</p>}
    </div>
  );
}
