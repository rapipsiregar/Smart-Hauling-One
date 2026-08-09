"use client";

import React, { useMemo, useState } from "react";
import { Save, RotateCcw } from "lucide-react";
import { ApiError, api } from "@/lib/api-client";
import { EdgeConfig, EdgeConfigPatch } from "@/lib/types";
import {
  TUNABLES, buildPatch, draftFrom, quantize, rangeError,
} from "@/lib/edge-config";
import { TunableStepper } from "./tunable-stepper";

/**
 * The per-device settings form (`docs/design_system.md` §7.10).
 *
 * Saving sends only the changed fields — the API takes a partial update and
 * rejects an empty body, which is why the save button stays disabled until
 * something actually differs from the last saved values.
 */
export function EdgeConfigForm({
  config,
  onSaved,
}: {
  config: EdgeConfig;
  onSaved: (next: EdgeConfig) => void;
}) {
  const [draft, setDraft] = useState<EdgeConfigPatch>(() => draftFrom(config));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Server-side field errors, keyed by field. The API reports one field at a
  // time (§2.2), so this holds at most one entry.
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof EdgeConfigPatch, string>>>({});

  const patch = useMemo(() => buildPatch(draft, config), [draft, config]);
  const localErrors = useMemo(() => {
    const errs: Partial<Record<keyof EdgeConfigPatch, string>> = {};
    for (const field of TUNABLES) {
      const value = draft[field.key];
      const err = rangeError(value ?? NaN, field);
      if (err) errs[field.key] = err;
    }
    return errs;
  }, [draft]);

  const hasChanges = Object.keys(patch).length > 0;
  const hasLocalError = Object.keys(localErrors).length > 0;

  const reset = () => {
    setDraft(draftFrom(config));
    setFieldErrors({});
    setFormError(null);
  };

  const save = async () => {
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const next = await api.updateEdgeConfig(config.camera_code, patch);
      onSaved(next);
      setDraft(draftFrom(next));
    } catch (err) {
      // The server is authoritative on ranges; surface its message verbatim and
      // attach it to the field it names, so it lands where the operator looks.
      const message = err instanceof ApiError
        ? err.serverMessage ?? `Gagal menyimpan (${err.status})`
        : "Gagal menyimpan — backend tidak terjangkau.";
      const named = TUNABLES.find((f) => message.startsWith(f.key));
      if (named) setFieldErrors({ [named.key]: message });
      else setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TUNABLES.map((field) => (
          <TunableStepper
            key={field.key}
            field={field}
            value={draft[field.key] ?? NaN}
            savedValue={config[field.key]}
            error={fieldErrors[field.key] ?? localErrors[field.key]}
            disabled={saving}
            onChange={(next) =>
              setDraft((d) => ({
                ...d,
                [field.key]: Number.isFinite(next) ? quantize(next, field) : next,
              }))
            }
          />
        ))}
      </div>

      {formError && <p className="text-xs font-medium text-rose-400">{formError}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!hasChanges || hasLocalError || saving}
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
          {hasChanges
            ? `${Object.keys(patch).length} nilai diubah — dikirim ke perangkat pada detak berikutnya.`
            : "Perangkat menerapkan perubahan pada detak berikutnya (±30 detik)."}
        </p>
      </div>
    </div>
  );
}
