"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { MatchProbe, RANGES, Settings, api, readerName } from "@/lib/api";

/**
 * Inference settings and the match probe, behind one panel.
 *
 * Both were on the main screen before. Neither is watched -- they are reached
 * for when something looks wrong, and the rest of the time they were taking room
 * from the live view. The reference layout puts them behind a Settings button
 * for the same reason.
 *
 * The probe answers a question no other view can: "would this gate recognise
 * that number, and if not, why". It runs against the device's own replica of the
 * master, so it works with the centre unreachable -- which is exactly when
 * somebody is standing here asking it.
 */
export function SettingsDrawer({
  open, onClose, ocrBackend,
}: {
  open: boolean;
  onClose: () => void;
  ocrBackend: string;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Partial<Settings>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.settings().then((s) => { setSettings(s); setDraft(s); }).catch(() => undefined);
  }, [open]);

  if (!open) return null;

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const next = await api.saveSettings(draft);
      setSettings(next);
      setDraft(next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        className="w-full max-w-md h-full overflow-y-auto bg-[var(--bg)] border-l border-[var(--border)] p-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Pengaturan Perangkat</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </header>

        <section className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">
            Pengaturan Deteksi
          </p>
          {/* The core may push its own config later and that is expected -- it
              stays authoritative for fleet-wide policy. Changing a value here is
              for diagnosing this one device on the spot. */}
          <p className="text-[11px] text-[var(--text-secondary)]">
            Berlaku langsung di perangkat ini dan bertahan setelah restart. Pusat
            tetap dapat mengirim konfigurasinya sendiri nanti.
          </p>
          {settings ? (
            <div className="space-y-2.5">
              {(Object.keys(RANGES) as (keyof Settings)[]).map((key) => {
                const [low, high] = RANGES[key];
                const step = high <= 1 ? 0.01 : 1;
                return (
                  <label key={key} className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-[var(--text-secondary)] w-40 shrink-0">
                      {key}
                    </span>
                    <input
                      type="number"
                      min={low}
                      max={high}
                      step={step}
                      value={draft[key] ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: Number(e.target.value) })
                      }
                      className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-2 py-1 font-mono"
                    />
                    <span className="font-mono text-[10px] text-[var(--text-dim)] w-16 text-right">
                      {low}–{high}
                    </span>
                  </label>
                );
              })}
              <button
                onClick={save}
                disabled={saving}
                className="w-full px-3 py-1.5 rounded-lg border border-[var(--accent)] text-[var(--accent)] text-xs font-semibold disabled:opacity-60"
              >
                {saving ? "Menyimpan…" : "Simpan"}
              </button>
              {saved && <p className="text-[11px] text-[var(--success)]">Tersimpan.</p>}
              {error && <p className="text-[11px] text-[var(--danger)]">{error}</p>}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-secondary)]">Memuat…</p>
          )}
        </section>

        <section className="space-y-2 pt-2 border-t border-[var(--border)]">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">
            Mesin Pembaca Nomor
          </p>
          <p className="font-mono text-sm text-[var(--accent)]">{readerName(ocrBackend)}</p>
          {/* Read-only on purpose: swapping engines means loading a different
              model, which is a restart with a different SMART_GATE_OCR_BACKEND,
              not a toggle. Showing it here answers "why does this gate read
              differently from that one" without an ssh session. */}
          <p className="text-[11px] text-[var(--text-secondary)]">
            Ditentukan saat perangkat dijalankan. Mengubahnya perlu memuat
            model lain, jadi bukan saklar di layar.
          </p>
        </section>

        <MatchProbePanel />
      </aside>
    </div>
  );
}

function MatchProbePanel() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<MatchProbe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api.probe(text));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-2 pt-2 border-t border-[var(--border)]">
      <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">
        Uji Pencocokan
      </p>
      <p className="text-[11px] text-[var(--text-secondary)]">
        Ketik hasil pembacaan mentah (mis. <code>215Z</code>) untuk melihat unit
        mana yang dikenali perangkat ini — dan kalau tidak, kenapa.
      </p>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="215Z"
          className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs font-mono"
        />
        <button
          onClick={run}
          disabled={busy}
          className="px-3 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
        >
          <Search size={14} />
        </button>
      </div>
      {error && <p className="text-[11px] text-[var(--danger)]">{error}</p>}
      {result && (
        <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] font-mono">
          <dt className="text-[var(--text-secondary)]">Kode terbaca</dt>
          <dd className="text-right">{result.extracted_code ?? "—"}</dd>
          <dt className="text-[var(--text-secondary)]">Hasil</dt>
          <dd className="text-right text-[var(--accent)]">{result.outcome}</dd>
          <dt className="text-[var(--text-secondary)]">Nomor lambung</dt>
          <dd className="text-right">{result.hull_id ?? "—"}</dd>
          <dt className="text-[var(--text-secondary)]">Jarak</dt>
          <dd className="text-right">{result.distance}</dd>
          {result.ambiguous_candidates.length > 0 && (
            <>
              <dt className="text-[var(--text-secondary)] col-span-2 pt-1">
                Sama dekatnya — tidak ditebak:
              </dt>
              <dd className="col-span-2 text-[var(--warning)]">
                {result.ambiguous_candidates.join(", ")}
              </dd>
            </>
          )}
        </dl>
      )}
    </section>
  );
}
