"use client";

import React from "react";
import { RitaseTrend } from "@/lib/types";
import { checkpointColors, formatBucket, trendTotals } from "@/lib/trend";

/**
 * The same series as numbers, with the column totals the site asked for.
 *
 * Two jobs at once. It is the "total penjumlahan" from the meeting, and it is
 * the accessibility relief the palette validator requires: three of the light
 * palette's four hues sit under 3:1 against the light surface, so the figures
 * must be readable without relying on the swatch. One table settles both.
 */
export function TrendTable({ trend, dark }: { trend: RitaseTrend; dark: boolean }) {
  const colors = checkpointColors(trend.checkpoints, dark);
  const totals = trendTotals(trend);

  if (trend.series.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left font-semibold text-[var(--text-secondary)] py-2 pr-3 whitespace-nowrap">
              Periode
            </th>
            {trend.checkpoints.map((name) => (
              <th
                key={name}
                className="text-right font-semibold text-[var(--text-secondary)] py-2 px-2 whitespace-nowrap"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ backgroundColor: colors[name] }}
                  />
                  {name}
                </span>
              </th>
            ))}
            <th className="text-right font-bold text-[var(--text-primary)] py-2 pl-3 whitespace-nowrap">
              Total Ritase
            </th>
            <th className="text-right font-semibold text-[var(--text-dim)] py-2 pl-3 whitespace-nowrap">
              Lintasan
            </th>
          </tr>
        </thead>
        <tbody>
          {trend.series.map((bucket) => (
            <tr
              key={bucket.bucket}
              className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <td className="py-1.5 pr-3 font-mono text-[var(--text-secondary)] whitespace-nowrap">
                {formatBucket(bucket.bucket, trend.granularity)}
              </td>
              {trend.checkpoints.map((name) => (
                <td
                  key={name}
                  className="text-right py-1.5 px-2 font-mono text-[var(--text-secondary)]"
                >
                  {bucket.perCheckpoint[name] ?? 0}
                </td>
              ))}
              <td className="text-right py-1.5 pl-3 font-mono font-bold text-[var(--text-primary)]">
                {bucket.ritase}
              </td>
              <td className="text-right py-1.5 pl-3 font-mono text-[var(--text-dim)]">
                {bucket.crossings}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--border-strong)]">
            <td className="py-2 pr-3 font-bold text-[var(--text-primary)]">Jumlah</td>
            {trend.checkpoints.map((name) => (
              <td
                key={name}
                className="text-right py-2 px-2 font-mono font-bold text-[var(--text-primary)]"
              >
                {totals.perCheckpoint[name] ?? 0}
              </td>
            ))}
            <td className="text-right py-2 pl-3 font-mono font-bold text-amber-500">
              {totals.ritase}
            </td>
            <td className="text-right py-2 pl-3 font-mono font-bold text-[var(--text-secondary)]">
              {totals.crossings}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
