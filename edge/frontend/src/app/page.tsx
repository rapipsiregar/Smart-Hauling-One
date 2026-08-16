"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  api, ClipSource, Crossing, GateStatus, LiveCrop, LiveState, RUN_ACTIVE, TestRun,
} from "@/lib/api";
import { CrossingRail } from "@/components/crossing-rail";
import { LiveView } from "@/components/live-view";
import { SettingsDrawer } from "@/components/settings-drawer";
import { StatusBar } from "@/components/status-bar";
import { TopBar } from "@/components/top-bar";
import { TrackPanel } from "@/components/track-panel";

/**
 * The gate console, on one screen.
 *
 * Laid out after docs/sample-references/sample-ui.mp4: the detection in the
 * middle with its truck-id crops beneath it, this gate's crossings down the left,
 * the reading blown up on the right, health along the bottom, controls on top.
 * The structure is the reference's; the palette, glass and typography are the
 * same tokens the centre console uses, because both are read by the same people
 * on the same shift.
 *
 * Everything is served by this device and keeps working with the centre
 * unreachable -- which is the reason a gate runs its own stack at all. The
 * annotated feed never leaves the LAN.
 *
 * Two clocks, on purpose: the live view polls fast because it is showing
 * something happening, and status and crossings poll slowly because they are
 * not.
 */
export default function GatePage() {
  const [status, setStatus] = useState<GateStatus | null>(null);
  const [crossings, setCrossings] = useState<Crossing[]>([]);
  const [live, setLive] = useState<LiveState | null>(null);
  const [clips, setClips] = useState<ClipSource[]>([]);
  const [run, setRun] = useState<TestRun | null>(null);
  const [selectedClip, setSelectedClip] = useState("ALL");
  const [filter, setFilter] = useState("");
  // Off by default: the resting screen is the lane, a green box, and the number
  // the system read. The working figures are one click away for whoever needs
  // them, and out of the way of everybody who does not.
  const [detailOn, setDetailOn] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedCrop, setSelectedCrop] =
    useState<{ track: number; index: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<EventSource | null>(null);

  const running = run != null && RUN_ACTIVE.includes(run.status);

  const refreshSlow = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([api.status(), api.crossings(50)]);
      setStatus(s);
      setCrossings(c);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    refreshSlow();
    api.clips().then(setClips).catch(() => setClips([]));
    api.activeRun().then(setRun).catch(() => setRun(null));
    const t = setInterval(refreshSlow, 5000);
    return () => clearInterval(t);
  }, [refreshSlow]);

  // The live panel's own loop. Fast while something is happening, slow when
  // nothing is: a gate screen left open all shift should not poll four times a
  // second at an empty lane.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const next = await api.liveState();
        if (!cancelled) setLive(next);
      } catch {
        /* the device is polled again shortly; a blip must not clear the panel */
      }
      if (!cancelled) timer = setTimeout(tick, running ? 400 : 1500);
    };
    tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [running]);

  // The run lives on the device, so its stream is the source of truth and a
  // reload rejoins whatever is already in flight.
  useEffect(() => {
    if (!run || !RUN_ACTIVE.includes(run.status)) {
      streamRef.current?.close();
      streamRef.current = null;
      return;
    }
    streamRef.current?.close();
    const es = new EventSource(`/api/test-runs/${run.id}/stream`);
    es.onmessage = (event) => setRun(JSON.parse(event.data) as TestRun);
    es.onerror = () => {
      es.close();
      streamRef.current = null;
      api.activeRun().then(setRun).catch(() => undefined);
    };
    streamRef.current = es;
    return () => { es.close(); streamRef.current = null; };
  }, [run?.id, run?.status]);

  // A finished run has just written crossings; pick them up without waiting out
  // the slow poll, or the list stays a step behind what the panel just showed.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) refreshSlow();
    wasRunning.current = running;
  }, [running, refreshSlow]);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setRun(await api.startRun(selectedClip === "ALL" ? undefined : [selectedClip]));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [selectedClip]);

  const stop = useCallback(async () => {
    if (!run) return;
    setBusy(true);
    try {
      await api.cancelRun(run.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [run]);

  const resetCrossings = useCallback(async () => {
    // Local to this device by design. One button cannot reach four Jetsons over
    // a link that may be down, and pretending otherwise would leave an operator
    // believing a gate was cleared when it was not.
    if (!confirm("Hapus riwayat lintasan di perangkat ini?")) return;
    try {
      await api.resetCrossings();
      await api.resetLive();
      setSelectedCrop(null);
      refreshSlow();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [refreshSlow]);

  if (error && !status) {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 text-[var(--danger)] font-semibold">
            <AlertTriangle size={18} /> Tidak dapat menghubungi layanan di perangkat ini
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-2">{error}</p>
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            Layanan lokal di perangkat ini kemungkinan belum jalan.
          </p>
        </div>
      </main>
    );
  }

  return (
    /* One screen, no page scroll. The panels scroll inside themselves instead:
       a gate console is glanced at, and anything that needs the page moved to
       be seen might as well not be on it. Below xl the columns stack and the
       page does scroll -- that is the phone-at-the-gate case. */
    <main className="p-3 flex flex-col gap-3 min-h-screen xl:h-screen xl:overflow-hidden">
      <TopBar
        cameraCode={status?.camera_code ?? "…"}
        direction={status?.direction ?? null}
        totalCrossings={status?.crossings.total ?? 0}
        clips={clips}
        selectedClip={selectedClip}
        onSelectClip={setSelectedClip}
        run={run}
        running={running}
        busy={busy}
        onStart={start}
        onStop={stop}
        detailOn={detailOn}
        onToggleDetail={() => setDetailOn((v) => !v)}
        filter={filter}
        onFilter={setFilter}
        onOpenSettings={() => setSettingsOpen(true)}
        onRefresh={refreshSlow}
      />

      {error && (
        <p className="glass-card px-3 py-2 text-[11px] font-mono text-[var(--danger)]">
          {error}
        </p>
      )}

      {/* Three columns on a desk monitor, stacked on the panel at the gate.
          The live view leads on both, because it is the one thing here that is
          worth watching rather than reading. */}
      <div className="grid gap-3 flex-1 min-h-0 grid-cols-1 xl:grid-cols-[17rem_minmax(0,1fr)_20rem]">
        <div className="order-2 xl:order-1 min-h-0 h-[26rem] xl:h-auto">
          <CrossingRail
            crossings={crossings}
            filter={filter}
            onReset={resetCrossings}
            detailOn={detailOn}
          />
        </div>

        <div className="order-1 xl:order-2 min-h-0">
          <LiveView
            state={live}
            detailOn={detailOn}
            selectedCrop={selectedCrop}
            onSelectCrop={(track, crop: LiveCrop) =>
              setSelectedCrop({ track, index: crop.crop_index })
            }
          />
        </div>

        <div className="order-3 min-h-0 h-[30rem] xl:h-auto xl:overflow-hidden">
          <TrackPanel
            state={live}
            selectedCrop={selectedCrop}
            onClearSelection={() => setSelectedCrop(null)}
            detailOn={detailOn}
          />
        </div>
      </div>

      <StatusBar status={status} />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        ocrBackend={status?.ocr_backend ?? "—"}
      />
    </main>
  );
}
