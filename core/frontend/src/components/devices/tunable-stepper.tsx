"use client";

import React from "react";
import { Minus, Plus } from "lucide-react";
import { TunableField, quantize } from "@/lib/edge-config";

/**
 * One tunable as a numeric stepper (`docs/design_system.md` §7.10 — steppers,
 * not free text). The field's API range is the hard limit; the operating range
 * the business owner prefers is helper text, so commissioning can still go
 * outside it deliberately.
 */
export function TunableStepper({
  field,
  value,
  savedValue,
  error,
  disabled,
  onChange,
}: {
  field: TunableField;
  value: number;
  savedValue: number;
  error?: string | null;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  const clamp = (n: number) => Math.min(field.max, Math.max(field.min, n));
  const nudge = (delta: number) => onChange(quantize(clamp(value + delta), field));
  const changed = quantize(value, field) !== quantize(savedValue, field);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <label className="text-[11px] font-mono uppercase tracking-widest text-[var(--text-dim)]">
          {field.label}
        </label>
        {changed && (
          <span className="text-[10px] font-mono font-bold text-amber-500">
            diubah · dari {savedValue.toFixed(field.precision)}
          </span>
        )}
      </div>

      <div
        className={`flex items-stretch rounded-lg border overflow-hidden ${
          error ? "border-rose-500/50" : changed ? "border-amber-500/50" : "border-[var(--border)]"
        }`}
      >
        <StepButton label={`Kurangi ${field.label}`} disabled={disabled || value <= field.min} onClick={() => nudge(-field.step)}>
          <Minus className="w-3.5 h-3.5" />
        </StepButton>

        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ""}
          min={field.min}
          max={field.max}
          step={field.step}
          disabled={disabled}
          aria-label={field.label}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
          className="flex-1 min-w-0 bg-[var(--bg-elevated)] px-2 py-2 text-center text-sm font-mono font-bold text-[var(--text-primary)] outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />

        <StepButton label={`Tambah ${field.label}`} disabled={disabled || value >= field.max} onClick={() => nudge(field.step)}>
          <Plus className="w-3.5 h-3.5" />
        </StepButton>
      </div>

      <p className="text-[10px] text-[var(--text-dim)] mt-1 leading-snug">
        {field.hint} · lazim {field.typical} · batas {field.min}–{field.max}
      </p>

      {error && <p className="text-[11px] font-medium text-rose-400 mt-1">{error}</p>}
    </div>
  );
}

function StepButton({
  label, disabled, onClick, children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="px-2.5 bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-amber-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}
