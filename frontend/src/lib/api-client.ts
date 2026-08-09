import { CrossingLog, TruckAsset, TowerTelemetry, KPISummary, CycleTimePoint, OCRVotingFrame, MaintenanceTower, RegressionForecast } from './types';

// Real-time API Client with mock fallbacks for optimal UI responsiveness
const API_BASE = '/api';

export const mockKPIs: KPISummary = {
  total_ritase_today: 428,
  active_trucks: 34,
  avg_ocr_accuracy: 98.6,
  sla_compliance_rate: 96.5,
  active_alarms_count: 2,
  traffic_trend_diff: 14.2,
};

export const mockCrossings: CrossingLog[] = [
  {
    id: 'CRX-9942',
    timestamp: '16:42:15',
    oht_id: 'DT-118',
    confidence: 99.4,
    direction: 'INBOUND',
    cargo_status: 'LOADED',
    contractor: 'PT Tunas Inti Abadi',
    gate_name: 'Gate 01 - Pit North',
    crop_image_url: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=400&q=80',
    is_verified: true,
    cycle_time_minutes: 42,
  },
  {
    id: 'CRX-9941',
    timestamp: '16:38:04',
    oht_id: 'DT-204',
    confidence: 97.8,
    direction: 'OUTBOUND',
    cargo_status: 'EMPTY',
    contractor: 'PT Borneo Indah Cemerlang',
    gate_name: 'Gate 02 - Port Main',
    crop_image_url: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=400&q=80',
    is_verified: true,
    cycle_time_minutes: 38,
  },
  {
    id: 'CRX-9940',
    timestamp: '16:31:50',
    oht_id: 'DT-089',
    confidence: 88.2,
    direction: 'INBOUND',
    cargo_status: 'LOADED',
    contractor: 'PT Tunas Inti Abadi',
    gate_name: 'Gate 01 - Pit North',
    crop_image_url: 'https://images.unsplash.com/photo-1586191582056-a73c1d9326e3?auto=format&fit=crop&w=400&q=80',
    is_verified: false,
    notes: 'Pembacaan OCR butuh verifikasi manual (Conf < 90%)',
    cycle_time_minutes: 54,
  },
  {
    id: 'CRX-9939',
    timestamp: '16:25:12',
    oht_id: 'DT-312',
    confidence: 98.9,
    direction: 'OUTBOUND',
    cargo_status: 'EMPTY',
    contractor: 'PT Borneo Indah Cemerlang',
    gate_name: 'Gate 01 - Pit North',
    is_verified: true,
    cycle_time_minutes: 40,
  },
  {
    id: 'CRX-9938',
    timestamp: '16:19:44',
    oht_id: 'DT-105',
    confidence: 99.1,
    direction: 'INBOUND',
    cargo_status: 'LOADED',
    contractor: 'PT Tunas Inti Abadi',
    gate_name: 'Gate 02 - Port Main',
    is_verified: true,
    cycle_time_minutes: 44,
  },
];

export const mockVotingFrames: OCRVotingFrame[] = [
  { frame_index: 167, read_text: 'DT-118', confidence: 99.4, is_winner: true },
  { frame_index: 175, read_text: 'DT-118', confidence: 98.2, is_winner: true },
  { frame_index: 181, read_text: 'DT-110', confidence: 54.1, is_winner: false },
  { frame_index: 188, read_text: 'DT-118', confidence: 97.9, is_winner: true },
];

export const mockTrucks: TruckAsset[] = [
  { id: 'T-1', oht_id: 'DT-118', contractor: 'PT Tunas Inti Abadi', model: 'CAT 777E', capacity_tons: 98, status: 'ACTIVE', total_ritase_today: 14, last_crossing_time: '16:42:15', driver_name: 'Budi Santoso', compliance_score: 99 },
  { id: 'T-2', oht_id: 'DT-204', contractor: 'PT Borneo Indah Cemerlang', model: 'Komatsu HD785', capacity_tons: 91, status: 'ACTIVE', total_ritase_today: 12, last_crossing_time: '16:38:04', driver_name: 'Ahmad Rizal', compliance_score: 97 },
  { id: 'T-3', oht_id: 'DT-089', contractor: 'PT Tunas Inti Abadi', model: 'CAT 777D', capacity_tons: 95, status: 'MAINTENANCE', total_ritase_today: 8, last_crossing_time: '16:31:50', driver_name: 'Dedi Kurniawan', compliance_score: 91 },
  { id: 'T-4', oht_id: 'DT-312', contractor: 'PT Borneo Indah Cemerlang', model: 'Volvo FMX 480', capacity_tons: 45, status: 'ACTIVE', total_ritase_today: 16, last_crossing_time: '16:25:12', driver_name: 'Eko Prasetyo', compliance_score: 98 },
  { id: 'T-5', oht_id: 'DT-105', contractor: 'PT Tunas Inti Abadi', model: 'CAT 777E', capacity_tons: 98, status: 'ACTIVE', total_ritase_today: 13, last_crossing_time: '16:19:44', driver_name: 'Rudi Hartono', compliance_score: 100 },
];

