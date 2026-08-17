"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FleetMasterUnit } from "@/lib/types";
import { Truck, Search, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

interface FleetMasterTableProps {
  units: FleetMasterUnit[];
}

const STATUS_LAYAK = "Layak";
const PAGE_SIZE = 15;

export function FleetMasterTable({ units }: FleetMasterTableProps) {
  const [query, setQuery] = useState("");
  const [contractor, setContractor] = useState<string>("all");
  const [unitType, setUnitType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Reset ke halaman 1 jika filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [query, contractor, unitType, status]);

  const contractors = useMemo(
    () => Array.from(new Set(units.map((u) => u.contractor).filter(Boolean))).sort() as string[],
    [units]
  );
  const unitTypes = useMemo(() => {
    const types = units.map((u) => u.unitType?.trim().toUpperCase()).filter(Boolean);
    return Array.from(new Set(types)).sort() as string[];
  }, [units]);
  const statuses = useMemo(
    () => Array.from(new Set(units.map((u) => u.status).filter(Boolean))).sort() as string[],
    [units]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return units.filter((u) => {
      if (contractor !== "all" && u.contractor !== contractor) return false;
      if (unitType !== "all" && (u.unitType ?? "").trim().toUpperCase() !== unitType) return false;
      if (status !== "all" && u.status !== status) return false;
      if (!q) return true;
      return (
        u.hullId.toLowerCase().includes(q) ||
        u.hullCode.toLowerCase().includes(q) ||
        (u.contractor ?? "").toLowerCase().includes(q) ||
        (u.brand ?? "").toLowerCase().includes(q) ||
        (u.modelType ?? "").toLowerCase().includes(q)
      );
    });
  }, [units, query, contractor, unitType, status]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  return (
    <GlassCard className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] font-mono uppercase tracking-wide">
              Data Master Armada
            </h3>
            <p className="text-xs text-[var(--text-secondary)] font-sans">
              Seluruh unit terdaftar pada data induk armada, sesuai catatan operator
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30 uppercase">
          {filtered.length} / {units.length} UNIT
        </span>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-[var(--bg-elevated)] p-3 rounded-lg border border-[var(--border)] text-xs">
        <div className="flex items-center gap-1.5 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-[var(--text-dim)] shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nomor lambung, kontraktor, merek..."
            className="bg-transparent outline-none text-[var(--text-primary)] placeholder:text-[var(--text-dim)] w-full font-sans text-xs"
          />
        </div>

        <div className="h-4 w-px bg-[var(--border)] hidden md:block" />

        <div className="flex items-center gap-1.5 text-[var(--text-primary)] font-sans font-semibold">
          <span>Kontraktor:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setContractor("all")}
            className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition border ${
              contractor === "all"
                ? "bg-amber-500 text-slate-950 border-amber-600/30 hover:bg-amber-400"
                : "bg-[var(--bg-elevated)] hover:bg-[var(--border)] text-[var(--text-primary)] border-[var(--border)]"
            }`}
          >
            SEMUA
          </button>
          {contractors.map((c) => (
            <button
              key={c}
              onClick={() => setContractor(c)}
              className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition uppercase border ${
                contractor === c
                  ? "bg-amber-500 text-slate-950 border-amber-600/30 hover:bg-amber-400"
                  : "bg-[var(--bg-elevated)] hover:bg-[var(--border)] text-[var(--text-primary)] border-[var(--border)]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-[var(--border)] hidden md:block" />

        <div className="flex items-center gap-1.5 text-[var(--text-primary)] font-sans font-semibold">
          <span>Tipe Unit:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setUnitType("all")}
            className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition border ${
              unitType === "all"
                ? "bg-amber-500 text-slate-950 border-amber-600/30 hover:bg-amber-400"
                : "bg-[var(--bg-elevated)] hover:bg-[var(--border)] text-[var(--text-primary)] border-[var(--border)]"
            }`}
          >
            SEMUA
          </button>
          {unitTypes.map((t) => (
            <button
              key={t}
              onClick={() => setUnitType(t)}
              className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition uppercase border ${
                unitType === t
                  ? "bg-amber-500 text-slate-950 border-amber-600/30 hover:bg-amber-400"
                  : "bg-[var(--bg-elevated)] hover:bg-[var(--border)] text-[var(--text-primary)] border-[var(--border)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-[var(--border)] hidden md:block" />

        <div className="flex items-center gap-1.5 text-[var(--text-primary)] font-sans font-semibold">
          <span>Status:</span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setStatus("all")}
            className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition border ${
              status === "all"
                ? "bg-amber-500 text-slate-950 border-amber-600/30 hover:bg-amber-400"
                : "bg-[var(--bg-elevated)] hover:bg-[var(--border)] text-[var(--text-primary)] border-[var(--border)]"
            }`}
          >
            SEMUA
          </button>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition uppercase border ${
                status === s
                  ? "bg-amber-500 text-slate-950 border-amber-600/30 hover:bg-amber-400"
                  : "bg-[var(--bg-elevated)] hover:bg-[var(--border)] text-[var(--text-primary)] border-[var(--border)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-dim)] uppercase text-[10px] tracking-wider">
              <th className="py-3 px-3">Nomor Lambung</th>
              <th className="py-3 px-3">Kode</th>
              <th className="py-3 px-3">Kontraktor</th>
              <th className="py-3 px-3">Tipe Unit</th>
              <th className="py-3 px-3">Merek</th>
              <th className="py-3 px-3">Model</th>
              <th className="py-3 px-3 text-center">Tahun</th>
              <th className="py-3 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[var(--text-secondary)] font-sans font-medium">
                  Tidak ada unit yang cocok dengan pencarian/saringan.
                </td>
              </tr>
            )}
            {paginated.map((u) => {
              const layak = u.status === STATUS_LAYAK;
              return (
                <tr key={u.hullId} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3 font-bold text-amber-600 dark:text-amber-400 text-sm">
                    {u.hullId}
                  </td>
                  <td className="py-3 px-3 text-[var(--text-secondary)]">{u.hullCode}</td>
                  <td className="py-3 px-3 text-[var(--text-primary)] font-semibold">
                    {u.contractor ?? <span className="text-[var(--text-dim)]">—</span>}
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] text-[10px] font-bold uppercase">
                      {u.unitType ?? "—"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[var(--text-primary)]">
                    {u.brand ?? <span className="text-[var(--text-dim)]">—</span>}
                  </td>
                  <td className="py-3 px-3 text-[var(--text-primary)]">
                    {u.modelType ?? <span className="text-[var(--text-dim)]">—</span>}
                  </td>
                  <td className="py-3 px-3 text-center text-[var(--text-secondary)]">
                    {u.year ?? "—"}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {u.status ? (
                      layak ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30 text-[10px] font-bold uppercase">
                          <CheckCircle2 className="w-3 h-3" /> {u.status}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 dark:border-red-500/30 text-[10px] font-bold uppercase">
                          <XCircle className="w-3 h-3" /> {u.status}
                        </span>
                      )
                    ) : (
                      <span className="text-[var(--text-dim)]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-[var(--border)] pt-4 gap-3 text-xs">
          <div className="text-[var(--text-secondary)] font-sans">
            Menampilkan <span className="font-semibold text-[var(--text-primary)] font-mono">{Math.min(filtered.length, (currentPage - 1) * PAGE_SIZE + 1)}</span> sampai{" "}
            <span className="font-semibold text-[var(--text-primary)] font-mono">{Math.min(filtered.length, currentPage * PAGE_SIZE)}</span> dari{" "}
            <span className="font-semibold text-[var(--text-primary)] font-mono">{filtered.length}</span> unit
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] hover:text-amber-500 hover:border-amber-500/40 transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer font-sans font-semibold"
            >
              <ChevronLeft className="w-4 h-4" /> Sebelumnya
            </button>
            <div className="font-mono text-[var(--text-primary)] px-3 py-1 bg-[var(--bg-elevated)] rounded-md border border-[var(--border)]">
              {currentPage} / {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] hover:text-amber-500 hover:border-amber-500/40 transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer font-sans font-semibold"
            >
              Berikutnya <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
