"use client";

import { useEffect, useRef, useState } from "react";
import { Radio, Video, VideoOff } from "lucide-react";
import { LiveCrop, LiveState, liveCropUrl, liveStreamUrl } from "@/lib/api";

/**
 * The lane, with what the detector is finding drawn on it, plus the truck-id
 * crops it has taken from the truck currently crossing.
 *
 * The two halves update independently, and that is the point. Boxes come from
 * the detector and land in tens of milliseconds; the crops below fill in as the
 * recogniser works through them, hundreds of milliseconds later. Before the
 * pipeline was split these shared a thread, so the picture froze for the length
 * of every reading (docs/sample-references/enhancement.md).
 *
 * `detailOn` is the operator/diagnostic switch. Off, this is the lane, a green
 * box where the system is looking, and nothing else. On, the box gains its
 * track id and score and the crop strip appears beneath.
 *
 * The feed is an MJPEG <img>: no player, no codec negotiation, no relay. It is
 * served by the FastAPI on this same device over the LAN, so nothing about this
 * view crosses the site's satellite link.
 */
export function LiveView({
  state, detailOn, onSelectCrop, selectedCrop,
}: {
  state: LiveState | null;
  detailOn: boolean;
  onSelectCrop: (track: number, crop: LiveCrop) => void;
  selectedCrop: { track: number; index: number } | null;
}) {
  const [nonce, setNonce] = useState(0);
  const [broken, setBroken] = useState(false);
  const active = state?.tracks.find((t) => t.track_id === state.active_track);
  // Samples from whichever truck is being read now; failing that, the last one
  // that was. An empty strip between trucks tells nobody anything.
  const strip = active ?? state?.tracks[0];
  const crops = strip ? [...strip.crops].slice(-10) : [];

  /*
   * Reconnecting the MJPEG feed is expensive in a way that is easy to miss: an
   * open multipart/x-mixed-replace response holds one of the browser's six
   * connections to this origin for as long as it lives, and swapping the <img>
   * does not reliably close the old one straight away. Reconnect on a timer and
   * the pool empties -- at which point the polling fetches stall, and so does
   * any other tab pointed at this device. The page looks frozen on stale data.
   *
   * So the only trigger is evidence that the socket is genuinely dead while the
   * device is genuinely producing: our sequence has not moved, but the device
   * says its newest frame is seconds old. A quiet lane fails that test, which is
   * the case that used to reconnect forever.
   */
  const lastSeq = useRef(0);
  const stale = useRef(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!state) return;
    if (state.frame_seq !== lastSeq.current) {
      lastSeq.current = state.frame_seq;
      stale.current = 0;
      return;
    }
    // Nothing new. Only suspicious if the device is producing frames anyway.
    const producing = state.frame_age_sec != null && state.frame_age_sec < 3;
    if (!producing) {
      stale.current = 0;
      return;
    }
    stale.current += 1;
    if (stale.current > 12) {
      stale.current = 0;
      // Drop the old request before asking for a new one, so the connection is
      // released rather than leaked alongside its replacement.
      if (imgRef.current) imgRef.current.src = "";
      setNonce((n) => n + 1);
    }
  }, [state]);

  // Same reason, on the way out: a page that navigates away while streaming
  // leaves the connection held until the browser gets round to it.
  useEffect(() => () => {
    if (imgRef.current) imgRef.current.src = "";
  }, []);

  const live = (state?.frame_age_sec ?? 99) < 3;

  return (
    <div className="flex flex-col gap-3 min-h-0 h-full">
      {/* Takes whatever height is left rather than a fixed ratio: the clips are
          a mix of portrait and landscape, and a locked 16:9 box pushed the OCR
          samples and the health strip off the bottom of a laptop screen. */}
      <div className="glass-card relative overflow-hidden bg-black flex-1 min-h-0">
        {broken ? (
          <div className="absolute inset-0 grid place-items-center text-center px-4">
            <div className="text-[var(--text-secondary)] text-xs">
              <VideoOff size={22} className="mx-auto mb-2 opacity-60" />
              Tidak ada gambar dari kamera, dan belum ada frame tersimpan.
            </div>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          /* The overlay is burned into the JPEG by the device, so turning boxes
             off has to be asked of the device rather than hidden here -- keyed
             on bboxOn so the stream is reopened when it changes. */
          <img
            key={`${nonce}-${detailOn ? "detail" : "plain"}`}
            ref={imgRef}
            src={liveStreamUrl(nonce, detailOn)}
            alt="Tampilan gerbang dengan kotak deteksi"
            className="w-full h-full object-contain"
            onError={() => setBroken(true)}
          />
        )}

        <span className="absolute top-2 left-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono text-[var(--accent)]">
          <Video size={11} className={live ? "animate-pulse" : "opacity-50"} />
          {state?.source ? state.source : "menunggu sumber"}
        </span>

        {/* The counter that proves the split works: detections climb while the
            readings lag behind, rather than the two advancing in lockstep.
            Diagnostic, so it follows the Detail switch. */}
        {state && detailOn && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono text-[var(--text-secondary)]">
            {state.boxes.length} kotak · {state.counters.detections} deteksi ·{" "}
            {state.counters.ocr_attempts} baca
          </span>
        )}

        {!live && !broken && (
          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono text-[var(--text-dim)]">
            gambar diam — belum ada proses berjalan
          </span>
        )}
      </div>

      {/* The strip is working evidence: which crops the reading was made from.
          Useful when somebody is diagnosing a misread, noise on the screen the
          rest of the time. */}
      {detailOn && (
        <SampleStrip
          crops={crops}
          trackId={strip?.track_id ?? null}
          pending={strip?.pending_ocr ?? 0}
          onSelect={onSelectCrop}
          selected={selectedCrop}
          session={state?.session ?? ""}
        />
      )}
    </div>
  );
}

