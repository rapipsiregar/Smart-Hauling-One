"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Camera } from "@/lib/types";
import { GlassCard } from "@/components/ui/glass-card";
import { GuideSwap } from "@/components/ui/guide-note";
import { CameraForm } from "./camera-form";
import {
  Cctv, Plus, Pencil, Trash2, RefreshCw, Wifi, WifiOff, Wrench, FolderInput,
} from "lucide-react";

const STATUS_META: Record<string, { icon: React.ReactNode; cls: string }> = {
  online: { icon: <Wifi className="w-3 h-3" />, cls: "text-emerald-600 dark:text-emerald-400" },
  offline: { icon: <WifiOff className="w-3 h-3" />, cls: "text-[var(--text-dim)]" },
  maintenance: { icon: <Wrench className="w-3 h-3" />, cls: "text-amber-600 dark:text-amber-400" },
};

export function CameraRegistry() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"idle" | "add" | "edit">("idle");
  const [editing, setEditing] = useState<Camera | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => api.getCameras().then(setCameras).catch(() => setCameras([]));

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const handleCreate = async (data: Partial<Camera>) => {
    await api.createCamera(data);
    await api.syncCameraAttribution();
    await load();
    setMode("idle");
    setMsg("✓ Kamera berhasil didaftarkan dan data lintasan disesuaikan.");
  };

  const handleUpdate = async (data: Partial<Camera>) => {
    if (!editing) return;
    await api.updateCamera(editing.camera_code, data);
    await api.syncCameraAttribution();
    await load();
    setMode("idle");
    setEditing(null);
    setMsg("✓ Kamera berhasil diperbarui.");
  };

  const handleDelete = async (cam: Camera) => {
    if (!confirm(`Hapus kamera "${cam.camera_code}"? Lintasannya akan menjadi 'Tidak Terdistribusi' (data asli tetap aman).`)) return;
    await api.deleteCamera(cam.camera_code);
    await api.syncCameraAttribution();
    await load();
    setMsg(`✓ Kamera ${cam.camera_code} berhasil dihapus.`);
  };

  const handleResync = async () => {
    const r = await api.syncCameraAttribution();
    setMsg(`✓ Berhasil memetakan ulang ${r.tagged} lintasan ke kameranya.`);
  };

  return (
    <GlassCard className="p-5">
      <GuideSwap title="Daftar Kamera" note="Daftar kamera yang terpasang di tiap gate. Kode Kamera dipakai perangkat gate untuk memperkenalkan diri ke pusat. Setiap gate kini mendeteksi truk masuk maupun keluar sendiri dari arah lintasan truk melewati garis tengah virtual pada video, jadi tidak ada lagi pengaturan arah per gate. Status menandai kamera itu sedang dipakai atau tidak.">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <Cctv className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold">Pendaftaran Kamera Pos</h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
            Daftar kamera aktif per pos pemeriksaan untuk merekam lintasan armada
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleResync} title="Petakan ulang lintasan ke kamera"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[var(--border)] text-[var(--text-secondary)] font-semibold text-xs rounded-lg hover:text-[var(--text-primary)] transition-colors cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" /> Sinkronkan Ulang
          </button>
          {mode === "idle" && (
            <button onClick={() => { setMode("add"); setEditing(null); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-slate-950 font-semibold text-xs rounded-lg hover:bg-amber-400 transition-colors cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Tambah Kamera
            </button>
          )}
        </div>
      </div>

      {msg && <p className="text-[11px] font-mono text-emerald-400 mb-3">{msg}</p>}

      {mode !== "idle" && (
        <div className="mb-4">
          <CameraForm
            editing={mode === "edit"}
            initial={editing ?? undefined}
            onSubmit={mode === "edit" ? handleUpdate : handleCreate}
            onCancel={() => { setMode("idle"); setEditing(null); }}
          />
        </div>
      )}

      {loading ? (
        <p className="text-xs text-[var(--text-dim)] font-mono py-6 text-center">Memuat data kamera…</p>
      ) : cameras.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] py-8 px-4 text-center">
          <FolderInput className="w-6 h-6 text-[var(--text-dim)] mx-auto mb-2" />
          <p className="text-xs text-[var(--text-secondary)] font-medium">Belum ada kamera terdaftar.</p>
          <p className="text-[11px] text-[var(--text-dim)] mt-1">
            Tambahkan kamera baru untuk memantau lintasan kendaraan pada setiap pos gerbang.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[var(--bg-elevated)] text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] border-b border-[var(--border)]">
                <th className="px-3 py-2.5">Kode Kamera</th>
                <th className="px-3 py-2.5">Pos / Lokasi</th>
                <th className="px-3 py-2.5">Folder Data</th>
                <th className="px-3 py-2.5">Alamat Kamera (RTSP)</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {cameras.map((c) => {
                const sm = STATUS_META[c.status] ?? STATUS_META.offline;
                const statusLabel = c.status === "online" ? "Aktif" : c.status === "offline" ? "Nonaktif" : "Perbaikan";
                return (
                  <tr key={c.camera_code} className="hover:bg-amber-500/[0.03] transition-colors">
                    <td className="px-3 py-2.5">
                      <span className="font-mono font-bold text-xs text-amber-500">{c.camera_code}</span>
                      <p className="text-[11px] text-[var(--text-secondary)]">{c.name}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--text-primary)]">{c.gate_location || "—"}</td>
                    <td className="px-3 py-2.5 text-[11px] font-mono text-[var(--text-secondary)]">{c.folder || "(utama)"}</td>
                    <td className="px-3 py-2.5 text-[11px] font-mono text-[var(--text-dim)] max-w-[180px] truncate" title={c.rtsp_url || ""}>
                      {c.rtsp_url || c.ip_host || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium capitalize ${sm.cls}`}>
                        {sm.icon} {statusLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditing(c); setMode("edit"); setMsg(null); }}
                          className="p-1.5 text-[var(--text-dim)] hover:text-amber-500 transition-colors cursor-pointer" title="Ubah">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(c)}
                          className="p-1.5 text-[var(--text-dim)] hover:text-rose-400 transition-colors cursor-pointer" title="Hapus">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </GuideSwap>
    </GlassCard>
  );
}
