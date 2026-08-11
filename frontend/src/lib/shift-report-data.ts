// Shift report mock data & types for the unified frontend app
// Mirrors the data from core/frontend but adapted for Vite/React

export interface TruckRitase {
  hullId: string;
  registered: boolean;
  ritase: number;
  inCount: number;
  outCount: number;
  unpaired: number;
  reads: number;
  bestConf: number;
  avgCycleSeconds: number | null;
}

export interface GateBreakdown {
  gate: string;
  inbound: number;
  outbound: number;
  undirected: number;
}

export interface UnpairedCrossing {
  id: number;
  hullId: string;
  lane: string;
  direction: 'inbound' | 'outbound' | null;
  crossedAt: string;
  reason: 'missing-out' | 'missing-in' | 'no-direction' | 'unidentified-hull';
}

export interface ShiftReport {
  date: string;
  model: string;
  totalRitase: number;
  unregisteredRitase: number;
  unregisteredHulls: string[];
  totalCrossings: number;
  unpairedCount: number;
  pairingBasis: 'chronological' | 'count';
  hasCrossingTimes: boolean;
  identified: number;
  unknown: number;
  reconciled: number;
  uniqueTrucks: number;
  totalReads: number;
  avgConfidence: number;
  perGate: GateBreakdown[];
  perTruck: TruckRitase[];
  unpaired: UnpairedCrossing[];
}

export const DEMO_SHIFT_REPORT: ShiftReport = {
  date: '11 Agustus 2026',
  model: 'Model Deteksi Otomatis v2',
  totalRitase: 428,
  unregisteredRitase: 0,
  unregisteredHulls: [],
  totalCrossings: 856,
  unpairedCount: 4,
  pairingBasis: 'chronological',
  hasCrossingTimes: true,
  identified: 852,
  unknown: 4,
  reconciled: 428,
  uniqueTrucks: 34,
  totalReads: 3420,
  avgConfidence: 0.964,
  perGate: [
    { gate: 'CK Gate A (Pit North)', inbound: 218, outbound: 0, undirected: 0 },
    { gate: 'CK Gate B (Port Stockpile)', inbound: 0, outbound: 210, undirected: 0 },
    { gate: 'CK Gate C (South Pit 01)', inbound: 214, outbound: 0, undirected: 0 },
    { gate: 'CK Gate D (South Pit 02)', inbound: 0, outbound: 214, undirected: 0 },
  ],
  perTruck: [
    { hullId: 'DT-118', registered: true, ritase: 14, inCount: 14, outCount: 14, unpaired: 0, reads: 112, bestConf: 0.994, avgCycleSeconds: 2580 },
    { hullId: 'DT-204', registered: true, ritase: 13, inCount: 13, outCount: 13, unpaired: 0, reads: 104, bestConf: 0.982, avgCycleSeconds: 2640 },
    { hullId: 'DT-089', registered: true, ritase: 12, inCount: 12, outCount: 12, unpaired: 0, reads: 96,  bestConf: 0.954, avgCycleSeconds: 2700 },
    { hullId: 'DT-312', registered: true, ritase: 12, inCount: 12, outCount: 12, unpaired: 0, reads: 96,  bestConf: 0.971, avgCycleSeconds: 2520 },
    { hullId: 'DT-105', registered: true, ritase: 11, inCount: 11, outCount: 11, unpaired: 0, reads: 88,  bestConf: 0.991, avgCycleSeconds: 2610 },
    { hullId: 'HD-2152', registered: true, ritase: 11, inCount: 11, outCount: 11, unpaired: 0, reads: 88, bestConf: 0.988, avgCycleSeconds: 2580 },
    { hullId: 'HD-2221', registered: true, ritase: 11, inCount: 11, outCount: 11, unpaired: 0, reads: 88, bestConf: 0.960, avgCycleSeconds: 2590 },
    { hullId: 'DT-401', registered: true, ritase: 10, inCount: 10, outCount: 10, unpaired: 0, reads: 80,  bestConf: 0.978, avgCycleSeconds: 2650 },
    { hullId: 'DT-502', registered: true, ritase: 10, inCount: 10, outCount: 10, unpaired: 0, reads: 80,  bestConf: 0.972, avgCycleSeconds: 2700 },
    { hullId: 'DT-311', registered: true, ritase: 9, inCount: 9, outCount: 9, unpaired: 0, reads: 72,   bestConf: 0.961, avgCycleSeconds: 2730 },
  ],
  unpaired: [
    { id: 101, hullId: 'DT-089', lane: 'CK Gate A', direction: 'inbound', crossedAt: '16:42:15', reason: 'missing-out' },
    { id: 102, hullId: 'DT-105', lane: 'CK Gate C', direction: 'inbound', crossedAt: '16:44:00', reason: 'missing-out' },
    { id: 103, hullId: 'UNKNOWN', lane: 'CK Gate B', direction: null, crossedAt: '14:12:33', reason: 'unidentified-hull' },
    { id: 104, hullId: 'DT-204', lane: 'CK Gate D', direction: 'outbound', crossedAt: '15:55:10', reason: 'missing-in' },
  ],
};

export interface PitTruck {
  hullId: string;
  registered: boolean;
  lastGate: string | null;
  lastCrossedAt: string | null;
  confidence: number | null;
}

export const DEMO_PIT_OCCUPANCY = {
  insideCount: 8,
  outsideCount: 26,
  inside: [
    { hullId: 'DT-118', registered: true, lastGate: 'CK Gate A', lastCrossedAt: '16:42:15', confidence: 0.994 },
    { hullId: 'DT-089', registered: true, lastGate: 'CK Gate A', lastCrossedAt: '16:40:30', confidence: 0.882 },
    { hullId: 'DT-401', registered: true, lastGate: 'CK Gate C', lastCrossedAt: '16:38:10', confidence: 0.978 },
    { hullId: 'DT-502', registered: true, lastGate: 'CK Gate C', lastCrossedAt: '16:35:44', confidence: 0.972 },
    { hullId: 'HD-2152', registered: true, lastGate: 'CK Gate A', lastCrossedAt: '16:33:20', confidence: 0.988 },
    { hullId: 'DT-311', registered: true, lastGate: 'CK Gate C', lastCrossedAt: '16:30:05', confidence: 0.961 },
    { hullId: 'DT-204', registered: true, lastGate: 'CK Gate C', lastCrossedAt: '16:27:45', confidence: 0.982 },
    { hullId: 'DT-105', registered: true, lastGate: 'CK Gate A', lastCrossedAt: '16:24:00', confidence: 0.991 },
  ] as PitTruck[],
};

export function formatCycleTime(seconds: number | null): string {
  if (seconds == null) return '—';
  if (seconds < 90) return `${Math.round(seconds)} dtk`;
  const minutes = seconds / 60;
  if (minutes < 90) return `${minutes.toFixed(0)} mnt`;
  return `${(minutes / 60).toFixed(1)} jam`;
}