/**
 * Every crop the recogniser was given, with what it read underneath.
 *
 * Attempts that read nothing are shown too. A strip of only successes makes a
 * truck whose plate was caked in dust look like a device that stopped working,
 * when in fact it tried nine times and said so honestly each time.
 */
function SampleStrip({
  crops, trackId, pending, onSelect, selected, session,
}: {
  crops: LiveCrop[];
  trackId: number | null;
  pending: number;
  onSelect: (track: number, crop: LiveCrop) => void;
  selected: { track: number; index: number } | null;
  session: string;
}) {
  return (
    <div className="glass-card p-3 shrink-0">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">
          Truck ID {trackId != null && `· T#${trackId}`}
        </p>
        {pending > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--accent)]">
            <Radio size={10} className="animate-pulse" /> {pending} menunggu dibaca
          </span>
        )}
      </div>

      {crops.length === 0 ? (
        <p className="text-xs text-[var(--text-secondary)]">
          Belum ada potongan gambar. Kotak deteksi muncul lebih dulu — pembacaan
          menyusul beberapa saat kemudian.
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {crops.map((crop) => {
            const isSelected =
              selected?.track === trackId && selected?.index === crop.crop_index;
            return (
              <button
                key={crop.crop_index}
                onClick={() => trackId != null && onSelect(trackId, crop)}
                className={`shrink-0 rounded-lg overflow-hidden border transition-colors ${
                  isSelected
                    ? "border-[var(--accent)]"
                    : "border-[var(--border)] hover:border-[var(--border-strong)]"
                }`}
                title={`C#${crop.crop_index} · frame ${crop.frame} · deteksi ${(
                  crop.det_conf * 100
                ).toFixed(0)}%`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={liveCropUrl(session, trackId!, crop.crop_index)}
                  alt={`Sampel C#${crop.crop_index}`}
                  className="h-16 w-32 object-cover bg-black"
                />
                <div className="px-1.5 py-1 bg-black/50 text-center">
                  <div
                    className={`font-mono text-xs font-bold truncate ${
                      crop.text ? "text-[var(--accent)]" : "text-[var(--text-dim)]"
                    }`}
                  >
                    {crop.text ?? "tak terbaca"}
                  </div>
                  <div className="font-mono text-[9px] text-[var(--text-dim)]">
                    C#{crop.crop_index} · {(crop.ocr_conf * 100).toFixed(0)}%
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
