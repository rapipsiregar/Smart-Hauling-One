export type NavigationTab = 
  | 'dashboard'
  | 'gate_console'
  | 'map'
  | 'ledger'
  | 'fleet'
  | 'ritase'
  | 'reports'
  | 'maintenance'
  | 'analytics'
  | 'contractor';



export interface CrossingLog {
  id: string;
  timestamp: string;
  oht_id: string;
  confidence: number;
  direction: 'INBOUND' | 'OUTBOUND';
  cargo_status?: 'LOADED' | 'EMPTY';
  contractor: string;
  gate_name: string;
  crop_image_url?: string;
  video_url?: string;
  is_verified: boolean;
  notes?: string;
  cycle_time_minutes?: number;
}

export interface OCRVotingFrame {
  frame_index: number;
  read_text: string;
  confidence: number;
  is_winner: boolean;
}

export interface TruckAsset {
  id: string;
  oht_id: string;
  contractor: string;
  model: string;
  capacity_tons?: number;
  status: 'ACTIVE' | 'MAINTENANCE' | 'IDLE' | 'OFFLINE';
  total_ritase_today: number;
  last_crossing_time: string;
  driver_name?: string;
  compliance_score?: number;
}

export interface TowerTelemetry {
  tower_id: string;
  name: string;
  location: string;
  battery_soc: number; // %
  battery_voltage: number; // Volts
  temperature: number; // Celsius
  vibration: number; // mm/s RMS
  pv_voltage: number;  // Volts
  signal_dbm: number;
  mode: 'NORMAL_LTE' | 'MONSOON_UHF';
  status: 'ONLINE' | 'WARNING' | 'CRITICAL';
  battery_trend: number[];
}

export interface MaintenanceTower {
  id: string;
  name: string;
  location: string;
  battery_health_pct: number;
  lens_clarity_pct: number;
  vibration_rms: number;
  days_to_failure: number;
  low_voltage_alert: boolean;
  voltage_history: { time: string; voltage: number; threshold: number }[];
}

export interface RegressionForecast {
  tower_name: string;
  metric: string;
  slope_m: number;
  intercept_c: number;
  r2_score: number;
  hours_to_limit: number;
}

export interface KPISummary {
  total_ritase_today: number;
  active_trucks: number;
  avg_ocr_accuracy: number; // e.g. 98.4
  sla_compliance_rate: number; // e.g. 96.2
  active_alarms_count: number;
  traffic_trend_diff: number; // e.g. +12%
}

export interface CycleTimePoint {
  hour: string;
  avg_cycle_minutes: number;
  sla_target: number;
  upper_bound: number;
  lower_bound: number;
}

export interface PeakTrafficHour {
  day: string;
  hour: number;
  count: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  data_table?: any[];
  chart_data?: any[];
}

