"use client";

import React, { useState } from "react";
import { TrendingUp, Fuel, Truck, ShieldAlert, Clock, BarChart3 } from "lucide-react";
import { FuelAnalyticsWidget } from "@/components/analytics/fuel-analytics";
import { FleetAnalyticsWidget } from "@/components/analytics/fleet-analytics";
import { AuditOverrideLogWidget } from "@/components/analytics/audit-override-log";
import { BottleneckAnalyticsWidget } from "@/components/analytics/bottleneck-analytics";

type Tab = "all" | "fuel" | "fleet" | "audit" | "peak";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "all",   label: "Semua",         icon: BarChart3   },
  { id: "fuel",  label: "Solar & Emisi", icon: Fuel        },
  { id: "fleet", label: "Armada & OEM",  icon: Truck       },
  { id: "audit", label: "Audit Log",     icon: ShieldAlert },
  { id: "peak",  label: "Jam Puncak",    icon: Clock       },
];

export default function AnalyticsPage() {
  const [active, setActive] = useState<Tab>("all");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="glass-panel border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shrink-0">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] font-mono uppercase tracking-wide">
              Advanced Analytics Dashboard
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              4 Modul: Fuel & Green Mining · Fleet Age & OEM · OCR Audit Log · Heatmap Jam Puncak
            </p>
          </div>
        </div>

        {/* Tab Filter */}
        <div className="flex flex-wrap gap-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                active === id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {(active === "all" || active === "fuel")  && <FuelAnalyticsWidget />}
      {(active === "all" || active === "fleet") && <FleetAnalyticsWidget />}
      {(active === "all" || active === "audit") && <AuditOverrideLogWidget />}
      {(active === "all" || active === "peak")  && <BottleneckAnalyticsWidget />}
    </div>
  );
}
