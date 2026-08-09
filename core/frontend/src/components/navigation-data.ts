import {
  Video,
  FileText,
  Settings,
  Clock,
  Cpu,
  RotateCw,
  Radio,
  Wrench,
  LucideIcon,
  TrendingUp,
  Building2,
} from "lucide-react";


export type UserRole = "super_admin" | "gate_operator" | "logistics_auditor" | "field_technician";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  avatarText: string;
  defaultLanding: string;
}

export const DEMO_PROFILES: UserProfile[] = [
  { id: "usr-1", name: "Budi Santoso", email: "admin@ishs.co.id", role: "super_admin", roleTitle: "Supervisor Pusat", avatarText: "BS", defaultLanding: "/" },
  { id: "usr-2", name: "Ahmad Rizal", email: "operator@ishs.co.id", role: "gate_operator", roleTitle: "Operator Gerbang", avatarText: "AR", defaultLanding: "/gate-console" },
  { id: "usr-3", name: "Siti Rahma", email: "auditor@ishs.co.id", role: "logistics_auditor", roleTitle: "Logistics Auditor", avatarText: "SR", defaultLanding: "/ritase" },
  { id: "usr-4", name: "Dedi Kurniawan", email: "technician@ishs.co.id", role: "field_technician", roleTitle: "Teknisi Telemetri", avatarText: "DK", defaultLanding: "/maintenance" },
];

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
  section: string;
  roles?: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: "dashboard",
    label: "Monitoring CCTV",
    href: "/",
    icon: Video,
    match: (p) => p === "/",
    section: "Pemantauan",
    roles: ["super_admin", "gate_operator", "field_technician"],
  },
  {
    key: "gate-console",
    label: "Konsol Gerbang Edge",
    href: "/gate-console",
    icon: Radio,
    match: (p) => p.startsWith("/gate-console"),
    section: "Pemantauan",
    roles: ["super_admin", "gate_operator"],
  },
  {
    key: "ritase",
    label: "Ritase & Posisi Truk",
    href: "/ritase",
    icon: RotateCw,
    match: (p) => p.startsWith("/ritase"),
    section: "Data Ritase",
    roles: ["super_admin", "logistics_auditor"],
  },
  {
    key: "cctv-history",
    label: "Riwayat Pembacaan",
    href: "/cctv-history",
    icon: Clock,
    match: (p) => p.startsWith("/cctv-history"),
    section: "Data Ritase",
    roles: ["super_admin", "logistics_auditor"],
  },
  {
    key: "reports",
    label: "Laporan Harian & Shift",
    href: "/reports",
    icon: FileText,
    match: (p) => p.startsWith("/reports"),
    section: "Laporan",
    roles: ["super_admin", "logistics_auditor"],
  },
  {
    key: "maintenance",
    label: "Asset Maintenance",
    href: "/maintenance",
    icon: Wrench,
    match: (p) => p.startsWith("/maintenance"),
    section: "Pengaturan",
    roles: ["super_admin", "field_technician"],
  },
  {
    key: "settings",
    label: "Konfigurasi Sistem",
    href: "/settings",
    icon: Settings,
    match: (p) => p === "/settings",
    section: "Pengaturan",
    roles: ["super_admin"],
  },
  {
    key: "devices",
    label: "Perangkat Edge",
    href: "/settings/devices",
    icon: Cpu,
    match: (p) => p.startsWith("/settings/devices"),
    section: "Pengaturan",
    roles: ["super_admin", "field_technician"],
  },
  {
    key: "analytics",
    label: "Advanced Analytics",
    href: "/analytics",
    icon: TrendingUp,
    match: (p) => p.startsWith("/analytics"),
    section: "Laporan",
    roles: ["super_admin", "logistics_auditor"],
  },
  {
    key: "contractor",
    label: "Efisiensi Kontraktor",
    href: "/contractor",
    icon: Building2,
    match: (p) => p.startsWith("/contractor"),
    section: "Laporan",
    roles: ["super_admin", "logistics_auditor"],
  },
];


export const NAV_SECTIONS = ["Pemantauan", "Data Ritase", "Laporan", "Pengaturan"];


export const HEADINGS: Record<string, string> = {
  "/": "Monitoring CCTV",
  "/gate-console": "Konsol Gerbang Edge (Live OCR)",
  "/ritase": "Ritase & Posisi Truk",
  "/cctv-history": "Riwayat Pembacaan",
  "/reports": "Laporan Harian & Shift",
  "/analytics": "Advanced Analytics",
  "/contractor": "Efisiensi & Kinerja Kontraktor",
  "/maintenance": "Asset Maintenance & Regresi OLS",
  "/settings": "Konfigurasi Sistem",
  "/settings/devices": "Perangkat Edge",
  "/live": "Tayangan Langsung Gate",
};


