"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { CctvDetection, Camera } from "@/lib/types";
import { GlassCard } from "@/components/ui/glass-card";
import { GuideSwap } from "@/components/ui/guide-note";
import { DetectionList } from "@/components/monitoring/detection-list";
import { DetectionInspector } from "@/components/monitoring/detection-inspector";
import { PitAndRitase } from "@/components/monitoring/pit-and-ritase";
import { AuditOverrideLogWidget } from "@/components/analytics/audit-override-log";
import { Cctv, Loader } from "lucide-react";

/**
 * Riwayat Pembacaan — three cards, in the order an operator asks the questions:
 *
 *   1. Posisi Armada & Ritase — where the fleet is and how many round trips
 *   2. Daftar Pembacaan Nomor — every reading behind those numbers
 *   3. Rincian Pembacaan      — one reading, with the pictures it came from
 *
 * The page title bar and the filter toolbar are gone. The title was already in
 * the app header, and the toolbar was a card in its own right for four controls
 * that mostly went unused. The one filter that genuinely changes the answer —
 * which gate — now sits in the list's own header, because that is the card it
 * filters.
 */
export default function CctvHistoryPage() {
  const [detections, setDetections] = useState<CctvDetection[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [hasUnassigned, setHasUnassigned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [camera, setCamera] = useState<string>("all");
  const [selected, setSelected] = useState<CctvDetection | null>(null);

  useEffect(() => {
    Promise.all([api.getCameras(), api.getCctvDetections()])
      .then(([cams, d]) => {
        setCameras(cams);
        setDetections(d);
        setHasUnassigned(d.some((x) => !x.cameraCode));
        if (d.length) setSelected(d[0]);
      })
      .catch((e) => console.warn("Riwayat pembacaan tidak tersedia (backend offline?):", e))
      .finally(() => setLoading(false));
  }, []);

  // Camera scoping is done server-side; the "Unassigned" bucket is filtered here
  // since a null camera cannot be expressed as a camera_code.
  const handleCameraChange = async (value: string) => {
    setCamera(value);
    setRefetching(true);
    try {
      const d =
        value === "__unassigned__"
          ? (await api.getCctvDetections()).filter((x) => !x.cameraCode)
          : await api.getCctvDetections(value === "all" ? undefined : value);
      setDetections(d);
      setSelected(d[0] ?? null);
    } catch (e) {
      console.warn("Riwayat pembacaan tidak tersedia (backend offline?):", e);
    } finally {
      setRefetching(false);
    }
  };

  const cameraOptions = useMemo(() => {
    const opts = cameras.map((c) => ({ code: c.camera_code, name: c.name || c.camera_code }));
    if (hasUnassigned) opts.push({ code: "__unassigned__", name: "Belum terhubung kamera" });
    return opts;
  }, [cameras, hasUnassigned]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AuditOverrideLogWidget />
      {/* 1 — where the fleet is, and the ritase behind it */}
      <PitAndRitase />

      {/* 2 + 3 — the readings, and the one being inspected */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <GlassCard className="lg:col-span-7 p-5">
          <GuideSwap
            title="Daftar Pembacaan Nomor Lambung"
            note="Setiap baris adalah satu truk yang melintas di sebuah gate, dengan nomor lambung hasil pembacaan AI dan tingkat keyakinannya. Angka keyakinan berasal dari voting: AI membaca nomor yang sama berkali-kali dari beberapa gambar, lalu yang paling banyak muncul menang. Menu gate di kanan atas mempersempit daftar ke satu gate saja. Klik satu baris untuk membuka rinciannya di panel kanan — di situ ada foto plat yang dipakai dan gambar penuhnya."
          >
            <div className="flex items-center justify-end gap-2 mb-3">
              <Cctv className="w-4 h-4 text-[var(--text-dim)]" />
              <select
                value={camera}
                onChange={(e) => handleCameraChange(e.target.value)}
                disabled={refetching}
                className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-amber-500 cursor-pointer max-w-[190px] disabled:opacity-60"
              >
                <option value="all">Semua gate</option>
                {cameraOptions.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
              {refetching && <Loader className="w-3.5 h-3.5 text-amber-500 animate-spin" />}
            </div>
            <DetectionList
              detections={detections}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
          </GuideSwap>
        </GlassCard>
        <div className="lg:col-span-5">
          <DetectionInspector detection={selected} />
        </div>
      </div>
    </div>
  );
}
