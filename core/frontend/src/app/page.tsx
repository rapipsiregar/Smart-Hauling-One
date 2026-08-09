"use client";

import React from "react";
import { CctvMonitoringSection } from "@/components/monitoring/cctv-monitoring-section";
import { FuelAnalyticsWidget } from "@/components/analytics/fuel-analytics";
import { BottleneckAnalyticsWidget } from "@/components/analytics/bottleneck-analytics";

export default function CctvMonitoringPage() {
  return (
    <div className="space-y-6">
      <CctvMonitoringSection />
      <BottleneckAnalyticsWidget />
      <FuelAnalyticsWidget />
    </div>
  );
}
