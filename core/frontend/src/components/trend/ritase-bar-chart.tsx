"use client";

import React, { useState } from "react";
import { RitaseTrend, TrendBucket } from "@/lib/types";
import { checkpointColors, formatBucket, peakRitase, stackSegments } from "@/lib/trend";

/**
 * Ritase per period, stacked by checkpoint.
 *
 * Stacked rather than grouped because the reader's first question is "how much
 * did the site haul", and the stack's full height answers that directly while
 * still showing which checkpoint contributed. Grouped bars would answer the
 * second question first and force mental addition for the first.
 *
 * Hand-drawn SVG, no chart library: four series of plain rectangles do not
 * justify a dependency, and the Docker image stays small.
 */
/** Wide enough for a full "16/08/26" tick without truncating it. */
const BAR_MAX_WIDTH = 54;
const BAR_GAP = 10;
/** A 2px surface gap between stacked segments, per the mark spec. */
const SEGMENT_GAP = 2;
const PLOT_HEIGHT = 200;

export function RitaseBarChart({ trend, dark }: { trend: RitaseTrend; dark: boolean }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const colors = checkpointColors(trend.checkpoints, dark);
  const peak = peakRitase(trend.series);

  if (trend.series.length === 0) {
    return (
      <p className="text-xs text-[var(--text-dim)] font-mono py-12 text-center">
        Belum ada data ritase pada rentang ini.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="relative overflow-x-auto"
        onMouseLeave={() => setHovered(null)}
      >
        <div
          className="flex items-end gap-[10px] min-w-fit"
          style={{ height: PLOT_HEIGHT }}
        >
          {trend.series.map((bucket, index) => (
            <Bar
              key={bucket.bucket}
              bucket={bucket}
              roster={trend.checkpoints}
              colors={colors}
              peak={peak}
              active={hovered === index}
              dimmed={hovered !== null && hovered !== index}
              onHover={() => setHovered(index)}
            />
          ))}
        </div>

        <div className="flex gap-[10px] min-w-fit mt-2">
          {trend.series.map((bucket, index) => (
            <div
              key={bucket.bucket}
              style={{ width: BAR_MAX_WIDTH }}
              className={`text-[10px] font-mono text-center truncate transition-colors ${
                hovered === index ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"
              }`}
              title={bucket.bucket}
            >
              {formatBucket(bucket.bucket, trend.granularity)}
            </div>
          ))}
        </div>
      </div>

      {hovered !== null && (
        <BucketReadout
          bucket={trend.series[hovered]}
          roster={trend.checkpoints}
          colors={colors}
          granularity={trend.granularity}
        />
      )}
    </div>
  );
}

function Bar({
  bucket,
  roster,
  colors,
  peak,
  active,
  dimmed,
  onHover,
}: {
  bucket: TrendBucket;
  roster: string[];
  colors: Record<string, string>;
  peak: number;
  active: boolean;
  dimmed: boolean;
  onHover: () => void;
}) {
  const segments = stackSegments(bucket, roster);
  // Height is a share of the tallest bar, so the y-axis is comparable across
  // the whole series rather than each bar filling its own column.
  const barHeight = (bucket.ritase / peak) * (PLOT_HEIGHT - 22);

  return (
    <div
      className="flex flex-col justify-end items-center h-full cursor-default"
      style={{ width: BAR_MAX_WIDTH }}
      onMouseEnter={onHover}
      onFocus={onHover}
      tabIndex={0}
      role="img"
      aria-label={`${bucket.bucket}: ${bucket.ritase} ritase`}
    >
      {/* The value above the bar — the exact number the site asked to see. */}
      <span
        className={`text-[10px] font-mono font-bold mb-1 transition-opacity ${
          active ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
        } ${bucket.ritase === 0 ? "opacity-40" : ""}`}
      >
        {bucket.ritase}
      </span>

      <div
        className="w-full flex flex-col-reverse rounded-t transition-opacity"
        style={{
          height: Math.max(bucket.ritase > 0 ? 3 : 2, barHeight),
          opacity: dimmed ? 0.45 : 1,
        }}
      >
        {bucket.ritase === 0 ? (
          // A real zero, drawn as a baseline tick. Nothing would read as
          // missing data; this reads as "we were here, output was nil".
          <div className="w-full h-[2px] bg-[var(--border-strong)] rounded-full" />
        ) : (
          segments.map((segment, i) => (
            <div
              key={segment.checkpoint}
              style={{
                height: `calc(${segment.fraction * 100}% - ${i === 0 ? 0 : SEGMENT_GAP}px)`,
                backgroundColor: colors[segment.checkpoint],
                marginTop: i === 0 ? 0 : SEGMENT_GAP,
              }}
              className={i === segments.length - 1 ? "rounded-t" : ""}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * The hovered period spelled out.
 *
 * Rendered below the plot rather than as a floating tooltip: the bars are
 * narrow and a tooltip pinned to the cursor would cover its neighbours, which
 * is the comparison the reader is in the middle of making.
 */
function BucketReadout({
  bucket,
  roster,
  colors,
  granularity,
}: {
  bucket: TrendBucket;
  roster: string[];
  colors: Record<string, string>;
  granularity: RitaseTrend["granularity"];
}) {
  const present = roster.filter((name) => (bucket.perCheckpoint[name] ?? 0) > 0);
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xs font-bold text-[var(--text-primary)] font-mono">
          {formatBucket(bucket.bucket, granularity)}
        </span>
        <span className="text-xs text-[var(--text-secondary)]">
          <span className="font-bold text-amber-500">{bucket.ritase}</span> ritase
        </span>
        <span className="text-[11px] text-[var(--text-dim)]">
          {bucket.crossings} lintasan tercatat
        </span>
      </div>
      {present.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
          {present.map((name) => (
            <span key={name} className="inline-flex items-center gap-1.5 text-[11px]">
              <span
                aria-hidden
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: colors[name] }}
              />
              <span className="text-[var(--text-secondary)]">{name}</span>
              <span className="font-mono font-bold text-[var(--text-primary)]">
                {bucket.perCheckpoint[name]}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Identity is never colour alone: every checkpoint is named beside its swatch. */
export function CheckpointLegend({ trend, dark }: { trend: RitaseTrend; dark: boolean }) {
  const colors = checkpointColors(trend.checkpoints, dark);
  if (trend.checkpoints.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {trend.checkpoints.map((name) => (
        <span key={name} className="inline-flex items-center gap-1.5 text-[11px]">
          <span
            aria-hidden
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ backgroundColor: colors[name] }}
          />
          <span className="text-[var(--text-secondary)] font-medium">{name}</span>
        </span>
      ))}
    </div>
  );
}
