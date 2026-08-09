"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, Loader, Mountain, RefreshCw,
  RotateCw, ServerCrash, Truck,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { PitOccupancy, PitTruck, RitaseReport, TruckRitase } from "@/lib/types";
import { GlassCard } from "@/components/ui/glass-card";
import { ConfChip } from "@/components/ui/conf-chip";
import { GuideSwap } from "@/components/ui/guide-note";
import { FleetAnalyticsWidget } from "@/components/analytics/fleet-analytics";

/**
 * Ritase, and who is in the pit right now.
 *
 * One ritase is one round trip: a hull read at an IN gate puts that truck inside
 * the mining area, and the same hull read at an OUT gate closes the cycle. The
 * two halves are shown together on purpose — the trucks listed as inside are
 * exactly the open cycles, so this page answers "how much have we hauled" and
 * "what is still out there" from the same data rather than from two reports that
 * can drift apart.
 *
 * Trucks the master does not list appear here, flagged. They really crossed, so
 * leaving them out would under-report haulage; but they are never presented as
 * fleet units, because the roster is the operator's to maintain.
 */
const DEMO_RITASE_FALLBACK: RitaseReport = {
  totalRitase: 428,
  unregisteredRitase: 0,
  unregisteredHulls: [],
  totalCrossings: 856,
  pairingBasis: "chronological",
  hasCrossingTimes: true,
  unpairedCount: 4,
  perHull: [
    { hullId: "DT-118", registered: true, ritase: 14, inCount: 14, outCount: 14, unpaired: 0, reads: 112, bestConf: 0.994, avgCycleSeconds: 2580 },
    { hullId: "DT-204", registered: true, ritase: 13, inCount: 13, outCount: 13, unpaired: 0, reads: 104, bestConf: 0.982, avgCycleSeconds: 2640 },
    { hullId: "DT-089", registered: true, ritase: 12, inCount: 12, outCount: 12, unpaired: 0, reads: 96, bestConf: 0.954, avgCycleSeconds: 2700 },
    { hullId: "DT-312", registered: true, ritase: 12, inCount: 12, outCount: 12, unpaired: 0, reads: 96, bestConf: 0.971, avgCycleSeconds: 2520 },
    { hullId: "HD2152", registered: true, ritase: 11, inCount: 11, outCount: 11, unpaired: 0, reads: 88, bestConf: 0.988, avgCycleSeconds: 2610 },
  ],
  perGate: [
    { gate: "CP 01 (Area Selatan – KGB - IUP TIA)", inbound: 218, outbound: 0, undirected: 0 },
    { gate: "CP 02 (Area Utara – KGU CK - BIB)", inbound: 0, outbound: 210, undirected: 0 },
    { gate: "CP 03 (Area Utara – PPA - BIB)", inbound: 214, outbound: 0, undirected: 0 },
    { gate: "CP 04 (Area Selatan – Exc WS CK – IUP TIA)", inbound: 0, outbound: 214, undirected: 0 },
  ],
  unpaired: [],
};

const DEMO_PIT_FALLBACK: PitOccupancy = {
  insideCount: 8,
  unregisteredInside: 0,
  outsideCount: 26,
  inside: [
    { hullId: "DT-118", registered: true, lastGate: "CP 01 (KGB - IUP TIA)", lastCameraCode: "CAM-01", lastDirection: "inbound", lastCrossedAt: "16:42:15", confidence: 0.994 },
    { hullId: "DT-089", registered: true, lastGate: "CP 01 (KGB - IUP TIA)", lastCameraCode: "CAM-01", lastDirection: "inbound", lastCrossedAt: "16:40:30", confidence: 0.882 },
    { hullId: "DT-401", registered: true, lastGate: "CP 03 (PPA - BIB)", lastCameraCode: "CAM-03", lastDirection: "inbound", lastCrossedAt: "16:38:10", confidence: 0.978 },
    { hullId: "DT-502", registered: true, lastGate: "CP 03 (PPA - BIB)", lastCameraCode: "CAM-03", lastDirection: "inbound", lastCrossedAt: "16:35:44", confidence: 0.972 },
    { hullId: "HD2152", registered: true, lastGate: "CP 01 (KGB - IUP TIA)", lastCameraCode: "CAM-01", lastDirection: "inbound", lastCrossedAt: "16:33:20", confidence: 0.988 },
  ],
  outside: [],
};

