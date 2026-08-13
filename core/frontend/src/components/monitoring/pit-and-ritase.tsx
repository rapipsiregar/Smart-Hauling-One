"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { RitaseReport, SitePlanData } from "@/lib/types";
import { GlassCard } from "../ui/glass-card";
import { GuideSwap } from "../ui/guide-note";
import { LogIn, LogOut, Loader, Repeat, Route, Truck } from "lucide-react";

/**
 * Pit occupancy and ritase, merged in from the retired Peta Gate and Buku
 * Lintasan pages.
 *
 * DELIBERATELY NOT SCOPED TO THE PAGE'S CAMERA FILTER, and labelled as such.
 * Both figures are fleet-wide by definition and filtering them would produce
 * numbers that look right and are not:
 *
 *   "Di dalam pit" means a truck whose LAST crossing anywhere was inbound. Scope
 *   it to one gate and it silently becomes "last crossing *at this gate*", which
 *   counts a truck as inside after it has left through another gate.
 *
 *   A ritase pairs one IN with one OUT per hull ACROSS gates, because a truck
 *   may enter at gate A and leave at gate B. Scope it to a single inbound gate
 *   and there is never an OUT to pair with, so every gate reports zero.
 *
 * The readings list above does follow the filter — there, per-gate is exactly
 * the question being asked.
 */
export function PitAndRitase() {
  const [plan, setPlan] = useState<SitePlanData | null>(null);
  const [ritase, setRitase] = useState<RitaseReport | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getSitePlan(), api.getRitase()])
      .then(([p, r]) => {
        setPlan(p);
        setRitase(r);
        setError(null);
      })
      .catch(() => setError("Data pit dan ritase tidak bisa dimuat."))
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <GlassCard className="p-6 flex justify-center">
        <Loader className="w-5 h-5 text-amber-500 animate-spin" />
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4 space-y-4">
      <GuideSwap
        title="Posisi Armada & Ritase"
        note="Ringkasan SELURUH lokasi, bukan per gate. 'Di dalam pit' berarti lintasan TERAKHIR truk itu tercatat masuk, di gate mana pun; kalau lintasan terakhirnya keluar, ia dihitung sudah keluar. Satu truk hanya dihitung satu kali. Satu ritase = satu lintasan masuk dipasangkan dengan satu lintasan keluar untuk nomor lambung yang sama, dan pasangannya boleh lewat gate berbeda — karena itu panel ini tidak ikut filter gate di daftar bawah; kalau ikut, angkanya akan terlihat wajar tapi salah. Kolom Siklus adalah selisih waktu masuk ke keluar, dan hanya terisi kalau lintasannya punya waktu asli."
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Posisi Armada &amp; Ritase
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
            seluruh gate
          </span>
        </div>

        {error && <p className="font-mono text-[11px] text-rose-400">{error}</p>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Stat icon={<LogIn className="w-4 h-4" />} label="Di dalam pit"
                value={plan?.total_inside ?? 0} unit="unit" accent="text-emerald-400" />
          <Stat icon={<LogOut className="w-4 h-4" />} label="Sudah keluar"
                value={plan?.total_outside ?? 0} unit="unit" accent="text-amber-400" />
          <Stat icon={<Truck className="w-4 h-4" />} label="Nomor lambung dikenali"
                value={plan?.total_trucks ?? 0} unit="unit" accent="text-sky-400" />
          <Stat icon={<Route className="w-4 h-4" />} label="Lane aktif"
                value={plan?.active_lanes.length ?? 0} unit="gate" accent="text-violet-400" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 pt-1">
          <TruckColumn
            title="Di dalam pit"
            subtitle="Lintasan terakhirnya tercatat masuk"
            hulls={(plan?.inside ?? []).map((c) => c.hull_id)}
          />
          <TruckColumn
            title="Sudah keluar"
            subtitle="Lintasan terakhirnya tercatat keluar"
            hulls={(plan?.outside ?? []).map((c) => c.hull_id)}
          />
        </div>

        <Ritase report={ritase} />
      </GuideSwap>
    </GlassCard>
  );
}

