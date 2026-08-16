"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Preflight } from "@/lib/api";

/**
 * The commissioning checklist, on the screen the technician already has open.
 *
 * Shown ONLY while something is wrong. A device that is correctly configured
 * needs no reassurance panel taking up the console it is trying to be — and a
 * green banner that is always there stops being read long before the day it
 * turns red.
 */
export function PreflightPanel() {
  const [report, setReport] = useState<Preflight | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      setReport(await api.preflight());
    } catch (err) {
      // The API being unreachable is its own, louder failure that the status bar
      // already reports, so no second banner here -- but it is logged rather
      // than swallowed, because a check that silently declines to run looks
      // exactly like a device that passed.
      console.warn("preflight: gagal dijalankan", err);
      setReport(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  if (!report || report.ready) return null;

  const failed = report.checks.filter((c) => !c.ok);

  return (
    <section className="rounded-lg border border-red-500/40 bg-red-500/5 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-red-400">
          Perangkat belum siap beroperasi
        </h2>
        <button
          type="button"
          onClick={check}
          disabled={checking}
          className="px-3 py-1 text-xs font-semibold rounded border border-white/15 hover:border-white/40 disabled:opacity-40 transition-colors cursor-pointer"
        >
          {checking ? "Memeriksa…" : "Periksa Ulang"}
        </button>
      </div>

      <p className="text-xs text-white/60 leading-relaxed">
        Pos <span className="font-mono">{report.cameraCode ?? "—"}</span> berjalan,
        tetapi {failed.length} hal berikut membuat data tidak sampai ke pusat.
        Perbaiki berurutan dari atas.
      </p>

      <ol className="space-y-2.5">
        {report.checks.map((c) => (
          <li key={c.name} className="flex gap-2.5">
            <span
              aria-hidden
              className={`mt-0.5 text-sm leading-none ${
                c.ok ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {c.ok ? "✓" : "✗"}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white/90">{c.name}</p>
              <p className="text-[11px] text-white/50 leading-relaxed">{c.detail}</p>
              {c.fix && (
                <p className="text-[11px] text-amber-300/90 leading-relaxed mt-0.5">
                  → {c.fix}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
