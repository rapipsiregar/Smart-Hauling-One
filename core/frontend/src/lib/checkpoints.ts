import { Camera } from "./types";

export interface Checkpoint {
  id: string;
  name: string;
  region: string;
  locationDetail: string;
  entities: string[];
  keterangan: string;
  status: "active" | "pending";
}

export const CHECKPOINTS: Checkpoint[] = [
  {
    id: "CP-01",
    name: "CP 01",
    region: "Area Selatan",
    locationDetail: "KGB - IUP TIA",
    entities: ["KGB", "PT. TIA"],
    keterangan: "-",
    status: "active",
  },
  {
    id: "CP-02",
    name: "CP 02",
    region: "Area Utara",
    locationDetail: "KGU CK - BIB",
    entities: ["PT. CK", "PT. BIB", "KGU"],
    keterangan: "-",
    status: "active",
  },
  {
    id: "CP-03",
    name: "CP 03",
    region: "Area Utara",
    locationDetail: "PPA - BIB",
    entities: ["PT. PPA", "PT. BIB"],
    keterangan: "-",
    status: "active",
  },
  {
    id: "CP-04",
    name: "CP 04",
    region: "Area Selatan",
    locationDetail: "Exc WS CK – IUP TIA",
    entities: ["PT. CK", "PT. TIA"],
    keterangan: "Dipasang setelah akses OB selesai di-progress",
    status: "pending",
  },
];

export const DEMO_CAMERAS: Camera[] = [
  {
    camera_code: "CAM-CP01",
    name: "Kamera CP 01 (KGB - IUP TIA)",
    gate_location: "CP 01 – Area Selatan (KGB - IUP TIA)",
    direction: "inbound",
    status: "online",
    folder: "data/01-playlist",
    rtsp_url: "rtsp://192.168.1.101:554/live",
    ip_host: "192.168.1.101",
    username: null,
    resolution: "1920x1080",
    fps: 25,
    install_date: "2026-01-15",
    last_seen: null,
    notes: "Kamera Utama CP 01 Area Selatan",
  },
  {
    camera_code: "CAM-CP02",
    name: "Kamera CP 02 (KGU CK - BIB)",
    gate_location: "CP 02 – Area Utara (KGU CK - BIB)",
    direction: "outbound",
    status: "online",
    folder: "data/01-playlist",
    rtsp_url: "rtsp://192.168.1.102:554/live",
    ip_host: "192.168.1.102",
    username: null,
    resolution: "1920x1080",
    fps: 25,
    install_date: "2026-01-15",
    last_seen: null,
    notes: "Kamera Utama CP 02 Area Utara",
  },
  {
    camera_code: "CAM-CP03",
    name: "Kamera CP 03 (PPA - BIB)",
    gate_location: "CP 03 – Area Utara (PPA - BIB)",
    direction: "inbound",
    status: "online",
    folder: "data/01-playlist",
    rtsp_url: "rtsp://192.168.1.103:554/live",
    ip_host: "192.168.1.103",
    username: null,
    resolution: "1920x1080",
    fps: 25,
    install_date: "2026-02-01",
    last_seen: null,
    notes: "Kamera Pos CP 03 PPA",
  },
  {
    camera_code: "CAM-CP04",
    name: "Kamera CP 04 (Exc WS CK – IUP TIA)",
    gate_location: "CP 04 – Area Selatan (Exc WS CK – IUP TIA)",
    direction: "outbound",
    status: "maintenance",
    folder: "data/01-playlist",
    rtsp_url: "rtsp://192.168.1.104:554/live",
    ip_host: "192.168.1.104",
    username: null,
    resolution: "1920x1080",
    fps: 25,
    install_date: "2026-03-10",
    last_seen: null,
    notes: "Dipasang setelah akses OB selesai di-progress",
  },
];