export const mockTowers: TowerTelemetry[] = [
  { tower_id: 'TOW-01', name: 'Mobile Solar Tower Alpha (Pit Gate)', location: 'Pit North Checkpoint 1', battery_soc: 92, battery_voltage: 25.8, pv_voltage: 48.2, temperature: 34.5, vibration: 1.2, signal_dbm: -64, mode: 'NORMAL_LTE', status: 'ONLINE', battery_trend: [80, 85, 90, 94, 92, 92] },
  { tower_id: 'TOW-02', name: 'Mobile Solar Tower Bravo (Port Gate)', location: 'Port Stockpile Access', battery_soc: 44, battery_voltage: 23.4, pv_voltage: 24.1, temperature: 41.2, vibration: 4.8, signal_dbm: -82, mode: 'MONSOON_UHF', status: 'WARNING', battery_trend: [72, 60, 50, 46, 44, 44] },
];

export const mockMaintenanceTowers: MaintenanceTower[] = [
  {
    id: 'm-1',
    name: 'Tower Alpha - Pit North',
    location: 'Pit Gate 01',
    battery_health_pct: 94,
    lens_clarity_pct: 98,
    vibration_rms: 1.2,
    days_to_failure: 142,
    low_voltage_alert: false,
    voltage_history: [
      { time: '00:00', voltage: 25.8, threshold: 24.0 },
      { time: '04:00', voltage: 25.4, threshold: 24.0 },
      { time: '08:00', voltage: 26.2, threshold: 24.0 },
      { time: '12:00', voltage: 27.1, threshold: 24.0 },
      { time: '16:00', voltage: 26.5, threshold: 24.0 },
      { time: '20:00', voltage: 25.9, threshold: 24.0 },
    ],
  },
  {
    id: 'm-2',
    name: 'Tower Bravo - Port Access',
    location: 'Port Gate 02',
    battery_health_pct: 58,
    lens_clarity_pct: 72,
    vibration_rms: 4.8,
    days_to_failure: 12,
    low_voltage_alert: true,
    voltage_history: [
      { time: '00:00', voltage: 24.2, threshold: 24.0 },
      { time: '04:00', voltage: 23.8, threshold: 24.0 },
      { time: '08:00', voltage: 24.5, threshold: 24.0 },
      { time: '12:00', voltage: 25.1, threshold: 24.0 },
      { time: '16:00', voltage: 23.9, threshold: 24.0 },
      { time: '20:00', voltage: 23.4, threshold: 24.0 },
    ],
  },
];

export const mockRegressionForecasts: RegressionForecast[] = [
  { tower_name: 'Tower Alpha', metric: 'Skid Vibration', slope_m: 0.04, intercept_c: 1.1, r2_score: 0.96, hours_to_limit: 184 },
  { tower_name: 'Tower Bravo', metric: 'CPU Junction Temp', slope_m: 0.18, intercept_c: 38.2, r2_score: 0.94, hours_to_limit: 36 },
];

export const mockCycleTime: CycleTimePoint[] = [
  { hour: '06:00', avg_cycle_minutes: 41, sla_target: 45, upper_bound: 52, lower_bound: 38 },
  { hour: '08:00', avg_cycle_minutes: 43, sla_target: 45, upper_bound: 52, lower_bound: 38 },
  { hour: '10:00', avg_cycle_minutes: 47, sla_target: 45, upper_bound: 52, lower_bound: 38 },
  { hour: '12:00', avg_cycle_minutes: 58, sla_target: 45, upper_bound: 52, lower_bound: 38 },
  { hour: '14:00', avg_cycle_minutes: 44, sla_target: 45, upper_bound: 52, lower_bound: 38 },
  { hour: '16:00', avg_cycle_minutes: 42, sla_target: 45, upper_bound: 52, lower_bound: 38 },
];

