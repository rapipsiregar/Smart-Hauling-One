"use client";

import React, { useState } from "react";
import { GuideSwap } from "@/components/ui/guide-note";
import { Camera } from "@/lib/types";
import { Save, X } from "lucide-react";

interface CameraFormProps {
  initial?: Partial<Camera>;
  editing: boolean;
  onSubmit: (data: Partial<Camera>) => Promise<void>;
  onCancel: () => void;
}

const EMPTY: Partial<Camera> = {
  camera_code: "", name: "", gate_location: "",
  status: "offline", folder: "", rtsp_url: "", ip_host: "", username: "",
  resolution: "", fps: null, install_date: "", notes: "",
};

export function CameraForm({ initial, editing, onSubmit, onCancel }: CameraFormProps) {
  const [form, setForm] = useState<Partial<Camera>>({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof Camera, v: string | number | null) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.camera_code?.trim() || !form.name?.trim()) {
      setError("Kode kamera dan nama tampilan wajib diisi.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch {
      setError("Gagal menyimpan — kode atau folder data kamera mungkin sudah digunakan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-[var(--bg-elevated)] p-4 space-y-3">
      <GuideSwap
        title={editing ? "Ubah Kamera" : "Daftarkan Kamera Baru"}
        note="Formulir pendaftaran kamera gate. Kode Kamera harus sama persis dengan yang dipakai perangkat di lokasi. Setiap gate kini mendeteksi truk masuk maupun keluar sendiri, dari arah lintasan truk melewati garis tengah virtual pada video — bukan dari pengaturan gate. Alamat RTSP dipakai untuk tayangan langsung."
      >
      <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
        {editing ? "Ubah Kamera" : "Daftarkan Kamera Baru"}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Kode Kamera *">
          <Input value={form.camera_code ?? ""} disabled={editing}
            onChange={(v) => set("camera_code", v.toUpperCase())} placeholder="CK-GATE-A" mono />
        </Field>
        <Field label="Nama Tampilan *">
          <Input value={form.name ?? ""} onChange={(v) => set("name", v)} placeholder="CK Gate A" />
        </Field>
        <Field label="Pos / Lokasi">
          <Input value={form.gate_location ?? ""} onChange={(v) => set("gate_location", v)} placeholder="CK Gate A" />
        </Field>
        <Field label="Folder Data" hint="kosong = folder utama">
          <Input value={form.folder ?? ""} onChange={(v) => set("folder", v)} placeholder="CK-GATE-A" mono />
        </Field>
        <Field label="Status Operasional">
          <Select value={form.status ?? "offline"} onChange={(v) => set("status", v)}
            options={[
              { value: "online", label: "Aktif" },
              { value: "offline", label: "Nonaktif" },
              { value: "maintenance", label: "Perbaikan" }
            ]} />
        </Field>
        <Field label="Alamat Kamera (URL Stream RTSP)" full>
          <Input value={form.rtsp_url ?? ""} onChange={(v) => set("rtsp_url", v)}
            placeholder="rtsp://10.0.0.5:554/stream1" mono />
        </Field>
        <Field label="Alamat IP Kamera">
          <Input value={form.ip_host ?? ""} onChange={(v) => set("ip_host", v)} placeholder="10.0.0.5" mono />
        </Field>
        <Field label="Username Masuk">
          <Input value={form.username ?? ""} onChange={(v) => set("username", v)} placeholder="operator" />
        </Field>
        <Field label="Resolusi Gambar">
          <Input value={form.resolution ?? ""} onChange={(v) => set("resolution", v)} placeholder="1920x1080" mono />
        </Field>
        <Field label="Kecepatan Deteksi (Gambar per Detik)">
          <Input value={form.fps == null ? "" : String(form.fps)} type="number"
            onChange={(v) => set("fps", v === "" ? null : Number(v))} placeholder="25" mono />
        </Field>
        <Field label="Tanggal Pemasangan">
          <Input value={form.install_date ?? ""} type="date" onChange={(v) => set("install_date", v)} />
        </Field>
        <Field label="Catatan Tambahan" full>
          <Input value={form.notes ?? ""} onChange={(v) => set("notes", v)} placeholder="Menara skid surya, tahan cuaca ekstrim…" />
        </Field>
      </div>

      {error && <p className="text-[11px] font-mono text-rose-400">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button onClick={handleSubmit} disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-slate-950 font-semibold text-xs rounded-lg hover:bg-amber-400 disabled:opacity-60 transition-colors cursor-pointer">
          <Save className="w-3.5 h-3.5" /> {saving ? "Menyimpan…" : editing ? "Simpan Perubahan" : "Daftarkan Kamera"}
        </button>
        <button onClick={onCancel} disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border)] text-[var(--text-secondary)] font-semibold text-xs rounded-lg hover:text-[var(--text-primary)] transition-colors cursor-pointer">
          <X className="w-3.5 h-3.5" /> Batal
        </button>
      </div>
      </GuideSwap>
    </div>
  );
}

function Field({ label, hint, full, children }: { label: string; hint?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-1">
        {label}{hint && <span className="text-[9px] normal-case tracking-normal text-[var(--text-dim)]">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, mono, type = "text", disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
  type?: string; disabled?: boolean;
}) {
  return (
    <input type={type} value={value} disabled={disabled}
      onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-amber-500 disabled:opacity-50 ${mono ? "font-mono" : ""}`} />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-amber-500 cursor-pointer">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
