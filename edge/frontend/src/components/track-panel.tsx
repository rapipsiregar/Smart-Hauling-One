"use client";

import { Crosshair, ScanLine } from "lucide-react";
import { LiveCrop, LiveState, LiveTrack, liveCropUrl } from "@/lib/api";
import { VoteBar } from "@/components/vote-bar";

/**
 * The reading, up close.
 *
 * The reviewer asked for "live view dari bbox yang terdeteksi di sisi kanan,
 * zoom, agar terlihat" -- the frame in the middle is too wide to judge a plate
 * by, so the crop the recogniser actually saw is shown here at a size a person
 * can read. Below it, every truck still being scanned, with its vote as it
 * stands.
 */
export function TrackPanel({
  state, selectedCrop, onClearSelection, detailOn,
}: {
  state: LiveState | null;
  selectedCrop: { track: number; index: number } | null;
  onClearSelection: () => void;
  detailOn: boolean;
}) {
  const tracks = state?.tracks ?? [];
  // Every crop URL is scoped to it -- see LiveState.session for why.
  const session = state?.session ?? "";
  const active = tracks.filter((t) => t.status === "scanning");
  const focus =
    (selectedCrop && tracks.find((t) => t.track_id === selectedCrop.track)) ||
    tracks.find((t) => t.track_id === state?.active_track) ||
    tracks[0];

  const crop: LiveCrop | undefined = focus
    ? selectedCrop && selectedCrop.track === focus.track_id
      ? focus.crops.find((c) => c.crop_index === selectedCrop.index)
      : [...focus.crops].reverse().find((c) => c.text) ?? focus.crops[focus.crops.length - 1]
    : undefined;

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <section className="glass-card p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">
            <Crosshair size={11} className="inline mr-1 -mt-0.5" />
            Nomor Terbaru
          </p>
          {selectedCrop && (
            <button
              onClick={onClearSelection}
              className="text-[10px] font-mono text-[var(--text-dim)] hover:text-[var(--accent)]"
            >
              ikuti otomatis
            </button>
          )}
        </div>

        {focus && crop ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={liveCropUrl(session, focus.track_id, crop.crop_index)}
              alt="Potongan nomor lambung, diperbesar"
              className="w-full rounded-lg border border-[var(--border)] bg-black object-contain max-h-40"
            />
            <div className="mt-2 text-center">
              <p className="font-mono font-bold text-3xl text-[var(--accent)] leading-tight">
                {focus.hull_id && focus.hull_id !== "UNKNOWN"
                  ? focus.hull_id
                  : focus.voted ?? crop.text ?? "—"}
              </p>
              {/* Track id, sample index, and how sure each stage was. Working
                  figures: they settle a support question and start one with
                  everybody else, so they follow the Detail switch. */}
              {detailOn && (
                <>
                  <p className="font-mono text-[10px] text-[var(--text-secondary)] mt-1">
                    T#{focus.track_id} · C#{crop.crop_index} · baca{" "}
                    {(crop.ocr_conf * 100).toFixed(0)}%
                    {focus.confidence != null &&
                      ` · suara ${(focus.confidence * 100).toFixed(0)}%`}
                  </p>
                  {/* A resolved hull id and a raw reading are not the same claim.
                      Saying which one is on screen is the difference between
                      "this truck is registered" and "this is what the camera
                      saw". */}
                  {focus.outcome && (
                    <p className="font-mono text-[10px] text-[var(--text-dim)] mt-0.5">
                      {focus.outcome === "exact" || focus.outcome === "fuzzy"
                        ? "cocok dengan master"
                        : "belum cocok dengan master"}
                    </p>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="py-8 text-center">
            <ScanLine size={22} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs text-[var(--text-secondary)]">
              Belum ada nomor terbaca di gate ini.
            </p>
          </div>
        )}
      </section>

      <section className="glass-card p-3 flex-1 min-h-0 overflow-y-auto">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-secondary)] mb-2">
          Sedang Dibaca
        </p>
        {active.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">
            Tidak ada truk yang sedang dipindai.
          </p>
        ) : (
          <div className="space-y-2">
            {active.map((track) => (
              <ScanningCard key={track.track_id} track={track} session={session}
                            detailOn={detailOn} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ScanningCard({
  track, session, detailOn,
}: { track: LiveTrack; session: string; detailOn: boolean }) {
  const maxShare = Math.max(...track.votes.map((v) => v.share), 0.0001);
  const thumb = [...track.crops].reverse().find((c) => c.text) ?? track.crops[track.crops.length - 1];

  return (
    <div className="rounded-lg border border-[var(--accent)]/40 p-2 space-y-2">
      <div className="flex items-center gap-2">
        {thumb ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={liveCropUrl(session, track.track_id, thumb.crop_index)}
            alt=""
            className="h-9 w-16 rounded object-cover bg-black shrink-0"
          />
        ) : (
          <div className="h-9 w-16 rounded bg-black/50 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-mono text-sm font-bold text-[var(--accent)] truncate">
            {track.voted ?? "memindai…"}
          </div>
          {detailOn && (
            <div className="font-mono text-[10px] text-[var(--text-secondary)]">
              T#{track.track_id} · {track.crops.length} sampel
              {track.pending_ocr > 0 && ` · ${track.pending_ocr} antre`}
            </div>
          )}
        </div>
      </div>
      {detailOn && track.votes.length > 0 && (
        <div className="space-y-1">
          {track.votes.slice(0, 3).map((v) => (
            <VoteBar
              key={v.id}
              id={v.id}
              share={v.share}
              reads={v.reads}
              winner={v.winner}
              maxShare={maxShare}
            />
          ))}
        </div>
      )}
    </div>
  );
}
