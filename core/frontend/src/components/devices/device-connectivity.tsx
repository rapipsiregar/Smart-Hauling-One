"use client";

import React, { useState } from "react";
import { Copy, Check, KeyRound, Link2, ShieldAlert, Save } from "lucide-react";
import { ApiError, api } from "@/lib/api-client";
import { EdgeConfig } from "@/lib/types";

/**
 * The core↔edge link for one device, in one place.
 *
 * Three different kinds of value live here and they are deliberately not shown
 * as one uniform form, because they behave differently:
 *
 *   editable   RTSP URL and device IP — the device's own end, saved through
 *              `PUT /api/cameras/{code}` (they are camera identity fields, so
 *              editing them must NOT bump `config_version`).
 *   read-only  the core's address. The device needs it before it can reach the
 *              core, so it is copied into the Jetson's `.env` by hand; showing
 *              it here is how the two halves are kept from drifting.
 *   write-only the API key. Only its hash is stored, so it can be issued and
 *              rotated but never displayed again after the one response that
 *              creates it.
 */
export function DeviceConnectivity({
  config,
  onSaved,
}: {
  config: EdgeConfig;
  onSaved: (next: EdgeConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <h4 className="text-xs font-bold text-[var(--text-primary)]">Koneksi Pusat &amp; Perangkat Pos</h4>
      </div>

      <ReadOnlyField
        label="Alamat Pusat (diisi di perangkat)"
        value={config.core_url}
        hint="Alamat server pusat yang harus dihubungi perangkat pos. Salin nilai ini ke berkas pengaturan perangkat saat pemasangan."
      />

      <EndpointForm config={config} onSaved={onSaved} />

      <ApiKeyBlock config={config} onSaved={onSaved} />
    </div>
  );
}

/** The device's own endpoints. Saved via the camera route, not edge-config. */
function EndpointForm({
  config,
  onSaved,
}: {
  config: EdgeConfig;
  onSaved: (next: EdgeConfig) => void;
}) {
  const [rtsp, setRtsp] = useState(config.rtsp_url ?? "");
  const [host, setHost] = useState(config.ip_host ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = rtsp !== (config.rtsp_url ?? "") || host !== (config.ip_host ?? "");

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateCamera(config.camera_code, {
        // Empty input means "not set", which is null in the database — saving
        // "" would make a blank string look like a configured address.
        rtsp_url: rtsp.trim() || null,
        ip_host: host.trim() || null,
      });
      // Re-read rather than trusting the camera response: this card renders the
      // edge-config projection, which is a different shape.
      onSaved(await api.getEdgeConfig(config.camera_code));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.serverMessage ?? `Gagal menyimpan (${err.status})`
          : "Gagal menyimpan — server tidak terjangkau.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2.5">
      <TextField
        label="Alamat Video Kamera (RTSP)"
        value={rtsp}
        onChange={setRtsp}
        placeholder="rtsp://192.168.1.50:554/stream1"
        disabled={saving}
      />
      <TextField
        label="Alamat IP Perangkat Pos"
        value={host}
        onChange={setHost}
        placeholder="192.168.1.50"
        disabled={saving}
      />

      {error && <p className="text-xs font-medium text-rose-400">{error}</p>}

      {changed && (
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-slate-950 font-semibold text-xs rounded-lg hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Menyimpan…" : "Simpan Alamat"}
        </button>
      )}
    </div>
  );
}

/**
 * Issue or rotate the device credential.
 *
 * Two-step on purpose: rotating silently cuts a working gate off from the core
 * until someone updates its `.env`, and that is not a thing to do on a stray
 * click. The plaintext is rendered once and never re-fetched — closing it is
 * final, which the copy says plainly.
 */
function ApiKeyBlock({
  config,
  onSaved,
}: {
  config: EdgeConfig;
  onSaved: (next: EdgeConfig) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const issue = async () => {
    setWorking(true);
    setError(null);
    try {
      const result = await api.provisionDevice(config.camera_code);
      setIssued(result.api_key);
      setConfirming(false);
      onSaved(await api.getEdgeConfig(config.camera_code));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.serverMessage ?? `Gagal menerbitkan kunci (${err.status})`
          : "Gagal menerbitkan kunci — server tidak terjangkau.",
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--border)] p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <KeyRound className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
        <p className="text-xs font-semibold text-[var(--text-primary)]">Kunci Akses Perangkat</p>
        <span
          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
            config.api_key_set
              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
              : "text-amber-600 dark:text-amber-400 bg-amber-500/10"
          }`}
        >
          {config.api_key_set ? "SUDAH DITERBITKAN" : "BELUM ADA"}
        </span>
      </div>

      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
        Kunci hanya ditampilkan sekali saat diterbitkan. Sistem menyimpan sidik digitalnya saja,
        sehingga kunci lama tidak dapat ditampilkan ulang — jika hilang, terbitkan kunci baru.
      </p>

      {issued && <IssuedKey value={issued} onDismiss={() => setIssued(null)} />}

      {error && <p className="text-xs font-medium text-rose-400">{error}</p>}

      {!confirming && !issued && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border)] text-[var(--text-secondary)] font-semibold text-xs rounded-lg hover:text-amber-500 hover:border-amber-500/40 transition-colors cursor-pointer"
        >
          <KeyRound className="w-3.5 h-3.5" />
          {config.api_key_set ? "Terbitkan Ulang Kunci" : "Terbitkan Kunci"}
        </button>
      )}

      {confirming && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 space-y-2.5">
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-px" />
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              {config.api_key_set
                ? "Kunci lama langsung berhenti berlaku. Perangkat pos ini tidak dapat mengirim data sampai kunci baru dipasang di perangkat — data lintasan tetap ditahan di perangkat selama terputus."
                : "Kunci baru akan diterbitkan untuk perangkat pos ini dan hanya ditampilkan satu kali."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={issue}
              disabled={working}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 text-white font-semibold text-xs rounded-lg hover:bg-rose-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {working ? "Menerbitkan…" : "Ya, Terbitkan"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={working}
              className="px-3 py-1.5 border border-[var(--border)] text-[var(--text-secondary)] font-semibold text-xs rounded-lg hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function IssuedKey({ value, onDismiss }: { value: string; onDismiss: () => void }) {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
      <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
        Salin kunci ini sekarang — setelah ditutup, kunci tidak dapat ditampilkan lagi.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 text-[11px] font-mono break-all text-[var(--text-primary)] bg-[var(--surface)] rounded px-2 py-1.5">
          {value}
        </code>
        <CopyButton value={value} />
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
      >
        Saya sudah menyalinnya — tutup
      </button>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 text-[11px] font-mono break-all text-[var(--text-primary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-2">
          {value}
        </code>
        <CopyButton value={value} />
      </div>
      <p className="text-[11px] text-[var(--text-dim)] leading-relaxed mt-1">{hint}</p>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-[11px] font-mono text-[var(--text-primary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-2 focus:outline-none focus:border-amber-500/60 disabled:opacity-50"
      />
    </div>
  );
}

/** Clipboard copy with a short confirmation — the values here are long and typo-prone. */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be refused (insecure origin, denied permission).
      // The value is on screen and selectable, so this is not worth an error.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Salin"
      className="shrink-0 p-2 border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:text-amber-500 hover:border-amber-500/40 transition-colors cursor-pointer"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}
