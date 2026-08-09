"use client";

import React, { useState } from "react";
import { GateFeed } from "@/lib/gate-feeds";
import { CctvViewport } from "./cctv-viewport";

/**
 * The two-screen monitoring wall.
 *
 * Two panes, each showing whichever gate the operator points it at — so a gate
 * pair (masuk / keluar) can be watched side by side. Until a pane is pointed
 * somewhere it defaults to the first and second registered gate. Choosing a gate
 * for a pane pins it there.
 */
export function CctvWall({ feeds }: { feeds: GateFeed[] }) {
  const [picked, setPicked] = useState<[string | null, string | null]>([null, null]);

  const codes = feeds.map((f) => f.cameraCode);

  /** An operator's choice wins; otherwise fall back down the list of defaults. */
  const resolve = (pane: string | null, ...defaults: (string | null | undefined)[]) =>
    [pane, ...defaults].find((code) => code && codes.includes(code)) ?? "";

  const paneA = resolve(picked[0], codes[0]);
  const paneB = resolve(picked[1], codes[1], codes[0]);

  const setPane = (index: 0 | 1) => (cameraCode: string) =>
    setPicked(([a, b]) => (index === 0 ? [cameraCode, b] : [a, cameraCode]));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <CctvViewport
        label="Layar 1"
        feeds={feeds}
        cameraCode={paneA}
        onCameraChange={setPane(0)}
      />
      <CctvViewport
        label="Layar 2"
        feeds={feeds}
        cameraCode={paneB}
        onCameraChange={setPane(1)}
      />
    </div>
  );
}