function Ritase({ report }: { report: RitaseReport | null }) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [report]);

  if (!report) return null;
  const paired = report.perHull.filter((h) => h.ritase > 0);
  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(paired.length / ITEMS_PER_PAGE);
  const displayed = paired.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="pt-3 border-t border-[var(--border)] space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Repeat className="w-3.5 h-3.5 text-amber-500" />
          <h4 className="text-xs font-semibold text-[var(--text-primary)]">Ritase</h4>
        </div>
        <span className="font-mono text-[10px] text-[var(--text-dim)]">
          {report.totalRitase} ritase · {report.totalCrossings} lintasan ·{" "}
          {report.unpairedCount} belum berpasangan
        </span>
      </div>

      {/* Which basis was used is not a detail: on `count` the duration column is
          empty because no crossing carried a real time, and an operator needs to
          know that rather than assume the cycle was not measured. */}
      <p className="text-[10px] text-[var(--text-dim)]">
        {report.pairingBasis === "chronological"
          ? "Dipasangkan menurut waktu, jadi durasi siklusnya nyata."
          : "Dipasangkan menurut jumlah masuk/keluar karena lintasannya belum punya waktu — durasi siklus tidak bisa dihitung."}
      </p>

      {paired.length === 0 ? (
        <p className="text-[11px] text-[var(--text-dim)]">
          Belum ada pasangan masuk-keluar yang lengkap.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-widest text-[var(--text-dim)] text-left">
                <tr>
                  <th className="py-1 pr-3">Nomor Lambung</th>
                  <th className="py-1 pr-3 text-right">Ritase</th>
                  <th className="py-1 pr-3 text-right">Masuk</th>
                  <th className="py-1 pr-3 text-right">Keluar</th>
                  <th className="py-1 text-right">Siklus</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((h) => (
                  <tr key={h.hullId} className="border-t border-[var(--border)]">
                    <td className="py-1 pr-3 font-mono text-[var(--text-primary)]">{h.hullId}</td>
                    <td className="py-1 pr-3 text-right font-mono">{h.ritase}</td>
                    <td className="py-1 pr-3 text-right font-mono text-emerald-400">{h.inCount}</td>
                    <td className="py-1 pr-3 text-right font-mono text-amber-400">{h.outCount}</td>
                    <td className="py-1 text-right font-mono">{formatCycle(h.avgCycleSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]" data-print="hide">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-0.5 text-[9px] font-bold rounded border border-[var(--border)] bg-[var(--bg-input)] hover:border-amber-500 disabled:opacity-40 disabled:hover:border-[var(--border)] transition-colors cursor-pointer text-[var(--text-secondary)]"
              >
                Sebelumnya
              </button>
              <span className="text-[9px] font-medium text-[var(--text-dim)]">
                Halaman {page} dari {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-0.5 text-[9px] font-bold rounded border border-[var(--border)] bg-[var(--bg-input)] hover:border-amber-500 disabled:opacity-40 disabled:hover:border-[var(--border)] transition-colors cursor-pointer text-[var(--text-secondary)]"
              >
                Selanjutnya
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** "—" when unknown, never 0m 0s: an unmeasured cycle is not a zero-length one. */
function formatCycle(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function TruckColumn({
  title, subtitle, hulls,
}: { title: string; subtitle: string; hulls: string[] }) {
  const [page, setPage] = useState(1);
  const unique = useMemo(() => Array.from(new Set(hulls)).sort(), [hulls]);

  useEffect(() => {
    setPage(1);
  }, [hulls]);

  const ITEMS_PER_PAGE = 24;
  const totalPages = Math.ceil(unique.length / ITEMS_PER_PAGE);
  const displayed = useMemo(() => {
    return unique.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  }, [unique, page]);

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="text-[10px] text-[var(--text-dim)]">{subtitle}</p>
      </div>
      {unique.length === 0 ? (
        <p className="text-[11px] text-[var(--text-dim)]">Tidak ada.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 min-h-[56px] content-start">
            {displayed.map((h) => (
              <span key={h}
                    className="px-2 py-0.5 rounded font-mono text-[11px] border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                {h}
              </span>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 pt-1" data-print="hide">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-0.5 text-[9px] font-bold rounded border border-[var(--border)] bg-[var(--bg-input)] hover:border-amber-500 disabled:opacity-40 disabled:hover:border-[var(--border)] transition-colors cursor-pointer text-[var(--text-secondary)]"
              >
                Sebelumnya
              </button>
              <span className="text-[9px] font-medium text-[var(--text-dim)]">
                Halaman {page} dari {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-0.5 text-[9px] font-bold rounded border border-[var(--border)] bg-[var(--bg-input)] hover:border-amber-500 disabled:opacity-40 disabled:hover:border-[var(--border)] transition-colors cursor-pointer text-[var(--text-secondary)]"
              >
                Selanjutnya
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  icon, label, value, unit, accent,
}: {
  icon: React.ReactNode; label: string; value: number; unit: string; accent: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
      <div className={`flex items-center gap-1.5 ${accent}`}>
        {icon}
        <span className="font-mono font-bold text-lg text-[var(--text-primary)]">{value}</span>
        <span className="text-[10px] text-[var(--text-dim)]">{unit}</span>
      </div>
      <p className="text-[10px] text-[var(--text-secondary)] mt-1">{label}</p>
    </div>
  );
}
