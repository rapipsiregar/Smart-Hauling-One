"use client";

import React, { useEffect, useState } from "react";
import { CctvDetection } from "@/lib/types";
import { ConfChip } from "../ui/conf-chip";
import { GuideSwap } from "../ui/guide-note";
import { CheckCircle2, AlertTriangle, ScanLine } from "lucide-react";

interface DetectionListProps {
  detections: CctvDetection[];
  selectedId: string | null;
  onSelect: (d: CctvDetection) => void;
}

export function DetectionList({ detections, selectedId, onSelect }: DetectionListProps) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [detections]);

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(detections.length / ITEMS_PER_PAGE);
  const displayed = detections.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <ScanLine className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Daftar Pembacaan Nomor Lambung</h3>
        <span className="ml-auto text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-widest">
          {detections.length} reads
        </span>
      </div>

      <GuideSwap title="Daftar Pembacaan Nomor Lambung" note="Seluruh pembacaan yang dikirim perangkat gate ke pusat. Tanda hijau berarti hasil baca antar-gambar sepakat; kuning berarti sempat berbeda-beda, jadi layak diperiksa. Tiap baris juga menyebut gate asalnya. Klik satu baris untuk melihat rinciannya beserta fotonya di panel kanan.">
      <div className="space-y-3">
        <div className="flex-1 overflow-y-auto rounded-lg border border-[var(--border)] divide-y divide-[var(--border)] max-h-[520px]">
          {displayed.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-[var(--text-secondary)] font-medium">
              Belum ada pembacaan yang tercatat.
            </p>
          )}
          {displayed.map((d) => {
            const isSel = d.id === selectedId;
            return (
              <button
                key={d.id}
                onClick={() => onSelect(d)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer ${
                  isSel ? "bg-amber-500/[0.08]" : "hover:bg-amber-500/[0.03]"
                }`}
              >
                <div className="shrink-0">
                  {d.isConsistent ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-[var(--text-primary)] truncate">
                      {d.ocrText || "UNIDENTIFIED"}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase">{d.towerId}</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] font-medium truncate">
                    {d.camera} · {d.ocrReadCount} pembacaan · {d.framesProcessed} gambar
                  </p>
                </div>
                <ConfChip confidence={d.confidence} />
              </button>
            );
          })}
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
      </div>
      </GuideSwap>
    </div>
  );
}