export function isLiveModeEnabled(): boolean {
  return localStorage.getItem('smart_hauling_live_mode') === 'true';
}

export function toggleLiveMode(enabled: boolean): void {
  localStorage.setItem('smart_hauling_live_mode', enabled ? 'true' : 'false');
}

export async function fetchKPISummary(): Promise<KPISummary> {
  if (isLiveModeEnabled()) {
    try {
      const res = await fetch(`${API_BASE}/system/health`);
      if (res.ok) return await res.json();
    } catch (e) {
      // Fallback gracefully
    }
  }
  return mockKPIs;
}

export async function fetchCrossings(): Promise<CrossingLog[]> {
  if (isLiveModeEnabled()) {
    try {
      const res = await fetch(`${API_BASE}/crossings`);
      if (res.ok) return await res.json();
    } catch (e) {
      // Fallback gracefully
    }
  }
  return mockCrossings;
}

// ─── Analytics: Fuel & Green Mining ───────────────────────────────────────────
export interface FuelAnalytics {
  totalLiters: number;
  tiaLiters: number;
  bicLiters: number;
  tonPerLiter: number;
  idlingWasteLiters: number;
  idlingWastePct: number;
  targetTonPerLiter: number;
}

export const mockFuelAnalytics: FuelAnalytics = {
  totalLiters: 29960,
  tiaLiters: 16820,
  bicLiters: 13140,
  tonPerLiter: 14.24,
  idlingWasteLiters: 420,
  idlingWastePct: 1.4,
  targetTonPerLiter: 13.5,
};

// ─── Analytics: Fleet Age & OEM Brand Breakdown ───────────────────────────────
export interface FleetAgeBucket { label: string; count: number; pct: number; }
export interface OEMBreakdown { brand: string; model: string; count: number; avgConf: number; color: string; }

export const mockFleetAgeBuckets: FleetAgeBucket[] = [
  { label: '< 3 Tahun (2023–2026)', count: 142, pct: 51.4 },
  { label: '3–5 Tahun (2020–2022)', count: 98, pct: 35.5 },
  { label: '> 5 Tahun (< 2019)', count: 36, pct: 13.1 },
];

export const mockOEMBreakdown: OEMBreakdown[] = [
  { brand: 'Caterpillar', model: 'CAT 777E / 773D', count: 164, avgConf: 98.4, color: '#f59e0b' },
  { brand: 'Komatsu', model: 'HD785-7 / WT', count: 68, avgConf: 97.2, color: '#10b981' },
  { brand: 'Volvo', model: 'FMX 440 / FH16', count: 28, avgConf: 96.8, color: '#3b82f6' },
  { brand: 'Scania / Lainnya', model: 'P410 / Water Truck', count: 16, avgConf: 95.1, color: '#8b5cf6' },
];

// ─── Analytics: Manual OCR Override Audit Log ─────────────────────────────────
export interface AuditOverrideLog {
  id: string;
  timestamp: string;
  gate: string;
  rawOcr: string;
  rawConf: number;
  corrected: string;
  auditor: string;
  reason: string;
}

export const mockAuditLogs: AuditOverrideLog[] = [
  { id: 'OVR-801', timestamp: '16:31:50', gate: 'Gate 01 – Pit North', rawOcr: 'DT-089', rawConf: 54.1, corrected: 'DT-089', auditor: 'Siti Rahma', reason: 'Lensa terhalang debu tebal – dicocokkan log fisik' },
  { id: 'OVR-802', timestamp: '15:12:04', gate: 'Gate 02 – Port Main', rawOcr: 'HD-215Z', rawConf: 68.2, corrected: 'HD-2152', auditor: 'Budi Santoso', reason: 'Koreksi karakter Z → 2 (optical confusion)' },
  { id: 'OVR-803', timestamp: '14:05:22', gate: 'Gate 01 – Pit North', rawOcr: 'DT-10I', rawConf: 61.0, corrected: 'DT-105', auditor: 'Siti Rahma', reason: 'Koreksi huruf I → 5 (ambiguity resolved via master match)' },
  { id: 'OVR-804', timestamp: '13:48:11', gate: 'Gate 03 – South Pit 01', rawOcr: 'DT-31Z', rawConf: 72.4, corrected: 'DT-312', auditor: 'Ahmad Rizal', reason: 'Koreksi karakter Z → 2, cocok di fleet master BIC' },
  { id: 'OVR-805', timestamp: '12:02:33', gate: 'Gate 04 – South Pit 02', rawOcr: 'DT-II8', rawConf: 58.7, corrected: 'DT-118', auditor: 'Budi Santoso', reason: 'Double I ambiguity di bawah kondisi pencahayaan silau' },
];

