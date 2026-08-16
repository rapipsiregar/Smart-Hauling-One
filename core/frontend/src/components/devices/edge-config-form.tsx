"use client";

import React, { useState } from "react";
import { Save, RotateCcw, ArrowLeftRight, AlertTriangle } from "lucide-react";
import { ApiError, api } from "@/lib/api-client";
import { EdgeConfig, InboundAxis } from "@/lib/types";
import { AXIS_OPTIONS } from "@/lib/edge-config";

/**
 * Per-device settings: which way this gate reads traffic.
 *
 * This used to carry five detection tunables. They were commissioning-time
 * values nobody revisited, and they crowded out the one setting that actually
 * gets changed — so they now live on the server with their defaults and off
 * this screen (see `lib/edge-config.ts`).
 */
export function EdgeConfigForm({
  config,
  onSaved,
}: {
  config: EdgeConfig;
  onSaved: (next: EdgeConfig) => void;
}) {
  const [draft, setDraft] = useState<InboundAxis>(config.inbound_axis);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges = draft !== config.inbound_axis;

  const reset = () => {
    setDraft(config.inbound_axis);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const next = await api.updateEdgeConfig(config.camera_code, { inbound_axis: draft });
      onSaved(next);
      setDraft(next.inbound_axis);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.serverMessage ?? `Gagal menyimpan (${err.status})`
          : "Gagal menyimpan — server tidak terjangkau.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ArrowLeftRight className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <h4 className="text-xs font-bold text-[var(--text-primary)]">Arah Gerak Truk di Kamera Ini</h4>
        </div>
        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-3">
          Tentukan arah gerak truk di layar kamera pos ini yang berarti MASUK area tambang.
          Pengaturan ini mengikuti posisi pemasangan kamera, jadi tiap pos bisa berbeda.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {AXIS_OPTIONS.map((option) => {
            const selected = draft === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={saving}
                onClick={() => setDraft(option.value)}
                aria-pressed={selected}
                className={`text-left rounded-lg border p-3 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  selected
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-[var(--border)] hover:border-amber-500/40"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
                      selected ? "border-amber-500 bg-amber-500" : "border-[var(--border)]"
                    }`}
                  />
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-semibold ${
                        selected ? "text-amber-600 dark:text-amber-400" : "text-[var(--text-primary)]"
                      }`}
                    >
                      {option.label}
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mt-1">
                      {option.hint}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {hasChanges && <AxisWarning />}

      {error && <p className="text-xs font-medium text-rose-400">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!hasChanges || saving}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 text-slate-950 font-semibold text-xs rounded-lg hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Menyimpan…" : "Simpan Pengaturan"}
        </button>

        {hasChanges && !saving && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--border)] text-[var(--text-secondary)] font-semibold text-xs rounded-lg hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Batalkan
          </button>
        )}

        <p className="text-[11px] text-[var(--text-dim)] leading-snug">
          Perangkat menerapkan perubahan pada detak berikutnya (±30 detik).
        </p>
      </div>
    </div>
  );
}

/**
 * Changing the axis re-interprets this gate entirely, so the consequence is
 * stated before the save rather than discovered afterwards — and the limit is
 * stated too: crossings already recorded keep the direction they were saved
 * with, because nothing here can know which of them were read backwards.
 */
function AxisWarning() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-px" />
      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
        Mengubah arah membalik cara pos ini membaca semua lintasan berikutnya. Data lintasan
        yang <span className="font-semibold text-[var(--text-primary)]">sudah tercatat tidak ikut berubah</span> —
        jika riwayat sebelumnya terbaca terbalik, catatan lama perlu diproses ulang secara terpisah.
      </p>
    </div>
  );
}
