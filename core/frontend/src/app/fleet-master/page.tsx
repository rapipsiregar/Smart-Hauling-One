"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { FleetMasterUnit } from "@/lib/types";
import { FleetMasterTable } from "@/components/fleet/fleet-master-table";
import { Loader } from "lucide-react";

/**
 * Data Master Armada — a read-only view of the operator's own fleet registry
 * (the ``trucks`` table), exactly as imported from their spreadsheet. This is
 * for manual verification of what's registered, not activity analysis — see
 * "Status Ritase & Posisi Truk" for that.
 */
export default function FleetMasterPage() {
  const [units, setUnits] = useState<FleetMasterUnit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getFleetMaster()
      .then(setUnits)
      .catch((e) => console.warn("Data master armada tidak tersedia (backend offline?):", e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <FleetMasterTable units={units} />
    </div>
  );
}