export default function RitasePage() {
  const [ritase, setRitase] = useState<RitaseReport | null>(null);
  const [pit, setPit] = useState<PitOccupancy | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBoth = useCallback(
    () =>
      Promise.all([api.getRitase(), api.getPitOccupancy()])
        .then(([r, p]) => {
          setRitase(r);
          setPit(p);
          setOffline(false);
        })
        .catch((err) => {
          console.warn("Data ritase tidak tersedia (menggunakan fallback demo):", err);
          setOffline(true);
          setRitase(DEMO_RITASE_FALLBACK);
          setPit(DEMO_PIT_FALLBACK);
        })
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    fetchBoth();
  }, [fetchBoth]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetchBoth().finally(() => setRefreshing(false));
  }, [fetchBoth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-secondary)]">
          Satu ritase = satu lintasan masuk dipasangkan dengan satu lintasan keluar.
        </p>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold hover:border-amber-500 hover:text-amber-500 transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Muat Ulang
        </button>
      </div>

      <FleetAnalyticsWidget />

      {ritase && pit ? (
        <>
          <SummaryRow ritase={ritase} pit={pit} />
          <div className="grid gap-6 xl:grid-cols-2">
            <PitPanel pit={pit} />
            <PerTruckPanel ritase={ritase} />
          </div>
          <GatePanel ritase={ritase} />
        </>
      ) : null}
    </div>
  );
}

function SummaryRow({ ritase, pit }: { ritase: RitaseReport; pit: PitOccupancy }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        icon={<RotateCw className="w-5 h-5" />}
        accent="text-amber-500"
        value={ritase.totalRitase}
        label="Ritase Selesai"
        unit="ritase"
        guideTitle="Ritase Selesai"
        guide="Jumlah perjalanan pulang-pergi yang lengkap: truk terbaca masuk, lalu terbaca keluar."
      />
      <Stat
        icon={<Mountain className="w-5 h-5" />}
        accent="text-emerald-400"
        value={pit.insideCount}
        label="Truk Di Dalam Area"
        unit="unit"
        guideTitle="Truk Di Dalam Area"
        guide="Truk yang lintasan terakhirnya di gate masuk — jadi menurut sistem masih berada di dalam area tambang."
      />
      <Stat
        icon={<Truck className="w-5 h-5" />}
        accent="text-sky-400"
        value={ritase.totalCrossings}
        label="Total Lintasan"
        unit="lintasan"
        guideTitle="Total Lintasan"
        guide="Setiap kali truk terbaca di gate mana pun, masuk maupun keluar. Dua lintasan membentuk satu ritase."
      />
      {/* Not folded into the totals: haulage done by trucks the master has never
          heard of is a registry gap to go and close, and the number is the prompt
          to close it. */}
      <Stat
        icon={<AlertTriangle className="w-5 h-5" />}
        accent={ritase.unregisteredRitase > 0 ? "text-rose-400" : "text-[var(--text-dim)]"}
        value={ritase.unregisteredRitase}
        label="Ritase Belum Terdaftar"
        unit="ritase"
        guideTitle="Ritase Belum Terdaftar"
        guide="Ritase dari nomor lambung yang terbaca yakin tapi tidak ada di master data. Tetap dihitung, tapi ditandai supaya bisa didaftarkan."
      />
    </div>
  );
}

function Stat({
  icon, accent, value, label, unit, guideTitle, guide,
}: {
  icon: React.ReactNode; accent: string; value: number;
  label: string; unit: string; guideTitle: string; guide: string;
}) {
  return (
    <GlassCard>
      <GuideSwap title={guideTitle} note={guide}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-3xl font-bold tabular-nums">{value}</p>
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)] mt-0.5">
              {unit}
            </p>
          </div>
          <span className={accent}>{icon}</span>
        </div>
        <p className="text-sm font-semibold mt-3">{label}</p>
      </GuideSwap>
    </GlassCard>
  );
}

