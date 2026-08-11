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
  contractor: string;
  gate_name: string;
  crop_image_url?: string;
  video_url?: string;
  is_verified: boolean;
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
  status: 'ACTIVE' | 'MAINTENANCE' | 'IDLE' | 'OFFLINE';
  total_ritase_today: number;
  last_crossing_time: string;
}

export interface KPISummary {
  total_ritase_today: number;
  active_trucks: number;
  avg_ocr_accuracy: number; // e.g. 98.4
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

