"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { Camera } from "@/lib/types";
import { buildGateFeeds } from "@/lib/gate-feeds";
import { CctvWall } from "./cctv-wall";
import { Loader } from "lucide-react";

/**
 * The gate-watching wall: two screens, nothing else.
 *
 * Deliberately bare. This page answers exactly one question — what does the gate
 * look like right now — and each pane carries its own gate selector, so a
 * control bar above them only duplicated that choice. Crossing data, readings
 * and ritase all live in Riwayat Pembacaan; putting a summary here too would
 * mean two places that count the same thing and can disagree.
 *
 * It also used to host the OCR Inspection HUD and start detection runs. Both
 * moved to the gate devices, where the pipeline actually runs.
 */
import { DEMO_CAMERAS } from "@/lib/checkpoints";

export function CctvMonitoringSection() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api
        .getCameras()
        .then((cams) => {
          setCameras(cams);
          setError(null);
        })
        .catch(() => {
          setCameras(DEMO_CAMERAS);
          setError(null);
        }),
    []
  );

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const feeds = useMemo(() => buildGateFeeds(cameras), [cameras]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader className="w-7 h-7 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="font-mono text-[11px] text-rose-400">{error}</p>}
      <CctvWall feeds={feeds} />
    </div>
  );
}
