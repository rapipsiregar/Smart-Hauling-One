import { CrossingLog, TruckAsset, TowerTelemetry, KPISummary, CycleTimePoint } from './types';

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

export const mockTrucks: TruckAsset[] = [
  { id: 'T-1', oht_id: 'DT-118', contractor: 'PT Tunas Inti Abadi', model: 'CAT 777E', capacity_tons: 98, status: 'ACTIVE', total_ritase_today: 14, last_crossing_time: '16:42:15', driver_name: 'Budi Santoso', compliance_score: 99 },
  { id: 'T-2', oht_id: 'DT-204', contractor: 'PT Borneo Indah Cemerlang', model: 'Komatsu HD785', capacity_tons: 91, status: 'ACTIVE', total_ritase_today: 12, last_crossing_time: '16:38:04', driver_name: 'Ahmad Rizal', compliance_score: 97 },
  { id: 'T-3', oht_id: 'DT-089', contractor: 'PT Tunas Inti Abadi', model: 'CAT 777D', capacity_tons: 95, status: 'MAINTENANCE', total_ritase_today: 8, last_crossing_time: '16:31:50', driver_name: 'Dedi Kurniawan', compliance_score: 91 },
  { id: 'T-4', oht_id: 'DT-312', contractor: 'PT Borneo Indah Cemerlang', model: 'Volvo FMX 480', capacity_tons: 45, status: 'ACTIVE', total_ritase_today: 16, last_crossing_time: '16:25:12', driver_name: 'Eko Prasetyo', compliance_score: 98 },
  { id: 'T-5', oht_id: 'DT-105', contractor: 'PT Tunas Inti Abadi', model: 'CAT 777E', capacity_tons: 98, status: 'ACTIVE', total_ritase_today: 13, last_crossing_time: '16:19:44', driver_name: 'Rudi Hartono', compliance_score: 100 },
];

export const mockTowers: TowerTelemetry[] = [
  { tower_id: 'TOW-01', name: 'Mobile Solar Tower Alpha (Pit Gate)', location: 'Pit North Checkpoint 1', battery_soc: 92, pv_voltage: 48.2, temperature: 34.5, signal_dbm: -64, mode: 'NORMAL_LTE', status: 'ONLINE', battery_trend: [80, 85, 90, 94, 92, 92] },
  { tower_id: 'TOW-02', name: 'Mobile Solar Tower Bravo (Port Gate)', location: 'Port Stockpile Access', battery_soc: 44, pv_voltage: 24.1, temperature: 41.2, signal_dbm: -82, mode: 'MONSOON_UHF', status: 'WARNING', battery_trend: [72, 60, 50, 46, 44, 44] },
];

export const mockCycleTime: CycleTimePoint[] = [
  { hour: '06:00', avg_cycle_minutes: 41, sla_target: 45, upper_bound: 52, lower_bound: 38 },
  { hour: '08:00', avg_cycle_minutes: 43, sla_target: 45, upper_bound: 52, lower_bound: 38 },
  { hour: '10:00', avg_cycle_minutes: 47, sla_target: 45, upper_bound: 52, lower_bound: 38 },
  { hour: '12:00', avg_cycle_minutes: 58, sla_target: 45, upper_bound: 52, lower_bound: 38 },
  { hour: '14:00', avg_cycle_minutes: 44, sla_target: 45, upper_bound: 52, lower_bound: 38 },
  { hour: '16:00', avg_cycle_minutes: 42, sla_target: 45, upper_bound: 52, lower_bound: 38 },
];

export async function fetchKPISummary(): Promise<KPISummary> {
  try {
    const res = await fetch(`${API_BASE}/system/health`);
    if (res.ok) return await res.json();
  } catch (e) {
    // Fallback gracefully to mock data
  }
  return mockKPIs;
}

export async function fetchCrossings(): Promise<CrossingLog[]> {
  try {
    const res = await fetch(`${API_BASE}/crossings`);
    if (res.ok) return await res.json();
  } catch (e) {
    // Fallback gracefully to mock data
  }
  return mockCrossings;
}
