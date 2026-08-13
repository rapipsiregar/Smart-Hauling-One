"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CHECKPOINTS, Checkpoint } from "@/lib/checkpoints";
import { PitOccupancy } from "@/lib/types";

interface MineLeafletMapProps {
  pit: PitOccupancy | null;
  selectedCp: Checkpoint | null;
  onSelectCheckpoint: (cp: Checkpoint) => void;
}

// Mengatasi kendala icon marker bawaan Leaflet yang sering patah di Next.js
const fixLeafletIcon = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
};

export function MineLeafletMap({ pit, selectedCp, onSelectCheckpoint }: MineLeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Helper pencocokan lintasan terakhir truk ke CP id
  const matchCheckpoint = (gate: string | null): string | null => {
    if (!gate) return null;
    const upper = gate.toUpperCase();
    if (upper.includes("CP 01") || upper.includes("CP-01") || upper.includes("KGB")) return "CP-01";
    if (upper.includes("CP 02") || upper.includes("CP-02") || upper.includes("KGU")) return "CP-02";
    if (upper.includes("CP 03") || upper.includes("CP-03") || upper.includes("PPA")) return "CP-03";
    if (upper.includes("CP 04") || upper.includes("CP-04") || upper.includes("EXC")) return "CP-04";
    return null;
  };

  const getTrucksForCheckpoint = (cpId: string) => {
    const inside = (pit?.inside ?? []).filter((t) => matchCheckpoint(t.lastGate) === cpId);
    const outside = (pit?.outside ?? []).filter((t) => matchCheckpoint(t.lastGate) === cpId);
    return { inside, outside };
  };

  // Kustomisasi Marker Neon Leaflet agar estetik dan menyatu dengan tema dashboard
  const createCustomIcon = (name: string, status: string, insideCount: number, outsideCount: number, isSelected: boolean) => {
    const color = status === "active" ? "#10b981" : "#f59e0b";
    const border = isSelected ? "4px solid #ffffff" : "2px solid #ffffff";
    const size = isSelected ? "18px" : "14px";
    const shadow = isSelected ? "0 0 12px 4px rgba(255,255,255,0.4)" : "0 0 6px 2px rgba(16,185,129,0.3)";
    const totalTrucks = insideCount + outsideCount;

    return L.divIcon({
      className: "custom-leaflet-marker",
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%;">
          <!-- Pin Neon Utama -->
          <div style="
            width: ${size};
            height: ${size};
            border-radius: 50%;
            background-color: ${color};
            border: ${border};
            box-shadow: ${shadow};
            transition: all 0.2s ease-in-out;
          "></div>
          
          <!-- Label Nama Checkpoint -->
          <div style="
            margin-top: 4px;
            background-color: rgba(15, 23, 42, 0.9);
            color: #f8fafc;
            font-family: monospace;
            font-size: 9px;
            font-weight: bold;
            padding: 2px 5px;
            border-radius: 4px;
            border: 1px solid rgba(255,255,255,0.15);
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.5);
          ">
            ${name}
          </div>
          
          <!-- Indikator Jumlah Truk -->
          ${totalTrucks > 0 ? `
            <div style="
              position: absolute;
              top: -12px;
              background-color: #f59e0b;
              color: #0f172a;
              font-family: monospace;
              font-size: 8px;
              font-weight: 900;
              padding: 1px 4px;
              border-radius: 8px;
              white-space: nowrap;
              border: 1px solid #ffffff;
              box-shadow: 0 0 5px rgba(245, 158, 11, 0.5);
            ">
              🚚 ${totalTrucks}
            </div>
          ` : ""}
        </div>
      `,
      iconSize: [50, 50],
      iconAnchor: [25, 25],
    });
  };

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    fixLeafletIcon();

    // Rata-rata koordinat tengah pos cek untuk pemusatan peta
    const centerLat = -3.5467;
    const centerLon = 115.5971;

    // Inisialisasi Peta
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([centerLat, centerLon], 12);

    mapInstanceRef.current = map;

    // Tambahkan layer Satelit ESRI World Imagery (Premium)
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 18,
    }).addTo(map);

    // Plot marker pos cek di atas peta satelit
    CHECKPOINTS.forEach((cp) => {
      if (!cp.gps) return;

      const isSelected = selectedCp?.id === cp.id;
      const { inside, outside } = getTrucksForCheckpoint(cp.id);

      const marker = L.marker([cp.gps.lat, cp.gps.lon], {
        icon: createCustomIcon(cp.name, cp.status, inside.length, outside.length, isSelected),
      }).addTo(map);

      // Tambahkan petunjuk visual hover (tooltip)
      marker.bindTooltip(`
        <div style="font-family: monospace; font-size: 10px; padding: 2px;">
          <strong>Pos Cek: ${cp.name}</strong><br/>
          <span style="font-size: 8.5px; color: #64748b;">Klik pos untuk detail operasional</span>
        </div>
      `, {
        direction: "top",
        offset: [0, -12],
        opacity: 0.95
      });

      marker.on("click", () => {
        onSelectCheckpoint(cp);
      });
    });

    // Pembersihan ketika komponen dilepas (unmounted)
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [pit, selectedCp]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full rounded-2xl overflow-hidden border border-[var(--border)]/40 shadow-inner"
      style={{ minHeight: "400px" }}
    />
  );
}