// ─── Analytics: Peak Hour Gate Heatmap ────────────────────────────────────────
export interface PeakHourEntry { hour: string; gateA: number; gateB: number; gateC: number; gateD: number; }

export const mockPeakHours: PeakHourEntry[] = [
  { hour: '05:00', gateA: 4,  gateB: 2,  gateC: 1,  gateD: 3  },
  { hour: '06:00', gateA: 18, gateB: 14, gateC: 9,  gateD: 12 },
  { hour: '07:00', gateA: 42, gateB: 38, gateC: 22, gateD: 31 },
  { hour: '08:00', gateA: 35, gateB: 32, gateC: 19, gateD: 28 },
  { hour: '09:00', gateA: 28, gateB: 25, gateC: 16, gateD: 22 },
  { hour: '10:00', gateA: 24, gateB: 22, gateC: 14, gateD: 19 },
  { hour: '11:00', gateA: 20, gateB: 18, gateC: 12, gateD: 16 },
  { hour: '12:00', gateA: 15, gateB: 14, gateC: 9,  gateD: 12 },
  { hour: '13:00', gateA: 22, gateB: 20, gateC: 13, gateD: 17 },
  { hour: '14:00', gateA: 26, gateB: 24, gateC: 15, gateD: 20 },
  { hour: '15:00', gateA: 31, gateB: 28, gateC: 18, gateD: 24 },
  { hour: '16:00', gateA: 38, gateB: 35, gateC: 21, gateD: 29 },
  { hour: '17:00', gateA: 40, gateB: 36, gateC: 22, gateD: 30 },
  { hour: '18:00', gateA: 14, gateB: 12, gateC: 8,  gateD: 10 },
];

// ─── Analytics: Stagnant Truck Alerts ─────────────────────────────────────────
export interface StagnantAlert { truckId: string; entryGate: string; entryTime: string; elapsedMinutes: number; contractor: string; status: 'CRITICAL' | 'WARNING'; }

export const mockStagnantAlerts: StagnantAlert[] = [
  { truckId: 'DT-089', entryGate: 'Gate 01 – Pit North', entryTime: '16:42', elapsedMinutes: 94, contractor: 'PT Tunas Inti Abadi', status: 'CRITICAL' },
  { truckId: 'DT-204', entryGate: 'Gate 03 – South Pit 01', entryTime: '15:55', elapsedMinutes: 81, contractor: 'PT Borneo Indah Cemerlang', status: 'WARNING' },
];

// ─── Analytics: Contractor Efficiency ─────────────────────────────────────────
export interface ContractorEfficiency {
  name: string; shortName: string; totalTrucks: number; activeTrucks: number;
  totalRitase: number; avgCycleMin: number; avgConf: number; slaCompliance: number;
  color: string;
}

export const mockContractorData: ContractorEfficiency[] = [
  { name: 'PT Tunas Inti Abadi', shortName: 'TIA', totalTrucks: 148, activeTrucks: 34, totalRitase: 248, avgCycleMin: 42, avgConf: 98.4, slaCompliance: 97.2, color: '#f59e0b' },
  { name: 'PT Borneo Indah Cemerlang', shortName: 'BIC', totalTrucks: 96, activeTrucks: 22, totalRitase: 180, avgCycleMin: 45, avgConf: 96.8, slaCompliance: 94.5, color: '#10b981' },
  { name: 'PT Padang Pariaman Abadi', shortName: 'PPA', totalTrucks: 20, activeTrucks: 6, totalRitase: 0, avgCycleMin: 0, avgConf: 0, slaCompliance: 0, color: '#6366f1' },
  { name: 'CV Karya Kencana', shortName: 'CK', totalTrucks: 12, activeTrucks: 4, totalRitase: 0, avgCycleMin: 0, avgConf: 0, slaCompliance: 0, color: '#64748b' },
];


