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
  online: { icon: <Wifi className="w-3 h-3" />, cls: "text-emerald-400" },
  offline: { icon: <WifiOff className="w-3 h-3" />, cls: "text-[var(--text-dim)]" },
  maintenance: { icon: <Wrench className="w-3 h-3" />, cls: "text-amber-400" },
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
    setMsg("✓ Camera registered and crossings re-attributed.");
  };

  const handleUpdate = async (data: Partial<Camera>) => {
    if (!editing) return;
    await api.updateCamera(editing.camera_code, data);
    await api.syncCameraAttribution();
    await load();
    setMode("idle");
    setEditing(null);
    setMsg("✓ Camera updated.");
  };

  const handleDelete = async (cam: Camera) => {
    if (!confirm(`Remove camera "${cam.camera_code}"? Its crossings become Unassigned (data is preserved).`)) return;
    await api.deleteCamera(cam.camera_code);
    await api.syncCameraAttribution();
    await load();
    setMsg(`✓ Camera ${cam.camera_code} removed.`);
  };

  const handleResync = async () => {
    const r = await api.syncCameraAttribution();
    setMsg(`✓ Re-attributed ${r.tagged} crossing(s) to their cameras.`);
  };

  return (
    <GlassCard className="p-5">
      <GuideSwap title="Daftar Kamera" note="Daftar kamera yang terpasang di tiap gate. Isian yang paling menentukan adalah Kode Kamera dan Arah: kode dipakai perangkat gate untuk memperkenalkan diri ke pusat, dan Arah (masuk/keluar) yang menentukan sebuah lintasan dihitung sebagai truk masuk atau truk keluar — salah mengisinya membuat perhitungan ritase ikut salah. Status menandai kamera itu sedang dipakai atau tidak.">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <Cctv className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold">Camera Registry</h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
            Per-gate cameras — each tags its own crossings via its playlist folder
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleResync} title="Re-attribute crossings to cameras"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[var(--border)] text-[var(--text-secondary)] font-semibold text-xs rounded-lg hover:text-[var(--text-primary)] transition-colors cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" /> Re-sync
          </button>
          {mode === "idle" && (
            <button onClick={() => { setMode("add"); setEditing(null); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-slate-950 font-semibold text-xs rounded-lg hover:bg-amber-400 transition-colors cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Add Camera
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
        <p className="text-xs text-[var(--text-dim)] font-mono py-6 text-center">Loading cameras…</p>
      ) : cameras.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] py-8 px-4 text-center">
          <FolderInput className="w-6 h-6 text-[var(--text-dim)] mx-auto mb-2" />
          <p className="text-xs text-[var(--text-secondary)] font-medium">No cameras registered yet.</p>
          <p className="text-[11px] text-[var(--text-dim)] mt-1">
            Add a camera and set its folder to <span className="font-mono">empty</span> to attribute the current playlist, or to a subfolder name for a specific gate.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[var(--bg-elevated)] text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] border-b border-[var(--border)]">
                <th className="px-3 py-2.5">Code</th>
                <th className="px-3 py-2.5">Gate / Location</th>
                <th className="px-3 py-2.5">Dir</th>
                <th className="px-3 py-2.5">Folder</th>
                <th className="px-3 py-2.5">Connection</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {cameras.map((c) => {
                const sm = STATUS_META[c.status] ?? STATUS_META.offline;
                return (
                  <tr key={c.camera_code} className="hover:bg-amber-500/[0.03] transition-colors">
                    <td className="px-3 py-2.5">
                      <span className="font-mono font-bold text-xs text-amber-500">{c.camera_code}</span>
                      <p className="text-[11px] text-[var(--text-secondary)]">{c.name}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--text-primary)]">{c.gate_location || "—"}</td>
                    <td className="px-3 py-2.5 text-[11px] font-medium uppercase text-[var(--text-secondary)]">{c.direction}</td>
                    <td className="px-3 py-2.5 text-[11px] font-mono text-[var(--text-secondary)]">{c.folder || "(root)"}</td>
                    <td className="px-3 py-2.5 text-[11px] font-mono text-[var(--text-dim)] max-w-[180px] truncate" title={c.rtsp_url || ""}>
                      {c.rtsp_url || c.ip_host || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium capitalize ${sm.cls}`}>
                        {sm.icon} {c.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditing(c); setMode("edit"); setMsg(null); }}
                          className="p-1.5 text-[var(--text-dim)] hover:text-amber-500 transition-colors cursor-pointer" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(c)}
                          className="p-1.5 text-[var(--text-dim)] hover:text-rose-400 transition-colors cursor-pointer" title="Delete">
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
