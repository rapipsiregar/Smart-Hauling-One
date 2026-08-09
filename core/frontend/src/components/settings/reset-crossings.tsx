"use client";

import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { GlassCard } from "../ui/glass-card";
import { GuideSwap } from "../ui/guide-note";
import { AlertTriangle, Loader, Trash2 } from "lucide-react";

/**
 * Clear recorded detections so a test can be repeated from an empty database.
 *
 * Two-step by design. This deletes real work irreversibly, and a single click
 * next to the harmless "clear display preferences" button is too easy to hit by
 * mistake — so the first press only reveals what would go, with the actual
 * counts read from the server rather than guessed at.
 */
export function ResetCrossings() {
  const [counts, setCounts] = useState<{ crossings: number; detections: number; runs: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.resetCrossings>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api.getCrossingsResetPreview().then(setCounts).catch(() => setCounts(null));
  }, []);

  useEffect(refresh, [refresh]);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.resetCrossings());
      setConfirming(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const empty = counts != null && counts.crossings === 0;

  return (
    <GlassCard className="p-5">
      <GuideSwap
        title="Hapus Hasil Deteksi"
        note="Alat pengembangan. Satu tombol mengosongkan dua tempat sekaligus: lintasan di pusat beserta gambar platnya, LALU riwayat di tiap perangkat gate yang terdaftar. Keduanya perlu, karena tiap gate menyimpan datanya sendiri — kalau hanya pusat yang dihapus, gate masih memegang bacaan lama dan pengujian berikutnya dimulai dari dua catatan yang tidak sama. Gate yang sedang tidak terjangkau dilaporkan apa adanya, bukan dianggap berhasil. Daftar armada 276 unit, registri kamera, dan kunci perangkat TIDAK ikut terhapus — kehilangan salah satunya membuat sistem terlihat rusak padahal hanya kehilangan pengaturannya."
      >
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Hapus Hasil Deteksi
            </h3>
            <span className="font-mono text-[10px] uppercase tracking-widest text-amber-500 border border-amber-500/30 rounded px-1.5 py-0.5">
              pengembangan
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Mengosongkan lintasan di pusat <em>dan</em> di tiap perangkat gate, supaya
            pengujian bisa diulang dari nol. Daftar armada dan registri kamera tidak
            tersentuh.
          </p>
        </div>

        {counts && (
          <p className="font-mono text-[11px] text-[var(--text-dim)] mb-3">
            Tersimpan sekarang: {counts.crossings} lintasan · {counts.detections} pembacaan
            · {counts.runs} pemrosesan
          </p>
        )}

        {!confirming ? (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => { setConfirming(true); setResult(null); }}
              disabled={empty}
              className="inline-flex items-center gap-2 px-4 py-2 border border-rose-500/30 text-rose-400 font-semibold text-sm rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" /> Hapus Hasil Deteksi
            </button>
            {empty && (
              <span className="text-xs text-[var(--text-dim)]">
                Sudah kosong — tidak ada yang bisa dihapus.
              </span>
            )}
            {result && (
              <div className="w-full font-mono text-[11px] space-y-0.5">
                <p className="text-emerald-400">
                  Pusat: {result.removed.crossings} lintasan · {result.removed.detections} pembacaan
                  · {result.removed.snapshots} gambar dihapus. Master {result.kept.trucks} unit dan
                  {" "}{result.kept.cameras} kamera tetap.
                </p>
                {result.gates.length === 0 ? (
                  <p className="text-[var(--text-dim)]">
                    Tidak ada perangkat gate yang dikonfigurasi — hanya pusat yang dikosongkan.
                  </p>
                ) : (
                  result.gates.map((g) => (
                    <p key={g.url} className={g.ok ? "text-emerald-400" : "text-rose-400"}>
                      {g.ok
                        ? `Gate ${g.url}: ${g.removed?.crossings ?? 0} lintasan · ${g.removed?.snapshots ?? 0} gambar dihapus.`
                        : `Gate ${g.url}: GAGAL — ${g.error}. Perangkat ini masih memegang datanya.`}
                    </p>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-[var(--text-secondary)]">
                <p className="font-semibold text-rose-400">
                  Menghapus {counts?.crossings ?? 0} lintasan secara permanen.
                </p>
                <p className="mt-1">
                  Ikut terhapus: {counts?.detections ?? 0} pembacaan per-gambar,
                  {" "}{counts?.runs ?? 0} catatan pemrosesan, dan seluruh gambar plat.
                </p>
                <p className="mt-1">
                  Tetap aman: daftar armada, registri kamera, dan kunci perangkat gate.
                </p>
                <p className="mt-1 text-[var(--text-dim)]">
                  Riwayat di tiap perangkat gate ikut dihapus lewat tombol ini juga.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={run}
                disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500 text-white font-semibold text-sm rounded-lg hover:bg-rose-400 transition-colors cursor-pointer disabled:opacity-60"
              >
                {busy ? <Loader className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Ya, hapus
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="px-4 py-2 border border-[var(--border)] text-[var(--text-secondary)] font-semibold text-sm rounded-lg hover:border-[var(--text-dim)] transition-colors cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-2 font-mono text-[11px] text-rose-400">{error}</p>}
      </GuideSwap>
    </GlassCard>
  );
}