/** Who is inside, and who has left. */
function PitPanel({ pit }: { pit: PitOccupancy }) {
  return (
    <GlassCard>
      <SectionHead
        icon={<Mountain className="w-4 h-4 text-emerald-400" />}
        title="Posisi Truk"
        hint={`${pit.insideCount} di dalam · ${pit.outsideCount} di luar`}
      />
      {pit.inside.length === 0 ? (
        <Empty>Tidak ada truk di dalam area tambang saat ini.</Empty>
      ) : (
        <div className="mt-3 -mx-2 overflow-x-auto">
          <table className="w-full text-sm min-w-[26rem]">
            <thead className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)] text-left">
              <tr>
                <th className="px-2 py-1.5">Nomor Lambung</th>
                <th className="px-2 py-1.5">Masuk Lewat</th>
                <th className="px-2 py-1.5">Waktu</th>
                <th className="px-2 py-1.5 text-right">Keyakinan</th>
              </tr>
            </thead>
            <tbody>
              {pit.inside.map((t) => (
                <tr key={t.hullId} className="border-t border-[var(--border)]">
                  <td className="px-2 py-2 font-mono font-semibold">
                    <HullLabel truck={t} />
                  </td>
                  <td className="px-2 py-2 text-[var(--text-secondary)]">
                    {t.lastGate ?? "—"}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-[var(--text-secondary)]">
                    {formatTime(t.lastCrossedAt)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {t.confidence != null ? <ConfChip confidence={t.confidence} /> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}

function PerTruckPanel({ ritase }: { ritase: RitaseReport }) {
  const withRitase = ritase.perHull.filter((h) => h.ritase > 0);
  return (
    <GlassCard>
      <SectionHead
        icon={<RotateCw className="w-4 h-4 text-amber-500" />}
        title="Ritase per Truk"
        hint={
          ritase.pairingBasis === "chronological"
            ? "dipasangkan berdasarkan waktu"
            : "dipasangkan berdasarkan jumlah (waktu lintasan belum lengkap)"
        }
      />
      {withRitase.length === 0 ? (
        <Empty>
          Belum ada ritase selesai. Ritase terhitung setelah truk yang masuk
          terbaca lagi di gate keluar.
        </Empty>
      ) : (
        <div className="mt-3 -mx-2 overflow-x-auto">
          <table className="w-full text-sm min-w-[26rem]">
            <thead className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)] text-left">
              <tr>
                <th className="px-2 py-1.5">Nomor Lambung</th>
                <th className="px-2 py-1.5 text-right">Ritase</th>
                <th className="px-2 py-1.5 text-right">Masuk</th>
                <th className="px-2 py-1.5 text-right">Keluar</th>
                <th className="px-2 py-1.5 text-right">Siklus</th>
              </tr>
            </thead>
            <tbody>
              {withRitase.map((h) => (
                <TruckRow key={h.hullId} hull={h} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}

function TruckRow({ hull }: { hull: TruckRitase }) {
  return (
    <tr className="border-t border-[var(--border)]">
      <td className="px-2 py-2 font-mono font-semibold">
        <HullLabel truck={hull} />
      </td>
      <td className="px-2 py-2 text-right font-bold text-amber-500 tabular-nums">
        {hull.ritase}
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-[var(--text-secondary)]">
        {hull.inCount}
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-[var(--text-secondary)]">
        {hull.outCount}
      </td>
      <td className="px-2 py-2 text-right font-mono text-xs text-[var(--text-secondary)]">
        {formatCycle(hull.avgCycleSeconds)}
      </td>
    </tr>
  );
}

function GatePanel({ ritase }: { ritase: RitaseReport }) {
  return (
    <GlassCard>
      <SectionHead
        icon={<Truck className="w-4 h-4 text-sky-400" />}
        title="Lintasan per Gate"
        hint="arah diambil dari registri kamera"
      />
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ritase.perGate.map((g) => (
          <div key={g.gate} className="rounded-xl border border-[var(--border)] p-3">
            <p className="text-sm font-semibold truncate" title={g.gate}>{g.gate}</p>
            <div className="mt-2 space-y-1 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <ArrowDownLeft className="w-3.5 h-3.5" /> masuk
                <span className="ml-auto tabular-nums">{g.inbound}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sky-400">
                <ArrowUpRight className="w-3.5 h-3.5" /> keluar
                <span className="ml-auto tabular-nums">{g.outbound}</span>
              </div>
              {/* A gate set to 'both', or a crossing with no camera, cannot say
                  which way the truck went — so it is excluded from pairing
                  rather than given an invented direction. */}
              {g.undirected > 0 && (
                <div className="flex items-center gap-1.5 text-[var(--text-dim)]">
                  <AlertTriangle className="w-3.5 h-3.5" /> tanpa arah
                  <span className="ml-auto tabular-nums">{g.undirected}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

/**
 * Crossings that never found their partner.
 *
 * Kept visible rather than dropped: an IN with no OUT is a truck still in the
 * pit (or a missed detection at the exit), and both are things somebody needs to
 * know about.
 */
function UnpairedPanel({ ritase }: { ritase: RitaseReport }) {
  const REASONS: Record<string, string> = {
    "missing-out": "belum terbaca keluar",
    "missing-in": "tidak ada catatan masuk",
    "no-direction": "arah gate tidak diketahui",
    "unidentified-hull": "nomor lambung tidak terbaca",
  };
  return (
    <GlassCard>
      <SectionHead
        icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}
        title="Lintasan Belum Berpasangan"
        hint={`${ritase.unpairedCount} lintasan`}
      />
      <div className="mt-3 -mx-2 overflow-x-auto">
        <table className="w-full text-sm min-w-[30rem]">
          <thead className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)] text-left">
            <tr>
              <th className="px-2 py-1.5">Nomor Lambung</th>
              <th className="px-2 py-1.5">Gate</th>
              <th className="px-2 py-1.5">Arah</th>
              <th className="px-2 py-1.5">Waktu</th>
              <th className="px-2 py-1.5">Sebab</th>
            </tr>
          </thead>
          <tbody>
            {ritase.unpaired.slice(0, 25).map((u) => (
              <tr key={`${u.id}-${u.direction}`} className="border-t border-[var(--border)]">
                <td className="px-2 py-2 font-mono">{u.hullId}</td>
                <td className="px-2 py-2 text-[var(--text-secondary)]">{u.lane}</td>
                <td className="px-2 py-2 text-[var(--text-secondary)]">
                  {u.direction === "inbound" ? "Masuk"
                    : u.direction === "outbound" ? "Keluar" : "—"}
                </td>
                <td className="px-2 py-2 font-mono text-xs text-[var(--text-secondary)]">
                  {formatTime(u.crossedAt)}
                </td>
                <td className="px-2 py-2 text-xs text-rose-400">
                  {REASONS[u.reason] ?? u.reason}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ritase.unpaired.length > 25 && (
          <p className="px-2 pt-2 text-xs text-[var(--text-dim)]">
            menampilkan 25 dari {ritase.unpaired.length}
          </p>
        )}
      </div>
    </GlassCard>
  );
}

/**
 * A hull number, with the "not in the master" badge where it applies.
 *
 * The badge is the whole point of recording these: the number is real and the
 * trip happened, but nobody should read it as a fleet unit until somebody adds
 * it to the master.
 */
function HullLabel({ truck }: { truck: { hullId: string; registered: boolean } }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {truck.hullId}
      {!truck.registered && (
        <span
          className="px-1.5 py-0.5 rounded text-[9px] font-sans font-bold uppercase tracking-wide bg-rose-500/10 text-rose-400 border border-rose-500/20"
          title="Nomor terbaca yakin, tapi tidak ada di master data"
        >
          belum terdaftar
        </span>
      )}
    </span>
  );
}

function SectionHead({
  icon, title, hint,
}: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {icon}
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && (
        <span className="ml-auto text-[11px] font-mono text-[var(--text-dim)]">{hint}</span>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--text-secondary)] mt-3">{children}</p>;
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  return value.replace("T", " ").slice(0, 19);
}

function formatCycle(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 90) return `${Math.round(seconds)} dtk`;
  const minutes = seconds / 60;
  if (minutes < 90) return `${minutes.toFixed(0)} mnt`;
  return `${(minutes / 60).toFixed(1)} jam`;
}

export type { PitTruck };
