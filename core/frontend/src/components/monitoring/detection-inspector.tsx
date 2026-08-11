"use client";

import React from "react";
import { CctvDetection } from "@/lib/types";
import { GlassCard } from "../ui/glass-card";
import { GuideSwap } from "../ui/guide-note";
import { mediaUrl } from "@/lib/media";
import { Cpu, CheckCircle2, AlertTriangle, Layers } from "lucide-react";

interface DetectionInspectorProps {
  detection: CctvDetection | null;
}

export function DetectionInspector({ detection }: DetectionInspectorProps) {
  if (!detection) {
    return (
      <GlassCard className="p-8 text-center">
        <GuideSwap title="Rincian Pembacaan" note="Panel ini menguraikan satu pembacaan yang Anda pilih dari daftar di kiri. Klik salah satu baris di sana untuk mengisinya.">
          <p className="font-mono text-[11px] text-[var(--text-dim)]">
            Pilih satu pembacaan untuk melihat rinciannya per gambar.
          </p>
        </GuideSwap>
      </GlassCard>
    );
  }

  const d = detection;
  const consensus = d.frameResults.filter((f) => f === d.ocrText).length;

  return (
    <GlassCard className="p-5 space-y-4">
      <GuideSwap title="Rincian Pembacaan" note="Uraian lengkap satu pembacaan. 'Voted Hull ID' adalah nomor lambung yang menang voting, dengan persentase keyakinannya. Di bawahnya: berapa gambar yang diperiksa, berapa kali AI berhasil membaca teks, dan seberapa yakin detektornya menemukan posisi plat. Lalu dua bukti visual — Foto Nomor Lambung adalah potongan gambar yang benar-benar dipakai untuk memutuskan, dan Gambar Penuh adalah frame utuh asalnya. Kalau salah satu kosong, memang tidak ada gambarnya tersimpan, bukan berarti kamera tidak melihat apa-apa. Terakhir, daftar hasil baca tiap gambar: hijau kalau sama dengan pemenang, abu-abu kalau berbeda.">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Rincian Pembacaan</h3>
        </div>
        {d.isConsistent ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Hasil Sesuai
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" /> Perhatian
          </span>
        )}
      </div>

      {/* Voted identity plate */}
      <div className="license-plate-card p-4 text-center">
        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] mb-1">
          Nomor Lambung Terverifikasi
        </p>
        <p className="font-mono font-bold text-3xl text-amber-500 tracking-tight">
          {d.ocrText || "BELUM TERBACA"}
        </p>
        <p className="text-[11px] font-mono text-[var(--text-secondary)] mt-1">
          {d.confidence.toFixed(1)}% Kejelasan Pembacaan
        </p>
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label="Jumlah Gambar" value={d.framesProcessed} />
        <Metric label="Pembacaan Berhasil" value={d.ocrReadCount} />
        <Metric label="Akurasi Posisi" value={`${d.detectionConfidence.toFixed(0)}%`} />
      </div>

      {/* The evidence, inline. It used to sit on a separate crossing page; a
          number without the picture it came from is a claim an operator cannot
          check, and making them navigate for it meant they mostly did not. */}
      <div className="grid grid-cols-2 gap-2">
        <Evidence
          label="Foto Nomor Lambung"
          hint="Potongan plat yang dipakai voting"
          src={d.imageProofUrl}
          empty="Tidak ada potongan gambar tersimpan untuk pembacaan ini."
        />
        <Evidence
          label="Gambar Penuh"
          hint="Frame utuh asal potongan itu"
          src={d.contextImageUrl}
          empty="Tidak ada gambar penuh tersimpan."
        />
      </div>

      {/* Frame-by-frame reads */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Layers className="w-3.5 h-3.5 text-[var(--text-dim)]" />
          <p className="text-[11px] font-medium text-[var(--text-secondary)]">
            Frame reads ({consensus}/{d.frameResults.length} agree)
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {d.frameResults.length === 0 && (
            <span className="text-[11px] text-[var(--text-dim)] font-mono">No text reads on these frames.</span>
          )}
          {d.frameResults.map((f, i) => (
            <span
              key={i}
              className={`px-2 py-0.5 rounded font-mono text-[11px] border ${
                f === d.ocrText
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border)]"
              }`}
            >
              {f}
            </span>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-[10px] font-mono text-[var(--text-dim)]">
        <span>MODEL: {d.aiModel}</span>
        <span>{d.location}</span>
      </div>
      </GuideSwap>
    </GlassCard>
  );
}

/**
 * One piece of visual evidence.
 *
 * Says plainly when there is nothing rather than showing a grey box: an
 * empty-window crossing genuinely has no crop, and an edge-submitted crossing
 * has no wider frame at all — the device sends the crop it voted on, not the
 * whole video (SRS §3.4). A placeholder would read as "camera saw nothing",
 * which is a different and wrong statement.
 */
function Evidence({
  label, hint, src, empty,
}: { label: string; hint: string; src: string | null; empty: string }) {
  const url = mediaUrl(src);
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)]">
        {label}
      </p>
      {url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={label}
            className="w-full aspect-video object-contain rounded-lg border border-[var(--border)] bg-black"
          />
          <p className="text-[10px] text-[var(--text-dim)]">{hint}</p>
        </>
      ) : (
        <div className="w-full aspect-video flex items-center justify-center px-3 text-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]">
          <span className="text-[10px] text-[var(--text-dim)] leading-snug">{empty}</span>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] py-2">
      <p className="font-mono font-bold text-lg text-[var(--text-primary)]">{value}</p>
      <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-dim)]">{label}</p>
    </div>
  );
}
