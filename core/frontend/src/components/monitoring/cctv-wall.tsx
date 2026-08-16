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
  const [pickedA, setPickedA] = useState<string | null>(null);
  const [pickedB, setPickedB] = useState<string | null>(null);

  const codes = feeds.map((f) => f.cameraCode);

  const paneA = pickedA && codes.includes(pickedA) ? pickedA : (codes[0] ?? "");
  const paneB = pickedB && codes.includes(pickedB) ? pickedB : (codes[1] ?? codes[0] ?? "");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <CctvViewport
        label="Layar Kiri"
        feeds={feeds}
        cameraCode={paneA}
        onCameraChange={(code) => setPickedA(code)}
      />
      <CctvViewport
        label="Layar Kanan"
        feeds={feeds}
        cameraCode={paneB}
        onCameraChange={(code) => setPickedB(code)}
      />
    </div>
  );
}
